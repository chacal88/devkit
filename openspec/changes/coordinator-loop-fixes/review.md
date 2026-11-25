<!-- devkit-stage review result=failed attempt=2 commit=9eaef847377372376ef25eb7a8f400d0e3ccf619 -->
# Review: coordinator-loop-fixes, round 1

Path: agents · range `3ca2e47e35e95cf53cf745a23838909c88dcd5ce..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 1 | 1 | 0 | 73e159c |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | 73e159c |
| code-quality-reviewer | rejected | 0 | 1 | 1 | 0 | 73e159c |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 73e159c |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 73e159c |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 73e159c |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md:55-74 (Decision 3, 4, 5, 7); docs/compozy-kit.md:124-128 — ADR 0032 decisions 3, 4, 5 and 7 apply to every run, but the approved plan narrows them: CompozyOS has no declare step, so it keeps asking the owner at a red gate and stops review at 2 rounds; an archive that left a delivery train keeps its blocked stop-archive on a conflict outside the release files; and approvals without a '- Plan:' line never go stale. None of these limits is recorded in ADR 0032 or ADR 0024, although docs/compozy-kit.md:124 says ADR 0024 lists each limit.
- code-quality-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:3289 (runDeclare) and plugins/openspec/skills/ship-change/SKILL.md:60 (stop-review-deadlock row) — The owner's words reach `declare review-round` only as `--param words="<their words>"` on the shell command line; runDeclare parses no `--stdin`, unlike `reply`, which got it so free text with quotes, `$` or backticks never goes through the shell (jira-entry-followups D-5). Owner words containing a backtick or `$(...)` inside double quotes run a command substitution, and the recorded words are not the ones the owner typed. Real run R7s used only plain words. Fix: accept `--stdin words` in runDeclare as runReply does, and have the ship-change and devkit rows (and design D-4) pass the words through the quoted heredoc `<<'DEVKIT_ARGS'`.
- test-coverage-reviewer — [important] plugins/openspec/hooks/conduct-check.mjs:64 — [5] The conduct-check side of conductor-task is untested. Removing 'conductor-task' from MAIN makes actorOf return { actor: 'stop', reason: 'unknown step conductor-task' }. deliveryStep then replaces next.reason with that text, the row's state reads 'blocked: ...: unknown step conductor-task', and selectDispatch never dispatches it; the change loop also passes that reason on in the action's detail. No test fails: T68 builds the row with rowOf, which skips actorOf, and the 'loop's step agents match conduct-check's actorOf' test only checks agents, so a session step with no agent is never checked. Real run r9 would also stay green, because ROWS still holds the step. Write in: conduct-check.test.mjs next to T45: assert.deepEqual(actorOf('conductor-task'), { actor: 'main' }), and a deliveryStep row for conductor-task whose state is not blocked and whose reason is deliver-check's.

## Refuted by verification
None.

## Notes
- Path agents: the round ran on a turn the owner did not type.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: coordinator-loop-fixes, round 2

Path: agents · range `73e159c2acfac2959d8f6f84b099c538b0eafc54..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 9eaef84 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | 9eaef84 |
| code-quality-reviewer | rejected | 1 | 0 | 1 | 0 | 9eaef84 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 9eaef84 |
| spec-reviewer | rejected | 0 | 1 | 1 | 0 | 9eaef84 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 9eaef84 |

Consensus: FAIL (round 2/2)

## Open findings
- code-quality-reviewer — [blocking] openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md:317-331, specs/file-writers/spec.md:49, design.md:265-272 and 444-487 (commits 59b8350, 66f3553) — The round-1 fixes revised the approved plan (the requirement's SHALL text changed from `--param words=<the owner's words>` to `--stdin words`, a new scenario added, the file-writers scenario widened to node option words, D-4/D-8 and T143-T148 added) with no new readiness review (readiness.md still attempt 12 at 8c62468) and no owner approval of the revised plan (approval.md unchanged since 84da214); ship-change's fix-review row requires change-planner, readiness and the owner's approval before such a fix, and the loop cannot catch it because approval.md has no `- Plan:` line. Fix: run the readiness review on the revised plan and record the owner's approval, or the owner's own word that this revision rides the existing approval (owner's call).
- spec-reviewer — [important] openspec/changes/coordinator-loop-fixes/specs/change-coordination/spec.md:317-330 (Requirement "The owner authorizes one more review round after the limit", new scenario "The owner's words are record… — The round-1 fixes (59b8350, 66f3553) rewrote a SHALL of the change-coordination delta (`--param words` to `--stdin words`), added a scenario, widened a file-writers scenario and edited design D-1/D-4 after the owner's last approval (84da214), with no new readiness review or approval; the ship-change fix-review row, the change's own requirement "A plan revised after the work started goes back to its gates" and ADR 0032 decision 7 ask for both, and only the missing `- Plan:` line lets the tool miss it. The owner decides whether these deltas join the approved plan.

## Refuted by verification
None.

## Notes
- Path agents: the round ran on a turn the owner did not type.

## Next
Consensus deadlock after round 2: the owner decides.
