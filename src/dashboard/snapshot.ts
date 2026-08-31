import { spawnSync } from "node:child_process";
import path from "node:path";

import { WORKFLOW_ROOT } from "../constants.js";
import { exists } from "../fs-safe.js";
import type { WorkflowStatus } from "../status.js";
import { getWorkflowStatus } from "../status.js";
import { listWorkflows } from "../workflow-store.js";

export interface GitStatus {
  branch?: string;
  dirty?: boolean;
}

export interface DashboardProject {
  name: string;
  path: string;
  git: GitStatus;
  steering: string[];
  specs: WorkflowStatus[];
  bugs: WorkflowStatus[];
}

export interface DashboardSnapshot {
  generatedAt: string;
  projects: DashboardProject[];
}

function git(projectRoot: string, args: string[]): string | undefined {
  const result = spawnSync("git", ["-C", projectRoot, ...args], {
    encoding: "utf8",
    timeout: 2000,
  });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

async function projectSnapshot(projectRoot: string): Promise<DashboardProject> {
  const root = path.resolve(projectRoot);
  const workflows = await listWorkflows(root);
  const statuses = await Promise.all(
    workflows.map((workflow) =>
      getWorkflowStatus(root, workflow.kind, workflow.name),
    ),
  );
  const steering: string[] = [];
  for (const name of ["product.md", "tech.md", "structure.md"]) {
    if (await exists(path.join(root, WORKFLOW_ROOT, "steering", name)))
      steering.push(name);
  }
  const branch = git(root, ["branch", "--show-current"]);
  const porcelain = git(root, ["status", "--porcelain"]);
  return {
    name: path.basename(root),
    path: root,
    git: {
      ...(branch ? { branch } : {}),
      ...(porcelain !== undefined ? { dirty: porcelain.length > 0 } : {}),
    },
    steering,
    specs: statuses.filter((status) => status.workflow.kind === "spec"),
    bugs: statuses.filter((status) => status.workflow.kind === "bug"),
  };
}

export async function createDashboardSnapshot(
  projectRoots: string[],
): Promise<DashboardSnapshot> {
  return {
    generatedAt: new Date().toISOString(),
    projects: await Promise.all(projectRoots.map(projectSnapshot)),
  };
}
