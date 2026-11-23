<!-- devkit-stage design result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Design

Change: `change-state` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (see
`proposal.md`; source item F-1 of `openspec/changes/archive/2026-11-22-managed-agents-study/study.md`).

The implementer copies the rules, keys, texts and test names below and makes no design choice:

- D-1 the state and its contract, D-2 the run file's facts, D-3 the `state` command;
- D-4 a GitHub that does not answer, D-5 the session title, D-6 the board;
- D-7 the message table, D-8 ADR 0017 and the Notes, D-9 the new tests, D-10 the existing tests this
  change touches, D-11 documents and release.

## Context

See `proposal.md` (Why). The code as it is at `c561553`:

- `plugins/openspec/hooks/change-loop.mjs` decides one change: `decide(facts)` (pure) returns an
  action of kind `agent`, `session`, `grill` or `end` (`end: { state, why }`, `params`, `reply`);
  `nextAction(cwd, id, opts)` reads the files, git and GitHub, calls `decide`, then adds `icon`
  (`stageIcon(action)`, the `STAGE_ICON` table) and `sessionTitle` (`sessionTitle(icon, id)`, cut to
  59 code points; no icon, no title). `whereOf` gives the one phrase `/devkit change` and the board's
  "outside the roadmap" rows show, from the stage checker's report alone. `waitLoop` polls `next`
  while it stays the same wait on GitHub; a poll that throws, or a decision `blocked` with the why
  `github-unreadable`, counts as a failed read, and three in a row end blocked.
- `decide` maps the stage checker's (`flow-check.mjs#readDelivery`) blocked ends through
  `BLOCKED_OF`: `gh-error` (the pull request cannot be read) and `checks-unreadable` both become
  blocked `github-unreadable`, exit 2. In the plan part GitHub is read only by `collectFlow`'s
  post-merge check off the change's own branch (`deliveryOf`), whose error only turns that check off.
- `plugins/openspec/hooks/roadmap-loop.mjs` owns the run file (`runFilePath`, `readRun`,
  `emptyRun`, `updateRun`), the gate table (`GATE_OF_WHY`, `gateOf`), `entriesOf(f)` (each open line
  of the roadmap as `running`, `agent`, `session`, `wait`, `owner`, `blocked`, `archived` or `own`,
  from `next`'s action and the run file), `decideRoadmap`, `boardOf` (the `/devkit status` text, rows
  placed by `entriesOf`'s kinds and `ownRow`) and `sessionStartOf` (the start tool's input, title
  `sessionTitle(stageIcon(a) ?? '❓', id)`). It imports `change-loop.mjs`, so `change-loop.mjs`
  cannot import it back.
- `plugins/openspec/hooks/project-loop.mjs` (the `/devkit project` slices) has its own decision with
  blocked `github-unreadable` ends, and calls `waitLoop`.
- `plugins/openspec/skills/devkit/SKILL.md` Loop step 1a renames a change session to each `next`'s
  `sessionTitle`; it does not change. `/devkit status` runs `roadmap-loop.mjs status`; it does not
  change.

## Goals / Non-Goals

**Goals:** one function derives the state; `next`, the new command, the board and the session title
read it; a GitHub that does not answer is a wait everywhere the loop reads the stage checker.

