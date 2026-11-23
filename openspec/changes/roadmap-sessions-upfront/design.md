<!-- devkit-stage design result=passed attempt=7 commit=0b409a5e21c6b8328e104e659417ec1bf51f6a74 -->
# Design

Change: `roadmap-sessions-upfront` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec:
n/a (sources: `requirements.md`, `proposal.md`, the specs of this change). Base: `c561553`; revised
on 2026-11-23 after main moved (merge `b216a46`: change-state, ADR 0017, commit-attribution), with the
held state of D-11 and phase 5 of `tasks.md`; revised again on 2026-11-23 after the merge `a9ecdc1`
(change-budget, jira-entry, delivery-models with ADR 0018, gh-version-check, review-openspec-fix): the
token budget in `session-next` (D-6 step 1, task 6.1), this change's ADR number 0019 (D-12) and the
release versions (D-14); revised a fourth time on 2026-11-23 after review round 1 at `123a7ba`
(`review.md`): the fixes of its twelve open important findings and of five nits, listed in D-16 and
built by phase 7 of `tasks.md`, with the sections they change (D-1, D-4, D-5, D-6, D-7, D-9, D-12,
D-13, D-15, the risks and the estimate) rewritten in place; revised a fifth time on 2026-11-23
after the merge `62cf500` brought `change-version-pin` (devkit-openspec 0.31.0), whose repository
check refuses a released flow edited in place: the triage helper ships as flow version 2 of the
`devkit` and `devkit-lite` scripts, the owner's answer of 2026-11-23 (D-17, phase 8 of `tasks.md`),
with D-4, D-9 step 3, D-13, D-14, D-15, the risks, the implementation plan and the dependencies
changed to say so.

## Context

See `proposal.md` (Why). The facts this design builds on, read at the base:

- `plugins/openspec/skills/devkit/SKILL.md` declares `disable-model-invocation: true`, so only the
  owner's typed `/devkit` runs it. A session the roadmap run starts receives the task
  `/devkit-openspec:devkit change <id>` under the started form (`STARTED_BY_SESSION` in
  `plugins/openspec/hooks/guard.mjs`); `guard.mjs#typedOf` reads that task as a typed command, so
  the change-run locks hold the session (ADR 0014 decision 4). What is missing is a way to run the
  loop with no typed command.
- `roadmap-loop.mjs#decideRoadmap`, in a run with a session per change (`changeSessions`), opens a
  ready line only when a place is free (`wanted = ready.slice(0, free)`), counts every open change in
  a place, asks no gate (`queue = sessionMode ? [] : ...`), and builds the `session-start` input in
  `sessionStartOf`. `roadmapAgentDecision` refuses every hand-off of the coordinating session (RH6).
- The run file (`<git common dir>/devkit/roadmap-run.json`, `readRun`, `updateRun`) holds exactly
  the fields ADR 0013 decision 4 lists.
- The change loop's stop lock (`change-loop.mjs#stopDecision`) refuses a stop while an agent or
  session action is ready, and allows it while a background task runs (`input.background_tasks`).
  The Stop hook input also carries `session_crons` (`roadmap-loop.test.mjs` builds it).
- `change-loop.mjs#waitLoop` polls a decision while it stays the same wait on GitHub.
- The grill rule "never answer your own grill questions" is in `openspec/config.yaml`
  (`rules.requirements`) and in the requirements instruction of both schema copies
  (`plugins/openspec/schemas/devkit*/schema.yaml`, `openspec/schemas/devkit*/schema.yaml`: "Do not
  answer the questions yourself").
- The `devkit` skill's Never list holds "Create a cron or any scheduled wake-up"; ADR 0006
  decision 3 and ADR 0014 decision 2 ("Nothing is scheduled") forbid a schedule.
- Since the merge `b216a46`, ADR 0017 (change-state) derives every change's state in one place,
  `change-loop.mjs#changeState(action, facts, { lang, id })`, over the run file's facts of
  `runFactsOf(run, id, { onRoadmap })`; `nextAction` sets `action.state` and takes `sessionTitle` from
  `state.title`; `stateEntries` (the `state` command) and `roadmap-loop.mjs#stateRow` (the board) read
  the same function. ADR 0017 decision 4 titles a stopped change `<state icon> <stage icon> <id>`
  (🙋 owner, ⏳ GitHub, ⛔ blocked); decision 2 reads a roadmap change with no session, or whose start
  waits, as `running` with the reason `ready`. Phases 1 to 4 of this change, written before that merge,
  read the held state a second way: `sessionDecide` titles a held change `sessionTitle(WAIT_ICON, id)`
  itself, and `stateRow` builds the `queue.held-*` rows from the board's `queued` and `waitsFor`
  directly. D-11 moves both readings into `changeState`.
- Since the merge `a9ecdc1`, change-budget counts a token budget only when `nextAction` is called with
  `budget: true` (default false), which only `change-loop.mjs next` does (`runNext`); at the cap a
  hand-off or a session step becomes the end `waiting-for-owner` with the why `waiting-budget`, which
  `GATE_OF_WHY` maps to the gate `budget`. change-budget's design D-4 keeps the locks, `wait` and the
  roadmap coordinator's reads budget-free. `sessionNext` calls `nextAction` with no budget, so a roadmap
  change session would never stop at its cap: D-6 step 1 restores it. ADR 0018 is delivery-models'
  (`docs/adr/0018-the-delivery-model-is-chosen-per-project.md`); it amends ADR 0010 and ADR 0012.

## Goals / Non-Goals

**Goals:** the sixteen criteria of `proposal.md`, through one entry with a ticket, one change-session
loop (`session-next`), one place rule shared by the change session and the periodic check, and one
cleanup path shared by the check and the run's end.

**Non-Goals:**

- No change to how the owner's typed `/devkit change` runs a lone change, beyond the triage (D-4;
  for a change on flow version 2, D-17),
  the source check (D-4) and the renumbering step (D-10).
- No lock refuses a load-stage hand-off without a place; the place rule is enforced by the loop and
  the stop lock (D-7). Recorded as a risk.
- No message tool between sessions: a change session goes on through its own background wait,
  never through a message (`followups AC-13 skill` pins "no message tool").
- No change to a run where the host cannot start sessions, except the triage, the periodic check and
  the source check, which apply to every run.

## D-1 The entry of a started change session (AC-1, AC-2)

**The ticket.** `decide()` in `roadmap-loop.mjs` (the impure wrapper around `decideRoadmap`) gives
every `session-start` action of the decision a fresh ticket, 16 lowercase hex characters from
`crypto.randomBytes(8)` (`mintTicket()`), and records it in the run file before printing:
`tickets[<id>] = { ticket, at, claimedBy: null }`. An unclaimed ticket of the same change is replaced;
a claimed one is never replaced. `withTicket(action, ticket)` (exported, pure) returns the action with
`input.prompt` set to two lines:

```
/devkit-openspec:devkit change <id>
devkit-start: <id> <ticket>
```

`decideRoadmap` itself stays pure and still returns the one-line prompt, so the stop lock's read-only
decision mints nothing. The first line is unchanged, so `typedOf` still reads a change run (ADR 0014
decision 4); the second line is ignored by it.

**The entry skill.** New `plugins/openspec/skills/devkit-session/SKILL.md`, model-invocable (no
`disable-model-invocation`). Frontmatter: `name: devkit-session`; `description` (quoted, it holds
`: `): "Runs the change of a session a /devkit roadmap run started, from its first turn, with no
command typed. Use only when this session's first message is the started-session form whose task is
/devkit change <id> followed by a devkit-start line; the devkit guard refuses it anywhere else." The
change id is the id of the `devkit-start:` line of the session's first message; the skill takes no
argument. Its body is D-6's loop. The `devkit` skill keeps `disable-model-invocation: true`
(`change-loop skill: the frontmatter` keeps pinning it).

**The guard.** `plugins/openspec/hooks/hooks.json` gains a fourth PreToolUse entry, matcher `Skill`,
command `node "${CLAUDE_PLUGIN_ROOT}/hooks/guard.mjs" skill`, timeout 10. `guard.mjs` gains the mode
`skill`. It first tests the raw input, with no import: `namesEntrySkill(toolInput)` (exported from
`guard.mjs`, pure, beside `ENTRY_SKILL = 'devkit-session'`, which moves here from `roadmap-loop.mjs`;
`roadmap-loop.mjs` imports both and re-exports `ENTRY_SKILL`) is true when some string value of
`input.tool_input` equals `devkit-session` or ends in `:devkit-session`. When it is false, the mode
logs `{ decision: 'allow', why: 'not-entry' }` and exits 0 without importing `roadmap-loop.mjs`, so a
module that cannot load never refuses another skill (scenario "Another skill"; review round 1,
code-quality F2). When it is true, the mode imports `roadmap-loop.mjs` and calls
`entryDecision(input, { env: process.env })`, logs the decision through the shared
`logDecision(mode, input, d)` (extracted from `lock`, same JSON line), and blocks (exit 2) on
`refuse`. Unlike the other locks it fails closed: an exception, the failed import included, blocks
with the reason `unreadable`. `DEVKIT_BYPASS=1` still exits 0 first. The mode does not depend on the
project's opt-in: outside a devkit project it refuses only a call of `devkit-session`, which exists
only for a roadmap run and finds no ticket there; ADR 0020 records this exception to ADR 0004 (D-12).
`entryDecision`'s `not-entry` branch calls the same `namesEntrySkill`, so the hook and the decision
read the skill's name one way.

**Shared readers in `guard.mjs`.** `startedTaskOf(content)` returns the lines after the first line
that, trimmed, is `Task:`, when the first line, trimmed, is `STARTED_BY_SESSION`; else null. Before
that test it skips the host's notes that lead the message: while the first non-blank line, trimmed, is
`<system-reminder>`, the lines up to and including the next line that, trimmed, is
`</system-reminder>` are dropped (an unclosed note gives null), then the blank lines after them. The
real first message of a session the app started on 2026-11-22 begins with such a note (the app's
list of linked sessions) before `STARTED_BY_SESSION` (review round 1, test-coverage F4; D-15), so
without the skip the entry would refuse every real started session and the change-run locks would
not see its task. `typedOf` uses it (one reader of the started form): a message for which
`startedTaskOf` is not null is read from its first non-blank task line; any other message from its
first line, as before, so a typed message that is not the started form reads as it does today.
`firstMessageOf(input)` returns the string
`message.content` of the first `user` line of the transcript that is neither `isMeta` nor
`isSidechain`, else null. `START_LINE = /^devkit-start: ([A-Za-z0-9][\w.-]*) ([0-9a-f]{16})[ \t]*\r?$/`
is exported.

**`entryDecision(input, { env })`** in `roadmap-loop.mjs`, one label per branch, first match wins:

| Label | Decision | When |
|---|---|---|
| `not-entry` | allow | `namesEntrySkill(input.tool_input)` is false: no string value equals `devkit-session` or ends in `:devkit-session` |
| `not-started` | refuse | `firstMessageOf` is null, or `startedTaskOf` of it is null, or the first non-blank task line is not `/devkit change <id>` (bare or plugin-scoped) |
| `no-ticket` | refuse | no task line matches `START_LINE` with the same `<id>` |
| `ticket-unknown` | refuse | the run file (from `input.cwd`) records no ticket for `<id>`, or another one |
| `ticket-claimed` | refuse | `claimedBy` is set and differs from `input.session_id` |
| `same-session` | allow | `claimedBy` equals `input.session_id` |
| `claimed` | allow | `claimedBy` is null: it is set to `input.session_id` under the run file's lock |
| `unreadable` | refuse | any exception (no project, run file busy, transcript unreadable) |

Every refusal's reason ends with: "the owner can run this change by typing /devkit change <id> in
this session". The skill is found by any string field because the host's field name for the skill is
not documented (Assumption A-2).

**How AC-2 holds.** (1) The `devkit` skill stays owner-only: the host refuses a model call of it, as
today. (2) The only model-invocable entry runs past the guard only with a ticket that the run wrote
into its own run file at the moment it built that session's start, carried in the session's first
message, in the host's started form, and not claimed by another session. A session the owner started,
a session started with a hand-made prompt, a pasted or replayed ticket in a second session, and a
session of a change the run did not start are all refused. (3) A model that reads the skill files and
runs `change-loop.mjs` by hand starts no run the hooks know (no typed command, no claimed ticket);
the product-code gates hold it as today (ADR 0011, Negative consequences, accepted).

## D-2 Every pending change opens at the run's start (AC-3)

In `decideRoadmap`, when `f.changeSessions`:

- `wanted` is every line of class `ready` or `waiting` (unticked, not archived, not open, not on the
  previous script, not declared), in file order, whatever `free`, the load and the dependencies.
  `starts` stays withheld on a turn nobody typed (`withhold`), with its line, as today.
- No `hold` action and no `roadmap-held` line: the load holds a place, not an opening (D-7).
- `session-start` for every open line with no session of its own, as today. A change whose ticket is
  claimed counts as `own` in `entriesOf` (beside `startedSessions` and `after === 'session-start'`).
