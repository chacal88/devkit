Verdict: approved
Commit: 6c053994f35e0f0b873fb34923d4c8d28a811723

## ADR review — fresh-base-check

### Findings
- [nit] openspec/changes/fresh-base-check/decisions.md; design.md:373 — ADR 0017 decision 1: state/status read the local base while next/wait read a fresh one, so they can briefly differ; design.md accepts it in a risk row but decisions.md says no record is needed. Add a sentence pointing at the risk row.
- [nit] openspec/changes/fresh-base-check/proposal.md:105 — Impact says deliveredChange, MERGE_CONFIG, MERGE_FILES and presetMerge are exported from test files (ADR 0026 decision 3); the code moved them to fixture modules, so reword the proposal.

ADRs reviewed: 0010, 0011, 0017, 0022, 0025, 0026; 0001 to 0009 and 0012 to 0024 scanned by status and a grep for fetch.

Conformance: the fetch adds no loop state (ADR 0010, 0017); locks and state call nextAction without fetchBase (ADR 0011); a fresher base keeps the fail-safe direction of ADR 0025 decision 4; no test file imports another test file (ADR 0026 decision 3); check.py and gen-catalog --check pass.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
