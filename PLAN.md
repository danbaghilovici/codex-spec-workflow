# Codex Spec Workflow Port Plan

## Recommendation

Build a Codex-native port of `../claude-code-spec-workflow`. Do not use
`shenli/codex-spec` as the implementation base: it is a substantially thinner,
API-key-driven product and does not reproduce the source workflow.

The port should use Codex skills for reusable workflows, `AGENTS.md` for compact
repository guidance, project-scoped custom agents for validation and execution,
and a deterministic companion CLI for setup, state management, migration, and
the dashboard.

## Repository Analysis

### Source adapter

The Claude adapter contains more than its headline spec flow:

- Ten workflows: five spec commands and five bug commands.
- Requirements -> design -> tasks -> scoped dependency-aware execution.
- Explicit approval gates and validation agents.
- Nine customizable document templates.
- Steering documents for product, technology, and structure.
- Deterministic task parsing, context assembly, and completion updates.
- An installer/updater that attempts to preserve existing work.
- A real-time multi-project dashboard, desktop wrapper, and optional tunnels.

The primary implementation is in:

- `../claude-code-spec-workflow/src/setup.ts`
- `../claude-code-spec-workflow/src/markdown/commands/`
- `../claude-code-spec-workflow/src/markdown/agents/`
- `../claude-code-spec-workflow/src/markdown/templates/`
- `../claude-code-spec-workflow/src/task-generator.ts`
- `../claude-code-spec-workflow/src/dashboard/`

The port should not be a mechanical rename. A clean baseline build and
typecheck pass, but the test suite currently has seven failing suites and five
failing tests. There is also contract drift: the dashboard expects
`✅ APPROVED` markers, while the installed Markdown workflow no longer tells the
agent to write those markers. Those instructions remain only in an unused
legacy `commands.ts`.

The source is MIT licensed. Preserve its copyright notice and attribution in
the derived project.

### `shenli/codex-spec`

The comparison used current `main` commit
`7b585f0dbf75fb3523244586a1f77a183520fb43`, dated 2025-09-11.

| Capability | Claude adapter | `codex-spec` |
|---|---:|---:|
| Requirements/design/tasks approval gates | Yes | No |
| Dedicated validators/executor | Yes | No |
| Bug workflow | Yes | No |
| Customizable templates | 9 | Prompt strings only |
| Steering context | Yes | Partial |
| Dependency-aware task execution | Yes | Yes |
| Dependency checking | No/limited | Yes |
| Dashboard and tunnels | Yes | No |
| Native Codex skills | No | No |
| Requires a separate API key | No | Yes |
| Automated tests | Extensive, currently imperfect | None |

Additional limitations in `codex-spec`:

- Generation bypasses the active Codex session and calls Chat Completions with
  `OPENAI_API_KEY` and a hard-coded `gpt-4` model.
- Its named spec directory and `.codex-specs/current` alias diverge after spec
  creation.
- Its nested `AGENTS.md` does not govern `codex exec` launched from the
  repository root.
- A zero process exit marks a task complete without independently checking its
  acceptance criteria.
- `execute-phase` can report success after tasks fail or remain blocked.
- Context update and refresh overwrite documents without reliably preserving or
  re-analyzing existing context.
- In a clean checkout, its test, type-check, and lint scripts all fail.

Ideas worth borrowing are the separate `.codex-specs/` state directory,
dependency metadata, execution logs, and read-only preview. Its architecture
should not be reused.

## Codex-Native Design

Codex custom prompts are deprecated. Repository workflows should be skills in
`.agents/skills`; durable repository guidance belongs in `AGENTS.md`; and
project-specific custom agents belong in `.codex/agents`.

Relevant official documentation:

- <https://learn.chatgpt.com/docs/build-skills>
- <https://learn.chatgpt.com/docs/customization/overview>
- <https://learn.chatgpt.com/docs/agent-configuration/subagents>
- <https://developers.openai.com/plugins/build/plugins>
- <https://learn.chatgpt.com/docs/import>

### User-facing workflow

```text
$spec-steering-setup
$spec-create user-authentication "Secure signup and login"
$spec-execute 1 user-authentication
$spec-status user-authentication

$bug-create wrong-status "Dashboard shows the wrong status"
$bug-analyze wrong-status
$bug-fix wrong-status
$bug-verify wrong-status
```

These are explicit skill mentions rather than custom slash commands. The skills
must not activate implicitly for ordinary planning, implementation, or bug-fix
requests. Generating one skill per implementation task would overcrowd the
Codex skill registry, so the Claude adapter's generated task commands should be
replaced by one resumable `$spec-execute` skill.

### Installed project layout

```text
AGENTS.md
.agents/
└── skills/
    ├── spec-create/
    ├── spec-execute/
    ├── spec-list/
    ├── spec-status/
    ├── spec-steering-setup/
    ├── bug-create/
    ├── bug-analyze/
    ├── bug-fix/
    ├── bug-status/
    └── bug-verify/
.codex/
└── agents/
    ├── spec-requirements-validator.toml
    ├── spec-design-validator.toml
    ├── spec-task-validator.toml
    └── spec-task-executor.toml
.codex-specs/
├── steering/
├── templates/
├── specs/<feature>/
│   ├── workflow.json
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
└── bugs/<bug>/
    ├── workflow.json
    ├── report.md
    ├── analysis.md
    ├── fix.md
    └── verification.md
```

`workflow.json` should hold deterministic phase and approval state. Markdown
remains the source of truth for requirements, design, and task content. This
removes the dashboard's fragile dependence on emoji and prose heuristics.

## Implementation Plan

### 1. Bootstrap the repository

