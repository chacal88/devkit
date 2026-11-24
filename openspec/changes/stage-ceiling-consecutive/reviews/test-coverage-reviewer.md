Verdict: rejected
Commit: e7494d13b825aa2245b663e44be1abe4d6001511

## Coverage analysis: stage-ceiling-consecutive (origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/project-loop.mjs:173 — [5] project-loop blockedEnd passes failures but S12 has attempt == failures (2), so dropping `failures:` leaves every test green; write a case with attempt != failures in project-loop.test.mjs next to S12
- [nit] plugins/openspec/hooks/change-loop.mjs:1279 — [3] the `failures ?? attempt` fallback of the two fix briefs (lines 1279 and 1317) is untested; every updated test passes failures
- [nit] plugins/openspec/hooks/flow-check.mjs stageHistory — [4] no test for a commit where the file is missing (deleted) nor for non-ASCII content (byte-offset parse of cat-file --batch); fixtures are ASCII only
- [nit] plugins/openspec/hooks/flow-check.mjs artifactState — [2] history of the first failed file of a multi-file stage (specs) has no test
- [nit] openspec/changes/stage-ceiling-consecutive/proof/red-flow-check.txt — several new tests are red on old code for incidental reasons (stageHistory missing, params shape), not only the behavioural assertion; acceptable, not a literal reporter-payload red run
- [praise] plugins/openspec/hooks/flow-check.test.mjs AC-1..AC-7 — seam tests use real git repositories (real merge commits, shallow clones, missing git on PATH) and pin exact params, so the history fact, the walk and the fallbacks would all go red if broken

In-scope surfaces: plugins/openspec/hooks (flow-check.mjs, change-loop.mjs, project-loop.mjs) and their node:test files.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): history fact -> caught by AC-1/2/3/7; walk failures>=ceiling -> caught by AC-1/AC-2 + deepEqual params; artifactState failuresInARow call -> caught by 'no history fact' subtest + unit test; history read only for failed numeric-ceiling stage -> caught by spy test; unreadable history -> caught by F-1..F-4; pass resets / review restart -> caught by AC-3 and AC-2 restarted round; retaken takes after merges -> caught by AC-7; change-loop blockedEnd failures -> caught by the loop test (attempt 5, failures 3); readout en/pt-BR -> caught by AC-6 regexes and SAMPLE snapshots; project-loop blockedEnd failures -> gap (F1); fix-brief fallback -> gap (F2).

Ran plugins/openspec/hooks/flow-check.test.mjs filtered: 145 of 145 pass.

### Well covered
- Failures since the last pass (AC-1 to AC-3) with real git history and exact params.
- Review round restart: no attempt subtracted (unit and restarted-round case).
- Fallbacks: no repository, no git, depth-1 clone and an uncommitted file give today's rule; depth-2, unknown-commit pass and uncommitted overwrite are counted as the history shows.
- Retaken takes after merges of main (AC-7) with real merge commits.
- Readout wording in both languages (anchored whole-line regexes, updated samples).
- Header and attempt unchanged (AC-5): attempt stays 3 in every params assertion.
- Loop reply for the ceiling with attempt and failures set apart.
