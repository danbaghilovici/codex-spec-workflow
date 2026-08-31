#!/usr/bin/env node
import path from "node:path";

import { Command, Option } from "commander";

import { PACKAGE_VERSION } from "./constants.js";
import { loadWorkflowContext } from "./context.js";
import { runDoctor } from "./doctor.js";
import { WorkflowError } from "./errors.js";
import { installWorkflow, type InstallResult } from "./installer.js";
import { migrateFromClaude } from "./migrate.js";
import { repairWorkflows } from "./repair.js";
import type { BugPhase, SpecPhase, WorkflowKind } from "./schemas.js";
import { getWorkflowStatus, formatStatus } from "./status.js";
import {
  completeTask,
  loadTasks,
  selectNextTask,
  taskProgress,
  validateTasks,
} from "./tasks.js";
import { setApproval, transitionWorkflow } from "./transitions.js";
import {
  initializeWorkflow,
  listWorkflows,
  readWorkflow,
  writeWorkflow,
} from "./workflow-store.js";

function kind(value: string): WorkflowKind {
  if (value !== "spec" && value !== "bug")
    throw new WorkflowError(`Invalid workflow kind ${value}.`);
  return value;
}

function project(value: string): string {
  return path.resolve(value);
}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printInstall(result: InstallResult): void {
  for (const action of result.actions) {
    process.stdout.write(
      `${action.status.padEnd(9)} ${action.path}${action.reason ? ` — ${action.reason}` : ""}\n`,
    );
  }
  process.stdout.write(
    `${result.dryRun ? "Dry run" : "Installation"} complete: ${result.actions.length} files inspected.\n`,
  );
}

const program = new Command()
  .name("codex-spec")
  .description("Deterministic state and setup tools for Codex Spec Workflow")
  .version(PACKAGE_VERSION);

program
  .command("install")
  .alias("init")
  .description(
    "Install or safely update skills, agents, templates, and AGENTS.md guidance",
  )
  .option("-p, --project <path>", "Target project", process.cwd())
  .option("--dry-run", "Preview changes without writing", false)
  .action(async (options: { project: string; dryRun: boolean }) => {
    printInstall(
      await installWorkflow(project(options.project), {
        dryRun: options.dryRun,
      }),
    );
  });

program
  .command("update")
  .description("Safely update managed installation files")
  .option("-p, --project <path>", "Target project", process.cwd())
  .option("--dry-run", "Preview changes without writing", false)
  .action(async (options: { project: string; dryRun: boolean }) => {
    printInstall(
      await installWorkflow(project(options.project), {
        dryRun: options.dryRun,
      }),
    );
  });

program
  .command("doctor")
  .alias("verify")
  .description("Verify Codex, installed files, checksums, and workflow state")
  .option("-p, --project <path>", "Target project", process.cwd())
  .option("--json", "Output JSON", false)
  .action(async (options: { project: string; json: boolean }) => {
    const findings = await runDoctor(project(options.project));
    if (options.json) printJson(findings);
    else {
      for (const finding of findings) {
        process.stdout.write(
          `${finding.level.toUpperCase().padEnd(7)} ${finding.check}: ${finding.message}\n`,
        );
      }
    }
    if (findings.some((finding) => finding.level === "error"))
      process.exitCode = 1;
  });

program
  .command("list")
  .description("List structured spec and bug workflows")
  .addOption(
    new Option("--kind <kind>", "Filter by kind").choices(["spec", "bug"]),
  )
  .option("-p, --project <path>", "Project root", process.cwd())
  .option("--json", "Output JSON", false)
  .action(
    async (options: {
      kind?: WorkflowKind;
      project: string;
      json: boolean;
    }) => {
      const root = project(options.project);
      const workflows = await listWorkflows(root, options.kind);
      const statuses = await Promise.all(
        workflows.map((workflow) =>
          getWorkflowStatus(root, workflow.kind, workflow.name),
        ),
      );
      if (options.json) printJson(statuses);
      else if (statuses.length === 0)
        process.stdout.write("No workflows found.\n");
      else {
        for (const status of statuses) {
          const progress = status.progress
            ? ` ${status.progress.completed}/${status.progress.total} tasks`
            : "";
          process.stdout.write(
            `${status.workflow.kind.padEnd(4)} ${status.workflow.name.padEnd(24)} ${status.workflow.phase}${progress}\n`,
          );
        }
      }
    },
  );

program
  .command("status <kind> <name>")
  .description("Show one workflow status")
  .option("-p, --project <path>", "Project root", process.cwd())
  .option("--json", "Output JSON", false)
  .action(
    async (
      kindValue: string,
      name: string,
      options: { project: string; json: boolean },
    ) => {
      const status = await getWorkflowStatus(
        project(options.project),
        kind(kindValue),
        name,
      );
      if (options.json) printJson(status);
      else process.stdout.write(`${formatStatus(status)}\n`);
    },
  );

const workflow = program
  .command("workflow")
  .description("Create and transition workflow state");

workflow
  .command("init <kind> <name>")
  .description("Initialize a spec or bug state file")
  .requiredOption("--title <title>", "Workflow title")
  .option("--description <description>", "Short description")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(
    async (
      kindValue: string,
      name: string,
      options: { title: string; description?: string; project: string },
    ) => {
      printJson(
        await initializeWorkflow({
          projectRoot: project(options.project),
          kind: kind(kindValue),
          name,
          title: options.title,
          ...(options.description ? { description: options.description } : {}),
        }),
      );
    },
  );

