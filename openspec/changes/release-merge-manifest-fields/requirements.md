<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> release-merge-manifest-fields: `release-merge.mjs --merge` refuses a head whose manifest changes anything but the version, so a change that edits a pack's description cannot ride a train (project-setup, pull request 148, was left for it). Renumber the version and keep the head's other manifest fields when only one side changed them, refusing only a field both sides changed, with a test of each case.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
