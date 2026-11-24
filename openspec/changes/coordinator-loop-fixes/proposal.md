<!-- devkit-stage proposal result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Proposal

Change: `coordinator-loop-fixes` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, the kept items 1 to 6, 8 to 18, 21 to 24 of its "Checked against main" list;
decision record: `decisions.md`, ADR 0022 as proposed).

## Why

Four retros of real `/devkit change` runs met decisions that no stage gate holds (an owner's pause, a
decision outside the gates, a third review round, a small fix after a red gate, an ordinary merge
conflict, a task only the session can do), and each ended on an undeclared stop, a false `blocked`
or a stage header edited by hand. The stop lock also accepts an end marker of another change, and a
plan revised after the implementation started keeps an approval the owner gave to the older plan.
ADR 0022 decides how the loop declares each of these; this change builds it and closes the open
nits the same retros left.

## What Changes

- One table of declared steps in `change-loop.mjs` (`DECLARED`) and one helper (`declaredStep`)
  through which the session declares every step or end outside the stage gates: two new reply keys,
  `waiting-pause` and `waiting-owner-decision` (both "waiting for the owner", no fifth state), and a
  new command `change-loop.mjs declare <id> <key>` for the two declared steps that are recorded,
  `gate-red` and `review-round`, in a new record `openspec/changes/<id>/declared.json` that only the
  main session writes: the guard refuses a subagent's write of the file and a subagent's
  `change-loop.mjs declare` command. `roadmap-loop.mjs reply` reads the same table.
- The stop lock lets a turn end on a recorded end only when its `devkit-end:` line names the run's
  change.
- A first red gate of a phase hands one fix to `devkit-core:tdd-implementer`, then the gate runs
  again; a second red gate of that phase ends the run `blocked` (`why=tests-red`), as today.
- After `stop-review-deadlock`, the owner's own typed message authorizes one more review round of
  the review in dispute (the code review, or in `two-prs` a conflict resolution's review); each
  review's round limit is 2 plus the rounds authorized for it, the code review stage's attempt
  ceiling in the stage walk rises by the same count (the loop meets that ceiling before the delivery
  checker's deadlock), and the round script accepts a `limit` argument (default 2, so every round
  without an authorization reads as today).
- A pull request that conflicts with its base outside the release files gets the declared step
  `resolve-base-conflict` (the implementer merges the base and resolves it), in place of a blocked
  end; a release-only conflict keeps `resolve-release-conflict`.
- A task whose description starts with `Conductor:` is the conducting session's: the delivery
  checker gives the session step `conductor-task` for it and never hands it to the implementer.
- The owner's approval records a digest of the plan files (ticks ignored); a plan file edited after
  the implementation started makes the readiness review stale and then the approval, so the revised
  plan goes back to its gates.
- `pr-verifier` may write under the change's `proof/` folder; its definition says so.
- With a host that has its own pull-request monitor and forbids polling, the session ends the turn
  without the background wait and says so; elsewhere the wait starts as today. Whether the desktop
  app's monitor wakes the session on green checks is not provable here and is carried to a roadmap
  line (AC-11 below).
- The fallback agent map of the loops comes from the pack table `PACKS` through one helper.
- Documents: a dated Note on ADR 0011, `docs/openspec-flow.md` (the two `devkit-lite` decisions, the
  declared steps, the round limit, the red gate), `docs/coordination-design.md`, the review gate
  sentence and the tasks instruction of both schemas, `openspec/config.yaml`'s ADR list.
- The nits: the archive sources worded as their union, exit 1 of `github-setup` for a blocked state
  in a scenario, a test for an unreadable `.openspec.yaml`, project-loop T25, a test of the
  commit-attribution roadmap scenario, deliver-check T31.
- Non-goals: everything under "Dropped" in `requirements.md`; the `fresh-base-check` half of item 21;
  any change to `devkit-lite`'s stages or gates; the slice ADR review of `/devkit project` (its own
  two-round rule in the `project-definition` spec); the side panel's step names.

## Acceptance criteria

- AC-1 `declared-step-outside-gates`: after the owner asks for a pause, or the session meets a decision outside the script's gates, a declared `change-loop.mjs reply` key records the end; ending the turn with its first output line is accepted by the stop lock, and the same turn without it is still refused. A test per case (pause, decision outside the gates).
- AC-2 `end-marker-id-checked`: a `devkit-end: <id> <state>` marker whose id differs from the run's change does not release the stop lock; one with the run's id does. Two tests in the guard's suite.
- AC-3 `skill-names-declared-end`: the `resolve-release-conflict` and `renumber-adr` items of `plugins/openspec/skills/devkit/SKILL.md` name the declared end (`reply blocked --param why=role-failed`) for `Outcome: failure`, and a test reads the skill for it.
- AC-4 `agent-map-from-pack-table`: the loop's fallback agent map and the pack table `PACKS` come from one source; a test fails when they differ.
- AC-5 `adr-0011-note`: `docs/adr/0011-the-change-coordinator-is-the-owners-session.md` has a dated Note on the stop lock after a recorded end, and its Decision section is unchanged.
- AC-6 `language-never-set`: with the person's language never set, the loop's messages come out in the project's default language with no unsubstituted placeholder, shown by a test and by one real run of the installed plugin with the setting absent.
- AC-7 `review-round-after-limit`: after the second review round, a declared step the owner authorizes with their own typed message hands a third round; `next` leaves `stop-review-deadlock` for it without a header edited by hand, and `review-round.workflow.js` accepts the round. Without that message the deadlock stays.
- AC-8 `plan-revised-after-start`: a plan file (`proposal.md`, `design.md`, `tasks.md`, a spec delta) edited after the implementation started makes the readiness review and the approval stale, and `next` hands the plan back to its own gate; a `tasks.md` tick or an evidence file does not.
- AC-9 `task-for-the-conductor`: a `tasks.md` line carrying the marker the plan names is never handed to the implementer; the loop leaves it to the conducting session and counts it done only when ticked.
- AC-10 `fix-after-red-gate`: a red `gate` hands one declared fix step to the implementer and runs the gate again; a second red ends the run `blocked` (`why=tests-red`).
- AC-11 `host-monitor-wait`: when the host has its own pull-request monitor and forbids polling, the loop ends the turn without starting the background `wait`, and the host's event starts the next turn, which goes on alone when the checks pass. Without that host, the background `wait` starts as today. Split by this plan (`requirements.md` keeps the wording above; design D-10):
  - proven in this change: with host instructions that name a monitor and forbid polling, the session starts no `wait` and says that the host's monitor holds the wait; without them, the background `wait` starts (T82, real runs R13a and R13b);
  - deferred to the next change run in the desktop app: whether the host's event wakes the session when the checks pass, so that it goes on alone. Carried by the roadmap line `host-monitor-wake` (task 6.5) and recorded by this change's retro; this change does not claim it.
