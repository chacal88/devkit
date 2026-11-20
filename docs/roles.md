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
- Played today by: The main session running `/devkit change` (the `devkit` skill of devkit-openspec), held by the stop and hand-off locks; `ship-change` still finishes a change begun under the previous script. The `requirements-grill` and `retro` skills carry its two writing steps.

## owner

- Does: The person who owns the change. Answers the grill, approves the plan and answers the retro's proposals.
- Delivers: The answers the stages record: the requirements answers, `approval.md` and the retro answers.
- Never: Is replaced by an agent: no role records an approval for the owner.
- Stages: `requirements` (answers), `approval` (`devkit` only), `retro` (answers).
- Played today by: The human, asked one question at a time by the session.

## screen-designer

- Does: Draws the screen a change adds or changes, with real data, and records the mock-up the owner approved.
- Delivers: `mockup.md`, or the same file saying why the change has no screen.
- Never: Writes product code or decides the design the plan settles.
- Stages: `mockup`.
- Played today by: Nobody yet: no role of this name is shipped, so the checker reports the stage as not applying until a person writes `mockup.md` by hand.

## adr-author

- Does: Records the decisions the change takes that deserve an architecture decision record, and drafts the record.
- Delivers: `decisions.md` and the ADR files it points to, or the same file saying that no decision needs one.
- Never: Overrules an accepted ADR or writes product code.
- Stages: `decisions`.
- Played today by: Nobody yet: the stage does not apply until the role ships; a person may write `decisions.md` by hand.

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

- Does: Runs the unit tests and the coverage of the surfaces the change touched and records the result.
- Delivers: `unit-tests.md`, with the commands and their results.
- Never: Changes product code to make a test pass.
- Stages: `unit-tests`.
- Played today by: Nobody yet: until the role ships the stage does not apply and the gates of `tasks.md` carry the proof.

## e2e-tester

- Does: Runs the end-to-end scenarios of the change against the running product and records the result.
- Delivers: `e2e-tests.md`, with the scenarios and their results.
- Never: Changes product code to make a scenario pass.
- Stages: `e2e-tests`.
- Played today by: Nobody yet: the stage does not apply until the role ships.

## pr-verifier

- Does: Proves each acceptance criterion and each gate against the committed code, from the commands' own output.
- Delivers: `evidence.md`, with the commit it verified on line 2 and a stage header on line 1.
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
- Stages: `delivery`.
- Played today by: The agent `devkit-core:commit-and-pr`.

## codebase-researcher

- Does: Reads the repository to answer a question about what exists, so the grill asks the owner only what the code cannot say.
- Delivers: Cited findings, as text handed back to the stage that asked.
- Never: Edits any file or guesses what it did not read.
- Stages: `requirements` (helper).
- Played today by: The agent `devkit-core:codebase-researcher`.

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
- Stages: `readiness` (helper) and `review` (helper).
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
