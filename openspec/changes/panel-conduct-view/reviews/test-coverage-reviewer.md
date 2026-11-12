Verdict: rejected
Commit: 0820110b9c8f7c6f68fd1eb4d91c2f139baafd83

## Coverage analysis — panel-conduct-view (origin/main...HEAD)

### Findings
- [important] plugins/panel/hooks/register.tsx:214 (folderOf) and :240 (readProgress) — No test asserts the fallback to <root>/openspec/changes/<id> when the row's worktree is gone (for the conducted change or another change's progress). If that fallback broke, the docs, summary, approval date and tasks would vanish silently once a worktree is deleted. Write in plugins/panel/hooks/panel.test.tsx: use flowWorld, leave the worktree out of w.dirs, put the files under /w/openspec/changes/<id>, and assert the status text still shows the summary, docs and 'k de n tarefas'.
- [nit] plugins/panel/hooks/register.tsx:219-235 (readFolder) — The failure paths of readFolder are not asserted: an unreadable file (readText returns undefined) and a specs folder holding only files, which gives no Specs link. The code degrades without throwing, but only the happy path and the old-view shape are pinned.
- [nit] plugins/panel/hooks/register.tsx:228 (APPROVAL_DATE_RE) — The Date: regex is tested only with the '- Date: YYYY-MM-DD' form and the 'n/a' form (panel.test.tsx:366, report.test.tsx:998). A bare 'Date:' line and a malformed date are not covered, though the fallback to the plain 'approved' fact exists in dateFact.

In-scope surfaces: plugins/panel (hooks: conducted, steps, detail, register, pane, report, sessions, i18n; the types; plugin.json and hooks.json). The plugins/openspec guard is unchanged.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- Transcript to `conductArgs` to the candidate list to `conductedId`: caught by panel.test.tsx:497-499 (the three invocation forms), :544 and :565 (round 5 or compacted transcript plus an own child), :595 (shared prefix), and by report.test.tsx:413-513.
- The conducted id to the folder to `readFolder` to the `flowSteps` view and the pane: caught by panel.test.tsx:377, :436, :450 and :1721, which assert on the drawn lines and the status text, not only on the pure functions.
- Light and full triggers, back-off and rate-limit to which checkers run: caught by the D5 tests at panel.test.tsx:626-833, which assert the `w.runs` list.
- Read-only guarantee: caught by AC-11 (panel.test.tsx:2127), and D9 (:1059) shows that no refresh or timer calls open_session_in.
- The Continue, Approve and Answer buttons to the prompt fill and its mark: caught by panel.test.tsx:1300-1386.
- A stored older view shape to the renderers: caught by the D7 view-4 test (report.test.tsx:1051).
- Folder to worktree fallback: GAP (F1).
- hooks.json gained `"hooks": {}`: no unit test, but the session's `plugin validate` runs on both the bundled 2.1.321 and npm 2.1.227 cover it.

Fragile-test notes: I saw no test that only asserts a mock was called with what the test passed. The checks that look implementation-coupled (the i18n key-parity and word-count tests) pin an approved contract (design D12) and the owner-approved mock, so they are deliberate.

### Well covered
- Signal 1 parsing of the conduct invocation: three forms, punctuation trimming, `round n`, empty ARGS and an older id behind a newer round all have tests (report.test.tsx:413-470).
- D3 conducted-change order: the 20-character shared prefix, a stored entry with an error, and keeping the previous id only when a fetch failed (report.test.tsx:476-530).
- `readTasks` is checked against the checker's own parse of `tasks.md` (AC-20, report.test.tsx:836) and against the real 5.1, 5.2 and 5.9 task texts of this change (panel.test.tsx:1996).
- `flowSteps` placement is checked row by row, and every step id of the table is placed (report.test.tsx:912-1010).
- Session errors: ask, deny and a failed list_sessions call each give one error line, never a silent empty list. A refused child press gives one toast and no retry (panel.test.tsx:1006-1248).
- Layout at 24, 38, 80 and 140 columns, and the mobile mount (panel.test.tsx:1852-2060).
