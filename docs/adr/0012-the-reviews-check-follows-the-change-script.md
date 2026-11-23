# ADR 0012: The devkit-reviews check checks only changes on a devkit script

- Status: accepted
- Date: 2026-11-20
- Change: coordinator-field-fixes
- Amends: ADR 0002 (0002-merge-without-the-owner-opt-in.md), the sentence of its Decision on what `devkit-reviews` recomputes; ADR 0003 (0003-auto-merge-the-archive-pr.md), the Negative consequence on archive PRs; ADR 0004 (0004-devkit-per-project.md), the sentence on the CI check
- Accepted by: the owner, on 2026-11-20, in the message that approved the plan of the change: `Aprovo com o ADR 0012` ("I approve, with ADR 0012"); recorded in `openspec/changes/coordinator-field-fixes/approval.md`
- Amended by ADR 0015 (0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)
- Amended by ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md)

## Context

Note (delivery-models, 2026-11-22): ADR 0018 amends decision 1: for a pull request to the base branch of a `two-prs` project the check also judges the test-branch rules, reading `devkit.delivery` from the default branch, and on a pull request to the test branch it judges the resolution's verdicts only. The Decision is otherwise unchanged.

ADR 0002 makes `devkit-reviews` (`deliver-check --ci`, also run as `guard.mjs ci`) the check
GitHub merges on: it "recomputes reviews, findings, gates and acceptance proof at the PR head in
CI". ADR 0003 adds that it checks an archive PR against the archived `retro.md` and "fails on a
missing retro". ADR 0004 says the CI check "does not depend on" the project's opt-in. None of the
three says which changes the check applies to: today it applies the devkit delivery contract to
whatever change the branch or the PR diff selects.

When devkit-openspec 0.16.0 was installed in three other projects on 2026-11-20 (the defects are
listed in `openspec/changes/coordinator-field-fixes/requirements.md`, reproduced on scratch
repositories), the required check failed three kinds of pull request that the contract was never
meant for:

- a pull request of a change on another OpenSpec schema (`spec-driven`), every task ticked: it
  fails on reviews, findings and acceptance proof that schema never asks for;
- a pull request that touches the folders of two changes: it fails with `several changes are
  touched by this PR` before checking either;
- the archive pull request of a `spec-driven` change: it fails on a `retro.md` that schema never
  writes.

A required check that fails a pull request no rule of the project asks it to judge blocks the
project's merges (ADR 0002 makes it required on the default branch). In the grill of
`coordinator-field-fixes` (question 1) the owner chose: the pull request of a change outside the
devkit scripts passes with a note, and that is recorded as a decision the owner approves with the
plan.

ADR 0004's alternatives table rejected "Per-change schema as the marker" for turning the hooks on
("projects with their own schema lose their gates; the git rule depends on which change is open").
This ADR uses the change's schema as the marker of what the CI check judges, not of whether the
hooks act; it answers that rejection under Consequences.

Note (project-phases, 2026-11-22): [ADR 0015](0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md)
amends decisions 1 and 3 for `devkit-project`: its active changes fail and its archived folders are judged
by the slice contract. The Decision is otherwise unchanged.

## Decision

1. `devkit-reviews` checks a change only when the change is on a devkit script: its own
   `.openspec.yaml` (else the project's `openspec/config.yaml`) names the schema `devkit` or
   `devkit-lite`, the same two names that turn the hooks on (ADR 0004). For a selected change on
   any other schema it checks nothing, prints that the change is not on a devkit script and that
   nothing was checked, and passes.
2. When the pull request touches the folders of several active changes and the branch selects
   none of them, the check judges each touched change on a devkit script that the pull request
   delivers (at least one ticked task in its `tasks.md` at the PR head), prints one result per
   change, and passes only when every one of them passes. A touched change that holds only a plan
   (no ticked task) or is on another schema is printed as a note and fails nothing. A pull request
   that touches devkit-script changes and delivers none of them fails, as a single plan-only change
   fails today.
3. An archive pull request is judged per archived folder by the schema its own `.openspec.yaml`
   names: a folder on another schema is a note; a devkit-script folder is checked as ADR 0003
   says, and a missing `retro.md` still fails, with a message that names the file, what it must
   hold and the step that writes it.
4. Everything else ADR 0002 and ADR 0003 decide is unchanged: the check still recomputes reviews,
   findings, gates and acceptance proof at the PR head for every devkit-script change it judges;
   it still reads neither `ship` nor `merge_method`; it still ignores `DEVKIT_BYPASS`; and it still
   does not depend on the project's opt-in.

## Consequences

- Positive: a project can keep changes on its own schema next to devkit ones without a red
  required check on every such pull request; a pull request that carries the plans of the next
  changes no longer blocks the delivery it ships; the required check fails only where the devkit
  contract applies, so a red `devkit-reviews` again means a devkit gate is open.
- Negative: a project that renames its copy of a devkit schema gets no CI check for the changes on
  the renamed copy (Mitigated: the check prints, on that pull request, that nothing was checked and
  why, so the gap is visible on every such pull request; ADR 0004 already documents that a renamed
  schema turns the hooks off, and the Customizing section of `docs/openspec-flow.md` says the same
  of the check). This is the cost ADR 0004 named when it rejected the per-change schema as the
  hooks' marker; here it is accepted because the alternative is a required check that judges
  changes against rules their schema never set. A change whose `.openspec.yaml` is edited to
  another schema escapes the check (Accepted: the edit is in the pull request's diff, which the
  reviewers read, as ADR 0002 accepts for edits of the workflow itself). A pull request that
  touches several changes is judged on more than one contract at once and is slower to make green
  (Accepted: each result is printed on its own).

### Review trigger

A merge lands a devkit-script change that the check reported as "not on a devkit script", a
project needs the check under a renamed schema, or OpenSpec starts recording a change's schema
somewhere other than its `.openspec.yaml`.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep checking every selected change against the devkit contract | Nothing new | Every pull request of a change on another schema, and every pull request touching two changes, fails the required check; the field projects had to remove the rule | low |
| A devkit script is any schema that declares the evidence and review stages | Follows a renamed copy | Reads schema files the CI job does not download (it fetches three files, `docs/openspec-flow.md` CI section); the previous devkit scripts declared neither stage, so their changes still under way would escape | medium |
| Fail a pull request that touches several changes, as today | One contract per pull request | The plans of later changes cannot ride with a delivery; projects split pull requests by hand to please the check | low |
| Let a plan-only pull request pass | Plans can merge alone | Not asked for by the owner (question 8 of the grill was not answered); kept failing as today, and the owner may correct it at the plan approval | low |
| Make the check read `ship:` and skip `plan` mode projects | Fewer runs | Not asked for; a project in `plan` mode that installs the workflow asks for the proof on purpose | low |
