Verdict: approved
Commit: a4f215885a9627fefa1348001fd2374c11bbd7e5

## Quality review — test-map-hub-links (round 2)

### Findings
- [nit] plugins/openspec/hooks/test-suite.test.mjs:1087 — One test still covers AC-1 to AC-4; a red names the message, not the AC (round 1 nit, unchanged). The new AC-3 and AC-4 tests are split per hub.
- [nit] CONTRIBUTING.md:44 — Wording 'runs none of their code' still differs from design D-4, which keeps tests that run hub code beyond load (round 1 nit, unchanged).
- [praise] plugins/openspec/hooks/test-suite.test.mjs:1141-1176 — hubLinkProblems and suiteStem are unit-tested with positive and negative cases. The per-hub real-map tests report missing and extra separately, which closes the kept-readers gap.
- [praise] plugins/openspec/hooks/test-suite.test.mjs:1124-1138 — KEPT_HUB_READERS holds 24 and 29 stems, matching the 53 kept rows of design.md, so the map is checked against an independent statement of intent.

### Scope
This round re-checks my round 1 findings and the lines changed since 76b2987d. Outside openspec/, one file changed: plugins/openspec/hooks/test-suite.test.mjs (+55, commit cfaefc9f). CONTRIBUTING.md, scripts/ and the map are untouched since round 1.

### Previous findings
Round 1 had no blocking or important finding from me. Its two nits are unchanged and listed as F1 and F2. The one important finding of the round-1 bench (kept hub readers not pinned) came from test-coverage-reviewer; the fix is confirmed below.

### Re-check of cfaefc9f
- KEPT_HUB_READERS holds 24 stems for change-loop.mjs and 29 for deliver-check.mjs, 53 in total, equal to the number of kept rows in design.md.
- suiteStem throws unless a stem names exactly one suite file; the unit test covers the 0-match case.
- hubLinkProblems ignores order, reports missing and extra separately and sorts the result. The unit test covers equal sets, reordered, missing, extra, both, an absent key and an unknown stem.
- The real-map tests read the map through suiteScript.readTestMap and compare it to the kept list, so removing a kept reader or re-adding a dropped link turns them red.
- Run alone: env TMPDIR=/var/tmp/devkit-suite node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs gave 1 files, 72 tests, 72 pass, 0 fail, 14.8s.
- evidence.md says the whole-suite rows were not re-run at cfaefc9f. The task brief records a later whole-suite run on the head with 3900 tests, 0 fail.

### Summary
- 4 findings (0 blocking, 0 important, 2 nit) + 2 praise.
- Justification: re-review limited to the round 1 findings and the cfaefc9f diff. The helper and tests are correct and close the gap the bench raised. The test file passes alone. The two remaining nits are optional and unchanged. No blocking or important finding is open from this reviewer.
