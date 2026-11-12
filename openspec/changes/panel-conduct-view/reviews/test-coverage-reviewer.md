Verdict: approved
Commit: 1077219956e46fe2d6a0c73c0d7220209dc3f785

## Coverage analysis — panel-conduct-view (round 2, 0820110..1077219)

### Findings
- [important] plugins/panel/hooks/register.tsx:214,240 — Folder fallback to <root>/openspec/changes/<id> when the worktree is gone was untested. · fixed in 1077219
- [nit] plugins/panel/hooks/register.tsx:219-235 — readFolder failure paths (unreadable file, specs folder with only files) are not asserted. The code degrades without throwing.
- [nit] plugins/panel/hooks/register.tsx:228 — APPROVAL_DATE_RE is tested only with the '- Date: YYYY-MM-DD' and 'n/a' forms. A bare 'Date:' line and a malformed date are not covered.
- [nit] scripts/check.py:122-163 — check_panel_parity has no test of its own. It was proven only by passing on the real tree, so a drifting copy that it should catch has not been shown to fail it. The regexes also match a literal anywhere in the checker's text.

In-scope surfaces: plugins/panel (hooks and tests), scripts/check.py, plugins/panel/hooks/grammar.ts. The plugins/openspec guard is unchanged.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- Folder to worktree fallback: caught by the new test in panel.test.tsx. It deletes the worktree dir, moves the conducted change's files under /w/openspec/changes/panel-conduct-view, and asserts the summary, the docs line 'Proposta Design Tarefas Specs', '4 de 9 tarefas' and the other change's '1 de 2 tarefas · gate da fase 1'. If folderOf or readProgress stopped falling back to the root, those reads would return nothing and the assertions would fail.
- Copied grammar to the checkers: caught by scripts/check.py#check_panel_parity. The session reports it passes. The new test's last assertion counts tasks through the same TASK_RE.
- All other seams from round 1 are unchanged and still caught as listed in the previous verdict.

Fragile-test notes: the new test builds its world by moving files inside the flowWorld fixture. That is a state a real producer can emit (a removed worktree), not an impossible fixture. It asserts the drawn status text, not internals.

### Well covered
- Folder fallback for the conducted change and for another change's progress: the new fallback test in panel.test.tsx.
- Everything listed as well covered in round 1 is unchanged by 1077219.
