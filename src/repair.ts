import { readdir } from "node:fs/promises";

import { BUG_DOCUMENTS, SPEC_DOCUMENTS, WORKFLOW_ROOT } from "./constants.js";
import { atomicWrite, exists, readUtf8 } from "./fs-safe.js";
import { resolveInside, validateWorkflowName } from "./paths.js";
import type {
  Approval,
  BugWorkflow,
  SpecWorkflow,
  WorkflowKind,
} from "./schemas.js";
import { parseTasks } from "./tasks.js";
import { createBugWorkflow, createSpecWorkflow } from "./transitions.js";

const APPROVED = /(?:✅\s*)?APPROVED|<!--\s*approved\s*-->/i;

export interface RepairResult {
  kind: WorkflowKind;
  name: string;
  action: "created" | "repaired" | "unchanged" | "skipped";
  warnings: string[];
}

function approval(content: string | undefined): Approval {
  return content && APPROVED.test(content)
    ? { status: "approved", approvedAt: new Date(0).toISOString() }
    : { status: "pending" };
}

async function documentContents(
  directory: string,
  names: readonly string[],
): Promise<Map<string, string>> {
  const documents = new Map<string, string>();
  for (const name of names) {
    const filePath = resolveInside(directory, name);
    if (await exists(filePath)) documents.set(name, await readUtf8(filePath));
  }
  return documents;
}

function inferredSpec(
  name: string,
  documents: Map<string, string>,
): SpecWorkflow {
  const workflow = createSpecWorkflow(name, name);
  workflow.approvals.requirements = approval(documents.get("requirements.md"));
  workflow.approvals.design = approval(documents.get("design.md"));
  workflow.approvals.tasks = approval(documents.get("tasks.md"));
  if (workflow.approvals.requirements.status === "approved") {
    workflow.phase = "design";
    if (workflow.approvals.design.status === "approved") {
      workflow.phase = "tasks";
      if (workflow.approvals.tasks.status === "approved") {
        workflow.phase = "implementation";
      }
    }
  }
  const tasks = parseTasks(documents.get("tasks.md") ?? "");
  if (
    workflow.phase === "implementation" &&
    tasks.length > 0 &&
    tasks.every((task) => task.completed)
  ) {
    workflow.phase = "complete";
  }
  return workflow;
}

function inferredBug(
  name: string,
  documents: Map<string, string>,
): BugWorkflow {
  const workflow = createBugWorkflow(name, name);
  workflow.approvals.report = approval(documents.get("report.md"));
  workflow.approvals.analysis = approval(documents.get("analysis.md"));
  workflow.approvals.fix = approval(documents.get("fix.md"));
  workflow.approvals.verification = approval(documents.get("verification.md"));
  if (workflow.approvals.report.status === "approved") {
    workflow.phase = "analysis";
    if (workflow.approvals.analysis.status === "approved") {
      workflow.phase = "fix";
      if (workflow.approvals.fix.status === "approved") {
        workflow.phase = "verification";
        if (workflow.approvals.verification.status === "approved") {
          workflow.phase = "complete";
        }
      }
    }
  }
  return workflow;
}

function ambiguityWarnings(
  kind: WorkflowKind,
  documents: Map<string, string>,
): string[] {
  const warnings: string[] = [];
  const order = kind === "spec" ? SPEC_DOCUMENTS : BUG_DOCUMENTS;
  for (let index = 1; index < order.length; index += 1) {
    const current = order[index]!;
    const previous = order[index - 1]!;
    if (
      documents.has(current) &&
      approval(documents.get(previous)).status !== "approved"
    ) {
      warnings.push(
        `${current} exists but ${previous} has no recognizable approval marker; phase was not inferred past that gate.`,
      );
      break;
    }
  }
  return warnings;
}

export async function repairWorkflows(
  projectRoot: string,
  options: { dryRun?: boolean; force?: boolean } = {},
): Promise<RepairResult[]> {
  const results: RepairResult[] = [];
  for (const kind of ["spec", "bug"] as const) {
    const parent = resolveInside(
      projectRoot,
      WORKFLOW_ROOT,
      kind === "spec" ? "specs" : "bugs",
    );
    let entries;
    try {
      entries = await readdir(parent, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      let name: string;
      try {
        name = validateWorkflowName(entry.name);
      } catch {
        results.push({
          kind,
          name: entry.name,
          action: "skipped",
          warnings: ["Directory name is not a valid workflow name."],
        });
        continue;
      }
      const directory = resolveInside(parent, name);
      const statePath = resolveInside(directory, "workflow.json");
      const hadState = await exists(statePath);
      if (hadState && !options.force) {
        results.push({ kind, name, action: "unchanged", warnings: [] });
        continue;
      }
      const documents = await documentContents(
        directory,
        kind === "spec" ? SPEC_DOCUMENTS : BUG_DOCUMENTS,
      );
      if (documents.size === 0) {
        results.push({
          kind,
          name,
          action: "skipped",
          warnings: ["No recognized workflow documents were found."],
        });
        continue;
      }
      const workflow =
        kind === "spec"
          ? inferredSpec(name, documents)
          : inferredBug(name, documents);
      const warnings = ambiguityWarnings(kind, documents);
      if (!options.dryRun) {
        await atomicWrite(statePath, `${JSON.stringify(workflow, null, 2)}\n`, {
          backup: Boolean(options.force),
          projectRoot,
        });
      }
      results.push({
        kind,
        name,
        action: hadState ? "repaired" : "created",
        warnings,
      });
    }
  }
  return results;
}
