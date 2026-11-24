<!-- devkit-stage tasks result=passed attempt=3 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Tasks

Change: `delivery-train` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, step, message, function, file and test
name is in `design.md`: D-1 the setting, D-2 boarding in the checker, D-3 the boarded set and its order,
D-4 the train record, D-5 the departure, D-6 the join, D-7 the suite and the red train, D-8 the train's
pull request, D-9 after the merge, D-10 the CI train mode, D-11 the tasks item and the evidence, D-12
ADR, documents and release, D-13 the tests and the real run. The implementer copies them and makes no
design choice.

Before phase 1, and again before 6.5, the change coordinator merges `origin/main` into the branch when
a sibling has merged ("Where the siblings meet" in `design.md`).

Every gate is one backticked command, run as written; the flow runs each `&&` part on its own, so no
part holds a `|`, and each `node` part carries its own `env` prefix. Every hook gate runs with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does. Every new test's name
starts `delivery-train ` and takes its env from the new suite's fixture, which blanks `DEVKIT_BYPASS`,
`DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`. The tests
need the `openspec` CLI 2.x and git 2.38 or later on `PATH`, and run with `TMPDIR=/var/tmp` on the
owner's machine. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes)
runs once, in 6.9, as a background command of the tool. The marketplace check is written `command
claude plugin validate .`.

Test first in every phase: the phase's first task writes its tests, runs them on the code as it is and
saves the output, as printed, under `openspec/changes/delivery-train/proof/<phase>-red.txt`; that run is
the task's check, never a gate. An existing test is changed only where `design.md` D-13 ("Existing tests
this plan touches") names it, in the task named here, with its invariant in the commit message. Leave no
backup or scratch file in the tree (every scratch worktree of a test or of the departure is removed),
and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `train-opt-in` | 1.1, 1.2, 1.3, 1.5, 2.1, 2.3, 2.4, 4.2, 6.9 |
| AC-2 | `boarding-at-review` | 2.1, 2.3, 2.4, 2.5, 3.2 |
| AC-3 | `merge-of-main-costs-nothing` | 2.1, 2.3, 2.6 |
| AC-4 | `train-departure` | 1.1, 1.4, 3.1, 3.2, 3.3, 3.4, 3.7 |
| AC-5 | `one-full-run` | 2.1, 2.2, 3.1, 3.3, 3.7, 4.1, 4.2, 5.3 |
| AC-6 | `train-check` | 4.1, 4.2, 4.3, 4.4 |
| AC-7 | `red-train` | 3.1, 3.3, 3.7 |
| AC-8 | `join-conflict` | 1.1, 1.4, 1.5, 3.3, 3.7 |
| AC-9 | `archives-board` | 1.5, 2.1, 2.4, 3.2, 4.2, 5.4 |
| AC-10 | `delivered-by-train` | 2.1, 2.3, 2.4, 3.4, 5.1, 5.2, 5.5, 6.6, 6.8 |
| AC-11 | `adr-and-docs` | 1.6, 2.6, 3.6, 4.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.9 |
| AC-12 | `real-run-proof` | 6.6, 6.7, 6.8, 6.9 |

AC-1 lists 6.9 because its second half, no behaviour change without the key, is proven by every
existing suite staying green, and only 6.9 runs them all.

## 1. The setting and the join (AC-1, AC-4, AC-8, AC-11)

- [x] 1.1 Create `plugins/openspec/hooks/delivery-train.test.mjs` with its env fixture and the tests of
  D-13 P1, P2, P6 and P7, and add its import to `plugins/openspec/hooks/guard.test.mjs` (one line, beside
  the other suite imports). Check: the run on the code as it is fails on the new tests only, saved as
  `proof/1-red.txt`.
- [x] 1.2 In `plugins/openspec/hooks/guard.mjs`, add `train` to `DELIVERY_KEYS`, `trainUnclosed` in
  `parseDevkitBlock`, and the exports `trainSetting` and `readTrainSetting` (D-1); `deliverySettings`
  keeps its shape. Check: the P1 tests pass and `delivery-models config: ...` tests of
  `plugins/openspec/hooks/delivery-models.test.mjs` pass unchanged.
- [x] 1.3 In `plugins/openspec/hooks/deliver-check.mjs#deliveryConfig` add `train` and the three
  `ShipConfigError` texts; in `plugins/openspec/hooks/change-loop.mjs` add `settings.train` to
  `readDevkitSettings` only when `suite` or `problem` is set, the train refusals to `projectGate`,
  `DELIVERY_ACCEPTED['delivery-train']` and the messages `train-model`, `train-no-model`,
  `setting.delivery-train` in both languages (D-1). Check: the P2 tests pass, `change-loop replies: no
  internal term in either language` passes, and the four `readDevkitSettings` shape tests of
  `plugins/openspec/hooks/change-loop.test.mjs` (lines 52, 216, 3216, 4124) pass unchanged.
