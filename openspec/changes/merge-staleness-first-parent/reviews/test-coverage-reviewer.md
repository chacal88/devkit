Verdict: approved
Commit: 4efd2b96a8a012c64289fa379e06e277df7a4054

## Coverage analysis: merge-staleness-first-parent (2300f84..HEAD)

### Findings
- [nit] plugins/openspec/hooks/deliver-check.mjs:189-195 — No test builds an octopus merge (more than two parents); the first-parent branch handles it generically, so the risk is low.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs (merge-staleness 7) — Setup for the root-commit merge is intricate; the precondition assertion and exact reason string keep it robust.

In-scope surfaces: plugins/openspec/hooks (deliver-check staleness/touchedPaths, flow-check readout), docs pin, version bump.
Blocking gaps (8-10 without a plan): 0
Seams checked: first-parent branch -> merge-staleness 1 and 5; first parent is the base -> 6; root commit in a merge -> 7; plain commit after an openspec-only merge -> 8; reviews, tasks and acceptance items -> 1; flow-check readout -> 9 and 10; docs pin -> change-loop doc test. Mutation runs: 0.

### Well covered
- The first-parent rule: merge-staleness 1 asserts the precondition that the old -m behaviour would flag, so it cannot pass vacuously.
- Negative and positive pairs on both surfaces: openspec-only merge is current (1, 9), product merge is stale (5, 10).
- The root-commit boundary (7) and the ordering case (8).
- Both consumers of staleness(): the deliver-check items (1) and the flow-check readout (9, 10).
