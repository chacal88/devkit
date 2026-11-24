Verdict: approved
Commit: 849d5c70748ee4caba1fd2c26703aeb3b4418e6f

## Coverage analysis — stage-ceiling-consecutive (round 2, e7494d1..HEAD)

### Findings
- [important] plugins/openspec/hooks/project-loop.mjs:173 — project-loop blockedEnd passes failures but S12 had attempt == failures, so dropping `failures:` left every test green · fixed in 2222180
- [nit] plugins/openspec/hooks/change-loop.mjs:1279 — the `failures ?? attempt` fallback of the two fix briefs (lines 1279 and 1318) was untested · fixed in 2222180
- [nit] plugins/openspec/hooks/flow-check.mjs stageHistory — no test for a commit where the file is missing (deleted) nor for non-ASCII content (byte-offset parse of cat-file --batch); fixtures are ASCII only
- [nit] plugins/openspec/hooks/flow-check.mjs artifactState — history of the first failed file of a multi-file stage (specs) has no test
- [nit] openspec/changes/stage-ceiling-consecutive/proof/red-flow-check.txt — several new tests are red on old code for incidental reasons (stageHistory missing, params shape), not only the behavioural assertion; not a literal reporter-payload red run
- [praise] plugins/openspec/hooks/project-loop.test.mjs:1090 — the new project-loop test uses real committed review history with attempt 3 vs failures 2 and asserts both the positive and the negative match, so it goes red if the failures param is dropped
- [praise] plugins/openspec/hooks/flow-check.test.mjs AC-1..AC-7 — seam tests use real git repositories (real merge commits, shallow clones, missing git on PATH) and pin exact params

In-scope surfaces: plugins/openspec/hooks (flow-check.mjs, change-loop.mjs, project-loop.mjs) and their node:test files. Round 2 diff since e7494d1 is tests plus review/evidence docs only; no production code changed.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): project-loop blockedEnd failures -> caught by 'AC-6 project-loop: the ceiling reply says the failures in a row, not the attempt' (attempt 3, failures 2, doesNotMatch (3)); change-loop plan brief failures ?? attempt -> caught by the new plan-brief fallback test; change-loop fix-tests brief failures ?? attempt -> caught by the new fix-tests fallback test; all other seams from round 1 unchanged and still caught (history fact, walk, artifactState call, unreadable history, pass reset, retaken takes after merges, readout wording, change-loop blockedEnd failures).

Ran filtered: plugins/openspec/hooks/project-loop.test.mjs 143 of 143 pass; change-loop.test.mjs and change-loop-compozy.test.mjs filtered to 'stage-ceiling-consecutive AC-6': 4 of 4 pass.

### Well covered
- Project-loop ceiling reply says failures in a row with attempt and failures set apart (real committed review history).
- Fix-brief fallback to the attempt when the report carries no failures, in both the plan and the fix-tests briefs.
- Everything listed as well covered in round 1 (AC-1 to AC-7 of flow-check, review restart, fallbacks, readout wording, header and attempt unchanged).
