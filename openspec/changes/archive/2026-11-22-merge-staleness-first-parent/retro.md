<!-- devkit-stage retro result=passed attempt=1 commit=12e64f51772b2e259ff1d6a0d541503a7cf08c96 -->
## Retro: merge-staleness-first-parent

1. Went wrong: while PR #51 waited, PR #47 merged and released devkit-openspec 0.19.0, so the PR conflicted with main in the five release files (both manifests, `CHANGELOG.md`, the CI pin in `docs/openspec-flow.md`, the pin assertion in `change-loop.test.mjs`). The loop ended the run blocked ("the pull request has a problem") instead of handing its release-conflict step, and that step's tool, `release-rebase.mjs`, rebases and force-pushes, which the desktop Auto-fix that woke the session forbids. The session merged `origin/main` by hand and renumbered the release to 0.19.1 (0.23.1); the merge brought product code, so evidence and both reviews went stale (correctly, by this change's own AC-2 rule) and cost a second whole-suite evidence run (about 27 minutes) and a stale-only review. Pushing the new evidence before the new review files also left `devkit-reviews` red on that intermediate head. The plan's literal command in `requirements.md` (`git diff --name-only`) would have read a move out of product code as current; the planner caught it (`git diff` detects renames) and used `git diff-tree`.
2. Better next time: give the delivery loop a step for release-file conflicts that merges the base (never a rebase) and renumbers the release above the base's, so a merge-mode pull request behind another release goes on alone. After a stale-only re-review, push the new evidence together with the new review files. In the grill, state a command assumption by its effect and leave the literal command to the planner.
3. Remember: two releases in flight meet at the merge of the base; renumber above the base's version and expect evidence and reviews to go stale.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Release-file conflicts with main end the run blocked; the release tool rebases and force-pushes, which Auto-fix forbids | tooling | followup | project |
| 2 | An evidence-only push before the stale-only re-review's files leaves `devkit-reviews` red until the reviews land | process-friction | memory-only | user |
| 3 | A literal command written in the grill (`git diff`) carried a rename-detection trap the owner never chose | process-friction | memory-only | user |
| 4 | Seen again, already carried by round 25 (`review-writer-prompt`): `review-round.mjs outcomes` gives no writer prompt; the session built it from `writerPrompt` | tooling | followup | project |
| 5 | AC-5 `update-branch-dogfood` is owed: this change's own update brought product code, so it could not dogfood the openspec-only case; the next pull request behind an openspec-only main proves it with 0.19.1 installed | tooling | followup | project |

Release follow-up done: tag `v0.19.1` on the merge commit 9258599 of PR #51, pushed (`CONTRIBUTING.md`). The plan files (design D-5, tasks 2.1) still name 0.18.2; `evidence.md` records the renumbering.

## Proposed updates

### `openspec/roadmap.md` (tooling)
Add a follow-up line for release-file conflicts met at the merge of the base.
- before: (no line for it)
+ after: - [ ] release-merge-conflict — when a change's pull request conflicts with its base only in release files (the two manifests, `CHANGELOG.md`, the CI pin and its pin assertion), the delivery loop hands a declared step that merges `origin/<base>` (never a rebase or force-push, which the desktop Auto-fix forbids) and renumbers the release above the base's, in place of ending the run blocked with a pull-request problem; and `release-rebase.mjs` gains that merge mode or the loop's release step stops naming it (merge-staleness-first-parent retro, item 1)
- Answer: approved
- Applied: yes

### user memory (memory-only)
After a stale-only re-review, commit the new evidence first but push it together with the new review files, so the reviews check never runs on a head with stale reviews.
- Answer: approved
- Applied: yes

### user memory (memory-only)
In a grill, write a command assumption as its effect ("files the merge brought into the branch"), never as a literal command line the owner did not choose.
- Answer: approved
- Applied: yes
