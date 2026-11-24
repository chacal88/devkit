<!-- devkit-stage tasks result=passed attempt=4 commit=bfd5c0a9bf6ac9612041b1dd7fbb39003b86b4fa -->
# Tasks

Change: `delivery-merge-hold` · Date: 2026-11-24 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, ref name, row, key, text and test name
is in `design.md`: D-1 the refs, D-2 joining and the race, D-3 the holder, D-4 the turn facts and the
reach of the lock, D-5 the rows and the conflict rule, D-6 the record, D-7 the change loop and the wait,
D-8 the roadmap run, D-9 the messages, D-10 the documents, D-11 the existing tests, D-12 the proof. The
implementer copies them and makes no design choice. Line numbers below are those of `bfd5c0a` (the merge
of `main` at `ea482c0`, which holds ADRs 0022 to 0024 and devkit-openspec 0.36.0); a later merge of
`main` moves them, and the implementer then finds the same test or paragraph by its name. A later merge
can also move a number: the ADR number (task 5.1), the release (task 5.4), the pin test's tag (task 5.4)
and the last entry of the `ADRs:` line (task 5.2) are each re-read from `origin/main` at the last merge
before review, by the rule those tasks state, never copied from this file.

Every gate is one backticked command, run as written; the flow runs each `&&` part on its own, so no
part holds a `|`, and every gate exits 0 when its phase is done. Every `node --test` gate runs as a
background command of the tool and is judged by its exit code once it ends, never by a foreground
timeout; where the temporary folder is short of inodes (the Avell), run it with `TMPDIR=/var/tmp`.
Every new test is named `merge-turn <AC-n or area> <part>: ...` and lives in the file D-12 names; a gate
runs the tests filtered through `plugins/openspec/hooks/guard.test.mjs`, which imports every test file.
Every env a new test builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`,
`GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`; every gate sets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`, as a
pull-request run on CI does. No test reaches GitHub: `origin` is a bare repository in the test's
temporary folder and pull-request states come from each file's fake `gh`. A fixture that needs the
queue sets the merge mode in its `openspec/config.yaml` (`ship:` with `devkit: merge` or `devkit-lite:
merge`); a fixture of a train project sets `devkit:` / `delivery:` with `model: trunk-auto` and a
`train:` command, as the `delivery-train` fixtures do; a fixture of a CompozyOS project sets
`devkit:` / `driver: compozy`.

Test first in phases 1 to 3: the phase's test task comes before its code tasks; its new tests fail on
the branch head as it is before the phase's first code task, and the failing run is saved as
`openspec/changes/delivery-merge-hold/proof/red-<phase>.txt`. The one exception is a guard test of the
train and CompozyOS exclusions (tasks 2.1 and 3.1) that asserts only today's step or today's refs: it
passes before the code, is listed as passing in the red file, and must still pass at the phase's gate;
one that also asserts a new field (`state.turn` null, `mergeQueue` false) fails first like the others. An existing test is changed only where
D-11 says; one that fails at a gate and is not in D-11 stops the work for a plan revision. Leave no
backup or scratch file in the tree; end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `queue-order` | 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 4.3 |
| AC-2 | `lock` | 2.1, 2.2, 2.3, 2.4, 4.3 |
| AC-3 | `hand-over` | 1.2, 1.3, 2.1, 2.2, 2.4, 3.1, 4.3 |
| AC-4 | `leave-and-rejoin` | 2.1, 2.2, 2.3, 2.4, 4.5 |
| AC-5 | `other-machine` | 2.1, 2.4, 3.1, 3.3 |
| AC-6 | `status` | 3.1, 3.4 |
| AC-7 | `no-run-no-lock` | 2.1, 2.2, 2.4, 3.1, 3.2, 5.4 (and the train and CompozyOS exclusions of ADR 0025 decision 9: 2.1, 2.2, 2.4, 3.1, 3.2) |
| AC-8 | `real-run` | 4.1 to 4.6 |

## 1. The queue on origin (AC-1, AC-3)

