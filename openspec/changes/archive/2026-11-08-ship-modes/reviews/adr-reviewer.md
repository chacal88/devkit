Verdict: approved
Commit: c5da1553d4afe9be984cb4d1056c8acf3bb9d405

## ADR review — ship-modes (round 3, stale-only re-review of 1acce88..HEAD)

ADRs reviewed: [ADR 0001](../../../../../docs/adr/0001-coordination-without-a-harness.md)

### Findings
No findings.

### Conformance checked
- plugins/core/agents/pr-verifier.md and docs/openspec-flow.md: wording on where the `Commit:` line goes (before the first heading). Documentation only; gates, single writer of evidence.md and the staleness rule are unchanged, so ADR 0001's Decision holds.
- plugins/openspec/hooks/deliver-check.mjs (main): a clear UsageError (exit 3) when openspec/ is not inside a git repository. It reads the repository only, adds no process or state outside the repository and GitHub, and drives no session or app.
- plugins/openspec/hooks/deliver-check.test.mjs: new tests for the no-git error and the agent wording. No ADR impact.
- Open decisions: none touched.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
