<!-- devkit-stage review result=passed attempt=3 commit=c6442089e54614c6871c50400b920f810a467c85 -->
# Review: forced-merge-path, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 1 | 1 | 0 | 0de71c2 |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 | 0de71c2 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 0de71c2 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 0de71c2 |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 0de71c2 |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md Decision 1 vs plugins/openspec/hooks/deliver-check.mjs:823-848 and specs/change-delivery/spec.md (An owner's forced merge is to… — ADR 0028 decision 1 says a merge is forced when `check` or `devkit-reviews` is not SUCCESS or is absent. The code, spec and docs/openspec-flow.md instead use the checks the default branch requires, plus `devkit-reviews` only when it reported. A project whose ruleset names other checks, or does not require `devkit-reviews`, is judged by a different rule than the one the accepted ADR states. Fix: align the ADR's decision 1 wording with the specced rule (the owner re-accepts the edit), or note the difference in the ADR.
- spec-reviewer — [important] specs/change-delivery/spec.md, requirement "A merged pull request is found from any checkout"; evidence.md Observations 1 — Spec ambiguity resolved silently: when several merged pull requests pass isOwnPr (stacked delivery-train PRs 91, 93, 94), the number found depends on the checkout (#91 from main, #93 from the change's own branch), and no scenario says which one is the change's. The retro text and tag-release name that number. The evidence records it as inherited and left to the owner. Decide the rule in the spec or record it as a follow-up change.
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check-archive.test.mjs:2305-2379 (L1, L3) over deliver-check.mjs deliveryOf:960-975 — [6] The commit arm's success path is never composed with deliveryOf, collectState or nextStep. L1 checks only that findChangePr returns via 'commit', and L3 composes only the error branch. Spec scenario 'Older than the newest 100': 'the delivery is judged on it'. If a change made deliveryOf skip the forced read, or the retro, for a via 'commit' pull request, no test goes red. In a scratch composition (pm with 100 non-own merged PRs, COMMITS_KEY and PULLS_KEY answering #12, forcedFixtures at head 'a'*40), the code answers retro for #12 with the 4-item reason. With every task ticked it answers today's 'the change PR is merged; run the retro'. Both are correct today, so this is a test gap, not a defect. Write in: deliver-check-archive.test.mjs beside L3, with the same pm({ mergedPrs: cap() }) and stateOf/nextStep shape, one case with 9.6 unticked and one fully ticked.

## Refuted by verification
None.

## Notes
- The test-coverage-reviewer's first stage-1 answer was refused (notRead was not empty) and the reviewer was run again once, with the same range.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: forced-merge-path, round 2

Path: agents · range `0de71c21dbbf05b099cb402387237df4cac9a622..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | d0a2b37 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | d0a2b37 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | d0a2b37 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | d0a2b37 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | d0a2b37 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
None.

## Next
Ready to ship.

# Review: forced-merge-path, round 1

Path: agents · range `d0a2b37eb677790cbbb1422d2ecf4b5143da5d89..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 470a8ca |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 470a8ca |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 470a8ca |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 470a8ca |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 470a8ca |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Stale-only re-review after two merges of main (train 4 and train 6) and the evidence attempts 3-4; it consumes no round. The code-quality-reviewer's first stage-1 answer was refused (notRead was not empty) and the reviewer was run again once.

## Next
Ready to ship.

# Review: forced-merge-path, round 1

Path: agents · range `470a8ca1785f800a8d4ee4d5858be00edc9e6d61..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | c30bfb8 |
| architecture-reviewer | rejected | 0 | 1 | 1 | 0 | c30bfb8 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | c30bfb8 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | c30bfb8 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | c30bfb8 |

Consensus: FAIL (round 1/2)

## Open findings
- architecture-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:946 — gatesAtHead calls verdictAllowed without the open flag main added (jira-entry-followups D-2), so a forced merge reads an approved verdict with an undisposed finding as passing while readReviews reads it as stale; the retro under-reports a gate. Reuse one currency rule or test and record the divergence.

## Refuted by verification
None.

## Notes
- Stale-only re-review after the merge of main at eb0477c (trains 7-8) and evidence attempt 5; it consumes no round. One new important finding (architecture-reviewer F1: gatesAtHead does not pass main's new open flag to verdictAllowed) was confirmed by three verifiers.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: forced-merge-path, round 2

Path: agents · range `c30bfb8d0761b3f7f73f1f8ceaf94b8736f2ea53..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 8dcee76 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 8dcee76 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 8dcee76 |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 | 8dcee76 |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 8dcee76 |

Consensus: FAIL (round 2/2)

## Open findings
- spec-reviewer — [important] specs/change-delivery/spec.md 'A review that did not pass' (deliver-check.mjs:947-962) — The gate at the merged head now treats an approved verdict that lists an undisposed finding as current only behind commits of the change's own review record (0934b63, tests G11 and G12). The spec scenario says only 'recorded before a product change'. The stricter rule, the 'fixed in <sha>' check through the GitHub compare route at the merged head, and the block on a compare error other than 404 are in no scenario. The change resolved this silently. Extend the scenario, or say it follows main's readReviews rule.
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:951-958 (inHead in gatesAtHead); deliver-check-archive.test.mjs G12 — No test puts a 'fixed in <sha>' whose compare answers behind, diverged or 404 on a verdict. If inHead always returned true, G11 and G12 would stay green and a finding fixed in a sha outside the merged head would pass as disposed. Write in deliver-check-archive.test.mjs, next to G12, with openGateRepo and compareFx('behind'|'diverged') or a 404 fixture; expect the stale-behind-head gate.
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:956-958 (historyError) — The rule 'a non-404 compare error blocks the gate' (return { error }) is asserted by no test. G9 covers contents-read errors but not the compare route in inHead. Dropping the historyError line, or treating the error as a 404, stays green. Write in deliver-check-archive.test.mjs beside G9: a 'fixed in' verdict whose compare answers a 500 or timeout, expecting { error }.

## Refuted by verification
None.

## Notes
- Round 2 FAIL: no convergence after round 2; escalated to the owner (no automatic third round). spec-reviewer F3 asks for a spec-delta scenario, which needs the owner's approval of the plan revision.

## Next
Consensus deadlock after round 2: the owner decides.

# Review: forced-merge-path, round 3 (run as round 1 of a new cycle)

Path: agents · range `8dcee767e6571680c851906a17ba978980a1316a..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | c644208 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | c644208 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | c644208 |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Round 3, approved by the owner after the round-2 deadlock (owner's words: "Aprovo o round 3"). The round script counts only rounds 1 and 2, so this round ran as round 1 of a new cycle. Bench: spec-reviewer and test-coverage-reviewer (rejected in round 2) and code-quality-reviewer (stale: ca5b3b3 touched a test file). adr-reviewer and architecture-reviewer stay approved at 8dcee76; since then only openspec files and deliver-check-archive.test.mjs changed.

## Next
Ready to ship.
