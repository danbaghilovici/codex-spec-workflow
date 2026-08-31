import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";

import {
  AGENT_NAMES,
  SKILL_NAMES,
  TEMPLATE_NAMES,
  WORKFLOW_ROOT,
} from "./constants.js";
import { checksumFile, exists, readUtf8 } from "./fs-safe.js";
import { resolveInside } from "./paths.js";
import { InstallationManifestSchema, WorkflowSchema } from "./schemas.js";

export interface DoctorFinding {
  level: "ok" | "warning" | "error";
  check: string;
  message: string;
}

async function inspectWorkflowStates(
  projectRoot: string,
): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];
  for (const [kind, directoryName] of [
    ["spec", "specs"],
    ["bug", "bugs"],
  ] as const) {
    const directory = resolveInside(projectRoot, WORKFLOW_ROOT, directoryName);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const statePath = resolveInside(directory, entry.name, "workflow.json");
      if (!(await exists(statePath))) {
        findings.push({
          level: "warning",
          check: `${kind}:${entry.name}`,
          message: "workflow.json is missing; run codex-spec repair.",
        });
        continue;
      }
      try {
        WorkflowSchema.parse(JSON.parse(await readUtf8(statePath)) as unknown);
      } catch (error) {
        findings.push({
          level: "error",
          check: `${kind}:${entry.name}`,
          message: `Invalid workflow state: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }
  }
  return findings;
}

export async function runDoctor(projectRoot: string): Promise<DoctorFinding[]> {
  const findings: DoctorFinding[] = [];
  const codex = spawnSync("codex", ["--version"], { encoding: "utf8" });
  findings.push(
    codex.status === 0
      ? {
          level: "ok",
          check: "codex",
          message: (codex.stdout || codex.stderr).trim(),
        }
      : {
          level: "error",
          check: "codex",
          message: "Codex CLI was not found or did not run.",
        },
  );
  findings.push({
    level: "ok",
    check: "node",
    message: process.version,
  });

  const manifestPath = resolveInside(
    projectRoot,
    WORKFLOW_ROOT,
    "install.json",
  );
  let manifest;
  try {
    manifest = InstallationManifestSchema.parse(
      JSON.parse(await readUtf8(manifestPath)) as unknown,
    );
    findings.push({
      level: "ok",
      check: "manifest",
      message: `Installed version ${manifest.version}.`,
    });
  } catch (error) {
    findings.push({
      level: "error",
      check: "manifest",
      message: `Installation manifest is missing or invalid: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const required = [
    ...SKILL_NAMES.map((name) => `.agents/skills/${name}/SKILL.md`),
    ...AGENT_NAMES.map((name) => `.codex/agents/${name}.toml`),
    ...TEMPLATE_NAMES.map((name) => `${WORKFLOW_ROOT}/templates/${name}`),
  ];
  for (const relative of required) {
    const filePath = resolveInside(projectRoot, ...relative.split("/"));
    if (!(await exists(filePath))) {
      findings.push({
        level: "error",
        check: relative,
        message: "Required file is missing.",
      });
      continue;
    }
    if (manifest?.preserved.includes(relative)) {
      findings.push({
        level: "warning",
        check: relative,
        message:
          "File is intentionally preserved as a customization and is not auto-updated.",
      });
      continue;
    }
    const expected = manifest?.files[relative];
    if (expected && (await checksumFile(filePath)) !== expected) {
      findings.push({
        level: "warning",
        check: relative,
        message: "Managed file was customized; updates will preserve it.",
      });
    }
  }
  findings.push(...(await inspectWorkflowStates(projectRoot)));
  if (!findings.some((finding) => finding.level === "error")) {
    findings.push({
      level: "ok",
      check: "installation",
      message: "Installation is usable.",
    });
  }
  return findings;
}
