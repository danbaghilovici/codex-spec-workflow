---
name: spec-create
description: Create or resume an approval-gated feature specification from requirements through design and implementation tasks. Use for new feature planning, not task execution.
---

# Create a specification

Accept a kebab-case spec name and a concise feature description. Store work in
`.codex-specs/specs/<name>/`. If the workflow exists, read its status and resume its current phase;
never replace approved work or restart from requirements.

Initialize new state with:

```bash
codex-spec workflow init spec <name> --title "<title>" --description "<description>"
```

At each phase, research the repository and steering documents before drafting. Prefer the matching
project override in `.codex-specs/templates/`; otherwise use the template in
`assets/templates/`. Keep traceability from requirements to design to tasks.

## Current phase

- `requirements`: Write `requirements.md` with testable, observable acceptance criteria. Ask the
  `spec-requirements-validator` agent for a read-only review when available. If agents are disabled,
  review completeness, ambiguity, feasibility, and template compliance locally. Present the draft,
  request explicit approval, and stop.
- `design`: Confirm requirements approval is already recorded. Trace the existing code before
  writing `design.md`. Ask `spec-design-validator` for read-only validation, or locally check every
  requirement, interface, reuse claim, failure mode, and test boundary. Request approval and stop.
- `tasks`: Write `tasks.md` as ordered, dependency-valid, one-task-sized checkboxes. Ask
  `spec-task-validator`, or locally check requirement coverage, exact file scope, dependencies, and
  verification. Run `codex-spec tasks validate <name>`. Request approval and stop.
- `implementation` or `complete`: Do not generate documents. Report status and direct task work to
  `$spec-execute`.

An invocation is not approval. Only after the user explicitly approves the current draft, record and
advance it:

```bash
codex-spec workflow approve spec <name>
codex-spec workflow advance spec <name>
```

Then stop unless the user explicitly asked to continue to drafting the next phase in the same turn;
even then, stop at the next approval boundary. If validation fails, revise the document and request
approval again rather than advancing state.
