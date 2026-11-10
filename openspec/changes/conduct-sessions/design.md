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
`selectDispatch` treats it like `subagent` (counted against the cap of three). `stateOf` gains the
`session` case beside `subagent`, `review`, `gate` and `main` (`conduct-check.mjs:81-85` has no such
case today): a session row's state is `ready to run: implement`, and `running` when its change is in
`--busy` (the `running` override in `compute` already covers every `RUNNABLE` actor). `deliveryStep`
takes the host from `report.host`; a fixture report without `host` means `cli`.

Alternatives: a `--sessions` flag (rejected: the host already says whether sessions exist, and a
caller would have to know to pass it); sessions in `cli` too (rejected: no tool to start them).

### D3. The checker builds the session descriptor

For every `session` row the JSON carries `session: { title, name, cwd, branch, phase, brief,
background }`:

- `title`: `<id>: phase <n>`.
- `name`: `[a-z0-9-]`, at most 24 characters, unique per change and phase. Four characters are
  reserved for `-p<n>` (`-p` plus up to two digits; a change with more than 99 phases is out of
  scope), so the id is cut to its first 20 characters, trailing `-` removed, for every phase:
  `<id20>-p<n>`. When two conducted changes have the same cut id, both get `<id18><hh>-p<n>`, where
  `<id18>` is the id cut to 18 characters (trailing `-` removed) and `<hh>` the first two hex
  characters of the SHA-1 of the full id. A test pins the plain, the cut and the collision case.
- `cwd`: the change's worktree (the row's `worktree`, absolute). `branch`: the row's `branch`.
- Every change row of the round, whatever its step, also carries `sessionPrefix`: the `name` without
  its phase number (`<id20>-p`, or `<id18><hh>-p` after a collision), the same for every phase of
  the change, so a caller can match a change's children in any phase (D6). Prefixes are computed
  for all conducted changes at once, so the collision rule gives every row of one run the same
  prefix for the same change.
- `brief`: the prompt, from a template in the checker: "Implement phase <n> of change `<id>` in
  `<worktree>` on branch `<branch>`. Work only there; every path is absolute under it; start every
  Bash command with `cd <worktree> && `; do not fetch. Dispatch `devkit-core:tdd-implementer` with
  the Agent tool: "Implement phase <n> of change <id>; stop at its gate." Wait for its `Outcome:`.
  Do not run the gate, commit, push, open a PR, start a session or edit product code yourself (in
  the `devkit` schema the project's hooks refuse it). End your turn with exactly two lines first: `Outcome: success` or
  `Outcome: failure: <reason>`, then `Head: <sha of HEAD in the worktree>`."
- `background`: the round (`n`, title), the change's roadmap text when any, the schema, and "the
  coordinating session recomputes the next step when you end; it runs the gate and the commit".

Why the checker and not the skill: the panel change in the orquestrador mod should open the same
session from the same text, and a test can pin the brief. Alternative: the skill composes the
prompt (rejected: two copies the day the panel exists).

### D4. The child runs `implement` only

The child does one phase through `tdd-implementer` and ends. The coordination's next recompute sees
`gate`, runs it in Bash as today, ticks the gate task, then `commit` and so on. Reasons: the
one-writer rule stays where it is enforced (in the `devkit` schema the child cannot write product
code itself, `guard.mjs` refuses a product edit with no `agent_type`; in `devkit-lite` the hooks do
not gate product code, as in 0.8.0, and only the brief keeps the child off it); a red gate
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

Before the recompute, the skill calls `mcp__ccd_session_mgmt__list_sessions({ linked: true, limit:
100 })` (the tool returns the most recent rows first and defaults to 20; stopped attempts stay
unarchived, so the default could hide a running child behind them). Its rows carry `sessionId`, `name`, `isRunning`, `isArchived`, `startedBy` and `lastActivityAt`
(observed on 2026-11-10; there is no `state` field). A row is busy when `isRunning` is true and
`isArchived` is false. The skill takes the previous report's `sessionPrefix` of every conducted
change (D3) and passes in `--busy` every change that has a busy row whose `name` is its prefix
followed by digits only (`^<prefix>[0-9]+$`; a bare starts-with would match `add-x-pagination-p1`
to `add-x`, whose prefix `add-x-p` it starts with), whatever the change's next step is: a child that ticked its last task but is still running
(writing its report) keeps the change out of `dispatch`, so no `gate` or `commit` runs beside a
live child. The first run of a round has no previous report: it recomputes once without `--busy`,
takes the prefixes from that report and, when any linked session is running, recomputes again with
`--busy`. The checker marks a busy change `running` and leaves it out of `dispatch`.

A child that ended is never busy. Its progress is read from `tasks.md` (ticked tasks) and git,
never from the child's report text; the one thing read from the report is its `Outcome:` line, by
the continuation turn, for the stop rule: `Outcome: failure: <reason>` stops the change as
`blocked: phase <n>: <reason>` and the child is left unarchived (D9). When the child reported
`Outcome: success` but the recompute still says `implement` for the same phase (no task ticked),
the change stops as `blocked: phase <n>: child ended without ticking tasks`. An idle (ended,
unarchived) child with the same name is not busy: on the owner's next typed `/conduct`, if the
phase is still `implement`, the skill starts a new session with the same name (the app allows a
repeated `name`; the older session is the stopped attempt, left for the owner to read). Once the
phase's gate task is ticked, every idle linked session with that name is archived (D9). This is how
a re-run during a phase (AC-7), a kill-and-resume and a retried phase all avoid a second live
session for the same phase.

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
the gate task of a phase ticked (`tasks.md`), the skill calls `archive_session` for every idle
linked session whose `name` is that phase's `session.name` (a retried phase may have left a stopped
attempt, D6), with reason `phase <n> of <id>: gate green`. A child whose phase stopped (gate red,
`Outcome: failure`) is left as it is, so the owner can open it. The app may ask the owner to
approve a move or an archive: the owner's `/conduct` after this change is the standing request, and
the skill says so in one line the first time it archives in a run.

