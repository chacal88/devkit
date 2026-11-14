Verdict: approved
Commit: 307e1f54ea97c27a45796299bbaeb918bf5c3102

## ADR review — compozy-loop-v2 (stage 1, round 2)

### Findings
- [blocking] design.md (Context, D1/D7/D9); plugins/compozy/README.md:43-44; the loop templates — REQUIRES SUPERSEDER - CompozyOS as the loop driver contradicted ADR 0001's harness ban and ADR 0006's named rejection of a 'Compozy-style daemon', unrecorded. · fixed in fd0e3de
- [important] design.md, D12 ("No new ADR, and no ADR changes") — D12's conclusion that no new ADR was needed was unsound against openspec/config.yaml's own rule and never checked ADR 0005-0007. · fixed in 70595db
- [important] .claude/settings.json enabledPlugins; proposal.md AC-9 — The proposal claimed repository adoption of the kit while .claude/settings.json never enabled devkit-compozy@devkit. · refuted: proposal.md AC-9 (commit 70595db) narrows 'adoption' to the installed files only, deferring enablement to a dated Workflow follow-up entry in tasks.md (dated 2026-11-14) with the devkit-panel precedent (pack merged in one PR, enabled in a separate one)
- [important] openspec/changes/compozy-loop-v2/evidence.md:47 — A literal Markdown link embedded in evidence.md made python3 scripts/check.py's exit criterion fail; evidence.md was regenerated without the bracketed link syntax and scripts/check.py now passes ("all checks passed", exit 0). · fixed in 06cab41

ADRs reviewed: ADR 0001 through ADR 0008, plus ADR 0009 (`docs/adr/0009-compozy-loop-as-a-second-driver.md`), new in this round.

### New checks this round
- Read ADR 0009 in full: it names the fired review trigger, states the exception decision with its reasons (the gates stay in the checkers; the repository and GitHub stay the source of truth; opt-in per ADR 0004), carries its own Review trigger section, and an alternatives table that considered and rejected the superseder form on stated grounds. No conformance issue.
- Confirmed D13's version and tag mechanics against ADR 0004 and `CONTRIBUTING.md`: `project-settings.mjs` gained `devkit-compozy` in `PACKS`, `devkit-openspec`'s `plugin.json` and `marketplace.json` versions moved 0.13.0 to 0.14.0 together, `CHANGELOG.md` gained the matching line, and the tag is deferred to a post-merge follow-up step. Consistent with the project's conventions, not itself an ADR matter.
- Ran `node --test plugins/openspec/hooks/guard.test.mjs` live at this commit: 668 of 668 pass; both regressions the first round recorded are gone. `tasks.md` phase 8 is fully ticked, matching the gate result.
- Scanned the rest of the diff (the `loop.yaml` guard fix, `docs/openspec-flow.md`, `marketplace.json`, `CHANGELOG.md`) for anything new touching ADR territory: none found.

### Summary
- 4 findings carried from round 1, all disposed (0 blocking open, 0 important open, 0 nit): three fixed, one refuted.
