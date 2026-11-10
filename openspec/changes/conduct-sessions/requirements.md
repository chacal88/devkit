# Requirements

## Request

The owner, in their words (translated from Portuguese): "Looking at Compozy and at our orchestrator:
how could we take the orchestration part that works in Compozy and build something like it for our
Claude, as a plugin? I like the way I organized my skills and phases in the devkit, but the
orchestrator I am building there is not working well. The visual part of the mod worked, but it got
stuck on starting and grouping child sessions, which was the main point. The linked-sessions
features of Claude Code that were in test are live now. How do we organize all this into a final
solution that actually works?"

Decided with the owner on 2026-11-10, in the grill: this change replaces the roadmap's round 6 line
`remove-conduct`; it touches only this repository (the orquestrador panel and a Workflow-based
review are later changes); only the implementation phases run as child sessions; when the app
refuses to start a session the run stops and asks for the owner's turn, never falling back to a
subagent; the session cron goes away in favour of one capped watch plus the app's PR Auto-fix; each
child joins a sidebar group named after its change and is archived when its phase closes.

Classification: domain=process type=feature flags=[architecture (ADR 0001/0005 exception), contract (`conduct-check` JSON)] (confirmed: schema `devkit`)

### Facts

- `/conduct` (devkit-openspec 0.8.0, `plugins/openspec/skills/conduct/SKILL.md`) dispatches every
  runnable step as a background subagent of the owner's session. `plugins/openspec/hooks/conduct-check.mjs`
  maps steps to actors in `actorOf` (`SUBAGENT`, `MAIN`, `ASKABLE`, `OWNER`, `GITHUB`, `STOP`); the
  `implement` step maps to `devkit-core:tdd-implementer`. `wakeOf` asks for a session cron
  (`*/20 * * * *`, prompt `/conduct --wake`) when `end` holds and a change waits on GitHub. The JSON
  is `version: 1` with `wake` among its fields.
- `deliver-check.mjs` reports `implement` with `phase: <n>` (line 984) and `host` as `app` when
  `CLAUDE_CODE_ENTRYPOINT` is `claude-desktop`, else `cli` (`DEVKIT_HOST` overrides).
- `guard.mjs` lets product code in the `devkit` schema be written only by the `tdd-implementer`
  agent (`agent_type` from the hook input); a session with no `agent_type` is refused. Since 0.8.0 the
  hooks resolve the project root from the edited file's path and from a command's `cd`, so they gate
  work done inside `.claude/worktrees/<id>/`.
- ADR 0001 and ADR 0005 both name "Claude Code lets automation start sessions" as their review
  trigger. ADR 0005 recorded parallel step subagents and the session cron.
- `openspec/roadmap.md` on `origin/main` has round 5 (`commit-and-pr-trailer`, `conventions-trailer
  (after: commit-and-pr-trailer)`, the conduct dogfood, not started; their worktrees exist under
  `.claude/worktrees/`) and round 6 with one line, `remove-conduct`, unticked.
- The Claude Code desktop app, as observed from a session on 2026-11-10, offers these session tools:
  `mcp__ccd_session__start_session` (`initiation` user_asked | offer | own_initiative, `context`
  fresh | fork, `cwd`, `use_worktree`, `wake_when_done`, `name` ≤ 24 chars `[a-z0-9-]`, `title`,
  `prompt`, `background`, `model`, `effort`, `permission_mode`), `mcp__ccd_session_mgmt__list_sessions`
  (`{linked: true}` lists the sessions this one started, with `sessionId`, `name`, `isRunning`,
  `isArchived`, `startedBy` and `lastActivityAt`; observed on 2026-11-10: it has no `state` field),
  `mcp__ccd_session_mgmt__archive_session`, `mcp__ccd_sidebar__list_groups`, `create_group` and
  `move_sessions`, and `SendMessage`. Rules the app states: a start with `initiation: "user_asked"` is
  accepted on the owner's own turn and on a `<side-sessions-event>` turn that follows it, or another
  such turn, in direct sequence; a turn started by a cron, a scheduled wake-up or another session's
  message refuses every start. A child started with `wake_when_done: true` continues the parent, once
  the parent is idle, with a `<side-sessions-event>` message that quotes the first 400 characters of
  the child's report. The app refuses `start_session` from a session that is not the owner's desktop
  session (Remote Control, cloud).
- The orquestrador mod (chacal88/orchestrator 0.16.0) opens one child per step and keeps "pending
  starts" when the app refuses; it carries its own flow engine (`hooks/flow.ts`). It is the future
  consumer of this change's JSON and is out of scope here.

## Assumptions

- Roadmap: in `openspec/roadmap.md`, round 6's line `- [ ] remove-conduct — ...` is replaced by
  `- [ ] conduct-sessions — ...`; its title becomes `## Round 6: phases as child sessions`. No other
  roadmap line changes. The round 5 dogfood of `conduct-rounds` is not run before this change; this
  change's own dogfood (AC-11) conducts round 5 with sessions.
