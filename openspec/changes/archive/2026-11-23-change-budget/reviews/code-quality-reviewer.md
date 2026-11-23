Verdict: approved
Commit: 7c12aa3f8b66039ddab7d3a3c1c3c13a8ff26ee4

## Quality review — change-budget (round 1 of 2, third merge with main)

### Findings
- [nit] plugins/openspec/hooks/guard.mjs spentOf — Keeping the first usage line per message id may undercount streamed output tokens; keep the max or document the rule.
- [nit] plugins/openspec/hooks/change-loop.mjs budgetOf / waiting-budget — With a project-level cap the reply points to the change's .openspec.yaml, whose devkit block may not exist; say it is created if missing.
- [praise] plugins/openspec/hooks/change-loop.mjs:539-542 — After the merge, 'waiting-budget': 'budget' sits in main's single GATE_OF_WHY, and roadmap-loop.mjs no longer keeps a copy, so the gate has one owner. A new test covers it as an end and as a declared wait, in both languages.
- [praise] CHANGELOG.md, plugin.json, marketplace.json, docs/openspec-flow.md — The renumbering to 0.25.0 / 0.29.0 is consistent in every pin (manifests, CHANGELOG 0.29.0 above 0.24.0 entry, flow-doc v0.25.0 in both places), and the docs test checks v0.25.0.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise
- Justification: I reviewed this change's net diff over main (90c9786..HEAD) for the lines that moved in the third merge: the release renumbering, the GATE_OF_WHY move, the merged import line, and the new gate test. Release pins agree: marketplace 0.29.0, devkit-openspec 0.25.0, CHANGELOG 0.29.0, flow-doc v0.25.0. change-loop.mjs imports sessionTranscript and spentOf next to main's isChangeId, readRoadmap, readValue and isDecisionRecord, with no duplicate or missing symbol. I ran the pattern budget|v0.25 over change-loop.test.mjs and roadmap-loop.test.mjs with TMPDIR=/var/tmp: 84/84 pass. I did not run the full suite; the caller reports 1754/1754 at bf77a9f. I did not re-check that the test rejects v0.24.0, since I only searched the hook tests for v0.24.0 and v0.25.0. Both earlier nits are unchanged and do not block.
