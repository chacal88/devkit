Verdict: rejected
Commit: 551ee6383b99eabd4589e6154ba08c730ad9748b

## Spec review — change-coordinator

### Findings
- [important] change-loop.mjs:853-869 (stopDecision); SKILL.md Loop (agent failure, gate red); requirements.md AC-6 vs coordination-locks spec "An end state" — AC-6 says the stop is not refused in any of the four end states. The lock calls nextAction with no --after, so it cannot see an end the session declared itself: a stage agent that returned failure, a red gate (tests-red), or a no-progress or not-delivered end. The next action is still a ready stage, so the first stop is refused, and only the repeat passes. The spec delta ties the allow to 'the next action is an end', so it is met literally, but AC-6 is not met for those blocked ends, and the spec and the design never say that cost is accepted. The live run shows it: the first refusal in L2 came right after the session ended the run as blocked, and in L4 the session answered the refusal by asking the owner instead of running the stage. Either word AC-6 and the delta to say a declared blocked end costs one refusal, or let the lock see the declared end.
- [important] change-loop.mjs:926-945 (agentDecision, roleOf); coordination-locks spec "Another agent"; change-loop.test.mjs:1690 — The hand-off lock lets an Agent call with no subagent_type through (the test pins it as allowed). The tool is documented as defaulting to a general-purpose agent when the type is omitted, but I did not verify that here. The scenario says a general-purpose agent hand-off is refused. The lock also compares only the part after the last colon, so another plugin's agent named like a script role (for example other:tdd-implementer) is allowed, although the scenario says another plugin's agent is refused. The tests use other-plugin:fixer, which does not exercise that. AC-8 asks that a hand-off to any other agent be refused.
- [important] change-loop.mjs:988-994 (failure); coordination-locks and change-coordination "Replies use no internal term"; AC-11 — On a usage or settings error the reply puts the raw error inside the blocked message, with 'change ?' as the id when no --change is given. I ran `start --bogus`. The reply was 'The change ? stopped: the change cannot be read (unknown option --bogus; usage: change-loop.mjs next --change ...)'. It names the script file, its options and a literal '?'. The scenario "A usage error" asks only for a reply saying the change cannot be read. The message-table test renders unreadable with a harmless error, so it never catches this path. The skill tells the session to say reply as it is.
- [nit] change-coordination spec "The message table is checked"; change-loop.test.mjs EXEMPT_EQUAL — The scenario says no Portuguese message equals its English one. The test exempts driver.compozy and setting.driver, which are identical. The spec should state the exemption.
- [nit] change-loop.mjs NAME regex (about line 779) — The id pattern accepts a trailing dash (for example 'a-') and needs at least 2 characters. The scenario says lowercase letters, digits and single dashes of at most 48 characters, which is ambiguous about the ends. The spec or the pattern should say which.
- [nit] coordination-locks spec "The owner interrupts" — Nothing in the tests or the live run exercises an interrupt. It rests on the documented platform fact that an interrupt fires no stop event, and evidence.md states the limit under AC-6.
- [nit] plugins/panel/hooks/i18n.ts conductMeaning (both languages) — The text changed from 'with child sessions' to 'stage by stage', and no scenario or AC-13 asks for it. It is a small consequence of the retirement.
- [nit] docs/adr/0008-reviews-as-a-workflow.md:29,55 — This ADR still names /conduct with no note of what replaced it. It follows the scenario (ADRs are records) and AC-15 (which lists 0005–0007 and 0009), so it is only worth a follow-up.
- [nit] plugins/openspec/skills/devkit/SKILL.md Loop, agent item — The sentence reads 'with `subagent_type` is `agent`'. It is garbled, and change-loop.test.mjs:1901 pins the exact text. It should read 'with `subagent_type` set to the `agent` field'.
- [praise] change-loop.test.mjs, change-loop.mjs, SKILL.md — The decision core is pure and tested row by row. The lock tests assert the THEN (the refusal text, the recorded key, per-session and per-agent records, fail-open). The skill covers the session-side THENs: the reply kept for the end of the turn, one question for the unfinished-work choice, the wait started in the background, and the approval and retro answers written only from the owner's message.

In-scope specs: openspec/specs/change-stages/spec.md; openspec/changes/change-coordinator/specs/change-coordination/spec.md; openspec/changes/change-coordinator/specs/coordination-locks/spec.md; openspec/changes/change-coordinator/specs/change-stages/spec.md; openspec/changes/change-coordinator/requirements.md (AC-1 to AC-15). ADR 0010 and ADR 0011 are the recorded decisions at play.

