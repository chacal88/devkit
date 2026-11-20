Verdict: approved
Commit: 07a85c411ee58cafd43ddd663a9176eb821b5c65

## ADR review: flow-script-checker

### Findings
- [nit] docs/coordination-design.md:61 and docs/adr/0010-openspec-as-the-harness.md Note (flow-script-checker) — ADR 0010 decision 3 says stages unlock when OpenSpec reports zero pending tasks; the checker excludes fenced examples (recorded in an ADR Note), but coordination-design still states the unqualified rule; add the qualification or point at the Note.
- [nit] plugins/openspec/hooks/guard.mjs sessionChange message — The session-start message names flow-check as the next-stage oracle and ship-change as the driver and omits /conduct, while ADR 0010 decision 7 keeps /conduct, conduct-check and deliver-check driving until round 15; reword to say flow-check is the read-only readout.
- [praise] plugins/openspec/schemas/devkit/schema.yaml, devkit-lite/schema.yaml, flow.json — Conforms to ADR 0010 decisions 1 and 3: roles replace Claude tool names, the header carries result, attempt and commit, the loop ends in the four named states, and the schema copies are byte-identical.
- [praise] .github/workflows/ci.yml and the four install lines — Pinning OpenSpec to major 2 (CI 2.0.0) matches the ADR 0010 mitigation that each project pins its OpenSpec version.

ADRs reviewed: ADR 0010 (docs/adr/0010-openspec-as-the-harness.md, decisions 1 to 8), ADR 0004 (docs/adr/0004-devkit-per-project.md), ADR 0002 and ADR 0003 (unchanged by this diff). ADR 0001 and ADRs 0005 to 0009 were read only through ADR 0010's supersession and exception list. The gate suite was not re-run.

Implementer decisions judged: (1) and (2) are checker mechanics no ADR locks. (3) rule 6 is consistent with decision 3, where waiting for the owner is an end state. (4) an archived change ending `archived` matches the four end states. (5) skipping staleness after a merged PR on a foreign branch conflicts with no ADR; ADR 0002 and ADR 0003 are untouched and flow-check writes nothing. (6) the checker's own git helpers touch no ADR. (7) the `@2` pin conforms to the ADR 0010 mitigation.

Other checks: the header's field names were an open decision in coordination-design section 8, and the change resolves and records them explicitly (requirements OD-1, proposal 'decided here'), so it is acknowledged. Attempt ceilings live in flow.json under openspec/, with a config override deferred to the round 15 devkit: block (design D-5), which is consistent with decision 1's build order. ADR 0004 opt-in holds: flow-check refuses a schema with no flow.json that is not a devkit schema.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit, 2 praise)
