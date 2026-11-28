Verdict: approved
Commit: ff998c02e3b9ae0766820d66e0d4e18a63b2d578

## Spec review — review-owner-rounds

### Findings
- [nit] plugins/core/skills/review-change/scripts/review-round.mjs recordedOwner — Still open from the previous round. The owner command does not cap the recorded words at 200 characters. Words over 200 pass owner but are refused by validateArgs (workflow.js line 87), and the spec leaves the length rule for the command unstated.
- [praise] review-round.test.mjs 'review-owner-rounds with review-writer-text' — The joined-condition test covers both sides. It checks the owner line two lines below the Consensus line in a round 3 section, and that the writer prompt still ends on summaryLine with the reviewer's own Summary dropped.

In-scope specs: openspec/changes/review-owner-rounds/specs/review-round/spec.md, plus openspec/specs/review-round/spec.md (the base's review-writer-text requirements, read only to check the join).

### Coverage
| Requirement | Status |
|---|---|
| A round beyond the second runs within the authorized limit (MODIFIED) | covered |
| A round beyond the second needs the owner's recorded words | covered |
| The owner command reads the owner's words from the record | covered |
| The round's section quotes the owner's words | covered |
| The review skill fills the owner's words from the record | covered |

Merge resolution (3480c886, own lines only): the conflict in `review-round.mjs` leaves `ownerLine` next to `withoutSummary` and `summaryLine` in both NAMES and the export list. `consolidate` keeps the owner line between the Consensus line and `## Open findings`. `writerPrompt` is unchanged from the base. No scope creep or gap came from the merge. The evidence refresh says the owner path did not change, and the diff supports that: `openspec/specs/review-round/spec.md` is a base-only addition, and the change's delta spec is untouched since round 1.

Tests: `review-round.test.mjs` passed 121 of 121. The earlier deliver-check parity scenario was checked in round 1 and the merge did not touch it.

### Summary
- 1 findings (0 blocking, 0 important, 1 nit) + 1 praise; open: F1; fixed: none; refuted: none
