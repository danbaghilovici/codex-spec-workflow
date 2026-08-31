import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  AGENT_NAMES,
  PACKAGE_NAME,
  PACKAGE_VERSION,
  SKILL_NAMES,
  TEMPLATE_NAMES,
  WORKFLOW_ROOT,
} from "./constants.js";
import {
  atomicWrite,
  checksum,
  checksumFile,
  exists,
  readUtf8,
} from "./fs-safe.js";
import { findPackageRoot } from "./package-root.js";
import { resolveInside } from "./paths.js";
import {
  InstallationManifestSchema,
  type InstallationManifest,
} from "./schemas.js";

const AGENTS_START = "<!-- codex-spec-workflow:start -->";
const AGENTS_END = "<!-- codex-spec-workflow:end -->";

const AGENTS_SECTION = `${AGENTS_START}
## Codex Spec Workflow

Apply this section only after the user explicitly invokes an installed skill whose name starts with
\`$spec-\` or \`$bug-\`. An ordinary feature, planning, implementation, debugging, or bug-fix request is
not workflow invocation. Neither existing \`.codex-specs/\` content nor a request matching a registered
spec or bug authorizes the workflow. Without an explicit workflow skill mention, do not initiate,
resume, advance, or enforce this workflow; handle the request normally.

Workflow state lives under \`.codex-specs/\`. Treat Markdown documents as the source of truth for
requirements, design, tasks, and bug content; use \`workflow.json\` for phase and approval state.

- Stop at every approval gate. Record approval with \`codex-spec workflow approve\` before advancing.
- Execute one approved spec task by default. Continue through multiple tasks sequentially only when
  the user explicitly requests them together. Validate and mark each task complete before the next.
- Prefer project templates in \`.codex-specs/templates/\` and preserve user customizations.
- Use the named read-only validator agents when available; follow the skill's local fallback otherwise.

Do not edit installation checksums by hand. Run \`codex-spec doctor\` to inspect the installation.
${AGENTS_END}`;

export type InstallActionStatus =
  "create" | "update" | "unchanged" | "preserve";

export interface InstallAction {
  path: string;
  status: InstallActionStatus;
  reason?: string;
}

export interface InstallResult {
  dryRun: boolean;
  actions: InstallAction[];
  manifest: InstallationManifest;
}

interface SourceFile {
  source: string;
  destination: string;
}

async function walkFiles(directory: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(candidate)));
    else if (entry.isFile()) files.push(candidate);
  }
  return files;
}

async function sourceFiles(
  projectRoot: string,
  packageRoot: string,
): Promise<SourceFile[]> {
  const files: SourceFile[] = [];
  for (const skill of SKILL_NAMES) {
    const root = resolveInside(packageRoot, "skills", skill);
    for (const source of await walkFiles(root)) {
      files.push({
        source,
        destination: resolveInside(
          projectRoot,
          ".agents",
          "skills",
          skill,
          path.relative(root, source),
        ),
      });
    }
  }
  for (const agent of AGENT_NAMES) {
    files.push({
      source: resolveInside(packageRoot, "agents", `${agent}.toml`),
      destination: resolveInside(
        projectRoot,
        ".codex",
        "agents",
        `${agent}.toml`,
      ),
    });
  }
  const templateRoot = resolveInside(
    packageRoot,
    "skills",
    "spec-create",
    "assets",
    "templates",
  );
  for (const template of TEMPLATE_NAMES) {
    files.push({
      source: resolveInside(templateRoot, template),
      destination: resolveInside(
        projectRoot,
        WORKFLOW_ROOT,
        "templates",
        template,
      ),
    });
  }
  return files;
}

async function previousManifest(
  projectRoot: string,
): Promise<InstallationManifest | undefined> {
  const filePath = resolveInside(projectRoot, WORKFLOW_ROOT, "install.json");
  if (!(await exists(filePath))) return undefined;
  try {
    const value: unknown = JSON.parse(await readUtf8(filePath));
    return InstallationManifestSchema.parse(value);
  } catch {
    return undefined;
  }
}

function withManagedAgentsSection(existing: string): string {
  const start = existing.indexOf(AGENTS_START);
  const end = existing.indexOf(AGENTS_END);
  if (start >= 0 && end >= start) {
    const after = end + AGENTS_END.length;
    return `${existing.slice(0, start)}${AGENTS_SECTION}${existing.slice(after)}`;
  }
  const separator = existing.trim() ? "\n\n" : "";
  return `${existing.trimEnd()}${separator}${AGENTS_SECTION}\n`;
}

export async function installWorkflow(
  projectRoot: string,
  options: { dryRun?: boolean; packageRoot?: string } = {},
): Promise<InstallResult> {
  const root = path.resolve(projectRoot);
  const packageRoot = options.packageRoot ?? (await findPackageRoot());
  const previous = await previousManifest(root);
  const actions: InstallAction[] = [];
  const managed: Record<string, string> = {};
  const preserved: string[] = [];

  for (const file of await sourceFiles(root, packageRoot)) {
    const relative = path
      .relative(root, file.destination)
      .split(path.sep)
      .join("/");
    const sourceContent = await readUtf8(file.source);
    const sourceChecksum = checksum(sourceContent);
    let status: InstallActionStatus = "create";
    let reason: string | undefined;
    if (await exists(file.destination)) {
      const currentChecksum = await checksumFile(file.destination);
      if (currentChecksum === sourceChecksum) status = "unchanged";
      else if (previous?.files[relative] === currentChecksum) status = "update";
      else {
        status = "preserve";
        reason = "Existing file is untracked or customized.";
      }
    }
    actions.push({ path: relative, status, ...(reason ? { reason } : {}) });
    if (status === "preserve") {
      preserved.push(relative);
      if (previous?.files[relative])
        managed[relative] = previous.files[relative];
      continue;
    }
    managed[relative] = sourceChecksum;
    if (!options.dryRun && status !== "unchanged") {
      await atomicWrite(file.destination, sourceContent, {
        backup: status === "update",
        projectRoot: root,
      });
    }
  }

  const agentsPath = resolveInside(root, "AGENTS.md");
  const existingAgents = (await exists(agentsPath))
    ? await readUtf8(agentsPath)
    : "";
  const nextAgents = withManagedAgentsSection(existingAgents);
  const agentsRelative = "AGENTS.md";
  const agentsStatus: InstallActionStatus =
    existingAgents === nextAgents
      ? "unchanged"
      : existingAgents
        ? "update"
        : "create";
  actions.push({ path: agentsRelative, status: agentsStatus });
  if (!options.dryRun && agentsStatus !== "unchanged") {
    await atomicWrite(agentsPath, nextAgents, {
      backup: agentsStatus === "update",
      projectRoot: root,
    });
  }

  const manifest: InstallationManifest = {
    schemaVersion: 1,
    package: PACKAGE_NAME,
    version: PACKAGE_VERSION,
    installedAt: new Date().toISOString(),
    files: managed,
    preserved,
  };
  if (!options.dryRun) {
    await atomicWrite(
      resolveInside(root, WORKFLOW_ROOT, "install.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { backup: true, projectRoot: root },
    );
  }
  return { dryRun: Boolean(options.dryRun), actions, manifest };
}

export const managedAgentsMarkers = {
  start: AGENTS_START,
  end: AGENTS_END,
} as const;
