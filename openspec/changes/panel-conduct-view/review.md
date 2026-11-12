# Review: panel-conduct-view, round 1

Path: agents · range `origin/main...HEAD` · structural: PASS

| Reviewer | Verdict | Blocking open | Important open | Verified | Refuted | Commit |
|---|---|---|---|---|---|---|
| adr-reviewer | approved | 0 | 0 | 0 | 0 | 0820110 |
| code-quality-reviewer | approved | 0 | 0 | 0 | 0 | 0820110 |
| test-coverage-reviewer | rejected | 0 | 1 | 1 | 0 | 0820110 |
| architecture-reviewer | rejected | 0 | 2 | 2 | 0 | 0820110 |

Consensus: FAIL (round 1/2)

## Open findings
- test-coverage-reviewer — [important] plugins/panel/hooks/register.tsx:214 (folderOf) and :240 (readProgress) — No test asserts the fallback to <root>/openspec/changes/<id> when the row's worktree is gone (for the conducted change or another change's progress). If that fallback broke, the docs, summary, approval date and tasks would vanish silently once a worktree is deleted. Write in plugins/panel/hooks/panel.test.tsx: use flowWorld, leave the worktree out of w.dirs, put the files under /w/openspec/changes/<id>, and assert the status text still shows the summary, docs and 'k de n tarefas'.
- architecture-reviewer — [important] plugins/panel/hooks/steps.ts:12-18 — The panel re-parses tasks.md with copies of deliver-check's SECTION_RE and TASK_RE (the comment says 'the same two expressions'); the checker already reports phases, so a change to its parser silently desyncs the pane across the plugin seam, and nothing in the diff ties the two. Direction: pin the shared grammar with a contract test against the checker's own output, or have the checker emit the task titles, and record the choice.
- architecture-reviewer — [important] plugins/panel/hooks/conducted.ts:14-20 — CHANGE_ID_RE and NOT_IDS copy the checker's own `--change` rule (conduct-check.mjs); a rule tightened in the checker makes the panel accept ids the checker refuses. Cross-plugin, so a shared import is impossible. Direction: a parity test that runs the checker's accept/reject set against isChangeId.

## Refuted by verification
None.

## Notes
- Path agents: the round ran on a turn the owner did not type.
- Stage 3 rewrote test-coverage-reviewer.md and architecture-reviewer.md once: the first write said approved with open important findings; check-file refused it.

## Next
Fix the open findings, then run review-change again (round 2).
