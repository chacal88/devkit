<!-- devkit-stage review result=passed attempt=3 commit=7b3b6b8b12dbed5e6a7a378cc14030af8a28e318 -->
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

# Review: coordinator-field-fixes, round 2

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 4f6d958 |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 | 4f6d958 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 4f6d958 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 4f6d958 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 4f6d958 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 4f6d958 |

Consensus: FAIL (round 2/2)

## Open findings
- spec-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:614-620,627-637 vs specs/change-coordination/spec.md (A change archived on the default branch is not unfinished) — A new change that reuses an archived id and was created after the archive is now listed, which the SHALL NOT requirement forbids; no scenario or design text states the exception. Extend the spec (reuse scenario, day-granularity rule) or drop the behavior.

## Refuted by verification
None.

## Notes
- Path agents: the turn that started this round was not typed by the owner.
- All six reviewers were summoned, as the delivery checker named them: the fixing commit fb91e5f touched code, so the four round-1 approvals at 403b38c were stale.
- The fix of code-quality-reviewer's round-1 finding (fb91e5f: a new change that reuses an archived id, created after the archive, is listed again) is what spec-reviewer now rejects: the change-coordination delta says SHALL NOT list a change archived on the default branch, with no reuse exception. The two findings pull in opposite directions unless the spec delta gains the exception, and the spec delta is a plan file the owner approved.
- adr-reviewer answered round 2 with an empty findings list and said its three round-1 nits still stand; they are in the round 1 section above and in no verdict file now.
- The stage-3 prompts were built with the script's own `writerPrompt` rule (`loadRules`), as in round 1.

## Next
Consensus deadlock after round 2: the owner decides.

# Review: coordinator-field-fixes, round 2

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 7b3b6b8 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Path agents: the turn that started this call was not typed by the owner.
- This is the third review call of the change. The owner authorized it on 2026-11-21 after the deadlock of round 2 (approval.md, History); the round script accepts only rounds 1 and 2, so the call ran as its round 2 and the heading and the Consensus line say round 2.
- Scoped call: only spec-reviewer was summoned, the one reviewer that rejected at 4f6d958. The five approvals at 4f6d958 (adr-reviewer, code-quality-reviewer, test-coverage-reviewer, security-reviewer, architecture-reviewer; table of the section above) stay current: the one commit since, 7b3b6b8, touches only files under openspec/.
- What changed between the two calls: the owner chose to state the reused archived id in the specification (requirements.md A-18); 7b3b6b8 adds the requirement "A new change that reuses an archived id is unfinished" to the change-coordination delta and describes the rule in design.md D-3 and proposal.md, after a new plan readiness review (attempt 3) and the owner's approval of the revised plan. No product code or test changed.
- No finding went to the verifiers: spec-reviewer's only important finding came back with the disposition `fixed in 7b3b6b8`, and its two nits are never verified.
- The stage-3 prompt was built with the script's own `writerPrompt` rule (`loadRules`), as in the earlier rounds.

## Next
Ready to ship.
