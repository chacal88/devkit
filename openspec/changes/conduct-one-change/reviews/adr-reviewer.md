Verdict: approved
Commit: a527a0f40340e774a70af46ab3c0322394e60c3b
Round: 1

## ADR review — conduct-one-change

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`). ADR 0002 and 0003 (merge and archive-PR rules) are untouched by the diff. ADR 0005 is superseded; ADR 0006 is its superseder and was followed.

Conformance checked:
- ADR 0007 is byte-identical to the draft in design D7.
- ADR 0006: decisions 1-4 and its review trigger are unchanged. The amendment is one pointer sentence in Decision 1 plus the `Amended by` header line. The skill keeps one child per phase, the refused start as a stop, no cron and no wake-up (Start 6), and the chain of continuation turns.
- ADR 0001: the checker `--change` mode is read-only and recomputes from the repository, worktrees and GitHub (`plugins/openspec/hooks/conduct-check.mjs`, `compute`). No new state is kept. Plan approval stays a human gate. The new-change creation, the schema and the unfinished-work question are all answered only by the owner's typed message (`plugins/openspec/skills/conduct/SKILL.md`, "A missing change" and "The unfinished-work gate").
- ADR 0004: no hook gating changed. The checker still resolves the project root from the cwd.
- ADR 0007 decisions 1-3 match the skill and the checker: `--change` never reads the roadmap, bare `/conduct` asks and never sweeps, the round runs only on `round <n>`, and a missing change is created only on the owner's answer. Continuation turns and Auto-fix wakes skip the unfinished-work question, which is consistent with "a turn the owner typed".

### Findings
- [nit] `docs/adr/0007-one-change-on-request.md` § Decision 4 — it lists "the sidebar group named after the change" and "the archive on the phase's gate" as ADR 0006 session rules. Decision 1-4 of `docs/adr/0006-phases-as-child-sessions.md` do not state them; they live in the skill and in 0006's Consequences. What is wrong: the cross-reference overstates what 0006 locks. Fix: word it as "the session rules of 0006 and the skill", or leave as is (it does not change behaviour).
- [nit] `docs/adr/0001-coordination-without-a-harness.md` § Consequences, Note — it names only "conducting a roadmap round" as the exception recorded in 0006. Since 0007 makes single-change conducting the default, the note now reads as if only rounds are exempt. Fix: add a pointer to ADR 0007 there (the ADR text is accepted, so this is the owner's call; the README already cites both).
- [nit] `plugins/openspec/skills/conduct/SKILL.md:112` and `:139` — the fixed Auto-fix line tells the owner to "run `/conduct` again". Under `docs/adr/0007-one-change-on-request.md` § Decision 2 a bare `/conduct` asks which change. Fix: say `/conduct <id>` (`round <n>` in the round mode) in that line.

### Summary
- 3 findings (0 blocking, 0 important, 3 nit)
- No open decision is touched, no superseder is required, and no scope exceeds the plan.
