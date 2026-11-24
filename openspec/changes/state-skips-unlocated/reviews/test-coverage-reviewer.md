Verdict: approved
Commit: 7e305e2e4151ffd509180328b4a05b3f339cb2ae

## Coverage analysis — state-skips-unlocated (9dff573..HEAD)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1790 (unplacedAction) vs change-loop-remote-state.test.mjs:1460-1478 — The case design D-2 accepts (a worktree on branch x lacks the folder while a worktree on another branch holds it, so locate picks the empty worktree and the stand-in says wrong-branch with the holder's root and branch) has no test; its guard (a) test only covers the worktree on x that holds the folder. Score 3. Write in change-loop-remote-state.test.mjs, 'unlocated 1:' section, with roundOf/withSide/t.addWt('x') and entryOf(stateCmd(...)).
- [nit] plugins/openspec/hooks/change-loop.mjs:1409-1416 (locate caller step) and writer callers of locate — locate's new caller step is tested through next and the change run's stop lock only. state run with cwd = the worktree that holds x, and state run from a third worktree with no folder of x, are not run (the code path is the same, so low risk). The write-side callers of locate (placeChange, moveFlow, switchScript, acceptDecisions) now act in the caller's worktree and no test pins that. Score 3-4. Optional: one state-from-side test in the same 'unlocated 1:' section.
- [nit] plugins/openspec/hooks/roadmap-loop-upfront.test.mjs:997 (BLOCK_OF_STATE) — implementation-coupled: the test re-declares the product's state-to-board-block mapping and uses it for the 'agree' and 'placed line' assertions. A legitimate change to that mapping breaks these tests together with the product. The sibling test at line 1013 asserts the contract directly (['blocked', phrase]).
- [nit] plugins/openspec/hooks/change-loop-remote-state.test.mjs:1627-1635 — implementation-coupled: 'unlocated 3' pins three literal phrases (wrong-branch, chore/archive-<id>, 'the checkout it is called from') in one paragraph of docs/openspec-flow.md. It is a prose pin that breaks on a harmless rewording; its invariant (AC-7) is documentation, so the cost is acceptable.
- [praise] change-loop-remote-state.test.mjs:1418-1458, 1460-1493 — locate and unplacedAction are pinned condition by condition, negatives included: archive worktree wins, own-branch worktree wins, main holds x active or archived, caller holds only an archived folder, caller holds no folder, and the three null guards of the helper. Dropping any one of locate's conditions (archived===false, !locateChange(root), the 'here' check) turns a named test red.
- [praise] roadmap-loop-upfront.test.mjs:1009-1087 with proof/red-2.txt — The collectRoadmap seam (unplacedAction(...) ?? nextAction(...)) is guarded end to end: the board in en and pt-BR, board and state agreement, the roadmap decision saying once that x stopped while a's stage is handed out, and the stop lock both refusing for a and allowing nothing-ready. proof/red-2.txt shows all of them red before the code, including the in-flight run-file case.
- [praise] change-loop-remote-state.test.mjs:1495-1537, 1556-1590 — The stateEntries ordering is pinned on both sides: the exact blocked entry (every field) in the list and with --change, pt-BR text, exit 3 for 'nope' in the unplaced setup, the run file weighing first (declared end and in-flight stage), and the archived-on-origin stale copy versus a copy created after the archive day (the createdAfter branch both ways).

In-scope surfaces: devkit-openspec hooks (change-loop.mjs, roadmap-loop.mjs), the node:test suites `change-loop-remote-state.test.mjs` (change-loop) and `roadmap-loop-upfront.test.mjs` (roadmap-loop), the shared fixtures, and docs/release files (docs/openspec-flow.md, CHANGELOG.md, plugin and marketplace versions).

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0, none needed because reading the tests was enough):
- `locate` caller step (here !== main, active folder in the caller, none in main) -> caught by 'unlocated 1: locate from a worktree on another branch...', '...a caller holding only an archived folder...', '...a main checkout holding a folder of x keeps it' (active and archived), '...a caller with no folder of x...', and '...from the main checkout is unchanged'. The archive-worktree and own-branch precedence are caught by two further tests.
- `locate` consumers: `next --change x` from the side worktree -> caught by 'unlocated 1: next --change x from the worktree on another branch' (asserts root and stage). The change run's stop lock in that worktree -> caught by 'unlocated 1: the change run's stop lock...' (code 2, 'stage proposal ready').
- `unplacedAction` guards (a) the folder is in locate's root, (b) the archive worktree, (c) no holder, (d) the stand-in -> caught by 'unplacedAction gives null for a change the loop can place' (3 subtests), 'gives null for an id no checkout holds' and 'gives the blocked stand-in with the holder's root and branch' (deepEqual of the whole object).
- `stateEntries` order (unplaced, archived stand-in, known, archived, named) -> caught by the state list, pt-BR, --change, 'nope' and run-file tests, and by the archived-on-origin stale-copy test with both subtests. The unknown id keeps exit 3 (AC-4): caught.
- `collectRoadmap` callsite (`unplacedAction(...) ?? nextAction(...)`) -> caught by the six 'unlocated 2:' board, decision and stop-lock tests, all red in proof/red-2.txt before the code. The 'x is the only line' stop-lock test and the 'a placed roadmap line reads as before' test also failed or passed as the plan predicted.
- Docs (AC-7) -> caught by 'unlocated 3' (red in proof/red-3.txt). The release pin is caught by the compozy docs test ('v0.39.1' present, 'v0.39.0' absent) and by the release-merge pin test, which the pr-verifier ran.

Test-the-mock hunt: no test asserts only a mock's canned answer. `gh` is a stub only for the archived-names listing, and the assertions check what our code derived from it. The fixtures (`addChange`, `withCreated`, `archiveOnOrigin`, hand-written stage headers with the worktree's real HEAD commit) match what the producers write, so there is no impossible-state fixture. The fixture move (`archiveGh`, `archivedFolder`, `archiveOnOrigin`, `withCreated`) into change-loop-fixtures.mjs leaves the field-fixes tests untouched apart from their imports.

Cross-process and real evidence: the plan's real-run proof (proof/real-run.txt, evidence.md AC rows) covers the before and after for state, state --change, nope, the board in two languages and `next` from the side worktree. I judge it enough for a flow that is a local CLI and not a producer-queue-consumer chain.

Inherited debt, not a gap of this change: the `roadmap-loop draft` and `status --json` paths keep their own exit 3 or catch (named non-goals in design.md), and no test was added for them because the change does not touch them.

### Well covered
- `locate` order, with each of its conditions and negatives, through its own tests and through `next` and the stop lock.
- The board, the state command and the roadmap decision agree on an unplaced line, in two languages, with the run file weighing first.
- The archived-versus-blocked decision for a stale copy (`createdAfter` both ways).
