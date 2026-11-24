<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> every item the three retros carried onto stage-roles, moved here by the owner on 2026-11-21. Carried from the change-coordinator retro for its grill, as the first real use of /devkit change: a declared end for a pause the owner asks for and for a decision outside the script's gates; the end marker's id compared with the run's change; the skill's resolve-release-conflict item naming the declared end; the loop's fallback agent map tied to the pack table; a dated Note on ADR 0011 for the stop lock after a recorded end; the person's language checked with the installed plugin when it was never set; the unlimited wait on GitHub proved in real use; whether a change that creates the project's first spec may run on the short script; and whether the short script gains the owner's plan approval. Carried from the coordinator-field-fixes retro: a declared step for a review round the owner authorizes after the limit (the round script accepts a third round and the loop leaves `blocked` without a header set by hand); a plan file revised after the implementation started makes the readiness review and the approval stale; and the review's open nits of that change (the archive sources worded as a fallback chain in the change-coordination spec while the code takes their union, exit 1 of `github-setup` for a blocked state stated in a scenario, a test for an unreadable `.openspec.yaml`). Carried from the roadmap-coordinator retro, the first whole change run with /devkit change: a declared step for a small fix after a red gate, in place of a run that ends blocked; a way for a task to say that the conducting session does it, so the loop does not hand it to the implementer; how the wait on GitHub lives with a host that has its own pull-request monitor and forbids polling, so that the session still goes on alone when the checks pass; and the verifier allowed to write its runs' output under the change's `proof/` folder. Carried from the commit-attribution retro: a `fix-review` whose fix touches only `openspec/` leads to a re-review of the reviewer that rejected, not to the same fix again; the review round starts on a committed tree (`evidence.md` committed before it, the round's own files committed after it), so no verdict goes stale for bookkeeping; `open-pr` checks `git merge-tree` against a freshly fetched base, and a pull request that conflicts outside the release files gets a declared resolve step in place of a blocked end; and that change's open nits (the project-loop T25 negative that passes vacuously without the export, a test of its own for the roadmap scenario, T31's count of a literal phrase).

## Checked against main (2026-11-23, `origin/main` c1ac8c4)

The request is 24 items. Each was read against the code, the specs, the ADRs, the archived retros and `openspec/roadmap.md` as they are today.

### Dropped: already done or owned by another line