- The session-started line becomes the new key `roadmap-session-opened` (English: "{id} is open in a session of
  its own; its grill is asked here."; Portuguese: `{id} está aberta numa sessão própria; o grill dela é feito aqui.`), with no count of places.

In a run without the mode nothing changes. `boardOf` lists every open change (D-11).

## D-3 The owner's gates of a change session, in the coordinating session (AC-4, AC-7)

**Reading the actions.** `collectRoadmap` gains `readOwn` (default true): in session mode, the action
of every open change in its own session is read (today it is skipped unless `readFlying`).
`roadmapStopDecision` passes `readOwn: false`, so the Stop hook reads no change's action; its actions
need only the files read by D-5 and D-9.

**The queue.** In session mode `queue` is the entries in roadmap order whose action is a roadmap gate:
`ROADMAP_GATES = ['grill', 'approval', 'retro']`, the gate of `gateOf(action)` (the grill, the end
`waiting-approval` or `waiting-approval-again`, the end `waiting-retro`). `ask` is
`{ change, kind: 'grill' | 'gate', gate, action }` as today; `asking` keeps the head while it stays
there. The gate lines `roadmap-gate` and `roadmap-gate-others` are emitted for roadmap gates; in
session mode "others go on" means another `own` entry that is not at a roadmap gate. Every other
gate stays in the change session and gets no line here.

**Asking and recording.** The skill's session-per-change part asks `ask` as item 4 of the second part
says: the grill through the `requirements-grill` skill for that change only, writing its
`requirements.md` at the absolute path under `ask.action.root`; the approval as the `ship-change`
row `stop-plan-approval` says (the plan's summary: the proposal's What Changes, the design decisions,
the tasks' phases; `approval.md` written in the change's folder under `ask.action.root`, with
`ask.action.detail.readiness` as the hash, only from the owner's own typed message); the retro as the
row `stop-retro-answers` says. `guard.mjs#classify` already lets the main session write `approval.md`
of any change folder.

**The change session goes on.** The change session never asks these: `session-next` gives it a
`held` action with `why: 'owner'` (D-6), it starts its background wait and ends its turn. When the
coordinating session writes the file, the wait's next poll sees another decision, exits, and its end
starts the change session's next turn. No message between sessions is needed.

The grill's ambiguous point (where the retro answers go) is resolved as (a): in the coordinating
session, so the owner answers every gate of a change session in one place.

## D-4 The triage agent and the source check (AC-5, AC-6)

**The agent.** New `plugins/core/agents/requirements-triage.md`. Frontmatter: `name:
requirements-triage`; `description`: "Read-only first pass over a grill's questions: answers each
question the project's files settle (ADRs, rules, specs, roadmap lines, earlier requirements, code),
with the source of every answer, and passes on the rest to the owner. Use when the requirements-grill
skill has drafted questions for a change, in a lone /devkit change or a roadmap run."; `tools: Read,
Glob, Grep`; `model: sonnet`. Body sections Receives (the change id, its request, the drafted
questions, each with its axis), Method, Returns, Never. Returns one block per question:
`answered: <answer> (source: \`<path>[:<line>]\`)` or `owner: <why nothing written settles it>`; a
question that changes what is delivered and that no file settles is always `owner`. Never: write or
edit any file, answer from its own judgement, write or suggest a plan approval or a retro answer.
With no write tool and no Bash it cannot write a file; `approval.md` refuses any subagent anyway
(`guard.mjs#writeViolation`).

**Where it runs.** `requirements-triage` joins the `helpers` of the `requirements` stage of the
`devkit` and `devkit-lite` flows as their version 2, released by D-17: `flow.json` says `"version":
2` and is copied to `flows/2.json` in the four flow folders (`plugins/openspec/schemas/devkit/`,
`.../devkit-lite/`, and the copies under `openspec/schemas/`), its digest recorded in
`scripts/released-flows.json`; `flows/1.json` keeps the released version 1, without the helper.
(Phase 4 first wrote the helper into `flow.json` at version 1, before main's `change-version-pin`
made a released flow immutable; phase 8 raises the version.) `PACKS` in `change-loop.mjs` gains
`'requirements-triage': 'devkit-core'`, so the change-run hand-off lock (`handOffFor`) allows it for
a change whose flow lists it. In a roadmap run with a
session per change, RH6 of `roadmapAgentDecision` gains one exception, label `grill-helper`: a
hand-off whose brief (`BRIEF_OF`) names a change open on the roadmap and whose `subagent_type` is a
helper of that change's `requirements` stage, in the flow that change follows (`changeFlow`, its
pin), with no prefix or the pack's, is allowed and marks
nothing in flight. With no brief: `own-sessions`, as today; a change not open: `not-open`. A change
on flow 1 gets no triage at all (D-17).

**The skill.** `plugins/core/skills/requirements-grill/SKILL.md` gains step "2b. Triage first":
draft the questions of the four axes; hand them to `devkit-core:requirements-triage` with a prompt
whose first line is `Change <id> (<script> script), stage requirements: triage of the grill`; record
each `answered` under `### Answered by triage` as `<n>. [<axis>] <question> → <answer> (source:
\`<path>[:<line>]\`)`; ask the owner, one at a time, only the `owner` ones and those the triage
answered with no source. The Output block gains `**Answered by triage:**`. The Never list keeps
"answer a question yourself": the triage answers are the agent's, each with a written source. Since
D-17, step 2b runs only when the loop's `grill` action names `requirements-triage` in its `helpers`
(a change on flow 2); for a change on flow 1 the grill skips it and asks the owner every question,
as before this change.

**The source check.** `change-loop.mjs#triageUnsourced(text)` (exported, pure): the numbered or
bulleted items under the heading `### Answered by triage` that hold no `(source: `. The section runs
to the next heading of level 1 to 3 or the end of the file (an unterminated section is read to the
end); lines inside a fenced block (three or more backticks or tildes) are skipped, an unclosed fence
skipping to the end of the section; an item continues over its indented lines; no heading or an empty
section gives `[]`. `nextAction` passes `unsourced: triageUnsourced(requirements.md)` to `decide`; in
`planPart`, when the requirements stage passed and `unsourced` is not empty, the action is the grill
with `detail: { unsourced }`. Precedent: the loop already reads the grill's classification line
(`classificationFlags`).

**One reader of the section** (review round 1, architecture F2; one shared helper per mechanism).
The scan of `triageUnsourced` becomes `triageSection(text)` (exported, pure): `null` when no line
outside a fence matches `TRIAGE_HEADING` (`/^### Answered by triage[ \t]*$/`), else the section's
items as `triageUnsourced` reads them today. `triageUnsourced(text)` is `(triageSection(text) ?? [])`
filtered to the items with no `(source: `, unchanged in what it returns; `hasTriageSection(text)`
(exported) is `triageSection(text) !== null`. The periodic check (D-9 step 3) asks `hasTriageSection`
whether a change's `requirements.md` holds the triage, in place of its own regular expression, so a
heading inside a fenced block or with words after it is no section for the loop nor for the check. The
triage block of `change-loop.mjs` moves above the header comment of `decide`, so that comment sits on
`export function decide` again (code-quality nit F4); no behaviour changes.

**The rule's words.** `openspec/config.yaml` `rules.requirements` and the requirements instruction of
the four schema files read: "Ask the owner every question that nothing written settles; the
requirements-triage agent answers the others first, each with its source. Never answer a question
yourself." The instruction's first line names `Helpers: codebase-researcher, requirements-triage.`

## D-5 The grill and the plan pushed with the branch (AC-12)

`collectRoadmap` (session mode) adds `unpushed: { <id>: 'grill' | 'plan' }` for each open change in
its own session: `plan` when `approval.md`'s stage header says `passed` and `filesPushed(root, id,
['approval.md'])` is false; else `grill` when `requirements.md`'s header says `passed` and
`filesPushed(root, id, ['requirements.md'])` is false. `PLAN_FILES` = `requirements.md`,
`proposal.md`, `design.md`, `tasks.md`, `readiness.md`, `approval.md` and `specs/`, those present;
the `push --what plan` subcommand still commits and pushes all of them.

**The record of a plan push** (review round 1, code-quality F1). `approval.md` on `origin` is the record
that the plan was pushed: only the coordinating session writes it, from the owner's typed approval,
and the plan push carries it with the other plan files in one commit. So once the plan is pushed,
the implementer ticking `tasks.md` (or any later edit of a plan file in the change session) asks for no
second plan push, and the coordinating session's `git add` and `git commit` never meet the change
session's own commits of those files on every decision. An approval written again (`waiting-approval-again`,
then a new `approval.md`) is not on `origin`, so its plan is pushed once more. Rejected: comparing the
committed `tasks.md` while ignoring its ticks (a second reader of the tasks file's form), and a
`pushed` field in the run file (a new field for ADR 0013 decision 4, and lost by `--fresh`).
`filesPushed` (pure git, no network): every path has no `git status --porcelain` entry, and
`refs/remotes/origin/<branch>` exists and contains the last commit that touched each path; with no
`origin` remote, committed is pushed. Headers are read with `guard.mjs#parseStageHeader`.

`decideRoadmap` emits `{ change, kind: 'push', what, command, progressKey: 'push' }` for each
`unpushed` entry whose `after[id]` is not `push`, on any turn. `command` is
`['node', '<HOOKS_DIR>/roadmap-loop.mjs', 'push', '--change', id, '--what', what, '--lang', l]`.

New subcommand `push --change <id> --what grill|plan --lang <l>`: in the change's checkout (`locate`),
`git add -- <paths>`, then `git commit -m "docs(openspec): <grill|plan> of <id>" -- <paths>` when
something is staged, then `git push -u origin <branch>` when `origin` exists. Exit 0 with
`{ version, change, what, pushed }`; any git failure exits 3 with the reply `push-failed` ("The branch
of {id} could not be pushed: {error}. I try again at a later decision."). The session runs it and
then `next --after <id>=push`; `push` joins `SESSION_KEYS`.

## D-6 The change session's loop (AC-1, AC-8, AC-9, AC-10)

**`session-next --change <id> --lang <l> --load-limit <p> [--after <key>]`.** Prints `devkit-run: <id>`,
then `devkit-end: <id> <state>` when the action is an end of the change loop, then the JSON action,
as `change-loop.mjs next` does (same `loopOutput` shape), so the change-run locks read it. It calls
`sessionNext(cwd, id, { write: true, ... })`:

1. `action = nextAction(...)` with `after`, and with `budget: true` when the caller is `session-next`:
   `sessionNext` gains the option `budget` (default false), which `session-next` sets and `session-wait`'s
   poll and the stop lock's read-only call (`changeSessionStopDecision`) leave off; the coordinating
   session's reads never count (change-budget D-4). At the cap the action is the end
   `waiting-for-owner` with the why `waiting-budget`; its gate (`GATE_OF_WHY`) is `budget`, not in
   `ROADMAP_GATES`, so it stays in the change session: `sessionDecide` passes it through (of the
   branches below only **release** can match it, and only when its stage is outside the load stages),
   so a change stopped at its budget in a load stage keeps its place (as D-7 says for an owner gate
   there), and `session-next` prints it with its `devkit-end:` line, as `next` does.
2. Not a session-mode change (the run file has `changeSessions` false or no claimed ticket for `id`):
   the action, unchanged.
3. `sessionDecide(facts)` (pure), first match wins:
   - **owner**: the action's gate is in `ROADMAP_GATES` → `held`, `why: 'owner'`, the stage's own icon
     (its state `waiting-for-owner`, titled `🙋 <stage icon> <id>` as ADR 0017 decision 4 says),
     reply `session-held-owner` ("{id}: {gate} is asked in the roadmap session; this session goes on
     as soon as it is answered.").
   - **after**: the action's stage is a plan stage (flow `part` `plan`, not `requirements` or
     `approval`) and `waitsFor` (the first `after:` dependency of the change's line in the main
     checkout's `openspec/roadmap.md` not in `archivedOnDefault`) is set → `held`, `why: 'after'`, ⏳
     (D-11), reply `session-held-after` ("{id} waits for {after} to be archived before its plan.").
   - **merge-base**: the same plan stage, no missing dependency, `proposal.md` absent, and some
     dependency's archive folder (`openspec/changes/archive/*-<dep>`) is not in `HEAD`'s tree →
     `{ kind: 'session', step: 'merge-base', stage, detail: { command: ['node', '<HOOKS_DIR>/roadmap-loop.mjs',
     'merge-base', '--change', id, '--lang', l] }, progressKey: '<stage>/merge-base@<fingerprint>' }`.
   - **place**: the action is an `agent` or `session` action whose stage's flow `part` is `build` or
     `after` (implementation, unit-tests, e2e-tests, evidence, review) and `placed[id]` is absent →
     `placeDecision` (below). Claimed: the action. Not claimed: `held`, `why: 'place'` or `'load'`, ⏳
     (D-11), reply `session-held-place` ("{id} waits for a place: {places} changes are building.") or
     `session-held-load` ("{id} waits: the processor is at {load}% (limit {limit}%).").
   - **release**: the action's stage is not in those parts, or the action is the archived end, and
     `placed[id]` is set → the place is released (`placed[id]` and `queued[id]` deleted); the action.
   - otherwise the action.

The `held` action: `{ version, change, script, root, branch, filesLanguage, kind: 'held', held: { why,
gate?, after? }, stage, stageTitle, icon, sessionTitle, state, reply, progressKey: 'held/<why>' }`. It is no
end of the change loop: the loop's four ends (ADR 0010 decision 3) are unchanged, and no
`devkit-end:` line is printed for it. Like every action of `next` it carries its state (ADR 0017
decision 1): `state = changeState(a, runFactsOf(heldRun, id, { onRoadmap: true }), { lang })`, where `a`
is the change loop's action and `heldRun` is `{ changeSessions: true, startedSessions: { [id]: { at: now } },
placed, queued, waitsFor: { [id]: waitsFor } }` with `placed` and `queued` as they are after this
decision (a claimed change session of a run with a session per change). `sessionTitle` is
`state.title`; `icon` is `state.stateIcon` when the state's reason is a held one (⏳), else
`state.stageIcon`. `sessionDecide` builds no title and names no icon of its own (D-11). The actions
that are not `held` keep the `state` and `sessionTitle` `nextAction` gave them.

**`placeDecision({ id, places, placed, queued, load, limit, anyway, now })`** (exported, pure; the one
place rule, also used by the check, D-9): `free = places - count(placed)`; `ahead` = the queued
entries other than `id` with an earlier `at`; claim when `free > ahead` and (`load < limit` or `id` is
in `anyway`). A claim writes `placed[id] = { at }`, deletes `queued[id]` and removes `id` from
`anyway`; a refusal writes `queued[id] = { at: queued[id]?.at ?? now, why }`. It runs inside
`updateRun`, on the file as read under the lock: `sessionNext` decides once on the file as first
read and, when that decision would write, decides again on the file as read under the lock and writes
that second decision, so two change sessions never take the same last place (pinned by a test that
changes the file between the two reads through the injected `lockSleep`, task 7.1; review round 1,
test-coverage F2).

**`session-wait --change <id> --lang <l> --load-limit <p> [--interval <s>] [--session <sid>]`.**
`waitLoop` with `poll = () => sessionNext(..., { write: true })` and `waiting = (a) => a.kind ===
'held'`; it exits when the decision changes and prints the new action (the same output as
`session-next`). While it lasts it is recorded in `waits[id]` (D-9) with `kind: 'session'`, cleared at
its end, also on error. `waitLoop` gains two optional parameters, `waiting` (default the GitHub
predicate) and `failWhy` (default `github-unreadable`; `unreadable` here); its existing tests run
unchanged. The default interval is 60 s.

**The stop of a change session.** `guard.mjs#lock`, mode `stop`, when no roadmap run is found, calls
`roadmap-loop.mjs#changeSessionStopDecision(input, { env, events })`: with a change run (`runOf`) whose
ticket the run file records as claimed by `input.session_id`, a read-only `sessionNext(..., { write:
false })` that gives `held` → `allow('held')`; every other case → `change-loop.mjs#stopDecision`
(unchanged). Any error → `stopDecision`. The hand-off and subagent locks of a change session are
unchanged.

**The `merge-base` subcommand** (`merge-base --change <id> --lang <l>`): in the change's checkout,
`git fetch origin --quiet`, then `git merge --no-edit origin/<defaultBase>`; on a conflict `git merge
--abort` and exit 3 with the reply `blocked` and `why: 'base-conflict'` (new `blocked-why.base-conflict`:
"the default branch could not be merged into it: {error}"). The change session declares that end
with `change-loop.mjs reply blocked --param id=<id> --param why=base-conflict --param error=<the JSON's error field>`,
shows its reply and ends the run; the skill's Loop item 3 says so in those words (review round 1,
spec F1: the skill did not, so no `devkit-end: <id> blocked` line was recorded and the next
`session-next` handed the merge again). `mergeBaseCmd` runs git through the file's `gitIn`, its local
copy of the same helper removed (architecture nit F3; no behaviour changes). Every failure of
`git merge` keeps the label `base-conflict` (code-quality nit F7): left as it is, since the reply
carries git's own error and a dirty tree in a change session is itself a defect to look at.

**The skill.** `devkit-session/SKILL.md`, sections `## Settings` (as the devkit skill's: the person's
language, the load limit, only the last message reaches the owner), `## The change` (the id of the
first message's `devkit-start:` line; before the first question this session asks the owner, two or
three sentences on who started it, why and what it does), `## Loop`, `## Never`. The Loop:

1. Run `node <skill-dir>/../../hooks/roadmap-loop.mjs session-next --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit}`, adding `--after` and the `progressKey` after every `agent` or `session` action.
2. When `sessionTitle` is present and differs from the title last set, load `select:mcp__ccd_session_mgmt__set_session_title` and call `mcp__ccd_session_mgmt__set_session_title` with `session_id` `"self"` and `title` the action's `sessionTitle`, from the main thread, before carrying out the action; a refused rename is not retried for the same `sessionTitle` (moved from item 1a of the devkit skill's Loop).
3. Carry out the action as item 2 of the `## Loop` of `<skill-dir>/../devkit/SKILL.md` says for its kind, with these differences: `held`: start `node <skill-dir>/../../hooks/roadmap-loop.mjs session-wait --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit} --session ${CLAUDE_SESSION_ID}` with the Bash tool's background option, say `reply`, end the turn, and when the wait ends run step 1 again; a `merge-base` step runs `detail.command`, and when it exits 3 runs `node <skill-dir>/../../hooks/change-loop.mjs reply blocked --param id=<id> --param why=base-conflict --param error="<the JSON's reply field>" --lang ${user_config.language}`, shows its reply and ends the run; `waiting-on-github` starts `node <skill-dir>/../../hooks/roadmap-loop.mjs wait --change <id> --lang ${user_config.language} --load-limit ${user_config.load_limit} --session ${CLAUDE_SESSION_ID}` in the background (recorded in `waits`, D-9).
4. The turn that archives the change ends with the line `devkit roadmap: <id> archived`.

Never: ask the grill, the plan approval or the retro answers here; write `approval.md` or a retro
answer; create a schedule; start a session; take a place by hand.

**The devkit skill** keeps its typed `/devkit change` loop, and its item 1a becomes: "In a session a
roadmap run started (its first message begins with `Background (from the session that started this
one):` and holds a `devkit-start:` line), call the Skill tool with `devkit-openspec:devkit-session`
and follow it in place of this Loop." This covers an owner who types `/devkit change <id>` in such a
session.

**The started session's brief.** `sessionBackground` is rewritten: "This session runs the devkit
change `<id>` for a `/devkit roadmap` run. The owner typed that command in the session `<coordinator>`,
which started this one: in the desktop app every change of a roadmap run has a session of its own
(ADR 0014, ADR 0020). Start at once, with no message from the owner: call the Skill tool with
`devkit-openspec:devkit-session`; the devkit skill itself runs only from the owner's typed command.
Work only in `<root>`, the change's worktree, on branch `<branch>`. The grill, the plan approval and
the retro answers are asked in the session that started this one. Before your first question to the
owner, say in two or three plain sentences, in the owner's language (<lang>), who started this
session, why and what it will do. Keep this session's title as the `sessionTitle` of each step,
renaming it yourself as the skill says. The report that ends each of your turns returns to the
session that started this one: when the change is archived, end that turn with the line `devkit
roadmap: <id> archived`."

