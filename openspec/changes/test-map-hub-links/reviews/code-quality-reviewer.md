Verdict: approved
Commit: 76b2987d2fe5e6e0cd31cdd109057f2a2ba26348

## Quality review — test-map-hub-links (round 1)

### Findings
- [praise] plugins/openspec/hooks/test-suite.test.mjs:1037-1121 — The durable guard is a data test with the invariant, layer and suite named, a helper (isDocumentKey, slowDocumentLinks) with its own positive and negative unit tests, and a no-script-change choice that avoids an M8 making every script edit run the slow tests; the proofs (read tracer, V8 coverage per test file) are committed verbatim and reproducible, and the red-before case is shown in reader-fails.txt.
- [nit] plugins/openspec/hooks/test-suite.test.mjs:1087 — One test covers AC-1 to AC-4 with many assertions; if a reader or a dropped link regresses, the failure names the message but not the separate AC, so a split into one test per AC would make a red easier to read.
- [nit] CONTRIBUTING.md:44 — The added sentence says the hub keys leave out a test that 'runs none of their code', while the rule applied (design D-4) keeps a test reached only through fixtures when coverage shows it runs hub code beyond load (guard is kept this way); wording 'runs none of their code beyond loading them' would match the rule.

## Quality review — test-map-hub-links (round 1)

### Summary
- 3 findings (0 blocking, 0 important, 2 nit) + 1 praise
- Justification: reviewed origin/main...HEAD (map data, the new pin tests, the CONTRIBUTING sentence, the plan files and the proof files). Independently verified: 56 document keys in scope, 35 removed and 21 narrowed or relinked, as the proposal states; only the two hub keys change beyond them; slow and shared untouched; no empty list; the dropped hub links are tests that do not import change-loop.mjs or deliver-check.mjs (checked by grep, and deliver-check.mjs/conduct-check.mjs do not import change-loop.mjs); the 3 new tests pass when run alone; python3 scripts/check.py prints all checks passed; commits after ad182dd2 (the evidence head) touch only openspec/ files; the Markdown-only run (37 s) plus the fixed CI part (10 s) is under 2 minutes; test names between base, head and train runs are identical after removing the 3 new tests; the reader-fails proof shows a renamed roadmap heading fails the selected guard test. Residual risks accepted by the plan: slow readers of narrowed documents run only on the train (owner accepted, requirements question 1), the read tracer covers only five fs functions in Node processes (non-Node children covered by the recorded grep), and the hub coverage is a single run on the base.
