<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> after a merge from the base, the delivery loop runs `openspec validate <id> --strict` before the evidence and sends a failure to the planner as a merge defect, and an evidence attempt that a base merge made stale or red does not count toward the stage's limit; in stage-roles a merge from main left the roadmap-coordination delta without main's new scenario, and the evidence's third attempt hit the limit (stage-roles retro, item 3)
>
> Asked by the owner on 2026-11-23 among the changes that cut the slowness of a busy main ("nao e possivel demorar tanto"); sibling changes in flight: stale-only-on-own-files and delivery-merge-hold.

## Classification

domain=process, type=feature, flags=[contract] (strict-assumed: it adds a step and a hand-off to the loop that other parts of the flow read).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Scope line (answered by the coordinating session under the owner's delegation, 2026-11-23): this change delivers only the first half of the request, the post-merge `openspec validate <id> --strict` and the hand-off of its failure to the planner as a merge defect. Counting a stage's attempts by real failures stays whole in the roadmap line `evidence-attempts-by-failure`; this change touches no attempt counter (`attempt=` in a stage header, `ceilings` in `flow.json`, `raw.attempt >= ceiling` in `plugins/openspec/hooks/flow-check.mjs`).
- The roadmap line `- [ ] post-merge-validate` in `openspec/roadmap.md` is trimmed to that half and says the attempt counting moved to `evidence-attempts-by-failure`.
- "A merge from the base" is any merge commit in the branch's history that brought `origin/<base>` into the branch since the last green check: a local `git merge origin/<base>`, the merge that `resolve-release-conflict` commits, and the `git pull --ff-only` that follows `update-branch`. The exact detection (a commit walk, a marker file) is the design's.
- The check is `openspec validate <id> --type change --strict`, run in the change's root by `plugins/openspec/hooks/change-loop.mjs` as a step of `next`, before the loop hands the evidence (`verify`). It is the only check added; `scripts/check.py`, the catalog check and the test suite stay where they are.
- A red check hands `devkit-core:change-planner` (owner of `proposal.md`, `design.md`, `tasks.md` and the spec deltas) with a brief that says the failure is a merge defect and quotes validate's errors. It spends no attempt of any stage: the headers of `evidence.md`, `review.md` and the implementation stage keep the `attempt=` they had.
- The merge-defect hand-offs are bounded so a planner that cannot fix it does not loop for ever: after three red checks in a row on the same merge (`flow.json` `ceilings.default`), the run ends `blocked` with a reason that names the merge defect. Where that count is recorded is the design's; it is not a stage attempt.
- The planner's fix of a merge defect follows whatever rule the flow already applies to any plan change (what happens to `readiness.md` and `approval.md` when the plan's hash changes). This change adds no exception to an owner gate, either way; the plan states the rule from the code (`plugins/openspec/hooks/flow-check.mjs`, `staleAfter` and the `started` guard).
- The check runs after every base merge, even when `stale-only-on-own-files` would keep the evidence current: the stage-roles defect came from a merge that changed no file of the change but changed the spec its delta modifies.
- When `openspec` is not installed or exits for a reason other than a validation error, the run ends `blocked` with that reason; the check is never skipped in silence.
- The step applies to every shipped flow that has an `evidence` stage; the plan lists which (`devkit`, `devkit-lite`, and whether `devkit-project`).
- Boundaries with siblings: `fresh-base-check` makes the loop fetch `origin/<base>` before judging; this change starts from the branch as it is and does not fetch. `delivery-merge-hold` and `delivery-train` decide when merges land; this change decides what the loop does once one has.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `validate-before-evidence`: on a branch whose HEAD holds a merge of `origin/<base>` that no green check follows, `change-loop.mjs next` returns the validate step, not the evidence hand-off.
- AC-2 `green-goes-on`: when `openspec validate <id> --strict` exits 0 after the merge, the next `next` returns the step it would have returned without the check (the evidence hand-off), and a second call does not run the check again for the same merge.
- AC-3 `merge-defect-to-planner`: when the check exits non-zero, `next` returns a hand-off to `devkit-core:change-planner` whose brief says merge defect and carries validate's output, and the `attempt=` of every stage header in the change folder is the same before and after.
- AC-4 `stage-roles-case`: in a fixture where the base adds a scenario to a requirement that the change's delta MODIFIES, and the merge changes no file of the change, the check is red and names that requirement (the case of the stage-roles retro, item 3).
- AC-5 `no-merge-no-check`: on a branch with no base merge since the last green check, `next` returns the same action as before this change and the check does not run.
- AC-6 `bounded`: after three red checks in a row on the same merge, `next` returns an end `blocked` whose reason names the merge defect; it is not the evidence ceiling.
- AC-7 `cannot-run`: when the step's command ran with `openspec` missing from its path (or the CLI timed out, was refused by the pin or gave no validation result), the next `next`, run with the CLI available, returns an end `blocked` that names the cause, never a green check. With no CLI at all, `next` itself exits 3 naming it, as today.
- AC-8 `real-run`: a real run in a throwaway repository reproduces the stage-roles merge, shows the loop handing the planner, shows the planner's fix, and shows the loop continuing to the evidence; the proof covers the red case, the green case and the conducting session's own part (running the step), not only prose tests.
- AC-9 `plan-gate-unchanged`: the planner's merge-defect fix leaves `readiness.md` and `approval.md` in exactly the state the flow gives any other plan change; a test shows the same `flow-check.mjs` answer for a merge-defect fix as for an ordinary plan edit.
- AC-10 `docs-and-roadmap`: `docs/openspec-flow.md` describes the step and its hand-off, and `openspec/roadmap.md` carries the trimmed line of this change.

## Out of scope

- Counting attempts by real failures, and exempting retakes after a merge: `evidence-attempts-by-failure`.
- Keeping evidence and reviews current when a merge touches none of the change's files: `stale-only-on-own-files`.
- Fetching the base before judging a conflict: `fresh-base-check`; holding or batching merges: `delivery-merge-hold`, `delivery-train`.
- Fixing the merge defect automatically; the planner fixes it.
- Any check other than `openspec validate <id> --strict`.
