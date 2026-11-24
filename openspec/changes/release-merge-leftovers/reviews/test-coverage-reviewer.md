Verdict: approved
Commit: dc781190731fd387e4e0f7accf90758c0e67496b

## Coverage analysis — release-merge-leftovers (origin/main...HEAD), round 1

### Findings
- [nit] plugins/openspec/hooks/conduct-check.test.mjs:631-640 (twoPrsConflict) — develop is pushed at main's tip, so a regression that classified conflicts or merged against origin/develop (ctx.ref) instead of origin/main (conduct-check.mjs:420, 431) gives identical paths and no test goes red; only the --base/next.base assertions guard the base, and only if ctx.base changed too. One extra commit on develop would make the ref choice observable. Write in: the same helper.
- [nit] plugins/panel/hooks/steps.ts:133 and plugins/panel/hooks/report.test.tsx:1023 — No test fails if a dead step id such as push-rebased is re-added to the STEP_OF table in steps.ts alone: AC-14 only checks that every STEP_IDS entry is placed, not that every STEP_OF entry has a label, and ACTOR_STEPS only checks the forward direction. The removal is dead-entry cleanup with no behaviour change, so this stays a nit. The guard would be a reverse-direction assertion in report.test.tsx.
- [nit] plugins/openspec/hooks/conduct-check.test.mjs:631-652 (listedBases) — implementation-coupled: listedBases asserts the exact set of --base values of deliver-check's `gh pr list` calls to prove two-prs is in force. It is a deliberate non-vacuity control and is fine, but it breaks if deliver-check changes how it reads PRs; the contract is only 'two-prs model in force'.
- [praise] plugins/openspec/hooks/conduct-check.test.mjs:642-657 — The new test goes red if the override passed develop to the merge command: it asserts the --base value is main, develop is absent from the command, next.base, the paths, the agent and the step. The positive control on the listed bases stops it passing under the plain pr config.
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:360-362 — The CI pin is guarded in both directions: it requires v0.39.1 and refuses v0.39.0 and v0.38.0 in docs/openspec-flow.md, so the docs and the release number cannot drift apart.

In-scope surfaces: devkit-openspec hooks (conduct-check.test.mjs, change-loop-compozy.test.mjs), devkit-panel (steps.ts, i18n.ts, report.test.tsx), release metadata (marketplace.json, the two plugin.json files, CHANGELOG, CI pin in docs/openspec-flow.md), delta spec commit-attribution.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- two-prs override merges the base, not the test branch -> caught by `conduct: under two-prs, a change PR in conflict only in release files ...` (the --base value is main, develop absent, next.base is main). I ran it: 2 pass, 0 fail.
- two-prs model in force -> caught by the listedBases positive control in both new tests.
- README conflict stays blocked under two-prs -> caught by the README two-prs test (the step and the exact state text `blocked: item 5 (conflict in README.md)`).
- ctx.ref chosen as origin/main, not origin/develop -> gap, nit only (F1).
- panel label table and step table agree after the removal -> caught by AC-14 `every step id of the i18n step table is placed` and `2.1 every step of actorOf has a short label`; the reverse direction on steps.ts alone is not guarded (F2).
- push-rebased stays gone from the checkers -> caught by change-loop.test.mjs:501, change-loop-remote-state.test.mjs:1437 and change-loop-compozy.test.mjs:318-321.
- CI pin and version bumps -> caught by change-loop-compozy.test.mjs:360-362 and the marketplace/pin tests.
- delta spec text of commit-attribution (AC-1) -> no test reads it; the proof is the scratch archive recorded in evidence.md, not a unit test. That is reasonable for a spec-only edit.

No production .mjs file differs from origin/main, so no new production branch needs a test. AC-4 (no behaviour change) rests on the unchanged suites. The whole suite at this HEAD stands on the delivery train; evidence.md says so, and I did not run it as instructed. The AC-3 non-vacuity switch is the conducting session's own run, as evidence.md states.

### Well covered
- Two-PR release-merge override: command shape, base, paths, agent and the blocked case are asserted on real conduct-check output, not on a mock echo.
- Panel step cleanup: the AC-14 and 2.1 tests make a half-done removal in i18n.ts fail.
- CI pin: a positive match on the new version and negative matches on the two older ones.
