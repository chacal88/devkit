<!-- devkit-stage retro result=passed attempt=1 commit=fdd36346a39c139c8744eab3e2600e15b7f967e1 -->
## Retro: coordinator-field-fixes

1. Went wrong:
   - The review stopped at its limit of two rounds on a conflict between two reviewers. Round 1 asked for a behaviour the plan did not have (a new change that reuses an archived id stays listed); the fix added it to the code and its test, and nobody added it to the spec delta, so round 2 rejected the fix as a behaviour the specification forbids. The owner had to decide, the plan went back through the readiness review and the owner's approval, and a third review call ran.
   - The script has no step for what the owner decided. After the limit, `change-loop.mjs next` answers `blocked` until someone sets the header of `review.md` by hand; `review-round.mjs` accepts only rounds 1 and 2, so the third call ran labelled as round 2; and a plan file revised after the implementation started makes no stage stale, so the readiness review and the approval were re-run by the session's own reading, not by the script's.
   - In round 1 three reviewers answered stage 1 with a placeholder commit (the short sha padded with zeros) and one answered without opening the baseline specs. Each was sent back by hand.
   - The first readiness review returned the plan: four outcomes of the design had no scenario in a spec delta.
   - Three existing tests outside the list the design named had to change, because they pinned rules this change replaces; the plan had not found them.
   - The test of the reused id was written in the review fix, after the red runs were recorded, so `proof/` holds no failing run of it on 0.16.0.
   - The eighth question of the grill got no answer (the owner's next message corrected an earlier answer), and the change went on with today's behaviour recorded as an assumption.
2. Better next time:
   - A fix asked by a review that adds or changes a behaviour is checked against the spec delta before the next round; when the delta does not state it, the plan is revised and approved first.
   - A stage-1 answer is checked for the commit of HEAD before the verify stage, by the script and not by the session.
   - The planner searches the existing tests for every rule the plan replaces, not only the suites of the files it edits.
3. Remember: a review fix that adds a behaviour is a plan change until the specification states it.

What this run showed about the points carried on the round 16 line (requirements A-17): the unlimited wait on GitHub worked in real use (the background wait ended when the checks turned green, the next step turned auto-merge on and GitHub merged, with no message from the owner); a decision outside the script's gates happened again (the review deadlock) and again had no declared step. The other points were not exercised.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A review fix added a behaviour the spec delta did not state, and the next round rejected it | process-friction | rule | project |
| 2 | After the review limit the loop has no step for a round the owner authorizes, and the round script refuses a third round | tooling | followup | project |
| 3 | A plan file revised after the implementation started makes no stage stale | bug-class | followup | project |
| 4 | Stage-1 answers carried a placeholder commit and nothing checked it against HEAD | tooling | followup | project |
| 5 | The flow document's sentence on archived changes does not mention the reused id | doc-gap | doc-update | project |
| 6 | Open nits of the review: the delta words the archive sources as a fallback chain while the code takes their union; exit 1 of `github-setup` for a blocked state is only in the design; no test for an unreadable `.openspec.yaml`; no red run of the reused-id test | doc-gap | followup | project |
| 7 | Existing tests that pin a replaced rule were not found by the plan | process-friction | memory-only | user |
| 8 | The release tags (`v0.17.0` on the merge commit of the change; `v0.17.1`, the version the retro's skill edit made, on the merge commit of the archive) and the re-install in the three projects are left for after this change | process-friction | followup | project |
| 9 | Found at the archive, after the proposals above were answered: a test of this change pinned the roadmap line of round 17b as unticked, a state the archive changes, and a docs test pinned the literal release tag; the whole suite on the archive branch failed 4 of 985 until both followed | bug-class | regression-gate | project |

## Proposed updates

### `plugins/openspec/skills/ship-change/SKILL.md` (process-friction)
The row of the fix steps says what to do when a review asks for a behaviour the plan does not have, so the next round does not reject the fix against the specification.
- before: `Then `commit` (or `push` once a PR exists). |` (the end of the row `fix-review`, `fix-defect`, `fix-checks`)
+ after: `Then `commit` (or `push` once a PR exists). When a finding asks for a behaviour the change's spec deltas do not state, the plan is revised first: `devkit-core:change-planner` adds it to the delta and the design, the readiness review runs again and the owner approves the revised plan; only then the fix and the next round. |`
- Answer: approved
- Applied: yes

### `docs/openspec-flow.md` (doc-gap)
The sentence on archived changes gains the exception this change added.
- before: `A change whose archived folder is already on the default branch is not listed as unfinished, whatever checkout still holds its branch.`
+ after: `A change whose archived folder is already on the default branch is not listed as unfinished, whatever checkout still holds its branch; a new change that reuses the id, created on a later day than the archive, is listed.`
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (tooling)
Carries what this change found into the rounds that will build it: the loop's findings to the round 16 line, the review script's finding to the round 25 line.
- before: `and whether the short script gains the owner's plan approval.` (the end of the stage-roles line of round 16)
+ after: `and whether the short script gains the owner's plan approval. Carried from the coordinator-field-fixes retro: a declared step for a review round the owner authorizes after the limit (the round script accepts a third round and the loop leaves `blocked` without a header set by hand); a plan file revised after the implementation started makes the readiness review and the approval stale; and the review's open nits of that change (the archive sources worded as a fallback chain in the change-coordination spec while the code takes their union, exit 1 of `github-setup` for a blocked state stated in a scenario, a test for an unreadable `.openspec.yaml`).`
- before: `is sent back before the verify stage` (the end of the review-writer-prompt line of round 25)
+ after: `is sent back before the verify stage; and one finding of the coordinator-field-fixes retro: a stage-1 answer whose commit is not the full sha of HEAD is refused by the script before the verify stage`
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a review asks for a behaviour the plan does not have, check the spec delta before the next round: if it does not state the behaviour, revise the plan and get the owner's approval first.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Before a plan is approved, search the existing tests for every rule the plan replaces, whatever suite they live in, and list them in the design.
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/guard.test.mjs`, `plugins/openspec/hooks/change-loop.test.mjs` (bug-class)
Added at the archive on 2026-11-21, after the whole hook suite on the archive branch failed 4 of 985: the roadmap test of this change pinned the round 17b line as unticked, which the archive's tick breaks, and a docs test pinned the literal release tag, which the version bump of the first proposal moves (the CI snippet of `docs/openspec-flow.md` follows the pack version, as three other tests require). The owner was shown both failures and what would change, and answered in their own message that both be fixed.
- before: `assert.equal(item.done, false);` (in the test "field-fixes 12 roadmap: the round 17b line is read before round 18"); `/v0\.17\.0/` (in the test "change-loop docs: the design records the answers")
+ after: `the assertion on the ticked state is removed: the test keeps round 17b between rounds 17 and 18 and the change on its line after change-coordinator`; `/v0\.17\.1/`
- Answer: approved
- Applied: yes
