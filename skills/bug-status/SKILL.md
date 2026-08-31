---
name: bug-status
description: Show structured phase, approval, documents, and the next valid action for one or all bug workflows.
---

# Bug status

For one bug, run `codex-spec status bug <name> --json`; for all bugs, run
`codex-spec list --kind bug --json`. Present structured phase and approval state, document gaps, and
the next phase skill. Do not infer state from prose markers and do not mutate workflow files. Suggest
`codex-spec repair --dry-run` for missing state.
