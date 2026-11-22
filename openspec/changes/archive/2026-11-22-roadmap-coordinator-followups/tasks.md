<!-- devkit-stage tasks result=passed attempt=3 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Tasks

Change: `roadmap-coordinator-followups` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, key, text and test name is in
`design.md`:

- D-1 the run's arguments, D-2 start anyway;
- D-3 one session per change, D-4 a session started by another session, D-5 the stage icon, D-6 a
  start on a turn nobody typed;
- D-7 the watch, D-8 the lock, D-9 ids, D-10 the temporary file;
- D-11 the board, D-12 the "others" keys;
- D-13 the ADRs, D-14 the tests this plan changes, D-15 the documents and release, D-16 proof.

The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every new test is named `followups <AC-n or F-n> <area>: ...` and lives in
`plugins/openspec/hooks/roadmap-loop.test.mjs`, except those D-16 places in
`plugins/openspec/hooks/change-loop.test.mjs`. A gate runs them filtered through
`plugins/openspec/hooks/guard.test.mjs`, which imports both files. Every env a new test builds uses
the file's shared constant that blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`,
`GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` (`SET` in `roadmap-loop.test.mjs`).
Every gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does.
The tests need the `openspec` CLI 2.x on `PATH`. The whole suite (about 13 minutes) runs once, in
gate 4.6, as a background command. No gate calls `claude` by name. No test starts, lists or
renames an app session: the host calls (`mcp__ccd_session__start_session`,
`mcp__ccd_session_mgmt__list_sessions`, `mcp__ccd_session_mgmt__set_session_title`) are proved by
the skill text and by the exact `input` the decision gives them, and live (phase 5).

Test first in phases 1, 2 and 3: the phase's test task comes before its code tasks, and its new tests
fail on the base `6e803eb`, except those D-16 says pin behaviour the base already has. An existing
test is changed only where D-14 names it (T-1 to T-10), and the task says its invariant, layer and
suite; T-11 to T-14 of D-14 read text this plan rewrites and pass unchanged, and the task that
rewrites the text names them in its check; every other existing test runs unchanged. Leave no backup or scratch file in the tree; end
every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `ready-line-waits-only-when-full` | 2.1, 2.3 |
| AC-2 | `others-go-on-only-when-running` | 2.1, 2.3 |
| AC-3 | `adr-names-run-file-fields` | 4.1 |
| AC-4 | `ids-checked-before-keys` | 1.1, 1.4 |
| AC-5 | `failed-write-cleans-temp` | 1.1, 1.3 |
| AC-6 | `lock-wait-under-hook-timeout` | 1.1, 1.3 |
| AC-7 | `killed-hold-does-not-hold` | 1.1, 1.2, 1.5 |
| AC-8 | `start-anyway-once` | 2.1, 2.2, 2.4 |
| AC-9 | `roadmap-n-starts-first-call` | 2.1, 2.2, 2.4 |
| AC-10 | `missing-tests-added` | 1.1, 1.3 |
| AC-11 | `first-run-defects-fixed` | 1.1, 2.1, 3.1, 5.3 |
| AC-12 | `first-run-observed` | 5.1, 5.2 |
| AC-13 | `one-session-per-change` | 3.1, 3.2, 3.5, 3.6, 4.2, 4.3, 5.1 |
| AC-14 | `session-icon-by-stage` | 3.1, 3.4, 3.6, 4.2, 5.1 |
| AC-15 | `start-needs-no-retyping` | 3.1, 3.2, 3.3, 3.6, 4.3, 5.1 |

## 1. The run file and its locks (AC-4, AC-5, AC-6, AC-7, AC-10, AC-11)

