# Design: the side pane of a roadmap run

Change: `roadmap-panel-study` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

This study lays another project's side pane, which the owner found clearer than following the sessions one by one, beside what devkit's own commands give during a roadmap run, field by field, on the board printed for this run. It says which views and fields the devkit pane takes, whether it extends or replaces `devkit-panel`, what it reads and how often, and what no command gives yet. It writes no product code and no mock-up. Its reader is the grill of `coordination-panels` (round 23), which takes the last section as input.

## Sources

- `openspec/changes/roadmap-panel-study/requirements.md`: the request, and the answered views (one board, option B kept with its cost); the reference's fields are known only from here and from the roadmap lines below, nothing else of it is used.
- `openspec/roadmap.md`, rounds 22b, 23, 23b, 23c and 24: the reference's fields as the owner described them on 2026-11-22 (the header line, the strip of rounds, the row of figures, the card, the ahead list, the foot line), the status bar that shares the budget field (`run-status-bar`), and the removal of the old panel (`coordination-cleanup`).
- `docs/coordination-design.md`, section 6 (D-6): the panels are read-only and a press only opens a detail, a document or a session; section 9 (D-9): the panels' language is the person's; section 11 (D-11): `devkit-panel` goes in round 24, after round 23's panels; "What stays shipped until its round" and "Where a change runs": what exists until then, and how another machine's changes are read.
- `docs/adr/0010-openspec-as-the-harness.md`: the loop's four ends, the read-only panels, the old panel's removal, and its review trigger "the owner wants to start work from a panel".
- `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`: one app session per change, its title (stage icon and id), and that a start happens only on a turn the owner typed.
- `docs/adr/0017-a-change-state-is-derived-in-one-place.md`: decision 1, the state is derived in one place and the panels read the state command; the state icons.
- `docs/adr/0020-a-change-can-run-on-another-machine.md`: the `machines` setting, the claim on `origin`, the board asking each listed machine over SSH, 20 s at most each, and the load.
- `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`: every change opens at the run's start, the run's places and bookkeeping, the periodic check about every 30 minutes, and the held states.
- `plugins/panel/README.md` and `plugins/panel/.claude-plugin/plugin.json`: what the old pane shows (the conducted change, ten steps, pending tasks, child sessions, other open changes), its refresh timings, the buttons that fill the prompt, and the pack's version and language setting.
- `plugins/panel/hooks/` (`commands.ts`, `conducted.ts`, `detail.ts`, `fixtures/`, `grammar.ts`, `hooks.json`, `i18n.ts`, `pane.tsx`, `panel.test.tsx`, `project.ts`, `register.tsx`, `report.test.tsx`, `report.ts`, `sessions.ts`, `steps.ts`) and `plugins/panel/types/index.d.ts`: what each file reads and does today, for the table of fates.
- `openspec/changes/archive/2026-11-19-orchestrator-replan/mock/` (`canvas.json` and the five `.dc.html` screens, the roadmap coordinator's first): the approved mock, whose labels are rendered here in English. Its planning page was read for context only and is not quoted.
- `plugins/openspec/hooks/change-loop.mjs`, command `state`: the JSON of a change's state (`state`, `reason`, `stage`, `stageTitle`, `phase`, `stageIcon`, `stateIcon`, `title`, `script`, `root`, `branch`), derived in one place; run on this change below, and on the whole clone for the count of entries it lists.
- `plugins/openspec/hooks/roadmap-loop.mjs`, command `status` and its `--json` form: the board printed below, its header, its blocks and its machine column; and the object another machine's probe prints (`id`, `where`, `icon`, `waitsForPlace`).
- `plugins/openspec/hooks/flow-check.mjs` with `--json`, and the stage lists of `plugins/openspec/schemas/devkit/flow.json` and `plugins/openspec/schemas/devkit-lite/flow.json`: the per-stage result a row of stage dots would need.
- `plugins/openspec/hooks/run-file.mjs`: the run file `<git common dir>/devkit/roadmap-run.json`, its fields (`places`, `inflight`, `declared`, `startedSessions`, `placed`, `tickets`, `occupied`, `queued`, `waits`, `cron`, `check`) and which of them carry a time.
- `plugins/openspec/hooks/machine-probe.mjs`: the program sent over SSH to ask another machine (`state`, `checkout`), and its 15 s limit.
- `openspec/changes/archive/2026-11-23-change-budget/proposal.md`: what the budget count is, where it is counted (the session transcript, before a hand-off) and that showing it in a panel was left out of that change.

## The real run

Printed on: 2026-11-23 23:59

Both commands ran from this change's worktree with the temporary folder set to `/private/tmp/devkit-roadmap-panel-study`, one after the other in the same minute, each with exit 0 and nothing on standard error. The print is of 2026-11-23, the day of the plan; the board changes by the minute, so this is the board of that time and not the planning-time snapshot (2 waiting for you, 21 under way, 12 in the queue, 35 archived) nor the grill's (8, 13, 12, 35).

### The board

`node plugins/openspec/hooks/roadmap-loop.mjs status --lang en --load-limit 80 --machines '[]'`

```text
Roadmap: 9 open of 2 · 11 in the queue · 35 archived

Waiting for you
  run-status-bar                  your approval of the mock-up · MacBook-Pro-2
  project-setup                   your approval of the plan · MacBook-Pro-2
Under way
  fresh-base-check                open on avell · avell
  delivery-merge-hold             open on avell · avell
  archive-release-pin             open on avell · avell
  post-merge-validate             open on avell · avell
  release-merge-leftovers         Implementation, phase 1 of 3 · MacBook-Pro-2
  evidence-attempts-by-failure    open on avell · avell
  stale-only-on-own-files         open on avell · avell
  state-skips-unlocated           Implementation, phase 1 of 3 · MacBook-Pro-2
  stage-models                    open on another machine · another machine
  coordinator-loop-fixes          Plan readiness · MacBook-Pro-2
  own-pr-archive-paths            open on avell · avell
  loop-place-and-evidence         open on avell · avell
  jira-entry-followups            Plan readiness · MacBook-Pro-2
  compozy-driver                  Implementation, phase 6 of 6 · MacBook-Pro-2
  roadmap-panel-study             Implementation, phase 1 of 1 · MacBook-Pro-2
  delivery-train                  open on another machine · another machine
  project-slice-claim             open on avell · avell
  stage-ceiling-consecutive       open on avell · avell
  suite-speed                     open on avell · avell
  forced-merge-path               Implementation, phase 1 of 3 · MacBook-Pro-2
In the queue
  roadmap-live-checks             ready, waits for a place
  release-merge-live-check        ready, waits for a place
  release-pin-is-a-release-file   ready, waits for a place
  project-slice-dogfood           ready, waits for a place
  jira-entry-live                 ready, waits for a place
  script-driver                   ready, waits for a place
  coordination-panels             waits for roadmap-panel-study
  coordination-cleanup            waits for coordination-panels
  lean-pr-template                ready, waits for a place
  remote-worker-live-checks       ready, waits for a place
  sessions-upfront-live-checks    ready, waits for a place
```

The header counts this machine's open changes, the run's places, the lines of the queue and the archived lines. It reads "9 open of 2" because the first number is the changes placed on this machine (the 2 under "Waiting for you" and the 7 under "Under way" that name this machine) and the second is the run's number of places, not a total, so the first can read above the second (ADR 0021's note says the same of this machine's row: it can hold more places than the run's number). With `--machines '[]'` the 13 changes open on other machines (11 on one named machine and 2 on a machine the board cannot name) are left out of it, while the same board lists all 20 rows under "Under way". With the machines listed, the header uses the other form that counts them. It has no total of the roadmap's lines and no round.

