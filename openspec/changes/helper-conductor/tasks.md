<!-- devkit-stage tasks result=passed attempt=3 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Tasks

Change: `helper-conductor` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base: `origin/main` at
`6f03a57` (the branch was opened on it and has merged nothing yet) · PRD / tech spec: n/a
(`proposal.md`, `design.md`, `requirements.md` at attempt 4, `decisions.md`, `release.md`)

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

Phase 1 is a decision point: phases 2 to 6 start only once `proof/decision.md` names Helper A or
Helper B and prompt S-A (D-1). A stop-and-revise case sends the plan back to the planner, the
readiness review and the owner's approval before anything else runs.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `first-real-run` | 1.1 to 1.9 |
| AC-2 | `one-typed-command` | 2.4, 4.2, 6.1 |
| AC-3 | `empty-tick-refused` | 1.6, 3.1, 6.1 |
| AC-4 | `tick-claims-one` | 2.5, 2.6, 4.1, 6.1 |
| AC-5 | `resume-from-files` | 2.5, 2.6, 6.2 |
| AC-6 | `no-owner-box` | 2.6, 3.3, 4.1, 4.3, 6.1 |
| AC-7 | `waits-for-owner-one-place` | 2.6, 2.7, 2.9, 4.2, 4.5, 6.1 |
| AC-8 | `delegation-quoted` | 2.2, 2.7, 3.4, 4.4, 6.3 |
| AC-9 | `task-removes-itself` | 1.2, 2.4, 2.5, 3.1, 4.2, 6.1 |
| AC-10 | `sessions-removed` | 5.1 to 5.5, 6.6 |
| AC-11 | `places-cap` | 2.1, 2.5, 3.1, 6.1 |
| AC-12 | `adr-recorded` | 1.10, 4.3, 5.6 |
| AC-13 | `compozy-untouched` | 5.7, 6.7 |
| AC-14 | `request-file-channel` | 2.3, 2.7, 3.4, 6.3 |
| AC-15 | `periodic-check` | 1.8, 2.4, 2.5, 6.2 |
| AC-16 | `approval-summary` | 2.3, 2.7, 4.4, 6.3 |
| AC-17 | `sibling-order` | 2.8, 4.4, 6.3 |
| AC-18 | `train-dispatch` | 2.9, 4.1, 6.4 |
| AC-19 | `open-precheck` | 2.10, 4.1, 6.4 |
| AC-20 | `escalation-rehand` | 2.11, 4.1, 6.4 |
| AC-21 | `machine-split` | 2.12, 6.4 |
| AC-22 | `test-capacity` | 2.14, 4.1, 4.2, 4.6, 6.5 |

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
- [ ] 1.3 Conductor: P-1 and P-2, a one-firing task whose session runs `git clean -n` and
  `git stash list`. Write `proof/p1-hooks.md`: the devkit `SessionStart` report seen, the `bash`
  guard's refusals, `DEVKIT_HOOK_LOG` lines, the first 400 characters of the `UserPromptSubmit`
  payload with the session id masked, and the envelope's exact form. Check: the file holds a guard
  refusal and the payload.
- [ ] 1.4 Conductor: P-3, a task whose prompt's second line is `/devkit-openspec:devkit status`. Write
  `proof/p3-slash.md` with the transcript's `<command-name>` line and the board's first line. Check:
  both present, or the file says it failed.
- [ ] 1.5 Conductor: P-4a and P-4b, the agent and the Workflow helpers dispatching
  `devkit-openspec:openspec-validator` and one `review-change` round on a scratch change in the probe
  project. Write `proof/p4-helper.md`: for each helper, the nested agents' `subagent-stop` log lines,
  whether a missing stage file was refused, and the round's files. Check: each helper reads `pass` or
  `fail` with its lines.
- [ ] 1.6 Conductor: P-5, three blocked firings and one passing firing. Write
  `proof/p5-empty-tick.md`: per firing, the transcript's assistant-message count and the host's
  usage, with the machine's real plugin set (genesi included). Check: the three blocked firings show
  0 model calls and 0 tokens, or the file says otherwise.
