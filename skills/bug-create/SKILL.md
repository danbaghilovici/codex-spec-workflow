---
name: bug-create
description: Create or resume the report phase of an approval-gated bug workflow from concrete symptoms and reproduction evidence.
---

# Create a bug report

Accept a kebab-case bug name and problem description. Initialize new state with:

```bash
codex-spec workflow init bug <name> --title "<title>" --description "<description>"
```

If state exists, resume it rather than overwriting later phases. During `report`, clarify observable
expected and actual behavior, reproduction, environment, impact, and evidence. Use the project
`bug-report-template.md` override or `../spec-create/assets/templates/bug-report-template.md`, then
write `.codex-specs/bugs/<name>/report.md`.

Present the report, ask for explicit approval, and stop. After explicit approval only:

```bash
codex-spec workflow approve bug <name>
codex-spec workflow advance bug <name>
```

Do not diagnose or fix during this skill. If the bug has already advanced, report its status and route
to the matching bug phase skill.
