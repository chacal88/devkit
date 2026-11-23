Verdict: rejected
Commit: 123a7ba4a7084ed466075cfbb23bdb9b82fdbbd0

## Architecture review — roadmap-sessions-upfront (round 1 of 2, stage 1, full read)

### Findings
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1098-1101, :747-751, :1401 — decide() prunes only startedSessions and tickets for a line that leaves the roadmap or stops being open. placed and queued are never pruned, so such a change keeps a place (counted in placeDecision's free) or heads the queue (counted in ahead) until --fresh. checkCmd filters the queue by openIds, but placeDecision's ahead and free do not. No test covers it.
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1414 vs plugins/openspec/hooks/change-loop.mjs:969 — checkCmd reads the triage section with its own regex (/^### Answered by triage\b/m, fences not skipped), while change-loop.mjs owns TRIAGE_HEADING and triageUnsourced (end-anchored, fence-aware). Two readers of one mechanism, and they can disagree on a fenced or suffixed heading.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:1316 vs :881 — mergeBaseCmd rebuilds a local execFileSync git helper beside gitIn (same shape, same file). 'First dependency not archived' is computed three times: collectRoadmap, sessionFacts:828 and stateEntries.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs (1474 lines); docs/adr/0019-a-roadmap-run-opens-every-change-at-its-start.md — The change session's own loop (sessionNext, sessionDecide, placeDecision, session-wait, merge-base, push, changeSessionStopDecision) lives in the roadmap coordinator module. That is defensible (it reads the run file, and change-loop never imports roadmap-loop), but ADR 0019 does not record the home. Candidate to name there, or to split out later if the file keeps growing.
- [praise] plugins/openspec/hooks/change-loop.mjs changeState (S9) and roadmap-loop.mjs sessionDecide/stateRow — The held state is derived once in changeState. The held action, the state command and the board read the same state and title. sessionDecide builds no title of its own, and the plan-stage reader moved to its owner (change-loop).

Analyzed:
- Owners: run bookkeeping (tickets, placed, queued, waits, check) is in the run file owned by roadmap-loop, with readRun validating each field; the held state is owned by changeState (ADR 0017) and the plan-stage reader now sits in change-loop; the shared started-form readers (startedTaskOf, firstMessageOf, START_LINE) are in guard.mjs, so there is one reader; the host protocols (CronCreate, archive_session) stay as action inputs carried out by the skills.
- Boundaries: change-loop never imports roadmap-loop; roadmap-loop imports guard.mjs statically; guard.mjs imports roadmap-loop dynamically, as it already did for ROADMAP_LOCKS, so no new cycle; the entry hook fails closed and exits 0 under bypass; the triage agent has only Read, Glob and Grep; the coordinating session hands no stage.
- Contract consumers enumerated: the run file (readRun, runCmd, decide, collectRoadmap, check, session-wait, the stop locks; unknown fields dropped), loopOutput (exported, same markers), the hooks matcher (T-7), the schema copies (move together), ADRs 0006, 0010, 0011, 0013, 0014 and 0017 (header lines and Notes), and the four spec deltas.
- Deletion tests: devkit-session skill, requirements-triage agent, placeDecision, entryDecision, staleWaits and killWaits, filesPushed and adrClash all pass; mergeBaseCmd is shallow only in its duplicated git helper (F3).
- ADR: 0019 covers the structural decisions; the home of the change session's loop (F4) is the only structural choice not recorded. No REQUIRES SUPERSEDER arises.
- Run in this round: no test or suite (2168/2168 at 1afa584 was given).
