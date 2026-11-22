<!-- devkit-stage design result=passed attempt=3 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Design

Change: `roadmap-coordinator-followups` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech
spec: n/a (sources: `requirements.md`, `proposal.md`, the two spec deltas of this change, the retro
and `reviews/` of `openspec/changes/archive/2026-11-21-roadmap-coordinator/`, and the transcript of
this change's own session after its move on 2026-11-21).

## Context

See `proposal.md` (Why). The code each item lives in, at `6e803eb`:

| Item | Where | What it does today |
|---|---|---|
| AC-1 | `plugins/openspec/hooks/roadmap-loop.mjs#boardOf` | Every ready line reads `queue.place` ("ready, waits for a place") unless the load holds it, also with free places and no run |
| AC-2 | `roadmap-loop.mjs#decideRoadmap`, keys `roadmap-gate`, `roadmap-blocked` of `change-loop.mjs#MESSAGES` | Both keys always end with "The others go on" |
| AC-3 | `roadmap-loop.mjs#emptyRun`, ADR 0013 decision 4 | The file holds `version`, `session`, `places`, `stopping`, `asking`, `inflight`, `declared`, `announced`, `starting`, `held`, `holding`, `updatedAt`; the decision names six of them in prose and says "nothing else" |
| AC-4 | `roadmap-loop.mjs#nextCmd`, `#replyCmd`, `#waitCmd` | `--after <id>=`, `--param id=` and `--change` become keys of plain objects unchecked |
| AC-5 | `roadmap-loop.mjs#updateRun` | A throw between `writeFileSync(temporary)` and `renameSync` leaves `roadmap-run.json.<pid>.tmp` |
| AC-6 | `roadmap-loop.mjs#LOCK` (`waitMs: 10_000`), `plugins/openspec/hooks/hooks.json` (`agent` timeout 10 s) | The run file's wait equals the hook's whole time; the agent hook also reads the roadmap, git and the flow before it writes |
| AC-7 | `roadmap-loop.mjs#holdCmd`, `#decideRoadmap` | `holding: true` survives a killed `hold`; while it is true no `hold` action is ever returned again |
| AC-8 (F-2) | `decideRoadmap` | `loaded = f.load >= f.limit`; nothing lets the owner start a held change |
| AC-9 (F-1) | `plugins/openspec/skills/devkit/SKILL.md` (Roadmap, step 1), `roadmap-loop.mjs#runCmd` | The heredoc carries `$ARGUMENTS` (`roadmap 2`); `parseWord` accepts only `2` |
| AC-10 | the test files | No test for `run` without `--session`, a lock timing out through `updateRun` or `open`, the draft's language fallback, or `mainInRun`'s single read |
| AC-13 (F-3) | `decideRoadmap`, the Roadmap section of `SKILL.md` | Every open change's stages are handed by the typed session (ADR 0013 decision 1); nothing starts an app session; in a session the app started in a worktree of its own the second change's writes are refused |
| AC-14 | `change-loop.mjs#decide` | An action carries `stage` and `stageTitle`, no icon; nothing renames a session |
| AC-15 | the whole run | Nothing knows what started a turn; the app refuses a session start on a turn a background task started |
| F-4 | `plugins/openspec/hooks/guard.mjs#typedOf` | Reads a typed command only from a `<command-name>` tag or a first line starting with `/`. The app delivers a started session's task below a `Background (from the session that started this one):` block, so `runOf` is null in a change session: none of the `/devkit change` locks hold there (checked on this change's own session transcript on 2026-11-21) |

Facts about the host this design relies on (sources: the brief of this planning stage and
`requirements.md`, assumptions confirmed by the owner; the three tool schemas, read in the desktop
app on 2026-11-21, and the calls the coordinating session of this run made on 2026-11-21 to start
this run's change sessions, both given in the brief of this plan's revision; the panel's
`list_sessions` reader, `plugins/panel/hooks/sessions.ts`):

- **Start.** The tool `mcp__ccd_session__start_session` starts a session. Its fields: `initiation`
  (`"user_asked"` starts it now and returns its id), `title` (under 60 characters), `prompt` (the
  brief, required), `context` (`"fresh"`), `background` (required with `"fresh"`, at least 80
  characters), and the optional `name` (`[a-z0-9-]`, at most 24), `use_worktree`, `cwd`,
  `source_branch`, `branch_name` and `wake_when_done`. The coordinating session of this run started
  its change sessions with `initiation: "user_asked"`, `context: "fresh"`, `title`, `name`, `cwd` set
  to the change's worktree, `use_worktree: false`, `prompt: "/devkit-openspec:devkit change <id>"`
  and `background`. A session it starts is nested under the session that started it, and its
  end-of-turn reports return to that session. The started session's first message reads
  `Background (from the session that started this one):`, then the background text, then a line
  `Task:` and the prompt.
- **List.** The tool `mcp__ccd_session_mgmt__list_sessions` lists sessions. Its fields: `linked`
  (`true` lists this session's family), `include_archived`, `limit` and `group`. With
  `{ "linked": true }` it listed the started sessions with their titles and folders. Each row carries
  `sessionId`, `title`, `cwd`, `isArchived`, `name` and `startedBy`, and the list leaves the calling
  session out (`plugins/panel/hooks/sessions.ts`, `parseSessionRows` and `ownChildren`).
- **Rename.** The tool `mcp__ccd_session_mgmt__set_session_title` renames a session. Its required
  fields: `session_id` (a session id from the list, or the literal string `"self"`) and `title`. A
  subagent cannot rename the session it runs in, so a session renames itself from its main thread
  with `session_id` `"self"`. When the owner set the title by hand, the app may ask the owner to
  approve the rename outside bypass mode. The app has no tool that sets a session icon. The change
  session of `merge-setup-field-fixes` renamed its own title from 📝 to 🛠️ when its code stage
  began (2026-11-21).
- **Message.** `SendMessage`, with `to` set to a session's `local_…` id, sends a message to a
  started session. This design does not call it (D-3, Tracking).
- **Loading.** `mcp__ccd_session__start_session`, `mcp__ccd_session_mgmt__set_session_title`,
  `mcp__ccd_session_mgmt__list_sessions` and `SendMessage` are deferred tools: a session loads each
  with the ToolSearch query `select:<name>` before its first call.
- **Turns** (confirmed live on 2026-11-21). The app starts a session on a turn the owner typed. It
  refuses on a turn an automated event started: a background task's end (a wait on GitHub, the load
  watch) or another session's note (a message or an end-of-turn report).
- A session started in a change's worktree writes there. This change's own session was started so on
  2026-11-21 and its planner writes in it.

Constraints:

- `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` are the three files a project's
  `devkit-reviews` workflow downloads: nothing new may become a static import of them. A helper both
  loops need goes into `guard.mjs` only when it imports nothing new.
- Product code, `docs/adr/` included, is closed until readiness is approved (`guard.mjs` edit lock):
  ADR 0014 and the ADR edits are drafted here (D-13) and written by phase tasks.
- A Node script cannot start, list or rename an app session: those are host tool calls a session
  makes. The script decides and gives each call's exact input; the session carries it out.
- ADR 0011 rejected a hook that fails closed. ADR 0013 decision 3 keeps the session from ending its
  turn while work is ready. ADR 0010's Note records the owner's answer that a start is held while the
  machine is loaded. ADR 0006 decision 2 answered a refused session start with a line for the owner,
  never a subagent in its place, and decision 3 rules out a cron.

## Goals / Non-Goals

**Goals:** one rule per item, in one function, used by every caller; every field defect (F-1 to F-4)
reproduced by a test that fails on `6e803eb` before its fix (AC-11); every existing test that pinned
a replaced rule changed with its invariant named (D-14); the driver boundary kept: the script's
decision names every host call the session makes, with its exact inputs.

**Non-Goals:** a killed `wait` (same class as AC-7, not in the request: flagged to the owner); a
change session for a host with no session-start tool (ADR 0013 decision 1 stays there); restarting a
change session the owner closed (the existing `/devkit change <id>`); a session wake-up or retry
(ADR 0006 decision 3); changing `parseRoadmap`'s id pattern; the round 16 items; a turns mechanism
for a one-worktree session (an earlier draft of this plan, dropped: D-3 removes the cause in the app,
and a terminal session is not refused writes by worktree).

## D-1 The run takes the arguments as typed (AC-9, F-1)

**Resolution of the ambiguous assumption: (b).** `run` drops one leading word `roadmap` (any case)
from standard input, then calls `parseWord`. The skill keeps `$ARGUMENTS` in the heredoc, which the
host substitutes, and step 1 says "the owner's arguments" instead of "the word after `roadmap`". The
Start section's `roadmap` bullet loses "with `text` as the word after `roadmap`".

