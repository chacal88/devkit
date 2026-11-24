<!-- devkit-stage proposal result=passed attempt=1 commit=0d5aebd77d65b21a557a827f185b6a4e65d3f815 -->
# Proposal

Change: `roadmap-panel-study` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(the source is the round 22b line of `openspec/roadmap.md` and the owner-confirmed `requirements.md`)

## Why

During a roadmap run the owner follows a dozen or more changes across two machines, but
`devkit-panel` draws only the one change its own session conducts, and it reads `conduct-check` and
`deliver-check`, which round 24 removes. Another project's side pane draws the whole run on one
screen, and the owner found it clearer than following the sessions one by one. Before
`coordination-panels` (round 23) is grilled, the comparison should be on paper, drawn on a real run
of this roadmap: which views and fields the devkit pane takes, what each field is read from, what
no command gives yet, and what happens to the old panel's files.

## What Changes

- **New `openspec/changes/roadmap-panel-study/design.md`**: the written recommendation, in the
  fixed form given in `tasks.md` ("The design's form"), with these sections: the sources read; the
  real run (the board of `roadmap-loop.mjs status` and the JSON of `change-loop.mjs state` for this
  change, pasted as text with the time they were printed); one row per field of the reference,
  taken or dropped, with its source and whether a command gives it today; the views (one board
  recommended, two switchable views kept as option B with its cost, answerable in one word); extend
  or replace `devkit-panel`, with every entry of `plugins/panel/hooks/` reused, reused with changes
  or dropped; what the pane reads, its refresh rule and each field no command gives today; the board
  beside the mock `orchestrator-replan` approved; and, last, the grill input for
  `coordination-panels`, one copyable decision or open point per line.
- Nothing else changes: no product code, no hook, no test, no mock-up, no ADR, no spec, no version
  bump and no CHANGELOG line. The reference is named only as "another project's side pane"; no
  project name, screenshot or file of it enters the repository.

Non-goals: building or drawing the panels (`coordination-panels`); the status bar under the message
box (`run-status-bar`); the delivery train (`delivery-train`); removing the old panel
(`coordination-cleanup`); changing `change-state`, the run file or the board's output (the study
only lists what is missing).

## Acceptance criteria

- AC-1: `design.md` of this change holds a table with one row per field of the owner's reference (the header counts, the strip of rounds, the card's number, stage dots, state in words, "acts: you / the agent", the machine, the "who owes" line), saying for each: taken or dropped, and the command or file it is read from.
- AC-2: `design.md` states the views the devkit pane takes (one board, per the answer above) and keeps option B (two views) with its cost, in a section the owner can answer in one word.
- AC-3: `design.md` states, in one section, whether the new panel extends or replaces `devkit-panel`, with the list of files of `plugins/panel/hooks/` reused and dropped.
- AC-4: `design.md` lists what the pane reads (`change-loop.mjs state`, the run file, `roadmap-loop.mjs status`, `remote-worker`'s machine column), the refresh rule, and each field no command gives today, so `coordination-panels` knows what to ask of the commands.
- AC-5: `design.md` ends with a section "Grill input for coordination-panels": the decisions and the open points, each as a line `coordination-panels` can copy into its requirements.
- AC-6: The comparison is drawn on the real board of 2026-11-23 and the `state` JSON of this change, pasted as text in `design.md` or in the evidence.
- AC-7: The change adds no file under `plugins/` and `scripts/`, and `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.

## Capabilities

None. A study changes no behaviour, so the change declares no capability and sets
`skip_specs: true` in its `.openspec.yaml`. The capabilities the panels will touch are
`coordination-panels`' to declare.

## Impact

- `openspec/changes/roadmap-panel-study/`: `design.md` added at the implementation stage, beside
  the plan files.
- `plugins/` and `scripts/`: none (AC-7). No pack's version moves.
- `devkit-panel` and the commands it would read (`change-loop.mjs state`, `roadmap-loop.mjs
  status`, the run file `<git common dir>/devkit/roadmap-run.json`, the `machines` setting): read
  only, unchanged.
- `coordination-panels` (round 23): its grill takes the last section of `design.md` as input.

Dependencies: none open. `change-state` (ADR 0017), `remote-worker` (ADR 0020) and
`roadmap-sessions-upfront` (ADR 0021) are archived, so the commands the study reads exist on the
base.

Decisions cited: ADR 0010 (the panels read-only, built in round 23; the old panel goes in round 24;
its review trigger "the owner wants to start work from a panel"), ADR 0014 (a session per change
and its title), ADR 0017 (decision 1: the panels read the state command), ADR 0020 (the machine of
each change, the `machines` setting, the board asking each machine over SSH), ADR 0021 (every change
of a run open from its start, the run's places, the periodic check), and `docs/coordination-design.md`
sections 6 (D-6, the read-only panels and the approved mock), 9 (D-9, the panels' language per
person) and 11 (D-11, `devkit-panel` removed in round 24).

Open decisions inherited: none. The open points of `docs/coordination-design.md` do not touch the
panels.