- Initialize Git and the TypeScript/npm package.
- Carry forward the source adapter's MIT notice and attribution.
- Establish one canonical source for every skill and template.
- Eliminate the source project's duplicated `commands.ts`/Markdown contract.
- Set up lint, formatting, typecheck, build, and test configuration immediately.

### 2. Build the deterministic workflow core

- Define versioned schemas for spec and bug workflow state.
- Port and harden task parsing, context loading, list/status, task selection,
  dependency checking, and checkbox updates.
- Add atomic file writes, path validation, state repair, and safe backups.
- Make workflow transitions explicit and reject invalid phase transitions.
- Keep AI generation out of the CLI; the active Codex session performs
  generative work.

### 3. Implement the ten Codex skills

- Convert every source command into a focused `SKILL.md`.
- Make `$spec-create` resumable and stop after every approval boundary.
- Preserve codebase research, template compliance, traceability, and
  one-task default execution with explicit sequential multi-task opt-in.
- Package templates as skill assets while supporting project-local overrides.
- Define exact expected inputs, outputs, stop conditions, and recovery paths.
- Add clear fallback behavior when subagents are unavailable or disabled.

### 4. Port the specialized agents

- Use read-only custom agents for requirements, design, and task validation.
- Let all custom agents inherit the parent model and reasoning settings.
- Let the executor inherit the parent permission mode rather than silently
  escalating access.
- Have the skills explicitly request the appropriate validator or executor.
- Mark tasks complete only after acceptance criteria and relevant checks pass.
- Do not parallelize write-heavy task execution.

### 5. Build the installer and updater

- Install managed skills under `.agents/skills`.
- Install managed custom agents under `.codex/agents`.
- Add or update a small, delimited section in `AGENTS.md` without overwriting
  existing repository guidance.
- Preserve user templates, specs, bugs, custom skills, agents, and Codex
  configuration.
- Use a versioned installation manifest and checksums for managed files.
- Add `doctor`, dry-run, and installation verification commands.
- Validate `codex --version`; do not require `OPENAI_API_KEY`.
- Avoid the source updater's delete-and-restore strategy.

### 6. Add Claude workflow migration

- Implement `migrate --from-claude` with a dry-run mode.
- Copy `.claude/specs`, `bugs`, `steering`, and customized templates into
  `.codex-specs`.
- Convert approval markers into structured workflow state.
- Preserve task completion checkboxes and normalize supported task formats.
- Back up state and leave the original `.claude` directory untouched.
- Do not migrate generated task commands; replace them with `$spec-execute`.
- Report ambiguous or malformed workflow state instead of guessing silently.

Codex's built-in `/import` may help with generic Claude instructions and
commands, but it cannot reproduce this package's CLI helpers, state semantics,
migration behavior, or dashboard.

### 7. Port the dashboard

- Centralize the workflow-root path and switch from `.claude` to
  `.codex-specs`.
- Read structured workflow state rather than inferring phases from prose.
- Replace Claude process discovery with explicit project paths and
  Codex-aware session discovery where reliable.
- Preserve WebSocket updates, multi-project display, Git information, and
  steering status.
- Retain read-only tunnel protections and test them independently.
- Port the Tauri desktop wrapper after the web dashboard is stable.
- Remove Claude-specific icons, labels, command examples, and process names.

### 8. Package it as a Codex plugin

- Add `.codex-plugin/plugin.json` referencing the ten skills.
- Add a repository marketplace entry for local installation testing.
- Keep the npm CLI for deterministic setup, migration, status, and dashboard
  operations.
- Ensure plugin installation and npm setup share the same canonical skills.
- Test plugin enable, disable, update, and fresh-session discovery behavior.

### 9. Verification gates

- Unit tests for parsers, schemas, phase transitions, approvals, dependencies,
  safe updates, and migration.
- Golden fixtures covering the complete spec and bug lifecycles.
- Contract tests ensuring dashboard status agrees with workflow state.
- Skill validation for frontmatter, missing references, stale Claude paths, and
  deprecated slash-command assumptions.
- Installer tests proving unrelated `AGENTS.md`, skills, agents, templates, and
  workflow data are preserved.
- Dashboard and tunnel integration tests.
- Clean lint, typecheck, test, build, and package-tarball installation.
- Codex smoke tests for skill discovery, explicit invocation, custom-agent
  loading, approval resume, default single-task execution, explicit multi-task
  execution, and task completion.

## Milestones

### Milestone 1: Core workflow

Complete steps 1-4. Deliver all ten skills, deterministic state, templates,
validators, and explicitly scoped task execution in a development checkout.

### Milestone 2: Installation and migration

Complete steps 5-6. Deliver safe installation, update, diagnostics, and
non-destructive migration from existing Claude workflow projects.

### Milestone 3: Dashboard parity

Complete step 7. Deliver the web dashboard and tunnels against the new state
contract, followed by the optional Tauri wrapper.

### Milestone 4: Distribution and release

Complete steps 8-9. Deliver npm and plugin packaging with a fully green release
matrix and end-to-end Codex smoke tests.

## Definition of Done

- All ten workflows are discoverable and usable as Codex skills.
- The feature workflow enforces requirements, design, and task approval gates.
- The bug workflow supports report, analysis, fix, and verification phases.
- Validators produce actionable results before user review.
- Execution defaults to one task, continues sequentially only with explicit
  multi-task authorization, and marks each task complete after validation.
- No separate OpenAI API key is required.
- Existing Claude workflow projects can be migrated without data loss.
- Updates preserve unrelated and user-customized files.
- Dashboard progress matches deterministic workflow state.
- Lint, typecheck, tests, build, package installation, and Codex smoke tests all
  pass from a clean checkout.
