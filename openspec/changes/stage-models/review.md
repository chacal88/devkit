<!-- devkit-stage review result=failed attempt=1 commit=e05787469f3a59a3de0a574a325a230566707b5e -->
# Review: stage-models, round 1

Path: agents · range `19c0196..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| code-quality-reviewer | rejected | 0 | 1 | 1 | 0 | e057874 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | e057874 |

Consensus: FAIL (round 1/2)

## Open findings
- code-quality-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:1013 (retried); proof/run-notes.txt deviation 3 — No spec, ADR 0020, design A-6 or test states that the retry fires only when a stage agent stops without writing its stage file; the subagent-stop hook makes a real agent write result=failed, which yields a fix-tests hand-off, not a retry. The proof needed stubs that ignore the hook and D-13 lacks that text. Fix: document the real trigger in the docs and D-13, and add a test or scenario for failure plus a result=failed file.

## Refuted by verification
None.

## Notes
None.

## Next
Fix the open findings, then run review-change again (round 2).
