# Review: stale-only-on-own-files, round 1

Path: agents · range `origin/compozy-driver...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | rejected | 0 | 1 | 1 | 0 | de79c56 |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | de79c56 |

Consensus: FAIL (round 1/2)

## Open findings
- code-quality-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:2518 — judgeBoarded builds gitFacts(wt) with no base, so a train PR judges each boarded change by the old strict rule and fails a head whose own devkit-reviews check passed after an unrelated base merge; D-4 does not cover this call and no test or doc says the train stays strict. Fix: pass { base } (judgeBoarded already has it) with a train test, or document the strict train rule in D-4, the flow doc and ADR 0025.
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:1946-1947; plugins/openspec/hooks/flow-check.mjs:272 — [5] The configuredBase / GITHUB_BASE_REF wiring into stalenessBase in collectState and collectFlow has no test: replacing it with null leaves every test green (wired tests use only the main fallback); write in deliver-check.test.mjs and flow-check.test.mjs a base 'develop' / GITHUB_BASE_REF case through collectState and collectFlow.

## Refuted by verification
None.

## Notes
- Range: origin/compozy-driver...HEAD (the stack below is not this change)
- Whole suite run once on 8d92bb9: 2913 pass, 0 fail

## Next
Fix the open findings, then run review-change again (round 2).

# Review: stale-only-on-own-files, round 2

Path: agents · range `de79c5649f8ea75b4e5a7bd1ce9d3aa8e4f0d7e1..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 962e43e |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 962e43e |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Round 2 re-reviewed only the round-1 findings and the lines changed since (range de79c56..HEAD); all fixed in 962e43e
- One nit stays open and does not block: the move-under-openspec and root-commit scenarios are tested only without a base (ownFiles own test covers both sides of a move)
- The whole suite runs once more at the final commit; its log goes to the evidence

## Next
Ready to ship.


# Review: stale-only-on-own-files, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 8c9685d |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 8c9685d |

Consensus: PASS (round 1/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Fresh round 1 because the evidence and reviews went stale after merges of main (suite-speed PR 98 and the roadmap-panel-study archive PR 96); no round budget consumed beyond this call
- The own-files code is unchanged since the round-2 approval at 962e43e; the 29 tests of this change moved into the split test files, 28 byte-identical and own-files AC-8 ci differs only by the shared GUARD_FILE fixture
- One nit stays open and does not block: tasks.md gates 1.5, 2.5 and 3.8 still name node --test guard.test.mjs, which after suite-speed matches only its own tests; node scripts/test-suite.mjs and the filtered runs cover the change (evidence.md says so)
- The move-under-openspec and root-commit scenarios are still tested only without a base (carried nit)
- The whole suite ran once at 8370f95 (2944 tests, 2941 pass, 0 fail, 3 skipped); the commit after it adds only evidence.md

## Next
Ready to ship.
