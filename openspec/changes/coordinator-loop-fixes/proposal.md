<!-- devkit-stage proposal result=passed attempt=5 commit=6e683aa3e98ecc40a3cdece58e1394082910e54e -->
# Proposal

Change: `coordinator-loop-fixes` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, the kept items 1, 2, 4 to 6, 8 to 18, 21 to 24 of its "Checked against main" list,
item 3 dropped there as covered by main, and the coordinator's four field findings 25 to 28 of 2026-11-24,
checked again against `origin/main` c09860c;
decision records: `decisions.md`, the change's ADR, accepted at the first plan approval, and the change's settings
ADR, which amends ADR 0023 decision 1 and is accepted at the owner's next approval).

## Why

Four retros of real `/devkit change` runs met decisions that no stage gate holds (an owner's pause, a
decision outside the gates, a third review round, a small fix after a red gate, an ordinary merge
conflict, a task only the session can do), and each ended on an undeclared stop, a false `blocked`
or a stage header edited by hand. The stop lock also accepts an end marker of another change, and a
plan revised after the implementation started keeps an approval the owner gave to the older plan.
The change's ADR decides how the loop declares each of these; this change builds it and closes the open
nits the same retros left. Two drivers run a change, the Claude session and CompozyOS: this change reaches
the second only where the plan says so (design D-19).

## What Changes

Each item in one line; the how is in `design.md`.

- One table of declared steps (`DECLARED`) and one helper (`declaredStep`) in `change-loop.mjs`: two new reply keys,
  `waiting-pause` and `waiting-owner-decision`, and a main-session-only command `declare` that records `gate-red`
  and `review-round` in `openspec/changes/<id>/declared.json`; `roadmap-loop.mjs reply` reads the same table (D-1).
- The stop lock accepts a recorded end only when its `devkit-end:` line names the run's change (D-2).
- A first red gate of a phase hands one fix to the implementer; a second ends the run `blocked` as today (D-3).
- The owner's own typed message at a review deadlock authorizes one more round of that review; the round limit
  and the code review stage's ceiling rise together (D-4).
- A pull request in conflict with its base outside the release files gets the step `resolve-base-conflict`
  in place of a blocked end, in a project without the delivery train (D-5).
- A task whose description starts with `Conductor:` is the conducting session's, never the implementer's (D-6).
- The approval records a digest of the plan files, on both drivers; a plan edited after the start goes back to
  its gates, a merge-defect fix included (D-7).
- `pr-verifier` may write under the change's `proof/` folder (D-8).
- The loops' fallback agent map comes from `PACKS` (D-9).
- With a host's own pull-request monitor that forbids polling, the session starts no wait and says so (D-10).
- A change whose id starts with `archive-` finds its own pull request (D-20).
- A delivered change on a branch advanced into the base goes to the retro with no new evidence or review (D-21).
- A change's own `budget` and `models:` move to an `x-devkit:` block of its `.openspec.yaml`, which the strict
  validation accepts; a `devkit:` block there is still read (D-22, the change's settings ADR; ADR 0023 gets a Note).
- `openspec/config.yaml` gains the rule that no test pins the tick of a live roadmap line, and the three tests
  that do follow it (D-23).
- Documents: ADR 0011's Note, `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/compozy-kit.md`, both
  schemas' review gate and tasks instruction, `openspec/config.yaml`'s ADR list (D-12); the nits of AC-14 (D-13).
- Non-goals: everything under "Dropped" in `requirements.md`; the `fresh-base-check` half of item 21;
  any change to `devkit-lite`'s stages or gates; the slice ADR review of `/devkit project` (its own
  two-round rule in the `project-definition` spec); the side panel's step names.

## Acceptance criteria

