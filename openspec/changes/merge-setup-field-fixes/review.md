<!-- devkit-stage review result=failed attempt=1 commit=58d7a8b07652ce057525b17f051fad8db1b7eb3b -->
# Review: merge-setup-field-fixes, round 1

Path: agents · range `main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 58d7a8b |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 58d7a8b |

Consensus: FAIL (round 1/2)

## Open findings
- test-coverage-reviewer — [important] plugins/openspec/skills/openspec-setup/scripts/github-setup.mjs (requirementSources, checksFrom 'unreadable') — No test covers the 'newest pull requests could not be read' label or checksFrom === 'unreadable'. If the discoverError branch were mislabelled as 'pull-requests', nothing goes red. Write in github-setup.test.mjs using the world() helper, with the pull-requests read failing and no --checks.
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs:1648 (checksToWatch) — The stop-merge-setup watch guards on !state.archive and pr.state === 'OPEN'; no test pins them. With the archive PR phase or a MERGED/CLOSED PR carrying a stale pending check, a watch could start wrongly and every field-fixes 9 test stays green. Write in deliver-check.test.mjs next to the field-fixes 9 tests, using mergeReady() and a merged PR state or an archive state with a pending check, asserting watchCalls is empty.

## Refuted by verification
None.

## Notes
- Agents path: the turn was a background notification, not typed by the owner.
- outcomes gave no writer prompt; the session built each stage-3 prompt with the round rules writerPrompt (the gap round 25 review-writer-prompt covers).
- Stage-1 answers gave a placeholder commit; the session put the full sha of HEAD (58d7a8b07652ce057525b17f051fad8db1b7eb3b) in before verify.

## Next
Fix the open findings, then run review-change again (round 2).
