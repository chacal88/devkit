Verdict: approved
Commit: 63c5eac8f72e8319b9056b1c9ca52715cfaf775c

## Coverage analysis: state-skips-unlocated (946e3e8..HEAD)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1790 — [4] A worktree on branch <id> that lacks the folder while another checkout holds it now gets wrong-branch (accepted R-3), and no test pins it; write in change-loop-remote-state.test.mjs beside the stand-in test.
- [nit] plugins/openspec/hooks/change-loop.mjs:1409 — [3] locate compares realpath(start) with the main root, so a session whose cwd is a subdirectory of the side worktree falls back to main; same as before, and untested either way.
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1531 — [5] status --json and the line 1710 classify call nextAction on unfinished() items without unplacedAction; the unplaced setup is not exercised there, only the board, the decision and the stop lock are. · refuted: design.md:57-60 declares statusJson (roadmap-loop.mjs:1531, own try/catch) and draftCmd (line 1710, keeps exit 3) non-goals not routed through unplacedAction; unplacedAction is wired only at roadmap-loop.mjs:807 and change-loop.mjs:1850, and the AC table (design.md:293-312) has no row for the two sites, so no plan-required coverage is missing / design.md:57-60 Non-Goals and tasks.md:81 keep statusJson and draftCmd unchanged and unrouted through unplacedAction; the diff 946e3e8..HEAD of roadmap-loop.mjs touches neither (2 lines changed, only the line 807 call site), so no AC requires a test of them in the unplaced setup
- [nit] plugins/openspec/hooks/change-loop-compozy.test.mjs — The release-pin test grows one doesNotMatch and a longer history comment per release; the invariant is the current pin only.
- [praise] plugins/openspec/hooks/roadmap-loop-upfront.test.mjs:980 — The 'unlocated' tests share one setup, take every phrase from render, and check the board against the state command, so drift between layers goes red.

## Coverage analysis: state-skips-unlocated (946e3e8..HEAD)

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, roadmap-loop.mjs, shared fixtures), docs/openspec-flow.md, CHANGELOG, release pin.
Blocking gaps (8-10 without a plan): 0
Seams checked: locate caller step -> caught by the 'locate' tests (main checkout holds a folder, caller holds only an archived folder, main unchanged, archive and own-branch precedence); unplacedAction -> caught by the deepEqual on the full stand-in and the three null subtests; stateEntries ordering -> caught by the archived-stale and reused-id subtests, the run-file-first subtests and the exit 3 test; collectRoadmap call -> caught by the board, pt-BR, board-state agreement, decision and stop-lock tests (mutation runs: 0, read only).

### Well covered
- The locate order, in eight tests in change-loop-remote-state.test.mjs, 'unlocated 1'.
- The archived stale copy versus a new change that reuses the id.
- The wrong-branch phrase in en and pt-BR, and the full entry shape.
- Run-file precedence, on the state command and the board.
- The state paragraph of docs/openspec-flow.md and the CI pin v0.39.2.
- Fixtures moved into change-loop-fixtures.mjs without changing what the field-fixes tests assert.
