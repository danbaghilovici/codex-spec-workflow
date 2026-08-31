import { z } from "zod";

import { WORKFLOW_SCHEMA_VERSION } from "./constants.js";

export const ApprovalSchema = z
  .object({
    status: z.enum(["pending", "approved"]),
    approvedAt: z.iso.datetime().optional(),
  })
  .superRefine((value, context) => {
    if (value.status === "approved" && !value.approvedAt) {
      context.addIssue({
        code: "custom",
        message: "approvedAt is required when status is approved",
        path: ["approvedAt"],
      });
    }
    if (value.status === "pending" && value.approvedAt) {
      context.addIssue({
        code: "custom",
        message: "approvedAt must be absent when status is pending",
        path: ["approvedAt"],
      });
    }
  });

const WorkflowBaseSchema = z.object({
  schemaVersion: z.literal(WORKFLOW_SCHEMA_VERSION),
  name: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const SpecPhaseSchema = z.enum([
  "requirements",
  "design",
  "tasks",
  "implementation",
  "complete",
]);

export const BugPhaseSchema = z.enum([
  "report",
  "analysis",
  "fix",
  "verification",
  "complete",
]);

export const SpecWorkflowSchema = WorkflowBaseSchema.extend({
  kind: z.literal("spec"),
  phase: SpecPhaseSchema,
  approvals: z.object({
    requirements: ApprovalSchema,
    design: ApprovalSchema,
    tasks: ApprovalSchema,
  }),
});

export const BugWorkflowSchema = WorkflowBaseSchema.extend({
  kind: z.literal("bug"),
  phase: BugPhaseSchema,
  approvals: z.object({
    report: ApprovalSchema,
    analysis: ApprovalSchema,
    fix: ApprovalSchema,
    verification: ApprovalSchema,
  }),
});

export const WorkflowSchema = z
  .discriminatedUnion("kind", [SpecWorkflowSchema, BugWorkflowSchema])
  .superRefine((workflow, context) => {
    if (workflow.kind === "spec") {
      const required =
        workflow.phase === "requirements"
          ? []
          : workflow.phase === "design"
            ? (["requirements"] as const)
            : workflow.phase === "tasks"
              ? (["requirements", "design"] as const)
              : (["requirements", "design", "tasks"] as const);
      for (const gate of required) {
        if (workflow.approvals[gate].status !== "approved") {
          context.addIssue({
            code: "custom",
            message: `${gate} must be approved before phase ${workflow.phase}`,
            path: ["approvals", gate],
          });
        }
      }
    } else {
      const required =
        workflow.phase === "report"
          ? []
          : workflow.phase === "analysis"
            ? (["report"] as const)
            : workflow.phase === "fix"
              ? (["report", "analysis"] as const)
              : workflow.phase === "verification"
                ? (["report", "analysis", "fix"] as const)
                : (["report", "analysis", "fix", "verification"] as const);
      for (const gate of required) {
        if (workflow.approvals[gate].status !== "approved") {
          context.addIssue({
            code: "custom",
            message: `${gate} must be approved before phase ${workflow.phase}`,
            path: ["approvals", gate],
          });
        }
      }
    }
  });

export type Approval = z.infer<typeof ApprovalSchema>;
export type SpecPhase = z.infer<typeof SpecPhaseSchema>;
export type BugPhase = z.infer<typeof BugPhaseSchema>;
export type SpecWorkflow = z.infer<typeof SpecWorkflowSchema>;
export type BugWorkflow = z.infer<typeof BugWorkflowSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
export type WorkflowKind = Workflow["kind"];

export const InstallationManifestSchema = z.object({
  schemaVersion: z.literal(1),
  package: z.literal("codex-spec-workflow"),
  version: z.string(),
  installedAt: z.iso.datetime(),
  files: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  preserved: z.array(z.string()).default([]),
});

export type InstallationManifest = z.infer<typeof InstallationManifestSchema>;
