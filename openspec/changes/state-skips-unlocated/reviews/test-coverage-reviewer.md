Verdict: approved
Commit: 535524cac1bb7936280169bb3aec4f5082dbc716

## Coverage analysis: state-skips-unlocated (faddf80..HEAD), round 1 of 2 after the merge of train 6

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1443 (locate) — [4] A worktree on branch <id> that lacks the folder while another checkout holds it gets wrong-branch (accepted R-3), and no test pins it; write in change-loop-remote-state.test.mjs beside the stand-in test. Still open: locate and unplacedAction are unchanged by the merge.
- [nit] plugins/openspec/hooks/change-loop.mjs:1451 (locate, realpathSync(start)) — [3] locate compares realpath(start) with the main root, so a session whose cwd is a subdirectory of the side worktree falls back to main; inherited behaviour, untested either way. Still open.
- [important] plugins/openspec/hooks/roadmap-loop.mjs:1531 — [5] status --json and the line 1710 classify call nextAction on unfinished() items without unplacedAction. Refuted earlier: design.md:57-60 declares statusJson and draftCmd non-goals not routed through unplacedAction, and the AC table has no row for the two sites. · refuted: design.md:57-60 declares statusJson (own try/catch) and draftCmd (keeps exit 3) non-goals not routed through unplacedAction; unplacedAction is wired only at roadmap-loop.mjs:807 and change-loop.mjs stateEntries, and the AC table (design.md:293-312) has no row for the two sites, so no plan-required coverage is missing
- [nit] plugins/openspec/hooks/change-loop-compozy.test.mjs — The release-pin test no longer grows per release: it reads the manifest version from plugin.json (main's commit 0e76c41, ADR 0030), so the 0.42.1 bump needed no hand edit. Cleared as a fact of main's merge. · fixed in 0e76c413b45074e97db712dfe21ed4f443ef55d8
- [praise] plugins/openspec/hooks/change-loop-remote-state.test.mjs:1387-1600 and plugins/openspec/hooks/roadmap-loop-upfront.test.mjs — The 'unlocated' tests survived the conflict resolution whole (26 test blocks, none doubled) and still protect the seams: locate order, the unplacedAction helper, the state command, the board, the run-file precedence and the archived stale copy.

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs locate, unplacedAction and stateEntries, roadmap-loop.mjs collectRoadmap, change-loop-fixtures.mjs, change-loop-remote-state.test.mjs, roadmap-loop-upfront.test.mjs), docs/adr/0017, docs/openspec-flow.md, CHANGELOG, and the release pin (0.42.1 / 0.47.1).

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0, read only):
- locate caller step: caught by the eight 'unlocated 1: locate...' tests, unchanged by the merge.
- unplacedAction wired in stateEntries, ahead of knownChange, and in collectRoadmap (roadmap-loop.mjs:807): caught by the 'state lists an unplaced change blocked' test and the roadmap-loop-upfront 'unlocated' tests.
- archived stale copy versus a new change reusing the id (the archivedDates and createdAfter branch): caught by the two subtests of 'state --change of a change archived on origin...'.
- Conflict resolution of change-loop.mjs: main's baseMergeOf sits above locate, and stateEntries is unchanged except for this change's own lines. The unplaced stand-in bypasses decide, so main's mergeCheck facts cannot leak into it. No merge-check test needs this change's setup.
- Conflict resolution of the test imports: change-loop-remote-state.test.mjs imports both sides' fixtures (pmvFacts and pmvRec, plus this change's). The 'merge-defect' and 'merge-check-failed' blocked-reason cases are main's work and sit beside this change's 'wrong-branch' case with no duplicate keys.
- ADR 0017 holds both Notes, each its own paragraph.
- The release pin is consistent: plugin.json, marketplace.json, CHANGELOG 0.47.1 and the CI snippet in docs/openspec-flow.md lines 733, 734 and 747 all name 0.42.1.

The exit 3 behaviour for next, wait and session-next on an unplaced change stays pinned by the existing exit 3 test and the three null subtests of unplacedAction.

### Well covered
- The locate order, in eight tests.
- State listing an unplaced change blocked, in en and pt-BR, and the state --change entry shape.
- An id nothing knows still exits 3.
- Run-file precedence over the stand-in, for declared ends and in-flight stages.
- The archived stale copy versus a new change that reuses the id.
- The docs paragraph naming the unplaced change and the locate order, checked by 'unlocated 3'.
