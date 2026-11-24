Verdict: approved
Commit: 0f2c5fa5fecdc1ab8db15a0ca2f65e60d8a6437e

## Coverage analysis — release-merge-leftovers (origin/main...HEAD), round 1

### Findings
- [nit] plugins/openspec/hooks/conduct-check.test.mjs:612-619 (twoPrsConflict) — develop is pushed at main's tip, so a regression that classified conflicts or merged against origin/develop instead of origin/main (ctx.ref, conduct-check.mjs:420, 431) gives the same paths and no test goes red; only the --base and next.base assertions guard the base, and only if ctx.base changed too. One extra commit on develop would make the ref choice observable.
- [nit] plugins/panel/hooks/steps.ts:133 and plugins/panel/hooks/report.test.tsx:699-705 — No test fails if a dead step id such as push-rebased is re-added to STEP_OF in steps.ts alone: AC-14 checks only that every STEP_IDS entry is placed, and ACTOR_STEPS checks only the forward direction. The removal is dead-entry cleanup with no behaviour change, so this stays a nit.
- [nit] plugins/openspec/hooks/conduct-check.test.mjs:621-624 (listedBases) — Implementation-coupled: listedBases asserts the exact set of --base values of deliver-check's gh pr list calls to prove two-prs is in force. It is a deliberate non-vacuity control, but it breaks if deliver-check changes how it reads PRs; the contract is only that the two-prs model is in force.
- [praise] plugins/openspec/hooks/conduct-check.test.mjs:626-640 — The two-prs release-conflict test goes red if the override passed develop to the merge command. It asserts the --base value is main, develop is absent from the command, and the paths, agent, step and next.base. The listedBases control stops it passing under the plain pr config. The README case pins blocked with the exact state text.
- [praise] plugins/openspec/hooks/change-loop-compozy.test.mjs:358-362 — The CI pin is guarded in both directions: it requires v0.39.2 and refuses v0.39.1, v0.39.0, v0.38.0 and v0.37.0 in docs/openspec-flow.md, so the docs and the release number cannot drift apart.

In-scope surfaces: devkit-openspec hooks (conduct-check.test.mjs, change-loop-compozy.test.mjs), devkit-panel (steps.ts, i18n.ts, report.test.tsx), release metadata (marketplace.json, the two plugin.json files, CHANGELOG, CI pin in docs/openspec-flow.md), delta spec commit-attribution.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- two-prs override merges the base, not the test branch -> caught by `conduct: under two-prs, a change PR in conflict only in release files ...` (--base value is main, develop absent from the command, next.base is main). I ran it at this head: 2 pass, 0 fail.
- two-prs model in force -> caught by the listedBases positive control in both new tests.
- README conflict stays blocked under two-prs -> caught by the README two-prs test (step blocked/stop and the exact state `blocked: item 5 (conflict in README.md)`).
- ctx.ref chosen as origin/main, not origin/develop -> gap, nit only (F1).
- panel label table and step table agree after the removal -> caught by AC-14 `every step id of the i18n step table is placed` and `2.1 every step of actorOf has a short label`; the reverse direction on steps.ts alone is not guarded (F2).
- push-rebased stays gone from the checkers -> caught by the existing change-loop tests (change-loop.test.mjs, change-loop-remote-state.test.mjs, change-loop-compozy.test.mjs) and the change-coordination spec scenario 'No step pushes by force'.
- CI pin and version bumps (marketplace 0.44.0, devkit-openspec 0.39.2, devkit-panel 0.3.1) -> caught by change-loop-compozy.test.mjs:360-364 and the existing marketplace/pin checks; docs lines 733, 734 and 747 agree with the pin.
- Delta spec of commit-attribution (AC-1) -> no unit test reads it. The proof is the scratch archive in evidence.md, which is reasonable for a spec-only edit. The base spec at openspec/specs/commit-attribution/spec.md still holds push-rebased until archive applies the delta, as expected.
- AC-4 (no behaviour change) -> no production .mjs differs from origin/main, so the unchanged suites carry it.

Not run by me: the full suite (the delivery train runs it; evidence.md attempt 4 records its last full pass on 0816112, before the merges of origin/main). The AC-3 non-vacuity switch is the conducting session's own run, as evidence.md states.

### Well covered
- Two-PR release-merge override: command shape, base, paths, agent and the blocked case are asserted on real conduct-check output, not on a mock echo.
- Panel step cleanup: the AC-14 and 2.1 tests make a half-done removal in i18n.ts fail.
- CI pin: a positive match on the new version and negative matches on the older ones.
