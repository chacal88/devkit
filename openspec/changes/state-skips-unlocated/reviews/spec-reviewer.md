Verdict: approved
Commit: 7e305e2e4151ffd509180328b4a05b3f339cb2ae

## Spec review — state-skips-unlocated

### Findings
- [nit] openspec/changes/state-skips-unlocated/requirements.md:18 and AC-5 — requirements.md says the caller's checkout wins 'when it holds the change's folder'. The approved spec delta ('The checkout a change is read in') and the code narrow this to the active folder with no folder of the change in the main checkout. requirements.md was not updated to match; the spec resolves the wording silently.
- [nit] specs/change-state/spec.md, requirement 'The archive is checked before a change is listed unplaced' — This requirement and its two scenarios are implemented and tested ('unlocated 1: ... reads archived'). requirements.md has no acceptance criterion (AC-1 to AC-7) for the archived stale-copy behaviour, so it cannot be traced to the owner-confirmed requirements.
- [nit] proposal.md, section Impact (Tests) — It says the new tests go in change-loop.test.mjs and roadmap-loop.test.mjs and that no existing test changes. The tests are in change-loop-remote-state.test.mjs and roadmap-loop-upfront.test.mjs, and change-loop-compozy.test.mjs changed (the CI pin assertion, and helpers moved to the fixtures file). tasks.md records the move; the proposal text is stale.

In-scope specs: openspec/changes/state-skips-unlocated/specs/change-state/spec.md and specs/roadmap-coordination/spec.md (deltas). Baselines: openspec/specs/change-state/spec.md, openspec/specs/roadmap-coordination/spec.md and openspec/specs/change-coordination/spec.md (archived-id scenarios the change reuses). ADR 0017 and ADR 0010 are cited by the change; neither is contradicted. `decisions.md` records no new ADR, and `wrong-branch` already exists in both languages in the message table.

### Coverage
| Requirement | Status |
|---|---|
| change-state: A change the loop cannot place is listed blocked (list, pt-BR, --change, run file first, unknown id exits 3, placeable change unchanged) | covered |
| change-state: The archive is checked before a change is listed unplaced (archived stale copy; new change reusing the id) | covered |
| change-state: The checkout a change is read in (caller's worktree, archive worktree wins, own worktree wins, main or own worktree unchanged, main holds a folder, caller holds only an archived folder) | covered |
| roadmap-coordination: A roadmap line the loop cannot place is shown blocked (board en, board pt-BR, board and state agree, roadmap decision says it once, roadmap stop lock) | covered |

Every scenario maps to a test named 'unlocated 1', 'unlocated 2' or 'unlocated 3'. The helper `unplacedAction` is used on both surfaces: `stateEntries` in change-loop.mjs and `collectRoadmap` in roadmap-loop.mjs. The `locate` order matches the delta. The docs (`docs/openspec-flow.md` state paragraph and the three CI pins), `CHANGELOG.md` 0.43.1 and the release files (devkit-openspec 0.39.1, marketplace 0.43.1) agree with each other. AC-4 (unknown id exits 3) is kept. I found no behaviour in the diff that no requirement asks for.

I ran the 'unlocated' tests in change-loop-remote-state.test.mjs and roadmap-loop-upfront.test.mjs, filtered (39 of 39 pass). I did not run the whole suite.

### Summary
- 3 findings (all nit; 0 scope creep, 0 gaps).
- Spec review: pass. Full coverage; no scope creep.