"Waiting for you" holds the changes whose state is `waiting-for-owner`, each with the gate in words (the approval of a mock-up, the approval of a plan) and the machine after a middle dot. The state command says the same for this machine: two changes in that state, with the reason codes `waiting-mockup` and `waiting-approval`. The owner's action ("you") is the whole block's meaning; no row says it in a column.

"Under way" holds 20 rows. The 7 of this machine say the stage in words, with "phase n of m" while it implements (for example "Implementation, phase 1 of 3"). The 13 of other machines say only "open on <machine>": the board read the claim on `origin` (the pushed branch names the machine) and, with no machine listed in the setting, asked nobody, so the row has no stage, no state and no reason. With a listed machine that answers, the row would carry that machine's stage text (`status --json`'s `where`) instead (ADR 0020). The one "Under way" row of this change reads "Implementation, phase 1 of 1", the same stage and phase the state JSON below gives.

"In the queue" holds 11 rows: 9 "ready, waits for a place" and 2 "waits for <id>", the dependency not yet archived (`coordination-panels` waits for this change, and `coordination-cleanup` for `coordination-panels`). The rows carry no machine, no round, no age and no order number; their order is the roadmap's.

Nothing on the board gives a round, a time, a budget, an owner of the next move as a word ("you" or "agents") or a link to a session. Two things on it the sources do not explain, and task 1.8 turns them into open points: the machine of `stage-models` and `delivery-train` reads "another machine" (the code gives that when a claim names no machine, which it does for a claim it could not read in its time and branch budget, but this print does not show which of the two it was); and the state command, run without `--change` a minute later, listed 10 entries for this clone, one of them `roadmap-coordinator-followups`, a change archived on 2026-11-22 that has no row on the board; the run file of this clone is of 2026-11-21 (`stopping` true, `places` 2, that change in `inflight`), so it is no live run, and the study cannot say whether its leftover names are what the state command listed.

### The state of this change

`node plugins/openspec/hooks/change-loop.mjs state --change roadmap-panel-study --lang en`

```json
{
  "version": 1,
  "changes": [
    {
      "change": "roadmap-panel-study",
      "state": "running",
      "reason": null,
      "stage": "implementation",
      "stageTitle": "Implementation",
      "phase": 1,
      "stageIcon": "🛠️",
      "stateIcon": null,
      "title": "🛠️ roadmap-panel-study",
      "script": "devkit-lite",
      "root": "<repo>/.claude/worktrees/roadmap-panel-study",
      "branch": "roadmap-panel-study"
    }
  ]
}
```

