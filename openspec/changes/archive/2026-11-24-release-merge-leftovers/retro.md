<!-- devkit-stage retro result=passed attempt=1 commit=75e716ebb5debe2096b3c60a3af9a8154bd61a48 -->
# Retro: release-merge-leftovers

Change PR: https://github.com/chacal88/devkit/pull/105, merged at `a347ac0` with train 3 (PR 117), tagged `v0.39.2`.

## Retro: release-merge-leftovers

1. Went wrong:
   - The plan moved `TWO_PRS` and re-exported it from `delivery-models.test.mjs`. While the change waited, suite-speed (ADR 0026) put the constant in `test-fixtures.mjs`. The code followed main, but `proposal.md` and the ticked task 2.1 kept the old move. Only a note in `tasks.md` recorded it, so the review of the merged head rejected the round on that text (important, three verifiers confirmed it) and cost a second round.
   - The evidence and the review were redone three times (attempts 2 to 4) as main moved under the change: the merges brought in changes that edit `change-loop-compozy.test.mjs` and the release files, which are this change's own files, so the own-files rule (ADR 0025) could not keep them current.
   - The pin test in `change-loop-compozy.test.mjs` carries an invariant comment that gains a clause on every release. Each release conflicts there. That file is not a release file for `release-merge.mjs`, so train 1 left the change off, and the conflict was resolved by hand.
   - OpenSpec 2.0.0 refuses a MODIFIED block that drops a scenario and refuses a REMOVED and an ADDED block under one header. The first delta failed validation before the workaround was found (remove the requirement and add it again under a new header, the text unchanged).
   - The disk of the machine was nearly full (about 2.5 GiB free) during the last evidence run: two test runs failed once with `No space left on device` and passed on the repeat.
2. Better next time:
   - When a merge of the base supersedes a decision of the plan, edit `proposal.md` and `tasks.md` in the same commit as the merge, so no review reads stale plan text.
   - Keep the pin test's comment to the current and the previous pin, or let the release step renumber that line, so a release stops conflicting there.
   - Check the free disk before a long evidence run.
3. Remember: a plan text is a claim about the code; a merge that moves the code moves the claim.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A merge that supersedes a plan decision must update the plan text in the same commit | process-friction | rule | project |
| 2 | The pin test's growing comment makes every release conflict in a file the release step does not renumber | tooling | followup | project |
| 3 | OpenSpec refuses a MODIFIED block that drops a scenario; remove and re-add under a new header | doc-gap | memory-only | user |
| 4 | A nearly full disk fails test runs with ENOSPC, with no sign in the test's own message | environment | memory-only | user |

## Proposed updates

### `CLAUDE.md` (project-rule)
When a merge of the base supersedes a decision the plan states, the merge commit also edits `proposal.md` and `tasks.md`, so a review never reads plan text the code no longer follows.
- before: "- When a change alters what an agent writes, its real-run proof covers every case the plan declares (each input variant, and the conducting session's own part), not one case plus prose tests."
+ after: "- When a change alters what an agent writes, its real-run proof covers every case the plan declares (each input variant, and the conducting session's own part), not one case plus prose tests.\n- When a merge of the base supersedes a decision the plan states (a moved file, a renamed helper), the same commit edits `proposal.md` and `tasks.md`: the review reads those files as claims about the code."
- Answer: approved
- Applied: yes

### user memory (memory-only)
OpenSpec 2.0.0 refuses a MODIFIED block that drops a scenario, and a REMOVED and an ADDED block under one header: remove the requirement and add it again under a new header with the text unchanged, and say so in the proposal.
- Answer: approved
- Applied: yes

### user memory (memory-only)
Before a long test or evidence run, check `df -h /`: with about 2.5 GiB free a run fails once with `No space left on device` and passes on the repeat, and the message names no test.
- Answer: approved
- Applied: yes
