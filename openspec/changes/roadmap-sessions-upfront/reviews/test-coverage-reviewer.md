Verdict: approved
Commit: f7c5945b8bd8763a51040c609968fe937a9633c4

## Coverage analysis — roadmap-sessions-upfront (round 2, origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/guard.mjs:972-976 (stop branch of lock()) — The stop branch routing a non-roadmap session to changeSessionStopDecision had only unit tests; no subprocess test ran guard.mjs stop. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] plugins/openspec/hooks/roadmap-loop.mjs:838-857 (sessionNext) — The place decision recomputed under the lock was not pinned by any test; replacing it with the first read would stay green. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] plugins/openspec/hooks/roadmap-loop.mjs:932-939 (killWaits, tidyWaits) — killWaits sent SIGTERM to a recorded pid with no identity check, and no test used a live pid that is not a wait. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] plugins/openspec/hooks/roadmap-loop.test.mjs:2745 (upStarted) — The started-session first message was a hand-built fixture that might not match the real host form. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:3388 — assert.ok(gone instanceof Error || gone.code === 3) accepts two outcomes; pin the one the contract promises.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs (updateRun ticket-label recheck) — No test changes the ticket between the check and the write under the lock.
- [praise] plugins/openspec/hooks/roadmap-loop.test.mjs (AC-14 isWaitProcess, AC-14 check, AC-15 decide, AC-1 entry real capture) and guard.test.mjs startedTaskOf host-note cases — Round-1 fixes come with tests that go red on reverting the seam: live non-wait process spared, real captured first message, subprocess stop and skill hooks, pinned triage reader.

In-scope surfaces: plugins/openspec hooks (guard, roadmap-loop, change-loop), the entry and triage skills and agents, schemas and config.

Blocking gaps (8-10 without a plan): 0

Seams checked: guard.mjs stop -> changeSessionStopDecision (caught by roadmap-loop.test.mjs 'AC-9 lock stop: guard.mjs stop ...' subprocess test); sessionNext in-lock recompute (caught by 'AC-9 session-next: the place is decided again ...' via lockSleep); killWaits/waitAlive identity (caught by 'AC-14 isWaitProcess', 'AC-14 check' and 'AC-15 decide' with a live stranger process); real started first message with host note (caught by 'AC-1 entry' with the captured REAL_STARTED_2026_11_22 fixture, and guard.test.mjs startedTaskOf host-note cases); unpushedOf approval.md record (caught by 'AC-12 next'); pruneRecords in check and decide (caught by 'AC-9 check' and 'AC-9 next', including the no-session-per-change negative case); skillEntry raw-input-first with fail-closed entry (caught by 'AC-2 guard' with a roadmap-loop.mjs that throws on load); triageSection/hasTriageSection single reader (caught by the pinned unit test and 'AC-14 check' fenced/suffixed heading case). Mutation runs: 0. Scoped test run of the 31 new or changed round-1 tests: 31 pass, 0 fail.

The merge of origin/main (699e6be), the ADR renumber (877026a) and the evidence commit (f7c5945) add no test gap of this change; main's release-tags and deliver-check work was not judged.

### Well covered
- Stop hook routing for a change session held for a place, through the real guard process (exit codes and log line).
- Place decision recomputed under the run-file lock, with a competing claim injected through lockSleep.
- Stale-wait kill only for processes that are still wait loops, with a live unrelated process spared at check and at run end.
- Host-note skipping in startedTaskOf: one note, two notes, unclosed, words in between, late note, note inside the task.
- Real captured started-session message fixture, refused for its hand-written task and claimed with the run's task and start line.
