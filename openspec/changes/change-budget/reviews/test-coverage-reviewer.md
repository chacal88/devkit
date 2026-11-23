Verdict: approved
Commit: 7017229d317b12833ae8c72914f86ac3c1bf77ba

## Coverage analysis — change-budget (a5f11db..7017229, re-review)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:635 — spentOf: a run line with no timestamp makes since null and silently drops every subagent file; only the subagent-side missing timestamp is tested (unchanged since the previous round).
- [nit] plugins/openspec/hooks/guard.mjs:635 — spentOf compares timestamps as strings; no test mixes timestamp formats (unchanged since the previous round).
- [praise] plugins/openspec/hooks/change-loop.test.mjs (change-budget tests) — Every budget seam is asserted through the real CLI, and the 41 change-budget tests still pass after the move to the shared tmpFolder helper.

In-scope surfaces: plugins/openspec/hooks (guard.mjs, change-loop.mjs, roadmap-loop.mjs and their node:test suites).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): cap lookup, the nextAction budget option, hold after guard, null spend, token counting, the roadmap gate and the stop lock after budget end are unchanged and still caught by the tests named in the previous round. The only change on this change's side is the budgetFiles helper moving to tmpFolder, and the 41 change-budget tests pass with TMPDIR=/var/tmp.

### Well covered
- Cap resolution (project, change, none) still asserts cap, origin and file after the helper change.
- The docs pin test keeps the no-stale-pin invariant, including the new v0.22.1 assertion.