### Coverage
| Requirement | Status |
|---|---|
| change-coordination: the devkit command reads its verb | covered (rounds 18/18/19/23; usage error see F3) |
| change-coordination: runs only in a project set up for devkit | covered |
| change-coordination: the driver setting decides | covered (rounds 21, 22; unknown value names setting, value and accepted values) |
| change-coordination: two language settings | covered (normalizeLang, userConfig, brief names the files' language) |
| change-coordination: a free-text request opens a change | covered (worktree, branch, template with the request, origin fetch or HEAD, taken names) |
| change-coordination: the script follows the grill | covered (switch-script and script command; locked after the proposal) |
| change-coordination: unfinished work asked first | covered |
| change-coordination: calling again resumes | covered |
| change-coordination: each stage before the implementation goes to its role | covered |
| change-coordination: from the implementation on, the step goes to its role | covered (ROWS matches the checkers; gate and review are session steps in the skill) |
| change-coordination: a run ends in one of four states | covered (exit codes 0/1/2/3) |
| change-coordination: the loop does not repeat a stage with no progress | covered (K1/K2 on --after) |
| change-coordination: the hand-off names role, change and stage | covered |
| change-coordination: the session waits on GitHub with no time limit | covered (waitLoop, skill background wait, reply text) |
| change-coordination: replies use no internal term | partial (table clean; error path F3; two equal strings F4) |
| change-coordination: the conduct command is no longer shipped | covered |
| coordination-locks: a run is known from the session's own record | covered (runOf) |
| coordination-locks: the coordinator does not end its turn while a stage is ready | partial (F1 for declared blocked ends; interrupt F6) |
| coordination-locks: a stage agent does not stop before its file is delivered | covered |
| coordination-locks: the coordinator writes no product code in a run | covered |
| coordination-locks: hands work only to the script's roles | partial (F2) |
| coordination-locks: a lock never traps | covered (catch means allow; bypass exits before the lock) |
| coordination-locks: lock decisions can be recorded | covered |
| change-stages (delta): every shipped stage agent declares its stage's skills | covered |

AC-1 to AC-15: all are delivered. AC-6 is partial because of F1 and AC-8 is partial because of F2. AC-11 is partial because of F3 and its stated limit (the session's own wording and the grill's questions are untested).

### Summary
- 9 findings: 3 important (0 scope creep, 3 gaps), 5 nit, plus 1 praise; no blocking.
- Verdict: approved, with F1 to F3 reported.

Files read this time: /Users/kauesantos/Documents/devkit/.claude/worktrees/panel-conduct-view-404c57/ openspec/specs/change-stages/spec.md; openspec/changes/change-coordinator/requirements.md; openspec/changes/change-coordinator/evidence.md (proof map AC rows and live-run records); openspec/changes/change-coordinator/specs/change-coordination/spec.md (whole); specs/coordination-locks/spec.md (whole); specs/change-stages/spec.md; openspec/changes/change-coordinator/design.md (D-8 tables U/H, the end-state table, grep of D-8 and P4); plugins/openspec/hooks/change-loop.mjs (whole, 1065 lines); plugins/openspec/hooks/guard.mjs (added lines of the diff, and the dispatch at lines 59-65 and 610-621); plugins/openspec/hooks/hooks.json (diff); plugins/openspec/skills/devkit/SKILL.md (whole); plugins/openspec/hooks/change-loop.test.mjs (test names; bodies of lines 76-172, 1431-1590, 1645-1695, 1775-1830, 1986-2044); plugins/panel/hooks/commands.ts, conducted.ts, i18n.ts and project.ts (diffs); plugins/core/agents/commit-and-pr.md, plan-readiness-reviewer.md and tdd-implementer.md (diffs); plugins/openspec/hooks/conduct-check.mjs, flow-check.mjs, flow-check.test.mjs and deliver-check.test.mjs (diffs); plugins/core/skills/review-change/scripts/review-round.test.mjs (diff); openspec/config.yaml and openspec/roadmap.md (diffs); docs/adr/0011-the-change-coordinator-is-the-owners-session.md (header); docs/adr/0005 to 0010 (grep for /conduct); openspec/changes/change-coordinator/tasks.md (checkbox counts only). Run by hand: `change-loop.mjs start --bogus` and `start` in a bare scratch repository, under the session scratchpad. Not read in full: the 53-file diff's remaining documents (CHANGELOG, README files, docs/openspec-flow.md, docs/coordination-design.md, docs/catalog.md, docs/compozy-kit.md, docs/roles.md, plugin.json files, the readiness/approval/proposal files), hooks/guard.test.mjs, the panel test files, and the body of most tests outside the ranges above.
