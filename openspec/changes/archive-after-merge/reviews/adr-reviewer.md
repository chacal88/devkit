Verdict: approved
Commit: d50ffb134c0486372e7b44e2888c211b099bfe99

## ADR review — archive-after-merge (re-review, range e497cc2..HEAD)

ADRs reviewed: ADR 0001 (`docs/adr/0001-coordination-without-a-harness.md`), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`). ADR files untouched in the range.

### Findings
- [important] `docs/adr/0003-auto-merge-the-archive-pr.md` § Consequences — the text no longer matches the behaviour.
  - What is wrong: the ADR records as accepted that `devkit-reviews` gates nothing on an archive PR. Since d50ffb1, `deliver-check --ci` (`plugins/openspec/hooks/deliver-check.mjs`) detects an archive PR by its archived folder and fails on a missing retro, an unanswered proposal or an unnamed file. The Decision section's file rule says "outside `openspec/`"; the implementation exempts only `openspec/changes/**`, `openspec/roadmap.md` and the release files, so `openspec/config.yaml` and `openspec/schemas/**` now need a named proposal. Both changes are stricter than the ADR, so the decision is not violated.
  - Fix: the owner decides whether to amend or supersede ADR 0003 so the Negative consequence and the file rule match. Until then, `docs/openspec-flow.md` and design D8 (which already describe the new behaviour) are ahead of the ADR. This is not blocking.

### Conformance checks
- ADR 0003: the auto-merge conditions are unchanged and are now enforced earlier and in CI, which is the intent of the owner-answer and file-check gate. `--match-head-commit` pinning and disable-on-drop are kept (P3a now also covers unanswered proposals and unnamed files). Nothing pushes to the default branch.
- ADR 0003 review trigger ("an archive PR merges a file the owner did not approve"): the new CI check lowers the chance of this.
- ADR 0001: no new coordinator, daemon, hook-driven loop or state outside the repo and GitHub. The CI check derives everything from the PR's changed paths and the retro file. The `gh pr view` body reads and `maxBuffer` are stateless.
- ADR 0002: unchanged in the range, and nothing in the range touches the owner opt-in rules.
- Open decisions: none touched.

### Summary
- 1 finding (0 blocking, 1 important, 0 nit)
