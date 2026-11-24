Verdict: approved
Commit: cb79a383d3ea574537c9c09ce539af92dbaeaebc

## Coverage analysis: state-skips-unlocated (946e3e8..HEAD), round 2

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1790 — [4] A worktree on branch <id> that lacks the folder while another checkout holds it now gets wrong-branch (accepted R-3), and no test pins it; write in change-loop-remote-state.test.mjs beside the stand-in test. Still open: no plugin code or test changed since 63c5eac.
- [nit] plugins/openspec/hooks/change-loop.mjs:1409 — [3] locate compares realpath(start) with the main root, so a session whose cwd is a subdirectory of the side worktree falls back to main; same as before, and untested either way. Still open, inherited behaviour.
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1531 — [5] status --json and the line 1710 classify call nextAction on unfinished() items without unplacedAction; the unplaced setup is not exercised there, only the board, the decision and the stop lock are. · refuted: design.md:57-60 declares statusJson (roadmap-loop.mjs:1531, own try/catch) and draftCmd (line 1710, keeps exit 3) non-goals not routed through unplacedAction; unplacedAction is wired only at roadmap-loop.mjs:807 and change-loop.mjs:1850, and the AC table (design.md:293-312) has no row for the two sites, so no plan-required coverage is missing. tasks.md:81 keeps statusJson and draftCmd un…
- [nit] plugins/openspec/hooks/change-loop-compozy.test.mjs — The release-pin test grows one doesNotMatch and a longer history comment per release; the invariant is the current pin only. Still open.
- [praise] plugins/openspec/hooks/roadmap-loop-upfront.test.mjs:980 — The 'unlocated' tests share one setup, take every phrase from render, and check the board against the state command, so drift between layers goes red.

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, roadmap-loop.mjs, shared fixtures), docs/openspec-flow.md, docs/adr/0017, CHANGELOG, release pin. The only changes in the re-review range 63c5eac..HEAD are f636733 (the docs sentence and the ADR 0017 Note), the evidence refresh and the review records.

Blocking gaps (8-10 without a plan): 0

Seams checked: locate caller step, unplacedAction, stateEntries ordering and the collectRoadmap call, all unchanged since round 1 and still caught by the tests named there (mutation runs: 0, read only). The new ADR Note and docs sentence state that next, wait and session-next keep exit 3 for an unplaced change. That behaviour is already pinned by the exit 3 test and the three null subtests of unplacedAction, so the doc change needs no new test.

### Well covered
- The locate order, in eight tests in change-loop-remote-state.test.mjs, 'unlocated 1'.
- The archived stale copy versus a new change that reuses the id.
- The wrong-branch phrase in en and pt-BR, and the full entry shape.
- Run-file precedence, on the state command and the board.
- Exit 3 kept for next, wait and session-next on an unplaced change, as the new ADR Note and docs sentence now say.
- Fixtures moved into change-loop-fixtures.mjs without changing what the field-fixes tests assert.
