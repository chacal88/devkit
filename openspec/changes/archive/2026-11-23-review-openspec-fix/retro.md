<!-- devkit-stage retro result=passed attempt=1 commit=15aa86cc1da589078d9ff671a6d5d1a3250b320e -->

## Retro: review-openspec-fix

1. Went wrong: the change itself went cleanly. The plan was approved, the code went red then green, both reviewers approved in round 1 with nits only, and no finding needed a fix. Delivery took most of a day anyway, because six sibling changes landed on `main` while PR #67 was between its merge with `main` and its own merge: stage-roles, test-fixture-cleanup, commit-attribution, change-state, change-budget and jira-entry. Each one took the release numbers this change had just picked, conflicted on the release files, and made the evidence and both reviews stale. Each lap cost about an hour on this worker: a merge, the ~25-minute guard suite in the evidence, and a scoped review round. Smaller frictions:
   - The installed devkit-openspec 0.21.1 could not read `main`'s newer `flow.json` (`unknown key appliesWhen`), so the session switched to the worktree's own `change-loop.mjs`.
   - A merge brought in only 6 lines of test change from `main`, and those alone made both reviews stale.
   - A reviewer marked `uncommitted: true` because of the untracked `evidence.md`, which would have written a stale `Commit:` line.
   - One commit came out with the subagent's own model in its `Co-Authored-By` trailer.
   - Releases 0.25.0 and 0.26.0 were never tagged, although CONTRIBUTING asks for a tag on every devkit-openspec release.
2. Better next time:
   - When several sessions deliver at once, `main` should take one release at a time. A change that is green and approved should get a short merge window, during which siblings hold their own merge.
   - Release numbers could be assigned at merge time instead of in the branch, but that is a design change.
   - Separately, the review stage could treat a merge commit whose only non-release, non-`openspec/` content comes from `main` the way it treats an `openspec/`-only commit.
3. Remember: on a busy `main`, a green change can loop forever on release collisions; ask the coordinator to hold sibling merges before the second lap, not the sixth.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Parallel changes all bump the same release numbers, so each landing on `main` forces every open PR into another merge, evidence and review lap (six laps here) | process-friction | doc-update | project |
| 2 | Each lap costs ~1 hour on the Linux worker, dominated by the guard suite running twice (resolver and verifier); running only the touched suites while resolving saved ~25 minutes per lap | process-friction | doc-update | project |
| 3 | An installed devkit-openspec older than `main`'s `flow.json` refuses to run the loop; the worktree's own hooks work | tooling | followup | project |
| 4 | devkit-openspec releases 0.25.0 and 0.26.0 were merged without their `v<version>` tag; nothing in the loop tags a release | tooling | followup | project |
| 5 | A reviewer may set `uncommitted: true` because of an untracked record file under `openspec/`, which writes `(uncommitted changes)` into the `Commit:` line and makes the verdict stale at once | tooling | followup | project |
| 6 | Telling a commit agent the exact co-author trailer does not always win over its own default | tooling | memory-only | project |

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
Add a merge-window rule to step 5, so a green change does not loop on release collisions while siblings keep landing.
- before: 5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to `CHANGELOG.md`. Changes run in parallel: when you merge `main` before the merge of your pull request, take the next version after `main`'s and the next free ADR number in `main`'s `docs/adr/`, and renumber your ADR and every reference your change made to it when another change took its number first.
+ after: 5. Bump the `version` of every pack you changed, in its `plugin.json` and in `marketplace.json`, and add a line to `CHANGELOG.md`. Changes run in parallel: when you merge `main` before the merge of your pull request, take the next version after `main`'s and the next free ADR number in `main`'s `docs/adr/`, and renumber your ADR and every reference your change made to it when another change took its number first. When a change has had to redo its release against `main` twice, its session asks the coordinator for a merge window: sibling changes hold their own merge (and auto-merge) until that pull request lands, so it does not loop on release collisions.
- Answer: approved
- Applied: yes

### `docs/openspec-flow.md` (process-friction)
Note in the delivery loop that resolving a release collision runs only the suites of the touched files, because the evidence stage runs the whole guard suite right after.
- before: (no rule on which suites a release-collision merge runs)
+ after: A merge of `main` that only resolves release-file collisions runs `check.py`, `gen-catalog.py --check`, `claude plugin validate .` and the suites of the conflicted test files; the whole guard suite runs once, in the evidence stage that follows.
- Answer: approved
- Applied: yes

### `CLAUDE.md` (memory-only)
Add one line under Working rules: when the installed devkit-openspec is older than `main`'s `flow.json` (`unknown key ...`), drive the change with the worktree's own `plugins/openspec/hooks/change-loop.mjs`.
- before: - Before changing a test, name its invariant, the layer that owns it and the suite it lives in.
+ after: - Before changing a test, name its invariant, the layer that owns it and the suite it lives in.
+ after: - When the installed devkit-openspec cannot read `main`'s `flow.json` (`unknown key ...`), drive the change with the worktree's own `plugins/openspec/hooks/change-loop.mjs` until the plugin is updated.
- Answer: approved
- Applied: yes
