<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> asked by the owner on 2026-11-22, after the same reference: reviewed deliveries board a train and leave together, so the full suite runs once for the batch instead of once for each pull request. On 2026-11-22 every merge of a sibling made each open change redo its evidence and part of its review on the full suite (13 to 21 minutes each; `stage-roles` redid its demonstration four times, two of them only for merges of main). In the grill: how a change boards (review approved, plan files only, or each delivery step), the order of the release versions inside a batch, what a red batch does (find the change that broke it and drop it from the train), how the train fits the `devkit` ruleset (the `check` and `devkit-reviews` checks, the strict up-to-date rule) and GitHub's own merge queue as a candidate, and what each change's evidence then proves.

## Classification

domain=process, type=feature, flags=[architecture, contract] (strict-assumed; no screen, so no mock-up).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
Answers 1 to 9 below were given by the coordinating roadmap session under the owner's delegation of 2026-11-23 ("check all the questions and answer those you have the information for"); the owner confirms them with the plan approval.

- Mechanism (Q1): devkit builds its own train, an integration branch `train/<n>` per batch cut from `origin/<base>`; GitHub's merge queue is a discarded alternative, because `chacal88/devkit` is owned by a user account (`owner.type = User`) and GitHub offers the queue for repositories owned by an organization (ADR 0002 already set it aside).
- Boarding (Q2): a change boards when its review is approved at its own head, that is, every item of the delivery contract is met except "up to date with the base" and the CI wait. Its own cycle (implementation, evidence, review) runs on its own branch at its own pace.
- Release order (Q3): boarding order, first approved boards first and takes the lowest release number; the numbers are renumbered only on the train branch with `plugins/openspec/hooks/release-merge.mjs` (its base is the train's tip); each change branch keeps its own number and its reviews stay current.
- Red train (Q4): the train finds the smallest red prefix `train[0..k]` by bisection; change `k` leaves the train with the failure attached and goes back to its own cycle against the train's tip; the others leave on a new train with one more full-suite run.
- What each stage proves (Q5): two layers. A change's `evidence.md` proves its acceptance criteria at its own head (the real run of what it delivers and the tests of the area it touches, not the whole suite). The whole suite, `check` and `devkit-reviews` run once at the train's head into a train record. `devkit-reviews` on the train's pull request judges each boarded change at its own head, requires that head to be contained in the train and requires the train record green.
- Departure (Q6): on request, one train at a time, no timer and no cron. In a roadmap run the coordinating session sends the request, so the owner does not have to; the request is a command, `/devkit train` (its exact spelling is the planner's). A change that boards while a train runs waits for the next. How the coordinating session calls it by itself (its periodic check) belongs to `roadmap-sessions-upfront`; this change only provides the command it calls.
- Archives (Q7): a ready archive (retro answered, the `archive-pr-ready` state of `deliver-check`) boards the next train like a change, in boarding order; the archive queue that updates its branch after every merge goes away; each archived folder is still judged as today (the P13 file check and the retro answers).
- Join conflicts (Q8): a conflict only in release files is resolved by the `release-merge.mjs` rule; any other conflicting path takes that change off the train, back to its own cycle with the path attached, and the train leaves without it. Whether a roadmap tick in `openspec/roadmap.md` (two archives on neighbouring lines were the commonest conflict of the run of 2026-11-22/23) can be resolved by rule like a release file is for the planner to weigh.
- Scope (Q9): the train applies to the delivery models `trunk` and `trunk-auto` of ADR 0018, and is opt-in through one key of the `devkit.delivery` block in `openspec/config.yaml` (AMBIGUOUS: (a) `devkit.delivery.train: true` | (b) another name; the planner resolves). Without the key nothing changes. In `trunk-auto` the train's pull request is merged by GitHub when its checks and the train record are green; in `trunk` the owner merges it; `two-prs` with the key is refused, saying why. The devkit repository turns it on.
- The train's pull request is merged with the merge method `merge` (a merge commit), whatever the project's `merge_method`, so every change's commits reach the base branch and each change's own pull request ends as merged (AMBIGUOUS: (a) GitHub marks it merged by itself | (b) the train closes it with a comment; the planner settles it with a real run). Auto-merge is never enabled on the pull request of a boarded change.
- The ruleset `devkit` stays as it is (`check` and `devkit-reviews` required, `strict_required_status_checks_policy: true`): only trains and unboarded pull requests merge into the base branch, so the train's branch is up to date when it departs.
- ADR work: a new ADR records the train and the discarded merge queue, and amends ADR 0002 (the accepted cost "strict up-to-date re-runs stale reviews"), ADR 0003 (the archive pull request), ADR 0012 (what `devkit-reviews` judges on a train's pull request) and ADR 0018 (the train as an addition to `trunk` and `trunk-auto`); `docs/openspec-flow.md` and `docs/coordination-design.md` change with it.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `train-opt-in`: in a project whose `openspec/config.yaml` has no train key, `deliver-check` and `change-loop.mjs next` return for every change exactly what they return today (no board or train step). With the key and `devkit.delivery.model` `trunk` or `trunk-auto` they return the train steps; with `two-prs` the configuration is refused with its reason.
- AC-2 `boarding-at-review`: a change whose review is approved at its head and whose delivery contract is met except "up to date with the base" and the CI wait is reported as boarded and queued in the order it became so; it is not sent to `update-branch`, `verify` or `review` because `main` moved.
- AC-3 `merge-of-main-costs-nothing`: with a boarded change and a merge of a sibling into `main`, the boarded change's evidence and reviews stay current and no step redoes them (its own head did not change).
- AC-4 `train-departure`: one request cuts `train/<n>` from `origin/<base>`, merges every boarded change's head in boarding order, renumbers the release files only on the train branch with `release-merge.mjs` and opens one pull request; a second request while a train runs starts no second train and leaves the boarded changes queued.
- AC-5 `one-full-run`: the whole suite, `check` and `devkit-reviews` run once at the train's head and their result is recorded in a train record; a change's `evidence.md` does not require the whole suite to be accepted.
- AC-6 `train-check`: `devkit-reviews` on a train's pull request judges each boarded change at its own head, fails when that head is not contained in the train or a review of the change is stale, and fails without a green train record.
- AC-7 `red-train`: for a train whose only failure is the interaction of two changes (each passes alone), the train finds the smallest red prefix, takes the later of the two off with the failure attached, and the rest leave on a new train with one more full-suite run.
- AC-8 `join-conflict`: a conflict only in release files is resolved by rule; a conflict in any other path takes that change off the train with the path attached, and the train leaves without it.
- AC-9 `archives-board`: a ready archive boards the next train in boarding order and no archive branch is updated after another's merge; each archived folder is judged as today (file check and retro answers) in the train's pull request.
- AC-10 `delivered-by-train`: after the train's pull request merges with a merge commit, every boarded change's pull request is merged or closed with a comment and the post-merge phase counts the change as delivered; in `trunk-auto` GitHub merges the train on green checks and record, in `trunk` it waits for the owner; auto-merge is never enabled on a boarded change's own pull request.
- AC-11 `adr-and-docs`: a new ADR (status proposed until the owner accepts) records the train, the discarded merge queue and the amendments listed above; `docs/openspec-flow.md`, `docs/coordination-design.md` and `docs/roles.md` (when a role changes) describe the train; `scripts/check.py` and `gen-catalog.py --check` pass.
- AC-12 `real-run-proof`: the evidence of this change runs, in a scratch repository, a train of at least two changes and one archive end to end, a red case (AC-7), a conflict case (AC-8) and the coordinating session's own part (the departure request), as `CLAUDE.md` asks, not one case plus prose tests.

## Questions asked

1. [scope] Mechanism: own train or GitHub's merge queue? → own train (delegated).
2. [scope] When does a change board? → when its review is approved (delegated).
3. [edges] Order of the release versions in a batch? → boarding order, renumbered only on the train (delegated).
4. [edges] What does a red train do? → bisection of the smallest red prefix, the culprit leaves (delegated).
5. [end effect] What does each change's evidence prove? → two layers (delegated).
6. [scope] Who departs the train and when? → on request, one at a time, the coordinating session in a run (delegated).
7. [scope] Do archives ride the train? → yes, like a change (delegated).
8. [edges] What does a join conflict do? → release by rule, the rest leaves the train (delegated).
9. [project rules] Which delivery models, and how is it switched on? → `trunk` and `trunk-auto`, opt-in key (delegated).

## Out of scope

- GitHub's merge queue and any move of the repository to an organization (a discarded alternative in the ADR).
- The `two-prs` delivery model with a train.
- Any timer, cron or wake-up of the train; the coordinating session's periodic check that sends the departure (`roadmap-sessions-upfront`).
- Weakening the ruleset (`strict_required_status_checks_policy` stays `true`).
- Resolving text conflicts outside release files automatically.
- The choice of the session model by stage (`stage-models`).
