# ADR 0025: A roadmap run grants one merge turn at a time

- Status: proposed
- Date: 2026-11-23
- Change: delivery-merge-hold
- Amends: ADR 0002 (0002-merge-without-the-owner-opt-in.md), its Decision, on what happens between
  8/8 and the merge when several changes of a roadmap run are ready; ADR 0003
  (0003-auto-merge-the-archive-pr.md), its Decision, on when auto-merge is enabled on an archive pull
  request of a roadmap run; ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md),
  decision 4, the fields of the run's bookkeeping, as ADR 0020 decision 6 and ADR 0021 decision 6
  extended it. Each amendment applies only to a project without a delivery train (decision 9); ADR
  0022 (0022-reviewed-changes-leave-on-a-delivery-train.md) amends ADR 0002 and ADR 0003 for a project
  with one, and this record leaves that amendment as it is.
- Builds on: ADR 0006 (0006-phases-as-child-sessions.md) decision 3 as ADR 0021 amended it for a
  roadmap run, ADR 0010 (0010-openspec-as-the-harness.md) decision 5, ADR 0011
  (0011-the-change-coordinator-is-the-owners-session.md), ADR 0018
  (0018-the-delivery-model-is-chosen-per-project.md), ADR 0020
  (0020-a-change-can-run-on-another-machine.md), ADR 0021
  (0021-a-roadmap-run-opens-every-change-at-its-start.md) decisions 2 and 4, ADR 0022
  (0022-reviewed-changes-leave-on-a-delivery-train.md) decisions 2, 9 and 10, ADR 0024
  (0024-compozy-runs-the-short-loop.md, proposed) decision 3

## Context

ADR 0002 lets `ship-change` enable GitHub's auto-merge on a change pull request as soon as
`deliver-check` reports 8/8, and ADR 0003 does the same for an archive pull request once it is
`archive-pr-ready`. Each change decides alone. The `devkit` ruleset requires every pull request to be
up to date with the base (`strict_required_status_checks_policy: true`), so every merge into `main`
leaves every other open pull request behind: each one merges the base again, redoes its evidence on
the full suite (13 to 21 minutes) and part of its review. In review-writer-prompt `main` moved three
times under PR 56, and each move cost a rebase, an evidence run and a review of five reviewers. On
2026-11-23, in a roadmap run spread over two machines, the coordinating session held the merges by
hand, telling each change session by message when its turn came; the owner asked for it to be
automated.

ADR 0022 answers the same cost another way, for the projects that opt in. A project that sets
`devkit.delivery.train` (accepted for the models `trunk` and `trunk-auto` only, refused with
`two-prs`; ADR 0022 decision 9) boards each reviewed change and each ready archive, sends them to the
base branch together on one train pull request that departs on request, and never sends a boarded
change to `update-branch` or enables auto-merge on its own pull request (ADR 0022 decisions 2 and
10). In such a project a ready change ends at `boarded`, `on-train` or `wait-train` and never at
`update-branch`, `enable-auto-merge` or `wait-merge`. A project without the key, which includes every
project that ships in the `merge` mode without choosing a model and every `trunk-auto` project that
does not opt in, still delivers each change through its own pull request and pays the cost above.
This repository's `openspec/config.yaml` on `main` at the last merge of this change's plan sets no
`devkit.delivery` block and ships its devkit scripts in the `merge` mode through its `ship:` entries
(ADR 0022 decision 9 says the repository turns the train on; no change has done it yet), so its own
roadmap runs are of the second kind today.

ADR 0002 rejected GitHub's merge queue (org plans and setup, not needed for one maintainer), and ADR
0022 found that GitHub offers it only to repositories owned by an organization, which
`chacal88/devkit` is not. ADR 0006 decision 3 still has a lone `/devkit change` schedule nothing. For
a roadmap run, ADR 0021 decision 4 keeps one session cron in the coordinating session, firing about
every 30 minutes, whose periodic check hands a freed place, stops the run's stale wait loops and
archives finished sessions, and never hands a stage or starts a session; ADR 0021 decision 2 has each
change session of this machine wait for a place in a background wait of its own. A change counted
from `origin` (one on another machine) still ends blocked with `no-place` and is woken by one message,
with nothing scheduled for it (ADR 0020 decision 5, as ADR 0021's Note keeps it). ADR 0011 already has
a change session keep a background wait on GitHub, with no time limit, for its checks and its merge.
ADR 0020 makes `origin` the only thing the machines of a run share; the run's bookkeeping file (ADR
0013 decision 4) lives in one clone's git directory and does not reach another machine. A session on
the Linux worker gets no GitHub notices. On the CompozyOS driver a roadmap run is started by
`roadmap-loop.mjs compozy-start` as a CompozyOS run, merges nothing itself and leaves the merge to the
ship mode (ADR 0024 decision 3, proposed).