- Which steps open a session: only `implement` (one phase of `tasks.md`), and only when `host` is
  `app`. `fix-review`, `fix-defect`, `fix-checks`, `commit`, `verify`, `open-pr`, `plan`, `readiness`,
  `review` and every other step keep today's actor. In `host: cli` `implement` keeps actor `subagent`
  (`devkit-core:tdd-implementer`), unchanged.
- The child session is started by the coordination with `mcp__ccd_session__start_session`:
  `initiation: "user_asked"`, `context: "fresh"`, `cwd: <change worktree>` (the absolute path from the
  JSON), `use_worktree: false` (the folder already is the change's worktree), `wake_when_done: true`,
  `title: "<id>: phase <n>"`, `name` as the JSON gives it (derived from the change id and the phase
  number, at most 24 characters), `prompt` and `background` as the JSON's `session.brief` and
  `session.background` give them; `model`, `effort` and `permission_mode` are omitted (inherited).
- What the child does: exactly the `implement` step of one phase, inside its worktree: it dispatches
  `devkit-core:tdd-implementer` with "Implement phase <n> of change <id>; stop at its gate", waits for
  `Outcome:`, and ends its turn with a report whose first line is `Outcome: success` or
  `Outcome: failure: <reason>` followed by `Head: <sha>`. It does not run the gate, commit, push,
  open a PR, start sessions or edit product code itself (the guard refuses that anyway). The gate,
  the commit and everything after stay with the coordination, as today.
- The chain rule in the skill: `start_session` is attempted on every run; a refusal (the tool's error)
  ends the run for that change with the state `waiting for the owner: start session <id> phase <n>`;
  the phase is never run as a subagent in `host: app`. The report lists every session left to start.
  The owner's next typed `/conduct` starts them.
- Kinds of turn (replaces the `--wake` rule): only the owner's typed `/conduct` is the go-ahead
  (schemas, the grill, a `devkit-lite` change's first `implement`, `approval.md`, retro answers,
  starting sessions). A continuation turn (`<side-sessions-event>` after a child's end) advances
  what is already under way and starts the next session of every change under way, where "under
  way" is read from the recompute: at least one ticked task in `tasks.md`, or, in `devkit`, an
  `approval.md` that records the current readiness; it never takes a `devkit-lite` change's first
  `implement`, never writes `approval.md` or a retro answer, and leaves
  a schema, grill, approval or retro question asked for the owner's next message. An Auto-fix wake
  or any other turn the owner did not type runs GitHub-side steps only and starts no session
  (design D13).
- Parallelism and busy detection: `MAX_PARALLEL` stays 3; a child still working counts in `--busy`.
  The skill derives `--busy` from `mcp__ccd_session_mgmt__list_sessions({linked: true, limit: 100})`: a row
  with `isRunning: true` and `isArchived: false` (the fields the tool returns; it has no `state`)
  whose `name` is a conducted change's `sessionPrefix` (the session `name` without its phase
  number, carried by every change row of the JSON) followed by digits only counts as busy for that
  change, whatever
  its next step. An ended child is never busy; a child that ended without ticking a task stops the
  change (`blocked: phase <n>: ...`); a retried phase reuses the name. A `/conduct` run while a
  child works never starts a second session for the same phase (design D6).
- The cron goes away: `wakeOf`, the `wake` field, `CronCreate`/`CronList`/`CronDelete` in the skill
  and the `--wake` marker are removed. The JSON becomes `version: 2` (a field is removed). On its
  first run the skill deletes any session cron whose prompt starts with `/conduct` (migration), and
  never creates one.
- GitHub waits: when `end` holds and `github` is not empty, one capped `conduct-check --watch` (as
  today), then the run ends with `waiting on GitHub: <what>` and the line "Auto-fix wakes this session
  on a CI failure, a merge conflict or a review comment; green checks do not wake it: run `/conduct`
  again to go on". After `open-pr` the skill calls `mcp__ccd_pr__get_status` and, when the PR is not
  reported, `mcp__ccd_pr__bind_pr` for it. AMBIGUOUS: whether the app binds more than one PR per
  session: (a) one at a time, the skill binds the PR opened last and says so | (b) several; the
  planner resolves by reading the ccd_pr tool descriptions, and the skill text states the limit.
- Sidebar: right after a successful start the skill calls `mcp__ccd_sidebar__list_groups`, creates
  the group named exactly `<id>` with `create_group` when none exists, and moves the child into it
  with `move_sessions`. When a later recompute shows the phase's gate task ticked in `tasks.md`, the
  skill archives every idle linked session with that phase's name with
  `mcp__ccd_session_mgmt__archive_session`. The coordination itself is not moved. A child whose phase
  stopped (gate red, `Outcome: failure`) stays unarchived. A refused or declined archive, move or
  `bind_pr` is reported (`not archived:` / `not grouped:` / `not bound:`), not retried in the run and
  never stops the change (design D9).
- ADRs: a new `docs/adr/0006-phases-as-child-sessions.md` records the decision; ADR 0005's status
  becomes `superseded by ADR 0006` (its parallel-steps rule survives through ADR 0006, its cron does
  not); ADR 0001's note and review trigger point to ADR 0006. `openspec/config.yaml` `context` lists
  0005 and 0006.
- Release: devkit-openspec 0.9.0 (`plugins/openspec/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json` pack and marketplace `version`), a `## 0.9.0` CHANGELOG entry
  marking the JSON `version: 2` as **BREAKING** for consumers of `conduct-check --json`; devkit-core
  is not touched. Docs updated: `README.md` (the `/conduct` paragraph), `docs/openspec-flow.md`
  ("Conducting a round", the wake-up paragraph, the troubleshooting rows about the cron, the limits),
  `plugins/openspec/README.md`, `docs/catalog.md` regenerated.

## Acceptance criteria

- AC-1: With `DEVKIT_HOST=app`, `conduct-check --json` reports every change whose next step is
  `implement` with `next.actor: "session"` and a `session` object `{ title, name, cwd, branch,
  phase, brief, background }` where `cwd` is the change's worktree, `phase` the phase number, `name`
  at most 24 characters of `[a-z0-9-]` (the id cut to 20, then `-p<n>`; design D3), unique per
  change and phase, and `brief` names the change,
  the phase, the worktree, the `tdd-implementer` dispatch and the `Outcome:`/`Head:` report lines.
  Every change row, whatever its step, carries `sessionPrefix`: that `name` without its phase
  number. With `DEVKIT_HOST=cli` the same change reports `next.actor: "subagent"` with
  `devkit-core:tdd-implementer`, as in 0.8.0.
- AC-2: `conduct-check --json` has no `wake` field and `version` is 2; `dispatch` still holds at most
  three non-`main` ids minus `--busy`, with `session` rows counted like `subagent` rows.
- AC-3: `/conduct`, typed by the owner in the app, starts one child session per `session` row in
  `dispatch` with `wake_when_done: true` and `cwd` set to the change's worktree, and runs no
  `tdd-implementer` subagent for those phases in the coordination.
- AC-4: The child dispatches `devkit-core:tdd-implementer` for its phase and ends with the `Outcome:`
  and `Head:` lines; in the `devkit` schema, product code edited directly by the child is refused by
  the guard (test: the existing worktree test in `guard.test.mjs` extended with the hook's `cwd` set
  to the worktree, no `agent_type`, a product file inside `.claude/worktrees/<id>/` of a `devkit`
  change with approved readiness), and a `devkit-lite` case shows nothing is refused there, as in
  0.8.0.
- AC-5: When a child ends, the coordination's continuation turn (`<side-sessions-event>`) recomputes
  and, when the change's next step is again `implement`, starts the next child in that same turn,
  with no message from the owner. The skill's Start section states this continuation rule and the
  kinds of turn (design D13), and a test in `guard.test.mjs` pins the sentences. Two consecutive
  phases of one change complete this way in the dogfood (AC-11).
- AC-6: When `start_session` is refused, the run ends with the state `waiting for the owner: start
  session <id> phase <n>` for that change, lists every session left to start, and no subagent runs
  the phase. Independent changes keep moving in the same run.
- AC-7: A `/conduct` run while a child is still working passes that change in `--busy`, reports it
  `running`, and starts no second session for its phase.
- AC-8: A child is in the sidebar group named exactly its change id right after it starts, and is
  archived by the skill once its phase's gate task is ticked; a child whose phase stopped is not
  archived. A `/conduct` run never creates a session cron; it lists and deletes session crons only
  to remove a `/conduct` cron left by 0.8.0, on the first run after the upgrade.
- AC-9: When everything that can move waits on GitHub, the run does one capped watch, then ends with
  `waiting on GitHub: <what>` and the Auto-fix line; `get_status`/`bind_pr` are called after
  `open-pr`.
- AC-10: `docs/adr/0006-phases-as-child-sessions.md` exists with the decision, consequences, review
  trigger and alternatives; ADR 0005 reads `superseded by ADR 0006`; ADR 0001 points to ADR 0006;
  `openspec/config.yaml` lists both; `python3 scripts/gen-catalog.py --check` reports no drift and
  the docs named in Assumptions describe the session flow and no cron.
- AC-11: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3
  scripts/check.py`) passes, with tests for AC-1, AC-2, AC-4 and the skill-text pins (the chain
  rule, no cron, the sidebar group and archive, the Auto-fix line). After the merge and before the
  archive, round 5 of `openspec/roadmap.md` is conducted with sessions to `archived` and recorded in
  this change's `retro.md` `## Dogfood`, including: two consecutive phases started without the owner
  (AC-5), one refused start handled as AC-6, and one re-run while a child worked (AC-7).

## Out of scope

- The orquestrador panel reading `conduct-check` (a change in chacal88/orchestrator).
- Running the review round as a Workflow script, or any change to `review-change`.
- A declarative per-project flow file (which steps open sessions, agents, models, retry caps).
- Child sessions for any step other than `implement`, or in `host: cli`.
- Messaging a running child (`SendMessage`); a failed phase stops the change as today.
- Changing `ship-change`, `deliver-check`'s items, `release-rebase` or `approval.md`.
- Removing `/conduct` (the former round 6 line).
