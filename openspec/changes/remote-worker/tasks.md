<!-- devkit-stage tasks result=passed attempt=4 commit=fc0123065c501db896a78bbc964754db237952b0 -->
# Tasks

Change: `remote-worker` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, key, text and test name is in
`design.md`:

- D-1 the claim at open, D-2 its form, D-3 the readers;
- D-4 the `machines` setting, D-5 lines open elsewhere and the board, D-6 asking a machine;
- D-7 placement, D-8 the session on another machine, D-9 the place, D-10 the wake, D-11 the locks;
- D-12 the messages, D-13 the ADRs, D-14 the existing tests this plan changes, D-15 the documents and
  the release, D-16 the proof and its fixtures.

The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every new test is named `remote <AC-n or locks> <area>: ...`, as the Proof map of
`design.md` names it, and lives in the file it names. A gate runs the tests filtered through
`plugins/openspec/hooks/guard.test.mjs`, which imports both files. Every env a new test builds blanks
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH`, as the files' shared constants do. Every gate runs with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set, as a pull-request run on CI does. The tests need the `openspec` CLI 2.x on
`PATH`; where the temporary folder is short of inodes, run the gates with `TMPDIR=/var/tmp`. No
gate calls `claude` by name. No test runs `ssh`, starts or lists a session, or sends a message (D-16).

**Gate durations.** Every gate's `node --test` runs as a background command of the tool, and the
gate is judged by its exit code once the command ends, never by a foreground timeout: a run still
going is pending, not red. The phase gates 1.4, 2.4, 3.6 and 4.6 are short: each runs the new
`remote` tests and only the existing groups its phase touches (named in the gate, with the
`followups AC-3 run file` test of D-14 T-3 in every one), and its duration measured on the base
`c561553` with `TMPDIR=/var/tmp` is given next to it; the new tests add to it. Gate 5.10 is long: it
runs the whole suite once (13 to 21 minutes). Every other existing test runs at gate 5.10.

Test first in phases 1 to 4: the phase's test task comes before its code tasks. Its new tests fail
on the base `c561553`, and the failing run is saved as `openspec/changes/remote-worker/proof/red-<phase>.txt`.
An existing test is changed only where D-14 names it, and the task says its invariant, layer and
suite. Every other existing test runs unchanged; one that fails at a phase gate or at gate 5.10 and
is not in D-14 stops the work for a plan revision. The plan revision of 2026-11-22 (approved by
the owner) added T-6 to T-13 of D-14 and task 5.7 after the whole-suite gate, then 5.7, found them.
The plan revision of 2026-11-23 (the owner's yes, in their own message) follows the release merge
of `origin/main` at `212d007` (merge commit `ccb3dfb`): the whole-suite gate, then 5.8, found one
test `main` added that the claim commit moves (T-14 of D-14, task 5.8), and `openspec validate
remote-worker --strict` refused the `roadmap-coordination` delta, which this revision fixes. Tasks
5.5 and 5.6 run again at the merged commit. The same revision makes ADR 0020 amend ADR 0017
decision 4 (the place wait is the one blocked end titled `⏳ <id>`; D-13, task 5.9, D-14 T-15), and
the whole-suite gate is now 5.10. The release took ADR 0019 at that merge, and devkit-openspec
`0.30.0` and marketplace `0.34.0` after `origin/main` at `aa7329a`; after `origin/main` at `37a7063`,
whose release-tags took ADR 0019, it takes ADR 0020, devkit-openspec `0.32.0` and marketplace
`0.36.0` (D-13, D-15). The plan revision after `37a7063` also puts the claim keys before main's pin (D-1 step 4) and
names T-16 to T-19 of D-14, in task 5.8. Leave no backup or scratch file in the tree;
end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `open-refuses-claimed` | 1.1, 1.3 |
| AC-2 | `open-pushes-claim` | 1.1, 1.2, 1.3 |
| AC-3 | `open-race-one-wins` | 1.1, 1.3 |
| AC-4 | `no-origin-unchanged` | 1.1, 1.3 |
| AC-5 | `status-shows-machine` | 3.1, 3.4, 5.10 |
| AC-6 | `roadmap-never-reopens` | 3.1, 3.3 |
| AC-7 | `machines-setting` | 3.1, 3.2, 5.10 |
| AC-8 | `open-on-fewest` | 4.1, 4.2 |
| AC-9 | `remote-session-start` | 4.1, 4.3, 4.4, 5.2, 5.10 |
| AC-10 | `place-at-implementation` | 2.1, 2.2, 2.3, 5.2, 5.9, 5.10 |
| AC-11 | `wake-on-free-place` | 2.1, 4.1, 4.5, 5.2, 5.10 |
| AC-12 | `unreachable-machine` | 3.1, 3.4, 3.5, 4.1, 4.3 |

The automated tests of phases 1 to 5 are this change's verification: gate 5.10 is its last gate. The
live check on two machines is not a task of this change. The owner decided on 2026-11-23 (`B: depois
do merge`, "B: after the merge") that it runs after the merge, on the merged version, the next time
the owner uses two machines; it is a bullet of the Workflow follow-up below (L-1 to L-4, which
re-check AC-1, AC-3, AC-5, AC-6 and AC-8 to AC-12 across real machines), and `design.md` D-16 says
what the tests cover in its place.

## 1. The claim at open (AC-1, AC-2, AC-3, AC-4)

- [x] 1.1 Write this phase's tests (design D-1 to D-3, D-16; spec `change-coordination` "Opening a
  change claims it on the remote", "An id open on another machine is refused", "Of two machines
  opening one id, one wins", and the MODIFIED "A free-text request opens a change"), in
  `plugins/openspec/hooks/change-loop.test.mjs`: the AC-1 to AC-4 tests of the Proof map (the
  AC-2 test of an option that is not valid included, spec scenario "A machine name or a places
  value that is not valid") and `remote locks claims: the claims of a stale clone cost at most 8 gh
  calls, and none for the default branch` (D-3's `gh` budget, spec `coordination-locks` "Reading
  the claims stays within a lock's time"). The two AC-3 tests use two clones of one bare remote;
  the first uses the `beforePush` seam, the second two child processes started at once. The AC-1 tests assert `snapshot` unchanged and no
  `refs/heads/<id>`. Run them on `c561553` and save the failing output to
  `openspec/changes/remote-worker/proof/red-1.txt`. Check: every new test fails there for a missing
  behaviour (not a syntax error), as the file shows.
- [x] 1.2 Change T-1 of D-14 (`change-loop open: O4 starts from origin/<default> after a fetch`,
  invariant: the branch starts from the fetched `origin/<default>`; layer: change-loop open; suite:
  `change-loop.test.mjs` through `guard.test.mjs`) as D-14 says. Check: the test's diff touches only
  the `HEAD` assertion and adds the two claim assertions.
- [x] 1.3 In `plugins/openspec/hooks/change-loop.mjs`: `thisMachine`, `MACHINE_NAME`, `parseClaim`,
  `claimOfRef` and `remoteClaims` with its `gh` budget (`CLAIM_GH_BRANCHES`, `CLAIM_DEADLINE_MS`,
  the per-call `timeout`, the default branch skipped) (D-2, D-3); the claim in `openChange`,
  `openCheckout` and `openUnderLock` (D-1 steps 1 to 6, the `claim` option, the `beforePush` and
  `machine` options); the `open` options `--machine`, `--places` and `--remote`, checked before
  anything is created (a value that fails is a usage error, D-1); the keys `claimed`,
  `claimed-elsewhere` and `opened-on` in both languages (D-12). `nameTaken` loses its
  `refs/remotes/origin/<id>` check, which moves to D-1 step 2. Check: the phase-1 tests, T-1 and T-4
  and T-5 of D-14 pass, and `project-loop.test.mjs`'s slice opens (`project-loop start: open ...`)
  are unchanged (they pass no `claim`); gate 1.4 runs them all.
- [x] 1.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^project-loop start: open" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green, a background command (14 existing tests, 40 s on the base); covers AC-1, AC-2, AC-3, AC-4 and the claims budget of `coordination-locks`.

## 2. The place on the change's side (AC-10, AC-11)

- [x] 2.1 Write this phase's tests (design D-9; spec `change-coordination` "The implementation waits
  for a free place on its machine" and "Taking a place is checked again and serialized per machine";
  spec `roadmap-coordination` the scenario "Waiting for a place"; spec `coordination-locks` the
  scenario "The stop lock of a change waiting for a place"), in `change-loop.test.mjs`: the AC-10
  tests and `remote AC-11 place: a wake that comes too early leaves the change waiting`. Also
  `remote AC-10 stop: the blocked end no-place lets a /devkit change run stop`. Fixtures: a change
  claimed with `x-devkit-places: 1` (and `2`, and `run` with a run file holding `places: 1`), its plan
  stages passed and `approval.md` written. The other changes of its machine are pushed branches of a
  second clone, with and without `approval.md`. The two-at-once test starts two child processes of
  `change-loop.mjs place`. Run them on `c561553` and save the output to
  `openspec/changes/remote-worker/proof/red-2.txt`. Check: every new test fails there for a missing
  behaviour.
- [x] 2.2 Create `plugins/openspec/hooks/run-file.mjs` and move `emptyRun`, `readRun` and
  `runFilePath` there unchanged. `roadmap-loop.mjs` imports and re-exports them (D-9). Check: `git
  grep -n "function readRun" plugins/openspec/hooks` names only `run-file.mjs`, and the existing
  `roadmap-loop run` and `run file` tests pass (gate 2.4 runs them; every other one runs at 5.10).
- [x] 2.3 In `change-loop.mjs`: `placeFacts` and its read in `nextAction` (only in the delivery part,
  only with `x-devkit-places`; the `claims` option of `nextAction`, D-3); the `take-place` step and the `no-place` end in `buildPart`; the
  `place` subcommand with its lock, its plan commit, its count and its push (exit 0, 2 or 3); ⏳ in
  `stageIcon` for the `no-place` end; the keys `waiting-place` and `blocked-why.no-place` (D-12); the
  usage line. Check: the phase-2 tests pass, and `node plugins/openspec/hooks/change-loop.mjs place`
  with no id exits 3 with the usage.
- [x] 2.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^change-loop open" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-loop lock stop" --test-name-pattern="^change-loop withLockFile" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups AC-5 run file" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green, a background command (86 existing tests, 141 s on the base); covers AC-10 and the change's side of AC-11.

## 3. What is open where: the setting, the claims, the board and the probe (AC-5, AC-6, AC-7, AC-12)

- [x] 3.1 Write this phase's tests (design D-4 to D-6, D-16; spec `roadmap-coordination` "The
  person's machines setting", "A line open on another machine is never opened again", the MODIFIED
  "Every open change of the roadmap fills a place" and "The status command shows the whole picture",
  and "A machine that does not answer keeps its changes" for the board), in
  `plugins/openspec/hooks/roadmap-loop.test.mjs`: the AC-5, AC-6 and AC-7 tests and `remote AC-12
  status: a silent machine and its changes read no answer`. Also `remote AC-12 probe: state through
  the injected ssh returns the other clone's changes, and a failing ssh is no answer`. The fake `ssh`
  and the `installed_plugins.json` fixture are D-16's. Run them on `c561553` and save the output to
  `openspec/changes/remote-worker/proof/red-3.txt`. Check: every new test fails there for a missing
  behaviour.
