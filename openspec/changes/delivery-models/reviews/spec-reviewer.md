Verdict: rejected
Commit: 26e00b19de03124db593d628a40c3383400db2c6

## Spec review — delivery-models

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs nextStep (two-prs block, after the `it(5).details.none` row); design.md D-4 table T3/T5 — Partial coverage of 'The two-pull-request delivery stops where it cannot go on by itself' / scenario 'The test-branch pull request was closed': the blocked row for a closed test PR (T5) sits after the base-PR rows. With a closed test PR the run can still emit open-pr (no base PR), push, or edit-pr-body before it blocks. The requirement says it SHALL open, move, close, push or merge nothing. The tests only cover the case where the base PR exists, is pushed and has a complete body. Move the closed-PR block ahead of those rows, or record in the spec that the block applies only after the base PR is in order.

In-scope specs: openspec/changes/delivery-models/specs/delivery-models/spec.md, openspec/changes/delivery-models/specs/reviews-check/spec.md, openspec/changes/delivery-models/specs/change-coordination/spec.md, openspec/changes/delivery-models/specs/coordination-locks/spec.md, openspec/changes/delivery-models/specs/change-delivery/spec.md. Cross-checked against requirements.md (AC-1 to AC-10), proposal.md, design.md D-1 to D-14, ADR 0017 (the plan calls it ADR 0015), ADR 0003. The ADR number collision with main is already known and not repeated.

### Coverage
| Requirement | Status |
|-------------|--------|
| The project chooses its delivery model in its configuration (delivery-models) | covered (`deliverySettings`, `deliveryConfig`, `readDevkitSettings`) |
| Without the new model the ship map decides as before | covered |
| A ship entry that disagrees with the model is a configuration error | covered (`deliveryConfig`, exit 3) |
| Both pull requests open together | covered (`open-prs`, `open-test-pr`) |
| The owner merges both pull requests | covered (`ready-test-branch`, `ready-base`; ship is `pr`, so no auto-merge) |
| The two-pull-request delivery stops where it cannot go on by itself | partial (see F1; the default-branch and test-branch-commit stops are covered) |
| The base pull request's check runs again after the test-branch merge | covered (`reviewsRerun`, `rerun-checks`) |
| A conflict with the test branch goes to the support branch | covered (`supportState`, `merge-into-support`, `move-test-pr`) |
| The resolution is reviewed before the pull request goes on | covered (`resolutionState`, `ownCommits`, `review-resolution`, `fix-resolution`) |
| A resolution review deadlock goes to the owner | covered (`stop-review-deadlock` with `resolution: true`) |
| A later commit of the task branch reaches both pull requests | covered (`merge-into-support`, `push-support`) |
| The archive goes to both branches | covered (`open-test-archive-pr`, `archive-prs-ready`, `archiveNext`) |
| The archive to the test branch stops where it cannot go on by itself | covered (`test-archive-pr` and `test-archive-cherry-pick` stops) |
| The delivery settings come from the repository's default branch (reviews-check) | covered (`ciSettingsRef`, `twoPrsContext`) |
| The check names the default branch from the event, else from the clone | covered (`ciSettingsRef` order: event, `origin/HEAD`, base ref) |
| A configured base branch other than the default branch fails the check | covered (`twoPrsRules`) |
| A pull request to the base branch waits for its pull request to the test branch | covered (`findTestPr`, `twoPrsRules`) |
| A pull request to the base branch that holds a test-branch commit fails | covered (`testBranchCommit`) |
| A pull request to the test branch is judged on its resolution only | covered (`testBranchPr`) |
| The test branch never enters a task branch (coordination-locks) | covered (`testBranchViolation`) |
| In the two-pull-request model a change opens from the base branch (change-coordination) | covered (`openUnderLock`) |
| A delivery setting that cannot be used stops the command | covered (`projectGate`, `setting-missing`, `setting-unknown`) |
| In the two-pull-request model a change is archived when both branches hold it | covered (`archivedDates`, `unfinished`) |
| A hand-off on the support branch names the support worktree | covered (`brief` with `detail.root` and `detail.branch`) |
| In the two-pull-request model only the pull request to the base branch delivers (change-delivery) | covered (`base` filter in `findChangePr`, `fetchPr`, `mergedOnBranch`) |

### Findings
- [important] F1 as above.

No scope creep. Every new step, message and field traces to a requirement, or to a design decision (D-4, D-8, D-10, D-11) that the specs name. `listWorktrees` moving into `deliver-check.mjs` and `plainValue` into `guard.mjs` are refactors design D-11 covers.

### Summary
- 1 finding (0 scope creep, 1 gap, partial)

I checked ADR 0017 and the notes in ADR 0003 against the specs and found nothing in conflict. ADR 0017 is accepted, with the owner's approval recorded in approval.md. I opened the hooks through their diffs against origin/main and read only the functions the specs name.
