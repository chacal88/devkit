<!-- devkit-stage tasks result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Tasks

Change: `merge-staleness-first-parent` · Date: 2026-11-21 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, command, function, file and test
name is in `design.md`: D-1 the rule, D-2 the diff command, D-3 the tests, D-4 the existing tests,
D-5 documents and release. The implementer copies them and makes no design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test's name starts
`merge-staleness <n>: ` (D-3). Every new hook test takes its env from the file's existing helpers
(`git()` with `GIT_ENV`; `{ ...gh.env, ...SHIP_ENV }` in the flow-check suite), which blank
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH`. Every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a
pull-request run on CI does: a new test that passes only without them is not done. The tests need
the `openspec` CLI 2.x on `PATH`. The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
about 13 minutes) runs once, in 2.2, as a background command. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first. Task 1.1 writes the ten tests, runs them on the unchanged code and saves the output, as
printed, to `openspec/changes/merge-staleness-first-parent/proof/red.txt` (D-3). That run is the
task's check, never a gate. No existing test is edited, except the CI pin assertion in task 2.1
(D-4, D-5). Leave no backup or scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `merge-openspec-only-current` | 1.1, 1.2, 1.4, 2.2 |
| AC-2 | `merge-product-stale` | 1.1, 1.2, 1.4, 2.2 |
| AC-3 | `merge-resolution-stale` | 1.1, 1.2, 1.4, 2.2 |
| AC-4 | `plain-commits-unchanged` | 1.1, 1.2, 1.4, 2.2 |
| AC-5 | `update-branch-dogfood` | Workflow follow-up only: the dogfood of the next change, not proven here (`proposal.md`) |

## 1. The rule and its tests (AC-1 to AC-4)

- [x] 1.1 Write tests `merge-staleness 1` to `merge-staleness 8` in
  `plugins/openspec/hooks/deliver-check.test.mjs` (section "staleness and item 2") and
  `merge-staleness 9` and `merge-staleness 10` in `plugins/openspec/hooks/flow-check.test.mjs`
  (section "fixtures over a real repository"), exactly as the two tables of `design.md` D-3 say:
  one test per guard condition and label. The positive cases are 1 (a merge bringing only
  `openspec/` is current) and 9 (the stage readout keeps evidence and review passed). The negative
  cases are 2 (a merge bringing a product file is stale), 3 (a merge commit editing a product file
  while resolving is stale), 4 (a merge moving a product file under `openspec/` is stale), 5 (a
  product commit the merge brings in is stale), 6 (a merge whose first parent is the base), 7 (a
  root commit brought in), 8 (a plain product commit after an `openspec/`-only merge is stale) and
  10 (the readout reports evidence stale). Each test also makes the fixture checks D-3 names. Run
  `node --test --test-name-pattern="^merge-staleness " plugins/openspec/hooks/flow-check.test.mjs`
  on the unchanged code and save its output to `proof/red.txt`. Check: the file holds all ten
  names; 1, 5, 7, 8 and 9 fail and 2, 3, 4, 6 and 10 pass, as D-3 expects (a different result is
  settled in this task as D-3 says, before 1.2).
- [x] 1.2 In `plugins/openspec/hooks/deliver-check.mjs`, add `touchedPaths(root, c, parents)` and make
  `staleness()` walk `git rev-list --parents <full>..<head>`, as D-1 and D-2 say: a merge is listed
  with `git diff-tree -r -z --name-only --no-commit-id <parents[0]> <c>`, any other commit with
  today's command unchanged; update the comment above `staleness` and drop the `-m` comment. Check:
  all ten `merge-staleness` tests pass; every test D-4 names passes; and
  `git diff --numstat $(git merge-base main HEAD) -- plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs`
  shows 0 deleted lines for both files (AC-4: no existing test changed).
- [x] 1.3 In `docs/openspec-flow.md`, add the merge sentence to "The `Commit:` staleness rule" and
  rewrite the `update-branch` row of "What `ship-change` runs", as D-5 says. Check:
  `python3 scripts/check.py` passes; the staleness paragraph says "first parent"; and
  `git grep -n "makes older reviews stale and re-runs them" -- docs plugins` prints nothing.
- [x] 1.4 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green (the flow-check suite loads the deliver-check suite, so this runs tests 1 to 10 and every existing staleness test); covers AC-1, AC-2, AC-3 and AC-4.

## 2. Release and the whole suite (AC-1 to AC-4)

- [x] 2.1 Release as D-5 says. Bump devkit-openspec to 0.18.2 in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and the
  marketplace to 0.22.2. Add the `CHANGELOG.md` section `## 0.22.2 — merge staleness by the first
  parent`. Turn every `v0.18.1` of `docs/openspec-flow.md` (three lines) into `v0.18.2`. In
  `plugins/openspec/hooks/change-loop.test.mjs`, test "change-loop docs: the design records the
  answers", change the pin assertion to `v0\.18\.2` with the message
  `(merge-staleness-first-parent: 0.18.2)` and add a `doesNotMatch` for `v0\.18\.1` (invariant: the
  CI snippet pins the current release; name it in the commit message). Check:
  `python3 scripts/gen-catalog.py --check` passes; `git grep -c "v0.18.1" -- docs/openspec-flow.md`
  prints nothing; and the change-loop docs test and the two `deliver-check.test.mjs` pin tests ("the
  pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, …" and "AC-8
  release-ready: …") pass.
- [x] 2.2 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate .` green (the guard suite as a background command); covers AC-1 to AC-4 and every other suite at once.

## Workflow follow-up

- After the merge, tag `v0.18.2` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the round 17d line of `openspec/roadmap.md`. The retro
  records AC-5 `update-branch-dogfood` as owed to the next change that meets it.
- AC-5, in the next change whose pull request is behind main while main brought only `openspec/`
  files: with devkit-openspec 0.18.2 installed in the session (`claude plugin update
  devkit-openspec@devkit`, `CONTRIBUTING.md`), run "Update branch", then check that `deliver-check` reports `evidence.md` and the reviews
  current, with no new suite run or review round, and record the result in that change's retro.
