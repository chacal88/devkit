Verdict: approved
Commit: 1077219956e46fe2d6a0c73c0d7220209dc3f785

## ADR review — panel-conduct-view

### Findings
- [nit] plugins/panel/hooks/register.tsx (open_session_in handler); design D9 — The panel calls the app window tool open_session_in. It is defensible under ADR 0001 (docs/adr/0001-coordination-without-a-harness.md) as a view action on the owner's press, but no ADR or README line records it; name it as the one layout call.
- [nit] design D4; plugins/panel/hooks/register.tsx:91 — The panel keeps its own copy of the candidate-listing rule, which approaches the ADR 0007 review trigger (docs/adr/0007-one-change-on-request.md). The design acknowledges it as not fired. The copied checker grammar is now tied to its source by check_panel_parity in scripts/check.py. Still name the trigger in the retro note.

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`). ADR 0005 is superseded and was read only to follow its superseder.

Re-review scope: the range 0820110..1077219 moves the grammar (SECTION_RE, TASK_RE, CHANGE_ID_RE, NOT_IDS, isChangeId, OWNER_RUN_RE) into `plugins/panel/hooks/grammar.ts` and adds a parity check in `scripts/check.py`. It also adds tests and small edits to project.ts, report.ts and steps.ts. A grep of the added and removed lines shows no new `$.` calls, no start_session, send_message, fs.write or submit. No ADR file changed. The parity check strengthens the ADR 0007 mitigation, because the copied rule can no longer drift from the checker unnoticed. No new findings. Both previous nits are still open and are not blockers.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
