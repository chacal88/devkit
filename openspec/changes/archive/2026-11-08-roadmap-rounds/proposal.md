# Proposal

## Why

The orchestrator that devkit replaced grouped changes into rounds and drove one session per change; with OpenSpec alone every change is a flat entry in `openspec list`, so the order between changes and "where are we in the plan" live only in someone's head. We want that grouping back without a coordinator process: as a file the session-start hook reads, informing but never blocking.

## What Changes

- New optional file `openspec/roadmap.md`: rounds as `## ` headings, one change per checklist line, optional dependencies:

  ```markdown
  # Roadmap

  ## Round 1: auth
  - [x] auth-scopes

  ## Round 2: exports
  - [ ] add-csv-export (after: auth-scopes)
  - [ ] export-audit-log
  ```

  The current round is the first one with an unticked line.
- The `session` mode of `plugins/openspec/hooks/guard.mjs` prints the current round when `roadmap.md` exists: its title, `done/total`, and for each unticked change its state, derived from disk only:
  - `not started` (no folder under `openspec/changes/`),
  - `open` (folder exists),
  - `archived, tick it` (only under `openspec/changes/archive/*-<id>`),
  - `waiting on <ids>` (an `after:` dependency is not ticked).
  It prints this whether a change is active, ambiguous or absent. When every line is ticked it prints one line saying the roadmap is done.
- The roadmap never gates: `edit`, `bash` and `ci` behave exactly as today. Unreadable or malformed lines are skipped; the hook never fails because of the roadmap. The hook never writes the file.
- Docs: a "Grouping changes: the roadmap" section in `docs/openspec-flow.md`, the session-start row in `plugins/openspec/README.md`, and an archive guidance line in the `openspec-setup` config template ("tick the change in `openspec/roadmap.md`").
- Release: devkit-openspec 0.2.0 → 0.3.0 in `plugin.json` and `marketplace.json`, CHANGELOG entry.

## Acceptance criteria

- AC-1: With `openspec/roadmap.md` present, a session start prints the current round's title, `done/total`, and each unticked change with exactly one state among `not started`, `open`, `archived, tick it`, `waiting on <ids>`, whether there is one active change, several, or none.
- AC-2: Without `roadmap.md` the session output is byte-identical to today; with every line ticked it is today's output plus one "roadmap done" line.
- AC-3: The roadmap never blocks: `edit`, `bash` and `ci` results are the same with and without `roadmap.md`, and a malformed roadmap (no rounds, junk lines, unknown ids) neither crashes the hook nor changes its exit code.
- AC-4: `docs/openspec-flow.md` documents the format and the states, and the setup template's archive guidance tells the agent to tick the archived change.

## Capabilities

### New Capabilities
<!-- None: this repository keeps no openspec/specs/; the behavior is pinned by guard.test.mjs. -->

### Modified Capabilities
<!-- None. skip_specs: true -->

## Impact

- `plugins/openspec/hooks/guard.mjs` (session mode only) and `guard.test.mjs`.
- `docs/openspec-flow.md`, `plugins/openspec/README.md`, `plugins/openspec/skills/openspec-setup/templates/config.yaml`.
- `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- This repository adopts OpenSpec for its own changes: `openspec/config.yaml` (schema `devkit-lite`) and `openspec/schemas/` (copy of the plugin's schemas, installed with `install-schemas.sh .`).
- Out of scope: enforcing order between changes, starting or tracking sessions, editing `roadmap.md` automatically, a roadmap command or skill.
