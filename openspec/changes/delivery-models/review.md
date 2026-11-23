<!-- devkit-stage review result=passed attempt=2 commit=64ed99fa03ddad4e40b2e6680588e424e61ee715 -->
# Review: delivery-models, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 1 | 1 | 0 | 26e00b1 |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 | 26e00b1 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 26e00b1 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 26e00b1 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 26e00b1 |
| architecture-reviewer | approved | 0 | 0 | 2 | 2 | 26e00b1 |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] docs/adr/0017-the-delivery-model-is-chosen-per-project.md — ADR number 0017 is already taken on origin/main by 0017-a-change-state-is-derived-in-one-place.md (and 0016 exists too); renumber to the next free number on merging main and update all references.
- spec-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs nextStep (two-prs block, after the `it(5).details.none` row); design.md D-4 table T3/T5 — Partial coverage of 'The two-pull-request delivery stops where it cannot go on by itself' / scenario 'The test-branch pull request was closed': the blocked row for a closed test PR (T5) sits after the base-PR rows. With a closed test PR the run can still emit open-pr (no base PR), push, or edit-pr-body before it blocks. The requirement says it SHALL open, move, close, push or merge nothing. The tests only cover the case where the base PR exists, is pushed and has a complete body. Move the closed-PR block ahead of those rows, or record in the spec that the block applies only after the base PR is in order.

## Refuted by verification
- architecture-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:140 — deliver-check.mjs grows to 2235 lines. It now holds deliveryConfig, the worktree listing, the test-branch PR, the support-branch and resolution state and the two-prs context. That scatters a flow across one file and lowers locality; it passes the deletion test only because the callers would be unreadable otherwise. Direction: after this change, carve the two-prs state (supportState, resolutionState, findTestPr, testBranchPr, twoPrsRules) into its own hook module behind one entry point, as a follow-up, and record it as an ADR candidate. · refuted: design.md:29-32 forbids a new module or import in deliver-check.mjs, guard.mjs and merge-setup.mjs because the CI job downloads exactly those three files, and twoPrsRules/testBranchPr (deliver-check.mjs:2113,2132) sit on that CI path; the line-count claim (2235) is true but the proposed split breaks the recorded constraint. / design.md:29-33 forbids any new module or import in deliver-check.mjs because devkit-reviews.yml:22-24 downloads only that one file for CI; twoPrsRules/testBranchPr (deliver-check.mjs:1967-2132) run on the --ci path, so the proposed split would break the download contract (2 of 3)
- architecture-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:142 — The delivery settings have two owners. guard.mjs parses and validates them (parseDevkitBlock, deliverySettings), and deliver-check.mjs combines them with the ship map (deliveryConfig, MODEL_SHIP). The MODEL_SHIP mapping and the model-to-ship rule have no single home that guard, the CI check and the loop can all share. Direction: confirm that guard.mjs and the CI template read the model only through deliverySettings. If one of them also needs the ship mapping, move MODEL_SHIP next to deliverySettings in guard.mjs. · refuted: grep of plugins, .github and scripts shows MODEL_SHIP only at deliver-check.mjs:140,155; guard.mjs:129 and change-loop.mjs:66 read the model only via deliverySettings; the CI template does not read the ship mapping, so the finding's own condition for moving MODEL_SHIP is unmet / MODEL_SHIP is referenced only at deliver-check.mjs:140/155 (grep over plugins/scripts/.github excluding tests); guard.mjs:129 deliverySettings and change-loop.mjs:66 read only the model; flow-check.mjs:11,239 reuses deliveryConfig, so the mapping has one home and the finding's own condition (guard or CI also needs ship) is not met (2 of 3)

## Notes
- Three reviewers (spec, code-quality, security) were re-run in stage 1 once: their first answers listed unread files and the round refused them.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: delivery-models, round 2

Path: agents · range `26e00b19de03124db593d628a40c3383400db2c6..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 64ed99f |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 64ed99f |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 64ed99f |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 64ed99f |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 64ed99f |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 64ed99f |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Round 2 re-ran all six reviewers: the merge of origin/main in 99ef2bd staled every round-1 verdict. Each reviewed only this change's part of 26e00b1..HEAD.

## Next
Ready to ship.
