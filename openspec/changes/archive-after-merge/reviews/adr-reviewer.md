Verdict: approved
Commit: e497cc29002c8cda9fdddbe2c945f7ed95e65479

## ADR review — archive-after-merge (round 1)

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`, new).

### Findings
- [nit] `docs/adr/0002-merge-without-the-owner-opt-in.md:35` — the edited bypass line is one long unwrapped line, unlike the neighbouring lines. Cosmetic only.
  - Fix: rewrap at the file's column width.

Checks (all pass):
- ADR 0003 vs `openspec/changes/archive-after-merge/design.md` D10: the ADR text is byte-identical to the D10 draft (diffed), so Context, Decision, Consequences, review trigger and Alternatives match. Status accepted, matching owner answer A in `openspec/changes/archive-after-merge/requirements.md`. Answer B (answers uncommitted in retro.md) is recorded as Accepted in the ADR's Consequences.
- ADR 0002 edits: the diff against dac9784 removes one line (bypass line, now "Accepted: round 3 archives through a PR ... see ADR 0003") and adds the pointer note to ADR 0003. The Decision section is untouched, and the new note says it governs change PRs. This matches D10 and AC-8.
- ADR 0001: archive state is derived each run from the repo and GitHub (`deliver-check` change mode, the `retro.md` answers). No new state file, no workflow added (`.github/` is unchanged in the range), no process or session driving. Merging is only `gh pr merge --auto --match-head-commit` at `enable-auto-merge` and `--disable-auto` (`plugins/openspec/skills/ship-change/SKILL.md:53,111`), and the skill's Never list forbids pushing to or committing on the default branch. Work runs as subagents of the owner's session, and the answers are written only after the owner's own message. The ruleset bypass is not used (`--admin` is forbidden at `SKILL.md:111`).
- Docs cite ADR 0003 at `docs/openspec-flow.md:263,285`.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
