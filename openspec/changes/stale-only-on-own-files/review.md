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
