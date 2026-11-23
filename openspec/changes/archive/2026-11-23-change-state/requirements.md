<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> one read-only command of the change loop derives a change's state from the files, GitHub and the roadmap run file: running, or one of the loop's four ends with its reason (waiting for the owner, waiting on GitHub, blocked, archived), and the stage; `/devkit status`, the session title's icon (beside the stage icons of `change-loop.mjs`, ADR 0014) and the panels read it alike, as a Managed Agents session reports one status with one stop reason (managed-agents-study F-1)

## Classification

domain=process type=feature flags=[contract] (confirmed: other parts of devkit read the command's output; the `devkit` script was chosen for it)

## Assumptions

<!-- Each confirmed by the owner or delegated by the owner to the coordinating roadmap session. -->
- The command is a read-only subcommand of `plugins/openspec/hooks/change-loop.mjs`, for one change or for all; its literal name and flags are the planner's (command by effect).
- The command writes no file, calls no AI and stores no state: the state is derived from the change's files, git, GitHub and the roadmap run file each time (ADR 0010, decisions 3 and 6).
- The state is one of `running`, `waiting-for-owner`, `waiting-on-github`, `blocked`, `archived`, with a reason when one applies and the stage with its title in the person's language; the output is JSON a later reader (the panels of `coordination-panels`) can parse.
- The state and its reason come from the same code that decides `change-loop.mjs next`, so the two never disagree.
- The stage icon table of `change-loop.mjs` (`STAGE_ICON`) stays as it is; the state icons are `🙋` waiting for the owner, `⏳` waiting on GitHub, `⛔` blocked, `📦` archived.
- The rule of when a session renames itself (`plugins/openspec/skills/devkit/SKILL.md`, Loop step 1a: sessions a roadmap run started) stays as it is; only the title it is given changes.
- `/devkit status` keeps its blocks and wording; its rows come from the command.
- The locks of `plugins/openspec/hooks/guard.mjs` keep reading the transcript to gate a run under way: they gate, they do not report a state.
- The `⏳ <id>` "waiting for a place" title the coordinating session of this roadmap batch uses by hand is not devkit behaviour; under this change such a change shows `running` with the reason "ready, waiting for someone to continue" and only its stage icon.

## Acceptance criteria

- AC-1 `one-change-state` — For one named change, the command prints its state, the reason when one applies, and the stage with its title in the person's language; `git status` is unchanged after it runs.
- AC-2 `all-changes-state` — Without a change named, the command prints one entry per open change folder under `openspec/changes/` and per change the roadmap run file lists, each as in AC-1.
- AC-3 `same-as-next` — For every end of the loop (waiting for the owner, waiting on GitHub, blocked with each reason, archived) and for a stage under way, the command's state and reason equal what `change-loop.mjs next` returns for the same files and the same GitHub answers; a test feeds the same facts to both.
- AC-4 `ready-no-session` — When the roadmap run file says a change has no session or waits for a place, the command prints `running` with the reason "ready, waiting for someone to continue"; with no roadmap run file, plain `running`.
- AC-5 `github-silent` — With GitHub not answering, a change whose stage needs GitHub prints `waiting-on-github` with the reason "GitHub did not answer", and a change whose stage does not need GitHub (the grill, the plan) prints its normal state.
- AC-6 `status-reads-state` — `/devkit status` builds each change's row from the command: a change in `waiting-for-owner` sits in the block of changes waiting for the owner, `blocked` in the blocked block, `running` and `waiting-on-github` under way; its existing tests stay green.
- AC-7 `title-state-icon` — The session title the loop gives is the stage icon and the id while the change runs (`🛠️ <id>`); the state icon, a space and the stage icon while it is stopped (`🙋 ❓ <id>`, `⏳ 🚀 <id>`, `⛔ 🛠️ <id>`); `📦 <id>` when archived; still cut to 59 code points.

## Out of scope

- Rewiring any panel to the new command: the panels read it in the later change `coordination-panels` (after: change-state).
- A stored event log or any state file of its own (ADR 0010).
- A budget or any new end of the loop (`change-budget` is its own change).

## Questions asked

1. [scope] Which surfaces read the one state in this change? → A: the new command, `/devkit status` and the session title's icon; the panels stay with `coordination-panels`. Answer delegated by the owner to the coordinating roadmap session (the owner asked it, in their own message there, to answer every question it has the information for), relayed on 2026-11-22.
2. [end effect] How does the session title show why a change stopped? → B: the state icon beside the stage icon, only while the change is stopped (`🙋 ❓ <id>` waiting for the owner, `⏳ 🚀 <id>` waiting on GitHub, `⛔ 🛠️ <id>` blocked); only the stage icon while it runs; only `📦` when archived. Answer delegated by the owner to the coordinating roadmap session (same message), relayed on 2026-11-22.
3. [edges] What does the state say when no end applies but nobody works on the change (session closed, waiting for a place)? → B: `running` with the extra reason "ready, waiting for someone to continue" when the roadmap run file says the change has no session or waits for a place; outside a roadmap run, plain `running`. Answer delegated by the owner to the coordinating roadmap session, relayed on 2026-11-22.
4. [edges] What does the command show when GitHub does not answer? → A: the same code as the loop's next step; without GitHub, `waiting-on-github` with the reason "GitHub did not answer"; a change that does not need GitHub at its stage shows its normal state. Answer delegated by the owner to the coordinating roadmap session, relayed on 2026-11-22.

## Escalations

- None: the request keeps ADR 0010 (derived state, no stored log) and ADR 0014 (one session per roadmap change, its title by stage).