What the app does with these calls, from its tool descriptions: `archive_session` asks the owner
to approve each call (except in auto or bypass mode), refuses a session that is still working,
pinned or open on screen, archives with it the archived session's own side sessions (a child starts
none, so archiving one child never touches its siblings) and cleans up its worktree by default;
`move_sessions` asks in default mode; `bind_pr` (D8) asks too. One rule for all three: a refused or
declined archive, move or bind is written in the run's report (`not archived: <name> (<why>)`,
`not grouped: <name> (<why>)`, `not bound: <url> (<why>)`), is not retried in the same run and
never stops the change; the next run tries again. Archiving the children of a change is the
intended cleanup of its worktree's sessions; whether the archive also removes the change's worktree
is the risk below.

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

### D13. Which turns may do what

Removing `--wake` (D7) removes the 0.8.0 sentence that told an automated run apart from the
owner's. The skill states the rule by the kind of turn instead, in Start, and the checker is not
involved (it cannot know the turn's origin):

- The owner's typed `/conduct` is the only go-ahead: it confirms schemas, asks the grill, takes a
  `devkit-lite` change's first `implement`, writes `approval.md` and retro answers from the owner's
  own message, and starts sessions.
- A continuation turn (a `<side-sessions-event>` that follows a child's end) advances what is
  already under way: it reads the child's `Outcome:` line (D6), recomputes, runs `main` steps,
  gates, subagent steps and reviews, and starts the next session of every change that is under way
  (the chain, D5). "Under way" is read from the recompute, never from the app's list of sessions
  (the previous child may already be archived by then): a change is under way when its `tasks.md`
  has at least one ticked task, or, in the `devkit` schema, when `approval.md` records the current
  `readiness.md` (the owner's go-ahead is on disk). A `devkit-lite` change with no ticked task is
  not under way: its first `implement` waits for the owner's typed `/conduct`. The turn never
  writes `approval.md` or a retro answer, and when the recompute reaches a schema, grill,
  plan-approval or retro gate it asks the question with AskUserQuestion and leaves it there: the
  answer is the owner's turn again.
- An Auto-fix wake (a `<ci-monitor-event>`) and any other turn the owner did not type (a message
  from another session, a scheduled task) advance only the GitHub side of what is under way
  (`fix-checks`, `push`, `answer`, `review`, `resolve-release-conflict`), ask nothing new and start
  no session. The app refuses a start on a turn a cron, a wake-up or another session's message
  started (requirements Facts); the skill treats an Auto-fix wake the same way without attempting
  the start, so no such turn produces D5's waiting state by itself.

The skill tells the three apart by the message that started the turn, never by a flag in the
prompt. This replaces 0.8.0's `--wake` clause in Start 1, its `--wake` sentences in Start 4 and the
"cron-started run" sentences in Owner gates and Never; the `guard.test.mjs` test that pins those
sentences is rewritten to pin these (task 2.3).

## Risks / Trade-offs

- [The app changes the chain semantics or stops continuing the parent] → ADR 0006's review trigger;
  the skill fails safe (D5: stop and ask), never silently.
- [A child ends while an `AskUserQuestion` is pending in the conductor] → the continuation arrives
  after the answer (observed in `conduct-rounds` design D14); the recompute that follows handles it.
- [`archive_session` removes the change's worktree] → D9's dogfood check and fallback to "group
  only".
- [Two conducted changes share their first 20 characters] → D3's hash suffix, pinned by a test.
- [The owner runs `/conduct` from Remote Control] → `start_session` is refused there; D5 reports it
  as waiting for the owner, and the report says a desktop turn is needed.
- [A child's `Head:` line disagrees with the worktree] → never read: the recompute uses `tasks.md`
  and git (D6).
- [A continuation turn reaches an owner gate (schema, grill, approval, retro)] → D13: it asks and
  leaves the question; nothing is written until the owner answers.
- [A child ends without ticking a task but reports `Outcome: success`] → D6: `blocked: phase <n>:
  child ended without ticking tasks`; the owner reads the child.

## Migration Plan

1. Merge; the installed pack updates to 0.9.0 on the owner's machine.
2. The first `/conduct` deletes any `/conduct` cron (D7) and reports it.
3. Round 5 is conducted with sessions (AC-11) and recorded in `retro.md`.
4. Rollback: install 0.8.0; the JSON goes back to `version: 1`; no file format on disk changed.

## Open Questions

None. Whether a continuation turn may ask the owner a grill question is answered by D13: it asks
and leaves the question; the answer is the owner's turn again.
