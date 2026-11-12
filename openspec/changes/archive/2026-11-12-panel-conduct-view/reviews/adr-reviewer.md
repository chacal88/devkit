Verdict: approved
Commit: 630180f18de881ff3160ca795369b2caca5424f6

## ADR review — panel-conduct-view

### Findings
- [nit] plugins/panel/hooks/register.tsx (open_session_in handler); design D9 — The panel calls the app window tool open_session_in. It is defensible under ADR 0001 (docs/adr/0001-coordination-without-a-harness.md) as a view action on the owner's press, but no ADR or README line records it; name it as the one layout call.
- [nit] design D4; plugins/panel/hooks/register.tsx:91 — The panel keeps its own copy of the candidate-listing rule, near the ADR 0007 review trigger (docs/adr/0007-one-change-on-request.md); check_panel_parity ties the grammar to its source; name the trigger in the retro note.

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`). ADR 0005 is superseded and was read only to follow its superseder.

Re-review scope: range 1077219..630180f changes in plugins/ are type-check fixes (RenderSurface type, a @ts-ignore comment on the status tool.call hook, isCollapsed in a test fixture), a removed width='100%' on the tint row, and one vscode-layout test. No new engine calls, no ADR file changed. No new findings. Both previous nits remain open and are not blockers.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
