<!-- devkit-stage review result=failed attempt=1 commit=73e159c2acfac2959d8f6f84b099c538b0eafc54 -->
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
