<!-- devkit-stage retro result=passed attempt=1 commit=9d8d601c2a4576df7bbdb53a3b961923596e5408 -->
## Retro: roadmap-coordinator-followups

1. Went wrong:
   - The owner added AC-13 to AC-15 while a planner was writing the plan; the plan missed them and was rewritten, and the first readiness review still found four gaps, one of them the host's exact tool ids, which the planner could not know.
   - The review's only important finding was a path that exists only live (the host refusing a session start on a turn nobody typed); it cost a fix and a second round, closed by an end-to-end subprocess test and the outcome-keyed rule in the skill.
   - Main moved three times while PR #47 was open (#46, #48, #49, the other change of the same run). Each merge of main made `evidence.md` and both reviews stale by `deliver-check`'s rule (a merge commit counts every file it brings against each parent), so the change ran three more verifications and a full re-review with no code of its own changed.
   - A subagent started the 21-minute whole suite with a shell `&` inside a foreground command; nothing woke the session when it ended, and the coordinating session had to point it out.
2. Better next time:
   - Hand the planner the host's tool schemas (ids and fields) whenever a plan relies on app tools, and stop a running planner when the owner adds criteria.
   - Plan, for every host outcome a script cannot see, an end-to-end subprocess test plus a design line naming the live part that goes to the retro.
   - Merge the base just before the final verification and review, not after; until round 17d lands, every merge costs a verification and a re-review.
   - Run long suites as a background command of the tool, never with a shell `&`.
3. Remember: in a roadmap run, the change that lands second pays for every merge of the first.

What the run showed after this change's verification (AC-12, AC-13, AC-14, AC-15, accepted by the owner on 2026-11-22 as retro follow-ups):
- merge-setup-field-fixes was merged (#46) and archived (#48) from its own session; this change was merged (#47, by auto-merge, 2026-11-22T02:27:11Z) from its own session.
- This session's title followed the stage: 📝 plan, 🛠️ code (22:48:57Z), 🚀 delivery, 🔍 review, 🛠️ the review fix, 🔍 review round 2, 🚀 delivery, 📦 archive.
- Several ends of the run handled one after another by the coordinating session: not seen; after the move each change session handles its own ends.
- A change becoming ready on a turn nobody typed, and the host's real refusal text: not seen in this run; the first case should be recorded (proposal 2).

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Long suites run as a tool background command; the whole suite takes up to about 21 minutes under load | process-friction | doc-update | project |
| 2 | Merges of the base stale evidence and every review; seen again here; live checks of AC-12 and AC-15 still owed | tooling | followup | project |
| 3 | Merge the base before the final verification and review | process-friction | memory-only | user |
| 4 | Hand the planner the host's tool schemas when a plan relies on app tools | doc-gap | memory-only | user |

## Proposed updates

### `CLAUDE.md` (process-friction)
The whole suite takes longer than the table says under load, and a shell `&` leaves the session without a wake-up.
- before: | Every hook test and the review round (about 13 minutes) | `node --test plugins/openspec/hooks/guard.test.mjs` |
+ after: | Every hook test and the review round (13 to 21 minutes; run it as a background command of the tool, never with a shell `&`) | `node --test plugins/openspec/hooks/guard.test.mjs` |
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (process-friction)
Record this change's evidence on the two lines that already carry the fixes, and add the live checks the run still owes.
- before: (round 17d) ... (merge-setup-field-fixes retro, item 1)
+ after: (round 17d) ... (merge-setup-field-fixes retro, item 1; seen again in roadmap-coordinator-followups on 2026-11-22: three merges of main cost three verifications and a full re-review)
- before: (round 25, review-writer-prompt) ... returns each outcome's stage-3 writer prompt ...
+ after: (round 25, review-writer-prompt) ... returns each outcome's stage-3 writer prompt (in roadmap-coordinator-followups the session built it with `loadRules().writerPrompt`) ...
+ after: ## Round 18c: live checks of a session per change
+ after: - [ ] roadmap-live-checks (after: roadmap-coordinator-followups) — on the next real `/devkit roadmap` run, record the host's real refusal of a session start on a turn nobody typed and what the owner saw, and several ends handled one after another by the coordinating session; a defect found is fixed with its red test (roadmap-coordinator-followups retro, AC-12 and AC-15)
- Answer: approved
- Applied: yes

### user memory (memory-only)
Merge the base into a devkit PR just before its final verification and review; any merge stales evidence and every review until round 17d lands.
- Answer: approved
- Applied: yes

### user memory (memory-only)
When a plan relies on app tools (session start, rename, list), hand the planner their exact ids and fields from the schemas.
- Answer: approved
- Applied: yes
