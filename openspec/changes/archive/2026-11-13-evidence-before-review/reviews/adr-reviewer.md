Verdict: approved
Commit: b719a4127c59af0d6c5e12f9811d26fbdbe81409

## ADR review — evidence-before-review

### Findings
- [praise] docs/openspec-flow.md (Order of the delivery steps) — The verify-before-review order is documented without changing the locked gates or writer rules of ADR 0001 and ADR 0008.

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`, tag-pinning rule only), ADR 0007 (`docs/adr/0007-one-change-on-request.md`), ADR 0008 (`docs/adr/0008-reviews-as-a-workflow.md`). ADRs 0003 to 0006 are not touched by this diff. The project keeps no open-decisions log.

ADR 0001: the `nextStep` reorder in `plugins/openspec/hooks/deliver-check.mjs` is computed from files only, adds no state or process, and leaves the PR gate (approved reviews and evidence) unchanged.

ADR 0008: only the step order changed. The review round and its workflow rules are untouched.

ADR 0007: `/conduct` still takes its step order from `next.step`; the added sentence in `plugins/openspec/skills/conduct/SKILL.md` only describes the new order.

ADR 0002: the `CONTRIBUTING.md` release-tag text and the v0.13.0 pins in `docs/openspec-flow.md` are consistent with pinning projects to a tag's commit.

### Summary
- 1 finding (0 blocking, 0 important, 0 nit, 1 praise)
