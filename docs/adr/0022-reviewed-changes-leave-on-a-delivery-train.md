# ADR 0022: Reviewed changes leave on a delivery train, and the whole suite runs once per train

- Status: accepted
- Amended by ADR 0031 (0031-release-at-merge.md)
- Date: 2026-11-23
- Change: delivery-train
- Amends: ADR 0002 (0002-merge-without-the-owner-opt-in.md), the Negative consequence "Strict up-to-date re-runs stale reviews after each base update (Accepted: cost, scoped re-review)" and the "Merge queue" row of its alternatives; ADR 0003 (0003-auto-merge-the-archive-pr.md), the Decision on how an archive pull request reaches the base branch in `merge` mode; ADR 0012 (0012-the-reviews-check-follows-the-change-script.md), decision 4, on what `devkit-reviews` recomputes at the pull request's head; ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md), decision 1, on what the models `trunk` and `trunk-auto` deliver through
- Accepted by: the owner, on 2026-11-23, in the message that approved the plan of the change: `1` (option 1, "Aprovo"), the answer to the question "approve the plan and ADR 0019 to start the implementation?" (the number was 0019 until the base took it, then 0021 until the base took that too; the ADR is now 0022); recorded in `openspec/changes/delivery-train/approval.md`

## Context

Note (release-at-merge, 2026-11-24): ADR 0031 amends decision 3's sentence "Each change branch keeps its own number, so its reviews stay current": a change with a release note (`openspec/changes/<id>/release.md`) carries no number at all on its branch, and the train's join numbers its release and its unnumbered ADR from the note; a change with no note keeps the sentence. The rejected alternative "Renumber releases on each change branch" stays rejected. The Decision is otherwise unchanged.

ADR 0002 made the `devkit` ruleset require the `check` and `devkit-reviews` checks with the strict
up-to-date rule, and accepted the cost that every update of a branch from its base re-runs the
stale reviews. ADR 0003 archives each change through its own archive pull request, and in `merge`
mode the archive queue updates the archive branch after every merge. ADR 0012 decision 4 has
`devkit-reviews` recompute reviews, findings, gates and acceptance proof at the pull request's head.
ADR 0018 names the delivery models `two-prs`, `trunk` and `trunk-auto`; each change still reaches
the base branch through its own pull request.

The run of 2026-11-22 measured that cost: every merge of a sibling sent each open change to
`update-branch`, and when the update touched a file outside `openspec/` the change redid its
evidence and part of its review on the full suite (13 to 21 minutes each). `stage-roles` redid its
demonstration four times, two of them only for merges of `main`. Archives on neighbouring lines of
`openspec/roadmap.md` conflicted with each other. The cost grows with the number of changes in
flight, which is what a roadmap run raises.

