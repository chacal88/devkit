<!-- devkit-stage review result=failed attempt=1 commit=403b38c5370d0279c75d0c2ad20824c72570e014 -->
# Review: coordinator-field-fixes, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 403b38c |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 403b38c |
| code-quality-reviewer | rejected | 0 | 1 | 1 | 0 | 403b38c |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 403b38c |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 403b38c |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 403b38c |

Consensus: FAIL (round 1/2)

## Open findings
- code-quality-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:unfinished/note — An id archived once and reopened under the same id is hidden from the unfinished list, even from a worktree on its own branch (0.16.0 kept it); no test covers a reused id.
- test-coverage-reviewer — [important] plugins/openspec/hooks/deliver-check.mjs mergedOnBranch (open PR branch); test near deliver-check.test.mjs:4729 — [6] A further open PR on the same head after a merge with tasks left is returned as the PR; no test supplies an OPEN PR in pr-list, so always returning none (and mergedBefore) goes unnoticed.

## Refuted by verification
None.

## Notes
- Path agents: the turn that started this round was not typed by the owner.
- The first review of the change used the skill's matrix (six reviewers), not only the two the delivery checker names.
- spec-reviewer's first stage-1 answer was sent back before the verify stage: it had not opened the baseline specs, had read five deltas by their titles only and carried a placeholder commit; its second answer lists the files read and is the one recorded.
- security-reviewer, test-coverage-reviewer and code-quality-reviewer first answered with a placeholder commit (the short sha padded with zeros); each was sent back to run `git rev-parse HEAD` and re-emitted its block with nothing else changed.
- test-coverage-reviewer's file keeps a trailing `Verdict: approved` line from its own stage-1 text below the findings; line 1 (`Verdict: rejected`, computed by the round) is the verdict.
- `review-round.mjs outcomes` returned no writer prompt; the stage-3 prompts were built with the script's own `writerPrompt` rule (`loadRules`) and handed to each reviewer as a file.

## Next
Fix the open findings, then run review-change again (round 2).
