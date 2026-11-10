# ADR 0004: devkit is opt-in per project

- Status: accepted
- Date: 2026-11-09
- Change: devkit-opt-in

## Context

This ADR builds on ADR 0001 and leaves ADRs 0001-0003 unchanged. devkit was taught as a user-scope install ("install it once"). Every project on a machine then loaded the packs' context and hooks: plain OpenSpec projects got devkit's session report and gates, and every folder had destructive git refused. Owners use devkit in some projects and plain OpenSpec, or nothing, in others.

## Decision

A project chooses devkit with committed files. Its `.claude/settings.json` declares the `devkit` marketplace and enables the packs it uses, so Claude Code loads them there and nowhere else. The devkit-openspec hooks (`session`, `edit`, `bash`) act only in a project whose `openspec/config.yaml` selects the `devkit` or `devkit-lite` schema. Anywhere else they print nothing and block nothing, the destructive-git rule included, even when the plugin is loaded at user scope. Inside such a project every gate stays as ADR 0001 describes. The CI check (`deliver-check --ci`, `guard.mjs ci`) does not depend on this rule. The docs and `openspec-setup` teach only the per-project install. Machine-wide schemas are installed only on explicit request.

## Consequences

- Positive: projects that did not choose devkit pay no context and meet no devkit gate. The choice is in the repository, reviewable, the same in worktrees and CI, and needs no machine state (ADR 0001). A user-scope install by mistake is harmless.
- Negative: destructive git is no longer refused outside opted-in projects, or for a command that `cd`s into one from outside (Accepted: the owner's choice; Claude Code's own permission rules can refuse it per user). Each project is set up once (Mitigated: `openspec-setup` writes the settings). A project that renames its copy of a devkit schema turns the hooks off (Mitigated: documented under Customizing). A worktree made from a branch older than the project's `.claude/settings.json` does not load devkit (Accepted: merge the default branch into it).

### Review trigger

Claude Code adds a native per-project activation for user-scope plugins, a gate is needed in projects that do not run a devkit schema, or a project needs devkit's hooks under a schema with another name.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the user-scope install; opt out per project (`enabledPlugins: false` in `settings.local.json`) | Nothing to set up per project | The default invades, so every new project needs an opt-out, and the opt-out is machine-local | low |
| Hooks gate on Claude Code settings (`enabledPlugins`) | Mirrors loading | Not in CI or worktrees for `settings.local.json`; `--plugin-dir` testing turns the gates off; fork names break it | low |
| An explicit `devkit: true` key in `openspec/config.yaml` | Explicit | Every opted-in project needs an edit before its gates come back | low |
| Per-change schema as the marker | Finer grained | Projects with their own schema lose their gates; the git rule depends on which change is open | medium |
