Verdict: approved
Commit: 2fd34f861706ff18a2a88efbd0981eef44ff8505

## ADR review — jira-entry

### Findings
- [nit] openspec/changes/jira-entry/design.md:238 — D-6 lists only a blocked end as withholding writeBack, but change-loop.mjs:1119-1120 also withholds it on the waiting-budget end; add the budget end to D-6 (and cite change-budget D-4) so the design matches the code and the AC-6 test at change-loop.test.mjs:3627.

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0016 (`docs/adr/0016-stage-roles-write-their-own-files.md`) and ADR 0007 (`docs/adr/0007-one-change-on-request.md`).

Previous findings: the verdict file of 90aecc5 had no findings, so none are re-listed.

Review of the fourth merge of main (e147d74):
- The merge resolution in `nextAction` (`plugins/openspec/hooks/change-loop.mjs:1112-1124`) reads `action.end.why === 'waiting-budget'` from the action `decide` already produced. It adds no second state source and no second budget count, so ADR 0017 decisions 1 and 4 hold.
- `action.task` and `action.writeBack` still sit after `action.state` and the session title. The budget count stays in `decide` through `facts.budget`.
- The budget end asks no write-back question while the owner has a cap to raise. This is consistent with the blocked-end rule and does not touch ADR 0010 decisions 1 to 8, whose Note for jira-entry is unchanged. The write-back record sits outside ADR 0016's stage-role files.
- `docs/coordination-design.md` keeps the `devkit.budget` finality sentence from main beside the jira-entry line (no task-source field).
- The renumbering to marketplace 0.30.0, devkit-core 0.12.0 and devkit-openspec 0.26.0 and the v0.26.0 CI pin are applied consistently in the CHANGELOG and `docs/openspec-flow.md`.
- No ADR is violated and no open decision is touched.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
