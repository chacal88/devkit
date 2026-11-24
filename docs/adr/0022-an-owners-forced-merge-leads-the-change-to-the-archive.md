# ADR 0022: An owner's forced merge leads the change to the archive, with its open items named

- Status: accepted
- Accepted by: the owner, on 2026-11-24, in the approval of the plan of change forced-merge-path (openspec/changes/forced-merge-path/approval.md)
- Date: 2026-11-24
- Change: forced-merge-path
- Amends: ADR 0003 (0003-auto-merge-the-archive-pr.md), its Context sentence "The archive starts
  after the change is delivered, its own pull request merged and every task ticked on the default
  branch", by naming the owner's forced merge as a second way to the archive
- Builds on: ADR 0002 (0002-merge-without-the-owner-opt-in.md), ADR 0012
  (0012-the-reviews-check-follows-the-change-script.md), ADR 0016
  (0016-stage-roles-write-their-own-files.md), ADR 0017 (0017-a-change-state-is-derived-in-one-place.md),
  ADR 0019 (0019-the-delivery-loop-tags-the-release-it-merged.md); amends none of them
- Number: the next free number on `origin/main` when this record was drafted; it is taken again at
  the last merge of `main` before the review (`openspec/config.yaml`, rules), and the file is
  renamed if a sibling change took it

## Context

ADR 0002 keeps the owner's merge as the default and bars no owner from merging. ADR 0003, and the
`change-delivery` spec requirement "Delivered means its own pull request merged and every task
ticked", let only a delivered change lead `deliver-check` to the archive steps. A merged pull
request with unticked tasks is read as a deliberate partial one: the checker answers `stop-branch`
("continue on branch ... and open a further pull request").

On 2026-11-23 and 2026-11-24 the owner merged change pull requests with admin rights while the
delivery contract was below 8/8: PR 88 (roadmap-sessions-upfront) with `devkit-reviews` FAILURE,
task 9.6 and the last phase's evidence and review open; delivery-train and compozy-driver the
same way. `deliver-check.mjs` and `change-loop.mjs next` kept answering `implement`. Once GitHub
deleted the branch they found no pull request for the change, because no lookup starts from the
merge commit. The retro and the archive of those changes were driven by hand. Each of these merges
is the case that ADR 0002's review trigger names: "A merge happens that `devkit-reviews` would
have failed".

In the grill of forced-merge-path (2026-11-24) the owner answered that the loop tells a forced,
final merge from a partial one automatically, by the required checks, and that the path is
recorded as a new ADR that amends ADR 0003.

## Decision

1. A merged pull request of the change is the owner's forced, final merge when the required checks
   of its head were not all green at the merge: `check` or `devkit-reviews` in the pull request's
   `statusCheckRollup` has a conclusion other than `SUCCESS`, or is absent.
2. A forced merge is a second way to the archive, beside a delivered change. `deliver-check` and
   `change-loop.mjs next` answer for it the same archive steps a delivered change gets (`retro`,
   `stop-retro-answers`, `archive`, `tick-roadmap`, `apply-proposals`, `open-archive-pr`, and
   `tag-release` when ADR 0019 applies). They never answer `implement`, `fix-*`, `verify`,
   `review` or `stop-branch` for it. The answer says `merged by the owner with N items open`.
3. N counts what did not run or was not done at the merge: each unticked task of the change's
   `tasks.md` on the default branch, each required check not green, and each gate of the delivery
   contract (`evidence.md`, `reviews/`) without a passing verdict for the merged head. The retro
   lists each open item and the count in `retro.md`.
4. Nothing is ticked, written or faked for what did not run. `tasks.md` keeps its unticked tasks,
   and no gate file (`readiness.md`, `reviews/<reviewer>.md`, `evidence.md`, `approval.md`) is
   created or changed by this path. Each gate file keeps its one writer (ADR 0016).
5. A merged pull request with unticked tasks and every required check `SUCCESS` stays a deliberate
   partial pull request, with the `stop-branch` answer of today.
6. The forced merge is found from any checkout, including after GitHub deleted the change's branch,
   by the pull request's number or by the merge commit on the default branch.
7. The retro proposals of such a change are answered only by the owner's own typed message, as for
   any change. `ship-change` keeps its ban on `--admin` and on merging: devkit only recognises a
   merge the owner already made.

ADR 0003's Decision (when and how the archive pull request is auto-merged) is unchanged; so is its
archive pull request, which carries the forced-merge change's folder like any other. ADR 0002's
Decision is unchanged: this record answers its review trigger by naming what follows such a merge,
not by letting any session make one.

## Consequences

- Positive: a change the owner merged early reaches its retro, its archive, its roadmap tick and
  its release tag through the loop, from any checkout, as a delivered change does; what was left
  open is written once, in the retro, where the owner reads it.
- Negative: an archived change can hold unticked tasks and missing gates (Accepted: the owner made
  the merge; the retro names each open item, and no gate is faked). A partial pull request merged
  while a required check was red is read as final (Accepted: the owner chose the automatic signal
  in the grill; a further pull request for the same change then needs the owner to open it by
  hand). A check that GitHub reports as absent for an unrelated reason, for example a workflow that
  never started, makes a merge forced (Accepted: a check that did not run is a gate that did not
  run, and the retro names it). The lookup by merge commit adds `gh` reads after a merge (Accepted:
  read-only).
- Note: the `devkit-reviews` archive check of ADR 0003 and ADR 0012 judges the archived `retro.md`.
  The plan shows that it passes an archive pull request whose change holds unticked tasks, or
  changes that check within this change's scope.
- Note: the release tag of ADR 0019 applies once the change is in the archive phase, and needs the
  pull request's number, which decision 6 finds.

### Review trigger

The owner wants to declare a merge final by a typed message instead of the checks; a partial pull
request is wrongly read as forced; the archive check refuses a forced-merge change's archive pull
request; or a session merges with `--admin`.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep ADR 0003's rule; the owner drives the retro and the archive by hand after a forced merge | Nothing new | What happened on 2026-11-23/24: the loop answers `implement` for a merged change and loses its pull request once the branch is deleted | low |
| The owner declares the merge final by a typed message | No inference from checks | Another owner stop after a merge the owner already made; not chosen by the owner (question 1) | low |
| Treat every merged pull request with unticked tasks as final | Simplest rule | Breaks the deliberate partial pull request of the `change-delivery` spec | medium |
| Tick the open tasks or write the missing gates after the merge so the change reads as delivered | Reuses the delivered path unchanged | Fakes gates that did not run; breaks the one-writer rule of ADR 0016 | high |
| Let `ship-change` merge with `--admin` when the owner asks | The owner does not leave the session | A session would bypass the ruleset that ADR 0002 and ADR 0003 keep closed for everyone | high |
