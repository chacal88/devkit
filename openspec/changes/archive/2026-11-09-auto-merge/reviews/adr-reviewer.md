Verdict: approved
Commit: cba2f4484a9452a95615ee6eba015bb21ecc1f98

## ADR review — auto-merge (re-review, stale-only, range 55722bf..HEAD)

ADRs reviewed: [ADR 0001](../../../../../docs/adr/0001-coordination-without-a-harness.md), [ADR 0002](../../../../../docs/adr/0002-merge-without-the-owner-opt-in.md)

### Findings
- [nit] ADR 0002 does not state its relation to ADR 0001 · fixed in cba2f4484a9452a95615ee6eba015bb21ecc1f98 (ADR 0002 Context now says it builds on ADR 0001 and leaves its gates unchanged)

### Conformance notes (no new finding)
- [ADR 0001](../../../../../docs/adr/0001-coordination-without-a-harness.md): the new code keeps one capped wait. `waitForMerge` (plugins/openspec/hooks/deliver-check.mjs) cuts each `gh` call at the remaining cap, with no new scheduler, session or state file. The shared `makeGh` and `ghError` moved into merge-setup.mjs without changing who writes which gate file. `github-setup.mjs` still plans first and applies only confirmed items. The setup skill now makes the owner confirm the ruleset's required-checks list.
- [ADR 0002](../../../../../docs/adr/0002-merge-without-the-owner-opt-in.md): pinning the consumer workflow to the release tag's commit sha is described in the ADR, design D5, docs/openspec-flow.md, the template and the setup skill. A missing tag defers the item and never falls back to the tag or a branch. The opt-in, `--match-head-commit`, and the default of the owner's merge are untouched.
- The design's accepted exit-0 note for a checkout without `openspec/` and the accepted import cycle do not contradict either ADR.
- No open decision is touched.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit), the nit fixed