- [ ] 1.1 Probe, before any code, that GitHub accepts the refs of D-1: in this worktree, push a create
  of `refs/devkit/merge-queue-probe/<13-digit ms>` pointing at `origin/main`'s commit with
  `--force-with-lease=<ref>:`, list it with `git ls-remote origin refs/devkit/*`, delete it with
  `--force-with-lease=<ref>:<sha>`, list again; then, as D-2 step 4 pushes, one `git push --atomic` that
  creates a second probe ref (`--force-with-lease=<ref>:`) and deletes a third one created before it
  (`--force-with-lease=<ref>:<sha>`), and list again; save every command and its output in
  `openspec/changes/delivery-merge-hold/proof/probe-refs.txt`, ending with the line `verdict: pass`
  when the creates, the listings, the delete and the mixed atomic push all worked, else `verdict: fail` and stop for a plan
  revision (D-1's fallback). Done when the file ends with `verdict: pass` and no `refs/devkit/` ref is
  left on `origin`.
- [ ] 1.2 Write this phase's tests (D-1 to D-3, D-6, D-12). In `deliver-check.test.mjs`: the listing
  parser (marker, entries of both kinds, a malformed line skipped, an empty answer, an id that breaks
  the id rule ignored), the order (key, kind, id; a duplicate of one kind and id), liveness from the
  fake `gh` (merged, closed, none, a failing call counted alive and `unread`; an archive entry read
  through both `archiveHeads` names, one test with the open pull request on `archive-<id>`), the holder
  as the first alive entry. In `change-loop.test.mjs`: `turn --join` into an empty queue (holds the
  turn), behind an entry, already queued (no second entry), with a dead entry pruned in the same push,
  without a marker (exit 3, nothing pushed, a stale record removed); the race of D-2 step 5 with a second
  joiner pushed between the two listings (the late, lower-keyed joiner re-keys behind; the one that listed
  first keeps its place); a refused push retried; five lost tries then exit 3 with no entry of the change
  left on `origin` and the record unchanged; `turn --leave` of one kind, of `all`, of an absent entry;
  `turn --leave` with no marker on `origin` (nothing pushed, the record removed, exit 0) and with a
  listing that fails (exit 3, the record kept); the record of D-6 written, removed, and each corrupt form
  (not JSON, truncated, empty, no `entries`, an entry without `ref`) read as "queued, entries unknown".
  Run them and save the failing run as `proof/red-1.txt`. Done when the file shows each new test failing.
- [ ] 1.3 Implement the reading in `plugins/openspec/hooks/deliver-check.mjs`: the listing (one
  `git ls-remote`, the 15 s timeout constant), the parser, the order and the liveness of D-1 and D-3
  (archive entries through `archiveHeads`), exported for `change-loop.mjs` and `roadmap-loop.mjs`; no new
  import (the CI job downloads only three files, D-4). Done when the reading tests of 1.2 pass.
- [ ] 1.4 Implement `turn` in `plugins/openspec/hooks/change-loop.mjs` (D-2, D-6): `--join` with the
  atomic create-and-prune push, the second listing and the re-key, the retries on a refused push and
  their bound, `--leave`, the record in the git common directory, the JSON output and the exit codes,
  the usage errors in the subcommand's form. Done when the `turn` tests of 1.2 pass.
- [ ] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^merge-turn" --test-name-pattern="^change-loop open" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`
  green, a background command; covers AC-1 (order, race) and AC-3 (a merged holder skipped).

## 2. The lock in the delivery checker and the change loop (AC-1 to AC-5, AC-7)

- [ ] 2.1 Write this phase's tests (D-4, D-5, D-7, D-9, D-12).
  In `deliver-check.test.mjs`, on a repository in merge mode with a bare `origin` holding the marker:
  each row T1 to T9 of D-5 (the holder behind its base gets `update-branch`, then `enable-auto-merge`; a
  waiting change gets `wait-turn` naming the holder and its pull request whether behind, in conflict
  (with `conflict: true`) or up to date; auto-merge on out of turn gets `disable-auto-merge`; a ready
  change outside the queue gets `join-queue`, with `conflict: true` when in conflict; one with its body
  missing and behind gets `edit-pr-body`, never `update-branch`; a holder rejected at its head, with a
  red check, or with a product commit after its entry gets `leave-queue`; a holder whose base merge made
  evidence and reviews stale keeps the turn through `verify` and `review`; an unreadable listing gives
  `wait-turn` with `unreadable` and no `holder` in each of D-4's three cases (a record, a corrupt record,
  this clone's run file with `mergeQueue: true` and no record) and today's step outside them; an
  unreadable listing with a record at `verify` and at `edit-pr-body` gives that step, T2); a stale record
  (no marker on `origin`) on a ready change gives today's `update-branch` or `enable-auto-merge`, never
  `join-queue`; a record from an earlier run with a new marker and no own entry gives `join-queue`; a
  waiting change with an unpushed `openspec/`-only commit or an uncommitted file keeps `wait-turn`
  (`waitable`); `ahead` and the stop at the first alive entry (one `gh` call when the holder is alive and
  first); `since` (base merges, an `openspec/`-only commit, a renumber commit that renames
  `docs/adr/0021-x.md` to `docs/adr/0022-x.md` and edits another file, a product commit named, a head that
  does not descend from the entry); the archive rows on an open archive pull request (an archive holder
  behind gets `update-branch` then `enable-auto-merge`; a failing check gives `leave-queue`; a waiting
  archive gets `wait-turn`); with no marker, no `origin`, `ship` `pr` (`trunk`), `two-prs`, and with
  `turn: false` and `--ci`, the steps of today (AC-7); the local reader of the run file's `mergeQueue`
  (D-4: a missing file, a file that is not JSON and a non-boolean field read false); and the imports of
  `deliver-check.mjs` stay `node:` modules, `./merge-setup.mjs` and `./guard.mjs` (D-4).
  The train rule (D-4, D-5 row T0, ADR 0025 decision 9), in a `trunk-auto` project with
  `devkit.delivery.train` whose bare `origin` holds the marker and an entry of the change, with the
  change's record present and this clone's run file recording `mergeQueue: true`: a change with every
  item met gets `boarded`, never `join-queue`, and `state.turn` is null; the same change behind its base
  and in conflict with it gets `boarded` too (the train's T5), never `wait-turn`; a change carried by an
  open train gets `on-train`; an archive pull request that is ready gets the archive's `boarded`; with
  the same record and `mergeQueue: true` but an `origin` that cannot be listed (a remote URL that does
  not exist), `state.turn` is still null and the step is `boarded`, never `wait-turn` with `unreadable`
  (nothing is listed in a train project); in a `trunk` project with the train key (`ship` `pr`) the
  step is the train's, as without this change; and `deliver-check <id>` in a `driver: compozy` project
  that ships in `merge` mode, with the marker on `origin`, gives the step without a queue and
  `state.turn` null.
  In `conduct-check.test.mjs` (`deliveryRow`, with a real `git merge-tree` conflict in a temporary
  repository): the actors of the three steps; `join-queue` with a conflict outside the release files
  gives the plain `blocked` stop, and two consecutive calls on that change both give the stop and
  neither gives `join-queue`; `join-queue` with a release-only conflict stays `join-queue`; `wait-turn`
  with a conflict outside the release files gives `leave-queue` with the stop's message, and the call
  after the leave (no entry) gives the stop, then the stop again; the holder's conflict outside the
  release files gives `leave-queue`, then the stop on the next two calls; the holder's release-only
  conflict stays `resolve-release-conflict`; an unclassifiable conflict (`conflictedPaths`,
  `conduct-check.mjs` line 355, returns `{ error }` when `git merge-tree` exits other than 0 or 1, made in
  the test by a `ctx.ref` that does not resolve) is treated as outside the release files at the join,
  the wait and the holder; an archive holder whose conflict is outside the
  release files gives `leave-queue`; a waiting change whose ADR number the base took keeps `wait-turn`
  (no `renumber-adr`), and the holder in the same state gets `renumber-adr`; in a train project with
  the marker and an entry on `origin`, a boarded change's row is `boarded`, an archive that left a train
  for a conflict still gets `trainRejoin`'s row, and a `rejoin-train` row is returned as today (none of
  D-5's three rules fires with `state.turn` null).
  In `change-loop.test.mjs`: the rows of the three steps; `wait-turn` with a holder ending
  `waiting-on-github` with `what: 'turn'`, the `turn-waits` reply naming the holder, exit 1, title ⏳
  with the stage icon; `wait-turn` with `unreadable` ending `waiting-on-github` with `why`
  `waiting-github`, `what: 'silent'`, the `waiting-github` reply, the error in `detail.error`, exit 1 and
  no throw, and `waitLoop` over three such polls in a row ending blocked `github-unreadable`; the
  plan-part `leave-queue` (`--kind all`, stage `delivery`) for a change with a record or a corrupt one
  back at its plan (a stage of part `open` or `plan`), once with `x-devkit-flow: 1` and once with
  `x-devkit-flow: 2` in its `.openspec.yaml`, and none, through `backAtPlan`, for a queued change whose
  report ends blocked `gh-error`, `checks-unreadable`, `no-progress`, `ceiling` or `pr-closed`, nor for
  one at a stage of part `build` or `after`; the wait of `waitLoop` ending when the holder's pull request
  merges (the next action is `update-branch`), and when the holder changes; AC-5 with two clones of one
  bare `origin` (one joins and holds, the other joins and waits, then gets `enable-auto-merge` once the
  first's pull request reads merged); `queueable` (D-4, D-7 condition 6): in a train project with the
  marker on `origin`, `next` for a ready change ends at the train's `boarded` end (the `waiting-train`
  reply of the `delivery-train loop` tests), and the same change with a record back at its plan gets
  its plan stage, never `leave-queue`; in a `driver: compozy` project with the marker on `origin`, a
  ready change's `next --view compozy` and `next` give the step without a queue (`enable-auto-merge`),
  never `join-queue`, and with a record back at its plan no `leave-queue`; with a refused train key (the
  model `two-prs`) and a record back at its plan, `nextAction` is not `queueable` and hands no
  `leave-queue`, and `start` still stops with the `train-model` reply as today. Save the failing run as
  `proof/red-2.txt`. Done when the file shows each new test failing, the guard tests of the exclusions
  excepted as the rule above says.
- [ ] 2.2 Implement D-4 and D-5 in `deliver-check.mjs`: the `turn` option of `collectState` (line 1884;
  passed `true` only by the non-`--ci` command in `main`, lines 2664, 2671 and 2675), `state.turn` null in
  D-4's order before any listing (`turn` false, `ship` not `merge`, `trainSuite !== null`, `devkit.driver`
  `compozy`, no `origin`)
  and after it (no marker), D-4's three unreadable cases, the local reader of the run file's
  `mergeQueue` (no import of `run-file.mjs`, D-4), `since` with the renumber rule, the commands, the
  mask in the plain rows (1784, 1785, 1788, 1850), `turnStep` with T0 to T9 (`conflict: true` on
  `join-queue` and `wait-turn`), the archive rows (T0 for a train project's A1 to A5), and the three
  steps in `describeNext` and `summaryOf`. Done when the `deliver-check.test.mjs` tests of 2.1 pass,
  the train-rule tests among them.
- [ ] 2.3 Implement D-5's part in `plugins/openspec/hooks/conduct-check.mjs`: `actorOf` (`MAIN` gains
  `join-queue` and `leave-queue`, `GITHUB` gains `wait-turn` beside `on-train` and `wait-train`), and in
  `deliveryRow` (line 465), after its `disable-auto-merge` and `rejoin-train` returns, the three ordered
  rules of D-5 (no `adrClash` for `wait-turn` and `leave-queue`; the holder's `blocked` stop becomes
  `leave-queue` when `d.state.turn?.own` is set; the conflict rule for `join-queue` and `wait-turn` with
  `conflict: true`, reusing `releaseConflict`), none of them firing with `state.turn` null. Done when the
  `conduct-check.test.mjs` tests of 2.1 pass and the existing `change-loop.test.mjs` test at line 537
  (the rows match the checkers' steps) passes unchanged.
- [ ] 2.4 Implement D-7 and the D-9 keys `turn-waits` and `what.turn` in `change-loop.mjs`: `ROWS`, the
  `github` case of `buildPart` (the holder form and the unreadable form), `queueable` in `nextAction`
  (line 1432: `settings.driver === 'claude' && settings.train === undefined`, from the
  `readDevkitSettings` of line 1437), which passes `turn: queueable` to `collectState` and reads the
  record into `facts.queued` only when `queueable`, the plan-part leave in `decide` through the new
  helper `backAtPlan` (D-7's six conditions, the part read from the flow the change follows), and the two
  existing-test changes of D-11 that belong to this phase (the third is task 5.4's): in
  `change-loop.test.mjs`, `SAMPLE` (line 86) gains `holder: 'add-csv-import'` and
  `ahead: 'add-csv-import'` for the test at line 125, and the fixed row detail of the test at line 563
  (line 568) gains `holder: 'add-csv-import'`; no assertion of either test changes. Done when the
  `change-loop.test.mjs` tests of 2.1 pass (the `queueable` ones included), the tests at lines 125 and 563
  pass with only those parameter additions, and the test at line 537 passes unchanged (D-11).
- [ ] 2.5 Document this phase: in `docs/openspec-flow.md`, the merge-mode steps list ("**Steps**",
  line 484: `join-queue`, `leave-queue`, `wait-turn`), the `waiting-on-github` codes of "A change's
  state" (line 240: `turn`), the `ship-change` merge-mode steps table (lines 607-623) and, in "The
  delivery train" (line 672), one sentence that a project with the key keeps no merge queue in a roadmap
  run (ADR 0025 decision 9); in
  `plugins/openspec/skills/ship-change/SKILL.md`, the rows `join-queue` (run `next.command`, then continue
  the loop; when `next.conflict` is true, stop with `blocked: item 5 (conflict with the base)`: D-5) and
  `leave-queue` (run `next.command`, then continue) and `wait-turn` (report `waiting for the merge turn
  behind <holder> (pull request #<n>)`, or `waiting for the merge turn: the queue on origin cannot be
  read` when `next.unreadable`, and stop, on both hosts, with no `--watch`: D-7), those lines added to
  the Report list, and one Hosts sentence saying the merge turn is not waited on by this skill (the change
  loop's wait or the next invocation reads it), keeping the Hosts words "archive PR" and "twice".
  `grep -n "ship-change" plugins/openspec/hooks/*.test.mjs` lists, among others, the tests that read
  that file (`guard.test.mjs` lines 1128 and 1572, `flow-check.test.mjs` line 1391,
  `delivery-models.test.mjs` line 2149, `delivery-train.test.mjs` line 2334, `deliver-check.test.mjs`
  lines 3131, 3180, 3212, 3226 and 4750, `change-loop.test.mjs` lines 3903 and 7114,
  `release-tags.test.mjs` line 538); none asserts a row this task changes (the `delivery-train` one
  counts the train's rows, which stay), and the three new rows satisfy `deliver-check.test.mjs` line 3211
  (a row per emitted step). Done when `python3 scripts/check.py` passes.
- [ ] 2.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^merge-turn" --test-name-pattern="^nextStep" --test-name-pattern="^merge mode" --test-name-pattern="^item 5" --test-name-pattern="^P" --test-name-pattern="^post-merge" --test-name-pattern="^walkthrough" --test-name-pattern="^--watch at" --test-name-pattern="^--ci" --test-name-pattern="^conduct" --test-name-pattern="^release-merge-conflict" --test-name-pattern="^delivery-train" --test-name-pattern="^change-loop decide" --test-name-pattern="^change-loop next" --test-name-pattern="^change-loop wait" --test-name-pattern="^change-loop replies" --test-name-pattern="^change-loop compozy" --test-name-pattern="^change-state" --test-name-pattern="^upfront" --test-name-pattern="^ship-change" --test-name-pattern="^format: ship-change" --test-name-pattern="^release-tags 3" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`
  green, a background command; covers AC-1, AC-2, AC-3, AC-4, AC-5 and AC-7 for the delivery checker,
  the conduct rule and the change loop (the `upfront` tests cover `session-next` and the run's `wait`,
  which read the same `nextAction`), and ADR 0025 decision 9 for the change: every `delivery-train` test
  (the train's rows, which `main` added in `delivery-train.test.mjs` under that prefix, which no other
  pattern catches), the `walkthrough` merge sequences of D-11 and the `change-loop compozy` tests (the
  CompozyOS driver's `next --view compozy` reads `nextAction`).

## 3. The roadmap run and the board (AC-3, AC-5, AC-6, AC-7)

- [ ] 3.1 Write this phase's tests in `roadmap-loop.test.mjs` (D-8, D-9, D-12): `run` with a bare
  `origin` in a project in merge mode pushes the marker and records `mergeQueue: true`, keeps a marker
  already there; `run` without `origin`, and `run` with an `origin` in a project in `pr` mode, push
  nothing, record `false` and print no line; `run` with `stop` pushes nothing; a refused marker prints
  `roadmap-turn-off` and records `false`; an end (done, stopped, stuck) reached by `next` and one reached
  by `check` each remove the marker and every entry, delete every record file under this clone's
  `<git common dir>/devkit/merge-queue/` with the folder, and record `false`; a refused removal prints
  `roadmap-turn-left`, keeps `true` and the records, and the next decision that ends pushes the removal
  again; a `check` firing while `a` holds and `b` waits leaves every ref on `origin` as it was and, with
  `b`'s `roadmap-loop.mjs wait` recorded in `waits`, leaves that wait running and recorded. In a run with
  a session per change: a hand-over from `a` to `b` with no recorded wait of `b` gives one `wake` with
  `why: 'turn'`, `b`'s machine (this one, and a claim's machine for a change open on another machine,
  AC-5) and `b`'s session name, and the line `roadmap-turn`; the same hand-over reached by a `check`
  firing gives the same wake; a hand-over to a `b` of this clone whose `waits` lists a `github` wait gives
  no wake and no line; no second wake while `b` holds (the holder kept under `announced['turn:merge']`, in
  the colon form beside `machine:<host>` and the place wake's `woken:<n>` value, neither of which it
  touches); none for a first entry; none in a run without a session per change; `readyText` of the turn
  wake; the board's merge-turn block for two deliveries and an archive in both languages (AC-6), no block
  without a marker, the unreadable line; `status` writes nothing. The projects that keep no queue
  (D-8 `keepsQueue`, ADR 0025 decision 9): `run` with a bare `origin` in a `trunk-auto` project with
  `devkit.delivery.train` pushes no marker, records `mergeQueue: false` and prints no line, also with a
  marker and an entry already on `origin` (both left as they are); `run` in a `two-prs` project and in a
  project whose `devkit` script ships in `merge` mode with `driver: compozy` pushes no marker and records
  `false`; `compozy-start` (with the fake CompozyOS binary of the `roadmap-loop compozy` tests) in a
  merge-mode project with an `origin` pushes no marker and writes no `mergeQueue: true`; `status` in a
  `pr` (`trunk`), a `two-prs` and a train project whose `origin` holds a marker and two entries prints no
  merge-turn block and no unreadable line, and `collectRoadmap` gives `mergeTurn: null` with no
  `ls-remote` made (an `origin` URL that does not exist leaves the board unchanged); a `next` of a train
  project whose run file still records `mergeQueue: false` sends no turn `wake` when the entries on
  `origin` change. Save the failing run as `proof/red-3.txt`. Done when the file shows each new test
  failing, the guard tests of the exclusions excepted as the phase rule above says.
- [ ] 3.2 Implement the run-file field in `plugins/openspec/hooks/run-file.mjs` (`emptyRun` line 14,
  `readRun`'s booleans line 41) and, in `roadmap-loop.mjs`, the helper `keepsQueue` (D-8: the Claude
  driver, no train key, `devkit` or `devkit-lite` in `merge` mode, an `origin`; `deliveryConfig` imported
  from `deliver-check.mjs`, line 47, and `readDevkitSettings` from `change-loop.mjs`, line 48), the
  marker at `run` only when `keepsQueue`, and its removal at an end in `decide` (line 1386), shared by
  `run`, `next` and `check` (D-8, D-1's push forms); `compozyStartCmd` (line 1633) is not edited. Done
  when the marker, end and no-queue-project tests of 3.1 pass.
- [ ] 3.3 Implement the wake in `decideRoadmap` (beside the place wake, lines 469-486), `readyText`
  (line 864), `collectRoadmap`'s `mergeTurn` (line 746; read only when `keepsQueue`, else null) and the
  D-9 keys `roadmap-turn`, `roadmap-turn-off`, `roadmap-turn-left` (in `change-loop.mjs`'s `MESSAGES`),
  and add the decision 4 bullet of D-8 to
  `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`, with `mergeQueue` in backticks and
  `origin` not, so the `roadmap-loop.test.mjs` test "followups AC-3 run file" (line 2706) passes
  unchanged (D-11). Done when the wake tests of 3.1 and that test pass.
- [ ] 3.4 Implement the board (D-8, D-9 keys `status-merge-turn`, `turn.*`, `status-turn-unreadable`)
  in `boardOf` (line 552, its block list at 621). Done when the board tests of 3.1 pass and the
  `roadmap-loop.test.mjs` board tests that use `BLOCK_KEYS` (line 4852) pass unchanged.
- [ ] 3.5 Document this phase: in `docs/openspec-flow.md`'s roadmap coordinator section (line 332), the
  periodic check paragraph (line 344: it carries a turn's wake and grants no turn), the run-file
  paragraph (line 346, the `mergeQueue` field), "What it decides and says" (line 354, the turn's
  `wake`, the board's merge-turn block) and a new paragraph "**The merge turn.**" that names the
  projects that keep no queue (`trunk`, `two-prs`, a delivery train, the CompozyOS driver); in
  `plugins/openspec/skills/devkit/SKILL.md`, the `wake` item (line 195) also names "a change whose merge
  turn arrived", on the same line, keeping `select:SendMessage` and "the action's `message` exactly as
  given" (pinned by `roadmap-loop.test.mjs` lines 2670-2673 and 4239-4240); `devkit-session/SKILL.md` is
  not edited (its test at line 3253); in `plugins/openspec/README.md`, the `change-loop.mjs` row (line 29)
  names `place` and `turn`, and the `roadmap-loop.mjs` row (line 31) says it keeps the run's merge queue
  on `origin`. Done when `python3 scripts/check.py` passes.
- [ ] 3.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^merge-turn" --test-name-pattern="^roadmap-loop" --test-name-pattern="^followups" --test-name-pattern="^remote" --test-name-pattern="^upfront" --test-name-pattern="^change-state" --test-name-pattern="^change-loop replies" --test-name-pattern="^stage-models AC-6" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`
  green, a background command; covers AC-3 and AC-5 (the wake), AC-6 and AC-7 for the run, and ADR 0025
  decision 9 for the run (the `roadmap-loop compozy` tests are under `^roadmap-loop`; the
  `stage-models AC-6` tests, which `main` added in `stage-models.test.mjs` and no other pattern catches,
  read and write the run file's `startedSessions` beside the new `mergeQueue`).

## 4. The real run (AC-8)

Run as D-12 says, with the hooks of this worktree, every command and its output appended to the proof
file the task names; each proof file ends with `verdict: pass` only when every check the task lists
holds, else `verdict: fail` and the work stops for a defect fix through the implementer.

- [ ] 4.1 With the plan approval, ask the owner for the `delete_repo` scope (`gh auth refresh -s
  delete_repo`) that 4.6 needs. Create the private scratch repository on the owner's account (`gh repo
  create --private`), run the `openspec-setup` GitHub step on it for merge mode on `devkit-lite` (the
  `devkit` ruleset with `devkit-reviews` required and the strict up-to-date rule), make two clones of it
  in the scratch folder, and record the repository's name, the ruleset (`gh api repos/<repo>/rulesets`)
  and the clones in `proof/scratch-repo.txt`. Done when `merge-setup`'s preflight reads the repository as
  prepared.
- [ ] 4.2 Prepare three changes `p1`, `p2` (first clone) and `p3` (second clone), each touching one
  product file, each with its evidence and its reviews current at its head and its pull request open.
  Each is driven by `change-loop.mjs next` in its clone, with the hooks of this worktree, and every
  hand-off is done by the agent the loop's action names (on `devkit-lite`: the plan stages' agents,
  `devkit-core:tdd-implementer` for the code, `devkit-core:pr-verifier` for `evidence.md`, the
  `review-change` skill's reviewer agents for the reviews); every owner gate the loop hands for a
  scratch change is asked of the owner and recorded from the owner's own message, never answered by
  the session; no review or evidence file is written by hand; start the run in the first clone with
  `roadmap-loop.mjs run` (marker on `origin`, recorded in `proof/l1-delivery-behind-delivery.txt`).
- [ ] 4.3 L-1, a delivery behind a delivery: bring `p1` and `p2` to ready at once; record each
  `change-loop.mjs next` and each step done; check that `p1` joins first and holds, `p2` joins and gets
  `wait-turn` naming `p1` until `p1` merges, then `p2` runs exactly one `update-branch` and one `verify`
  (one whole-suite run of the scratch project) before `enable-auto-merge`, and merges; the board of
  `roadmap-loop.mjs status` printed while `p2` waits. File `proof/l1-delivery-behind-delivery.txt`.
- [ ] 4.4 L-2, an archive behind a delivery: while `p2` holds the turn, bring `p1`'s archive pull
  request to ready; check that it joins and gets `wait-turn` naming `p2`, and merges after `p2` with one
  `update-branch`. File `proof/l2-archive-behind-delivery.txt`.
- [ ] 4.5 L-3, a head that leaves: with `p3` (second clone) holding the turn and another entry waiting,
  commit and push to `p3`'s branch a one-line change of its product file through
  `devkit-core:tdd-implementer` (a commit outside `openspec/` after its entry, D-4 `since`; no review is
  written by hand: the rejected-review leave is proved by the 2.1 tests); check that `p3`'s next step is
  `leave-queue`, that the waiting entry's next loop call gives it the turn with no message sent, that
  `roadmap-loop.mjs next` gives one `wake` naming it, and that `p3`, verified and reviewed again at its
  new head by the same agents, joins at the end. File `proof/l3-head-leaves.txt`.
- [ ] 4.6 End the run (`roadmap-loop.mjs next` with every line done or `stop`), check that `origin`
  holds no `refs/devkit/` ref, delete the scratch repository (`gh repo delete --yes`) and both clones,
  and append both to `proof/scratch-repo.txt` with `verdict: pass`.
- [ ] 4.7 Gate: `grep -q "^verdict: pass$" openspec/changes/delivery-merge-hold/proof/scratch-repo.txt && grep -q "^verdict: pass$" openspec/changes/delivery-merge-hold/proof/l1-delivery-behind-delivery.txt && grep -q "^verdict: pass$" openspec/changes/delivery-merge-hold/proof/l2-archive-behind-delivery.txt && grep -q "^verdict: pass$" openspec/changes/delivery-merge-hold/proof/l3-head-leaves.txt`
  green; covers AC-8 (and AC-1 to AC-4 on real GitHub).

## 5. Records, documents and the release

- [ ] 5.1 Check that this change's ADR (written by the adr-author and renumbered once already, to
  `docs/adr/0025-a-roadmap-run-grants-one-merge-turn-at-a-time.md`) holds the next free number on
  `origin/main` at the last merge before review (0025 at `ea482c0`, where ADRs 0022 to 0024 are taken);
  when another record took that number, the delivery loop hands `renumber-adr` (ADR 0021 decision 7),
  which renames the file to the next free number on `origin/main` at the last merge before review and
  changes every reference this change makes to it (`decisions.md`, `proposal.md`, `design.md`, the specs,
  the ADR notes of 5.2, `docs/`, `openspec/config.yaml`, `CONTRIBUTING.md`); a reference to ADR 0022 that
  names the delivery train (`0022-reviewed-changes-leave-on-a-delivery-train.md`) is another record and
  is never rewritten. Done when `ls docs/adr` shows no duplicate number (`guard.test.mjs` lines 1223 and
  1239).
- [ ] 5.2 Records (D-10): ADR 0002 and ADR 0003 get the
  `- Amended by ADR 0025 (0025-a-roadmap-run-grants-one-merge-turn-at-a-time.md)` header line after
  their ADR 0022 line (line 7 of each) and a dated Note in Context after the delivery-train Note (ADR 0002
  line 20, ADR 0003 line 26); ADR 0013 the same header line after its ADR 0021 line (line 6) and a Note
  after the roadmap-sessions-upfront Note (line 26; its decision 4 bullet came in 3.3);
  `openspec/config.yaml` `context` (the `ADRs:` line, line 32) names ADR 0025 after its last entry (the
  0024 entry at `ea482c0`), in the words of D-10, each with the number 5.1 confirmed (0025 unless 5.1
  renumbered it); no other entry of that line is edited. The tests that read those headers and that line
  (`delivery-models.test.mjs` lines 2130 and 2133, `guard.test.mjs` lines 499 and 1175,
  `stage-models.test.mjs` line 1394, `roadmap-loop.test.mjs` lines 1942, 1958, 2718, 2744, 2752 and 5369)
  assert lines this task keeps. Done when `python3 scripts/check.py` passes.
- [ ] 5.3 Documents (D-10): `docs/coordination-design.md` gains the section "The merge turn" after
  "Where a change runs" (line 577); `CONTRIBUTING.md` lines 17 and 58 say that a roadmap run holds the
  other merges by itself (ADR 0025) and keep the version-number advice; line 58 is in step 5, so it keeps
  every part `release-tags.test.mjs` line 567 pins there (`release_tag`, `tag-release`, the ADR 0019
  link, `` `git tag v<x> <merge sha>` ``, "lightweight", "merge commit").
  `grep -rn "merge window\|hold other merges" --include=*.md .` outside `openspec/changes/archive/` lists
  no other sentence to correct. Done when `python3 scripts/check.py` passes.
- [ ] 5.4 Release: bump devkit-openspec (minor) in `plugins/openspec/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`, and the marketplace version, each to the next version after the
  one on `origin/main` at the last merge before review (devkit-openspec 0.36.0 and marketplace 0.40.0 at
  `ea482c0`, so 0.37.0 and 0.41.0 unless a later merge moved them); a `CHANGELOG.md` section; move the
  CI pin of `docs/openspec-flow.md` (lines 731 and 732 of the snippet, and the "Pin the commit sha"
  paragraph, line 745) to the release's tag as the previous releases did; `python3
  scripts/gen-catalog.py`. The pin is asserted by `change-loop.test.mjs` line 2615 (`/v0\.36\.0/`,
  "compozy-driver: 0.36.0", with the `doesNotMatch` lines for older pins from line 2616): edit that test
  as D-11's row says (the `assert.match` on the new tag, a `doesNotMatch` for the tag it replaces,
  `/v0\.36\.0/` at `ea482c0`, above the one for `/v0\.35\.0/`, and the comment at line 2614 naming this
  change and its release); `deliver-check.test.mjs` line 3816 and `change-loop.test.mjs` lines 2642-2644
  read the version from the manifest and pass unchanged. No flow file changes (no stage changes). Done
  when `python3 scripts/gen-catalog.py --check` and `claude plugin validate .` pass and
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop docs: the design records the answers" --test-name-pattern="^AC-8 release-ready" plugins/openspec/hooks/guard.test.mjs`
  exits 0 (the test at line 2580 that holds the pin assertion, and the test at `deliver-check.test.mjs`
  line 3806).
- [ ] 5.5 `openspec validate delivery-merge-hold --strict` passes; the output saved in
  `proof/validate.txt`.
- [ ] 5.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && grep -q "is valid" openspec/changes/delivery-merge-hold/proof/validate.txt`
  green, the whole suite once (13 to 21 minutes) as a background command; covers every acceptance
  criterion's tests and AC-7's "every existing test unchanged".

## Workflow follow-up

- After the merge, the retro records whether the first real roadmap run with two or more changes in
  delivery used the queue with no relayed message (the practice of 2026-11-23 this change replaces).
- The roadmap line's words ("the same packs") are narrowed by the owner's answer Q1; the retro proposes
  the roadmap line's wording if the owner wants it recorded.
