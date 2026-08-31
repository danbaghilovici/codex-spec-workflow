import { exists } from "./fs-safe.js";
import type { Workflow } from "./schemas.js";
import { loadTasks, taskFilePath, taskProgress, type Task } from "./tasks.js";
import { missingDocuments, readWorkflow } from "./workflow-store.js";

export interface WorkflowStatus {
  workflow: Workflow;
  missingDocuments: string[];
  tasks?: Task[];
  progress?: ReturnType<typeof taskProgress>;
}

export async function getWorkflowStatus(
  projectRoot: string,
  kind: Workflow["kind"],
  name: string,
): Promise<WorkflowStatus> {
  const workflow = await readWorkflow(projectRoot, kind, name);
  const status: WorkflowStatus = {
    workflow,
    missingDocuments: await missingDocuments(projectRoot, workflow),
  };
  if (kind === "spec" && (await exists(taskFilePath(projectRoot, name)))) {
    const tasks = await loadTasks(projectRoot, name);
    status.tasks = tasks;
    status.progress = taskProgress(tasks);
  }
  return status;
}

export function formatStatus(status: WorkflowStatus): string {
  const { workflow } = status;
  const approvals = Object.entries(workflow.approvals)
    .map(([phase, approval]) => `  ${phase}: ${approval.status}`)
    .join("\n");
  const progress = status.progress
    ? `\nTasks: ${status.progress.completed}/${status.progress.total} (${status.progress.percent}%)`
    : "";
  const missing = status.missingDocuments.length
    ? `\nMissing documents: ${status.missingDocuments.join(", ")}`
    : "";
  return `${workflow.kind} ${workflow.name}\nPhase: ${workflow.phase}\nApprovals:\n${approvals}${progress}${missing}`;
}
