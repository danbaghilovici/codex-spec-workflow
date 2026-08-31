# Repository guidance

This repository is the canonical source for the Codex Spec Workflow npm package and plugin.

- Keep deterministic mechanics in `src/`; skills must call the CLI rather than duplicating state
  logic.
- `skills/` is the canonical skill tree. `skills/spec-create/assets/templates/` is the only canonical
  template source; the installer copies it to project overrides.
- Validators must remain read-only. The executor must inherit parent permissions and model settings.
- Preserve explicit approval stops, one-task default execution, explicit multi-task opt-in,
  dependency ordering, and per-task completion evidence when changing workflows.
- Add or update contract tests for state, migration, installation preservation, or dashboard changes.
- Run `npm run verify` plus the skill and plugin validators before release.

Do not add Claude slash-command assumptions or use Markdown approval prose as live state. Claude
markers are supported only by migration and repair.
