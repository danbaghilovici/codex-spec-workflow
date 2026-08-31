---
name: spec-steering-setup
description: Research a repository and create or revise product, technology, and structure steering documents with user approval.
---

# Set up steering documents

Inspect the actual repository, configuration, build commands, dependencies, module boundaries, and
existing documentation. Draft `product.md`, `tech.md`, and `structure.md` using project overrides in
`.codex-specs/templates/` or the corresponding templates under
`../spec-create/assets/templates/`.

Present the drafts and stop for explicit user approval before writing. On approval, preserve useful
existing content and write only the approved documents to `.codex-specs/steering/` using normal file
editing tools. Report uncertain claims as questions or marked gaps; do not invent product intent from
code. Revisions require another approval before saving.
