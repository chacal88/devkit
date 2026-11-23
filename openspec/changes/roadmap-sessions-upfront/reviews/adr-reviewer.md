Verdict: approved
Commit: f7c5945b8bd8763a51040c609968fe937a9633c4

## ADR review: roadmap-sessions-upfront (round 2)

### Findings
- [important] docs/adr/0020-a-roadmap-run-opens-every-change-at-its-start.md:3 (was ADR 0019, proposed with no Accepted by line) — ADR 0020 was still proposed with no recorded acceptance; it now reads accepted, cites the owner's aprovo and approval.md · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] docs/adr/0020-a-roadmap-run-opens-every-change-at-its-start.md Decision 3 / Amends; plugins/core/agents/requirements-triage.md; openspec/config.yaml — Triage answering grill questions touched ADR 0010 decision 8 without naming it, and applied to a lone /devkit change; ADR 0020 and the ADR 0010 Note now name the sentence and the scope · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [important] plugins/openspec/hooks/guard.mjs (skillEntry); plugins/openspec/hooks/hooks.json — The Skill hook ignores the ADR 0004 project opt-in with no ADR acknowledging it; ADR 0020 Decision 1 and a Note and header line in ADR 0004 now record the bounded exception · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6
- [nit] plugins/openspec/hooks/conduct-check.mjs (adrClash, renumber-adr); docs/adr/0020 Decision 7 — Implementer renumbering an ADR the default branch took, without asking the owner, was in no ADR; now ADR 0020 Decision 7 · fixed in 6fab305a0226c551d6bf73af04f1b88c8d8cf6d6

ADRs reviewed: ADR 0004, 0006, 0010, 0011, 0013, 0014, 0016, 0017 (amended by this change), 0019 (main's release-tag ADR, number clash only) and 0020 (this change's record, renumbered from 0019 in 877026a). No index file or open-decisions log exists; the config's ADR list was checked.

All four previous findings are closed by 6fab305. The work since my previous commit (the merge of main, the renumber to 0020, the evidence) has no conflict with a locked ADR: the 0019 cited in the release_tag comment of openspec/config.yaml is main's release-tag ADR and is correct; the older ADRs' header lines and Notes, the config list, the docs and CHANGELOG.md follow the 0020 number; the remaining 0019 mentions in proposal.md, design.md and readiness.md are history of the change, not references.

No test was run; the suite result came from the caller.

### Summary
- 0 open findings; the 4 previous findings (3 important, 1 nit) are fixed in 6fab305.
