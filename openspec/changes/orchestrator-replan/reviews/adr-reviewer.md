Verdict: approved
Commit: 683ef5e4366ca827c78c62c48e44cf1ed7d02856

## ADR review — orchestrator-replan (round 2)

### Findings
- [nit] docs/adr/0006-phases-as-child-sessions.md:4 — Header said 'Amended by ADR 0007' without noting ADR 0007 is now superseded by ADR 0010. · fixed in d3a9928

Verdict: approved
Commit: 683ef5e4366ca827c78c62c48e44cf1ed7d02856

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`), ADR 0007 (`docs/adr/0007-one-change-on-request.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`). The other ADRs were covered in round 1 and the range does not touch them.

Re-review scope: the F1 nit and the lines changed since the round 1 commit e6ea4e5.

- ADR 0006's header now says its amendment by ADR 0007 is superseded by ADR 0010.
- The `plugins/openspec/README.md` and `docs/openspec-flow.md` rewordings keep ADR 0010 as the rule in force. Both say the current machinery stays until its round, which is consistent with ADR 0010.
- The two new tests in `plugins/openspec/hooks/guard.test.mjs` pin ADR 0010 as accepted and superseding ADR 0001 and ADR 0007, and check that the config names it. They also check the `rules:` entries of `openspec/config.yaml`. This is test code only, and `requirements.md` A-4 and AC-6 were reworded to say so. No agent, skill, schema or hook logic was edited.
- No ADR was resolved or contradicted without acknowledgement, and no open decision was touched.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit), the nit fixed
