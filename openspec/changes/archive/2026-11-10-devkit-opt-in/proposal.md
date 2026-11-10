# Proposal

Change: `devkit-opt-in` · Date: 2026-11-09 · Owner: kaue rodrigues dos santos · Requirements: [requirements.md](requirements.md) · Design: [design.md](design.md) · PRD / tech spec: n/a · Roadmap: not listed in `openspec/roadmap.md`

## Why

devkit is installed at user scope on the owner's machine, so every project loads devkit-core and devkit-openspec: about 3.3k always-on tokens, the SessionStart report and the PreToolUse guards. Plain OpenSpec projects (`schema: spec-driven`: margi, recruit, psim-kernel) get the `[devkit]` session line, the one-writer rule on `readiness.md` / `reviews/*.md` / `evidence.md` and a refused `gh pr create`, and every folder gets the destructive-git refusal (`plugins/openspec/hooks/guard.mjs:321`, before any project check). The docs teach that user-scope install (`README.md:5`, `docs/getting-started.md:23`, each pack README). The owner wants devkit only in the projects that choose it.

## What Changes

- **Hooks act only in opted-in projects.** `guard.mjs` `session`, `edit` and `bash` print nothing and block nothing unless the project's `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema (design D2). Outside, the destructive-git rule is silent too (owner's choice). Inside, every gate is unchanged. `guard.mjs ci` and `deliver-check.mjs` are unchanged. **BREAKING** for anyone who relied on a user-scope devkit to refuse destructive git in every folder.
- **Per-project install is the taught path.** `README.md`, `docs/getting-started.md`, `docs/openspec-flow.md` and every pack README teach the committed `.claude/settings.json` (`extraKnownMarketplaces.devkit` plus `enabledPlugins`) or `claude plugin install <pack>@devkit --scope project`, and say why. No doc teaches a user-scope install any more.
- **`openspec-setup` opts the project in.** A new script writes or updates the project's `.claude/settings.json` (devkit marketplace plus the packs, other keys kept). The schemas go into the project by default. **BREAKING**: `install-schemas.sh` with no argument now installs into the current project; the machine-wide install needs `--user`.
- **This repo opts itself in** with a committed `.claude/settings.json` (devkit-core, devkit-openspec).
- **Owner-machine migration doc** (`docs/migrate-to-project-scope.md`): four items, each with the exact command, a check and an undo. Each one runs only on the owner's yes for that item, after this change's PR merges.
- **ADR 0004** records that devkit is opt-in per project and where the hooks act (drafted in design D7).
- Versions: devkit-openspec 0.7.0, devkit-core 0.5.1, devkit-design / devkit-stack / devkit-ai-engineering 0.1.1, marketplace 0.7.0, a CHANGELOG entry, catalog regenerated.

Non-goals: adding devkit to psim-kernel, margi or recruit; changing what any gate checks inside an opted-in project; the owner's `~/.claude/CLAUDE.md`; plugins from other marketplaces; changing `ship-change`, `deliver-check.mjs` or the CI check.

## Acceptance criteria

- **AC-1**: With devkit installed at user scope, a Claude Code hook call (`guard.mjs session|edit|bash`) whose `cwd` is a project that has not opted in prints nothing and exits 0, including for `git push --force`, `git reset --hard` and `gh pr create`. Covered by tests in `plugins/openspec/hooks/guard.test.mjs`.
- **AC-2**: In a plain OpenSpec project (`schema: spec-driven`, an active change, no devkit opt-in), the SessionStart hook prints no `[devkit]` line, writing `readiness.md` / `evidence.md` is not blocked, and `gh pr create` is not blocked.
- **AC-3**: In an opted-in project, every current gate behaves as today (the existing guard tests pass unchanged in meaning: destructive git refused, gate-file writers, readiness gate, PR gate, roadmap report).
- **AC-4**: `README.md`, `docs/getting-started.md` and every pack README teach installing per project (`claude plugin install <pack>@devkit --scope project`, or the `.claude/settings.json` snippet) and no longer teach a user-scope install; they say why (the packs then load only in projects that chose them).
- **AC-5**: `openspec-setup` writes or updates the project's `.claude/settings.json` with the devkit marketplace and the packs it needs (keeping the file's other keys), and installs the schemas into the project by default; `install-schemas.sh` with no argument installs into the current project, and the machine-wide install needs an explicit option.
- **AC-6**: This repo has a committed `.claude/settings.json` that opts it into devkit-core and devkit-openspec, so it keeps working after the user-scope install is removed.
- **AC-7**: A migration doc lists the four owner-machine steps with the exact command for each, how to check it, and how to undo it; none of them is run without the owner's yes for that item. After the owner runs the ones they approve, `claude plugin list` shows no devkit pack at `Scope: user`, and a new session in a project that did not opt in (e.g. `~/Documents/projects/margi`) shows no `[devkit]` SessionStart line and no devkit skills or agents.
- **AC-8**: Each changed pack's version is bumped in its `plugin.json` and `.claude-plugin/marketplace.json`, with a CHANGELOG line; `claude plugin validate .` and `python3 scripts/gen-catalog.py --check` pass.

## Capabilities

### New Capabilities

None. The repository keeps no canonical specs (`openspec/specs/` is empty), so `.openspec.yaml` sets `skip_specs: true`, as in the four archived changes. Behavior is pinned by the tests run from `guard.test.mjs` and documented in `docs/openspec-flow.md` (design D1).

### Modified Capabilities

None (see above).

## Impact

- **devkit-openspec**: `hooks/guard.mjs` (opt-in check in `session`, `edit`, `bash`), `hooks/guard.test.mjs`, `hooks/hooks.json` (description), `skills/openspec-setup/` (`SKILL.md`, `scripts/install-schemas.sh`, new `scripts/project-settings.mjs` and tests), `README.md`, `plugin.json`.
- **devkit-core, devkit-design, devkit-stack, devkit-ai-engineering**: `README.md` install lines, `plugin.json`.
- **Repo**: new `.claude/settings.json`, new `docs/adr/0004-devkit-per-project.md`, new `docs/migrate-to-project-scope.md`; `README.md`, `docs/getting-started.md`, `docs/openspec-flow.md` (gates, adoption, troubleshooting, CI pin `v0.7.0`), `openspec/config.yaml` (ADR line), `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`.
- **Owner's machine**: changed only by the migration doc's items, after the merge, one owner yes per item.
- **Other projects**: representante-digital is unchanged (already per project, `schema: devkit-lite`). Projects with no devkit schema stop seeing devkit's hooks even where the plugin is still loaded.
- Dependencies: none new. Inherited open decisions: none (the repo keeps no open-decisions log).
