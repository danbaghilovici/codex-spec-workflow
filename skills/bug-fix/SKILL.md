---
name: bug-fix
description: Implement the narrowly approved fix for an analyzed bug, add regression coverage, and stop for approval before verification.
---

# Fix an analyzed bug

Require bug phase `fix`. Read the approved report, analysis, and steering context via
`codex-spec context bug <name>`. Implement only the approved fix plan, preserving unrelated behavior.
Add the planned regression test and run focused checks plus relevant type, lint, or build checks.

Write `.codex-specs/bugs/<name>/fix.md` with changed files, behavioral rationale, tests run and their
results, deviations from the plan, and residual risks. Do not claim success if acceptance evidence is
missing.

Present the implementation and request explicit approval before verification. After approval only:

```bash
codex-spec workflow approve bug <name>
codex-spec workflow advance bug <name>
```

On a failed check, keep the workflow in `fix`, report the failure, and repair only within the approved
scope. Broader changes require revising and re-approving the analysis.
