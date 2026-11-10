# Design

## Context

See proposal.md - Why. The pieces this design builds on:

- `conduct-check.mjs` already computes, per change of the round, `next` (a `deliver-check` step or a
  planning step) and `next.actor` through the static map `actorOf(step)`; `selectDispatch` caps the
  non-`main` runnable rows at `MAX_PARALLEL` minus `--busy`; `summarizeRound` yields `dispatch`,
  `owner`, `github`, `stopped`, `busy`, `end`; `wakeOf` adds `wake`. `deliver-check` already knows
  `host` (`app` | `cli`) and reports `implement` with `phase: <n>`.
- The guard hooks are worktree-aware (0.8.0) and, in the `devkit` schema, accept product edits only
  from `agent_type` `tdd-implementer`. A child session has no `agent_type`, so it must dispatch the
  implementer like the coordination does today.
- The desktop app's session tools and their rules are listed in requirements.md (Facts). Two of
  them shape the design: a start is accepted only on the owner's turn or on the unbroken chain of
  `<side-sessions-event>` turns that follows it; and `bind_pr` binds one PR to a session.
- The orquestrador mod will later read the same JSON to draw its panel and open the same sessions.
  Nothing here depends on it, but the descriptor is designed so a caller other than the skill can use
  it without reading the skill.

## Goals / Non-Goals

**Goals:**

- One source of truth for "which sessions to open": the checker. The skill and any later panel only
  hand its descriptors to the app.
- The chain rule written down once, with a deterministic outcome when it breaks.
- No step runs in two places: `implement` is the child's, everything else stays where 0.8.0 runs it.

**Non-Goals:**

- Driving a child after it started (follow-up messages, retries inside the child).
- Any new state file. The children are found through the app (`list_sessions`), the phases through
  `tasks.md`, as before.
- A per-project flow file. Which step is a session is a constant of this change.

## Decisions

### D1. No spec delta

This repository keeps no `openspec/specs/`; every archived change pinned behaviour with the tests
run from `guard.test.mjs` and set `skip_specs: true`. Same here.

### D2. The actor of `implement` depends on the host

`actorOf(step, host)` returns `{ actor: 'session', agent: 'devkit-core:tdd-implementer' }` for
`implement` when `host === 'app'`, and today's `{ actor: 'subagent', ... }` otherwise. `host` is the
one `deliver-check` computes (`DEVKIT_HOST`, else `CLAUDE_CODE_ENTRYPOINT`), read once per run and
passed down, so `--json` is reproducible in tests with `DEVKIT_HOST`. `RUNNABLE` gains `'session'`;
`selectDispatch` treats it like `subagent` (counted against the cap of three). `stateOf` is unchanged:
a dispatched session row is `running` when busy, otherwise its `next` summary.

Alternatives: a `--sessions` flag (rejected: the host already says whether sessions exist, and a
caller would have to know to pass it); sessions in `cli` too (rejected: no tool to start them).

### D3. The checker builds the session descriptor

For every `session` row the JSON carries `session: { title, name, cwd, branch, phase, brief,
background }`:

- `title`: `<id>: phase <n>`.
- `name`: `[a-z0-9-]`, at most 24 characters, unique per change and phase: the change id cut to
  `24 - length('-p<n>')` characters, trailing `-` removed, plus `-p<n>`. When two conducted changes
  would collide after the cut, the checker appends the first two characters of a short hash of the
  id before `-p<n>` (and cuts the id two more characters); a test pins both cases.
