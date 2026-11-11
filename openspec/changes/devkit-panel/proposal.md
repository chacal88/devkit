# Proposal

Change: `devkit-panel` · Date: 2026-11-10 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(requirements.md holds the grill)

## Why

The owner keeps one engine, the devkit plugin, and retires the orquestrador mod's own flow engine;
what that mod did well, a side pane that shows where every change stands and buttons that put the
owner's next command in the prompt box, has no home in devkit. `conduct-check` and `deliver-check`
already compute every state the pane needs; nothing draws them beside the chat.

## What Changes

- A new pack, `devkit-panel` 0.1.0, under `plugins/panel/`: a Claude Code mod (function hooks)
  that draws a pane and a one-line band from the checkers' JSON, lists the linked child sessions
  of each change and fills the prompt box with the owner's next command. Read-only: it starts no
  session, schedules nothing beyond its own 60 s refresh while the pane is open, writes no file and
  never submits a prompt.
- `.claude-plugin/marketplace.json` lists the pack; `scripts/gen-catalog.py` and `docs/catalog.md`
  know it; `docs/conventions.md` adds it to the pack table; `docs/openspec-flow.md` gets a short
  section on the panel; CHANGELOG `## 0.10.0 — devkit panel`, marketplace version 0.10.0.
- devkit-openspec 0.9.2: one line, `devkit-panel` in `PACKS` of
  `plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs`, so `openspec-setup --packs`
  accepts the pack (a guard test pins `PACKS` to the marketplace's pack names; the owner chose the
  bump over an exception on 2026-11-11). `DEFAULT_PACKS` is unchanged. No change to devkit-core,
  and no ADR (the panel stays within ADR 0001: it
  reads the repository, GitHub through the checkers and the app's own list of sessions, and drives
  nothing).

## Acceptance criteria

- AC-1: `claude plugin validate .` passes with `plugins/panel` (`devkit-panel` 0.1.0) listed in
  `.claude-plugin/marketplace.json` and `docs/catalog.md`; `python3 scripts/gen-catalog.py`
  leaves no diff; `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`
  passes.
- AC-2: In an OpenSpec devkit project the pane lists every change of the current roadmap round
  with `id`, `next.step`, `next.actor` and `state` from `conduct-check --json` (version 2) run in
  the project root with `DEVKIT_HOST=app`, and the header names the checker (`devkit-openspec
  <version>` or `repo`).
- AC-3: Open changes not in the round and archived changes are listed by name, collapsed, without
  running a checker.
- AC-4: Outside an OpenSpec devkit project the pane shows one line, no checker runs and the band
  is not drawn.
- AC-5: Expanding a change row runs `deliver-check <id> --json` once per refresh in the change's
  worktree and shows its 8 items (`met`/`open`/`blocked` with the reason), `summary` and
  `next.step`.
- AC-6: The report refreshes at session start, when the pane opens, at the end of each main-loop
  turn, every 60 s while the pane is open and on the `Refresh` button; two triggers never run two
  checkers at once; while a run is in flight the last good report stays with its age; a checker
  error (non-zero exit, timeout) is one header line and the last good report stays.
- AC-7: With `list_sessions` allowed, each change lists the linked sessions whose `name` matches
  `^<sessionPrefix>[0-9]+$` as running, idle or archived; with `ask` or `deny` one line names the
  tool, the lists stay empty and no dialog opens from a timer.
- AC-8: Every owner button fills the prompt box with the exact text of the Assumptions and never
  submits it, never starts a session and never calls a session tool; when the fill answers
  `isFilled: false` the same text is toasted.
- AC-9: In a devkit project the band shows the round summary and a button that opens or closes the
  pane; `/devkit-panel` toggles the pane; outside a devkit project the band passes to the engine.
- AC-10: `userConfig.language` (`pt-BR` default, `en`) selects every pane, band and toast text;
  the module's code, comments and docs are in English.
- AC-11: `claude plugin validate plugins/panel` reports no refusal, and the module calls no
  `start_session`, `prompt.submit`, `clock.after`, `fs.write` or `store` method (read-only pack).
- AC-12: `claude plugin test plugins/panel` passes, with tests through the `claude-code/testing`
  kit that mock `process.run`, `tool.check`, `tool.call`, `fs` and `prompt.fill` and cover AC-2
  to AC-10 on the `terminal` and `desktop` surfaces.
- AC-13: Loaded in the devkit repository through the app (the session's mods folder or
  `CLAUDE_CODE_PLUGIN_DIRS`), the pane shows round 5 (`commit-and-pr-trailer`,
  `conventions-trailer`), the archived changes and the linked child sessions; the pane's text is
  recorded in `evidence.md`.

## Capabilities

### New Capabilities

None as spec deltas: this repository keeps no `openspec/specs/` and pins behaviour with tests
(`skip_specs: true` in `.openspec.yaml`, as every archived change did). The behaviour is the
acceptance criteria above, pinned by `plugins/panel/hooks/*.test.tsx`.

### Modified Capabilities

None.

## Impact

- New: `plugins/panel/` (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `hooks/register.tsx`
  and sibling modules, `types/index.d.ts`, `hooks/*.test.tsx`, `README.md`).
- Edited: `.claude-plugin/marketplace.json` (new entry, `metadata.version` 0.10.0, devkit-openspec
  0.9.2), `plugins/openspec/.claude-plugin/plugin.json` (0.9.2),
  `plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs` (`PACKS`),
  `scripts/gen-catalog.py` (`PACKS`), `docs/catalog.md` (generated), `docs/conventions.md` (pack
  table), `docs/openspec-flow.md` (panel section), `CHANGELOG.md`.
- Dependencies: none added to the repository. At run time the pack needs `node` on the host's
  PATH and an installed `devkit-openspec` (project scope of the project, else user scope), or the
  devkit repository's own `plugins/openspec/hooks/`; without either it shows one line.
- Exit criteria: `claude plugin validate .`, `claude plugin test plugins/panel`, `python3
  scripts/gen-catalog.py --check`, `node --test plugins/openspec/hooks/guard.test.mjs && python3
  scripts/check.py`, all green at the PR's head; the live check of AC-13 in `evidence.md`.
- Decisions cited: ADR 0001 (no harness; the panel drives nothing), ADR 0004 (opt-in per project:
  the panel draws only where the hooks act), ADR 0006 (children are named `<sessionPrefix><n>`).
  Open decisions inherited: none.
