<!-- devkit-stage retro result=passed attempt=1 commit=4537ea896522e49042c5a888d10d4a4ebb65f416 -->
## Retro: jira-entry

1. Went wrong: the plan, the code, the evidence and the first review round were done in one pass, but delivery took four merges of main. Siblings (#68, #70, #72) landed while pull request #71 waited for its checks, each one taking the release numbers this change had chosen and conflicting in `change-loop.mjs`. Each merge cost about 1h30 (the guard suite, the evidence and a five-reviewer round). Three smaller frictions came with it: a review round run on a tree where only `evidence.md` was uncommitted stamped every verdict "(uncommitted changes)", which the delivery check treats as stale, so the evidence had to be committed and the round run again; after a fix that touched only the change folder (design.md D-6), `next` kept answering `fix-review`, because the rejected verdict still counted as current, and round 2 had to be run by hand; and gate 4.6 went red on a test in `roadmap-loop.test.mjs` that pins the devkit skill's `argument-hint` text, which the plan changed without naming that test.
2. Better next time: commit the evidence before a review round starts; let a fix inside the change folder count as an answer to the rejected review, so the loop moves to the re-review; and when a task edits a text that a test pins, name that test in the task.
3. Remember: in a roadmap run with siblings in flight, a change's release numbers and its merge with main are settled at the last moment and may need several passes.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Siblings merged during the checks of #71 forced four merges of main; each redid the suite, the evidence and the review | process-friction | followup (already the subject of `release-merge-conflict` and `delivery-train`; this change adds its numbers) | project |
| 2 | A review round on a tree dirty only in the change folder marks every verdict "(uncommitted changes)" and the delivery check treats it as stale | tooling | followup | project |
| 3 | After a fix inside the change folder, `next` keeps answering `fix-review` instead of the re-review | bug-class | followup | project |
| 4 | A task changed a text pinned by a test the plan did not name, and the gate went red | doc-gap | rule | project |
| 5 | The installed `change-loop.mjs` (0.21.1) refused the repository's newer `flow.json` after the merge (`appliesWhen`), so the worktree's own script ran the loop | tooling | followup | project |
| 6 | The open review nits: `writeBackAsk` against a recreated pull request, the Jira error on the shell line in the skill, the task-taken check outside the open lock, no test for the blocked half of the write-back condition, the `_` to `-` mapping the spec does not state | bug-class | followup | project |

## Proposed updates

### `openspec/roadmap.md` (followup)
A follow-up line for learnings 2, 3, 5 and 6, under round 20b, and the numbers of learning 1 on the lines that already own it.
- before: ## Round 20b: live proof of the Jira entry
+ after: ## Round 20c: follow-ups of the Jira entry
+ after: - [ ] jira-entry-followups (after: jira-entry) — from the jira-entry retro: a review round whose tree is dirty only inside the change folder records its verdicts as committed (the delivery check today treats "(uncommitted changes)" as stale, so the evidence had to be committed and the round run again); after a fix that touches only the change folder, `next` hands the re-review instead of `fix-review` again (round 2 of jira-entry was run by hand); the installed loop reads a `flow.json` newer than itself or says which release it needs (0.21.1 refused `appliesWhen`); and the review's open nits: `writeBackAsk` compares the pull request number as `nextAction` does, the skill passes a connector error through the quoted heredoc and not `--param error=`, the task-taken check runs inside the open lock, a test for the blocked half of the write-back condition, and the spec delta states the `_` to `-` mapping of the id prefix
+ after:
+ after: ## Round 20b: live proof of the Jira entry
- before: (end of the release-merge-conflict line) ... (merge-staleness-first-parent retro, item 1)
+ after: (end of the release-merge-conflict line) ... (merge-staleness-first-parent retro, item 1; jira-entry merged main four times, losing 0.27.0, 0.28.0 and 0.29.0 to #68, #70 and #72 while its checks ran)
- Answer: approved
- Applied: yes

### `openspec/config.yaml` (project-rule)
A tasks rule so the plan names every test that pins a text it changes.
- before:     - Every acceptance criterion id appears in at least one task
+ after:     - Every acceptance criterion id appears in at least one task
+ after:     - A task that changes a text a test pins (a skill's frontmatter, a reply, a doc sentence) names each test file that asserts the old text; grep the test files for it
- Answer: approved
- Applied: yes

### user memory (memory-only)
In a devkit roadmap run with siblings in flight, commit the evidence before a review round and re-fetch main right before each push: siblings landing during the checks force another merge and renumbering.
- Answer: approved
- Applied: yes
