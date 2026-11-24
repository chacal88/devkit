<!-- devkit-stage tasks result=passed attempt=2 commit=2aea5d914ea2e8266f2de39f6a5b19696d40d65d -->
# Tasks

Change: `loop-place-and-evidence` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `proposal.md`, `design.md`, `specs/change-delivery/spec.md`).

Work only in this change's worktree, on branch `loop-place-and-evidence`. The how is fixed in
`design.md` (D-1 to D-5). The implementer copies the names, texts and rules from there and makes no
design choice of its own. A choice the design does not settle stops the phase and goes to the owner.

Every gate is one backticked command, run as written. The flow takes the first backticked text
after `Gate:` and runs each `&&` part on its own, so no part holds a `|` (several name patterns are
several `--test-name-pattern` flags). Every hook gate runs with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set, as a pull-request run on CI does. Every suite that a gate runs imports
`deliver-check.test.mjs`. The gates of phases 1 and 3, and the red run of task 1.3, take several
minutes: run each as a background command of the tool, never with a shell `&`. On the Avell, run
them with `TMPDIR=/var/tmp`. The tests need the `openspec` CLI 2.x on `PATH`.

Test first. Task 1.1 and task 2.1 write their phase's tests, run them on the code as it is, and save
the output, as printed, under `openspec/changes/loop-place-and-evidence/proof/`. That run is the
task's check, never a gate. Every new test's name starts `loop-evidence <n>: ` (design D-4).

Existing tests change only where design D-4 names them (E1 to E9), each with its invariant, the
layer that owns it and its suite (CLAUDE.md). Name them in the commit message. Leave no backup or
scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `commit-before-review` | 1.1, 1.2, 1.5, 3.3 |
| AC-2 | `review-after-commit` | 1.1, 1.2, 1.4, 1.5, 3.3 |
| AC-3 | `clean-folder-unchanged` | 1.1, 1.3, 1.4, 1.5, 3.3 |
| AC-4 | `product-dirty-first` | 1.1, 1.2, 1.5, 3.3 |
| AC-5 | `no-uncommitted-verdicts` | 1.1, 1.5, 3.3, and the Workflow follow-up (the real round) |
| AC-6 | `skill-names-the-step` | 2.1, 2.2, 2.3, 2.4, 3.3 |
| AC-7 | `place-wait-untouched` | 1.5, 3.2, 3.3 |

## 1. The checker: commit the change folder before a review round (AC-1 to AC-5, AC-7)

