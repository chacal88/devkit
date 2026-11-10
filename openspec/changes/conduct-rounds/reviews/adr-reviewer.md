Verdict: approved
Commit: 9cd32659aef800f1eaf373694e15030cdd141bff

## ADR review — conduct-rounds (round 2, stale re-review after merge of origin/main at 9cd3265)

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`); 0002 and 0003 checked against the delta, not touched by it.

Scope: `git diff dd407bd..9cd3265` outside `openspec/changes/archive`. The delta is the devkit-opt-in retro (0.7.1) merged from main: the `tdd-implementer` PID rule, the schema Request line and template, `docs/migrate-to-project-scope.md` items 1-4 and their tests in `plugins/openspec/hooks/guard.test.mjs`, version bumps, CHANGELOG, plus conduct-rounds review artifacts and the removal of the archived `devkit-opt-in` change folder. None of it touches the conduct skill, the hooks' opt-in rule, the wake-up or the parallel-step decisions.

### Findings
- [important] `plugins/openspec/skills/conduct/SKILL.md` Start 4 (a cron-started run counted as the `devkit-lite` go-ahead) · fixed in dd407bd
  - Verified: Start 1 defines `--wake` as carried only by the cron's prompt and not an owner message. Start 4 says only the owner typing `/conduct` is the go-ahead, and a `--wake` run never takes a `devkit-lite` change's first `implement` and never writes `approval.md` or a retro answer. `conduct-check.mjs:504` emits `/conduct --wake` and `/conduct round <n> --wake`. The skill's cron table, ADR 0005 Decision 2 and design D12/D13/D14 say the same. Unchanged by the merge.
- [nit] `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` § Context does not cite ADR 0004 · still open. Cite it, since the `guard.mjs` changes depend on its opt-in rule.
- [nit] `openspec/changes/conduct-rounds/design.md:322` (D13 numbering note) and `tasks.md:182` still say another in-flight change claims 0004 · still open. 0004 is on main with no duplicate number, so the note is stale.

No new findings from the merged delta: the migration doc edits keep ADR 0004's per-project opt-in model (item 2 removal of the marketplace leaves opted-in projects to re-offer it from their own `.claude/settings.json`), and the `tdd-implementer` rule adds a prohibition without altering ADR 0001's coordination model.

### Summary
- 3 findings (0 blocking, 0 open important, 2 nit open)
