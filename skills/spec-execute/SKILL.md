---
name: spec-execute
description: Execute exactly one approved specification task with dependency checks, acceptance validation, and resumable completion state.
---

# Execute one specification task

Take a spec name and an optional task ID. Read `codex-spec status spec <name>` and require phase
`implementation`. Select an explicit task with `codex-spec tasks show <name> <id>` or the next
dependency-ready task with `codex-spec tasks next <name>`.

Load context once with `codex-spec context spec <name>`. Use the `spec-task-executor` custom agent
when agents are available, passing the selected task and context. Do not parallelize implementation
tasks. If agents are unavailable, implement locally with the same boundaries and current permission
mode.

Implement only the selected task. Follow its exact scope, reuse guidance, requirements, and repository
conventions. Run the task's acceptance checks and the smallest relevant regression checks. A process
exit code alone is not acceptance: inspect the behavior and criteria.

Mark completion only after all criteria and relevant checks pass:

```bash
codex-spec tasks complete <name> <id>
```

If this was the final task, run `codex-spec workflow advance spec <name>` to close the spec. Otherwise
report the next ready task but do not execute it. On failures or blocked dependencies, leave the
checkbox unchanged and report exact evidence and a recovery path.
