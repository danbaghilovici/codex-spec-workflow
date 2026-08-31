---
name: spec-execute
description: Execute approved specification tasks with dependency checks and per-task validation; continue beyond one task only when the user explicitly requests a multi-task run.
---

# Execute specification tasks

Take a spec name and an optional starting task ID. Read `codex-spec status spec <name>` and require
phase `implementation`. Select an explicit starting task with `codex-spec tasks show <name> <id>` or
the next dependency-ready task with `codex-spec tasks next <name>`.

Default to exactly one task per invocation. Continue across multiple tasks only when the user
explicitly asks to implement all, the remaining tasks, or multiple tasks together in the same
invocation. Task approval and `$spec-execute` invocation alone are not multi-task authorization; do
not infer it from urgency or broad implementation language.

Load context once with `codex-spec context spec <name>`. Execute tasks sequentially; never parallelize
write-heavy implementation tasks. For each selected task, use the `spec-task-executor` custom agent
when agents are available, passing that task and the approved context. If agents are unavailable,
implement locally with the same boundaries and current permission mode.

Keep each implementation step within the selected task's exact scope, reuse guidance, requirements,
and repository conventions. Run that task's acceptance checks and the smallest relevant regression
checks. A process exit code alone is not acceptance: inspect the behavior and criteria.

After a task's criteria and relevant checks pass, mark it complete:

```bash
codex-spec tasks complete <name> <id>
```

For the default single-task scope, report the next ready task and stop. When multi-task execution was
explicitly authorized, select the next dependency-ready task with `codex-spec tasks next <name>` and
continue in the same invocation without requesting confirmation between successfully completed
approved tasks.

When all tasks are complete, run `codex-spec workflow advance spec <name>` to close the spec. On a
failed acceptance check, implementation blocker, invalid task graph, or unavailable dependency, stop;
leave the affected checkbox unchanged and report exact evidence and a recovery path.