- [x] 3.2 `parseMachines` in `roadmap-loop.mjs` (D-4), the `--machines` option of `run`, `next` and
  `status` with its three refusal keys (D-12), and `userConfig.machines` in
  `plugins/openspec/.claude-plugin/plugin.json` exactly as D-4 gives it. Change T-2 of D-14
  (`roadmap-loop setting: the load_limit user setting`; invariant: the pack declares exactly the user
  settings the skill uses; layer: the manifest; suite: `roadmap-loop.test.mjs`) as D-14 says. Check:
  the AC-7 tests and T-2 pass.
- [x] 3.3 The claims in `collectRoadmap` (`claimsGh`, `claimsReadable`, `claims`), the `elsewhere`
  class of `classifyLines`, the `remote` entries of `entriesOf`, and the drop of a declared end of a
  line open elsewhere (`state.clearDeclared` in `decide`) (D-5). Check: the AC-6 tests pass, and the
  existing `roadmap-loop lines`, `roadmap-loop decide` and `roadmap-loop status` tests pass unchanged
  (gate 3.6 runs them; every other one runs at 5.10).
- [x] 3.4 The board (D-5): the machine suffix, the `remote` rows, the machines block and its count
  line, the unreadable-claims line, `queue.no-machine`, and their keys (D-12). Check: the AC-5 tests
  and the board test of AC-12 pass, and the existing board tests (`roadmap-loop status: ...`) pass
  unchanged.