- [x] 1.4 In `plugins/openspec/hooks/release-merge.mjs`, the `--merge <rev>` mode with the swapped roles,
  the orientation argument of `mergeStages`, the `chore(train): join ...` message and the JSON fields
  `mode` and `conflicts` (D-6); `--base` keeps its behaviour. Check: the P6 tests pass and
  `plugins/openspec/hooks/release-merge.test.mjs` passes unchanged.
- [x] 1.5 In `release-merge.mjs`, `resolveRoadmapTicks`, the optional `{ roadmap }` resolver of
  `classifyConflict`, used by `--merge` and by `--base` only under the new flag `--roadmap-ticks`, its
  return field `roadmapMerged` (the resolved roadmap text `main` writes, `null` without a resolver), and
  that flag (D-6, D-2 override 4). Check: the P7 tests pass, `--base --roadmap-ticks` resolves a tick
  conflict, and a `--base` run without the flag on a roadmap conflict still exits 2 (P6's and P3b's
  negatives).
- [x] 1.6 In `docs/openspec-flow.md`, the `release-merge.mjs` paragraph gains the `--merge` mode and the
  roadmap tick rule, and a first `### The delivery train` subsection after `### Delivery models` states
  the key, its refusals and that nothing changes without it (D-1, D-6, D-12). Check: `python3
  scripts/check.py` passes.
- [x] 1.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/delivery-models.test.mjs && python3 scripts/check.py` green; covers AC-1 (the setting), AC-4 and AC-8 (the join).

## 2. The record, the train facts and boarding (AC-1, AC-2, AC-3, AC-5, AC-9, AC-10, AC-11)

- [x] 2.1 Extend `simGitHub` in `plugins/openspec/hooks/delivery-models.test.mjs` as D-13 lists (train
  PRs, `headRefName` filters, `mergeCommit`, `gh pr close`, `gh pr comment`, `gh pr merge --auto` and
  `--merge`, a per-PR `autoMergeRequest` and `mergeStateStatus` defaulting to today's `null` and
  `'CLEAN'`, the argument log) and export it, then write in `delivery-train.test.mjs` the scenario
  fixture and the tests of D-13 P3, P3b, P4 and P5, `delivery-train AC-2: ...`, `delivery-train AC-3:
  ...`, the boarding half of `delivery-train AC-9: ...` and the tasks-item half of `delivery-train AC-5:
  ...`. Check: the run fails on the new tests only, saved as `proof/2-red.txt`, and
  `plugins/openspec/hooks/delivery-models.test.mjs` passes unchanged.
- [x] 2.2 In `deliver-check.mjs`, `parseTrainRecord` and its error cases (D-4), and `tasksItem`'s
  `trainParts` (D-11). Check: the P5 parse tests and the tasks-item tests pass.
- [x] 2.3 In `deliver-check.mjs`, `trainFacts`, `state.train` in `collectState` (with `setup` on the
  method `merge` in `trunk-auto`), the `mergeFields` option of `fetchPr`, `findChangePr`,
  `mergedOnBranch` and `deliveryOf` with `prFacts` reading `autoMerge` when the train is on (D-2, "The
  pull request fields in `trunk`"), and the rows T1 to T9 of `nextStep` (D-2). Check: P3 (the change
  rows and the `trunk` field tests, the argument-log negative included), P4, `delivery-train AC-2: ...`
  and `delivery-train AC-3: ...` pass.
- [x] 2.4 In `deliver-check.mjs#archiveNext`, the archive rows A1 to A5 of a train project with
  `state.train` read for the archive (`kind: 'archive'`); in `plugins/openspec/hooks/conduct-check.mjs`,
  override 4 `trainRejoin` called by `deliveryRow` after `releaseConflict`, `serializeArchives` unchanged
  rows with the train on (both reading `ctx.train`, set once by `compute` from `readTrainSetting(root)`),
  and the `actorOf` entries of the six new steps (D-2). Check: P3 (the archive
  rows and auto-merge on an archive PR), P3b and the boarding half of `delivery-train AC-9: ...` pass,
  and `plugins/openspec/hooks/conduct-check.test.mjs` passes unchanged.
