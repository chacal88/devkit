<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> the whole suite takes about 43 minutes (2356 tests, 40k lines under plugins/openspec/hooks, most of it tests) because `plugins/openspec/hooks/guard.test.mjs` imports every test file into one process and Node runs them nearly in series. Run the test files directly and in parallel (`node --test plugins/openspec/hooks/*.test.mjs`), each with its own `TMPDIR` (the "leaves no temporary folder" tests compare the whole folder), then change the test command in CLAUDE.md, CONTRIBUTING.md, docs/openspec-flow.md and the CI snippet; keep one command that runs everything. Asked by the owner on 2026-11-23 after 43-minute runs on a loaded machine.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
