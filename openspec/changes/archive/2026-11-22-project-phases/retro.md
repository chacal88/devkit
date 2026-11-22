<!-- devkit-stage retro result=passed attempt=1 commit=a3bd8b8ef52a0616f7ac61628c8c27c3ce596989 -->
## Retro: project-phases

1. Went wrong: four siblings merged while this change ran, and one of them took ADR 0014, so the pull request was in conflict and this change's ADR had to become ADR 0015 at the merge; the plan documents still say 0014 in places. The first readiness round missed a test that pins the CI release (the planner searched only version strings). One implementer ran `pkill -f` by pattern on a machine where other sessions run tests. In the review round, one reviewer returned finding ids that were not `F<n>` and a placeholder commit sha, so the round's script refused its stage-1 object until the ids were renumbered by hand.
2. Better next time: before the release work of a change, check `origin/main`'s `docs/adr/` and the pack versions, and take the next free ADR number at the merge, not at planning; say in the reviewer prompt that ids are `F1, F2, ...` and the commit is `git rev-parse HEAD`; say in the implementer's rules that processes are never killed by pattern.
3. Remember: a change that writes an ADR checks the next free number on `origin/main` when it merges main, not only when it plans.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Parallel changes collide on the ADR number and the versions; the later merge renumbers | process-friction | doc-update | project |
| 2 | A reviewer's stage-1 ids outside `F<n>` and a placeholder sha fail the round's validation | tooling | doc-update | project |
| 3 | An implementer killed processes by pattern on a shared machine | process-friction | doc-update | project |
| 4 | Open nits: four untested fail-closed branches of `sliceProblems`, `sliceReviewStale` on merges, and the plan's ADR 0014 mentions | bug-class | followup | project |
| 5 | Dogfood: the first real slice (the phases' conversations, the real GitHub auto-merge) | process-friction | followup | project |

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
An ADR number is taken when a change merges main, not when it plans: changes run in parallel.
- before: 5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to `CHANGELOG.md` (a link in the file).
+ after: 5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to `CHANGELOG.md` (a link in the file). Changes run in parallel: when you merge `main` before the merge of your pull request, take the next version after `main`'s and the next free ADR number in `main`'s `docs/adr/`, and renumber your ADR and every reference your change made to it when another change took its number first.
- Answer: approved
- Applied: yes

### `plugins/core/skills/review-change/scripts/review-round.workflow.js` (tooling)
The reviewer prompt names the id format and the commit command, so a stage-1 object is not refused for ids or a placeholder sha.
- before: + 'findings: [ { id: "F1", severity: "blocking|important|nit|praise", ...
+ after: + 'findings: [ { id: "F1", severity: "blocking|important|nit|praise", ... (ids are F1, F2, ... in order, one per finding, praise included; commit is the output of git rev-parse HEAD, never a short or padded sha)
- Answer: approved
- Applied: yes

### `plugins/core/agents/tdd-implementer.md` (process-friction)
Other sessions run tests on the same machine.
- before: 3. **You're on the change's branch or worktree**, never the default branch.
+ after: 3. **You're on the change's branch or worktree**, never the default branch. Never stop a process by pattern (`pkill -f`, `killall`): other sessions run their tests on the same machine; stop only a process you started, by its id.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
A follow-up line for the open review nits and the dogfood of the first real slice.
- before: ## Round 20: the Jira entry
+ after: ## Round 19b: follow-ups of the project flow
+ after: - [ ] project-phases-followups (after: project-phases) — tests for the fail-closed branches of `sliceProblems` (a Commit that does not resolve, a missing or malformed record header, no base ref, the verdict's uncommitted marker), `sliceReviewStale` judging a merge by its first parent, the plan's ADR 0014 mentions, and the dogfood of the first real slice in one of the owner's projects (the phases' conversations, the real GitHub auto-merge)
+ after:
+ after: ## Round 20: the Jira entry
- Answer: approved
- Applied: yes

### user memory (memory-only)
A change that writes an ADR takes the next free number on origin/main when it merges main; parallel siblings may have taken it.
- Answer: approved
- Applied: yes
