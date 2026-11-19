Verdict: approved
Commit: b589e357de07a7d2ef1f1264625772700a8770c8

## ADR review — design-open-points

### Findings
- [nit] docs/coordination-design.md:38 — Section 1 command table still headed 'Example' though the command names are now decided; rename the column to 'Command'.

ADRs reviewed: ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0006 and ADR 0009 for the Note form, ADR 0007 and ADR 0008 (open points unchanged).

ADR 0010 stays accepted and its Decision text is untouched. The dated Note is the first paragraph under Context, in the same form ADRs 0006 and 0009 use. It correctly names the last sentence of decision 2 (line 82) and the last sentence of the Negative consequences (line 177). No decision 1 to 8 is reversed, so no superseding ADR is needed. The open points that remain (the conflict with `develop`, how load is measured, the ADR 0007 and ADR 0008 questions) are still listed.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
