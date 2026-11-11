# ADR 0007: One change on request, never a sweep

- Status: accepted
- Date: 2026-11-10
- Change: conduct-one-change

## Context

ADR 0006 lets a conducting skill start one child session per implementation phase, in the change's
worktree, from the owner's turn and the chain of continuation turns that follows it. It says nothing
about which changes a run conducts: in 0.9.x the only conducting skill was the round sweep of
`openspec/roadmap.md`, which took every open change of the current round and reused any worktree
found by branch. Its first dogfood resumed a worktree left dirty by an earlier run, and the owner
had no way to name one change. The owner asked for the one-change shape: name a change, approve its
plan, watch its phases run as child sessions under it, nothing else touched, and no automatic or
roadmap-driven run.

## Decision

1. `/conduct <id>` conducts exactly the change the owner names. The checker's `--change <id>`
   restricts the report to that change without reading the roadmap; the skill reads and writes only
   that change's worktree, enforces no `after:`, and never picks a change on its own. A change that
   does not exist is an error, and is created only after the owner confirms the id and the schema.
2. The round sweep runs only on an explicit `round <n>`. A bare `/conduct` lists the open change
   ids and asks which one; it never sweeps.
3. Before anything of a change runs on a turn the owner typed, work already in its worktree
   (uncommitted paths outside `openspec/`, half-done phases) is reported, and the change goes on
   only when the owner's own message in that session says so.
4. ADR 0006's session rules hold per change, in both modes: one child per implementation phase,
   the chain of continuation turns, a refused start as a stop, the sidebar group named after the
   change, the archive on the phase's gate. ADR 0006 is amended, not superseded: it decides how
   phases run; this ADR decides which changes a run conducts.

## Consequences

- Positive: the owner is the one who picks; a stale worktree is seen before it is resumed; one
  engine (the checker) serves both modes and any later panel.
- Negative: ordering between changes is the owner's in single-change mode (Accepted: the roadmap
  stays a report, as ADR 0001 wanted). Two changes conducted one by one take two typed runs
  (Accepted: that is the request). A missing change costs one question before anything starts
  (Accepted: a typo'd id must create nothing).

### Review trigger

The owner asks for an unattended or roadmap-driven run again; a caller other than the skill (a
panel) needs the checker to list candidate changes; the unfinished-work question is answered by
anything but the owner's own message.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the sweep as the default and add `<id>` as a filter | Smallest change | A bare `/conduct` still sweeps; the owner's request was the opposite | low |
| Remove the round mode | Simplest skill | A round of independent changes loses its parallel run; the engine exists | low |
| Give `ship-change` the child sessions | No new mode | A second copy of the session rules in a host-agnostic skill; no worktree logic there | medium |
| Pick the change from the current branch | No argument needed | Silent selection is what the owner ruled out; `ship-change` already does it for its own flow | low |
