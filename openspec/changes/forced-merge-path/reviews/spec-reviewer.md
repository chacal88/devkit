Verdict: approved
Commit: 470a8ca1785f800a8d4ee4d5858be00edc9e6d61

## Spec review — forced-merge-path

### Findings
- [important] specs/change-delivery/spec.md, requirement 'A merged pull request is found from any checkout'; evidence.md Observation 1 — Stacked merged pull requests: the number found depends on the checkout and no scenario says which is the change's; recorded as a known limit and follow-up. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs, scenario 'A further pull request is open' — The test had no red required check and did not assert the merged pull request is not read as forced; now asserts both. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] specs/change-delivery/spec.md, 'A merged pull request is found from any checkout' and 'The open items of a forced merge are named' — The bounds of 10 commits and 300 files were in no requirement; the spec now states them and has a scenario for a verdict recorded too far behind to read. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/openspec-flow.md delivered paragraph; branch base — Stop-branch sentence scoped to a partial merge, and origin/main merged before the final verify and review (train 6). · fixed in c4f8a1303163cdf3fbf9a6bf7f51d8803014d382
- [nit] branch base (local ref origin/main 086a53c, train 8) — HEAD does not contain the local origin/main (train 8); I did not fetch, so this may be stale. Merge main again before the last verify and review if the remote is ahead.

Spec review — stale-only re-review of the two merges of main (a1a995c train 4, c4f8a13 train 6).

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
| A merged pull request is found from any checkout | covered (stacked-PR rule still a recorded limit and follow-up) |
| The loop leads an owner's forced merge to the retro (change-coordination) | covered |
| An archive pull request is not judged on the archived change's tasks (reviews-check) | covered |

### Notes
Merge resolution: plugin.json 0.43.0, marketplace.json 0.48.0 (plugin 0.43.0) and the three CI pin hunks in docs/openspec-flow.md agree on v0.43.0; the CHANGELOG puts 0.48.0 above main's 0.47.0, 0.46.0 and 0.45.0. ADR 0003 lists ADR 0028 as an amending ADR next to 0018, 0027 and 0030 and carries the forced-merge Note. The flow doc's delivered paragraph keeps ADR 0028 and the partial-merge scoping of stop-branch. The devkit skill keeps both the merge-check command step and the retro-with-reply sentence. No conflict markers remain outside tests that assert their absence.

Composition: the forced retro is a session step and is not in CHECK_BEFORE, so main's merge-check cannot intervene before it. testStageStep is skipped for next.forced, and the forced-merge reply goes through sessionAction.

Tests: not rerun as instructed; the caller's log shows 7 files, 1268 pass, 0 fail. A narrower focused run matched one test, which passed.

Not opened: the three change specs (unchanged in the range d0a2b37..HEAD) and the conflict hunks of deliver-check-archive.test.mjs and openspec/config.yaml in a1a995c/c4f8a13 were not read beyond the diff against d917ae0, so I rely on the 1268/1268 log for them.

### Summary
- 1 finding open (0 blocking, 0 important, 1 nit), 0 scope creep, 0 gaps. Spec review passes.
