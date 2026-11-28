<!-- devkit-stage tasks result=passed attempt=7 commit=db6342b8aa8a1ef653e7729f1f1eb883c68419ed -->
# Tasks

Change: `helper-conductor` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base: `origin/main` at
`6f03a57` (the branch was opened on it and has merged nothing yet) · PRD / tech spec: n/a
(`proposal.md`, `design.md`, `requirements.md` at attempt 7, `decisions.md`, `release.md`, the phase 1
proof under `proof/`). This is the revision phase 1's decision point asked for (`proof/decision.md`).

"The record" is `docs/adr/helper-conductor.md`, cited `ADR [helper-conductor]` everywhere outside
test and fixture files; no task numbers it, renames it, bumps a version, writes a `CHANGELOG.md`
line or moves a CI pin line: the delivery writes them at the merge (`release.md`, ADR 0034). No test
or fixture cites the record (they are outside the citation rewrite).

Work only in this change's worktree, on its branch. Every name, text, field, rule and test is in
`design.md` (D-1 to D-25); the implementer copies them and makes no design choice. Test first in
every task that adds a test: write it, see it fail on the code before the task, then make it pass.
Before a test is changed, its commit names its invariant, the layer that owns it and the suite it
lives in (CLAUDE.md); D-15's table gives the class of each pinned test. A task that adds, moves or
removes a script or a test edits `scripts/test-map.json` in the same commit. Leave no scratch file in
the tree, and end every task with `git status --short`.

Every gate is one backticked command, run as written; the flow runs each `&&` part on its own. The
selective part is its own `pass` row in `evidence.md`, with the run's `selected` lines and its `suite:`
line (CLAUDE.md). Run each whole-suite run (6.7) as a background command of the tool, never with a
shell `&`, with no other suite on the machine, and record `uptime` beside it.

Phase 1 is a decision point. Probe 2 has run (`proof/p2-result.md`) and its answers are settled
facts of D-1: prompt form S-B with no entry skill, the envelope, every hand-off in the background,
the review round's `workflow` path, a run's status that is no lock. Phases 2 to 6 start once task
1.4 has recorded them in `proof/decision.md` and the plan's approval of this revision is recorded.
Task 3.6 is a second decision point, before phase 4. A stop-and-revise case of D-1 sends the plan back
to the planner, the readiness review and the owner's approval before anything else runs.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `first-real-run` | 1.1 to 1.4, 1.8, 1.9, 3.6 |
| AC-2 | `one-typed-command` | 2.4, 4.2, 6.1 |
| AC-3 | `empty-tick-refused` | 2.17, 3.1, 3.6, 6.1 |
| AC-4 | `tick-claims-one` | 2.5, 2.6, 4.1, 6.1 |
| AC-5 | `resume-from-files` | 2.5, 2.6, 6.2 |
| AC-6 | `no-owner-box` | 2.6, 3.3, 4.2, 4.3, 6.1 |
| AC-7 | `waits-for-owner-one-place` | 2.6, 2.7, 2.9, 4.2, 4.5, 6.1 |
| AC-8 | `delegation-quoted` | 2.2, 2.7, 3.4, 4.4, 6.3 |
| AC-9 | `task-ends-blocked` | 1.2, 2.4, 2.5, 2.7, 3.1, 4.2, 4.5, 6.1 |
| AC-10 | `sessions-removed` | 5.1 to 5.5, 6.6 |
| AC-11 | `places-cap` | 2.1, 2.5, 3.1, 3.6, 6.1 |
| AC-12 | `adr-recorded` | 1.10, 4.1, 4.3, 5.6 |
| AC-13 | `compozy-untouched` | 5.7, 6.7 |
| AC-14 | `request-file-channel` | 2.3, 2.7, 3.4, 6.3 |
| AC-15 | `periodic-check` | 2.4, 2.5, 3.6, 6.2 |
| AC-16 | `approval-summary` | 2.3, 2.7, 4.4, 6.3 |
| AC-17 | `sibling-order` | 2.8, 4.4, 6.3 |
| AC-18 | `train-dispatch` | 2.9, 4.2, 6.4 |
| AC-19 | `open-precheck` | 2.10, 4.2, 6.4 |
| AC-20 | `escalation-rehand` | 2.11, 4.2, 6.4 |
| AC-21 | `machine-split` | 2.12, 6.4 |
| AC-22 | `test-capacity` | 2.14a, 2.14, 2.15, 4.2, 4.6, 6.4, 6.5 |

## 1. The real run and the decision point (phase 1)

