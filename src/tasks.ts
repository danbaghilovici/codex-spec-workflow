import path from "node:path";

import { WORKFLOW_ROOT } from "./constants.js";
import { atomicWrite, readUtf8 } from "./fs-safe.js";
import { ValidationError, WorkflowError } from "./errors.js";
import { resolveInside, validateWorkflowName } from "./paths.js";

const TASK_PATTERN =
  /^(\s*)-\s*\[\s*([xX ]?)\s*\]\s*(\d+(?:\.\d+)*)\s*\.?\s+(.+?)\s*$/;
const METADATA_PATTERN =
  /_?(Requirements|Leverage|Depends on|Dependencies):\s*(.+?)(?:_\s*)?$/i;

export interface Task {
  id: string;
  description: string;
  completed: boolean;
  requirements?: string;
  leverage?: string;
  dependencies: string[];
  details: string[];
  line: number;
}

function dependencyIds(value: string): string[] {
  return [...value.matchAll(/\b\d+(?:\.\d+)*\b/g)].map((match) => match[0]);
}

export function normalizeTaskMarkdown(content: string): string {
  return content
    .split("\n")
    .map((line) => line.replace(/^(\s*-\s*)\[\s*\](\s*\d)/, "$1[ ]$2"))
    .join("\n");
}

export function parseTasks(content: string): Task[] {
  const tasks: Task[] = [];
  const lines = content.split(/\r?\n/);
  let current: Task | undefined;

  for (const [index, line] of lines.entries()) {
    const match = line.match(TASK_PATTERN);
    if (match) {
      current = {
        id: match[3]!,
        description: match[4]!.trim(),
        completed: match[2]!.toLowerCase() === "x",
        dependencies: [],
        details: [],
        line: index + 1,
      };
      tasks.push(current);
      continue;
    }

    if (!current) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      current = undefined;
      continue;
    }
    if (!trimmed) continue;

    const metadata = trimmed.replace(/^[-*]\s*/, "").match(METADATA_PATTERN);
    if (metadata) {
      const key = metadata[1]!.toLowerCase();
      const value = metadata[2]!.trim();
      if (key === "requirements") current.requirements = value;
      else if (key === "leverage") current.leverage = value;
      else current.dependencies = dependencyIds(value);
    } else if (/^\s+/.test(line)) {
      current.details.push(trimmed);
    }
  }

  return tasks;
}

export function validateTasks(tasks: Task[]): void {
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id))
      throw new ValidationError(`Duplicate task ID ${task.id}.`);
    ids.add(task.id);
  }
  for (const task of tasks) {
    for (const dependency of task.dependencies) {
      if (dependency === task.id) {
        throw new ValidationError(`Task ${task.id} depends on itself.`);
      }
      if (!ids.has(dependency)) {
        throw new ValidationError(
          `Task ${task.id} references missing dependency ${dependency}.`,
        );
      }
    }
  }
  detectCycles(tasks);
}

function detectCycles(tasks: Task[]): void {
  const dependencies = new Map(
    tasks.map((task) => [task.id, task.dependencies]),
  );
  const visited = new Set<string>();
  const active = new Set<string>();

  const visit = (id: string): void => {
    if (active.has(id))
      throw new ValidationError(`Task dependency cycle includes ${id}.`);
    if (visited.has(id)) return;
    active.add(id);
    for (const dependency of dependencies.get(id) ?? []) visit(dependency);
    active.delete(id);
    visited.add(id);
  };
  for (const task of tasks) visit(task.id);
}

export interface TaskSelection {
  task?: Task;
  blocked: Array<{ task: Task; unmet: string[] }>;
}

export function selectNextTask(tasks: Task[]): TaskSelection {
  validateTasks(tasks);
  const completed = new Set(
    tasks.filter((task) => task.completed).map((task) => task.id),
  );
  const blocked: TaskSelection["blocked"] = [];
  for (const task of tasks) {
    if (task.completed) continue;
    const unmet = task.dependencies.filter(
      (dependency) => !completed.has(dependency),
    );
    if (unmet.length === 0) return { task, blocked };
    blocked.push({ task, unmet });
  }
  return { blocked };
}

export function taskFilePath(projectRoot: string, specName: string): string {
  return resolveInside(
    projectRoot,
    WORKFLOW_ROOT,
    "specs",
    validateWorkflowName(specName),
    "tasks.md",
  );
}

export async function loadTasks(
  projectRoot: string,
  specName: string,
): Promise<Task[]> {
  const filePath = taskFilePath(projectRoot, specName);
  try {
    const tasks = parseTasks(await readUtf8(filePath));
    validateTasks(tasks);
    return tasks;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new WorkflowError(
        `Tasks file not found: ${path.relative(projectRoot, filePath)}`,
      );
    }
    throw error;
  }
}

export async function completeTask(
  projectRoot: string,
  specName: string,
  taskId: string,
): Promise<Task> {
  if (!/^\d+(?:\.\d+)*$/.test(taskId))
    throw new ValidationError(`Invalid task ID ${taskId}.`);
  const filePath = taskFilePath(projectRoot, specName);
  const content = await readUtf8(filePath);
  const tasks = parseTasks(content);
  validateTasks(tasks);
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new WorkflowError(`Task ${taskId} was not found.`);
  if (task.completed) return task;

  const completed = new Set(
    tasks.filter((candidate) => candidate.completed).map((item) => item.id),
  );
  const unmet = task.dependencies.filter(
    (dependency) => !completed.has(dependency),
  );
  if (unmet.length > 0) {
    throw new WorkflowError(
      `Task ${taskId} is blocked by incomplete dependencies: ${unmet.join(", ")}.`,
    );
  }

  const lines = content.split(/\r?\n/);
  const index = task.line - 1;
  lines[index] = lines[index]!.replace(/(\[)\s*(\])/, "$1x$2");
  const ending = content.endsWith("\n") ? "\n" : "";
  await atomicWrite(
    filePath,
    `${lines.join("\n").replace(/\n$/, "")}${ending}`,
    {
      backup: true,
      projectRoot,
    },
  );
  return { ...task, completed: true };
}

export function taskProgress(tasks: Task[]): {
  total: number;
  completed: number;
  percent: number;
} {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}
