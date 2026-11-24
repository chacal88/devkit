<!-- devkit-stage proposal result=passed attempt=4 commit=bfd5c0a9bf6ac9612041b1dd7fbb39003b86b4fa -->
# Proposal

Change: `delivery-merge-hold` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`). Roadmap round 17h.
Decision: [ADR 0025](../../../docs/adr/0025-a-roadmap-run-grants-one-merge-turn-at-a-time.md)
(proposed, listed in `decisions.md`). Planned against `main` at `ea482c0` (merged here at `bfd5c0a`),
which holds ADRs 0021 to 0024, flow version 2 and devkit-openspec 0.36.0.

## Why

The `devkit` ruleset requires every pull request to be up to date with `main`, so each merge leaves
every other open pull request behind: each one merges `main` again, redoes its evidence on the full
suite (13 to 21 minutes) and part of its review. In review-writer-prompt `main` moved three times under
PR 56; on 2026-11-23 the coordinating session of a two-machine roadmap run held the merges by hand,
messaging each change session when its turn came, and the owner asked for it to be automated.

## What Changes

- **A merge queue per roadmap run, recorded on `origin`.** A roadmap run with an `origin` in the merge
  mode marks the repository as holding a queue; a change pull request approved at its head, and a
  ready archive pull request, joins it; first approved, first served; the head holds the merge turn.
  The queue is refs on `origin` (D-1), so another machine reads it.
- **The lock in the change's own loop.** A queued change or archive without the turn gets a wait
  naming the holder where it would merge the base or enable auto-merge; the holder merges the base
  once, runs the full suite once and enables auto-merge as today (rows and conflict rule: D-5; the
  wait: D-7).
- **Leaving and rejoining by itself.** A queued change that stops being ready leaves, and the next in
  line holds the turn at its next loop call; approved again, it joins at the end (D-4, D-5).
- **The coordinator only wakes.** When the turn passes, the coordinating session sends one message to
  the new holder's session unless it already waits on GitHub (D-8); the message carries no authority,
  and the periodic check passes no turn.
- **`/devkit status` shows the queue**: for each queued change or archive, "holds the merge turn" or
  "waits behind `<id>`", in the person's language.
- **No run, no lock.** Without a queue on `origin`, in the `trunk` and `two-prs` delivery models, in a
  project with a delivery train and on the CompozyOS driver, everything answers as today (D-4, D-8).
- Docs: ADR 0025 (proposed) amends ADR 0002, ADR 0003 and ADR 0013 decision 4; the flow page, the
  coordination design, CONTRIBUTING (whose manual "merge window" the queue replaces), the `devkit` and
  `ship-change` skills and the pack README follow (D-10); a devkit-openspec minor release.

Non-goals: holding by pack or by file; deciding whether a merge of the base makes evidence stale
(`stale-only-on-own-files`); the turn in a project with an accepted `devkit.delivery.train`, which keeps
no queue and follows ADR 0022 alone, and combining the two (ADR 0025 decision 9); GitHub's merge queue
(ADR 0002); a timer, a new cron, or a command that reorders or holds the queue; the order of roadmap
lines; the `devkit` ruleset; `/devkit project` slices; `flow-check.mjs`; a new flow version; the
`devkit-session` skill; the turn in `conduct-check`'s own reads (below).

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `queue-order`: in a roadmap run, changes whose review is approved at their head and archive pull requests that are `archive-pr-ready` are queued in the order they became so; exactly one of them holds the turn, the head.
- AC-2 `lock`: for a queued change that does not hold the turn, `deliver-check` and `change-loop.mjs next` return a wait step that names the holder instead of `enable-auto-merge`; for the holder they return `enable-auto-merge` as today. Auto-merge is never enabled on a pull request out of turn.
- AC-3 `hand-over`: when the holder's pull request merges, the next in the queue holds the turn at the next call of the loop.
- AC-4 `leave-and-rejoin`: when the holder's review stops being approved at its head, its head moves, or its CI turns red, it leaves the queue and the next takes the turn without any message from the coordinator; when approved again it queues at the end.
- AC-5 `other-machine`: a change running on another machine reads the turn from the shared place and gets the wait step or `enable-auto-merge` accordingly, with no GitHub notice; the coordinator's `wake` for a turn that arrived names the change and its session.
- AC-6 `status`: `roadmap-loop.mjs status` lists each queued change with "holds the turn" or "waits behind `<id>`", for deliveries and for archives.
- AC-7 `no-run-no-lock`: with no queue recorded (a lone `/devkit change`, or a project outside a roadmap run), `deliver-check` and `change-loop.mjs next` return what they return today.
- AC-8 `real-run`: in a real run of two changes ready at once, the second shows the wait step until the first merges and then merges itself with one merge of the base and one full-suite run; the proof covers a delivery behind a delivery, an archive behind a delivery, and a head that leaves the queue.

Reach of AC-2: "never" holds for every driver of a change in a roadmap run (`change-loop.mjs`,
`roadmap-loop.mjs`, `deliver-check <id>`, `ship-change`), which all read the turn. `conduct-check`'s own
reads (its CLI, the panel) read no queue; a change queued with auto-merge on out of turn has it disabled
at its next loop call (design D-4).

Exit criteria: every phase gate of `tasks.md` green, the whole suite
`node --test plugins/openspec/hooks/guard.test.mjs` green once, `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
`openspec validate delivery-merge-hold --strict` pass, and the real-run proof files of AC-8 exist.

## Capabilities

### New Capabilities

- `merge-turn`: who merges into the base inside a roadmap run: the queue on `origin`, joining, the
  order, the turn, the wait, leaving and rejoining, archive pull requests, and where no turn applies
  (no marker, `trunk`, `two-prs`, a delivery train, the CompozyOS driver).

### Modified Capabilities

- `change-coordination`: four ADDED requirements: the loop steps that join and leave the queue, the wait
  for the turn, an unreadable queue as the wait on a silent GitHub, and a run's change session holding
  that wait as the run's recorded wait.
- `roadmap-coordination`: seven ADDED requirements: the run's marker on `origin`, no marker in a project
  with a train or on the CompozyOS driver, its removal at the end, the periodic check passing no turn,
  the coordinator's message when the turn passes, no message to a change already waiting, and the
  board's merge-turn block.

## Impact

- `plugins/openspec/hooks/`: `deliver-check.mjs` reads the queue outside `--ci` (the steps `join-queue`,
  `leave-queue`, `wait-turn`; `--ci` unchanged); `change-loop.mjs` gains the `turn` subcommand, the rows,
  the leave on a return to the plan and the messages; `conduct-check.mjs` the actors and the conflict
  rule (D-5); `roadmap-loop.mjs` and `run-file.mjs` the `mergeQueue` field, the marker, the wake and
  the board (D-8).
- Skills `devkit` and `ship-change`; docs `docs/openspec-flow.md`, `docs/coordination-design.md`,
  `CONTRIBUTING.md`, `plugins/openspec/README.md`, ADRs 0002, 0003, 0013, `openspec/config.yaml`.
- `origin` gains refs under `refs/devkit/` while a run holds a queue; no branch, no file on any branch.
- Dependencies: ADR 0020 (`remote-worker`, archived) for other machines and the `wake` action; ADR
  0021 (`roadmap-sessions-upfront`, archived) for change sessions, the periodic check and `renumber-adr`;
  ADR 0022 (`delivery-train`, merged) for the train setting that turns the queue off; ADR 0024
  (`compozy-driver`, merged) for `compozy-start`, which keeps no queue.
  Open decisions inherited: none; ADR 0025 is proposed and accepted with the plan.