**Non-Goals (design level, beyond the proposal's):**

- `entriesOf` and `decideRoadmap` keep their own reading of the run file: they decide what a run does
  next (start, hand, ask), which the state does not say. Only `boardOf`'s rows move to the state.
  D-6 keeps the two readings in step with one parity test.
- A GitHub failure the delivery checker meets on its own (before the delivery stage, or on the
  archive branch) keeps today's end (`pr-problem` or `unreadable`); only the stage checker's two GitHub
  ends change (D-4). `change-state AC-5 build` (`change-loop.test.mjs`, task 2.1) holds the command to
  `next` at the implementation and code review stages, whatever end `next` gives there.
- No state for `/devkit project` slices; `project-loop.mjs` keeps its blocked `github-unreadable`.
- An end the session declares in a `/devkit change` run (`reply blocked`, `reply
  waiting-pr-decision`) is in no file, so the state does not show it until `next` runs again (as
  today); in a roadmap run the run file holds it and the state shows it (D-2).

## D-1 The state and its contract (AC-1, AC-3, AC-7)

One exported pure function in `change-loop.mjs`, the only place a state is derived:

`changeState(action, facts = null, { lang } = {})` returns

```
{ state, reason, stage, stageTitle, phase, stageIcon, stateIcon, title }
```

- `action`: an action of `decide` (with `change`, `stage`, `stageTitle`, `params`, `detail`), or
  `null`, or the stand-in `{ kind: 'none', change, stage: 'open', stageTitle }` for a change the run
  file lists with no folder (D-3). `facts`: `runFactsOf(...)` (D-2), or `null` outside a roadmap run.
  `lang`: the person's language, for the reason's phrase (`normalizeLang(lang)`).
- `state`: `running`, `waiting-for-owner`, `waiting-on-github`, `blocked` or `archived`.
- `reason`: `null` or `{ code, text }`. The codes and phrases, the whole contract:

| state | `reason.code` | `reason.text` (message key) |
|---|---|---|
| `running` | none (a stage or step handed out) | `null` |
| `running` | `ready` (D-2) | `running.ready` |
| `waiting-for-owner` | `grill` (action of kind `grill`) | `gate.grill` |
| `waiting-for-owner` | the end's `why`: `waiting-approval`, `waiting-approval-again`, `waiting-retro`, `waiting-merge`, `waiting-archive-merge`, `waiting-review-dispute`, `waiting-unrun-stage`, `waiting-by-hand`, `waiting-pr-decision` | `gate.<gateOf>` (`GATE_OF_WHY`) |
| `waiting-on-github` | the end's `params.what`: `checks`, `merge`, `archive-merge`, `silent` | `what.<code>` |
| `blocked` | the end's `why` (every `blocked-why.` code of the table) | `blocked-why.<code>` rendered with `{ ...params, id, why }` |
| `archived` | none | `null` |

- `stage`, `stageTitle`: the action's (`null` when it has none). `phase`: `action.detail.phase` when
  it is a number, else `null`.
- `stageIcon`: `stageIcon(action)` (unchanged table; `📦` for an archived end; `❓` for the stand-in).
- `stateIcon`: `STATE_ICON[state]`, a new exported constant `{ 'waiting-for-owner': '🙋',
  'waiting-on-github': '⏳', blocked: '⛔', archived: '📦' }`; `null` for `running`.
- `title` (D-5).

An action kind `agent` or `session` is `running`; a `grill` is `waiting-for-owner`; an `end` takes
its own `state`. An unknown owner wait throws `LoopUsageError` (as `gateOf` does today), so a new
owner wait added later fails a test instead of showing a wrong phrase.

`nextAction` keeps `action.icon = stageIcon(action)` and adds `action.state = changeState(action,
null, { lang })`; `action.sessionTitle` is `action.state.title` when it is not `null` (D-5). `next`
and `wait` print the action as today, now with `state`.

**Why one function over two callers.** The requirement says the state comes from the code that
decides `next`. `next` and the command both go through `nextAction` and `changeState`; the board goes
through `changeState` with the facts `collectRoadmap` already read. There is no second copy.
Rejected: a state computed inside `decide` (it would need the run file, which `decide` never reads);
a state module of its own (a third file that both loops import, for one function and a table).

## D-2 The run file's facts (AC-4, AC-6)

`runFilePath`, `readRun`, `emptyRun` (and its local `isObject`), `GATE_OF_WHY` and `gateOf` move from
`roadmap-loop.mjs` to `change-loop.mjs` unchanged, exported there; `roadmap-loop.mjs` imports them and
re-exports `runFilePath`, `readRun` and `gateOf`, which tests and callers import from it today. The
parser does not change: a missing, empty or broken run file is an empty run with one place, and a
field of the wrong type is dropped (as `readRun` does now).

`runFactsOf(run, id, { onRoadmap })`, exported from `change-loop.mjs`, takes any object with the run
file's fields (`readRun`'s result, or the facts `f` of `boardOf`, which carry the same fields and an
`after`) and returns:

```
{ sessionMode, started, inflight, declared, waits }
```

- `sessionMode`: `run.changeSessions === true` and `onRoadmap` (the id is a line of the roadmap).
- `started`: `run.startedSessions[id]` exists, or `run.after?.[id] === 'session-start'`.
- `inflight`: `run.inflight[id]`, or `null` when `id` is a key of `run.after` (as `entriesOf`).
- `declared`: `run.declared[id]` or `null`.
- `waits`: `id` is in `run.starting`, or `run.announced[id]` is `waits-turn` or `waits-refused`.

`changeState` applies them in this order, first match wins (the order `entriesOf` and `boardOf` give
the board today):

| # | Condition | State |
|---|---|---|
| S1 | `sessionMode` and `declared` | the declared end (below) |
| S2 | `sessionMode` and `started` | from the action; with no action, `running` with no stage and no reason |
| S3 | `sessionMode` | `running`, reason `ready` |
| S4 | not `sessionMode`, `inflight`, and `inflight.kind === 'wait'` or the action is a wait on GitHub | `waiting-on-github`, `what` from `action.params.what ?? inflight.what ?? 'merge'` |
| S5 | not `sessionMode` and `inflight` | `running`, no reason; stage and title the action's, else `inflight.stage` for both (what the board shows today) |
| S6 | `declared` | the declared end |
| S7 | `waits`, or the action is the stand-in, or there is no action | `running`, reason `ready` |
| S8 | otherwise | from the action |

A declared end: `state: 'blocked'` gives `blocked`, code `declared.why`, phrase
`blocked-why.<why>` with `{ ...declared.params, id, why }`; `state: 'waiting-for-owner'` gives
`waiting-for-owner`, code `declared.why` (`waiting-pr-decision`), phrase `gate.<declared.params.gate
?? GATE_OF_WHY[why]>`. Its stage is the action's when there is one, else `null`.

S7 is AC-4's "waits for a place": a start handed but not open, or left for the owner's next message.
Outside a roadmap run (`facts` `null`, or a run file that names nothing for the id) the state is the
action's: AC-4's "plain `running`".

## D-3 The `state` command (AC-1, AC-2, AC-4)

`node plugins/openspec/hooks/change-loop.mjs state [--change <id>] --lang <pt-BR|en>`, routed in
`main` like `next`, added to `USAGE`. Options are parsed by `parseArgs` with the value options
`--change` and `--lang`; any positional word or other option is a `LoopUsageError` (exit 3, the
`request-unreadable` reply, the raw message in `error`).

`stateEntries(cwd, { id = null, lang, env, openspec, gh })`, exported, is the command's whole read:

1. `start = findRoot(cwd)` (none: `LoopUsageError`); `run = readRun(runFilePath(start))`;
   `roadmapIds` = the ids of `readRoadmap(start)` (none: an empty set).
2. The ids: with `id`, that id; without, the union of `unfinished(start, { env, gh })` (open folders in
   every checkout and archive branches not merged; slices left out, as today) and the run file's ids:
   `run.starting`, the keys of `run.inflight`, `run.declared` and `run.startedSessions`, and the keys
   of `run.announced` whose value is `waits-turn` or `waits-refused`. Each id once, sorted.
