<!-- devkit-stage requirements result=pending attempt=1 commit=none -->
# Requirements

## Request

> Replace the session-per-change design of `/devkit roadmap` (ADR 0021; ADR 0013 and ADR 0014 amended) with a conductor that needs no session per change. The owner's first real `/devkit roadmap 4` run (2026-11-27) showed: the host refuses a session start on any turn the owner did not type; a start ticket re-minted at every `next` (`plugins/openspec/hooks/roadmap-loop.mjs`, the block that sets `run.tickets[a.change]`) makes the entry guard refuse the opened sessions as `ticket-unknown`; with the places full the stop guard keeps demanding one more opening; a declared owner-decision end stays stuck until the command is re-typed. And on 2026-11-28 eleven child sessions each asked the owner questions in boxes the coordinator could neither answer nor close: the owner wants the conductor to answer and drive the changes itself. Design to plan: the owner types `/devkit roadmap <name> [round <k>] [<n>]` once; the run records its queue in its run file and installs one scheduled task of the project (the host's scheduled-tasks tool), whose tick is refused before the model when nothing is ready (an empty tick costs nothing); each tick claims the next ready item and runs that change's loop in a worktree of its own through a helper (an agent or a Workflow; no session, no ticket) up to its next wait (GitHub checks, a free place, a dependency), records the state and ends; the next tick goes on from the files. A helper never asks the owner: the grill is answered by the conductor from the files (the triage agent) and the owner's standing answers; what truly needs the owner (plan approval, retro answers, or whatever the owner delegates) becomes a `waits-for-owner` line shown in ONE place, the session the owner typed in or the phone, never a box per change. The task removes itself when the roadmap is done or on `stop`. First task of the plan, before the design is final: one real run proving a scheduled task can open a session with the devkit plugin and its hooks, and what an empty tick costs. The change removes the tickets, the `devkit-session` entry skill and the session cron. Model to read first, if installed on this machine: `~/.claude/plugins/cache/genesi/genesi/*/commands/unstick.md` and `caretaker.md`.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- 

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: 

## Out of scope

- 