## D-7 Places count only the load stages (AC-9)

The place rule is D-6's `placeDecision`; the load stages are the stages whose flow `part` is `build`
or `after`, read from the change's own script (`readFlow`), so a stage a later script adds to those
parts holds a place with no code change. A change keeps its place in those stages whatever its state
(running, blocked, at an owner gate there), and leaves it when its stage is in another part or it is
archived. Lowering the number interrupts nothing: `placed` entries above it stay until they leave.

**A change that is no longer open holds no place** (review round 1, architecture F1). A change whose
line leaves the roadmap, is ticked, is archived or is moved to the previous script never reaches its
`release` branch when its session is gone, so its entries are pruned by the coordinating session:
`pruneRecords(run, openIds)` (in `roadmap-loop.mjs`, one helper), in a run with `changeSessions`,
deletes every `placed` and `queued` entry whose id is not an open line. `decide()` calls it under the
run file's lock beside the pruning of `startedSessions` and `tickets` (D-9), and `checkCmd` calls it at
the top of its own locked update, before it hands freed places (D-9 step 2), so the firing that
follows such a change already counts its place as free and nothing queued behind it waits for it.
`anyway` is not pruned: it gives no place by itself and is used up by a claim. A run without a
session per change keeps the records as they are (`roadmap-loop run: U4 ...` keeps passing unchanged).