- [x] 3.5 `plugins/openspec/hooks/machine-probe.mjs` (D-6, Node built-ins only), `askMachine` with the
  injectable `ssh`, `status --json` (one claims read passed to each change's `nextAction`, D-3),
  and the `probe` and `ssh` options of `collectRoadmap`. Check: the probe test passes, and `node plugins/openspec/hooks/roadmap-loop.mjs status --json --lang en` run
  in this worktree prints one JSON object with `version` 1 and `remote-worker` among its `changes`.
- [x] 3.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop lines" --test-name-pattern="^roadmap-loop status" --test-name-pattern="^roadmap-loop setting" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^followups AC-1 status" --test-name-pattern="^followups AC-15 status" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green, a background command (58 existing tests, 38 s on the base); covers AC-5, AC-6, AC-7 and the board of AC-12.

## 4. Placement, the session on another machine and the wake (AC-8, AC-9, AC-11, AC-12)

- [x] 4.1 Write this phase's tests (design D-7, D-8, D-10, D-11; spec `roadmap-coordination` "A
  change opens on the machine with the fewest open changes", "A change on another machine gets its
  session there", "A place is taken from the implementation on", "A freed place tells one waiting
  change to go on", the MODIFIED "Starts are held while the machine is loaded" and "Calling the
  command again resumes from the files", and "A machine that does not answer keeps its changes" for
  the decisions; spec `coordination-locks` "No lock reaches another machine"), in
  `roadmap-loop.test.mjs`: the AC-8, AC-9 and AC-11 roadmap tests, `remote AC-12 next: a silent
  machine gets no change, and its placed change no session`, and the `remote locks stop` test. The
  AC-9 test asserts the whole `session-start` action: its `checkout` array and its `input` with
  `target: 'ssh'`, `host`, `cwd` `<folder>/.claude/worktrees/<id>`, `use_worktree: false`, and the
  prompt `/devkit-openspec:devkit change <id>`. The locks test injects an `ssh` that fails the test
  when called. Run them on `c561553` and save the output to
  `openspec/changes/remote-worker/proof/red-4.txt`. Check: every new test fails there for a missing
  behaviour.