- The unlimited wait on GitHub proved in real use: done. The coordinator-field-fixes retro (`openspec/changes/archive/2026-11-21-coordinator-field-fixes/retro.md`, line 18) records that the background wait ended when the checks turned green and that auto-merge and the merge followed with no owner message.
- A `fix-review` whose fix touches only `openspec/` leads to a re-review: done by `review-openspec-fix` (`[x]` in `openspec/roadmap.md`; `plugins/openspec/hooks/deliver-check.mjs` `reviewRecord` and `verdictAllowed`, tests in `deliver-check.test.mjs`). The roadmap line `jira-entry-followups` still lists the same finding; that line should drop it, and it is not this change's work.
- The review round starts on a committed tree (`evidence.md` committed before it, the round's own files after it): owned by the roadmap lines `loop-place-and-evidence` (commit the evidence before the review round) and `jira-entry-followups` (a tree dirty only inside the change folder records its verdicts as committed).
- `open-pr`'s freshly fetched base: owned by the roadmap line `fresh-base-check` (the loop fetches `origin/<base>` before it judges a conflict). Only the half that no line owns stays here (see item 21 below).
- The roadmap lines `delivery-merge-hold`, `post-merge-validate`, `evidence-attempts-by-failure`, `stale-only-on-own-files`, `stage-ceiling-consecutive`, `forced-merge-path`, `delivery-train`, `compozy-driver`, `stage-models` and `jira-entry-followups` own none of the other items; they were read for overlap.

### Kept: still real today

Numbers are the request's order.

1. A declared end for a pause the owner asks for and for a decision outside the script's gates: `plugins/openspec/hooks/change-loop.mjs` `END_OF_KEY` has only `blocked` and `waiting-pr-decision`.
2. The `devkit-end: <id> <state>` marker's id is not compared with the run's change: `plugins/openspec/hooks/guard.mjs` `runMarkers` and `runOf`.
4. The loop's fallback `AGENT` map (`change-loop.mjs`) is a literal separate from the pack table `PACKS`; no test holds them together.
5. ADR 0011 has no dated Note for the stop lock after a recorded end (`stopDecision`, `end-recorded`).
6. The person's language: the tolerance exists (`normalizeLang`, scenario in `openspec/specs/change-coordination/spec.md`, test in `change-loop.test.mjs`); what is missing is the check against an installed plugin with the setting never set.
8. Whether a change that creates the project's first spec may run on the short script: no rule or ADR answers it.
9. Whether the short script gains the owner's plan approval: `docs/openspec-flow.md` says `devkit-lite` has "no separate plan approval"; the retro read this as conflicting with the owner's rule that the plan is approved before code.
10. A declared step for a review round the owner authorizes after the limit (`deliver-check.mjs` ends at `stop-review-deadlock` after round 2; `review-round.workflow.js` hard-codes "of 2").
11. A plan file revised after the implementation started marks nothing stale (`flow-check.mjs` skips `stale-plan` once started; `deliver-check.mjs` guards the approval with `!state.started`).
12. Nit: `openspec/specs/change-coordination/spec.md` words the archive sources as a fallback chain; the code takes their union.
13. Nit: `openspec/specs/project-setup/spec.md` does not state exit 1 of `github-setup` for a blocked state.
14. Nit: no test for an unreadable `.openspec.yaml` (the `catch` branch of `createdAfter`).
15. A declared step for a small fix after a red gate: a red `gate` goes straight to `reply blocked --param why=tests-red`.
16. A task cannot say that the conducting session does it (`deliver-check.mjs` `parseTasks` knows only the `Gate:` marker).
17. The wait on GitHub with a host that has its own pull-request monitor and forbids polling: `SKILL.md` always starts the background `wait`.
18. The verifier may not write under `proof/` (`guard.mjs` allows `pr-verifier` only its own file; `core/agents/pr-verifier.md` says "the only file you write").
21. Half of it: a pull request that conflicts outside the release files ends blocked (`conduct-check.mjs`), with no declared resolve step. The freshly fetched base is `fresh-base-check`'s.
22. Nit: `plugins/openspec/hooks/project-loop.test.mjs` T25 negative uses `CL.ATTRIBUTION_ASK ?? '\u0000'` and passes without the export.
23. Nit: the roadmap scenario of `openspec/specs/commit-attribution/spec.md` has no test of its own.
24. Nit: `deliver-check.test.mjs` counts the literal phrase `Attribution below` (T31).

Items 1, 10 and 15 are the same problem (a decision outside the gates with no declared step); one mechanism may serve all three.

## Checked against main again (2026-11-24, `origin/main` c663f21)

The kept items were read again against the merged tree (merge commit 0cf2aeb) and against the plans of
the sibling changes in flight (`loop-place-and-evidence`, `stage-ceiling-consecutive`,
`state-skips-unlocated`, `fresh-base-check`, `post-merge-validate`, `forced-merge-path`,
`project-slice-claim`, `jira-entry-followups`).

### Dropped: covered by main

- Item 3 (the `resolve-release-conflict` and `renumber-adr` items naming the declared end of a
  failure), with its AC-3. Main already settles it the other way, through the stage models (merge
  8f14bd1, `stage-models`, ADR 0023; `openspec/specs/stage-models/spec.md`, "A second failure or a
  failure on Opus ends the run blocked"): both items now say "`Outcome: failure` goes back to `next`,
  as for any agent", and the loop itself retries the hand-off once on the next model up, then gives
  the blocked end `role-failed` with its own `devkit-end:` line. The test
  `change-loop skill: an end the session declares goes through reply, and the marker lines are never
  shown (F1)` (`plugins/openspec/hooks/change-loop-compozy.test.mjs`) asserts that the Loop holds no
  `why=role-failed`, so the session's own declared end the item asked for would now contradict main.

### Kept, with what moved

- Every other kept item is still real on c663f21: `change-loop.mjs`, `guard.mjs`,
  `conduct-check.mjs`, `roadmap-loop.mjs`, `project-loop.mjs`, `pr-verifier.md` and the review round
  script did not change since the plan's last base (ea482c0); `deliver-check.mjs` and
  `flow-check.mjs` changed only for ADR 0025 (a base merge stales only on the change's own files),
  the delivery train and the archive check, none of it on the functions these items need.
- Item 21 (kept half): in a project with a delivery train (`devkit.delivery.train`, ADR 0022) a
  change or an archive in conflict with its base boards the train and is not stopped (the rows T5 and
  "A ready archive boards like a change" of `docs/openspec-flow.md` and the `delivery-train` spec), so
  the declared resolve step is met in a project without the train; this repository has the train on.
- `stale-only-on-own-files` merged (ADR 0025); it no longer is an in-flight line for the assumption
  below on the lines this change does not edit.
- No other item is owned by a sibling: `jira-entry-followups` (the round script's `args.dirty`,
  `reply --stdin`, a plan fix reaching `commit`), `forced-merge-path` (a forced merge's post-merge
  rows), `state-skips-unlocated` (`locate` and `state`), `project-slice-claim` (the slice's open
  claim), `loop-place-and-evidence` (a place end and the evidence commit), `fresh-base-check` (the
  fetch before a conflict is judged), `post-merge-validate` (validate after a base merge) and
  `stage-ceiling-consecutive` (how a stage's failures are counted) touch the same files but none of
  these items; the plan names where they meet.

### Added: the coordinator's field findings of 2026-11-24

Four defects found in the field on 2026-11-24 join this change (the coordinator's messages), the
first two checked on c663f21, the third on this branch, the fourth on `origin/main` d917ae0:

25. A change whose id starts with `archive-` loses its own pull request: `isArchiveHead`
    (`plugins/openspec/hooks/deliver-check.mjs:684`) tests `/^(chore\/)?archive-/`, so `isOwnPr` (`:710`)
    answers false for head `archive-release-pin`, `mergedOnBranch` (`:754`) and the merged-list
    search of `findChangePr` (`:786`) return `{ none: true }`, and `next` says the change has no pull
    request and never reaches the retro (`archive-release-pin`, PR 107). The loop creates only
    `chore/archive-<id>` archive branches; `archiveHeads` (`:681`) still accepts the older
    `archive-<id>`. The other places that read an archive prefix take the exact form and are right:
    `flow-check.mjs:190` (`offOwnBranch`, through `archiveHeads(id)`), `guard.mjs:232`
    (`archiveBranchChange`, `^chore\/archive-(.+)$`), `train-loop.mjs:275` (the same pattern),
    `change-loop.mjs:1799` and `conduct-check.mjs:121` and `:485` (`chore/archive-${id}`). No roadmap
    line owns it.
26. After a delivery train merged a change, a session that advanced the change's local branch to the
    base sees its evidence and reviews stale and is sent to the five reviewers again: the stage walk
    switches to the walk after the merge only off the change's own branch (`flow-check.mjs:283`,
    `postMerge` needs `offOwnBranch`), while `deliver-check.mjs:2019` needs only the delivery; on the
    own branch the walk calls `staleness` (`deliver-check.mjs:356`), whose own-files exemption
    (ADR 0025, `ownFiles`, `:309`) gives up when the head is already in the base, so the train's merge
    commits count against their first parent. ADR 0025's rule covers a base merged into a branch that
    is still ahead of it, not a branch advanced into the base; `post-merge-validate` (roadmap line 74),
    `evidence-attempts-by-failure` (line 79), `fresh-base-check` (line 71) and `own-files-by-content`
    (line 93) do not cover it either.
27. A third field finding of 2026-11-24 (the coordinator's second message, found by the change
    `run-status-bar`), checked on this branch at 20c0930 with the `openspec` CLI 2.0.0: the
    paragraph "The model of each stage" of `docs/openspec-flow.md` offers a change's own
    `.openspec.yaml` a `models:` table under a `devkit:` block, and `modelsOf`
    (`plugins/openspec/hooks/change-loop.mjs`) reads it there, but
    `openspec validate <id> --type change --strict` warns "Unrecognized key name(s) in .openspec.yaml
    ... devkit" and exits 1 on that file (it accepts only `schema`, `created`, `goal`,
    `affected_areas`, `initiative`, `skip_specs`, `retire_capabilities` and `x-` keys). A change
    that follows the document turns its own validation, its gates and the `check` red. Commit
    a9d75e9 of this branch wrote the table and 20c0930 removed it again. No roadmap line owns it.
28. A fourth field finding of 2026-11-24 (the coordinator's third message, found by delivery train 8,
    which spent three suite runs on it), checked on `origin/main` d917ae0: a test that pins the state of
    a live line of `openspec/roadmap.md` forbids the archive that changes that line. The test
    `post-merge-validate 3: the roadmap line names the merge check and the sibling that counts evidence
    attempts, and stays unticked` (`plugins/openspec/hooks/change-loop.test.mjs`) asserts
    `/^- \[ \] post-merge-validate/` on the live roadmap, so the archive of `post-merge-validate`
    (pull request 125), which ticks that line, turned its own `check` red and left the train. The same
    class, not biting yet: `jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry`
    (`change-loop-remote-state.test.mjs`) finds its line by the text `- [ ] jira-entry-live (after:
    jira-entry)` and asserts `done: false`, so the archive of `jira-entry-live` will fail it; and
    `stage-roles docs: the roadmap line of stage-roles keeps its text, and every carried item moved to
    coordinator-loop-fixes` (`change-loop-compozy.test.mjs`) asserts no tick but reads the live text of
    the `stage-roles` and `coordinator-loop-fixes` lines, which an archive or a roadmap edit may change.
    The rule "Test history" of `openspec/config.yaml` keeps tests off git history but says nothing of
    the live roadmap. No roadmap line owns it.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The items under "Dropped" are out of this change; nothing here re-does them.
- Items 1, 10 and 15 share one mechanism: a declared step or end the session can run through `change-loop.mjs reply`, so the stop lock in `plugins/openspec/hooks/guard.mjs` accepts it. The planner picks the shape; an owner-authorized round after the limit is written only from the owner's own typed message.
- Item 2 is a guard fix: a marker whose id differs from the run's change does not release the stop lock.
- Item 4: one source for the fallback map and the pack table, with a test that fails when they differ.
- Item 5 is a dated Note on `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`; the Decision is unchanged.
- Item 6 is a test and a documented check, not a new setting.
- Item 11: after the implementation started, a plan-file edit makes the readiness review and the approval stale, and `next` hands the revised plan back to its own gate.
- Item 16: a `tasks.md` line carries a marker (the planner names it) and the loop never hands that task to the implementer.
- Item 17: when the host has its own monitor and forbids polling, the loop ends the turn without starting the background `wait`, and the host's event starts the next turn.
- Item 18: `proof/` of the change folder is the verifier's second writable place, in `guard.mjs` and in `core/agents/pr-verifier.md`.
- Item 21 (kept half): a conflict outside the release files gets a declared resolve step, in the same way as `resolve-release-conflict`.
- The nits 12, 13, 14, 22, 23 and 24 are fixed as the request words them, each with its own test or spec edit.
- This change does not edit `plugins/*/` files owned by the in-flight lines (`loop-place-and-evidence`, `fresh-base-check`, `post-merge-validate`, `stale-only-on-own-files`, `stage-ceiling-consecutive`); where it touches the same function it merges main before its last gate.
- Item 9 (plan approval on the short script): `devkit-lite` keeps no separate plan approval; no gate is added or removed. The change only records the decision in `docs/openspec-flow.md` (the owner's go-ahead for a short-script change is the message that sends it). The owner can reopen it at the plan approval of this change.
- Item 8 (first spec on the short script): no rule changes. A change that creates the project's first spec follows the same choice rule as any other (the `why` codes of `change-loop.mjs`, `WHY_CODES`); the first spec is not a reason of its own, and `devkit-lite` already accepts a capability delta. The change only records this in `docs/openspec-flow.md`; no gate and no behaviour the owner sees changes.
- Item 15: a first red gate gets one declared fix step handed to `devkit-core:tdd-implementer`, then the gate runs again; a second red gate still ends the run `blocked` with `why=tests-red` (the planner may widen the bound, never remove it).
- The real-run proof of the change covers every case the plan declares (each input variant, and the conducting session's own part), as `CLAUDE.md` asks of a change that alters what an agent writes.

## Questions asked

1. [project rules] Should the short script (`devkit-lite`) gain the owner's plan approval? → No, it stays as it is; the change records the decision in `docs/openspec-flow.md`. Answered by the coordinating session under the owner's delegation, 2026-11-23; the owner can reopen it at the plan approval.
2. [scope] May a change that creates the project's first spec run on the short script? → No rule change; it follows the same choice rule as any change, recorded in `docs/openspec-flow.md`. Answered by the coordinating session under the owner's delegation (a recommended option that changes no gate), 2026-11-23.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `declared-step-outside-gates`: after the owner asks for a pause, or the session meets a decision outside the script's gates, a declared `change-loop.mjs reply` key records the end; ending the turn with its first output line is accepted by the stop lock, and the same turn without it is still refused. A test per case (pause, decision outside the gates).
- AC-2 `end-marker-id-checked`: a `devkit-end: <id> <state>` marker whose id differs from the run's change does not release the stop lock; one with the run's id does. Two tests in the guard's suite.
- AC-3 `skill-names-declared-end`: dropped, covered by main (merge 8f14bd1, `stage-models`): see "Checked against main again". No task or test of this change serves it.
- AC-4 `agent-map-from-pack-table`: the loop's fallback agent map and the pack table `PACKS` come from one source; a test fails when they differ.
- AC-5 `adr-0011-note`: `docs/adr/0011-the-change-coordinator-is-the-owners-session.md` has a dated Note on the stop lock after a recorded end, and its Decision section is unchanged.
- AC-6 `language-never-set`: with the person's language never set, the loop's messages come out in the project's default language with no unsubstituted placeholder, shown by a test and by one real run of the installed plugin with the setting absent.
- AC-7 `review-round-after-limit`: after the second review round, a declared step the owner authorizes with their own typed message hands a third round; `next` leaves `stop-review-deadlock` for it without a header edited by hand, and `review-round.workflow.js` accepts the round. Without that message the deadlock stays.
- AC-8 `plan-revised-after-start`: a plan file (`proposal.md`, `design.md`, `tasks.md`, a spec delta) edited after the implementation started makes the readiness review and the approval stale, and `next` hands the plan back to its own gate; a `tasks.md` tick or an evidence file does not.
- AC-9 `task-for-the-conductor`: a `tasks.md` line carrying the marker the plan names is never handed to the implementer; the loop leaves it to the conducting session and counts it done only when ticked.
- AC-10 `fix-after-red-gate`: a red `gate` hands one declared fix step to the implementer and runs the gate again; a second red ends the run `blocked` (`why=tests-red`).
- AC-11 `host-monitor-wait`: when the host has its own pull-request monitor and forbids polling, the loop ends the turn without starting the background `wait`, and the host's event starts the next turn, which goes on alone when the checks pass. Without that host, the background `wait` starts as today.
- AC-12 `verifier-writes-proof`: `pr-verifier` can write under the change's `proof/` folder, `guard.mjs` allows it, `core/agents/pr-verifier.md` says so, and a write outside `evidence.md` and `proof/` is still refused.
- AC-13 `resolve-outside-release-files`: a pull request that conflicts with the base outside the release files gets a declared resolve step; the run does not end blocked for it, and a conflict in the release files still uses `resolve-release-conflict`.
- AC-14 `nits-closed`: the change-coordination spec words the archive sources as their union; the project-setup spec states exit 1 of `github-setup` for a blocked state; a test covers an unreadable `.openspec.yaml`; project-loop T25 fails without the export; the roadmap scenario of the commit-attribution spec has a test of its own; T31 no longer counts a literal phrase.
- AC-15 `short-script-decisions-recorded`: `docs/openspec-flow.md` records that `devkit-lite` has no plan approval of its own by decision and that a first-spec change follows the ordinary choice rule; no behaviour changes: `devkit-lite`'s stages and gates are the same before and after.
- AC-16 `no-behaviour-change-elsewhere`: no behaviour changes for any item under "Dropped" and for the stages `devkit` runs today, other than what AC-1 to AC-13 and AC-17 to AC-20 state; the existing suites stay green.
- AC-17 `archive-prefixed-id-own-pr`: a change whose id starts with `archive-` and whose pull request's head is its own id finds that pull request as its own, merged or open, so `next` goes on to the retro after its merge; a head `chore/archive-<id>` (or `archive-<id>`) is still the archive of change `<id>` and never its own pull request, and another change's `archive-` head is neither. A test per condition, negatives included, and a real `next` run on `archive-release-pin`.
- AC-18 `delivered-advanced-branch-no-rereview`: a delivered change whose local branch was advanced into the base (its head contained in `origin/<base>`) goes to the retro with no new evidence or review round; on its own branch still ahead of the base, and for a change not delivered, the evidence and the reviews are judged as today.
- AC-19 `stage-models-override-validates`: the per-change override of a stage's model that `docs/openspec-flow.md` documents and the strict validation agree: either the loop reads the table from a place `openspec validate <id> --type change --strict` accepts, or the document stops offering the change's own `.openspec.yaml`; the plan decides which. A test writes the table exactly as the document shows it, runs `openspec validate <id> --type change --strict` on that change and asserts exit 0, and asserts that `modelsOf` reads the table's values (or, if the document stops offering it, that the document no longer shows it).
- AC-20 `no-test-pins-live-roadmap-state`: the `context:` rules of `openspec/config.yaml`, beside "Test history", say that a test never asserts the tick or the done state of a live line of `openspec/roadmap.md`, and that a line's old content is held as a fixture or a constant. The tests of finding 28 follow that rule, each named in the plan's test table with its invariant and the layer that owns it: `post-merge-validate 3: ... and stays unticked` (if still present on the base when the phase runs; that change's own archive may fix it first), `jira-entry AC-10 the roadmap has the live-proof follow-up after jira-entry`, and `stage-roles docs: the roadmap line of stage-roles keeps its text, ...`. Each corrected test passes on the live roadmap and on a copy of it with the line it reads ticked.

## Out of scope

- Every item under "Dropped".
- The `fresh-base-check` half of item 21 (the fetch before a conflict is judged).
- Any change to `devkit-lite`'s stages other than what item 9's answer decides.