ADR 0002 rejected GitHub's merge queue ("needs org plans or more setup"). `chacal88/devkit` is
owned by a user account (`owner.type = User`), and GitHub offers the queue only to repositories
owned by an organization, so that rejection still holds. The grill of `delivery-train` (questions
1 to 9, answered by the coordinating session under the owner's delegation of 2026-11-23) settled
the rest.

## Decision

1. devkit builds its own delivery train. A train is an integration branch `train/<n>`, cut from
   `origin/<base>`, that merges the heads of the boarded changes and archives and reaches the base
   branch through one pull request.
2. A change boards when its review is approved at its own head and every item of its delivery
   contract is met except "up to date with the base" and the CI wait. A boarded change is not sent
   to `update-branch`, `verify` or `review` because the base branch moved: its own head did not
   change, so its evidence and reviews stay current. A ready archive (`archive-pr-ready`, retro
   answered) boards like a change, and the archive queue that updates each archive branch after
   every merge goes away.
3. Boarding order is the train's order. The first to board takes the lowest release number; the
   release files are renumbered only on the train branch, by `release-merge.mjs` with the train's
   tip as its base. Each change branch keeps its own number, so its reviews stay current.
4. A train departs on request, one at a time, with no timer and no cron. The request is a command
   (`/devkit train`; its exact spelling is the plan's); in a roadmap run the coordinating session
   sends it. A change that boards while a train runs waits for the next.
5. Proof has two layers. A change's `evidence.md` proves its acceptance criteria at its own head:
   the real run of what it delivers and the tests of the area it touches, not the whole suite. The
   whole suite, `check` and `devkit-reviews` run once at the train's head, and their result is
   recorded in a train record.
6. On a train's pull request, `devkit-reviews` judges each boarded change at its own head (reviews,
   findings, gates and acceptance proof, as ADR 0012 decision 4 says), fails when that head is not
   contained in the train or a review of the change is stale, fails without a green train record,
   and judges each archived folder as ADR 0003 and ADR 0012 decision 3 say.
7. A red train finds the smallest red prefix `train[0..k]` by bisection; change `k` leaves the
   train with the failure attached and returns to its own cycle against the train's tip; the
   others leave on a new train, with one more full-suite run.
8. A join conflict only in release files is resolved by the `release-merge.mjs` rule. A conflict in
   any other path takes that change off the train with the path attached, and the train leaves
   without it. Whether a roadmap tick can be resolved by rule like a release file is the plan's.
9. The train is opt-in through one key of the `devkit.delivery` block in `openspec/config.yaml`
   (its name is the plan's), for the models `trunk` and `trunk-auto` only; `two-prs` with the key
   is refused, saying why. Without the key nothing changes. In `trunk-auto` GitHub merges the
   train's pull request when its checks and the train record are green; in `trunk` the owner
   merges it. The devkit repository turns it on.
10. The train's pull request is merged with a merge commit, whatever the project's `merge_method`,
    so every change's commits reach the base branch; each boarded change's own pull request then
    ends as merged (or is closed with a comment, as the plan's real run settles) and the post-merge
    phase counts the change as delivered. Auto-merge is never enabled on a boarded change's own
    pull request.
11. The `devkit` ruleset stays as it is (`check` and `devkit-reviews` required,
    `strict_required_status_checks_policy: true`): only trains and unboarded pull requests merge
    into the base branch, so a train's branch is up to date when it departs.

## Consequences

- Positive: a merge of a sibling costs a boarded change nothing; the whole suite runs once per
  batch instead of once per pull request per base update; archives stop conflicting with each
  other's branch updates; the ruleset and its strict rule stay untouched, so no bypass exists.
- Negative: a change's own evidence no longer proves the whole suite, so an interaction between two
  changes is found only at the train (Mitigated: the train record is required by `devkit-reviews`,
  and decision 7 isolates the culprit). A red train costs extra full-suite runs, one per bisection
  step and one for the new train (Accepted: the cost falls only on a red train, and the culprit
  leaves). Delivery waits for a departure request (Accepted: the coordinating session sends it in a
  run; outside a run the owner does). A change pushed after boarding leaves the train until its
  review is approved again (Accepted: boarding is tied to the reviewed head). The merge commit of
  the train ignores a project's `squash` `merge_method` (Accepted: the per-change pull requests
  must end as merged, which squash would prevent). The `devkit-reviews` check grows a train mode
  (Accepted: it judges each boarded change by the same contract as today).

### Review trigger

A train's pull request merges a change whose own head `devkit-reviews` did not judge, a red train's
bisection names the wrong change, GitHub offers its merge queue to repositories owned by a user
account, or a project needs the train under `two-prs`.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| GitHub's merge queue | Built in; batches and bisects by itself | Offered only to repositories owned by an organization; `chacal88/devkit` is owned by a user (ADR 0002 already set it aside) | medium |
| Keep one pull request per change with strict up-to-date (today) | Nothing new | Every sibling merge re-runs evidence and reviews (13 to 21 minutes each, four times for `stage-roles` on 2026-11-22) | low |
| Turn off the strict up-to-date rule | No updates at all | Changes merge untested together; weakens the ruleset ADR 0002 set | low |
| Board at plan approval, or at each delivery step | Earlier batching | Boards unreviewed code; a train would carry changes that may still fail their own review | medium |
| Renumber releases on each change branch | One number everywhere | Every renumber changes a change's head and stales its reviews, the cost this ADR removes | low |
| A timer or cron departs the train | No request needed | A second coordinator outside the session (ADR 0001, ADR 0010); out of scope | medium |
| A red train drops every change and starts over | Simple | One bad change delays every good one; no culprit is named | low |
| Resolve any join conflict automatically | Fewer leavers | Text merges no reviewer read would reach the base branch | medium |
| The train on by default for `trunk` and `trunk-auto` | No key | Changes every project's flow at once; the requirements ask for opt-in | low |
