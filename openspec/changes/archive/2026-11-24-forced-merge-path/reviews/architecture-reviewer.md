Verdict: approved
Commit: 8dcee767e6571680c851906a17ba978980a1316a

## Architecture review: forced-merge-path (round 2, c30bfb8..8dcee76)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:946 — gatesAtHead called verdictAllowed without the open flag main added (jira-entry-followups D-2), so a forced merge read an approved verdict with an undisposed finding as passing while readReviews read it as stale. · fixed in 0934b6364bbec1408604774fcb91fa92a39e2232
- [nit] plugins/openspec/hooks/change-loop.mjs:1351 — buildPart reads row.next.forced at two sites; one flag on the row spec would keep the forced notion in one place (unchanged).
- [nit] plugins/openspec/hooks/deliver-check.mjs:852 — forcedChecks/gatesAtHead restates the local currency rule with a net-diff compare; name both in the next staleness ADR. F1 was a concrete drift of it, now closed by findingsOfText plus the open flag.
- [nit] plugins/openspec/hooks/deliver-check.mjs:942 — After a forced merge every later collectState re-reads rules, rollup and gate files until the archive lands; skip the gate read once retro.md exists if latency shows (unchanged).
- [praise] plugins/openspec/hooks/deliver-check.mjs:555 — The fix adds no new home. findingsOfText is split out of findingsOfFile with an injected inHead predicate, so disk reads and GitHub reads share one disposition parser and one currency rule.

Analyzed: owners findingsOfText, findingsOfFile, verdictAllowed and gatesAtHead in deliver-check.mjs; boundaries: the gate read at the merged head goes only through ghJson (GitHub compare route), and the merge of train 12 only renumbered the release, with CHANGELOG as the only conflict; contract consumers: verdictAllowed has two callers, readReviews and gatesAtHead, and both now pass the open flag; findingsOfFile keeps its signature, with undisposedIn and its other callers unchanged; deletion tests: findingsOfText is the shared parser both readers use, so inlining it would copy the disposition grammar into two sites (passes, it has depth). Tests: G11 and G12 run alone in the foreground, 2 pass and 0 fail. The caller's runs after the merge (243, 203, 201 and 226 tests, all exit 0) are taken as given. No blocking finding.
