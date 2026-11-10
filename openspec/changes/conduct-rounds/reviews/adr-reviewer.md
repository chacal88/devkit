Verdict: approved
Commit: dd407bdc86858067fa68ebe43836e05395df3cde

## ADR review — conduct-rounds (round 2)

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`)

### Findings
- [important] `plugins/openspec/skills/conduct/SKILL.md` Start 4 (a cron-started run counted as the `devkit-lite` go-ahead) · fixed in dd407bd
  - Verified: Start 1 defines `--wake` as carried only by the cron's prompt and not an owner message. Start 4 says only the owner typing `/conduct` is the go-ahead, and a `--wake` run never takes a `devkit-lite` change's first `implement` and never writes `approval.md` or a retro answer. `conduct-check.mjs:504` emits `/conduct --wake` and `/conduct round <n> --wake`. The skill's cron table, ADR 0005 Decision 2 and design D12/D13/D14 say the same.
- [nit] `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` § Context does not cite ADR 0004 · still open. Cite it, since the `guard.mjs` changes depend on its opt-in rule.
- [nit] `openspec/changes/conduct-rounds/design.md:322` (D13 numbering note) and `tasks.md:182` still say another in-flight change claims 0004 · still open. 0004 is on main with no duplicate number, so the note is stale.

### Summary
- 3 findings (0 blocking, 0 open important, 2 nit open)
