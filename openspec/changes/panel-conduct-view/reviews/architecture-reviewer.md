Verdict: rejected
Commit: 0820110b9c8f7c6f68fd1eb4d91c2f139baafd83

## Architecture review — panel-conduct-view (origin/main...HEAD)

### Findings
- [important] plugins/panel/hooks/steps.ts:12-18 — The panel re-parses tasks.md with copies of deliver-check's SECTION_RE and TASK_RE (the comment says 'the same two expressions'); the checker already reports phases, so a change to its parser silently desyncs the pane across the plugin seam, and nothing in the diff ties the two. Direction: pin the shared grammar with a contract test against the checker's own output, or have the checker emit the task titles, and record the choice.
- [important] plugins/panel/hooks/conducted.ts:14-20 — CHANGE_ID_RE and NOT_IDS copy the checker's own `--change` rule (conduct-check.mjs); a rule tightened in the checker makes the panel accept ids the checker refuses. Cross-plugin, so a shared import is impossible. Direction: a parity test that runs the checker's accept/reject set against isChangeId.
- [nit] plugins/panel/hooks/report.ts:216 — OWNER_RUN_RE is defined twice in the same package (report.ts:216 and steps.ts:17); the marker has two homes. Direction: export it from one module.
- [nit] plugins/panel/hooks/project.ts:7 — project.ts (discovery) imports isChangeId from conducted.ts (the conduct-signal module), which pulls in sessions.ts; the id rule is a project concept and sits in the wrong module. Direction: move isChangeId to project.ts, or a small ids home.
- [nit] plugins/panel/hooks/sessions.ts:84-91 — ADR candidate: the panel now calls the app's open_session_in, a layout action. design D9/D18 argue it stays within ADR 0001 ('drives nothing') and record no ADR. The allow-list helper callAppTool is a sound seam, but the boundary between 'view action' and 'driving' is now an interpretation, not a record. Direction: consider a short ADR, or an addendum to 0001, stating that view-only layout calls are allowed.
- [nit] plugins/panel/hooks/pane.tsx:1 — pane.tsx (1265 lines) and register.tsx (645 lines) hold most of the rendering and the refresh orchestration, so following one flow means scrolling a very large file; the pure modules (detail, steps, conducted, commands) are well split. Direction: no action now; split when the next view lands.

Analyzed: owners, boundaries, contract consumers and deletion tests are covered below.

Owners: the panel stays read-only. Checker data comes only from `conduct-check --change` and `deliver-check`, the app's session list through `sessions.ts`, and the git worktree list through `project.ts`. Every `tool.call` goes through `callAppTool`, which accepts only `list_sessions` and `open_session_in` (register.tsx:131 and :542-543 are the only call sites). Deciding which change is conducted lives in one pure module, `conducted.ts`.

Boundaries: the panel is a separate plugin and imports nothing from `plugins/openspec`; it reads the checkers' JSON tolerantly (`report.ts`). The checker's contracts (`--change`, `details`, `phases`, `pr`) are consumed only by the panel. The removed `others`/`archived`/`delivers`/`changeOption` view fields, `buttonsFor` and `changeFolders` are replaced in the diff by types, `commands.ts`, `project.ts` and `register.tsx`, so there is no dangling consumer. The old-checker path (`checkerVersionOk`, minimum 0.10.0, ADR 0007) guards the version contract.

Deletion tests: `conducted.ts` concentrates real work (three invocation forms, ambiguity, a fallback to children), so it passes. `detail.ts` and `steps.ts` pass; they hold the label, summary and tasks parsing that would otherwise bloat the pane. `callAppTool` is thin but earns its keep as the single allow-list seam (an ADR 0001 guard), so it passes. `commands.ts` is now small (the buttons' texts only) but is the pinned fill-text contract, so it is borderline and passes.

ADRs: ADR 0007's review trigger is argued as approached but not fired (design D4), so I did not re-litigate it. Nothing in the diff contradicts a locked ADR, so there is no escalation.

Not run: tests, because the caller supplied the results.
