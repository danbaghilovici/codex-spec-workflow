---
name: spec-status
description: Show detailed structured status, approvals, task progress, blockers, and next action for one specification.
---

# Specification status

Require a spec name and run `codex-spec status spec <name> --json`. Summarize the current phase,
approval states, completed/total tasks, dependency blockers, missing documents, and the single next
valid action. Do not mutate files. If state is invalid or missing, recommend
`codex-spec repair --dry-run` and surface the ambiguity.
