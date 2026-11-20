Verdict: approved
Commit: 07a85c411ee58cafd43ddd663a9176eb821b5c65

## Quality review: flow-script-checker, origin/main...HEAD (round 1, full diff)

### Findings
- [nit] plugins/openspec/hooks/flow-check.mjs:159-188 — Inline git helpers duplicate what deliver-check owns; export and reuse in a later change.
- [nit] plugins/openspec/hooks/flow-check.mjs:~385 — staleAfter is skipped once any task is ticked, so late edits to the plan are not flagged; document as a known blind spot.
- [nit] plugins/openspec/hooks/flow-check.test.mjs:764-815 — The 'every run ends' simulation proves termination and a named stage or end, not that the right stage is offered; the targeted tests cover that.
- [praise] plugins/openspec/hooks/flow-check.mjs:111,159,181 — Argument arrays only, and the change id is validated by locateChange before any spawn: no injection or traversal path.
- [praise] plugins/openspec/hooks/flow-check.mjs:217-260 — Pure computeFlow, lazy single gh read, typed usage errors for CLI failures.
- [praise] plugins/openspec/hooks/flow-check.mjs:466-480 — The last guard on next is enforced in one place (offer).
- [praise] plugins/openspec/hooks/flow-check.test.mjs:700-735 — A table drives all delivery outcomes against a real git repo and a gh fake wired through the real makeGh.

### What I checked
I read the rest of flow-check.mjs (walk, readDelivery, renderText, main), conduct-check.mjs (flow.json plan files with fallback, no import cycle), the guard.mjs session text, the three edited test files and flow-check.test.mjs, both flow.json and schema.yaml pairs (ids and files agree in both directions; openspec/schemas copies byte-identical), and the edited agent and skill texts. I found no correctness, security, contract or data-consistency defect. I did not re-run the suite and relied on the supplied gate results.

### Summary
- 3 nit, 4 praise, 0 blocking, 0 important.
- Justification: every file in the diff outside the template and schema text bodies was read; the old checkers keep their behaviour and their edited tests match the new plan shape.
