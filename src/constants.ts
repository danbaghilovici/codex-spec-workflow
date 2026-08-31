export const PACKAGE_NAME = "codex-spec-workflow";
export const PACKAGE_VERSION = "0.1.0";
export const WORKFLOW_SCHEMA_VERSION = 1 as const;
export const WORKFLOW_ROOT = ".codex-specs";

export const SPEC_DOCUMENTS = [
  "requirements.md",
  "design.md",
  "tasks.md",
] as const;
export const BUG_DOCUMENTS = [
  "report.md",
  "analysis.md",
  "fix.md",
  "verification.md",
] as const;

export const SKILL_NAMES = [
  "spec-create",
  "spec-execute",
  "spec-list",
  "spec-status",
  "spec-steering-setup",
  "bug-create",
  "bug-analyze",
  "bug-fix",
  "bug-status",
  "bug-verify",
] as const;

export const AGENT_NAMES = [
  "spec-requirements-validator",
  "spec-design-validator",
  "spec-task-validator",
  "spec-task-executor",
] as const;

export const TEMPLATE_NAMES = [
  "requirements-template.md",
  "design-template.md",
  "tasks-template.md",
  "product-template.md",
  "tech-template.md",
  "structure-template.md",
  "bug-report-template.md",
  "bug-analysis-template.md",
  "bug-verification-template.md",
] as const;