**Start anyway.** In session mode, `next --start-anyway` (the owner's own typed message, item 4a)
records `anyway` = the ids in `queued` with `why: 'load'` at that moment; `placeDecision` consumes an
id when it claims. A change queued later is held again. `anyway` holds nothing that starts a later
change.

**Enforcement.** The change session follows `session-next`; its stop is allowed while held (D-6).
No hook refuses a hand-off to the implementer without a place (Non-Goals; Risk R-4).

## D-8 The plan after the dependencies, against the code of that day (AC-8)

D-6's `after` and `merge-base` branches. `waitsFor` reads the roadmap of the main checkout
(`mainRoot`), the one the coordinating session reads, and `archivedOnDefault` (GitHub, the remote ref,
the local default branch, the main checkout). The merge brings the dependencies' code and their
archive folders into the branch, so the planner, handed next, reads the default branch of that day.
A change with no `after:` line writes its plan right after its grill.

## D-9 The periodic check and the cleanup (AC-13, AC-14, AC-15)

**Scheduling.** Item 1 of the Roadmap section loads `select:CronCreate` with the start tool; when it
loads, `run` gets the flag `--cron` (recorded as `cron: true`). While `cron` is true, the run is not
stopping and the run file records no check, `decideRoadmap` emits
`{ change: null, kind: 'schedule-check', input: { cron: '13,43 * * * *', prompt, recurring: true },
progressKey: 'schedule-check' }`, on any turn, in both modes. `prompt` (built by `checkPrompt(lang,
limit)`) is one paragraph that starts with `devkit-roadmap-check:` (never with `/`, so `typedOf` reads
no command and the run goes on) and says: run `node <HOOKS_DIR>/roadmap-loop.mjs check --lang <l>
--load-limit <p>` and carry out its actions as the devkit skill's "The periodic check" says; approve no
plan, answer no retro, start no stage. The session calls `CronCreate` with the action's `input`
exactly, then runs `next --check-id <job id>` (records `check: { id, at }`), or `next --check-refused`
when the call returns no id (records `check: { refused: true, at }`, line `roadmap-check-refused`, no
retry in that run). `run` from another session resets `check` (a session cron dies with its
session); `--fresh` too. The minutes 13 and 43 avoid :00 and :30. The host's session cron is
session-only, fires only while the session is idle, may fire up to half its period late, and a
recurring job expires after 7 days (one last firing, then it is deleted); `durable` has no effect and
is not passed.

**Keeping the check alive.** A run can outlive 7 days, so on every turn the owner typed and on every
firing, before `next` or `check`, the session loads `select:CronList` and calls `CronList`. When the
decision JSON's `check` field (the recorded job id, added to the output of `run`, `next` and `check`)
names an id the list lacks, the call gets `--check-gone`, which sets `check` to null unless it records a
refusal; the same decision then emits `schedule-check` again. A refusal recorded by `--check-refused`
is never retried in that run.

**The firing.** A turn whose prompt begins with `devkit-roadmap-check:` is an `event` turn. The
session runs `check --lang <l> --load-limit <p>`. `checkCmd` reads the facts (`collectRoadmap`), and,
under the run file's lock:

1. **Stale waits.** `staleWaits(waits, { open, archived })` (exported, pure): every recorded wait of a
   change that is not an open line, or is archived; for each change and kind, every entry older than
   the newest. Each stale entry whose process is still a wait loop of the run gets `SIGTERM`
   (`process.kill`; an error counts as already gone), and every stale entry is dropped; an entry whose
   process is gone, or is no longer a wait loop, is dropped (`waitAlive`).
   **A recorded pid is checked before it is signalled** (review round 1, code-quality F3; this revises
   the first plan's "each stale pid gets SIGTERM", which had no identity check). After a reboot or a
   long run the operating system may hand a recorded pid to an unrelated process of the owner.
   `isWaitProcess(pid)` (exported from `roadmap-loop.mjs`) reads the process's command line with
   `ps -o command= -p <pid>` (`execFileSync`, no shell, a 2-second timeout) and is true only when it
   matches `/roadmap-loop\.mjs\s+(?:session-)?wait(?:\s|$)/`, the form of the `wait` and `session-wait`
   commands the skills start; any error of `ps` (no such process, no `ps` on the system) gives false.
   `waitAlive(w)` is `watchAlive(w) && isWaitProcess(w.pid)`. `killWaits(entries)` signals only an
   entry for which `isWaitProcess` holds and returns how many it signalled; the others are spared.
   Every caller drops the entries it was given from the record whether signalled or spared (`checkCmd`
   here, `tidyWaits` at an end, D-9 "The end"), so a pid that is not a wait is spared once and
   forgotten. `watchAlive` itself is unchanged: the load watch (`holding`) keeps its own reading.
2. **A freed place.** `pruneRecords` first (D-7), then, for the queued ids in `at` order,
   `placeDecision` claims while it can. A claimed
   change's own `session-wait` sees `placed[id]` at its next poll and its session goes on; a claimed
   change with no live wait gets the line `roadmap-check-idle` ("{id} has a place but its session is
   not watching: type any message in it.").
3. **The decision.** `decideRoadmap` on the facts with `turn: 'event'`, so no session starts; plus
   `triage` actions: `{ change, kind: 'triage', root, progressKey: 'triage' }` for each change whose
   action is the grill, whose grill action names `requirements-triage` in its `helpers` (a change on
   flow 2, D-17), that is not `ask.change`, and whose `requirements.md` has no triage section by
   `change-loop.mjs#hasTriageSection` (D-4, the loop's own reader: a heading inside a fenced block or
   with words after it is no section).

`check` prints each of its own lines once per state, before the decision's: `roadmap-check-stopped-waits`
when step 1 signalled at least one wait loop, `roadmap-check-idle` for each change given a place with no
live wait (step 2), and the decision's `roadmap-check-archive-later` line (below). The spec scenarios
"Wait loops stopped", "A place given to a session that is not watching" and "An archive not done yet"
of `roadmap-coordination` name these three lines (review round 1, spec nit F3).

`check` prints `devkit-roadmap: <n>` and the decision's JSON (lines, actions, ask, end), like `next`.
Its lines are emitted once per state (`announced`). The session carries out `triage` by running the
triage step of the `requirements-grill` skill for that change only, writing its `### Answered by
triage` section and asking the owner nothing; `archive-session` as below; any `session-start` never
comes (event turn). When the call printed no line and no `end.reply`, the turn ends with no message.
The check writes no `approval.md`, no retro answer, hands no stage and starts no session: its action
kinds are only `triage`, `archive-session`, `push` and `delete-check` (`check: its actions` test).

**Archiving sessions.** The owner agreed on 2026-11-22 (grill question 5) that a roadmap run archives
the sessions of its archived changes; ADR 0020 records that standing agreement, which is what the
tool's rule (archive only with the owner's explicit agreement) rests on. The app may still ask the
owner to approve each call, except in auto or bypass permission mode, and it does not archive a
session that is still working (mid-turn, or with live background work).

`startedSessions` and `tickets` entries of a line in an archived class are kept (today `decide()`
deletes every entry whose line is not open) until the session reports `--after <id>=session-archived`;
an entry is still deleted when its line leaves the roadmap. Every decision in session mode, the
check's included, first kills the recorded waits of each archived change (they are stale by
`staleWaits`, so live background work no longer blocks the archive), then emits `{ change, kind:
'archive-session', cwd, title, input: { reason }, progressKey: 'session-archived' }` for each kept
entry of an archived line whose `after[id]` is not `session-archive-later`; `reason` is "devkit
roadmap: <id> is archived". The session calls `mcp__ccd_session_mgmt__list_sessions` with `{ "linked":
true }`, takes the row not archived whose `cwd` equals the action's `cwd` or whose `title` ends in the
change id, calls `mcp__ccd_session_mgmt__archive_session` with `{ session_id: <that row's id>, reason }`,
and runs `next --after <id>=session-archived` (also when no row matches). A refusal, a pending
approval or a session still working is no error: the session runs `next --after
<id>=session-archive-later`, which keeps the entry, asks for no other archive of that change in the
same decision, and emits the line `roadmap-check-archive-later` ("The session of {id} is not archived
yet: it is still working or waits for your approval; I try again later.") once per state; the next
firing or the run's end tries again. `session-archived` and `session-archive-later` join
`SESSION_KEYS`.

**Recording the waits.** `roadmap-loop.mjs wait` and `session-wait` take `--session <sid>` and record
`waits[id]` entries `{ pid: process.pid, kind: 'github' | 'session', at, session }`, removing their own
entry at their end, also on error. The devkit-session skill uses `roadmap-loop.mjs wait` for its GitHub
waits (D-6), so every wait of a change session is recorded.

**The end.** When `decideRoadmap` returns an `end` in a run that records a check or kept sessions, the
end is computed without the cleanup actions, and these are added after it: `delete-check` (`input: {
id }`) when `check.id` is set; `archive-session` for each kept entry of an archived line; and
`stop-own-tasks` when the end is `done` or `stuck`. In `decide()`, an end `done` or `stuck` kills every
recorded wait (`killWaits`); an end `stopped` kills only `staleWaits`. `killWaits` spares a pid that is
no longer a wait loop (step 1), and the entries leave the record all the same. The session calls `CronDelete`
with the action's `input`, then `next --check-deleted` (records `check: null`), also when the job is
already gone (expired after 7 days, or its session's cron list lacks it): a missing job is no error.
For `stop-own-tasks` it stops each background task it started for the run with `TaskStop`. The waits
are killed before the `archive-session` actions are carried out. An archive still refused at the end
is said by `roadmap-check-archive-later` and left to the owner. The stop lock refuses the turn's
end while a cleanup action is left, once per state, so the cleanup runs.

**The devkit skill.** The Roadmap section gains "### The periodic check" (scheduling, the firing, the
cleanup, the never-list of the check). The Never item becomes: "Create a cron or any scheduled
wake-up, except the one periodic check of a roadmap run that `roadmap-loop.mjs` asks for, which only
the run's end deletes." No section before `## Roadmap` names `CronCreate`.

## D-10 Drift without the owner (AC-11)

- **ADR numbers.** `conduct-check.mjs#deliveryRow` gains an override, first in the chain and
  before `releaseConflict` (main's release-merge-conflict removed `rewrittenBranch`): `adrClash(ctx, row)`. `ADR_DIRS = ['docs/adr', 'docs/decisions']`. The
  files the branch added since `git merge-base <ctx.ref> HEAD` (`git diff --name-only
  --diff-filter=A`) that match `<dir>/NNNN-*.md`; the files of the same folder on `ctx.ref` (`git
  ls-tree --name-only`). A clash is a branch file whose number a different base file has. Each
  clash, in number order, gets the next free number above the highest on the base and on the branch.
  Step `renumber-adr` with `{ files: [{ from, to, number }] }`, actor `devkit-core:tdd-implementer`
  (`SUBAGENT` map), message "an ADR number the base took: renumber <from> to <to> and every
  reference". `change-loop.mjs` `ROWS` gains `'renumber-adr': handOff('implementation',
  'tdd-implementer')`, so in a change session it is a load stage. A `ctx.ref` that does not resolve
  gives no override.
- **Release versions.** Unchanged: the `resolve-release-conflict` step already resolves a conflict in
  release files only, without the owner (`release-merge.test.mjs`, `conduct-check.test.mjs`); the
  merge mode of round 17e is out of scope.
- **A contradicted requirement.** The proposal instruction of both `devkit` schema copies and
  `plugins/core/agents/change-planner.md` gain: "When code merged since the grill contradicts what a
  requirement says, write no plan file: add the question under `## Reopened` in `requirements.md`, set
  its header to `result=pending` with the attempt one more, and return. Resolve every other drift (an
  ADR number, a release version, a moved file) in the plan without asking." `flow-check` then names
  the requirements stage first, and the loop gives the grill (asked in the coordinating session in a
  run with a session per change).

## D-11 The held state, the board and the messages (AC-3, AC-9, AC-10)

**One derivation (ADR 0017 decision 1).** A change session held for a place, the load or its
dependencies is a state `running` with a reason, derived only by `change-loop.mjs#changeState`; the
change session's `held` action (D-6), the `state` command (`stateEntries`) and the board (`stateRow`)
read that state and nothing else for it.

- **The facts.** `runFactsOf(run, id, { onRoadmap })` gains three fields: `queued` (`run.queued?.[id]
  ?? null`), `placed` (`Boolean(run.placed?.[id])`) and `waitsFor` (`run.waitsFor?.[id] ?? null`). `run`
  is, as before, `readRun`'s result or the board's facts, which carry `queued`, `placed` and the
  `waitsFor` map of `collectRoadmap`; `stateEntries` and `sessionDecide` add a `waitsFor` map of their
  own (below).
- **The reasons.** `change-loop.mjs` exports `HELD_TEXT = { 'held-place': 'queue.held-place',
  'held-load': 'queue.held-load', 'held-after': 'queue.held-after' }` beside `STATE_ICON`: the held
  reason codes and the message key of each one's phrase. `changeState` gains one rule after its S1 to
  S8 chain, S9: when `facts.sessionMode` and the state so far is `running` (with no reason or the
  reason `ready`), a `facts.queued` entry with `facts.placed` false gives the reason `held-load` when its
  `why` is `load`, else `held-place`; else a `facts.waitsFor` gives `held-after`. The reason's text is
  `render(lang, HELD_TEXT[code], { after: facts.waitsFor })`. Every other state (waiting for the owner,
  on GitHub, blocked, archived) keeps its own reason and title: a held reason only ever replaces
  `running`. It replaces `ready` too, as the board already placed those rows (a change with no
  session whose dependency is not archived was a `queue.held-after` row before this revision).
- **The held icon, decided once.** In `changeState`'s title rule, a `running` state whose reason is
  in `HELD_TEXT` gets `stateIcon = WAIT_ICON` and `title = sessionTitle(WAIT_ICON, id)`: ⏳ and the
  id, the stage icon replaced (AC-10); `stageIcon` still names the stage's icon. `WAIT_ICON = '⏳'`
  stays exported beside `STAGE_ICON`, and `changeState` is its only reader. A wait on GitHub keeps
  `⏳ <stage icon> <id>` (ADR 0017 decision 4): the two read apart by the stage icon beside it. The
  owner's gates held for the coordinating session keep ADR 0017's `🙋 <stage icon> <id>`. The stage
  icons are unchanged.
- **The `held` action** (D-6) carries `state`, and its `sessionTitle` and `icon` come from it;
  `sessionDecide` no longer calls `sessionTitle` nor imports `WAIT_ICON`.
- **The state command.** `stateEntries`, for an id that is a line of the roadmap in a run with
  `changeSessions`, passes `runFactsOf({ ...run, waitsFor: { [id]: w } }, id, { onRoadmap: true })`,
  where `w` is the first `after:` dependency of the line not in `archivedOnDefault` when
  `isPlanStage(start, id, action)` holds, else null. `queued` and `placed` come from the run file. So
  `state --change <id>`, `session-next`'s `held` action and the board give the same state for a held
  change (change-state's "The state is the loop's own decision" and "The board and the command
  agree").
- **One plan-stage reader.** `PLAN_NOT_HELD`, `partOfStage(found, id, stage)` and `isPlanStage(start,
  id, action)` move unchanged from `roadmap-loop.mjs` to `change-loop.mjs` (exported; `roadmap-loop.mjs`
  imports them), so `collectRoadmap`'s `waitsFor`, `sessionFacts` and `stateEntries` read a plan stage
  the same way (`roadmap-loop.mjs` imports `change-loop.mjs`, never the reverse).

**The board.** `boardOf`, session mode: an `own` entry at a roadmap gate → the owner block with
`gate.<gate>` (the state's reason, as change-state placed it); a held one → the queue block with the
state's reason text, which is `queue.held-place` ("open, waits for a place"; Portuguese `aberta,
espera uma vaga`), `queue.held-load` ("open, held by the load"; Portuguese `aberta, segurada pela
carga`) or `queue.held-after` ("open, waits for {after}"; Portuguese `aberta, espera {after}`); else under
way as change-state places it. `stateRow` maps the held reasons through one table entry beside
`BLOCK_OF_STATE`: a `running` state whose reason code is in `HELD_TEXT` → `['queue', s.reason.text]`;
its own reads of `f.queued` and `f.waitsFor` go. Every row's words stay the same for the same facts.
`collectRoadmap` keeps adding `waitsFor` for open lines (through `isPlanStage`) and passing `queued`
and `placed`.

**New message keys**, in `en` and `pt-BR`, none holding a stage, role or step id, a file name, a
script name or an option: `roadmap-session-opened`, `session-held-owner`, `session-held-place`,
`session-held-load`, `session-held-after`, `push-failed`, `blocked-why.base-conflict`,
`roadmap-check-refused`, `roadmap-check-idle`, `roadmap-check-stopped-waits` ("{n} wait loops of the run
were stopped: their changes no longer need them."), `roadmap-check-session-archived` ("The session of
{id} was archived."), `roadmap-check-archive-later` (D-9), `queue.held-place`, `queue.held-load`, `queue.held-after`. The existing test
`change-loop messages` family checks both languages hold the same keys.

## D-12 The ADR (proposed as ADR 0020)

The ADR takes the next free number on `origin/main` when the change merges main; 0016 (stage-roles),
0017 (change-state) and 0018 (delivery-models) are taken, and a sibling may take 0019 first (ADR number
at merge). Written by task 6.2 into `docs/adr/0020-a-roadmap-run-opens-every-change-at-its-start.md`
(the path follows the number):

> # ADR 0020: A roadmap run opens every change at its start, runs each change session on the run's ticket, and keeps one periodic check while it lasts
>
> - Status: accepted
> - Date: 2026-11-22
> - Change: roadmap-sessions-upfront
> - Accepted by: the owner, on `<date>`, in the message that approved the plan of the change: `Aprovo`; recorded in `openspec/changes/roadmap-sessions-upfront/approval.md`
> - Amends: ADR 0004 (0004-devkit-per-project.md), its decision that the hooks block nothing outside
>   a devkit project, for the entry skill of a change session only; ADR 0006
>   (0006-phases-as-child-sessions.md), decision 3, for a roadmap run only; ADR 0010
>   (0010-openspec-as-the-harness.md), decision 2, where the host can start sessions, and decision 8's
>   sentence "the owner's gates (grill answers, plan approval, retro answers) stay the owner's", for
>   the grill answers the project's files settle; ADR 0011
>   (0011-the-change-coordinator-is-the-owners-session.md), decision 2; ADR 0013
>   (0013-the-roadmap-coordinator-is-the-owners-session.md), decision 4; ADR 0014
>   (0014-each-roadmap-change-runs-in-a-session-of-its-own.md), decisions 1 to 4; ADR 0017
>   (0017-a-change-state-is-derived-in-one-place.md), decision 4, the title of a held change session
>
> ## Context
>
> On 2026-11-22 every ready change of a run was opened by hand, each in a session of its own. A
> session the coordinating session started could not run the devkit skill until the owner typed
> `/devkit change <id>` in it: the skill declares `disable-model-invocation: true`, and a message from
> another session is no go-ahead. Ten changes would mean ten typed commands. ADR 0014 decision 1 put
> each change's owner questions in its own session, and ADR 0010 decision 2 starts a change only when
> its dependencies are archived and a place is free, so grills came one at a time. The same run left
> about 30 stale wait loops that kept the app from archiving finished sessions. The owner decided in
> the grill of `roadmap-sessions-upfront`: a change session must start running with no typed command;
> every pending change opens at the start; the grills, plan approvals and retro answers are asked in
> the coordinating session, a triage agent answering what the files settle; places count only the
> stages that load the machine; and the run keeps temporary schedules that it cleans up at its end.
> ADR 0017 has since derived each change's state in one place and titled a stopped change session
> with its state icon beside its stage icon; a change session that waits in itself needs a state and a
> title of its own.
>
> ## Decision
>
> 1. A roadmap run that starts a change session writes a one-use ticket for that change into its own
>    bookkeeping and into the session's task, below `/devkit change <id>`. A model-invocable entry
>    skill runs the change's loop from the session's first turn. A hook on the Skill tool lets it run
>    only when the session's first message is the host's started form carrying a ticket the run
>    recorded for that change and no other session claimed; the first session claims it. Any other
>    call is refused, and the hook refuses when it cannot read, because its refusal still leaves the
>    owner's typed command. The devkit skill stays owner-only. The hook acts whatever the project's
>    opt-in, an exception to ADR 0004: it refuses only a call of the entry skill, which exists only for
>    a roadmap run and finds no ticket outside one, and lets every other skill through without reading
>    anything else, so a project that did not choose devkit meets no gate it would notice.
> 2. Where the host can start sessions, the first decision on the owner's typed turn opens every
>    unticked, unarchived roadmap line and starts its session. The run's number counts only the changes
>    whose current stage is the implementation, a test stage, the evidence or the review. A change
>    waits for a place, for the load or for its dependencies in its own session, through a background
>    wait of that session. No plan file is written before its `after:` dependencies are archived; the
>    change then merges the default branch before its plan.
> 3. The coordinating session asks the grill, the plan approval and the retro answers of every change
>    session, one change at a time, and writes each answer into that change's files; the change
>    session goes on when its wait sees the file change. Every other owner gate stays in the change
>    session. The coordinating session hands no stage; it may hand the grill's triage agent. In every
>    grill, a lone `/devkit change` as much as a roadmap run, a read-only triage agent answers first the
>    questions the project's files settle, each answer with its source, and the rule of
>    `openspec/config.yaml` and of the schemas says so. This amends the sentence of ADR 0010 decision 8
>    that the grill answers stay the owner's for those answers only: the owner still answers every
>    question nothing written settles, every question that changes what is delivered, and every plan
>    approval and retro answer.
> 4. While a roadmap run lasts, the coordinating session holds one session cron, about every 30
>    minutes. A firing has the triage answer ahead, hands a freed place to the first waiting change,
>    stops the run's stale wait loops, archives the sessions of archived changes, and speaks only when
>    something changed. It never writes a plan approval or a retro answer, hands a stage or starts a
>    session. The host expires a recurring session cron after 7 days, so the run reads the session's
>    cron list on every typed turn and every firing and creates the check again when it is gone. The
>    run's end deletes the cron (a cron already gone is no error), stops the run's wait loops and
>    archives the sessions of archived changes. The owner agreed on 2026-11-22 (grill question 5)
>    that the run archives the sessions of its archived changes: that standing agreement is what each
>    archive call rests on; the app may still ask per call, and a refused or pending archive is tried
>    again later. A lone `/devkit change` schedules nothing.
> 5. While a change session waits for a place, the load or its dependencies, its change's state is
>    `running` with the reason of that wait, derived where ADR 0017 derives every state, and its title
>    is ⏳ and the change id, the stage icon replaced; once it goes on, the title is its stage's again.
>    This amends ADR 0017 decision 4 for a held change session only: a wait on GitHub keeps ⏳ beside
>    the stage icon, and the owner's gates keep 🙋 beside it.
> 6. The run's bookkeeping also holds the start tickets (`tickets`), the places held (`placed`), the
>    changes waiting for one (`queued`), the start-anyway of the moment (`anyway`), the wait loops
>    under way (`waits`), whether the host offers a session cron (`cron`) and the periodic check
>    (`check`).
> 7. A change whose ADR number the default branch gave another record since the change began has
>    it renumbered by the implementer, as a delivery step, without asking the owner: the next free
>    number, and every reference to it.
> 8. The change session's own loop (its next step, its wait, its place, its merge of the default
>    branch, its push and its stop) lives in the roadmap coordinator's script beside the run's
>    bookkeeping it reads, and the change loop never imports that script. If that script keeps
>    growing, splitting the change session's loop into a module of its own is a follow-up, not a new
>    decision.
>
> ## Consequences
>
> - Positive: a run needs one typed command; every grill is answered up front in one session, the
>   triage taking the questions the files settle; the machine runs at most the number of building
>   changes while plans go on; nothing the run started outlives it.
> - Negative: a model-invocable skill exists for the change loop (Mitigated: the hook refuses it
>   without the run's unclaimed ticket, and fails closed). The entry depends on the host's started
>   form and on the Skill tool reaching a PreToolUse hook, neither documented (Accepted: a wrong
>   reading refuses, and the owner types `/devkit change <id>`). Each change session polls its files
>   once a minute while it waits (Accepted: a sleeping process per session, recorded and stopped when
>   stale). A schedule exists again, for a roadmap run (Mitigated: one per run, deleted at its end,
>   and it starts nothing the owner must allow). Reading every open change's action makes a
>   coordinating decision slower with many changes (Accepted; the Stop hook does not read them). The
>   entry's hook runs in projects that did not opt in (Mitigated: it decides only for the entry skill,
>   with no import for any other). The triage answers part of a grill (Mitigated: each answer names its
>   source, an answer with none sends the change back to its grill, and a question no file settles
>   reaches the owner). A process that took a recorded wait's number is never signalled (Mitigated: the
>   run checks the process's command line first).
>
> ### Review trigger
>
> The host documents a way to start a session already running a skill, or a message between sessions
> that counts as the owner's; the Skill tool stops reaching PreToolUse hooks; the started form
> changes; a firing of the check is found writing an approval or a retro answer, or starting a stage;
> a run leaves a cron, a wait loop or an archived change's session behind.
>
> ## Alternatives considered
>
> | Option | Pros | Cons | Cost to undo |
> |---|---|---|---|
> | Drop `disable-model-invocation` from the devkit skill | One skill | Any session could start a run on its own, which AC-2 forbids | low |
> | The grills in the coordinating session and the change session opened only after them | No entry needed for the grill | Still a typed command per session for the plan and the code | low |
> | A message from the coordinating session as the go-ahead | No hook | ADR 0011: only the owner's own message is a go-ahead; no message tool is in use (ADR 0014 rejected it) | low |
> | Places counted over open changes, as before | No new field | Grills and plans wait for building changes; the owner asked otherwise | low |
> | A timer that retries a refused session start (ADR 0014 rejected it) | Starts without the owner | The app refuses a start on a turn nobody typed; the periodic check starts nothing and leaves a refused start to the owner's next message | low |
> | A hook that refuses an implementer hand-off without a place | A hard lock | More hook code over the run file in a 10-second hook; the loop and the stop lock already hold the rule | low |
> | A cron per change session | Each session wakes itself | Many schedules to clean up; the background wait already wakes it | medium |

**Rejected alternatives this ADR takes up or answers.** ADR 0011 rejected "A hook that fails closed"
because it would trap a session; the entry fails closed because a refusal traps nothing (the owner's
typed command still runs the change). ADR 0014 rejected "A retry on a timer" (a cron that retries a
start the app refuses); the check retries no start. ADR 0006 decision 3 and ADR 0014 decision 2 ("Nothing
is scheduled") are amended for a roadmap run only; `/devkit change` stays unscheduled. ADR 0014
rejected "A change session messages the coordinating session"; nothing here sends a message.

**Notes and header lines** (task 6.2, revised by task 7.9 after review round 1; `<file>` is the ADR's file name, and a link quoted in backticks is written in the ADR as a plain Markdown link):

- ADR 0020 itself (task 7.9, review round 1, adr-reviewer F1 to F4 and architecture nit F4): the
  status line becomes `- Status: accepted` and an `- Accepted by:` line follows the `- Change:` line,
  in the form ADRs 0016 to 0018 use, with the date and the owner's words read from this change's
  `approval.md` as the owner writes it for this revised plan (`<date>` above is that file's `Date`);
  the Amends line, decisions 1 and 3, decisions 7 and 8 and the Consequences gain the text quoted
  above. Nothing else of the ADR changes.
- ADR 0004 (new, review round 1, adr-reviewer F3): header `- Amended by ADR 0020 (<file>)` after the
  `- Change:` line; Note at the top of Context, before the coordinator-field-fixes Note: "Note
  (roadmap-sessions-upfront, 2026-11-23): the hook on the Skill tool acts whatever the project's opt-in
  (`[ADR 0020](<file>)`, decision 1): it refuses only a call of the `devkit-session` skill, which
  exists only for a roadmap run, and lets every other skill through. Every other hook still blocks
  nothing outside a devkit project. The Decision is otherwise unchanged."

- ADR 0006: header `- Amended by ADR 0020 (<file>)`; Note at the top of Context: "Note
  (roadmap-sessions-upfront, 2026-11-22): a roadmap run keeps one session cron while it lasts and
  deletes it at its end (`[ADR 0020](<file>)`); decision 3 still holds for one change. Decisions 1, 2
  and 4 are unchanged."
- ADR 0010: header line, after the `- Amended by ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md)`
  line delivery-models wrote; Note after the roadmap-coordinator-followups Note: "Note
  (roadmap-sessions-upfront, 2026-11-22): where the host can start sessions, a roadmap run opens every
  pending change at its start, and its number counts only the changes in the implementation, its
  tests, evidence or review; a plan waits for its dependencies (`[ADR 0020](<file>)`). Decision 2
  holds unchanged where the host cannot start sessions. This change leaves the other decisions as
  they are." Task 7.9 replaces its last sentence with: "Decision 8's sentence that the owner's gates
  (grill answers, plan approval, retro answers) stay the owner's is amended for the grill answers the
  project's files settle: in every grill, a lone `/devkit change` as much as a roadmap run, the
  requirements-triage agent answers those first, each with its source, and the owner answers every
  question nothing written settles and every approval and retro answer. This change leaves the other
  decisions as they are."
- ADR 0011: header line; Note: "Note (roadmap-sessions-upfront, 2026-11-22): a change session a roadmap
  run starts also runs with no typed command, through an entry the guard lets through only with the
  run's ticket (`[ADR 0020](<file>)`); the run is still detected from its task and the loop's line.
  The approval of such a change is written by the coordinating session, from the owner's own typed
  message. This change leaves the other decisions as they are."
- ADR 0013: header line; decision 4's list gains the bullet "the start tickets (`tickets`), the places
  held (`placed`), the changes waiting for one (`queued`), the start-anyway of the moment (`anyway`),
  the wait loops under way (`waits`), whether the host offers a session cron (`cron`) and the periodic
  check (`check`), as ADR 0020 decides;" before the last bullet (phases 1 to 4 wrote it citing ADR
  0017, the number change-state took: task 6.2 corrects it); Note: "Note (roadmap-sessions-upfront,
  2026-11-22): decision 4 names the fields ADR 0020 adds. Decisions 1 to 3 and 5 are otherwise
  unchanged."
- ADR 0014: header line, after the `- Amended by ADR 0017 (...)` line; Note: "Note
  (roadmap-sessions-upfront, 2026-11-22): `[ADR 0020](<file>)` amends decisions 1 to 4. Every pending
  change opens at the run's start and its session runs with no typed command, on the run's ticket; the
  grill, the plan approval and the retro answers are asked in the coordinating session; a change
  session waits for a place in itself, so a freed place needs no start; a roadmap run keeps one periodic
  check. Decision 3, as `[ADR 0017](0017-a-change-state-is-derived-in-one-place.md)` amended it, is
  amended again: while a change session waits for a place, the load or its dependencies, its title is
  ⏳ and the id. A start still happens only on a turn the owner typed. Decisions 5 and 6 are otherwise
  unchanged."
- ADR 0017: header `- Amended by ADR 0020 (<file>)`; Note at the top of Context: "Note
  (roadmap-sessions-upfront, 2026-11-23): `[ADR 0020](<file>)` amends decision 4 for a change session
  of a roadmap run: while it waits for a place, the load or its dependencies, its title is ⏳ and the
  id, the stage icon replaced, and its state is `running` with the reason of that wait, derived as
  decision 1 says. A wait on GitHub keeps ⏳ beside the stage icon. Decisions 1 to 3 are unchanged."
- ADR 0012: nothing. delivery-models' ADR 0018 amends it; this change does not.
- `openspec/config.yaml` context, the ADRs list: its entries for 0016, 0017 and 0018 stay as they are,
  and after 0018 it gains "0020 a roadmap run opens every change at its start, runs change sessions on the
  run's ticket and keeps one periodic check, amends 0006, 0010, 0011, 0013, 0014 and 0017"; task 7.9
  makes its amends list "0004, 0006, 0010, 0011, 0013, 0014 and 0017".
- References to this ADR that phases 1 to 5 wrote as "ADR 0017" (the number change-state took), each
  renamed to "ADR 0020" by task 6.2, with no behaviour change: `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`
  (decision 4's bullet, line 74), `plugins/openspec/hooks/roadmap-loop.mjs` (the header comment on
  `tickets` to `unpushed`, line 25; the `sessionBackground` text "(ADR 0014, ADR 0017)", line 183; the
  comment above the archive of a change's session, line 487), `plugins/openspec/hooks/change-loop.mjs`
  (the comment above the run file's new fields, line 688), `plugins/openspec/hooks/change-loop.test.mjs`
  (the comment on the periodic check in the skill test, line 2446) and
  `plugins/openspec/hooks/roadmap-loop.test.mjs` (the assertion message "the empty fields of ADR 0017",
  line 2213, which names this change's run-file fields beside the `UPFRONT` list). Lines as of
  `a9ecdc1`; found with `grep -rn "ADR 0017"` over the files this branch changed. The references of
  change-state's own tests and documents stay, and no reference to ADR 0018 (delivery-models) changes.

## D-13 Existing tests this change touches

Searched in every suite under `plugins/openspec/hooks/` and `plugins/openspec/skills/*/scripts/` for
the rules this plan replaces: ADR 0014's decisions (`changeSessions`, `own-sessions`, `asks no gate`,
`ask, null`, the start input, `sessionBackground`, `roadmap-session-started`, `waits-turn`, the load
hold in session mode), `disable-model-invocation`, `STARTED_BY_SESSION`, the hooks' matchers, and "no
cron" (`cron`, `CronCreate`, `wake`, `session_crons`). Searched again on 2026-11-23, after the merge
`b216a46`, for the readings phase 5 replaces: `sessionTitle(WAIT_ICON`, `WAIT_ICON`, `queue.held-`,
`held-place`, `held-load`, `held-after`, the `held` action's shape (`kind: 'held'`, `held.why`, its
`icon` and `sessionTitle`), `runFactsOf`, `stateRow`, `STATE_ICON` and the titles with ⏳ (rows T-15
and T-16). Each test below keeps its invariant; the task that changes it names the invariant, the
layer and the suite.

| Id | Test (file) | Change | Invariant · layer · suite |
|---|---|---|---|
| T-1 | `followups F-3 decide: with a session per change the coordinator hands no stage and starts each open change's session in its worktree` (`roadmap-loop.test.mjs`) | `r.ask` is `b`'s grill instead of null | the coordinating session hands no stage and gives each start its exact input · decideRoadmap · roadmap-loop |
| T-2 | `followups AC-13 run: --change-sessions is recorded, and a run without it keeps the stages in the session` (`roadmap-loop.test.mjs`) | `j.ask` is `a`'s grill; `j.actions` also holds `schedule-check` when `--cron` is given (not given here: unchanged) | the mode is recorded by `run` and a later run without it goes back · run command · roadmap-loop |
| T-3 | `followups AC-13 background: the brief names ...` (`roadmap-loop.test.mjs`) | the phrase list gains `devkit-openspec:devkit-session`, `with no message from the owner`, `asked in the session that started this one` | the brief names the change, its worktree and branch, the coordinator, the language, the title rule, the archive line, at least 80 characters · sessionBackground · roadmap-loop |
| T-4 | `followups AC-15 decide: the load eases on a turn nobody typed and the held change waits for the owner's next message with its line` (`roadmap-loop.test.mjs`) | in session mode no `hold` action: at load 95 a pending line not open is withheld with `roadmap-waits-turn` on the event turn and started on the typed turn | a start in session mode happens only on a typed turn and never without a line · decideRoadmap · roadmap-loop |
| T-5 | `followups AC-13 skill: the session-per-change part names the tools, the list check, the session keys and the turn, and hands nothing` (`roadmap-loop.test.mjs`) | the sentence becomes `the session hands no stage but the grill's triage, asks the grills, the plan approvals and the retro answers, and starts no wait on GitHub`; the Never line becomes `In a run with a session per change: hand a stage, ask a change's other gates or start a wait on GitHub from this session, ...`; `doesNotMatch(md, /wake_when_done\|SendMessage/)` kept | the part names the host tools, the keys and the turn, and hands no stage · skill text · roadmap-loop |
| T-6 | `followups AC-14 skill: a change session renames its title from the sessionTitle of each next` (`roadmap-loop.test.mjs`) | reads the item from `devkit-session/SKILL.md`'s Loop | a change session renames itself from `sessionTitle` with the host tool, from the main thread · skill text · roadmap-loop |
| T-7 | `change-loop lock hooks.json: Stop, SubagentStop without a matcher and PreToolUse Agent call guard.mjs` (`change-loop.test.mjs`) | the matchers are `['Edit\|Write\|MultiEdit\|NotebookEdit', 'Bash', 'Agent', 'Skill']`, the fourth `cmd('skill')` with timeout 10 | each hook calls `guard.mjs` with its mode · hooks.json · change-loop |
| T-8 | `change-loop skill: the sections of D-3 to D-9 and the modes of start` (`change-loop.test.mjs`) | `doesNotMatch(md, /conduct-check\|CronCreate\|wake_when_done/)` applies to the text before `## Roadmap`; `## Roadmap` must name `CronCreate` and `wake_when_done` nowhere | the change part names no retired machinery and no schedule · skill text · change-loop |
| T-9 | `roadmap-loop run: U4 the same session keeps what is under way and changes the number; another session or --fresh starts from empty` (`roadmap-loop.test.mjs`) | another session keeps `tickets`, `placed`, `queued` and `waits` beside `startedSessions` and resets `check`; `--fresh` empties them | a new coordinating session keeps only what outlives the session that started it · run command · roadmap-loop |
| T-10 | `followups AC-8 next: start anyway starts what is held now ...` (`roadmap-loop.test.mjs`) | asserts that `anyway` stays `[]` on a run without a session per change, instead of banning the field and the word from the run file (D-6 keeps a start-anyway of the moment in `anyway`) | a `--start-anyway` on a run without a session per change keeps no permission in the run file · start anyway · roadmap-loop |
| T-11 | `followups AC-3 run file: every field the run file holds is named in ADR 0013 decision 4 ...` (`roadmap-loop.test.mjs`) | unchanged; ADR 0013 decision 4's new bullet (D-12) is written in phase 1 instead of task 6.2, so the test stays green from phase 1 on | every field of the run file is named in ADR 0013 decision 4 · run file · roadmap-loop |
| T-12 | `followups AC-13 next: a reported session start is recorded once, said once and never started again, and a change no longer open leaves the record` (`roadmap-loop.test.mjs`) | expects the line `roadmap-session-opened` (D-2) and the `roadmap-gate` line of `a`'s grill (D-3) instead of `roadmap-session-started` with its count | a reported session start is recorded once, said once and never started again · next command · roadmap-loop |
| T-13 | `followups AC-13 run: a run from another session keeps the started change sessions and gives them no second session, and --fresh forgets them` (`roadmap-loop.test.mjs`) | expects `announced` to be `{ a: 'gate:grill' }`, the run's own announcement of `a`'s grill gate (D-3), instead of `{}` | a new coordinating session keeps only what outlives it and starts the rest empty · run command · roadmap-loop |
| T-14 | `upfront AC-1 ticket: decide gives each session start a fresh ticket ...` (`roadmap-loop.test.mjs`, written in phase 1) | its third step expects no `session-start` for a claimed ticket and the stored ticket unchanged, since a claimed ticket counts as `own` (D-2) | a claimed ticket is never replaced · next command · roadmap-loop |
| T-15 | `upfront AC-7 session-next: the grill, the plan approval and the retro answers are held for the coordinating session with their stage icon` (`roadmap-loop.test.mjs`, written in phase 2) | the expected `sessionTitle` is `🙋 <icon> a` instead of `<icon> a` (the state `waiting-for-owner`, ADR 0017 decision 4); `icon` stays the stage's | the change session holds each roadmap gate for the coordinating session, under its stage's icon, taking no place · sessionDecide · roadmap-loop |
| T-16 | `upfront AC-10 session-next: a held change is titled ⏳ <id> and a claimed one its stage icon again` (`roadmap-loop.test.mjs`, written in phase 2) | the owner gate's expected title is `🙋 📝 a` instead of `📝 a`, its message "an owner gate keeps its stage icon, beside 🙋"; the place, load and after cases (`⏳`, `⏳ a`) and the claimed case are unchanged | a change held for a place, the load or a dependency is titled ⏳ and its id, and a claimed one gets its own action back · sessionDecide · roadmap-loop |
| T-17 | the test helper `sleeper()` of `roadmap-loop.test.mjs` (near line 3731) and the five tests that record its children as waits: `upfront AC-14 check: a stale wait is killed and the newest of each kind kept`, `upfront AC-14 check: a freed place goes to the first queued change, and one with no live wait gets its idle line`, `upfront AC-14 decide: an archived line with a recorded session kills its recorded waits, then gives archive-session with its reason until session-archived is reported`, `upfront AC-15 decide: the end done gives delete-check, archive-session per kept session and stop-own-tasks, and decide kills every recorded wait` and `upfront AC-15 decide: a stop kills only stale waits and keeps the sessions of changes that go on` (written in phase 3) | `sleeper(kind = 'session')` spawns `process.execPath` with the arguments `-e`, `setTimeout(() => {}, 120000)`, `<HOOKS_DIR>/roadmap-loop.mjs` and `session-wait` (or `wait` for `kind` `github`), so its command line is a wait loop's (D-9 step 1); a new helper `stranger()` keeps today's plain child for the new test of a spared pid; no assertion of the five tests changes | a stale or doomed wait loop is stopped, a kept one keeps running, and a change's live wait counts as watching · check and decide · roadmap-loop |

| T-18 | `upfront AC-5 triage: a change run may hand devkit-core:requirements-triage` (`change-loop.test.mjs`) | its two scratch changes (`liteChange()`, `approvedChange()`) record `x-devkit-flow: 2` in their `.openspec.yaml`, as an open with this release does; with no pin they follow flow 1, which does not list the triage (D-17) | a change run may hand the triage to a change whose flow lists it, with no prefix or devkit-core's · the `agent` lock, H3 · change-loop |
| T-19 | `upfront AC-4 lock agent: the coordinating session may hand requirements-triage with a brief naming an open change, and marks nothing under way` (`roadmap-loop.test.mjs`) | change `a` of its `lkProject` records `x-devkit-flow: 2` | the coordinating session may hand a helper of an open change's grill, marking nothing under way · `roadmapAgentDecision` RH6 · roadmap-loop |
| T-20 | `upfront AC-14 check: its actions are only triage, archive-session, push and delete-check, and it starts no session on its event turn` and `upfront AC-14 check: a triage heading inside a fence or with words after it gives the triage action, and a plain heading does not` (`roadmap-loop.test.mjs`) | the changes they expect a `triage` for (`b`; `c` and `d`) record `x-devkit-flow: 2`; the others keep their files | the check gives the triage of each grill not being asked that has no triage section · `checkCmd` · roadmap-loop |
| T-21 | the fixtures of `version-pin.test.mjs`: `treeFlow`, `scratch`, `openProject`, `makePackV2` and `checkScratch` | each stands for a project installed at release 1, as the suite was written: `treeFlow(schema)` reads `flows/1.json`; `scratch`, the origin of `openProject` and the pack copy of `makePackV2` give `devkit` and `devkit-lite` the bytes of `flows/1.json` as `flow.json` and no `flows/2.json` before the synthetic version 2 of `flowV2()` is written; `checkScratch` does the same and drops the `"2"` digests of both scripts, except in `version-pin AC-7 check: the tree's flows pass`, which keeps reading the tree as it is; no assertion changes | a change keeps the flow it opened with across an upgrade, and the repository check refuses a flow change that keeps its version · the version-pin fixtures · version-pin |
| T-22 | `flow-check readout: the sample change prints the approved text` (`flow-check.test.mjs`, near line 1210) | the sample change `add-csv-export` of `sampleChange()` records `x-devkit-flow: 2` in its `.openspec.yaml`, as a change opened with this release does; with no pin it follows flow 1 under an installed flow 2 and its readout gains the newer-flow line (`Fluxo: esta change segue a versão 1 do roteiro devkit; a versão 2 está instalada ...`, found by readiness attempt 4's probe); `SAMPLE_PT` and `SAMPLE_EN` stay byte for byte | the readout of the approved sample change reads as the owner approved it · the readout · flow-check |

| T-23 | `change-loop start: S6 one token naming a change resumes it and says where it stopped`, `change-loop start: S6 a change that lives only in a worktree resumes there` and `change-loop start: S7 no text and one unfinished change resumes it` (`change-loop.test.mjs`) | their changes (`addChange` gains a `flow` option) and the archived `old` of the first record `x-devkit-flow: 2`, as an open with this release does; with no pin they follow flow 1 under the installed flow 2 and the resume reply gains the newer-flow line (`It follows version 1 of its script's flow; version 2 is installed ...`); the expected replies stay | the resume reply names the change and says where it stopped, and nothing else · `startMode` (the resume) · change-loop |
| T-24 | `field-fixes 1 archived: resuming an archived change by its id still ends archived` (`change-loop.test.mjs`) | the change `foo` and its archived folder (`archivedFolder` gains a `flow` argument) record `x-devkit-flow: 2`; the expected reply stays | resuming an archived change by its id ends archived · `startMode` (the resume) · change-loop |
| T-25 | `jira-entry AC-5 start resumes the unfinished change that records the key, for the key and for its link` (`change-loop.test.mjs`) | the change of `addTaskChange` (gains a `flow` option) records `x-devkit-flow: 2`; the expected reply stays | a Jira key or its link resumes the unfinished change that records it and says where it stopped · `startMode` · change-loop |
| T-26 | `field-fixes 7 flow-check: readFlowFile reads a flow.json by path, readFlow still reads it by schema, and a malformed one names the path` (`changes-under-way.test.mjs`) | `flow.version` is compared with the version the file declares (read from the file) instead of the literal 1; the other assertions are unchanged | readFlowFile reads a flow.json by path as the file declares it, readFlow reads the same flow by schema, and a malformed file names its path · flow-check's readers · changes-under-way |

Added during phase 1 by the coordinator (2026-11-22): T-10 and T-11 were found red by phase 1's gate
and were missing from this table; both follow from decisions already approved (D-6, D-12 decision 6)
and change no requirement, criterion or scenario. T-12 to T-14 were added the same way during phase 3
(2026-11-23); they follow from D-2 and D-3. T-15 and T-16 come with the plan revision of 2026-11-23
(D-11's one derivation, ADR 0017 decision 4). T-17 comes with the revision after review round 1
(D-9's identity check of a recorded pid). T-18 to T-22 come with the revision for flow version 2
(D-17): a scratch change with no pin now follows flow 1 under an installed flow 2, and the
version-pin suite's fixtures read the tree's `flow.json` as version 1. Found by the planner's probe
of 2026-11-23 (a scratch clone of `62cf500` with version 2 released as task 8.2 says; the
`^version-pin`, `^upfront AC-4` and `^upfront AC-5` tests: 9 of 75 failed, T-18, T-19, the six
version-pin tests T-21 covers, and `upfront AC-4 lock agent: the triage for a change not open is
refused not-open`, which D-17's RH6 correction fixes in the code, not the test) and by reading each
test that expects a `triage` action of the check (T-20, red only once task 8.3 filters it); task 8.6
runs the whole suite again on the tree. That run (2026-11-23, 2311 tests) found six more tests that
failed only because they assumed flow version 1 is the installed one, the cases task 8.4's rule
names: three resume replies of `change-loop start`, one resume of an archived change and one of a
Jira key (a reply read as text that now holds the newer-flow line: T-23 to T-25) and one test that
expected the literal version 1 from the installed `flow.json` (T-26); each is changed as the rule says and has its row above.

**The search for phase 7** (2026-11-23, at `123a7ba`), over every suite under `plugins/openspec/hooks/`
and `plugins/openspec/skills/*/scripts/`, for the rules phase 7 replaces: the plan push (`unpushed`,
`filesPushed`, `'push'`, `what: 'plan'`; the two `upfront AC-12` tests keep passing: in both the
approval is written and not yet on `origin`), the skill hook (`guard.mjs skill`, `ENTRY_SKILL`,
`not-entry`, `review-change`; `upfront AC-2 guard: guard.mjs skill ...` keeps passing: an unrelated
skill still exits 0 and logs nothing without `DEVKIT_HOOK_LOG`, a named entry still logs its
decision), the signals (`killWaits`, `staleWaits`, `watchAlive`, `sleeper`, `waitOf`, `pid:
process.pid`; only the tests of T-17 record a live child as a wait and go through `check` or
`decide()`; `roadmap-loop run: U4 ...` records the test runner's own pid as the only wait of an
open change, so it is no stale wait and nothing signals it), the pruning
(`placed:`, `queued:` in run files that reach `decide()` or `check`: `roadmap-loop run: U4 ...` is a
run without a session per change, so nothing is pruned; `upfront AC-9 next: start anyway ...` queues
`b` and `c`, which are not lines of its roadmap, and asserts only `anyway`, which is not pruned; the
`upfront AC-14 check` place test queues only open lines; the session-next tests call `sessionNext`,
which prunes nothing), the triage heading (`Answered by triage`; the check's test writes a plain
heading with a source), the started form (`STARTED_BY_SESSION`, `startedTaskOf`, `typedOf`; `upfront
AC-2 guard: startedTaskOf ...` asserts that a line `hello` before the form gives null, which stays:
only a `<system-reminder>` note is skipped) and ADR 0020's status (`Status: proposed`; no test reads
ADR 0020's status). Only T-17 changes.

Read and expected to pass unchanged (each named in the check of the task that rewrites what it
reads): `change-loop skill: the frontmatter` (the devkit skill keeps `disable-model-invocation:
true`); `followups F-4 guard: the task of a session started by another session makes a change run`;
`followups AC-13 lock agent: ... every hand-off of the coordinating session is refused ...`;
`followups AC-13 decide: a change archived in its session frees its place, ...`; the AC-15 tests of
`next` (refused start, `--turn` words, withheld lines, lock stop); `followups AC-15 status: ...`;
`followups AC-13 lock stop: ...`; the `followups AC-14 icon`, `next` and `title` tests;
`README and the pack README describe how one change runs, with no cron` (`guard.test.mjs`: the README's
`/devkit change` paragraph stays free of `cron`); the two `conduct:` tests on `wake` in
`conduct-check.test.mjs`; `change-loop lock agent: the accepted packs are the ones docs/roles.md names`
(passes once `docs/roles.md` names the new helper, task 4.6); the `waitLoop` tests of
`change-loop.test.mjs`. For phase 5 (`b216a46` on): every `change-state` test, among them `change-state
AC-4 facts: runFactsOf reads each field of the run file`, `change-state AC-6 board: each state's row
sits in its block`, `change-state AC-6 board parity: every entry kind of entriesOf keeps its block and
its words`, `change-state AC-6 status and state agree: ...`, `change-state AC-7 start: ...` and
`change-state ADR 0017: the documents follow` (it still finds the `- Amended by ADR 0017` line within
ADR 0014's first eight lines, the ADR 0020 line going after it); every `commit-attribution` test;
`upfront AC-3 status: the board lists every opened change, with held-place, held-load and held-after
rows`; the `upfront AC-8 session-next`, `upfront AC-9 place` and `upfront AC-9 session-next` tests;
`upfront AC-7 session-next: the held approval goes on once approval.md is written`; `upfront AC-9
waitLoop: ...`; `followups ADR 0014: the documents follow`. For phase 6 (`a9ecdc1` on): every
`change-budget` test, among them `change-budget AC-1 nextAction without the option applies no cap
(kept)` (`sessionNext`'s `budget` stays off by default); `delivery-models docs: the documents follow`
(the ADR 0018 header lines and Notes of ADR 0010 and ADR 0012, and the config line's 0018 entry, stay
as they are). For phase 7 (`123a7ba` on): both `upfront AC-12 next` tests; `upfront AC-2 guard:
guard.mjs skill ...`; `upfront AC-2 entry: another skill is let through`; `upfront AC-2 guard:
startedTaskOf and firstMessageOf read only the first message's started form`; `followups F-4 guard:
the task of a session started by another session makes a change run`; every `upfront AC-14
staleWaits` test; `roadmap-loop hold: ...` and the other `holding` tests (`watchAlive` unchanged);
`roadmap-loop run: U4 ...`; `upfront AC-9 next: start anyway ...`; every `upfront AC-6 triage` test;
the three `upfront AC-9 lock stop` tests; `upfront AC-8 merge-base: ...`; `upfront AC-1 skill: ...`;
`followups ADR 0014: the documents follow`, `change-state ADR 0017: the documents follow` and
`delivery-models docs: the documents follow`. Any other test found failing is a defect of this
change, not a test to edit.

## D-14 Documents and release

- `docs/openspec-flow.md`: the roadmap part (opening at the start, the entry, the gates in the
  coordinating session, places, ⏳ and the held state's reasons beside the paragraph "A change's
  state.", the plan after dependencies, the push, the periodic check and the cleanup), the locks paragraph (the entry, the change session's stop), the grill (triage), the
  delivery rows (`renumber-adr`); in the paragraph "The token budget.", the cap is checked in `next`
  and in a roadmap change session's `session-next` (D-6 step 1); the CI pin to the new
  devkit-openspec tag.
- `docs/coordination-design.md`: the roadmap coordinator's section and the locks table.
- `docs/roles.md`: a `requirements-triage` helper section (Does, Delivers, Never, Stages:
  `requirements` as helper, Played today by: the devkit-core agent `requirements-triage`); the
  change-coordinator and roadmap-coordinator "Played today by" lines.
- `README.md`, `plugins/core/README.md` (the new agent), `plugins/openspec/README.md` (the new skill,
  the `skill` hook mode, the new subcommands), `docs/getting-started.md` where it lists agents.
- `docs/catalog.md` regenerated (`python3 scripts/gen-catalog.py`).
- Release (the next free minors over main at `78b6cd7`): devkit-openspec 0.29.0 → 0.30.0 and
  devkit-core 0.13.1 → 0.14.0 in each `plugin.json` and in `.claude-plugin/marketplace.json`,
  marketplace 0.33.0 → 0.34.0, a `CHANGELOG.md` entry `## 0.34.0`, the CI pin `v0.30.0` in
  `docs/openspec-flow.md` (lines 643 and 644, the snippet's comment and its sha placeholder, and line
  655, the "Pin the commit sha" paragraph) and its assertion in
  `plugins/openspec/hooks/change-loop.test.mjs` (the test `change-loop docs: the design records the
  answers`, near line 2567: `v0.30.0` matched, `v0.29.0` joining the pins that must be gone, its
  Invariant comment naming this change's move; invariant: the CI snippet pins the current release;
  layer: docs; suite: change-loop). A sibling merged first moves these numbers; the release step
  renumbers. The merges of main since moved them: the tree at `62cf500` holds devkit-openspec 0.32.0,
  devkit-core 0.14.0, marketplace 0.36.0 and the entry `## 0.36.0`, and these are the numbers phase 8
  writes into (D-17).
- Flow version 2 (D-17, phase 8): in `docs/openspec-flow.md`, after the paragraph that starts "A
  change to a `flow.json` raises its `version`", one paragraph that names the released flow versions:
  `devkit` and `devkit-lite` at version 2 from devkit-openspec 0.32.0 on (version 2 adds the
  `requirements-triage` helper to the grill; a change on version 1 keeps its grill with no triage until
  it is moved with `change-loop.mjs flow <id>`), `devkit-project` at version 1. The `## 0.36.0` entry
  of `CHANGELOG.md` gains one sentence on flow version 2 and a "Projects" line: re-run
  `openspec-setup` to install `flows/2.json`; changes under way keep flow 1 and their grill.
  `docs/adr/0020-a-roadmap-run-opens-every-change-at-its-start.md` gains, after its Decision list,
  a paragraph in the form of ADR 0010's Notes, starting `Note (roadmap-sessions-upfront, 2026-11-23):`:
  decision 3's triage in every grill holds for a change that follows flow version 2 or later of its
  script; a change on flow 1 (opened before devkit-openspec 0.32.0, or with no recorded flow) keeps
  its grill with no triage until the owner moves it (D-17). Its status and decisions stay.

## D-15 Proof: what this change proves and what the next real run proves

| AC | Proven in this change (tests, files) | Dogfood on the next real `/devkit roadmap` |
|---|---|---|
| AC-1 | `entryDecision` labels `claimed` and `same-session` on a synthetic started transcript; `withTicket` and the ticket recorded before the start; `session-next` output read as a change run by `runOf`; the devkit-session skill text; since review round 1, the real first message of a session the app started on 2026-11-22 (its host note, background paragraph, `Task:` line, task and closing notes, paths and ids replaced by placeholders) read by `startedTaskOf`, with the run's task form put in its envelope read as a change run and claimed on its ticket | a started session calls the entry on its first turn and runs its loop with no typed command; the host's Skill input reaches the hook; the `devkit-start:` line reaches the session verbatim below its task: that line is new, so no real message holds it yet, and it stays proven only on the next real run |
| AC-2 | `entryDecision` labels `not-entry`, `not-started`, `no-ticket`, `ticket-unknown`, `ticket-claimed`, `unreadable`; the guard's exit 2 through a real `guard.mjs skill` process; the devkit skill's frontmatter; since review round 1, the real first message refused (`not-started`: its task is a hand-written brief) and its envelope with the run's task and no start line refused (`no-ticket`); a `guard.mjs skill` process whose `roadmap-loop.mjs` cannot load lets another skill through and refuses `devkit-session` | the host refuses a model call of the devkit skill (today's behaviour) |
| AC-3 | `decideRoadmap` opens every pending line at load 95 with number 1; `run` through `main` creates no hold; the board lists all, its held rows placed by the state's reason (phase 5) | ten sessions start in one typed turn |
| AC-4 | session-mode queue and `ask` in roadmap order; the skill text naming the change's absolute `requirements.md` | the owner answers every grill in the coordinating session |
| AC-5 | agent file and `helpers` and `PACKS`; RH6 `grill-helper`; the grill skill's step 2b; `triageUnsourced`; since D-17 (phase 8), flow version 2 of `devkit` and `devkit-lite` in both copies with `flows/1.json` unchanged and both digests recorded, the open recording `x-devkit-flow: 2`, and a change on flow 1 whose grill names no triage helper, whose triage hand-off is refused (change run and coordinating session) and for which the check gives no triage | a flow-2 change's grill asked in the coordinating session and one in a lone `/devkit change` both hand the questions to the triage first; a flow-1 change's grill asks the owner every question, and its readout and resume reply show the newer-flow line |
| AC-6 | the agent's tools (no write, no Bash); `approval.md` refused for `devkit-core:requirements-triage` (`guard.test.mjs`); `triageUnsourced` → grill | a question nothing settles reaches the owner |
| AC-7 | the approval and retro asks in session mode; `session-next` holds `owner` and goes on when `approval.md` is written (scratch repository) | the change session wakes from its wait after the approval |
| AC-8 | `after` hold; `merge-base` step and subcommand on a scratch repository with an origin, conflict included; since review round 1, the skill's declared end after an exit 3 of `merge-base` and the `devkit-end: <id> blocked` line that end prints | a dependent change plans after its dependency's archive |
| AC-9 | `placeDecision` (free, ahead, load, anyway); claim and release through `session-next`; the stop allowed while held; since review round 1, the place decided again under the run file's lock when the file changed (one last place, one session), the stop of a claimed held session through a real `guard.mjs stop` process, and the place of a change that left the roadmap freed | at most `<n>` changes build at once |
| AC-10 | `changeState`'s held reasons and the title `⏳ <id>` they give, a stopped state keeping its own; the `held` action carrying that state, its title from it; the `state` command, `session-next` and the board agreeing on a change held for a place and one held for a dependency (scratch repository); the claimed action's own title back (phase 5, over the phase 2 tests) | the sidebar shows ⏳ and the id, then the stage icon again |
| AC-11 | `adrClash` on scratch repositories (clash, none, same file, two clashes); a requirements header back to pending gives the grill; the planner rule text; the release step's existing tests | a sibling's ADR number is renumbered without a question |
| AC-12 | `filesPushed`, the `push` action and subcommand against a scratch origin; a failed push asks no second push in the same decision; since review round 1, ticks of `tasks.md` after the plan push ask no second plan push, and an approval written again does | the branch is on `origin` after each grill |
| AC-13 | `schedule-check` while `cron` and no check; `--check-id`, `--check-refused`, `--check-gone` (a new `schedule-check` after an expired job); `delete-check` at every end and at stop; the check prompt reads as no typed command; the cron expression avoids :00 and :30 | the cron exists while the run lasts and is gone after |
| AC-14 | `check`: stale waits killed (real child processes), a place claimed, only `triage`, `archive-session`, `push`, `delete-check` kinds, no line when nothing changed; since review round 1, a live process that is not a wait loop, recorded as a stale wait, spared and forgotten, and the triage section read by the loop's own reader | a firing speaks only when something changed |
| AC-15 | end `done`: `delete-check`, `archive-session` per kept session (with its `reason`), `stop-own-tasks`, every recorded wait killed (real children) before the archives; `session-archive-later` keeps the entry and asks no second archive in the same decision | nothing of the run is left |
| AC-16 | no change-loop action kind schedules; the devkit skill's change part names no `CronCreate` (T-8) | a lone change creates no cron |
| change-budget (no AC of this change) | `upfront budget session-next: at the cap a change session's session-next prints the budget end and keeps its place` (task 6.1): the end and its `devkit-end:` line, the place kept, and no budget on `session-wait`'s poll or the stop lock's read | a change session with a `budget:` cap stops at it in its own session |

## D-16 The fixes of review round 1 (phase 7)

Round 1 (`review.md`, at `123a7ba`) left twelve important findings open, each confirmed by three
verifiers; two others were refuted (spec-reviewer's token budget, test-coverage-reviewer's F3, the
latter re-raised as code-quality F3, which stays open). Each fix below names where the design now
says it, the task of phase 7 that builds it and whether a spec delta changes. No criterion of
`proposal.md` and no line of `requirements.md` changes: every fix serves an existing criterion.

| # | Finding | Fix | Design | Task | Spec delta |
|---|---|---|---|---|---|
| 1 | code-quality F1: the plan push stays due while `tasks.md` is ticked | `approval.md` on `origin` is the record of the plan push | D-5 | 7.2 | `roadmap-coordination` "The grill and the plan are pushed with the change's branch": a sentence and the scenarios "Tasks ticked after the plan was pushed" and "A plan approved again" |
| 2 | code-quality F2: a load failure of `roadmap-loop.mjs` refuses every skill | `namesEntrySkill` on the raw input before the import | D-1 | 7.3 | none: conforms to the existing scenario "Another skill" of `coordination-locks` |
| 3 | code-quality F3 (test-coverage F3, refuted there): a recycled pid is signalled | `isWaitProcess` before a signal; spared and forgotten | D-9 step 1, D-13 T-17 | 7.4 | `roadmap-coordination`: a sentence in "A firing of the check acts and reports only what changed" and in "The end of a run cleans up after itself", and the scenarios "A recorded wait loop that is no longer one" (the check) and "A process that took a wait loop's number" (the end) |
| 4 | architecture F1: places and queue entries of a change no longer open stay | `pruneRecords` in `decide()` and `check` | D-7, D-9 step 2 | 7.5 | `roadmap-coordination` "A place is held only by a change that loads the machine": a sentence and the scenario "A change that leaves the roadmap" |
| 5 | architecture F2: the check reads the triage heading with its own regular expression | `triageSection` and `hasTriageSection` exported from `change-loop.mjs` | D-4, D-9 step 3 | 7.6 | `roadmap-coordination`: the scenario "A triage heading that is no section" (the behaviour becomes observable in the check) |
| 6 | test-coverage F1: the `stop` routing of `guard.mjs` is tested only by direct calls | a `guard.mjs stop` process test (test only) | D-6 | 7.1 | none: the scenarios "A change session waiting for a place" and "A change session with its place" hold it |
| 7 | test-coverage F2: the place decided again under the lock is unpinned | a `lockSleep` test (test only) | D-6 | 7.1 | none: "Two changes reach the implementation with one place" holds it |
| 8 | test-coverage F4: the started form is a hand-built fixture | a test over the real first message of 2026-11-22; it showed that the real message begins with a host note before `STARTED_BY_SESSION`, which `startedTaskOf` did not skip, so the fix adds the skip | D-1, D-15, R-1, R-2 | 7.1, 7.7 | `coordination-locks`: a sentence in "A run is known from the session's own record", and the scenarios "A started task after a note of the host", "Words before the started form" (today's behaviour, now said) and "The run's own start after a note of the host" |
| 9 | spec F1: the skill does not declare the end after a `merge-base` exit 3 | the skill's Loop item 3 names `change-loop.mjs reply blocked ... why=base-conflict` | D-6 | 7.8 | none: the scenario "The merge conflicts" already says the change stops blocked |
| 10 | adr-reviewer F1: ADR 0020 is still proposed | status accepted and the `Accepted by:` line from this revised plan's `approval.md` | D-12 | 7.9 | none |
| 11 | adr-reviewer F2: ADR 0010 decision 8's sentence on the grill answers | ADR 0020 amends it; ADR 0010's Note says so; lone changes named | D-12 | 7.9 | none: `change-coordination` "Every grill asks the triage agent first" already holds the behaviour |
| 12 | adr-reviewer F3: the skill hook ignores ADR 0004's opt-in | ADR 0020 decision 1 and Consequences say why; ADR 0004 gets its header line and Note | D-1, D-12 | 7.9 | none: `coordination-locks` "A lock never traps", scenario "A project that has not opted in", already holds it |

Nits fixed in the same phase: ADR 0020 records the implementer's renumbering of an ADR (decision 7,
adr-reviewer F4) and the home of the change session's loop (decision 8, architecture F4), task 7.9;
the triage block of `change-loop.mjs` moves above `decide`'s header comment (code-quality F4) and
`mergeBaseCmd` uses `gitIn` (architecture F3), tasks 7.6 and 7.8; the `CHANGELOG.md` entry names the
new subcommands `session-next`, `session-wait`, `merge-base`, `push` and `check`, and calls
`schedule-check` and `delete-check` actions of a decision (spec F4), task 7.9; the three lines of the
check get spec scenarios (spec F3), D-9 and task 7.1. Left as they are, said here: every failure of
`git merge` labelled `base-conflict` (code-quality F7, D-6); the "first dependency not archived"
computed in three readers (architecture F3, second half: each reads it for its own caller, and a
shared reader is a refactor with no finding of a wrong answer); test-coverage's two nits (an
assertion that accepts two outcomes, and the ticket recheck under the lock with no test of a change
between the two reads), which no verifier raised to important.

## D-17 The triage ships as flow version 2 (AC-5; phase 8)

**The problem.** The merge `62cf500` brought `change-version-pin` (archived
`openspec/changes/archive/2026-11-23-change-version-pin/`, devkit-openspec 0.31.0). Its design D-2
keeps every released flow version as `flows/<n>.json`, and its D-8 adds
`scripts/check.py#check_flow_versions`: each schema's `flow.json` must equal `flows/<its
version>.json`, each `flows/<n>.json` must match its digest in `scripts/released-flows.json`, and a
flow change raises its version. Phase 4 (task 4.2) added `requirements-triage` to the `helpers` of the
`requirements` stage in the four `flow.json` files with `"version": 1` kept, so `python3
scripts/check.py` prints exactly two errors:
`plugins/openspec/schemas/devkit/flow.json: differs from flows/1.json, the released content of
version 1; a flow change raises its version`, and the same for `devkit-lite` (the check reads only
`plugins/openspec/schemas/`; the copies under `openspec/schemas/` are held to them by the
byte-identical test of `flow-check.test.mjs`).

**The choice.** Release version 2 of the `devkit` and `devkit-lite` flows: the owner's answer of
2026-11-23 ("1", flow version 2). Concretely, in each of the four folders
(`plugins/openspec/schemas/devkit/`, `plugins/openspec/schemas/devkit-lite/`,
`openspec/schemas/devkit/`, `openspec/schemas/devkit-lite/`):

- `flow.json`: its second line becomes `  "version": 2,`; every other byte stays as phase 4 left it
  (the requirements helpers `["codebase-researcher", "requirements-triage"]`).
- `flows/2.json` (new): the same bytes as that `flow.json`.
- `flows/1.json`: untouched, byte for byte the released version 1 (`helpers:
  ["codebase-researcher"]`), whose digest `scripts/released-flows.json` already records.

`scripts/released-flows.json` gains `"2"` under `devkit` and under `devkit-lite`: `sha256:` and the
hex SHA-256 of the bytes of `plugins/openspec/schemas/<script>/flows/2.json`, the function
`check.py#flow_digest` computes (`hashlib.sha256(data).hexdigest()`; `shasum -a 256` gives the same
hex, as CONTRIBUTING.md says). The planner's probe of 2026-11-23 (the tree at `62cf500` with only the
version line raised, in a scratch copy) gave `sha256:6577dd5362bce5f505e33b7cc795b18f7ca81d6eb179b16ec343658fe8057776`
for `devkit` and `sha256:7eb245e30d26345c89703a25064cec6ede5f531b0caa617255f67eefc6a605ed` for
`devkit-lite`, and `check.py` then printed `all checks passed`; the implementer computes the digests
from the files it writes, never copies these. Only the `schema.yaml` instruction text of the
requirements stage changed besides; it is not versioned (change-version-pin D-4 B2: the OpenSpec CLI
reads the installed `schema.yaml` for every change).

