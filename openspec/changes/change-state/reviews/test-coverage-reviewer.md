Verdict: approved
Commit: c8a9f5cdd08fb476adf59effe66147de5704349f

## Coverage analysis — change-state re-review (8120c98..c8a9f5c)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:612 declaredEnd — The throw for a declared owner wait that names no gate has no test; add one beside the AC-3 declared-wait test in change-loop.test.mjs.
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:922 — The moved readRun parsing is exercised only by a concurrency test; this is inherited debt for the backlog.
- [praise] plugins/openspec/hooks/change-loop.test.mjs AC-1..AC-7 — Every seam the diff introduced has a named test that would go red if it broke; the subtests are now awaited, so a failing subtest is no longer cancelled unseen.

In-scope surfaces: change-loop.mjs, roadmap-loop.mjs and their tests.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): unchanged from the previous round. In the range, the only edits this change made to its tests are `await t.test(...)` on each subtest (the AC-3, AC-4 and S1-S8 groups) and the shared tmp helper. Production code in change-loop.mjs and roadmap-loop.mjs has no change of this change's in the range. Awaiting the subtests makes a failing subtest fail its parent, so the assertions are as strong as before or stronger. The tmp helper swap changes fixture folders only. The merge conflict resolution in change-loop.test.mjs kept the stage-roles archive path lookup, which is main's edit.

### Well covered
- Awaited subtests: a failure inside S1-S8, runFactsOf and the AC-3 reason groups now reaches the parent test.
- The state command contract, the title forms, state and next agreeing, and a silent GitHub keeping its state, as in the previous round.
