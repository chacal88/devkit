Verdict: approved
Commit: 0820110b9c8f7c6f68fd1eb4d91c2f139baafd83

## Quality review — panel-conduct-view (round 1)

### Findings
- [nit] plugins/panel/hooks/register.tsx:~327 — On a full trigger, `others` includes entries already dropped (`archived`, `not-a-change`), so every pane open or Refresh re-runs conduct-check for them. D5 says 'every other change in progress', and dropped entries are not in progress. A light trigger already skips them.
- [nit] plugins/panel/hooks/register.tsx:~312 — When `fetchOne` of the conducted change hits a rate limit in this run, `deliverReport` still runs right after, adding 3 to 6 `gh` calls against a limit that was just reported. Skipping it when `isLimited` is already true would save them. The code does what D5 describes, so this is optional.
- [praise] plugins/panel/hooks/register.tsx:refresh/runAs/pool — One run at a time, with a full trigger queued behind a light run and its own promise de-duplicated. Checker runs capped at 3 in parallel by `pool`. Light triggers skip everything but the conducted change while the pane is closed. Matches the D5 cost table, with no N+1 on the hot path.
- [praise] plugins/panel/hooks/register.tsx:ui.render Pane — The render path only reads atoms and builds pure items, so it runs no process and no fs call. Folder facts, tasks and progress are read in `load`, not in `ui.render`. The `ROWS_SHOWN` and `PENDING_SHOWN` caps and `capLines` bound the lists.
- [praise] plugins/panel/hooks/panel.test.tsx:586-712 — The tests cover the 5-minute rule (no row younger than 5 min on a tick, stale rows asked once at FRESH_MS) and the rate-limit back-off. They assert the checker-call counts, not only the rendered output.

### Summary
- 5 findings (0 blocking, 0 important, 2 nit) + 3 praise
- Justification: I did not re-run the suite and relied on the conducting session's 161/161. I read `conducted.ts` in full and `register.tsx`'s `load`, `fetchEntry`, `deliverReport`, `refresh`/`runAs`, `tick` and both `ui.render` hooks. I compared them with design D5, and checked `candidates` in `project.ts` and the test coverage of the cadence.

### Refresh path
- **5-minute rule.** Light with the pane open re-asks only non-dropped others older than FRESH_MS. With the pane closed, light asks none. A candidate with no stored entry is fetched once on any trigger, as D3 and D5 say.
- **Back-off.** In back-off a light trigger runs no checker, and a full trigger runs only the conducted change's two checkers. No candidate is fetched. A new rate-limit match restarts the 15 minutes, and a successful run keeps the existing `backoffUntil`.
- **Bounded fan-out.** Candidates come only from worktrees and the change folders, so the number of checker runs is bounded. `readFolder` and `readProgress` do a handful of fs reads per refresh, with no `gh`.
- **Failures.** A failed fetch keeps the last good row, so `sessionPrefix` stays readable for D3. A thrown refresh becomes the view's error line, and `isRefreshing` is reset in `finally`.

### Render path
- Pane render is atom reads plus pure builders. The detail pane reads the open document from disk on each render, which is acceptable because it is only on the owner's actions and refreshes.
- `conductedId` builds one RegExp per child and entry pair in `childrenOf`. The input is the own-children list, so it stays small.
- `$.session.messages()` is read in full on every refresh, and `conductArgs` scans back from the end. D5 declares this and the cost is in-process, so it is not a finding.
