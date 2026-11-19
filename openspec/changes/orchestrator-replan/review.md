# Review: orchestrator-replan, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | e6ea4e5 |
| code-quality-reviewer | rejected | 1 | 1 | 2 | 0 | e6ea4e5 |
| test-coverage-reviewer | rejected | 0 | 2 | 2 | 0 | e6ea4e5 |

Consensus: FAIL (round 1/2)

## Open findings
- code-quality-reviewer — [blocking] openspec/changes/orchestrator-replan/evidence.md AC-1 row — Evidence says ADR 0010's Alternatives table lists 12 options (lines 179-190); the table at docs/adr/0010-openspec-as-the-harness.md has 11 rows. This is a false claim in the proof. Fix: correct the count to 11 and the line range, and re-read the other numeric claims in the file.
- code-quality-reviewer — [important] plugins/openspec/README.md:3; docs/openspec-flow.md:3; README.md ("Earlier attempts... state in files" paragraph) — Each still states the superseded ADR 0001 rule as current: 'No coordinator session, no state machine', 'no orchestrator session in the middle'. This contradicts ADR 0010 (two coordinators, OpenSpec as harness) and AC-4. The AC-4 grep did not search these phrasings. Fix: add 'today' or 'until round 15' to the sentences, or reword them, and widen the AC-4 sweep.
- test-coverage-reviewer — [important] openspec/config.yaml:35 (rules.design third entry, now quoted) — [6] AC-7 fix has no durable test: if the unquoted `: ` returns, OpenSpec silently drops all three design rules and no test in guard.test.mjs or check.py goes red. Only the one-off evidence row (openspec instructions ... | grep 'ignoring this artifact') proves it. Write in: a follow-up test in guard.test.mjs or a check.py check that parses config.yaml rules as strings. This is outside this change's AC-6 scope, so it is a follow-up and not a gate.
- test-coverage-reviewer — [important] plugins/openspec/hooks/guard.test.mjs:1296-1316 — [5] The supersession seam is guarded for ADR 0007 only. ADR 0001 `superseded by ADR 0010`, the existence and `accepted` status of ADR 0010, and `0010` in the config.yaml ADRs line are checked only by one-off greps in evidence.md. Deleting ADR 0010 or reverting ADR 0001 to `accepted` leaves the suite green; the existing test still checks only that ADR 0001 names ADR 0006. Follow-up: add the assertions to the existing 'ADR 0006 supersedes ADR 0005...' test, or a sibling ADR 0010 test, in the style of ADR 0004's test at line 592.

## Refuted by verification
None.

## Notes
- Path agents: the round ran on a turn the owner did not type.
- The outcomes command returned no writer prompt; the stage 3 prompts were built with the writerPrompt rule exported by review-round.mjs.

## Next
Fix the open findings, then run review-change again (round 2).

# Review: orchestrator-replan, round 2

Path: agents · range `e6ea4e53955bdd5d53848413ba381083bec4ce7d..HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 683ef5e |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 683ef5e |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | 683ef5e |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
- Path agents: the round ran on a turn the owner did not type.
- code-quality-reviewer re-emitted its stage 1 object once: its first reply gave finding F1 the disposition "fixed in d3a9928 and 683ef5e", which the validator refuses (one sha per disposition).
- The outcomes command returned no writer prompt; the stage 3 prompts were built with the writerPrompt rule exported by review-round.mjs.

## Next
Ready to ship.