**`devkit-project` does not move.** Its `flow.json` has no `requirements` stage and this change edits
none of its files, so `check.py` passes on it as it is. A flow version is per script:
`released-flows.json` keys the digests by script, the pin is read against the change's own script
folder (change-version-pin D-1, D-3: `flows/<x-devkit-flow>.json` of the script), and a slice records
its own script's installed version (D-6 there). Raising it would release a second version with the
same stages and show every slice under way the newer-flow line for nothing. A slice opened with this
release records `x-devkit-flow: 1`, as before.

**Who gets the triage.** A `devkit` or `devkit-lite` change opened with this release installed
records `x-devkit-flow: 2` (`change-loop.mjs#recordPin` reads the installed version, change-version-pin
D-6), and so does a `script` switch before the proposal (D-7 there). A change with `x-devkit-flow: 1`,
or with no `x-devkit-flow` (opened before devkit-openspec 0.31.0, or by hand), follows version 1
(change-version-pin D-3 step 4: `pin.flow ?? 1`, read from `flows/1.json`), whose requirements stage
lists only `codebase-researcher`. Such a change does not get the triage in its grill; only a change on
flow 2 does. The owner moves a change on flow 1 with `change-loop.mjs flow <id>` (change-version-pin
D-7), on request only; its readout and resume reply say a newer flow is installed (D-5 there).

