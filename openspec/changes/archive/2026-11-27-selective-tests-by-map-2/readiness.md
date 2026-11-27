<!-- devkit-stage readiness result=passed attempt=5 commit=7b7355566114e74e8a61ed712bb6227c8c5cdc34 -->
# Readiness review: selective-tests-by-map-2

Round 5, a re-review of the plan after the planner fixed the four blockers (R-1 to R-4) and the two optional items (R-5, R-6)
of round 4. Head `7b735556` (phases 1 and 2 committed; the revised `proposal.md`, `design.md` and `tasks.md` are uncommitted
edits on it). Nothing was fetched. Scope as asked: the revision for code review round 1 (D-2 T-35 line, D-3 "The M5 list", D-5
`currentBranch`), tasks 2.6 to 2.9 and 3.7, tests T-31 to T-35, AC coverage, phase gates, and whether the revision weakens an AC
or ADR 0025 decision 4. The code review's findings are not judged again.
Run on this tree: `openspec validate selective-tests-by-map-2 --strict` (valid; `skip_specs` noted) and `python3 scripts/check.py`
("all checks passed"). The selective gate part and `claude plugin validate .` were not run: the long gate is the caller's, and the
own files have not changed since `evidence.md`'s green row at `02eb93ed` except the plan files.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Each round-4 blocker is closed by an edit I re-derived against the code and the test helpers; no new blocker came up. The code
for 2.7 to 2.9 and 3.7 is not written, and every one of those tasks now names its input, its expected output and a runnable check.

## 2. Scope validation
Classification: correct. The revision adds no AC and no capability. It fixes two behaviours inside D-3 and D-5, pins D-2's CI
base with one test, and records the `release-note.test.mjs` edit that `proposal.md` Impact, the "Pinned rules" table and task 2.6
now name. All five findings of `review.md` round 1 have a task: spec-reviewer (3.6 wording and the proposal's AC-5 bullet),
code-quality F1 (2.7, 3.7), code-quality F2 (2.6, Pinned rules), test-coverage (2.9), architecture (2.8).

## 3. Proposal review
- The "Revised after round 1" bullet, the Impact bullet for `release-note.test.mjs` and the AC-5 bullet are accurate. The AC-5
  bullet's last sentence ("The pr-verifier words the row that way (task 3.6)") now has its task: 3.6 carries the wording.
- `release.md` (frozen by the approval hash) still says "four test files"; the change touches five. It only feeds the changelog
  body, and an edit would ask the owner again. Not a finding.

## 4. Design review
Claims re-derived against live code at this tree:
- `currentBranch(root, env)` is already exported at `plugins/openspec/hooks/deliver-check.mjs:3001` (`DEVKIT_BRANCH ||
  GITHUB_HEAD_REF`, else `git symbolic-ref --short -q HEAD`, its own `catch` gives `''`); `TRAIN_BRANCH` is exported at line 1120
  and `TRAIN_BRANCH.exec(currentBranch(root, env))` is at line 3700. `deliver-check.mjs` needs no edit for 2.8.
- `headBranch` (`scripts/test-suite.mjs:466`) is the only user of `spawnSync` (import line 14, use line 468), and `abbrev-ref`,
  `headBranch` and `spawnSync` occur nowhere else in that file, so 2.8's check
  `git grep -n -e headBranch -e abbrev-ref -e spawnSync -- scripts/test-suite.mjs` can print nothing. The other `abbrev-ref` hits in
  the repo (`conduct-check.mjs`, two test files, `guard.mjs`) are other files.
- `stalenessBase(root, env)` (line 331) reads `GITHUB_BASE_REF` first; `selectOwn` passes `process.env` at `scripts/test-suite.mjs:480`.
  With the `{}` mutation of 2.9 the base falls back to `origin/HEAD`, so T-35's `release` case (own files = diff against
  `origin/release`, B only) fails; with the variable blank both A and B are own, as T-35 says. `branchOwnPaths` (line 358) does the
  diff with `ownDiffPaths(root, tip, head)`, which is the merge-base range, and the branch is not in `origin/release`.
- M5 in `mapProblems` (line 253) walks the four `SUITE_FOLDERS` with `keep = () => true`, as D-3 says. `coveringKey` (line 97)
  returns an exact key, else the longest folder key ending in `/`; M1 on an exact key whose file is gone gives
  `names <path>, which does not exist` (line 238 to 239). T-31's deleted-file case is therefore right to use a folder key, and its
  expected list is empty. T-13 builds its tree with `files()` (no `git init`), so it falls on the walk, as the Pinned rules row says.
- `tree()` (`test-suite.test.mjs:60`) commits everything written in one `base` commit, then switches to `feature`. A `.gitignore`
  in T-33's `files` is therefore in the base, not an own file; `__pycache__/x.pyc` and `.DS_Store` written afterwards are ignored
  and untracked. `dirtyPaths` (`deliver-check.mjs:299`) keeps an untracked, non-ignored file outside `openspec/` and `.claude/`,
  so `stray.tmp` is an own file; `selectTests` S4 finds no key, S5 and S6 do not match, S7 pushes it to `uncovered`, and line 138
  yields `no entry of scripts/test-map.json covers <path>`. T-33 case (2) is writable and its expected line is the code's.
- The repository's `.gitignore` ignores `.DS_Store` and `__pycache__/` (lines 1 and 3), as 3.7 and T-33 say. The real
  `scripts/test-map.json` has no folder key that covers `plugins/openspec/hooks/stray.tmp` (its folder keys are
  `plugins/compozy/kit/templates/`, `plugins/openspec/hooks/fixtures/`, `plugins/openspec/schemas/`,
  `plugins/openspec/skills/devkit/scripts/fixtures/`, `plugins/panel/`), so 3.7 run 2 does print the whole-suite line.

