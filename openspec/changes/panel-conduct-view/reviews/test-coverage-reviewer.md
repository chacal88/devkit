Verdict: approved
Commit: 630180f18de881ff3160ca795369b2caca5424f6

## Coverage analysis: panel-conduct-view (round 3, 1077219..630180f)

### Findings
- [nit] plugins/panel/hooks/register.tsx:219-235 — readFolder failure paths (unreadable file, specs folder with only files) are not asserted; the code degrades without throwing.
- [nit] plugins/panel/hooks/register.tsx:228 — APPROVAL_DATE_RE is not tested with a bare 'Date:' line or a malformed date.
- [nit] scripts/check.py:122-163 — check_panel_parity has no test showing it fails on a drifting copy; it was proven only by passing on the real tree.
- [nit] plugins/panel/hooks/panel.test.tsx:22 — SURFACES omits vscode, so the percentage-width layout test at :1922 does not cover it; the new vscode test covers only the rule and the lines.
- [important] plugins/panel/hooks/register.tsx:214,240 — Folder fallback to <root>/openspec/changes/<id> when the worktree is gone was untested. · fixed in 1077219956e46fe2d6a0c73c0d7220209dc3f785
- [praise] plugins/panel/hooks/panel.test.tsx:1947 — The vscode render test asserts both no rule element and lines equal to desktop, so it would go red if hasRule mis-handled vscode.

In-scope surfaces: plugins/panel (pane.tsx, register.tsx, panel.test.tsx). The delta in code is 4 lines; the rest is change-folder docs.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- surface?: RenderSurface widening, so a 'vscode' surface reaches hasRule (pane.tsx:532): caught by the new test at panel.test.tsx:1947 (no rule element for vscode, lines equal to desktop).
- Removal of the duplicate width: '100%' from the tint spread (pane.tsx:659): still caught. The Box at pane.tsx:654 keeps width="100%", and panel.test.tsx:1936 asserts stepRow.props.width is '100%'.
- @ts-ignore on the tool.call hook (register.tsx:585): a type-level change with no runtime effect; both type checks exit 0 per the session.
- Fixture isCollapsed:false in BAND props: tracks the 2.1.321 contract and changes no assertion.

### Well covered
- A vscode render follows the desktop layout: panel.test.tsx:1947.
- Folder fallback to the root when the worktree is gone: the test added in 1077219 is unchanged.
- Everything listed as well covered in earlier rounds is unchanged.
