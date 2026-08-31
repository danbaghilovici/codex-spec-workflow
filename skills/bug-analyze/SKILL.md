---
name: bug-analyze
description: Investigate an approved bug report, establish an evidence-backed root cause, and produce an approval-gated fix plan.
---

# Analyze a bug

Require bug phase `analysis` from `codex-spec status bug <name>`. Load the bug and steering context
with `codex-spec context bug <name>`, reproduce when safe, and trace the real execution and data paths.
Separate the root cause from symptoms and cite concrete files and symbols.

Write `.codex-specs/bugs/<name>/analysis.md` using the project override or
`../spec-create/assets/templates/bug-analysis-template.md`. Include impact, smallest robust fix,
alternatives, exact file changes, regression tests, verification, and rollback.

Present the analysis, request explicit approval, and stop. After explicit approval only, run:

```bash
codex-spec workflow approve bug <name>
codex-spec workflow advance bug <name>
```

Do not implement the fix in this phase. If reproduction is unsafe or unavailable, state the evidence
gap and confidence rather than guessing.
