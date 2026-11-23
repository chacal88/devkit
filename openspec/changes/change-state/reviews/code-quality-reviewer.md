Verdict: approved
Commit: 9a76a1f2241bd3d67af5fbd143b68ead5070eb7e

## Quality review — change-state (round 1, re-review after the third main merge)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:621 — changeState is one pure derivation shared by nextAction and stateEntries, with S1-S8 first-match rows; the moved run-file helpers are re-exported, not duplicated.
- [praise] plugins/openspec/hooks/change-loop.mjs:675 — One githubSilent predicate feeds decide, whereOf and waitLoop's isUnreadable, and the 3-failures-then-blocked guarantee is kept.
- [nit] openspec/changes/change-state/evidence.md (AC-4, AC-5) — AC-4, AC-5 and the hourglass, stop and archive title forms have test proof only; a real-output demonstration with a stubbed gh and a temp run file would close it. The evidence states why not.
- [nit] plugins/openspec/hooks/change-loop.mjs:1499 — waitLoop quotes action.detail?.error ?? '' when error is null, so an empty string yields 'GitHub cannot be read ()'; add a fallback phrase.
- [praise] plugins/openspec/hooks/change-loop.test.mjs — Every t.test subtest of the change's tests is awaited, and no un-awaited t.test remains in plugins/openspec/hooks; this fixes the CI Node cancellation.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2481 — The release renumbering was done at every coupled site (manifests, CHANGELOG order, CI pin, setPins, pin assertion, plan text), and the pin test refuses the previous release v0.23.0.

### Summary
- 6 findings (0 blocking, 0 important, 2 nit) + 4 praise
- Justification: re-review of c8a9f5c..9a76a1f. Opened the manifests, CHANGELOG, docs pin, pin assertion and plan text that this change's side of the merge renumbered to devkit-openspec 0.24.0 / marketplace 0.28.0, and found them consistent with each other and with main's 0.27.0 entry kept below. No production code of this change changed in the range; main's ac40615 content is out of scope. The whole-suite result at c6e5c1b (1712 of 1712 pass, CI check passed) was relied on, not re-run, as HEAD differs from it only in evidence.md. The known exit 3 of 'state' without --change on a stale local main is pre-existing on main and not a regression of this change. Only nits remain, so the verdict stays approved.
