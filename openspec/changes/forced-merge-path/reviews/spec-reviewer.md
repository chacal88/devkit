Verdict: rejected
Commit: 8dcee767e6571680c851906a17ba978980a1316a

## Spec review — forced-merge-path (round 2, since c30bfb8)

### Findings
- [important] specs/change-delivery/spec.md, scenario 'A review that did not pass' — Previous finding (stacked merged pull requests: which is the change's was unspecified). · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] branch base (local ref origin/main 4eccbdc) — Previous nit stands, with a new sha. The local origin/main is now 4eccbdc (trains 13 and 14, PRs 137 and 138). HEAD holds train 12 only. The train's join is meant to bring in the rest. I did not fetch, so the remote may be further ahead.
- [important] specs/change-delivery/spec.md 'A review that did not pass' (deliver-check.mjs:947-962) — The gate at the merged head now treats an approved verdict that lists an undisposed finding as current only behind commits of the change's own review record (0934b63, tests G11 and G12). The spec scenario says only 'recorded before a product change'. The stricter rule, the 'fixed in <sha>' check through the GitHub compare route at the merged head, and the block on a compare error other than 404 are in no scenario. The change resolved this silently. Extend the scenario, or say it follows main's readReviews rule.

In-scope specs: openspec/changes/forced-merge-path/specs/change-delivery/spec.md, specs/change-coordination/spec.md, specs/reviews-check/spec.md

### Coverage
| Requirement | Status |
|---|---|
| Delivered means its own pull request merged and every task ticked | covered |
| The work left after a merge is named | covered |
| A task done after the merge is ticked before the archive | covered |
| An owner's forced merge is told by the required checks | covered |
| An owner's forced merge leads to the archive steps | covered (the gate-file scenarios carry the F3 ambiguity) |
| The open items of a forced merge are named | covered |
| A merged pull request is found from any checkout | covered |
| The loop leads an owner's forced merge to the retro (change-coordination) | covered |
| An archive pull request is not judged on the archived change's tasks (reviews-check) | covered |

### Notes
The changes since c30bfb8 are 0934b63, 638eeac, 03ce440 and 8dcee76. 0934b63 adds the open-flag currency rule to gatesAtHead. G11 and G12 pass when run alone. 03ce440 is the train 12 merge: release 0.46.0 and marketplace 0.51.0 are consistent with tasks.md 3.3. The evidence commits touch only openspec/. No new scope creep and no gap against any scenario.

### Summary
- 3 findings: 1 previous important fixed in 8058ecf, 1 new important (F3, a spec ambiguity resolved silently), 1 nit open (F2). 0 blocking, 0 scope creep, 0 gaps.
