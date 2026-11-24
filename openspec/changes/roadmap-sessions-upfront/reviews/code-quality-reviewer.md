Verdict: rejected
Commit: 5edea6bd2080c7e55bca299fb82202d2d25484cf

## Quality review: roadmap-sessions-upfront (round 1 of 2, f7c5945..5edea6b)

### Findings
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1623-1640 (pushCmd) x plugins/openspec/hooks/change-loop.mjs:1346-1358 (placeFacts) — In a machines+session run the plan push puts approval.md on origin, so the remote-worker place gate reads taken:true and never gates this machine's changes; two place counters (occupied vs claims) coexist and the board's machine.row uses the claims one; no test or design text reconciles them
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:1590-1597 (mergeBaseCmd) — Every git merge failure is reported as why=base-conflict; only a real conflict deserves it (open from the previous round, unchanged)
- [nit] docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md — No sentence says a change opened for another machine starts with the typed form and no ticket (the code comment and a test do); one sentence in the ADR Note would close it
- [important] plugins/openspec/hooks/roadmap-loop.mjs:900 (unpushedOf), :885 (filesPushed) [previous round] — unpushedOf asked a plan push whenever any plan file was dirty or ahead, so tasks.md ticks were committed as the plan push · fixed in 6fab305
- [important] plugins/openspec/hooks/guard.mjs:950-955 (skillEntry) [previous round] — The fail-closed catch wrapped the import of roadmap-loop.mjs, so a module that could not load refused every Skill call · fixed in 6fab305
- [important] plugins/openspec/hooks/roadmap-loop.mjs:932 (killWaits), :1396 (checkCmd watchAlive) [previous round] — killWaits signalled and checkCmd counted a recorded pid with no check that it is still a wait loop · fixed in 6fab305
- [nit] plugins/openspec/hooks/change-loop.mjs:961-1011 [previous round] — The header comment of decide was separated from it by the triage section · fixed in 6fab305
- [praise] plugins/openspec/hooks/change-loop.mjs:1114-1122 (decide) — The grill action takes helpers from the requirements stage of the flow the change follows; flow 1 gets none, the unsourced grill carries them the same way, and no other action has the key
- [praise] plugins/openspec/hooks/roadmap-loop.mjs:659-663 (isRequirementsHelper) — Reads the pinned flow, and falls back to the installed flow only for a change with no folder, with the reason in a comment
- [praise] scripts/released-flows.json, openspec/schemas/*/flows, plugins/openspec/schemas/*/flows — Flow version 2 is released cleanly: four byte-identical copies, flows/1.json and devkit-project untouched, digests match, and each test states its invariant, layer and suite
- [praise] plugins/openspec/hooks/run-file.mjs; roadmap-loop.mjs board and persist block — The merge keeps occupied and placed as two records that both outlive a session, orders pruneRecords after the placed pruning, handles machinesOn and sessionMode together in the board, and keeps titles and messages from colliding; the ADR 0021 renumber and release numbers are consistent

### Summary

- 3 findings (0 blocking, 1 important, 2 nit) + 4 praise, plus the 4 fixed findings and the earlier praise re-listed from the previous round; the earlier mergeBaseCmd nit stays open as F2.
- Justification: the phase 8 commit 7eb62be (flow version 2) was judged on its own diff, and the merge 5cc1c69 only where it combines main's remote-worker code with this change's (run-file.mjs, placement, the persist block, the board, the change-loop messages and titles). Phase 8 holds up: helpers come from the pinned flow, the lock reads the pinned flow, the check filters on helpers, the four flow copies and digests agree, and python3 scripts/check.py passes. The real runs in evidence.md cover both flow variants for the grill, the lock and the check; the flow-1 pin under a flow-2 install, the readout line and a recorded triage item are left to tests and dogfood, and the evidence says so. The one open important finding (F1) is an unreconciled interplay between the plan push of this change and the remote-worker place gate on this machine, found by reading the code, not by a run. The full suite was not re-run (the brief reports 2356 tests, 0 fail, on 5cc1c69). With F1 open and neither fixed nor contested with evidence, the round cannot be approved.
