Verdict: approved
Commit: a5f11db996c8489dd8c36938906350c27d1da839

## Coverage analysis — change-budget (08eea2b..a5f11db, re-record at clean HEAD)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs:635 spentOf (since null) — A run line with no timestamp makes since null and drops every subagent file silently; only the subagent-side missing timestamp is tested.
- [nit] plugins/openspec/hooks/guard.mjs:635 spentOf (start >= since) — Timestamps are compared as strings; no test mixes timestamp formats.
- [praise] plugins/openspec/hooks/change-loop.test.mjs (token budget section) — Every seam (cap lookup, next wiring, hold, spend count, gate, stop lock) has a test that asserts the spend, cap and file through the real CLI.

In-scope surfaces: plugins/openspec/hooks (guard.mjs, change-loop.mjs, roadmap-loop.mjs and their node:test suites).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0), carried over from the previous round because the code has not changed since: cap lookup (budgetOf) -> project/change/invalid tests; nextAction budget option -> sessionTranscript -> spentOf -> decide -> reply -> 'next at the cap' test; runNext budget:true -> same test plus 'no option applies no cap'; hold after guard -> at-cap/above-cap/no-progress tests; null spend -> null and no-session-id tests; token counting -> 7525 fixture and AC-7 tests; roadmap gate -> roadmap-loop replies test; stop lock after budget end -> stop-hook test; message tokens in both languages -> SAMPLE/NAMES_ITS_FILE.

### Well covered
- The budget decision (D-4): boundary at cap, under cap, null spend and the no-progress ordering.
- Invalid budget values: budgetValue directly, and start, open and next each tested; open asserts nothing is created.
- Cap isolation across changes, and no transcript read when no cap applies.
