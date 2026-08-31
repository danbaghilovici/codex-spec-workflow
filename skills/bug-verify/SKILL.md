---
name: bug-verify
description: Verify an approved bug fix against its reproduction, regression risks, and checks, then request final closure approval.
---

# Verify a bug fix

Require bug phase `verification`. Read report, analysis, fix record, and steering context. Re-run the
original reproduction, the regression test, relevant suites, edge cases, and applicable quality
checks. Review whether the implemented change actually addresses the documented root cause.

Write `.codex-specs/bugs/<name>/verification.md` using the project override or
`../spec-create/assets/templates/bug-verification-template.md`. Record exact commands and honest
results. A zero exit code without matching the original acceptance behavior is insufficient.

If any required check fails, leave the workflow in `verification` and report the recovery path. If
verification passes, present the evidence, ask whether the bug is resolved, and stop. After explicit
final approval only:

```bash
codex-spec workflow approve bug <name>
codex-spec workflow advance bug <name>
```
