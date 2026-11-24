Verdict: approved
Commit: 470a8ca1785f800a8d4ee4d5858be00edc9e6d61

## Architecture review: forced-merge-path (stale-only re-review, d0a2b37..HEAD)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1349 — buildPart reads row.next.forced at two sites (skip testStageStep, attach reply); one flag on the row spec would keep the forced notion in one place
- [nit] plugins/openspec/hooks/deliver-check.mjs:852 — forcedChecks/gatesAtHead restates the currency rule of local staleness with a net-diff compare; name both in the next staleness ADR
- [nit] plugins/openspec/hooks/deliver-check.mjs:942 — after a forced merge every later collectState re-reads rules, rollup and gate files until the archive lands; skip the gate read once retro.md exists if latency shows
- [praise] plugins/openspec/hooks/guard.mjs:565 — No new home: valueIn cut out of readValue, requiredChecks/readContents/verdictAllowed reused, unreadable reads fail closed as blocked

Analyzed: owners deliveryOf/forcedMerge in deliver-check.mjs (state, GitHub reads), buildPart in change-loop.mjs; boundaries deliver-check to change-loop, forced path versus train-carried path (carried === null guard), the new folderDirty commit step (pre-review only, never after a merge); contract consumers: none changed since round 1; deletion tests: no new module or home in the range (round 1 result stands). The two merges of main (train 4: archive-release-pin; train 6: post-merge-validate and loop-place-and-evidence) compose with the forced-merge path without friction, and the resolutions of the docs, ADR 0003, config, CHANGELOG, skills and the two test files show no design friction. The release renumbering (devkit-openspec 0.43.0, marketplace 0.48.0) leaves ADR 0028 and the spec rule unchanged. Tests: a focused run of the forced tests in deliver-check-archive.test.mjs did not finish inside the 120 second foreground limit and was stopped, so no focused test result is claimed; the caller's run of the touched files (1268/1268) is the evidence. No blocking or important finding.
