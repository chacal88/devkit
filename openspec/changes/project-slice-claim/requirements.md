<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> a `/devkit project` slice is a change on `devkit-project`; today `open` claims a change on `origin` when it opens, but a slice opened through `project-loop.mjs` shares `openCheckout` and takes no claim, so two machines can still open the same slice. Make the slice open take the same create-only claim (branch pushed at once with the machine name in `.openspec.yaml`), refuse a slice already claimed, and show it in `/devkit status` and the roadmap with its machine; the claim keys are written before the version pin, as `remote-worker` does (remote-worker retro, `design.md` Non-Goals)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
