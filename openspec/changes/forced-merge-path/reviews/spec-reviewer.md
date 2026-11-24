Verdict: approved
Commit: c30bfb8d0761b3f7f73f1f8ceaf94b8736f2ea53

## Spec review — forced-merge-path (stale-only re-review at c30bfb8)

### Findings
- [nit] branch base (local ref origin/main c09860c, train 9) — HEAD does not contain the local origin/main (train 9, PR 129); no fetch was done, so the remote may be further ahead; merge main again before the last verify and review if so.
- [important] specs/change-delivery/spec.md, 'A merged pull request is found from any checkout' — Stacked merged pull requests: which is the change's was unspecified. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0

In-scope specs: openspec/changes/forced-merge-path/specs/change-delivery/spec.md, specs/change-coordination/spec.md, specs/reviews-check/spec.md

### Coverage
| Requirement | Status |
|---|---|
| Delivered means its own pull request merged and every task ticked | covered |
| The work left after a merge is named | covered |
| A task done after the merge is ticked before the archive | covered |
| An owner's forced merge is told by the required checks | covered |
| An owner's forced merge leads to the archive steps | covered |
| The open items of a forced merge are named | covered |
| A merged pull request is found from any checkout | covered |
| The loop leads an owner's forced merge to the retro (change-coordination) | covered |
| An archive pull request is not judged on the archived change's tasks (reviews-check) | covered |

### Notes
Trains 7-8 changes to deliver-check.mjs, change-loop.mjs and guard.mjs do not touch the forced-merge detection or its retro step. Release 0.45.0 / pin v0.45.0 consistent; ADR 0003 lists 0027, 0028, 0030. Tests not rerun (caller's log: 13 files, 1931 pass).

### Summary
- 1 finding open (0 blocking, 0 important, 1 nit), 0 scope creep, 0 gaps.
