Verdict: approved
Commit: 535524cac1bb7936280169bb3aec4f5082dbc716

## Spec review — state-skips-unlocated

### Findings
- [nit] openspec/changes/state-skips-unlocated/tasks.md 1.1, 2.1, 3.1; design.md D-7; proposal.md Impact — Plan metadata still names change-loop.test.mjs and roadmap-loop.test.mjs for tests that live in change-loop-remote-state.test.mjs and roadmap-loop-upfront.test.mjs (only task 3.5 says so); no requirement is affected, and the plan files are unchanged since the last round.

In-scope specs: openspec/changes/state-skips-unlocated/specs/change-state/spec.md and openspec/changes/state-skips-unlocated/specs/roadmap-coordination/spec.md. The baselines openspec/specs/change-state, roadmap-coordination and coordination-locks are unchanged against main (git diff d917ae0..HEAD -- openspec/specs is empty). ADR 0017 (decisions 1 and 2 and its Note) and ADR 0010 (decision 3) are respected.

### Coverage
| Requirement | Status |
|-------------|--------|
| change-state: A change the loop cannot place is listed blocked (6 scenarios) | covered |
| change-state: The archive is checked before a change is listed unplaced (2 scenarios) | covered |
| change-state: The checkout a change is read in (6 scenarios) | covered |
| roadmap-coordination: A roadmap line the loop cannot place is shown blocked (5 scenarios) | covered |

Re-review of faddf80..HEAD. The plan files and both spec deltas are unchanged since the last round. The diff against main shows the change's own product code intact after the merge of train 6: unplacedAction is imported and used in roadmap-loop.mjs, and change-loop.mjs holds both main's baseMergeOf and this change's locate. The ADR 0017 Note of this change sits as its own paragraph after post-merge-validate's. The docs/openspec-flow.md state paragraph and the CI snippet pins are v0.42.1. The release is consistent at devkit-openspec 0.42.1, marketplace 0.47.1 and CHANGELOG 0.47.1. python3 scripts/check.py: all checks passed. I ran no test; the pr-verifier evidence and the train cover the suites. Code brought in by main was not reviewed.

### Summary
- 1 finding (0 scope creep, 0 gaps): the earlier nit F1, still open.