- AC-12 `verifier-writes-proof`: `pr-verifier` can write under the change's `proof/` folder, `guard.mjs` allows it, `core/agents/pr-verifier.md` says so, and a write outside `evidence.md` and `proof/` is still refused.
- AC-13 `resolve-outside-release-files`: a pull request that conflicts with the base outside the release files gets a declared resolve step; the run does not end blocked for it, and a conflict in the release files still uses `resolve-release-conflict`.
- AC-14 `nits-closed`: the change-coordination spec words the archive sources as their union; the project-setup spec states exit 1 of `github-setup` for a blocked state; a test covers an unreadable `.openspec.yaml`; project-loop T25 fails without the export; the roadmap scenario of the commit-attribution spec has a test of its own; T31 no longer counts a literal phrase.
- AC-15 `short-script-decisions-recorded`: `docs/openspec-flow.md` records that `devkit-lite` has no plan approval of its own by decision and that a first-spec change follows the ordinary choice rule; no behaviour changes: `devkit-lite`'s stages and gates are the same before and after.
- AC-16 `no-behaviour-change-elsewhere`: no behaviour changes for any item under "Dropped" and for the stages `devkit` runs today, other than what AC-1 to AC-13 state; the existing suites stay green.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-coordination`: the declared ends for a pause and for a decision outside the gates, the
  declared fix after a red gate, the owner-authorized review round, the resolve step for a conflict
  outside the release files, the session step for a conductor task, the wait with a host's own
  monitor, and the archive sources worded as their union.
- `coordination-locks`: a recorded end releases the stop lock only for the run's change.
- `change-stages`: a plan revised after the implementation started goes back to its gates; the
  code review stage's attempt ceiling is its declared ceiling plus the rounds the owner authorized.
- `change-delivery`: a task marked for the conducting session is never handed to the implementer
  and counts as done only when ticked; the review round limit follows the owner's authorizations.
- `delivery-models`: a conflict resolution's review deadlock comes after its round limit, 2 plus the
  rounds the owner authorized for that review, in place of "after the second round".
- `review-round`: the round script accepts a round up to an authorized limit.
- `file-writers`: the verifier's `proof/` folder, and the declared-steps record written only by the
  main session (no subagent writes the file or runs the command that writes it).
- `project-setup`: exit 1 of `github-setup` for a blocked state.

## Impact

- `devkit-openspec` (minor bump): `plugins/openspec/hooks/change-loop.mjs`, `guard.mjs`,
  `deliver-check.mjs`, `flow-check.mjs`, `conduct-check.mjs`, `roadmap-loop.mjs`, `project-loop.mjs`
  and their tests; `skills/devkit/SKILL.md`, `skills/devkit-session/SKILL.md`,
  `skills/ship-change/SKILL.md`; both schemas' `schema.yaml` (both copies, no flow version change);
  `skills/openspec-setup/scripts/github-setup.test.mjs`.
- `devkit-core` (minor bump): `agents/pr-verifier.md`, `agents/tdd-implementer.md`,
  `skills/review-change/SKILL.md` and `scripts/review-round.workflow.js` with its tests.
- Docs: `docs/openspec-flow.md`, `docs/coordination-design.md`, ADR 0011's Note,
  `openspec/config.yaml`'s ADR list, `CHANGELOG.md`, `.claude-plugin/marketplace.json`,
  `openspec/roadmap.md` (the `host-monitor-wake` line).
- Dependencies: ADR 0022 (proposed, accepted at the plan approval through `accept-decisions`); ADR
  0010 decisions 3, 5 and 6; ADR 0011 decision 2; ADR 0016; ADR 0017. Sibling changes in flight touch
  the same files (design, "Siblings"); this change merges `origin/main` before its last gate.
- Exit criteria: `node --test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
  `openspec validate coordinator-loop-fixes --strict` green on the merged head, and the real-run
  proofs of design D-14 recorded in `evidence.md`, and the roadmap line `host-monitor-wake` present
  in `openspec/roadmap.md`.
- Open decisions inherited: none blocking. AC-11's second half (the desktop app's monitor waking the
  session on green checks) is deferred to the roadmap line `host-monitor-wake` (design D-10).
