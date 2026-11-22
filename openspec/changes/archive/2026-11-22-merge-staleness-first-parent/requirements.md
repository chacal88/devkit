<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> `deliver-check`'s `staleness()` judges a merge commit by its diff against its first parent instead of `git diff-tree -m` (against each parent), so `gh pr update-branch` that brings only `openspec/` files leaves `evidence.md` and the reviews current; a test merges main into a reviewed scratch branch both ways (main brings only `openspec/`, main brings a product file) (merge-setup-field-fixes retro, item 1)

Classification: domain=product (the plugin's hooks) type=bug flags=[] (confirmed)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The fix lives in `plugins/openspec/hooks/deliver-check.mjs#staleness`. `plugins/openspec/hooks/flow-check.mjs` calls the same function (its `staleness` fact), so the stage readout follows with no change of its own.
- A merge commit `c` (more than one parent) is judged by the files that differ between its first parent and itself, `git diff --name-only -z <c>^1 <c>`: what the merge brought into the branch, conflict resolutions included. A commit with one parent, and the root commit, are judged as today.
- The commits a merge brings in stay in `git rev-list <recorded>..HEAD` and are still checked one by one, as today; only the merge commit itself changes how it is read.
- A merge whose first parent is not the branch (the base merged the branch, then the branch was reset onto it) is read against its first parent too: anything outside `openspec/` that differs makes the record stale. No special case.
- The stale reason keeps its form: `<short> is behind <merge short>, which touches <path>`.
- The invariant of the test at `plugins/openspec/hooks/deliver-check.test.mjs` "staleness: a merge from the base branch that brings product code is stale; openspec-only is current" stays true; that suite owns the new cases too.
- Release: a patch bump of `devkit-openspec` as CONTRIBUTING.md says; it meets the sibling changes' bumps at the release rebase.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
Proven in this change with scratch repositories in `plugins/openspec/hooks/deliver-check.test.mjs`:

- AC-1 `merge-openspec-only-current` — A branch with product commits before the recorded commit, then a `--no-ff` merge of main that brings only files under `openspec/`: `staleness()` returns null, so `evidence.md` and the reviews read current in `deliver-check` and in the stage readout.
- AC-2 `merge-product-stale` — The same branch, where main brings a file outside `openspec/` (another pull request's product code or version bump): `staleness()` reports the record stale and names that file.
- AC-3 `merge-resolution-stale` — A merge of main that brings only `openspec/` files but whose merge commit also changes a file outside `openspec/` (an edit made while resolving the merge) is stale and names that file.
- AC-4 `plain-commits-unchanged` — Commits with one parent are judged exactly as before: every existing `staleness` test in `deliver-check.test.mjs` and `flow-check.test.mjs` stays green unchanged.

Left for the next change that meets it (the dogfood, recorded in this change's retro):

- AC-5 `update-branch-dogfood` — On a real pull request, a GitHub "Update branch" that brings only `openspec/` files leaves `evidence.md` and the reviews current, with no new suite run or review round.

## Out of scope

- Judging staleness only by the files the change itself touches: any file outside `openspec/` brought from main keeps making the record stale (owner's answer).
- Walking only the first-parent chain (`rev-list --first-parent`): main's commits stay checked one by one.
- Any change to `flow-check.mjs`, to the reason wording, or to the dirty-tree rule.
- Running "Update branch" on this change's own pull request as proof (owner chose tests here, real use later).

## Questions asked

1. [end effect] When main brings product code from another pull request, what should happen? → Evidence and reviews go stale, as today.
2. [scope] Proof: scratch-repository tests here and real use in the next change, or also on this change's own pull request? → Tests here, real use later.
