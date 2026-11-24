<!-- devkit-stage review result=passed attempt=2 commit=d0a2b37eb677790cbbb1422d2ecf4b5143da5d89 -->
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
