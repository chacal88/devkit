# Requirements

## Request

The owner, in their words (translated from Portuguese): "Today devkit invades all my projects, and I
don't want that. I only want to use devkit in the projects I choose, so it cannot be installed
globally on my machine."

(The Portuguese original is not kept here: `scripts/check.py` refuses non-English prose in Markdown,
as in the earlier changes' requirements.)

Classification: domain=process type=feature flags=[contract (hook behaviour), owner-machine migration] (confirmed: schema `devkit`)

### What "invading" is today (facts)

- `~/.claude/settings.json` → `enabledPlugins` has `"devkit-core@devkit": true` and
  `"devkit-openspec@devkit": true`; `claude plugin list` shows both at `Scope: user` (0.5.0, 0.6.0).
  Every project on the machine loads them: `claude plugin details` reports ~2.8k always-on tokens for
  devkit-core and ~0.5k for devkit-openspec, plus the SessionStart and PreToolUse hooks of
  `plugins/openspec/hooks/hooks.json`.
- `plugins/openspec/hooks/guard.mjs:321` refuses destructive git in any folder: `gitViolation` runs
  before the `findRoot` check at `guard.mjs:323`.
- `findRoot` (`guard.mjs:59-66`) only looks for `openspec/changes/`, so a plain OpenSpec project with no
  devkit (psim-kernel, margi, recruit use `schema: spec-driven`) gets the SessionStart
  "[devkit] Active OpenSpec change" message (`guard.mjs:385-410`), the one-writer rule on
  `readiness.md` / `reviews/*.md` / `evidence.md` (`guard.mjs:202-205`) and `gh pr create` refused
  without reviews and evidence (`guard.mjs:334-336`; `prViolation` has no opt-in check).
  `~/Documents/recruit/.claude/settings.local.json:86` already disables `devkit-openspec@devkit` by hand.
- The docs steer to a user-scope install: `README.md:5` ("Install it once"),
  `docs/getting-started.md:23` and each pack README (`/plugin install <pack>@devkit`, whose default
  scope is `user`); per-project settings appear only under "Share with a team"
  (`docs/getting-started.md:60-73`).
- This repo has no `.claude/settings.json`: it relies on the user-scope install.
  `~/Documents/representante-digital/.claude/settings.json` already opts in per project.
- `plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh` with no argument installs the
  schemas machine-wide in `${XDG_DATA_HOME:-$HOME/.local/share}/openspec/schemas/`;
  `plugins/openspec/skills/openspec-setup/SKILL.md:22-23` offers both places. Nothing is installed
  there on this machine today.
- Claude Code supports `claude plugin install <plugin> --scope project` (writes the project's
  `.claude/settings.json` `enabledPlugins`) and declaring the marketplace per project with
  `extraKnownMarketplaces`.

## Assumptions

- A project opts in through its committed `.claude/settings.json`: `extraKnownMarketplaces.devkit`
  (`{"source": {"source": "github", "repo": "chacal88/devkit"}}`) and `enabledPlugins` with the packs it
  uses (`"devkit-core@devkit": true`, `"devkit-openspec@devkit": true`, ...). This is the default the docs
  and `openspec-setup` teach; `.claude/settings.local.json` is not the taught path.
- devkit's hooks defend themselves: in a project that has not opted into devkit, every hook mode
  (`session`, `edit`, `bash`) is silent and blocks nothing, including the destructive-git rule, even when
  the plugin is installed at user scope. The `ci` mode is unchanged. AMBIGUOUS: what the hook reads as
  "opted in": (a) `openspec/config.yaml` `schema:` (or the active change's `.openspec.yaml` `schema:`) is
  `devkit` or `devkit-lite` | (b) the project's `.claude/settings.json` / `.claude/settings.local.json`
  enables `devkit-openspec@devkit` | (c) both; the planner resolves, and a plain OpenSpec project
  (`schema: spec-driven`, no devkit in its settings) must come out as not opted in.
- Projects that keep devkit: this repo (`~/Documents/devkit`, gains a committed `.claude/settings.json`)
  and `~/Documents/representante-digital` (already opted in, unchanged). psim-kernel, margi and recruit
  end with no devkit at all.
- `install-schemas.sh` and `openspec-setup` default to the project (`<project>/openspec/schemas/`); the
  machine-wide install stays available only when asked for explicitly.
- The owner's machine is changed only by a documented migration, each item run only after the owner's
  explicit yes at that moment:
  1. uninstall `devkit-core@devkit` and `devkit-openspec@devkit` from user scope (removes them from
     `~/.claude/settings.json` `enabledPlugins`);
  2. remove the `devkit` marketplace from `~/.claude/plugins/known_marketplaces.json`
     (`claude plugin marketplace remove devkit`);
  3. remove `"devkit-openspec@devkit": false` from `~/Documents/recruit/.claude/settings.local.json`;
  4. remove the project-scope devkit installs registered for old worktrees of representante-digital
     (`~/Documents/representante-digital/.claude/worktrees/*`, 7 entries per pack).
- Each changed pack gets a version bump in its `plugin.json` and `.claude-plugin/marketplace.json` plus a
  CHANGELOG line (CONTRIBUTING).

## Acceptance criteria

- **AC-1** — With devkit installed at user scope, a Claude Code hook call (`guard.mjs session|edit|bash`)
  whose `cwd` is a project that has not opted in prints nothing and exits 0, including for
  `git push --force`, `git reset --hard` and `gh pr create`. Covered by tests in
  `plugins/openspec/hooks/guard.test.mjs`.
- **AC-2** — In a plain OpenSpec project (`schema: spec-driven`, an active change, no devkit opt-in) the
  SessionStart hook prints no `[devkit]` line, writing `readiness.md` / `evidence.md` is not blocked, and
  `gh pr create` is not blocked.
- **AC-3** — In an opted-in project, every current gate behaves as today (the existing guard tests pass
  unchanged in meaning: destructive git refused, gate-file writers, readiness gate, PR gate, roadmap report).
- **AC-4** — `README.md`, `docs/getting-started.md` and every pack README teach installing per project
  (`claude plugin install <pack>@devkit --scope project`, or the `.claude/settings.json` snippet) and no
  longer teach a user-scope install; they say why (the packs then load only in projects that chose them).
- **AC-5** — `openspec-setup` writes or updates the project's `.claude/settings.json` with the devkit
  marketplace and the packs it needs (keeping the file's other keys), and installs the schemas into the
  project by default; `install-schemas.sh` with no argument installs into the current project, and the
  machine-wide install needs an explicit option.
- **AC-6** — This repo has a committed `.claude/settings.json` that opts it into devkit-core and
  devkit-openspec, so it keeps working after the user-scope install is removed.
- **AC-7** — A migration doc lists the four owner-machine steps with the exact command for each, how to
  check it, and how to undo it; none of them is run without the owner's yes for that item. After the
  owner runs the ones they approve, `claude plugin list` shows no devkit pack at `Scope: user`, and a new
  session in a project that did not opt in (e.g. `~/Documents/projects/margi`) shows no `[devkit]`
  SessionStart line and no devkit skills or agents.
- **AC-8** — Each changed pack's version is bumped in its `plugin.json` and `.claude-plugin/marketplace.json`,
  with a CHANGELOG line; `claude plugin validate .` and `python3 scripts/gen-catalog.py --check` pass.

## Out of scope

- Adding devkit to psim-kernel, margi or recruit.
- Changing what the gates check inside opted-in projects.
- The owner's `~/.claude/CLAUDE.md` (its devkit line is already conditional: "Onde o projeto usa o devkit").
- Plugins from other marketplaces.

## Questions asked

1. [scope] Where does a project's choice live? → the committed `.claude/settings.json`.
2. [end effect] Should the hooks defend themselves if devkit is installed at user scope again? → yes, silent without opt-in.
3. [scope] Which OpenSpec projects keep devkit? → this repo and representante-digital only.
4. [project rules] Machine-wide schema install? → keep it as an explicit option; default to the project.
5. [scope] What does the machine migration cover? → user-scope uninstall, the global marketplace, recruit's local entry, old worktree entries.
6. [project rules] Schema for this change? → `devkit` (full).