- [x] 1.1 Conductor: set up the probe project of D-1: `/var/tmp/devkit-hc-probe/project` (a clone of
  this branch's head), `/var/tmp/devkit-hc-probe/bin/probe-gate.mjs` and the project's
  `.claude/settings.local.json` with the probe `UserPromptSubmit` hook and `DEVKIT_HOOK_LOG`. Nothing
  of it is committed. Check: `git -C /var/tmp/devkit-hc-probe/project status --short` lists only the
  settings file; this worktree's `git status --short` is clean.
- [x] 1.2 Conductor: P-0, the delete before any create: create `devkit-hc-probe-0`, remove it, list.
  Write `openspec/changes/helper-conductor/proof/p0-delete.md` (the tool names, the calls, the list
  before and after). Check: the last list shows no `devkit-hc-probe-` task; on no way to remove a task,
  stop at 1.9 with the stop-and-revise case.
- [x] 1.3 Coordinator's session: probe 2 on the owner's Mac (done 2026-11-28:
  `openspec/changes/helper-conductor/proof/p2-result.md`, run `local_b35eeb53-…`, status
  `succeeded`). A one-time task
  `devkit-helper-conductor-probe-2`, working folder `/Users/kauesantos/Documents/devkit`, with the
  prompt of `openspec/changes/helper-conductor/proof/probe-2-prompt.md` verbatim (the envelope, the
  slash command, the nested agent, the Workflow, the hooks, the overlap). Write
  `openspec/changes/helper-conductor/proof/p2-result.md` with the result file's lines verbatim and,
  from `list_task_runs`, the run's status and times and whether it read `running` while step 6's
  background `sleep` lived. The task is a one-time task: it is not deleted by any session (the owner
  removes it with one click, `proof/p0-delete.md`). Check: the file holds every key of the prompt's
  six steps (a `fail:` value counts) and the run's status line.
- [x] 1.4 Conductor: append to `proof/decision.md` a section "Probe 2" naming, each with its
  `p2-result.md` line, the values D-1 settled: the envelope (header, tag, the line
  `devkit-roadmap-tick: <root>`) for D-4 and D-11, prompt form S-B with no entry skill
  (`slash_command: no`), the review round's `workflow` path (`workflow_ran: yes`), every hand-off in
  the background (`nested_agent`), no stop hook refusal seen (`stop_hook_seen: none`), and a run's
  status that is no lock (`list_task_runs`). Check: each of the six is named with its source line.
- 1.5 to 1.7: removed in the revision of 2026-11-28; their probes are task 1.3 (P-2, P-3, P-4a,
  P-4b, P-6's background) and task 3.6 (P-5, P-6's two runs, the cron, P-7).
- [x] 1.8 Conductor: remove every probe task (P-0's tool), list, and delete
  `/var/tmp/devkit-hc-probe` only after checking the session created it. Append the final list to
  `proof/p0-delete.md`. Check: no `devkit-hc-probe-` task in the list.
- [x] 1.9 Conductor: write `proof/decision.md` (D-1): Helper A, Helper B or stop-and-revise, S-A or
  stop-and-revise, the envelope regex D-4 will use, the cron, the remove tool and the notification
  tool, each with the proof file and line it rests on. Check: every case of D-1's list is named true
  or false with its source.
- [x] 1.10 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (it
  selects no test: only `openspec/` files changed); `proof/decision.md` names the prompt form and the
  review round's path from `proof/p2-result.md` (task 1.4); the record holds this revision's decisions
  (the adr-author's revision of decisions 1, 3, 9, 10 and 13 and the ADR 0008 and ADR 0022
  amendments), and the plan's approval of this revision is recorded. AC-1 (in part), AC-12 (in
  part).

## 2. The bookkeeping and the verbs (phase 2)

Order (coordinator's word of 2026-11-28): the tasks that only add files run first, before the change
`multi-roadmaps` merges: 2.2, 2.3, 2.14a and 2.17, then the gate 2.18. They edit none of the files
`multi-roadmaps` edits (`guard.mjs`, `run-file.mjs`, `roadmap-loop.mjs`, `change-loop.mjs`,
`deliver-check.mjs`, `conduct-check.mjs`, `status-line.mjs`, the devkit and ship-change `SKILL.md`,
`docs/openspec-flow.md`); they only import from them. Every other task of phases 2 to 6 waits for that
merge and the coordinator's word.

- [ ] 2.1 The run file (D-2, D-3): in `plugins/openspec/hooks/run-file.mjs`, `emptyRun` and `readRun`
  with `task`, `ended`, `queue`, `claims` (`{ session, at, heartbeat }`), `holds` (`elsewhere` with
  its 30-minute `recheckAt`, `delegated` with its gate and quote), `ownerWaits` (the `@train` and
  `@run` keys kept), `train` (its `hold` with `recheckAt`); the removed fields not read;
  `CLAIM_STALE_MS`; `tickReady(run, facts, now)` with every rule of D-3 (`no-task` after the end,
  `stopping` and `stopping-busy`, `archived` holds counting for `done`, rule 4a with `train.hold`);
  `commonDirOf` and `localRunFilePath` in `plugins/openspec/hooks/guard.mjs`, re-exported by
  `run-file.mjs`, and `localFacts(root, run, env)` with `node:fs` only, `heldPlaces` the
  `run.occupied` ids that are open, and the prune of `run.occupied` to the open ids that `tick` and
  `helper-next` run before `placeDecision`; `limitOf` and `DEFAULT_LIMIT` moved from
  `roadmap-loop.mjs` and re-exported there. The move of 2.17's interim copy (D-4): `commonDirOf`
  and `localRunFilePath` go from `tick-gate.mjs` to `guard.mjs`, `localFacts` and `tickReady` to
  `run-file.mjs`, and `tick-gate.mjs` deletes its copy, with its minimal copies of `limitOf`,
  `DEFAULT_LIMIT`, `isChangeId` and `CLAIM_STALE_MS` and its building of the run from the parsed
  object, and gets the four functions and `readRun` by its dynamic `import()` after the raw match
  (D-4), `limitOf` coming with `run-file.mjs`, so one copy is left. The hook still reads and parses
  the run file itself before it calls the moved functions: a missing file reads as no run (`no-task`,
  block), a file that exists but does not parse to a JSON object prints nothing, and only a missing
  file or one that parses goes on to `readRun`, `localFacts` and `tickReady` (D-3, D-4); so the
  process cases of `tick-gate.test.mjs` pass unchanged, and its unit cases change only their import
  line to `guard.mjs` and `run-file.mjs` and pass with their bodies unchanged. Tests in the new `plugins/openspec/hooks/roadmap-loop-conductor.test.mjs`
  (`conductor AC-4 `, `AC-11 `): each D-3 rule, a broken run file read by `readRun` as `emptyRun()`
  (`no-task` for the `tick` verb, D-3), a non-id queue entry; on one
  fixture repository (a main checkout, two worktrees, one removed folder) `localRunFilePath` equals
  `runFilePath` from the main checkout and from a worktree, `localFacts`' `open` equals the change
  folders of `listWorktrees`' paths, and it reads the same with a `PATH` whose `git` exits 1;
  `heldPlaces` counts an `occupied` entry of an open change with no claim, and leaves out one of a
  change no longer open; with an `occupied` entry of a removed change and one place, `placeDecision`
  after the prune gives the place to the next change, as the hook's `tickReady` does. The existing tests that import `limitOf` from `roadmap-loop.mjs` pass
  unchanged. Map: the new test linked to `run-file.mjs` and `roadmap-loop.mjs`, and marked `slow`;
  `run-file.mjs`'s list gains `tick-gate.test.mjs` (the hook calls its functions).
  Check: `node scripts/test-suite.mjs --test-name-pattern="^(conductor |roadmap-loop setting:|tick-gate )"` passes.
- [x] 2.2 The standing answers (D-8): `plugins/openspec/hooks/standing-answers.mjs` and
  `plugins/openspec/hooks/standing-answers.test.mjs` with the seven cases of D-15. Map: a `files` key
  for the module. Check: `node scripts/test-suite.mjs --test-name-pattern="^standing "` passes.
- [x] 2.3 The request files (D-17, D-19): `plugins/openspec/hooks/request-file.mjs` (write, parse, the
  12-line summary refusal, the answer file, the 200-character cut of an approval's words) and
  `plugins/openspec/hooks/request-file.test.mjs`. Map: its `files` key. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^request "` passes.
- [ ] 2.4 The typed command and the task (D-5): `run` records the queue and prints `install-task`
  (only `run` prints it); `--after task=installed|exists|refused`; a typed `run` clears `ended` and
  the `@run` line; `stop` sets `stopping`, and with no live claim records the end at once (D-6 rule
  3's record) and prints `roadmap-ended-stopped` with the `@run` line's words; the replies
  `roadmap-task-left` (D-9's new words) and `gate.task-left` in both languages of `change-loop.mjs`
  (grep the tests for the message table's key lists first, CLAUDE.md); the task id, the `*/5` cron
  (or `decision.md`'s) and D-5's two-line S-B prompt, with the task id `devkit-roadmap-tick-…`; `--change-sessions`,
  `--cron` and `--after task=deleted` refused as unknown. Tests `conductor AC-2 `, `AC-9 `: typed
  twice gives one `install-task`; typed after an end with the old task listed gives `install-task`
  whose `exists` report records the same id (no second task); `tick` and `next` never print
  `install-task`; stop with no live claim records `ended` and `task: null`; no decision of `run`,
  `stop` or `tick` names a delete, an update or a run of a task. Check: as in 2.1.
- [ ] 2.5 The tick, its claim and its sweep (D-6, D-18): `tick --session`, `tick-recorded`; the
  sweep; the claim under `updateRun` (`{ claim: { change, root } }`, no model and no brief); the stale
  takeover; the places cap; rule 3's end (`ended`, `task: null`, the `@run` line) for `done` and for
  `stopping`, and `stopping-busy`. Tests `conductor AC-4 `, `AC-5 `, `AC-9 `, `AC-11 `, `AC-15 `: two
  items one claim, a live claim left alone, every place with a drive in flight, two `tick` processes
  at once leave one claim, a stale claim taken over, a merged pull request swept; the last archive
  gives `roadmap-ended-done` with `ended.why` `done`, `task: null` and one `@run` line of gate
  `task-left` naming the task id; a stopping run with no live claim gives `roadmap-ended-stopped`
  the same way, with a live claim `{ end: null }`, and with a stale claim the end; after the end
  `tickReady` gives `no-task` and `tick` replies `roadmap-no-run`. Check: as in 2.1.
- [ ] 2.6 The drive's verbs (D-7, D-14): `helper-next` from `session-next`'s place, load, dependency,
  merge-base and budget logic, with D-7's table of ends (a `blocked` end writes its hold and the
  owner line of gate `decision`; an `archived` end its hold and no line; a `delegated` end its hold
  and no gate file written; `run.stopping` the `stopping` end that releases the claim);
  `helper-release`; every `agent` action carrying its stage's model as a lone change's does (no
  `helperModel`). Tests `conductor AC-7 blocked`: the blocked end's line and hold, `answered --gate
  decision` deleting both, the next `tick` claiming the item; an archived end with no line, and the
  last archived end making `tickReady` give `done`; `conductor AC-9 stopping`: a `helper-next` call on
  a stopping run releases the claim and hands nothing. Rewrite the
  class M tests of D-15 that drive `session-next` onto `helper-next` (in
  `roadmap-loop-followups.test.mjs`, `roadmap-loop-upfront.test.mjs`, `change-loop-remote-state.test.mjs`,
  `change-loop-declared.test.mjs`), each keeping its invariant. Check: as in 2.1, and
  `node scripts/test-suite.mjs --test-name-pattern="^upfront AC-(8|9|10) "` passes.
- [ ] 2.7 The owner's place (D-8, D-17, D-19): `request`, `answer`, `owner-waits [--session]`,
  `owner-watch`, `answered` (`--change @run --gate task-left` included), `pushed`, `record-delegated`;
  a grill line holds its questions; an approval line its summary; the `@run` line shown once and
  pushed once. Tests `conductor AC-7 `, `AC-8 `, `AC-9 line`, `AC-14 `, `AC-16 `: `owner-watch` exits
  on a new `@run` line and when `task` is null; `owner-waits --session` marks it shown. Check: as in
  2.1.
- [ ] 2.8 The siblings (D-20): `siblings --change`, and the `- Siblings:` line the approval adds. Tests
  `conductor AC-17 `, with a test that `deliver-check.mjs` answers the same with and without the line.
  Check: as in 2.1.
- [ ] 2.9 The train's claim (D-21, its CLI part): the `boarded` hold, `@train` readiness (rule 4a with
  `train.hold`), the train's claim (`{ claim: { train: true, root } }`), and `train-end` with every row of D-21's table of ends; `answered`
  and `pushed` with `--change @train`. Tests `conductor AC-18 `: a boarded change gives a train claim
  before any change; no second train while one is live; a departed train's `github` hold dispatches
  nothing before its `recheckAt`; an owner end writes `ownerWaits['@train']` (gate `merge`, and gate
  `decision` for `base-red`) and dispatches nothing until `answered`; a left change with `why: red`
  gets `blocked` with `train-red` and its line, one with `why: conflict` loses its hold and is
  claimable. Check: as in 2.1.
- [ ] 2.10 The check before an opening (D-22): `precheck`, `skip`. Tests `conductor AC-19 `: a parked
  branch on a local bare `origin` fixture is reused, a branch with no folder is `branch-taken`, a skip
  records `skipped` and its request. Check: as in 2.1.
- [ ] 2.11 The escalation's re-hand (D-23): the `escalated` hold, its request, readiness on the
  answer file, the plain `helper-next`. Tests `conductor AC-20 `. Check: as in 2.1.
- [ ] 2.12 The machines (D-13, conservative): in a conducted run `open` never takes `--machine` and
  a loaded machine holds the item; the push after `open` (`push --what open`); the `elsewhere` hold;
  the takeover of a released or stale claim by a fetch and a worktree from the pushed branch;
  `remoteSessionStartOf` no longer called. Tests `conductor AC-21 ` with two clones of one bare
  `origin` in the test's folder: with the machines setting listing `avel` and this machine loaded,
  the item is held `load` and never opened for `avel`; with this machine holding more open changes
  than `avel`, the item opens here; the claim naming `avel` gives this machine an `elsewhere` hold
  with `recheckAt` 30 minutes, no worktree, no drive and no `occupied` entry, `tickReady` not ready
  before `recheckAt`; at `recheckAt` with the claim released the tick claims it and the worktree is
  added from `origin/<id>`. The class M tests of D-15 that place a change on `avel` in a run with a
  task are rewritten to the same rule (the legacy run file with no task keeps ADR 0020's placement).
  Check: as in 2.1.
- [ ] 2.13 ADR 0013's Note (D-2) and the class M test "followups AC-3 run file" reading it. Grep the
  tests for `0013-the-roadmap-coordinator-is-the-owners-session.md` first (D-15's pin rule). Check:
  `node scripts/test-suite.mjs --test-name-pattern="^followups (AC-3|ADR 0014) "` passes.
- [x] 2.14a The test-slot ledger, add-only part of D-25: the new
  `plugins/openspec/hooks/test-slots.mjs` with the exports D-25 names ("The ledger module's
  contract": `SLOTS_LOCK`, `SLOT_STEP_MS`, `slotsPaths`, `readSlots`, `tryTakeSlot`, `releaseSlots`,
  `waitForSlot`), the ledger under `withLockFile` imported from `change-loop.mjs`, where it lives
  today, the dead-pid drop and the train's `trainWaiting`, which holds the gates as well as a change's
  whole suite. This task owns the module and every ledger case; 2.14 adds none. Tests first, seen
  failing, in the new `plugins/openspec/hooks/test-slots.test.mjs` (`capacity AC-22 `), driving the
  module's exports with `DEVKIT_STATE_DIR` a fixture folder, `gates` passed in, an injected `alive`
  and `sleep` and a recording `log`: a second whole suite gets `wait` (`devkit-test: waiting for a
  whole-suite slot (<owner>)`) while the first holds the slot and takes it after `releaseSlots` of
  the first's pid; a train's suite waiting (`trainWaiting` written with its pid) keeps a change's
  suite from taking the slot, and the train takes it first once the slot is free; while the train's
  suite runs or waits a new gate gets `wait` with the line `devkit-test: waiting for the train's
  suite`, and takes a slot after the train's entries are released; the train's suite waits for the
  gates in flight (`devkit-test: the train waits for <n> test runs to end`) and takes the slot when
  they are released, clearing its `trainWaiting`; a third gate waits at `gates` 2 (`devkit-test:
  waiting for a gate slot (2 of 2 in flight)`); `waitForSlot` logs its first wait line once and
  nothing on later rounds, and sleeps `SLOT_STEP_MS` (15 seconds) between rounds; a dead pid's slot
  is taken (with `alive` the default `process.kill(pid, 0)`, on a child that has exited); a ledger
  that does not parse, and a missing one, read as empty; two clones (two `clone` roots) on one
  `DEVKIT_STATE_DIR` share the whole-suite slot; `releaseSlots(pid)` removes that pid's `suite`,
  gate and `trainWaiting` entries and no other. The `test-run` verb, `capacity` in the run file, the
  settings, `DEVKIT_TEST_CONCURRENCY` and the brief's sentence are 2.14's. Map: a `files` key for
  `test-slots.mjs` linking `test-slots.test.mjs`; `change-loop.mjs`'s list is left as it is, because
  the test-map-hub-links AC-3 test (`plugins/openspec/hooks/test-suite.test.mjs:1171`) pins it to its kept readers. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^capacity AC-22 "` passes.
- [ ] 2.14 The test capacity (D-25), the rest once 2.14a is done: `capacity` in `emptyRun`/`readRun`
  with `gatesOf` and `concurrencyOf` in `plugins/openspec/hooks/run-file.mjs`; `run --test-gates
  --test-concurrency`; the two `userConfig` settings in `plugins/openspec/.claude-plugin/plugin.json`;
  the `test-run` verb of `roadmap-loop.mjs`, which calls 2.14a's `waitForSlot` with
  `capacity.gates` (D-25's defaults when `capacity` is null) and `releaseSlots` and creates no other
  ledger code; the ceiling of `DEVKIT_TEST_CONCURRENCY` in `scripts/test-suite.mjs`; the cap sentence
  `helper-next` appends to every `agent` brief. Tests first, seen failing: the verb's cases extend
  `plugins/openspec/hooks/test-slots.test.mjs` (`capacity AC-22 test-run `), run as a process on a
  fixture clone with `DEVKIT_STATE_DIR` a fixture folder: no run file or no `task` runs the command
  at once with no slot; with a run file whose `task` is set it takes its slot, the child sees
  `DEVKIT_TEST_CONCURRENCY=<concurrency>`, and the child's exit code is `test-run`'s; `SIGTERM` to
  `test-run` frees its slot (the ledger has no entry of its pid after it exits); no `--`
  or an empty command exits 3 with nothing taken. `conductor AC-22 ` in
  `roadmap-loop-conductor.test.mjs` (`run` records the defaults, the settings' values, and the
  defaults for `0`, `x` and an unfilled `${user_config.test_gates}`; a typed `run` again rewrites
  `capacity`; every `agent` action of `helper-next` carries the sentence with `--concurrency=<c>`,
  and a lone change's `next` brief does not; a change at its review waiting on GitHub with no claim
  holds a place, a helper at a grill holds none); `suite-capacity AC-22 ` in
  `plugins/openspec/hooks/test-suite.test.mjs` (`DEVKIT_TEST_CONCURRENCY=1` with `--concurrency=2`
  runs one file at a time and the `suite:` line reads `concurrency 1`; `0`, `x` and empty are
  ignored). The class E rows of D-15 for `roadmap-loop setting: the load_limit user setting` and
  `test-suite.test.mjs`'s `BLANK_ENV` in the same commit. Map: `roadmap-loop.mjs`'s list gains
  `test-slots.test.mjs`, and `plugin.json` links `roadmap-loop-followups.test.mjs` (the
  `test-slots.mjs` key is 2.14a's). Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(capacity |conductor AC-22 |suite-capacity |roadmap-loop setting:)"`
  passes.
- [ ] 2.15 The `openspec/`-only pull request (D-25): `conductedOf(root)` in
  `plugins/openspec/hooks/guard.mjs` (`node:fs` only, over `localRunFilePath`); in
  `plugins/openspec/hooks/deliver-check.mjs` `collectState` leaves the `train` facts out and records
  `openspecOnly: true` for a conducted run whose open pull request's files (`prFiles`) are all under
  `openspec/`, at the archive (`:3099`) and the change (`:3152`) sites. Tests first, seen failing, in
  `plugins/openspec/hooks/delivery-train.test.mjs` (`train AC-22 openspec-only `), on its train
  fixtures with a run file whose `task` is set: an archive pull request of `openspec/` files only
  gives `enable-auto-merge` under `trunk-auto` and `archive-pr-ready` under `trunk`, never
  `boarded`; `boardedSet` leaves it out; a change pull request with a file outside `openspec/` still
  boards; with no run file, a run file with no `task`, or one that does not parse, the archive boards
  as before. Grep the delivery-train and deliver-check tests for `boarded` on an archive first; a
  test that pins the archive's boarding in a fixture with a run file is a row of D-15 edited in this
  commit. Map: `guard.mjs` and `deliver-check.mjs` already link `delivery-train.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(train AC-22 |delivery-train )"` passes.
- [ ] 2.16 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; AC-2,
  AC-4, AC-5, AC-7, AC-8, AC-9, AC-11, AC-14 to AC-22 (their code).

- [x] 2.17 The tick's hook module, add-only part of 3.1 (D-4): `plugins/openspec/hooks/tick-gate.mjs`
  with the interim home of D-3's functions (D-4, "The interim copy"): `commonDirOf`,
  `localRunFilePath`, `localFacts` and `tickReady`, exported from `tick-gate.mjs` itself with D-3's
  rules and signatures. It reads the run file itself with `node:fs` and builds the run from the
  parsed object with D-2's type rules for the fields D-3 reads: a missing run file reads as no run, so
  `tickReady` gives `no-task` and the hook blocks; a run file that exists but does not parse to a JSON
  object (empty, not JSON, an array) prints nothing (D-3's last paragraph, D-4). Since `localFacts`
  and `tickReady` are synchronous, the module holds its own unexported minimal copies of what they
  call: `limitOf` and `DEFAULT_LIMIT` (the same lines as `roadmap-loop.mjs:62-71`), `isChangeId`
  (as `guard.mjs:1503`) and `CLAIM_STALE_MS` with its `DEVKIT_CLAIM_STALE_MS` override (D-2); it has
  no import from `roadmap-loop.mjs` or `run-file.mjs`. Its imports follow D-4: Node built-ins at the
  top, and `findRoot` and `optedIn` from `guard.mjs` by the dynamic `import()` awaited on the hook's
  asynchronous main path after the raw match (no synchronous function calls them). Task 2.1 moves the
  four functions to their D-3 homes, deletes the minimal copies and the building of the run, and
  leaves one copy. Tests first, seen failing, in the
  new `plugins/openspec/hooks/tick-gate.test.mjs` (`tick-gate AC-3 `): the unit cases on fixture run
  files, each D-3 rule of `tickReady` (`no-task` before the task and after `ended`, `stopping-busy`
  with a live claim and with a live `train.claim`, `stopping`, `done` with `archived` and `skipped`
  holds, `helpers-full`, each hold kind of rule 5, rule 4a with `train.hold`, `nothing-ready`, a
  non-id queue entry skipped), and on one fixture repository (a main checkout, two worktrees, one
  removed folder) `commonDirOf` from the main checkout and from a worktree equal to the real
  `git rev-parse --git-common-dir` (the one case that runs `git`), `localRunFilePath` null
  with no common git folder, `localFacts`' `archived`, `open` (the removed folder left out) and
  `heldPlaces` (an `occupied` entry of an open change counted, one of a change no longer open left
  out); and the process cases, the hook run with a payload on stdin, with the envelope of
  `proof/p2-result.md` and again with the bare stored prompt, on that fixture repository and with a
  `PATH` whose `git` and `gh` stubs exit 1: every case 3.1 lists except the held place checked
  against the conductor test's `tick`, which needs the `tick` verb and stays in 3.1. No `hooks.json`
  entry yet (3.1 adds it), so nothing of the repository fires the hook. Map: a `files` key for
  `tick-gate.mjs` linking `tick-gate.test.mjs`, and `guard.mjs`'s list gains `tick-gate.test.mjs`
  (the module imports from it; it imports nothing from `roadmap-loop.mjs`). Check:
  `node scripts/test-suite.mjs --test-name-pattern="^tick-gate "` passes.
- [ ] 2.18 Gate of the add-only tasks: `node scripts/test-suite.mjs --own-files --concurrency=2 && python3 scripts/check.py`
  green, its `selected` lines recorded. AC-3 (the hook's part), AC-6 and AC-14 (the modules' part),
  AC-22 (the ledger's part).

## 3. The tick's hook, the locks and the blocked firing (phase 3)

- [ ] 3.1 The tick's prompt hook (D-4), what 2.17 and 2.1 left: the first `UserPromptSubmit` entry
  of `plugins/openspec/hooks/hooks.json` naming `plugins/openspec/hooks/tick-gate.mjs` (built-ins at
  the top, `guard.mjs` and `run-file.mjs` by dynamic `import()` after the raw match; `readRun`,
  `localRunFilePath`, `localFacts`, `tickReady` (and `limitOf` with `run-file.mjs`) from their D-3
  homes since task 2.1, which moved `commonDirOf` and the other three out of `tick-gate.mjs` and
  deleted its minimal copies; the hook's own read and parse of the run file before `readRun` kept,
  D-4), and the last case of
  `plugins/openspec/hooks/tick-gate.test.mjs`: a held place blocks as the conductor test's `tick`
  claims nothing on the same run file. The cases 2.17 wrote, listed here as the hook's whole
  contract, pass unchanged: run as a
  process with the envelope of `proof/p2-result.md` (`envelope:`, `envelope_tag:`: the scheduler's
  header, the `<scheduled-task name="devkit-roadmap-tick-…" file="…">` tag, the host's sentence,
  the stored prompt) as the fixture payload's `prompt`, and again with the bare stored prompt, on a fixture repository with a main checkout and a
  linked worktree, and with a `PATH` whose `git` and `gh` stubs exit 1 in every case: the envelope
  with nothing ready blocks (from the main checkout and from the worktree), `stopping-busy` blocks,
  `no-task` blocks (a run file with no `task`, and a missing run file), a run file with `ended` set blocks with the reason naming the deletion in the
  app; an item ready, done and stopping with no live claim print only the tick's note (its
  `additionalContext` naming the payload's session id, the hook's own `CLAUDE_PLUGIN_ROOT` paths, the
  settings from `CLAUDE_PLUGIN_OPTION_*`, and an unset setting left out of the call); any other
  prompt, a tag of another task's name, a first line naming another root, a run file that exists
  but does not parse to a JSON object (empty, not JSON, an array), no common git folder and another root print nothing; the envelope run ends within the hook's 10-second
  timeout, its time recorded in the test's message. Map: `hooks.json`'s list links
  `tick-gate.test.mjs` (the `tick-gate.mjs` key and `run-file.mjs`'s link are 2.17's and 2.1's).
  Check: `node scripts/test-suite.mjs --test-name-pattern="^tick-gate "` passes.
- [ ] 3.2 The stop and hand-off locks of a conducted run (D-11): `roadmapStopDecision` with the
  tick's stop rule (a live claim of its session with no hold and no background task refused once
  naming `helper-next` and `helper-release`; a background stage agent or review round allowed, its
  notice waking the session; a drive ended at a delegated gate allowed; nothing claimed allowed; a repeat allowed; the
  typed session allowed with `task` or `ended`), and `roadmapAgentDecision` (a role of the claimed
  change's script and `devkit-core:codebase-researcher` with the claimed change's brief allowed;
  another change's brief, a general-purpose agent and any hand-off with no live claim refused; no
  helper agent allowed). Tests `conductor locks ` for each scenario of "A conducted run's sessions
  stop as its ticks need" and the hand-off scenarios of "In a roadmap run a hand-off names its
  change"; the class K `roadmap-loop lock stop: RS…` and `lock agent: RH…` tests pass unchanged.
  The run detection of a tick's session (D-11): `roadmapRunOf` reads the first user message's
  scheduler header, `devkit-roadmap-tick-…` tag and `devkit-roadmap-tick: <root>` line as a typed
  `/devkit roadmap tick`; tests `conductor locks envelope `: probe 2's first message plus the
  `devkit-roadmap:` line is a run in `roadmap tick`; without that line, with another task's tag,
  another root, the line outside the tag, or the text typed in a later message, it is no run; an
  unreadable transcript is no run; the AskUserQuestion refusal of 3.3 holds in that session. No
  `Skill` entry is added. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(conductor locks|roadmap-loop lock) "` passes.
- [ ] 3.3 No question box (D-10): the `PreToolUse` `AskUserQuestion` entry and `guard.mjs ask`. Tests
  in `guard.test.mjs` (`conductor AC-6 ask`): refused in a tick's session, from its main thread, a
  stage agent and a review round's agent; allowed elsewhere; an error lets it through. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^conductor AC-6 "` passes.
- [ ] 3.4 The writers (D-8, D-11, D-17): `classify` in `guard.mjs` makes
  `openspec/standing-answers.md` owner-only, `requests/*.answer.md` main-session only, and refuses a
  gate file a tick's session writes with no `record-delegated` for that change and gate. Tests
  `conductor writers ` in `guard.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^conductor writers "` passes.
- [ ] 3.5 The state (change-state delta): `runFactsOf` and `changeState` read claims, holds and lines;
  the class E tests of `change-loop-remote-state.test.mjs` in D-15 edited. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^change-state "` passes.
- [ ] 3.6 Coordinator's session, on the owner's Mac: the blocked firing and the runs at once, with the
  real hook. A scratch project `/var/tmp/devkit-hc-tick/project` (a clone of this branch's head,
  `openspec/` intact), never this repository's settings: its `.claude/settings.local.json` holds one
  `UserPromptSubmit` hook running this branch's `plugins/openspec/hooks/tick-gate.mjs` by its
  absolute path and sets `DEVKIT_HOOK_LOG=/var/tmp/devkit-hc-tick/log/hook.jsonl`; its run file
  (`<common dir>/devkit/roadmap-run.json`) records a `task` and a queue whose only item has a live
  claim (nothing ready). Then, each a task of that project created on the owner's typed turn:
  (a) three one-time firings with the D-5 prompt: per firing, the hook log line (`block`), the run's
  transcript assistant-message count, and the host's usage (tokens) from `list_task_runs` or the
  app; (b) one firing with the run file made ready, for comparison, with its tokens and the model the
  session ran on; (c) a recurring task with `*/5 * * * *`: accepted or refused (and the shortest
  interval accepted), and, with the run file ready and the first firing's session running a
  Bash `sleep 420` run with a 600000 ms timeout (not in the background), whether the next firing starts a second run while the first is in flight;
  (d) in one firing's session, `ToolSearch` for the host's notification tool (`select:PushNotification`,
  else the query `notification`); (e) any pause for a tool approval in any firing; (f) in the
  passing firing, the hook's note in the session (its `additionalContext` seen by the model, quoted
  by it into the scratch project's log) and the tick call it names run; (g) the hook's payload
  `prompt` as `DEVKIT_HOOK_LOG` records it: the tag form or the bare stored prompt (the form not seen
  is dropped from the hook's regex and from `tick-gate.test.mjs` in this task, D-4). Write
  `openspec/changes/helper-conductor/proof/p5-empty-tick.md` with each observation, then append
  "Phase 3 real run" to `proof/decision.md` with the cron, the notification tool and whether a
  stop-and-revise case of D-1 holds. Before any create, check the session can list the project's
  tasks; nothing created is deleted by a session (the owner deletes the tasks with one click; the
  folder `/var/tmp/devkit-hc-tick` is removed after checking the session created it). Check: the three
  blocked firings read 0 model calls and 0 tokens and the note reached the passing firing's
  session, or `decision.md` names the stop-and-revise case (whether a second run started is
  recorded, no stop case: the claims guard overlap); `git status --short` in this worktree lists nothing of the scratch
  project.
- [ ] 3.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; AC-1,
  AC-3, AC-6, AC-8, AC-11 (the runs at once), AC-14, AC-15 (the cron).

## 4. The tick's drive and the texts (phase 4)

Before task 4.1, and again before the delivery, merge `origin/main` into this branch (since `6f03a57`
it changed `plugins/core/skills/review-change/SKILL.md` and `review-round.*`, which task 4.1 edits),
re-read `openspec/config.yaml`, and in the same commit edit this file's header ("has merged nothing
yet") and any task the merge supersedes (CLAUDE.md).

- [ ] 4.1 The review round in a tick's session (D-7, D-9; probe 2 ran the Workflow):
  `plugins/core/skills/review-change/SKILL.md` "Which path runs" gains D-9's sentence for the
  scheduled prompt of a conducted run. Grep
  `plugins/core/skills/review-change/scripts/review-round.test.mjs` and the other tests for that
  sentence first; an asserting test is edited in this commit with its invariant named. Tests
  `review-round conductor `: the sentence names `devkit-roadmap-tick:` and keeps "Use the Workflow
  tool for anything but this round" in `Never`. Map: `review-change/SKILL.md` already links
  `review-round.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^review-round "` passes.
- [ ] 4.2 The devkit skill and the tick's drive (D-7, D-9): `plugins/openspec/skills/devkit/SKILL.md`
  `## Roadmap` rewritten as "The typed command" (the task created on the typed turn, the `@run` line
  said once), "A tick" (the drive of D-7: every rule of "The drive", the precheck, the escalation,
  the push after open, the train with its `depart` through `test-run --train --kind suite` (D-21,
  D-22, D-23), its own test commands through `test-run` (D-25), every hand-off in the background
  with the turn ended after it and the drive going on at its notice, the sweep as the only place a
  gate file is written), "What stays"; "A tick" readable whole as a file at the note's path; the `Never` item on crons and tasks; the `argument-hint`; the
  settings list's `test_gates` and `test_concurrency` and `run`'s `--test-gates`/`--test-concurrency`
  (D-25). No skill is added and `devkit` keeps `disable-model-invocation: true`. Tests
  `conductor skill ` for each sentence D-9 names, and `conductor AC-6 skill` / `conductor AC-22
  skill`: the tick's part names `helper-next`, `request`, `helper-release` and `test-run`, never
  names AskUserQuestion but as forbidden, and names no `delete_scheduled_task`,
  `update_scheduled_task` or `run_scheduled_task` but as forbidden; no file of `plugins/openspec/agents/`
  is named `roadmap-helper` and no `plugins/openspec/skills/devkit-tick/` exists; the `roadmap-loop setting` test's loop over `${user_config.*}` keys
  passes. Check: `claude plugin validate .` exits 0 and
  `node scripts/test-suite.mjs --test-name-pattern="^conductor (skill|AC-6 skill|AC-22 skill)"` passes.
- [ ] 4.3 The grill and its rule (D-9): step 2c of `plugins/core/skills/requirements-grill/SKILL.md`;
  the rule in `openspec/config.yaml`, `plugins/openspec/schemas/devkit/schema.yaml`,
  `plugins/openspec/schemas/devkit-lite/schema.yaml`, `openspec/schemas/devkit/schema.yaml`,
  `openspec/schemas/devkit-lite/schema.yaml`; the class E test "upfront AC-5 skill: the grill rule..."
  of `guard.test.mjs` and "upfront AC-5 skill: the grill skill and the devkit skill hand the triage..."
  of `change-loop-compozy.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^upfront AC-5 "` passes.
- [ ] 4.4 The `ship-change` rows (D-19, D-20): `plugins/openspec/skills/ship-change/SKILL.md`
  `stop-plan-approval` and `stop-retro-answers`: the summary, the delegated words (written by a
  tick's session in its sweep, after its `record-delegated` action, never in the drive that reached
  the gate), the siblings line, the cron-started sentence. Tests `conductor AC-16 rows`. Check: as in 4.2, and the class K test
  "stage-roles gates: an approved mock-up..." passes unchanged.
- [ ] 4.5 The messages and the board (D-9, the roadmap-coordination delta): the new keys in both
  languages in `change-loop.mjs` (before adding them, grep the tests for the key names and for the
  helpers and sample tables that render every key, CLAUDE.md); `boardOf`'s owner block from `ownerWaits` with
  `status-owner-here`, the `@run` line (`gate.task-left` with the task id), the "goes on at the next
  tick" row. Tests `conductor AC-7 board`; the
  message-table parity tests pass. Check: as in 4.2.
- [ ] 4.6 The docs (D-16): `docs/openspec-flow.md` (with D-25's test capacity),
  `docs/coordination-design.md`, `docs/roles.md`, `plugins/openspec/README.md` (with
  `test-slots.mjs` and the two settings). Grep the tests for each paragraph's old sentences first; an asserting
  test is a row of D-15 edited in this commit. Check: `python3 scripts/check.py` exits 0.
- [ ] 4.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; AC-2,
  AC-4, AC-6, AC-7, AC-8, AC-9, AC-12 (rule, ADR 0008's sentence), AC-16 to AC-20 and AC-22 (texts).

## 5. The removal (phase 5)

- [ ] 5.1 The tickets and the change sessions in `roadmap-loop.mjs` and `run-file.mjs` (D-12 rows 1,
  2, 3, 5, `sessionBackground` included): delete them and every class R test of D-15 that tests them
  (`followups F-3 decide` and `followups AC-13 background` among them); edit the class E fixtures,
  `putRun` of `plugins/openspec/hooks/test-fixtures.mjs` (a `shared` file: its edit selects every
  test, so the 5.8 gate runs them all) included.
  Check: `node scripts/test-suite.mjs --test-name-pattern="^(upfront|followups|remote|stage-models) "`
  passes.
- [ ] 5.2 The session cron (D-12 row 4): `CHECK_CRON`, the prompt, `schedule-check`, `delete-check`,
  `checkCmd`, `check`, the `--check-*` flags; the class R tests `upfront AC-13`, `AC-14`, `AC-15`,
  `AC-16 skill`. Check: as in 5.1.
- [ ] 5.3 The session models (D-12, D-14): the step-down actions and their keys; the class R tests of
  `stage-models.test.mjs` (`AC-6`, `AC-7`, `AC-10 with a session per change`), the stage-models
  delta's new scenario as `conductor AC-11 model` in the conductor file. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^stage-models "` passes.
- [ ] 5.4 The entry (D-12 rows 8, 9): `ENTRY_SKILL`, `namesEntrySkill`, `skillEntry`, `START_LINE`,
  mode `skill`, the `Skill` entry of `hooks.json`, `changeSessionStopDecision`'s branch; delete
  `plugins/openspec/skills/devkit-session/`; the class R tests of `guard.test.mjs` and
  `change-loop-compozy.test.mjs` ("upfront AC-1 guard: …"), the class E tests of
  `change-loop-declared.test.mjs` that name `devkit-session`, and `SESSION_SKILL_PATH` and
  `SKILL_INPUT` of `plugins/openspec/hooks/roadmap-loop-fixtures.mjs`. Regenerate `docs/catalog.md` with
  `python3 scripts/gen-catalog.py`. Check: `python3 scripts/gen-catalog.py --check` exits 0.
- [ ] 5.5 The messages (D-9's removed keys) and `runFactsOf`'s `sessionMode`/`started`. Check:
  `grep -rn 'devkit-start:\|ticket-unknown\|devkit-roadmap-check:' plugins/` prints nothing, and
  `grep -rn 'roadmap-session-\|roadmap-waits-turn\|roadmap-check-\|session-held-owner\|roadmap-woken' plugins/`
  prints nothing, and `grep -rln 'devkit-session' plugins/` prints nothing.
- [ ] 5.6 The records (D-16): ADR 0021's status line, the `- Amended by ADR [helper-conductor]` lines
  of ADR 0004, 0006, 0008, 0010, 0011, 0013, 0014, 0017, 0020,
  0022, 0023 and 0026, after the pin rule's grep; the class E test "upfront ADR 0021: the documents follow";
  the class K tests of ADR 0022 and ADR 0026 (`guard.test.mjs` "setup AC-2 records",
  `release-note.test.mjs` "release-note AC-14 texts", its subtest "records: ADR 0022 and ADR 0025")
  run unchanged. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(upfront ADR 0021|followups ADR 0014|setup AC-2 records|release-note AC-14) "`
  passes.
- [ ] 5.7 The map and CompozyOS: `scripts/test-map.json` has no entry for a deleted file and links
  every new test; the CompozyOS tests run unchanged. Check: `node scripts/test-suite.mjs --own-files`
  refuses no map entry, and `node scripts/test-suite.mjs --test-name-pattern="^compozy"` passes
  (AC-13).
- [ ] 5.8 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; AC-10,
  AC-12, AC-13.

## 6. The real run and the checks (phase 6)

- [ ] 6.1 Conductor (the coordinator's session on the owner's Mac, where scheduled tasks run): the
  real run, in a scratch project with a roadmap of three small items (`a`, `b` after `a`, `c`), on the
  installed packs built from this branch: type `/devkit roadmap 1` twice (one task, AC-2), see a
  blocked empty firing in `DEVKIT_HOOK_LOG` (AC-3), a claim per tick and its drive in the tick's own
  session handing each stage one level below it (AC-4), never more than one live claim (AC-11), no
  question box and no AskUserQuestion call (AC-6), the tick's stop refused once while its claim had
  no wait (a `stop` line of `DEVKIT_HOOK_LOG`), `a`'s review round run as the Workflow (`review.md`'s
  path line `workflow`), the drive's turns each ended after a background hand-off and woken by its
  notice, `a`'s plan approval as one line shown in the typed session and
  answered there (AC-7), then `/devkit roadmap stop`: the run file's `ended`, the next firing blocked
  in `DEVKIT_HOOK_LOG` with no model call, the `@run` line said once in the typed session, and the
  task still listed until the owner deletes it with one click (AC-9). Write `proof/run-1.md` with the
  run file at each step, the hook log and the task lists. Check: the file shows each AC's
  observation.
- [ ] 6.2 Conductor: in the same run, end `b`'s tick run mid-stage (the owner's stop of that run in
  the app, or killing that session's process); after the stale bound (lowered for the run with
  `DEVKIT_CLAIM_STALE_MS`, an env override `run-file.mjs` reads for tests and proofs only), the next
  tick takes the claim over and the stage is handed again from the files; a five-minute tick sweeps
  the run (AC-5, AC-15). The failure path names the hook that sees it (the prompt hook passes on the
  stale claim; the stage agent that lost its session left no stage file, and the re-handed stage
  agent's `subagent-stop` is judged as any stage's) and the files left (the claim's old heartbeat,
  the partial stage file). `proof/run-2.md`. Check: the file shows the takeover and the re-hand.
- [ ] 6.3 Conductor: with `openspec/standing-answers.md` delegating the plan approval, `c`'s approval
  is recorded by a tick with the quoted line, its summary within 12 lines and its words within 200
  characters, a sibling line when `a` and `c` share a file, and a grill question answered as a request
  file and its answer (AC-8, AC-14, AC-16, AC-17). `proof/run-3.md`. Check: `approval.md`, the request
  and its answer are copied in the file.
- [ ] 6.4 Conductor: a boarded change dispatched by the next tick (AC-18); an archive pull request
  of the run (`openspec/` files only) merged on its required checks with no train (AC-22); a parked branch reused and
  an already-delivered item skipped (AC-19); a planner escalation answered and re-handed (AC-20); the
  machine split, conservatively (AC-21, D-13): with the machines setting listing `avel` (an SSH host,
  which holds no task), every item opens on the Mac and its branch is on `origin` after `open`; a
  branch pushed with a claim naming `avel` is held `elsewhere` and not driven, and once that claim
  is released on `origin` the Mac's tick claims it and adds its worktree from `origin/<id>`.
  `proof/run-4.md`. Check: the file shows each.
- [ ] 6.5 Conductor: the test capacity on one machine, in the scratch project of 6.1 with its run's
  defaults (2 gates, 4 files) and `DEVKIT_STATE_DIR` in the scratch folder: two helpers' gates and a
  third `test-run --kind gate` started at once (the third waits), a change's whole suite then a
  train's started while it runs (the train's waits for it and for the gates in flight, a second
  change's suite and a new gate started after the train asked wait for the train's end), the `suite:` lines reading `concurrency 4`, a briefed stage agent's
  transcript running its gate through `test-run`, and one `test-run` killed with `SIGKILL` whose slot
  the next one takes. The failure path names what sees it (the next `test-run`'s read drops the dead
  pid) and the file left (the ledger with the dead entry). `proof/run-5.md`, with the ledger at each
  step and `uptime` beside each run. Check: the file shows each observation (AC-22).
- [ ] 6.6 The checks: `claude plugin validate .`, `python3 scripts/gen-catalog.py --check`,
  `node plugins/compozy/kit/scripts/gen-agents.mjs --check`, and the AC-10 greps of 5.5. Check: each
  exits 0 or prints nothing.
- [ ] 6.7 Conductor: the whole suite after the last merge of the base, alone on the machine:
  `node scripts/test-suite.mjs`, as a background command, with `uptime`. Check: its `suite:` line ends
  `0 fail`.
- [ ] 6.8 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; every AC
  from AC-1 to AC-22 has its proof file or test named in `evidence.md` by the verifier.

## Workflow follow-up

- The verifier writes `evidence.md`; the review bench runs; the delivery numbers the record and writes
  the release from `release.md`; the retro and the archive follow.
- A defect of `flow-check.mjs` (lines 563-581, devkit-openspec 0.50.2) seen in this change: once a task
  of `tasks.md` is ticked, the mtime staleness of a failed readiness is skipped, and the plan-revised
  path needs a matching approval, so a failed readiness never sees the planner's fix; `next` hands
  the planner again with "nothing changed". This change dispatched the readiness review directly. A
  follow-up change on `flow-check.mjs` makes a plan file newer than the failed readiness count as the
  fix while the work has started.
