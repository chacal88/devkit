<!-- devkit-stage evidence result=passed attempt=1 commit=d9b9fdf9cc3c0a33f79df9fea749e3eccc0061b5 -->
Commit: d9b9fdf9cc3c0a33f79df9fea749e3eccc0061b5

# Evidence: merge-staleness-first-parent

Verified on branch `merge-staleness-first-parent` at the commit above, with a clean working tree. Every
hook gate ran with `GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main`, as a pull-request run on CI
does. No UI and no screenshots: the change touches hooks and docs only.

## Verification

### Gates

| Gate | Command | Result |
|------|---------|--------|
| 1.4 flow-check suite | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/flow-check.test.mjs` | pass: exit 0, 591 tests, 591 pass, 0 fail, 0 skipped, 565 s (loads the deliver-check suite) |
| 1.4 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.2 whole guard suite | `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 1140 tests, 1140 pass, 0 fail, 0 skipped, 987 s (background run) |
| 2.2 repo check | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.2 catalog | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog up to date |
| 2.2 plugin validation | `command claude plugin validate .` | pass: exit 0, "Validation passed" |

Also run: `openspec validate merge-staleness-first-parent --strict` exit 0 ("is valid").

### Acceptance criteria

| AC | Criterion | Proof | Result |
|----|-----------|-------|--------|
| AC-1 | `merge-openspec-only-current`: a `--no-ff` merge of main bringing only `openspec/` leaves the record current | Tests `merge-staleness 1` and `9` pass in the 591-test flow-check run (both failed on the unchanged code, `proof/red.txt`). Real scratch repo (branch with a product commit as the recorded `Commit:`, main adds `openspec/roadmap.md`, `git merge --no-ff main`): the new `staleness()` returns `null`; the code before d9b9fdf on the same repo returns `"d6e1272 is behind 99c3428, which touches src/feat.js"`. | pass |
| AC-2 | `merge-product-stale`: main brings a file outside `openspec/`, the record is stale and names it | Tests `merge-staleness 2`, `5`, `6`, `7`, `10` pass. Scratch repo, main adds `src/other.js`, `--no-ff` merge: `"d6e1272 is behind 7490aa1, which touches src/other.js"`. | pass |
| AC-3 | `merge-resolution-stale`: an `openspec/`-only merge whose merge commit edits a product file is stale and names it | Tests `merge-staleness 3` and `4` pass. Scratch repo, `git merge --no-ff --no-commit main`, edit `src/feat.js`, commit: `"660d52e is behind e2ef179, which touches src/feat.js"`. | pass |
| AC-4 | `plain-commits-unchanged`: one-parent commits judged as before, existing staleness tests unchanged and green | Tests `merge-staleness 8` passes; the whole flow-check (591) and guard (1140) suites pass. Scratch repo: an `openspec/`-only plain commit returns `null`, a following product commit returns `"... touches src/new.js"`; a product commit after an `openspec/`-only merge returns `"... touches src/late.js"`. The task 1.2 numstat check (0 deleted lines in the two test files) was not re-run here. | pass |
| AC-5 | `update-branch-dogfood`: a real GitHub "Update branch" keeps evidence and reviews current | Not an exit criterion of this change; it is the next change's dogfood (`proposal.md`, "Left for the next change"). | no proof: needs a real pull request behind main with devkit-openspec 0.18.2 installed, owed to the next change |

The scratch repositories lived outside the worktree, under the session scratchpad; nothing was left in the tree.
