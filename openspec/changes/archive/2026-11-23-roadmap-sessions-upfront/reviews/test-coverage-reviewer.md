Verdict: approved
Commit: 5edea6bd2080c7e55bca299fb82202d2d25484cf

## Coverage analysis — roadmap-sessions-upfront (round 3, f7c5945..HEAD: phase 8, second merge of main)

### Findings
- [important] plugins/openspec/hooks/guard.mjs:972-976 (stop branch of lock()) — The stop branch routing a non-roadmap session to changeSessionStopDecision had only unit tests; no subprocess test ran guard.mjs stop. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] plugins/openspec/hooks/roadmap-loop.mjs sessionNext (in-lock place decision) — The place decision recomputed under the lock was not pinned by any test; replacing it with the first read would stay green. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] plugins/openspec/hooks/roadmap-loop.mjs killWaits, tidyWaits — killWaits sent SIGTERM to a recorded pid with no identity check, and no test used a live pid that is not a wait. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] plugins/openspec/hooks/roadmap-loop.test.mjs (upStarted fixture) — The started-session first message was a hand-built fixture that might not match the real host form. · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:3405 — assert.ok(gone instanceof Error || gone.code === 3) accepts two outcomes; pin the one the contract promises. Still as it stood.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs (updateRun ticket-label recheck) — No test changes the ticket between the check and the write under the lock. Still as it stood.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:377 (ask.action = head.action) and roadmap-loop.test.mjs:384,3533 — [4] No roadmap-loop test asserts that ask.action carries `helpers` from the change-loop grill action. The coordinating session reads it to decide on the triage. Only the real run in evidence.md (AC-4) shows it, so a refactor that rebuilt ask.action from named fields would stay green. Write in roadmap-loop.test.mjs next to the existing ask.action asserts (AC-4 grills asked in order), with one change on flow 2 and one on flow 1.
- [nit] plugins/openspec/hooks/change-loop.test.mjs ('upfront AC-5 skill: the grill skill and the devkit skill hand the triage only when ...') — Implementation-coupled prose test: it asserts regexes and phrases in SKILL.md, not what an agent does. It is the only automated guard on the skill side of the `helpers` contract and breaks on a legitimate rewording. The real-run proof for the agent's behaviour stays open as dogfood.
- [praise] plugins/openspec/hooks/change-loop.test.mjs (upfront AC-5 triage, flow, lock agent) and roadmap-loop.test.mjs (AC-4 lock agent flow 1, AC-14 check flow 1/2) — Phase 8 pins each seam with a flow-1 and flow-2 pair on the tree's real flow files: grill `helpers` per pin, the unsourced grill, the real guard.mjs agent process with not-a-role labels counted, the roadmap own-sessions refusal, and the check's triage filter.
- [praise] plugins/openspec/hooks/roadmap-loop.test.mjs ('upfront merge ...' group, 5148 onward) — The merge of remote-worker with this change's run file is pinned: occupied and placed stay two records in readRun, both are in OUTLIVES, placement with the machines setting, no ticket for a session start on another machine, and the periodic check with the machines setting. Main's 'remote AC-9/AC-12' tests cover placed changes with the pruning and the persist block.

In-scope surfaces: plugins/openspec hooks (change-loop `decide`, roadmap-loop `isRequirementsHelper` and `check`, run-file, persist block), flow files `flows/1.json`/`flows/2.json` in both schema copies, `scripts/released-flows.json`, the grill and devkit skills.

Blocking gaps (8-10 without a plan): 0

Seams checked:
- Grill action `helpers` read from the change's pinned flow: caught by 'upfront AC-5 triage: the grill of a change on flow 1 names no triage helper and that of a change on flow 2 names it'. It covers no pin, pin 1 and pin 2, the `flow <id>` move, the unsourced-triage grill, and the absence of `helpers` on agent actions.
- `isRequirementsHelper` with a folder, read from the pin: caught by 'AC-4 lock agent: ... read from the flow the change is pinned to' and 'the coordinating session's triage for a change on flow 1 is refused own-sessions'.
- `isRequirementsHelper` with no folder, falling back to the installed flow (the new `readFlow(changeSchemaAt)` branch): caught by 'AC-4 lock agent: the triage for a change not open is refused not-open'. Returning false there would give own-sessions and fail the assert on `d.why`.
- Change-run hand-off lock (H3): caught by 'AC-5 lock agent: ... flow 1 refuses ... as not-a-role, flow 2 allows it'. It runs a real guard.mjs agent process and counts 8 not-a-role refusals in the hook log.
- The check's triage filter `action.helpers?.includes('requirements-triage')`: caught by 'AC-14 check: a grill of a change on flow 1 gives no triage action, and one on flow 2 does' and the adjusted fenced-heading test.
- `flows/2.json` equal to `flow.json` in four copies, `flows/1.json` as released, devkit-project at 1, and digests in `released-flows.json`: caught by the three 'upfront AC-5 flow' tests (digest recomputed from the file bytes).
- Merge, run file: `occupied` (places held) and `placed` (changes opened elsewhere) stay separate. Caught by 'upfront merge run file' (cross-shaped input is dropped, both are in OUTLIVES) and main's 'remote AC-9 next: the run file keeps placed'.
- Merge, session start on another machine gets no ticket: caught by 'upfront merge ticket'.
- Merge, placement with the machines setting: caught by 'upfront merge placement'.
- Merge, persist block, pruning and board: caught by main's remote AC-9/AC-12 tests (record kept while the line is open elsewhere, a silent machine's placed change gets no session) plus this change's AC-9 prune tests, which now read `occupied`.
- Merge, the periodic check carries the machines setting: caught by 'upfront merge check'.
- Skill side of `helpers`: prose test only (see F8). `ask.action.helpers` through the roadmap `next` decision: no unit assert (see F7).

Mutation runs: 0. Scoped run of 29 tests across the three files above (phase 8, merge and AC-4 lock-agent tests): 29 pass, 0 fail. The whole suite was not re-run, per the instructions (2356 pass on 5cc1c69).

How the round-1 edits to older tests read: `addChange`, `addOpen`, `addTaskChange`, `archivedFolder` and the flow-check sample now record `x-devkit-flow: 2`. Each says in a comment that with no pin the change would follow flow 1 under the installed flow 2 and the reply would gain the newer-flow line. This is not weakening. The newer-flow line is still asserted for real upgrades in version-pin.test.mjs:710. The version-pin fixtures use `installRelease1`, which installs a real flows/1.json as the pack, so the 1 to synthetic-2 upgrade tests keep their meaning. `upfront AC-5 open` and 'version-pin AC-7 check: the tree's flows pass' read the tree as it is.

The judged scope is the 7eb62be diff, how 5cc1c69 combined main's remote-worker code with this change's run file, placement, persist block, board and messages, and the 5edea6b evidence. Main's own remote-worker work (b92e6b1, 4631376) was not judged.

### Well covered
- Flow 1 versus flow 2 grill helpers: both action fields and both locks (change run through a real guard process, coordinating session through RH6).
- Released flow immutability: byte-identical copies, digest equality with released-flows.json, devkit-project untouched.
- The merge of two run-file concepts (`occupied` versus `placed`): the crossed-shape input is dropped, both survive a new session, no ticket for a remote start.
