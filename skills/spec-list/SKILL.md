---
name: spec-list
description: List Codex specification workflows and summarize their structured phase, approval, and task progress state.
---

# List specifications

Run `codex-spec list --kind spec --json` from the project root. Present each spec's name, current
phase, approval gate, and task progress when available. Read `workflow.json`; do not infer status from
emoji or prose. If a directory lacks valid state, report it and suggest `codex-spec repair --dry-run`
instead of guessing.
