<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> `isOwnPr` in `plugins/openspec/hooks/deliver-check.mjs` drops any pull request that touches `openspec/changes/archive/`, so a change whose own pull request edits another change's archived files is never found after its merge and `/devkit change` asks to open it again; refuse only a pull request that touches the change's own archive folder, and pin it with a test

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
