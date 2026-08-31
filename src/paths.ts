import path from "node:path";

import { ValidationError } from "./errors.js";

const WORKFLOW_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateWorkflowName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!WORKFLOW_NAME.test(normalized) || normalized.length > 80) {
    throw new ValidationError(
      `Invalid workflow name "${name}". Use 1-80 lowercase letters, digits, and single hyphens.`,
    );
  }
  return normalized;
}

export function resolveInside(root: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(root);
  const candidate = path.resolve(resolvedRoot, ...segments);
  if (
    candidate !== resolvedRoot &&
    !candidate.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new ValidationError(`Path escapes the allowed root: ${candidate}`);
  }
  return candidate;
}

export function relativeInside(root: string, candidate: string): string {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ValidationError(`Path is outside the allowed root: ${candidate}`);
  }
  return relative || ".";
}
