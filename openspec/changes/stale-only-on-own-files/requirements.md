<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> One change for three roadmap lines that all cut the time a change loses when the default branch moves, asked by the owner on 2026-11-23 after a day where every merge of main made the other changes redo their evidence and reviews ("nao e possivel demorar tanto"). Tick all three lines in openspec/roadmap.md when this change is archived.
>
> stale-only-on-own-files: a merge of the default branch that changes none of a change's files (outside its release files) leaves its evidence and reviews current, so a busy `main` does not cost a whole suite and a review per merge (change-state retro, learning 3)
>
> fresh-base-check: the delivery loop fetches origin/<base> before it judges a pull request's conflict or decides update-branch, so a step never says the base merges cleanly from a stale copy (review-writer-prompt retro, item 3)
>
> post-merge-validate: after a merge from the base, the delivery loop runs `openspec validate <id> --strict` before the evidence and sends a failure to the planner as a merge defect, and an evidence attempt that a base merge made stale or red does not count toward the stage's limit; in stage-roles a merge from main left the roadmap-coordination delta without main's new scenario, and the evidence's third attempt hit the limit (stage-roles retro, item 3)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
