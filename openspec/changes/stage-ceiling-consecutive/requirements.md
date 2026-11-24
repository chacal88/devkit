<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> `flow-check.mjs` blocks a stage with `ceiling-reached` when its header says `result=failed` and `attempt >= ceiling`, but `attempt` is one more on each rewrite, so a stage that passed at attempts 1 and 2 (rewritten after code changed) and failed at attempt 3 is blocked at the first failure after two green runs (remote-worker, the evidence stage, 2026-11-23: two defects found and fixed, the loop declared `blocked: ceiling`, and only the owner's authorization ran a fourth attempt). Count the failures since the last passed attempt, keep `attempt` as it is, and pin it in `flow-check.test.mjs`

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