**What the locks and the grill do for a change on flow 1** (read at `62cf500`):

- The change-run hand-off lock (`change-loop.mjs#handOffFor`, H3) builds the allowed roles with
  `scriptAgents(changeFlow(...).flow)`, the flow the change follows: `devkit-core:requirements-triage`
  is not among them, so the hand-off is refused with the label `not-a-role` and a reason listing the
  script's roles. Outside a `/devkit` run no lock applies (`no-run`), as for every agent.
- The coordinating session of a run with a session per change (RH6, `roadmap-loop.mjs#roadmapAgentDecision`)
  allows the triage only when `isRequirementsHelper` finds it among the `helpers` of the
  `requirements` stage of `changeFlow(...).flow`: for a change on flow 1 it does not, so the hand-off
  is refused `own-sessions`. A run whose changes run in the coordinating session goes through RH3,
  `handOffFor`: `not-a-role`. One correction there: a brief naming a change with no folder (`zzz`,
  not open) has no pin either, so `changeFlow` reads it as flow 1 and the triage would be refused
  `own-sessions` before the open check could say `not-open` and name the open changes (the probe
  found `upfront AC-4 lock agent: the triage for a change not open is refused not-open` failing). So
  `isRequirementsHelper`, when `locateChange` finds no folder for the change, reads the helpers of the
  installed flow of the project's script (`readFlow(found.root, changeSchemaAt(found.root, dir))`,
  the flow an open would record); a change with a folder keeps reading its own flow. The new read is
  null-safe as the current one (`readFlow(...)?.stages.find((x) => x.id === 'requirements')?.helpers
  ?? []`): `readFlow` returns null for a script with no `flow.json`, and the hand-off is then not a
  helper's.
