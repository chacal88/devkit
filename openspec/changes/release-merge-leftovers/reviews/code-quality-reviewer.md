Verdict: approved
Commit: 48d1148e4c105c19675366c602ca8a373b09b8e9

## Quality review: release-merge-leftovers (round 1)

### Findings
- [praise] plugins/openspec/hooks/conduct-check.test.mjs:641-666 — Each new two-prs test opens with a positive control (the gh pr list bases are main and develop), so a fixture that fell back to pr mode fails instead of passing vacuously; assertions pin the --base value rather than only the presence of main, and rule out develop.
- [praise] openspec/changes/release-merge-leftovers/specs/commit-attribution/spec.md — The delta works around the OpenSpec rule that a MODIFIED block cannot drop a scenario (REMOVED plus ADDED under a new header, text unchanged), flags the side effects to the owner in the proposal, and proves the result by a scratch archive (17 scenarios, 0 push-rebased).
- [nit] openspec/changes/release-merge-leftovers/tasks.md:201 — Task 2.1 is ticked [x] although the move it describes was superseded and no TWO_PRS edit was made; the preamble note explains it, but the ticked line still describes work not done.
- [nit] plugins/openspec/hooks/change-loop-compozy.test.mjs:359 — The invariant comment keeps growing by one clause per release (one very long line); consider keeping only the current and previous pin, since git history holds the rest.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: the diff matches the declared scope. The spec delta validates strict and its scratch archive proves AC-1. The panel tables lose the same id together, and no leftover is outside the intended guards and the delta-managed spec lines. The CI pin, manifests, marketplace and changelog agree. The two new tests pass here (2 pass, 0 fail) and have a positive control. No behaviour changes: only test files and panel tables changed, and no hook source. The whole-suite result is the one in evidence.md (2767 tests, 2766 pass, 0 fail, run before the docs-only merge); it was not re-run, as instructed. The non-vacuity switch for AC-3 is the conducting session's own run, and evidence.md says so.