- [ ] 1.1 Write tests `loop-evidence 1` to `loop-evidence 14` in
  `plugins/openspec/hooks/deliver-check.test.mjs` (a new section at the end of the file) and
  `loop-evidence 15` in `plugins/openspec/hooks/change-loop.test.mjs` (right after "change-loop
  decide: B2 commits and pull requests go to the commit agent"), as design D-4's tables say. Run
  `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^loop-evidence " plugins/openspec/hooks/change-loop.test.mjs`
  on the code as it is (it loads `deliver-check.test.mjs` too) and save its output to
  `openspec/changes/loop-place-and-evidence/proof/red-1.txt`. Check: the file names all fifteen
  tests. 1, 6, 7, 8, 9, 10, 11, 12 and 14 fail (7, 12 and 14 read `folderDirty`, which is
  `undefined` before D-1; the others expect the step of D-2); 2, 3, 4, 5, 13 and 15 pass, because
  they pin behaviour that must not change (design D-4, column "Red before D-1/D-2").
- [ ] 1.2 Add the `folderDirty` field to `collectState`'s pre-merge return (design D-1) and the
  `commit` condition inside `nextStep`'s `if (toReview.length)` block (design D-2), with their two
  comments, in `plugins/openspec/hooks/deliver-check.mjs`. Change nothing else in the file. Check:
  tests 1 to 15 pass, and `git diff --stat -- plugins/openspec/hooks/` lists only
  `deliver-check.mjs` and the two test files of 1.1.
- [ ] 1.3 Run the whole `plugins/openspec/hooks/deliver-check.test.mjs` and the test "flow-check AC-6:
  deliver-check gives the same step with and without stage headers" of
  `plugins/openspec/hooks/flow-check.test.mjs` on the code of 1.2, before any edit to an existing
  test, and save both outputs to `openspec/changes/loop-place-and-evidence/proof/red-1b.txt`.
  Check: the failing tests are exactly E1 to E9 of design D-4, or a subset of them. A failing test
  outside E1 to E9 stops the phase: report it, and the plan is revised before any edit.
- [ ] 1.4 Edit E1 to E8 in `plugins/openspec/hooks/deliver-check.test.mjs` and E9 in
  `plugins/openspec/hooks/flow-check.test.mjs`, exactly as design D-4's table says: commit the evidence
  before the call, or add the `commit` step to the recorded sequence. Expected reviewers and rounds
  stay as they are, and no assertion is removed. Check: E1 to E9 pass, and `git diff -U0` of the two
  files shows no removed `assert` line except the three sequence lists of E2 and E7, each replaced by
  its new list.
- [ ] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^loop-evidence " --test-name-pattern="^flow-check AC-6" --test-name-pattern="^change-loop decide: B2" --test-name-pattern="^remote AC-10 stop" --test-name-pattern="^upfront AC-[789] " plugins/openspec/hooks/guard.test.mjs`
  green (a background command); covers AC-1, AC-2, AC-3, AC-4 and AC-5 (the fixture round, test 13),
  and AC-7 (the place-wait tests, unedited).

## 2. The texts: the skill rows and the flow doc (AC-6)

- [ ] 2.1 Write tests `loop-evidence 16` and `loop-evidence 17` in
  `plugins/openspec/hooks/deliver-check.test.mjs`, after "format: ship-change names every next.step
  the checker can return", as design D-4 says. Run
  `node --test --test-name-pattern="^loop-evidence 1[67]: " plugins/openspec/hooks/deliver-check.test.mjs`
  on the texts as they are and save its output to
  `openspec/changes/loop-place-and-evidence/proof/red-2.txt`. Check: both tests are named and both fail.
- [ ] 2.2 Edit rows `commit` and `review` of `plugins/openspec/skills/ship-change/SKILL.md` with the
  exact texts of design D-3. The rest of each row stays byte for byte. No test asserts the replaced
  sentences (`grep -rn "Commit every modified\|lists only the paths outside\|verify and review run next" plugins/*/hooks/*.test.mjs scripts/`
  prints only test 16's lines). The rows are pinned, unchanged, by "format: ship-change names every
  next.step the checker can return" (`deliver-check.test.mjs`), "flow-check AC-3: every writer of a
  stage file names the stage header" (`flow-check.test.mjs`, the `review` row keeps the header) and
  "stage-roles gates: the verify row allows no pull-request comment" (`guard.test.mjs`). Check: test
  16 and those three pass.
- [ ] 2.3 Edit the paragraph "**Order of the delivery steps.**" of `docs/openspec-flow.md` with the two
  insertions of design D-3, and nothing else. The heading is pinned by "AC-6 instructions-follow:
  configs, ship-change, devkit, flow doc and READMEs name evidence before review", and the old
  phrases are refused by "AC-6 instructions-follow: no tracked file outside the records still says
  review before evidence" (both in `deliver-check.test.mjs`). Check: test 17 and both AC-6 tests pass,
  and `python3 scripts/check.py` passes.
- [ ] 2.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^loop-evidence 1[67]: " --test-name-pattern="^format: ship-change" --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^flow-check AC-3: every writer" --test-name-pattern="^stage-roles gates" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`
  green; covers AC-6.

## 3. Release and the whole suite (AC-1 to AC-7)

- [ ] 3.1 Release (`CONTRIBUTING.md`, step 5). Run `git fetch origin main`, then take the next
  minor version of devkit-openspec and of the marketplace after `origin/main`'s at the last merge
  before review. If `jira-entry-followups` or another sibling merged meanwhile, merge `origin/main`
  first and take the versions above its own. Bump devkit-openspec in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and the
  marketplace's own version. Add a `CHANGELOG.md` section above the newest one,
  `## <marketplace version> — the change folder is committed before the review round`, with a
  **devkit-openspec** bullet: `deliver-check` hands the `commit` step before a review round while
  anything under the change folder is uncommitted, the `ship-change` rows `commit` and `review` say
  so, and the CI snippet now pins `v<devkit-openspec version>`. Turn every pin of
  `docs/openspec-flow.md` on the current release into the new version: the four matches of
  `v0\.33\.0` (line 661, the snippet comment; line 662, its URL; line 675, the text and the `gh api`
  command). Line 123 ("at version 2 from devkit-openspec 0.33.0 on") is a release fact, not a pin,
  and stays as it is. In the test "change-loop docs: the design records the
  answers" (`plugins/openspec/hooks/change-loop.test.mjs`), move the pin assertion to the new version,
  extend its invariant comment with this change, and add a `doesNotMatch` on the replaced pin. The
  older sections of `CHANGELOG.md` stay as they are: "**devkit-openspec** 0.33.0" is read by tests in
  `guard.test.mjs` and `roadmap-loop.test.mjs`. Check: `python3 scripts/gen-catalog.py --check` passes;
  `grep -c 'v0\.33\.0' docs/openspec-flow.md` prints 0 (if a sibling moved the pin, the same
  count on the version `origin/main` pins then); `grep -n 'devkit-openspec 0\.33\.0 on' docs/openspec-flow.md`
  still prints line 123; and "change-loop docs: the design
  records the answers", "the pin in docs/openspec-flow.md is the commit sha of v + the
  devkit-openspec version, …" and "AC-8 release-ready: …" (the last two in `deliver-check.test.mjs`)
  pass.
- [ ] 3.2 Check that nothing outside the plan changed. Check:
  `git diff --stat $(git merge-base origin/main HEAD) -- plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/roadmap-loop.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/conduct-check.mjs plugins/openspec/hooks/flow-check.mjs plugins/openspec/hooks/guard.mjs plugins/openspec/schemas openspec/schemas plugins/core plugins/panel plugins/openspec/skills/devkit`
  prints nothing (AC-7: the place wait and the held session keep their code and tests).
- [ ] 3.3 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate loop-place-and-evidence --strict`
  green (the guard suite as a background command); covers AC-1 to AC-7 together with every other
  suite.

## Workflow follow-up

- From gate 1.5 on, the conducting session reads `next` from the worktree's own
  `plugins/openspec/hooks/change-loop.mjs`, not the installed 0.33.0 one (design D-5). Without that,
  the installed loop hands `review` on a dirty folder and AC-5 cannot be shown.
- The conducting session adds to the `verify` dispatch: one Gates row per `&&` part of gates 1.5,
  2.4 and 3.3, with the guard suite run as a background command; AC-5's row is `pass` on test
  `loop-evidence 13`, and its proof cell says that the real round's lines follow (design D-5).
- When `verify` returns: part S of design D-5 (the session's own `commit` hand-off, the next `next`,
  and the folder's status before and after), then the variant cases V0 to V4 on throwaway clones,
  each recorded in the session's scratchpad. The clones are removed by name afterwards.
- After the review round, before the next call to `next`: S's post-round lines (line 2 of every
  `reviews/*.md`, and item 2 of `deliver-check.mjs loop-place-and-evidence --json`). Then one more
  `devkit-core:pr-verifier` dispatch with the S and V records, which rewrites `evidence.md` with the
  "Real-run proof" table (S, V0 to V4) and AC-5's proof from the real round (design D-5). The
  dispatch names the `Commit:` sha: `git rev-parse HEAD` at the dispatch, as `pr-verifier.md`
  records it (F when nothing was committed after S). A line
  marked `(uncommitted changes)` makes AC-5 `fail`.
- The reviewers get the guard suite's result from `evidence.md` instead of re-running it.
- After the merge, the loop's `tag-release` step tags the new devkit-openspec version on the merge
  commit (ADR 0019). The archive ticks the `loop-place-and-evidence` line of round 19b in
  `openspec/roadmap.md`.
