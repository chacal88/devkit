<!-- devkit-stage review result=failed attempt=1 commit=551ee6383b99eabd4589e6154ba08c730ad9748b -->
# Review

## Review: change-coordinator, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 551ee63 |
| spec-reviewer | rejected | 0 | 3 | 3 | 0 | 551ee63 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 551ee63 |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | 551ee63 |
| architecture-reviewer | rejected | 0 | 1 | 1 | 0 | 551ee63 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 551ee63 |

Consensus: FAIL (round 1/2)

### Open findings
- spec-reviewer — [important] change-loop.mjs:853-869 (stopDecision); SKILL.md Loop (agent failure, gate red); requirements.md AC-6 vs coordination-locks spec "An end state" — AC-6 says the stop is not refused in any of the four end states. The lock calls nextAction with no --after, so it cannot see an end the session declared itself: a stage agent that returned failure, a red gate (tests-red), or a no-progress or not-delivered end. The next action is still a ready stage, so the first stop is refused, and only the repeat passes. The spec delta ties the allow to 'the next action is an end', so it is met literally, but AC-6 is not met for those blocked ends, and the spec and the design never say that cost is accepted. The live run shows it: the first refusal in L2 came right after the session ended the run as blocked, and in L4 the session answered the refusal by asking the owner instead of running the stage. Either word AC-6 and the delta to say a declared blocked end costs one refusal, or let the lock see the declared end.
- spec-reviewer — [important] change-loop.mjs:926-945 (agentDecision, roleOf); coordination-locks spec "Another agent"; change-loop.test.mjs:1690 — The hand-off lock lets an Agent call with no subagent_type through (the test pins it as allowed). The tool is documented as defaulting to a general-purpose agent when the type is omitted, but I did not verify that here. The scenario says a general-purpose agent hand-off is refused. The lock also compares only the part after the last colon, so another plugin's agent named like a script role (for example other:tdd-implementer) is allowed, although the scenario says another plugin's agent is refused. The tests use other-plugin:fixer, which does not exercise that. AC-8 asks that a hand-off to any other agent be refused.
- spec-reviewer — [important] change-loop.mjs:988-994 (failure); coordination-locks and change-coordination "Replies use no internal term"; AC-11 — On a usage or settings error the reply puts the raw error inside the blocked message, with 'change ?' as the id when no --change is given. I ran `start --bogus`. The reply was 'The change ? stopped: the change cannot be read (unknown option --bogus; usage: change-loop.mjs next --change ...)'. It names the script file, its options and a literal '?'. The scenario "A usage error" asks only for a reply saying the change cannot be read. The message-table test renders unreadable with a harmless error, so it never catches this path. The skill tells the session to say reply as it is.
- test-coverage-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:888,927 — [7] subagentStopDecision and agentDecision find the change through locate(); no lock test puts the change in a worktree while cwd is the main checkout (the topology open creates). Mutation run: both locate calls replaced by the start root, and all 36 'change-loop lock' tests stayed green. Add a worktree case to the lock subagent-stop and lock agent blocks in change-loop.test.mjs.
- test-coverage-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:761-765 — [6] The rollback of openChange (worktree and branch removed when openspec new change or the template step fails) has no test; a broken rollback would leave a half-made change that makes the retry answer name-taken. Write it in change-loop.test.mjs, change-loop open: block, with a fake openspec runner and a snapshot().
- architecture-reviewer — [important] plugins/openspec/hooks/change-loop.mjs:255 — ROWS and AGENT restate the step-to-agent mapping that conduct-check's actorOf/SUBAGENT already owns (and the row already carries agent); the test checks step names only, not roles, so the two can drift silently.

### Refuted by verification
None.

### Notes
- The first stage-1 answer of the spec-reviewer matched scenario titles to test names without reading the two main spec deltas or the code; it was sent back before the verify stage and its second answer, used here, brought the three important findings.
- Three verdict files (spec-reviewer, test-coverage-reviewer, architecture-reviewer) carry the stage-1 text verbatim below the findings, including that text's own 'Verdict: approved' line; line 1 of each file is the verdict that counts (rejected: a verified important finding is open).

### Next
Fix the open findings, then run review-change again (round 2).
