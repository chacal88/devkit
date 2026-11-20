Verdict: approved
Commit: c45c6b6467d7d3a3bce4efafd1eca890cc587a14

## Spec review: change-coordinator (round 2)

### Findings
- [important] change-loop.mjs stopDecision / guard.mjs runOf; coordination-locks 'An end state' — The stop lock could not see an end the session declared, so a failed agent, red gate or no-progress end cost one refusal; now the run's last recorded action is read from devkit-end lines and the stop is allowed at the first attempt. · fixed in 2d48034
- [important] change-loop.mjs agentDecision; coordination-locks 'Another agent' — A hand-off with no subagent_type was allowed and another plugin's agent named like a role passed; now no type is refused and the prefix must be none or the shipping pack. · fixed in 2d48034
- [important] change-loop.mjs failure; change-coordination 'A usage error' — The usage-error reply held the script name, option and a literal '?'; now it is the request-unreadable message and the raw text stays in the error field. · fixed in 2d48034
- [nit] change-coordination 'The message table is checked' — The spec did not state the two equal strings; it now names CompozyOS and the setting name driver. · fixed in 2d48034
- [nit] change-loop.mjs NAME; change-coordination 'An id that cannot be a change name' — The id pattern accepted a trailing dash; the pattern and the scenario now say 2 to 48 characters, no leading, trailing or double dash. · fixed in 2d48034
- [nit] coordination-locks 'The owner interrupts' — No test or live run exercises an interrupt; it rests on the documented platform fact.
- [nit] plugins/panel/hooks/i18n.ts conductMeaning — The meaning text changed with no scenario or AC asking for it; unchanged in this round.
- [nit] docs/adr/0008-reviews-as-a-workflow.md — The ADR named /conduct with no note of what replaced it; the fixing commit added a note. · fixed in 2d48034
- [nit] plugins/openspec/skills/devkit/SKILL.md Loop, agent item — The garbled 'with subagent_type is agent' sentence now reads 'set to the action's agent field'. · fixed in 2d48034
- [nit] plugins/openspec/skills/devkit/SKILL.md resolve-release-conflict bullet — A failed resolve-release-conflict hand-off is only said to end the run blocked, with no reply blocked declaration, so read literally it could still cost one stop refusal; point it at the declared-end rule.
- [praise] change-loop.test.mjs T3a, H4a, usage-error and worktree-layout tests — The new tests assert the THEN of each changed scenario: first-attempt allow with nothing recorded, the refusal text and roles, the reply string with the raw error kept apart, and the roles read from the change's own worktree.

## Spec review: change-coordinator (round 2)

In-scope specs: openspec/specs/change-stages/spec.md; the three deltas under openspec/changes/change-coordinator/specs/ (change-coordination, coordination-locks, change-stages); openspec/changes/change-coordinator/requirements.md (AC-1 to AC-15). ADR 0010 and ADR 0011 are the recorded decisions at play.

### Coverage
| Requirement | Status |
|---|---|
| change-coordination: the devkit command reads its verb (usage error) | covered |
| change-coordination: replies use no internal term | covered (usage reply; the equal-string exemption is in the spec) |
| change-coordination: every end of a run is marked in the record | covered |
| change-coordination: opening fails half-way, id rules | covered |
| change-coordination: agent of a delivery step comes from the checker's row | covered |
| coordination-locks: a run is known from the session's record, last action an end | covered |
| coordination-locks: no stop while a stage is ready | covered (interrupt case unexercised, F6) |
| coordination-locks: stage agent does not stop before its file (worktree) | covered |
| coordination-locks: hands work only to the script's roles | covered |
| All other requirements from round 1 | covered, unchanged |

AC-6, AC-8 and AC-11 are now delivered.

### Summary
- 0 blocking and 0 important. F1 to F3 fixed. F4, F5, F8 and F9 fixed. F6 and F7 unchanged. F10 is new.
- Verdict: approved.

Files read: previous reviews/spec-reviewer.md; the diff 551ee63..HEAD of change-loop.mjs, guard.mjs, SKILL.md and the two spec deltas; the test bodies for the new reply, next, wait, lock-stop, agent, subagent-stop, usage-error and PACKS tests in change-loop.test.mjs; the flow.json roles of plugins/openspec/schemas/.
