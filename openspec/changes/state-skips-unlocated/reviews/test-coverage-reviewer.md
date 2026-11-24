Verdict: approved
Commit: faddf80f7035fb873748b734bd3515341ab62456

## Coverage analysis: state-skips-unlocated (cb79a38..HEAD), round 3

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1790 — [4] A worktree on branch <id> that lacks the folder while another checkout holds it now gets wrong-branch (accepted R-3), and no test pins it; write in change-loop-remote-state.test.mjs beside the stand-in test. Still open: the file is unchanged since cb79a38.
- [nit] plugins/openspec/hooks/change-loop.mjs:1409 — [3] locate compares realpath(start) with the main root, so a session whose cwd is a subdirectory of the side worktree falls back to main; inherited behaviour, untested either way. Still open: unchanged since cb79a38.
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1531 — [5] status --json and the line 1710 classify call nextAction on unfinished() items without unplacedAction; the unplaced setup is not exercised there, only the board, the decision and the stop lock are. · refuted: design.md:57-60 declares statusJson (roadmap-loop.mjs:1531, own try/catch) and draftCmd (line 1710, keeps exit 3) non-goals not routed through unplacedAction; unplacedAction is wired only at roadmap-loop.mjs:807 and change-loop.mjs:1850, and the AC table (design.md:293-312) has no row for the two sites, so no plan-required coverage is missing; tasks.md:81 keeps statusJson and draftCmd un…
- [nit] plugins/openspec/hooks/change-loop-compozy.test.mjs — The release-pin test no longer grows one doesNotMatch and a longer history comment per release: cleared as a fact of main's merge, not by this change. Main's commit 0e76c41 (ADR 0030) made the pin test read the manifest version from plugin.json (lines 306 and 362), so the pin is no longer hand-edited each release. · fixed in 0e76c413b45074e97db712dfe21ed4f443ef55d8
- [praise] plugins/openspec/hooks/roadmap-loop-upfront.test.mjs:980 — The 'unlocated' tests share one setup, take every phrase from render, and check the board against the state command, so drift between layers goes red.

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, roadmap-loop.mjs, shared fixtures and tests), docs/openspec-flow.md, docs/adr/0017, CHANGELOG, the release pin (plugin.json, marketplace.json, CI snippet).

Blocking gaps (8-10 without a plan): 0

Scope of this round: the product and test files of this change (change-loop.mjs, roadmap-loop.mjs, change-loop-remote-state.test.mjs, roadmap-loop-upfront.test.mjs, change-loop-fixtures.mjs) have an empty diff for cb79a38..HEAD. The release renumber is intact after the merge of train 4: devkit-openspec 0.40.1 and marketplace 0.45.1 in the manifests, CHANGELOG 0.45.1, and the CI snippet pins at docs/openspec-flow.md lines 733, 734 and 747 all name v0.40.1. The docs sentence in the state-command paragraph (line 240) and the dated ADR 0017 Note (state-skips-unlocated, 2026-11-24) are intact and both say next, wait and session-next keep exit 3 for a change only another checkout holds.

Seams checked: locate caller step, unplacedAction, stateEntries ordering and the collectRoadmap call, all unchanged since round 2 and still caught by the tests named there; the exit 3 behaviour the Note and the docs sentence state stays pinned by the exit 3 test and the three null subtests of unplacedAction (mutation runs: 0, read only; no test command was run, per the train rule).

### Well covered
- The locate order, in eight tests in change-loop-remote-state.test.mjs, 'unlocated 1'.
- The archived stale copy versus a new change that reuses the id.
- The wrong-branch phrase in en and pt-BR, and the full entry shape.
- Run-file precedence, on the state command and the board.
- Exit 3 kept for next, wait and session-next on an unplaced change, as the ADR Note and the docs sentence say.
- Fixtures moved into change-loop-fixtures.mjs without changing what the field-fixes tests assert.
