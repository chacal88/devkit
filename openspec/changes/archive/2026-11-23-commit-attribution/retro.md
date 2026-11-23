<!-- devkit-stage retro result=passed attempt=1 commit=45eccea92ab5e8eb3314d5b924603bbaeebb890e -->

## Retro: commit-attribution

1. Went wrong:
   - Round 1 of the review failed on coverage: the plan proved the agent live only for the commit trailer, so `none`, the PR footer and a real loop dispatch had no real-run proof until 16eee42.
   - The fix touched only `openspec/` files, so the loop kept the rejected verdict current and kept handing `fix-review`. It never scheduled round 2, and the session ran round 2 from the review skill's own rule.
   - Two verdicts went stale for bookkeeping, not code. Code quality recorded "uncommitted changes" because `evidence.md` was untracked during the round. Then the round-2 review files were themselves uncommitted, so each re-check needed a commit first.
   - Code quality's first stage-1 answer listed the three test files in `notRead`. The round refuses such an answer, so the reviewer had to be asked to answer again.
   - `main` moved twice during delivery: the stage-roles release (0.26.0, conflicts in `change-loop.mjs`, both skills and the release files), then the test-fixture release (0.26.1). The PR opened CONFLICTING, and the loop ended blocked ("pr-problem") instead of handing a resolve step. Two merges followed, each with a whole-suite run (1558, then 1568 tests) and a fresh evidence and review pass.
   - After the first merge, the installed loop (0.21.1) refused the change ("flow.json of devkit is malformed: stage mockup has an unknown key appliesWhen"). The session ran the worktree's `plugins/openspec/hooks/change-loop.mjs` from then on.
2. Better next time:
   - A fix whose only output is evidence under `openspec/` should lead to a re-review of the reviewer that rejected, not to the same fix again.
   - The review round should start on a committed tree: commit `evidence.md` before the round, and commit the round's own files right after it.
   - Check `git merge-tree` against a freshly fetched `origin/main` right before `open-pr`, and give content conflicts a declared resolve step in place of a blocked end.
3. Remember: in this repository, once a branch merges a `main` whose schema changed, drive the change with the worktree's own loop until the release is installed.

AC-4, checked again on every commit of the branch after the evidence, as D-9 asks: all nine commits the branch made itself carry only `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. That covers 4ae67c9, 52fb4fa, 16eee42, ac5797c, c5ac7df, the two merges 11989f7 and 39fc410, 8636145 and 45eccea, and the squash commit ac40615 on `main` carries the same line. The only Sonnet trailer in the merged range is main's own 08eea2b, the stage-roles archive, made under the old flow: the defect this change fixes. Dogfood: from the merged head on, the worktree's loop printed the attribution request at the end of the `push` brief, and the session appended its block as the request says.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A `fix-review` whose fix touches only `openspec/` keeps the rejected verdict current, so the loop repeats the fix and never re-reviews | bug-class | followup | project |
| 2 | A review verdict recorded while `evidence.md` or the round's own files are uncommitted goes stale at once and forces a bookkeeping re-run | process-friction | followup | project |
| 3 | A pull request that conflicts with `main` outside the release files ends the run blocked; the loop has no declared resolve step for content conflicts, and nothing checks `merge-tree` before `open-pr` | process-friction | followup | project |
| 4 | After a branch merges a `main` whose `flow.json` schema changed, the installed loop refuses the change; the worktree's loop works | tooling | doc-update | project |
| 5 | A plan that proves an agent live for one case leaves its other declared cases (none, footer, the session's own append) to prose tests; reviewers ask for real runs | doc-gap | memory-only | project |
| 6 | Open nits of this change: the project-loop T25 negative passes vacuously when `ATTRIBUTION_ASK` is missing; the roadmap scenario has no test of its own; T31 counts a literal phrase | bug-class | followup | project |

## Proposed updates

### `openspec/roadmap.md` (process-friction)
Carry learnings 1, 2, 3 and 6 onto the coordinator loop fixes round, at the end of its item.
- before: and the verifier allowed to write its runs' output under the change's `proof/` folder.
+ after: and the verifier allowed to write its runs' output under the change's `proof/` folder. Carried from the commit-attribution retro: a `fix-review` whose fix touches only `openspec/` leads to a re-review of the reviewer that rejected, not to the same fix again; the review round starts on a committed tree (`evidence.md` committed before it, the round's own files committed after it), so no verdict goes stale for bookkeeping; `open-pr` checks `git merge-tree` against a freshly fetched base, and a pull request that conflicts outside the release files gets a declared resolve step in place of a blocked end; and that change's open nits (the project-loop T25 negative that passes vacuously without the export, a test of its own for the roadmap scenario, T31's count of a literal phrase).
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (tooling)
Name the schema case next to the existing note on the installed pack.
- before: A session runs the pack installed at project scope, not the working tree: after a release merges, run `claude plugin update devkit-openspec@devkit` (and `devkit-core@devkit` when it changed) in the project before dogfooding the new version, or load the tree with `--plugin-dir` as above.
+ after: A session runs the pack installed at project scope, not the working tree: after a release merges, run `claude plugin update devkit-openspec@devkit` (and `devkit-core@devkit` when it changed) in the project before dogfooding the new version, or load the tree with `--plugin-dir` as above. When a change branch merges a `main` whose `flow.json` schema changed, the installed `change-loop.mjs` refuses the change as malformed: drive it with the worktree's `node plugins/openspec/hooks/change-loop.mjs` until that release is installed.
- Answer: approved
- Applied: yes

### `CLAUDE.md` (memory-only)
A project line for planning a change that alters what an agent writes.
+ after: When a change alters what an agent writes, its real-run proof covers every case the plan declares (each input variant, and the conducting session's own part), not one case plus prose tests.
- Answer: approved
- Applied: yes
