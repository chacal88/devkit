# Review: post-merge-validate, round 1

Path: agents · range `9dff5735a04c18ec3190965d7fca32087e7f5331..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 1 | 1 | 0 | 24725d7 |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 | 24725d7 |
| code-quality-reviewer | rejected | 1 | 0 | 1 | 0 | 24725d7 |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 24725d7 |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:2739 and 2792-2796 — merge-check is a command-only session step but is missing from COMMAND_STEPS, so the CompozyOS view hands it to a coordinator agent with a brief naming a ship-change row that does not exist; this drifts from ADR 0024 decision 4 (deterministic command steps run by the loop with no agent). Fix: add it to COMMAND_STEPS with a compozy test, or record the kit's view as out of scope in the design.
- spec-reviewer — [important] openspec/changes/post-merge-validate/specs/change-coordination/spec.md, 'A merge of the base is checked before the evidence' vs openspec/specs/change-coordination/spec.md 'From the implementation on,… — The delta only ADDs a requirement whose scenarios say that, with an unchecked merge, verify, review, wait-checks and ready give merge-check instead. The canonical scenarios 'The demonstration', 'The code review', 'Waiting on GitHub' and 'Other owner gates' still say those steps give the verifier, the review session step, a wait or an owner end. After archive the two read as contradicting unless the reader knows the new requirement takes precedence, and the delta states no precedence. Either MODIFY those scenarios or state the precedence in the requirement.
- code-quality-reviewer — [blocking] plugins/openspec/hooks/change-loop.mjs:1672 — run(['validate', id, '--strict', '--json']) has no --type change. When the change id equals a canonical spec capability name, openspec answers ambiguous_item and the check is cannot-run; the loop then ends blocked as merge-check-failed on every retry and the session cannot fix it. This repo has 7 archived change ids equal to spec names. Reproduced with openspec: validate x --strict --json gives ambiguous_item (Pass --type change|spec.), and --type change gives valid:true. Fix: add --type change and a test with a spec and a change of the same name.
- test-coverage-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:2739,2792-2796 — [6] buildView does not list merge-check in COMMAND_STEPS: under next --view compozy it becomes a coordinator hand-off pointing at a nonexistent ship-change row, and no compozy test covers it - write in: change-loop-compozy.test.mjs beside the take-place view test

## Refuted by verification
None.

## Notes
- Round 1 ran on the agents path: the turn did not begin with the owner's own typed message.
- Bench: adr-reviewer, spec-reviewer, code-quality-reviewer and test-coverage-reviewer; the four open important or blocking findings were each verified by three finding-verifiers and none was refuted.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: post-merge-validate, round 2

Path: agents · range `9dff5735a04c18ec3190965d7fca32087e7f5331..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 369bbac |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 369bbac |
| code-quality-reviewer | rejected | 0 | 1 | 1 | 0 | 369bbac |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 369bbac |

Consensus: FAIL (round 2/2)

## Open findings
- code-quality-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:1373 — The planner's brief (and design.md, spec.md and the header comment at line 16) still names `openspec validate <id> --strict` without --type change, so for a same-name spec the planner's own confirmation command answers ambiguous_item

## Refuted by verification
None.

## Notes
- Round 2 ran on the agents path with the four reviewers of round 1, each against its previous verdict and the range 24725d7..HEAD.
- The one open important finding (code-quality-reviewer F4: the planner's brief and the plan texts name `openspec validate <id> --strict` without --type change) was verified by three finding-verifiers and none refuted it. No automatic third round: the disputed point goes to the owner.

## Next
Consensus deadlock after round 2: the owner decides.

# Review: post-merge-validate, round 2

Path: agents · range `9dff5735a04c18ec3190965d7fca32087e7f5331..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 7f9624e |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 7f9624e |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 7f9624e |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 7f9624e |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Third pass on the agents path, allowed by the owner's own typed word "terceira rodada ok" after the round-2 deadlock (the round field stays 2 because the review script knows no round 3).
- The fix for the one open important finding (the planner brief and plan texts name the check with --type change) is 1c283d6; the code-quality reviewer re-checked it and approved. The ADR, spec and coverage verdicts were refreshed at the new head because the fix commit touched code and docs, and are approved.
- Open nits left on purpose: the ADR 0017 Note wording, the bare command in plan prose, and the bare command in agent texts outside this change (backlog).

## Next
Ready to ship.
