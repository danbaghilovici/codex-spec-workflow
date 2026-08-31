# Codex Spec Workflow

A Codex-native port of `pimzino/claude-code-spec-workflow`: approval-gated requirements, design,
tasks, implementation, and bug-fix workflows backed by deterministic local state.

The active Codex session performs research, writing, and implementation. The companion CLI handles
only deterministic work—installation, state transitions, task parsing, migration, status, and the
dashboard. It does not call an AI API and does not require `OPENAI_API_KEY`.

## Install into a project

Requires Node.js 20+ and the Codex CLI.

```bash
npm install -g codex-spec-workflow
cd /path/to/project
codex-spec install --dry-run
codex-spec install
codex-spec doctor
```

The installer manages ten skills under `.agents/skills`, four agents under `.codex/agents`, default
templates under `.codex-specs/templates`, and one delimited block in `AGENTS.md`. Existing project
guidance, customized managed files, unrelated skills and agents, templates, specs, bugs, and Codex
configuration are preserved. Managed writes are atomic and updated files are backed up under
`.codex-specs/backups`.

## Use the workflows

The workflows are opt-in: Codex uses them only when you explicitly mention an installed skill with
`$skill-name`. Ordinary planning, implementation, and bug-fix requests do not activate the spec
workflow automatically.

Invoke the installed skills in Codex:

```text
$spec-steering-setup
$spec-create user-authentication "Secure signup and login"
$spec-execute user-authentication
$spec-status user-authentication

$bug-create wrong-status "Dashboard shows the wrong status"
$bug-analyze wrong-status
$bug-fix wrong-status
$bug-verify wrong-status
```

Each content phase stops for explicit approval. Approval is stored in `workflow.json`; requirements,
design, and tasks remain Markdown source of truth. `$spec-execute` runs one dependency-ready task and
marks it complete only after its acceptance criteria and relevant checks pass.

Useful deterministic commands:

```bash
codex-spec list --json
codex-spec status spec user-authentication
codex-spec tasks next user-authentication
codex-spec context spec user-authentication
codex-spec repair --dry-run
```

## Migrate a Claude workflow

The migration leaves `.claude` untouched, preserves checkboxes, normalizes supported task syntax,
converts recognizable legacy approval markers into state, and reports ambiguity rather than silently
guessing.

```bash
codex-spec migrate --from-claude --dry-run
codex-spec migrate --from-claude
```

Use `--force` only to replace an existing destination; every replacement is backed up first.
Generated per-task Claude commands are intentionally not migrated—use `$spec-execute`.

## Dashboard

```bash
codex-spec dashboard --project /project/one /project/two
# For a dashboard exposed through a tunnel:
codex-spec dashboard --read-only --host 0.0.0.0
```

The web dashboard reads structured state, streams filesystem changes over WebSockets, and shows
multiple explicit project paths, Git status, steering coverage, approvals, and task progress. It has
no write API. `--read-only` additionally rejects every non-read HTTP method. The optional Tauri
wrapper in `src-tauri/` launches the same local dashboard.

## Plugin development

The plugin manifest is `.codex-plugin/plugin.json`; the repo-local marketplace is
`.agents/plugins/marketplace.json`. Install or refresh the repository marketplace, then start a new
Codex session so newly bundled skills are discovered. The npm installer and plugin both use the same
canonical `skills/` tree.

The repository formats follow the official OpenAI documentation for
[skills](https://developers.openai.com/codex/build-skills/),
[custom agents](https://developers.openai.com/codex/subagents/), and
[plugins](https://developers.openai.com/codex/build-plugins/).

## Development

```bash
npm install
npm run verify
```

The source project is MIT licensed. See [NOTICE.md](NOTICE.md) for attribution.
