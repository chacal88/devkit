Verdict: approved
Commit: 4efd2b96a8a012c64289fa379e06e277df7a4054

## Quality review — merge-staleness-first-parent (round 1)

### Findings
- [praise] plugins/openspec/hooks/deliver-check.mjs:189-196 — Small touchedPaths helper: the merge case uses the first-parent diff, the other branch keeps the old command byte for byte, and the commits a merge brings in stay in the rev-list walk.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs, flow-check.test.mjs — One test per condition (openspec-only merge, product merge, resolution edit, late product commit, plain commit), plus end-to-end readout tests 9 and 10; red proof on the old code in proof/red.txt; no existing test lines deleted.
- [nit] openspec/changes/merge-staleness-first-parent/evidence.md (AC-4) — The evidence says the task 1.2 numstat check was not re-run; re-run for this review, it shows 0 deletions.

### Summary
- 3 findings (0 blocking, 0 important, 1 nit) + 2 praise
- I read the whole code diff (`deliver-check.mjs`), the tests, the docs and release bumps, and the evidence; the long suites are reported green at d9b9fdf. For a merge commit the first-parent diff lists what the merge brought into the branch, edits made while resolving included. A one-parent or root commit is unchanged (`parents.length` 0 or 1 runs the old `-m --root` command). Rename detection is off by default in `diff-tree`, so a file moved out of product code still shows its old path.
- Residual risk (not a finding): a merge whose first parent is the base side, such as a `git merge feat` run on main, is judged against main; outside the update-branch flow the proposal targets.
- Acceptance: AC-1 to AC-4 have real output in evidence.md; AC-5 is owed to the next change and is not an exit criterion here.
