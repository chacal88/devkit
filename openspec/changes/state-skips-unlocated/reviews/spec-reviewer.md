Verdict: approved
Commit: 63c5eac8f72e8319b9056b1c9ca52715cfaf775c

## Spec review — state-skips-unlocated

### Findings
- [nit] openspec/changes/state-skips-unlocated/design.md D-7; proposal.md Impact; tasks.md 1.1, 2.1, 3.1 — Plan metadata still names change-loop.test.mjs and roadmap-loop.test.mjs as the files holding the new tests; they now live in change-loop-remote-state.test.mjs and roadmap-loop-upfront.test.mjs (only task 3.5 says so). Test names are unchanged and no requirement is affected.

In-scope specs: openspec/changes/state-skips-unlocated/specs/change-state/spec.md, openspec/changes/state-skips-unlocated/specs/roadmap-coordination/spec.md, with the canonical baselines openspec/specs/change-state/spec.md, openspec/specs/roadmap-coordination/spec.md and openspec/specs/coordination-locks/spec.md; ADR 0017 (decisions 1, 2) and ADR 0010 (decision 3) are respected.

### Coverage
| Requirement | Status |
|-------------|--------|
| change-state: A change the loop cannot place is listed blocked (6 scenarios) | covered |
| change-state: The archive is checked before a change is listed unplaced (2 scenarios) | covered |
| change-state: The checkout a change is read in (6 scenarios) | covered |
| roadmap-coordination: A roadmap line the loop cannot place is shown blocked (5 scenarios) | covered |

Every scenario maps to a test: unlocated 1: tests 1.1 to 1.19 in change-loop-remote-state.test.mjs and unlocated 2: tests 2.1 to 2.8 in roadmap-loop-upfront.test.mjs. The docs follow (unlocated 3: and the release pin). No scope creep: the reused wrong-branch code adds no new message, and the archived check, the locate step and the collectRoadmap helper call each derive from a spec requirement. Filtered run of the unlocated tests at this head: 39 of 39 pass; the whole suite was not run, as instructed.

### Summary
- 1 finding (0 scope creep, 0 gaps)
