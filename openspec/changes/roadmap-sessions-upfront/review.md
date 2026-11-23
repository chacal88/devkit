<!-- devkit-stage review result=passed attempt=2 commit=f7c5945b8bd8763a51040c609968fe937a9633c4 -->
# Review: roadmap-sessions-upfront, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | rejected | 0 | 3 | 3 | 0 | 123a7ba |
| spec-reviewer | rejected | 0 | 1 | 2 | 1 | 123a7ba |
| code-quality-reviewer | rejected | 0 | 3 | 3 | 0 | 123a7ba |
| test-coverage-reviewer | rejected | 0 | 3 | 4 | 1 | 123a7ba |
| security-reviewer | approved | 0 | 0 | 0 | 0 | 123a7ba |
| architecture-reviewer | rejected | 0 | 2 | 2 | 0 | 123a7ba |

Consensus: FAIL (round 1/2)

## Open findings
- adr-reviewer — [important] docs/adr/0019-a-roadmap-run-opens-every-change-at-its-start.md:3 — ADR 0019 is still proposed with no Accepted by line, no decisions.md exists for the accepting script, yet six accepted ADRs, the config list and the code cite it as amending them; record the owner's acceptance (approval.md, 'Aprovo') or leave it explicitly for merge.
- adr-reviewer — [important] docs/adr/0019-a-roadmap-run-opens-every-change-at-its-start.md Decision 3 / Amends; plugins/core/agents/requirements-triage.md; openspec/config.yaml:38 — Triage answering grill questions touches ADR 0010 decision 8's statement that grill answers stay the owner's; ADR 0019 does not name that sentence and the triage and config rule also apply to a lone /devkit change, outside ADR 0019's scope.
- adr-reviewer — [important] plugins/openspec/hooks/guard.mjs:950 (skillEntry); plugins/openspec/hooks/hooks.json:29-35 — The new skill hook ignores the project opt-in that ADR 0004 requires of devkit-openspec hooks (block nothing outside devkit/devkit-lite projects); the design chose this on purpose and no ADR acknowledges it.
- spec-reviewer — [important] plugins/openspec/skills/devkit-session/SKILL.md:28; spec roadmap-coordination, requirement "A change's plan waits for its dependencies and starts from the code of that day", scenario "The merge confl… — Partial: merge-base aborts and exits 3, but the session skill never says to declare the end (design D-8 says change-loop.mjs reply blocked why=base-conflict), so no devkit-end blocked line is recorded and the change does not stop blocked; the next session-next hands merge-base again.
- code-quality-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs:900 (unpushedOf), :885 (filesPushed) — unpushedOf returns 'plan' whenever approval.md passed and any PLAN_FILES path is dirty or ahead of origin, with no stage guard. While the implementer ticks tasks.md the push stays due on every decision, so a half-ticked tasks.md is committed as 'docs(openspec): plan of <id>', and the coordinator's git add/commit can race the change session's own git. Fix: return 'plan' only while no later stage has started (or push 'plan' only when the committed tasks.md differs, ignoring ticks) and add a test with a dirty tasks.md after approval.
- code-quality-reviewer — [important] plugins/openspec/hooks/guard.mjs:950-955 (skillEntry) — The fail-closed catch also wraps `await import('./roadmap-loop.mjs')`. A module that cannot load refuses every Skill call of every project with the plugin, which contradicts the spec scenario 'Another skill: this rule lets the call through'. Every Skill call also pays the full import before the not-entry check, and the mode skips the opt-in gate the lock modes use. Fix: test cheaply in guard.mjs whether any tool_input string names devkit-session and return before the import; fail closed only for the import when it is named.
- code-quality-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs:932 (killWaits), :1396 (checkCmd watchAlive) — killWaits sends SIGTERM to a pid read from the run file, and checkCmd counts a pid as alive with kill(pid, 0), with no check that the pid is still the wait loop that wrote it. After a reboot or a long run the pid can belong to an unrelated process of the owner. The tests never send a signal. Fix: record the process start time with the pid, or check the command line (`ps -o command= -p <pid>` contains roadmap-loop.mjs and wait) before signalling, and add a test with a recycled pid.
- test-coverage-reviewer — [important] plugins/openspec/hooks/guard.mjs:972-976 — The `stop` branch of lock() that routes a non-roadmap session to roadmap-loop.changeSessionStopDecision is exercised only by direct unit calls (roadmap-loop.test.mjs:3399-3438); no subprocess test runs `guard.mjs stop` with a claimed started session. Reverting the branch to change-loop's stopDecision leaves every test green, and a claimed session held for a place would be refused at its stop. Write in: roadmap-loop.test.mjs, next to the lkHook('stop') tests at ~1771, using upStopInput's transcript and a run file with a claimed ticket and another change placed; assert exit 0 and a `held` line under DEVKIT_HOOK_LOG.
- test-coverage-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs:838-857 (sessionNext) — The place decision is recomputed on the run file as read under the lock (`decide(current)`), but no test makes the file change between the first read and the lock (lockSleep is never used for sessionNext). If the recompute were replaced by `first`, two sessions could take the same last place and all tests stay green. Write in: roadmap-loop.test.mjs, phase 2 session-next tests; a second claim written to the run file from the injected lockSleep or a pre-lock hook, asserting the loser is queued.
- test-coverage-reviewer — [important] plugins/openspec/hooks/roadmap-loop.test.mjs:2745 (upStarted) — upStarted is a hand-built fixture of the host's first-message form (background line, paragraph, `Task:`, task, `devkit-start:` line). If the real host lays the first message out differently, the entry skill refuses every real started session while the suite stays green. Real-evidence item for the next dogfood run: capture one real started session transcript (first user line) and a real `guard.mjs skill` log line, and compare the form with the fixture.
- architecture-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs:1098-1101, :747-751, :1401 — decide() prunes only startedSessions and tickets for a line that leaves the roadmap or stops being open. placed and queued are never pruned, so such a change keeps a place (counted in placeDecision's free) or heads the queue (counted in ahead) until --fresh. checkCmd filters the queue by openIds, but placeDecision's ahead and free do not. No test covers it.
- architecture-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs:1414 vs plugins/openspec/hooks/change-loop.mjs:969 — checkCmd reads the triage section with its own regex (/^### Answered by triage\b/m, fences not skipped), while change-loop.mjs owns TRIAGE_HEADING and triageUnsourced (end-anchored, fence-aware). Two readers of one mechanism, and they can disagree on a fenced or suffixed heading.

## Refuted by verification
- spec-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs sessionNext/sessionNextCmd (budget: true); proposal What Changes; tasks 6.1; baseline change-coordination "A run can carry a token budget" — The token budget counted in a change session's session-next has no requirement in any delta spec or AC (plan says "no AC of this change"); the baseline names /devkit change and excludes only the coordinator's own reading, so the ambiguity was resolved silently: add a MODIFIED scenario or remove it. · refuted: Baseline openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs:1305 restores it; proposal.md:47-51 and design.md:48-53 state it openly / Baseline openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs:1305 restores it; proposal.md:47-51 and design.md:48-53 state it openly / Baseline openspec/specs/change-coordination/spec.md:696-698 already requires the stop at the cap in place of a hand-off or session step and exempts only the coordinator's own reads (734-736); roadmap-loop.mjs:1305 restores it; proposal.md:47-51 and design.md:48-53 state it openly (3 of 3)
- test-coverage-reviewer — [important] plugins/openspec/hooks/roadmap-loop.mjs:932-939 (killWaits) and tidyWaits ~1073 — killWaits sends SIGTERM to a recorded pid with no identity check (kind, start time, command). The tests at roadmap-loop.test.mjs:3758 use real child processes and a dead pid, but none uses a live pid that is not a wait (a reused pid), so the stale wait of a pid the OS handed to an unrelated process is killed with no test red. Write in: roadmap-loop.test.mjs upfront AC-14 check tests; record a live unrelated child as a stale wait and assert the intended policy (spared or killed), whichever the design chooses. · refuted: roadmap-loop.test.mjs:3731,3758-3779 record live plain sleeper() processes (not waits) as stale waits and assert they are killed, the design's policy (design.md:425: SIGTERM each stale pid, no identity check) / roadmap-loop.test.mjs:3735 sleeper() is a live non-wait node process recorded as a stale wait and asserted killed at 3758-3777, matching design.md:425 (2 of 3)

## Notes
- Stage 1 of code-quality, test-coverage and architecture reviewers was run twice: the first answers left paths in notRead and were refused; the second answers read every path of their remit.
- Path agents: the round ran on a turn the owner did not type, with the Agent tool; stage 3 writers were given their prompt from files in the scratchpad.
- The suite was not re-run by the reviewers: 2168 of 2168 at 1afa584, no code or test file changed since (stated in every prompt).

## Next
Fix the open findings, then run review-change again (round 2).

# Review: roadmap-sessions-upfront, round 2

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | f7c5945 |
| architecture-reviewer | approved | 0 | 0 | 0 | 0 | f7c5945 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | f7c5945 |
| security-reviewer | approved | 0 | 0 | 0 | 0 | f7c5945 |
| spec-reviewer | approved | 0 | 0 | 0 | 0 | f7c5945 |
| test-coverage-reviewer | approved | 0 | 0 | 0 | 0 | f7c5945 |

Consensus: PASS (round 2/2)

## Open findings
None.

## Refuted by verification
None.

## Notes
None.

## Next
Ready to ship.
