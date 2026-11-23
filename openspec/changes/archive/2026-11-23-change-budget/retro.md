<!-- devkit-stage retro result=passed attempt=1 commit=c85f470d10a028327fe89705f6fb159208986689 -->
## Retro: change-budget

1. Went wrong: the release numbers collided three times. Sibling changes took devkit-openspec 0.22.1, 0.23.0 and 0.24.0 while this change was in delivery, so the branch merged `main` four times and ended at devkit-openspec 0.25.0 / marketplace 0.29.0. Each merge cost a full guard suite (13-21 minutes), a new evidence pass and a re-review. Separately, round 1 of the review recorded both verdicts as `Commit: <sha> (uncommitted changes)`, because `tasks.md` and `evidence.md` were still uncommitted; `deliver-check` read them as stale and the round had to be re-recorded. And after the first merge, the installed devkit-openspec 0.21.1 could not read `main`'s `flow.json` (`stage mockup has an unknown key appliesWhen`); the loop had to switch to the installed 0.22.0.
2. Better next time: commit the change folder before every review round, so the reviewers see a clean tree. Pick the release number only at the last merge of `main` before the push, and re-check `origin/main`'s numbers right before `enable-auto-merge`. When a merge brings a newer schema, run the loop from the installed pack that matches `main`.
3. Remember: in a parallel roadmap the release number is decided at push time, not at plan time.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Parallel changes in delivery race for the same release numbers; every lost race costs a full suite, an evidence pass and a re-review | process-friction | doc-update | project |
| 2 | A review round over a tree with only `openspec/` files uncommitted is recorded `(uncommitted changes)` and goes stale at once | tooling | doc-update | project |
| 3 | A loop from an older installed pack refuses a newer `flow.json` after a merge of `main`, with no hint to use the newer pack | tooling | followup | project |
| 4 | The live half of AC-1, AC-2 and AC-6 (a real run stopping at its cap) is still unproved | process-friction | followup | project |

Follow-ups (no file change here): item 3, the refusal of an unknown `flow.json` key could name the pack version that reads it; item 4 stays the dogfood bullet of this change's `## Workflow follow-up`.

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
Say when to settle the release number in a parallel roadmap, so a change does not pay a full suite and a re-review per lost race.
- before: 5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to `CHANGELOG.md`. Changes run in parallel: when you merge `main` before the merge of your pull request, take the next version after `main`'s and the next free ADR number in `main`'s `docs/adr/`, and renumber your ADR and every reference your change made to it when another change took its number first.
+ after: 5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to `CHANGELOG.md`. Changes run in parallel: when you merge `main` before the merge of your pull request, take the next version after `main`'s and the next free ADR number in `main`'s `docs/adr/`, and renumber your ADR and every reference your change made to it when another change took its number first. Fetch `main` again right before each push of the delivery and before `enable-auto-merge`: a sibling that merged in between took your number, and merging it then costs one suite and one re-review instead of a conflict found after the checks.
- Answer: approved
- Applied: yes

### `plugins/openspec/skills/ship-change/SKILL.md`, `docs/openspec-flow.md`, `plugins/openspec/hooks/change-loop.test.mjs` (tooling)
Commit the change folder before a review round, so the verdicts are not recorded against uncommitted changes and do not go stale at once.
The devkit-openspec patch release this edit needs moves the CI pin in `docs/openspec-flow.md` and its assertion in `plugins/openspec/hooks/change-loop.test.mjs` to the new version (added with the owner's approval: `Sim, inclua`).
- before: | `review` | Run the `review-change` skill on change <id> through the Workflow tool as it describes (its `agents` path on a turn the owner did not type), scoped: ...
+ after: | `review` | Commit every modified or untracked file under the change folder first (`tasks.md` ticks, `evidence.md`), so the round runs on a clean tree; then run the `review-change` skill on change <id> through the Workflow tool as it describes (its `agents` path on a turn the owner did not type), scoped: ...
- Answer: approved
- Applied: yes

### user memory (memory-only)
In a parallel devkit roadmap, re-check origin/main's release numbers right before each push and before enabling auto-merge.
- Answer: approved
- Applied: yes