Fail-safe (ADR 0025 decision 4) and ACs: leaving untracked files out of M5 checks fewer paths only where the path is ignored (never
committed, never in CI) or an own file that S7 sends to the whole suite when no key covers it; T-33 case (2) now pins that
argument, and 3.7 run 2 is its real-run twin. A `null` list (no git, an enclosing repository, an empty list) falls back to the
walk, a superset. `currentBranch` over `headBranch` only adds `DEVKIT_BRANCH` as an override; the Risks section now names the stale
`DEVKIT_BRANCH` exposure (R-6). AC-9 (M1) is untouched. No AC is weakened.

## 5. Specs review
`skip_specs: true`; no delta. Not applicable.

## 6. Tasks review
- Every AC id is in a task: AC-1 (1.3, 1.5, 1.7, 2.9, 3.4), AC-5 (2.2, 2.3, 3.1, 3.5, and 3.6 for its wording), AC-7 (1.5, 2.1,
  2.8, 3.4), AC-9 (1.4, 1.5, 1.6, 2.7, 3.4, 3.7); the others are unchanged.
- Phase gates: 2.5 and 3.6 follow 2.9 and 3.7 in the file, and `parseTasks` / `readPhases` take a phase's gate by its `Gate:`
  prefix and the phase header, not by id order (checked in round 4). Each gate is one backticked command; the rows of `02eb93ed`
  go stale at the next commit and the gates run again, as 2.5 and 3.6 say.
- Test first holds for 2.7 (T-31 and T-33 fail today because the walk refuses a stray file) and 2.8 (T-34's `DEVKIT_BRANCH=train/4`
  case fails today, because `headBranch` ignores it). 2.9 is test-only and proves the bite by a one-run mutation, the red line
  recorded in the commit message.
- R-3 is closed: 2.8 is committed before 2.9 starts, and `git diff --quiet HEAD -- scripts/test-suite.mjs` is a runnable command
  that exits 0 once the mutation is restored (T-35 lives in the test file, so it does not count against it).
- R-4 is closed: 3.6 words the AC-5 row `pass:` plus what is proven here and what is next-change dogfood, never a bare `pass`.
- Task 2.6 names its invariant, layer, suite and the name exception; its anchors check (`ADRS_LINE_TAIL` line 895, `documents:`
  subtest line 999, new test from line 935; the design says "934 to 944", one line early, harmless).

## 7. Omission detection
Validation, error handling (a `null` list, a git failure, a `''` branch), side effects, test strategy (T-31 to T-35 with concrete
expected lines, case (k) as the real run), rollout (`--own-files` only, the whole run unchanged), migration and observability: no
gap that changes behaviour. The test files' own conventions (name prefix, commit message with invariant, layer and suite) are in
the tasks preamble.

## 8. Execution risks (top 5 failures)
1. A T-32 sub-case builds a git tree that tracks no suite file: `tree()` links `deliver-check.mjs` under the hooks folder by default,
   which makes the list non-empty. Cause: the helper's default. Impact: the test would assert the wrong fallback. Prevention: the
   implementer passes `link: false` or builds the folder with `files()` plus `git init`; the expected result is written in T-32.
2. The 2.9 mutation is left in by hand. Prevention: the `git diff --quiet` check before the commit.
3. T-33 (2) needs a map with no folder key over the stray path; `eMap()` has exact keys only, so it holds.
4. The AC-5 row reverts to a bare `pass` at the next verifier run. Prevention: the 3.6 sentence.
5. Load on the machine during gates 2.5 and 3.6 (a watch test flakes under load). Prevention: the preamble's load and disk checks.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] `design.md` line 590 says the new `release-note` test is on "lines 934 to 944"; it starts at 935. Harmless.
- [ ] T-32's third sub-case could say it needs `link: false` (or a folder made with `files()` and `git init`); the implementer
  finds it on the first run.

## 11. Explicitly out of scope
- [ ] The code review's five findings themselves, and the code for 2.7 to 2.9 and 3.7 (not written yet).
- [ ] `release.md`'s "four test files" (held by the approval hash).
- [ ] The commit message of `02eb93ed`, which does not name the invariant; task 2.6 and the Pinned rules table now do.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes; each revision names the failing input, the rule and the test.
2. Is the result measurable? Yes; T-31 to T-35 and case (k) have concrete expected lines and exit codes.
3. Are error behaviors defined? Yes: `null` list, git failure, `''` branch, an uncovered own file, each with its fallback.
4. Are edge cases covered? Yes: untracked, ignored, staged, deleted-and-covered, enclosing repository, empty list, uncovered own file.
5. Are dependencies clear? Yes: 2.7, 2.8 and 2.9 are independent (2.9 after 2.8's commit); 3.7 follows 2.7; gates follow all.
6. Are contracts defined? Yes: `trackedSuitePaths(root, env)`, `mapProblems(root, map, suite, env = process.env)` and the
   `currentBranch(root, process.env)` call are written.
7. Can two developers interpret this differently? Not on any behaviour; only on how T-32's no-tracked-file tree is built (Low).
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes, for the five review findings and every AC.
10. What will be discovered too late? Nothing material; the CI half of AC-7 is in the workflow follow-up by design.

## 13. Final conclusion
- Can we start? Yes: implement 2.7, 2.8, 2.9 (in that order, 2.8 committed before 2.9), then gate 2.5, then 3.7 and gate 3.6.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? The two Low items above cost one failed first run at most.
