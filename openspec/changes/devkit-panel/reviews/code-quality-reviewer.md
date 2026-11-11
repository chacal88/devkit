Commit: 0d186c7544335d0e2a1829cb822258bd1d3438df
Verdict: rejected
Reviewer: general-purpose subagent following plugins/core/agents/code-quality-reviewer.md (the devkit-core agent type is not loaded in this session)

## Quality review — devkit-panel (round 1)

Reviewed: `git diff ae2b676...0d186c7` (plan commit 80ccbc7 + implementation commit 0d186c7), judged against design.md D2–D15, requirements.md AC-1 to AC-12, tasks.md, and the engine contract `claude-code.d.ts` (2.1.317). Phase 1 (context), 2 (architecture), 3 (line by line) and 4 (summary) were run in order.

### Findings

- [important] `plugins/panel/hooks/register.tsx:115-131` — Race between `load` and `toggle`: `load` reads `collapsed` at line 115, runs the expanded rows' `deliver-check`s (seconds each, `gh` inside), then overwrites the whole view at line 131 with the `delivers` it computed. A row the owner expands during that window (`toggle` writes `delivers[id]` at line 167-168) loses its report when line 131 lands: the row stays unfolded with no `deliver:` line until the next refresh (next turn or 60 s). Reproduced with a scratch test on a copy of the pack (the second expanded row's deliver check ran, then the view held 1 deliver report for 2 unfolded rows). · fix: make the final write a merge, `update($, view, v => ({ ...next, delivers: { ...keepOpen(v.delivers, nowOpen), ...delivers } }))` where `nowOpen` is a fresh `read($, collapsed)`, and add the case to `panel.test.tsx` (hold the deliver run with a deferred `process.run` as the scratch test did).
- [important] `plugins/panel/hooks/register.tsx:72-83` — A refused or failed `list_sessions` is misdiagnosed or silent. `$.tool.call` resolves `{ deny }` or `{ isError, text }` for a hook's refusal or a tool error and rejects only for an unknown name or an abort (`claude-code.d.ts:3147-3148`); both resolved arms fall through `answerText` to `parseSessionRows(undefined | errorText)` → `[]`, so the lists are empty with no line at all (confirmed with a `{ deny }` mock: no notice drawn), while the `catch` at 81-82 maps the rare rejection to `permission: LIST`, telling the owner to allow a tool that is already allowed. Neither case is covered by a test. · fix: branch on `answer.deny` / `answer.isError` and surface them as the pane's error line (`list_sessions: <deny|text>`), keep `permission` for the `mayList` path only, and add a `{ deny }` case to AC-7's tests.
- [nit] `plugins/panel/hooks/i18n.ts:61,93` — `${met}/8` hard-codes the item count; `DeliverReport.items.length` is at hand (`pane.tsx` passes `deliver`). Use it so the line stays right if the contract grows.
- [nit] `plugins/panel/hooks/pane.tsx:147` — `cut` counts UTF-16 units, not cells: a wide glyph or an emoji in a round title makes the band line overrun `bodyColumns` by that much. Acceptable for pt-BR/en titles; note it or count code points.
- [nit] `plugins/panel/hooks/pane.tsx:117` — an unfolded `Archived` group draws one line per folder with no cap; the list grows with the project's history. The pane scrolls, so not a gate, but a `newest N` with a count line keeps the pane short.
- [nit] `plugins/panel/hooks/register.tsx:231` — the `tool.call` hook for `mcp__devkit-panel__status` has no `.catch` (`plugin validate`: "gating hook without .catch"); a thrown state write inside `refresh` turns the model's call into a failed call. The `examples/tool-call.ts` pattern (`.catch` answering with the plugin's name) would keep the tool diagnosable.
- [nit] `openspec/changes/devkit-panel/design.md:55` lists a `ui.close` hook in `register.tsx`; the module registers none (validate: six hooks, no `ui.close`), and D9 says there is nothing to keep. Harmless; drop it from D2's file list so the plan and the module agree.
- [praise] `plugins/panel/hooks/register.tsx:135-154` — one refresh in flight done right: the in-flight promise is handed back to a second trigger, `free` only clears its own run (`inFlight === run`), and `then(free, free)` keeps a rejected run from pinning the flag. AC-6's two-triggers test proves it with the mocked engine.
- [praise] `plugins/panel/hooks/project.ts:8-11`, `sessions.ts` (`PanelTool`) — readers take `Pick<EngineInterface[...]>` slices of `$`, so the checker location, the folders and the permission check are tested against an in-memory disk and tool table with no engine.
- [praise] `plugins/panel/hooks/fixtures/*.ts` — captured from real checker runs with the command, version, exit code and the trimming recorded in the header, as D13 asked, not written from the design's sketch.

### Acceptance with real output

- AC-1: `python3 scripts/check.py` → `all checks passed`; `python3 scripts/gen-catalog.py --check` → exit 0; `node --test .../project-settings.test.mjs` → 13 pass (the `PACKS equals the plugin names in marketplace.json` pin included).
- AC-11: `claude plugin validate plugins/panel` (app binary 2.1.317) → `Validation passed`; the calls list is `clock.every, clock.now, command.register, env.get, fs.exists, fs.list, fs.read, process.run, prompt.fill, session.root, state.get, state.set, tool.call (via loadSessions), tool.check, tool.list, tool.register, ui.close, ui.open, ui.panes, ui.resolve, ui.toast`; no `prompt.submit`, `fs.write`, `store`, `clock.after`; the one session tool reached is `list_sessions` (only warning: no icon).
- AC-12 (and AC-2 to AC-10 through it): `claude plugin test plugins/panel` → 43 pass, 0 fail (25 in `panel.test.tsx` over `terminal` and `desktop`, 18 in `report.test.tsx`).
- Task 2.3: `tsc` 5.6.3 with the skill's `claude-code.d.ts` as the one type root, `jsx: react` + `jsxFactory: h` (the contract's global factory), `strict` + `noUncheckedIndexedAccess` → exit 0, no errors. (With `exactOptionalPropertyTypes` the conditional-spread pattern in `report.ts` fails; the engine's laid tsconfig is not in the worktree, so this is noted, not counted.)
- AC-13: phase 4 is declared unticked (4.2, 4.9); no false claim.
- Scope: every file outside `plugins/panel/` (marketplace, CHANGELOG, catalog, conventions, openspec-flow, `.gitignore`, `project-settings.mjs`, openspec plugin bump) is named in D14; no ADR touched (D16).

### Summary

- 7 findings (0 blocking, 2 important, 5 nit) + 3 praise
- Justification: the pack is read-only as planned and `claude plugin validate` proves AC-11 with real output; the tests pass and pin AC-2 to AC-10 on two surfaces. Two `important` findings stay open: a reproduced race in which a refresh drops the deliver report of a row expanded during it, and a refused or failed `list_sessions` call that is either silent or reported as a missing permission, neither with a test. Verdict `rejected` until both are fixed (or contested with evidence); the nits are the implementer's call.
