Verdict: rejected
Commit: 0de71c21dbbf05b099cb402387237df4cac9a622

## ADR review — forced-merge-path

### Findings
- [important] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md Decision 1 vs plugins/openspec/hooks/deliver-check.mjs:823-848 and specs/change-delivery/spec.md (An owner's forced merge is to… — ADR 0028 decision 1 says a merge is forced when `check` or `devkit-reviews` is not SUCCESS or is absent. The code, spec and docs/openspec-flow.md instead use the checks the default branch requires, plus `devkit-reviews` only when it reported. A project whose ruleset names other checks, or does not require `devkit-reviews`, is judged by a different rule than the one the accepted ADR states. Fix: align the ADR's decision 1 wording with the specced rule (the owner re-accepts the edit), or note the difference in the ADR.
- [nit] docs/adr/0028-an-owners-forced-merge-leads-the-change-to-the-archive.md header, Number line — The Number line says 0028 is the next free number on origin/main, but local origin/main ends at 0026. 0027 is held by the remote branch origin/archive-release-pin. Say in the Number line that 0027 is taken by that sibling, or confirm the number again at the last merge of main.

ADRs reviewed: ADR 0002, 0003, 0012 (as cited), 0016, 0017 and 0019 (as cited), and 0028 (the change's own record).

No open decisions log exists in the project. The change does not contradict any locked ADR and needs no superseder. It amends ADR 0003 through ADR 0028, and ADR 0003 is annotated accordingly.

### Summary
- 2 findings (0 blocking, 1 important, 1 nit)