- So that the grill never meets these refusals, the triage is not offered for such a change, in three
  places that read one fact, the `helpers` of the change's own requirements stage:
  1. `change-loop.mjs#decide`, `planPart`: both `grill` actions (the requirements stage next or
     waiting for the owner, and the grill sent back by `unsourced`) gain `helpers`, the `helpers` of
     the `requirements` stage of the flow passed to `decide` (the change's own flow, through
     `collectFlow` → `changeFlow`), `[]` when it lists none. No other action kind changes.
  2. The skills: the `grill` item of `plugins/openspec/skills/devkit/SKILL.md` and step 2b of
     `plugins/core/skills/requirements-grill/SKILL.md` hand the drafted questions to
     `devkit-core:requirements-triage` only when the change's flow allows it, and each says where
     it reads that permission: in a lone `/devkit change` or a change session, the `helpers` of the
     `grill` action that `next` (or `session-next`) printed; in the coordinating session, the
     `helpers` of `ask.action`, which is that same grill action (`roadmap-loop.mjs`, the `ask` of
     `decideRoadmap`); for the check's `triage` action, which carries no `helpers`, the action
     itself, since the check gives it only for a grill whose `helpers` name the triage (item 3), so
     the devkit skill's `triage` item and step 2b run from it with no further test. With no
     permission step 2b is skipped and the owner is asked every question, one at a time, as before
     this change. A grill run by hand with no loop action keeps step 2b (no lock applies there and no
     flow is read; accepted).
  3. The periodic check (D-9 step 3) gives `triage` only for a change whose grill action in
     `facts.actions` (the action `nextAction` gave for that line) has `helpers` including
     `requirements-triage`; the `triage` action it emits keeps its shape (`change`, `kind`, `root`,
     `progressKey`) and adds no `helpers`.
- The source check (`triageUnsourced`, D-4) is unchanged: a requirements file with no triage section
  gives `[]`; a section written by hand keeps its check.
- The requirements instruction of the installed `schema.yaml` names the triage for every change
  (above): a flow-1 grill reads it, and its rule "Never answer a question yourself" holds, so every
  question reaches the owner. The owner's grill on flow 1 is the grill as it was before this change.

**This change's own folder.** `openspec/changes/roadmap-sessions-upfront/.openspec.yaml` holds
`schema: devkit` and `created: 2026-11-22`, no pin: it follows flow 1. Its grill passed long ago;
flows 1 and 2 have the same stages, files, roles, ceilings and `appliesWhen`/`notAfter`, so its
evidence, review and archive read the same, and its CI check (`deliver-check.mjs --ci`) reads
`flows/1.json` with the same readiness. Its readout and resume reply gain the newer-flow line once
the tree ships version 2; it is not moved (a move is the owner's request, and nothing in it needs
flow 2).

**The tests this asks** (phase 8; the invariant, layer and suite of each changed test in D-13 T-18 to
T-22). New, test first, in `change-loop.test.mjs` unless named:

