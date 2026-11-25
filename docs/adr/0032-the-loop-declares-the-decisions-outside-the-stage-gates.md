# ADR 0032: The loop declares every decision it meets outside the stage gates, and a plan revised after the start goes back to its gates

- Status: accepted
- Accepted by: the owner, on 2026-11-24, in the approval of the plan of change coordinator-loop-fixes (openspec/changes/coordinator-loop-fixes/approval.md)
- Date: 2026-11-23
- Change: coordinator-loop-fixes
- Number: the next free number on `origin/main` when drafted; it may be renumbered when the change
  merges the default branch, if a sibling change took it first
- Relies on: ADR 0010 (0010-openspec-as-the-harness.md), decisions 3, 5 and 6; ADR 0011
  (0011-the-change-coordinator-is-the-owners-session.md), decision 2; ADR 0017
  (0017-a-change-state-is-derived-in-one-place.md)
- Amends: no accepted record. It replaces the "two rounds at most" of the review stage in
  `docs/coordination-design.md` with a bound the owner can lift (the `review` stage's ceiling in the
  scripts' `flow.json` is unchanged and is raised by the recorded authorizations only), and the "a gate that stays red ends
  blocked" of `docs/openspec-flow.md` with one declared fix first

## Context

ADR 0010 decision 3 makes the loop end in one of four states (archived, waiting for the owner,
waiting on GitHub, blocked), and decision 5 lets the stop lock refuse the session's stop while a
stage is ready, naming it, without driving. Four retros of real `/devkit change` runs met decisions
that no stage gate holds, and each one ended in a way the script does not declare:

- The owner asked for a pause, or the session met a decision only the owner can take outside the
  gates: `change-loop.mjs reply` knows only `blocked` and `waiting-pr-decision`, so the session either
  fought the stop lock or declared a false `blocked`.
- The owner authorized a third review round after `stop-review-deadlock`: the round script refused
  it ("of 2"), and the loop left the deadlock only after a stage header was edited by hand.
- A first red gate with a small, obvious fix ended the run `blocked` (`why=tests-red`), and the
  owner restarted it for a one-line fix.
- A pull request that conflicted with the base outside the release files ended blocked, while a
  conflict in the release files has a declared step (`resolve-release-conflict`).
- A task that only the conducting session can do (a real run, a host setting) was handed to the
  implementer, who could not do it.

Two related facts of the stop lock and the approval gate were found on the way. The stop lock
accepts any recorded `devkit-end:` marker, whatever change id it names, so a marker of another
change releases it. And a plan file edited after the implementation started marks nothing stale:
the readiness review and the owner's approval still read as current for a plan they never saw.
ADR 0016's "a change under way is never sent back" is about stages added by a release, not about a
plan its own change revised, so it does not settle the second fact.

## Decision

1. Every decision the loop meets outside the script's stage gates is a declared key of
   `change-loop.mjs reply` or a declared step of `next`; the session never stops on an undeclared
   end, and no stage header is edited by hand to move a change on. A pause the owner asks for and a
   decision outside the gates each have their own declared end, both in the state "waiting for the
   owner" of ADR 0010 decision 3: no fifth end state is added, and their state and title are derived
   where ADR 0017 derives every other.
2. The stop lock lets the session end its turn on a declared end only when the end's `devkit-end:`
   marker names the run's change; a marker with another change's id releases nothing. A turn that
   ends without a declared end while a stage is ready is still refused. The hook still vetoes and
   does not drive (ADR 0010 decision 5).
3. After the second review round, the review's deadlock (`stop-review-deadlock`, or for the code
   review the stage walk's attempt ceiling of the `review` stage, which the loop meets first) stays
   until the owner authorizes one more round in their own typed message, recorded from the owner's
   session in the same way as the plan approval; a message from another session or agent is no
   authorization. Each authorization hands exactly one round of the review it answers: it raises
   that review's round limit, and for the code review its stage ceiling, by one; the round script
   accepts the round, and the loop leaves the deadlock for it by its own step.
4. A first red gate hands one declared fix step to `devkit-core:tdd-implementer`, then the gate runs
   again; a second red gate ends the run `blocked` with `why=tests-red`. The bound lives in the loop
   and may be widened by a later decision, never removed.
5. A pull request that conflicts with the base outside the release files gets a declared resolve
   step, in the same way as `resolve-release-conflict`; its role's `Outcome: failure` ends the run
   `blocked` with `why=role-failed`. A conflict in the release files keeps `resolve-release-conflict`.
6. A task line of `tasks.md` carrying the marker the plan names is the conducting session's: the loop
   never hands it to the implementer and counts it done only when ticked. The marker lifts no lock:
   the session does such a task under ADR 0011 decision 2, so a task that needs a product edit is
   never marked for it.
7. A plan file (`proposal.md`, `design.md`, `tasks.md`, a spec delta) edited after the implementation
   started makes the readiness review and the owner's approval stale, and `next` hands the plan back
   to its own gates, the owner's approval included. A `tasks.md` tick and an evidence file do not.
8. ADR 0010's and ADR 0011's decisions are otherwise unchanged; ADR 0011 gains a dated Note on the
   stop lock after a recorded end, its Decision section untouched.

Note (coordinator-loop-fixes, 2026-11-25): the approved plan of the change narrows decisions 3, 4,
5 and 7 in three places, so their review triggers do not fire there. First, the CompozyOS driver has
no `declare` step (`declare` is the main session's command, and a CompozyOS run has no main session):
it asks the owner at a red gate, in place of decision 4's one fix, and stops its review at two rounds,
with no round the owner authorizes under decision 3 (proposal AC-7 and AC-10; design.md, Goals /
Non-Goals). Second, an archive that left a delivery train and conflicts with the base outside the
release files and the roadmap ticks keeps its blocked `stop-archive`, in place of decision 5's resolve
step, because that conflict is a person's to resolve on the archive's branch
([ADR 0022](0022-reviewed-changes-leave-on-a-delivery-train.md), decision 8; design.md, Goals /
Non-Goals and D-5). Third, under decision 7 an approval written without a `- Plan:` line never goes
stale: it records no plan to compare (design.md, D-7). No decision's text changes.

## Consequences

- Positive: an owner's pause, a decision outside the gates, an extra review round, a small fix after
  a red gate and an ordinary merge conflict each go through a step the loop declares and the stop
  lock understands, so no run needs a hand-edited header or a false `blocked`; a marker of another
  change can no longer release a run; the owner's approval always covers the plan being built.
- Negative: more declared keys and steps in the loop and more cases in the stop lock (Mitigated: one
  mechanism serves the pause, the decision outside the gates and the extra round, with one test per
  key, and the stop lock's other cases are unchanged). A fix step after a red gate spends one more
  implementer hand-off before the run stops (Accepted: bounded to one, and the second red still
  ends blocked). A plan revised mid-delivery asks the owner again (Accepted: that is the point; a
  tick or an evidence file does not trigger it). A conductor task is trusted to need no product edit
  (Mitigated: the edit lock still refuses the session's product edit whatever the marker says).

### Review trigger

A run ends on an undeclared stop, or a header is edited by hand to move a change on; a third review
round runs without a recorded authorization from the owner's own message; a second red gate hands a
second fix; a marker of another change releases the stop lock; a plan edited after the start goes to
delivery without a new approval; the session makes a product edit for a task marked as its own.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep today's ends, the owner edits a header to go on | No new key | The retros record hand-edited headers and false `blocked` ends; the stop lock fights a pause | low |
| A fifth end state, `paused` | A distinct state for a pause | ADR 0010 decision 3 has four ends and ADR 0017 an icon per state; a pause is a wait for the owner | low |
| The stop lock accepts any `devkit-end:` marker, as today | No id read | A stale marker of another change releases the run | low |
| Fix after a red gate until green | No restart | An unbounded loop the attempt ceilings of ADR 0010 decision 3 exist to stop | low |
| The extra review round authorized by any message the session receives | Simpler to record | Only the owner's own typed message is a go-ahead (ADR 0011, ADR 0021) | low |
| A conductor task lifts the session's edit lock | The session can finish any task | The side door ADR 0010 decision 8 and ADR 0011 decision 2 closed | medium |
| A plan edited after the start stays approved, as today | No change sent back | The approval no longer covers the plan being built | low |
