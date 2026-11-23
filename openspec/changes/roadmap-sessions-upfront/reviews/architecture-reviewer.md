Verdict: approved
Commit: f7c5945b8bd8763a51040c609968fe937a9633c4

## Architecture review — roadmap-sessions-upfront (round 2 of 2, stage 1)

### Findings
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1098-1101, :747-751, :1401 (previous round: placed and queued never pruned) — decide() pruned only startedSessions and tickets, so a change that left the roadmap or stopped being open kept a place or headed the queue until --fresh. · fixed in 6fab305
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1414 vs plugins/openspec/hooks/change-loop.mjs:969 (previous round: two readers of the triage section) — checkCmd read the triage section with its own regex while change-loop owned a fence-aware reader, so the two could disagree. · fixed in 6fab305
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:1341 and :828 (previous round: duplicate git helper, triple computation) — mergeBaseCmd now uses gitIn, but the first dependency not archived is still computed in collectRoadmap, sessionFacts and stateEntries.
- [nit] docs/adr/0020-a-roadmap-run-opens-every-change-at-its-start.md:86 (previous round: home of the change session's loop not recorded) — The ADR did not record that the change session's loop lives in roadmap-loop.mjs. · fixed in 6fab305
- [nit] openspec/changes/roadmap-sessions-upfront/approval.md:8 — approval.md, readiness.md and review.md still say ADR 0019 for this change's ADR, now 0020; the code, ADR and specs agree, so these history records can stay or get a one-line note.

Analyzed:
- Owners: ENTRY_SKILL and namesEntrySkill moved to guard.mjs beside firstMessageOf and startedTaskOf, so there is one definition. roadmap-loop re-exports ENTRY_SKILL, so existing importers keep working.
- Boundaries: change-loop does not import roadmap-loop, and roadmap-loop imports change-loop and guard statically, unchanged. isWaitProcess and waitAlive stay with the wait loops that own them, and killWaits no longer signals a pid that is not a wait loop, which is a boundary fix for pid reuse.
- Contract consumers: the release_tag settings key is read through releaseTagSetting in guard.mjs and readDevkitSettings. The tag-release row and tag-elsewhere message are in ROWS and MESSAGES in both languages, and deliver-check supplies the fact; these belong to the main-merged release-tags change, not to this one. The BULLETED_STATUS edit in acceptDecisions is local and changes no contract.
- Deletion tests: pruneRecords (one rule, two callers) passes; isWaitProcess (hides the ps call, the pattern and the failure policy) passes; triageSection (the one reader) passes.
- ADR: 0020 covers the structural decisions, including the home in decision 8. No REQUIRES SUPERSEDER arises.
- Run in this round: no test or suite.
