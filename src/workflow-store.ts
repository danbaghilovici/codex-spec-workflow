import { readdir } from "node:fs/promises";
import path from "node:path";

import { BUG_DOCUMENTS, SPEC_DOCUMENTS, WORKFLOW_ROOT } from "./constants.js";
import { atomicWrite, exists, readUtf8 } from "./fs-safe.js";
import { ValidationError, WorkflowError } from "./errors.js";
import { resolveInside, validateWorkflowName } from "./paths.js";
import {
  BugWorkflowSchema,
  SpecWorkflowSchema,
  type Workflow,
  type WorkflowKind,
  WorkflowSchema,
} from "./schemas.js";
import { createBugWorkflow, createSpecWorkflow } from "./transitions.js";

export function workflowDirectory(
  projectRoot: string,
  kind: WorkflowKind,
  name: string,
): string {
  return resolveInside(
    projectRoot,
    WORKFLOW_ROOT,
    kind === "spec" ? "specs" : "bugs",
    validateWorkflowName(name),
  );
}

export function workflowStatePath(
  projectRoot: string,
  kind: WorkflowKind,
  name: string,
): string {
  return resolveInside(
    workflowDirectory(projectRoot, kind, name),
    "workflow.json",
  );
}

export async function readWorkflow(
  projectRoot: string,
  kind: WorkflowKind,
  name: string,
): Promise<Workflow> {
  const statePath = workflowStatePath(projectRoot, kind, name);
  try {
    const parsed: unknown = JSON.parse(await readUtf8(statePath));
    const workflow = WorkflowSchema.parse(parsed);
    if (workflow.kind !== kind)
      throw new ValidationError(`Expected ${kind} state in ${statePath}.`);
    return workflow;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkflowError(
        `Workflow state not found: ${path.relative(projectRoot, statePath)}`,
      );
    }
    throw error;
  }
}

export async function writeWorkflow(
  projectRoot: string,
  workflow: Workflow,
): Promise<void> {
  const validated = WorkflowSchema.parse(workflow);
  await atomicWrite(
    workflowStatePath(projectRoot, validated.kind, validated.name),
    `${JSON.stringify(validated, null, 2)}\n`,
    { backup: true, projectRoot },
  );
}

export interface InitializeWorkflowOptions {
  projectRoot: string;
  kind: WorkflowKind;
  name: string;
  title: string;
  description?: string;
  now?: Date;
}

export async function initializeWorkflow(
  options: InitializeWorkflowOptions,
): Promise<Workflow> {
  const name = validateWorkflowName(options.name);
  const directory = workflowDirectory(options.projectRoot, options.kind, name);
  const statePath = resolveInside(directory, "workflow.json");
  if (await exists(statePath))
    throw new WorkflowError(`${options.kind} "${name}" already exists.`);

  const workflow =
    options.kind === "spec"
      ? createSpecWorkflow(
          name,
          options.title,
          options.description,
          options.now,
        )
      : createBugWorkflow(
          name,
          options.title,
          options.description,
          options.now,
        );
  const schema =
    options.kind === "spec" ? SpecWorkflowSchema : BugWorkflowSchema;
  schema.parse(workflow);
  await atomicWrite(statePath, `${JSON.stringify(workflow, null, 2)}\n`, {
    projectRoot: options.projectRoot,
  });
  return workflow;
}

export async function listWorkflows(
  projectRoot: string,
  kind?: WorkflowKind,
): Promise<Workflow[]> {
  const kinds: WorkflowKind[] = kind ? [kind] : ["spec", "bug"];
  const workflows: Workflow[] = [];
  for (const currentKind of kinds) {
    const parent = resolveInside(
      projectRoot,
      WORKFLOW_ROOT,
      currentKind === "spec" ? "specs" : "bugs",
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
      try {
        workflows.push(
          await readWorkflow(projectRoot, currentKind, entry.name),
        );
      } catch {
        // Invalid state is reported by doctor/repair, not hidden behind a failing list operation.
      }
    }
  }
  return workflows.sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

export async function missingDocuments(
  projectRoot: string,
  workflow: Workflow,
): Promise<string[]> {
  const documents =
    workflow.kind === "spec"
      ? SPEC_DOCUMENTS.slice(
          0,
          workflow.phase === "requirements"
            ? 1
            : workflow.phase === "design"
              ? 2
              : 3,
        )
      : BUG_DOCUMENTS.slice(
          0,
          workflow.phase === "report"
            ? 1
            : workflow.phase === "analysis"
              ? 2
              : workflow.phase === "fix"
                ? 3
                : 4,
        );
  const directory = workflowDirectory(
    projectRoot,
    workflow.kind,
    workflow.name,
  );
  const missing: string[] = [];
  for (const document of documents) {
    if (!(await exists(resolveInside(directory, document))))
      missing.push(document);
  }
  return missing;
}