- [x] 1.1 Write this phase's tests (design D-7 to D-10, D-16; specs `roadmap-coordination` "A watch
  of the load that died holds nothing", "The loop refuses an id that is not a change id", "The
  bookkeeping is written whole or not at all"; `coordination-locks` "The hand-off lock answers within
  the hook's time when the bookkeeping is busy" and the scenario "A watch of the load that died").
  First export `readCounter` from `plugins/openspec/hooks/change-loop.test.mjs`. Then add, in
  `roadmap-loop.test.mjs`:
  - `followups AC-4 next: an --after id that is not a change id exits 3 and writes nothing` (ids
    `__proto__`, `../x`, `-a`; the run file's bytes unchanged);
  - `followups AC-4 reply: an end declared for an id that is not a change id exits 3 and records nothing`;
  - `followups AC-4 wait: a --change that is not a change id exits 3 and marks nothing in flight`;
  - `followups AC-5 run file: a write that fails leaves no temporary file and throws` (the run file
    path made a directory; no `*.tmp` left in its folder);
  - `followups AC-6 lock: the run file's wait is at most half the agent hook's timeout` (reads
    `plugins/openspec/hooks/hooks.json` and the exported `LOCK`);
  - `followups AC-6 lock agent: a hand-off while the run file is locked is let through within the
    hook's time and logged run-file-busy` (a real `guard.mjs agent` process through `lkHook`, with a
    fresh `roadmap-run.lock` beside the run file and `DEVKIT_HOOK_LOG` set; exit 0 in under 10 000 ms;
    the log line's `why` is `run-file-busy`; no entry in flight for the change);
  - `followups AC-7 next: a hold whose process ended asks for a new hold while loaded, and starts below
    the limit` (`holding` set to the pid of a child that has exited, and to the 0.18.0 boolean `true`);
  - `followups AC-7 hold: a killed hold process leaves a mark the next next does not trust` (a real
    `roadmap-loop.mjs hold --interval 5` child, killed with `SIGKILL` once the run file names its pid;
    then `next` at load 95 gives a `hold` action and at load 40 a `start`);
  - `followups AC-7 lock stop: a held start whose watch process ended is refused once, naming the watch
    to start`;
  - `followups AC-10 run: run without --session exits 3 and writes no run file`;
  - `followups AC-10 lock: updateRun on a held lock throws RunFileBusy after its wait, without sleeping
    for real` (the injected sleeps add up to `LOCK.waitMs`; the other holder's lock is untouched);
  - `followups AC-10 lock: next on a held run file lock exits 3 and leaves the file as it was` (`main`
    with a no-op `lockSleep` that records its calls);
  - `followups AC-10 draft: an unknown files' language writes the draft in English` (`devkit:` with
    `language: fr`, `--lang pt-BR`: the round title in English, the reply in pt-BR);
  - `followups AC-10 guard: an edit and a shell write in a roadmap run read the transcript once` (exit
    2 each, one read each, through `readCounter`).

  And in `change-loop.test.mjs`:
  - `followups AC-10 open lock: open on a held open lock fails with its own message and creates nothing`
    (`openChange` with a no-op `lockSleep`; a fresh `devkit-open.lock` in the git common directory);
  - `followups AC-10 guard: an edit and a shell write in a change run read the transcript once`.

  Run them on the unchanged code with
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" plugins/openspec/hooks/guard.test.mjs`
  and save the output to `openspec/changes/roadmap-coordinator-followups/proof/red-1.txt`. At its top,
  list the tests that pass on the base: the `--session`, draft and two guard read tests of AC-10.
  Check: every other new test fails in that file. The open-lock test may take its full 60 s there;
  that is expected.
- [x] 1.2 Make a dead watch hold nothing in `plugins/openspec/hooks/roadmap-loop.mjs` (D-7): `holding`
  as `null | { pid, at }`, `watchAlive`, `readRun`, `collectRoadmap`, and `holdCmd` writing its pid
  and clearing only its own. Check: the three `followups AC-7` tests pass.
- [x] 1.3 Add the lock's wait, the busy hand-off and the temporary file's removal (D-8, D-10). In
  `roadmap-loop.mjs`: `LOCK` exported with `waitMs: 3_000`, `RunFileBusy`, `updateRun`'s try/catch
  with `rmSync`, `allow('run-file-busy', change)` in `roadmapAgentDecision` and
  `roadmapSubagentStopDecision`, `lockSleep` in `contextOf` passed to every `updateRun`. In
  `plugins/openspec/hooks/change-loop.mjs`: `openChange`'s `lockSleep` passed through `withOpenLock`.
  Check: the `followups AC-5`, `followups AC-6` and the three `followups AC-10 ... lock` tests pass.
- [x] 1.4 Check ids before they become keys (D-9): `isChangeId` exported from
  `plugins/openspec/hooks/guard.mjs`, and `changeIdOf` in `roadmap-loop.mjs` called by `next`
  (`--after`), `reply` (`--param id=` of an end key) and `wait` (`--change`). Check: the three
  `followups AC-4` tests pass, and `roadmap-loop next: a usage error exits 3 with the form of
  change-loop and writes nothing` passes unchanged.
- [x] 1.5 Change T-1, T-2 and T-3 of D-14 in `roadmap-loop.test.mjs`, each keeping its invariant:
  - T-1: the same session keeps what is under way, and another session or `--fresh` starts empty
    (layer: the run command; suite: roadmap-loop).
  - T-2: the hold marks its watch while it lasts and clears it at its end, also on error (layer: the
    hold command; suite: roadmap-loop).
  - T-3: a watched hold lets the stop through (layer: the stop lock; suite: roadmap-loop).

  Check: the three tests pass with the `holding` shape of D-7.
- [x] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-4, AC-5, AC-6, AC-7, AC-10 and the red record of AC-11 for this phase.

## 2. What the owner sees, the run's arguments and start anyway (AC-1, AC-2, AC-8, AC-9, AC-11)

- [x] 2.1 Write this phase's tests (design D-1, D-2, D-11, D-12; spec `roadmap-coordination`: the
  scenarios "The arguments as typed", "A change reaches a gate while nothing else runs", "A change
  stops while nothing else runs", the three ready-line scenarios and "Loaded with nothing open", and
  the requirement "The owner can start held changes anyway"). In `roadmap-loop.test.mjs`:
  - `followups F-1 run: the arguments as typed start the run on the first call` (`roadmap 2`,
    `roadmap`, `ROADMAP stop` after a run, `roadmap many`, and `2`);
  - `followups F-2 decide: start anyway starts the held changes once`;
  - `followups AC-8 next: start anyway starts what is held now, and a change ready later is held and
    said again` (with `next --start-anyway`, then a later decision without it; the run file gains no
    field; the hold line ends with the start-anyway sentence);
  - `followups AC-1 status: a ready line waits for a place only when the places are taken`;
  - `followups AC-2 decide: a gate or blocked line says the others go on only when another change is
    under way` (alone; with another change in flight, with a stage handed, with a wait, with a start);
  - `followups F-1 skill: the run call takes the owner's arguments`;
  - `followups F-2 skill: start anyway only on the owner's own message, with both flags`.

  Run them on the unchanged code as in task 1.1 and save the output to
  `openspec/changes/roadmap-coordinator-followups/proof/red-2.txt`. Check: every new test of this
  task fails there.
- [x] 2.2 Take the arguments as typed and add start anyway in `roadmap-loop.mjs` (D-1, D-2):
  `parseRunInput` used by `runCmd`; `next --start-anyway` read into `facts.startAnyway` and used by
  `decideRoadmap`'s `loaded`. In `change-loop.mjs#MESSAGES`, the closing sentence of `roadmap-held`
  in both languages. Check: the `followups F-1 run`, `followups F-2 decide` and `followups AC-8` tests
  pass.
- [x] 2.3 Change the board's ready line and the "others" sentence (D-11 first paragraph, D-12). In
  `boardOf`, the `queue.ready` key. In `MESSAGES`, `queue.ready`, `roadmap-gate`, `roadmap-blocked`,
  `roadmap-gate-others` and `roadmap-blocked-others` in both languages, and `BLOCKED_WHY_KEYS` in
  `change-loop.mjs`. In `decideRoadmap`, `othersGoOn`. Then change T-4 to T-7 of D-14, each keeping
  its invariant:
  - T-4: one line per event, once, in the table's order (layer: decide; suite: roadmap-loop).
  - T-5: an event line is in the person's language (layer: decide; suite: roadmap-loop).
  - T-6: every key with a blocked `{why}` renders every reason (layer: the message table; suite:
    roadmap-loop).
  - T-7: the same invariant as T-6 (layer: the message table; suite: change-loop).

  Check: the `followups AC-1` and `followups AC-2` tests pass, as do T-4 to T-7, and the message
  table's parity test passes unchanged.
- [x] 2.4 Update `plugins/openspec/skills/devkit/SKILL.md` for D-1 and D-2: the Start bullet for
  `roadmap`; Roadmap step 1 ("the owner's arguments"); the start-anyway item with its full `next` call
  carrying both flags; the Never item. Check: the two `followups ... skill` tests of task 2.1 pass,
  and every `roadmap-loop skill` and `change-loop skill` test passes unchanged.
- [x] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-8, AC-9 and F-1, F-2 of AC-11.

## 3. One session per change, the stage icon and a start on a turn nobody typed (AC-13, AC-14, AC-15, AC-11)

- [x] 3.1 Write this phase's tests (design D-3 to D-6, D-11 second paragraph, D-16; spec
  `roadmap-coordination`: the requirements "Each change of a roadmap run runs in a session of its own
  where the host can start sessions", "A change session tells the coordinating session when its change
  is archived", "A change session shows the stage its change is in", "A change ready on a turn nobody
  typed waits for the owner's next message, with a line", the scenarios "A gate in a change's own
  session", "Two changes at their grill, each in its own session", "A change that already has a
  session", "A session the app already lists", "A stop in a run with a session per change", "A report
  from a change session", "A report with nothing new", "The load falls in a run with a session per
  change" and "A ready line waiting for the owner's next message", and the requirement "Each decision
  of a run with a session per change names its turn" ("No turn named", "A turn word the loop does
  not know"); spec `coordination-locks`: "A session started by another session", "A command
  named inside a message", "Every change in its own session", "A change session to start on a typed
  turn", "A start on a turn nobody typed", "A hand-off when every change has its own session"). In
  `roadmap-loop.test.mjs`:
  - `followups F-3 decide: with a session per change the coordinator hands no stage and starts each open
    change's session in its worktree` (`changeSessions` true, turn `typed`; `a` with an agent action,
    `b` at its grill, `c` in `startedSessions`: one `session-start` each for `a` and `b`, with `cwd`
    the change's root and `title` `<icon> <id>`, and `input` deep-equal to the eight fields of D-3:
    `initiation` `user_asked`, `context` `fresh`, `title`, `name` (`sessionName(id)`), `cwd`,
    `use_worktree` false, `prompt` `/devkit-openspec:devkit change <id>` and `background`; no
    `agent`, `session` or `wait` action; `ask` null; no gate line);
  - `followups AC-13 name: sessionName gives the start's name, [a-z0-9-] and at most 24 characters`
    (`roadmap-coordinator-followups`, `A_b.c`, `___`, and a 40-character id);
  - `followups AC-13 run: --change-sessions is recorded, and a run without it keeps the stages in the
    session`;
  - `followups AC-13 run: a run from another session keeps the started change sessions and gives
    them no second session, and --fresh forgets them` (D-3, item 9);
  - `followups AC-13 next: a reported session start is recorded once, said once and never started
    again, and a change no longer open leaves the record`;
  - `followups AC-13 decide: a change in its own session counts as under way for the end of the run,
    and a stop ends the run with each change staying in its session`;
  - `followups AC-13 decide: a change archived in its session frees its place, and on the event turn
    its report starts, the next ready line gets its line and waits for the owner's next message`;
  - `followups AC-13 background: the brief names the change, its worktree and branch, the coordinating
    session, the person's language, the title rule and the archive line, and has at least 80
    characters`;
  - `followups AC-13 lock agent: in a run with a session per change every hand-off of the coordinating
    session is refused and nothing is marked under way`;
  - `followups AC-13 lock stop: a change session to start on a typed turn is refused once, and every
    change in its own session lets the stop through`;
  - `followups AC-15 decide: on a turn nobody typed a start and a session start become one line each,
    said once, and on the owner's next turn they start`;
  - `followups AC-15 decide: the load eases on a turn nobody typed and the held change waits for the
    owner's next message with its line`;
  - `followups AC-15 next: a refused session start gives its line, records the turn as event and asks
    for no other start on that turn`;
  - `followups AC-15 next: --turn takes typed or event, refuses any other word (message and an empty
    word included) with exit 3 and the run file's bytes unchanged, and no --turn reads as event` (the
    last with a ready line and a free place in a run with a session per change: no `start`, one
    `roadmap-waits-turn` line);
  - `followups AC-15 decide: every withheld start has its line in the same decision or an announced
    one` (it walks every decision of the test's table, with each turn);
  - `followups AC-15 lock stop: after a decision on a turn nobody typed the stop is let through`;
  - `followups AC-15 status: a line left for the owner's next message reads so in the queue, and an
    open change with no session says it starts at the next message`;
  - `followups AC-13 skill: the session-per-change part names the tools, the list check, the session
    keys and the turn, and hands nothing` (the ToolSearch queries
    `select:mcp__ccd_session__start_session` and `select:mcp__ccd_session_mgmt__list_sessions`;
    `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }` and the match on `cwd` or a title
    ending in the id; `mcp__ccd_session__start_session` with the action's `input` exactly as given;
    `session-start` and `session-refused`; the report turn as `event`; and no `SendMessage`);
  - `followups AC-14 skill: a change session renames its title from the sessionTitle of each next`
    (the Loop's item names the ToolSearch query `select:mcp__ccd_session_mgmt__set_session_title`,
    the tool `mcp__ccd_session_mgmt__set_session_title` with `session_id` `"self"` and `title` the
    action's `sessionTitle`, the main thread, and no retry for the same title);
  - `followups AC-15 skill: the turn's two words, event when in doubt or on another session's note,
    and next first on a typed turn`.

  And in `change-loop.test.mjs`:
  - `followups F-4 guard: the task of a session started by another session makes a change run` (the
    fixture of D-16; `runOf` gives the change, and a real `guard.mjs edit` of a product file exits 2);
  - `followups F-4 guard: a command on a later line of any other message is no typed command`;
  - `followups AC-14 icon: every stage of both scripts has its icon, and an archived end is the
    archive's` (reads both `flow.json` files; the six icons of D-5; an unknown stage is null);
  - `followups AC-14 next: every action of change-loop next carries the icon of its stage and its
    session title`;
  - `followups AC-14 title: sessionTitle is the icon and the id, cut under 60 code points` (a short
    id, and a 70-character id giving 59 code points).

  Run them on the unchanged code as in task 1.1 and save the output to
  `openspec/changes/roadmap-coordinator-followups/proof/red-3.txt`. Check: every new test of this
  task fails there.
- [x] 3.2 Add the session per change and the turn in `roadmap-loop.mjs` (D-3, D-6):
  - the run file fields `changeSessions`, `startedSessions` and `turn` (`emptyRun`, `readRun`, `run`);
  - `run --change-sessions`, `next --turn`, and the `--after` keys `session-start` and
    `session-refused`;
  - the facts of `collectRoadmap`, the `own` state of `entriesOf`, the session mode of
    `decideRoadmap`, `sessionBackground`, and what `decide()` writes;
  - `readyText` for `session-start`, and RH6 in `roadmapAgentDecision`;
  - `sessionName`, and the `input` of `session-start` with its eight fields;
  - in `change-loop.mjs#MESSAGES`, `roadmap-session-started`, `roadmap-waits-turn` and
    `roadmap-waits-refused` in both languages.

  Check: the `followups F-3` test and the `followups AC-13` and `followups AC-15` decide, run, next,
  name, background and lock tests pass, and every `roadmap-loop` test passes unchanged.
- [x] 3.3 Add the session rows of the board (D-11 second paragraph): `queue.turn` and
  `running.no-session` in `MESSAGES` (both languages), and `boardOf`'s rows for `own` entries and
  open changes with no session. Check: the `followups AC-15 status` test passes, as do the
  `followups AC-1` test and every `roadmap-loop status` test.
- [x] 3.4 Add the stage icon (D-5): `stageIcon` and `sessionTitle` exported from `change-loop.mjs`,
  and `icon` and `sessionTitle` set by `nextAction` on every action (the second only with an icon);
  `roadmap-loop.mjs` imports `sessionTitle` for the start's `title`. Check: the three
  `followups AC-14` tests of `change-loop.test.mjs` pass, and every `change-loop` test passes
  unchanged.
- [x] 3.5 Read the started-session form in `guard.mjs#typedOf` (D-4): `STARTED_BY_SESSION` exported,
  and the `Task:` line's command. Check: the two `followups F-4` tests pass, and every `change-loop
  lock run` and `roadmap-loop lock run` test passes unchanged.
- [x] 3.6 Update `plugins/openspec/skills/devkit/SKILL.md` for D-3, D-5 and D-6 (D-15):
  - Roadmap step 1: the ToolSearch query `select:mcp__ccd_session__start_session` before `run`, and
    `--change-sessions` when it loads the tool; the opening paragraph and step 1 stay above both
    parts;
  - the two `###` parts, in this order: `### A session per change` (bullets, no item starting `5.`)
    and `### Every change in this session` (today's steps 2 to 5 and the closing paragraph, word for
    word);
  - in the first part, as D-3 (Skill) gives them: the turn rule (`typed` or `event`); `session-start`
    with the ToolSearch queries, `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }`
    and its match, `mcp__ccd_session__start_session` with the action's `input` exactly as given, and
    the two session keys; the end-of-turn report of a change session as an `event` turn;
  - the Loop's title item (D-5): `mcp__ccd_session_mgmt__set_session_title` with `session_id`
    `"self"` and the action's `sessionTitle`, loaded with `select:mcp__ccd_session_mgmt__set_session_title`;
  - the Never items;
  - nowhere the wake field of the start tool, any start field outside the action's `input`, or
    `SendMessage`.

  Then change T-9 and T-10 of D-14, each keeping its invariant:
  - T-9 (`change-loop skill: the sections of D-3 to D-9 and the modes of start`, `change-loop.test.mjs`):
    the skill keeps its sections and start modes and names no retired machinery (layer: skill text;
    suite: change-loop). `start_session` becomes `wake_when_done` in its refused pattern.
  - T-10 (`roadmap-loop skill: background hand-offs, one change per question, and the message that
    ends a turn`, `roadmap-loop.test.mjs`): where the host cannot start sessions, the coordinator
    hands each stage in the background, asks one change at a time and ends a turn with its message
    (layer: skill text; suite: roadmap-loop). Only its `roadmap` constant changes, to
    `sectionOf(md, '## Roadmap', '### A session per change') + sectionOf(md, '### Every change in this session', '## Status')`
    (the opening paragraph and step 1, which hold the `devkit-roadmap: <n>` and `run` with `stop`
    sentences, plus the part with today's steps 2 to 5); every assertion stays as written.

  Check: the three `followups ... skill` tests of task 3.1 pass, T-9 and T-10 pass, and every
  `roadmap-loop skill` and `change-loop skill` test passes, T-13 unchanged.
- [x] 3.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^followups" --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-13, AC-14 and AC-15 by tests, and F-3, F-4 of AC-11.

## 4. The ADRs, the documents, the release and the whole suite (AC-3, AC-13, AC-14, AC-15)

- [x] 4.1 Add `followups AC-3 run file: every field the run file holds is named in ADR 0013 decision 4,
  and every field named there is held` to `roadmap-loop.test.mjs`. It takes the keys of a run file
  written by `run --change-sessions`, `next --after <id>=session-start` and `hold` in a scratch
  repository, and the backticked names of item 4 of ADR 0013's `## Decision`. Run it and see it
  fail. Then rewrite decision 4 of `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`
  as D-13 gives it, and add its Note and the `- Amended by ADR 0014 (...)` header line. Check: the
  test passes, and `roadmap-loop docs: the documents follow` passes unchanged.
- [x] 4.2 Create `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md` as D-13 gives
  it. Its status is `accepted`, with an `Accepted by:` line quoting `approval.md`, only when
  `approval.md` records the owner's acceptance of ADR 0014; else stop and report. Add the Notes of D-13
  to `docs/adr/0010-openspec-as-the-harness.md` and
  `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, the `Amended by ADR 0014` header
  line to ADR 0011, and the 0014 entry to the `ADRs:` line of `openspec/config.yaml`. Add
  `followups ADR 0014: the documents follow`:
  - ADR 0014's headings, status, `Supersedes` and `Amends` lines, and its six icons;
  - ADR 0013's and ADR 0011's `Amended by` lines and Notes;
  - ADR 0010's Note;
  - the config line naming 0014.

  Check: the test passes.
- [x] 4.3 Update the documents as D-15 says: `docs/openspec-flow.md`, `docs/coordination-design.md`
  (line 28, section 10's Claude bullet with the text D-15 gives, keeping
  `each stage runs as a subagent in the` on one line, and the "Holding a start" paragraph),
  `docs/roles.md` and `README.md`. Change T-8, `change-loop docs: the design records the answers` in
  `change-loop.test.mjs` (invariant: the CI snippet pins the current release and no earlier one;
  layer: the documents; suite: change-loop): `/v0\.18\.0/` becomes `/v0\.19\.0/` and `v0.18.0` is
  refused. Extend `followups ADR 0014: the documents follow` to check:
  - the flow page has the paragraph "A session per change." and no longer says "(ready, waits for a
    place)";
  - `README.md`, `docs/roles.md` and `docs/coordination-design.md` each cite ADR 0014.

  Check: both tests pass; T-11 (`roadmap-loop docs: the documents follow`), T-12 (the other
  assertions of `change-loop docs: the design records the answers`) and T-14
  (`change-loop lock agent: the accepted packs are the ones docs/roles.md names`) pass unchanged;
  and `python3 scripts/check.py` passes.
- [x] 4.4 Release as D-15 says:
  - `plugins/openspec/.claude-plugin/plugin.json` (0.19.0);
  - `.claude-plugin/marketplace.json` (devkit-openspec 0.19.0, marketplace 0.23.0);
  - `CHANGELOG.md` (`## 0.23.0 — follow-ups of the roadmap coordinator`);
  - then `python3 scripts/gen-catalog.py`.

  Check: `python3 scripts/gen-catalog.py --check` passes.
- [x] 4.5 Owner-run task, done by the session that conducts this change (never `tdd-implementer`),
  after task 4.4. Run the marketplace validation with the desktop app's bundled Claude Code, as
  `CONTRIBUTING.md` says, into `${TMPDIR%/}/devkit-validate-roadmap-coordinator-followups/phase-4.txt`.
  Check: the record holds "Validation passed" and the release's commit; a failure is fixed in task
  4.4 and the run repeated.
- [x] 4.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-roadmap-coordinator-followups/phase-4.txt"` green, the whole suite run once as a background command; covers AC-3 and every acceptance criterion's tests together, with every existing test passing.

## 5. The first real run, recorded (AC-11, AC-12, AC-13, AC-14, AC-15)

- [x] 5.1 Owner-run task, done by the conducting session (never `tdd-implementer`). Write
  `openspec/changes/roadmap-coordinator-followups/proof/live/records.txt` with this run's records, in
  order and with their times:
  - before the move: from the coordinating session's transcript, every output of `roadmap-loop.mjs`
    `run`, `next`, `wait`, `hold` and `reply`, and every `devkit-end:` line;
  - the move of 2026-11-21: each session the coordinating session started for a change, with its
    title, folder and the time, and the app's list of sessions showing each one nested under the
    coordinating session;
  - after the move: from each change session's transcript, every output of `change-loop.mjs` `next`
    and `reply`, every title rename of this change's session with its time and the stage it named,
    and the rename of the `merge-setup-field-fixes` session from 📝 to 🛠️ when its code stage began;
  - the output of `node plugins/openspec/hooks/roadmap-loop.mjs status --lang en --load-limit 80`, run
    now;
  - a copy of `<git common directory>/devkit/roadmap-run.json`.

  End the file with an index naming the times of the records that show each item:
  - AC-12: the selection of the two ready changes; a change going on while the owner answers the
    other's questions; several ends handled one after another; a change reaching the delivery part;
    the many-archived runs (task 5.2);
  - AC-13: each change in a session of its own, nested, its questions and approvals asked there;
  - AC-14: this session's title at each stage change, and the `merge-setup-field-fixes` rename;
  - AC-15: a change that became ready on a turn nobody typed, and what the owner saw.

  An item not reached by this change's verification is named as "after verification: in the retro".
  Check: every item has a record or that line.
- [x] 5.2 Owner-run task, done by the conducting session. Write
  `openspec/changes/roadmap-coordinator-followups/proof/many-archived.txt` with the output and elapsed
  time of three calls, all from this tree's `plugins/openspec/hooks/`: `roadmap-loop.mjs status`,
  `run` with `2` on standard input and a scratch session id, and `change-loop.mjs start --lang en`.
  Run them:
  - on this repository;
  - on a scratch project in `${TMPDIR%/}/devkit-many-archived-followups`, built by a script kept in
    the session's scratchpad and never committed. It is a git repository with `schema: devkit`, the
    pack's schemas, 150 archived changes `old-1` to `old-150` under `openspec/changes/archive/`, a
    roadmap with their 150 lines ticked and two unticked lines with no `after:`, all committed.

  Check: the scratch board counts 150 archived; no `old-<n>` is listed as open, unfinished or in the
  queue; and `run` starts the two ready lines.
- [x] 5.3 Complete the "Field defects of this run" table of `design.md` (AC-11): one row per defect
  the run showed up to this change's verification, each with its plan section, the owner's renewed
  approval in `approval.md` when it came after the first approval, and its red test's name in
  `proof/red-<n>.txt`. Check: no row lacks a plan section, an approval or a red test.
- [x] 5.4 Gate: `test -s openspec/changes/roadmap-coordinator-followups/proof/live/records.txt && test -s openspec/changes/roadmap-coordinator-followups/proof/many-archived.txt && grep -q "150 archived" openspec/changes/roadmap-coordinator-followups/proof/many-archived.txt && python3 scripts/check.py` green; covers AC-11, AC-12 and the live part of AC-13, AC-14 and AC-15.

## Workflow follow-up

- After the merge, tag `v0.19.0` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro. The retro records what the run shows after this change's verification:
  this change's merge and archive, the end of `merge-setup-field-fixes`, the first session the script
  itself starts for a change, and any start left for the owner's next message. The archive ticks the
  round 18b line of `openspec/roadmap.md`.
