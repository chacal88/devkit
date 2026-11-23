Verdict: approved
Commit: 95968f98dd0d1972b3d5edc49eaf933941e32286

## Coverage analysis — delivery-models (origin/main...HEAD), round 3 (stale-only, merge of main)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:541 testBranchViolation; plugins/openspec/hooks/delivery-models.test.mjs:1085-1105 — Test-branch lock tests cover merge, rebase and pull only; cherry-pick, merge FETCH_HEAD and merge -- develop are neither pinned refused nor pinned deliberately allowed (the base-PR check is the backstop).
- [nit] plugins/openspec/hooks/delivery-models.test.mjs:2065 — The 'documents follow' test pins long prose sentences (implementation-coupled); keep pins to structural markers.
- [praise] plugins/openspec/hooks/delivery-models.test.mjs (P7 T5, around line 505) — The closed-test-PR fix is pinned at the seam by three tests, one per pre-empted row, shown red before the fix in proof/fix-red.txt.
- [praise] plugins/openspec/hooks/delivery-models.test.mjs — Seams run through real wires (fake gh over a real bare origin, real worktrees, hook CLI, --ci with env); negatives accompany positives.

In-scope surfaces: plugins/openspec/hooks (guard, deliver-check, change-loop), docs/coordination-design.md, release files of the merge.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- guard.mjs parseDevkitBlock keeps top-level budget -> caught by the new test 'the block keeps the budget at its own level, never one nested under delivery' (positive and nested-negative asserts).
- change-loop readDevkitSettings/budgetOf read through shared parseDevkitBlock -> caught by main's budget tests, which now run through the shared parser.
- GATE_OF_WHY holds waiting-budget plus the three merge waits -> caught by roadmap-loop.test 'every owner wait has a gate' (map updated with both sides).
- deliver-check readReviews with main's verdictAllowed on shared verdictFiles -> caught by main's staleness tests plus this change's review-record tests; no test lost in the merge diff.
- Release 0.28.0/0.13.0/0.32.0, CI pin v0.28.0 -> caught by the docs-version test and the CI-snippet pin.

### Well covered
- Merge-conflict resolutions only add expected fields to existing assertions (BLOCKED_PARAMS, argument-hint, gate map); no assertion was weakened.
- The budget-key parse has a positive and a negative (nested under delivery) assertion.
