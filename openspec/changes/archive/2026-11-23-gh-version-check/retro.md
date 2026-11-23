<!-- devkit-stage retro result=passed attempt=1 commit=8c6e6308b417f72fd8c29e902aa739a2cc71eaf5 -->
## Retro: gh-version-check (PR #69)

1. Went wrong:
   - The delivery raced `main`. Between the first PR and the merge, `main` took six other changes (#64, #68, #70, #72, #71, #67). Each one meant a new merge, and four of them took the release number this change had chosen (0.22.0, 0.23.0, 0.24.0, 0.25.0, 0.26.0, then 0.27.0). On this machine each merge, evidence run and scoped review took one to two hours. The request to the coordinator to hold `main` was queued and got no answer before the merge.
   - Two semantic merges needed real thought, not renumbering. #70 made `gh-error`/`checks-unreadable` a wait on GitHub, and `gh-too-old` had to stay a stop. #62 required the shared tmp helper in a test this change added.
   - The installed `change-loop.mjs` 0.21.1 could not read the merged `flow.json` (`appliesWhen`), so the session switched to the installed 0.22.1 in mid-run.
   - Round 1 of the review caught one real gap: the archive-facts consumer of `checksItem` had no old-`gh` test (fixed in 7492d49).
   - Reviewers set `uncommitted: true` when the only dirty file was `evidence.md` under `openspec/`. The verdict files would then have carried "(uncommitted changes)" and gone stale; each reviewer had to be asked to re-send.
   - One commit-and-pr hand-off wrote a Sonnet attribution trailer instead of the one asked for (efa4568). #68 on `main` now lets the caller set it.
2. Better next time:
   - Ask the coordinator to hold merges to `main` once a change reaches its release step, and number the release only after a fresh `git fetch`.
   - When a change adds a field to a shared item such as `checksItem`, list every consumer of that item in the plan and give each one a test.
   - Tell reviewers that a dirty file under `openspec/` alone is not an uncommitted code state.
3. Remember: On a busy `main`, a change at its release step needs a merge hold from the coordinator, or every re-merge costs a full evidence and review cycle.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Concurrent merges to `main` re-open the release step of a change in delivery; the coordinator holds merges while one change is at its release step | process-friction | doc-update | project |
| 2 | Re-merging `main` can change semantics the change depends on (wait versus stop), not only version numbers; re-read the sibling's contract at each merge | process-friction | memory-only | project |
| 3 | A new field on a shared checker item needs a test at every consumer, not only at the producer | bug-class | memory-only | project |
| 4 | Reviewers flag `uncommitted` for a dirty `evidence.md`, which would mark their verdict stale; the review-round prompt should say that `openspec/`-only dirt does not count | tooling | followup | project |
| 5 | After merging a newer `main`, the installed loop may not read the merged schema; run the newest installed loop | tooling | memory-only | project |
| 6 | The minimum `gh` version was proven from release notes and source through `gh api`, because web fetch is blocked by the guard hook | environment | memory-only | project |

## Proposed updates

### `CONTRIBUTING.md` (process-friction)
A change at its release step asks the coordinator to hold other merges to `main`, and numbers its release after a fresh fetch.
- before: When a change is rebased onto a base that merged a sibling while the change was in review (`resolve-release-conflict`, or by hand), re-read what the change consumes from that sibling before pushing the rebased head: a skill's argument forms, a checker's exit codes and JSON fields, the text a button fills. The reviews run again on the pushed head either way; a contract found moved by review costs another round.
+ after: When a change is rebased onto a base that merged a sibling while the change was in review (`resolve-release-conflict`, or by hand), re-read what the change consumes from that sibling before pushing the rebased head: a skill's argument forms, a checker's exit codes and JSON fields, the text a button fills. The reviews run again on the pushed head either way; a contract found moved by review costs another round. In a roadmap run, a change that reaches its release step asks the coordinator to hold other merges to `main` until its PR merges, and takes its version numbers from `origin/main` right after a fresh `git fetch`: every sibling merged meanwhile costs one more merge, evidence run and review.
- Answer: approved
- Applied: yes

### user memory (memory-only)
On the Avell, a delivery's re-merge plus evidence plus review costs one to two hours; ask the coordinator to hold `main` before the release step.
- Answer: approved
- Applied: yes
