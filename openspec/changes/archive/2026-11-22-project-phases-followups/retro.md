<!-- devkit-stage retro result=passed attempt=1 commit=2753796ea1c7f62eb90899db6acd4dc065cdbb46 -->
## Retro: project-phases-followups

1. Went wrong: after PR #61 merged, `deliver-check` could not find it as the change's own pull request, because `isOwnPr` (`plugins/openspec/hooks/deliver-check.mjs:512`) drops any pull request that touches `openspec/changes/archive/`, and this change's AC-6 added notes to the archived `project-phases` plan; `/devkit change` kept asking to open a pull request that was already merged, so the archive ran by hand. Before that, the stop hook refused to let the turn end while the change waited for a place under the roadmap's place limit (no end state says "waiting for a place"), so the session declared the run blocked with a reason that did not fit. The review round's first verdicts carried `(uncommitted changes)` because `evidence.md` was left untracked after the verify step, which would have made them stale on arrival; the evidence was committed and the reviewers re-emitted at the new head. Two different answers reached this change for one question (one typed here, one relayed from the coordinating session).
2. Better next time: tell a change's own pull request from an archive pull request by the change's own archive folder, not by any archive path; give the loop an end for "waiting for a place"; commit `evidence.md` before the review round; ask a change's question in one session only.
3. Remember: a change that edits another change's archived files cannot be found after its merge until `isOwnPr` is fixed; archive it by hand.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | `isOwnPr` drops a change's own pull request when it touches another change's archived files | bug-class | followup | project |
| 2 | The stop hook has no end for a change waiting for a place; evidence.md stays untracked into the review round | tooling | followup | project |
| 3 | One question reached the owner in two sessions and got two answers | process-friction | memory-only | user |

## Proposed updates

### `openspec/roadmap.md` (followup)
The `isOwnPr` defect becomes a change of its own in round 19b.
- before: - [ ] project-slice-dogfood (after: project-phases-followups) — the first real slice in one of the owner's projects through `/devkit project` (the phases' conversations with the owner, the real GitHub auto-merge)
+ after: - [ ] project-slice-dogfood (after: project-phases-followups) — the first real slice in one of the owner's projects through `/devkit project` (the phases' conversations with the owner, the real GitHub auto-merge)
+ after: - [ ] own-pr-archive-paths (after: project-phases-followups) — `isOwnPr` in `plugins/openspec/hooks/deliver-check.mjs` drops any pull request that touches `openspec/changes/archive/`, so a change whose own pull request edits another change's archived files is never found after its merge and `/devkit change` asks to open it again; refuse only a pull request that touches the change's own archive folder, and pin it with a test
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
Two frictions of the change loop become one change in round 19b.
- before: (the line added by the proposal above)
+ after: - [ ] loop-place-and-evidence (after: project-phases-followups) — the stop hook of `/devkit change` has no end for a change that waits for a place under a roadmap's place limit (the session has to declare it blocked), and `evidence.md` is left uncommitted after the verify step, so the review round's verdicts carry `(uncommitted changes)` and are stale on arrival: add a waiting-for-a-place end and commit the evidence before the review round
- Answer: approved
- Applied: yes

### user memory (memory-only)
A change's question is asked and answered in that change's own session; a coordinating session relays the owner's answer there and never asks the same question again.
- Answer: approved
- Applied: yes
