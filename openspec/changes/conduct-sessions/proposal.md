# Proposal

Change: `conduct-sessions` · Date: 2026-11-10 · Owner: kaue rodrigues dos santos · Requirements: [requirements.md](requirements.md) · Design: [design.md](design.md) · Roadmap: round 6 of `openspec/roadmap.md` (replaces `remove-conduct`)

## Why

`/conduct` (0.8.0) runs every step of a round as a background subagent of one session and wakes
itself with a cron. In use, that shape hides the phases (nothing to open, no worktree of its own to
look at), blocks the whole run while one owner question is pending, and the cron fires only when the
session is idle. ADR 0001 and ADR 0005 ruled out starting sessions because the app could not start
one from an automated turn; both name "Claude Code lets automation start sessions" as their review
trigger. That trigger fired: the desktop app now starts linked child sessions from the owner's turn
and from the continuation turns those children produce (`wake_when_done`), lists them, groups them
and archives them. The owner's orquestrador mod already proved the visible half (a panel, gates and
owner buttons) and got stuck exactly on starting sessions. This change gives the devkit the part
that was missing, in the one place that already computes the next step.

## What Changes

- **`conduct-check` names sessions.** In `host: app`, a change whose next step is `implement` gets
  `next.actor: "session"` and a `session` descriptor (title, name, cwd, branch, phase, brief,
  background) that any caller can hand to the app's `start_session`. In `host: cli` nothing changes.
- **`/conduct` starts child sessions for phases.** One child per dispatched phase, in that change's
  worktree, with `wake_when_done`. The child dispatches `tdd-implementer` for its phase and reports
  `Outcome:` and `Head:`; gate, commit, review and PR stay with the coordination. The chain rule is
  explicit: a refused start ends that change's run as `waiting for the owner: start session ...`,
  never a subagent in its place. Children join a sidebar group named after the change and are
  archived when the phase's gate is ticked.
- **The session cron goes away** (**BREAKING** for consumers of `conduct-check --json`: `wake` is
  removed, `version` becomes 2). Waits on GitHub are one capped watch plus the app's PR Auto-fix;
  green checks need the owner's re-run. The first run after the upgrade deletes a cron left by 0.8.0.
- **ADR 0006** records phases as child sessions, supersedes ADR 0005 and closes ADR 0001's trigger.
- **Roadmap**: round 6 becomes this change instead of `remove-conduct`.
- **Docs and release**: `README.md`, `docs/openspec-flow.md`, `plugins/openspec/README.md`, catalog,
  CHANGELOG; devkit-openspec 0.9.0. devkit-core is not touched.

## Acceptance criteria

