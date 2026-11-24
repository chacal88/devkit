<!-- devkit-stage retro result=passed attempt=1 commit=5acc74b573cbb6b2ba40b93a1bb28347329f9053 -->
## Retro: stale-only-on-own-files

1. Went wrong: the rule this change ships judges paths, not content, and it bit the change twice before it merged. The pull request had to be updated from `main` (the ruleset requires an up-to-date branch), and each time `main` carried a commit that touched `CONTRIBUTING.md` or `docs/openspec-flow.md`, files the change also edits. The first time it was the merge commit of the stack this branch already contained (nothing new in content); the second time three archive commits whose edits were unrelated text. Both times the evidence and both reviews went stale and the whole cycle ran again (one suite, the evidence, one scoped review), and the owner's coordinating session had to hold every other merge to `main` until this one landed. Smaller slips: round 1 of the review caught that the delivery train's `judgeBoarded` had no base, so the train judged a boarded change by the old rule; the plan's gates 1.5, 2.5 and 3.8 still name `node --test plugins/openspec/hooks/guard.test.mjs`, which after suite-speed (PR 98) matches only its own tests, so they pass without covering the change; and when the coordinator held the pull request, the loop's stop hook demanded `open-pr` and the only fitting `blocked-why` code was `no-place`, so the stop read as a wait for a machine.
2. Better next time: a change that edits shared docs asks the coordinator to hold `main` before its last push, as soon as it knows the ruleset will require an update-branch. A follow-up change makes the own-files rule content-aware: a merge counts as touching an own file only when the merged result of that path differs from the branch's own version, so a base that re-brings text already on the branch, or edits another part of a shared document, no longer stales. A plan names its gates through the project's current suite command (`node scripts/test-suite.mjs`), never through a file that another change may turn into a small one. The loop gets a stop reason for "held by the coordinator".
3. Remember: a rule that stales on paths makes every shared document a restart; hold `main` before the final push.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The own-files rule judges paths: a base merge that adds nothing of its own to a shared document still stales the records | tooling | followup | project |
| 2 | The loop has no stop reason for a wait on the coordinator, so a hold is reported as `no-place` | tooling | followup | project |
| 3 | A change that edits shared docs asks for a hold on `main` before its last push | process-friction | memory-only | user |

## Proposed updates

### `openspec/roadmap.md` (followup)
A roadmap line for the follow-up that makes the own-files rule content-aware (learning 1), in the round of the staleness rule.
- before: the round of the staleness rule ends with `stale-only-on-own-files`.
+ after: the round gains `own-files-by-content`: a base merge stales the records only when the merged text of an own path differs from the branch's, so an archive or a stack merge that adds nothing of its own to a shared document no longer restarts the suite, the evidence and the review.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
A roadmap line for a stop reason for a hold by the coordinator (learning 2).
- before: the loop's `blocked-why` codes name a machine, a place or a limit; a hold on a merge order has none, so the run ends as `no-place`.
+ after: the round gains `blocked-why-held`: a `held` code, with its text in both languages, for a run that waits on the coordinator's word before opening or merging its pull request, so the stop hook and the readout say what the run waits for.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a change edits shared docs and the repository requires an up-to-date branch, ask the coordinator to hold `main` before the last push: every `main` commit that touches one of those files costs one suite, one evidence run and one review.
- Answer: approved
- Applied: yes
