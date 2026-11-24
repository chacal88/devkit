Verdict: approved
Commit: 65f22c441ddc35b8afd2374365f046393aaaf7dc

## Spec review — state-skips-unlocated

### Findings
- [nit] openspec/changes/state-skips-unlocated/requirements.md:18 — The requirements say the caller's checkout wins 'when it holds the change's folder'; the approved spec delta and design D-5 narrow this to the active folder with the main checkout holding none, and requirements.md was not updated to match.
- [nit] openspec/changes/state-skips-unlocated/specs/change-state/spec.md: Requirement 'The archive is checked before a change is listed unplaced' — This requirement and its two scenarios are covered and tested, but requirements.md has no acceptance criterion for them (AC-1 to AC-7), so the archived stale-copy behaviour is not traceable from the requirements file.

In-scope specs: openspec/changes/state-skips-unlocated/specs/change-state/spec.md, openspec/changes/state-skips-unlocated/specs/roadmap-coordination/spec.md (deltas); baselines openspec/specs/change-state/spec.md and openspec/specs/roadmap-coordination/spec.md; ADR 0017 (not contradicted).

### Coverage
| Requirement | Status |
|---|---|
| change-state: A change the loop cannot place is listed blocked (all 6 scenarios) | covered |
| change-state: The archive is checked before a change is listed unplaced (2 scenarios) | covered |
| change-state: The checkout a change is read in (6 scenarios) | covered |
| roadmap-coordination: A roadmap line the loop cannot place is shown blocked (5 scenarios) | covered |

Every scenario maps to a named test (`unlocated 1:`, `unlocated 2:`, `unlocated 3:`). `wrong-branch` already exists in both languages with the exact phrases the specs quote. `statusJson`, `draftCmd` and `sessionNext` keep their behaviour, which requirements, design and readiness name as out of scope. The docs, CHANGELOG and release files (0.38.1, 0.42.1, CI pin) match design D-6.

### Summary
- 2 findings (nits only; 0 scope creep, 0 gaps).
- Spec review: pass. Full coverage; no scope creep.
