Verdict: approved
Commit: 65f22c441ddc35b8afd2374365f046393aaaf7dc

## ADR review — state-skips-unlocated

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1790; openspec/changes/state-skips-unlocated/requirements.md:35 — nextAction does not use unplacedAction, so next --change still exits 3 where state says blocked; an owner-approved non-goal, drift from ADR 0017 decision 1's one-place intent only; cite the ADR if a later change makes next succeed.

ADRs reviewed: ADR 0017 (docs/adr/0017-a-change-state-is-derived-in-one-place.md), ADR 0020 (docs/adr/0020-a-change-can-run-on-another-machine.md), ADR 0021 (docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md), ADR 0026 (docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md), ADR 0002 and ADR 0003 (CI pin and release), ADR 0010 and ADR 0014 as cited from ADR 0017.

Conformance: the one shared helper unplacedAction builds the blocked stand-in with the existing reason wrong-branch and is called by both the state command and the roadmap facts collector (ADR 0017 decisions 1 and 2). No ADR or spec pins locate's order, and the new step applies only in the case the spec names. The moved tests import no other test file and the shared helpers live in change-loop-fixtures.mjs (ADR 0026 decision 3). The release bumps the plugin and the marketplace, moves the CI pin to v0.38.1 and adds the CHANGELOG entry; the v0.38.1 tag is owed after merge per CONTRIBUTING.md. No open-decisions log exists in the repo. No tests were run by this review, as instructed.

### Summary
- 1 finding (0 blocking, 0 important, 1 nit)
