Verdict: approved
Commit: cb79a383d3ea574537c9c09ce539af92dbaeaebc

## Spec review — state-skips-unlocated

### Findings
- [nit] openspec/changes/state-skips-unlocated/design.md D-7 (lines 327-342, 380); proposal.md Impact; tasks.md 1.1, 2.1, 3.1 — Plan metadata still names change-loop.test.mjs and roadmap-loop.test.mjs for tests now in change-loop-remote-state.test.mjs and roadmap-loop-upfront.test.mjs (only task 3.5 says so); test names unchanged, no requirement affected, plan not edited after approval.

In-scope specs: openspec/changes/state-skips-unlocated/specs/change-state/spec.md, openspec/changes/state-skips-unlocated/specs/roadmap-coordination/spec.md, with the canonical baselines openspec/specs/change-state/spec.md, openspec/specs/roadmap-coordination/spec.md and openspec/specs/coordination-locks/spec.md; ADR 0017 (decisions 1, 2 and its new Note) and ADR 0010 (decision 3) are respected.

### Coverage
| Requirement | Status |
|-------------|--------|
| change-state: A change the loop cannot place is listed blocked (6 scenarios) | covered |
| change-state: The archive is checked before a change is listed unplaced (2 scenarios) | covered |
| change-state: The checkout a change is read in (6 scenarios) | covered |
| roadmap-coordination: A roadmap line the loop cannot place is shown blocked (5 scenarios) | covered |

Re-review of 63c5eac..HEAD: only f636733 touches the remit (the state paragraph of docs/openspec-flow.md and a dated Note in ADR 0017). Both name the exception that next, wait and session-next keep exit 3 for an unplaced change; this is consistent with the delta spec, which puts no requirement on those commands for an unplaced change and keeps exit 3 only for an id nothing knows. The spec, design, tasks, proposal, plugin and script files are unchanged in this range. The state paragraph still cites ADR 0017 within its first blank line, and python3 scripts/check.py passes. From the spec side the ADR Note and the docs sentence satisfy the adr-reviewer's F1; the adr-reviewer owns that verdict. No test was run: the pr-verifier's filtered runs at f636733 are green and the train proves the whole suite.

### Summary
- 1 finding (0 scope creep, 0 gaps), the round-1 nit, still open