The state JSON is one object with `version` and a `changes` list; here one entry. It says what the board says for this change and a little more: the state (`running`) with no reason, the stage as an id (`implementation`) and in words, the phase, the two icons (`stageIcon` set, `stateIcon` null while it runs), the session title, the script (`devkit-lite`), the worktree and the branch. It has no time, no age, no budget, no machine, no list of the stages and no link to the session. Without `--change` it lists every unfinished change of this clone and the ones its run file names, and none of the changes that are open only on another machine.

## Fields of the reference

The views come from the descriptions in `requirements.md` and the round 22b and 23 lines: the factory view has the header of counts and, in each round's grid, the card's number, its row of stage dots, its state and who acts; the roadmap view has the train of rounds, the cards of each change and "who owes". Where those descriptions do not say which view a field belongs to, the cell says `both` and the lines below the table say it is not settled. "Taken" and "dropped" are for the one board of the recommended answer (see Views). "Today" is what the commands give on the print above or by a field named in the sources.

| Id | Field | View | Decision | Read from | Today |
|---|---|---|---|---|---|
| R-1 | Count: demands | factory | dropped | none | missing (G-1) |
| R-2 | Count: working | factory | taken | `change-loop.mjs state` (`state` running, no held reason) and the "Under way" rows of `roadmap-loop.mjs status` | partly (G-2) |
| R-3 | Count: ready | factory | taken | `roadmap-loop.mjs status`, the header's "in the queue" count and the "In the queue" rows, shown as "in line" | given |
| R-4 | Count: waiting for you | factory | taken | `change-loop.mjs state` (`state` waiting-for-owner) and the "Waiting for you" rows of `roadmap-loop.mjs status` | partly (G-2) |
| R-5 | Count: asleep | factory | taken | `change-loop.mjs state` (`reason.code` held-place, held-load or held-after) | partly (G-3) |
| R-6 | Count: delivered | factory | taken | `roadmap-loop.mjs status`, the header's archived count | given |
| R-7 | Header line: n of m delivered | roadmap | dropped | `roadmap-loop.mjs status` header and `openspec/roadmap.md` | partly (G-4) |
| R-8 | Strip of rounds: one wagon per round with its count | roadmap | taken | `openspec/roadmap.md` (the round headings and their lines) | partly (G-5) |
| R-9 | Row of figures: one per change | roadmap | dropped | `change-loop.mjs state` (`state`, `stateIcon`) | partly (G-2) |
| R-10 | Card: number | factory | taken | `change-loop.mjs state` (`change`, the change id, in the number's place) | given |
| R-11 | Card: stage icon | roadmap | taken | `change-loop.mjs state` (`stageIcon`) | given |
| R-12 | Card: stage dots | both | taken | `flow-check.mjs` with `--json` (`stages` and each `state`) and `change-loop.mjs state` (`stage`) | partly (G-6) |
| R-13 | Card: state in words | both | taken | `change-loop.mjs state` (`state`, `reason.text`, `stageTitle`, `phase`) | partly (G-2) |
| R-14 | Card: age of the work | roadmap | taken | `change-loop.mjs state`, to carry a time it has none of today | missing (G-7) |
| R-15 | Card: reason of a wait | roadmap | taken | `change-loop.mjs state` (`reason.text` and `reason.code`) | partly (G-2) |
| R-16 | Card: acts: you / the agent | factory | taken | `change-loop.mjs state` (`state`, read as who acts) | partly (G-8) |
| R-17 | Card: machine | both | taken | `roadmap-loop.mjs status`, the machine after the middle dot of each row | given |
| R-18 | Card: Open link to the session | roadmap | taken | the app's session list (`mcp__ccd_session_mgmt__list_sessions`) and `mcp__ccd_window__open_session_in` | partly (G-9) |
| R-19 | Ahead list: the next round's changes | roadmap | dropped | `openspec/roadmap.md` and the "In the queue" rows of `roadmap-loop.mjs status` | partly (G-5) |
| R-20 | Foot line: who owes: you (n) / agents (n) | roadmap | taken | the counts of R-16, from `change-loop.mjs state` | partly (G-8) |
| R-21 | Card: share of the budget | both | dropped | none | missing (G-10) |

Why each dropped field is dropped:

- R-1 (dropped): the board answered for the devkit pane has no count of demands, and `requirements.md` and the roadmap lines name the count without saying what the reference counts as a demand; the study does not guess it, so it is an open point (G-1).
- R-7 (dropped): on one board its "n" is the delivered count of R-6 and its "m" is each wagon's total in R-8, so a header line would say the same twice; the sum stays derivable from the counts.
- R-9 (dropped): the card of each change already carries its state in words and its stage icon, so a row of small figures would show every change twice on a narrow pane.
- R-19 (dropped): the changes of the next round are cards in state "in line", so a separate ahead list would repeat them.
- R-21 (dropped): the share of the budget is the status bar's field (`run-status-bar`, round 23c), and a change with no `budget:` has no share to show; the card can take it later with no change of layout, once a command gives it (G-10).

What is missing for each partly field:

- R-2, R-4, R-9, R-13 and R-15 (G-2): the state and its reason of a change open on another machine. The board's row for it says only "open on <machine>" and the probe's object has `where`, `icon` and `waitsForPlace` but no state or reason, so 13 of the 20 "Under way" rows on this print cannot be counted as working or waiting for you.
- R-5 (G-3): a held change is "asleep" in the `state` command only in a run that opens every change at its start (ADR 0021), through the `held-*` reasons; this print has no live run (see the run file's date above), so no held state was seen on a real board, and the study could not tell it from a plain queued line.
- R-7 (G-4): the header's open count leaves out the changes open on other machines when the `machines` setting is empty (9 here, against 22 rows), its second number is the run's places and not a total, and no command prints the total of the roadmap's lines.
- R-8 and R-19 (G-5): the rounds are in `openspec/roadmap.md`, and `roadmap-loop.mjs` reads them, but no command prints them: the board is grouped by state and has no round, so the pane would have to parse the file itself.
- R-12 (G-6): the state command gives the current stage and the script, and the two flows list 12 and 17 stages; the result of each stage (passed, not applicable, pending) comes from `flow-check.mjs` with `--json`, one call per change, which reads the stage files one by one: ADR 0017 decision 1 says the panels read the state command, so this is an exception to it until O-6 is answered.
- R-16 and R-20 (G-8): no command says who acts; the pane would derive it from `state`, and the rule for `blocked` and for a wait on GitHub is not decided (see the open points).
- R-18 (G-9): no command gives the app session of a change: the run file's `startedSessions` holds only a time, so the pane finds a session by its title, which ends with the change id (ADR 0014, ADR 0017), the way the old pane finds child sessions.

Not settled by the descriptions: the view of R-12, R-13, R-17 and R-21 (the card's dots, its words, its machine and its budget are not placed in one view or the other), and whether the reference's "ready" (R-3) leaves out the changes that wait for a dependency, which the board's "in line" includes.

## Views

The reference has two views of a roadmap run. The question for the devkit pane is whether it draws one board or both views with a switch. The coordinating session answered it with one board under the owner's delegation, in the grill of this change on 2026-11-23, and kept the other as option B with its cost, so the owner can overrule it by reading this section.

Recommended: A (one board)

A is one screen for a roadmap run, top to bottom (the labels are the approved mock's, in English):

- Counts on top: waiting for you, working, in line, asleep, delivered (R-2 to R-6; the reference's count of demands is dropped, R-1).
- A strip of rounds: one wagon per round with its count of delivered changes out of its total (R-8).
- One card per change: the change id, its stage icon, its row of stage dots, its state in words with the reason of a wait, who acts (you or the agent), its machine and an Open link to its session (R-10 to R-13, R-15 to R-18); the age of the work is added when a command gives it (R-14).
- A foot line, "who owes: you (n) / agents (n)" (R-20), and, as in the approved mock, a line saying when the screen was read and when it is read next.

Every press opens something (a session, a detail, a document) or refreshes; none starts, sends or changes anything (D-6).

Option B: two views

B is the reference's own shape: a roadmap view (the train of rounds, a row of small figures one per change, the cards, the ahead list and the "who owes" foot line) and a factory view (the header of counts, then each round as a grid of cards with the number, the stage dots, the state and who acts), with a switch between them. B shows what A does not: the header line "n of m delivered" (R-7), the row of figures (R-9) and the ahead list (R-19), and a grid that holds more changes on a screen than a column of cards does. This print has 20 changes under way and 11 in the queue, which is a long column in a narrow pane.

Cost of B: a second layout to draw, test and translate in both panel languages (pt-BR and en, D-9), and a switch the owner must learn. For scale, the old pane's one layout of six screens is 1265 lines in `pane.tsx`, 558 in `i18n.ts` (every string in both languages) and 2304 of tests in `panel.test.tsx`: a measure of what a layout costs here, not an estimate of B. B also needs a screen the owner has not approved (the approved mock has one roadmap coordinator screen, D-6, so a second view means a new mock before its plan), and three fields whose sources are only partly given today (R-7, R-9 and R-19: G-4, G-2 and G-5).

Answer in one word: A or B

## Extend or replace devkit-panel

Decision: replace

This is decided already, not decided here. The `coordination-cleanup` line of `openspec/roadmap.md` (round 24) removes "the old panel" once `coordination-panels` replaces it; D-11 of `docs/coordination-design.md` lists `devkit-panel` under "What stays shipped until its round" with "round 24 (cleanup), after round 23's panels"; and ADR 0010 decision 8 says the old panel "goes in round 24, after the new panels of round 23 read the new checker". The new panels are a new pane, not an edit of the old one. "Reused" below means the file's idea or code is carried into the new pane under the same name or another; it does not keep the old pane alive past round 24.

The old pane reads `conduct-check` and `deliver-check` (round 24 removes both) and finds the change its session conducts from the transcript and from the child sessions of ADR 0006 (round 24 removes that code too); the new one reads `change-loop.mjs state` and `roadmap-loop.mjs status` and draws a whole run. Beside that, D-6 and the requirement's rule (a press only opens a detail, a document or a session) leave no room for the old pane's buttons that fill the prompt, and D-9 keeps the language per person, which `i18n.ts` already does.

| File | Fate | Why |
|---|---|---|
| `commands.ts` | dropped | its buttons (`Conduzir`, `Continuar aqui`, `Aprovar plano`, `Responder retro`) fill the prompt with the owner's next command; the new pane only opens a session, a detail or a document, and the owner types the command (D-6, ADR 0010's review trigger) |
| `conducted.ts` | dropped | finds the one change this session conducts, from the newest `/devkit change <id>` or retired `/conduct` in the transcript and from this session's child sessions of ADR 0006; the board draws the whole run and needs neither; how the change coordinator's own panel finds its change is an open point |
| `detail.ts` | dropped | short lists of `deliver-check` items and command labels for the step detail, which the board does not have; `clip` (one line) and `summaryOf` (the proposal's one-line summary) are small enough to write again if a card shows a summary |
| `fixtures/` | reused with changes | only `sessions.ts` (the app's session-list rows) stays; `change.ts`, `deliver.ts`, `deliver-open.ts`, `messages.ts`, `proposal.ts`, `tasks.ts` and `worktrees.ts` pin the two checkers' JSON, the transcript and the worktree walk, and the new fixtures are the real board and state JSON of this study |
| `grammar.ts` | dropped | the panel's copies of the checkers' task and change-id expressions, kept equal to the checkers' by a parity check in `scripts/check.py`; the new pane reads the state command and not `tasks.md`, so neither goes on (the check goes with the file, in `coordination-cleanup`) |
| `hooks.json` | reused | one line that registers `./register.tsx` as the pack's module; unchanged while the entry module keeps that name |
| `i18n.ts` | reused with changes | the mechanism stays (`Lang`, `langOf` reading the person's `language` option, every string in pt-BR and en, D-9); the strings change: the ten steps and the old screens go, the board's labels come in |
| `pane.tsx` | reused with changes | its split stays (a pure model, a list of items, a render over injected elements, a plain-text form for `/devkit-panel status`, `cut` and `clockTime`); the six screens, the detail pane and the band are replaced by the board and its card |
| `panel.test.tsx` | reused with changes | the harness and the read-only tests stay (no prompt is submitted, no session starts, a refresh or a render opens nothing); the cases about the conducted change, the steps and the buttons are rewritten for the board |
| `project.ts` | reused with changes | the devkit-project test (`isDevkitProject`) and the worktree-to-project step (`projectAbove`) stay; the checker location and version test, the worktree listing and the candidate changes go, because the board command lists the changes itself |
| `register.tsx` | reused with changes | the registration, the atoms, the refresh machinery with its 60 s, 5 minute and 15 minute timings, the `/devkit-panel` command and the `mcp__devkit-panel__status` tool stay; the checker runs become the state and board runs, and the prompt fill goes |
| `report.test.tsx` | dropped | pins the parsing of `conduct-check` and `deliver-check` JSON, which round 24 removes |
| `report.ts` | dropped | parses `conduct-check --json` (version 2) and `deliver-check --json` (version 1) and works out the actor from them; the new parsers read the state JSON (version 1) and the board, and the rule for who acts is G-8 |
| `sessions.ts` | reused with changes | the session-list parse and the `mcp__ccd_window__open_session_in` call, made only on a press, stay for the Open link (R-18); the child-session matching by `<prefix><n>` of ADR 0006 goes, and a session is found by its title ending with the change id |
| `steps.ts` | dropped | the ten steps of `conduct-check` and the `tasks.md` reader behind them; the card's stage dots come from the stages of the flow (G-6), not from this table |

What outside `hooks/` follows the same fate: `types/index.d.ts` is rewritten for the new view, `README.md` and the pack's manifest (`.claude-plugin/plugin.json`, its `language` setting kept) are rewritten for the board, and the guide section of `docs/openspec-flow.md` follows; the removal of the old files themselves is `coordination-cleanup`'s, not decided here.

## What the pane reads

The pane is read-only (D-6): it runs commands that write nothing, reads files, and calls the app's session list and, on a press, its open-session call. ADR 0017 decision 1 says the panels read the state command, so it reads each change's state from that command; the one exception is the stage dots (R-12), read from `flow-check.mjs` per change until O-6 is answered; the rounds and the queue come from `openspec/roadmap.md` and the board.

### Sources read

| Source | What it gives | Rows |
|---|---|---|
| `change-loop.mjs state` (with `--change <id>`, or without it for every unfinished change of the clone and the ones its run file names) | one JSON object, version 1, per change: `state`, `reason` (`code` and `text`), `stage`, `stageTitle`, `phase`, `stageIcon`, `stateIcon`, `title`, `script`, `root`, `branch`; only changes whose folder is in this clone, so none that is open only on another machine | R-2, R-4, R-5, R-9, R-10, R-11, R-12, R-13, R-15, R-16, R-20 |
| `roadmap-loop.mjs status` (`--lang`, `--load-limit`, `--machines`) | the board as text, grouped by state: a header with the counts, the blocks "Waiting for you", "Under way", "In the queue" and the machine after a middle dot on each row; it writes nothing; it has no JSON form | R-2, R-3, R-4, R-6, R-7, R-17, R-19 |
| `roadmap-loop.mjs status --json` | what another machine's probe prints (`machine-probe.mjs` sends it over SSH and gives the remote run 15 s): the machine's name and, for each unfinished change of that clone, `id`, `where` (the stage in words), `icon` and `waitsForPlace`; no roadmap, no state, no reason | R-2, R-4, R-13, R-17 (the other machines' side of G-2) |
| `openspec/roadmap.md` | the rounds (`## Round` headings), each line with its id, its tick and its `after:` dependencies | R-7, R-8, R-19 |
| the run file `<git common dir>/devkit/roadmap-run.json` | one run's bookkeeping, shared by every checkout of the clone: `places`, `stopping`, `inflight`, `declared`, `startedSessions`, `placed`, `tickets`, `occupied`, `queued`, `waits`, `cron`, `check`, `updatedAt`; the state command already folds it in, so the pane does not read it itself; it is the one place that holds times (`occupied`, `queued`, `placed`, `startedSessions`) | R-5, R-14 (through G-7) |
| the per-person `machines` setting of devkit-openspec (with `load_limit` and `language`) | the list of other machines (`host`, `folder`, `places`) the board is asked to probe; passed to the board as `--machines`; the pane is another pack, with its own `language` setting only | R-17 |
| the machine column of the board (`remote-worker`, ADR 0020) | the name of the machine of each open change, read from the claim on `origin` (a pushed branch that names the machine) | R-17 |
| the app's session list and open-session call | the sessions the app holds, with their titles (the stage icon and the change id) and, on a press, a session shown beside the pane | R-18 |
| `flow-check.mjs <id>` with `--json` | one change's stages with each result (`stages[].state`: passed, not applicable, pending), from the stage files, for this clone's changes only | R-12 |

The machine column covers the changes open on another machine without SSH: the board reads the claims on `origin` (the pushed branches, ADR 0020 decision 1), so on this print 11 rows name one machine with `--machines '[]'`, and 2 name none (the claim could not be read). What the column does not give is those changes' stage, state or reason: for that the board asks each listed machine over SSH through `machine-probe.mjs`, and a machine that does not answer reads "no answer". So the machine column is enough for R-17, and the other machines' states need the setting listed and the probe to answer, and a probe that gives a state (G-2).

### The refresh rule

The pane reads when it opens, on a press of Refresh, at the end of a turn of this session, and on a timer every 5 minutes while it is open; never while closed. One read at a time. A `gh` rate-limit line pauses the reads for 15 minutes and the pane says so, as the old pane does (`register.tsx`: a light refresh every 60 s of the one conducted change, a full read on a press, a 15 minute back-off). The 60 s light refresh does not carry over: it was one checker for one change, and the commands of a whole run cost more than a minute on this machine. Measured on 2026-11-24, within the hour after the print (the board and the state JSON above), at a load average of about 5 and with this print's 20 changes under way: the board took 36 s and 37 s (two runs, `--machines '[]'`), `state` for the whole clone 60 s and 75 s (two runs), `state` for one change 6 s and `flow-check.mjs` for one change 1 s (one run each); each listed machine adds up to 20 s over SSH (ADR 0020). The old pane's time limit for one checker was 60 s. ADR 0021's periodic check, about every 30 minutes, belongs to the coordinating session and is not the pane's timer; the pane neither shares it nor waits for it.

The pane writes nothing, starts nothing and schedules nothing beyond its own refresh while it is open (the README's rule for the old pane, kept). It never opens a session, a detail or a document except on a press, and a refresh, a timer tick or a render opens nothing.

### Fields no command gives today

- G-1 R-1: the count of demands; no command; the pane has none until the owner says what the reference counts as a demand, and it is dropped meanwhile.
- G-2 R-4: the state and the reason of a change open on another machine (also R-2, R-9, R-13, R-15); `roadmap-loop.mjs status --json`, the probe's object, should carry `state` and `reason` as `change-loop.mjs state` does; it carries only `where`, `icon` and `waitsForPlace`, and the board row reads "open on <machine>" with no probe.
- G-3 R-5: the asleep state (a change held for a place, the load or a dependency) on a real board; `change-loop.mjs state` gives it as a `held-*` reason only for a change with a session of its own in a run that opens every change at its start (ADR 0021); no print of this study had a live run, so it is unseen and must be proved live.
- G-4 R-7: a total of the roadmap's lines and a header that counts every machine's open changes; `roadmap-loop.mjs status` gives the first number as this machine's open changes and the second as the run's places, and leaves other machines out unless they are listed.
- G-5 R-8: the rounds with their lines and counts (also R-19); `roadmap-loop.mjs status` or a new subcommand should print each round with its lines' ids, their state classes and their `after:`; `roadmap-loop.mjs` reads the rounds inside and prints none.
- G-6 R-12: the result of each stage in the state (also the stage count); `change-loop.mjs state` gives the stage id and the script only, so the dots need one `flow-check.mjs` call per change, which reads the stage files one by one.
- G-7 R-14: the age of a change's work, such as "working 5 h"; `change-loop.mjs state` should carry the time the change entered its state or stage; the run file holds times in `occupied`, `queued`, `placed` and `startedSessions`, but the state JSON carries none, no time is kept outside a run, and the pane should not read the run file around the state command.
- G-8 R-16: who acts, you or the agent (also R-20); `change-loop.mjs state` should say it for each state, since the rule for `blocked` and for a wait on GitHub is not written anywhere; today the pane would have to decide it.
- G-9 R-18: the app session of a change; the run file's `startedSessions` holds only a time, so no command names the session and the pane finds it by its title (ADR 0014, ADR 0017), which fails for a session the owner renamed or closed.
- G-10 R-21: the share of a change's budget spent; `change-loop.mjs state` should carry the tokens counted and the cap; the count of `change-budget` is made inside `next` before a hand-off, from the session transcript, and `change-budget` left a panel out of its scope.
- G-11 R-2: the board as structured data; `roadmap-loop.mjs status` prints text grouped by state, in the person's language, and has no JSON form, so the pane would parse prose in two languages; its `--json` form is the probe's object, which lists a clone's unfinished changes and no roadmap.
- G-12 R-2: a read that fits the refresh; the commands of a whole run took 36 s to 75 s on this print (see the refresh rule), against an old time limit of 60 s; the board and the state command should answer from what is local, or the pane's limit must be raised.

## Beside the approved mock

The board stands for the first screen of the `orchestrator-replan` mock, the roadmap coordinator's (`Manager.dc.html`), approved by the owner on 2026-11-19; its labels are rendered here in English. That screen shows, top to bottom: a title bar with a refresh button; "this conversation looks after the roadmap", the repository and a line "11 of 17 changes archived, 6 left" with "up to 2 changes at a time"; a "Now" box saying who acts ("you act") and which change waits for the owner's approval since what time, with the line "Answer in the conversation. The panel only shows."; the groups "In progress" (each change with a state glyph, "6 of 13 steps" and a line such as "implementation, phase 2 of 3, Claude acts"), "Ready to start" (the next in the queue), "Waiting for another change" (named after which one) and "Stuck" (empty, "None. A stuck change appears here with the reason."); a folded "Archived" and a folded "How to use"; and a footer, "Updated 6 s ago, next in 54 s".

How the two differ, field by field:

- Grouping: the mock groups by state (in progress, ready, waiting, stuck, archived), as the printed board does; the recommended board puts counts and a strip of rounds above one card per change and has no groups. The round is a new axis the mock does not have.
- Counts: the mock has one sentence of archived out of total and the run's places; the board has five counts (R-2 to R-6) and the wagons' counts (R-8). The places of the run have no field in the board; they are not one of the reference's fields.
- The "Now" box: the mock has it, with the time the wait began ("since" a time of day); the board replaces it with each card's "acts" (R-16) and the foot line (R-20), and the age is G-7. The mock's sentence "The panel only shows" is kept as the pane's rule (D-3 of the grill input).
- Progress: the mock says "6 of 13 steps"; the card has a row of stage dots (R-12, G-6). The mock's "Claude acts" is R-16 (G-8).
- Stuck: the mock has a group for it; the board has no group and no count for a blocked change (an open point), only the card's state in words with its reason (R-13, R-15).
- Archived: the mock folds the archived changes into one line; the board counts them (R-6) and does not say whether a delivered change has a card (an open point).
- The machine, the Open link and the budget share: not in the mock. The machine and the Open link (R-17, R-18) are new on the board; the budget share is dropped (R-21).
- Timing: the mock's footer ("updated 6 s ago, next in 54 s") is a 60 s refresh; the board's rule is 5 minutes (see the refresh rule), so the footer's numbers change.

What of the other four screens stays for `coordination-panels` to weigh. The change coordinator's screen (`Main.dc.html`, one change with its 13 steps, its subagents and its documents) and the stage detail (`Stage.dc.html`, the phases, who is working, the stage's gate command and the open tasks) are the change coordinator's panel, which this study does not cover; they read the state command and the stage files and would take the stage results of G-6. The help screen (`Help.dc.html`, the commands and the project's settings) does not depend on the board; the mock's roadmap screen links to it with a folded "How to use". The band above the prompt box (`Band.dc.html`, one line with the change or the roadmap, its progress and an "open panel" button) overlaps `run-status-bar` (round 23c) and is only noted here.

## Grill input for coordination-panels

- D-1 The pane draws one board for a roadmap run, answer A of "Views": counts on top (waiting for you, working, in line, asleep, delivered), a strip of rounds with their counts, one card per change, and the foot line "who owes: you (n) / agents (n)"; the reference's two views stay as option B with its cost, for the owner's one-word answer.
- D-2 The new pane replaces `devkit-panel`, as `coordination-cleanup` already decides: `hooks.json` is reused; `fixtures/`, `i18n.ts`, `pane.tsx`, `panel.test.tsx`, `project.ts`, `register.tsx` and `sessions.ts` are reused with changes; `commands.ts`, `conducted.ts`, `detail.ts`, `grammar.ts`, `report.test.tsx`, `report.ts` and `steps.ts` are dropped; the removal of the old files is `coordination-cleanup`'s.
- D-3 The pane is read-only (D-6): no button starts, sends, fills the prompt or changes anything; a press only opens a session, a detail or a document; a refresh, a timer tick or a render opens nothing.
- D-4 The fields the board takes are R-2 to R-6, R-8, R-10 to R-18 and R-20; the ones it drops are R-1, R-7, R-9, R-19 and R-21 (the budget share goes to `run-status-bar`); R-12, the stage dots, is the one field not read from the state command, and is read from `flow-check.mjs --json` per change until O-6 is answered.
- D-5 Each change's state, reason and current stage are read from `change-loop.mjs state` (ADR 0017 decision 1: the panels read that command), with the single exception of D-4's R-12 until O-6 is answered; the rounds and the queue from `openspec/roadmap.md` and `roadmap-loop.mjs status`; the machine of each change from the board's machine column (ADR 0020); the run file is read only through the state command.
- D-6 (provisional until O-12 is answered) The refresh rule: the pane reads when it opens, on Refresh, at the end of a turn of its session and every 5 minutes while open, one read at a time, with a 15 minute pause on a `gh` rate limit; it writes nothing, starts nothing and schedules nothing beyond its own refresh while it is open.
- D-7 The language is the person's (D-9 of the coordination design): the pane's own `language` setting (pt-BR or en) names the labels and is passed as `--lang` to every command it runs.
- D-8 The Open link on a card calls the app's `mcp__ccd_window__open_session_in` only on a press, as `sessions.ts` does today, and finds the session by its title ending with the change id.
- D-9 (provisional until O-18 is answered) A change on another machine shows that machine from the board's machine column, and its stage and state only when the machine is listed and answers; a machine that does not answer reads "no answer".
- O-1 G-1 R-1: what does the reference's count of "demands" stand for; the board drops it until the owner says, and no command counts it today.
- O-2 G-2 R-4: the probe's object (`roadmap-loop.mjs status --json`) should carry each change's `state` and `reason`, so the counts of working and waiting for you, the cards' words and the "who owes" line cover the changes open on another machine; on the print 13 of the 20 "Under way" rows have none.
- O-3 G-3 R-5: the asleep state (a `held-*` reason of `change-loop.mjs state`) was not seen on any real board because no live run was going; prove it on the next live roadmap run, and say whether a queued line that no session holds is asleep or only in line.
- O-4 G-4 R-7: the board's header should count every machine's open changes whatever the `machines` setting says, and the total of the roadmap's lines should be printed, if the pane shows an "n of m" anywhere.
- O-5 G-5 R-8: a command should print the rounds with their lines (id, state class, `after:`) and counts, or the pane parses `openspec/roadmap.md` itself; the grill picks one.
- O-6 G-6 R-12: `change-loop.mjs state` should carry the list of stages with each stage's result, so the dots need no `flow-check.mjs` call per change.
- O-7 G-7 R-14: `change-loop.mjs state` should carry the time the change entered its current state or stage; the run file's times (`occupied`, `queued`, `placed`, `startedSessions`) are kept only inside a run; the card shows no age until it does.
- O-8 G-8 R-16: `change-loop.mjs state` should say who acts for each state; the grill decides who acts for `blocked` and for a wait on GitHub, which the board's "who owes" count depends on.
- O-9 G-9 R-18: a command should name the app session of a change, since the run file holds only the time it started; until then the Open link is found by title and may fail for a renamed or closed session.
- O-10 G-10 R-21: `change-loop.mjs state` should carry the tokens counted and the cap of a change's budget, for `run-status-bar` and for a card later; today the count is made only inside `next`.
- O-11 G-11 R-2: the board should have a JSON form (the rounds, the groups, the header counts), or the pane parses prose in two languages.
- O-12 G-12 R-2: the whole-run commands took 36 s to 75 s on a loaded machine, against an old 60 s limit for one checker; the grill decides whether the commands get a fast local read or the pane's limit and its 5 minute timer stand.
- O-13 The owner's one-word answer on the views, A or B, is not given yet; the board is built as A until it is.
- O-14 The board printed on 2026-11-23 shows `stage-models` and `delivery-train` on "another machine", with no name: the code gives that for a claim that names no machine (an unread claim, or none written); which of the two it is was not found.
- O-15 `change-loop.mjs state`, run without `--change`, listed `roadmap-coordinator-followups`, a change archived on 2026-11-22 with no row on the board, while the clone's run file of 2026-11-21 still names it; the grill decides whether the pane takes the board as the list of changes and the state command only for their detail.
- O-16 Where does a blocked change count in the header's counts: the five counts of the board (waiting for you, working, in line, asleep, delivered) have none for it, while the printed board has a "Blocked" block and the mock a "Stuck" group.
- O-17 Does a delivered change have a card, or only the count, as the mock folds its archived changes into one line; 35 cards would be a long column.
- O-18 Where does the pane get the `machines` and `load_limit` settings: they are devkit-openspec's per-person options, and devkit-panel is another pack with a `language` setting only; without them the board still names the machines from the claims but never probes them.
- O-19 Does the reference's "ready" (R-3) leave out the changes that wait for a dependency; the board's "in line" counts both.
- O-20 R-10: the card's number is the change id; does the owner want an order number (the line's place in its round) besides it.
- O-21 How does the change coordinator's own panel find its change now that `conducted.ts` is dropped (the newest `/devkit change <id>` of the transcript was one of its two signals), and does it share this pane's module.
- O-22 Does a press on a card open the change's session (R-18), or a detail like the mock's third screen, or both; the band above the prompt box is left to `run-status-bar`, which overlaps it.
