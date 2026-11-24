# ADR 0014: In the desktop app each change of a roadmap run runs in a session of its own

- Status: accepted
- Amended by ADR 0017 (0017-a-change-state-is-derived-in-one-place.md)
- Amended by ADR 0020 (0020-a-change-can-run-on-another-machine.md)
- Amended by ADR 0021 (0021-a-roadmap-run-opens-every-change-at-its-start.md)
- Date: 2026-11-21
- Change: roadmap-coordinator-followups
- Supersedes: ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md), decision 1 where
  the host can start sessions, and its rejected option "App child sessions, one per change"
- Amends: ADR 0013, decisions 3 and 4; ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md),
  decision 2, what counts as a typed command
- Accepted by: the owner, on 2026-11-21, in the message that approved the plan of the change: `Aprovo` ("I approve"), given in answer to the question whether the owner approves the plan and ADR 0014; recorded in `openspec/changes/roadmap-coordinator-followups/approval.md`

## Context

Note (roadmap-sessions-upfront, 2026-11-22): [ADR 0021](0021-a-roadmap-run-opens-every-change-at-its-start.md) amends decisions 1 to 4. Every pending
change opens at the run's start and its session runs with no typed command, on the run's ticket; the
grill, the plan approval and the retro answers are asked in the coordinating session; a change
session waits for a place in itself, so a freed place needs no start; a roadmap run keeps one periodic
check. Decision 3, as [ADR 0017](0017-a-change-state-is-derived-in-one-place.md) amended it, is
amended again: while a change session waits for a place, the load or its dependencies, its title is
⏳ and the id. A start still happens only on a turn the owner typed. Decisions 5 and 6 are otherwise
unchanged.

Note (change-state, 2026-11-22): [ADR 0017](0017-a-change-state-is-derived-in-one-place.md) amends
decision 3: while the change is stopped, the title carries the state icon (🙋, ⏳ or ⛔) before the
stage icon, and 📦 alone once archived. Decisions 1, 2 and 4 to 6 are unchanged.

Note (remote-worker, 2026-11-22): a change of a run may run on another machine; its session is
started on that machine's SSH connection, in its worktree there
([ADR 0020](0020-a-change-can-run-on-another-machine.md)). Decisions 2 to 6 are otherwise unchanged.

The first real `/devkit roadmap` on this repository (2026-11-21) ran two changes inside the session
the owner typed it in, as ADR 0013 decision 1 says. Only one background task showed in the app, and
the owner could not tell what each change was doing. On 2026-11-21 the owner decided that every
change of a run gets an app session of its own, with an icon for the stage it is in, and had the
two changes moved into such sessions by hand.

ADR 0013 rejected app child sessions per change because a start needs the owner's turn or an
unbroken chain, the failure ADR 0010's survey found. What the app does now (seen live on
2026-11-21): it starts a session on a turn the owner typed, and refuses on a turn an automated
event started, a background task's end or another session's note. A session it starts is nested
under the session that started it, its end-of-turn reports return to that session, and it can
rename its own title; there is no session icon. The run also showed that a session the app
starts in a worktree of its own cannot write to two changes' worktrees, while a session started in
a change's worktree writes there. The app delivers a started session's task below a background
block, which ADR 0011's run detection did not read, so the moved sessions held no change lock.

## Decision

1. Where the host can start sessions, the session the owner typed /devkit roadmap in coordinates
   the roadmap only. It picks what starts, opens it, holds for the load and shows the run's lines
   and board. Each change it starts or resumes runs in a session of its own, started by it in the
   change's worktree with /devkit change for that change and nested under it. That session is the
   change's coordinator under ADR 0011: the change's stages, owner questions and approvals happen
   there. The coordinating session hands no stage.
2. A change session is started only on a turn the owner typed. On any other turn, and when the app
   refuses, the change waits: a line and the board say it starts at the owner's next message, and
   why. It never runs in the coordinating session in its place (ADR 0006 decision 2's answer). A
   change session's end-of-turn reports return to the coordinating session, which decides again on
   each; the report of the turn that archives the change says so in one line. Nothing is
   scheduled.
3. A change session's title is the icon of its change's stage and the change id. The icons are
   ❓ requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery and 📦 archive. The change session
   renames itself when the change loop reports another icon.
4. The task another session started a session with, in the host's form of a started session,
   counts as a command typed in it for ADR 0011's run detection.
5. ADR 0013 decision 3's "a change could start" counts only on a turn the owner typed. The
   run's bookkeeping also holds whether its changes run in sessions of their own, which change
   sessions were started, and what started the last turn (ADR 0013 decision 4 names them).
6. Where the host cannot start sessions, ADR 0013 decision 1 holds unchanged. The rest of ADR 0013
   holds everywhere.

## Consequences

- Positive: the owner sees each change in the sidebar, with its stage at a glance. A change's
  questions wait in its own session without blocking the others. Each session writes in its own
  worktree. The coordinating session stays small. A change session is held by the same locks as
  any /devkit change run.
- Negative: a change that becomes ready on a turn the owner did not type, after another change's
  archive included, waits for the owner's next message (Accepted: the line says so at once, and the
  app refuses a start on any other turn). A change session the owner closes is not restarted by the run
  (Accepted: /devkit change resumes it anywhere). A new coordinating session could start a second
  session for a change (Mitigated: the run's record of the started change sessions outlives the
  session that started them, and a session reads the app's list of the sessions it started
  first). The started-session
  form and the turn's origin are read from the host's words, which it does not document (Accepted,
  as in ADR 0011: a wrong reading fails open or waits for the owner).

### Review trigger

The app starts sessions on a turn the owner did not type, or refuses them on a typed turn; a
started session's end-of-turn reports stop returning to the session that started it; it changes
the form of a started session's first message; it gains a session icon; a change session is found
handing work for another change, or the coordinating session handing a stage.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep every change in the typed session (ADR 0013 decision 1) | Nothing new to build | The owner cannot tell the changes apart; one background task shows; a session started in an app worktree cannot write to two changes | low |
| The changes take turns for a one-worktree session (this change's first draft) | Writes stay in one folder | Still one session and nothing visible; one stage at a time | low |
| Child sessions started with the app's wake-up when they are done (ADR 0006) | The coordinator is called back when a change is done | ADR 0006's wake-up chain is what ADR 0010's survey found breaking, and the end-of-turn reports already return without it | medium |
| A change session messages the coordinating session when its change is archived | An explicit signal | Needs the coordinating session's app id in every brief; its turn could not start the next session either, and the report already returns | low |
| A subagent in place of a refused session | Never waits | Hides the change the owner asked to see; ADR 0006 decision 2 rejected it | low |
| A retry on a timer | No owner message needed | A cron or wake-up, which ADR 0006 decision 3 rules out, and the app refuses its turn anyway | low |
| A session icon set through the app | A real icon | The app has no such tool; a leading emoji in the title shows the same in the sidebar | low |
