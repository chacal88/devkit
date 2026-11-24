<!-- devkit-stage requirements result=passed attempt=1 commit=0d5aebd77d65b21a557a827f185b6a4e65d3f815 -->
# Requirements

## Request

> asked by the owner on 2026-11-22: a study, ending in a written recommendation and no product code, of what the side pane should show during a roadmap run. Today `devkit-panel` is already a side pane of the desktop app, but it draws only the one change its session conducts. The owner's reference, the side pane of another project of theirs, draws the whole run in two views: a roadmap view (the train of rounds, the cards of each change, "who owes") and a factory view (a header of counts: demands, working, ready, waiting for you, asleep, delivered; then each round as a grid of cards, each with its number, a row of stage dots, its state and "acts: you / the agent"). The owner found it clearer than following the sessions one by one. The study compares the two on real runs of this roadmap, says which views and fields the devkit pane takes, whether it extends `devkit-panel` or replaces it, and what it reads (`change-state`, the roadmap run file, the machines of `remote-worker`), and hands its result to `coordination-panels` as that change's grill input.

Classification: domain=tooling type=study flags=[docs] (confirmed)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The deliverable is one Markdown file, `openspec/changes/roadmap-panel-study/design.md`, the written recommendation. The change writes no product code, no hook, no test and no mock-up (the screens are drawn later, in `coordination-panels`).
- The recommendation takes ONE board for a roadmap run: counts on top (waiting for you, working, in line, asleep, delivered), a strip of rounds as wagons with their counts, one card per change, and a foot line "who owes: you (n) / agents (n)". This was answered by the coordinating session under the owner's delegation, on 2026-11-23, in the grill. The alternative, two switchable views as in the owner's reference (a roadmap view and a factory view), stays in the recommendation as option B with its cost (a second layout to draw, test and translate, and a switch the owner must learn), so the owner picks when reading it.
- The panel is read-only, as `docs/coordination-design.md` section 6 (D-6) decided: no button starts, sends or changes anything; a press only opens a detail, a document or a session (the existing `mcp__ccd_window__open_session_in` path of `plugins/panel/hooks/sessions.ts`).
- The panel reads each change's state from the `state` command of `plugins/openspec/hooks/change-loop.mjs` (ADR 0017, decision 1), never from the stage files one by one, and the list of rounds and queue from `openspec/roadmap.md` and the board of `plugins/openspec/hooks/roadmap-loop.mjs status`. The machine of each change comes from the board's machine column (`remote-worker`, ADR 0020).
- Extend or replace: `coordination-cleanup` (roadmap line, D-11) already removes the old `devkit-panel` once `coordination-panels` replaces it, so the new panels replace it. The study says which files of `plugins/panel/hooks/` (`pane.tsx`, `sessions.ts`, `i18n.ts`, `register.tsx`, `report.ts`) the new panel reuses and which it drops, and does not re-decide the replacement.
- "The real runs of this roadmap" are: the board `roadmap-loop.mjs status` printed on 2026-11-23 (8 waiting for the owner, 13 under way on two machines, 12 in the queue, 35 archived) and the `state` command's JSON for this change. The study lays the reference's fields beside what these commands give, field by field, and lists each field the commands cannot give yet (for example the age of a change's work, "working 5 h", and a per-change share of budget).
- The reference is described only as "another project's side pane"; no project name, no screenshot and no file of it enters this repository (it is public).
- Every file of the change is in English; the owner is spoken to in Brazilian Portuguese.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: `design.md` of this change holds a table with one row per field of the owner's reference (the header counts, the strip of rounds, the card's number, stage dots, state in words, "acts: you / the agent", the machine, the "who owes" line), saying for each: taken or dropped, and the command or file it is read from.
- AC-2: `design.md` states the views the devkit pane takes (one board, per the answer above) and keeps option B (two views) with its cost, in a section the owner can answer in one word.
- AC-3: `design.md` states, in one section, whether the new panel extends or replaces `devkit-panel`, with the list of files of `plugins/panel/hooks/` reused and dropped.
- AC-4: `design.md` lists what the pane reads (`change-loop.mjs state`, the run file, `roadmap-loop.mjs status`, `remote-worker`'s machine column), the refresh rule, and each field no command gives today, so `coordination-panels` knows what to ask of the commands.
- AC-5: `design.md` ends with a section "Grill input for coordination-panels": the decisions and the open points, each as a line `coordination-panels` can copy into its requirements.
- AC-6: The comparison is drawn on the real board of 2026-11-23 and the `state` JSON of this change, pasted as text in `design.md` or in the evidence.
- AC-7: The change adds no file under `plugins/` and `scripts/`, and `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.

## Out of scope

- Any product code, any mock-up or screen drawing, and the build of the panels (`coordination-panels`).
- The status bar under the message box (`run-status-bar`) and the delivery train (`delivery-train`).
- Removing the old panel (`coordination-cleanup`).
- Changing `change-state`, the run file or the board's output: the study only lists what is missing.
