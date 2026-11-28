<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> forced-merge-release-edit: on an owner's forced merge, `gatesAtHead` reads each gate file through a GitHub compare whose files must all be under `openspec/` or allowed by `verdictAllowed`, so the commit of the `assign-release` step lists `evidence.md` and each approved review as open items. Give `gatesAtHead` the release-edit allowance (allow the files of a commit that carries `Release-change: <id>`, or apply the release mask), drop the forced-merge sentence release-at-merge wrote into that requirement, and add a test: a noted change whose compare from the evidence commit lists only the step's release files opens no gate.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