- [ ] 1.7 Conductor: P-6 and P-7: overlap with a background `sleep 900`, the `*/5 * * * *` schedule
  accepted or refused, and the notification tool's name. Write `proof/p6-overlap.md`. Check: the file
  names each answer.
- [x] 1.8 Conductor: remove every probe task (P-0's tool), list, and delete
  `/var/tmp/devkit-hc-probe` only after checking the session created it. Append the final list to
  `proof/p0-delete.md`. Check: no `devkit-hc-probe-` task in the list.
- [x] 1.9 Conductor: write `proof/decision.md` (D-1): Helper A, Helper B or stop-and-revise, S-A or
  stop-and-revise, the envelope regex D-4 will use, the cron, the remove tool and the notification
  tool, each with the proof file and line it rests on. Check: every case of D-1's list is named true
  or false with its source.
- [ ] 1.10 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (it
  selects no test: only `openspec/` files changed); `proof/decision.md` picks a helper and S-A; and
  the record is revised by the adr-author with that pick (its decision 3, and its ADR 0008 amendment
  with Helper B), before the plan's approval is recorded again. The record's amendments of ADR 0022
  and ADR 0026 are already in it and wait for nothing. AC-1, AC-12 (in part).

## 2. The bookkeeping and the verbs (phase 2)

- [ ] 2.1 The run file (D-2, D-3): in `plugins/openspec/hooks/run-file.mjs`, `emptyRun` and `readRun`
  with `task`, `queue`, `claims`, `holds` (`elsewhere` with its 30-minute `recheckAt`), `ownerWaits`
  (the `@train` key kept), `train` (its `hold` with `recheckAt`); the removed fields not read;
  `CLAIM_STALE_MS`; `tickReady(run, facts, now)` with every rule of D-3 (`stopping` and
  `stopping-busy`, `archived` holds counting for `done`, rule 4a with `train.hold`); `commonDirOf`,
  `localRunFilePath` and `localFacts(root, run, env)` with `node:fs` only, `heldPlaces` the
  `run.occupied` ids that are open; `limitOf` and `DEFAULT_LIMIT` moved from `roadmap-loop.mjs` and
  re-exported there. Tests in the new `plugins/openspec/hooks/roadmap-loop-conductor.test.mjs`
  (`conductor AC-4 `, `AC-11 `): each D-3 rule, a broken run file, a non-id queue entry; on one
  fixture repository (a main checkout, two worktrees, one removed folder) `localRunFilePath` equals
  `runFilePath` from the main checkout and from a worktree, `localFacts`' `open` equals the change
  folders of `listWorktrees`' paths, and it reads the same with a `PATH` whose `git` exits 1;
  `heldPlaces` counts an `occupied` entry of an open change with no claim, and leaves out one of a
  change no longer open. The existing tests that import `limitOf` from `roadmap-loop.mjs` pass
  unchanged. Map: the new test linked to `run-file.mjs` and `roadmap-loop.mjs`, and marked `slow`.
  Check: `node scripts/test-suite.mjs --test-name-pattern="^(conductor |roadmap-loop setting:)"` passes.
- [ ] 2.2 The standing answers (D-8): `plugins/openspec/hooks/standing-answers.mjs` and
  `plugins/openspec/hooks/standing-answers.test.mjs` with the seven cases of D-15. Map: a `files` key
  for the module. Check: `node scripts/test-suite.mjs --test-name-pattern="^standing "` passes.
- [ ] 2.3 The request files (D-17, D-19): `plugins/openspec/hooks/request-file.mjs` (write, parse, the
  12-line summary refusal, the answer file, the 200-character cut of an approval's words) and
  `plugins/openspec/hooks/request-file.test.mjs`. Map: its `files` key. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^request "` passes.
- [ ] 2.4 The typed command and the task (D-5): `run` records the queue and prints `install-task`;
  `--after task=installed|exists|refused|deleted`; `stop` prints `delete-task`; the reply
  `roadmap-task-left` in both languages of `change-loop.mjs` (grep the tests for the message
  table's key lists first, CLAUDE.md); the task id, the
  `*/5` cron (or `decision.md`'s) and the two-line prompt; `--change-sessions` and `--cron` refused as
  unknown options. Tests `conductor AC-2 `, `AC-9 `: typed twice gives one `install-task`; stop and
  done give `delete-task`. Check: as in 2.1.
- [ ] 2.5 The tick, its claim and its sweep (D-6, D-18): `tick --session`, `tick-started`,
  `tick-ended`, `tick-recorded`; the sweep; the claim under `updateRun`; the stale takeover; the
  places cap; rule 3's `stopping` and `stopping-busy`, and `tick --after task=deleted|delete-refused`.
  Tests `conductor AC-4 `, `AC-5 `, `AC-9 `, `AC-11 `, `AC-15 `: two items one claim, a live claim
  left alone, every place with a helper, two `tick` processes at once leave one claim, a stale claim
  taken over, a merged pull request swept; a stopping run with no live claim gives `delete-task` and
  `roadmap-ended-stopped`, with a live claim `{ end: null }`, and with a stale claim `delete-task`;
  `task=delete-refused` sets `task: null` and prints `roadmap-task-left`. Check: as in 2.1.
- [ ] 2.6 The helper's verbs (D-7, D-14): `helper-next` from `session-next`'s place, load, dependency,
  merge-base and budget logic, with D-7's table of ends (a `blocked` end writes its hold and the
  owner line of gate `decision`; an `archived` end its hold and no line); `helper-release`;
  `helperModel`. Tests `conductor AC-7 blocked`: the blocked end's line and hold, `answered --gate
  decision` deleting both, the next `tick` claiming the item; an archived end with no line, and the
  last archived end making `tickReady` give `done`. Rewrite the
  class M tests of D-15 that drive `session-next` onto `helper-next` (in
  `roadmap-loop-followups.test.mjs`, `roadmap-loop-upfront.test.mjs`, `change-loop-remote-state.test.mjs`,
  `change-loop-declared.test.mjs`), each keeping its invariant. Check: as in 2.1, and
  `node scripts/test-suite.mjs --test-name-pattern="^upfront AC-(8|9|10) "` passes.
- [ ] 2.7 The owner's place (D-8, D-17, D-19): `request`, `answer`, `owner-waits [--session]`,
  `owner-watch`, `answered`, `pushed`, `record-delegated`; a grill line holds its questions; an
  approval line its summary. Tests `conductor AC-7 `, `AC-8 `, `AC-14 `, `AC-16 `. Check: as in 2.1.
- [ ] 2.8 The siblings (D-20): `siblings --change`, and the `- Siblings:` line the approval adds. Tests
  `conductor AC-17 `, with a test that `deliver-check.mjs` answers the same with and without the line.
  Check: as in 2.1.
- [ ] 2.9 The train's claim (D-21, its CLI part): the `boarded` hold, `@train` readiness (rule 4a with
  `train.hold`), the train's claim, and `train-end` with every row of D-21's table of ends; `answered`
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
- [ ] 2.12 The machines (D-13): the push after `open` (`push --what open`), the fetch and worktree on
  the other machine, the `elsewhere` hold; `remoteSessionStartOf` no longer called. Tests
  `conductor AC-21 ` with two clones of one bare `origin` in the test's folder: the claim naming
  `avel` gives this machine an `elsewhere` hold with `recheckAt` 30 minutes, no worktree, no helper
  and no `occupied` entry, `tickReady` not ready before `recheckAt`; at `recheckAt` with the claim
  released the tick claims it. Check: as in 2.1.
- [ ] 2.13 ADR 0013's Note (D-2) and the class M test "followups AC-3 run file" reading it. Grep the
  tests for `0013-the-roadmap-coordinator-is-the-owners-session.md` first (D-15's pin rule). Check:
  `node scripts/test-suite.mjs --test-name-pattern="^followups (AC-3|ADR 0014) "` passes.
- [ ] 2.14 The test capacity (D-25): `capacity` in `emptyRun`/`readRun` with `gatesOf` and
  `concurrencyOf` in `plugins/openspec/hooks/run-file.mjs`; `run --test-gates --test-concurrency`;
  the two `userConfig` settings in `plugins/openspec/.claude-plugin/plugin.json`; the new
  `plugins/openspec/hooks/test-slots.mjs` (the ledger under `withLockFile`, the dead-pid drop, the
  train's `trainWaiting`) and the `test-run` verb of `roadmap-loop.mjs`; the ceiling of
  `DEVKIT_TEST_CONCURRENCY` in `scripts/test-suite.mjs`; the cap sentence `helper-next` appends to
  every `agent` brief. Tests first, seen failing: `plugins/openspec/hooks/test-slots.test.mjs`
  (`capacity AC-22 `: a second whole suite waits until the first exits; a train's suite waiting
  keeps a change's suite from starting and starts before it; a third gate waits at `gates` 2; a
  dead pid's slot is taken; a ledger that does not parse is empty; two clones' run files on one
  `DEVKIT_STATE_DIR` share the whole-suite slot; no run file or no `task` runs at once with no
  slot; the child's exit code is `test-run`'s, and `SIGTERM` frees the slot; no `--` exits 3);
  `conductor AC-22 ` in `roadmap-loop-conductor.test.mjs` (`run` records the defaults, the
  settings' values, and the defaults for `0`, `x` and an unfilled `${user_config.test_gates}`; a
  typed `run` again rewrites `capacity`; every `agent` action of `helper-next` carries the sentence
  with `--concurrency=<c>`, and a lone change's `next` brief does not; a change at its review
  waiting on GitHub with no claim holds a place, a helper at a grill holds none); `suite-capacity
  AC-22 ` in `plugins/openspec/hooks/test-suite.test.mjs` (`DEVKIT_TEST_CONCURRENCY=1` with
  `--concurrency=2` runs one file at a time and the `suite:` line reads `concurrency 1`; `0`, `x`
  and empty are ignored). The class E rows of D-15 for `roadmap-loop setting: the load_limit user
  setting` and `test-suite.test.mjs`'s `BLANK_ENV` in the same commit. Map: a `files` key for
  `test-slots.mjs` linking `test-slots.test.mjs`, and `plugin.json` linking
  `roadmap-loop-followups.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(capacity |conductor AC-22 |suite-capacity |roadmap-loop setting:)"`
  passes.
- [ ] 2.15 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; AC-2,
  AC-4, AC-5, AC-7, AC-8, AC-11, AC-14 to AC-22 (their code).

## 3. The tick's hook and the locks (phase 3)

- [ ] 3.1 The tick's prompt hook (D-4): `plugins/openspec/hooks/tick-gate.mjs` (built-ins at the
  top, `guard.mjs` and `run-file.mjs` by dynamic `import()` after the raw match; `localRunFilePath`,
  `localFacts`, `tickReady`), the first `UserPromptSubmit` entry of
  `plugins/openspec/hooks/hooks.json`, and `plugins/openspec/hooks/tick-gate.test.mjs`, run as a
  process with the payload of `proof/p1-hooks.md`, on a fixture repository with a main checkout and a
  linked worktree, and with a `PATH` whose `git` and `gh` stubs exit 1 in every case: the envelope
  with nothing ready blocks (from the main checkout and from the worktree), `stopping-busy` blocks,
  `no-task` blocks, a held place blocks as the conductor test's `tick` claims nothing on the same run
  file; an item ready, done, stopping with no live claim, any other prompt, a broken run file, no
  common git folder and another root print nothing; the envelope run ends within the hook's 10-second
  timeout, its time recorded in the test's message. Map: the hook's `files` key, `hooks.json`'s
  list, and `run-file.mjs`'s list (the hook calls its functions) link `tick-gate.test.mjs`. Check: `node scripts/test-suite.mjs --test-name-pattern="^tick-gate "` passes.
- [ ] 3.2 The stop and hand-off locks of a conducted run (D-11): `roadmapStopDecision`,
  `roadmapAgentDecision`, the helper's `subagent-stop`. Tests `conductor locks ` for each scenario of
  "A conducted run's sessions stop as its ticks need" and the new hand-off scenarios; the class K
  `roadmap-loop lock stop: RS…` and `lock agent: RH…` tests pass unchanged. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(conductor locks|roadmap-loop lock) "` passes.
- [ ] 3.3 No question box (D-10): the `PreToolUse` `AskUserQuestion` entry and `guard.mjs ask`. Tests
  in `guard.test.mjs` (`conductor AC-6 ask`): refused in a tick's session, main thread and subagent;
  allowed elsewhere; an error lets it through. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^conductor AC-6 "` passes.
- [ ] 3.4 The writers (D-8, D-11, D-17): `classify` in `guard.mjs` makes
  `openspec/standing-answers.md` owner-only, `requests/*.answer.md` main-session only, and refuses a
  gate file a tick's session writes with no `record-delegated` for that change and gate. Tests
  `conductor writers ` in `guard.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^conductor writers "` passes.
- [ ] 3.5 The state (change-state delta): `runFactsOf` and `changeState` read claims, holds and lines;
  the class E tests of `change-loop-remote-state.test.mjs` in D-15 edited. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^change-state "` passes.
- [ ] 3.6 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; AC-3,
  AC-6, AC-8, AC-14.

## 4. The helper and the texts (phase 4)

- [ ] 4.1 The helper (D-7): Helper A `plugins/openspec/agents/roadmap-helper.md`, or Helper B
  `plugins/openspec/skills/devkit/scripts/change-helper.workflow.js` with its `files` key in the map,
  as `proof/decision.md` picked; it covers the change loop, the grill's exit, the precheck, the
  escalation, the push after open, the train with its `depart` through `test-run --train --kind
  suite` (D-21, D-22, D-23) and its own test commands through `test-run` (D-25). Tests
  (`conductor AC-6 helper`, `conductor AC-22 helper`): the file names `helper-next`, `request`,
  `helper-release` and `test-run`, never AskUserQuestion, and its tools (A) hold no
  AskUserQuestion. Check: `claude plugin validate .` exits 0 and the test passes.
- [ ] 4.2 The devkit skill (D-9): `plugins/openspec/skills/devkit/SKILL.md` `## Roadmap` rewritten as
  "The typed command", "A tick", "What stays"; the `Never` item on crons; the `argument-hint`; the
  settings list's `test_gates` and `test_concurrency` and `run`'s `--test-gates`/`--test-concurrency`
  (D-25). Tests `conductor skill ` for each sentence D-9 names; the `roadmap-loop setting` test's
  loop over `${user_config.*}` keys passes. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^conductor skill "` passes.
- [ ] 4.3 The grill and its rule (D-9): step 2c of `plugins/core/skills/requirements-grill/SKILL.md`;
  the rule in `openspec/config.yaml`, `plugins/openspec/schemas/devkit/schema.yaml`,
  `plugins/openspec/schemas/devkit-lite/schema.yaml`, `openspec/schemas/devkit/schema.yaml`,
  `openspec/schemas/devkit-lite/schema.yaml`; the class E test "upfront AC-5 skill: the grill rule..."
  of `guard.test.mjs` and "upfront AC-5 skill: the grill skill and the devkit skill hand the triage..."
  of `change-loop-compozy.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^upfront AC-5 "` passes.
- [ ] 4.4 The `ship-change` rows (D-19, D-20): `plugins/openspec/skills/ship-change/SKILL.md`
  `stop-plan-approval` and `stop-retro-answers`: the summary, the delegated words, the siblings line,
  the cron-started sentence. Tests `conductor AC-16 rows`. Check: as in 4.2, and the class K test
  "stage-roles gates: an approved mock-up..." passes unchanged.
- [ ] 4.5 The messages and the board (D-9, the roadmap-coordination delta): the new keys in both
  languages in `change-loop.mjs` (before adding them, grep the tests for the key names and for the
  helpers and sample tables that render every key, CLAUDE.md); `boardOf`'s owner block from `ownerWaits` with
  `status-owner-here`, the "goes on at the next tick" row. Tests `conductor AC-7 board`; the
  message-table parity tests pass. Check: as in 4.2.
- [ ] 4.6 The docs (D-16): `docs/openspec-flow.md` (with D-25's test capacity),
  `docs/coordination-design.md`, `docs/roles.md`, `plugins/openspec/README.md` (with
  `test-slots.mjs` and the two settings). Grep the tests for each paragraph's old sentences first; an asserting
  test is a row of D-15 edited in this commit. Check: `python3 scripts/check.py` exits 0.
- [ ] 4.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green; AC-2,
  AC-4, AC-6, AC-7, AC-8, AC-9, AC-12 (rule), AC-16 to AC-20 and AC-22 (texts).

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
  of ADR 0004, 0006, 0010, 0011, 0013, 0014, 0017, 0020, 0022, 0023 and 0026 (ADR 0008 only with
  Helper B), after the pin rule's grep; the class E test "upfront ADR 0021: the documents follow";
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

- [ ] 6.1 Conductor: the real run, in a scratch project with a roadmap of three small items (`a`,
  `b` after `a`, `c`), on the installed packs built from this branch: type `/devkit roadmap 1` twice
  (one task, AC-2), see a blocked empty tick in `DEVKIT_HOOK_LOG` (AC-3), a claim and a helper per
  tick (AC-4), never more than one helper (AC-11), no question box (AC-6), `a`'s plan approval as one
  line shown in the typed session and answered there (AC-7), then `/devkit roadmap stop` and the list
  without the task (AC-9). Write `proof/run-1.md` with the run file at each step, the hook log and the
  task lists. Check: the file shows each AC's observation.
- [ ] 6.2 Conductor: in the same run, kill `b`'s helper mid-stage; after the stale bound (lowered for
  the run with `DEVKIT_CLAIM_STALE_MS`, an env override `run-file.mjs` reads for tests and proofs only),
  the next tick takes the claim over and the stage is handed again from the files; a five-minute tick
  sweeps the run (AC-5, AC-15). The failure path names the hook that sees it (the prompt hook passes on
  the stale claim; `subagent-stop` refuses the killed stage agent's missing file at its next stop) and
  the files left (the claim's old heartbeat, the partial stage file). `proof/run-2.md`. Check: the file
  shows the takeover and the re-hand.
- [ ] 6.3 Conductor: with `openspec/standing-answers.md` delegating the plan approval, `c`'s approval
  is recorded by a tick with the quoted line, its summary within 12 lines and its words within 200
  characters, a sibling line when `a` and `c` share a file, and a grill question answered as a request
  file and its answer (AC-8, AC-14, AC-16, AC-17). `proof/run-3.md`. Check: `approval.md`, the request
  and its answer are copied in the file.
- [ ] 6.4 Conductor: a boarded change dispatched by the next tick (AC-18); a parked branch reused and
  an already-delivered item skipped (AC-19); a planner escalation answered and re-handed (AC-20); a
  change opened for a second clone on the Avell, pushed, and picked up there by its own run (AC-21).
  `proof/run-4.md`. Check: the file shows each.
- [ ] 6.5 Conductor: the test capacity on one machine, in the scratch project of 6.1 with its run's
  defaults (2 gates, 4 files) and `DEVKIT_STATE_DIR` in the scratch folder: two helpers' gates and a
  third `test-run --kind gate` started at once (the third waits), a change's whole suite then a
  train's started while it runs (the train's waits for it, a second change's suite started after the
  train asked waits for the train), the `suite:` lines reading `concurrency 4`, a briefed stage agent's
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
