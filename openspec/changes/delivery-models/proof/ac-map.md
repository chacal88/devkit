# Acceptance criteria and the tests that prove them (task 6.8)

Result column: from the run of the whole new suite (`env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/delivery-models.test.mjs`) on 2026-11-22: 734 tests, 734 pass, 0 fail. The coordinator's 6.9 run confirms it.

Renumbering: the plan's "ADR 0015" is ADR 0017 in every file written here, because main already holds ADR 0015 (a project slice) and an open pull request adds ADR 0016.

| AC | Slug | Test (in `plugins/openspec/hooks/delivery-models.test.mjs`) | Result |
|---|---|---|---|
| AC-1 | `model-chosen-per-project` | `delivery-models config: trunk-auto alone is merge` | pass |
| AC-1 | `model-chosen-per-project` | `delivery-models config: two-prs alone is pr, with the model and both names` | pass |
| AC-1 | `model-chosen-per-project` | `delivery-models open: a two-prs change starts from origin/<base>` | pass |
| AC-1 | `model-chosen-per-project` | `delivery-models open: a trunk project opens as today, with no test branch needed` | pass |
| AC-1 | `model-chosen-per-project` | `delivery-models docs: the documents follow` | pass |
| AC-2 | `two-prs-open-together` | `delivery-models AC-2: both pull requests open together from the task branch and the state names both` | pass |
| AC-3 | `owner-merges-both` | `delivery-models AC-3: the owner merges the test-branch pull request first, then the base one; auto-merge is never enabled` | pass |
| AC-4 | `base-waits-for-test-branch` | `delivery-models AC-4: the base pull request's check fails naming the test-branch pull request until it merges, then passes` | pass |
| AC-5 | `test-branch-never-in-task-branch` | `delivery-models AC-5: the hook refuses bringing the test branch into the task branch` | pass |
| AC-5 | `test-branch-never-in-task-branch` | `delivery-models AC-5: the check fails a base pull request that holds a test-branch commit, naming it` | pass |
| AC-6 | `conflict-on-support-branch` | `delivery-models AC-6: a conflict goes to the support branch, the pull request moves, the task branch and the base pull request stay` | pass |
| AC-7 | `conflict-resolution-reviewed` | `delivery-models AC-7: the resolution is reviewed on its own before the support branch is pushed; a blocking finding holds it` | pass |
| AC-8 | `fix-reaches-both` | `delivery-models AC-8: a fix on the task branch reaches both pull requests, without a support branch` | pass |
| AC-8 | `fix-reaches-both` | `delivery-models AC-8: a fix on the task branch reaches both pull requests, with a support branch` | pass |
| AC-9 | `archive-to-both` | `delivery-models AC-9 delivered: a merged test-branch pull request alone does not deliver the change` | pass |
| AC-9 | `archive-to-both` | `delivery-models AC-9 archive: both archive pull requests open are ready, named together, and nothing is merged` | pass |
| AC-9 | `archive-to-both` | `delivery-models AC-9 archive: both merged is archived` | pass |
| AC-10 | `proof-in-tests` | `delivery-models docs: the documents follow` | pass |
