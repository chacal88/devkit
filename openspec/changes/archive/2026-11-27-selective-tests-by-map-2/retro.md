<!-- devkit-stage retro result=passed attempt=1 commit=44a656b05cbaa5f4d7cbeb6643b7dfbc5936025d -->
# Retro: selective-tests-by-map-2

Change PR: #157 (merged). Ran as `selective-tests-by-map`, whose plan stopped at the readiness ceiling after three rounds, then reopened as `-2` with the same plan.

1. Went wrong:
   - The plan was written on a base that a sibling change (`release-at-merge`) then moved. Two of the three readiness rounds failed on claims about the base (the release rule, base labels), and the third on a record rename that no longer applied. The ceiling of 3 stopped the change, and the only supported way out was a new change id.
   - The plan appended an entry to the `ADRs:` line of `openspec/config.yaml` and its test search looked for the line's text, not for tests that pin its end. A release-at-merge test anchored the end of the line, and only the phase gate found it.
   - The first map check walked the disk, so an ignored `.DS_Store` made every `--own-files` run refuse. The code review found it, not the tests.
   - Review round 1 refused a reviewer's answer because it listed paths in `notRead`; its stage 1 ran twice.
   - A commit message said a plan file was updated "to match" when its diff held only a tick.
2. Better next time:
   - Merge `origin/main` before the planner writes the plan, and again before the first readiness round when a sibling has merged since.
   - When a task appends to a line a test may pin, grep the tests for the line's other entries and its `$` anchors, not only its text.
   - Tell reviewers in the stage 1 prompt to open every path of their remit.
   - Give the commit agent the exact body when it states what a plan file holds.
3. Remember: a plan's claims about the base go stale when a sibling merges; refresh the base before the plan, not after the ceiling.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | The plan's grep missed a test that anchors the end of a line the change appends to | bug-class | rule | project |
| 2 | A plan written on a base a sibling then moved failed readiness on claims, and the ceiling forced a reopened change | process-friction | rule | project |
| 3 | A check that walks a folder on disk refuses on ignored files; the fix lists git's tracked files (T-31 to T-33 are its regression gate, already in this change) | bug-class | regression-gate | project |
| 4 | The review round refuses a reviewer answer with paths in `notRead`, which costs a second stage 1 | tooling | doc-update | project |
| 5 | `deliver-check.mjs` is linked to 33 of 44 tests, so a change touching it still selects 35 files: the map speeds up changes away from the hub modules, not those on them | process-friction | followup | project |
| 6 | A commit message claimed an edit its diff did not hold | process-friction | memory-only | user |

## Proposed updates

### `openspec/config.yaml` (rule)
A tasks rule for a change that appends to a line of a shared file: the plan greps the tests for every entry of that line and for anchored patterns (`$`), since the ADRs line was pinned by an end anchor the text search missed.
- before: `A task that changes a text a test pins (a skill's frontmatter, a reply, a doc sentence) names each test file that asserts the old text; grep the test files for it`
+ after: `A task that changes a text a test pins (a skill's frontmatter, a reply, a doc sentence) names each test file that asserts the old text; grep the test files for it. A task that appends an entry to a line of a shared file (the ADR list) also greps for the line's other entries and for anchored patterns (a regex ending in $), which pin the end of the line.`
- Answer: approved
- Applied: yes

### `openspec/config.yaml` (rule)
A proposal rule: before the planner writes the plan, and before its first readiness round, the branch merges `origin/main` when a sibling change has merged since the branch was cut, so the plan's claims about the base (release rule, base labels, anchors) are true when the review reads them.
- before: `Keep it under two pages; the how belongs in design.md`
+ after: `Keep it under two pages; the how belongs in design.md. When a sibling change has merged since the branch was cut, merge origin/main before the plan is written and before its first readiness round, so every claim about the base is true when the review reads it.`
- Answer: approved
- Applied: yes

### `plugins/core/skills/review-change/scripts/review-round.workflow.js` (doc-update)
The stage 1 prompt (`reviewerPrompt`) says to list every path of the reviewer's remit in `read`, but the round refuses an answer with a path in `notRead`. Say so in the prompt: open every path of the remit, and decline only for lack of surface.
- before: `List in read every repo-relative path you opened, and in notRead every path of your remit you did not open (an empty list when you opened them all); the round refuses an answer with a path in notRead, or with an empty read unless you declined.`
+ after: `... the round refuses an answer with a path in notRead, so open every path of your remit before you answer; a path you truly cannot open goes in notRead with the reason in sections, and costs a second stage 1.`
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (followup)
A follow-up change: narrow the links of hub modules such as `plugins/openspec/hooks/deliver-check.mjs` in `scripts/test-map.json` (a direct import, or a named seam, instead of every test that names the file), so a change on a hub module selects fewer than 35 of 44 files; measure the selection before and after.
- before: `(no line for it)`
+ after: `- [ ] test-map-hub-links: narrow the hub-module links of scripts/test-map.json so a change on deliver-check.mjs selects fewer tests (after: selective-tests-by-map-2)`
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a hand-off to the commit agent must state what a plan file holds, give it the exact body: a commit message is a claim the diff has to support.
- Answer: approved
- Applied: yes
