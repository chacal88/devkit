<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `project-phases-followups` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, message, file, fixture and test name
is in `design.md`: D-1 the contract's refusal, D-2 the loop and the message, D-3 the merge comment,
D-4 the tests, D-5 the existing tests, D-6 the documents, D-7 the release. The implementer copies
them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every hook gate runs with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does: a new test that passes
only without them is not done. Every new test takes its env from the file's helpers (`ENV`, `ciEnv`,
`lp`), never from `process.env` directly. The tests need the `openspec` CLI 2.x on `PATH`. On a
machine whose `/tmp` runs short of inodes, prefix the commands with `env TMPDIR=/var/tmp`. The whole
suite (`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) runs once, in 2.4, as a
background command of the tool, never with a shell `&`. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first. Task 1.1 writes the ten tests of D-4, runs them on the unchanged code and saves the
output, as printed, to `openspec/changes/project-phases-followups/proof/red.txt`. That run is the
task's check, never a gate. No existing test is edited, except the CI pin assertion in 2.3 (D-5,
D-7). Leave no backup or scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `commit-does-not-resolve` | 1.1, 1.2, 1.5, 2.4 |
| AC-2 | `record-header-missing-or-malformed` | 1.1, 1.2, 1.5, 2.4 |
| AC-3 | `no-base-ref` | 1.1, 1.2, 1.5, 2.4 |
| AC-4 | `uncommitted-verdict-refused` | 1.1, 1.2, 1.3, 1.4, 1.5, 2.4 |
| AC-5 | `merge-bringing-adr-is-stale` | 1.1, 1.2, 1.4, 1.5, 2.4 |
| AC-6 | `adr-renumbering-note` | 2.1, 2.4 |
| AC-7 | `dogfood-roadmap-line` | 2.2, 2.4 |
| AC-8 | `suite-green` | 2.3, 2.4 |

## 1. The slice contract, the loop and their tests (AC-1 to AC-5)

- [x] 1.1 Write tests `followups 1` to `followups 10` in `plugins/openspec/hooks/project-loop.test.mjs`,
  each with the exact name, fixture and expectation of the D-4 table, in the places D-4 names. Run
  `node --test --test-name-pattern="followups [0-9]+:" plugins/openspec/hooks/project-loop.test.mjs`
  on the unchanged code and save its output to
  `openspec/changes/project-phases-followups/proof/red.txt`. Check: the file holds all ten names;
  6, 7, 8 and 9 fail and 1, 2, 3, 4, 5 and 10 pass, as D-4 expects (a different result is settled in
  this task, as D-4 says, before 1.2).
- [x] 1.2 In `plugins/openspec/hooks/guard.mjs`, make `sliceProblems` name the uncommitted marker
  first in its `Commit:` branch (D-1), and replace the last sentence of the comment above
  `sliceReviewStale` with the three comment lines of D-3; no other line of either function changes.
  Check: `node --test --test-name-pattern="followups (1|2|3|4|5|6|7|10):" plugins/openspec/hooks/project-loop.test.mjs`
  passes, and `node --test --test-name-pattern="^project-loop (ci|hook):" plugins/openspec/hooks/project-loop.test.mjs`
  passes (every existing contract test of D-5 included).
- [x] 1.3 In `plugins/openspec/hooks/project-loop.mjs`, make `readVerdict`'s `usable` false for a
  marked verdict and add the `uncommitted` refusal to `recordReviewCommand` between `no-commit` and
  `other-commit`; in `plugins/openspec/hooks/change-loop.mjs`, add `why.uncommitted` beside
  `why.other-commit` in `en` and in `pt-BR` with the two texts of D-2, as written. Check: tests
  `followups 8` and `followups 9` pass; `node --test --test-name-pattern="^project-loop (next|review|start):" plugins/openspec/hooks/project-loop.test.mjs`
  passes; and `node --test --test-name-pattern="^change-loop replies" plugins/openspec/hooks/change-loop.test.mjs`
  passes (the new key is rendered, translated and clean in both languages).
- [x] 1.4 In `docs/openspec-flow.md` line 323 ("The slice contract"), replace the verdict clause with
  the text of D-6. Check: `python3 scripts/check.py` passes, and
  `git grep -n "recorded with no uncommitted changes, and current" -- docs/openspec-flow.md` prints
  one line.
- [x] 1.5 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/project-loop.test.mjs && env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern=change-loop.replies plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-3, AC-4 and AC-5.

## 2. Records, release and the whole suite (AC-6 to AC-8)

- [x] 2.1 Add the note of D-6 to `openspec/changes/archive/2026-11-22-project-phases/proposal.md`,
  `design.md` and `tasks.md`: after the title line and its blank line, the note line and one blank
  line, with `<date>` set to the day it is written. Check: for each file,
  `git diff --numstat -- <file>` shows `2	0` (two lines added, none removed), line 1 is still the
  stage header with `commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34`, and
  `git grep -c "shipped as ADR 0015" -- openspec/changes/archive/2026-11-22-project-phases` prints
  one match per file (three files); `python3 scripts/check.py` passes.
- [x] 2.2 In `openspec/roadmap.md`, round 19b, make the `project-phases-followups` line and the new
  `project-slice-dogfood` line read exactly as the D-6 block; in `plugins/openspec/README.md` line
  20, `(ADR 0014)` becomes `(ADR 0015)` (D-6). Check: `git diff --numstat -- openspec/roadmap.md`
  shows `2	1`; `git grep -n "dogfood" -- openspec/roadmap.md` prints only the `project-slice-dogfood`
  line; `git grep -n "0014" -- plugins/openspec/README.md` prints nothing.
- [x] 2.3 Release as D-7 says: devkit-openspec to 0.21.2 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, the
  marketplace to 0.25.2, the `CHANGELOG.md` section of D-7 above `## 0.25.1`, every `v0.21.1` of
  `docs/openspec-flow.md` (three lines) to `v0.21.2`, and in
  `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop docs: the design records the
  answers", the pin assertion to `/v0\.21\.2/` with the D-7 message and its `doesNotMatch` to
  `/v0\.21\.1/` (invariant: the CI snippet pins the current release; name it in the commit
  message). When `origin/main` has moved past 0.21.1 or 0.25.1 by then, take the next patch after
  its versions everywhere instead (`CONTRIBUTING.md`, step 5). Check:
  `python3 scripts/gen-catalog.py --check` passes; `git grep -c "v0.21.1" -- docs/openspec-flow.md`
  prints nothing; and `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs`
  and `node --test --test-name-pattern="the pin in docs/openspec-flow.md|AC-8 release-ready" plugins/openspec/hooks/deliver-check.test.mjs`
  pass.
- [x] 2.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green (the guard suite as a background command of the tool); covers AC-1 to AC-8 and every other suite at once.

## Workflow follow-up

- After the merge, tag `v0.21.2` (or the version 2.3 took) on the merge commit and push the tag
  (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the `project-phases-followups` line of round 19b of
  `openspec/roadmap.md`, and `project-slice-dogfood` becomes ready for `/devkit roadmap`.
- In the projects that use devkit, update devkit-openspec and move the pinned `devkit-reviews`
  workflow to `v0.21.2` through each project's own pull request, before a slice ships there.
