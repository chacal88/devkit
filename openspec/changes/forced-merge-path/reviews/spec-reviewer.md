Verdict: approved
Commit: d0a2b37eb677790cbbb1422d2ecf4b5143da5d89

## Spec review — forced-merge-path

### Findings
- [important] specs/change-delivery/spec.md, requirement "A merged pull request is found from any checkout"; evidence.md Observation 1 — Stacked merged pull requests (91, 93, 94): the number found depends on the checkout and no scenario says which is the change's. Recorded as a known limit and follow-up in design.md Risks and proposal.md out-of-scope, which satisfies 'record it as a follow-up change'. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:1198, scenario "A further pull request is open" — The test had no red required check and did not assert the merged pull request is not read as forced. It now has devkit-reviews FAILURE and asserts no forced fact and no pr view 12 call. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] specs/change-delivery/spec.md, "A merged pull request is found from any checkout" and "The open items of a forced merge are named" — The bounds of 10 commits and 300 files were in no requirement. The spec now states the 10 commits and has the scenario 'A verdict recorded too far behind to read'. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] docs/openspec-flow.md delivered paragraph; branch base — (a) the stop-branch sentence is now scoped to a partial merge (fixed in 8058ecf). (b) origin/main (a347ac0 locally; merge-base still 9dff573) has moved on with own-pr-archive-paths changes to isOwnPr and deliver-check.mjs and is not merged; merge it before the final verify and review.

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
| A merged pull request is found from any checkout | covered (stacked-PR rule recorded as limit and follow-up) |
| The loop leads an owner's forced merge to the retro (change-coordination) | covered |
| An archive pull request is not judged on the archived change's tasks (reviews-check) | covered |

### Notes
F1: the caller recorded a follow-up (design.md Risks row, proposal.md out-of-scope) rather than deciding a rule; that satisfies 'decide the rule in the spec or record it as a follow-up change'. The spec still has no scenario for the stack case; the follow-up should add one when it picks the rule.
F4(b) stays open as a nit: HEAD is not a descendant of origin/main (local ref a347ac0, merge-base 9dff573), and origin/main changed isOwnPr and deliver-check.mjs, which the commit arm calls. I did not fetch, so the ref may be older than the remote. The project rule is to merge main before the last verify and review.
Focused run: deliver-check-archive.test.mjs L4 to L7 and the further-open-pull-request test, 5 pass, 0 fail.

### Summary
- 1 finding open (0 blocking, 0 important, 1 nit), 0 scope creep, 0 gaps. Spec review passes with this follow-up.