- [x] 4.2 Placement in `decideRoadmap` with `machines` set (D-7): candidates, counts, the order, the
  hold only with no candidate, and the `machine`, `remote` and `places` fields of a `start`. Check:
  the AC-8 tests pass, and the existing decision tests (no `machines`) pass unchanged.
- [x] 4.3 The remote `session-start` (D-8): the action for a `placed` `remote` entry with its
  `checkout` and its `input`, withheld on a turn nobody typed with `roadmap-waits-turn-on`, none for a
  silent machine, with `roadmap-machine-silent` once per silence. Also `roadmap-session-started-on`.
  Check: the AC-9 decision test and the AC-12 decision test pass.
- [x] 4.4 The run file's `placed` field (D-8) in `run-file.mjs` (`emptyRun`, `readRun`) and in
  `decide`, kept by a `run` from another session and cleared by `--fresh`. In the same task, the
  bullet of `placed` in decision 4 of `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`,
  exactly as D-13 gives it. Also the `checkout` subcommand of `roadmap-loop.mjs` and the key
  `checkout-failed` (D-12). Check: `remote AC-9 checkout: the worktree is made on the other clone from
  its branch` and T-3 of D-14 pass.
- [x] 4.5 The `wake` action (D-10): the waiting changes of each machine (the local `own` entries read
  when `machines` is set), `free_c`, the `woken:<held>` key, the line `roadmap-woken`, no wake
  without session mode. Then the stop lock's options (D-11): `probe: false`, `claimsGh: OFFLINE_GH`,
  the setting from `CLAUDE_PLUGIN_OPTION_MACHINES`. Check: the AC-11 roadmap tests and the locks test
  pass.
- [x] 4.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" --test-name-pattern="^roadmap-loop decide" --test-name-pattern="^roadmap-loop next" --test-name-pattern="^roadmap-loop run" --test-name-pattern="^roadmap-loop lock stop" --test-name-pattern="^followups AC-7" --test-name-pattern="^followups AC-13" --test-name-pattern="^followups AC-15" --test-name-pattern="^followups F-3" --test-name-pattern="^followups AC-3 run file" --test-name-pattern="^followups ADR 0014" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green, a background command (78 existing tests, 132 s on the base); covers AC-8, AC-9, AC-11 and AC-12 by tests, and the `coordination-locks` delta.

