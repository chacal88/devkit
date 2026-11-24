Verdict: approved
Commit: 224bba238de37259d7daa6e183ba6477a3052c07

## ADR review — fresh-base-check

### Findings
- [nit] openspec/changes/fresh-base-check/decisions.md; design.md:364 — ADR 0017 decision 1: state and status read the local base while next and wait read a fresh one, so they can briefly differ. design.md accepts this in its Risks table, but decisions.md says no record is needed. Add a sentence pointing at the risk row (previous nit, still open).
- [nit] openspec/changes/fresh-base-check/proposal.md:104 — Impact says deliveredChange, MERGE_CONFIG, MERGE_FILES and presetMerge are exported from test files (ADR 0026 decision 3). The code moved them to change-loop-fixtures.mjs and test-fixtures.mjs, so reword the proposal (previous nit, still open).

ADRs reviewed: 0010, 0011, 0017, 0022, 0025 and 0026 (`docs/adr/`). I read the others by status and a grep for fetch.

Conformance, range 6c05399..224bba2, the change's own lines only:
- The fetch adds no loop state. `refreshBase` and `baseFetches` are in-memory and per call, and the only file the fetch touches is the remote-tracking ref (ADR 0010, 0017).
- `state`, `status` and the locks call `nextAction` without `fetchBase`, so they never fetch (ADR 0011, 0017). `deliver-check.mjs` and `conduct-check` stay fetch-free; the change to `deliver-check.mjs` is a header comment only.
- A fresher base keeps the fail-safe direction of ADR 0025 decision 4. A failed fetch falls back to the local copy and says so in the reply (`base-unfetched`, both languages).
- The release renumbering (devkit-openspec 0.45.0, marketplace 0.50.0) and the merge resolutions bring in no ADR-bound change.
- No test file imports another test file (ADR 0026 decision 3). The shared helpers live in `change-loop-fixtures.mjs` and `test-fixtures.mjs`.
- The change needs no superseding ADR. I found no open decision touched.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
