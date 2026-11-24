<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> Fix the devkit test suite on macOS: under the default TMPDIR the suite runner nests each file TMPDIR under realpath(tmpdir())/devkit-suite-<6>/<n>/, so the fake CompozyOS daemon socket path in test-fixtures.mjs daemon() reaches 111 bytes and macOS caps a Unix socket path at 104; 32 compozy tests fail with listen EINVAL. The suite must pass on macOS with the default TMPDIR, keep the leftover check, and keep passing in CI.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
