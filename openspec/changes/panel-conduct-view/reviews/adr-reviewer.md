Verdict: approved
Commit: 0820110b9c8f7c6f68fd1eb4d91c2f139baafd83

## ADR review — panel-conduct-view

### Findings
- [nit] plugins/panel/hooks/register.tsx (open_session_in handler); design D9 — The panel calls the app window tool open_session_in. This is defensible under ADR 0001 (docs/adr/0001-coordination-without-a-harness.md) as a view action on the owner's press, but no ADR or README line records it; name it as the one layout call.
- [nit] design D4; plugins/panel/hooks/register.tsx:91 — The panel keeps its own copy of the candidate-listing rule, which approaches ADR 0007's review trigger (docs/adr/0007-one-change-on-request.md). The design acknowledges it as not fired; also name the trigger in the retro note.

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`); ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`) is superseded and was read only to follow its superseder.

No ADR files changed. No blocking or important findings. The panel's `$.*` calls are limited to fs.read/list/exists, process.run, clock.now and the 60 s refresh, and prompt.fill in replace mode (never sends). It does not call start_session, stop_session, archive_session or send_message, and has no prompt.submit, fs.write or store. The conducted change is only displayed, never selected for a run, so ADR 0006 and ADR 0007 hold. The docs in docs/openspec-flow.md match the code.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
