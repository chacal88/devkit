<!-- devkit-stage evidence result=passed attempt=2 commit=11bfc8b17be0276e67258d25fa02feb47ee3cbf1 -->
Commit: 11bfc8b17be0276e67258d25fa02feb47ee3cbf1

# Evidence: merge-staleness-first-parent

Verified on branch `merge-staleness-first-parent` at the commit above (the merge of main that brought
pull request 47), with a clean working tree. Every hook gate ran with
`GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`, as a pull-request run on CI does. No UI and no
screenshots: the change touches hooks and docs only.

Renumbering: the merge brought devkit-openspec 0.19.0 (marketplace 0.23.0) from main, so this
change's release moved from 0.18.2 (0.22.2) to 0.19.1 (0.23.1). The CI pin in
`docs/openspec-flow.md` and the pin assertion of `change-loop.test.mjs` now read `v0.19.1`. The plan
files (`design.md` D-5, `tasks.md` 2.1) still name 0.18.2 and were not edited; read 0.18.2 as 0.19.1
and 0.22.2 as 0.23.1. At HEAD, `plugin.json` says 0.19.1, `marketplace.json` says 0.23.1,
`CHANGELOG.md` has `## 0.23.1 — merge staleness by the first parent`, and `docs/openspec-flow.md`
has three `v0.19.1` lines and no `v0.19.0`.

Field observation: the previous evidence (attempt 1, at d9b9fdf) went stale because the merge of main
brought product code. That is exactly AC-2's rule working as designed: a merge that brings product
files makes the record stale, so evidence was re-run in full at the merge commit.

## Verification

### Gates

| Gate | Command | Result |
|------|---------|--------|
| 1.4 flow-check suite | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs` | pass: exit 0, 591 tests, 591 pass, 0 fail, 0 skipped, 544 s (loads the deliver-check suite; the ten `merge-staleness` tests all pass) |
| 1.4 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.2 whole guard suite | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 1191 tests, 1191 pass, 0 fail, 0 skipped, 1044 s (background run) |
| 2.2 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.2 catalog | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.2 plugin validation | `command claude plugin validate .` | pass: exit 0, "Validation passed" |

Also run: `openspec validate merge-staleness-first-parent --strict` exit 0 ("is valid"). The task 1.2
check `git diff --numstat $(git merge-base main HEAD) -- <the two test files>` shows 223 added and 0
deleted lines for `deliver-check.test.mjs` and 38 added and 0 deleted for `flow-check.test.mjs`.

### Acceptance criteria

Scratch repositories (outside the worktree, in the session scratchpad) were run for real against
`staleness()` of the tree and, for contrast, against the `deliver-check.mjs` of d9b9fdf^ ("old").

| AC | Criterion | Proof | Result |
|----|-----------|-------|--------|
| AC-1 | `merge-openspec-only-current`: a `--no-ff` merge of main bringing only `openspec/` leaves the record current | Tests `merge-staleness 1` and `9` pass in the 591-test run. Scratch repo (recorded `Commit:` is a product commit, main adds `openspec/roadmap.md`, `git merge --no-ff`): new returns `null`; old returns "3e99f50 is behind cafbaba, which touches src/feat.js". | pass |
| AC-2 | `merge-product-stale`: main brings a file outside `openspec/`, the record is stale and names it | Tests `merge-staleness 2`, `5`, `6`, `7`, `10` pass. Scratch repo, main adds `src/other.js`, `--no-ff` merge: new returns "eecd489 is behind eae2590, which touches src/other.js". | pass |
| AC-3 | `merge-resolution-stale`: an `openspec/`-only merge whose merge commit edits a product file is stale and names it | Tests `merge-staleness 3` and `4` pass. Scratch repo, `git merge --no-ff --no-commit main`, edit `src/feat.js`, commit: new returns "84212cb is behind 699696c, which touches src/feat.js". | pass |
| AC-4 | `plain-commits-unchanged`: one-parent commits judged as before, existing staleness tests unchanged and green | Test `merge-staleness 8` passes; flow-check (591) and guard (1191) suites pass; numstat shows 0 deleted lines in both test files. Scratch repo: an `openspec/`-only plain commit gives `null` and a following product commit gives "... touches src/new.js", both identical to old; a product commit after an `openspec/`-only merge gives "... touches src/late.js". | pass |
| AC-5 | `update-branch-dogfood`: a real GitHub "Update branch" keeps evidence and reviews current | Not an exit criterion of this change; it is the next change's dogfood (`proposal.md`, "Left for the next change"). | no proof: needs a real pull request behind main with the fixed devkit-openspec (now 0.19.1) installed, owed to the next change |

Nothing was left in the tree (`git status --short` empty before this file was written).
