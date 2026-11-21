# ADR 0013: The roadmap coordinator is the owner's session, and its stages run in the background

- Status: accepted
- Date: 2026-11-21
- Change: roadmap-coordinator
- Amends: ADR 0010 (0010-openspec-as-the-harness.md), the bullet of decision 8 that answers ADR 0005's "One subagent per whole change"; ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md), decisions 1 and 2, which name only /devkit change
- Accepted by: the owner, on 2026-11-21, in the message that approved the plan of the change: `Aprovo tudo` ("I approve everything"), given in answer to the question whether the owner approves the plan together with ADR 0013; recorded in `openspec/changes/roadmap-coordinator/approval.md`

## Context

ADR 0010 decision 2 asks for a roadmap coordinator that starts every change whose after:
dependencies are archived, several at once up to a number the owner sets per run. Its decision 8
takes up ADR 0005's rejected "One subagent per whole change" for that mode: "in the roadmap mode
of the Claude driver each change coordinator is a subagent. A question goes up to the session and
the roadmap coordinator asks it", with the repeated report of a nested subagent's end to be
"proved live before it is trusted". Section 10 of docs/coordination-design.md says the same.

ADR 0011 then decided that, in the Claude driver, the change coordinator is the session the owner
typed /devkit change in, held by hooks, because only that session can ask the owner the grill's
questions, write approval.md from the owner's own message, and be called back when a background
wait on GitHub ends. Each of those reasons holds for every change of a roadmap run as much as for
one change.

The locks of ADR 0011 follow one change per session: the reader of the run keeps only the newest
change id the loop printed, any slash command typed after /devkit change ends the run, and the
stop lock keeps one progress key per session. A run of several changes needs locks that follow
each of them.

The grill of the change roadmap-coordinator (2026-11-21) left the shape open between (a) a
change-coordinator subagent per change with the stage agents as its subagents, and (b) the session
running the loop of every open change itself, each stage handed to a subagent that runs in the
background, to be settled by a probe before anything is built on it.

## Decision

1. In the Claude driver the session the owner typed /devkit roadmap in is the roadmap coordinator
   and the change coordinator of every change the run holds open. It asks the loop for the next
   action of every open change, hands each stage to its role as a subagent that runs in the
   background, carries out the session steps one at a time, and asks the owner's gates in the
   session, one change at a time. There is one level of subagents, as in /devkit change.
2. Decision 1 holds only on facts the probe of the change roadmap-coordinator checked before
   anything was built on it: a subagent started in the background lets the session end its turn,
   its end starts a new turn of the session, and two of them at once both reach it.
3. The locks of ADR 0011 hold a roadmap run for every change it holds open. A roadmap run is under
   way when the newest slash command typed in the session, /devkit status aside, is /devkit
   roadmap and the roadmap loop printed its run line after it, both read from the session's
   transcript. In it the session writes no product code, hands work only to a role of the script
   of the change the hand-off names, and does not end its turn while a change has a stage ready
   that is not under way, or a change could start. The end of one change releases no other.
4. What the files cannot say about a run in progress is one run's bookkeeping, the form ADR 0010
   decision 8 accepts: one file in the repository's git directory, outside every working tree,
   holding the number the owner set, whether a stop was asked, which change's gate the owner is
   being asked, which stages and waits are under way, the ends the session declared and the events
   already announced, and nothing else. A hand-off the hook lets through marks its stage as under
   way and that subagent's stop clears it; the hooks still only veto and record.
5. ADR 0010's decisions 1 to 7, the rest of decision 8, and ADR 0011 for /devkit change are
   unchanged.

## Consequences

- Positive: every owner gate is asked in the session that can record it; the changes that do not
  wait on the owner keep running while the owner answers another one; no subagent sits two levels
  down, so the nested end ADR 0010 asked to prove is never relied on; a lost end costs one re-read.
- Negative: one session carries every open change (Mitigated: nothing is remembered; a compacted
  or new session reads the files and the bookkeeping file again). The bookkeeping file goes stale
  when a session dies with stages under way (Mitigated: a run started from another session starts
  it from empty; /devkit status shows what it holds). Two sessions running /devkit roadmap in one
  repository share the file (Accepted: one roadmap run per repository, documented; the opening of
  a change is serialized, so none is opened twice). Run detection reads an undocumented transcript
  format (Accepted, as in ADR 0011; a wrong reading fails open).

### Review trigger

A subagent started in the background stops reporting its end to the session, in real use or a
live test; Claude Code gives a subagent a way to ask the owner, or lets a session adopt an agent
definition; the bookkeeping file needs to hold anything the files or GitHub could hold; a product
edit by the coordinating session is found in a roadmap run.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| (a) A change-coordinator subagent per open change, its stages its own subagents (ADR 0010 decision 8 as written) | The literal design of section 10; each change's work stays out of the session's context | ADR 0011's three reasons hold per change: no owner questions, no approval.md, gone when a wait ends; every gate would end the subagent and be relayed; it relies on a nested subagent's end, the failure the owner reported | high |
| The session runs every loop, its stages in the foreground, one batch per turn | No background end to rely on | The session is busy until the slowest stage returns, so nothing moves while the owner answers another change | low |
| The run's bookkeeping in the transcript only | No file | A later turn, a hook and /devkit status in another session could not tell the number or what is under way without re-parsing the whole conversation | low |
| A program outside the session that runs the roadmap (a daemon) | No session context to fill | The owner's gates still need the session; ADR 0001 and ADR 0010 accept a daemon only as a driver of its own (round 22) | high |
| App child sessions, one per change (ADR 0006) | Each change visible in the sidebar | A start needs the owner's turn or an unbroken chain, the failure ADR 0010's survey found | medium |
