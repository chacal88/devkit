---
name: compozy-setup
description: Installs the CompozyOS delivery loop (version 2) into a project as `.compozy/` - config.toml, the four role shells, the loop template and the devkit-kit resolver. Use when a project adopts the CompozyOS kit, or when the user says "install compozy", "set up the compozy loop" or "adopt the compozy kit".
---

# compozy-setup

Writes `.compozy/` into the current project from this pack's templates, filling the
change-independent placeholders named in
[`templates/substitutions.json`](templates/substitutions.json) with the project's values (or
their default, when the project gives none). It is the only writer of `.compozy/`'s installed
files; it does not maintain them afterwards.

## Install procedure

1. **Gather the inputs.** Ask the project (or read them from an existing `.compozy/` when
   re-running): the four agent ids (`__PLANNER__`, `__IMPLEMENTER__`, `__REVIEWER__`,
   `__DESIGNER__`), `__VERIFY_COMMAND__`, optionally `__DEMO_COMMAND__` and `__DEMO_URL__`, and
   the workspace `__TIMEZONE__`. Everything else about a project comes from files already in the
   repository (`CLAUDE.md`, `openspec/config.yaml`), never guessed.
2. **Write `.compozy/config.toml`** from `templates/config.toml`: the workspace overlay (default
   agent, provider, `permissions.mode`, skills sources, timezone).
3. **Write `.compozy/README.md`** from `templates/README.md`: the roles table, the loop's stage
   line and the one command that starts a run.
4. **Write the four role shells**, `.compozy/agents/<role>/AGENT.md` for `tech-lead`, `dev`, `qa`
   and `design`, from `templates/agents/<role>/AGENT.md`.
5. **Write `.compozy/loops/openspec-change/loop.yaml`** from
   `templates/loops/openspec-change/loop.yaml`, with `__VERIFY_COMMAND__`, `__DEMO_COMMAND__` and
   `__DEMO_URL__` filled.
6. **Write `.compozy/bin/devkit-kit`**, executable, from
   [`templates/bin/devkit-kit`](templates/bin/devkit-kit) verbatim (it carries no placeholder:
   every template calls `.compozy/bin/devkit-kit <checker>` instead of a path from one
   repository).
7. **Add a `design:` block to `openspec/config.yaml`**, with `screen_map:` (`__SCREEN_MAP__`) and,
   when the project names one, `mockup:` (`__MOCKUP__`) - only when the project has at least one
   screen to track. A project with no browser surface gets no block, and the design gate stays a
   no-op for it.

### devkit-kit's resolver

`.compozy/bin/devkit-kit` finds the devkit checkers (`deliver-check`, `conduct-check`) at
`$DEVKIT_HOOKS`, in a repository checkout, or in the installed `devkit-openspec` with the highest
version under the Claude Code plugins directory; it resolves its own pack's `screens-check` the
same way, scoped to `devkit-compozy`, without `$DEVKIT_HOOKS` (design D9). That search honours
`$CLAUDE_CONFIG_DIR` (the same variable Claude Code itself uses to relocate its config directory)
to find the plugins directory, defaulting to `~/.claude/plugins`. Nothing in this install step
needs to set `$CLAUDE_CONFIG_DIR`; it matters only to a session that redirects Claude Code's own
config elsewhere.

## What it never does

- **Publish the loop.** `compozy loop create --fork-from-name` is the operator's act, run once the
  files are in place and reviewed.
- **Start a run.** `compozy loop run` is a later, separate step.
- **Write product code, a test or a spec.** This skill only writes `.compozy/` and the one
  `design:` block of `openspec/config.yaml`.

## Re-running over an existing `.compozy/`

Running this skill again replaces the installed files with the current templates, filled with the
same inputs as before (re-asking only for an input the project does not already record). It never
touches a file outside `.compozy/` and `openspec/config.yaml`'s `design:` block, and it leaves any
project-specific customization of `.compozy/README.md`'s prose as a diff the owner reviews before
committing, rather than silently overwriting it without being asked to.
