Verdict: approved
Commit: faddf80f7035fb873748b734bd3515341ab62456

## Spec review — state-skips-unlocated

### Findings
- [nit] openspec/changes/state-skips-unlocated/design.md D-7; proposal.md Impact; tasks.md 1.1, 2.1, 3.1 — Plan metadata still names change-loop.test.mjs and roadmap-loop.test.mjs for tests now in change-loop-remote-state.test.mjs and roadmap-loop-upfront.test.mjs (only task 3.5 says so); no requirement affected, plan files unchanged since cb79a38.

In-scope specs: openspec/changes/state-skips-unlocated/specs/change-state/spec.md, openspec/changes/state-skips-unlocated/specs/roadmap-coordination/spec.md, with the canonical baselines openspec/specs/change-state/spec.md, openspec/specs/roadmap-coordination/spec.md and openspec/specs/coordination-locks/spec.md; ADR 0017 (decisions 1, 2 and its Note) and ADR 0010 (decision 3) are respected.

### Coverage
| Requirement | Status |
|-------------|--------|
| change-state: A change the loop cannot place is listed blocked (6 scenarios) | covered |
| change-state: The archive is checked before a change is listed unplaced (2 scenarios) | covered |
| change-state: The checkout a change is read in (6 scenarios) | covered |
| roadmap-coordination: A roadmap line the loop cannot place is shown blocked (5 scenarios) | covered |

Re-review of cb79a38..HEAD: the plan, spec deltas and the product and test files of this change are unchanged. The release renumbering is intact (plugin 0.40.1, marketplace 0.45.1, CHANGELOG 0.45.1, CI snippet pins v0.40.1). The ADR 0017 dated Note and the docs/openspec-flow.md state paragraph (exception for next, wait and session-next keeping exit 3; wrong-branch; archived; unknown id exit 3) are intact after the merge of main. No canonical spec under openspec/specs/change-state, roadmap-coordination or coordination-locks differs from main. python3 scripts/check.py passes. No test was run: the train proves the whole suite.

### Summary
- 1 finding (0 scope creep, 0 gaps), the round-1 nit, still open
