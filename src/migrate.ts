import { readdir } from "node:fs/promises";
import path from "node:path";

import {
  BUG_DOCUMENTS,
  SPEC_DOCUMENTS,
  TEMPLATE_NAMES,
  WORKFLOW_ROOT,
} from "./constants.js";
import { atomicWrite, exists, readUtf8 } from "./fs-safe.js";
import { resolveInside, validateWorkflowName } from "./paths.js";
import type {
  Approval,
  BugWorkflow,
  SpecWorkflow,
  WorkflowKind,
} from "./schemas.js";
import { normalizeTaskMarkdown, parseTasks } from "./tasks.js";
import { createBugWorkflow, createSpecWorkflow } from "./transitions.js";

const APPROVED = /(?:✅\s*)?APPROVED|<!--\s*approved\s*-->/i;

export interface MigrationAction {
  source: string;
  destination: string;
  status: "copy" | "normalize" | "preserve" | "skip";
  message?: string;
}

export interface MigrationReport {
  dryRun: boolean;
  actions: MigrationAction[];
  warnings: string[];
}

interface MigrationOptions {
  projectRoot: string;
  sourceRoot?: string;
  dryRun?: boolean;
  force?: boolean;
}

function markerApproval(content: string | undefined): Approval {
  return content && APPROVED.test(content)
    ? { status: "approved", approvedAt: new Date(0).toISOString() }
    : { status: "pending" };
}

async function copyManaged(
  source: string,
  destination: string,
  options: MigrationOptions,
  report: MigrationReport,
  transform?: (content: string) => string,
): Promise<string | undefined> {
  if (!(await exists(source))) return undefined;
  const content = await readUtf8(source);
  const output = transform ? transform(content) : content;
  const relativeSource = path.relative(options.projectRoot, source);
  const relativeDestination = path.relative(options.projectRoot, destination);
  if ((await exists(destination)) && !options.force) {
    report.actions.push({
      source: relativeSource,
      destination: relativeDestination,
      status: "preserve",
      message: "Destination exists; use --force to replace it with a backup.",
    });
    return content;
  }
  report.actions.push({
    source: relativeSource,
    destination: relativeDestination,
    status: transform && output !== content ? "normalize" : "copy",
  });
  if (!options.dryRun) {
    await atomicWrite(destination, output, {
      backup: Boolean(options.force),
      projectRoot: options.projectRoot,
    });
  }
  return content;
}

function specState(
  name: string,
  documents: Partial<Record<(typeof SPEC_DOCUMENTS)[number], string>>,
): SpecWorkflow {
  const workflow = createSpecWorkflow(name, name);
  workflow.approvals.requirements = markerApproval(
    documents["requirements.md"],
  );
  workflow.approvals.design = markerApproval(documents["design.md"]);
  workflow.approvals.tasks = markerApproval(documents["tasks.md"]);
  if (workflow.approvals.requirements.status === "approved") {
    workflow.phase = "design";
    if (workflow.approvals.design.status === "approved") {
      workflow.phase = "tasks";
      if (workflow.approvals.tasks.status === "approved") {
        workflow.phase = "implementation";
      }
    }
  }
  const tasks = parseTasks(documents["tasks.md"] ?? "");
  if (
    workflow.phase === "implementation" &&
    tasks.length > 0 &&
    tasks.every((task) => task.completed)
  ) {
    workflow.phase = "complete";
  }
  return workflow;
}

