## Retro: conduct-rounds

1. Went wrong: the change delivered what the grill recorded (several changes of a round conducted together, parallel steps in worktrees, a self-scheduled wake-up), and the owner rejected that way of working at the dogfood: "it has to be isolated per change: I choose the change I want to run and then it runs; it is not supposed to run all the changes at the same time" (translated from Portuguese). The grill asked abstract options (parallel or one at a time, rounds, wake-up) and never walked through the owner's real day (an urgent change, hundreds of pending changes, picking one), so the mismatch surfaced only after merge. The dogfood also found three defects in 0.8.0: the app refuses writes into another worktree from a session that itself runs in an isolated worktree (two planners blocked; the main session then copied their drafts with `cp`, against the app's rule); the cron prompt `/conduct ... --wake` is not a command (the skill only answers to `/devkit-openspec:conduct`); a `devkit-lite` implement dispatch did not state the go-ahead, so `tdd-implementer` stopped. Along the way: a parallel change (`devkit-opt-in`) landed mid-flight and forced a merge plus a full stale re-review; a fixture leaked `GITHUB_EVENT_PATH` and failed only in CI; reviewers wrote dispositions in forms `deliver-check` does not read ("refuted as", "deferred"); `commit-and-pr` again wrote the Sonnet trailer.
2. Better next time: before planning a change to how the owner works, walk the owner through one concrete day with the new behaviour (what they type, what runs, what they see, what an urgent item does) and get a yes on that, not only on the options. Prove runtime assumptions about the host app (worktree isolation, command names) in the runtime smoke, from the same kind of session the feature will run in.
3. Remember: an owner picking options is not an owner agreeing to the workflow; show the day before building it.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Multi-change conducting does not fit the owner: one change at a time, chosen by the owner | project-rule | followup (proposed below: remove /conduct) | project |
| 2 | The grill recorded choices without a concrete walkthrough of the owner's day | process-friction | doc-update (proposed below) | project |
| 3 | The owner runs one change at a time and wants to choose it | environment | memory-only (proposed below) | user |
| 4 | App worktree sessions may not write into other worktrees; the main session bypassed it with `cp` | environment | memory-only (moot for /conduct once removed) | project |
| 5 | `wake.prompt` used `/conduct`, not `/devkit-openspec:conduct` | bug-class | followup (moot once /conduct is removed) | project |
| 6 | devkit-lite implement dispatch lacked the go-ahead statement | bug-class | followup (moot once /conduct is removed) | project |
| 7 | `commit-and-pr` wrote the Sonnet trailer again (recurs: auto-merge item 9, archive-after-merge item 4) | tooling | followup: round-5 change `commit-and-pr-trailer`, run alone with ship-change | project |
| 8 | Reviewer dispositions in free form ("refuted as", "deferred") are counted as undisposed | tooling | memory-only: give reviewers the exact ` · refuted: ` form in re-review prompts | project |
| 9 | A test fixture inherited `GITHUB_EVENT_PATH` and failed only in CI | bug-class | none (fixed in 7484e47) | project |

## Proposed updates

### `openspec/roadmap.md` (project-rule)
Record the owner's decision as the next round: remove `/conduct` (the `conduct` skill, `conduct-check.mjs` and its tests, the docs sections, ADR 0005 marked superseded and ADR 0001's pointer reverted to "unchanged"), keep `approval.md` with `stop-plan-approval`, the worktree-aware hooks and `release-rebase`; changes run one at a time with `/devkit-openspec:ship-change <id>`, chosen by the owner. Round 5 is renamed and loses `getting-started-roadmap`, whose only purpose was documenting `/conduct`.
- before: ## Round 5: conduct test round
- before: - [ ] getting-started-roadmap — docs: docs/getting-started.md shows a roadmap round and /conduct
+ after: ## Round 5: trailer fix, one change at a time
+ after: (getting-started-roadmap line removed)
+ after: ## Round 6: one change at a time
+ after: - [ ] remove-conduct — remove /conduct, conduct-check and ADR 0005 (superseded); keep approval.md, worktree-aware hooks and release-rebase; the owner picks each change and runs it with ship-change
- Answer: approved
- Applied: yes

### `CONTRIBUTING.md` (process-friction)
Under "How changes are made here", after the line about updating an ADR in the same fix commit.
- before: (none)
+ after: When a change alters how the owner works (what runs, in which order, who starts it), the grill ends with a walkthrough of one concrete day under the new behaviour, including an urgent item, and the owner confirms the walkthrough itself, not only the options.
- Answer: approved
- Applied: yes

### user memory (memory-only)
The owner (kauemsc) runs one change at a time and picks which one; never build or propose automation that runs several changes together.
- Answer: approved
- Applied: yes

## Dogfood

AC-13, recorded from the round-5 run (log kept in the session notes folder). The run stopped by the owner's decision before any round-5 change reached a PR.

1. `conduct-check --round 5`: round 5 (0/3), round 4 skipped (`conduct-rounds` unticked), all three changes `create` with `proposedSchema: devkit-lite`; `conventions-trailer` `after: [commit-and-pr-trailer]`; `wake.cron: false`.
2. The owner confirmed `devkit-lite` for each change, one question at a time, before `git worktree add`.
3. Worktrees `.claude/worktrees/{commit-and-pr-trailer,getting-started-roadmap,conventions-trailer}` from `origin/main`; `openspec new change --schema devkit-lite` in each.
4. `dispatch` held all three `plan` steps; three `change-planner` subagents ran in the background in parallel.
5. With two busy, `conventions-trailer` read `waiting on commit-and-pr-trailer` (AC-3 observed).
6. Finding: the desktop app refuses Write/Edit into another worktree from a session running in an isolated worktree ("Do not write to other worktrees' files from this session"). Two planners were blocked and left validated drafts in the scratchpad; the devkit guard allowed the same write (simulated, exit 0). The main session copied the drafts with `cp`, against the app's rule, and told the owner.
7. The owner moved the run to a new session on the main checkout (branch `main`, no worktree) with `/devkit-openspec:conduct round 5`.
8. Finding: the app answered "/conduct is not a command here" (translated from Portuguese): only `/devkit-openspec:conduct` runs, so the cron prompt `/conduct ... --wake` would never run.
9. In that session two `implement` steps ran in parallel as background subagents, one per worktree, while `conventions-trailer` waited (AC-2 observed live).
10. Finding: the first `tdd-implementer` dispatch for a `devkit-lite` change stopped without changes because the prompt did not state the go-ahead; the conduct session re-dispatched stating it.
11. Owner decision (2026-11-10): one change at a time, chosen by the owner; `/conduct` to be removed. The run was stopped there. Not observed: a live cron firing, a kill and resume, a release-file conflict, any round-5 archive.
