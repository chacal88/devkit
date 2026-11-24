---
name: compozy-setup
description: Installs the CompozyOS kit into a project as `.compozy/` - config.toml, one agent per devkit role, the three loops (a change, its review round, a roadmap) and the devkit-kit resolver. Use when a project adopts the CompozyOS kit, or when the user says "install compozy", "set up the compozy loop" or "adopt the compozy kit".
---

# compozy-setup

Writes `.compozy/` into the current project from this pack's templates, filling the
change-independent placeholders named in
[`templates/substitutions.json`](templates/substitutions.json) with the project's values (or
their default, when the project gives none). It is the only writer of `.compozy/`'s installed
files, and installs them again on a re-run without losing what the project edited.

## Install procedure

1. **Gather the inputs.** Ask the project (or read them from an existing `.compozy/` when
   re-running) for the workspace's `__TIMEZONE__`; it is the only input the loops and agents need.
   Everything else about a project comes from files already in the repository (`CLAUDE.md`,
   `openspec/config.yaml`), never guessed.
2. **Run the installer** from the project's root:

   ```bash
   node <this skill>/scripts/install-kit.mjs <project-root> [--set __NAME__=value]... [--accept <path>,...] [--json]
   ```

   It writes `.compozy/config.toml` (the workspace overlay: default agent `change-coordinator`,
   provider, `permissions.mode`, skills sources, timezone), `.compozy/README.md` (what the kit is, the
   loops and what the owner answers), the twenty-one agents `.compozy/agents/<role>/AGENT.md` (one per
   devkit role, generated from the Claude agent files and written verbatim), the three loops
   `.compozy/loops/devkit-change/loop.yaml`, `.compozy/loops/devkit-review/loop.yaml` and
   `.compozy/loops/devkit-roadmap/loop.yaml`, and `.compozy/bin/devkit-kit`, executable and verbatim
   (every loop calls `.compozy/bin/devkit-kit <checker>` instead of a path from one repository). Pass
   each input from step 1 with `--set`. It records the inputs and a sha256 of every file in
   `.compozy/kit-manifest.json`, prints one line per file (`create`, `same`, `update`, `edited`,
   `accepted`, `remove` or `kept`) and writes nothing outside `.compozy/`. A loop file in the
   workspace's `.compozy/loops/` is listed and run by name: there is no step to publish it.

3. **Add a `design:` block to `openspec/config.yaml`**, with its two keys: `screen_map:`
   (`__SCREEN_MAP__`), the path to the project's screen map, and, when the project names one,
   `mockup:` (`__MOCKUP__`), the tool or document the mockup lives in (informational only; `screens-check`
   does not read it) - only when the project has at least one screen to track. A
   project with no browser surface gets no block, and `screens-check` stays a no-op for it.

   ```yaml
   design:
     screen_map: docs/design/screen-map.md
     mockup: Figma
   ```

   The map at `screen_map` must carry the two things the `screen-design` skill's `screens-check`
   reads: a row per screen with **the screen id as the row's first cell**, and somewhere in the
   document a line starting with `Mockup:` carrying the version or the date the rows describe
   (`Mockup: v3`, `Mockup: 2026-11-14`). See the `screen-design` skill for how a row is proposed
   and where it is written.

### devkit-kit's resolver

`.compozy/bin/devkit-kit` finds the devkit checkers (`deliver-check`, `conduct-check`, `change-loop`,
`roadmap-loop`, `review-round`) at
`$DEVKIT_HOOKS`, in a repository checkout, or in the installed `devkit-openspec` with the highest
version under the Claude Code plugins directory; it resolves its own pack's `screens-check` the
same way, scoped to `devkit-compozy`, without `$DEVKIT_HOOKS` (design D9). That search honours
`$CLAUDE_CONFIG_DIR` (the same variable Claude Code itself uses to relocate its config directory)
to find the plugins directory, defaulting to `~/.claude/plugins`. Nothing in this install step
needs to set `$CLAUDE_CONFIG_DIR`; it matters only to a session that redirects Claude Code's own
config elsewhere.

## What it never does

- **Start a run.** `/devkit` starts them, or `compozy loop run`, as a later, separate step.
- **Write product code, a test or a spec.** This skill only writes `.compozy/` and the one
  `design:` block of `openspec/config.yaml`.

## Re-running over an existing `.compozy/`

Run `install-kit.mjs` again. The manifest's recorded inputs are reused (`--set` overrides one), so
the skill asks again only for an input the project does not already record. An input the templates no
longer have is dropped from the manifest and printed as `dropped __NAME__`. Per file:

- a file the project did not edit (its bytes still match the recorded digest) is replaced by the
  current template without a question (`update`); one already equal to its rendering is `same`,
  not written, and its digest is recorded;
- a file the project edited is `edited`: left in place, with its difference from the current
  template printed. Show the difference to the owner and ask yes or no for that file, one question
  per file; on yes, run again with `--accept .compozy/<path>` for it (`accepted`);
- the first re-run of an install made before the manifest existed treats every file that differs
  from the template as edited, so nothing the project wrote is lost.

A project on the first kit has five retired files: the four role shells
`.compozy/agents/{tech-lead,dev,qa,design}/AGENT.md` and `.compozy/loops/openspec-change/loop.yaml`.
One that still equals its recorded digest is deleted (`remove`, with its folder when it is empty). One
the project edited, or that has no recorded digest, is kept (`kept`) and named: show it to the owner,
and on yes run again with `--accept .compozy/<path>` for it (`remove`). Runs of the old loop under way
finish on the loop definition CompozyOS already holds. A workspace whose default agent was `tech-lead`
needs another one: `compozy workspace edit <name> --default-agent change-coordinator`.

It never touches a file outside `.compozy/` and `openspec/config.yaml`'s `design:` block.