function bugState(
  name: string,
  documents: Partial<Record<(typeof BUG_DOCUMENTS)[number], string>>,
): BugWorkflow {
  const workflow = createBugWorkflow(name, name);
  workflow.approvals.report = markerApproval(documents["report.md"]);
  workflow.approvals.analysis = markerApproval(documents["analysis.md"]);
  workflow.approvals.fix = markerApproval(documents["fix.md"]);
  workflow.approvals.verification = markerApproval(
    documents["verification.md"],
  );
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

function reportAmbiguity(
  kind: WorkflowKind,
  name: string,
  documents: Partial<Record<string, string>>,
  warnings: string[],
): void {
  const order = kind === "spec" ? SPEC_DOCUMENTS : BUG_DOCUMENTS;
  for (let index = 1; index < order.length; index += 1) {
    const current = order[index]!;
    const previous = order[index - 1]!;
    if (
      documents[current] &&
      markerApproval(documents[previous]).status !== "approved"
    ) {
      warnings.push(
        `${kind} ${name}: ${current} exists but ${previous} has no approval marker; state remains at the earlier gate.`,
      );
      return;
    }
  }
}

async function migrateWorkflowKind(
  kind: WorkflowKind,
  options: MigrationOptions,
  sourceRoot: string,
  report: MigrationReport,
): Promise<void> {
  const sourceParent = resolveInside(
    sourceRoot,
    kind === "spec" ? "specs" : "bugs",
  );
  let entries;
  try {
    entries = await readdir(sourceParent, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  const documentNames = kind === "spec" ? SPEC_DOCUMENTS : BUG_DOCUMENTS;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let name: string;
    try {
      name = validateWorkflowName(entry.name);
    } catch {
      report.warnings.push(
        `${kind} directory ${entry.name} has an invalid name and was skipped.`,
      );
      continue;
    }
    const destinationDirectory = resolveInside(
      options.projectRoot,
      WORKFLOW_ROOT,
      kind === "spec" ? "specs" : "bugs",
      name,
    );
    const documents: Partial<Record<string, string>> = {};
    for (const documentName of documentNames) {
      const source = resolveInside(sourceParent, name, documentName);
      const destination = resolveInside(destinationDirectory, documentName);
      const content = await copyManaged(
        source,
        destination,
        options,
        report,
        documentName === "tasks.md" ? normalizeTaskMarkdown : undefined,
      );
      if (content !== undefined) documents[documentName] = content;
    }
    reportAmbiguity(kind, name, documents, report.warnings);
    const workflow =
      kind === "spec" ? specState(name, documents) : bugState(name, documents);
    const statePath = resolveInside(destinationDirectory, "workflow.json");
    if ((await exists(statePath)) && !options.force) {
      report.actions.push({
        source: path.relative(options.projectRoot, sourceParent),
        destination: path.relative(options.projectRoot, statePath),
        status: "preserve",
        message: "Structured state already exists.",
      });
    } else {
      report.actions.push({
        source: path.relative(options.projectRoot, sourceParent),
        destination: path.relative(options.projectRoot, statePath),
        status: "copy",
      });
      if (!options.dryRun) {
        await atomicWrite(statePath, `${JSON.stringify(workflow, null, 2)}\n`, {
          backup: Boolean(options.force),
          projectRoot: options.projectRoot,
        });
      }
    }
  }
}

export async function migrateFromClaude(
  options: MigrationOptions,
): Promise<MigrationReport> {
  const sourceRoot = options.sourceRoot
    ? path.resolve(options.sourceRoot)
    : resolveInside(options.projectRoot, ".claude");
  const report: MigrationReport = {
    dryRun: Boolean(options.dryRun),
    actions: [],
    warnings: [],
  };
  if (!(await exists(sourceRoot))) {
    report.warnings.push(`Claude workflow directory not found: ${sourceRoot}`);
    return report;
  }

  for (const name of ["product.md", "tech.md", "structure.md"]) {
    await copyManaged(
      resolveInside(sourceRoot, "steering", name),
      resolveInside(options.projectRoot, WORKFLOW_ROOT, "steering", name),
      options,
      report,
    );
  }
  for (const name of TEMPLATE_NAMES) {
    await copyManaged(
      resolveInside(sourceRoot, "templates", name),
      resolveInside(options.projectRoot, WORKFLOW_ROOT, "templates", name),
      options,
      report,
    );
  }
  await migrateWorkflowKind("spec", options, sourceRoot, report);
  await migrateWorkflowKind("bug", options, sourceRoot, report);
  return report;
}
