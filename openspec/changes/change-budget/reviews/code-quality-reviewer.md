Verdict: approved
Commit: 7017229d317b12833ae8c72914f86ac3c1bf77ba

## Quality review — change-budget (round 1 of 2)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs spentOf — Keeping the first usage line per message id may undercount streamed output tokens; keep the max or document the rule.
- [nit] plugins/openspec/hooks/change-loop.mjs budgetOf / waiting-budget — With a project-level cap the reply points to the change's .openspec.yaml, whose devkit block may not exist; say it is created if missing.
- [praise] plugins/openspec/hooks/change-loop.mjs hold/budgetOf — One hold wrapper at the single action-building point, validated cap, fail-open transcript lookup.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:3523 — budgetFiles now uses the shared tmpFolder helper, so budget fixtures are cleaned up like the rest of the file.

## Quality review — change-budget (round 1 of 2)

### Summary
- 3 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: the range since a5f11db holds the merge with main (f5075ff) and the evidence commit (7017229). The release files are consistent (marketplace 0.27.0, devkit-openspec 0.23.0, CHANGELOG entry, flow-doc pin v0.23.0 in all three places, no v0.22.1 left). The budget test helper uses the shared tmpFolder. The 41 change-budget tests pass with TMPDIR=/var/tmp; the full suite was not run (1573/1573 reported). Code in guard.mjs and change-loop.mjs is unchanged in this change's own lines since the last approval, so the two earlier nits stand and do not block.