## Decision

1. **One merge turn per roadmap run.** In a roadmap run that records a queue, exactly one change
   pull request or archive pull request holds the merge turn at a time. The turn is per run, not per
   pack or per file: under the strict up-to-date rule any merge of the base leaves every other pull
   request behind, whatever packs it touches.
2. **Who queues, in what order.** A change joins the queue when its review is approved at its own
   head, that is, when every item of the delivery contract is met except being up to date with the
   base and the CI wait; an archive pull request joins when it is `archive-pr-ready`. They are served
   in the order they joined, deliveries and archives in one queue. The head of the queue holds the
   turn, so the holder is always ready.
3. **What a turn is.** The holder merges the base once, redoes only what that merge made stale, runs
   the full suite once on that commit, and enables auto-merge. It hands the turn on only when its
   pull request merges or it leaves the queue.
4. **Leaving and rejoining.** A change leaves the queue by itself when its review stops being
   approved at its head (a failed review, a new commit, a return to plan revision), its CI turns
   red, or its pull request comes to conflict with the base outside the release files or in a way
   that cannot be classified; the next in line holds the turn at its next loop call, with no message
   from the coordinator. Approved again, it joins at the end. Only a conflict the release override
   resolves may be queued: a change or archive whose conflict with the base is outside the release
   files, or cannot be classified, never joins, and one already queued leaves once and then gets the
   conflict stop it would get without a queue, at every call until the conflict is resolved by hand,
   so joining and leaving cannot alternate. A release-file conflict is resolved in the holder's turn.
   The renumber of an ADR whose number the base took (the loop's `renumber-adr` step) is work of the
   turn, not a reason to leave: only the holder is handed it, and keeps the turn through that commit
   and the evidence and reviews it makes stale; a waiting change keeps waiting and gets its renumber
   once it holds the turn, after its own base merge. Nothing reorders the queue by hand. Nothing
   passes the turn by time: neither a timer of this change nor the run's periodic check of ADR 0021
   decision 4, which neither grants, takes nor reorders a turn (decision 7).
5. **The lock is in the change's own loop.** For a queued change without the turn, `deliver-check`
   and `change-loop.mjs next` return a wait step that names the holder in place of
   `enable-auto-merge`; for the holder they return `enable-auto-merge` as today. Auto-merge is never
   enabled out of turn. The queue exists only where devkit itself enables auto-merge, that is, where
   the project ships in the `merge` mode: in `trunk` the step that declares the pull request ready is
   a report to the owner, who merges by hand, so holding it would hide a ready pull request without
   preventing a merge, and a `trunk` project reads no queue (the plan's settled point, against ADR
   0018 decision 2). In `two-prs` devkit enables no auto-merge (ADR 0018 decision 2), so the turn has
   nothing to withhold there and that project reads no queue either.
6. **The turn lives on `origin`, as refs outside the branches.** The queue and its turn are kept
   where a session on any machine of the run reads them: one marker ref of the run and one ref per
   entry, under `refs/devkit/` on `origin` (the plan names the refs). Each is created or deleted only
   by a push that names the ref's expected old value, never by force; a push that lost a race lists
   the queue again and retries, a bounded number of times the plan names. No branch and no file of
   any branch holds the queue. ADR 0020 rejected a ref outside the branches for claims, and the
   owner chose the branch, because the branch already is a claim's visible record and the ref would
   be a second record beside it, invisible on GitHub's pages; the queue has no branch that records
   it, an entry lives from a change's approval to its merge rather than for the change's whole life,
   and `/devkit status` shows it (decision 8). A change's loop reads the turn there when it runs. The
   coordinator's `wake` action only wakes a change session whose turn arrived, naming the change and
   its session; it carries no authority. Nothing relies on GitHub's pull-request notices.
7. **The turn arrives through the change's own wait on GitHub.** A queued change without the turn
   ends its loop as a wait on GitHub, and its session keeps the background wait on GitHub it already
   keeps for its checks and its merge (ADR 0011; the `change-coordination` requirement "The session
   waits on GitHub with no time limit"). Each poll of that wait computes the change's next step
   again, which reads the queue on `origin` once and the state of the pull requests ahead of the
   change only up to the first open one; the wait ends when the turn arrives, the holder changes or
   the change must leave. Nothing passes the turn by time: the turn passes only when a pull request
   merges or closes or an entry leaves the queue, and the wait only observes it. The owner settled in
   the grill of this change that no timer and no cron passes the turn. This change adds no schedule:
   a lone `/devkit change` keeps none (ADR 0006 decision 3), and a roadmap run keeps only the one
   session cron of ADR 0021 decision 4. That periodic check, or the coordinating session's own
   decision, may carry the coordinator's `wake` to a change session whose turn arrived and is not
   waiting (decision 6), as it carries other wakes; it grants, takes or reorders no turn, and a turn
   that waited for its next firing, about 30 minutes, would idle the base the turn exists to keep
   busy, while the change's own wait sees a merge at its next poll. A queued change's wait is the wait
   of an open change with an open pull request, so it is not one of the stale wait loops that check
   stops. ADR 0020 decision 5 (the owner's choice, grill answer 6) chose a message over a background
   poll for a change waiting for a place counted from `origin`, because such a change has just had
   its plan approved, has no pull request and keeps no wait on GitHub, so a poll would have been a
   wait holding a new process per waiting change; ADR 0021 decision 2 has since given each change
   session of this machine a background wait for its place. A change waiting for the turn, on any
   machine, already has an approved pull request whose checks and merge it waits on, so it keeps the
   one wait it would keep for its own CI and no process is added.
8. **ADR 0013 decision 4, amended.** The run's bookkeeping gains one field recording that the run
   keeps a merge queue (the plan names it); `/devkit status` shows, for each queued change or archive,
   whether it holds the turn or waits and behind whom, in the person's language.
9. **Scope, and a project with a delivery train records no queue.** With no queue recorded (a lone
   `/devkit change`, a project outside a roadmap run), `deliver-check` and the loop answer as before;
   this record adds no configuration key. A project whose delivery settings carry a train (a
   non-empty `devkit.delivery.train` that the settings reader accepts, the same reading that turns
   the train's rows on in `deliver-check`) records no queue: a roadmap run there pushes no marker and
   records that it keeps no queue, the change's turn is null whatever is on `origin`, and no change or
   archive of it is ever handed the steps that join or leave the queue or wait for the turn (the plan
   names them `join-queue`, `leave-queue` and `wait-turn`). Its changes and archives follow ADR 0022
   alone. Without this rule a boarded change would meet the queue's joining condition, join, and as
   holder find that its own step, `boarded`, is none of the steps that keep the turn, so it would
   leave at the next call and join at the one after, until the loop ends blocked for making no
   progress; the train already does what the turn is for, since a sibling's merge does not move a
   boarded head and nothing of it enables auto-merge. A refused train key is no train and no queue
   either: the checkers and loops stop on it with the setting's reply before any step. On the
   CompozyOS driver the run is started by `compozy-start`, which records no queue, so its changes
   read none (ADR 0024 decision 3). Which record governs: ADR 0022 governs every change and archive
   of a project with a train, inside a roadmap run or not; this record governs a roadmap run on the
   Claude driver in a project that ships in the `merge` mode and has no train; neither changes the
   other's case. Running both in one project (a turn among trains, or a train that waits for a turn)
   is not decided here and would need a record of its own. Whether a merge of the base makes evidence
   stale is decided elsewhere (`stale-only-on-own-files`); the turn only uses that result.
10. ADR 0002's conditions for auto-merge (8/8 pinned to the checked head, the required
   `devkit-reviews` check, disabling when the contract drops), ADR 0003's archive conditions, the
   rest of ADR 0013, ADR 0022 and the `devkit` ruleset are unchanged; the turn is one more condition
   before auto-merge is enabled inside a run.

## Consequences

- Positive: in a run, each ready change merges the base once and runs the full suite once instead of
  once per sibling merge; the coordinating session no longer relays turns by hand; a change on
  another machine learns its turn without GitHub notices; `/devkit status` shows who merges next. A
  project that opts into the train keeps the train's flow unchanged, with no queue on `origin`.
- Negative: changes merge one after another, so a ready change waits for every change ahead of it
  (Accepted: the wait replaces repeated evidence and review runs, which cost more). A holder whose CI
  hangs without turning red holds everyone (Mitigated: the owner can return it to plan revision or
  close it; there is no timer by decision). A record on `origin` is written by several machines and
  can race (Mitigated: the plan names the retry; the loop recomputes the turn on each call). A run
  that dies leaves a stale queue on `origin` (Mitigated: a change leaves it by itself when not
  approved, and the plan says how a new run starts it). A change whose conflict with the base lies
  outside the release files stays out of the queue until a person resolves it (Accepted: the release
  override cannot resolve it, and leaving once ends the join and leave cycle). Between loop calls
  GitHub still merges on required checks alone (Accepted, as in ADR 0002). Each waiting change's
  session keeps its wait on GitHub open while it waits, adding to each poll one listing of `origin`
  and about one pull-request read beside the reads the wait already makes (Accepted: it is the wait
  the change keeps for its own CI; a change outside a queue never waits for a turn). The queue does
  not show on GitHub's pages (Accepted: `/devkit status` shows it, and
  `git ls-remote origin 'refs/devkit/*'` lists it). Two answers to one cost live side by side, chosen
  per project by one key (Accepted: the train needs a whole-suite command and a departure request,
  and a project that has not opted in still gets the turn in a run). A project that turns the train
  on while a run keeps a queue leaves the queue's refs on `origin` (Mitigated: no change of it reads
  them any more, and the next run of a project without a train starts the queue again as the plan
  says).

### Review trigger

Auto-merge is enabled on a pull request out of turn; a queued change waits behind a holder that is
not ready; a change of a project with a delivery train is handed a queue step; the ruleset drops the
strict up-to-date rule (then a per-pack hold or none may be enough); the owner adopts GitHub's merge
queue, or turns the train on in every project that runs roadmaps (then this record has no case left);
a project needs the turn and the train together; GitHub stops accepting or listing refs outside the
branches; the waits of queued changes reach GitHub's rate limit.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Hold only changes that touch the same packs (the request's words) | Unrelated changes merge in parallel | The strict up-to-date rule leaves every open pull request behind on any merge, so it saves little; the practice of 2026-11-23 held every merge | low |
| GitHub's merge queue | Serialization done by GitHub | Rejected by ADR 0002 (org plans, setup) and again by ADR 0022 (offered only to repositories owned by an organization); its own up-to-date model replaces the ruleset's | medium |
| The delivery train of ADR 0022 as the only answer, with no turn | One mechanism; a sibling's merge costs a boarded change nothing | Opt-in per project and only for `trunk` and `trunk-auto`, so a project that ships in the `merge` mode without choosing a model, or does not opt in, keeps paying the cost in every run; it needs a whole-suite command and a departure request. Where a project opts in it governs alone (decision 9) | low |
| The turn applies in a project with a train too, a boarded change holding it until its train merges | One rule for every run | A boarded change never reaches `enable-auto-merge`, so the turn would withhold nothing, and a holder at `boarded` holds no step that keeps the turn, so it would join and leave on alternate calls; serializing trains is the train's own rule (one under way at a time, ADR 0022 decision 4) | low |
| The coordinator relays turns by message (the practice of 2026-11-23) | Nothing new | Slow, manual, the turn is the session's word and lost when it compacts; the owner asked to automate it | low |
| The turn only in the run's bookkeeping file | One existing file | It lives in one clone's git directory and does not reach another machine (ADR 0020) | low |
| A timer or the run's periodic check (ADR 0021 decision 4) passes the turn | No dependency on loop calls; the run already keeps one session cron | The owner settled in this change's grill that no timer and no cron passes the turn; a turn frees on a merge, which the waiting change's own wait on GitHub sees at its next poll, while the check fires about every 30 minutes and the base would idle until then; ADR 0021 keeps that check from handing stages, and a lone `/devkit change` schedules nothing (ADR 0006 decision 3) | low |
| The queue in a file on a branch of `origin` (one shared JSON file) | Visible on GitHub's pages, as ADR 0020 chose the branch over a claim ref | Every join and leave is a commit that the ruleset and the reader of claims on branches see; one shared file loses a write on every race unless each write is a compare-and-swap with retries; unlike a claim, no branch already records an entry, so a ref is not a second record (decision 6) | low |
| The coordinator's message alone brings the turn; a waiting change ends with no wait (ADR 0020's choice over a background poll of places) | No wait held by a waiting change | A turn frees by a merge on GitHub, which only a wait on GitHub sees; the coordinator learns it only at its next decision, and a run whose host cannot start sessions (ADR 0014 decision 6) has no change session to message; the change already keeps this wait for its own CI, so the poll ADR 0020 rejected (a new process per waiting change) does not arise (decision 7) | low |
| Lock in a hook that refuses `gh pr merge --auto` | Refuses the command itself | Hooks veto, they do not drive (ADR 0010 decision 5): the loop would still propose the step; a remote machine's hook cannot see the shared turn without the same read | medium |
| A command to reorder or hold the queue by hand | Owner control | Out of scope by the owner's answers; a return to plan revision already removes a change | low |
