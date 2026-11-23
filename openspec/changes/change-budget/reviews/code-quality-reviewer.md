Verdict: approved
Commit: 897c7ee0d075ee4ae85e44bb12fa9ad33971416e

## Quality review — change-budget (round 1 of 2, second merge with main)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs spentOf — Keeping the first usage line per message id may undercount streamed output tokens; keep the max or document the rule.
- [nit] plugins/openspec/hooks/change-loop.mjs budgetOf / waiting-budget — With a project-level cap the reply points to the change's .openspec.yaml, whose devkit block may not exist; say it is created if missing.
- [praise] plugins/openspec/hooks/change-loop.mjs agent/sessionAction — The merge composes main's withAttribution with hold(guard(...)) at the single action-building point; hold stays after guard so no-progress ends keep priority.
- [praise] CHANGELOG.md, plugin.json, marketplace.json, docs/openspec-flow.md — The renumbering to 0.24.0 / 0.28.0 is consistent in every pin and the test still rejects the previous release's pin.

## Quality review — change-budget (round 1 of 2, second merge with main)

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: reviewed the net diff over main (ac40615..HEAD) for the lines this change owns after the second merge. Release files agree (marketplace 0.28.0, devkit-openspec 0.24.0, CHANGELOG 0.28.0 above 0.27.0, flow-doc pin v0.24.0 in all three places, test rejects v0.23.0). change-loop.mjs keeps withAttribution inside hold(guard(...)) for both agent and sessionAction. Pattern run budget|v0.24|pin|attribution in change-loop.test.mjs: 97/97 pass with TMPDIR=/var/tmp; scripts/check.py passes. The full suite was not run (1609/1609 reported at 0907857). The two earlier nits are unchanged and do not block.
