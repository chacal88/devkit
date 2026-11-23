# Roles

Each stage of a devkit change names a role, not a tool. A role is a job with a fixed deliverable and
fixed limits; the stage declaration (`flow.json` in each schema folder) says which role runs which
stage, and the schema instruction of the stage starts with `Role: <role>.` The same text works in
any harness that can run the role. This document says what each role does, what it delivers, what it
never does, which stages name it, and who plays it in Claude Code today.

In Claude Code a role is the `devkit-core` agent of the same name where one exists; the sections say
where it does not. A helper is a role that a stage's main role may call on; it delivers to that role
and not to the change folder.

## change-coordinator

In `docs/coordination-design.md` this role is the team's `tech-lead`; the CompozyOS kit's `tech-lead` is a different role, its planner, renamed `planner` in round 21.

- Does: Runs the change from its opening to its retro: opens the folder, grills the owner for the requirements, hands each stage to its role, reads the checker after every stage and asks the owner only where a stage says so.
- Delivers: The change folder, `requirements.md` and `retro.md`, each with its stage header.
- Never: Writes product code, approves its own change, or skips a stage the checker has not passed.
- Stages: `open`, `requirements`, `retro` (both scripts).
- Played today by: The main session running `/devkit change` (the `devkit` skill of devkit-openspec), or `/devkit roadmap` for every open change of its run, held by the stop and hand-off locks (in the desktop app each change of a run has a session of its own, which plays the change coordinator, [ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md); a run opens every change at its start and its session runs on the run's ticket through the `devkit-session` skill, [ADR 0020](adr/0020-a-roadmap-run-opens-every-change-at-its-start.md)); `ship-change` still finishes a change begun under the previous script. The `requirements-grill` and `retro` skills carry its two writing steps.

## roadmap-coordinator

In `docs/coordination-design.md` this role is the team's `manager`.

- Does: Reads `openspec/roadmap.md`, starts every change whose `after:` dependencies are archived up to the number the owner set for the run, holds a start while the machine is loaded, and keeps the changes it holds open going while the owner answers another one.
- Delivers: Nothing of its own: the changes it starts, and the run's event lines and board.
- Never: Writes product code, starts a change the loop did not return, hands two stages of one change at once, or answers an owner gate itself.
- Stages: none; it starts changes.
- Played today by: The main session running `/devkit roadmap` (the `devkit` skill of devkit-openspec), held by the roadmap run's locks; in the desktop app each change of a run has a session of its own, which plays the change coordinator ([ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md)); each stage runs as a subagent in the background ([ADR 0013](adr/0013-the-roadmap-coordinator-is-the-owners-session.md)); it asks the grill, the plan approval and the retro answers of every change session, hands no stage, and keeps one periodic check while the run lasts ([ADR 0020](adr/0020-a-roadmap-run-opens-every-change-at-its-start.md)).

## project-coordinator

In `docs/coordination-design.md` this role is the team's `tech-lead` for a new project: it plans, it does not build.

- Does: Runs a slice of a project from its opening to its pull request: opens the slice, takes the owner through the business, domain model, architecture and implementation plan phases one question at a time, proposes the roadmap rounds, and hands the ADR review and the commits to their roles.
- Delivers: The slice's stage records, each with its stage header, and the documents under `docs/design/<slice>/` and the new ADRs the owner approved.
- Never: Writes product code, sets a stage record to passed without the owner's approval, edits `openspec/roadmap.md` by hand, edits a flat `docs/design/` or another slice's folder, or merges.
- Stages: `open`, `business`, `domain-model`, `architecture`, `implementation-plan`, `roadmap` (`devkit-project` only).
- Played today by: The main session running `/devkit project` (the `devkit` skill of devkit-openspec); it has no agent file, as `change-coordinator` has none.

## owner

- Does: The person who owns the change. Answers the grill, approves the plan and answers the retro's proposals.
- Delivers: The answers the stages record: the requirements answers, `approval.md` and the retro answers.
- Never: Is replaced by an agent: no role records an approval for the owner.
- Stages: `requirements` (answers), `approval` (`devkit` only), `retro` (answers).
- Played today by: The human, asked one question at a time by the session.

## screen-designer

- Does: Draws the screen a change adds or changes, with real data, only when the grill flags `ui`, and redraws it from the owner's notes until the owner approves.
- Delivers: `mock/<screen>.html` or `mock/<screen>.md` for each screen, and `mockup.md` listing them, with a stage header saying `pending`; the session records the owner's approval.
- Never: Writes product code, keeps an image of a screen, sets its own stage to passed or decides the design the plan settles.
- Stages: `mockup` (`devkit` only).
- Played today by: The agent `devkit-core:screen-designer`.

## adr-author

- Does: Records the decisions the change takes that deserve an architecture decision record, and drafts each record with status proposed; the owner's plan approval accepts them.
- Delivers: `decisions.md` and the ADR files it points to, or the same file saying that no decision needs one.
- Never: Overrules or edits an accepted ADR, sets a record accepted or writes product code.
- Stages: `decisions` (`devkit` only).
- Played today by: The agent `devkit-core:adr-author`.

## change-planner

- Does: Turns the requirements into the plan: proposal, spec delta, design and tasks, one artifact at a time, each validated.
- Delivers: `proposal.md`, the spec delta under `specs/`, `design.md` (`devkit` only) and `tasks.md`, each with its stage header.
- Never: Writes product code or approves its own plan.
- Stages: `proposal`, `specs`, `design`, `tasks`.
- Played today by: The agent `devkit-core:change-planner`.

## plan-readiness-reviewer

- Does: Reviews the finished plan against the repository as it is and decides whether implementation may start.
- Delivers: `readiness.md`, with a `- Status:` line and a stage header.
- Never: Edits the plan it reviews or writes product code.
- Stages: `readiness` (`devkit` only).
- Played today by: The agent `devkit-core:plan-readiness-reviewer`.

## tdd-implementer

- Does: Implements one phase of the tasks at a time, test first, and ticks the boxes it finishes.
- Delivers: Code and tests on the change's branch, and ticked tasks.
- Never: Commits, opens a pull request, approves its own work or ticks a gate task.
- Stages: `implementation`.
- Played today by: The agent `devkit-core:tdd-implementer`.

## test-runner

- Does: Runs the whole unit suite and the coverage command the project declares and records the result, only when the project declares `devkit.tests.unit`.
- Delivers: `unit-tests.md`, with each command, its exit code and its summary, and the coverage against the target.
- Never: Changes a file but `unit-tests.md` or masks an exit code.
- Stages: `unit-tests`.
- Played today by: The agent `devkit-core:test-runner`.

## e2e-tester

- Does: Writes the E2E tests from the acceptance criteria, apart from the implementer, runs them and records the result, only when the project declares `devkit.tests.e2e`.
- Delivers: The E2E test files and `e2e-tests.md`, with the scenarios and their results.
- Never: Changes a product file, or reads the test files of the change's diff.
- Stages: `e2e-tests`.
- Played today by: The agent `devkit-core:e2e-tester`.

## pr-verifier

- Does: Proves each acceptance criterion and each gate against the committed code, from the commands' own output.
- Delivers: `evidence.md`, as text, with no image, with the commit it verified on line 2 and a stage header on line 1.
- Never: Fixes a defect it finds or approves the change.
- Stages: `evidence`.
- Played today by: The agent `devkit-core:pr-verifier`.

## review-bench

- Does: Runs the independent reviewers over the committed change, has each finding verified and decides the consensus.
- Delivers: `reviews/<reviewer>.md` from each reviewer and `review.md` with the round's consensus and a stage header.
- Never: Writes product code or reviews its own work.
- Stages: `review`.
- Played today by: The `review-change` skill, which dispatches the reviewer agents.

## commit-and-pr

- Does: Commits the change in the project's convention and opens or updates its pull request.
- Delivers: Commits, the pushed branch and the pull request, whose body names every acceptance criterion.
- Never: Merges a pull request the project has not set to merge, pushes to the default branch or skips the hooks.
- Stages: `delivery` (every script).
- Played today by: The agent `devkit-core:commit-and-pr`.

## codebase-researcher

- Does: Reads the repository to answer a question about what exists, so the grill asks the owner only what the code cannot say.
- Delivers: Cited findings, as text handed back to the stage that asked.
- Never: Edits any file or guesses what it did not read.
- Stages: `requirements` (helper).
- Played today by: The agent `devkit-core:codebase-researcher`.

## requirements-triage

- Does: Reads the project's files to answer the grill's questions they settle, each with the file that settles it, so the owner is asked only what nothing written settles.
- Delivers: One block per question, as text handed back to the stage that asked: `answered` with its source, or `owner` with why nothing written settles it.
- Never: Edits any file, answers from its own judgement, or writes or suggests a plan approval or a retro answer.
- Stages: `requirements` (helper).
- Played today by: The agent `devkit-core:requirements-triage`.

## openspec-validator

- Does: Checks the structure of a plan artifact against its schema before the stage is declared passed.
- Delivers: A pass or a list of structural errors.
- Never: Rewrites the artifact it checks.
- Stages: `proposal`, `specs`, `design`, `tasks` (helper).
- Played today by: The agent `devkit-openspec:openspec-validator`, or the command `openspec validate <id> --strict`.

## plan-reality-auditor

- Does: Checks that every path, symbol and behaviour the plan cites exists in the repository as the plan says.
- Delivers: A list of claims that no longer hold, with the evidence.
- Never: Edits the plan or approves it.
- Stages: `readiness` (helper).
- Played today by: The agent `devkit-core:plan-reality-auditor`.

## adr-reviewer

- Does: Checks the plan, or the change, against the accepted decision records.
- Delivers: A verdict with the records cited.
- Never: Writes or changes a record.
- Stages: `readiness` (helper) and `review` (helper); `review` (main role, `devkit-project` only).
- Played today by: The agent `devkit-core:adr-reviewer`.

## code-quality-reviewer

- Does: Reviews the diff for clarity, duplication, naming and typed errors.
- Delivers: `reviews/code-quality-reviewer.md`, with `Verdict:` on line 1 and the commit it reviewed.
- Never: Edits the code it reviews.
- Stages: `review` (helper).
- Played today by: The agent `devkit-core:code-quality-reviewer`.

## test-coverage-reviewer

- Does: Reviews whether the tests prove each behaviour and edge case the plan names.
- Delivers: `reviews/test-coverage-reviewer.md`, with `Verdict:` on line 1 and the commit it reviewed.
- Never: Edits the tests it reviews.
- Stages: `review` (helper).
- Played today by: The agent `devkit-core:test-coverage-reviewer`.

## architecture-reviewer

- Does: Reviews the diff against the layers and boundaries the design and the records set.
- Delivers: `reviews/architecture-reviewer.md`, with `Verdict:` on line 1 and the commit it reviewed.
- Never: Edits the code it reviews.
- Stages: `review` (helper).
- Played today by: The agent `devkit-core:architecture-reviewer`.

## security-reviewer

- Does: Reviews the diff for injection, secrets, authorization and unsafe input handling.
- Delivers: `reviews/security-reviewer.md`, with `Verdict:` on line 1 and the commit it reviewed.
- Never: Edits the code it reviews.
- Stages: `review` (helper).
- Played today by: The agent `devkit-core:security-reviewer`.

## spec-reviewer

- Does: Reviews whether the diff does what the spec delta and the acceptance criteria say, no less and no more.
- Delivers: `reviews/spec-reviewer.md`, with `Verdict:` on line 1 and the commit it reviewed.
- Never: Edits the code or the spec it reviews.
- Stages: `review` (helper).
- Played today by: The agent `devkit-core:spec-reviewer`.

## finding-verifier

- Does: Re-checks one reviewer finding against the code and says whether it holds, so a refuted finding does not block the change.
- Delivers: A verdict on the finding: confirmed or refuted, with the evidence.
- Never: Raises findings of its own or edits files.
- Stages: `review` (helper).
- Played today by: The agent `devkit-core:finding-verifier`.