3. Per id: when `knownChange(start, id)` finds a folder (active or archived), `action =
   nextAction(start, id, { env, lang, openspec, gh })`. Else, when the id is archived on the default
   branch (`archivedOnDefault`), the action is an archived end with no stage. Else, when the run file
   names it (step 2's fields), the stand-in `{ kind: 'none', change: id, stage: 'open', stageTitle }`
   with the `open` stage's title from the `devkit` script's `flow.json` in the person's language
   ("Open the change", "Abrir a change"). Else `LoopUsageError` (`no change named <id>`): exit 3.
4. The entry: `{ change: id, ...changeState(action, runFactsOf(run, id, { onRoadmap:
   roadmapIds.has(id) }), { lang }), script, root, branch }`, the last three from the action (`null`
   for the stand-in and the archived end).

Output: `{ "version": 1, "changes": [ <entry>, ... ] }` and a newline, one entry for `--change`, exit
0. It prints no `devkit-run:` and no `devkit-end:` line: the stop lock reads those lines in the
transcript as a run, and a state read is no run. It writes nothing, calls no AI and starts only git,
openspec and gh, as `next` does; it never calls `updateRun`.

An example, `state --change feat --lang en` at the plan approval:

```
{ "version": 1, "changes": [ { "change": "feat", "state": "waiting-for-owner",
  "reason": { "code": "waiting-approval", "text": "your approval of the plan" },
  "stage": "approval", "stageTitle": "Owner's approval", "phase": null, "stageIcon": "📝",
  "stateIcon": "🙋", "title": "🙋 📝 feat", "script": "devkit", "root": "/…/worktrees/feat",
  "branch": "feat" } ] }
```

Rejected: printing one object for `--change` and a list without it (two shapes for one reader);
exit codes by state, as `next` has (a report is not a run end; a panel reads the JSON).

## D-4 A GitHub that does not answer (AC-5)

One exported predicate in `change-loop.mjs`, used by both readers of the stage checker's report:

`githubSilent(end)`: `end?.state === 'blocked'` and `end.reasonCode` is `gh-error` or
`checks-unreadable`.

- `decide`, in `blockedEnd(e)` (reached from the plan part and from `buildPart`): when
  `githubSilent(e)`, return `waiting('waiting-on-github', 'waiting-github', e.stage, { what:
  'silent' }, { error: e.params?.error ?? '' })`: an end `waiting-on-github`, why `waiting-github`,
  `params.what` `silent`, `detail.error` GitHub's error, exit 1, reply `waiting-github` ("<id> is
  waiting on GitHub (GitHub did not answer). I keep waiting with no time limit …"). `gh-error` and
  `checks-unreadable` leave `BLOCKED_OF`.
- `whereOf`: when `githubSilent(report.end)`, the phrase is `where.github` ("waiting on GitHub"), not
  `where.blocked`. One rule, so the unfinished list and the board's "outside" rows say what the state
  says.
- `waitLoop`: `isUnreadable(a)` becomes true for a decision `blocked` with why `github-unreadable`
  (`project-loop.mjs`'s form, kept) and for a wait whose `params.what` is `silent`. A silent poll is
  a failed read before any comparison with the first decision; after three failed reads in a row
  the wait returns a blocked end with why `github-unreadable` and the reply `blocked` quoting the
  error: the silent action's `detail.error`, or the thrown poll's message (as today). A first decision
  that is itself silent is a wait (it is not counted), so the wait polls; GitHub answering with any
  other decision ends the wait with it.

Exit 1 instead of 2 makes the session start the background wait (SKILL.md "Waiting on GitHub",
unchanged), and in a roadmap run `entriesOf` reads it as a `wait`, so the run hands a wait, not a
blocked line.

Rejected: mapping the silence only in `changeState`, leaving `next` blocked (the state and `next`
disagree, against AC-3); telling a missing `gh` or a refused login from an outage (the failure's kind
would have to travel through `deliveryOf`'s lookup in `deliver-check.mjs`; the three-poll end quotes
gh's own error, which names either case).

## D-5 The session title (AC-7)

`sessionTitle(icon, id, stateIcon = null)` keeps its two-argument form and gains a third: the code
points of `[stateIcon, icon, id].filter(Boolean).join(' ')`, cut to 59 when there are 60 or more.

`changeState`'s `title`:

| state | title | example |
|---|---|---|
| `running` | `sessionTitle(stageIcon, id)`; `null` when there is no stage icon | `🛠️ feat` |
| `waiting-for-owner`, `waiting-on-github`, `blocked` | `sessionTitle(stageIcon, id, stateIcon)`; with no stage icon, `sessionTitle(stateIcon, id)` | `🙋 ❓ feat`, `⏳ 🚀 feat`, `⛔ 🛠️ feat`, `⛔ feat` |
| `archived` | `sessionTitle('📦', id)` | `📦 feat` |

`nextAction` sets `action.sessionTitle` to that title, so a change session renames itself by SKILL.md
Loop step 1a, unchanged, whenever the state or the stage icon changes. `roadmap-loop.mjs#sessionStartOf`
titles the start `changeState(a).title ?? sessionTitle('❓', e.id)` (no run facts: the session that
starts is the change's own), so a change session starts with the title its first `next` gives.

Rejected: the state icon in place of the stage icon (the owner chose B in the grill, question 2); a
state icon while the change runs (the owner's answer: only the stage icon then).

## D-6 The board (AC-6)

`boardOf(f)` keeps `entriesOf(f)` for which lines are placed, the counts and the queue. For each
placed entry `e` (not archived) its row is:

- `s = changeState(f.actions?.[e.id] ?? null, runFactsOf(f, e.id, { onRoadmap: true }), { lang })`;
- the block: `waiting-for-owner` → owner, `blocked` → blocked, `running` and `waiting-on-github` →
  running;
- the text: owner and blocked, `s.reason.text`; `waiting-on-github`, `running.github` with `{ what:
  s.reason.code }`; `running` with reason `ready` and `sessionMode`, `running.no-session` (the board's
  words stay, AC-6); any other `running`, `running.phase` when `s.phase` and `f.phaseTotals[id]` are
  known, else `running.stage` with `s.stageTitle ?? ''`.

`ownRow` and `runningText` go: the state gives what they computed. Every row text is the same string
as today for the same facts. The parity test of D-9 (`change-state AC-6 board parity`) runs every
entry kind of `entriesOf` through the old and the new placement over the same facts.

## D-7 The message table (AC-4, AC-5)

Two keys, in both languages, in `MESSAGES`:

| key | en | pt-BR |
|---|---|---|
| `what.silent` | `GitHub did not answer` | `o GitHub não respondeu` |
| `running.ready` | `ready, waiting for someone to continue` | `pronta, esperando alguém continuar` |

`what.silent` renders inside `waiting-github` and `running.github` through the `what.` family. Both
pass `change-loop replies: no internal term in either language` unchanged.

## D-8 ADR 0017 and the Notes

ADR 0010 decision 3 (four ends, each with its reason) and decision 6 (the state in the repository and
GitHub) are kept. ADR 0014 decision 3 says a change session's title is the icon of its stage and the
id; this change adds the state icon while the change is stopped, so it amends that decision. Task 3.1
creates `docs/adr/0017-a-change-state-is-derived-in-one-place.md` with this text (status `accepted`
and the `Accepted by` line once the owner approves the plan; the next free number on `origin/main`
at merge, as `CONTRIBUTING.md` step 5 says):

```
# ADR 0017: A change's state is derived in one place, and a stopped change's session title shows it

- Status: accepted
- Date: 2026-11-22
- Change: change-state
- Amends: ADR 0014 (0014-each-roadmap-change-runs-in-a-session-of-its-own.md), decision 3, the title of a change session
- Accepted by: the owner, on <date>, in the message that approved the plan of the change: <the owner's words>; recorded in `openspec/changes/change-state/approval.md`

## Context

ADR 0010 decision 3 gives the loop four ends, each with its reason, and decision 6 keeps the state in
the repository and GitHub. Each surface still read it its own way: `/devkit status` worked each row
out from the loop's action and the run file, the change session's title (ADR 0014 decision 3) showed
the stage only, so a session waiting for the owner looked like one at work, and the panels of
`coordination-panels` would have read the files a third way. The managed-agents-study (item F-1)
compared this with a Managed Agents session, which reports one status and one stop reason. In the
grill of `change-state` (2026-11-22), answers the owner delegated to the coordinating session: the
command, `/devkit status` and the title read the state in this change, the panels later; the title
carries the state icon beside the stage icon while the change is stopped; a change nobody works on in
a roadmap run reads running, ready for someone to continue; a GitHub that does not answer is a wait
on GitHub.

## Decision

1. A change's state is `running` or one of ADR 0010's four ends, with a reason when one applies and
   the stage. It is derived on every read, from the change's files, git, GitHub and the roadmap run
   file, by the code that decides the loop's next action, and stored nowhere. The loop's action, the
   change loop's state command, `/devkit status` and the change session's title read it; the panels
   read the command. The hooks' locks keep reading the transcript: they gate a run and report no state.
2. In a roadmap run the run file weighs first: an end the session declared, a stage or wait in
   flight, and, in a run with a session per change, a change with no session of its own or whose
   start waits for the owner's next message, which reads `running`, ready for someone to continue.
3. When the change's stage needs GitHub and GitHub does not answer, the loop ends waiting on GitHub
   with that reason, not blocked; the wait ends blocked, quoting GitHub's error, after three failed
   reads in a row.
4. ADR 0014 decision 3, amended: a change session's title is the stage icon and the change id while
   the change runs; while it is stopped, the state icon (🙋 waiting for the owner, ⏳ waiting on
   GitHub, ⛔ blocked), a space, then the stage icon and the id; 📦 and the id once archived. The stage
   icons and when the session renames itself are unchanged.

## Consequences

- Positive: the board, the title and the panels give one answer; a session waiting for the owner is
  told apart in the sidebar at a glance; a GitHub outage no longer stops a run as blocked.
- Negative: outside a roadmap run, an end the session declared (an agent's failure, a red gate) is
  in no file, so the state shows the stage as ready again until `next` runs (Accepted: ADR 0010
  keeps no stored log). A `gh` that is missing or not signed in reads as GitHub not answering until
  the wait's third failed read (Mitigated: the blocked reply quotes gh's error). A title holds two
  emoji (Accepted: cut to 59 code points). A GitHub failure the delivery checker meets on its own,
  before the delivery stage or on the archive branch, keeps its blocked end (Accepted: flagged in
  the change's design).

### Review trigger

A surface needs a state the loop cannot derive (a budget end); the app gains a session icon or a
session status; the owner asks for a stored history of states.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| One event log per change, the study's first candidate | A history to read | A stored state ADR 0010 rejects ("a session that remembers where it is"); the files already hold the facts | medium |
| Each surface keeps its own reading | Nothing to build | The board and the title already disagree on a stopped change | low |
| GitHub's silence mapped only in the state, the loop still blocked | The loop unchanged | The state and the loop's end disagree | low |
| The state icon in place of the stage icon | A shorter title | Loses where the change stopped; the owner chose both icons | low |
| A state icon while the change runs too | One form | The owner's answer: only the stage icon while it runs | low |
| Tell a missing gh or a refused login from an outage | An exact reason | The failure's kind would cross the delivery checker's lookup; the blocked reply already quotes gh's error | medium |
```

The Notes and the index entry, each Note in its ADR's Context before its first existing Note, and
ADR 0014's header line after its `- Status:` line:

```
ADR 0014, header line:
- Amended by ADR 0017 (0017-a-change-state-is-derived-in-one-place.md)

ADR 0014, Note:
Note (change-state, 2026-11-22): [ADR 0017](0017-a-change-state-is-derived-in-one-place.md) amends
decision 3: while the change is stopped, the title carries the state icon (🙋, ⏳ or ⛔) before the
stage icon, and 📦 alone once archived. Decisions 1, 2 and 4 to 6 are unchanged.

ADR 0010, Note:
Note (change-state, 2026-11-22): the change loop derives one state per change, running or one of
decision 3's four ends with its reason, read by the board, the session title and the panels and stored
nowhere ([ADR 0017](0017-a-change-state-is-derived-in-one-place.md)); a GitHub that does not answer
is a wait on GitHub. Decisions 1 to 8 are otherwise unchanged.

openspec/config.yaml, the ADRs line, before its closing parenthesis:
; 0017 a change's state is derived in one place and a stopped change's title shows it, amends 0014
```

## D-9 New tests (every AC)

Test first: each phase's test task comes before its code tasks, and its new tests fail on the base
`c561553` except those marked "passes on the base" (they pin behaviour the base already has). Every
new test is named `change-state <AC-n> <area>: ...`. Each labelled branch is its own test; a table
of cases is one `t.test` subtest per case, named by its case. Fixtures reuse the files' helpers
(`run`, `endOf`, `reportOf`, `rowOf`, `build`, `planChange`, `deliveredChange`, `next`, `parsed` in
`change-loop.test.mjs`; `world`, `sessionWorld`, `agentAct`, `grillAct`, `endAct`, `ownerAct`,
`githubAct`, `blockedAct`, `projectWith`, `addOpen`, `putRun`, `doStatus`, `cmd` in
`roadmap-loop.test.mjs`) and the shared env constants that blank the branch variables.

In `plugins/openspec/hooks/change-loop.test.mjs`:

| Name | Proves | Base |
|---|---|---|
| `change-state AC-3 state: an agent and a session step are running with no reason` | D-1 row 1, both kinds | red |
| `change-state AC-3 state: the grill waits for the owner with the reason grill` | D-1 `grill` | red |
| `change-state AC-3 state: each end waiting for the owner keeps its why as the reason, with its gate phrase` | one subtest per `waiting-*` why of D-1 | red |
| `change-state AC-3 state: an unknown wait for the owner throws` | negative of the gate table | red |
| `change-state AC-3 state: each wait on GitHub takes what it waits for as the reason` | subtests `checks`, `merge`, `archive-merge`, `silent` | red |
| `change-state AC-3 state: each blocked reason decide gives is the reason, with its phrase and details` | one subtest per blocked why `decide` returns (`ceiling`, `no-progress`, `not-delivered`, `pr-closed`, `previous-script`, `not-opened`, `wrong-branch`, `merge-setup`, `archive-failed`, `plan-not-approved`, `pr-problem`, `unknown-step`, `unreadable`) | red |
| `change-state AC-3 state: an archived end has no reason` | D-1 `archived` | red |
| `change-state AC-3 state: the phrase is in the person's language and the code is not` | `en` and `pt-BR` of one owner, one blocked, one GitHub case | red |
| `change-state AC-3 cli: next and state give the same state for the same files and GitHub answers` | subtests: a plan stage handed out, the grill, the approval, a ceiling, archived (real `planChange`/archived repos), checks pending and GitHub silent (`deliveredChange`); `next`'s `action.state` equals the command's entry less `change`, `script`, `root`, `branch` | red |
| `change-state AC-5 decide: the pull request that cannot be read is a wait on GitHub, GitHub did not answer` | `gh-error`: state, why, `params.what`, `detail.error`, reply, exit 1 | red |
| `change-state AC-5 decide: checks that cannot be read are a wait on GitHub, GitHub did not answer` | `checks-unreadable`, same fields | red |
| `change-state AC-5 decide: a ceiling and a closed pull request still block` | negative: `githubSilent` false for them | passes on the base |
| `change-state AC-5 githubSilent: true only for the two GitHub ends of the stage checker` | subtests: `gh-error`, `checks-unreadable` true; `pr-closed`, `ceiling-reached`, a waiting end, `null` false | red |
| `change-state AC-5 delivery: with GitHub silent a change at its delivery prints waiting on GitHub` | `deliveredChange` with `pr-view` failing: `next` exit 1 and `state` entry `silent`, "GitHub did not answer", `⏳ 🚀 feat` | red |
| `change-state AC-5 plan: with GitHub silent the grill, a plan stage and the approval keep their state` | real repos read from the main checkout (off the change's branch) with every `gh` call failing, against the same repos with `gh` answering | passes on the base for `next`; red for the command |
| `change-state AC-5 build: with GitHub silent the implementation and the code review keep the loop's action` | pins the Non-Goal: with every `gh` call failing, the command's state equals `next`'s action state at those two stages, whatever end `next` gives | red (no command) |
| `change-state AC-5 where: whereOf says waiting on GitHub when GitHub did not answer` | D-4 `whereOf` | red |
| `change-state AC-5 wait: a silent wait counts as a failed read and three end blocked quoting the error` | `[WAIT, silent, silent, silent]` gives blocked `github-unreadable`, the reply quotes `detail.error` | red |
| `change-state AC-5 wait: a first decision that is silent waits, and GitHub answering ends the wait with the new decision` | `[silent, WAIT]` returns `WAIT`; `[silent, silent, changed]` returns `changed` | red |
| `change-state AC-5 wait: the blocked form project-loop gives still counts as a failed read` | `[WAIT, blocked github-unreadable ×3]` gives the blocked end | passes on the base |
| `change-state AC-7 title: a running change is its stage icon and its id` | `🛠️ feat`; with no stage icon `null` | red |
| `change-state AC-7 title: waiting for the owner is 🙋, a space, the stage icon and the id` | `🙋 ❓ feat` (grill), `🙋 📝 feat` (approval) | red |
| `change-state AC-7 title: waiting on GitHub is ⏳ and the stage icon` | `⏳ 🚀 feat` (checks and silent) | red |
| `change-state AC-7 title: blocked is ⛔ and the stage icon, or ⛔ alone with no stage` | `⛔ 🛠️ feat`, `⛔ feat` (previous script) | red |
| `change-state AC-7 title: archived is 📦 and the id alone` | `📦 feat` | red |
| `change-state AC-7 title: every form of a 70-character id is cut to 59 code points` | five forms | red |
| `change-state AC-7 next: every action carries its state and its sessionTitle is the state's title` | real repos at the grill, a plan stage, the approval, the previous script, archived | red |
| `change-state AC-1 command: one change prints its state, reason, stage and title in the person's language` | the D-3 example, `en` and `pt-BR`, exit 0 | red |
| `change-state AC-1 command: the output holds no run marker` | no `devkit-run:` / `devkit-end:` for a blocked and a waiting change | red |
| `change-state AC-1 command: nothing is written` | `git status --porcelain`, the run file's bytes and `git worktree list` before and after; no run file created where none was | red |
| `change-state AC-1 command: an unknown change exits 3 with the plain reply` | negative | red |
| `change-state AC-1 command: an unknown option and a stray word exit 3 with the plain reply` | negatives | red |
| `change-state AC-2 command: every open change and every change the run file lists, each once, in id order` | the spec's six-id fixture | red |
| `change-state AC-2 command: a slice, a change archived on the default branch and one the run file announced archived are not listed` | negatives | red |
| `change-state AC-2 command: nothing in play prints an empty list` | edge | red |
| `change-state AC-4 facts: runFactsOf reads each field of the run file` | subtests per field: `sessionMode` (with and without the roadmap line), `started` (record, `after`), `inflight` (cleared by `after`), `declared`, `waits` (`starting`, `waits-turn`, `waits-refused`, and `announced` `archived` false) | red |
| `change-state AC-4 state: S1 to S8 each give their state` | one subtest per row of D-2's table | red |
| `change-state AC-4 command: a roadmap change with no session of its own is running, ready` | S3 through the command, title `📝 a` | red |
| `change-state AC-4 command: a start that waits for a place is running, ready, at the opening` | S7 through the command, title `❓ x` | red |
| `change-state AC-4 command: no run file gives the loop's plain state` | negative | red |
| `change-state AC-4 command: a change off the roadmap gets no ready reason in a session-per-change run` | negative | red |
| `change-state ADR 0017: the documents follow` | D-8: the ADR's headings, status, `Accepted by`, `Amends` line, the four state icons; ADR 0014's header line and Note; ADR 0010's Note; the `ADRs:` line; `docs/openspec-flow.md`'s paragraph `**A change's state.**` | red |

In `plugins/openspec/hooks/roadmap-loop.test.mjs`:

| Name | Proves | Base |
|---|---|---|
| `change-state AC-6 board: each state's row sits in its block` | subtests: owner, running, GitHub (checks and silent), blocked, declared blocked, declared owner wait, no session, in flight; the archived entry in no block | red on the base for silent (no `what.silent` key); passes after phase 1 |
| `change-state AC-6 board parity: every entry kind of entriesOf keeps its block and its words` | the same facts give the same board text as the base's `ownRow`/`runningText` gave, for each kind, both modes, both languages (expected strings written out in the test) | passes on the base and after phase 1 |
| `change-state AC-6 status and state agree: each open roadmap change's block is its state's` | a project with a run file (`addOpen`, `putRun`: one at the grill, one with a stage in flight, one declared blocked, one waiting in flight on GitHub): `status`'s blocks equal the blocks of `change-loop.mjs state`'s entries | red |
| `change-state AC-7 start: a change session starts with its state's title` | `sessionStartOf` through `decideRoadmap`: a grill `🙋 ❓ b`, an agent `📝 a`, an approval `🙋 📝 c` | red |

## D-10 Existing tests this change touches

Changed (each keeps its invariant; the task names it):

| Id | Test (file) | Invariant, layer | Change |
|---|---|---|---|
| E-1 | `change-loop decide: B0 the blocked ends of the stage checker win over the delivery step` (`change-loop.test.mjs`) | the stage checker's blocked ends win over the delivery step; layer `decide` | the `gh-error` and `checks-unreadable` rows leave its table (they are now `change-state AC-5 decide` tests); the three other rows stay |
| E-2 | `followups AC-14 next: every action of change-loop next carries the icon of its stage and its session title` (`change-loop.test.mjs`) | every action carries its stage icon and the title for it; layer `nextAction` | the expected title becomes `action.state.title`: `🙋 ❓ feat` at the grill, `🙋 📝 feat` at the approval, `📝 feat` at the plan stages, `📦 feat` archived; the previous-script action gets `⛔ feat` where it had no title |
| E-3 | `followups F-3 decide: with a session per change the coordinator hands no stage and starts each open change's session in its worktree` (`roadmap-loop.test.mjs`) | the start input is the start tool's eight fields, its title the change's; layer `decideRoadmap` | `b` (a grill) is titled `🙋 ❓ b` in `b.title` and `b.input.title`; `a` stays `📝 a` |

Read and pass unchanged (the task that changes their code names them in its check):

- `change-loop wait: W1` to `W9` and `change-loop wait: a different wait is a different decision …`
  (`change-loop.test.mjs`): W8's `GH_DOWN` is now a silent wait and every assertion holds (D-4).
- `followups AC-14 icon: …` and `followups AC-14 title: sessionTitle is the icon and the id, cut
  under 60 code points` (`change-loop.test.mjs`): the stage table and the two-argument form stay.
- `change-loop replies: no internal term in either language` (`change-loop.test.mjs`): the two new
  keys (D-7).
- Every `roadmap-loop status: …` test, `followups AC-1 status: …`, `followups AC-15 status: …` and
  `roadmap-loop status: nothing written` (`roadmap-loop.test.mjs`): the board's text is unchanged.
- `roadmap-loop replies: every owner wait has a gate` (`roadmap-loop.test.mjs`): `gateOf` is imported
  from `roadmap-loop.mjs`, which re-exports it.
- `followups ADR 0014: the documents follow` (`roadmap-loop.test.mjs`): ADR 0014 gains a header line
  and a Note; the lines it reads stay.
- `followups AC-14 skill: a change session renames its title from the sessionTitle of each next`
  (`roadmap-loop.test.mjs`): SKILL.md is not changed.
- `project-loop wait: it ends when the decision changes and holds no state` and `project-loop next:
  S25 … S26 …` (`project-loop.test.mjs`): `project-loop.mjs` is not changed and `waitLoop` still counts
  its blocked form.
- `change-loop docs: the design records the answers` (`change-loop.test.mjs`), which pinned `v0.22.0`
  in `docs/openspec-flow.md`: the pin moves in this release to `v0.23.0` (task 3.3) and the assertion moves with it
  (`release-rebase pin: the real docs/openspec-flow.md …` ties the pin to the plugin version).

The search behind this list (every suite under `plugins/openspec/hooks/`, `guard.test.mjs` included)
looked for `sessionTitle`, `stageIcon`, `.icon`, `title:`, `boardOf`, `doStatus`, `running.`,
`github-unreadable`, `gh-error`, `checks-unreadable`, `GH_DOWN` and the exit code 2. `flow-check`'s
`a gh error blocks` and `unreadable checks block` cases (`flow-check.test.mjs`) pin the stage checker's own ends, which do
not change. `guard.test.mjs`'s session lines (`one state per pending change`) are the roadmap's line
states, not a change's state, and do not change. Any other existing test that fails is a stop: report
it, do not change it.

## D-11 Documents and release

- `docs/openspec-flow.md`:
  - "**The loop.**" paragraph: one sentence that the action also carries `state`, the change's state
    (link to the new paragraph).
  - "**Waiting on GitHub.**" paragraph: the sentence "A failed `gh` call is retried; three in a row
    end the wait." becomes: a GitHub that does not answer is itself a wait on GitHub ("GitHub did not
    answer"); a failed read is retried, and three in a row end the wait blocked, quoting GitHub's
    error.
  - A new paragraph after "**Waiting on GitHub.**", starting `**A change's state.**`: the command
    line of D-3, the JSON of D-3 with its fields, the reason table of D-1, the order of D-2 in one
    sentence, that it writes nothing and prints no run marker, that `/devkit status` places its rows
    by it and that the panels read it; cites ADR 0017.
  - "**A session per change.**" paragraph: the title forms of D-5.
  Do not write the words `(ready, waits for a place)` (a test refuses them).
- `docs/coordination-design.md`: in the section that says the loop ends in one of four states, one
  sentence: the change loop's `state` command gives each change's state, read by `/devkit status`,
  the session titles and the panels (ADR 0017).
- ADR 0017, ADR 0014, ADR 0010, `openspec/config.yaml`: D-8.
- Release: `plugins/openspec/.claude-plugin/plugin.json` 0.23.0; `.claude-plugin/marketplace.json`
  devkit-openspec 0.23.0 and the marketplace 0.27.0; `CHANGELOG.md` `## 0.27.0 — one state per
  change` with one devkit-openspec line (the `state` command, the GitHub wait, the title, the board)
  and a Docs line (ADR 0017); then `python3 scripts/gen-catalog.py`. Take the next versions after
  `main`'s if another change merges first. The CI pin lines in `docs/openspec-flow.md` move to
  `v0.23.0` in this release, with `setPins` of `release-rebase.mjs` (the release tests tie the pin to
  the plugin version) and the assertion of `change-loop docs: the design records the answers`.

## Proof map

| AC | Proven by |
|---|---|
| AC-1 | `change-state AC-1 command: …` (five tests) |
| AC-2 | `change-state AC-2 command: …` (three tests) |
| AC-3 | `change-state AC-3 state: …` (eight tests) and `change-state AC-3 cli: next and state give the same state …` |
| AC-4 | `change-state AC-4 facts …`, `… state: S1 to S8 …`, the four `… command: …` tests |
| AC-5 | the eleven `change-state AC-5 …` tests |
| AC-6 | `change-state AC-6 board …`, `… board parity …`, `… status and state agree …`, and the existing board tests unchanged |
| AC-7 | the eight `change-state AC-7 …` tests, E-2, E-3 |

Every AC is proven in this change by tests; the rename of a live app session to the new titles is
seen in the next change a roadmap run starts (SKILL.md Loop 1a is unchanged and its text test passes).

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| `boardOf`'s rows change words for a case no test pins | LOW × MEDIUM | the parity test runs every entry kind through both placements with written-out strings; the existing board tests run unchanged |
| A `gh` that is missing or not signed in waits three polls before it shows as blocked | MEDIUM × LOW | the blocked reply quotes gh's error; the wait's interval is the existing one |
| The delivery checker's own GitHub failures (before the delivery stage, on the archive branch) still end blocked | MEDIUM × LOW | a Non-Goal, recorded in ADR 0017's consequences; `change-state AC-5 build` (`change-loop.test.mjs`) pins what the base gives; a later change can carry the failure's kind |
| Moving the run file's reader breaks an importer | LOW × MEDIUM | `roadmap-loop.mjs` re-exports the same names; the whole suite runs in the last gate |
| `state` for all changes is slow (one `next` per change) | MEDIUM × LOW | the same reads `/devkit status` already makes; no extra gh call per change beyond `next`'s |
| A parallel change takes ADR 0017 or version 0.23.0 first | MEDIUM × LOW | `CONTRIBUTING.md` step 5: take the next free number and version at merge, renumbering the references |
| The state command prints a run marker and starts a run lock | LOW × HIGH | `change-state AC-1 command: the output holds no run marker` |

## Migration Plan

No data: nothing is stored, and the run file gains no field. A project picks the change up with the
release. Rollback: revert the pull request; `next` returns to the blocked GitHub end and the titles
to the stage icon alone, with no file to clean.

## Implementation plan

Dependency order: the state helper and the loop's rules (`change-loop.mjs`) → the command (the
same file) → the board and the start title (`roadmap-loop.mjs`) → documents and release.

**Per surface.**

- Hooks (`change-loop.mjs`): the moved run-file reader and gate table, `runFactsOf`, `changeState`,
  `STATE_ICON`, `githubSilent`, `sessionTitle`'s third argument, `decide`'s silent wait, `whereOf`,
  `waitLoop`, `nextAction`'s `state` and title, `stateEntries`, the `state` subcommand, `USAGE`, two
  message keys.
- Hooks (`roadmap-loop.mjs`): imports and re-exports, `boardOf` by state, `sessionStartOf`'s title.
- Skill: none. Workers/integrations: none (GitHub is read through the existing `gh` calls).
- Docs and release: D-8, D-11.

**File structure.**

- Create: `docs/adr/0017-a-change-state-is-derived-in-one-place.md`.
- Modify: `plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/roadmap-loop.mjs`,
  `plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/hooks/roadmap-loop.test.mjs`,
  `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`,
  `docs/adr/0010-openspec-as-the-harness.md`, `openspec/config.yaml`, `docs/openspec-flow.md`,
  `docs/coordination-design.md`, `plugins/openspec/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md` (generated).
- Delete: none.

**Estimate.** Optimistic 7 h · likely 11 h · pessimistic 17 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Phase 1 tests (AC-3, AC-5, AC-7, AC-4 facts and S1 to S8) | 3 | Testing | MEDIUM |
| The move, `runFactsOf`, `changeState`, `STATE_ICON`, `sessionTitle` | 1.5 | Core | LOW |
| `githubSilent`, `decide`, `whereOf`, `waitLoop` | 1 | Core | MEDIUM |
| E-1, E-2 | 0.5 | Testing | LOW |
| Phase 2 tests (AC-1, AC-2, AC-4 command, AC-3 cli, AC-6, AC-7 start) | 2 | Testing | MEDIUM |
| `stateEntries`, the `state` subcommand | 1 | Core | LOW |
| `boardOf` by state, `sessionStartOf`, E-3 | 1 | Integration | MEDIUM |
| ADR 0017, Notes, config line, ADR test | 0.5 | Documentation | LOW |
| `docs/openspec-flow.md`, `docs/coordination-design.md` | 0.5 | Documentation | LOW |
| Release files, catalog, validation, whole suite | 0.5 | Integration | LOW |

**Assumptions** (where the plan breaks if reality differs):

- The stage checker's `gh-error` and `checks-unreadable` are the only GitHub ends the loop meets at
  the delivery stage, because `decide` takes the stage checker's blocked end first (`change-loop
  decide: B0 …` in `change-loop.test.mjs`, `change-loop.mjs#decide`).
- In the plan part the loop reads GitHub only through `collectFlow`'s post-merge check, whose error
  only turns that check off (`flow-check.mjs#collectFlow`); `change-state AC-5 plan` (`change-loop.test.mjs`) pins it.
- The run file's fields are the ones ADR 0013 decision 4 names (`followups AC-3 run file: …` in `roadmap-loop.test.mjs`);
  this change adds none.
- Node's `--test-name-pattern` repeated runs the tests matching any of the patterns (the gates of
  `roadmap-coordinator-followups` use it).

**Dependencies.** `managed-agents-study` (archived, item F-1); ADR 0010, ADR 0013 decision 4, ADR 0014
(accepted). `coordination-panels` depends on this change.

## Decisions cited

ADR 0010 (decision 3, the four ends with a reason; decision 6, the state in the repository and
GitHub; decision 8, no session that remembers), ADR 0011 (the run detection the locks keep, untouched),
ADR 0013 (decision 4, the run file's fields), ADR 0014 (decisions 1 and 2 kept; decision 3 amended by
ADR 0017, proposed here). No open decision of the log is touched.

## Open Questions

None.
