<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> while a change's pull request is in delivery, the roadmap coordinator holds the merge of any other change that touches the same packs until it lands, and /devkit status shows the hold; in review-writer-prompt main moved three times under PR 56 and each move cost a rebase, an evidence run and a review of five reviewers (review-writer-prompt retro, item 3)
>
> Live input, 2026-11-23: in the two-machine roadmap run the coordinating session held these merges by hand, telling each session by message when its turn to merge main came; every merge of main made the other in-flight changes redo their evidence and reviews. The owner asked to automate it ("nao e possivel demorar tanto").

## Classification

domain=process, type=feature, flags=[architecture, contract] (strict-assumed; no screen, so no mock-up: `/devkit status` is plain text).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
Answers 1 to 4 below were given by the coordinating roadmap session ("DevKit roadmap 2") under the owner's delegation of 2026-11-23 for grill questions; the rest were settled from the code, the roadmap and the practice of that day. The owner confirms all of them with the plan approval.

- Hold criterion (Q1): one merge turn per roadmap run, not one per pack. The request says "the same packs"; the practice of 2026-11-23 held every merge of the run, and the ruleset's `strict_required_status_checks_policy: true` makes any merge of the base leave every other open pull request behind, so a per-pack hold would save little. The turn is held in the run file's record of the queue (the planner names the field) and handed to the head of the queue.
- Entry and order (Q2): a change joins the queue when its review is approved at its own head, that is, every item of the delivery contract is met except "up to date with the base" and the CI wait (the same boarding point `delivery-train` uses); first approved, first served. A change that is not approved joins nothing, so the head is always ready.
- What a turn is (Q2, coordinator): when its turn comes the change merges the base once and redoes only what that merge made stale (with `stale-only-on-own-files`, nothing when the base touched none of its files), runs the full suite once on that commit, enables auto-merge, and hands the turn on only when it merges or leaves the queue.
- Leaving and rejoining (settled): a change leaves the queue by itself when its review stops being approved at its head (a failed review, a new commit, a return to plan revision) or its CI turns red, and the next in line takes the turn at once (the case of 2026-11-23: `roadmap-sessions-upfront` went back to plan revision and `stage-models` took the turn). When approved again it joins at the end. There is no timer and no cron; this change adds no command to reorder the queue by hand.
- The lock (Q3): a real lock in the change's own loop. Without the turn, `plugins/openspec/hooks/deliver-check.mjs` and `change-loop.mjs next` return a wait step that names the holder of the turn in place of `enable-auto-merge` (and, in the delivery model `trunk`, in place of the step that declares the pull request ready for the owner to merge; AMBIGUOUS: (a) lock both | (b) lock only `enable-auto-merge`; the planner settles it against ADR 0018). The turn lives where a session on another machine can read it (the planner picks the place, for example a ref or a file on `origin`; the run file does not reach another machine). The coordinator's `wake` action only wakes the session; it carries no authority.
- No GitHub notice needed (Q3 and the coordinator's addition): a session on the Linux worker gets no GitHub check notices, so the turn arrives by the `wake` message (`roadmap-loop.mjs`, the `wake` action) and by the session reading the turn when its loop runs. Nothing relies on the app's pull-request notices.
- Archives (Q4): an archive pull request joins the same queue when it is ready (retro answered, the `archive-pr-ready` state of `deliver-check`), is served first come, first served with deliveries, and has the same lock and wait step (the practice of 2026-11-23: the `change-version-pin` archive was queued between deliveries by hand).
- Scope (settled): the queue and the lock exist only in a roadmap run that records a queue. A lone `/devkit change` and a project that does not run the roadmap behave exactly as today; no configuration key. In the delivery model `two-prs` the owner merges and devkit enables no auto-merge, so the lock has nothing to withhold there.
- Status (settled): `/devkit status` (`roadmap-loop.mjs status`) shows, for each change in the queue, whether it holds the turn or waits and behind whom, in the person's language.
- The line to the neighbours (settled): `stale-only-on-own-files` decides whether a merge of the base makes a change's evidence stale; this change decides who merges now and who waits, and only uses that result. `delivery-train` joins several reviewed deliveries into one merge; a change that boards a train takes no turn, because it leaves with the train, and the hold still governs every change and archive that does not board one. This change adds no code for trains (the train change is not merged yet) and does not use GitHub's merge queue (set aside by ADR 0002).
- ADR work: a new ADR records the merge turn, and amends ADR 0002 (what happens between "8/8" and the merge when several changes are ready) and ADR 0003 (the archive pull request takes a turn); `docs/openspec-flow.md` and `docs/coordination-design.md` change with it.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `queue-order`: in a roadmap run, changes whose review is approved at their head and archive pull requests that are `archive-pr-ready` are queued in the order they became so; exactly one of them holds the turn, the head.
- AC-2 `lock`: for a queued change that does not hold the turn, `deliver-check` and `change-loop.mjs next` return a wait step that names the holder instead of `enable-auto-merge`; for the holder they return `enable-auto-merge` as today. Auto-merge is never enabled on a pull request out of turn.
- AC-3 `hand-over`: when the holder's pull request merges, the next in the queue holds the turn at the next call of the loop.
- AC-4 `leave-and-rejoin`: when the holder's review stops being approved at its head, its head moves, or its CI turns red, it leaves the queue and the next takes the turn without any message from the coordinator; when approved again it queues at the end.
- AC-5 `other-machine`: a change running on another machine reads the turn from the shared place and gets the wait step or `enable-auto-merge` accordingly, with no GitHub notice; the coordinator's `wake` for a turn that arrived names the change and its session.
- AC-6 `status`: `roadmap-loop.mjs status` lists each queued change with "holds the turn" or "waits behind `<id>`", for deliveries and for archives.
- AC-7 `no-run-no-lock`: with no queue recorded (a lone `/devkit change`, or a project outside a roadmap run), `deliver-check` and `change-loop.mjs next` return what they return today.
- AC-8 `real-run`: in a real run of two changes ready at once, the second shows the wait step until the first merges and then merges itself with one merge of the base and one full-suite run; the proof covers a delivery behind a delivery, an archive behind a delivery, and a head that leaves the queue.

## Out of scope

- Holding by pack or by file (Q1); whether a merge of the base makes evidence stale (`stale-only-on-own-files`).
- Batching deliveries into a train, boarding, red-train bisection (`delivery-train`).
- GitHub's merge queue, a timer or cron to pass the turn, and a command to reorder or hold the queue by hand.
- Choosing the order of roadmap lines or when a change starts (`roadmap-sessions-upfront` and the roadmap loop's own rules).
- Changing the `devkit` ruleset (`check`, `devkit-reviews`, the strict up-to-date rule).
