<!-- devkit-stage proposal result=passed attempt=2 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Proposal

Change: `delivery-train` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (source:
`requirements.md`, answers 1 to 9 given under the owner's delegation of 2026-11-23; decision record
ADR 0021, `docs/adr/0021-reviewed-changes-leave-on-a-delivery-train.md`, listed in `decisions.md`).

## Why

Under the strict up-to-date rule of the `devkit` ruleset (ADR 0002), every merge of a sibling sends
each open change to `update-branch`, and an update that touches a file outside `openspec/` makes the
change redo its evidence and part of its review on the whole suite (13 to 21 minutes each; on
2026-11-22 `stage-roles` redid its demonstration four times, two of them only for merges of `main`).
The cost grows with the number of changes in flight, which is what a roadmap run raises. GitHub's
merge queue is not offered to a repository owned by a user account, so devkit builds its own train.

## What Changes

- An opt-in key, `devkit.delivery.train`, whose value is the project's whole-suite command, turns the
  train on for the models `trunk` and `trunk-auto` (ADR 0018). Without it nothing changes; with
  `two-prs`, or with no model, the configuration is refused with its reason (`design.md` D-1 resolves
  the requirements' AMBIGUOUS key name).
- Boarding: a change whose review is approved at its own head, with every other item of the delivery
  contract met except "up to date with the base" and pending checks, is reported as boarded. It is
  never sent to `update-branch`, `verify` or `review` because the base moved, and auto-merge is never
  enabled on its pull request. A ready archive pull request boards the same way, and the serialized
  archive queue goes away.
- Departure: `/devkit train` (a new verb) runs one train at a time, on request, with no timer. It cuts
  `train/<n>` from `origin/<base>`, merges each boarded head in boarding order, renumbers the release
  files on the train only (`release-merge.mjs` gains a mode that merges a head into the current
  branch), runs the whole suite once, writes the train record `openspec/trains/<n>.md` and opens one
  pull request, merged with a merge commit (by GitHub in `trunk-auto`, by the owner in `trunk`).
- A red train finds the smallest red prefix by bisection, takes that change off with the failure
  attached, and runs the rest once more; a join conflict outside the release files (and outside a
  roadmap tick, resolved by rule on the train, `design.md` D-6) takes that change off with the paths.
  A change taken off waits for its train to land, then returns to its implementer; an archive taken
  off waits too, then merges the base into its branch when only release files and roadmap ticks are in
  the way, and otherwise stops for the owner with the paths, so it never leaves train after train.
- `devkit-reviews` gains a train mode: on a `train/<n>` pull request it judges each boarded change and
  archive at its own head, requires that head inside the train, refuses any commit of the train's own
  beyond releases, ticks and the record, and fails without a green, current train record.
- A change's evidence no longer has to prove the whole suite in a train project: a gate part equal to
  a part of the train's command is proven by the train record, both in the local delivery checker and
  in `devkit-reviews` on the change's own pull request, which reads the command from the default branch.
- After the train merges, each boarded pull request is merged by GitHub or closed by the train with a
  comment, and the change is delivered either way; a train head is never a change's own pull request.
- ADR 0021 (written at the decisions stage, `proposed`) is accepted with the plan and amends ADRs
  0002, 0003, 0012 and 0018 through dated notes; docs, skills, the pr-verifier agent and the release.

Non-goals: GitHub's merge queue; the train under `two-prs`; any timer, cron or periodic departure by
the coordinating session (`roadmap-sessions-upfront`); weakening the ruleset; resolving any other text
conflict automatically; `devkit-project` slices on the train (they deliver as today); a stop lock for
a train run; switching the train on in this repository, which is a one-line follow-up pull request
once the release is installed (`design.md` D-12), because the sessions run the installed pack.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

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

## Capabilities

### New Capabilities

- `delivery-train`: the opt-in train of a trunk project: its setting, when a change or an archive
  boards and in which order, the departure request, the joins and the release numbers on the train,
  the whole-suite run and the train record, the red train, the join conflict, the train's pull request
  and its merge, and what boarded and left changes wait for.

### Modified Capabilities

- `change-coordination`: `/devkit` gains the verb `train` (MODIFIED "The devkit command reads its
  verb"); a boarded change ends waiting for the departure and a change on a train waits on GitHub
  (ADDED).
- `change-delivery`: a train pull request is never a change's own; a change is delivered when the
  train that carries it merges; in a train project the whole-suite gate parts are proven by the train
  record (ADDED).
- `reviews-check`: the train mode of `devkit-reviews` on a `train/<n>` pull request (ADDED).
- `coordination-locks`: a typed `/devkit train`, like `/devkit status`, neither starts nor ends a
  roadmap run (ADDED).

## Impact

- devkit-openspec (minor): `hooks/guard.mjs` (the `train` key and the roadmap-run reading),
  `hooks/deliver-check.mjs` (train facts, boarding rows, the train record reader, the CI train mode and
  the train parts on every CI run, delivered-by-train), `hooks/release-merge.mjs` (the `--merge` mode,
  the roadmap tick rule and the `--roadmap-ticks` flag), a new `hooks/train-loop.mjs`,
  `hooks/change-loop.mjs`, `hooks/conduct-check.mjs` (the override for an archive that left a train),
  `hooks/flow-check.mjs`,
  `skills/devkit/SKILL.md`, `skills/ship-change/SKILL.md`; a new suite `hooks/delivery-train.test.mjs`.
  The `devkit-reviews` job still downloads the same three files and its workflow does not change; a
  project allows merge commits with the existing `github-setup.mjs --method merge`.
- devkit-core (patch): `agents/pr-verifier.md` (the train parts of a gate).
- Docs: ADR 0021 accepted and the notes in ADRs 0002, 0003, 0012 and 0018; `docs/openspec-flow.md`,
  `docs/coordination-design.md`, `docs/roles.md`, `CONTRIBUTING.md` (the tag of a train release),
  the `ADRs:` line of `openspec/config.yaml`, `plugins/openspec/README.md`, `CHANGELOG.md`,
  `.claude-plugin/marketplace.json`, `docs/catalog.md`.

**Dependencies.** `release-merge-conflict` (its code, `release-merge.mjs`, is on `main` since #65 at
`78b6cd7`; its folder is not archived yet, which this plan does not need); `delivery-models`
(archived: `devkit.delivery`). `roadmap-sessions-upfront` will call the command this change ships.

**Decisions cited.** ADR 0002, ADR 0003, ADR 0010 (decision 6), ADR 0012, ADR 0017, ADR 0018; ADR 0021
proposed (`decisions.md`).

**Open decisions inherited.** The three points ADR 0021 leaves to the plan are settled in `design.md`:
the command `/devkit train` and the key `devkit.delivery.train` (D-1, D-5), the roadmap tick resolved
by rule on the train (D-6), and both endings of a boarded pull request handled, merged by GitHub or
closed with a comment (D-9); the first train of this repository records which one GitHub gives. One
reading the owner confirms with the plan: the culprit's "own cycle against the train's tip" (ADR 0021
decision 7) runs against the base branch once the train it left has landed, waiting on GitHub until then
(D-7). ADR 0021's acceptance is the owner's, at plan approval.
