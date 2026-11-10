# ADR 0006: Phases run as child sessions started by the conducting session

- Status: accepted
- Amended by ADR 0007 (0007-one-change-on-request.md)
- Date: 2026-11-10
- Change: conduct-sessions

## Context

ADR 0001 ruled out starting or driving sessions because the app could not start a session from an
automated turn, and both it and ADR 0005 named "Claude Code lets automation start sessions" as
their review trigger. The desktop app now starts linked child sessions from the owner's turn and
from the continuation turns those children produce when they end (`wake_when_done`), lists them,
groups them in the sidebar and archives them. ADR 0005's parallel step subagents hid the phases
inside one session, and its cron fired only while the session was idle and could not have started a
session anyway. The owner chose, in the grill of `conduct-sessions`, visible and isolated phases,
a stop when a start is refused, and no cron.

## Decision

1. A conducting skill may start one child session per implementation phase (`implement`), in the
   change's worktree, with `wake_when_done`, from the owner's turn or from the chain of continuation
   turns that follows it. The child runs that one phase through the implementer agent and ends with
   its report; the gate, the commit, the reviews and the PR stay with the conducting session. No
   other step runs in a child. Which changes a run conducts is decided by ADR 0007.
2. A refused start stops that change for the run, as `waiting for the owner: start session <id>
   phase <n>`; the phase is never run as a subagent in its place. The owner's next message starts
   it.
3. The conducting skill schedules nothing: no cron, no wake-up. Waits on GitHub are one capped watch
   and the app's PR Auto-fix; green checks need the owner's re-run.
4. Unchanged from ADR 0001: every step is recomputed from the repository and GitHub; the owner's
   plan approval is a human gate; no state outside the repository, GitHub and the app's own list of
   sessions. ADR 0005 is superseded: its parallel dispatch (at most three steps at once, one step
   per dispatch) survives here; its cron does not.

## Consequences

- Positive: each phase has a session the owner can open, with its own transcript and its own
  worktree; a finished phase wakes the conductor without the owner; the one-writer rule is enforced
  inside the child by the same hooks.
- Negative: the chain breaks on any automated turn (a cron, a scheduled wake-up, a message from a
  session), after which the owner has to type once more (Accepted: the report says exactly what is
  left to start). Only one PR per session gets Auto-fix (Accepted: the others wait for the owner's
  re-run). Outside the desktop app nothing of this applies (Accepted: the CLI path is ADR 0005's
  subagent path without the cron). Moving and archiving sessions may ask the owner to approve
  (Accepted: `/conduct` is the standing request; the app decides whether to ask).

### Review trigger

The app lets an automated turn start sessions, or stops continuing the parent when a child ends; a
child session is found implementing more than its phase; a phase runs as a subagent in the app
host; `bind_pr` binds more than one PR per session.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep ADR 0005 (subagents and a cron) | Nothing new | Phases hidden; the owner blocked by one question; the cron cannot start sessions | low |
| Remove `/conduct` (`remove-conduct`) | Simplest | The owner is the loop again; the orquestrador panel has no engine to read | low |
| A session per step (plan, reviews, PR too) | Everything visible | More starts, more places for the chain to break; reviews are read-only fan-out that subagents fit | medium |
| Fall back to a subagent on a refused start | Never stops | Hides the phases the owner asked to see; the conductor edits product code through a side door | low |
| A daemon that starts sessions (Compozy-style) | Unattended | A harness outside the app; state outside the repository (ADR 0001) | high |
