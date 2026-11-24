<!-- devkit-stage tasks result=passed attempt=1 commit=5d255b1e77f67a5628a3f1f7dabbcfe8f0147634 -->
# Tasks

Change: `stale-only-on-own-files` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, name, text and test name is in
`design.md`: D-1 the base, D-2 the own files, D-3 the walk, D-4 the call sites, D-5 the rejected
verdict, D-6 the documents, D-7 the existing tests this plan changes, D-8 the new tests and the
real-run proof. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every new test is named `own-files <AC-n> <area>: ...` as D-8 names it, in the file
D-8 names; the gates run them through `plugins/openspec/hooks/guard.test.mjs`, which imports every
hook test file. Every env a new test builds blanks `DEVKIT_BYPASS`, `DEVKIT_BRANCH`,
`DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through the file's
shared constant, and every folder it makes comes from `test-tmp.mjs` with a `devkit-` prefix
(CONTRIBUTING). Every gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request
run on CI does; on a machine short of inodes in `/tmp`, run it with `TMPDIR=/var/tmp`. Every
`node --test` gate runs as a background command of the tool and is judged by its exit code once it
ends. The phase gates 1.5 and 2.5 run only the groups their phase touches; gate 3.8 runs the whole
suite once (13 to 21 minutes, longer on a loaded machine).

Test first in phases 1 and 2: the phase's test task comes before its code task, its new tests fail on
the plan base `5d255b1`, and the failing run is saved as
`openspec/changes/stale-only-on-own-files/proof/red-<phase>.txt`. An existing test is changed only
where D-7 names it. Leave no backup or scratch file in the tree; end every task with
`git status --short`.

| Id | Tasks |
|---|---|
| AC-1 | 1.1, 1.3, 2.1, 2.3, 3.6 |
| AC-2 | 1.1, 1.3, 2.1, 2.3, 3.6 |
| AC-3 | 1.1, 1.3, 3.6 |
| AC-4 | 1.1, 1.3, 2.2, 3.6 |
| AC-5 | 1.1, 1.3, 3.6 |
| AC-6 | 1.1, 1.3, 1.5 |
| AC-7 | 1.1, 1.2, 1.3, 3.6 |
| AC-8 | 1.1, 1.4, 3.6 |
| AC-9 | 3.1, 3.2 |
| AC-10 | 3.6 |

## 1. The own-files rule in the delivery checker (AC-1 to AC-8)

- [x] 1.1 Write the `own-files` tests of D-8 that live in `plugins/openspec/hooks/deliver-check.test.mjs`
  (every row of the D-8 table except the AC-9 docs test), with the `ownRepo()` fixture D-8 describes;
  run them on the plan base and save the failing run as `proof/red-1.txt`. Done when each listed test
  exists by its D-8 name and `red-1.txt` shows them failing.
- [x] 1.2 In `plugins/openspec/hooks/deliver-check.mjs`, add `stalenessBase` (D-1) and `ownFiles` (D-2),
  both exported, and the `base` field of `gitFacts` (D-4). Done when the `own-files AC-7 base` and
  `own-files AC-7 own` tests pass.
- [x] 1.3 In the same file, extend `staleness` with the `own` option and the two memoized sets (D-3),
  pass `own` from `tasksItem`, `acceptanceItem` and `readReviews` (approved or declined verdicts only,
  D-5), and compute the facts with the base in `collectState` (D-4). Done when every `own-files AC-1`
  to `AC-7` test passes and T-1 of D-7 runs unchanged and green.
- [x] 1.4 In the same file, compute the facts with `stalenessBase(root, env, null)` in `runCi` (D-4). Done
  when `own-files AC-8 ci` passes from both entries and the `--ci` tests (T-6) are green.
- [x] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^own-files" --test-name-pattern="^staleness" --test-name-pattern="^merge-staleness" --test-name-pattern="^item " --test-name-pattern="^review-openspec-fix" --test-name-pattern="^review-writer-prompt AC-8" --test-name-pattern="^--ci" --test-name-pattern="^nextStep" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1 to AC-8 at the checker and AC-6 by the unchanged per-reviewer tests.

## 2. The stage checker and the loop (AC-1, AC-2, AC-4)

- [x] 2.1 Write the two `own-files` stage tests of D-8 in `plugins/openspec/hooks/flow-check.test.mjs`;
  run them on the plan base and save the failing run as `proof/red-2.txt`. Done when both exist by
  name and fail there.
- [x] 2.2 Rewrite `release-merge-conflict 8` in `plugins/openspec/hooks/conduct-check.test.mjs` as D-7
  T-4 says (invariant: after a release merge that is not pushed, the loop runs what the merge made
  stale, then hands a plain `git push`; layer: the loop over `collectState`; suite: `guard.test.mjs`):
  (a) the release-only merge hands `push` with `['git', 'push', 'origin', 'b']` and no `verify`;
  (b) a merge whose origin also changes a file the branch changed hands `verify` first, then `push`
  after `reviewedAt`. Done when (a) fails on the plan base (its run added to `proof/red-2.txt`) and
  both pass on the phase 1 code, which the loop reads through `collectState`.
- [x] 2.3 In `plugins/openspec/hooks/flow-check.mjs` `collectFlow`, compute `gf` with the base and pass
  `own` in `facts.staleness` (D-4). Done when the two stage tests pass and T-2 of D-7 is green.
- [x] 2.4 In `plugins/openspec/skills/devkit/SKILL.md`, change the `resolve-release-conflict` sentence to
  the D-6 wording, and the pinned string of `release-merge-conflict 16` in
  `plugins/openspec/hooks/change-loop.test.mjs` with it (D-7 T-3: invariant, the skill describes the
  release step as a merge and a plain push; docs layer; `guard.test.mjs`). Done when that test passes
  with its other assertions untouched.
- [x] 2.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^own-files" --test-name-pattern="^merge-staleness" --test-name-pattern="^flow-check stages" --test-name-pattern="^review-openspec-fix" --test-name-pattern="^review-writer-prompt AC-8" --test-name-pattern="^release-merge-conflict" --test-name-pattern="^delivery-models P5" --test-name-pattern="^delivery-models P7" --test-name-pattern="^delivery-models AC-5" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2 and AC-4 at the stage checker and the loop, and T-2 to T-5, T-7.

## 3. Documents, decisions, release and proof (AC-9, AC-10)

- [x] 3.1 Update `docs/openspec-flow.md` at the six places of D-6, `CONTRIBUTING.md` at its two, and
  `plugins/core/skills/review-change/SKILL.md` at its one. Done when `python3 scripts/check.py`
  passes and none of those files still says that any merge of the base outside `openspec/` stales
  the evidence and the reviews.
- [x] 3.2 Write `own-files AC-9 docs` in `plugins/openspec/hooks/deliver-check.test.mjs` (D-8). Done when
  it passes on the 3.1 text.
- [x] 3.3 Add the "Amended by ADR 0025" line and the dated Note to
  `docs/adr/0002-merge-without-the-owner-opt-in.md`, and append ADR 0025 to the `ADRs:` line of
  `openspec/config.yaml` (D-6). If `origin/main` took 0022 by the last merge before review, take the
  next free number on `origin/main` and renumber the ADR file and every reference this change made
  (CONTRIBUTING step 5). Done when the ADR tests that read the `ADRs:` line stay green at gate 3.8.
- [x] 3.4 After the owner approves the plan, set `- Status: accepted` and the `- Accepted by:` line in
  ADR 0025, as ADR 0020 does, citing `openspec/changes/stale-only-on-own-files/approval.md`. Done when
  the header holds both lines.
- [x] 3.5 Release: bump devkit-openspec and devkit-core to the next free minor version on `origin/main`
  at the last merge before review, in each `plugin.json` and in `.claude-plugin/marketplace.json`
  (and the marketplace version), add the `CHANGELOG.md` entry, move every CI pin of
  `docs/openspec-flow.md` to the new devkit-openspec version, and run `python3 scripts/gen-catalog.py`.
  Done when `python3 scripts/gen-catalog.py --check` passes and the pin tests stay green at gate 3.8.
- [x] 3.6 Real-run proof P-1 to P-7 of D-8 with the CLIs on a scratch repository with a bare `origin`,
  written to `openspec/changes/stale-only-on-own-files/proof/real-run.md`, one section per case with
  its commands and outputs; the scratch folder removed afterwards. Done when every case shows the
  outcome its AC states (AC-1 to AC-5, AC-7, AC-8).
- [x] 3.7 Run `claude plugin validate .` and save its output to
  `${TMPDIR%/}/devkit-validate-stale-only-on-own-files/phase-3.txt`. Done when the file holds
  `Validation passed`.
- [ ] 3.8 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate stale-only-on-own-files --strict && grep -q "Validation passed" "${TMPDIR%/}/devkit-validate-stale-only-on-own-files/phase-3.txt"` green, the whole suite once as a background command at the final commit (after the last merge of `origin/main`, with the tests `main` added since `5d255b1` run by name first, CONTRIBUTING); covers every acceptance criterion's tests together and AC-9.

## Workflow follow-up

- After the change's pull request merges: tag the release `v<devkit-openspec version>` on its merge
  commit (CONTRIBUTING, the tag rule).
- At the archive: tick only the `stale-only-on-own-files` line of `openspec/roadmap.md`
  (`requirements.md`, Out of scope: `fresh-base-check` and `post-merge-validate` are changes of
  their own).
