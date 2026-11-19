Verdict: approved
Commit: e6ea4e53955bdd5d53848413ba381083bec4ce7d

## ADR review — orchestrator-replan

### Findings
- [nit] docs/adr/0006-phases-as-child-sessions.md:4 — Header still says 'Amended by ADR 0007' without noting ADR 0007 is now superseded by ADR 0010; the Context note covers it.

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0005 (`docs/adr/0005-parallel-steps-and-a-session-wake-up.md`, already superseded by ADR 0006), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`), ADR 0008 (`docs/adr/0008-reviews-as-a-workflow.md`), ADR 0009 (`docs/adr/0009-compozy-loop-as-a-second-driver.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`).

Supersession of ADR 0001 and ADR 0007 is explicit and uses the existing status form (as ADR 0005 does), with a Context note on what survives and which round retires what. ADRs 0006, 0008 and 0009 stay in force and get Notes naming the replacing rounds. ADR 0010 decision 6 keeps ADR 0002, ADR 0003 and ADR 0004, and answers the rejected alternatives of the earlier ADRs as `openspec/config.yaml` requires. ADR 0007's review trigger (the owner asks for a roadmap-driven run) is acknowledged openly. Open points are marked open in `docs/coordination-design.md` and are not resolved silently. Withdrawn roadmap rounds 5, 11 and 13 are listed in `docs/coordination-design.md`. Release metadata follows the project's bump rule, and the guard.test.mjs change only updates the ADR 0007 status assertion.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