- [x] 2.5 In `change-loop.mjs`, the `ROWS` of `boarded`, `on-train`, `wait-train`, `rejoin-train`,
  `close-boarded-pr` and `rejoin-archive`, `OWNER_STEP.boarded`, the `what` of the GitHub end, `GATE_OF_WHY['waiting-train']`
  and the messages `waiting-train`, `what.train`, `gate.train` in both languages, and `unfinished`
  skipping checkouts on `train/<n>` branches (D-2, "Other readers"); in
  `plugins/openspec/hooks/flow-check.mjs#readDelivery`, the train facts (`rejoin-archive` included) and
  their `TEXT` lines; in
  `plugins/openspec/hooks/roadmap-loop.test.mjs`, the `expected` gate table gains `'waiting-train':
  'train'` (invariant: every `waiting-` key has its gate; D-13). Check: the step scan and the actor test
  of `change-loop.test.mjs` pass unchanged, `roadmap-loop.test.mjs` passes, and `change-loop.mjs next` on
  a boarded fixture exits 1 with the `waiting-train` reply, and the `unfinished` tests of P13 pass.
- [x] 2.6 In `docs/openspec-flow.md`, the delivery contract gains the rows T1 to T9, the archive rows A1
  to A5 and override 4 of a train project and the tasks item's train parts; the subsection of 1.6 gains boarding, its order and
  what a merge of the base no longer costs (D-2, D-3, D-11). Check: `python3 scripts/check.py` passes.
- [x] 2.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green; covers AC-2, AC-3, AC-5 (the tasks item), AC-9 (boarding), AC-10 (no auto-merge on a boarded pull request).

## 3. The departure, the verb and the skill (AC-2, AC-4, AC-5, AC-7, AC-8, AC-9, AC-10, AC-11)

- [x] 3.1 Write the tests of D-13 P8, P9, P12 and P13, `delivery-train AC-4: ...`, `delivery-train AC-7:
  ...`, `delivery-train AC-8: ...` and the record half of `delivery-train AC-5: ...`. Check: the run fails
  on the new tests only, saved as `proof/3-red.txt`.
- [x] 3.2 Create `plugins/openspec/hooks/train-loop.mjs` with the boarded set and its order (D-3), the
  numbering, the lock, `writeTrainRecord` and the build of D-5 steps 1 to 3 and 5, removing every scratch
  worktree in a `finally`. Check: P5's round trip, the boarded-set tests of P9 and the join and ordering
  part of `delivery-train AC-4: ...` pass.
- [x] 3.3 In `train-loop.mjs`, `runSuite`, the bisection, the base check and the rebuild without the
  culprit (D-7), and `depart --update` (D-5). Check: P8, `delivery-train AC-7: ...`, `delivery-train
  AC-8: ...` and the record half of `delivery-train AC-5: ...` pass.
- [x] 3.4 In `train-loop.mjs`, `next` with the rows N0 to N15 and `wait`, and the messages `train-off`,
  `train-running`, `train-nothing`, `train-blocked`, `train-base-red`, `train-checks`,
  `train-auto-merge-on`, `train-ready`, `train-delivered` in both languages in `change-loop.mjs`'s table
  (D-5, D-8). Check: P9 and `delivery-train AC-4: ...` pass (a second request starts no train), and
  `change-loop replies: no internal term in either language` passes.
- [x] 3.5 In `change-loop.mjs#startMode`, the verb `train` and the mode `train-args`; `verb-unknown` takes
  the two texts D-5 states ("Where the skill's new text sits"); the Portuguese prefix regex of
  `change-loop.test.mjs` line 975 and of `roadmap-loop.test.mjs` line 808 becomes `^Por enquanto existem
  \/devkit change, \/devkit roadmap, \/devkit status, \/devkit project e \/devkit train` (invariant: the
  reply names every verb that runs, in order; D-13); in `guard.mjs#roadmapRunOf`, `/devkit train` beside
  `/devkit status` (D-5). Check: P12, P13 pass; `change-loop.test.mjs` lines 973 and 976-977,
  `roadmap-loop.test.mjs` line 807 and `plugins/openspec/hooks/project-loop.test.mjs` line 1550 pass
  unchanged.
