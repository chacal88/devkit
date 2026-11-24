Verdict: rejected
Commit: c30bfb8d0761b3f7f73f1f8ceaf94b8736f2ea53

## Architecture review: forced-merge-path (stale-only re-review, 470a8ca..c30bfb8)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:946 — gatesAtHead calls verdictAllowed without the open flag main added (jira-entry-followups D-2), so a forced merge reads an approved verdict with an undisposed finding as passing while readReviews reads it as stale; the retro under-reports a gate. Reuse one currency rule or test and record the divergence.
- [nit] plugins/openspec/hooks/change-loop.mjs:1351 — buildPart reads row.next.forced at two sites; one flag on the row spec would keep the forced notion in one place (round 1, unchanged).
- [nit] plugins/openspec/hooks/deliver-check.mjs:852 — forcedChecks/gatesAtHead restates the local currency rule with a net-diff compare; name both in the next staleness ADR (round 1; F1 is a concrete drift of it).
- [nit] plugins/openspec/hooks/deliver-check.mjs:942 — After a forced merge every later collectState re-reads rules, rollup and gate files until the archive lands; skip the gate read once retro.md exists if latency shows (round 1, unchanged).
- [praise] plugins/openspec/hooks/guard.mjs:565 — No new home: valueIn, requiredChecks, readContents and verdictAllowed are reused, and unreadable reads fail closed as blocked; main's trains 7-8 compose with the forced path (carried === null guard, locate fallback, unplacedAction, FLOW_VERSIONS).

Analyzed: owners deliveryOf/forcedMerge/forcedChecks/gatesAtHead in deliver-check.mjs and buildPart in change-loop.mjs; boundaries: the locate fallback and unplacedAction do not reach a forced-merged change because main holds its folder, deliveryOf keeps the carried === null guard, FLOW_VERSIONS matches the shipped flow.json versions; contract consumers: verdictAllowed gained an optional open parameter with two callers (readReviews passes it, gatesAtHead does not, see F1); reply --stdin and the slice-machine message touch nothing the forced path uses; deletion tests: no new module or home in the range. ADR 0028 only had its Number line renumbered. No test was run: the caller's run of the touched files (13 files, 1931 tests, 0 fail) is the evidence. No blocking finding.
