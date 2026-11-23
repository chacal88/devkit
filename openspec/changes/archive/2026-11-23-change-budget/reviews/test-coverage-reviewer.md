Verdict: approved
Commit: 7c12aa3f8b66039ddab7d3a3c1c3c13a8ff26ee4

## Coverage analysis: change-budget, 897c7ee..7c12aa3 (re-review after the third merge with main)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:635 — spentOf: a run line with no timestamp makes since null and silently drops every subagent file; only the subagent-side missing timestamp is tested (unchanged since the previous round).
- [nit] plugins/openspec/hooks/guard.mjs:635 — spentOf compares timestamps as strings; no test mixes timestamp formats (unchanged since the previous round).
- [nit] plugins/openspec/hooks/change-loop.mjs:710 — No test puts an attributed commit-agent hand-off under and over the cap in one case; hold(guard(withAttribution)) is covered only by each side's tests separately.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2484 — The docs pin test requires v0.25.0 and rejects every older pin, so a stale pin after the release renumber goes red.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:3942 — The new state test covers the waiting-budget gate phrase both as an end and as a declared wait, so dropping the GATE_OF_WHY entry goes red.

## Coverage analysis: change-budget, 897c7ee..7c12aa3 (re-review after the third merge with main)

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, roadmap-loop.mjs and their node:test suites), the release files (plugin.json, marketplace.json, CHANGELOG 0.29.0) and the docs pin.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): release renumber 0.25.0 / 0.29.0 -> change-loop.test.mjs:2484-2486 (the two pin tests in the same file also pass); GATE_OF_WHY 'waiting-budget': 'budget' -> the new state test at :3942-3949; roadmap-loop.mjs dropping its gateOf copy -> the budget and state tests cover the single copy in change-loop.mjs. Test runs with TMPDIR=/var/tmp: 9 of 9 on the change-budget AC-1 / docs / v0.25 names, 25 of 25 on the pin name.

### Well covered
- Release pin: the current pin must be present and every older pin absent.
- Budget end mapped to the budget gate phrase, as an end and as a declared wait.
- The budget hold at the cap and the held action's reply, asserted through the real CLI.
