Verdict: approved
Commit: ff998c02e3b9ae0766820d66e0d4e18a63b2d578

## ADR review — review-owner-rounds

### Findings

ADRs reviewed: ADR 0032 (`docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md`), ADR 0008 (`docs/adr/0008-reviews-as-a-workflow.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0036 (`docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md`).

ADR review — pass. The change's own lines in the merge of origin/main (3480c886) and the evidence refresh keep ADR 0032 decision 3: validateArgs still refuses a round above 2 without the owner's recorded words, and the ownerLine rule lives in the one rules section (ADR 0008). The merge keeps ownerLine and review-writer-text's withoutSummary and summaryLine side by side, and a test covers both sides of the joined condition. No owner word reaches an agent prompt. No test or script file is added, so no test-map edit is due (ADR 0036). The record is not derived state (ADR 0017). review-round.test.mjs ran in the foreground: 121 tests, 121 pass, at load 3.29.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit) + 0 praise; open: none; fixed: none; refuted: none
