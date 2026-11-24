Verdict: approved
Commit: c6442089e54614c6871c50400b920f810a467c85

## Spec review — forced-merge-path (round 3, since 8dcee76)

### Findings
- [important] specs/change-delivery/spec.md 'The open items of a forced merge are named' — Previous F3: the stricter open-flag currency rule, the fixed-in compare check and the block on a non-404 compare error were in no scenario. Now stated in three scenarios and in design D-3, matching deliver-check.mjs:952-960; G13 and G14 pass alone. · fixed in ca5b3b3283eba0ede1df206d02062305ecd41b05
- [nit] branch base (local ref origin/main) — HEAD holds train 12 only while the local origin/main is further ahead; not fetched. The train's join brings in the rest.

In-scope specs: openspec/changes/forced-merge-path/specs/change-delivery/spec.md, specs/change-coordination/spec.md, specs/reviews-check/spec.md (the last two unchanged since 8dcee76)

### Coverage
| Requirement | Status |
|---|---|
| Delivered means its own pull request merged and every task ticked | covered |
| The work left after a merge is named | covered |
| A task done after the merge is ticked before the archive | covered |
| An owner's forced merge is told by the required checks | covered |
| An owner's forced merge leads to the archive steps | covered |
| The open items of a forced merge are named | covered (three new scenarios, G13 and G14) |
| A merged pull request is found from any checkout | covered |
| The loop leads an owner's forced merge to the retro (change-coordination) | covered |
| An archive pull request is not judged on the archived change's tasks (reviews-check) | covered |

### Notes
The range since 8dcee76 changes only openspec files and deliver-check-archive.test.mjs. Product code is unchanged. G13 and G14 were run alone and pass (2/2).

### Summary
- 2 findings: 1 previous important fixed in ca5b3b3, 1 nit open (F2). 0 blocking, 0 scope creep, 0 gaps.
