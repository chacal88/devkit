<!-- devkit-stage proposal result=passed attempt=2 commit=02208a3517799997e0a4950c46c466ec161c88c6 -->
# Proposal

Change: `post-merge-validate` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, with the owner's scope line, and `decisions.md`, which lists a proposed
Note on ADR 0017 that the owner's plan approval accepts; see Impact).

## Why

A merge of the base can break a change's plan without touching any of its files: in `stage-roles` a
merge from `main` added a scenario to a requirement that the change's `roadmap-coordination` delta
modifies, so the delta's MODIFIED block silently dropped it (stage-roles retro, item 3). Only the
evidence's own `openspec validate --strict` caught it, as a failed demonstration attempt, the third,
which hit the stage's limit. Today the check after a merge is a by-hand sentence in
`docs/openspec-flow.md`; the delivery loop does not run it, and the defect lands on the stage that did
not cause it.

## What Changes

- In the delivery part of `/devkit change` (`plugins/openspec/hooks/change-loop.mjs next`), when the
  branch holds a merge of the base that no green check follows, the loop gives a new session step,
  `merge-check`, ahead of the evidence and of every later delivery step that pushes or waits on the
  change's pull request. The step's command, `change-loop.mjs merge-check <id>`, runs
  `openspec validate <id> --strict` in the change's root and records the result for that merge in the
  git common directory (never in the worktree, never in a commit).
- A green check lets the loop give the step it would have given without it, and the same merge is not
  checked again.
- A red check hands `devkit-core:change-planner` a brief that says "merge defect", quotes validate's
  errors and tells it to fix the plan files only, leaving every stage header and task checkbox as it
  is. No stage's `attempt=` changes, and no attempt ceiling is read or counted for it.
- After the planner's fix the check runs again. Three red checks in a row on the same merge
  (`flow.json` `ceilings.default`) end the run `blocked`, with a reason that names the merge defect.
- A check that cannot run (`openspec` missing, timed out, refused by the version pin, or an answer
  that is not a validation result) ends the run `blocked` naming the cause; it is never taken as green.
- Applies to the shipped flows with an `evidence` stage: `devkit` and `devkit-lite`. `devkit-project`
  has no evidence stage and its loop (`project-loop.mjs`) is not touched. `flow.json` does not change,
  so no flow version is raised.
- The `devkit` skill says how the session runs the step; `docs/openspec-flow.md` replaces its by-hand
  sentence with the loop's step and adds two Troubleshooting rows; `plugins/openspec/README.md` names
  the command; `openspec/roadmap.md` trims this change's line to the half it delivers.
- Release: devkit-openspec minor bump and marketplace minor bump (the next free numbers on
  `origin/main` at the last merge before review), a CHANGELOG entry, and the CI pin lines moved with
  the devkit-openspec version.

Non-goals: checking after a rebase of the task branch (it leaves no merge commit); counting a stage's attempts by real failures and exempting retakes after a merge (the
roadmap line `evidence-attempts-by-failure`); keeping evidence and reviews current across a merge that
touches none of the change's files (`stale-only-on-own-files`); fetching the base (`fresh-base-check`);
holding or batching merges (`delivery-merge-hold`, `delivery-train`); fixing the defect automatically;
any check other than `openspec validate <id> --strict`; the CompozyOS kit, whose own loop already
validates in its node checks; `ship-change` rows (the step is the loop's own, like `take-place`).

## Acceptance criteria

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

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-coordination`: six ADDED requirements: the post-merge check is a session step of the
  delivery ahead of the evidence; a green check is remembered per merge; a red check goes to the
  planner as a merge defect without spending a stage attempt; three reds in a row end the run blocked;
  a check that cannot run ends the run blocked; a merge-defect fix follows the plan-change rule every
  other plan edit follows. No existing requirement's text changes.

## Impact

- Hooks: `plugins/openspec/hooks/change-loop.mjs` (the decision, the facts `next` reads, the new
  `merge-check` command, two blocked reasons in both languages). `flow-check.mjs`, `deliver-check.mjs`,
  `conduct-check.mjs`, `guard.mjs` and every `flow.json` are unchanged; the CI path of
  `deliver-check --ci` is untouched.
- Skills: `plugins/openspec/skills/devkit/SKILL.md` (one sentence in the Loop's `session` item).
- Docs: `docs/openspec-flow.md`, `plugins/openspec/README.md`, `CHANGELOG.md`; `openspec/roadmap.md`.
- Release: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, the CI pin
  lines in `docs/openspec-flow.md`.
- Tests: `plugins/openspec/hooks/change-loop.test.mjs` (new `post-merge-validate` tests; the blocked
  cases of `change-state AC-3`). The tests need the `openspec` CLI 2.x on `PATH`, as the suites already do.
- Dependencies: none new. Decisions cited: ADR 0010 (decisions 3 and 6), ADR 0011 (decision 2), ADR
  0016, ADR 0017 (decision 1). No open decision is inherited (the repository keeps no open-decisions
  log). The merge-check record is a new input of the state ADR 0017 decision 1 derives: the owner
  chose its place, `<git common dir>/devkit/merge-check/<id>.json`, on 2026-11-23 (answer A), and
  `decisions.md` lists the adr-author's Note on ADR 0017 (status proposed), which the owner's
  approval of this plan accepts (`design.md`, "ADR 0017: a proposed Note").