## 5. The skill, the ADRs, the documents and the release

- [x] 5.1 Write `docs/adr/0020-a-change-can-run-on-another-machine.md` (drafted as 0016; renumbered to 0019 at
  the release merge of `212d007` and to 0020 after `37a7063`, D-13) exactly as D-13 gives it, and
  the rest of D-13: the header line and the Note of ADR 0013, the header line and the Note of ADR
  0014, the Notes of ADR 0010 and ADR 0011, and the ADRs line of `openspec/config.yaml`. Check:
  `followups ADR 0014: the documents follow` and T-3 still pass, and `python3 scripts/check.py`
  reports no broken link.
- [x] 5.2 `plugins/openspec/skills/devkit/SKILL.md` as D-15 lists: the `--machines` flag on every
  `roadmap-loop.mjs` call of `run`, `next`, `status` and `checkout`; the `take-place` step; the
  message that resumes a change session; the `start` fields; `session-start` with a `checkout`; the
  `wake` item; the two Never items. Check: `roadmap-loop setting: the load_limit user setting` (T-2)
  finds `machines` among the settings the skill uses, and the existing tests that read the skill
  (`change-loop.test.mjs`, `roadmap-loop.test.mjs`, `flow-check.test.mjs`, `deliver-check.test.mjs`)
  pass unchanged, except T-11, T-12 and T-13 of D-14, which task 5.7 changes (gate 5.10 runs them all).
- [x] 5.3 `docs/openspec-flow.md`, `docs/coordination-design.md` and `plugins/openspec/README.md` as
  D-15 lists, with the two corrected claims of `docs/coordination-design.md` and the CI pins at
  `v0.32.0`. Check: `git grep -n "configures one command" docs`, `git grep -n "Where a change runs (proposed)" docs`
  and `git grep -n -F "(ready, waits for a place)" docs/openspec-flow.md` each find nothing; the pin
  test (T-10 of D-14, no edit) passes:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop docs: the design records" plugins/openspec/hooks/guard.test.mjs`
  exits 0 with 1 test and 1 passing, run as a background command (gate 5.10 runs it again).
- [x] 5.4 The release (D-15): devkit-openspec `0.32.0` in `plugins/openspec/.claude-plugin/plugin.json`
  and `.claude-plugin/marketplace.json`, marketplace `0.36.0`, the `CHANGELOG.md` entry
  `## 0.36.0 — remote worker`, and `python3 scripts/gen-catalog.py` for `docs/catalog.md`. Check:
  `python3 scripts/gen-catalog.py --check` exits 0.
- [x] 5.5 Run `claude plugin validate .` at the merged commit (the manifests at `0.32.0` and
  `0.36.0`) and save its output to `${TMPDIR%/}/devkit-validate-remote-worker/phase-5.txt`,
  replacing the file of the run before the merge. Check: the file holds `Validation passed` and is
  newer than the merge commit `c9f08f0` (the fourth merge of `origin/main`, at `fc01230`). Tasks 5.5,
  5.6 and 5.10 are run again at the final commit, the one that holds task 5.8; a run ticked before
  it does not count.
