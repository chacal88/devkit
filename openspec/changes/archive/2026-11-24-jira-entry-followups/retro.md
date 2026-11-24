<!-- devkit-stage retro result=passed attempt=1 commit=e63ffcbb9eae78f3d5268b64c0069240750c1ed4 -->
## Retro: jira-entry-followups

1. Went wrong: the change merged `origin/main` five times before it landed (d1cdbad, b36f820, f40445e, 68353a5, 3883289), and train 7 left it behind once more because its head no longer joined `main`. Two siblings in flight, `stale-only-on-own-files` and `loop-place-and-evidence`, edited the same functions of `plugins/openspec/hooks/deliver-check.mjs` (`readReviews`, `nextStep`) and the same rows of the `ship-change` skill. Each merge cost a conflict resolution, a release renumber with the CI pin, an evidence run and a review re-check. The requirements' overlap check had seen the shared file and settled it with "whichever merges second merges main", which priced none of this. One merge, f40445e, joined this change's rule (an approved verdict with an undisposed finding goes stale as a rejected one does) with the own-files exemption `main` brought, as the guard `own: approved(verdict) && !open`. No test pinned that guard, and review round 1 rejected on it (F1, fixed in 3f6f865 with four tests). Smaller slips: a merge left the spec delta's MODIFIED requirement without `main`'s new sentence and scenario, which `openspec validate` caught; a test on `main` pinned the old text of the `ship-change` commit row and went red at the merge; the first answer of `test-coverage-reviewer` listed unread paths and was run again.
2. Better next time: a merge resolution that joins a rule from each side into one condition is new behaviour, so it gets a test per side of that condition before the review sees it. When the overlap check finds a sibling in flight on the same function, the change asks the coordinator for an order (start after the sibling lands, or board both on one train) before the plan is approved.
3. Remember: a sibling in flight on the same function costs one full merge cycle per train; order the two changes, do not race them.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A merge resolution that joins a guard from each side into one condition was shipped to review with no test of the joined guard | bug-class | rule | project |
| 2 | Two changes in flight on the same function paid five merges of `main`, each with an evidence run and a review re-check | process-friction | memory-only | user |

## Proposed updates

### `CLAUDE.md` (project-rule)
A working rule for a merge of the base that joins two rules into one condition (learning 1), next to the rule on a merge that supersedes a plan decision.
- before: - When a merge of the base supersedes a decision the plan states (a moved file, a renamed helper), the same commit edits `proposal.md` and `tasks.md`: the review reads those files as claims about the code.
+ after: - When a merge of the base supersedes a decision the plan states (a moved file, a renamed helper), the same commit edits `proposal.md` and `tasks.md`: the review reads those files as claims about the code.
+ after: - When a merge of the base joins a rule of the branch and a rule of the base into one condition (a guard one side adds to a rule the other brought), a test for each side of that condition lands before the next review round: the review reads the joined condition as new behaviour.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When the overlap check finds a sibling in flight on the same function, ask the coordinator before plan approval to order the two (start after it lands, or board both on one train): racing them cost jira-entry-followups five merges of `main`, each with an evidence run and a review re-check.
- Answer: approved
- Applied: yes
