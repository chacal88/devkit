<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `review-openspec-fix` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, command, function, file, test name
and doc sentence is in `design.md`: D-1 the rule, D-2 why `next`, the stage readout and the check
need no code, D-3 the tests, D-4 the two consequences, D-5 the existing tests, D-6 documents and
release. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts
`review-openspec-fix <n>: ` (D-3). Every new hook test takes its env from the file's existing helpers
(`git()` with `GIT_ENV`, `shipRepo`'s and `ciRepo`'s env), which blank `DEVKIT_BYPASS`,
`DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`.
Every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI
does: a new test that passes only without them is not done. The tests need the `openspec` CLI 2.x on
`PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) runs
once, in 2.2, as a background command of the tool, never with a shell `&`. The marketplace check is
written `command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first. Task 1.1 writes the twenty tests, runs them on the unchanged code and saves the output,
as printed, to `openspec/changes/review-openspec-fix/proof/red.txt` (D-3). That run is the task's
check, never a gate. No existing test is edited, except the CI pin assertion in task 2.1 (D-5, D-6).
Leave no backup or scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `rejected-openspec-fix-reviews` | 1.1, 1.2, 1.4, 2.2 |
| AC-2 | `record-commit-keeps-fix` | 1.1, 1.2, 1.4, 2.2 |
| AC-3 | `approved-keeps-rule` | 1.1, 1.2, 1.4, 2.2 |
| AC-4 | `deadlock-unchanged` | 1.1, 1.2, 1.4, 2.2 |

## 1. The rule, its tests and the docs (AC-1 to AC-4)

- [x] 1.1 Write tests `review-openspec-fix 1` to `review-openspec-fix 18` and the fixtures
  `rejectedRepo()` and `planFix()` in a new section at the end of
  `plugins/openspec/hooks/deliver-check.test.mjs`, and tests `review-openspec-fix 19` and
  `review-openspec-fix 20` in a new section at the end of `plugins/openspec/hooks/flow-check.test.mjs`,
  exactly as the tables of `design.md` D-3 say: one test per guard condition and label. The
  positive cases are 1 (a plan fix stales a rejected verdict), 5 (the record committed with another
  file), 6 (each of the five paths that only look like the record), 7 (a test-spared reviewer's
  rejected verdict after tests only), 8 (no `Verdict:` line), 9 (a reviewer outside the six), 13 (a
  merge bringing only `openspec/`), 14 (the loop answers `review` at round 2 naming only the
  rejecting reviewer), 17 (round 1 after the round-2 stop), 18 (the check names the reviewer stale)
  and 19 (the readout offers the review again). The negative cases are 2, 3 and 4 (a commit of
  `reviews/`, `review.md` or `evidence.md` alone), 10 (approved and declined stay current after a plan
  fix), 11 (a test-spared approved verdict stays current after tests only), 12 (an uncommitted plan
  fix), 15 (the record committed twice keeps `fix-review`), 16 (the round-2 stop) and 20 (the readout
  keeps the fix). Each test also makes the fixture checks D-3 names. Run
  `node --test --test-name-pattern="^review-openspec-fix " plugins/openspec/hooks/flow-check.test.mjs`
  on the unchanged code and save its output to `openspec/changes/review-openspec-fix/proof/red.txt`.
  Check: the file holds all twenty names; 1, 5, 6, 7, 8, 9, 13, 14, 17, 18 and 19 fail, and 2, 3, 4,
  10, 11, 12, 15, 16 and 20 pass, as D-3 expects (a different result is settled in this task as D-3
  says, before 1.2).
- [x] 1.2 In `plugins/openspec/hooks/deliver-check.mjs`, as D-1 says: move `approved` up after
  `TEST_SPARED_REVIEWERS` with its comment; add `reviewRecord(id)` and `verdictAllowed(id, name,
  verdict)`; make `readReviews` pass `{ allowed: verdictAllowed(id, name, verdict) }` to `staleness()`
  for every file and update its comment; make `reviewsItem`'s rejected filter `!approved(x.verdict)`.
  Leave `staleness()`, `touchedPaths()`, `nextStep` and every other caller unchanged. Check: all
  twenty `review-openspec-fix` tests pass; every test D-5 names passes;
  `git grep -n "function reviewRecord\|function verdictAllowed\|const approved =" -- plugins ':!*.test.*'` prints
  exactly three lines, all in `deliver-check.mjs`; and
  `git diff --numstat $(git merge-base main HEAD) -- plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs`
  shows 0 deleted lines for both files (no existing test changed).
- [x] 1.3 Make the documentation changes D-6 lists for `docs/openspec-flow.md` (the staleness rule,
  the order of the delivery steps and the `update-branch` row; not the pins, which move in 2.1) and
  for `plugins/core/skills/review-change/SKILL.md` (the stale definition), with the sentences D-6
  gives. Check: `python3 scripts/check.py` passes; `git grep -n "review record" -- docs/openspec-flow.md plugins/core/skills/review-change/SKILL.md`
  prints at least one line in each file; and `git grep -n "leaves reviews and evidence current" -- docs plugins`
  prints nothing.
- [x] 1.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green (the flow-check suite loads the deliver-check suite, so this runs tests 1 to 20 and every test D-5 names in those two files); covers AC-1, AC-2, AC-3 and AC-4.

## 2. Release and the whole suite (AC-1 to AC-4)

- [x] 2.1 Release as D-6 says. Bump devkit-openspec to 0.21.2 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, devkit-core to
  0.9.1 in `plugins/core/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and the
  marketplace to 0.25.2. Add the `CHANGELOG.md` section `## 0.25.2 — a review fixed in the plan
  files` with the three bullets D-6 gives, above `## 0.25.1`. Turn every `v0.21.1` of
  `docs/openspec-flow.md` (three lines) into `v0.21.2`. In
  `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop docs: the design records the
  answers", change the pin assertion to `v0\.21\.2` with the message
  `(review-openspec-fix: 0.21.2)` and add the `doesNotMatch` for `v0\.21\.1` (invariant: the CI
  snippet pins the current release; name it in the commit message). Check:
  `python3 scripts/gen-catalog.py --check` passes; `git grep -c "v0.21.1" -- docs/openspec-flow.md`
  prints nothing; and the change-loop docs test and the two `deliver-check.test.mjs` pin tests ("the
  pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, …" and "AC-8
  release-ready: …") pass.
- [x] 2.2 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green (the guard suite as a background command); covers AC-1 to AC-4 and every other suite at once.

## Workflow follow-up

- After the merge, tag `v0.21.2` on the merge commit and push the tag (`CONTRIBUTING.md`); a sibling
  release merged first moves this release to the next free version, and the tag follows it.
- Archive with the retro; the archive ticks the round 17f line of `openspec/roadmap.md`.
- The next change whose review is rejected and fixed in its plan files, with devkit-openspec 0.21.2
  installed in the session (`claude plugin update devkit-openspec@devkit`, `CONTRIBUTING.md`),
  records in its retro that `/devkit change` went on to round 2 with no hand from the owner.
