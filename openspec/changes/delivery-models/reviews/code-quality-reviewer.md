Verdict: approved
Commit: 95968f98dd0d1972b3d5edc49eaf933941e32286

## Quality review — delivery-models (stale-only re-review of the merge of main, PR 73)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:571 — Round-1 finding, still open. The rule refuses `git merge -m test main` on a task branch, because an option value equal to the test branch name is read as a ref. Skip the value of -m/-F/-s/-X before matching.
- [nit] plugins/openspec/hooks/guard.mjs:558 — Round-1 finding, still open. The `git -C` regex uses `\S+`, so `-C "my dir"` is not parsed. `git -c k=v merge develop` also bypasses the rule. Name the gap in a comment.
- [nit] plugins/openspec/hooks/guard.mjs:566 — Round-1 finding, still open. On a bare `git pull`, `gitOut(... '@{u}')` runs once per remote inside `remotes.some`. Hoist it out of the loop.
- [praise] plugins/openspec/hooks/change-loop.mjs:1171 — Round-1 praise. A change id ending in `-<test_branch>` is refused, so a task branch can never be mistaken for a support branch.
- [praise] plugins/openspec/hooks/conduct-check.mjs:19 — Round-1 praise. `listWorktrees` lives in deliver-check and is re-exported from conduct-check, so there is one shared helper and old importers still work.
- [praise] plugins/openspec/hooks/deliver-check.mjs:1445 — Round-1 praise. The closed test-branch PR now blocks in `nextStep` before the open-pr, push and edit-body steps, backed by three tests whose red-before-fix output is kept in proof/fix-red.txt.
- [praise] plugins/openspec/hooks/guard.mjs:103 — The merge keeps one parseDevkitBlock for both sides: `budget` is read only at the block's own level, and a `budget` nested under `delivery:` is ignored. The new test in delivery-models.test.mjs:99 covers both cases, and change-loop's readDevkitSettings and budgetOf read through it, so main's local copy is gone.

### Summary
- 7 findings (0 blocking, 0 important, 3 nit) + 4 praise
- Justification: I reviewed the merge's own part of the range 64ed99f..HEAD, meaning the delta against main (ae1243c), not main's work. I read three things in the diff. In guard.mjs, parseDevkitBlock now holds both the `budget` key and the `delivery` sub-keys, with no cross-leak. In change-loop.mjs, the diff shows the shared parseDevkitBlock replacing main's local copy, `waiting-budget` in GATE_OF_WHY, and the budget fact read only when `next` asks for it. In deliver-check.mjs, readReviews applies main's verdictAllowed staleness rule to the shared verdictFiles. I ran the merge's first-red test (`keeps the budget at its own level`) alone, and it passes. The release is consistent: devkit-openspec 0.28.0, devkit-core 0.13.0, marketplace 0.32.0, a CHANGELOG 0.32.0 entry, and the CI pin docs at v0.28.0. I did not re-run the suite because the caller supplied 2056 pass at c093f6e. The three guard.mjs nits from the earlier rounds are unchanged by the merge. They are optional, since the hook rule is best-effort and fails open. Nothing blocks.
