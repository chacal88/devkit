<!-- devkit-stage retro result=passed attempt=1 commit=21e08f555dfe924978f6946a5717b1030d06475f -->
## Retro: merge-setup-field-fixes

1. Went wrong: `gh pr update-branch` merged main into the branch (c292a5d), and main brought only `openspec/roadmap.md`. Yet `deliver-check` marked `evidence.md` and both reviews stale ("c292a5d touches .claude-plugin/marketplace.json"), because `staleness()` lists a merge commit's files against each parent (`git diff-tree -m`), so the branch's own files show up against the main parent. That cost a third whole-suite evidence run (about 17 minutes) and a review re-run, and `devkit-reviews` went red on PR #46 meanwhile. Review round 1 also failed on two guards that had no test (the `checksToWatch` archive and OPEN conditions, and the `unreadable` source label of `github-setup.mjs`); tasks.md named only the positive cases of the new predicate.
2. Better next time: judge a merge commit by its diff against its first parent (what the merge brought into the branch); the commits it brings in are already checked one by one in the same `rev-list`. When a plan adds a predicate or a labelled branch, its tasks name one test per guard condition and per label, the negative ones included.
3. Remember: a merge of main into a reviewed branch must not make the reviews stale when main brought only `openspec/` files.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | `staleness()` counts the branch's own files on a merge of main (`diff-tree -m`), so update-branch makes evidence and reviews stale | tooling | followup | project |
| 2 | A new predicate's plan lists only positive tests; the coverage reviewer found the untested guards | process-friction | memory-only | user |
| 3 | Seen again, already carried by round 25 (`review-writer-prompt`): `review-round.mjs outcomes` gives no writer prompt; stage-1 answers gave a placeholder commit sha; a stage-1 `sections` text carried its own `Verdict:` and `Commit:` lines (left out by the session); a tests-only commit made both reviewers stale | tooling | memory-only | project |

## Proposed updates

### `openspec/roadmap.md` (tooling)
Add a follow-up line so a merge of the base into a change branch is judged by what it brought.
- before: (no line for it)
+ after: - [ ] merge-staleness-first-parent — `deliver-check`'s `staleness()` judges a merge commit by its diff against its first parent instead of `git diff-tree -m` (against each parent), so `gh pr update-branch` that brings only `openspec/` files leaves `evidence.md` and the reviews current; a test merges main into a reviewed scratch branch both ways (main brings only `openspec/`, main brings a product file) (merge-setup-field-fixes retro, item 1)
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a plan adds a predicate or a labelled branch, its tasks name one test per guard condition and per label, negative cases included.
- Answer: approved
- Applied: yes
