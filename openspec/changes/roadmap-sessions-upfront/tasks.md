<!-- devkit-stage tasks result=passed attempt=8 commit=9e78755559dc81c6ca2f110b9c29398b8796b46b -->
# Tasks

Change: `roadmap-sessions-upfront` · Date: 2026-11-22 · Owner: Kaue (chacal88) · Base: `c561553`;
phase 5 added on 2026-11-23 over the merge `b216a46` (change-state, ADR 0017, commit-attribution);
phase 6 revised on 2026-11-23 over the merge `a9ecdc1` (change-budget, delivery-models with ADR 0018);
phase 7 added on 2026-11-23 after review round 1 at `123a7ba` (design D-16); phase 8 added on
2026-11-23 after the merge `62cf500` (change-version-pin): flow version 2 (design D-17)

Work only in this change's worktree, on its branch. Every rule, name, text and label is in
`design.md`: D-1 the entry, D-2 the opening, D-3 the gates, D-4 the triage, D-5 the push, D-6 the
change session's loop, D-7 places, D-8 the plan after dependencies, D-9 the periodic check and the
cleanup, D-10 drift, D-11 the held state, the board and messages, D-12 the ADR, D-13 the tests this
plan changes, D-14 documents and release, D-15 proof, D-16 the fixes of review round 1, D-17 flow
version 2. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written; each `&&` part runs on its own, no part holds a
`|`, and every gate exits 0 when its phase is done. Every new test is named `upfront <AC-n> <area>:
...` (the one test of task 6.1, which no criterion of this change names, `upfront budget <area>: ...`;
the documents test of task 7.1, `upfront ADR 0021: ...`)
and lives in `plugins/openspec/hooks/roadmap-loop.test.mjs`, except where a task names
`change-loop.test.mjs`, `conduct-check.test.mjs`, `guard.test.mjs` or (task 8.1) `version-pin.test.mjs`; all run through
`plugins/openspec/hooks/guard.test.mjs`, which imports them. Every env a new test builds blanks
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH` through the file's shared constant (`SET` in `roadmap-loop.test.mjs`). Every gate
runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests need
the `openspec` CLI 2.x on `PATH`. No test starts, lists, renames or archives an app session or
creates a cron: the host calls are proved by the exact `input` the decisions give and by the skill
text, and live in the next real run (D-15). One test per condition and per label of every new guard
and decision, negatives included.

Test first in phases 1 to 5, in task 6.1 and in phases 7 and 8: the phase's test task comes before its code tasks (task
6.1 writes its test before its code), its new tests fail on the base (`c561553` for phases 1 to 4,
`b216a46` for phase 5, `a9ecdc1` for task 6.1, the commit that holds the plan revised after review
round 1 and its approval for phase 7, the commit that holds the plan revised for flow version 2 and
its approval for phase 8; each red run saved under
`openspec/changes/roadmap-sessions-upfront/proof/`), and an existing test is changed only where D-13
names it (T-1 to T-22), the task saying its invariant, layer and suite. Leave no backup or scratch file in the tree; end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `session-opens-running` | 1.1, 1.3, 1.4, 1.5, 2.1, 2.3, 7.1, 7.7 |
| AC-2 | `other-starts-refused` | 1.1, 1.3, 1.4, 7.1, 7.3, 7.7 |
| AC-3 | `every-pending-change-opens` | 3.1, 3.2, 3.4, 5.1, 5.3 |
| AC-4 | `grills-in-roadmap-session` | 3.1, 3.2, 3.6, 8.1, 8.3 |
| AC-5 | `triage-first` | 4.1, 4.2, 4.3, 4.4, 7.9, 8.1, 8.2, 8.3, 8.4, 8.5 |
| AC-6 | `triage-never-approves` | 4.1, 4.2, 4.3 |
| AC-7 | `approval-in-roadmap-session` | 2.1, 2.3, 3.1, 3.2, 3.6 |
| AC-8 | `plan-after-dependencies` | 2.1, 2.3, 2.5, 7.1, 7.8 |
| AC-9 | `places-load-only` | 2.1, 2.3, 2.4, 3.5, 5.1, 5.2, 7.1, 7.5 |
| AC-10 | `waiting-icon` | 2.1, 2.2, 2.3, 5.1, 5.2, 5.3 |
| AC-11 | `drift-without-owner` | 4.1, 4.5, 7.9 |
| AC-12 | `branch-pushed-with-grill` | 3.1, 3.3, 7.1, 7.2 |
| AC-13 | `run-check-scheduled` | 3.1, 3.5, 3.6 |
| AC-14 | `check-acts-not-approves` | 3.1, 3.5, 3.6, 7.1, 7.4, 7.6, 8.1, 8.3, 8.4 |
| AC-15 | `run-end-cleans-up` | 3.1, 3.5, 3.6, 7.1, 7.4 |
| AC-16 | `lone-change-schedules-nothing` | 3.1, 3.6 |

## 1. The entry of a started change session (AC-1, AC-2)

- [x] 1.1 Write this phase's tests (design D-1; spec `coordination-locks` "A change session started by
  a roadmap run runs only on the run's ticket", "A lock never traps", "Lock decisions can be recorded",
  the scenario "A started task with a start line"; spec `roadmap-coordination` "Calling the command
  again resumes from the files"). In `roadmap-loop.test.mjs`, one test per label of `entryDecision`,
  each over a synthetic transcript and run file:
  - `upfront AC-1 entry: the run's own start of the change is claimed by the first session` (label `claimed`; the run file then records `claimedBy`);
  - `upfront AC-1 entry: the session that claimed the ticket is let through again` (`same-session`);
  - `upfront AC-2 entry: another skill is let through` (`not-entry`, also with the skill name in a field other than `skill`);
  - `upfront AC-2 entry: a session whose first message is typed is refused` (`not-started`; also a started form whose task is not `/devkit change`);
  - `upfront AC-2 entry: a started session with no start line for its change is refused` (`no-ticket`; also a start line naming another id);
  - `upfront AC-2 entry: a ticket the run does not record is refused` (`ticket-unknown`; no entry, and another ticket);
  - `upfront AC-2 entry: a ticket another session claimed is refused` (`ticket-claimed`);
  - `upfront AC-2 entry: an unreadable transcript or run file is refused` (`unreadable`; each refusal's reason names `/devkit change <id>`);
  - `upfront AC-2 guard: guard.mjs skill exits 2 on a refusal, 0 on a claim, 0 under DEVKIT_BYPASS=1, and logs one line under DEVKIT_HOOK_LOG` (a real `guard.mjs skill` process);
  - `upfront AC-1 ticket: decide gives each session start a fresh ticket recorded before it prints, keeps a claimed one, and withTicket adds the start line` (the CLI output's `input.prompt` has two lines; `decideRoadmap`'s stays one line);
  - `upfront AC-1 run file: readRun reads tickets, occupied, queued, anyway, waits, cron and check, and drops a field of the wrong type`.

  In `change-loop.test.mjs`: `upfront AC-1 guard: a started task followed by a start line still makes a change run`.
  In `guard.test.mjs`: `upfront AC-2 guard: startedTaskOf and firstMessageOf read only the first message's started form`.
  Run them on the unchanged code with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-sessions-upfront/proof/red-1.txt`, listing at its top
  any test that passes on the base (expected: the `change-loop.test.mjs` one). Check: every other new test fails there.
- [x] 1.2 Add the run file's fields (D-1, D-9, D-12 decision 6) in `plugins/openspec/hooks/roadmap-loop.mjs`:
  `emptyRun`, `readRun` (validation of each field), `runCmd` keeping `tickets`, `occupied`, `queued` and
  `waits` for another session and resetting `check`, `--fresh` emptying them, and `decide()` keeping
  `startedSessions` and `tickets` of archived lines (D-9). Change T-9 of D-13 (invariant: a new
  coordinating session keeps only what outlives the session that started it; layer: run command;
  suite: roadmap-loop). Check: the `upfront AC-1 run file` test and T-9 pass.
- [x] 1.3 Add the shared readers and the entry (D-1): `startedTaskOf`, `firstMessageOf`, `START_LINE`
  exported from `plugins/openspec/hooks/guard.mjs`, `typedOf` using `startedTaskOf`; `ENTRY_SKILL`,
  `entryDecision`, `mintTicket`, `withTicket` in `roadmap-loop.mjs`, and `decide()` minting and
  recording tickets. Check: the `upfront AC-1 entry`, `upfront AC-2 entry`, `upfront AC-1 ticket`
  and both reader tests pass; `followups F-4 guard: the task of a session started by another session
  makes a change run` passes unchanged.
- [x] 1.4 Add the `skill` mode (D-1): in `guard.mjs` the dispatch, the header comment line, the shared
  `logDecision` extracted from `lock`, fail closed; in `plugins/openspec/hooks/hooks.json` the
  PreToolUse entry `Skill`. Change T-7 of D-13 (invariant: each hook calls `guard.mjs` with its mode;
  layer: hooks.json; suite: change-loop). Check: `upfront AC-2 guard: guard.mjs skill ...` and T-7
  pass.
- [x] 1.5 Write `plugins/openspec/skills/devkit-session/SKILL.md` with the frontmatter of D-1 and the
  sections of D-6 (`session-next` and `session-wait` named as written there, used from phase 2); in
  `plugins/openspec/skills/devkit/SKILL.md` replace Loop item 1a with D-6's text; rewrite
  `sessionBackground` (D-6). Add `upfront AC-1 skill: devkit-session is model-invocable, names its
  change from the start line, and keeps the title rule and the archive line` in
  `roadmap-loop.test.mjs`. Change T-3 (invariant: the brief names the change, worktree, branch,
  coordinator, language, title rule and archive line, at least 80 characters; layer:
  sessionBackground; suite: roadmap-loop) and T-6 (invariant: a change session renames itself from
  `sessionTitle` with the host tool from the main thread; layer: skill text; suite: roadmap-loop).
  Check: those three pass, `change-loop skill: the frontmatter` passes unchanged (the devkit skill
  keeps `disable-model-invocation: true`), and `python3 scripts/check.py` passes.
- [x] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1 (entry, ticket) and AC-2.

## 2. The change session's loop, places and ⏳ (AC-1, AC-7, AC-8, AC-9, AC-10)

- [x] 2.1 Write this phase's tests (design D-6, D-7, D-8, D-11 icon; specs `roadmap-coordination` "A
  place is held only by a change that loads the machine", "A change's plan waits for its dependencies
  and starts from the code of that day", "A change session shows the stage its change is in";
  `coordination-locks` "The coordinator does not end its turn while a stage is ready"). In
  `roadmap-loop.test.mjs`, one test per branch of `sessionDecide` and of `placeDecision`:
  - `upfront AC-7 session-next: the grill, the plan approval and the retro answers are held for the coordinating session with their stage icon` (branch `owner`, three actions);
  - `upfront AC-7 session-next: the held approval goes on once approval.md is written` (scratch repository);
  - `upfront AC-8 session-next: a plan stage waits for an unarchived dependency with ⏳` (branch `after`);
  - `upfront AC-8 session-next: once the dependency is archived and not merged, the step merges the default branch` (branch `merge-base`; none when `proposal.md` exists or the archive folder is in `HEAD`);
  - `upfront AC-9 place: a free place is claimed` / `upfront AC-9 place: no free place queues the change with why place` / `upfront AC-9 place: a loaded machine queues it with why load` / `upfront AC-9 place: start anyway claims despite the load once` / `upfront AC-9 place: an earlier queued change goes first` (`placeDecision`);
  - `upfront AC-9 session-next: an implementation step claims a place and the delivery releases it`, `upfront AC-9 session-next: a blocked change in its implementation keeps its place`, `upfront AC-9 session-next: the archived end releases the place` (branch `release`);
  - `upfront AC-9 session-next: a change outside a session-mode run gets the change loop's action unchanged` (the plain branch);
  - `upfront AC-10 session-next: a held change is titled ⏳ <id> and a claimed one its stage icon again`;
  - `upfront AC-1 session-next: prints devkit-run first, so runOf reads a change run`;
  - `upfront AC-9 session-wait: exits with the new action when a place frees, records and clears its wait` (injected sleep);
  - `upfront AC-9 lock stop: a claimed change session held for a place may stop` (label `held`) and `upfront AC-9 lock stop: with its place and a stage ready the stop is refused once` (falls to `stopDecision`), and `upfront AC-9 lock stop: a session that did not claim the ticket is judged as any change run`;
  - `upfront AC-8 merge-base: merges origin's default branch, and on a conflict aborts and exits 3 with base-conflict` (scratch repository with an origin).

  In `change-loop.test.mjs`: `upfront AC-9 waitLoop: a given predicate keeps waiting while it holds and failWhy names the end`.
  Run them on the unchanged code with the command of 1.1 and save the output to
  `openspec/changes/roadmap-sessions-upfront/proof/red-2.txt`. Check: every new test fails there.
- [x] 2.2 In `plugins/openspec/hooks/change-loop.mjs`: export `WAIT_ICON`; `waitLoop`'s optional
  `waiting` and `failWhy`; the messages `session-held-owner`, `session-held-place`,
  `session-held-load`, `session-held-after`, `blocked-why.base-conflict` in both languages (D-11).
  Check: the `upfront AC-9 waitLoop` test passes and the existing `waitLoop` tests pass unchanged.
- [x] 2.3 In `roadmap-loop.mjs`: `placeDecision`, `sessionDecide`, `sessionNext`, the subcommands
  `session-next` and `session-wait` (with `--session`, recording `waits`), and the usage line (D-6,
  D-7). Check: the `upfront AC-7 session-next`, `AC-8 session-next`, `AC-9 place`, `AC-9
  session-next`, `AC-10 session-next`, `AC-1 session-next` and `AC-9 session-wait` tests pass.
- [x] 2.4 Route a change session's stop (D-6): `changeSessionStopDecision` in `roadmap-loop.mjs`,
  called by `guard.mjs#lock` for mode `stop` when no roadmap run is found. Check: the three `upfront
  AC-9 lock stop` tests pass and every `change-loop lock stop` test passes unchanged.
- [x] 2.5 Add the `merge-base` subcommand (D-6, D-8). Check: the `upfront AC-8 merge-base` test passes.
- [x] 2.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1 (the loop), AC-7 (the change side), AC-8, AC-9, AC-10.

## 3. The coordinating session and the periodic check (AC-3, AC-4, AC-7, AC-9, AC-12 to AC-16)

- [x] 3.1 Write this phase's tests (design D-2, D-3, D-5, D-9, D-11; specs `roadmap-coordination` "Every
  pending change opens at the start of a run with a session per change", "The owner's gates are asked
  one change at a time", "The grill and the plan are pushed with the change's branch", "A roadmap run
  keeps one periodic check while it lasts", "A firing of the check acts and reports only what
  changed", "The end of a run cleans up after itself", "The board shows what each change session waits
  for"; `change-coordination` "A lone change schedules nothing"; `coordination-locks` the scenario "The
  periodic check's prompt"). In `roadmap-loop.test.mjs`:
  - `upfront AC-3 decide: every pending line opens on a typed turn whatever the number, the load and the dependencies, each with its session` (number 1, load 95, a line `after:` an open one; a ticked, an archived and a previous-script line not opened);
  - `upfront AC-3 decide: on a turn nobody typed a pending line not open waits for the owner's next message with its line`;
  - `upfront AC-3 status: the board lists every opened change, with held-place, held-load and held-after rows`;
  - `upfront AC-4 decide: the grills of change sessions are asked in roadmap order, one change at a time, with their gate line`;
  - `upfront AC-7 decide: a plan approval and the retro answers of a change session are asked here, and a merge left to the owner is not`;
  - `upfront AC-12 next: a passed grill not on origin gives a push, the push commits and pushes requirements.md, and a plan approved gives the push of the plan files` (scratch repository with an origin);
  - `upfront AC-12 next: after --after <id>=push the same decision asks no push, and a failed push exits 3 with its reply`;
  - `upfront AC-13 decide: with cron and no check the decision asks for one, on any turn, and none while stopping or after a refusal`;
  - `upfront AC-13 next: --check-id records the check, --check-refused records the refusal with its line, --check-deleted clears it, also for a job already gone`;
  - `upfront AC-13 next: --check-gone clears a recorded check and the same decision asks for a new one, but not after a refusal` (the 7-day expiry);
  - `upfront AC-13 decide: the check's cron expression avoids minutes 00 and 30, recurring is true and no durable field is passed`;
  - `upfront AC-13 decide: every end and a stop give delete-check when a check is recorded`;
  - `upfront AC-13 guard: the check's prompt reads as no typed command and the roadmap run goes on` (through `roadmapRunOf`);
  - `upfront AC-14 check: a stale wait is killed and the newest of each kind kept` (real child processes; `staleWaits` one test per rule: not open, archived, older duplicate, dead process dropped);
  - `upfront AC-14 check: a freed place goes to the first queued change, and one with no live wait gets its idle line`;
  - `upfront AC-14 check: its actions are only triage, archive-session, push and delete-check, and it starts no session on its event turn`;
  - `upfront AC-14 check: nothing changed prints no line and no end reply`;
  - `upfront AC-14 decide: an archived line with a recorded session kills its recorded waits, then gives archive-session with its reason until session-archived is reported`;
  - `upfront AC-14 next: --after <id>=session-archive-later keeps the entry, asks no second archive in that decision, says the line once, and a later decision asks again`;
  - `upfront AC-15 decide: the end done gives delete-check, archive-session per kept session and stop-own-tasks, and decide kills every recorded wait` (real child processes);
  - `upfront AC-15 decide: a stop kills only stale waits and keeps the sessions of changes that go on`;
  - `upfront AC-15 lock stop: a cleanup action left refuses the end of the turn once`;
  - `upfront AC-9 next: start anyway records the changes queued by the load now, and a change queued later is held again`;

  In `change-loop.test.mjs`: `upfront AC-16 next: no action of a change run asks for a schedule` (every kind of `decide` over the fixtures of the file).
  Run them on the unchanged code with the command of 1.1 and save the output to
  `openspec/changes/roadmap-sessions-upfront/proof/red-3.txt`. Check: every new test fails there, the
  AC-16 one excepted (it pins behaviour the base has; listed at the top of the file).
- [x] 3.2 Session-mode `decideRoadmap` (D-2, D-3) and `collectRoadmap` (`readOwn`, `waitsFor`,
  `queued`, `occupied`), `roadmapStopDecision` passing `readOwn: false`; the message
  `roadmap-session-opened`. Change T-1 (invariant: the coordinating session hands no stage and gives
  each start its exact input; layer: decideRoadmap; suite: roadmap-loop), T-2 (invariant: the mode is
  recorded by `run` and a later run without it goes back; layer: run command; suite: roadmap-loop) and
  T-4 (invariant: a start in session mode happens only on a typed turn and never without a line;
  layer: decideRoadmap; suite: roadmap-loop). Check: the `upfront AC-3 decide`, `AC-4 decide` and
  `AC-7 decide` tests and T-1, T-2, T-4 pass; `followups AC-13 decide: a change archived in its
  session ...` and the AC-15 `next` tests pass unchanged.
- [x] 3.3 The push (D-5): `filesPushed`, `unpushed` in `collectRoadmap`, the `push` action, `push` in
  `SESSION_KEYS`, the `push` subcommand and the message `push-failed`. Check: the two `upfront AC-12`
  tests pass.
- [x] 3.4 The board (D-11): `boardOf` session-mode rows and the `queue.held-*` messages. Check:
  `upfront AC-3 status` passes and `followups AC-15 status: ...` passes unchanged.
- [x] 3.5 The periodic check and the cleanup (D-7 start anyway, D-9): `run --cron`, the `schedule-check`
  action and `checkPrompt`, `next --check-id`, `--check-refused`, `--check-deleted`, `staleWaits`,
  `killWaits`, the `check` subcommand, `roadmap-loop.mjs wait --session` recording `waits`, the
  `archive-session` action with its `reason`, the waits of an archived change killed before it,
`session-archived` and `session-archive-later` in `SESSION_KEYS`, `--check-gone` and the decision's
`check` field, the cleanup actions at an end,
  `anyway` in session mode, the messages `roadmap-check-refused`, `roadmap-check-idle`,
  `roadmap-check-stopped-waits`, `roadmap-check-session-archived`, `roadmap-check-archive-later`. Check: every `upfront AC-13`,
  `AC-14`, `AC-15` test and `upfront AC-9 next: start anyway ...` pass; the `followups AC-7` hold tests
  pass unchanged.
- [x] 3.6 The devkit skill's Roadmap section (D-3, D-9): item 1 loads `select:CronCreate` and adds
  `--cron`; every typed turn and every firing calls `CronList` first and adds `--check-gone` when the
  recorded job is missing; `CronDelete` of a job already gone is no error; `archive_session` with `{
  session_id, reason }`, a refusal or pending approval reported with `--after <id>=session-archive-later`; the session-per-change part asks the grills, plan approvals and retro answers (item 4's
  rules, the change's absolute paths), carries out `push`, `schedule-check`, `delete-check`,
  `archive-session`, `stop-own-tasks` and `triage`; the new subsection `### The periodic check`; the
  Never item of D-9. Change T-5 (invariant: the part names the host tools, the keys and the turn, and
  hands no stage; layer: skill text; suite: roadmap-loop) and T-8 (invariant: the change part names no
  retired machinery and no schedule; layer: skill text; suite: change-loop). Add `upfront AC-13 skill:
  the periodic check names CronCreate, CronList, CronDelete, archive_session and TaskStop, re-creates a missing check, and approves nothing`
  and `upfront AC-16 skill: no section before the Roadmap names a scheduling tool`. Check: those four
  pass, `followups AC-15 skill: ...` passes unchanged, and `python3 scripts/check.py` passes.
- [x] 3.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-3, AC-4, AC-7, AC-9 (start anyway), AC-12, AC-13, AC-14, AC-15, AC-16.

## 4. The triage and the drift (AC-4, AC-5, AC-6, AC-11)

- [x] 4.1 Write this phase's tests (design D-4, D-10; specs `change-coordination` "Every grill asks the
  triage agent first", "A triage answer always names its source", "A requirement a merged change
  contradicts reopens the grill"; `change-delivery` "An ADR number taken on the default branch is
  renumbered without the owner"; `coordination-locks` the scenarios on the grill's triage). In
  `change-loop.test.mjs`:
  - `upfront AC-6 triage: an answer under the triage heading with no source sends the change back to its grill naming it`;
  - `upfront AC-6 triage: the heading's end, an unclosed fence, an item over indented lines, no heading and an empty section` (one assertion per parse rule of D-4);
  - `upfront AC-5 triage: the agent file has the name, a description that says when, the tools Read, Glob and Grep only, and the Never rules`;
  - `upfront AC-5 triage: requirements-triage is a helper of the requirements stage of both scripts, in both schema copies, and PACKS ships it in devkit-core`;
  - `upfront AC-5 triage: a change run may hand devkit-core:requirements-triage`;
  - `upfront AC-11 next: a requirements file set back to pending after the proposal gives the grill`.

  In `roadmap-loop.test.mjs`: `upfront AC-4 lock agent: the coordinating session may hand requirements-triage with a brief naming an open change, and marks nothing under way` (label `grill-helper`), `upfront AC-4 lock agent: the triage with no brief is refused own-sessions`, `upfront AC-4 lock agent: the triage for a change not open is refused not-open`.
  In `guard.test.mjs`: `upfront AC-6 guard: approval.md refuses a write by devkit-core:requirements-triage`; `upfront AC-5 skill: the grill rule of config.yaml and of the four schema files names the triage and forbids answering yourself`.
  In `conduct-check.test.mjs`: `upfront AC-11 adr: a number the base gave another file is renumbered to the next free one` / `upfront AC-11 adr: no clash gives no step` / `upfront AC-11 adr: the same file on both gives no step` / `upfront AC-11 adr: two clashes take the next two numbers in order` / `upfront AC-11 adr: an unresolvable base gives no step` (scratch repositories; the step's actor is the implementer).
  Run them on the unchanged code with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-sessions-upfront/proof/red-4.txt`, listing at its
  top the tests that pass on the base (expected: the `approval.md` one, which pins today's rule for a
  new agent type). Check: every other new test fails there.
- [x] 4.2 Write `plugins/core/agents/requirements-triage.md` (D-4); add it to the `requirements` helpers
  of `plugins/openspec/schemas/devkit/flow.json`, `plugins/openspec/schemas/devkit-lite/flow.json`,
  `openspec/schemas/devkit/flow.json` and `openspec/schemas/devkit-lite/flow.json` (written at
  version 1, before change-version-pin merged; task 8.2 releases it as version 2, D-17); `PACKS` in
  `change-loop.mjs`; the `requirements-triage` section of `docs/roles.md`. Check: the `upfront AC-5
  triage` tests and `change-loop lock agent: the accepted packs are the ones docs/roles.md names` pass.
- [x] 4.3 `triageUnsourced` and its use in `nextAction` and `decide`'s `planPart` (D-4); RH6's
  `grill-helper` in `roadmapAgentDecision`. Check: the `upfront AC-6 triage`, `upfront AC-11 next`
  and three `upfront AC-4 lock agent` tests pass; `followups AC-13 lock agent: ...` passes unchanged.
- [x] 4.4 The grill skill's step 2b and Output (`plugins/core/skills/requirements-grill/SKILL.md`); the
  rule's words in `openspec/config.yaml` and the requirements instruction of the four schema files,
  its first line naming the new helper (D-4). Check: `upfront AC-5 skill: ...` passes and
  `flow-check` tests reading the schemas pass unchanged.
- [x] 4.5 `adrClash`, `ADR_DIRS`, the `renumber-adr` override and `SUBAGENT` entry in
  `plugins/openspec/hooks/conduct-check.mjs`; the `renumber-adr` row in `change-loop.mjs`; the planner
  rule in `plugins/core/agents/change-planner.md` and the proposal instruction of both `devkit` schema
  copies (D-10). Check: the five `upfront AC-11 adr` tests pass and every `conduct` test passes
  unchanged.
- [x] 4.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^conduct" --test-name-pattern="^flow-check" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-4 (triage hand-off), AC-5, AC-6, AC-11.

## 5. The held state through changeState (AC-3, AC-9, AC-10)

- [x] 5.1 Write this phase's tests (design D-6 the `held` action, D-11 the held state; specs
  `roadmap-coordination` "A change session shows the stage its change is in" and "The board shows what
  each change session waits for"). In `change-loop.test.mjs`:
  - `upfront AC-10 facts: runFactsOf reads the change's queue entry, its place and its waitsFor, and no other change's`;
  - `upfront AC-10 state: a running change queued for a place reads held-place with its board words and the title ⏳ <id>` (en and pt-BR; `stateIcon` ⏳, `stageIcon` the stage's);
  - `upfront AC-10 state: a running change queued by the load reads held-load`;
  - `upfront AC-10 state: a plan stage whose dependency is not archived reads held-after naming it`;
  - `upfront AC-10 state: a change that holds a place, or has no queue entry and no waitsFor, gets no held reason` (negative);
  - `upfront AC-10 state: a change waiting for the owner, blocked or waiting on GitHub keeps its state and title over a queue entry or a waitsFor` (negative; the GitHub wait stays `⏳ 🚀 <id>`);
  - `upfront AC-10 state: outside a run with a session per change a queue entry or a waitsFor gives no held reason` (negative);
  - `upfront AC-10 state: a held title of a 70-character id is cut to 59 code points`.

  In `roadmap-loop.test.mjs`:
  - `upfront AC-10 session-next: every held action carries the state changeState derives, and its title and icon come from it` (place, load, after and owner, each `action.state` equal to `changeState` over `runFactsOf` of the records after the decision; the owner one titled `🙋 <stage icon> a`);
  - `upfront AC-10 status: a held row is placed by the state's reason, in the queue with its words` (place, load, after, in en and pt-BR, each row equal to the state's `reason.text`);
  - `upfront AC-10 command: the state command, session-next and the board agree on a change held for a place and one held for a dependency` (scratch repository, a run with a session per change and claimed tickets; `change-loop.mjs state`, `roadmap-loop.mjs session-next` and `status`).

  Run them on `b216a46` with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront AC-10" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-sessions-upfront/proof/red-5.txt`, listing at its
  top the tests that pass there (expected: the three negatives, which pin what the base already
  does, and phase 2's `upfront AC-10 session-next: a held change is titled ...`, not new). Check:
  every other new test fails there.
- [x] 5.2 In `plugins/openspec/hooks/change-loop.mjs` (D-11): `runFactsOf` gains `queued`, `occupied` and
  `waitsFor`; `HELD_TEXT` exported beside `STATE_ICON`; `changeState`'s rule S9 and its held title and
  `stateIcon` (`WAIT_ICON`, its only reader); `PLAN_NOT_HELD`, `partOfStage` and `isPlanStage` moved
  here unchanged and exported (the copies in `roadmap-loop.mjs` go in 5.3); `stateEntries` passing a
  `waitsFor` for a roadmap line of a run with a session per change. Check: the eight `change-loop.test.mjs`
  tests of 5.1 pass, and every `change-state` test passes unchanged.
- [x] 5.3 In `plugins/openspec/hooks/roadmap-loop.mjs` (D-6, D-11): `sessionDecide`'s `held` action
  takes `state`, `sessionTitle` and `icon` from `changeState` over `runFactsOf` of the records after
  the decision, with no `sessionTitle` call and no `WAIT_ICON` of its own; `stateRow` places a held
  reason in the queue with `s.reason.text`, its reads of `f.queued` and `f.waitsFor` removed;
  `collectRoadmap` and `sessionFacts` use the imported `isPlanStage` and `partOfStage`, their local
  copies and `PLAN_NOT_HELD` removed. Change T-15 (invariant: the change session holds each roadmap
  gate for the coordinating session, under its stage's icon, taking no place; layer: sessionDecide;
  suite: roadmap-loop) and T-16 (invariant: a change held for a place, the load or a dependency is
  titled ⏳ and its id, and a claimed one gets its own action back; layer: sessionDecide; suite:
  roadmap-loop). Check: the three `roadmap-loop.test.mjs` tests of 5.1, T-15 and T-16 pass; `upfront
  AC-3 status: ...`, every `change-state AC-6` and `change-state AC-7` test and the `upfront AC-8
  session-next` and `upfront AC-9` tests pass unchanged.
- [x] 5.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^conduct" --test-name-pattern="^flow-check" --test-name-pattern="^change-state" --test-name-pattern="^commit-attribution" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-3 (the board's held rows), AC-9 (the queue's reasons) and AC-10.

## 6. The token budget in a change session, the ADR, the documents, the release and the whole suite (every AC)

- [x] 6.1 The token budget in a change session, test first (design D-6 step 1; change-budget's
  scenario "The roadmap coordinator's own reading" kept: the coordinating session's reads count no
  budget). In `plugins/openspec/hooks/roadmap-loop.test.mjs` write
  `upfront budget session-next: at the cap a change session's session-next prints the budget end and keeps its place`
  (scratch repository; a run with a session per change, `a`'s ticket claimed, `occupied.a` recorded, `a`
  at an implementation hand-off; `budget: 1000` in the `devkit:` block of `a`'s `.openspec.yaml`; a
  session transcript under `CLAUDE_CONFIG_DIR` for `CLAUDE_CODE_SESSION_ID` whose spend after `a`'s run
  line is above the cap, built as `budgetEnv` of `change-loop.test.mjs` builds it). It asserts:
  `roadmap-loop.mjs session-next --change a` prints `devkit-run: a`, then `devkit-end: a
  waiting-for-owner`, then the end with the why `waiting-budget`, and exits 1 as `next` does at the cap;
  the run file still records `occupied.a` and no `queued.a`; negatives: the same facts through
  `sessionNext` without `budget` (the poll of `session-wait` and the stop lock's read) give the
  implementer hand-off, and `session-next` with the spend below the cap gives the hand-off. Run it on
  the unchanged code with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront budget" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-sessions-upfront/proof/red-6.txt`. Check: the test
  fails there. Then in `plugins/openspec/hooks/roadmap-loop.mjs`: `sessionNext` gains the option
  `budget` (default false), passed to `nextAction`; `sessionNextCmd` passes `budget: true`;
  `session-wait`'s poll and `changeSessionStopDecision` pass none; in
  `plugins/openspec/hooks/change-loop.mjs` the comment above `nextAction`'s budget read names
  `session-next` beside `next` (no behaviour changes). Check: the same command passes, and every
  `change-budget` test and the `upfront AC-9 session-next` and `upfront AC-9 session-wait` tests pass
  unchanged.
- [x] 6.2 Write the ADR of D-12 at `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`
  (0018 is delivery-models'; take the next free number on `origin/main` if a sibling took 0019, and
  rename the file and every reference), the header lines and Notes of D-12 in ADRs 0006, 0010 (its
  header line after the `- Amended by ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md)`
  line, its Note beside the delivery-models one), 0011, 0013, 0014 and 0017 (ADR 0012 gets nothing:
  this change does not amend it), the ADRs line of `openspec/config.yaml` (the 0021 entry after the
  0018 one, its amends list `0006, 0010, 0011, 0013, 0014 and 0017`), and the renaming to "ADR 0021"
  of the references D-12 lists that phases 1 to 5 wrote as "ADR 0017" meaning this change (no
  behaviour changes): `plugins/openspec/hooks/change-loop.mjs:688`,
  `plugins/openspec/hooks/roadmap-loop.mjs:25`, `:183` ("(ADR 0014, ADR 0017)"), `:487`,
  `plugins/openspec/hooks/change-loop.test.mjs:2446` (the comment),
  `plugins/openspec/hooks/roadmap-loop.test.mjs:2213` (the assertion message "the empty fields of ADR
  0017", which names this change's run-file fields) and
  `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md:74` (lines as of `a9ecdc1`; read each
  line before renaming it, and leave every reference meaning change-state's ADR 0017 or
  delivery-models' ADR 0018). Check: `python3 scripts/check.py` passes (links and language);
  `grep -n "ADR 0017" plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/roadmap-loop.test.mjs docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`
  prints nothing (the comment in `change-loop.test.mjs` renamed too; that file's change-state test
  keeps its own ADR 0017); `grep -n "ADR 0021" plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/change-loop.test.mjs`
  prints the six renamed lines (three in `roadmap-loop.mjs`, one in each other file);
  `grep -n "ADR 0018" plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/roadmap-loop.test.mjs docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`
  prints nothing; and `change-state ADR 0017: the documents follow`, `followups ADR 0014: the
  documents follow` and `delivery-models docs: the documents follow` pass unchanged.
- [x] 6.3 Update the documents of D-14: `docs/openspec-flow.md` (with the budget paragraph's
  `session-next`), `docs/coordination-design.md`, `docs/roles.md` (the "Played today by" lines),
  `docs/getting-started.md`, `README.md`, `plugins/core/README.md`, `plugins/openspec/README.md`.
  Check: `README and the pack README describe how one change runs, with no cron` and `change-budget
  AC-10 docs/openspec-flow.md describes the budget` pass unchanged and `python3 scripts/check.py`
  passes.
- [x] 6.4 Release (D-14): devkit-openspec 0.29.0 → 0.30.0 and devkit-core 0.13.1 → 0.14.0 in both
  `plugin.json` and `.claude-plugin/marketplace.json`, marketplace 0.33.0 → 0.34.0, the `CHANGELOG.md`
  entry `## 0.34.0`, the CI pin `v0.30.0` in `docs/openspec-flow.md` (lines 643, 644 and 655) and its
  assertion in `plugins/openspec/hooks/change-loop.test.mjs` (`change-loop docs: the design records the
  answers`, near line 2567: `v0.30.0` matched, `v0.29.0` joining the pins that must be gone; invariant:
  the CI snippet pins the current release; layer: docs; suite: change-loop); regenerate
  `docs/catalog.md` with `python3 scripts/gen-catalog.py`. Check: `python3 scripts/gen-catalog.py
  --check` passes, `change-loop docs: the design records the answers` passes, and `claude plugin
  validate .` reports no error.
- [x] 6.5 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate roadmap-sessions-upfront --strict` green, the suite run as a background command of the tool (13 to 21 minutes); covers AC-1 to AC-16 as D-15 maps them, and the budget row of D-15.

## 7. The fixes of review round 1 (AC-1, AC-2, AC-8, AC-9, AC-12, AC-14, AC-15; design D-16)

Every new test here is written before the code it proves. The real message of task 7.1 is copied
from the first `user` line of the transcript of the session the roadmap run started on 2026-11-22
for this change (`34a54b1d-b62f-4fae-8caa-03f47e1a3cb8.jsonl` in the Claude Code project folder of this
worktree under `~/.claude/projects/`, on the owner's machine; the transcript stays outside the
repository): its text kept line for line, with every
absolute path of that machine replaced by `<home>/...`, every app session id by `local_<n>`, and the
names of the owner's two machines by `<machine-1>` and `<machine-2>` (the repository is public); the
record's other keys (`type`, `isSidechain`, `promptSource`, `turnOrigin`, `entrypoint`, `version`,
`userType`) kept with their values.

- [x] 7.1 Write this phase's tests (design D-1, D-4, D-5, D-6, D-7, D-9, D-12, D-16; specs
  `roadmap-coordination` "A place is held only by a change that loads the machine" (scenario "A
  change that leaves the roadmap"), "The grill and the plan are pushed with the change's branch"
  ("Tasks ticked after the plan was pushed", "A plan approved again"), "A firing of the check acts
  and reports only what changed" ("Wait loops stopped", "A recorded wait loop that is no longer
  one", "A place given to a session that is not watching", "An archive not done yet", "A triage
  heading that is no section"), "The end of a run cleans up after itself" ("A process that took a
  wait loop's number"); `coordination-locks` "A change session started by a roadmap run runs only on
  the run's ticket" ("The run's own start after a note of the host", "Another skill"), "A run is
  known from the session's own record" ("A started task after a note of the host", "Words before
  the started form"), "The coordinator does not end its turn while a stage is ready" ("A change
  session waiting for a place", "A change session with its place")). In `roadmap-loop.test.mjs`:
  - `upfront AC-12 next: ticks of tasks.md after the plan was pushed ask no second plan push, and an approval written again does` (`upPushed`; the grill and the plan pushed with the `push` subcommand; a box of `tasks.md` ticked and left uncommitted, then committed and not pushed: no `push` action in either; then `approval.md` written again with attempt 2: one `push` action with `what` `plan`) (finding 1);
  - `upfront AC-2 guard: guard.mjs skill lets another skill through without loading roadmap-loop.mjs, and refuses devkit-session when it cannot load` (a temporary folder holding a copy of `plugins/openspec/hooks/guard.mjs` and a `roadmap-loop.mjs` whose first line throws; a real `node <folder>/guard.mjs skill` process: `review-change` exits 0 and logs `not-entry`, `devkit-openspec:devkit-session` exits 2 with the reason naming `/devkit change <id>` and logs `unreadable`, under `DEVKIT_HOOK_LOG`) (finding 2);
  - `upfront AC-14 isWaitProcess: only a process started as roadmap-loop.mjs wait or session-wait is a wait loop` (one assertion each: a `session-wait` child and a `wait` child are; a plain child, a child started as `roadmap-loop.mjs check`, a child started as `other.mjs wait`, a dead pid and a pid that is not a positive whole number are not) (finding 3);
  - `upfront AC-14 check: a live process that is not a wait loop, recorded as a stale wait, is spared and forgotten` (a `stranger()` child recorded as the older of two waits of one kind of an open change: alive after `check`, gone from `waits`, and no `roadmap-check-stopped-waits` line) (finding 3);
  - `upfront AC-15 decide: the end done spares a recorded pid that is not a wait loop and forgets it` (a `stranger()` child recorded as a wait of an archived line at the end `done`: alive after the decision, `waits` empty) (finding 3);
  - `upfront AC-9 check: a change that left the roadmap or was archived frees its place and its queue entry, and the change queued behind it takes the place` (number 1; `occupied.gone` with no line for `gone`, `queued.b` with why `place`: after `check`, `occupied` is `{ b }`; the same with `gone` archived) (finding 4);
  - `upfront AC-9 next: a coordinating decision prunes the places and queue entries of lines no longer open, and a run without a session per change keeps them` (finding 4);
  - `upfront AC-14 check: a triage heading inside a fence or with words after it gives the triage action, and a plain heading does not` (finding 5);
  - `upfront AC-9 lock stop: guard.mjs stop lets a claimed change session held for a place stop with a held log line, and refuses a session that did not claim the ticket` (a real `guard.mjs stop` process through `lkHook('stop', ...)` with `upStopInput`'s transcript, next to the `lkHook('stop')` tests near line 1771; a run file with `a`'s ticket claimed by the session and `occupied.b` at number 1, `a` at its implementation: exit 0 and a `held` line under `DEVKIT_HOOK_LOG`; `a`'s ticket claimed by another session: exit 2 naming the implementation) (finding 6; pins the phase 2 behaviour, so it passes on the base);
  - `upfront AC-9 session-next: the place is decided again on the run file as read under its lock, so of two sessions only one takes the last place` (number 1, `a` at its implementation, the run file's lock file created by the test before `sessionNext(..., { write: true, lockSleep })`; the injected `lockSleep`, on its first call, writes `occupied.b` into the run file and deletes the lock file: `a`'s action is `held` with why `place`, `queued.a` is recorded and `occupied` is `{ b }`) (finding 7; passes on the base);
  - `upfront AC-1 entry: the real first message of a started session is read through its host note, background, Task line and task, refused for its hand-written task, and with the run's task put in refused for want of a start line and claimed with one` (the constant `REAL_STARTED_2026_11_22` of the paragraph above; `startedTaskOf` gives the task lines from `You hold the already-open devkit change` to the closing notes paragraph; `entryDecision` over a transcript whose first line is that record: `not-started`; the same envelope with the task replaced by `/devkit-openspec:devkit change a`: `no-ticket`; with the line `devkit-start: a <ticket>` added below it and the ticket recorded: `claimed`) (finding 8);
  - `upfront AC-8 skill: after a merge-base exit 3 the change session declares the end blocked with base-conflict and ends the run` (the Loop item 3 of `devkit-session/SKILL.md` names `change-loop.mjs reply blocked --param id=<id> --param why=base-conflict --param error=`; and in a scratch project with change `a`, `change-loop.mjs reply blocked --param id=a --param why=base-conflict --param error=x --lang en` prints `devkit-end: a blocked` and the text of `blocked-why.base-conflict`) (finding 9);
  - `upfront ADR 0021: the documents follow` (ADR 0021 holds `- Status: accepted`, an `- Accepted by: the owner, on ` line naming `openspec/changes/roadmap-sessions-upfront/approval.md`, an Amends line naming ADR 0004 and ADR 0010's decision 8, the words `renumber` and `follow-up` in its Decision; ADR 0004 holds `- Amended by ADR 0021 (` in its first eight lines and a Note starting `Note (roadmap-sessions-upfront`; ADR 0010's roadmap-sessions-upfront Note names decision 8 and `a lone /devkit change`; the ADRs line of `openspec/config.yaml` reads `amends 0004, 0006, 0010, 0011, 0013, 0014 and 0017`; the `## 0.34.0` entry of `CHANGELOG.md` names `session-next`, `session-wait`, `merge-base`, `push` and `check` as subcommands and does not call `schedule-check` or `delete-check` one) (findings 10 to 13, spec nit F4).

  In `change-loop.test.mjs`: `upfront AC-6 triage: triageSection and hasTriageSection read the one section, a fenced or suffixed heading being none` (finding 5); `upfront AC-1 guard: a started task after a note of the host makes a change run` (finding 8, the `typedOf` path).
  In `guard.test.mjs`: `upfront AC-2 guard: namesEntrySkill reads the entry skill's name from any string field and nothing else` (one assertion each: the bare name, the plugin-scoped name, another field, a value that is not a string, `devkit-session-x`, `my-devkit-session`) (finding 2); `upfront AC-1 guard: startedTaskOf skips the host's leading notes and nothing else` (one assertion each: one note, two notes, blank lines after a note, an unclosed note gives null, a line `hello` before the form gives null, a note after the form's first line is no leading note) (finding 8).
  Change T-17 of D-13 (invariant: a stale or doomed wait loop is stopped, a kept one keeps running, and a change's live wait counts as watching; layer: check and decide; suite: roadmap-loop): `sleeper(kind)` spawns a child whose command line is a wait loop's, `stranger()` keeps the plain child; no assertion of its five tests changes.
  Run the new tests and T-17 on the unchanged code with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-sessions-upfront/proof/red-7.txt`, listing at its
  top the tests that pass there (expected: the `guard.mjs stop` test and the `lockSleep` test, which
  pin phase 2's behaviour, and the five tests of T-17, which pass with the new helper). Check: every
  other new test fails there, and no test outside T-17 was edited (`git diff` of the three test files
  shows only added tests and the `sleeper` and `stranger` helpers).
- [x] 7.2 The plan push recorded by `approval.md` on `origin` (D-5): in `plugins/openspec/hooks/roadmap-loop.mjs`,
  `unpushedOf` gives `plan` only while `filesPushed(root, branch, [approval.md])` is false; the
  `push --what plan` subcommand still commits all `PLAN_FILES`. Check: the new `upfront AC-12` test
  and both existing `upfront AC-12` tests pass.
- [x] 7.3 The `skill` mode tests the raw input first (D-1): `ENTRY_SKILL` and `namesEntrySkill` in
  `plugins/openspec/hooks/guard.mjs` (exported); `skillEntry` logs `not-entry` and returns before the
  import when `namesEntrySkill` is false, and fails closed on any error, the import included, when it
  is true; `roadmap-loop.mjs` imports both, re-exports `ENTRY_SKILL`, and `entryDecision`'s
  `not-entry` calls `namesEntrySkill`; the header comment of `skillEntry` says why. Check: the two new
  tests of finding 2 pass, and `upfront AC-2 guard: guard.mjs skill ...` and `upfront AC-2 entry:
  another skill is let through` pass unchanged.
- [x] 7.4 The identity of a recorded wait (D-9 step 1): `isWaitProcess` and `waitAlive` in
  `roadmap-loop.mjs` (exported); `killWaits` signals only an entry `isWaitProcess` accepts and
  returns that count; `checkCmd` keeps the entries `waitAlive` accepts; every caller drops the
  entries it was given; `watchAlive` unchanged. Check: the three new tests of finding 3 and the five
  tests of T-17 pass; every `upfront AC-14 staleWaits` test and `roadmap-loop hold: ...` pass
  unchanged.
- [x] 7.5 The records of a change no longer open (D-7): `pruneRecords(run, openIds)` in
  `roadmap-loop.mjs`, called in `decide()` beside the pruning of `startedSessions` and `tickets` and
  at the top of `checkCmd`'s locked update. Check: the two new tests of finding 4 pass;
  `roadmap-loop run: U4 ...`, `upfront AC-9 next: start anyway ...` and every `upfront AC-14 check`
  test pass unchanged.
- [x] 7.6 One reader of the triage section (D-4): in `plugins/openspec/hooks/change-loop.mjs`,
  `triageSection` and `hasTriageSection` exported, `triageUnsourced` built on `triageSection`, and the
  triage block moved above the header comment of `decide` (no behaviour changes); in `roadmap-loop.mjs`,
  `checkCmd` asks `hasTriageSection` in place of its regular expression. Check: the two new tests of
  finding 5 pass and every `upfront AC-6 triage` test passes unchanged.
- [x] 7.7 The host's leading notes (D-1): `startedTaskOf` in `plugins/openspec/hooks/guard.mjs` skips
  the leading `<system-reminder>` notes and the blank lines after them; `typedOf` reads a message
  `startedTaskOf` accepts from its first non-blank task line and any other from its first line; the
  comments on `STARTED_BY_SESSION` and `startedTaskOf` name the note. Check: the three new tests of
  finding 8 pass; `upfront AC-2 guard: startedTaskOf and firstMessageOf read only the first message's
  started form`, `followups F-4 guard: the task of a session started by another session makes a
  change run` and every `upfront AC-1 entry` and `upfront AC-2 entry` test pass unchanged.
- [x] 7.8 The declared end after a conflicting merge (D-6): Loop item 3 of
  `plugins/openspec/skills/devkit-session/SKILL.md` gains the sentence of D-6; `mergeBaseCmd` in
  `roadmap-loop.mjs` runs git through `gitIn`, its local helper removed (no behaviour changes). Check:
  `upfront AC-8 skill: ...` passes, `upfront AC-8 merge-base: ...` and `upfront AC-1 skill: ...` pass
  unchanged, and `python3 scripts/check.py` passes.
- [x] 7.9 The ADRs and the changelog (D-12, D-16): in `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`,
  the status `accepted`, the `- Accepted by:` line with the date and the owner's words read from
  this change's `approval.md` (written by the owner for this revised plan: its header says
  `attempt=3` and its `Date` and `Readiness` lines match this plan's `readiness.md`; if it is still the
  attempt 2 file, stop and report), the Amends line, decisions 1 and 3, decisions 7 and 8 and the Consequences as D-12
  quotes them; in `docs/adr/0004-devkit-per-project.md` the header line and the Note of D-12; in
  `docs/adr/0010-openspec-as-the-harness.md` the last sentence of the roadmap-sessions-upfront Note
  as D-12 says; the ADRs line of `openspec/config.yaml` (its 0021 amends list); in `CHANGELOG.md`,
  the `## 0.34.0` entry's subcommand sentence names `session-next`, `session-wait`, `merge-base`,
  `push` and `check`, and the cleanup sentence names `schedule-check` and `delete-check` as actions of
  a decision. If `origin/main` took the number 0019 since, renumber it: the next free number on `origin/main` at the last merge before review, as task 6.2 says. Check: `upfront
  ADR 0021: the documents follow` passes; `followups ADR 0014: the documents follow`, `change-state
  ADR 0017: the documents follow` and `delivery-models docs: the documents follow` and the `guard.test.mjs` test "ADR 0004 exists with its sections" pass unchanged;
  `python3 scripts/check.py` passes.
- [x] 7.10 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate roadmap-sessions-upfront --strict` green, the suite run as a background command of the tool (13 to 21 minutes); covers the fixes of D-16 and every criterion as D-15 maps them.

## 8. Flow version 2 of devkit and devkit-lite (AC-4, AC-5, AC-14; design D-17)

Added on 2026-11-23 after the merge `62cf500` (change-version-pin): `python3 scripts/check.py` refuses
the `flow.json` that phase 4 edited at version 1, and the owner chose to release version 2. Every new
test here is written before the code it proves; an existing test changes only where D-13 names it
(T-18 to T-22). No version number moves: devkit-openspec 0.33.0, devkit-core 0.14.0 and marketplace
0.37.0 are already this change's release in the tree (the second merge of main renumbered them, with ADR 0021).

- [x] 8.1 Write this phase's tests (design D-17 "The tests this asks"; specs `change-coordination`
  "Every grill asks the triage agent first" and "The triage ships as flow version 2" (scenarios "A
  change opened on flow 2", "A project slice", "A change on flow 1 keeps its flow's grill", "A change
  moved to flow 2"), `coordination-locks` "In a roadmap run a
  hand-off names its change" ("The triage for a change on an older flow"), `roadmap-coordination` "A
  firing of the check acts and reports only what changed" ("A grill on an older flow")). In
  `change-loop.test.mjs`:
  - `upfront AC-5 flow: version 2 of devkit and devkit-lite names requirements-triage among the grill's helpers in both copies, and flows/2.json is flow.json`;
  - `upfront AC-5 flow: flows/1.json of devkit and devkit-lite is released version 1, without requirements-triage, and devkit-project stays at version 1`;
  - `upfront AC-5 flow: released-flows.json records the digest of flows/2.json of devkit and devkit-lite` (`sha256:` and the hex SHA-256 of the file's bytes, as `check.py#flow_digest`);
  - `upfront AC-5 triage: the grill of a change on flow 1 names no triage helper and that of a change on flow 2 names it` (no pin, `x-devkit-flow: 1`, `x-devkit-flow: 2`, and the flow-1 change after `change-loop.mjs flow <id>` moved it; the grill of the next stage and the grill sent back by `unsourced`; the `helpers` key only on `grill` actions);
  - `upfront AC-5 lock agent: a change run on flow 1 refuses devkit-core:requirements-triage as not-a-role, and one on flow 2 allows it` (a real `guard.mjs agent` process, as `upfront AC-5 triage: a change run may hand ...` runs it);
  - `upfront AC-5 skill: the grill skill and the devkit skill hand the triage only when the grill action's helpers name it` (step 2b of `plugins/core/skills/requirements-grill/SKILL.md` and the `grill` item of `plugins/openspec/skills/devkit/SKILL.md` name `helpers` and say the owner is asked every question otherwise).

  In `version-pin.test.mjs`: `upfront AC-5 open: a devkit and a devkit-lite change opened on the tree's schemas record x-devkit-flow 2, and a project slice 1` (a project with the tree's schemas, not the fixtures of T-21).
  In `roadmap-loop.test.mjs`: `upfront AC-4 lock agent: the coordinating session's triage for a change on flow 1 is refused own-sessions`; `upfront AC-14 check: a grill of a change on flow 1 gives no triage action, and one on flow 2 does`.
  In `guard.test.mjs`: `upfront AC-5 docs: the flow doc names the released flow versions, the 0.37.0 entry names flow version 2, and ADR 0021's Note names flow 1`.
  Run them on the unchanged code with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront AC-5 flow" --test-name-pattern="^upfront AC-5 triage: the grill of a change on flow" --test-name-pattern="^upfront AC-5 lock agent" --test-name-pattern="^upfront AC-5 skill: the grill skill and" --test-name-pattern="^upfront AC-5 open" --test-name-pattern="^upfront AC-5 docs" --test-name-pattern="^upfront AC-4 lock agent: the coordinating session's triage for a change on flow 1" --test-name-pattern="^upfront AC-14 check: a grill of a change on flow 1" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-sessions-upfront/proof/red-8.txt`, listing at its
  top the tests that pass there (expected: `upfront AC-5 flow: flows/1.json of devkit and devkit-lite
  is released version 1 ...`, which pins what change-version-pin released). Check: every other new
  test fails there.
- [x] 8.2 Release flow version 2 (D-17 "The choice"): in `plugins/openspec/schemas/devkit/flow.json`,
  `plugins/openspec/schemas/devkit-lite/flow.json`, `openspec/schemas/devkit/flow.json` and
  `openspec/schemas/devkit-lite/flow.json` the second line becomes `  "version": 2,` and nothing else
  changes; copy each to `flows/2.json` in its folder (the same bytes); leave every `flows/1.json` and
  the `devkit-project` folders untouched; add `"2"` under `devkit` and under `devkit-lite` in
  `scripts/released-flows.json`, each `sha256:` and the hex printed by
  `python3 -c "import hashlib,sys; print(hashlib.sha256(open(sys.argv[1],'rb').read()).hexdigest())" plugins/openspec/schemas/<script>/flows/2.json`
  (the function of `check.py#flow_digest`). Check: `python3 scripts/check.py` prints `all checks
  passed`; `git diff --exit-code -- plugins/openspec/schemas/devkit/flows/1.json plugins/openspec/schemas/devkit-lite/flows/1.json openspec/schemas/devkit/flows/1.json openspec/schemas/devkit-lite/flows/1.json plugins/openspec/schemas/devkit-project openspec/schemas/devkit-project`
  exits 0; the three `upfront AC-5 flow` tests, `upfront AC-5 open: ...`, `version-pin AC-7 schema:
  every kept flow is valid and named by its version`, `version-pin AC-7 check: the tree's flows pass`
  and `flow-check schema: the openspec/schemas copies are byte-identical` pass.
- [x] 8.3 The triage only for a change on flow 2 (D-17 "What the locks and the grill do"): in
  `plugins/openspec/hooks/change-loop.mjs`, `decide`'s `planPart` gives both `grill` actions
  `helpers`, the `helpers` of the `requirements` stage of the flow `decide` reads (`[]` when none);
  in `plugins/openspec/hooks/roadmap-loop.mjs`, `checkCmd`'s `triage` filter keeps only a grill
  action whose `helpers` include `requirements-triage`; in `plugins/core/skills/requirements-grill/SKILL.md`
  step 2b and in the `grill` item of `plugins/openspec/skills/devkit/SKILL.md`, the sentences of D-17
  item 2, each naming where it reads the permission: the `helpers` of the action `next` (or
  `session-next`) printed in a lone change or a change session, the `helpers` of `ask.action` in the
  coordinating session, and, for the check's `triage` action (which carries no `helpers`), the
  action itself, since the check gives it only for a grill whose `helpers` name the triage; with no
  permission every question goes to the owner, one at a time, as before; in `roadmap-loop.mjs`,
  `isRequirementsHelper` reads the installed flow of the project's script when the brief's change has
  no folder, null-safe as its current read (`readFlow(...)?.stages.find(...)?.helpers ?? []`, since
  `readFlow` returns null for a script with no `flow.json`) (D-17, the RH6 correction).
  `handOffFor` does not change. Check: `upfront AC-4 lock agent: the triage for a change not open is
  refused not-open` passes unchanged once 8.2 is done; `upfront
  AC-5 triage: the grill of a change on flow 1 ...`, `upfront AC-5 lock agent: ...`, `upfront AC-5
  skill: the grill skill and ...`, `upfront AC-4 lock agent: the coordinating session's triage for a
  change on flow 1 ...` and `upfront AC-14 check: a grill of a change on flow 1 ...` pass; `upfront
  AC-5 skill: the grill rule of config.yaml and of the four schema files ...` and every `upfront AC-6
  triage` test pass unchanged.
- [x] 8.4 The tests that expect flow version 1 to be the installed one (D-13 T-18 to T-22). Change
  T-18 (invariant: a change run may hand the triage to a change whose flow lists it; layer: the
  `agent` lock, H3; suite: change-loop), T-19 (invariant: the coordinating session may hand a helper
  of an open change's grill, marking nothing under way; layer: `roadmapAgentDecision` RH6; suite:
  roadmap-loop), T-20 (invariant: the check gives the triage of each grill not being asked that has
  no triage section; layer: `checkCmd`; suite: roadmap-loop) and T-21 (invariant: a change keeps the
  flow it opened with across an upgrade, and the repository check refuses a flow change that keeps
  its version; layer: the fixtures of the version-pin suite; suite: version-pin) and T-22
  (invariant: the readout of the approved sample change reads as the owner approved it; layer: the
  readout; suite: flow-check) as D-13 says. Check: T-18 to T-22 and every `version-pin` and
  `flow-check` test pass, with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront" --test-name-pattern="^version-pin" --test-name-pattern="^flow-check" plugins/openspec/hooks/guard.test.mjs`.
  The rule for a failure the whole-suite run of 8.6 finds beyond T-18 to T-22: a test failing only
  because it assumed flow version 1 is installed (an unpinned scratch change that hands the triage, a
  readout or resume reply read as text that now holds the newer-flow line, a raise to version 2 that
  version 2 already holds) is changed the same way, with a row added to D-13 naming its invariant,
  layer and suite; any other failure is a defect of this change, not a test to edit.
- [x] 8.5 Documents (D-14 "Flow version 2", D-17): the versions paragraph in `docs/openspec-flow.md`
  after "A change to a `flow.json` raises its `version`"; in `CHANGELOG.md`, the `## 0.37.0` entry's
  sentence on flow version 2 under **devkit-openspec** 0.33.0 and its "Projects" line; the Note of
  `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md` after its Decision list. Check:
  `upfront AC-5 docs: ...` passes; `upfront ADR 0021: the documents follow`, `change-loop docs: the
  design records the answers` and every `change-budget AC-10` docs test pass unchanged;
  `python3 scripts/check.py` passes (links, language, changelog).
- [x] 8.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate roadmap-sessions-upfront --strict` green, the suite run as a background command of the tool (13 to 45 minutes; it covers the documents 8.5 edits, read by suites outside phase 8's patterns), a failure handled by 8.4's rule; covers AC-5 (flow version 2, the triage of a change on flow 2 only), AC-4 (the coordinating session's triage by the change's flow) and AC-14 (the check's triage by the change's flow).

## 9. This change beside remote-worker (AC-9, AC-10; design D-18)

Added on 2026-11-23 after review round 1 at `5edea6b` (`review.md`, third block): three important
findings from combining this change with main's `remote-worker` (ADR 0020, merged at `5cc1c69`).
Item 3 of D-18 is a decision for the owner's approval; nothing here starts before the owner approves
this revised plan. Every new test is written before the code or text it proves; an existing test
changes only where D-13 names it (T-27). No version number moves. The whole suite ran on `5cc1c69`
(2356 tests, 0 fail); this phase changes two product files (`change-loop.mjs`, `roadmap-loop.mjs`), so
its last gate runs the whole suite again. The spec delta and the `rules.requirements` sentence of
`openspec/config.yaml` are written by this revision of the plan.

- [ ] 9.1 Write this phase's tests (design D-18 "The tests this asks"; spec `roadmap-coordination`
  "With the machines setting set, a change session of this machine takes its place from the run's own count", scenarios "The places of each machine with the machines setting set", "An approved plan
  pushed is no place taken on this machine", "A change reaches its implementation before its plan is
  pushed", "The place frees before the claim on origin does", "A change of this machine with no
  claimed ticket"). In `plugins/openspec/hooks/roadmap-loop.test.mjs`, over `upPushed`'s change `a` with
  the claim `x-devkit-machine: <thisMachine()>` and `x-devkit-places: run`, another change `b` of this
  machine with its `approval.md` on the same `origin`, and a run file with `changeSessions`, `places: 1`
  and `a`'s ticket claimed:
  - `upfront D-18 place: a change session of this machine on the run's ticket takes its place from occupied only, before and after its plan push`;
  - `upfront D-18 place: a place of this machine frees when its change leaves the load stages, whatever its claim on origin, and nothing of it counts once archived`;
  - `upfront D-18 place: a change of this machine whose ticket no session claimed keeps the remote-worker gate`;
  - `upfront D-18 docs: ADR 0021 names ADR 0020 in its Amends and a Note, ADR 0020 is amended by ADR 0021, and ADR 0010's Note and the config rule qualify the triage by flow`;
  and change T-27 (invariant: the config's ADR list names what ADR 0021 amends; layer: the
  documents; suite: roadmap-loop): `upfront ADR 0021: the documents follow` asserts "amends 0004,
  0006, 0010, 0011, 0013, 0014, 0017 and 0020". Each new test carries its Invariant, Layer and Suite
  comment as D-18 states them. Run them on the unchanged code with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront D-18" --test-name-pattern="^upfront ADR 0021: the documents follow" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-sessions-upfront/proof/red-9.txt`, listing at its
  top the tests that pass there (expected: `upfront D-18 place: a change of this machine whose ticket
  no session claimed keeps the remote-worker gate`, which pins today's gate). Check: the other three
  tests and T-27 fail there, each on the assertion D-18 names (the `no-place` end or `take-place`
  before the push, the board's `taken`, the ADR text; the docs test's config-rule assertion already
  holds, since this revision wrote that sentence).
- [ ] 9.2 One gate for a change session of this machine (D-18 item 3, change 1): in
  `plugins/openspec/hooks/change-loop.mjs#placeFacts`, read the run file once
  (`readRun(runFilePath(found.root))`) and, when the claim's `places` is `run` and that run has
  `changeSessions` and `tickets[id]?.claimedBy`, return `null`; otherwise as today (the run's
  `places` for `run`). The header comment of `placeFacts` names the condition and that it is
  `sessionNext`'s. `placeChange`, `buildPart` and the `wake` of `decideRoadmap` do not change. Check:
  `upfront D-18 place: a change session of this machine on the run's ticket ...` (its gate half) and
  `upfront D-18 place: a change of this machine whose ticket no session claimed ...` pass; every
  `remote AC-10` and `remote AC-11` test and every `upfront AC-9 session-next` test pass unchanged.
- [ ] 9.3 The board's row of this machine (D-18 item 3, change 2): in
  `plugins/openspec/hooks/roadmap-loop.mjs#boardOf`, with `f.changeSessions` the `taken` of the row
  `machine.this` is the number of distinct ids in `f.occupied` and in this machine's claims with
  `placed: true` whose ticket no session claimed (`!f.tickets?.[id]?.claimedBy`); other rows and a run
  without a session per change keep `takenBy`. Check: both `upfront D-18 place` tests that read the
  board pass; `remote AC-5 status: the machines block and the machine of each row`, `remote AC-12
  status: a silent machine and its changes read no answer` and every `upfront merge` test pass
  unchanged.
- [ ] 9.4 The ADRs, the config and the changelog (D-18 item 1, the text it quotes): in
  `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md`, the ADR 0020 entry at the end of
  `- Amends:` and the second Note before `## Consequences`, the status and the decisions unchanged; in
  `docs/adr/0020-a-change-can-run-on-another-machine.md`, the `- Amended by ADR 0021 (...)` header line
  after `- Amends:` and the one Note before `## Consequences`, its status and decisions unchanged; in
  `docs/adr/0010-openspec-as-the-harness.md`, the flow qualifier in the roadmap-sessions-upfront Note;
  in `openspec/config.yaml`, the `ADRs:` line's 0021 entry ends "amends 0004, 0006, 0010, 0011, 0013,
  0014, 0017 and 0020" (`rules.requirements` is already done); in `CHANGELOG.md`, the `## 0.37.0`
  entry's **devkit-openspec** 0.33.0 bullet gains "With the machines setting set, a change session of
  this machine on the run's ticket takes its place from the run's own count: its plan on `origin` is
  no place taken, and the board's row of this machine counts those places." Check: `upfront D-18
  docs: ...` and T-27 pass; `upfront AC-5 docs: ...` and `upfront AC-5 skill: the grill rule of
  config.yaml ...` pass unchanged; `python3 scripts/check.py` passes (links, language, changelog).
- [ ] 9.5 Gate (focused): `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^upfront D-18" --test-name-pattern="^upfront ADR 0021: the documents follow" --test-name-pattern="^upfront AC-5 skill: the grill rule" --test-name-pattern="^upfront AC-5 docs" --test-name-pattern="^upfront AC-9 session-next" --test-name-pattern="^upfront merge" --test-name-pattern="^remote AC-10" --test-name-pattern="^remote AC-11" --test-name-pattern="^remote AC-5 status" --test-name-pattern="^remote AC-12 status" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate roadmap-sessions-upfront --strict`
  green; covers D-18 (AC-9 and AC-10 with the machines setting set) and the documents of 9.4.
- [ ] 9.6 Gate (whole suite, two product files changed since `5cc1c69`): `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs`
  green, run as a background command of the tool (13 to 45 minutes); a failure outside 9.1's tests is
  a defect of 9.2 or 9.3, not a test to edit.

## Workflow follow-up

- On the next real `/devkit roadmap` with the release installed: record the dogfood column of D-15
  (the entry on a started session's first turn with `DEVKIT_HOOK_LOG` set, the session's first
  message with its `devkit-start:` line compared with `REAL_STARTED_2026_11_22` of task 7.1, the
  cron's life, the archive of an archived change's session, ⏳ in the sidebar, a change session
  stopping at a `budget:` cap when one is set, and the triage variants of D-17: a flow-2 change's
  grill asked in the coordinating session and one in a lone `/devkit change`, both handing the
  questions to the triage first, and a flow-1 change's grill, which asks the owner every question
  and whose readout and resume reply show the newer-flow line), as evidence of `roadmap-live-checks`. Until then the
  `devkit-start:` line is proven only by the tests of synthetic messages: the evidence of this change
  says so in its AC-1 row.
- Archive the change after its review and merge.
