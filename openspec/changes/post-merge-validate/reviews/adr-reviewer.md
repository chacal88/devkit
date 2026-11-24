Verdict: rejected
Commit: 24725d7f44ce1297d6729258875fd5a93e126a32

## ADR review — post-merge-validate

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs:2739 and 2792-2796 — merge-check is a command-only session step but is missing from COMMAND_STEPS, so the CompozyOS view hands it to a coordinator agent with a brief naming a ship-change row that does not exist; this drifts from ADR 0024 decision 4 (deterministic command steps run by the loop with no agent). Fix: add it to COMMAND_STEPS with a compozy test, or record the kit's view as out of scope in the design.
- [nit] docs/adr/0017-a-change-state-is-derived-in-one-place.md, third Note in Context — The Note keeps the words 'status: proposed' for good, though the ADR is accepted and nothing flips them (readiness L-6); reword the Note without a status clause.
- [nit] plugins/openspec/hooks/change-loop.mjs:1365-1376 and redsAfter — The loop keeps its own count of reds against ceilings.default, outside the checker that ADR 0010 decision 3 says counts attempt ceilings; the intent holds, so cite decision 3 in the design in one sentence.

## ADR review — post-merge-validate

ADRs reviewed: ADR 0010, 0016, 0017 (with the proposed Note), 0019, 0020, 0022, 0024, 0025, 0026 (paths under `docs/adr/`).

No blocking violation. The Note on ADR 0017 is the place the owner chose for the merge-check record, and the plan approval accepts it, as `decisions.md` and `approval.md` record. The step, its record and its replies keep ADR 0010's four ends and the ADR 0011 and ADR 0016 write limits. The release files are bumped together.

### Summary
- 3 findings (0 blocking, 1 important, 2 nit)
