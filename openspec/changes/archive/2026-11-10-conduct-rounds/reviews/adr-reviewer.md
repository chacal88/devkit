Verdict: approved
Commit: 7484e4795c0e9694ee9f86874a14af6a61562e3e

## ADR review — conduct-rounds (round 2, stale re-review at 7484e47)

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`); 0002 and 0003 checked against the delta, not touched by it.

Scope: previous review covered `git diff dd407bd..9cd3265` (devkit-opt-in retro merged from main). The only change since is `git diff 9cd3265..7484e47 -- plugins/`: `plugins/openspec/hooks/conduct-check.test.mjs` and `plugins/openspec/hooks/deliver-check.test.mjs` clear `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` in the `--ci` fixtures (4 lines). Test-fixture environment only; it touches no ADR decision. Suite result supplied by the caller (535/535), not re-run.

### Findings
- [important] `plugins/openspec/skills/conduct/SKILL.md` Start 4 (a cron-started run counted as the `devkit-lite` go-ahead) · fixed in dd407bd
  - Verified: Start 1 defines `--wake` as carried only by the cron's prompt and not an owner message. Start 4 says only the owner typing `/conduct` is the go-ahead, and a `--wake` run never takes a `devkit-lite` change's first `implement` and never writes `approval.md` or a retro answer. `conduct-check.mjs:504` emits `/conduct --wake` and `/conduct round <n> --wake`. The skill's cron table, ADR 0005 Decision 2 and design D12/D13/D14 say the same. Unchanged by the merge and by the fixture change.
- [nit] `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` § Context does not cite ADR 0004 · still open. Cite it, since the `guard.mjs` changes depend on its opt-in rule.
- [nit] `openspec/changes/conduct-rounds/design.md:322` (D13 numbering note) and `tasks.md:182` still say another in-flight change claims 0004 · still open. 0004 is on main with no duplicate number, so the note is stale.

No new findings from the fixture change: hermetic env in tests does not affect ADR 0001, 0004 or 0005.

### Summary
- 3 findings (0 blocking, 0 open important, 2 nit open)
