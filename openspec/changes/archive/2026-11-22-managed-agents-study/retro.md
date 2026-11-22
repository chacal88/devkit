<!-- devkit-stage retro result=passed attempt=1 commit=074e86159720142f58ce7dc8baed59aa3eb6f607 -->
## Retro: managed-agents-study

1. Went wrong: round 1 of the review rejected the study, and the fix (fe49b25) touched only `openspec/`, so the rejected verdicts never went stale and the loop kept asking for the fix; the owner had to authorize round 2 by hand. While the PR waited, main shipped devkit-openspec 0.19.0 with the stage icons that line L-2 proposed, so the PR conflicted on `remote-worker` and the approved L-2 had to be reworded and approved again. The loop then ended blocked as "GitHub unreadable" because the installed `gh` 2.46.0 has no `gh pr checks --json`, without naming the version as the cause. The three commits made by the commit step carry "Co-Authored-By: Claude Sonnet 5.5", the commit agent's own model, while the session that did the work runs on Opus 5.5. The first `evidence.md` carried "(uncommitted changes)" although only `openspec/` files were uncommitted, which its own rule excludes, so it was stale on arrival.
2. Better next time: let an `openspec/`-only commit after a rejected review trigger the next round; name an old `gh` as the cause when GitHub cannot be read; carry the coordinator session's attribution lines into the commit step's brief; compare a study's devkit baseline with `origin/main` before putting its lines to the owner.
3. Remember: a study's baseline goes stale while its PR waits; re-read main before the owner approves lines.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A rejected review fixed by an `openspec/`-only commit never goes stale, so the loop asks for the fix forever and round 2 needs the owner's hand | tooling | followup | project |
| 2 | The commit step's co-author line names the commit agent's model (Sonnet), not the session's (Opus) | tooling | followup | project |
| 3 | `gh` older than `gh pr checks --json` ends the loop as "GitHub unreadable" with no hint at the version | tooling | followup | project |
| 4 | The study's baseline (2300f84, 0.18.1) was behind main (0.19.0) when the owner approved L-2; L-2 was reworded after approval | process-friction | memory-only | user |
| 5 | `pr-verifier` wrote "(uncommitted changes)" with only `openspec/` files dirty, against its own rule in `plugins/core/agents/pr-verifier.md`; a second dispatch fixed it | tooling | memory-only | user |
| 6 | Environment on the Avell: no git identity, `gh` 2.46.0 from the distribution, `/tmp` out of inodes; fixed with a global git identity and `gh` 2.105.0 in `~/.local/bin` | environment | memory-only | user |
| 7 | Seen again, already carried by round 25 (`review-writer-prompt`): `review-round.mjs outcomes` gives no writer prompt; the session built it from `writerPrompt` | tooling | followup | project |
| 8 | Seen again, already carried by `stage-roles`: owner-run tasks the implementer can only no-op, and the wait on GitHub against a host that forbids polling (Auto-fix could not be turned on from this session either, so the owner called `/devkit change` again) | process-friction | followup | project |

## Proposed updates

### `openspec/roadmap.md` (tooling)
Add a follow-up line for a review rejected and fixed only under `openspec/`.
- before: (no line for it)
+ after: ## Round 17f: a review fixed in the plan files
+ after: - [ ] review-openspec-fix (after: merge-staleness-first-parent) — a rejected review whose findings are fixed by a commit that touches only `openspec/` (a study, a plan, a roadmap line) gets its next round from the loop: `deliver-check` reads a rejected verdict as stale after any later commit, `openspec/` included, while an approved one keeps today's rule; a test rejects a review on a scratch branch, fixes it with an `openspec/`-only commit and expects the review step (managed-agents-study retro, item 1)
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (tooling)
Add a follow-up line for the commit step's attribution lines.
- before: (no line for it)
+ after: - [ ] commit-attribution — the delivery loop's brief to the commit step carries the coordinator session's attribution lines (the commit footer and the pull-request footer), and `plugins/core/agents/commit-and-pr.md` uses the brief's lines over its own environment's, so a commit made by the commit agent names the model of the session that did the work (managed-agents-study retro, item 2)
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (tooling)
Add a follow-up line for an old `gh`.
- before: (no line for it)
+ after: - [ ] gh-version-check — `deliver-check` tells an old `gh` (no `gh pr checks --json`) from an unreadable GitHub and says the installed version and the first one that works, and the setup step checks the `gh` version once (managed-agents-study retro, item 3)
- Answer: approved
- Applied: yes

### user memory (memory-only)
Before putting a study's or plan's roadmap lines to the owner, compare the baseline it read with `origin/main`; main may already ship what a line proposes.
- Answer: approved
- Applied: yes
