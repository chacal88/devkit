# ADR 0020: A change can run on another machine, claimed on GitHub when it opens

- Status: accepted
- Amended by ADR 0021 (0021-a-roadmap-run-opens-every-change-at-its-start.md)
- Date: 2026-11-22
- Change: remote-worker
- Amends: ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md), the hold of a start by
  this machine's load and decision 4; ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md),
  decision 1, the change's worktree on this machine; ADR 0017
  (0017-a-change-state-is-derived-in-one-place.md), decision 4, the title of a change waiting for a
  place
- Accepted by: the owner, on 2026-11-23, in the message that approved the revised plan of the change, which includes the amendment of ADR 0017 decision 4: `Aprovo`; recorded in `openspec/changes/remote-worker/approval.md`

## Context

On 2026-11-21 three changes were opened on a second machine, a Linux worker reached over SSH, each
in an app session of its own. Their folders and branches lived only there: `/devkit status` on the
Mac listed them as ready, and a `/devkit roadmap` run on the Mac would have opened them again. The
owner required that no machine opens a change already open on another one. The owner also chose
SSH, with one app session per change, as the way a run uses another machine, and left Claude
Managed Agents to a roadmap line of its own (grill of `remote-worker`, answers 1 and 3).

ADR 0013 holds a start only by this machine's processor load. ADR 0014 starts each change session in
the change's worktree, which today is always on this machine. Every open change fills one place of
the run's number. Nothing is shared between machines but the repository on GitHub.

## Decision

1. Opening a change in a repository with an `origin` remote commits its folder, with the request and
   the machine's name, and pushes its branch at once, by a push that only creates the branch. A
   branch already on `origin` with the change's folder refuses the open and names the machine. The
   branches on `origin` are the one record of which change is open where.
2. The machines a roadmap run may use are a per-person setting of the pack (`machines`), never a
   project file. This machine is implicit and first. With the setting unset, ADR 0013 and ADR 0014
   hold unchanged.
3. With the setting set, a change opens on the machine that answers with the fewest open changes,
   this machine first on a tie. This machine is skipped while its load is at or above the limit,
   and a start is held only when no machine can take it. A change stays on its machine until its
   archive.
4. A change on another machine gets its worktree there from its branch, over SSH. It runs in an app
   session the coordinating session starts on that machine's SSH connection, in that worktree,
   nested under it, under ADR 0014's turn rules.
5. With the setting set, a change takes a place only from its implementation on, by pushing its
   approved plan. The change script counts the places from GitHub under a lock of the clone. With
   none free, the change ends blocked, waiting for a place (⏳, decision 8). When a place frees, the coordinating
   session sends one message to one waiting change, which checks again. Nothing polls and nothing
   is scheduled (ADR 0006 decision 3).
6. The run's bookkeeping also holds which changes it opened for another machine (`placed`); ADR 0013
   decision 4 names it.
7. No hook reaches another machine. A stage on another machine is held by that machine's own hooks
   (the same pack, installed there) and by the pull request's checks (ADR 0010 decision 5).
8. ADR 0017 decision 4, amended: a change waiting for a place is the one blocked end whose session
   title is `⏳ <id>`, ADR 0017's waiting icon with no ⛔ and no stage icon. A place wait is not a
   fault but a wait for a resource, which frees on its own when another change of the machine is
   archived, so it takes the waiting icon, not the blocked one. Its state stays `blocked` with the
   reason `no-place`; every other blocked end keeps ADR 0017's form.
9. ADR 0010 decisions 1 to 8 (the loop's four ends included: waiting for a place is a blocked end
   with its reason), ADR 0011, and the rest of ADR 0013, ADR 0014 and ADR 0017 are unchanged.

Note (roadmap-sessions-upfront, 2026-11-23): [ADR 0021](0021-a-roadmap-run-opens-every-change-at-its-start.md) counts the places of this machine's change
sessions on the run's ticket from the run file, not from `origin`, and keeps one session cron for a
roadmap run; its Note says how each point sits beside decisions 5, 7 and 8. The status and the
decisions above stay.

## Consequences

- Positive: no machine opens a change open on another one. `/devkit status` shows where each change
  is. A loaded machine sends new changes elsewhere instead of holding them. The owner's gates stay
  in each change's own session, wherever it runs.
- Negative: every change's branch is public from its open (Accepted by the owner with the plan of
  `remote-worker`). A change opened directly on a machine carries its hostname, which may differ
  from its SSH connection name (Accepted: the board shows it; the owner can name the connection
  after the hostname). Each decision of a run with machines asks every listed machine over SSH,
  20 s at most each (Accepted). Every machine needs the same pack version (Mitigated: one that
  answers in another form counts as not answering, and the documentation says so). The number of
  places of another machine is recorded in each change when it opens (Accepted: a change of the
  setting applies to the changes opened after it).

### Review trigger

The app stops starting sessions on an SSH connection, or stops returning their end-of-turn reports;
`SendMessage` stops reaching a remote session; GitHub stops honouring a push's expected old value; a
change is found open on two machines; the owner asks for Managed Agents or a machine without the
app.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| A draft pull request opened at open as the claim (grill answer 2, B) | Visible on GitHub's pull request list | A pull request before any plan; ADR 0012's check and ADR 0002's merge rules would judge it; the owner chose the branch | medium |
| A claim ref outside the branches, `refs/devkit/claims/<id>` (grill answer 2, C) | No public branch at open | A second record beside the branch, invisible on GitHub's pages; the owner chose the branch | medium |
| A shell command per machine, `ssh <host> 'claude -p ...'` (grill answer 3, B) | No desktop app needed | No session in the sidebar and no way for the owner to answer a gate there; the owner chose the app | medium |
| The machine list in `openspec/config.yaml` (the request's words; grill answer 8, B) | Shared by everyone on the project | The repository is public, and the list holds the owner's connection, folders and places | low |
| Every open change fills a place on its machine (grill answer 5, A) | Today's rule | A grill or a plan waits for a machine's place, which the owner rejected | low |
| A background poll of a machine's places (grill answer 6, B) | No message between sessions | A wait that holds a process per waiting change; the owner chose the message | low |
| The coordinator moves the changes of a silent machine (grill answer 7, B) | Work goes on | Two copies of one change when the machine wakes; the owner chose to keep them | high |
| Claude Managed Agents as a machine (grill answer 1, C) | No processor load on the owner's machines | No hooks, sessions outside the app; the owner made it a roadmap line of its own | high |
