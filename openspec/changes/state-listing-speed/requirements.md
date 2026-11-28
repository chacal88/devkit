<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> make the `state` listing fast enough for the coordinator's status bar, whose call is bounded at 20 s; on this repository `state --offline` over 11 changes takes 37 to 45 s, about 5 s per change read one after another, so the coordinator bar prints nothing. Read the changes in parallel, or skip the per-change reads the offline listing does not need.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