- [x] 5.6 `openspec validate remote-worker --strict`, at the merged commit with the
  `roadmap-coordination` delta of this revision (its MODIFIED requirement "A change session shows
  the stage its change is in" carries main's 9 scenarios and "Waiting for a place"). Check: it
  prints that the change is valid.
- [x] 5.7 Change T-6 to T-9 and T-11 to T-13 of D-14 exactly as D-14 gives them (T-10 needs no edit:
  the test reads the manifest since `aa7329a`, and task 5.3's check runs it), and nothing else in the two test
  files. The invariants stay as D-14 states them.
  - T-6, `change-loop replies: no internal term in either language`. Invariant: every key renders in
    both languages and holds no internal term. Layer: the message table. Suite:
    `change-loop.test.mjs`. Change: `SAMPLE` gains `entry`, `field` and `name`.
  - T-7, `roadmap-loop replies: a blocked line renders every blocked reason in both languages`.
    Invariant: every blocked `{why}` key renders every reason. Layer: the message table. Suite:
    `roadmap-loop.test.mjs`. Change: `BLOCKED_PARAMS` gains `machine`, `taken` and `places`.
  - T-8, `roadmap-loop replies: every owner wait has a gate`. Invariant: every owner wait has a
    gate, and `gateOf` refuses the rest. Layer: `gateOf`. Suite: `roadmap-loop.test.mjs`. Change:
    `waiting-place` leaves the `waits` filter, and the two assertions that it is a blocked end are
    added.
  - T-9, `followups AC-8 next: start anyway ...`. Invariant: the run file gains no field except its
    write time. Layer: `next --start-anyway` and the run file. Suite: `roadmap-loop.test.mjs`.
    Change: the fixture's `putRun` gets `placed: {}`.
  - T-11 and T-12, `followups F-2 skill: ...` and `followups AC-15 skill: ...`. Invariant: the call
    carries every setting. Layer: the skill text. Suite: `roadmap-loop.test.mjs`. Change: the
    expected call gains `${SK_MACHINES}`.
  - T-13, `followups AC-13 skill: ...`. Invariant: the coordinating session hands nothing, uses no
    wake-up field and sends no message except the ones `next` returns. Layer: the skill text. Suite:
    `roadmap-loop.test.mjs`. Change: `SendMessage` is allowed only on the `wake` line,
    `wake_when_done` stays refused everywhere, and the Never text grows by D-15's two items.

  Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop replies: no internal term" --test-name-pattern="^roadmap-loop replies" --test-name-pattern="^followups AC-8 next: start anyway" --test-name-pattern="^followups F-2 skill" --test-name-pattern="^followups AC-13 skill" --test-name-pattern="^followups AC-15 skill" plugins/openspec/hooks/guard.test.mjs`
  exits 0 with 7 tests and 7 passing, run as a background command (the dry run of 2026-11-22 ran
  these edits with T-10's, 8 tests in 13 s). In `git diff fc01230 -- plugins/openspec/hooks/change-loop.test.mjs
  plugins/openspec/hooks/roadmap-loop.test.mjs` (against `main`'s tip at the fourth merge), no existing test
  changes except T-1, T-2, T-6 to T-9 and T-11 to T-13 (checked at `c9f08f0`: the removed lines are
  `SAMPLE`, T-1's `rev-parse HEAD` assertion, the import line, `BLOCKED_PARAMS`, the `waits` filter,
  the `userConfig` assertion, `putRun` and the T-11 to T-13 lines). The import lines, the new `remote` tests and their helpers are additions. End with
  `git status --short`.
- [ ] 5.8 Change T-14 of D-14 exactly as D-14 gives it, and nothing else in
  `plugins/openspec/hooks/delivery-models.test.mjs`; then, after the merge of `origin/main` at
  `37a7063`, the order of D-1 step 4 in `plugins/openspec/hooks/change-loop.mjs` and T-19 of D-14.
  The invariants stay as D-14 states them. T-14 is done (merge commit `ccb3dfb`); the rest comes
  from the plan revision after `37a7063`. No `version-pin` test is edited (T-16 to T-18: no edit).
  - T-14, `delivery-models open: a two-prs change starts from origin/<base>`. Invariant: a two-prs
    change branches from the remote's base tip, not from the local default branch. Layer: the
    `open` command of `change-loop.mjs`. Suite: `delivery-models.test.mjs`, loaded by
    `guard.test.mjs`. Change: the last assertion becomes two, that the new HEAD's parent
    (`HEAD^`) is `origin/main` and that `origin/main` is an ancestor of HEAD (`git merge-base
    --is-ancestor origin/main HEAD` exits 0). The exit-code and `[b.branch, b.base]` assertions
    stay.

  Before the edit, the check below exits 1 with 10 tests and 1 failing (this test, `evidence.md`
  attempt 3, D-1); that is the red run, not a gate. Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models open" plugins/openspec/hooks/guard.test.mjs`
  exits 0 with 10 tests and 10 passing, run as a background command (18 s on `ccb3dfb` with
  `TMPDIR=/var/tmp`). In `git diff fc01230 -- plugins/openspec/hooks/delivery-models.test.mjs`, only
  T-14's last assertion changes: one removed line and two added (checked at `c9f08f0`, the same three
  lines as against `37a7063`; `main`'s exports of `37a7063` are in both bases).
  - The order of D-1 step 4: `claimOnOrigin` is split into `writeClaimKeys(dir, claim)`, called in
    `openCheckout` right after `openspec new change` and before `recordPin`, and
    `claimOnOrigin({ worktree, id, beforePush })`, which only commits and pushes, after `prepare`.
    The pin lines stay last in `.openspec.yaml`, so main's `version-pin` tests (T-16 to T-18) pass
    unedited; the open's visible behaviour does not change.
  - T-19, `remote AC-4 open: with no origin nothing is committed or pushed`. Invariant: with no
    `origin`, the open commits, pushes and writes no claim key. Layer: the `open` command of
    `change-loop.mjs`. Suite: `change-loop.test.mjs`, loaded by `guard.test.mjs`. Change: its two
    `/x-devkit/` assertions become `/x-devkit-(machine|places)/`.

  Check: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="version-pin" plugins/openspec/hooks/guard.test.mjs`
  exits 0 with 66 tests and 66 passing, and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^remote" plugins/openspec/hooks/guard.test.mjs`
  exits 0 with 41 tests and 41 passing (20 in `change-loop.test.mjs`, 21 in
  `roadmap-loop.test.mjs`), each run as a background command. In `git diff 37a7063 --
  plugins/openspec/hooks/version-pin.test.mjs`, nothing changes. End with `git status --short`.
- [x] 5.9 The amendment of ADR 0017 (D-13, plan revision of 2026-11-23), in the files task 5.1
  wrote: in `docs/adr/0020-a-change-can-run-on-another-machine.md`, the `Amends:` line, decision 5's
  `(⏳, decision 8)`, the new decision 8 and the list of decision 9, each exactly as D-13 gives
  them, its `Status:` left as it is (D-13: the session that records the approval sets it); in
  `docs/adr/0017-a-change-state-is-derived-in-one-place.md`, the header line `- Amended by ADR 0020
  (...)` after `- Status:` and the Note as the first paragraph of its Context, exactly as D-13 gives
  them, with no other line of ADR 0017 changed; in `openspec/config.yaml`, the 0020 entry of the
  ADRs line ending `amends 0013, 0014 and 0017`. Check:
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-state ADR 0017" --test-name-pattern="^followups ADR 0014" --test-name-pattern="^followups AC-3 run file" plugins/openspec/hooks/guard.test.mjs`
  exits 0 with 3 tests and 3 passing (T-15, and the two readers of ADR 0013, ADR 0014 and the
  config line; 19 s on `ccb3dfb` with `TMPDIR=/var/tmp`), run as a background command; `python3 scripts/check.py` reports no broken link; `git diff
  ccb3dfb -- docs/adr/0017-a-change-state-is-derived-in-one-place.md` shows only added lines; and
  `git grep -n "Amends: ADR 0014" docs/adr/0017-a-change-state-is-derived-in-one-place.md` still
  finds the original `Amends:` line. End with `git status --short`.
- [x] 5.10 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-remote-worker/phase-5.txt"` green, the whole suite run once as a background command at the merged commit; covers every acceptance criterion's tests together, with every existing test passing, the tests `main` added since `c561553` included.

## Workflow follow-up

None of these is a task of the change loop: no gate of this change needs them, and none goes to
`tdd-implementer`. They run after the merge, as `CONTRIBUTING.md` says for a fact that exists only
after it.

- After the merge, the delivery loop's `tag-release` step tags `v0.32.0` on the merge commit and
  pushes the tag: main's ADR 0019 (`0019-the-delivery-loop-tags-the-release-it-merged.md`) has
  `deliver-check` answer `tag-release` because `openspec/config.yaml` names the release file
  (`release_tag`, `plugin.json`), and the session pushes the tag before the retro
  (`CONTRIBUTING.md`). Only if the loop does not, the fallback is by hand: `git tag v0.32.0
  <merge commit>` and `git push origin v0.32.0`; a tag by hand at another commit stops the loop at
  its R2 row. Checked on 2026-11-23 against `origin/main` at `fc01230`: `v0.32.0` matches devkit-openspec `0.32.0` in both
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` of this
  worktree (marketplace `metadata.version` `0.36.0`), renumbered from `0.22.0` and `0.26.0` by the
  release merge of `origin/main` at `212d007` (devkit-openspec `0.28.2`, marketplace `0.32.2`), and
  again after `origin/main` at `aa7329a` (devkit-openspec `0.29.0`, marketplace `0.33.0`), and a
  third time after `origin/main` at `37a7063` (devkit-openspec `0.31.0`, marketplace `0.35.0`); the
  fourth merge, of `origin/main` at `fc01230` (devkit-core `0.13.2`, marketplace `0.35.1`), moved no
  number of this change. If
  `origin/main` moves again before the merge, the release merge of D-15 renumbers once more: every
  version number of this change (the tag, the two manifests, the `CHANGELOG.md` heading and the CI
  pins of `docs/openspec-flow.md`, which T-10 of D-14 compares with the manifest) and the ADR number are re-checked against
  `origin/main` at delivery, and the tag takes the number that merged.
- Archive with the retro. The retro proposes, for the owner, a roadmap line for the claim of a
  `/devkit project` slice (left out here, `design.md` Non-Goals), and the roadmap line of the live
  check below. The archive ticks the round 28 line of `openspec/roadmap.md`.
- The live check on two machines (the owner's decision of 2026-11-23, `B: depois do merge`). Where
  it is recorded: a roadmap line, not this change's folder. The retro proposes, as a proposal whose
  target is `openspec/roadmap.md`, a new round `## Round 28b: live checks of a change on another
  machine` with the line `remote-worker-live-checks (after: remote-worker)`, whose text carries L-1
  to L-4 below, as round 18c's `roadmap-live-checks` does for a session per change. That line's
  change records the checks in its own folder, as
  `openspec/changes/remote-worker-live-checks/proof/live.txt`, which its archive keeps; a defect it
  finds is fixed there with its red test. The retro of this change also states that the live part
  of AC-1, AC-3, AC-5, AC-6 and AC-8 to AC-12 was not run before the merge. If the owner rejects the
  proposal, the retro records the answer and the live check is not scheduled.

  The check runs first thing the next time the owner uses two machines: the Mac and the Linux
  worker `avel`, both running the merged version of devkit-openspec, updated on each with `claude
  plugin update devkit-openspec@devkit` as `CONTRIBUTING.md` describes, the same version on both. The owner's `machines` setting on the
  Mac lists `avel` with its folder and 1 place. The records go in order and with their times; each
  starts with the ids of the acceptance criteria it shows (for example `AC-9:`) and holds the
  commands' outputs, and the app's list of sessions where a session is concerned. No connection
  detail beyond the connection name `avel` is written (no address, user or key).

  - L-1 The claim, the race and the board: on `avel`, `/devkit change` opens a scratch change
    `probe-claim`; record the machine name its claim carries (the worker's hostname, R-4). On the
    Mac, `open probe-claim` is refused naming that machine (AC-1), and `/devkit status` lists
    `probe-claim` under way with it, never in the queue (AC-5). A `/devkit roadmap` run whose
    roadmap names `probe-claim` does not open it (AC-6). Then the race against GitHub: the owner
    starts `printf 'Probe the race\n' | node <the pack's hooks>/change-loop.mjs open probe-race
    --script devkit-lite --why small --lang en` in the repository's main checkout on the Mac and on
    `avel` within the same second (one terminal each, started together), and records both outputs
    and `git ls-remote origin refs/heads/probe-race`. Exactly one exits 0, the other exits 3 with
    `claimed` naming the winner and leaves no worktree, folder or branch, and the branch on
    `origin` is the winner's commit (AC-3). Afterwards, the scratch branches `probe-claim` and
    `probe-race` on `origin` and their worktrees on `avel` and on the Mac are deleted only with the
    owner's explicit authorization, asked for at that moment (destructive Git).
  - L-2 Placement and the remote session: with the Mac above its `load_limit` (or with a roadmap
    where the Mac holds more open changes), a typed `/devkit roadmap` opens a ready line for `avel`
    (AC-8). Then `ssh avel true` exits 0 (R-2), `checkout` makes the worktree there, and a session
    starts on the connection `avel` in it, nested under the Mac's session and titled `❓ <id>`
    (AC-9).
  - L-3 The place and the wake: with `avel`'s one place held by a change in its implementation, a
    second change on `avel` reaches its approval and ends ⏳. When the first is archived, the Mac's
    session sends the wake, and the second takes the place and starts its implementation (AC-10,
    AC-11). Record whether the wake was sent on a turn nobody typed (R-7); what the check could not
    reach is named in the record.
  - L-4 A silent machine: with `avel` asleep or its Tailscale down, `/devkit status` on the Mac
    reads "no answer" for `avel` and for each of its changes, and a typed `/devkit roadmap` opens
    the next ready line on the Mac (AC-12).
