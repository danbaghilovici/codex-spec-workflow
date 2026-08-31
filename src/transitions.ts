import { TransitionError, ValidationError } from "./errors.js";
import type {
  BugPhase,
  BugWorkflow,
  SpecPhase,
  SpecWorkflow,
  Workflow,
} from "./schemas.js";

const pending = { status: "pending" } as const;

export function createSpecWorkflow(
  name: string,
  title: string,
  description?: string,
  now = new Date(),
): SpecWorkflow {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    kind: "spec",
    name,
    title,
    ...(description ? { description } : {}),
    phase: "requirements",
    approvals: { requirements: pending, design: pending, tasks: pending },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createBugWorkflow(
  name: string,
  title: string,
  description?: string,
  now = new Date(),
): BugWorkflow {
  const timestamp = now.toISOString();
  return {
    schemaVersion: 1,
    kind: "bug",
    name,
    title,
    ...(description ? { description } : {}),
    phase: "report",
    approvals: {
      report: pending,
      analysis: pending,
      fix: pending,
      verification: pending,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function setApproval(
  workflow: Workflow,
  phase: string,
  approved: boolean,
  now = new Date(),
): Workflow {
  if (phase === "implementation" || phase === "complete") {
    throw new ValidationError(
      `Phase "${phase}" does not have an approval gate.`,
    );
  }
  if (!(phase in workflow.approvals)) {
    throw new ValidationError(
      `Phase "${phase}" is not an approval gate for ${workflow.kind}.`,
    );
  }
  if (phase !== workflow.phase) {
    throw new ValidationError(
      `Only the current ${workflow.phase} gate can be ${approved ? "approved" : "revoked"}.`,
    );
  }

  const approval = approved
    ? ({ status: "approved", approvedAt: now.toISOString() } as const)
    : pending;
  return {
    ...workflow,
    approvals: { ...workflow.approvals, [phase]: approval },
    updatedAt: now.toISOString(),
  } as Workflow;
}

const SPEC_NEXT: Partial<Record<SpecPhase, SpecPhase>> = {
  requirements: "design",
  design: "tasks",
  tasks: "implementation",
  implementation: "complete",
};

const BUG_NEXT: Partial<Record<BugPhase, BugPhase>> = {
  report: "analysis",
  analysis: "fix",
  fix: "verification",
  verification: "complete",
};

export interface TransitionOptions {
  tasksComplete?: boolean;
  now?: Date;
}

export function transitionWorkflow(
  workflow: Workflow,
  target: SpecPhase | BugPhase,
  options: TransitionOptions = {},
): Workflow {
  const expected =
    workflow.kind === "spec"
      ? SPEC_NEXT[workflow.phase]
      : BUG_NEXT[workflow.phase];
  if (target !== expected) {
    throw new TransitionError(
      `Cannot transition ${workflow.kind} "${workflow.name}" from ${workflow.phase} to ${target}; expected ${expected ?? "no further phase"}.`,
    );
  }

  if (workflow.kind === "spec") {
    if (workflow.phase === "implementation") {
      if (!options.tasksComplete) {
        throw new TransitionError(
          "All implementation tasks must be complete before closing a spec.",
        );
      }
    } else if (workflow.phase === "complete") {
      throw new TransitionError(`Spec "${workflow.name}" is already complete.`);
    } else if (workflow.approvals[workflow.phase].status !== "approved") {
      throw new TransitionError(
        `The ${workflow.phase} phase requires explicit approval first.`,
      );
    }
  } else {
    if (workflow.phase === "complete") {
      throw new TransitionError(`Bug "${workflow.name}" is already complete.`);
    }
    if (workflow.approvals[workflow.phase].status !== "approved") {
      throw new TransitionError(
        `The ${workflow.phase} phase requires explicit approval first.`,
      );
    }
  }

  return {
    ...workflow,
    phase: target,
    updatedAt: (options.now ?? new Date()).toISOString(),
  } as Workflow;
}
