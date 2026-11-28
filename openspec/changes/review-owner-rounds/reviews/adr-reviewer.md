Verdict: approved
Commit: 109279031bd2295a0ed1e8c83e0dd2fb28d88a3f

## ADR review — review-owner-rounds

### Findings

ADRs reviewed: ADR 0032 (`docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md`), ADR 0008 (`docs/adr/0008-reviews-as-a-workflow.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0036 (`docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md`).

ADR review — pass. 4 ADRs reviewed. The change carries out ADR 0032 decision 3 and its review trigger. It keeps ADR 0008's rule that the Workflow script gets everything through `args` and that the rules live once. `declared.json` is a record, not derived state, so ADR 0017 holds. No test or script file is added, so no `test-map.json` edit is due (ADR 0036). No ADR is numbered or amended in the diff.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
