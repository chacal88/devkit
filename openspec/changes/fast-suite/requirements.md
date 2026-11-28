<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> fast-suite: the whole suite took about an hour on the owner's machine (measured 2026-11-28: 44 files, 3903 tests, 950 s in a single run at concurrency 14 with a load average of 35 to 43, the nine slowest files between 8 and 16 minutes each). A change's own gate should run only the tests its files map to (`node scripts/test-suite.mjs --own-files`) and the whole suite once, at the train or in CI, not at every gate and every merge of the base; the runner's concurrency should stop at what the machine can carry; the files that dominate the time should be split or their fixtures made cheaper; `test-private-tmpdir` and `own-files-by-content` fold into it. Done when the whole suite takes at most 5 minutes on the owner's machine with no other suite running, and CLAUDE.md, CONTRIBUTING.md and docs/openspec-flow.md state the new gate rule. (roadmap item `fast-suite`, Round 29)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