workflow
  .command("approve <kind> <name>")
  .description("Record explicit user approval for the current gate")
  .option("--phase <phase>", "Approval phase (defaults to current phase)")
  .option("--revoke", "Revoke approval instead", false)
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(
    async (
      kindValue: string,
      name: string,
      options: { phase?: string; revoke: boolean; project: string },
    ) => {
      const root = project(options.project);
      const current = await readWorkflow(root, kind(kindValue), name);
      const updated = setApproval(
        current,
        options.phase ?? current.phase,
        !options.revoke,
      );
      await writeWorkflow(root, updated);
      printJson(updated);
    },
  );

workflow
  .command("advance <kind> <name>")
  .description("Advance exactly one phase after its gate is satisfied")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(
    async (kindValue: string, name: string, options: { project: string }) => {
      const root = project(options.project);
      const current = await readWorkflow(root, kind(kindValue), name);
      const next =
        current.kind === "spec"
          ? (
              {
                requirements: "design",
                design: "tasks",
                tasks: "implementation",
                implementation: "complete",
              } as const
            )[current.phase as Exclude<SpecPhase, "complete">]
          : (
              {
                report: "analysis",
                analysis: "fix",
                fix: "verification",
                verification: "complete",
              } as const
            )[current.phase as Exclude<BugPhase, "complete">];
      if (!next)
        throw new WorkflowError(
          `${current.kind} ${current.name} is already complete.`,
        );
      let tasksComplete = false;
      if (current.kind === "spec" && current.phase === "implementation") {
        const tasks = await loadTasks(root, current.name);
        tasksComplete =
          tasks.length > 0 && tasks.every((task) => task.completed);
      }
      const updated = transitionWorkflow(current, next, { tasksComplete });
      await writeWorkflow(root, updated);
      printJson(updated);
    },
  );

const tasks = program
  .command("tasks")
  .description("Inspect and safely update spec tasks");

tasks
  .command("list <name>")
  .description("List parsed tasks")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(async (name: string, options: { project: string }) => {
    const values = await loadTasks(project(options.project), name);
    printJson({ tasks: values, progress: taskProgress(values) });
  });

tasks
  .command("show <name> <id>")
  .description("Show one parsed task")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(async (name: string, id: string, options: { project: string }) => {
    const task = (await loadTasks(project(options.project), name)).find(
      (candidate) => candidate.id === id,
    );
    if (!task) throw new WorkflowError(`Task ${id} was not found.`);
    printJson(task);
  });

tasks
  .command("next <name>")
  .description("Select the next pending task whose dependencies are complete")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(async (name: string, options: { project: string }) => {
    printJson(selectNextTask(await loadTasks(project(options.project), name)));
  });

tasks
  .command("validate <name>")
  .description("Validate task IDs and dependency graph")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(async (name: string, options: { project: string }) => {
    const values = await loadTasks(project(options.project), name);
    validateTasks(values);
    printJson({ valid: true, tasks: values.length });
  });

tasks
  .command("complete <name> <id>")
  .description("Atomically mark one dependency-ready task complete")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(async (name: string, id: string, options: { project: string }) => {
    printJson(await completeTask(project(options.project), name, id));
  });

program
  .command("context <kind> <name>")
  .description("Assemble steering and workflow Markdown context")
  .option("-p, --project <path>", "Project root", process.cwd())
  .action(
    async (kindValue: string, name: string, options: { project: string }) => {
      process.stdout.write(
        `${await loadWorkflowContext(project(options.project), kind(kindValue), name)}\n`,
      );
    },
  );

program
  .command("repair")
  .description(
    "Create or repair structured state from recognizable Markdown markers",
  )
  .option("-p, --project <path>", "Project root", process.cwd())
  .option("--dry-run", "Preview without writing", false)
  .option("--force", "Replace existing state after backing it up", false)
  .action(
    async (options: { project: string; dryRun: boolean; force: boolean }) => {
      printJson(
        await repairWorkflows(project(options.project), {
          dryRun: options.dryRun,
          force: options.force,
        }),
      );
    },
  );

program
  .command("migrate")
  .description("Migrate workflow data without modifying the source")
  .requiredOption("--from-claude", "Migrate from .claude workflow data")
  .option("--source <path>", "Custom Claude workflow directory")
  .option("-p, --project <path>", "Project root", process.cwd())
  .option("--dry-run", "Preview without writing", false)
  .option("--force", "Replace targets after backing them up", false)
  .action(
    async (options: {
      fromClaude: boolean;
      source?: string;
      project: string;
      dryRun: boolean;
      force: boolean;
    }) => {
      const root = project(options.project);
      printJson(
        await migrateFromClaude({
          projectRoot: root,
          ...(options.source ? { sourceRoot: options.source } : {}),
          dryRun: options.dryRun,
          force: options.force,
        }),
      );
    },
  );

program
  .command("dashboard")
  .description("Start the real-time multi-project dashboard")
  .option("-p, --project <path...>", "Project roots", [process.cwd()])
  .option("--host <host>", "Listen host", "127.0.0.1")
  .option("--port <number>", "Listen port", "8247")
  .option(
    "--read-only",
    "Reject non-read HTTP methods (recommended for tunnels)",
    false,
  )
  .action(
    async (options: {
      project: string[];
      host: string;
      port: string;
      readOnly: boolean;
    }) => {
      const { startDashboard } = await import("./dashboard/server.js");
      const dashboard = await startDashboard({
        projects: options.project.map(project),
        host: options.host,
        port: Number(options.port),
        readOnly: options.readOnly,
      });
      process.stdout.write(`Codex Spec Workflow dashboard: ${dashboard.url}\n`);
    },
  );

try {
  await program.parseAsync();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