- `cwd`: the change's worktree (the row's `worktree`, absolute). `branch`: the row's `branch`.
- `brief`: the prompt, from a template in the checker: "Implement phase <n> of change `<id>` in
  `<worktree>` on branch `<branch>`. Work only there; every path is absolute under it; start every
  Bash command with `cd <worktree> && `; do not fetch. Dispatch `devkit-core:tdd-implementer` with
  the Agent tool: "Implement phase <n> of change <id>; stop at its gate." Wait for its `Outcome:`.
  Do not run the gate, commit, push, open a PR, start a session or edit product code yourself (the
  project's hooks refuse it). End your turn with exactly two lines first: `Outcome: success` or
  `Outcome: failure: <reason>`, then `Head: <sha of HEAD in the worktree>`."
- `background`: the round (`n`, title), the change's roadmap text when any, the schema, and "the
  coordinating session recomputes the next step when you end; it runs the gate and the commit".

Why the checker and not the skill: the panel change in the orquestrador mod should open the same
session from the same text, and a test can pin the brief. Alternative: the skill composes the
prompt (rejected: two copies the day the panel exists).

### D4. The child runs `implement` only

The child does one phase through `tdd-implementer` and ends. The coordination's next recompute sees
`gate`, runs it in Bash as today, ticks the gate task, then `commit` and so on. Reasons: the
one-writer rule stays where it is enforced (the child cannot write product code itself); a red gate
is seen by the coordination, which already stops the change and reports it; nothing else of the
loop moves. Alternative: the child also runs the gate and the commit (rejected: three steps outside
the recompute, and a second place that ticks `tasks.md`).

### D5. The chain rule, and what a refusal does

The skill attempts `start_session` for every `session` row in `dispatch`. A refusal (the tool's
error) is final for that change in this run: the skill records the state `waiting for the owner:
start session <id> phase <n>` for it, keeps dispatching the other rows (subagents, gates, `main`
steps, and the sessions of other changes - a refusal on one row does not mean the next is refused,
so each is attempted once), and ends the run with the list of sessions left to start. In `host:
app` the phase is never run as a subagent instead. The owner's next typed `/conduct` is the turn
that starts them. The checker cannot know the turn's origin, so this state is produced by the
skill; it is an instance of the existing `waiting for the owner: <what>` form (AC-7 of
conduct-rounds), so the report still has five states.

Why not fall back to a subagent: the owner chose visibility and isolation for phases; a silent
fallback would hide exactly the phases the owner wanted to see, and would reopen "the coordination
edits product code" through a side door.

### D6. Busy from the app, not from a file

Before the recompute, the skill calls `mcp__ccd_session_mgmt__list_sessions({ linked: true })` and
collects the names of sessions that are not ended (state working, starting or waiting at a prompt).
Every conducted change whose `session.name` (for its current phase) is in that set goes into
`--busy`. The checker marks it `running` and leaves it out of `dispatch`. A child that ended is not
busy; the next recompute reads its result from `tasks.md` (ticked tasks) and git, never from the
child's report text. This is how a re-run during a phase (AC-7) and a kill-and-resume both avoid a
second session for the same phase.

### D7. The cron goes away; JSON version 2

`wakeOf` and the `wake` field are removed, and `version` becomes 2 (a removed field, per the JSON
contract in `docs/openspec-flow.md`). The skill drops its reconciliation table and the `--wake`
marker; a run is always an owner-started run or a continuation of one. One migration rule stays
in the skill: on a run, `CronList`; delete every job whose prompt starts with `/conduct`; never
create one. The three cron tools are therefore named in the skill only in that rule.

Alternative: keep the cron for GitHub waits only (the grill's second option, rejected by the owner:
a cron firing breaks the chain and cannot start the next phase anyway).

### D8. Waits on GitHub: one capped watch, then Auto-fix

Unchanged: when `end` holds and `github` is not empty, one `conduct-check --watch` (9 minutes by
default, 30 at most). Then the run ends with `waiting on GitHub: <what>` and one fixed line: "Auto-fix
wakes this session on a CI failure, a merge conflict or a review comment; green checks do not wake
it: run `/conduct` again to go on." After `open-pr` the skill calls `mcp__ccd_pr__get_status` and,
when it does not report that PR, `mcp__ccd_pr__bind_pr` with its URL. `bind_pr` binds one PR to a
session (its description says "bind this session to a PR"), so the skill binds the PR opened last
in the run and says in the report which PR is bound; the other PRs of the round rely on the owner's
re-run. A wake from Auto-fix is an automated turn: it may run every non-session step (fix-checks,
push, answer, review) and must not start sessions; after a PR exists no phase is left to implement,
so nothing is lost. The requirements' AMBIGUOUS item resolves to (a).

### D9. Sidebar group and archive

Right after a start succeeds: `list_groups`; create `<id>` when missing; `move_sessions` with the
new session's id. The coordination is not moved (it conducts many changes). When a recompute shows
the gate task of a phase ticked (`tasks.md`), the skill calls `archive_session` for that phase's
child, with reason `phase <n> of <id>: gate green`. A child whose phase stopped (gate red,
`Outcome: failure`) is left as it is, so the owner can open it. The app may ask the owner to
approve a move or an archive: the owner's `/conduct` after this change is the standing request, and
the skill says so in one line the first time it archives in a run.

[Risk] `archive_session` says it "cleans up its worktree" by default. The child was started with
`cwd` set to the change's worktree and `use_worktree: false`, so the app created no worktree for
it; the change's worktree must survive the archive. The dogfood checks `git worktree list` after
the first archive; if the worktree is removed, the skill is changed in the same change to "group
only" (the grill's second option) and the ADR records why.

### D10. The host without sessions

In `host: cli`, nothing of D3-D9 applies: `implement` is a subagent, as in 0.8.0, minus the cron
(D7). The skill's session rows start with "In the app:" so the CLI path reads as before.

### D11. ADR 0006 (draft; written as `docs/adr/0006-phases-as-child-sessions.md` in phase 3)

```markdown
# ADR 0006: Phases run as child sessions started by the conducting session

- Status: accepted
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
   other step runs in a child.
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
```

ADR 0005 gets `- Status: superseded by ADR 0006 (0006-phases-as-child-sessions.md)` and one line in
Context saying which part survives. ADR 0001 gets its note and review trigger pointed at ADR 0006.

### D12. Release

devkit-openspec 0.9.0 in `plugins/openspec/.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json` (pack and marketplace `version`), CHANGELOG `## 0.9.0 — phases as
child sessions` with the **BREAKING** JSON note. The CI snippet in the docs pins `v0.9.0`, as the
previous releases did. devkit-core is not touched.

## Risks / Trade-offs

- [The app changes the chain semantics or stops continuing the parent] → ADR 0006's review trigger;
  the skill fails safe (D5: stop and ask), never silently.
- [A child ends while an `AskUserQuestion` is pending in the conductor] → the continuation arrives
  after the answer (observed in `conduct-rounds` design D14); the recompute that follows handles it.
- [`archive_session` removes the change's worktree] → D9's dogfood check and fallback to "group
  only".
- [Two conducted changes share a 20-character prefix] → D3's hash suffix, pinned by a test.
- [The owner runs `/conduct` from Remote Control] → `start_session` is refused there; D5 reports it
  as waiting for the owner, and the report says a desktop turn is needed.
- [A child's `Head:` line disagrees with the worktree] → never read: the recompute uses `tasks.md`
  and git (D6).

## Migration Plan

1. Merge; the installed pack updates to 0.9.0 on the owner's machine.
2. The first `/conduct` deletes any `/conduct` cron (D7) and reports it.
3. Round 5 is conducted with sessions (AC-11) and recorded in `retro.md`.
4. Rollback: install 0.8.0; the JSON goes back to `version: 1`; no file format on disk changed.

## Open Questions

None that change the specs, the approach or the tasks. Deferrable: whether a continuation turn may
also ask the owner a grill question (today the grill runs in the owner's turn; a continuation turn
that reaches `grill` for another change asks, and the answer is the owner's turn again).