- AC-1 `declared-step-outside-gates`: after the owner asks for a pause, or the session meets a decision outside the script's gates, a declared `change-loop.mjs reply` key records the end; ending the turn with its first output line is accepted by the stop lock, and the same turn without it is still refused. A test per case (pause, decision outside the gates).
- AC-2 `end-marker-id-checked`: a `devkit-end: <id> <state>` marker whose id differs from the run's change does not release the stop lock; one with the run's id does. Two tests in the guard's suite.
- AC-3 `skill-names-declared-end`: dropped, covered by main (merge 8f14bd1, `stage-models`): both skill items say "`Outcome: failure` goes back to `next`, as for any agent", and the loop retries once on the next model up, then ends the run blocked `role-failed` with its own `devkit-end:` line (`requirements.md`, "Checked against main again").
- AC-4 `agent-map-from-pack-table`: the loop's fallback agent map and the pack table `PACKS` come from one source; a test fails when they differ.
- AC-5 `adr-0011-note`: `docs/adr/0011-the-change-coordinator-is-the-owners-session.md` has a dated Note on the stop lock after a recorded end, and its Decision section is unchanged.
- AC-6 `language-never-set`: with the person's language never set, the loop's messages come out in the project's default language with no unsubstituted placeholder, shown by a test and by one real run of the installed plugin with the setting absent.
- AC-7 `review-round-after-limit`: after the second review round, a declared step the owner authorizes with their own typed message hands a third round; `next` leaves `stop-review-deadlock` for it without a header edited by hand, and `review-round.workflow.js` accepts the round. Without that message the deadlock stays. The step is the Claude session's (`declare` is the main session's command); the CompozyOS driver's review loop keeps its two rounds.
- AC-8 `plan-revised-after-start`: a plan file (`proposal.md`, `design.md`, `tasks.md`, a spec delta) edited after the implementation started makes the readiness review and the approval stale, and `next` hands the plan back to its own gate; a `tasks.md` tick or an evidence file does not. It holds for both drivers: the approval the CompozyOS driver's `record-approval` writes carries the same `- Plan:` digest.
- AC-9 `task-for-the-conductor`: a `tasks.md` line carrying the marker the plan names is never handed to the implementer; the loop leaves it to the conducting session and counts it done only when ticked.
- AC-10 `fix-after-red-gate`: a red `gate` hands one declared fix step to the implementer and runs the gate again; a second red ends the run `blocked` (`why=tests-red`). It is the Claude session's; the CompozyOS driver keeps asking the owner at a red gate.
- AC-11 `host-monitor-wait`: when the host has its own pull-request monitor and forbids polling, the loop ends the turn without starting the background `wait`, and the host's event starts the next turn, which goes on alone when the checks pass. Without that host, the background `wait` starts as today. Design D-10 splits it: the first two sentences are proven here; whether the host's event wakes the session on green checks is carried by the roadmap line `host-monitor-wake` (task 6.5), and this change does not claim it.
- AC-12 `verifier-writes-proof`: `pr-verifier` can write under the change's `proof/` folder, `guard.mjs` allows it, `core/agents/pr-verifier.md` says so, and a write outside `evidence.md` and `proof/` is still refused.
- AC-13 `resolve-outside-release-files`: a pull request that conflicts with the base outside the release files gets a declared resolve step; the run does not end blocked for it, and a conflict in the release files still uses `resolve-release-conflict`. Design D-5 gives the pull requests this covers and the delivery-train cases that keep their own steps.
- AC-14 `nits-closed`: the change-coordination spec words the archive sources as their union; the project-setup spec states exit 1 of `github-setup` for a blocked state; a test covers an unreadable `.openspec.yaml`; project-loop T25 fails without the export; the roadmap scenario of the commit-attribution spec has a test of its own; T31 no longer counts a literal phrase.
- AC-15 `short-script-decisions-recorded`: `docs/openspec-flow.md` records that `devkit-lite` has no plan approval of its own by decision and that a first-spec change follows the ordinary choice rule; no behaviour changes: `devkit-lite`'s stages and gates are the same before and after.
- AC-16 `no-behaviour-change-elsewhere`: no behaviour changes for any item under "Dropped" and for the stages `devkit` runs today, other than what AC-1 to AC-13 and AC-17 to AC-20 state; the existing suites stay green.
- AC-17 `archive-prefixed-id-own-pr`: a change whose id starts with `archive-` and whose pull request's head is its own id finds that pull request as its own, merged or open, so `next` goes on to the retro after its merge; a head `chore/archive-<id>` (or `archive-<id>`) is still the archive of change `<id>` and never its own pull request, and another change's `archive-` head is neither. A test per condition, negatives included, and a real `next` run on `archive-release-pin`.
- AC-18 `delivered-advanced-branch-no-rereview`: a delivered change whose local branch was advanced into the base (its head contained in `origin/<base>`) goes to the retro with no new evidence or review round; on its own branch still ahead of the base, and for a change not delivered, the evidence and the reviews are judged as today.
- AC-19 `stage-models-override-validates`: the per-change override of a stage's model that `docs/openspec-flow.md` documents and the strict validation agree: either the loop reads the table from a place `openspec validate <id> --type change --strict` accepts, or the document stops offering the change's own `.openspec.yaml`; the plan decides which. A test writes the table exactly as the document shows it, runs `openspec validate <id> --type change --strict` on that change and asserts exit 0, and asserts that `modelsOf` reads the table's values (or, if the document stops offering it, that the document no longer shows it). Decided by this plan: the `x-devkit:` block, for `budget` too (design D-22).
- AC-20 `no-test-pins-live-roadmap-state`: the `context:` rules of `openspec/config.yaml`, beside "Test history", say that a test never asserts the tick or the done state of a live line of `openspec/roadmap.md`, and that a line's old content is held as a fixture or a constant. The tests of finding 28 follow that rule, each named in the plan's test table with its invariant and the layer that owns it: `post-merge-validate 3: ... and stays unticked` (if still present on the base when the phase runs; that change's own archive may fix it first), `jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry`, and `stage-roles docs: the roadmap line of stage-roles keeps its text, ...`. Each corrected test passes on the live roadmap and on a copy of it with the line it reads ticked.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-coordination`: the declared ends for a pause and for a decision outside the gates, the
  declared fix after a red gate, the owner-authorized review round, the resolve step for a conflict
  outside the release files (not for an archive that left a train), the session step for a conductor
  task, the wait with a host's own monitor, the archive sources worded as their union, and a change's
  budget read from the `x-devkit:` block of its `.openspec.yaml` (two modified requirements).
- `coordination-locks`: a recorded end counts as the run's last action only when it names the run's
  change (a modified requirement, with the scenarios of the declared pause and decision).
- `change-stages`: a plan revised after the implementation started goes back to its gates, a
  merge-defect fix included; the code review stage's ceiling, which the failures in a row are compared
  with, is its declared ceiling plus the rounds the owner authorized;
  after a merge the walk resumes at the retro on the change's own branch too when that branch was
  advanced into the base (a modified requirement).
- `change-delivery`: a task marked for the conducting session is never handed to the implementer
  and counts as done only when ticked; the review round limit follows the owner's authorizations; a
  head equal to the change's own id is never an archive head for its own pull request (a modified
  requirement).
