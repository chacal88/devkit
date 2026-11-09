Verdict: approved
Commit: 55722bf6a30ec7d49ebea78efb3187222f1d0ca5

## ADR review — auto-merge

ADRs reviewed: ADR 0001 (../../../docs/adr/0001-coordination-without-a-harness.md), ADR 0002 (../../../docs/adr/0002-merge-without-the-owner-opt-in.md, added by this change)

### Findings
- [nit] README.md:48 — [ADR 0001](../../../docs/adr/0001-coordination-without-a-harness.md) § Decision
  - What is wrong: the paragraph says `ship-change` drives a change "to a ready PR" and the new ADR 0002 paragraph follows, but ADR 0002 itself never states its relation to ADR 0001 (refines it for opt-in repos). A reader of ADR 0002 alone does not see that 0001's gates still hold.
  - Fix: add one line to ADR 0002 Context or Decision saying it builds on ADR 0001 and leaves its gates unchanged.

### Conformance notes (no finding)
- ADR 0001: nothing starts sessions or schedules wake-ups. `wait-merge` is the same single capped `--watch` as `wait-checks` (ship-change/SKILL.md Hosts). Auto-merge state is read from GitHub each run, with no new state file. `github-setup.mjs` writes only the workflow file and ruleset/repo settings, after a plan and confirmation. No gate file gains a second writer (`reviews/*`, `evidence.md` and `readiness.md` stay with their agents). The owner's plan approval stays human in every mode.
- ADR 0002 matches design D10 and the implementation: opt-in per schema via `ship`; `enable-auto-merge` pinned with `--match-head-commit`; `disable-auto-merge` when below 8/8 (deliver-check.mjs:671); `stop-merge-setup` blocks instead of downgrading (:679); `commit-and-pr` never merges; the default stays the owner's merge.
- ADR 0002 is cited by README.md:50, docs/openspec-flow.md:232, CONTRIBUTING.md:7 and openspec/config.yaml:15. The ship-change "Never" rule limits `gh pr merge` to `--auto` and `--disable-auto`.
- No open decision is touched. Round 3's bypass is named as out of scope in ADR 0002 and proposal.md.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