- New export `parseRunInput(text)` in `roadmap-loop.mjs`:
  `parseWord(String(text ?? '').trim().replace(/^roadmap(?=\s|$)/i, ''))`. So `roadmap 2` gives 2,
  `roadmap` gives 1, `ROADMAP stop` gives stop, `roadmap many` gives invalid `many`, `2` gives 2, and
  `roadmap roadmap` gives invalid `roadmap`.
- `runCmd` calls `parseRunInput(ctx.stdin)` in place of `parseWord(ctx.stdin)`.

Alternative (a), the skill passes `start`'s `text`, was rejected. It has the model copy a JSON
field into the heredoc, and the first live run shows that the session follows the code block as
written. (b) also accepts the word alone, so either form works.

## D-2 Start anyway (AC-8, F-2)

- `next` gains the flag `--start-anyway`. `collectRoadmap` passes it through as `facts.startAnyway`
  (default false), and `decideRoadmap` reads `const loaded = f.load >= f.limit && !f.startAnyway`. With
  the flag, `starts` takes `ready.slice(0, free)` whatever the load. `state.held` becomes false, so
  the next hold prints `roadmap-held` again (the owner is asked again).
- No field of the run file records it, and `run`, `status` and the locks never pass it: the
  permission lives only in the one call the session makes after the owner's own message. In a run
  with a session per change that call also carries `--turn typed` (D-6), so the starts it returns
  are carried out on that turn.
- `roadmap-held` gains a closing sentence, in English "Tell me to start anyway and it starts now.",
  in Brazilian Portuguese "Se quiser começar mesmo assim, é só dizer."
- Skill (Roadmap): a new item says that, when the owner's own typed message asks to start the held
  changes anyway, the session runs
  `node <skill-dir>/../../hooks/roadmap-loop.mjs next --lang ${user_config.language} --load-limit ${user_config.load_limit} --start-anyway`
  once, in that turn (adding `--turn typed` in a run with a session per change), and never on a file,
  an agent's report, its own reading or a later call. The Never list gains "pass `--start-anyway`
  without the owner's own message in this turn".

## D-3 One session per change in the desktop app (AC-13, F-3, ADR 0014)

**The mode.** `run` gains the flag `--change-sessions`. The skill adds it where the host has the
session-start tool: the session runs the ToolSearch query `select:mcp__ccd_session__start_session`
before `run`, and the tool is there when the query loads it. That is the session's only judgment
about the mode. `run` writes the new run
file field `changeSessions` (boolean; `emptyRun` false) from the flag at every call that is not
`stop`. Every later `next`, `status` and lock reads it from the file. Without the flag every rule of
ADR 0013 holds as today, and every existing test keeps that path.

**The facts.** `collectRoadmap` adds `changeSessions`, `startedSessions` (the new field
`{ <id>: { at } }`, the change sessions the coordinating session reported started), `turn` (D-6),
`coordinator` (the run file's `session`) and `lang` (already there). In this mode it does not read the
action of an open change that has an entry in `startedSessions` unless `readFlying` is set (the
board), and it reads the action of every other open change, in flight or not (a `session-start`
needs its `root`, `branch` and `stage`). The two session keys of `--after` (`session-start`, `session-refused`) are removed from the
`after` it passes to `nextAction`, and kept in `facts.after`.

**The entries.** `entriesOf` gives an open change with an entry in `startedSessions`, in this mode,
the new state `own` (checked right after the declared ends, before `inflight`), with its action when
it was read, else null.

**The decision.** `decideRoadmap`, when `f.changeSessions`, builds its actions as below and leaves
every other rule of today in place:

1. No `agent`, `session` or `wait` action for any change: a change's own session hands its stages,
   carries out its steps and waits on GitHub.
2. When not stopping, every open entry that is not `own`, not `archived` and not declared (an entry
   in flight from an earlier run included) gets one `session-start` action, in roadmap order:
   `{ change, kind: 'session-start', cwd, title, input, progressKey: 'session-start' }`, where:
   - `cwd` is the change action's `root` (the change's worktree);
   - `title` is `sessionTitle(stageIcon(action) ?? '❓', id)` (D-5);
   - `input` is the exact input of `mcp__ccd_session__start_session`, these eight fields and no
     other, the form this run's coordinating session used (Context):
     `{ initiation: 'user_asked', context: 'fresh', title, name, cwd, use_worktree: false, prompt, background }`,
     where `name` is `sessionName(id)`, `prompt` is `` `/devkit-openspec:devkit change ${id}` `` and
     `background` is `sessionBackground({ id, root, branch, coordinator, lang })` below.
     `use_worktree: false`, and no `source_branch` or `branch_name`: the change's worktree and branch
     exist already (`open` made them), and an app-made worktree is F-3's cause. No `wake_when_done`:
     the end-of-turn reports already return (Context), and ADR 0006's wake-up stays retired (ADR
     0014's table).
   - New export `sessionName(id)` in `roadmap-loop.mjs`, pure: the id lowercased, each run of
     characters outside `[a-z0-9-]` replaced by one `-`, cut to its first 24 characters, then
     leading and trailing `-` removed; `change` when nothing is left. So
     `roadmap-coordinator-followups` gives `roadmap-coordinator-foll`, and `A_b.c` gives `a-b-c`.
3. The starts (`start`) and the hold (`hold`) are decided as today, start anyway included. A started
   change gets its `session-start` at the next decision, once it is open.
4. When the turn may not start sessions (D-6), every `start` and `session-start` is taken out of the
   actions and replaced by its line (D-6). A `start` taken out is not added to `starting`.
5. `ask` is null: the change's own session asks its gates (spec: "The owner's gates are asked one
   change at a time"). The gate and blocked events are not emitted in this mode.
6. The started and resumed events are replaced by one event per change whose `after` key is
   `session-start`: key `roadmap-session-started` with `{ id, open, places }`, announced as
   `session`, counted as `roadmap-started` counts today.
7. For the end of the run, an `own` entry counts as under way, except while stopping (like a wait on
   GitHub today). `/devkit roadmap stop` therefore ends the run at once in this mode, each change
   staying in its session with its `roadmap-stayed` line.
8. `state` gains `sessionsStarted` (the ids whose `after` key is `session-start`) and `turn` (D-6).
   `decide()` writes `startedSessions[id] = { at: <now> }` for them and removes the entries of every
   id that is no longer an open line.
9. `run` from another session empties the run file as today (U4) except `startedSessions`, which it
   keeps: a change session lives on when the session that started it ends, and the app's list of a
   new coordinating session does not show it. `--fresh` empties `startedSessions` too. A change
   whose session the owner closed is resumed with `/devkit change <id>` (Non-Goals), or the run is
   called with `--fresh`.

`sessionBackground` (exported, English, read by the model of the change session; at least 80
characters for every input, as the tool requires):

> This session runs the devkit change `{id}` for a `/devkit roadmap` run. The owner typed that
> command in the session `{coordinator}`, which started this one: in the desktop app every change of
> a roadmap run has a session of its own (ADR 0014). Work only in `{root}`, the change's worktree, on
> branch `{branch}`. Before your first question to the owner, say in two or three plain sentences, in
> the owner's language ({lang}), who started this session, why and what it will do. Run the change
> with the task below and the devkit skill's Loop: its stages, questions and approvals happen here.
> Keep this session's title as the `sessionTitle` of each `next`, renaming it yourself as the Loop
> says. The report that ends each of your turns returns to the session that started this one: when
> the change is archived, end that turn with the line `devkit roadmap: {id} archived`.

`{coordinator}` is the run file's `session` (the id `run` was given), a name for the owner to read
and never an address: no tool call takes it.

**The driver boundary.** The decision is the whole of the coordinating session's judgment. The
session carries out a `session-start` by host calls only, one session start at a time:

0. **Loading.** Before its first call of a tool below in a turn, the session loads it with the
   ToolSearch query `select:mcp__ccd_session_mgmt__list_sessions` or
   `select:mcp__ccd_session__start_session` (deferred tools, Context).
1. **The list check.** It calls `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }`.
   When a row whose `isArchived` is not true has a `cwd` equal to the action's `cwd`, or a `title`
   ending in `` ` {id}` ``, it starts none and runs `next --turn typed --after <id>=session-start`, as
   if it had started it. This finds every change session this coordinating session started, the two
   moved on 2026-11-21 included. A session an earlier coordinating session started is not in this
   family: `startedSessions`, which a run from another session keeps (below), covers that case.
2. **The start.** Else it calls `mcp__ccd_session__start_session` with the action's `input` exactly
   as given, no field added, changed or left out.