- `upfront AC-5 flow: version 2 of devkit and devkit-lite names requirements-triage among the grill's helpers in both copies, and flows/2.json is flow.json`;
- `upfront AC-5 flow: flows/1.json of devkit and devkit-lite is released version 1, without requirements-triage, and devkit-project stays at version 1` (the digest of each `flows/1.json` equals its `"1"` entry; the requirements helpers of version 1 are `["codebase-researcher"]`; `devkit-project`'s `flow.json` says version 1 and it has no `flows/2.json`);
- `upfront AC-5 flow: released-flows.json records the digest of flows/2.json of devkit and devkit-lite` (the same `sha256:` function as `check.py`);
- `upfront AC-5 open: a devkit and a devkit-lite change opened on the tree's schemas record x-devkit-flow 2, and a project slice 1` (in `version-pin.test.mjs`, over a project with the tree's schemas);
- `upfront AC-5 triage: the grill of a change on flow 1 names no triage helper and that of a change on flow 2 names it` (`nextAction` over a scratch project with the tree's schemas: one change with no pin, one with `x-devkit-flow: 1`, one with `x-devkit-flow: 2`, and the flow-1 change once `change-loop.mjs flow <id>` moved it; also the grill sent back by `unsourced`);
- `upfront AC-5 lock agent: a change run on flow 1 refuses devkit-core:requirements-triage as not-a-role, and one on flow 2 allows it`;
- `upfront AC-4 lock agent: the coordinating session's triage for a change on flow 1 is refused own-sessions` (`roadmap-loop.test.mjs`);
- `upfront AC-14 check: a grill of a change on flow 1 gives no triage action, and one on flow 2 does` (`roadmap-loop.test.mjs`);
- `upfront AC-5 skill: the grill skill and the devkit skill hand the triage only when the grill action's helpers name it`;
- `upfront AC-5 docs: the flow doc names the released flow versions, the 0.36.0 entry names flow version 2, and ADR 0020's Note names flow 1` (`guard.test.mjs`).

**Spec deltas.** `change-coordination`: "Every grill asks the triage agent first" holds for a grill
whose flow lists the triage, and the new requirement "The triage ships as flow version 2" (scenarios
"A change opened on flow 2", "A project slice", "A change on flow 1 keeps its flow's grill", "A
change moved to flow 2"); `coordination-locks`: "In a roadmap run a hand-off names its change" reads
the helpers of the flow the change follows, scenario "The triage for a change on an older flow";
`roadmap-coordination`: "A firing of the check acts and reports only what changed" gives the triage
only to a grill whose flow lists it, scenario "A grill on an older flow". `proposal.md`'s AC-5 and
AC-14, and the sentences that repeat them (What Changes, Capabilities), carry the clause "of a
change that follows flow 2 or later of its script; a change on flow 1 keeps its grill with no triage
until the owner moves it (D-17)" (readiness attempt 4, finding 1). `requirements.md`, the owner's
record, keeps its words; the proposal says that the owner's answer of 2026-11-23 narrowed them.

**Rejected.** Keeping version 1 edited in place: `check.py` refuses it, and every change under way
would get the helper with no recorded move, the silent flow change change-version-pin exists to
prevent. Granting the triage by a constant outside the flow (a role list in the lock): a second
source of a stage's helpers beside `flow.json`, which the hand-off lock and RH6 read today. Moving
`devkit-project` too: no content change (above). Moving every change under way to flow 2 by a
migration: the move is the owner's request only (change-version-pin D-7).

## Risks / Trade-offs

| Id | Risk | P × I | Mitigation |
|---|---|---|---|
| R-1 | The host's Skill tool does not reach a PreToolUse hook, or names the skill in another field, or the `devkit-start:` line does not reach the session verbatim below its task | MEDIUM × HIGH | The entry fails closed and the owner types `/devkit change <id>` (today's behaviour); the skill is found in any string field; the envelope of a real started message is pinned by a test (task 7.1), but the `devkit-start:` line is new and no real message holds it yet: it stays proven only on the next real run, which records the hook log (`DEVKIT_HOOK_LOG`) and the session's first message |
| R-2 | The host changes the started form, adds notes before it, or drops lines below the task | MEDIUM × HIGH | `startedTaskOf` is the one reader and skips the host's leading `<system-reminder>` notes, found in the real message of 2026-11-22 (review round 1); the entry refuses (fallback typed command); review trigger in ADR 0020 |
| R-3 | A coordinating `next` reading 20 actions is slow | MEDIUM × MEDIUM | the Stop hook passes `readOwn: false`; measured in the dogfood; the cost is per decision, not per poll |
| R-4 | A change session hands a load stage while held | LOW × MEDIUM | the skill follows `session-next`; the stop is allowed only while held, so the session ends its turn; no lock (Non-Goals) |
| R-5 | Two sessions write the same worktree's index (push while the change session hands the implementer) | LOW × LOW | the push commits by path and fails with exit 3 on an index lock; the next decision retries; since review round 1 a plan is pushed once per approval (D-5: `approval.md` on `origin` is the record), so the implementer's ticks of `tasks.md` never ask the coordinating session to commit in that worktree again |
| R-6 | `archive_session` also removes the worktree | LOW × MEDIUM | the change sessions are started with `use_worktree: false`, in a worktree the app did not create; checked in the first dogfood; the archive runs only for archived changes |
| R-7 | The host's session cron expires after 7 days, or fires late or not while the session is busy | HIGH × LOW | `CronList` on every typed turn and every firing, `--check-gone` and a new `schedule-check`; the run's end accepts a job already gone; the check acts on its next firing whatever the delay |
| R-11 | An archive is refused, waits for the owner's approval, or meets a session still working | MEDIUM × LOW | the change's waits are killed first; `session-archive-later` keeps the entry and says so once; the next firing or the run's end tries again; one left at the end is said and left to the owner |
| R-8 | A killed wait was not stale | LOW × MEDIUM | only waits of changes no longer open or archived, and older duplicates of the same kind, are stale; the newest wait of an open change is never killed before the end |
| R-15 | A recorded pid now belongs to an unrelated process of the owner (after a reboot or a long run) | LOW × HIGH | `isWaitProcess` reads the command line with `ps` before any signal and counts a process as a live wait only when it is one (D-9 step 1); a pid that is not a wait is spared and forgotten; with no `ps` nothing is signalled, and a live wait left unrecorded ends with its session (accepted) |
| R-16 | The places of a change that left the roadmap stay counted | LOW × MEDIUM | `pruneRecords` in every coordinating decision and at the top of every firing (D-7); `--fresh` as before |
| R-9 | Siblings in flight edit `roadmap-loop.mjs` and `change-loop.mjs` | MEDIUM × MEDIUM | merge main before the last verification and review; conflicts resolved by the implementer |
| R-10 | Size: about 67 hours across two packs | MEDIUM × MEDIUM | seven phases with filtered gates; the full suite in phase 6 and again at the end of phase 7 |
| R-12 | change-state and this change both modify the requirement "A change session shows the stage its change is in" of `roadmap-coordination`; the one archived later overwrites the other's text | MEDIUM × MEDIUM | this change's delta holds change-state's whole text and scenarios plus the held clause, so either order of archive leaves both rules; the archive's `openspec validate --strict` reads the result |
| R-13 | The held ⏳ and the GitHub ⏳ read alike in the sidebar | LOW × LOW | a held title has no stage icon (`⏳ <id>`), a GitHub wait keeps it (`⏳ 🚀 <id>`); the state command and the board name the reason |
| R-14 | The board and the periodic check read with the budget off (change-budget D-4), so a change session stopped at its budget looks running there | MEDIUM × LOW | the change session itself prints the budget end, its title shows the owner's wait (🙋) and its reply names the file and the key to raise; no AC claims the board shows it; the owner goes on by raising the cap and typing in that session |
| R-17 | The roadmap coordinator's script keeps growing with the change session's loop | MEDIUM × LOW | ADR 0020 decision 8 records the home and names a split into a module of its own as a follow-up; the change loop never imports the roadmap script |
| R-18 | Flow version 2 makes every unpinned test change of the suites follow flow 1 under an installed flow 2: a test that hands the triage for such a change, or reads a readout or resume reply as text, meets the refusal or the newer-flow line | HIGH × MEDIUM | D-13 T-18 to T-22 name the tests found by the planner's probe and readiness attempt 4's (the whole suite run on a scratch copy with version 2 released); the whole-suite gate of task 8.6 re-runs that search on the tree, after the documents of 8.5, and any other test found failing is fixed only where it assumed flow version 1 is the installed one, its invariant, layer and suite named |
| R-19 | Projects under way see the newer-flow line on every change after the update, and their grills get no triage until moved | HIGH × LOW | the line is change-version-pin's own notice (its D-5); the `CHANGELOG.md` "Projects" line and the flow doc say how to move a change; nothing is moved without the owner |

## Migration Plan

No data migration. `readRun` drops unknown types and fills the new fields empty, so a run file of
0.28 reads as a run with no tickets, places or check. A run in progress across the update: its
change sessions started with the old prompt have no ticket and run as today (typed command); the next
`/devkit roadmap` in that session gives new sessions tickets. Rollback: revert the release; the new run
file fields are ignored by 0.28's `readRun`; a leftover session cron dies with its session; delete it
with `CronDelete` if the session lives on.

## Implementation plan

**Per surface.** `plugins/openspec`: hooks (guard, roadmap-loop, change-loop, conduct-check,
hooks.json), skills (devkit, devkit-session), schemas (both copies). `plugins/core`: the new agent, the
grill skill, the planner agent. No worker or frontend.

**Order.** Run file fields and the shared readers → the entry → the change session's loop and places
→ the coordinating session (opening, gates, push, board) → triage and drift → the check and cleanup →
the held state through `changeState` → the token budget in `session-next` → documents and release →
the fixes of review round 1 → flow version 2.
Phases in `tasks.md`: 1 entry, 2 change session, 3 coordinating session and check, 4 triage and drift,
5 the held state through `changeState` (after the merge `b216a46`), 6 the token budget in
`session-next` (after the merge `a9ecdc1`), ADRs, documents, release, full suite, 7 the fixes of
review round 1 (D-16; after `123a7ba`), its own full suite, 8 flow version 2 (D-17; after the merge
`62cf500`), its focused gate.

**Files.**

- Create: `plugins/openspec/skills/devkit-session/SKILL.md`, `plugins/core/agents/requirements-triage.md`,
  `docs/adr/0020-a-roadmap-run-opens-every-change-at-its-start.md`,
  `openspec/changes/roadmap-sessions-upfront/proof/red-1.txt` to `red-8.txt`; in phase 8,
  `plugins/openspec/schemas/devkit/flows/2.json`, `plugins/openspec/schemas/devkit-lite/flows/2.json`,
  `openspec/schemas/devkit/flows/2.json`, `openspec/schemas/devkit-lite/flows/2.json`.
- Modify: `plugins/openspec/hooks/guard.mjs`, `roadmap-loop.mjs`, `change-loop.mjs`,
  `conduct-check.mjs`, `hooks.json`, `roadmap-loop.test.mjs`, `change-loop.test.mjs`,
  `conduct-check.test.mjs`, `guard.test.mjs`; `plugins/openspec/skills/devkit/SKILL.md`;
  `plugins/openspec/schemas/devkit/{flow.json,schema.yaml}`, `plugins/openspec/schemas/devkit-lite/{flow.json,schema.yaml}`
  and the same four under `openspec/schemas/`; `plugins/core/skills/requirements-grill/SKILL.md`,
  `plugins/core/agents/change-planner.md`; `openspec/config.yaml`; ADRs 0004 (phase 7), 0006, 0010, 0011, 0013, 0014, 0017, and 0020 again in phase 7;
  `docs/openspec-flow.md`, `docs/coordination-design.md`, `docs/roles.md`, `docs/getting-started.md`,
  `docs/catalog.md`, `README.md`, `plugins/core/README.md`, `plugins/openspec/README.md`,
  `CHANGELOG.md`, both `plugin.json`, `.claude-plugin/marketplace.json`. In phase 8 (D-17): the four
  `flow.json` again (the version line), `scripts/released-flows.json`, `plugins/openspec/hooks/change-loop.mjs`
  (the grill actions' `helpers`), `plugins/openspec/hooks/roadmap-loop.mjs` (the check's triage
  filter), `plugins/openspec/skills/devkit/SKILL.md`, `plugins/core/skills/requirements-grill/SKILL.md`,
  `plugins/openspec/hooks/version-pin.test.mjs` (its fixtures, T-21), `flow-check.test.mjs` (T-22), `change-loop.test.mjs`,
  `roadmap-loop.test.mjs`, `guard.test.mjs`, `docs/openspec-flow.md`, `CHANGELOG.md` (the `## 0.36.0`
  entry), `docs/adr/0020-a-roadmap-run-opens-every-change-at-its-start.md` (a Note). No version number
  moves: devkit-openspec 0.32.0 and marketplace 0.36.0 are this change's release already.
- Delete: none.

**Estimate.** Optimistic 52 h · likely 73 h · pessimistic 106 h (phases 1 to 6: 40 · 55 · 79; phase
7: 8 · 12 · 18; phase 8: 4 · 6 · 9).

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| Run file fields, `readRun`, tickets, `withTicket` | 3 | Core | LOW |
| `startedTaskOf`, `firstMessageOf`, `entryDecision`, guard `skill` mode, hooks.json | 5 | Core | MEDIUM |
| devkit-session skill, devkit skill item 1a, `sessionBackground` | 3 | Core | MEDIUM |
| `session-next`, `sessionDecide`, `placeDecision`, `session-wait`, `waitLoop` predicate | 7 | Core | MEDIUM |
| Change session stop routing | 2 | Core | MEDIUM |
| `merge-base` subcommand and the `after` hold | 3 | Integration | MEDIUM |
| Session-mode `decideRoadmap` (opening, queue, lines), `collectRoadmap` `readOwn` | 5 | Core | MEDIUM |
| `push` action and subcommand, `filesPushed` | 3 | Integration | LOW |
| Board and messages | 3 | Core | LOW |
| Periodic check: `schedule-check`, `check`, `staleWaits`, waits recording, cleanup at the end, `archive-session` | 7 | Core | MEDIUM |
| Triage agent, grill skill, `triageUnsourced`, flow helpers, `PACKS`, RH6 `grill-helper`, rule words | 5 | Core | LOW |
| `adrClash` and `renumber-adr`, planner reopen rule | 3 | Core | LOW |
| Tests T-1 to T-14 and the red records | 3 | Testing | LOW |
| The held state through `changeState` (`runFactsOf`, `HELD_TEXT`, S9, the held title, `stateRow`, `stateEntries`, the moved plan-stage reader), its tests and T-15, T-16 | 4 | Core | MEDIUM |
| The token budget in `session-next` (test first, red record) | 1 | Core | LOW |
| ADR 0020, Notes, documents | 4 | Documentation | LOW |
| Release files, catalog, full suite | 2 | Documentation | LOW |
| Phase 7 tests and the red record (seventeen new tests, T-17) | 3 | Testing | MEDIUM |
| The plan push recorded by `approval.md` on `origin` (D-5) | 1 | Core | LOW |
| `namesEntrySkill` before the import in the `skill` mode (D-1) | 1 | Core | LOW |
| `isWaitProcess`, `waitAlive`, `killWaits` sparing a non-wait (D-9) | 1.5 | Core | MEDIUM |
| `pruneRecords` in `decide()` and `check` (D-7) | 1 | Core | LOW |
| `triageSection`, `hasTriageSection`, the moved block (D-4) | 1 | Core | LOW |
| The host's leading notes skipped by `startedTaskOf`, `typedOf` reading it (D-1) | 1 | Core | MEDIUM |
| The skill's declared end after `merge-base` exit 3, `gitIn` in `mergeBaseCmd` (D-6) | 0.5 | Core | LOW |
| ADR 0020 accepted and completed, ADR 0004 and 0010 Notes, config line, CHANGELOG (D-12) | 1 | Documentation | LOW |
| Phase 7 gate and the full suite | 1 | Testing | LOW |
| Phase 8 tests and the red record (ten new tests; T-18 to T-22) | 2 | Testing | MEDIUM |
| Flow version 2 in the four folders, `flows/2.json`, the digests (D-17) | 0.5 | Migration | LOW |
| The grill actions' `helpers`, the check's triage filter, the two skills' condition (D-17) | 1.5 | Core | MEDIUM |
| The flow doc's versions paragraph, the `## 0.36.0` sentence and Projects line, ADR 0020's Note (D-14, D-17) | 0.5 | Documentation | LOW |
| Phase 8 gate | 1.5 | Testing | MEDIUM |

## Assumptions

- A-1: the desktop app delivers a started session's task verbatim below `Task:`, every line kept
  (source: `guard.mjs` comment on `STARTED_BY_SESSION`, roadmap-coordinator-followups D-4; the real
  first message of a session started on 2026-11-22, read in review round 1, keeps a task of many lines
  and blank lines verbatim and adds a notes paragraph after it, but holds no `devkit-start:` line,
  which is new). That message also shows the app may put a `<system-reminder>` note before
  `STARTED_BY_SESSION` (D-1).
- A-2: a call of the Skill tool reaches PreToolUse hooks with `tool_name` `Skill` and the skill's
  name, plugin-scoped, in a string field of `tool_input` (source: Claude Code hooks match any tool by
  name; the field name is not documented, hence the any-field rule).
- A-3: `CronCreate` takes `{ cron, prompt, recurring }` (`recurring` defaults to true) and returns a
  job id; `CronDelete` takes `{ id }`; `CronList` reads the jobs; the cron is session-only, fires only
  while the session is idle, up to 50% of its period late, and a recurring job expires after 7 days
  (source: the host's tool schemas, checked by the coordinating session on 2026-11-22). That a firing
  starts a turn with the prompt as a user message is from the same check.
- A-4: `mcp__ccd_session_mgmt__archive_session` takes `{ session_id, reason }`, `session_id` from
  `mcp__ccd_session_mgmt__list_sessions`; the app asks the owner per call outside auto or bypass mode
  and refuses a session still working (source: the host's tool schema, checked on 2026-11-22).
- A-5: the Stop hook's input lists the session's background tasks in `background_tasks` (source:
  `change-loop.mjs#stopDecision` T2 and its tests).
- A-6: a background task's end starts a new turn of its session (source: ADR 0011's wait on GitHub,
  in use since change-coordinator).

## Dependencies

- `roadmap-coordinator-followups` (archived 2026-11-22): the session per change, the started form,
  the stage icons, the run file's locked writes.
- `merge-staleness-first-parent` (archived): a merge of main that brings only `openspec/` files keeps
  evidence and reviews current, so the `merge-base` step before the plan stales nothing.
- `change-budget` (merged into this branch at `a9ecdc1`): `nextAction`'s `budget` option, the end
  `waiting-budget` and its gate `budget` in `GATE_OF_WHY` (D-6 step 1).
- `delivery-models` (merged at `a9ecdc1`): ADR 0018 and its header lines in ADR 0010 and ADR 0012,
  beside which D-12 writes this change's (ADR 0010 only).
- `change-version-pin` (archived 2026-11-23, merged into this branch at `62cf500`; devkit-openspec
  0.31.0): the pin `x-devkit-flow`, `changeFlow`, `flows/<n>.json`, `scripts/released-flows.json` and
  `check.py#check_flow_versions`, the newer-flow line and the `flow` move (its design D-1 to D-8), on
  which D-17 releases flow version 2.
- Relies on, not delivered here: `release-merge-conflict` (round 17e) for release files in conflict;
  `fresh-base-check` (round 17h) for an up-to-date `origin/<base>` in `adrClash`.

## Decisions cited

ADR 0004 (its decision on the hooks outside a devkit project; amended for the entry skill only, after
review round 1), ADR 0006 (decisions 2 and 3), ADR 0010 (decisions 2, 3, 5 and 8; decision 8's
sentence on the grill answers amended after review round 1), ADR 0011 (decisions 1 and 2, its
Negative consequences and its rejected fail-closed lock), ADR 0013 (decisions 3 and 4), ADR 0014
(decisions 1 to 6, its rejected timer retry and message), ADR 0017 (decisions 1, 2 and 4; decision 4
amended here for a held change session), ADR 0020 (written by this change, accepted with the approval
of this revised plan, task 7.9). ADR 0016 (stage-roles) amended
decisions of ADR 0010 and ADR 0011, and ADR 0018 (delivery-models) decisions of ADR 0010 and ADR 0012,
that this change does not touch. Not an ADR: change-budget's design D-4 (only `next` counts the
budget; the roadmap coordinator's reads do not), which D-6 step 1 extends to `session-next`, a change
run's own loop, leaving the coordinator's reads as they are. Not an ADR either: change-version-pin's
design D-2 (every released flow version kept), D-3 (a change with no pin follows version 1), D-6 and
D-7 (the open and the `flow` move record the installed version) and D-8 (a flow change raises its
version), which D-17 follows to release flow version 2; ADR 0020 decision 3 (the triage in every
grill) gets a Note for a change on flow 1, its decision unchanged.

## Open Questions

None that changes the specs or the tasks. The fields of `CronCreate`, `CronDelete`, `CronList` and
`archive_session` (A-3, A-4) were confirmed on 2026-11-22; should the host change them, a
different field name changes one constant and its test.
