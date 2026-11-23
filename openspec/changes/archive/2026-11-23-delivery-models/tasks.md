<!-- devkit-stage tasks result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Tasks

Change: `delivery-models` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, step, message, function, file and test
name is in `design.md`: D-1 the configuration, D-2 the base branch, D-3 opening, D-4 the two pull
requests, D-5 the loop and its readers, D-6 the hook lock, D-7 the CI rules, D-8 the support branch
and the resolution round, D-9 fixes, D-10 the archive, D-11 the shared helpers, D-12 ADR 0015, D-13
documents and release, D-14 the tests. The implementer copies them and makes no design choice; a
helper D-11 names is written once and called, never copied.

Before phase 1, the change coordinator merges `origin/main` into the branch when a sibling
(`merge-staleness-first-parent`, `roadmap-coordinator-followups`) has merged ("Where the siblings
meet" in `design.md`).

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and each `node` part carries its
own `env` prefix. Every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a
pull-request run on CI does: a new test that passes only without them is not done. Every new test's
name starts `delivery-models ` and takes its env from the new suite's fixture, which blanks
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH`. The tests need the `openspec` CLI 2.x and git 2.38 or later on `PATH`. The whole
suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about 13 minutes) runs once, in 6.9, as
a background command. The marketplace check is written `command claude plugin validate .`, so that a
shell function named `claude` is skipped.

Test first in every phase. The phase's first task writes its tests, runs them on the code as it is
and saves the output, as printed, under `openspec/changes/delivery-models/proof/<phase>-red.txt`.
That run is the task's check, never a gate. An existing test is changed only where `design.md` D-14
names it, in the task named there, with its invariant named in the commit message. Leave no backup or
scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `model-chosen-per-project` | 1.1, 1.2, 1.3, 1.4, 1.5, 6.9 |
| AC-2 | `two-prs-open-together` | 2.1, 2.2, 2.3, 2.6 |
| AC-3 | `owner-merges-both` | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6 |
| AC-4 | `base-waits-for-test-branch` | 2.1, 2.2, 3.1, 3.4, 3.5, 3.6 |
| AC-5 | `test-branch-never-in-task-branch` | 3.1, 3.2, 3.3, 3.4, 3.6 |
| AC-6 | `conflict-on-support-branch` | 4.1, 4.2, 4.3, 4.7 |
| AC-7 | `conflict-resolution-reviewed` | 4.1, 4.2, 4.4, 4.5, 4.6, 4.7 |
| AC-8 | `fix-reaches-both` | 2.1, 2.6, 4.1, 4.2, 4.7 |
| AC-9 | `archive-to-both` | 2.1, 2.2, 2.4, 5.1, 5.2, 5.3, 5.4 |
| AC-10 | `proof-in-tests` | 1.1, 2.1, 3.1, 4.1, 5.1, 6.8, 6.9 |

AC-1 lists 6.9 because its second half, no behaviour change for `plan`, `pr` and `merge` projects, is
proven by every existing suite staying green, and only 6.9 runs them all.

## 1. The delivery settings and opening a change (AC-1)

- [x] 1.1 Create `plugins/openspec/hooks/delivery-models.test.mjs` with its env fixture and the tests of
  D-14 P1, P2 and P10 (the open rows and the two setting replies), and add its import to
  `plugins/openspec/hooks/guard.test.mjs` (one line, beside the other suite imports). Check: the run
  on the code as it is fails on the new tests only, saved as `proof/1-red.txt`.
- [x] 1.2 In `plugins/openspec/hooks/guard.mjs`, write `parseDevkitBlock`, `deliverySettings` and
  `readDeliverySettings`, move `plainValue` from `change-loop.mjs`, and export `mainCheckout`, as D-1
  and D-11 say. Check: the P1 tests pass.
- [x] 1.3 In `plugins/openspec/hooks/deliver-check.mjs`, write `deliveryConfig` (D-1's table) and call it
  in place of `shipConfig` in `collectState` and in `plugins/openspec/hooks/flow-check.mjs#collectFlow`;
  `shipConfig` stays exported and unchanged. Check: the P2 tests pass, and the five `change-loop
  settings: …` tests of `change-loop.test.mjs` pass unchanged.
- [x] 1.4 In `plugins/openspec/hooks/change-loop.mjs`, base `readDevkitSettings` on `parseDevkitBlock`
  with the `delivery` field and the `missing` list, make `projectGate` refuse on `missing`, add the
  messages `setting-missing`, `test-branch-missing`, `base-not-default`, `name-test-suffix` and the
  three `setting.delivery-*` codes in both languages (D-5), and make `openUnderLock` follow D-3. In
  `change-loop.test.mjs`, `SAMPLE` gains `branch`, `base` and `default` (data only; D-14). Check: the
  P10 open rows pass, `change-loop open: O4 starts from origin/<default> after a fetch` and `change-loop
  replies: no internal term in either language` pass.
- [x] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-1.

## 2. The two pull requests and the loop's readers (AC-2, AC-3, AC-4 in part, AC-8 without a support branch, AC-9 in part)

- [x] 2.1 Write `simGitHub` and the scenario fixture (a bare origin with `main` and `develop`, a main
  checkout, the task worktree; D-11) in `delivery-models.test.mjs`, and the tests `delivery-models AC-2:
  …`, `delivery-models AC-3: …`, `delivery-models AC-8: …` (its no-support half), `delivery-models AC-9:
  …` (its delivered half), and D-14 P7 rows T0, T2 to T5 and T13 to T18, P8, P10 (`decide` rows, owner
  ends, brief), P12 and P13. Check: the run fails on the new tests only, saved as `proof/2-red.txt`.
- [x] 2.2 In `deliver-check.mjs`: `fetchPr` with `base`, the base filter of `findChangePr`, the model
  through `deliveryOf`, `mergedOnBranch` and `collectState`; `findTestPr`; `state.twoPrs` with
  `defaultOk` and `test` (`support` and `resolution` read as absent until phase 4); `nextStep` rows T0,
  T2 to T5 and T13 to T18; the report's `model` and `twoPrs` (D-4). Check: P7 (those rows), P8 and the
  AC-2, AC-3, AC-9 (delivered half) tests pass; `plan and pr modes: the PR is asked with the 0.4.0
  fields …` passes unchanged.
- [x] 2.3 In `change-loop.mjs`, every new step's `ROWS` entry, `OWNER_STEP`, the owner end's `branch`,
  `base` and `list` params, the three `waiting-` messages in both languages and the brief's support
  root (D-5); in `plugins/openspec/hooks/conduct-check.mjs`, `actorOf` and `stateOf` for every new step.
  Check: the P10 `decide` rows and P13 pass; `change-loop decide: the loop's step agents match
  conduct-check's actorOf` and `conduct: deliveryStep maps every deliver-check step …` pass unchanged.
- [x] 2.4 In `flow-check.mjs#readDelivery` and `TEXT`, the codes `no-test-pr`,
  `owner-merges-test-branch` and `owner-merges-base` in both languages (D-5). Check: P12 passes and
  `flow-check readout: both languages cover every reason code` passes unchanged.
- [x] 2.5 In `plugins/openspec/hooks/roadmap-loop.mjs`, the three `GATE_OF_WHY` entries (D-5), and in
  `roadmap-loop.test.mjs` the `expected` table of `roadmap-loop replies: every owner wait has a gate`
  gains the same three keys (invariant: every `waiting-` key has a gate code). Check: that test passes.
- [x] 2.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green; covers AC-2, AC-3, AC-8 (no support branch) and the delivered half of AC-9.

## 3. The test-branch lock in the hook and in CI (AC-4, AC-5)

- [x] 3.1 Write the tests `delivery-models AC-4: …`, both `delivery-models AC-5: …` tests, and D-14 P3,
  P4, P5 (its settings-source rows S1 to S3 and the base-not-default line included) and P7 row T1. The hook tests run `guard.mjs bash` as a process with a PreToolUse input, as
  the existing bash-hook tests of `guard.test.mjs` do. Check: the run fails on the new tests only,
  saved as `proof/3-red.txt`.
- [x] 3.2 In `guard.mjs`, `testBranchViolation` and its call in `guardBash` after `gitViolation`
  (D-6). Check: the P3 tests and the hook half of AC-5 pass.
- [x] 3.3 In `deliver-check.mjs`, `testBranchCommit` (D-7's rule) and row T1 (D-4). Check: P4 and T1
  pass.
- [x] 3.4 In `deliver-check.mjs`: extract `eventPayload` from `ciPreflight` and write `ciSettingsRef`
  (D-7's table S1 to S3, D-11); in `runCi`, the settings read from the ref `ciSettingsRef` names, the
  base-not-default line, the two rules on a pull request to the base branch for each judged change, and
  the CI report's `twoPrs` with `settingsRef` (D-7). Check: P5, AC-4 and the CI half of AC-5 pass;
  `--ci --json: version 1, mode ci, …` and both `--ci preflight: …` tests pass unchanged.
- [x] 3.5 In `plugins/openspec/skills/openspec-setup/templates/devkit-reviews.yml`, `pull-requests:
  read` and the step's `GH_TOKEN` (D-7). Check: `workflow (<label>): pull_request only, never
  pull_request_target, read-only token` of `merge-setup.test.mjs` passes unchanged for both labels.
- [x] 3.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/merge-setup.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^--ci" plugins/openspec/hooks/deliver-check.test.mjs && python3 scripts/check.py` green; covers AC-4 and AC-5.

## 4. The support branch and the resolution round (AC-6, AC-7, AC-8 with a support branch)

- [x] 4.1 Write the tests `delivery-models AC-6: …`, `delivery-models AC-7: …`, the support half of
  `delivery-models AC-8: …`, and D-14 P6, P7 rows T6 to T12, P11 (in `guard.test.mjs`) and P15 (in
  `plugins/core/skills/review-change/scripts/review-round.test.mjs`). Check: the run fails on the new
  tests only, saved as `proof/4-red.txt`.
- [x] 4.2 In `deliver-check.mjs`: move `listWorktrees` and `rebaseBranch` from `conduct-check.mjs`
  (re-exported there), extract `verdictFiles` from `readReviews` and `findingsIn` from `findingsItem`,
  write `supportState` and `resolutionState`, and rows T6 to T12 (D-4, D-8, D-11). Check: T6 to T12, the
  AC-6 and AC-8 tests pass, and every `item 2`, `item 3` and `conduct:` test passes unchanged.
- [x] 4.3 In `guard.mjs#classify`, `reviews/resolution/<name>.md` belongs to `<name>` (D-8). Check: P11
  passes and the existing verdict-writer tests of `guard.test.mjs` pass unchanged.
- [x] 4.4 In `deliver-check.mjs#runCi`, the rule on a pull request to the test branch, with the
  settings read as 3.4 reads them (D-7). Check: P6 passes, its row with no model in the test branch's
  own copy included.
- [x] 4.5 In `plugins/core/skills/review-change/scripts/review-round.workflow.js`, `args.verdictDir`
  (default `reviews`) on the verdict path (D-8). Check: P15 passes and every existing test of
  `review-round.test.mjs` passes unchanged.
- [x] 4.6 In `plugins/core/skills/review-change/SKILL.md`, the section "Resolution calls"; in
  `plugins/core/agents/code-quality-reviewer.md` and `plugins/core/agents/test-coverage-reviewer.md`,
  the resolution-call sentence (D-8). Check: `python3 scripts/check.py` passes and the AC-7 test's
  reading of those three files (the section heading, the path `reviews/resolution/`) passes.
- [x] 4.7 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^delivery-models" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-6, AC-7 and AC-8 with a support branch.

## 5. The archive to both branches (AC-9)

- [x] 5.1 Write the archive half of `delivery-models AC-9: …` and D-14 P9 (one test per row of D-10's
  table, the stop rows and `exists: true` included) and the `archivedDates` and
  `unfinished` rows of P10. Check: the run fails on the new tests only, saved as `proof/5-red.txt`.
- [x] 5.2 In `deliver-check.mjs`, `archivePrFacts` with the head as a parameter, `onTest`, `testPr` and
  `testLocal` (through `listWorktrees`, moved in 4.2) in `archiveFacts`, and D-10's rows in
  `archiveNext`, its three `stop-archive` rows included. Check: P9 and the AC-9 archive half pass; `P0:
  archived on the default branch is "archived" …` passes unchanged.
- [x] 5.3 In `change-loop.mjs`, `archivedDates` in `two-prs` and the `unfinished` mapping of
  `chore/archive-<x>-<test>` (D-10). Check: those P10 rows pass and the existing `change-loop start:
  S7` to `S11` tests pass unchanged.
- [x] 5.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green; covers AC-9.

## 6. ADR 0015, documents, skills, release and the whole suite (AC-1 to AC-10)

- [x] 6.1 Write `docs/adr/0015-the-delivery-model-is-chosen-per-project.md` with the text of D-12,
  status `proposed`, the date of the day. Check: the file has `## Context`, `## Decision`,
  `## Consequences`, `### Review trigger`, `## Alternatives considered`.
- [x] 6.2 Only when `approval.md`'s owner's words accept ADR 0015: status `accepted` with an `Accepted
  by:` line in ADR 0012's form, and the `- Amended by ADR 0015 (…)` header line in
  `docs/adr/0002-merge-without-the-owner-opt-in.md`, `docs/adr/0003-auto-merge-the-archive-pr.md`,
  `docs/adr/0010-openspec-as-the-harness.md` and `docs/adr/0012-the-reviews-check-follows-the-change-script.md`;
  otherwise stop and report. Check: the five headers read as D-12 says.
- [x] 6.3 The dated Notes of D-12 in the four ADRs, and the ADR 0015 entry of the `ADRs:` line of
  `openspec/config.yaml`. Check: `ADR 0002 exists, is cited by README and docs/openspec-flow.md, and
  says Status: accepted` (`deliver-check.test.mjs`) passes unchanged.
- [x] 6.4 Update `docs/coordination-design.md` as D-13 says. Check: `change-loop docs: the design
  records the answers` and `roadmap-loop docs: the documents follow` pass for this file.
- [x] 6.5 Update `docs/openspec-flow.md` and `plugins/openspec/README.md` as D-13 says, and write
  `delivery-models docs: the documents follow` (D-14 P16). Check: P16 and `docs sweep: "never merges"
  …` pass.
- [x] 6.6 Add the new steps' rows and the `two-prs` paragraph to
  `plugins/openspec/skills/ship-change/SKILL.md`, and the two-PR call and the test-branch archive call
  to `plugins/core/agents/commit-and-pr.md` (D-13). Check: `python3 scripts/check.py` passes and P16
  reads one row per new step in the skill.
- [x] 6.7 Release as D-13 says: `plugins/openspec/.claude-plugin/plugin.json`,
  `plugins/core/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`,
  `python3 scripts/gen-catalog.py` for `docs/catalog.md`, every CI pin of `docs/openspec-flow.md` to
  the new devkit-openspec tag, and the version assertion of `change-loop docs: the design records the
  answers` moved to the new tag with a `doesNotMatch` for the previous one (invariant: the CI snippet
  pins the current release). Check: `python3 scripts/gen-catalog.py --check` passes and `git grep -c`
  of the previous tag in `docs/openspec-flow.md` prints nothing.
- [x] 6.8 Record, in `openspec/changes/delivery-models/proof/ac-map.md`, each acceptance criterion with
  the test name of D-14's AC-10 table and its result in the 6.9 run. Check: ten rows, each naming a
  test that exists in the suite.
- [x] 6.9 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate delivery-models --strict` green (the guard suite as a background command); covers AC-1 to AC-10 and every other suite at once.

## Workflow follow-up

- Evidence (`pr-verifier`), the review bench and one pull request to `main` (devkit ships in `merge`
  mode, ADR 0002); after the merge, tag the devkit-openspec version on the merge commit
  (`CONTRIBUTING.md`).
- The first real use of `two-prs` is a later change of the owner's project (`requirements.md`, "Proof:
  proven here vs first real use").