3. **The record.** When the call returns a session id it runs
   `next --turn typed --after <id>=session-start`; when the app refuses or the call fails, it runs
   `next --turn event --after <id>=session-refused` (D-6).

A `session-start` is only ever returned on a typed turn (D-6), so steps 1 and 3 always carry
`--turn typed`.

**Tracking.** The coordinating session keeps nothing of a change but the fact that its session was
started (`startedSessions`). Where a change stands is read from its own files by `nextAction`, as
every board does. A change session is a `/devkit change` run of its own (D-4), so ADR 0011's locks
hold it. Its end-of-turn reports return to the coordinating session (Context), and each one starts a
turn there that the session reads as `event` (D-6: another session's note may not start a session).
It runs `next --turn event`, which reads the change's files, so the archive is found by `nextAction`
whatever the report says: the archive line is said, the place is freed, and the next ready line gets
its `roadmap-waits-turn` line and starts at the owner's next message. The background's line
`devkit roadmap: {id} archived` makes that report readable to the owner. No tool call sends it: the
`SendMessage` tool is not needed, because the report already returns and a message's turn could
not start a session either.

**Locks.**

- Stop (`roadmapStopDecision`): no change of code beyond `collectRoadmap` reading `turn` from the
  run file and `readyText` for the new kind:
  `the change <id> has no session of its own yet: start it`. With `turn` `event` the decision has no
  start, so the stop is let through.
- Hand-off (`roadmapAgentDecision`): a new rule RH6, after the run is found and before RH1. When the
  run file's `changeSessions` is true, every hand-off of the coordinating session is refused with
  `refusal('own-sessions', change, 'in this /devkit roadmap run each change runs in a session of its own: its stages are handed in that session, not here')`.
  RH0 (a subagent's own call) still comes first.

**Skill.** The Roadmap section keeps its opening paragraph and step 1 (with the sentences after
step 1's code block: the `devkit-roadmap: <n>` line and the rows `run` with `stop` prints) where they
are, and splits what follows into two parts, each a `###` heading, in this order (the `##` headings
stay as the skill test pins them):

- `### A session per change` (the run had `--change-sessions`), its items as bullets (no item
  starting `5.`):
  - every `next` carries `--turn <typed|event>` (D-6);
  - `start` and `hold` as today;
  - `session-start` as the driver boundary above: the ToolSearch queries
    `select:mcp__ccd_session_mgmt__list_sessions` and `select:mcp__ccd_session__start_session`,
    `mcp__ccd_session_mgmt__list_sessions` with `{ "linked": true }` and its match on `cwd` or title,
    `mcp__ccd_session__start_session` with the action's `input` exactly as given, and the two
    `--after` keys `session-start` and `session-refused`;
  - the session hands no stage, asks no gate and starts no wait on GitHub;
  - a change session's end-of-turn report, `devkit roadmap: <id> archived` among them, starts an
    `event` turn: run `next --turn event`, and when it printed no line and no `end.reply`, end the
    turn with no message;
  - the message that ends a turn holds the lines, the plain lines and `end.reply`.
- `### Every change in this session` (no session-start tool): steps 2 to 5 of today, word for word,
  then the closing paragraph ("Calling `/devkit roadmap` again ...").
- The Never list gains: "In a run with a session per change: hand a stage, ask a change's gate or
  start a wait on GitHub from this session, start a change session `next` did not return, or call
  the session-start tool with any input but the action's `input`".

The skill names neither the wake field of the start tool nor any other field the action's `input`
lacks (T-9 refuses the wake field's name in the skill).

**F-3** (writes refused across worktrees) has no code of its own. In the app each change's session
is started in the change's worktree and writes only there. The coordinating session writes in no
worktree: `open` and the run file are written by scripts through Bash, which the host did not refuse
in the live run.

Why this approach and not the alternatives is ADR 0014's table (D-13). It reverses ADR 0013
decision 1 and its rejected option "App child sessions, one per change", so it is recorded as an ADR
(`openspec/config.yaml`, design rules).

## D-4 A session started by another session is a change run (F-4, AC-13)

- `guard.mjs#typedOf(content)` also reads the app's form of a started session. When the first line
  of `content`, trimmed, equals the exported constant
  `STARTED_BY_SESSION = 'Background (from the session that started this one):'`, it finds the first
  line that, trimmed, equals `Task:`. It applies today's first-line rule to the first non-blank line
  after it. With no `Task:` line, or no slash command there, the message is no typed command.
- Nothing else changes: `runOf`, `roadmapRunOf` and `mainInRun` read the typed event as they read a
  typed command. In a change session the task `/devkit-openspec:devkit change <id>` and the loop's
  `devkit-run: <id>` line make a change run, so its product edits, its hand-offs and its stop are held
  as in any `/devkit change` run (ADR 0011).
- A command on a later line of any other message stays no command (the existing first-line rule).
- Recorded in ADR 0014 (decision 4) and a Note in ADR 0011, because it widens ADR 0011 decision 2's
  "the newest slash command typed in the session".

## D-5 The stage icon (AC-14)

**Resolution of the ambiguous assumption: (b)**, a leading emoji in the change session's title. The
app has a title tool and no icon tool (Context).

- New export `stageIcon(action)` in `change-loop.mjs`, pure: an `end` whose `end.state` is
  `archived` gives 📦; else by `action.stage`:
  - ❓: `open`, `requirements`;
  - 📝: `mockup`, `decisions`, `proposal`, `specs`, `design`, `tasks`, `readiness`, `approval`;
  - 🛠️: `implementation`, `unit-tests`, `e2e-tests`;
  - 🔍: `evidence`, `review`;
  - 🚀: `delivery`;
  - 📦: `retro`;
  - any other stage, or none: null.
  The table names every stage of both `flow.json` files. A test fails when a stage of either has no
  icon.
- New export `sessionTitle(icon, id)` in `change-loop.mjs`, pure, the one helper for a change
  session's title (the start's `title` in D-3 and every rename): `` `${icon} ${id}` ``, cut to its
  first 59 code points when it has 60 or more (the start tool's title is under 60 characters). The
  list check of D-3 also matches a row by its `cwd`, so a cut title is still found.
- `nextAction` sets `action.icon = stageIcon(action)` on every action it returns, and
  `action.sessionTitle = sessionTitle(action.icon, id)` when the icon is not null (else the field is
  absent). `change-loop.mjs next` prints both in its JSON, and roadmap actions carry them through
  their spread.
- Who renames: the change session itself, from its main thread (a subagent cannot rename the session
  it runs in), from the `sessionTitle` the change loop reports. The skill's Loop gains one item. In a
  session a roadmap run started (its first message begins with
  `Background (from the session that started this one):` and names `/devkit roadmap`), after every
  `next` whose `sessionTitle` is present and differs from the title the session last set or was
  started with, call `mcp__ccd_session_mgmt__set_session_title` with
  `{ session_id: "self", title: <the action's sessionTitle> }`, before carrying out the action. A
  rename that fails or that the owner declines is not retried for the same `sessionTitle`, and the
  action goes on. The coordinating session sets the first title through the start's `title` (D-3)
  and never renames a change session itself.
- Proof: the mapping and `sessionTitle` are unit-tested here; the renames are recorded live from
  this change's own session and from the `merge-setup-field-fixes` session, which renamed itself
  from 📝 to 🛠️ on 2026-11-21 (D-16).

## D-6 A start on a turn nobody typed (AC-15)

- `next` gains `--turn <typed|event>`; any other value, an empty one included, is a usage error:
  exit 3 with `--turn takes typed or event: got <the word>`, the run file's bytes unchanged. Without
  the flag the turn is `event`, the cautious reading: no start is tried that the app would refuse,
  and a line is still shown. `run` is always a turn the owner typed: it sets `typed`. Both cases are
  scenarios of the spec delta (`roadmap-coordination`, "A change ready on a turn nobody typed ...")
  and one test (task 3.1).
- Two words, not three: the app refuses a start on a turn another session's note started, as on a
  background task's end (Context, confirmed live on 2026-11-21), so a turn a change session's report
  or message started is `event`. An earlier draft of this plan had a third word, `message`, for such
  a turn; it was dropped with that fact.
- `decideRoadmap` reads `mayStart = f.turn === 'typed'`. Any `after` key `session-refused` makes the
  turn `event` for that decision (the app just refused on this turn) and names that change as
  refused.
- In a run with a session per change, when `!mayStart`, each `start` and `session-start` taken out
  (D-3, step 4) emits one event, announced as `waits-turn`:
  - `roadmap-waits-turn` `{ id }`, in English "{id} is ready and starts in a session of its own at
    your next message: the app starts a session only on a turn you typed.", in Brazilian Portuguese
    `{id} está pronta e começa numa sessão própria na sua próxima mensagem: o app só abre sessão num turno que você digitou.`;
  - for the refused change, `roadmap-waits-refused` `{ id }`, announced as `waits-refused`: "{id}
    could not start in a session of its own: the app refused it. It starts at your next message." /
    `{id} não pôde começar numa sessão própria: o app recusou. Ela começa na sua próxima mensagem.`
- `state.turn` is the turn the decision used. `decide()` writes it to the new run file field `turn`
  (`emptyRun` null), which the stop lock reads (D-3).
- The board (D-11): a ready line, or an open change with no session, announced `waits-turn` or
  `waits-refused` reads the new key `queue.turn` ("ready: starts in a session of its own at your next
  message" / "pronta: começa numa sessão própria na sua próxima mensagem").
- Skill: `typed` when the turn began with the owner's own message; `event` otherwise (a background
  task's end, the hold's end, another session's message or end-of-turn report) and when in doubt. On
  a turn the owner typed, while a run with a session per change goes on, the session runs
  `next --turn typed` before anything else. `/devkit status` stays a command that writes
  nothing and starts nothing.
- Never without a line: every `start` or `session-start` the decision withholds emits its line in
  the same decision, or was announced for the same state; a test walks the withheld actions of every
  decision in its table and finds the line or the announced key.

## D-7 A killed hold holds nothing (AC-7)

- `holding` changes from a boolean to `null | { pid, at }`. `holdCmd` writes
  `{ pid: process.pid, at: <now> }`. Its `finally` clears the field only when `holding?.pid === process.pid`,
  so the end of an old hold never clears a newer one.
- New export `watchAlive(holding)`. It returns true only for an object with an integer `pid > 0` for
  which `process.kill(pid, 0)` does not throw, or throws `EPERM`. `ESRCH` and every other error count
  as dead.
- `readRun` keeps `holding` only when it is such an object, else null. An old boolean `true` from
  0.18.0 therefore reads as no watch. `collectRoadmap` passes `holding: watchAlive(run.holding)`, so
  `decideRoadmap` keeps its boolean input and its tests.
- `run` (U4: the same session) keeps the record as it is; `--fresh` and another session reset it to null.

## D-8 The run file's lock and the busy hand-off (AC-6, AC-10)

- `LOCK` becomes `{ stepMs: 100, waitMs: 3_000, staleMs: 60_000 }` and is exported. The rule: the wait
  is at most half the `agent` hook's timeout in `hooks.json` (10 s). A test reads both and fails when
  the rule breaks. The 3 s wait holds for every caller of `updateRun`, not only the hooks: `next`,
  `reply`, `hold`, `wait` and `run` give up after 3 s too, with `RunFileBusy` (exit 3, the file as it
  was). The writes under the lock take milliseconds, so a 3 s wait is only reached when another call
  holds the lock far longer than any write does (Risks).
- New exported class `RunFileBusy extends LoopUsageError`. `updateRun`'s `timeout` returns
  `new RunFileBusy('the run file is locked by another call')`. The CLI still exits 3 through `failure`.
- `roadmapAgentDecision` and `roadmapSubagentStopDecision` turn a `RunFileBusy` into
  `allow('run-file-busy', change)`; any other error stays `allow('error', change)`. `guard.mjs#lock`
  already logs `why`.
- **The reading of AC-6's "the lock's refusal".** It is the lock's own give-up, the `RunFileBusy` it
  throws within 3 s, which the hook turns into its answer before the host's timeout. The hand-off is
  let through, as every lock does when it cannot record (`coordination-locks`, "A lock never traps").
  Refusing the hand-off was rejected: ADR 0011 rejected a hook that fails closed, and a refusal would
  have the session hand the stage again while the bookkeeping is still busy. The cost is a stage not
  marked in flight (Risks).
- `contextOf` takes `lockSleep` (synchronous, in milliseconds). `decide`, `runCmd`, `replyCmd`,
  `waitCmd` and `holdCmd` pass `{ sleep: ctx.lockSleep }` to every `updateRun`, so a test times a lock
  out without waiting.
- `change-loop.mjs#openChange` takes `lockSleep` and passes it to `withOpenLock(main, work, lockSleep)`,
  which gives it to `withLockFile`. The command line passes none.

## D-9 Ids are checked before they become keys (AC-4)

- New export `isChangeId(id)` in `plugins/openspec/hooks/guard.mjs`:
  `typeof id === 'string' && /^[A-Za-z0-9][\w.-]*$/.test(id)`, the same form `parseRoadmap` and the
  brief accept. It imports nothing new.
- `roadmap-loop.mjs#changeIdOf(flag, id)` throws
  `LoopUsageError(\`${flag} needs a change id (a letter or digit, then letters, digits, _, . or -): got ${JSON.stringify(id)}\`)`.
- It is called for every `--after` id (before `collectRoadmap`), for `--param id=` of an end key
  (before `updateRun`) and for `wait --change` (before the first `updateRun`). `readRun` keeps only the
  `startedSessions` keys that pass it. The `open` names keep their own rule (`NAME` in
  `change-loop.mjs`).

## D-10 The bookkeeping is written whole (AC-5)

In `updateRun`, `writeFileSync(temporary)` and `renameSync` sit in one `try`. Its `catch` runs
`rmSync(temporary, { force: true })` and rethrows. The lock is still released by `withLockFile`'s
`finally`.

## D-11 The board's ready line (AC-1, AC-15)

In `boardOf`, the ready lines that the free places would take are
`const takes = new Set(ready.slice(0, Math.max(free, 0)).map((l) => l.id))`. Each of them reads
`queue.load` when the machine is loaded, else the new key `queue.ready` ("ready to start", "pronta
para começar"). Every other ready line reads `queue.place`. The load line keeps its rule.

In a run with a session per change (D-3, D-6), a line announced `waits-turn` or `waits-refused` reads
`queue.turn` in place of `queue.ready`. An `own` entry with a read action gets the row its action's
state gives today (owner, under way, blocked). An open change with no session gets a row under way
with the new key `running.no-session`: "no session of its own yet: it starts at your next message" /
"ainda sem sessão própria: começa na sua próxima mensagem".

## D-12 "The others go on" only when another change is under way (AC-2)

- The keys `roadmap-gate` and `roadmap-blocked` lose their "others" sentence:
  - English: "{id} waits for {gate}." and "{id} stopped: {why}. The changes after it wait."
  - Brazilian Portuguese: "{id} espera {gate}." and "{id} parou: {why}. As que dependem dela
    esperam."
- New keys `roadmap-gate-others` and `roadmap-blocked-others` hold today's texts.
- `BLOCKED_WHY_KEYS` in `change-loop.mjs` gains `roadmap-blocked-others`.
- In `decideRoadmap`, `othersGoOn(id)` is true when an entry of another change has the state
  `running`, or when an action of the final list names another change with the kind `agent`,
  `session`, `wait` or `start`. The gate and blocked events use the `-others` key when it is true. The
  announced key (`gate:<gate>`, `blocked:<why>`) does not change, so a line is never said twice for
  the same state. These events exist only in a run whose changes run in the coordinating session
  (D-3, step 5).

## D-13 The ADRs (AC-3, AC-13, AC-14, AC-15, F-4, AC-8)

A link quoted below in backticks is written in the ADR as a plain Markdown link (it resolves only
there).

**ADR 0013, decision 4, rewritten in place** (`docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`):

> 4. What the files cannot say about a run in progress is one run's bookkeeping, the form ADR 0010
>    decision 8 accepts. It is one file in the repository's git directory, outside every working
>    tree, holding these fields and nothing else:
>    - the number the owner set (`places`);
>    - whether a stop was asked (`stopping`);
>    - which change's gate the owner is being asked (`asking`);
>    - which stages and waits are under way (`inflight`);
>    - the starts handed and not yet open (`starting`);
>    - whether the hold of a start was announced (`held`), and which process watches the load
>      (`holding`);
>    - the ends the session declared (`declared`) and the events already announced (`announced`);
>    - the session that runs the run (`session`);
>    - whether each change runs in a session of its own (`changeSessions`), which change sessions were
>      started (`startedSessions`) and what started the last turn (`turn`), as ADR 0014 decides;
>    - the form of the file and its last write (`version`, `updatedAt`).
>
>    A hand-off the hook lets through marks its stage as under way, and that subagent's stop clears
>    it; the hooks still only veto and record.

ADR 0013 also gets the header line
`- Amended by ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md)`, and this Note at
the top of its Context:

> Note (roadmap-coordinator-followups, 2026-11-21): in the desktop app each change of a run now runs
> in a session of its own, and the session the owner typed /devkit roadmap in coordinates the roadmap
> only. `[ADR 0014](0014-each-roadmap-change-runs-in-a-session-of-its-own.md)` supersedes decision 1
> there and takes up the option "App child sessions, one per change" this ADR rejected. Decision 1
> still holds where the host cannot start sessions. Decision 4 now names each field of the run file.
> Decisions 2, 3 and 5 are otherwise unchanged.

**ADR 0011, a Note** at the top of its Context, and the header line
`- Amended by ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md)`:

> Note (roadmap-coordinator-followups, 2026-11-21): the task another session started a session with,
> in the desktop app's form of a started session, counts as a command typed in it. A change session a
> roadmap run starts is therefore held by these locks
> (`[ADR 0014](0014-each-roadmap-change-runs-in-a-session-of-its-own.md)`). Decisions 1 to 3 are
> otherwise unchanged.

**ADR 0010, a Note** after the roadmap-coordinator Note (`docs/adr/0010-openspec-as-the-harness.md`):

> Note (roadmap-coordinator-followups, 2026-11-21): in the desktop app each change of a roadmap run
> runs in a session of its own, nested under the owner's session
> (`[ADR 0014](0014-each-roadmap-change-runs-in-a-session-of-its-own.md)`). A start the app refuses
> waits for the owner's next message with a line, never a subagent in its place. The owner may tell
> the session to start the changes the load holds at that moment anyway, and the hold applies again
> to every later start; that permission is the owner's own message and is kept nowhere. Decisions 1
> to 8 are otherwise unchanged.

**ADR 0014, proposed with this plan**
(`docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`; status `accepted` and an
`Accepted by:` line only when `approval.md` records the owner's acceptance with the plan):

> # ADR 0014: In the desktop app each change of a roadmap run runs in a session of its own
>
> - Status: proposed
> - Date: 2026-11-21
> - Change: roadmap-coordinator-followups
> - Supersedes: ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md), decision 1 where
>   the host can start sessions, and its rejected option "App child sessions, one per change"
> - Amends: ADR 0013, decisions 3 and 4; ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md),
>   decision 2, what counts as a typed command
>
> ## Context
>
> The first real `/devkit roadmap` on this repository (2026-11-21) ran two changes inside the session
> the owner typed it in, as ADR 0013 decision 1 says. Only one background task showed in the app, and
> the owner could not tell what each change was doing. On 2026-11-21 the owner decided that every
> change of a run gets an app session of its own, with an icon for the stage it is in, and had the
> two changes moved into such sessions by hand.
>
> ADR 0013 rejected app child sessions per change because a start needs the owner's turn or an
> unbroken chain, the failure ADR 0010's survey found. What the app does now (seen live on
> 2026-11-21): it starts a session on a turn the owner typed, and refuses on a turn an automated
> event started, a background task's end or another session's note. A session it starts is nested
> under the session that started it, its end-of-turn reports return to that session, and it can
> rename its own title; there is no session icon. The run also showed that a session the app
> starts in a worktree of its own cannot write to two changes' worktrees, while a session started in
> a change's worktree writes there. The app delivers a started session's task below a background
> block, which ADR 0011's run detection did not read, so the moved sessions held no change lock.
>
> ## Decision
>
> 1. Where the host can start sessions, the session the owner typed /devkit roadmap in coordinates
>    the roadmap only. It picks what starts, opens it, holds for the load and shows the run's lines
>    and board. Each change it starts or resumes runs in a session of its own, started by it in the
>    change's worktree with /devkit change for that change and nested under it. That session is the
>    change's coordinator under ADR 0011: the change's stages, owner questions and approvals happen
>    there. The coordinating session hands no stage.
> 2. A change session is started only on a turn the owner typed. On any other turn, and when the app
>    refuses, the change waits: a line and the board say it starts at the owner's next message, and
>    why. It never runs in the coordinating session in its place (ADR 0006 decision 2's answer). A
>    change session's end-of-turn reports return to the coordinating session, which decides again on
>    each; the report of the turn that archives the change says so in one line. Nothing is
>    scheduled.
> 3. A change session's title is the icon of its change's stage and the change id. The icons are ❓
>    requirements, 📝 plan, 🛠️ code, 🔍 review, 🚀 delivery and 📦 archive. The change session renames
>    itself when the change loop reports another icon.
> 4. The task another session started a session with, in the host's form of a started session,
>    counts as a command typed in it for ADR 0011's run detection.
> 5. ADR 0013 decision 3's "a change could start" counts only on a turn the owner typed. The
>    run's bookkeeping also holds whether its changes run in sessions of their own, which change
>    sessions were started, and what started the last turn (ADR 0013 decision 4 names them).
> 6. Where the host cannot start sessions, ADR 0013 decision 1 holds unchanged. The rest of ADR 0013
>    holds everywhere.
>
> ## Consequences
>
> - Positive: the owner sees each change in the sidebar, with its stage at a glance. A change's
>   questions wait in its own session without blocking the others. Each session writes in its own
>   worktree. The coordinating session stays small. A change session is held by the same locks as
>   any /devkit change run.
> - Negative: a change that becomes ready on a turn the owner did not type, after another change's
>   archive included, waits for the owner's next message (Accepted: the line says so at once, and the
>   app refuses a start on any other turn). A change session the owner closes is not restarted by the run
>   (Accepted: /devkit change resumes it anywhere). A new coordinating session could start a second
>   session for a change (Mitigated: the run's record of the started change sessions outlives the
>   session that started them, and a session reads the app's list of the sessions it started
>   first). The started-session
>   form and the turn's origin are read from the host's words, which it does not document (Accepted,
>   as in ADR 0011: a wrong reading fails open or waits for the owner).
>
> ### Review trigger
>
> The app starts sessions on a turn the owner did not type, or refuses them on a typed turn; a
> started session's end-of-turn reports stop returning to the session that started it; it changes
> the form of a started session's first message; it gains a session icon; a change session is found
> handing work for another change, or the coordinating session handing a stage.
>
> ## Alternatives considered
>
> | Option | Pros | Cons | Cost to undo |
> |---|---|---|---|
> | Keep every change in the typed session (ADR 0013 decision 1) | Nothing new to build | The owner cannot tell the changes apart; one background task shows; a session started in an app worktree cannot write to two changes | low |
> | The changes take turns for a one-worktree session (this change's first draft) | Writes stay in one folder | Still one session and nothing visible; one stage at a time | low |
> | Child sessions started with the app's wake-up when they are done (ADR 0006) | The coordinator is called back when a change is done | ADR 0006's wake-up chain is what ADR 0010's survey found breaking, and the end-of-turn reports already return without it | medium |
> | A change session messages the coordinating session when its change is archived | An explicit signal | Needs the coordinating session's app id in every brief; its turn could not start the next session either, and the report already returns | low |
> | A subagent in place of a refused session | Never waits | Hides the change the owner asked to see; ADR 0006 decision 2 rejected it | low |
> | A retry on a timer | No owner message needed | A cron or wake-up, which ADR 0006 decision 3 rules out, and the app refuses its turn anyway | low |
> | A session icon set through the app | A real icon | The app has no such tool; a leading emoji in the title shows the same in the sidebar | low |

`openspec/config.yaml`'s `ADRs:` line gains
`0014 in the desktop app each change of a roadmap run runs in a session of its own, amends 0011 and 0013`.

## D-14 Existing tests this change touches

Found with
`grep -n "holding\|roadmap-gate\|roadmap-blocked\|v0\.18\.0\|outras seguem\|start_session\|run_in_background\|one change at a time" plugins/openspec/hooks/*.test.mjs`,
which every hook suite was searched with for the rules this plan replaces (ADR 0013 decision 1: every
change inside the typed session), and with
`grep -n "coordination-design\|openspec-flow\|roles\.md\|README\|'## Roadmap'\|'## Loop'" plugins/openspec/hooks/*.test.mjs`
for every test that reads a document or a skill section this plan rewrites (D-15). Each test below
keeps its invariant; every other existing test runs unchanged.

| Id | Test (file) | Invariant · layer · suite | Change |
|---|---|---|---|
| T-1 | `roadmap-loop run: U4 the same session keeps what is under way ...` (`roadmap-loop.test.mjs`) | The same session keeps what is under way; another session or `--fresh` starts empty · run command · roadmap-loop | `holding: true` becomes `{ pid: process.pid, at }`; the expected emptied value is `null` |
| T-2 | `roadmap-loop hold: polls the load, exits below the limit or on stop, and sets and clears holding` (`roadmap-loop.test.mjs`) | The hold marks its watch while it lasts and clears it at its end, also on error · hold command · roadmap-loop | `true` becomes an object with `pid: process.pid`, and `false` becomes `null` |
| T-3 | `roadmap-loop lock stop: RS2 a change that could start is refused, and a start held by the load is allowed only while its hold is watched` (`roadmap-loop.test.mjs`) | A watched hold lets the stop through · stop lock · roadmap-loop | `putRun(root, { places: 1, holding: true })` becomes `holding: { pid: process.pid, at }` |
| T-4 | `roadmap-loop decide: events each of the table once, in order, none for a stage change or a GitHub wait` (`roadmap-loop.test.mjs`) | One line per event, once, in the table's order · decide · roadmap-loop | The gate lines of `a` and `c` and the blocked line of `d` use the `-others` keys (`b` runs a stage) |
| T-5 | `roadmap-loop decide: events speak the person's language` (`roadmap-loop.test.mjs`) | An event line is in the person's language · decide · roadmap-loop | The literal becomes `/^▸ a espera a sua aprovação do plano\.$/` (nothing else runs) |
| T-6 | `roadmap-loop replies: a blocked line renders every blocked reason in both languages` (`roadmap-loop.test.mjs`) | Every key with a blocked `{why}` renders every reason · message table · roadmap-loop | The key list gains `roadmap-blocked-others` |
| T-7 | the `BLOCKED_WHY_KEYS` constant of the message-table test (`change-loop.test.mjs`, line 92) | Same as T-6 · message table · change-loop | Gains `roadmap-blocked-others` |
| T-8 | `change-loop docs: the design records the answers` (`change-loop.test.mjs`) | The CI snippet pins the current release and no earlier one · documents · change-loop | `/v0\.18\.0/` becomes `/v0\.19\.0/`, and `v0.18.0` is refused |
| T-9 | `change-loop skill: the sections of D-3 to D-9 and the modes of start` (`change-loop.test.mjs`) | The skill keeps its sections and start modes and names no retired machinery · skill text · change-loop | Its `doesNotMatch(md, /conduct-check\|CronCreate\|start_session/)` pins ADR 0013 decision 1 (no app session): `start_session` becomes `wake_when_done` (ADR 0006's wake-up stays retired; the session-start tool is now named by the Roadmap section) |
| T-10 | `roadmap-loop skill: background hand-offs, one change per question, and the message that ends a turn` (`roadmap-loop.test.mjs`) | Where the host cannot start sessions, the coordinator hands each stage in the background, asks one change at a time and ends a turn with its message · skill text · roadmap-loop | It pins ADR 0013 decision 1 for every run. Only its `roadmap` constant changes: from `sectionOf(md, '## Roadmap', '## Status')` to `sectionOf(md, '## Roadmap', '### A session per change') + sectionOf(md, '### Every change in this session', '## Status')`, the opening paragraph and step 1 (which hold the `devkit-roadmap: <n>` and `run` with `stop` sentences two of its assertions read) plus the part with today's steps 2 to 5. Every assertion stays as written, the Never-list and `## Status` ones included |

Tests that read text this plan rewrites and pass unchanged, because the plan keeps the text they pin
(each is named in the task that rewrites the text, and its check):

| Id | Test (file) | Invariant · layer · suite | What the plan keeps |
|---|---|---|---|
| T-11 | `roadmap-loop docs: the documents follow` (`roadmap-loop.test.mjs`) | The design, ADR 0013, the two Notes, the config, the flow page, the role document and both READMEs say what the roadmap coordinator is · documents · roadmap-loop | Section 10 of `docs/coordination-design.md` keeps the phrase `each stage runs as a subagent in the background`, its words up to `the` on one line (the test's `\s+` allows a line break only before `background`; D-15 gives the bullet), and never writes `each change has its change coordinator as a subagent`; ADR 0013 keeps its five headings; ADR 0010 and ADR 0011 keep their `Note (roadmap-coordinator, ...)` with the ADR 0013 link (the new Notes are added beside them); the `ADRs:` line keeps `0013`; the flow page keeps its roadmap heading; `docs/roles.md` keeps `## roadmap-coordinator`; both READMEs keep naming `/devkit roadmap` and `/devkit status` |
| T-12 | `change-loop docs: the design records the answers` (`change-loop.test.mjs`), its assertions other than T-8's | The design records the owner's answers · documents · change-loop | Section 10's sentence `Decided by the owner on 2026-11-20 (round 15 grill, question 1)` |
| T-13 | `roadmap-loop skill: every roadmap-loop command carries the person's language and the load limit` and `roadmap-loop skill: every hand-off of a roadmap run starts with the change's brief line, and an unfilled setting is used silently` (`roadmap-loop.test.mjs`) | Every `roadmap-loop.mjs` line carries both settings; the `run` line reads `$ARGUMENTS` through the quoted heredoc; the brief-line and unfilled-setting sentences · skill text · roadmap-loop | Every new `roadmap-loop.mjs` line carries both flags; `run`'s code block is the first line naming `roadmap-loop.mjs run`; the opening paragraph and step 2's brief-line sentence stay in the Roadmap section |
| T-14 | `change-loop lock agent: the accepted packs are the ones docs/roles.md names` (`change-loop.test.mjs`) | `PACKS` matches the agents `docs/roles.md` names · hand-off lock · change-loop | The rewritten `Played today by:` lines of `change-coordinator` and `roadmap-coordinator` keep the form `- Played today by: The main session ...`, never `- Played today by: The agent ...` |

`changeIdOf` accepts every id the existing tests pass (`a`, `alpha`, `x`). The tests read
`render(...)` for `roadmap-held`. No existing fixture sets `changeSessions`, so every `decide`, lock and
command test keeps the path of ADR 0013 decision 1. No existing test compares a whole run file or a
whole change-loop action. Before approval, the readiness reviewer can confirm this list with the grep
above.

## D-15 Documents, the skill and the release

- `plugins/openspec/skills/devkit/SKILL.md`:
  - D-1, D-2, D-3, D-5 and D-6: the Start bullet; Roadmap step 1 (the owner's arguments,
    `--change-sessions`), its two `###` parts, the start-anyway item, the turn rule; the Loop's
    title item; the Never list.
  - Every line that names a `roadmap-loop.mjs` subcommand carries `--lang ${user_config.language}`
    and `--load-limit ${user_config.load_limit}` (the skill test reads every such line). No line above
    the `run` code block names `roadmap-loop.mjs run`.
  - The tools are named as the app names them, and loaded first with the ToolSearch query
    `select:<name>` (deferred tools): in the Roadmap section's `### A session per change` part,
    `mcp__ccd_session__start_session` (called with the action's `input` exactly as given) and
    `mcp__ccd_session_mgmt__list_sessions` (called with `{ "linked": true }`); in the Loop's title
    item, `mcp__ccd_session_mgmt__set_session_title` (called with `session_id` `"self"` and `title`
    the action's `sessionTitle`, from the main thread). The skill names no other field of these
    tools, no wake field and no `SendMessage`.
- `docs/openspec-flow.md`, the roadmap section:
  - its first paragraph: the session coordinates the roadmap; in the desktop app each change runs in
    a session of its own (ADR 0014), elsewhere in the session as before;
  - "The lines.": the "ready, waits for a place" class becomes "ready (the board says it waits for a
    place only when the places are taken)";
  - "The run file.": it names the fields of ADR 0013 decision 4 and says a watch of the load whose
    process ended counts as none;
  - "The load.": the owner can say to start anyway; the next start is held again;
  - a new paragraph, "A session per change.": D-3, D-5 and D-6 in plain words, the icons included;
  - "What it decides and says.": the `session-start` action, `--turn`, and the gate and blocked
    lines' "others" sentence;
  - "The locks.": a change session is a change run (D-4); in a run with a session per change the
    coordinating session hands nothing;
  - Troubleshooting: the held-start row says "or tell the session to start anyway", and a new row
    for "waits for your next message";
  - the CI snippet's pin `v0.18.0` becomes `v0.19.0` (three places).
- `docs/coordination-design.md`:
  - line 28's parenthesis gains "in the desktop app each change in a session of its own" with the
    ADR 0014 link, and keeps "each stage a subagent in the background" and the ADR 0013 link;
  - section 10's Claude bullet: its first two sentences and its second paragraph (the "Waiting on
    GitHub" decision, `Decided by the owner on 2026-11-20 (round 15 grill, question 1)`) stay as they
    are; the rest of its first paragraph, from "For the roadmap" to "one change at a time.", becomes
    the text below, wrapped so that `each stage runs as a subagent in the` stays on one line (T-11);
    each link quoted in backticks is written there as a plain Markdown link (it resolves only there):

    > For the roadmap the session is the roadmap coordinator. In the desktop app each change of the
    > run has an app session of its own, started by the roadmap coordinator in the change's worktree
    > and nested under it, which is that change's coordinator
    > (`[ADR 0014](adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md)`); where the host
    > cannot start sessions, the session is also the coordinator of every open change. Either way
    > each stage runs as a subagent in the background
    > (`[ADR 0013](adr/0013-the-roadmap-coordinator-is-the-owners-session.md)`). When a change needs
    > the owner, its coordinator asks it, one change at a time.

  - the "Holding a start" paragraph gains the start-anyway sentence and the wait for the owner's
    next message.
- `docs/roles.md`: the `change-coordinator` and `roadmap-coordinator` "Played today by" lines say
  that in the desktop app each change of a run has a session of its own, which plays the change
  coordinator (ADR 0014).
- `README.md`, the `/devkit roadmap` sentence: "each stage in the background and your gates asked in
  this session one change at a time" becomes "each change in an app session of its own in the desktop
  app, where its gates are asked", and it cites ADR 0014.
- Versions: devkit-openspec 0.18.0 → 0.19.0 (`plugins/openspec/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`) and marketplace `metadata.version` 0.22.0 → 0.23.0.
  `CHANGELOG.md` gets `## 0.23.0 — follow-ups of the roadmap coordinator`. `docs/catalog.md` is
  regenerated (`python3 scripts/gen-catalog.py`). The tag `v0.19.0` is a workflow follow-up.

## D-16 Proof

- New tests are named `followups <AC-n or F-n> <area>: ...`, so a gate selects them with
  `--test-name-pattern="^followups"`. They live in `plugins/openspec/hooks/roadmap-loop.test.mjs`,
  except the change-run tests (the open lock, the change run's single read, the started-session run of
  F-4, `stageIcon` and the `icon` of `next`), which live in `plugins/openspec/hooks/change-loop.test.mjs`
  beside their fixtures. `readCounter` is exported from `change-loop.test.mjs`, so one helper serves
  both files.
- The F-4 fixture is the shape of this change's own first message: the background line, a background
  paragraph, `Task:`, `/devkit-openspec:devkit change <id>`, and the notes line, in generic words.
- Red first: phases 1, 2 and 3 each write their tests on the unchanged code and save the run to
  `openspec/changes/roadmap-coordinator-followups/proof/red-1.txt`, `red-2.txt` and `red-3.txt`. The
  tests of AC-10 pin behaviour the base already has and pass there; the file says so for each.
- Live (AC-12, AC-13, AC-14, AC-15): the records of this run go to `proof/live/records.txt`, both
  before the move (the coordinating session's transcript) and after it (each change session's
  transcript). They include every title rename of this change's session, with its time and stage,
  and the rename of the `merge-setup-field-fixes` change session from 📝 to 🛠️ when its code stage
  began (2026-11-21), from that session's transcript. The many-archived runs go to `proof/many-archived.txt`. `evidence.md` (the verifier's) quotes them in
  English. The coordinating session runs 0.18.0 until this change merges, so the script's own session
  starts are proved here by tests. Their first live use is the next roadmap run, recorded in the retro.

## Field defects of this run (AC-11)

Every defect this run shows until this change's delivery ends gets a row. A new row means revising
the spec delta and this plan, then readiness, then the owner's approval again, before its fix.

| Id | Defect | Plan | Approval | Red test |
|---|---|---|---|---|
| F-1 | `/devkit roadmap 2` is refused on the first `run` call | D-1 | approval.md, attempt 1 (2026-11-21), the plan's first approval | `followups F-1 run: the arguments as typed start the run on the first call` |
| F-2 | No way for the owner to start a held change | D-2 | approval.md, attempt 1 (2026-11-21), the plan's first approval | `followups F-2 decide: start anyway starts the held changes once` |
| F-3 | A session the app started in its own worktree cannot write to two changes; nothing tells the changes apart | D-3, ADR 0014 | approval.md, attempt 1 (2026-11-21), the plan's first approval | `followups F-3 decide: with a session per change the coordinator hands no stage and starts each open change's session in its worktree` |
| F-4 | A session started by another session holds none of the change run's locks | D-4, ADR 0014 | approval.md, attempt 1 (2026-11-21), the plan's first approval | `followups F-4 guard: the task of a session started by another session makes a change run` |

All four defects were in the plan the owner approved once, on 2026-11-21 (`approval.md`, attempt 1); no
defect came after that approval, so no renewed approval exists and none is owed. The live records
(`proof/live/records.txt`) show no further defect. Their last observation, the run file's stale
in-flight planner entry after the change was moved to its own session by hand, is not a row: the
move was a one-off manual act, no code path of this run produces it, and ADR 0014's
`startedSessions` (D-3) replaces the in-flight entry for a change that has its own session.

## Proof map

| AC | Tasks | Proved by |
|---|---|---|
| AC-1 | 2.1, 2.3 | `followups AC-1 status: ...` |
| AC-2 | 2.1, 2.3 | `followups AC-2 decide: ...` |
| AC-3 | 4.1 | `followups AC-3 run file: ...` against ADR 0013 decision 4 |
| AC-4 | 1.1, 1.4 | `followups AC-4 ...` |
| AC-5 | 1.1, 1.3 | `followups AC-5 run file: ...` |
| AC-6 | 1.1, 1.3 | `followups AC-6 lock agent: ...` (a real hook process) and the wait rule test |
| AC-7 | 1.1, 1.2 | `followups AC-7 ...` (a killed real `hold` process) |
| AC-8 | 2.1, 2.2, 2.4 | `followups F-2 ...`, `followups AC-8 ...` |
| AC-9 | 2.1, 2.2, 2.4 | `followups F-1 ...` |
| AC-10 | 1.1, 1.3 | the seven `followups AC-10 ...` tests, and `followups AC-6 lock agent: ...` for the hook as a caller of the lock |
| AC-11 | 1.1, 2.1, 3.1, 5.3 | `proof/red-1.txt` to `proof/red-3.txt`, the Field defects table |
| AC-12 | 5.1, 5.2 | `proof/live/records.txt`, `proof/many-archived.txt`, quoted in `evidence.md` |
| AC-13 | 3.1, 3.2, 3.5, 3.6, 4.2, 4.3, 5.1 | `followups AC-13 ...`, `followups F-3 ...`, `followups F-4 ...`; live: the sessions moved by hand |
| AC-14 | 3.1, 3.4, 3.6, 4.2, 5.1 | `followups AC-14 ...`; live: this session's renames in `proof/live/records.txt` |
| AC-15 | 3.1, 3.2, 3.3, 3.6, 4.3, 5.1 | `followups AC-15 ...`; live when it happens in this run, else in the retro |

## Risks / Trade-offs

- [The owner does not accept ADR 0014] → the plan returns to planning; phases 1 and 2 do not depend
  on it, and phase 3 is removed.
- [The app refuses a start on a typed turn too] → the refused path (D-6) gives the line and the
  board row, so the change waits for the owner's next typed message; never silent. The live run or
  the retro records it, and ADR 0014's review trigger names it.
- [Every change that becomes ready after an archive waits for the owner's next message] → accepted
  by AC-15 ("or the coordinator's board says it waits for the owner's next message, with the
  reason"): the app refuses a start on another session's note (Context), so no mechanism of this
  plan can start it sooner; the line says so at once.
- [The session misjudges what started its turn] → `event` when in doubt; a `typed` misread is caught
  by the app's refusal, which takes the refused path.
- [The app's started-session form changes] → F-4's reading fails open (no run, as in ADR 0011); its
  test fixture pins today's form, and ADR 0014's review trigger names it.
- [A second session for one change, from a new coordinating session: `{ "linked": true }` lists only
  its own family, so a session an earlier coordinating session started is not found] → `run` from
  another session keeps `startedSessions` (D-3, item 9), so the change is not started again; only
  `--fresh` forgets it. A start from the same coordinating session is prevented by `startedSessions`
  and the list check.
- [A change session the owner closed, still in `startedSessions`] → the run counts the change as
  running in its session and starts no other; the owner resumes it with `/devkit change <id>` (the
  Non-Goals) or calls the run with `--fresh`; the board's row for the change is read from its files
  as for any change.
- [A typed `/devkit status` is the owner's only next message] → it writes and starts nothing by its
  own requirement; the board's row says the change starts at the next message, so the owner writes
  again.
- [A busy hand-off goes through unmarked, and the stop lock later names its stage as ready] → the
  writes under the lock take milliseconds and the wait is 3 s; the refusal comes once per state; the
  skill already says one stage per change at a time.
- [A `next`, `reply`, `hold`, `wait` or `run` gives up after 3 s where it waited 10 s before] → it
  exits 3 with `RunFileBusy`'s message and writes nothing, so the session runs the same call again;
  a lock older than 60 s is taken over as stale, as today.
- [A change session's end-of-turn report does not start a turn in the coordinating session] → the
  change's files still say it was archived, so the next decision, at the owner's next message, frees
  its place and starts the next line; the live run (task 5.1) or the retro records it, and ADR 0014's
  review trigger names it.
- [Every turn end of every change session starts a turn in the coordinating session] → each such
  turn runs one `next --turn event`, which hands and starts nothing in this mode and says only lines
  not said before; a turn with no new line ends with no message (D-3, Skill).
- [The owner set a change session's title by hand, and the app asks the owner to approve the rename
  outside bypass mode] → the question is the app's, in the change session; a declined rename is not
  retried for the same title and the change goes on.
- [A change id of 57 characters or more] → `sessionTitle` cuts the title to 59 code points; the list
  check also matches the row's `cwd`.
- [The pid of a dead hold is reused by another process] → that watch reads as alive until the run
  is called from a new session or with `--fresh`. Rare and harmless: no start is lost, only delayed.
- [The session passes `--start-anyway` on its own] → the skill rule and the Never item. No file holds
  the permission, and no lock reason suggests the flag. The same trust as `approval.md` (ADR 0011).
- [`merge-setup-field-fixes` releases first] → the release rebase renumbers this change's version
  and CHANGELOG entry (`release-rebase.mjs`).

## Migration Plan

The run file stays compatible both ways. 0.19.0 reads 0.18.0's boolean `holding` as no watch, and an
absent `changeSessions`, `startedSessions` or `turn` as false, empty and null. 0.18.0's `readRun`
drops an object `holding` and the three unknown fields. A run started under 0.18.0 keeps running its
changes in the typed session until `/devkit roadmap` is called again under 0.19.0 with
`--change-sessions`. The two sessions moved by hand on 2026-11-21 were started by this run's
coordinating session, so its list check (`{ "linked": true }`) finds them by their `cwd` and does
not start them again (D-3). Rollback: revert the pull request; a change session then goes on
as a `/devkit change` run under ADR 0011, without the F-4 reading.

## Implementation plan

Order: the bookkeeping and its locks (phase 1), then what the owner sees, the run's arguments and
start anyway (phase 2), then the session per change, the icon and the turn (phase 3), then the ADRs,
documents and release (phase 4), then the live records (phase 5).

**Per surface.**

- Hooks (`roadmap-loop.mjs`, `change-loop.mjs`, `guard.mjs`): D-1 to D-12.
- Skill (`SKILL.md`): D-1, D-2, D-3, D-5, D-6.
- Documents: D-13, D-15.
- No worker, no frontend, no CI file.

**Files.**

- Modify: `plugins/openspec/hooks/roadmap-loop.mjs`, `plugins/openspec/hooks/change-loop.mjs`,
  `plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/roadmap-loop.test.mjs`,
  `plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/skills/devkit/SKILL.md`,
  `docs/adr/0010-openspec-as-the-harness.md`, `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`,
  `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`, `docs/openspec-flow.md`,
  `docs/coordination-design.md`, `docs/roles.md`, `README.md`, `openspec/config.yaml`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`,
  `docs/catalog.md`.
- Create: `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`, and
  `openspec/changes/roadmap-coordinator-followups/proof/` (`red-1.txt`, `red-2.txt`, `red-3.txt`,
  `live/records.txt`, `many-archived.txt`).
- Delete: none.

**Estimate:** optimistic 27 h · likely 37.5 h · pessimistic 54 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 the run's arguments | 1 | Core | LOW |
| D-2 start anyway, its key and the skill item | 2 | Core | LOW |
| D-3 the session per change: mode, facts, `own`, `session-start` and its `input`, `sessionName`, background, kept `startedSessions`, RH6 | 8 | Core | HIGH |
| D-4 the started-session form in `typedOf` | 1.5 | Core | MEDIUM |
| D-5 `stageIcon`, `sessionTitle`, the `icon` and `sessionTitle` fields, the Loop item | 2 | Core | LOW |
| D-6 the turn, the two wait lines, the board key | 3 | Core | MEDIUM |
| D-7 the watch's process | 2 | Core | MEDIUM |
| D-8 the lock's wait, `RunFileBusy`, `lockSleep` | 3 | Core | MEDIUM |
| D-9 ids | 1 | Core | LOW |
| D-10 the temporary file | 0.5 | Core | LOW |
| D-11 the board's ready line and the session rows | 1.5 | Core | LOW |
| D-12 the "others" keys | 1.5 | Core | LOW |
| AC-10 tests (`--session`, draft, `mainInRun`, timeouts) | 2 | Testing | LOW |
| D-14 the ten changed tests | 1.5 | Testing | LOW |
| Phase 3 tests (sessions, icon, turn, F-4) | 3 | Testing | MEDIUM |
| D-13 ADR 0013 decision 4 and its test, ADR 0014, three Notes | 2.5 | Documentation | MEDIUM |
| D-15 the skill's Roadmap parts, documents and release | 3 | Documentation | MEDIUM |
| Phase 5 live records and many archived changes | 3 | Integration | MEDIUM |
| The whole suite and the marketplace validation | 1 | Testing | LOW |

**Risks** (probability × impact):

- ADR 0014 refused (LOW × HIGH): see Risks above.
- The session mode breaks an existing decision test (MEDIUM × MEDIUM) → it runs only with
  `changeSessions`, which no existing fixture sets; phase 3's gate runs every `roadmap-loop` and
  `change-loop` test.
- The `icon` field breaks a test that compares an action (LOW × LOW) → none compares a whole action
  (searched: no `deepEqual` of an action or its keys); phase 3's gate runs them all.
- The real-process tests add time to the 13-minute suite (MEDIUM × LOW) → one 3 s hook test and one
  killed-hold test; everything else uses `lockSleep`.
- A further field defect late in the run (MEDIUM × MEDIUM) → AC-11's loop: revise, approve, red test,
  fix.

**Assumptions.**

- The app's facts in Context: the start, list and rename tools with their exact ids and fields; the
  four tools are deferred and loaded with ToolSearch `select:<name>`; nesting and the end-of-turn
  reports; only a typed turn may start a session; the first-message form of a started session
  (sources: the tool schemas read in the desktop app and the calls this run's coordinating session
  made, both on 2026-11-21 and given in the brief of this plan's revision; `requirements.md`,
  assumptions confirmed by the owner; this change's own session transcript of 2026-11-21;
  `plugins/panel/hooks/sessions.ts` for the list's rows).
- `{ "linked": true }` lists the sessions this coordinating session started, with `title` and `cwd`,
  and leaves archived ones out unless `include_archived` is set (source: the calls of 2026-11-21 and
  `plugins/panel/hooks/sessions.ts`, which sets `include_archived: true` to see them). The list check
  still skips a row whose `isArchived` is true.
- A session started in a change's worktree writes there, and a script run through Bash (`open`, the
  run file) is not refused in an app-made worktree (sources: this session, and the roadmap-coordinator
  retro).
- `process.kill(pid, 0)` tests whether a process exists on macOS, Linux and Windows (source: Node.js
  documentation of `process.kill`).
- A hook killed by its timeout does not block the tool call (source: Claude Code hooks documentation,
  timeouts are non-blocking errors). This is why AC-6 is about the hook's own answer and its record,
  not about a hand-off that would otherwise be lost.

**Dependencies.** `roadmap-coordinator` (archived, merge commit `aafd1ce`): `roadmap-loop.mjs`,
`withLockFile`, `transcriptEvents`. The OpenSpec CLI 2.x on `PATH` for the suite. The owner's
acceptance of ADR 0014 with the plan.

## Decisions cited

- ADR 0006: decision 2 (a refused session start waits for the owner, never a subagent), decision 3
  (no cron); its wake-up chain, rejected again in ADR 0014's table.
- ADR 0010: decision 8 (one run's bookkeeping); the survey on starting child sessions; the Note on
  holding a start (D-13 adds a Note).
- ADR 0011: decision 2 (the run read from the session's record; widened by D-4); a hook that fails
  closed was rejected (D-8 keeps the busy hand-off open); `approval.md` only from the owner's own
  message (the same rule for start anyway).
- ADR 0013: decision 1 (superseded in the desktop app by ADR 0014), decision 3 (the stop lock, amended
  for the turn), decision 4 (rewritten to name the fields), and the rejected option "App child
  sessions, one per change" (taken up by ADR 0014).

## Open Questions

None that changes the specs, the approach or the tasks. The owner confirms at approval: ADR 0014, the
reading of AC-6 (D-8), whether a killed `wait` (the Non-Goals) becomes a roadmap line, and the two
changes the host facts of 2026-11-21 made in this revision: a change session starts only on a typed
turn (no `message` turn), and the archive reaches the coordinating session by the change session's
end-of-turn report, with no message tool (D-3, D-6).