- `delivery-models`: a conflict resolution's review deadlock comes after its round limit, 2 plus the
  rounds the owner authorized for that review, in place of "after the second round".
- `review-round`: the round script accepts a round up to an authorized limit.
- `file-writers`: the verifier's `proof/` folder, and the declared-steps record written only by the
  main session (no subagent writes the file or runs the command that writes it).
- `project-setup`: exit 1 of `github-setup` for a blocked state.
- `stage-models`: a change's table is read from the `x-devkit:` block of its `.openspec.yaml`, else
  from its `devkit:` block (a modified requirement).

## Impact

- `devkit-openspec` (minor bump): `plugins/openspec/hooks/change-loop.mjs`, `guard.mjs` (with
  `parseDevkitBlock`'s key and `changeDevkitBlock`),
  `deliver-check.mjs`, `flow-check.mjs`, `conduct-check.mjs`, `roadmap-loop.mjs`, `project-loop.mjs`
  and their tests (`change-loop.mjs` also holds the CompozyOS driver's approval writer, `approvalText` and
  `recordApproval`); `skills/devkit/SKILL.md`, `skills/devkit-session/SKILL.md`,
  `skills/ship-change/SKILL.md`; both schemas' `schema.yaml` (both copies, no flow version change);
  `skills/openspec-setup/scripts/github-setup.test.mjs`.
- `devkit-core` (minor bump): `agents/pr-verifier.md`, `agents/tdd-implementer.md`,
  `skills/review-change/SKILL.md` and `scripts/review-round.workflow.js` with its tests.
- `devkit-compozy` (minor bump): no source file of the pack is edited; the two templates
  `skills/compozy-setup/templates/agents/tdd-implementer/AGENT.md` and `.../pr-verifier/AGENT.md` are
  regenerated by `gen-agents.mjs` from the two core agent files, and this repository's `.compozy/` copies
  and `.compozy/kit-manifest.json` are installed again by `install-kit.mjs` (design D-19).
- Docs: `docs/openspec-flow.md`, `docs/coordination-design.md`, ADR 0011's Note, ADR 0023's Note (pointing to the change's settings ADR),
  `openspec/config.yaml` (the ADR list, the settings comments and the `Live roadmap:` rule), `CHANGELOG.md`, `.claude-plugin/marketplace.json`,
  `openspec/roadmap.md` (the `host-monitor-wake` line), `docs/compozy-kit.md`. Versions: each changed pack
  and the marketplace take the next free minor at merge (design D-18); the plan names no version.
- Dependencies: the change's ADR (accepted at the first plan approval through `accept-decisions`) and the
  change's settings ADR (proposed; accepted by `accept-decisions` after the owner's next approval, design D-7); ADR
  0010 decisions 3, 5 and 6; ADR 0011 decision 2; ADR 0016; ADR 0017; ADR 0022 (the delivery train,
  on in this repository); ADR 0023 (the stage models' retry, and decision 1's change override, amended by the change's settings ADR); ADR 0025 (a base merge stales only on the
  change's own files); ADR 0026 (the suite runs by file); ADR 0030 (no test holds a release's version).
  Sibling changes in flight touch the same files (design D-17); each phase that edits one of them opens
  with a merge of `origin/main`.
- Exit criteria: every phase gate green (each runs the test files its phase touches with
  `--concurrency=2`, design D-17; the whole suite runs only on the delivery train, at its head), the new
  tests under CI's branch variables, `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check`,
  `claude plugin validate .` and
  `openspec validate coordinator-loop-fixes --strict` green on the merged head (the loop's own
  `merge-check` after the last merge), and the real-run
  proofs of design D-14 recorded in `evidence.md`, and the roadmap line `host-monitor-wake` present
  in `openspec/roadmap.md`.
- Open decisions inherited: none blocking. AC-11's second half (the desktop app's monitor waking the
  session on green checks) is deferred to the roadmap line `host-monitor-wake` (design D-10).