- AC-1: With `DEVKIT_HOST=app`, `conduct-check --json` reports every change whose next step is `implement` with `next.actor: "session"` and a `session` object `{ title, name, cwd, branch, phase, brief, background }` where `cwd` is the change's worktree, `phase` the phase number, `name` at most 24 characters of `[a-z0-9-]`, unique per change and phase, and `brief` names the change, the phase, the worktree, the `tdd-implementer` dispatch and the `Outcome:`/`Head:` report lines. With `DEVKIT_HOST=cli` the same change reports `next.actor: "subagent"` with `devkit-core:tdd-implementer`, as in 0.8.0.
- AC-2: `conduct-check --json` has no `wake` field and `version` is 2; `dispatch` still holds at most three non-`main` ids minus `--busy`, with `session` rows counted like `subagent` rows.
- AC-3: `/conduct`, typed by the owner in the app, starts one child session per `session` row in `dispatch` with `wake_when_done: true` and `cwd` set to the change's worktree, and runs no `tdd-implementer` subagent for those phases in the coordination.
- AC-4: The child dispatches `devkit-core:tdd-implementer` for its phase and ends with the `Outcome:` and `Head:` lines; product code edited directly by the child is refused by the guard (test: the `edit` hook with no `agent_type` on a product file inside `.claude/worktrees/<id>/` of a `devkit` change with approved readiness).
- AC-5: When a child ends, the coordination's continuation turn (`<side-sessions-event>`) recomputes and, when the change's next step is again `implement`, starts the next child in that same turn, with no message from the owner. Two consecutive phases of one change complete this way in the dogfood (AC-11).
- AC-6: When `start_session` is refused, the run ends with the state `waiting for the owner: start session <id> phase <n>` for that change, lists every session left to start, and no subagent runs the phase. Independent changes keep moving in the same run.
- AC-7: A `/conduct` run while a child is still working passes that change in `--busy`, reports it `running`, and starts no second session for its phase.
- AC-8: A child is in the sidebar group named exactly its change id right after it starts, and is archived by the skill once its phase's gate task is ticked; a child whose phase stopped is not archived. A `/conduct` run never creates a session cron; it lists and deletes session crons only to remove a `/conduct` cron left by 0.8.0, on the first run after the upgrade.
- AC-9: When everything that can move waits on GitHub, the run does one capped watch, then ends with `waiting on GitHub: <what>` and the Auto-fix line; `get_status`/`bind_pr` are called after `open-pr`.
- AC-10: `docs/adr/0006-phases-as-child-sessions.md` exists with the decision, consequences, review trigger and alternatives; ADR 0005 reads `superseded by ADR 0006`; ADR 0001 points to ADR 0006; `openspec/config.yaml` lists both; `python3 scripts/gen-catalog.py --check` reports no drift and the docs named in Assumptions describe the session flow and no cron.
- AC-11: The test command (`node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`) passes, with tests for AC-1, AC-2, AC-4 and the skill-text pins (the chain rule, no cron, the sidebar group and archive, the Auto-fix line). After the merge and before the archive, round 5 of `openspec/roadmap.md` is conducted with sessions to `archived` and recorded in this change's `retro.md` `## Dogfood`, including: two consecutive phases started without the owner (AC-5), one refused start handled as AC-6, and one re-run while a child worked (AC-7).

## Capabilities

### New Capabilities
<!-- None: this repository keeps no openspec/specs/; behavior is pinned by the tests run from guard.test.mjs (precedents: every archived change under openspec/changes/archive/). skip_specs: true. See design.md D1. -->

### Modified Capabilities
<!-- None. skip_specs: true -->

## Impact

- **devkit-openspec** (`plugins/openspec/`): `hooks/conduct-check.mjs` (`actorOf` by host, the
  `session` descriptor, `wake` removed, `version: 2`), `hooks/conduct-check.test.mjs`,
  `skills/conduct/SKILL.md` (session rows, chain rule, busy from linked sessions, sidebar, cron
  migration, Auto-fix line), `hooks/guard.test.mjs` (skill-text pins and the AC-4 guard test),
  `README.md`, `.claude-plugin/plugin.json`.
- **Repo**: new `docs/adr/0006-phases-as-child-sessions.md`; `docs/adr/0005-...` (status) and
  `docs/adr/0001-...` (note, trigger); `docs/openspec-flow.md`, `README.md`, `docs/catalog.md`
  (generated), `openspec/config.yaml` (ADR list), `openspec/roadmap.md` (round 6 line),
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- **Runtime**: the Claude Code desktop app's session tools (`mcp__ccd_session__start_session`,
  `mcp__ccd_session_mgmt__list_sessions`, `archive_session`, `mcp__ccd_sidebar__*`, `mcp__ccd_pr__*`).
  Outside the app `/conduct` behaves as 0.8.0 minus the cron.
- **Dependencies**: none new (Node 22, `gh`, OpenSpec 1.16, git ≥ 2.38 as before).
- **Exit criteria**: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`, `openspec validate
  conduct-sessions --strict`; `check` and `devkit-reviews` green on the PR; after the merge, the
  round-5 dogfood with sessions reaches `archived` (AC-11).
- **Decisions cited**: ADR 0001 (its review trigger fired; the recompute-from-disk-and-GitHub rule,
  one step per dispatch and the owner's human gates are kept), ADR 0002 and ADR 0003 (unchanged),
  ADR 0004 (the hooks gate the child's worktree as an opted-in project), ADR 0005 (superseded: its
  parallel steps survive through ADR 0006, its cron does not). **New**: ADR 0006 (design D11).