- [x] 3.6 In `plugins/openspec/skills/devkit/SKILL.md`, the description sentence, the `argument-hint`
  (`| train` between `status` and `project`), the modes `train` and `train-args` in `## Start` and the
  `## Train` section between `## Waiting on GitHub` and `## Roadmap`, as D-5 places each; in
  `change-loop.test.mjs` lines 2439-2440 the heading list gains `'## Train'` after `'## Waiting on
  GitHub'` and the mode list `'train'` and `'train-args'` (invariant: the skill keeps its sections and
  start modes), and in `roadmap-loop.test.mjs` line 1823 the hint becomes D-5's (invariant: the hint
  lists every verb with its arguments); in `plugins/openspec/skills/ship-change/SKILL.md`, the rows
  `boarded`, `on-train`, `wait-train`, `rejoin-train`, `close-boarded-pr`, `rejoin-archive` after
  `ready-base`; in `docs/openspec-flow.md`, the subsection gains `/devkit train`, the departure, the
  record, the red train, the join rules and the train's pull request (D-5, D-12); and `delivery-train
  docs: the documents follow` (P10). Check: P10 and `python3 scripts/check.py` pass, and every other
  row of D-13's table marked 3.6 passes unchanged (`project-loop.test.mjs` 1570-1573,
  `roadmap-loop.test.mjs` 1824-1829, 1836, 1882, 2274, 2282, 2597, `change-loop.test.mjs` 2420,
  `guard.test.mjs` 1076 and 1578-1580, `flow-check.test.mjs` 1385-1392, `delivery-models.test.mjs`
  2118-2134).
- [x] 3.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/delivery-models.test.mjs && python3 scripts/check.py` green; covers AC-4, AC-5 (the record), AC-7, AC-8, AC-10 (auto-merge with the merge method `merge` on the train's pull request).

## 4. `devkit-reviews` on a train (AC-6, AC-9, AC-11)

- [x] 4.1 Write the tests of D-13 P11 (the train parts on a change's own PR, `TRAIN_PIN_FILE` and the
  three-file run included) and `delivery-train AC-6: ...`, and the check half of `delivery-train AC-9:
  ...`. Check: the run fails on the new tests only, saved as `proof/4-red.txt`.
- [x] 4.2 In `deliver-check.mjs`, `ciTrainParts` (with `trainSetting` added to the existing `./guard.mjs`
  import and no other import), the constant `TRAIN_PIN_FILE`, the `{ trainParts }` option of `checkOne`
  and `runSeveral` passed on every devkit change `runCi` judges, and `trainCheck` before
  `selectCiChange` with the failures 1 to 6 of D-10, judging each boarded change and archive in a
  scratch worktree at its own head (D-10). Check: P11, `delivery-train AC-6: ...` and the check half of
  `delivery-train AC-9: ...` pass, and `plugins/openspec/hooks/deliver-check.test.mjs` passes unchanged.
- [x] 4.3 In `docs/openspec-flow.md`, the CI section gains the train mode and the train parts of a
  change's own pull request (D-10), in a sentence after "reads `devkit.delivery` from the default branch,
  and applies rules only in `two-prs`", which stays as it is; P10 gains its assertion on that section.
  Check: `python3 scripts/check.py`, P10 and `delivery-models docs` (`delivery-models.test.mjs`) pass.
- [x] 4.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/delivery-models.test.mjs && python3 scripts/check.py` green; covers AC-5 (the train parts in CI), AC-6, AC-9 (the check).

## 5. After the train merges (AC-5, AC-9, AC-10, AC-11)

- [x] 5.1 Write `delivery-train AC-10: ...` and the delivered-by-train rows of P3 and P4. Check: the run
  fails on the new tests only, saved as `proof/5-red.txt`.
- [x] 5.2 In `deliver-check.mjs`, `isOwnPr` refusing `train/<n>` heads, `deliveryOf` delivered by
  `train.carried`, and the `close-boarded-pr` row before the archive rows (D-2, D-9). Check:
  `delivery-train AC-10: ...` passes, and the existing `deliver-check.test.mjs` tests of `isOwnPr` pass
  unchanged.
- [x] 5.3 In `plugins/core/agents/pr-verifier.md`, the train parts of a gate and their row ending in a
  `train:` cell, read from the default branch's settings, and every part run by a change that edits the
  key (D-11). Check: `python3 scripts/check.py` passes, the agent text names `devkit.delivery.train`
  and `train: proven by the train record`, and `stage-roles roles verifier: ...`
  (`change-loop.test.mjs` 2845-2854) passes unchanged.
- [x] 5.4 In `docs/openspec-flow.md`, the post-merge section gains delivered by a train, the close step
  and the archives on the train; `CONTRIBUTING.md` gains the train cases of D-11 (the merge during
  review, the release step, the tag). Check: `python3 scripts/check.py` passes.
- [x] 5.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green; covers AC-10, AC-9 (no archive branch updated after a merge).

## 6. ADR 0022, documents, release, the real run and the whole suite (AC-1 to AC-12)

- [x] 6.1 Only when `approval.md`'s owner's words accept ADR 0022: renumber it to the next free number on
  `origin/main` at the last merge before review when a sibling took 0019 (the file name, its title and
  every reference in this change); set its status `accepted` with an `Accepted by:` line in ADR 0012's
  form; add the `- Amended by ADR 0022 (...)` header line and the dated Note of D-12 to
  `docs/adr/0002-merge-without-the-owner-opt-in.md`, `docs/adr/0003-auto-merge-the-archive-pr.md`,
  `docs/adr/0012-the-reviews-check-follows-the-change-script.md` and
  `docs/adr/0018-the-delivery-model-is-chosen-per-project.md`; otherwise stop and report. Check: the five
  headers read as D-12 says and `ADR 0002 exists, is cited by README and docs/openspec-flow.md, and says
  Status: accepted` (`deliver-check.test.mjs`) passes unchanged.
- [x] 6.2 The ADR entry on the `ADRs:` line of `openspec/config.yaml` (that line only; the train is not
  switched on here, D-12). Check: `openspec validate delivery-train --strict` passes.
- [x] 6.3 Update `docs/coordination-design.md` section 5 with the train paragraph (D-12). Check: `change-loop
  docs: the design records the answers` and `roadmap-loop docs: the documents follow` pass.
- [x] 6.4 Update `docs/roles.md` (change-coordinator and roadmap-coordinator) and
  `plugins/openspec/README.md` (D-12). Check: `python3 scripts/check.py` passes.
- [x] 6.5 Release as D-12 says, each number the next free one on `origin/main` at the last merge before
  review: `plugins/openspec/.claude-plugin/plugin.json` (minor), `plugins/core/.claude-plugin/plugin.json`
  (patch), `.claude-plugin/marketplace.json`, one `CHANGELOG.md` entry, `python3 scripts/gen-catalog.py`
  for `docs/catalog.md`, and every CI pin of `docs/openspec-flow.md` to the new devkit-openspec tag. The
  pin tests read the manifest's version (`change-loop docs: the design records the answers` in
  `change-loop.test.mjs`, and the pin test of `deliver-check.test.mjs` line 3795), so they stay as they
  are. Check: `python3 scripts/gen-catalog.py --check` passes, both pin tests pass, and `git grep -c` of
  the previous tag in `docs/openspec-flow.md` prints nothing.
- [x] 6.6 Write `delivery-train AC-12: the real run` (D-13): the four cases of D-13's table, each under
  the model the table names (cases 1, 3 and 4 `trunk-auto`, case 2 `trunk`), from fresh scratch
  repositories, spawning `change-loop.mjs start` with `train`, then `train-loop.mjs next` and each
  action's command, with `simGitHub`'s stub `gh` on `PATH`. Check: the test passes, its case 1 log holds
  `gh pr merge <n> --auto --merge --match-head-commit`, its case 2 log holds no `--auto` call, and it
  leaves nothing in `TMPDIR`.
- [x] 6.7 Record, in `openspec/changes/delivery-train/proof/ac-map.md`, each acceptance criterion with the
  test of D-13's table and its result in the 6.9 run. Check: twelve rows, each naming a test that exists
  in the suite.
- [x] 6.8 Run the real run of D-13 by hand in a scratch folder under `/var/tmp` (the four cases, each
  under its model, the departure request typed as the coordinating session sends it), recording each
  command, its output and its exit code in `openspec/changes/delivery-train/proof/real-run.md` (the
  implementer writes this file; `pr-verifier` re-runs the cases and cites it), then remove the scratch
  folder. Check: the file holds the four cases, each naming its model and ending as
  D-13's table says (case 1 merged by auto-merge, case 2 merged by the owner's step, case 3 with `beta`
  left for red, case 4 with `beta` and the archive of `delta` left for conflicts and the archive's
  `stop-archive` naming the spec path).
- [ ] 6.9 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate delivery-train --strict` green (the guard suite as a background command); covers AC-1 to AC-12 and every other suite at once.

## Workflow follow-up

- Evidence (`pr-verifier`), the review bench and one pull request to `main` (this repository still ships
  in `merge` mode until the follow-up below); after the merge, tag the devkit-openspec version on the
  merge commit (`CONTRIBUTING.md`).
- Once the release is installed (`claude plugin update devkit-openspec@devkit`): one pull request that
  sets `devkit.delivery.model: trunk-auto` and `devkit.delivery.train` in `openspec/config.yaml`, after
  `github-setup.mjs --method merge` allows merge commits (D-12). The first train records in its retro
  whether GitHub marked each boarded pull request merged (`design.md`, Open Questions).
- `roadmap-sessions-upfront` makes the coordinating session send `/devkit train` on its own.
