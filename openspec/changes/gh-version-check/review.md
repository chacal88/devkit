<!-- devkit-stage review result=failed attempt=1 commit=4fadc2a97437f4af8bdffab9070a42aa3eefaa52 -->
# Review: gh-version-check, round 1

Path: agents · range `c56155334749cdc46bad077ba8f53c4bbec5d140..4fadc2a97437f4af8bdffab9070a42aa3eefaa52` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 4fadc2a |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 4fadc2a |

Consensus: FAIL (round 1/2)

## Open findings
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:946-949 — [5] The state collector for the merge/archive facts calls checksItem and keeps only c.reason; with an old gh it carries the new text as a plain error string. No test runs that path with an old gh, so a change to how ghTooOld is consumed there would stay green. Write in: deliver-check.test.mjs, next to the gh-version 5-9 tests, with the same fakeGh pr-checks 'unknown flag: --json' fixture, asserting the collected checks.error includes 2.50.0 and 'update gh'.

## Refuted by verification
None.

## Notes
- code-quality-reviewer could not reproduce the suites in its own time limit; it took the test results from evidence.md at 4fadc2a.

## Next
Fix the open findings, then run review-change again (round 2).
