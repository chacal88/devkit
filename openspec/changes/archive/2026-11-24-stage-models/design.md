<!-- devkit-stage design result=passed attempt=1 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Design

Change: `stage-models` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (sources:
`requirements.md`, `decisions.md`, ADR 0023, `proposal.md` and the four spec deltas of this change).

## Context

See `proposal.md` (Why). The code this change touches, read at `19c0196` (devkit-openspec 0.29.0):

| Piece | Where | What it does today |
|---|---|---|
| Settings parser | `plugins/openspec/hooks/guard.mjs#parseDevkitBlock`, `#plainValue` | Reads the top-level `devkit:` block into `{ driver, language, budget, delivery: { model, base, test_branch } }`; one nested level, for `delivery:` only; other keys ignored |
| Project settings | `plugins/openspec/hooks/change-loop.mjs#readDevkitSettings`, `#projectGate` | Lists bad values in `unknown`; `projectGate` answers the first with mode `setting-unknown` in `start`, `open`, `roadmap-loop.mjs run`/`status` and `project-loop.mjs` (all exit 0 with the mode) |
| Change settings | `change-loop.mjs#budgetOf` | Reads `budget` from the change's `.openspec.yaml` and the project's file; an invalid value is a `LoopRefusal` (`next` exits 3 with `{ version, error, reply }`) |
| The decision | `change-loop.mjs#decide`, inner `agent`, `sessionAction`, `guard` (K1 no progress, K2 not delivered), `hold` (budget) | Pure; every `agent` action has `agent`, `brief`, `progressKey`; no model anywhere |
| The brief | `change-loop.mjs#decide`, inner `brief` | `Change <id> (<script> script), stage <stage>: <what>. Work only in <root> on branch <branch>; ... Write the change's files in <Language>.`, plus `ATTRIBUTION_ASK` for the commit agent |
| `next` | `change-loop.mjs#nextAction`, `#runNext` | Reads files, git, GitHub; `runNext` passes `budget: true`; the locks, `wait`, `state` and `roadmap-loop.mjs` call `nextAction` without it |
| Transcripts | `guard.mjs#transcriptEvents`, `#sessionTranscript`, `#spentOf`, `#tokensOf`, `#runMarkers`, `#marksOf` | The budget's one reader (change-budget D-2, D-3); skips `isSidechain` user lines, so a subagent file's prompt is never read |
| A failed agent | `plugins/openspec/skills/devkit/SKILL.md`, Loop `agent` item and step 3 of "Every change in this session" | The session declares `reply blocked ... why=role-failed`; the loop never sees the failure |
| Roadmap sessions | `plugins/openspec/hooks/roadmap-loop.mjs#sessionStartOf`, `#decideRoadmap`, `#collectRoadmap`, `#decide`, `SESSION_KEYS`; `change-loop.mjs#readRun`, `#emptyRun` | `session-start` with an eight-field `input`; `startedSessions: { <id>: { at } }`; an own-session change's action is not read except for the board |
| Readouts | `plugins/openspec/hooks/flow-check.mjs#renderText`, `#main`; `roadmap-loop.mjs#boardOf`, `#statusCmd` | Plain text; no spend |

What the host records, observed on 2026-11-23 in the desktop app, on this change's own session and
its two stage subagents (field names and counts only, no content):

- The Bash environment of a subagent holds the parent session's `CLAUDE_CODE_SESSION_ID`; the
  parent's transcript is `<config>/projects/<folder>/<id>.jsonl`, where `<folder>` is the session's
  working folder with every character outside `[A-Za-z0-9]` written as `-`
  (`/home/u/repos/devkit/.claude/worktrees/stage-models` gives `-home-u-repos-devkit--claude-worktrees-stage-models`).
- Each subagent has `<id>/subagents/agent-<n>.jsonl` and `agent-<n>.meta.json` (it may also have
  `agent-<n>.prefix.json`). Every line of the `.jsonl` has `isSidechain: true`; its first `user`
  line holds the Agent call's prompt as a string, starting with the loop's brief.
- Every `assistant` line has `message.model`, a model id such as `claude-opus-5-5` or
  `claude-sonnet-5-5`; the parent's lines here carried `claude-sonnet-5-5` and the subagents'
  `claude-opus-5-5` (their frontmatter model, since the Agent calls passed no `model`).
- The Agent calls of this run carried `description`, `prompt` and `subagent_type` only.

The host's session tools, checked live by the conducting session on 2026-11-23 (the schemas the
desktop app gives the tools, no call made):

- `mcp__ccd_session__start_session` has an optional `model` field, honoured with `context: "fresh"`
  only (the start input of `sessionStartOf` always sends `fresh`): a model id of the same family as
  the starting session's or cheaper. A higher one is ignored, and the session then starts as it
  would with no `model` field (the host's default; the first two-machine run's sessions started on
  `opus[1m]`). So the coordinating session's own model caps the model a change session starts on
  (D-6 "The start").
- `mcp__ccd_session_mgmt__set_session_model` takes `session_id` and `model`. It is refused for the
  calling session, and it asks the user before a switch to a more expensive model (none before a
  cheaper one).

Not checked before code: the Agent tool's `model` parameter taking `opus`, `sonnet` and `haiku`
and overriding the agent's frontmatter `model:` (A-3). Task 1.1 probes it with one real Agent call
before any code of this change is written; a failed probe stops the change for a plan revision.

## Goals / Non-Goals

**Goals:**

- One table, one resolver: every model the loop prints comes from `modelsOf` (D-2) and the ordering
  of D-1.
- Nothing stored for the retry or the spend: both are read from the transcripts (ADR 0023 decisions
  5 and 6, ADR 0010 decision 3).
- With no `models:` key and no failure, every action is what it is today plus its `model` field.

**Non-Goals:**

- `project-loop.mjs` and `/devkit project` (its hand-offs keep their frontmatter models).
- The review round's reviewers and verifiers (`review-change`; their frontmatter models).
- The coordinating session's own model, and any switch up.
- Counting the spend in a lock or in `wait`.
- Changing an agent's `model:` frontmatter.

## D-1 The table (AC-1, AC-4; spec `stage-models`)

**Keys.** `requirements.md` left two options (AMBIGUOUS, "the planner resolves"): (a) the schema's
artifact ids plus `implement`, `deliver` and `archive`, or (b) the agent names. This design takes
(a) in the form the loop already speaks: the stage ids of `plugins/openspec/schemas/devkit/flow.json`
and `plugins/openspec/schemas/devkit-lite/flow.json` but `open`, which are the `stage` field of every
action `next` prints. `implement`, `deliver` and `archive` are those flows' `implementation`,
`delivery` and `retro` (the archive steps are steps of the retro stage, `change-loop.mjs#ROWS`).
Option (b) is rejected: one agent serves several stages (`tdd-implementer` for the implementation's
seven steps), and the grill, the approval, the review and the retro have no agent.

`MODEL_STAGES` (new, exported, `change-loop.mjs`), in flow order:
`requirements, mockup, decisions, proposal, specs, design, tasks, readiness, approval, implementation,
unit-tests, e2e-tests, evidence, review, delivery, retro`. A test (D-12) asserts it equals the union
of the two flows' ids minus `open`, so a new stage cannot be left out.

**Default.** `DEFAULT_MODELS` (new, exported, frozen):

| Stage | Model | ADR 0023 decision 1 says |
|---|---|---|
| `requirements` | `opus` | the grill |
| `decisions` | `opus` | the ADRs |
| `proposal`, `specs`, `design`, `tasks` | `opus` | the plan |
| `mockup` | `sonnet` | not named; the screen designer's frontmatter model |
| `readiness` | `sonnet` | review |
| `approval` | `sonnet` | coordinate (the `accept-decisions` session step) |
| `implementation` | `sonnet` | implement |
| `unit-tests` | `haiku` | the unit-test run |
| `e2e-tests` | `sonnet` | not named; writing tests is not mechanical |
| `evidence` | `sonnet` | deliver (the verifier proves the acceptance criteria) |
| `review` | `sonnet` | review |
| `delivery` | `haiku` | the commit and pull-request hand-off |
| `retro` | `sonnet` | coordinate |

"Validation" (ADR 0023 decision 1, AC-1) has no stage of its own in either script: the
`openspec-validator` helper runs inside the plan stages and already declares `model: haiku`
(`plugins/openspec/agents/openspec-validator.md`). AC-1's "validation" is met by that helper and
gets no row; the test of AC-1 checks every row above.

**Session-run stages.** `SESSION_RUN_STAGES` (new, exported, frozen, `change-loop.mjs`), in flow
order: `requirements, approval, review, delivery, retro`. They are the stages a change session
performs itself (ADR 0023 decision 4): the grill, the owner's approval (`accept-decisions` and the
approval gate), the review round the session conducts, the delivery steps (the merge, the waits on
GitHub, the release-conflict hand-off's follow-up) and the retro. Every other stage runs as a stage
subagent. Only the step-down floor reads this list (D-6); it does not change the action of any stage.
A D-12 test asserts each entry is in `MODEL_STAGES`.

**Values and their order.** `MODEL_VALUES = ['haiku', 'sonnet', 'sonnet[1m]', 'opus', 'opus[1m]']`
(new, exported), cheapest first. `modelRank(value)` is the index, `-1` for anything else.
`cheaper(a, b)` is `modelRank(a) < modelRank(b)` when both are known, else false.
`familyOf(value)` strips `[1m]`. `oneUp(value)`: `haiku` → `sonnet`, `sonnet` → `opus`,
`sonnet[1m]` → `opus[1m]`, `opus` and `opus[1m]` → `null`. `haiku[1m]` is not a value (AC-4).
`strongest(values)`: the value of highest `modelRank` among the known ones, `null` when none is
known.

## D-2 Reading the table (AC-2, AC-3; spec `stage-models`)

**The parser** (`guard.mjs#parseDevkitBlock`). The block gains `models`, a `Map` from each key
written under a `models:` line of the block to its `plainValue` (or `undefined` when empty), in file
order, a later duplicate winning. The rules of the nested level are `delivery:`'s: a line indented
deeper than the block's keys belongs to the last key at the block's level; a `models:` entry nested
one level deeper still is ignored. A `models:` line with an inline value (`models: opus`) records
the key `''` with that value, which D-2's check refuses. An empty file, no block, or no `models:` line
gives an empty `Map`. CR is dropped and a missing final newline is fine, as today. The other keys of
the result keep their values (the `delivery-models` parser tests stay as they are).

**The check.** `modelProblems(map)` (new, exported, `change-loop.mjs`) returns the problems in map
order: a key not in `MODEL_STAGES` gives `{ setting: 'model-stage', value: <key, or the inline value
when the key is ''>, accepted: MODEL_STAGES.join(', ') }`; a non-empty value not in `MODEL_VALUES`
gives `{ setting: 'model-value', value: '<stage>: <value>', accepted: MODEL_VALUES.join(', ') }`.

**The project.** `readDevkitSettings(root)` appends `modelProblems(block.models)` to `unknown`,
after the budget's and before the tests'. So `start`, `open`, `/devkit roadmap`, `/devkit status`
and `/devkit project` answer mode `setting-unknown` for a bad project table (AC-3), through
`projectGate` as for every setting today. This refusal is the only effect of this change on
`/devkit project`: it is intended, since the table is a project setting and `projectGate` checks
every project setting before any command runs; `project-loop.mjs`'s hand-offs carry no model
(Non-Goals). D-12 tests it.

**The change.** `modelsOf(root, dir, { strict })` (new, exported): reads
`join(dir, '.openspec.yaml')` and `join(root, 'openspec', 'config.yaml')` with `settingsText` and
`parseDevkitBlock`. With `strict`, the first problem of the change's map, else of the project's,
throws `new LoopRefusal('setting-unknown', render(lang, 'setting-unknown', problem))`. Without it,
a map with any problem is ignored whole (the project's or the change's), so a lock or the roadmap
never stops on a change's typing error: a lenient reader takes the next layer for every stage
(spec `stage-models` scenario "A bad change table outside the change's own loop"). It returns a plain object over `MODEL_STAGES`: the change's
non-empty value, else the project's, else `DEFAULT_MODELS`'s.

**Where it is read.** `nextAction` gains the option `strictModels = false` and always calls
`modelsOf(found.root, dir, { strict: strictModels, lang })` after `readDevkitSettings`, before the
budget. `runNext` passes `strictModels: true`, so `next` exits 3 with the settings reply on a bad
table in either file (AC-3); every other caller is lenient. The facts passed to `decide` gain
`models`.

AC-3 says `start` and `next` "exit 3". `start` answers every settings problem with exit 0 and the
mode `setting-unknown` (`change-loop.mjs#runStart`; the skill's Start section says the reply and
ends the turn); this design keeps that contract and reads AC-3's `start` half as that mode, which
names the setting and the accepted values. `next` exits 3.

## D-3 The model on every action (AC-5, AC-8, AC-9; spec `stage-models`)

In `decide`, `stageFields(id)` gains `model: facts.models?.[id] ?? undefined` (omitted when the stage
has no row, as for `open` or a `null` stage). So every action and every end whose `stage` is in the
table carries `model`; an `agent` action always does, since every agent stage has a row. `decide`
called without `models` (old tests' facts) prints no `model`, which keeps those tests as they are.

The session's side (`SKILL.md`, D-9): the Agent call sets `model` to the action's `model` with a
trailing `[1m]` removed. That is how a stage above the session's model runs on its model (AC-8):
`decide` never returns anything that switches a session, and `change-loop.mjs` has no action kind
for it (AC-9).

## D-4 Reading a subagent's run (AC-10, AC-11)

In `guard.mjs`, beside `spentOf`:

- `familyOfId(id)` (new, exported): `opus`, `sonnet` or `haiku` when the model id string holds that
  word (case-insensitive), else `null`.
- `handOffKey(text)` (new, exported): the text from its start through the first match of
  `/\. Write the change's files in [^.\n]+\./` (the brief's last sentence, `decide`'s inner `brief`;
  `[^.\n]+` and not letters and spaces, because `filesLanguageName` gives the raw tag, such as
  `zh-CN`, for a language it has no name for), else `null`. The prompt of a hand-off starts with the brief and may carry appended sentences
  (the dispatch sentence, the attribution block); the key cuts them off. The commit agent's
  `ATTRIBUTION_ASK` comes after that sentence, so it is cut off too.
- `subagentRun(file)` (new, exported): one pass over the lines of `file`, each parsed with
  `JSON.parse` in a `try` (a cut-off or broken line is skipped). It returns `null` when the file
  cannot be read, else `{ start, prompt, family, failed, usage }`:
  - `start`: the first string `timestamp` of any line, else `null`;
  - `prompt`: the first `user` line's `message.content` when a string, or the joined `text` of its
    `text` blocks when an array, else `null`;
  - `family`: `familyOfId` of the newest `assistant` line's `message.model`, else `null`;
  - `failed`: true when the newest `assistant` line holding a `text` block has, in its text, a line
    matching `/^[ \t>*_`]*Outcome:[ \t*_`]*failure\b/m`; an empty file or one with no text is false;
  - `usage`: `[{ id, tokens, family }]` of the `assistant` lines with a `message.usage` object,
    `id` the line's `message.id`, `tokens` by `tokensOf`, `family` by `familyOfId` of the line's
    `message.model`.
- `handOffsOf(transcript, since)` (new, exported): the `subagentRun` of every `agent-*.jsonl` of
  `join(dirname(transcript), basename(transcript, '.jsonl'), 'subagents')`, sorted by `start` then by
  name, keeping those whose `start` is a string `>= since` (all when `since` is `null`), each with its
  `key: handOffKey(prompt)`; a folder that cannot be listed gives `[]`.
- `typedSince(transcript)` (new, exported): the `at` of the newest `typed` event of
  `transcriptEvents(..., { usage: true })` whose name is `devkit` (bare or plugin-scoped) and whose
  verb is not `status` (`isDevkitVerb(event.typed, 'status')` false, as `roadmapRunOf` skips it),
  else `null`; `null` too when the file cannot be read. A `/devkit status` typed mid-run so neither
  starts a new window nor erases a failure record.

## D-5 The retry, in the decision (AC-10, AC-11; spec `stage-models`)

`nextAction` gains two options: `retry = false` and `handOffs` (a list already read). With
`handOffs` given, the fact `handOffs` is that list; else, with `retry` and a session transcript
(`sessionTranscript(env)`), it is `handOffsOf(path, typedSince(path))`; else `null`. `runNext` passes
`retry: opts.after !== undefined`: `next` reads the hand-offs (the window's transcript and the
subagent folder) only when it is called with `--after`, the call the session makes after a stage
agent returns, success or failure. A `next` with no `--after` (the first call of a run, a call after
a session step that carries no key) reads no hand-off, so with no budget set it reads no transcript at
all, as before this change (the owner's choice of 2026-11-23, after phase 2 found that the kept
change-budget AC-4 test contradicts a `next` that always reads; D-11). `nextAction`'s own `retry`
option keeps its meaning (read when asked); only `runNext`'s argument depends on `--after`. The
locks, `wait` and `state` pass neither, so they read no subagent folder.

Every failure path already passes the key: the skill reports an agent's `Outcome: failure` with
`--after` as after any agent (D-9), and every retry and failure scenario of the specs (`stage-models`,
`change-coordination` "A failed stage agent", `roadmap-coordination`) calls the loop with the failed
action's progress key. The one case a call with no `--after` meets a failure in the window is a
session that calls `next` again without the key (a run resumed after a session step, or a driver that
drops the key): it gets the stage on its table model as a first hand-off, not the retry, and the
failure stays in the window, so the next call with `--after` counts both runs in a row (a second
failure ends the run blocked). That is accepted: it spends at most one extra hand-off, and the
alternative reads a transcript on every `next`.

`collectRoadmap` (`roadmap-loop.mjs`) gains the option `retry = false`, beside D-6's `models`.
Only `runCmd` and `nextCmd` pass `retry: true`; the stop lock (`roadmapStopDecision`, the
`collectRoadmap` call at `wheres: 'none'`) and `statusCmd` do not. With `retry` true and
`run.changeSessions` false (the one-session mode, where the coordinating session hands the stages
and its transcript holds their subagents), `collectRoadmap` reads the session transcript once,
`handOffs = handOffsOf(path, typedSince(path))`, and passes that list as `handOffs` to each
`nextAction` it calls; with sessions per change it reads nothing (each change session runs its own
`next`, which reads its own transcript when called with `--after`). So no lock reads a hand-off
(D-11's "the locks read no model and no hand-off" holds), and the stop lock's decision is the same
with or without a subagent folder (D-12 test). The roadmap's reading does not depend on `--after`:
one read serves every change of the call, `run` opens its window at the `/devkit roadmap` the owner
just typed (so it finds no hand-off after it), and no roadmap test expects `next` to read no
transcript; task 2.4 stands as built.

In `decide`, the inner `agent` becomes:

```js
const agent = (stage, role, step, what, detail, named) => {
  const id = named ?? AGENT[role];
  const action = { ...base, kind: 'agent', ...stageFields(stage), agent: id, ...(step ? { step } : {}), ...(detail ? { detail } : {}),
    brief: withAttribution(id, brief(stage, what, detail)), progressKey: key(stage, step) };
  const again = retried(action);
  return again ? hold(again) : hold(guard(action));
};
```

`retried(action)` (inner, pure) reads `facts.handOffs`:

1. `null`, or no record whose `key` equals `handOffKey(action.brief)`: return `null`.
2. `runs` = those records, newest last; `failures` = how many of the newest are `failed` in a row.
   `0`: return `null`.
3. `last` = the newest; `from` = `last.family ?? familyOf(action.model)`; `up` = `oneUp` of `from`,
   with `[1m]` added when `action.model` has it.
4. `failures === 1` and `up` is not `null`: return
   `{ ...action, model: up, retry: { failedOn: from, attempt: 2 } }`, with the same `progressKey`.
5. Otherwise: `blocked('role-failed', { stage: titleOf(action.stage) }, action.stage)`.

The retry comes before `guard`, so the progress key the session passes after the failure gives the
retry, not a no-progress end. `hold` applies to the retry like any hand-off, and its tokens are in
the budget's count because `spentOf` sums every subagent of the session (AC-11). A blocked end is
exit 2 with `devkit-end: <id> blocked` (`loopOutput`), so the session declares nothing (spec
`change-coordination`, MODIFIED). The window from the newest typed `/devkit` command other than
`/devkit status` makes a new `/devkit change` start fresh (spec scenario "A new typed command starts
fresh": its first `next` has no `--after` and reads nothing, and every later call with `--after` reads
only the runs after that command), while a status check typed mid-run keeps the window (D-4
`typedSince`).

Without a readable transcript the run behaves as before this change except for who ends it: the
session no longer declares `role-failed`, so a call with the failed action's key ends for no
progress (K1), or not delivered (K2) when the stage file is pending.

**The retry's reach (review round 1).** `retried` matches the newest runs by `handOffKey` of the
action `decide` would hand now, so a retry happens only when that action is the same hand-off as the
failed one: the stage checker still names the same stage with the same reason, which holds when the
subagent stopped with `Outcome: failure` and wrote no stage file (or left it `pending`). That is the
retry's whole reach: a stage agent that could not finish. A stage agent that finished its work and
recorded `result=failed` in its stage file is a failed stage, not a failed agent: `flow-check`
offers the stage's `onFail` with `fix-after-failure`, so `decide` builds a different brief (the
implementer's `fix-tests` after `unit-tests` or `e2e-tests`, `testStageStep`; "revise the plan from
its findings" after a plan stage, `planPart`), on that action's own table model, and `retried` finds
no run of that brief and hands no retry. The other two answers of `flow-check` to a failed stage
(`flow-check.mjs:633-637`) hand no retry either: a stage at its ceiling ends blocked with the
ceiling's reason (`ceiling-reached`), as it did before this change (spec scenario "A test stage
recorded as failed at its ceiling", pinned by the task 5.1 test), and a failed test stage whose
code changed since is run again (`rerun-after-fix`) with the "run it again" brief on the stage's
table model, a brief other than the failed one, so `retried` finds no run of it (covered by the
existing `rerun-after-fix` tests of `flow-check.test.mjs` and `change-loop.test.mjs`; no new
scenario). Its last line (`Outcome: failure` or another) does not
matter. The `subagent-stop` hook (`guard.mjs subagent-stop`, `subagentStopFor` U2, `refuseOnce`)
refuses the first stop of a stage agent whose stage file does not exist and asks it to write the
file, so an agent that obeys it records a result and takes the fix path; one that stops again
without the file takes the retry. This is the code as built at `e057874` and it is kept: a red test
stage needs a code fix, not a stronger test runner, and the fix path already counts its attempts
against the stage's ceiling. No product code changes for it; the spec (`stage-models`, "Only a
stage subagent that could not finish is retried", scenarios "A failure with a written result=failed
file", "A plan stage recorded as failed" and "A test stage recorded as failed at its ceiling"), a
D-12 test that pins it, D-13's real run 3 that shows it with a real agent, D-13's stub text and the
D-10 words state it. The narrowing is a reading of the owner's AC-10 and of ADR 0023 decision 5,
which the owner accepts at plan approval (`proposal.md`, the resolved criteria and readings).

## D-6 The roadmap: start model and step-down (AC-6, AC-7; spec `roadmap-coordination`)

**The start.** `sessionStartOf` adds `model: a.model` to `input` when the action carries one (the
ninth field). `a` is the change's current action, so a new change's start carries the grill's model.
The input already holds `context: 'fresh'`, the only context in which the host honours `model`
(Context, checked 2026-11-23). The host honours it only when it is of the coordinating session's
family or cheaper; a higher one is ignored and the session starts on the host's default. The loop
does not read the coordinating session's model (it is the owner's, ADR 0023 decision 4) and always
sends the stage's model. The run records that model (below) whether or not the host honoured it.
That record is safe for the step-down: a session that ignored the field runs on the host's default,
which is not cheaper than the recorded model in any start observed (`opus[1m]`), so every switch the
step-down rule returns is to a model cheaper than the session's real one and asks nothing (A-2's
checked fact). The one loss is a session on `opus[1m]` recorded as `opus`, which a stage at `opus` does
not switch down to `opus`; the Troubleshooting row of D-10 names it (open the coordinating session on Opus to
start a change at its grill on Opus).

**The record.** `readRun` keeps, in each `startedSessions` entry, `model` and `refused` when they
are strings in `MODEL_VALUES`, and leaves them out otherwise, so an entry written before this change
reads `{ at }` as today. `SESSION_KEYS` gains `session-found`, `session-model` and
`session-model-refused`. In `decideRoadmap`, `state.sessionsStarted` becomes
`[{ id, model }]`: `session-start` gives the action's `model` (or none), `session-found` gives none.

**`session-found` is a start everywhere a start is read.** Today the skill reports a session the
app already lists as `--after <id>=session-start`; this change gives it its own key so that no model
is recorded for it, and every site that tests for `session-start` tests for either key, through one
helper `startedNow = (key) => key === 'session-start' || key === 'session-found'` (inner,
`roadmap-loop.mjs`):

- `entriesOf` (the `own` entry, `f.after?.[id] === 'session-start'` today): a found session's
  change is `own`, so it gets no second `session-start` action and is not read as a stage;
- `collectRoadmap` (the skip of a started change's action, `after[line.id] === 'session-start'`
  today): a found session's change is not read for a stage action;
- `decideRoadmap`'s `sessionsStarted` filter (`f.after?.[e.id] === 'session-start'` today), which
  feeds both the run file's record and the announcement: a found session is recorded (with no
  model) and announced with `roadmap-session-started`, once, as it is today when the skill reports
  it as a start. The owner sees the same line whether the coordinating session started the session
  or found it.
`state.sessionModels` (new) lists `{ id, model }` for each `--after <id>=session-model` (the model of
that change's switch target in this decision's facts) and `state.modelsRefused` (new) `{ id, model }`
for each `session-model-refused`. The writer in `roadmap-loop.mjs#decide` sets
`startedSessions[id] = { at, model? }`, then `startedSessions[id].model = model` and deletes
`refused` for each switch done, and sets `startedSessions[id].refused = model` for each refusal.

**The fact.** `collectRoadmap` gains the option `models = false` (beside D-5's `retry`); `runCmd`
and `nextCmd` pass `true` (the stop lock and `statusCmd` do not). With it and `run.changeSessions`,
each open line that is an own-session change and whose record has a `model` is read three ways, each
lenient: its action with `nextAction` (no budget, no retry, no strict models), its table with
`modelsOf(root, dir, { strict: false })`, and its script's stage order with
`readFlow(root, changeSchemaAt(root, dir))?.stages.map((s) => s.id)` in a `try` (both functions
already imported by `roadmap-loop.mjs`; `MODEL_STAGES` when it throws or gives nothing), `root` being
the change's checkout and `dir` its folder (`locateChange`). Then `stageModels[id] = { stage:
action.stage ?? null, models, stages }`; nothing else of the action is used, and `actions` is
unchanged. A `LoopUsageError` of the action's read leaves the id out (no switch for it on that
decision). `roadmap-loop.mjs` imports `modelsOf`, `MODEL_STAGES`, `MODEL_VALUES`,
`SESSION_RUN_STAGES`, `cheaper` and `strongest` from `change-loop.mjs`.

**The step-down rule, in one place.** `stepDownOf({ current, stage, models, stages, refused })`
(new, exported, `roadmap-loop.mjs`, pure) is the only code that says whether a change session is
switched and to what: it returns the model to switch to, or `null`. It builds ADR 0023 decision 4
with the owner's floor of 2026-11-23:

1. `null` when `stage` is `null` or `models[stage]` is not a value of `MODEL_VALUES`.
2. `ahead` = the entries of `stages` at or after `stage` (by index in `stages`; all of `stages` when
   `stage` is not in it) that are in `SESSION_RUN_STAGES` (D-1).
3. `floor = strongest([models[stage], ...ahead.map((s) => models[s])])`: the strongest model among
   the new stage and the session-run stages still ahead of it.
4. Return `floor` when `cheaper(floor, current)` and `refused !== floor`, else `null`.

So the target of a switch is the floor, never the stage's own model when a session-run stage ahead is
stronger; a change session never goes from Sonnet to Haiku while a session-run stage on Sonnet is
ahead, and the table's Haiku rows reach only the stages handed to subagents. With the default table
(D-1) a `devkit` change session started at its grill on Opus stays on Opus while its change is at a
stage on Opus (the stage's own model is part of the floor), is switched once to Sonnet at the first
later stage on Sonnet (the mockup when the change has one, else the readiness review; the floor is
then Sonnet, from that stage, the approval, the review and the retro; the plan stages still ahead
run as subagents on Opus, D-3), and stays on Sonnet to the end: at the unit tests and at the
delivery, both Haiku, the floor is Sonnet (the review and the retro, or the retro alone, ahead). A
`devkit-lite` change has no `approval` and steps down at its first Sonnet stage, the implementation,
with the same result. Its comment, its D-12 tests (the "Roadmap" group's step-down rows) and the
spec requirements "A change session only steps down", "A change session's floor is set by the
session-run stages ahead" and "A stage above the session's model never switches it" are the only other places that state the rule.

A stage whose model is above the session's current one is never a switch (`stepDownOf` returns only
cheaper models): when it runs as a stage subagent, `decide` hands it on its model (D-3, AC-8); when it
is a session-run stage, the session performs it on its current model. Because the floor holds every
session-run stage ahead, that happens only where ADR 0023's Consequences accept it: a session whose
start model the host ignored (it runs on the host's default, which is not cheaper; D-6 "The start"),
a session found already running (no known model, never switched), a refused switch, or a table that
puts a stronger session-run stage after a weaker stage at which the session started (a change
resumed at its implementation starts on Sonnet, and a project table with `retro: opus` has that
retro performed on Sonnet).

**The decision.** After the actions and the withholding of `decideRoadmap`, while not stopping, for
each entry in state `own` with `f.stageModels[id]` and `f.startedSessions[id]?.model`:
`to = stepDownOf({ current: startedSessions[id].model, ...stageModels[id], refused:
startedSessions[id].refused })`. When `to` is not `null`, push
`{ change: id, kind: 'session-model', cwd: <the change's root>, model: to, progressKey: 'session-model' }`.
The switch is pushed after `withhold` empties the actions, so it is carried out on any turn. No other
path returns it: never upward (AC-7), never in `change-loop.mjs` (AC-9).

**The session's side** (`SKILL.md`, D-9): load `select:mcp__ccd_session_mgmt__list_sessions` and
`select:mcp__ccd_session_mgmt__set_session_model`; find the row of `list_sessions` `{ "linked": true }`
not archived whose `cwd` equals the action's `cwd`; call `set_session_model` with its `sessionId` as
`session_id` and the action's `model`; then `next ... --after <id>=session-model`, or
`--after <id>=session-model-refused` when no row matches or the call returns anything but success
(the host's question before a more expensive switch never arises, since `stepDownOf` only returns
cheaper targets; a user who declines a question the host asks anyway gives a refusal).
The found-session branch of `session-start` reports `--after <id>=session-found` instead of
`session-start`.

When the stage changes inside one turn of a change session, the coordinating session sees it at that
session's next end-of-turn report (ADR 0014 decision 2); a switch then applies to the session's next
turn. ADR 0023 decision 4 is met at that grain.

## D-7 The spend readout (AC-11, AC-12; spec `spend-readout`)

**The reader** (`guard.mjs#spendOf(transcripts, change)`, new, exported). For each transcript path
(deduplicated):

1. `events = transcriptEvents({ transcript_path }, { usage: true })`; `null` adds nothing.
2. Walk the events with `current = null` and `stage = null`. A `texts` event whose markers
   (`marksOf(event, runMarkers)`) hold `{ run: X }` sets `current = X`; when `X` is `change`,
   `stage` = the `stage` of the JSON after the marker lines of that text (`JSON.parse` of the text
   from its first `{`; a parse error or no string `stage` gives `null`). A `usage` event counts for
   `change` when `current === change`, in `stage`, under `familyOfId(event.usage.model)`, each
   message id once per transcript. The usage scan of `transcriptEvents` gives
   `{ usage: { id, tokens, model }, at }`, `model` being the line's `message.model` when a string,
   else `null` (the only change to `transcriptEvents`; `spentOf` reads `id` and `tokens` as today).
3. Subagents: `handOffsOf(transcript, null)`; a record counts when its `prompt` starts with
   `Change <change> (`; its stage is the `STAGE_OF` match of the prompt
   (`/^Change \S+ \([^)]*\), stage ([\w-]+):/`, moved from `roadmap-loop.mjs` to `guard.mjs` and
   imported back), its usage is summed per family. A record is a retry when the record before it with
   the same `key` failed; its tokens are also listed as `{ stage, from, to, tokens }`.

It returns `{ stages: [{ stage, models: { <family>: tokens } }] in first-seen order, retries: [...],
total }`; a family it cannot tell is `other`, a session message with no stage is stage `null`.

**The transcripts read.** `spendSources(env, root)` (new, exported, `guard.mjs`):
`sessionTranscript(env)` when found, plus every `*.jsonl` directly in
`<config>/projects/<encoded root>/` (D-1's encoding, `<config>` as `sessionTranscript` reads it);
`root` is the change's checkout (`locate`). The main checkout's folder is not read: it holds every
session of the repository.

**The block.** `spendLines(lang, spend, { cap, titleOf })` (new, exported, `guard.mjs`): `[]` when
`spend.total` is 0; else the `spend-head` line, one `spend-stage` line per stage with a stage (or
`spend-stage-none` for the stage `null`), whose `{models}` is `<family> <tokens>` joined by `, `
(families in `MODEL_VALUES` order then `other`), one `spend-retry` line per retry, and
`spend-total` (with a cap) or `spend-total-none`. `{title}` is `titleOf(stage)`, the stage's title
in the person's language as the flow names it; `{from}`, `{to}` and the families are `opus`,
`sonnet`, `haiku` or `other`; numbers are plain digits.

Its texts are `SPEND_MESSAGES` (new, exported, `guard.mjs`, both languages, D-8). `guard.mjs`
cannot call `change-loop.mjs#render` (`change-loop.mjs` imports `guard.mjs`), so `spendLines`
fills the rows itself: `fill(template, params)` (inner) replaces each `{name}` with
`String(params[name])` and throws a `TypeError` naming the key and the parameter when one is
missing. The spend rows use only the parameters `id`, `title`, `models`, `from`, `to`, `tokens` and
`cap`, none of which `render` treats as a code or a stage phrase (its special names are `stage`,
`inStage`, `Stage`, `why` and the `FAMILY` keys), so `render` of a spend row and `fill` of it give
the same text; a D-12 test asserts it for every spend row in both languages. `change-loop.mjs#MESSAGES`
spreads `SPEND_MESSAGES[lang]` into each language, so they are rows of the one message table and its
test ("change-loop replies: no internal term in either language", through `renderings`) renders
them through `render` with `SAMPLE` (D-11).

**The cap.** `budgetValue` moves from `change-loop.mjs` to `guard.mjs` unchanged and is exported
there; `change-loop.mjs` imports it and re-exports it (`export { budgetValue } from './guard.mjs'`
beside its import), so every caller and test that imports it from `change-loop.mjs` is unchanged.
`flow-check.mjs` imports `budgetValue` and `parseDevkitBlock` from `guard.mjs`, which it already
imports; it imports nothing from `change-loop.mjs` (which imports `flow-check.mjs`), so no import
cycle is made.

**Where it prints.** `flow-check.mjs#main`, text output only: after `renderText`, when the readout
is for an existing change, append `spendLines` with the flow's titles and the cap from
`budgetValue` of the change's `devkit:` block's `budget`, else the project's (each read with
`readFileSync` in a `try` and `parseDevkitBlock`; an unreadable file or an invalid value shows no
cap). `roadmap-loop.mjs#statusCmd`: after `boardOf(facts)`, it takes the open ids from
`entriesOf(facts).entries` (those whose state is not `archived`, the set `boardOf` lists), or, with
no roadmap, from `facts.unfinished`; one block per id, indented two spaces under a line with the id,
each from `spendOf(spendSources(env, root), id)` where `root` is the id's change checkout. Both read
only; `--json` of `flow-check` is unchanged. With no token counted, both print exactly what they
print today (spec scenario "No tokens").

## D-8 Messages (spec `stage-models`, `spend-readout`)

New rows of `MESSAGES` (the spend rows through `SPEND_MESSAGES`):

| Key | en | pt-BR |
|---|---|---|
| `setting.model-stage` | `stage named in the model table` | `etapa citada na tabela de modelos` |
| `setting.model-value` | `model of a stage` | `modelo de uma etapa` |
| `spend-head` | `Spend of {id}, in tokens:` | `Gasto de {id}, em tokens:` |
| `spend-stage` | `Stage {title}: {models}` | `Etapa {title}: {models}` |
| `spend-stage-none` | `Outside a stage: {models}` | `Fora de uma etapa: {models}` |
| `spend-retry` | `Stage {title}, a retry from {from} to {to}: {tokens}` | `Etapa {title}, uma repetição de {from} para {to}: {tokens}` |
| `spend-total` | `Total: {tokens} tokens of the budget {cap}` | `Total: {tokens} tokens do orçamento {cap}` |
| `spend-total-none` | `Total: {tokens} tokens; no budget is set` | `Total: {tokens} tokens; nenhum orçamento definido` |

The spend rows take `{title}`, never `{stage}`: `render` turns `{stage}` into a stage phrase
(`stagePhrase`: "the code review", "a etapa Revisão de código"), which the words "Stage" and
"Etapa" would double. `{title}` is the plain title (D-7, "The block"), as `SAMPLE`-based
`renderings` already pass it (`title: STAGE_SAMPLE[lang]`). A retry of a session message has no
stage, so `spend-retry` needs no `null` form. No row holds a file, a hyphenated id or a setting's
key, and every Portuguese row differs from its English one, so `EXEMPT_EQUAL` and `NAMES_ITS_FILE`
do not change.

## D-9 The skill (`plugins/openspec/skills/devkit/SKILL.md`)

- Loop, `agent` item: after "with the call's `subagent_type` set to the action's `agent` field and
  the prompt `brief`", add "and its `model` set to the action's `model` with any `[1m]` suffix
  removed". Its last sentence becomes: "When the agent returns `Outcome: failure`, run `next` with
  `--after` as after any agent: the loop hands the stage once more on a stronger model or ends the
  run blocked; a `ship-change` row's own words on a failure do not apply here."
- The paragraph "An end the session declares itself (an agent's failure, a red gate, ...)" drops
  "an agent's failure, ".
- The `resolve-release-conflict` item: "`Outcome: failure` ends the run blocked." becomes
  "`Outcome: failure` goes back to `next`, as for any agent."
- "Every change in this session", step 2 `agent`: the same `model` clause; step 3: "An agent's
  `Outcome: failure` is declared with `... reply blocked ... why=role-failed ...`" becomes "An
  agent's `Outcome: failure` is reported like its success, with `--after <id>=<progressKey of its
  action>`: the loop retries it or ends the change blocked"; the red gate and pull-request sentences
  stay.
- "A session per change": the list-check sentence reports `--after <id>=session-found`; a new item
  `session-model` says D-6's session side, with its two `--after` keys and the same `--turn` as the
  call that returned it.
- Never: "In a run with a session per change: ... switch a session's model to one `next` did not
  return, or switch any session up."

## D-10 ADRs and documents

- ADR 0023 (`docs/adr/0023-the-model-is-chosen-by-stage.md`) is the adr-author's and its
  decisions stay as they are. Its number is checked against `origin/main` before review (task 4.1).
  `origin/main` (local ref `b92e6b1`, not fetched) already holds another
  `docs/adr/0020-a-change-can-run-on-another-machine.md` and devkit-openspec 0.32.0, so tasks 4.1
  and 4.5 are redone at the delivery merge (this change's ADR takes the next free number, 0021 at
  `b92e6b1` (0022 at the second delivery merge, tip `6999a04`; 0023 at the third, tip `eca590e`), every reference in this change's files, `docs/`, `openspec/config.yaml` and
  `CHANGELOG.md` follows, the release moves above `origin/main`'s), and the tests that hard-code
  `0020` (`ADR_FILE` and the `0020` assertions of `plugins/openspec/hooks/stage-models.test.mjs`)
  follow in the same commit; phase 5 is done on the current names first, so it stays one rename
  away.
  It is marked accepted by the loop's `accept-decisions` step after the owner's approval. The one
  addition is the clarifying Note of "The retry's reach and the 1M reach in words" below (task 5.3),
  in the form the Notes of ADR 0014 use; it changes no decision.
- `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`: header line
  `- Amended by ADR 0023 (0023-the-model-is-chosen-by-stage.md)` and a Note
  `Note (stage-models, 2026-11-23): ADR 0023 amends decision 1: ...` in the form of ADR 0014's own
  `Note (change-state, 2026-11-22)`.
- `openspec/config.yaml`: the comment above `devkit:` names the optional `models:` table; the
  `ADRs:` line of `context` gains `0023 the model chosen by stage, sessions only step down and never
  below the stages they still run, a failed stage retried once a model up, amends 0014`.
- `docs/openspec-flow.md`, section "The change coordinator": a paragraph **The model of each
  stage.** after **The token budget.** (the key, the override, the stage ids, the values, the
  default table, `[1m]` as opt-in, the Agent call's model, the retry and its window, the roadmap's
  start model, the step-down and its floor at the session-run stages still ahead, so that the Haiku
  rows reach only stage subagents, the readout); the Troubleshooting table gains four rows (a
  `setting-unknown` for `models`; a stage that ran on another model than the table's, cause: a
  driver that ignores `model`; a change session that never stepped down, or stayed on Sonnet at a
  Haiku stage, cause: a session found already running, a refused switch, or by design the floor of
  a session-run stage still ahead; a change session that started on the host's default
  instead of its stage's model, cause: the stage's model is above the coordinating session's, which
  the host ignores, fix: open the coordinating session on that model or a stronger one); "## Cost": the bullet "All reviewers and the readiness
  reviewer run on Sonnet; only `change-planner` uses Opus. To change a model for one project, copy
  the agent ..." becomes "Each stage's hand-off runs on the model of the stage's row in the
  `models:` table (Opus for the grill, the ADRs and the plan, Haiku for the unit-test run and the
  commit, Sonnet for the rest); reviewers of a review round keep their own `model:`." That bullet is
  the only copy of the claim outside `CHANGELOG.md` history (searched: `grep -rn "uses Opus"`).
- `docs/coordination-design.md`, after the `devkit.budget` sentence of "**The configuration's field
  names.**": `devkit.models` (and its override in a change's `.openspec.yaml`) is final, decided by
  `stage-models` on 2026-11-23.
- `plugins/openspec/hooks/change-loop.mjs` header comment: one sentence on the `model` field and
  the retry.

**The retry's reach and the 1M reach in words (review round 1, task 5.3).** Three places say the
same, with these sentences (the implementer copies them):

- `docs/openspec-flow.md`, paragraph **The model of each stage.**: the sentence "A stage agent that
  returns `Outcome: failure` on Haiku or Sonnet is handed again once on the next model up (Haiku to
  Sonnet, Sonnet to Opus, `sonnet[1m]` to `opus[1m]`); a second failure in a row, or a failure on
  Opus, ends the run blocked." becomes "A stage agent that cannot finish, and stops with `Outcome:
  failure` on Haiku or Sonnet without writing its stage file, is handed again once on the next model
  up (Haiku to Sonnet, Sonnet to Opus, `sonnet[1m]` to `opus[1m]`); a second failure in a row, or a
  failure on Opus, ends the run blocked. A stage agent that finished and recorded `result=failed` in its stage
  file (red tests, for instance) is a failed stage, not a failed agent: the loop hands the stage's
  usual fix (the implementer's `fix-tests` after a test stage, a revision after a plan stage) on the
  table's model, and no retry. The `subagent-stop` hook asks an agent that stops without its file to
  write it, so an agent that then records `result=failed` takes the fix, and one that stops again
  without the file takes the retry." In the same paragraph, the sentence "No default uses the
  1M-token context: `opus[1m]` and `sonnet[1m]` are accepted as an explicit opt-in for one stage,
  and `haiku[1m]` is not a value." gains, after it: "The suffix reaches only a session's own model
  (a change session's start model, or a step-down to that value) and the retry's mapping on the
  action; it never reaches a stage agent, whose Agent call drops it, so a stage agent runs with the
  plain family's context window."
- `docs/adr/0023-the-model-is-chosen-by-stage.md`: after decision 7 and before `## Consequences`,
  a paragraph "Note (stage-models, 2026-11-23): decision 5's retry reaches a stage subagent
  that stops with `Outcome: failure` without writing its stage file. A subagent that writes its
  stage file with `result=failed`, as the `subagent-stop` hook asks of one that stops without it,
  is a failed stage and takes the stage's existing fix path, with no retry. Decision 2's `[1m]`
  opt-in reaches a session's own model and the retry's mapping, never a stage subagent: the Agent
  call takes no suffix. So the Consequences' mitigation "one retry a model up" reaches only an
  agent that cannot finish; a stage agent that obeys the hook and records `result=failed` takes the
  fix path, bounded by the stage's ceiling. No decision's text changes."
- `CHANGELOG.md`, this change's section (`the model is chosen by stage`, whatever its number after
  task 4.5): "(... ; `opus[1m]` and `sonnet[1m]` only as an opt-in)" becomes "(... ; `opus[1m]` and
  `sonnet[1m]` only as an opt-in, which reaches a session's own model and the retry's mapping, never
  a stage agent, whose Agent call drops the suffix)"; "A stage agent that returns `Outcome: failure`
  on Haiku or Sonnet is handed again once on the next model up," becomes "A stage agent that stops
  with `Outcome: failure` on Haiku or Sonnet without writing its stage file is handed again once on
  the next model up (one that records `result=failed` in its stage file takes the stage's usual fix,
  with no retry),".

Anchors: the phrase `without writing its stage file` is in all three; the 1M reach is `never
reaches a stage agent` in the flow document, `never a stage subagent` in the ADR and `never a stage
agent` in `CHANGELOG.md`; `result=failed` is in all three. When the ADR and `CHANGELOG.md` are
wrapped, each anchor stays on one line. The D-12 "Skill and docs" test reads the flow document and
the ADR with whitespace collapsed; task 5.3's checks `grep` the `CHANGELOG.md` anchors.

## D-11 Existing tests that change

Searched: `grep -n` over `plugins/openspec/hooks/*.test.mjs` for `Outcome: failure`, `role-failed`,
`START_FIELDS`, `use_worktree`, `as if you had started it`, `exactly as given`, `EXEMPT_EQUAL`,
`SAMPLE`, `parseDevkitBlock(`, `startedSessions`, `subagent_type`, `uses Opus` and the `v0.29.0` pin.
Each change is made in the task that changes its rule, its invariant named in the commit message.

| Test (file) | Change | Invariant (owner: spec, layer, suite) |
|---|---|---|
| "change-loop replies: no internal term in either language" (`change-loop.test.mjs`) | `SAMPLE` gains `models: 'opus 3210, sonnet 1105'`, `tokens: 4315`, `from: 'haiku'`, `to: 'sonnet'` (its `cap` and `id` exist, and `renderings` already passes `title`) | Unchanged: every row of the table, in both languages, holds no internal term (`change-coordination` "Replies use no internal term"; message table; `guard.test.mjs`) |
| "change-loop skill: an end the session declares goes through reply, and the marker lines are never shown (F1)" (`change-loop.test.mjs`) | The declared-ends sentence loses "an agent's failure, "; the key `reply blocked --param id=<id> --param why=role-failed` leaves the list | A failed agent is the loop's end, the others are still declared through `reply` (`change-coordination`, MODIFIED; skill text; `guard.test.mjs`) |
| "change-loop skill: the release-conflict sentence" (`change-loop.test.mjs`) | `/`Outcome: failure` ends the run blocked/` becomes `/`Outcome: failure` goes back to `next`, as for any agent/` | The release-conflict hand-off follows the loop's failure rule (`stage-models`; skill text; `guard.test.mjs`) |
| The roadmap skill test holding `` `Outcome: failure` is declared with ... why=role-failed`` (`roadmap-loop.test.mjs`, about line 1846) | That assertion becomes `/`Outcome: failure` is reported like its success, with `--after <id>=<progressKey of its action>`/` | In the one-session roadmap a failure goes back to the loop (`roadmap-coordination`, MODIFIED; skill text; `guard.test.mjs`) |
| "followups F-3 decide: with a session per change the coordinator hands no stage ..." (`roadmap-loop.test.mjs`) | `START_FIELDS` gains `model` (nine fields); the expected `input` gains `model: 'opus'`; `agentAct`/`grillAct` give the fixture actions a `model` | The start's input is exactly the start tool's fields, now with the stage's model (`roadmap-coordination` ADDED "A change session starts on its stage's model"; roadmap decision; `guard.test.mjs`) |
| "change-loop docs: the design records the answers" (`change-loop.test.mjs`) | None: its pin assertion reads the version from the manifest (`CHANGELOG.md` 0.33.0) | The CI snippet pins the current release |

Fixture changes with no invariant: `SET` of `roadmap-loop.test.mjs` and `SHIP_ENV` of
`flow-check.test.mjs` gain `CLAUDE_CODE_SESSION_ID: ''`, so no test reads the live transcript of the
session that runs the suite (`change-loop.test.mjs`'s `SET` has it since change-budget). The
`roadmap-loop.test.mjs` one is made in the red half of phase 2 (task 2.1), before `collectRoadmap`
first reads a transcript (task 2.4); the `flow-check.test.mjs` one in the red half of phase 3 (task
3.1), before `flow-check.mjs` first reads one (task 3.4).

Checked and unchanged: the `delivery-models` parser tests (no deep equality on the block); the
"one scan of the transcript" and "reads the transcript once on every lock" tests (the locks read no
model and no hand-off); every `change-loop decide:` test (their facts carry no `models`, so no
`model` field appears, D-3); `followups` tests that write `startedSessions: { a: { at: AT } }` (the
entry keeps its shape, D-6); the flow-check sample texts (no transcript, so no spend block); the
skill test "one stage per hand-off ..." (its patterns still match); "change-budget AC-4 with no
budget next prints the same output with and without a session transcript, and reads none (kept)"
(`change-loop.test.mjs`, about line 4340; invariant: with no budget set, a `next` with no `--after`
reads no transcript and prints the same output with or without one, owner `change-budget` AC-4,
the `next` command, `guard.test.mjs`): it calls `next` with no `--after`, so `runNext` passes
`retry: false` and no budget is set, and neither `spentOf` nor `typedSince` nor `handOffsOf` runs
(D-5). Phase 2 found it failing on a `next` that always read the hand-offs; D-5 was changed for it,
the test was not.

## D-12 New tests

All in the new `plugins/openspec/hooks/stage-models.test.mjs`, imported by `guard.test.mjs` beside
`delivery-models.test.mjs`; each named `stage-models AC-<n> <what>`. Fixtures: the repository
builders of `change-loop.test.mjs` (`planChange`, `cleanEnv`) and of `roadmap-loop.test.mjs`
(`sessionWorld`, `agentAct`, `putRun`, `doNext`), imported (each file gains an `export` keyword where
one is missing; no test of theirs changes); new transcript builders `userLine`,
`modelLine({ id, model, input, output, cacheWrite, at, text })`, `subagentFile(dir, n, { prompt,
lines })` and `nextOutput(id, action)` (the `devkit-run:` line and the JSON), under a
`CLAUDE_CONFIG_DIR` of the test's own temporary folder. Tests marked (kept) pass on the code before
the change too.

| Group | Tests |
|---|---|
| Table (D-1) | AC-1 `MODEL_STAGES` equals the union of the two flows' stage ids minus `open`; AC-1 `next` at each stage of a `devkit` change, and at the unit tests and delivery of a `devkit-lite` one, carries the D-1 default (every row of D-1's table, `mockup`, `readiness`, `approval`, `e2e-tests` and `retro` included); AC-4 no default value ends in `[1m]`; AC-4 `oneUp`, `cheaper` and `modelRank` over every pair of `MODEL_VALUES`, and `strongest` of a list with an unknown value and of an empty list; AC-1 every entry of `SESSION_RUN_STAGES` is in `MODEL_STAGES`, in flow order |
| Settings (D-2) | AC-2 the project's entry changes one stage, the others keep the default; AC-2 the change's entry wins for that change and another change keeps the project's; AC-2 an empty value is absent; AC-2 a quoted value and a comment read the model; AC-4 `opus[1m]` and `sonnet[1m]` are returned as written; AC-3 an unknown stage (`implement`), an unknown value (`gpt`), `haiku[1m]` and an inline `models: opus` each make `start` answer mode `setting-unknown` naming the setting and accepted values, and `open` create nothing; AC-3 the same in the change's file makes `next` exit 3 with the reply in both languages and no hand-off; AC-3 a lenient read (`stopDecision`, `collectRoadmap`) ignores a bad change table and gives the project's or the default model; AC-3 a bad project table makes `roadmap-loop.mjs run` and `status` and `project-loop.mjs` answer mode `setting-unknown` (F-9: `/devkit project` refuses it as every project setting); AC-2 the parser's `delivery` and `budget` read as before with a `models:` block beside them (kept for the delivery part) |
| Action (D-3) | AC-5 every `agent` action of `next` over a change walked through its plan stages and its implementation carries `model`; AC-8 a design hand-off carries `opus` whatever the session; AC-9 no action of `change-loop.mjs` has a kind that switches a session, and `decide` without `models` prints no `model` (kept) |
| Reader (D-4) | AC-10 `subagentRun` gives prompt, family, failed and usage of a fixture; a cut-off last line is skipped; an empty file is not failed; `handOffKey` cuts the dispatch sentence and the attribution block; `handOffKey` keys a brief whose files language is a raw tag (`zh-CN`); `handOffsOf` keeps only runs at or after `since`; `typedSince` gives the newest `/devkit` command's time, and a `/devkit status` typed after it does not move it |
| Retry (D-5) | AC-10 a failure on `haiku` gives the same stage on `sonnet`, marked, with the same progress key, called with that key; AC-10 a failure on `sonnet[1m]` gives `opus[1m]`; AC-10 two failures in a row end blocked `role-failed`, exit 2, `devkit-end: <id> blocked`; AC-10 a failure on `opus` ends blocked; AC-10 a success between two failures gives one retry again; AC-10 a new typed `/devkit change` after two failures hands the table model; AC-10 a `/devkit status` typed between a failure and the next call keeps the retry; AC-10 another change's subagents between do not break the chain; AC-10 no transcript: the progress key ends for no progress (kept); AC-10 a `next` with no `--after` after a failed hand-off, with no budget set, reads neither the session transcript nor the subagent folder and hands the stage on its table model with no `retry` mark, while the same call with `--after` and the failed action's key reads them and hands the retry (task 2.3); AC-10 in a one-session roadmap run, `roadmap-loop.mjs next` after a failed hand-off returns the retry, and `collectRoadmap` reads the subagent folder once for every change; AC-10 the stop lock (`roadmapStopDecision`) and `roadmap-loop.mjs status` decide and print the same with and without a subagent folder holding a failed hand-off of the open change (they read no hand-off, B1), and with sessions per change `next` reads none either; AC-11 a retry at the cap is held by the budget, and `spentOf` counts the retry's tokens; AC-10 (review round 1, task 5.1, pins the code at `e057874`, so it passes there) a failure with a written `result=failed` file: a `devkit-lite` change at its unit tests, the unit-test hand-off on `haiku`, a subagent file of that brief on `claude-haiku-5-5` ending `Outcome: failure`, and `unit-tests.md` written with the header `<!-- devkit-stage unit-tests result=failed attempt=1 commit=<HEAD> -->`; `next --after <id>=<that action's progressKey>` exits 0 with no `devkit-end:` line and an `agent` action at stage `implementation`, agent `devkit-core:tdd-implementer`, step `fix-tests`, `model` `sonnet` (the implementation's default), no `retry` field and a brief other than the failed one; in the same test, the same world without `unit-tests.md` gives the retry on `sonnet` with `retry.failedOn` `haiku`, so the only difference is the written file; a `devkit` change at its `decisions` stage with no table (`featWith({ have: PLAN_OF.decisions })`, decisions on `opus`; `adr-author` is a role whose Output names `failure`, A-6) whose decisions subagent, on `claude-opus-5-5`, ended `Outcome: failure` after `decisions.md` was written with `<!-- devkit-stage decisions result=failed attempt=1 commit=<HEAD> -->` gives, exit 0 and no `devkit-end:` line, an `agent` action at `decisions`, agent `devkit-core:adr-author`, whose brief holds `revise the plan from its findings`, `model` `opus` and no `retry` field (spec scenario "A plan stage recorded as failed"); and the unit-test world with `unit-tests.md` at `result=failed attempt=3` (the stage's ceiling, 3) and its subagent ending `Outcome: failure` gives exit 2, `devkit-end: <id> blocked` with the ceiling's reason, and no `retry` field on any action (spec scenario "A test stage recorded as failed at its ceiling") |
| Roadmap (D-6) | AC-6 a new change's `session-start` input holds `opus` and a resumed change at its implementation `sonnet`; AC-6 the start's `input` holds `context: 'fresh'` beside `model`; AC-6 `--after a=session-start` records the model, `--after a=session-found` records none; AC-6 after `--after a=session-found`, `a` is `own`: the same call and the next return no `session-start` for `a` and no stage action of `a`, and `roadmap-session-started` is announced for `a` once, as after `session-start`; AC-7 `stepDownOf` with every session-run stage on the same model as the stage, over every pair of `MODEL_VALUES` for the current model and that model, returns it only when it is cheaper and not the refused one; AC-7 `stepDownOf` with the default table over every stage of each script's order, from a session on `opus`, returns `sonnet` or `null` and never `haiku` (at `unit-tests` and at `delivery` it returns `sonnet`); AC-7 `stepDownOf` at `delivery` (`haiku`) with `retro: haiku` in the table, from a session on `sonnet`, returns `haiku`, and at `unit-tests` with `review: opus` from a session on `opus` returns `null`; AC-7 `stepDownOf` returns `null` for a `null` stage, and when the refused model equals the floor; AC-7 `stepDownOf` at `tasks` with `tasks: sonnet` and `approval: opus` in the table, from a session on `opus`, returns `sonnet` on the `devkit-lite` order (`approval` is not in that flow) and `null` on the `devkit` order (`approval` ahead); AC-7 at `implementation` on the `devkit` order with `approval: opus`, from `opus`, returns `sonnet` (`approval` is behind); AC-7 a session on `opus` with its change waiting at the approval gets one `session-model` to `sonnet` on an `event` turn; AC-7 a session on `sonnet` with its change at its unit tests or its delivery gets none; AC-7 a session on `sonnet` with its change at its retro and `retro: opus` in the project's table gets none (no upward switch); AC-7 equal or upward floors give none; AC-7 after `session-model` the record holds the target and no switch follows; AC-7 after `session-model-refused` the same target is not returned again; AC-7 none while stopping; AC-7 the stop lock's decision holds no switch; AC-6 an old `{ at }` entry reads back as `{ at }` |
| Spend (D-7) | AC-12 the spec's "Known numbers" give 3210 and 1105, 4315 in all; AC-12 another change's run line and the lines before the first run line do not count; AC-11 a retry is listed with its families and tokens; AC-12 the total line with a cap and with none; AC-12 for every `SPEND_MESSAGES` row in both languages, `spendLines`'s own filling equals `render` of the row from `change-loop.mjs` with the same parameters, and a stage line reads `Stage Design: ...` and `Etapa Design: ...` (no doubled stage phrase); AC-12 `budgetValue` imported from `guard.mjs` and from `change-loop.mjs` is the same function; AC-12 `flow-check.mjs <id> --lang en` prints the block after the readout, and `--json` is unchanged; AC-12 `roadmap-loop.mjs status` prints one block for the change with tokens and none for the other; AC-12 neither writes a file (the repository's status and the run file unchanged); AC-12 with no transcript both outputs equal today's (kept) |
| Skill and docs (D-9, D-10) | AC-5 the Loop's `agent` item says the `model` clause; AC-9 the change sections name no session-model tool; AC-7 the session-per-change part names `session-model`, `session-found`, `session-model-refused` and `set_session_model`; the flow doc's **The model of each stage.** paragraph names `models:`, `[1m]`, the retry, the step-down and its floor at the session-run stages; the ADR 0014 header and Note; the config's `ADRs:` line names 0023; AC-10 (review round 1, task 5.2) the flow document's **The model of each stage.** paragraph and ADR 0023, whitespace collapsed, each hold `without writing its stage file` and `result=failed`; AC-4 (task 5.2) the paragraph holds `never reaches a stage agent` and the ADR `never a stage subagent` |

## D-13 The real-run proof (AC-13)

Three runs in scratch projects outside this repository (under `/var/tmp/devkit-stage-models/proof/`),
the full outputs saved under `openspec/changes/stage-models/proof/`; `pr-verifier` runs them again at
evidence. Runs 1 and 2 (tasks 4.3, 4.4) prove the retry of an agent that cannot finish; run 3
(review round 5, task 5.4) proves the path a real agent that obeys the `subagent-stop` hook takes,
the owner's choice of 2026-11-23 (run it, not waive it), as `CLAUDE.md` requires that a change's
real-run proof cover every case the plan declares.

**The probe (A-3, task 1.1, before any code).** In an empty scratch folder outside this repository:
`command claude -p --model sonnet --plugin-dir <worktree>/plugins/core --output-format stream-json
--verbose` with the prompt "Make exactly one Agent call: subagent_type
`devkit-core:codebase-researcher`, model `haiku`, prompt `Reply with the single word done.` Then
stop.", output to `proof/probe-agent-model.jsonl`. `codebase-researcher` declares `model: sonnet`
and only reads, so a subagent on Haiku proves the parameter overrides the frontmatter. The probe
holds when the output's `tool_use` block of the Agent call carries `"model":"haiku"` and an
`assistant` event whose `parent_tool_use_id` is that block's id has a `message.model` holding
`haiku`; `proof/probe-agent-model.txt` records those two lines' fields (no content). The same
fallbacks as the runs below apply (a refused nested `claude -p` is run by the conducting session in
Bash). When the subagent's model is not Haiku, the change stops for a plan revision: D-3, D-5 and
D-9 rest on it.

**The stub pack.** A copy of this worktree's `plugins/core` in the scratch folder whose
`agents/test-runner.md` and `agents/e2e-tester.md` bodies are replaced (frontmatter kept). The
`test-runner` body: "If the file `<root>/.proof-unit-once` does not exist, create it and end with the
line `Outcome: failure — proof`, and write no file: when a stop hook asks for `unit-tests.md` before
you stop, do not write it, stop again at once with the same last line (the file must stay absent).
Otherwise write `unit-tests.md` in the change's folder with the header `<!-- devkit-stage unit-tests
result=passed attempt=1 commit=<git rev-parse HEAD> -->` on line 1, and end with `Outcome: green`."
The `e2e-tester` body: "End with the line `Outcome: failure — proof` and write nothing: when a stop
hook asks for `e2e-tests.md` before you stop, do not write it, stop again at once with the same last
line." Both are agents whose real Output sections already name `failure` (A-6).

Why the stubs stop again at once without the file (review round 1; `proof/run-notes.txt`, deviation
3): the retry reaches only an agent that stops with `Outcome: failure` and no stage file (D-5 "The
retry's reach"). The `subagent-stop` hook refuses the first stop of a stage agent whose file does
not exist and asks for it; a stub that obeys writes the file with `result=failed`, and the loop then
hands the implementer's `fix-tests`, a normal failed stage, so the retry would never run. Stopping
again at once without the file is the case of an agent that cannot finish, which is what the proof
must show in runs 1 and 2; the failure-plus-`result=failed` case is pinned by the D-12 test of task
5.1 and shown with a stub that obeys the hook by run 3 below. The scratch repository also lists `.proof-unit-once` in `.git/info/exclude` (deviation 2), so
the untracked marker does not read as uncommitted code and send the change back to the
implementation.

**Run 1, a lone change.** A `devkit-lite` scratch project (`git init`, `openspec/config.yaml` with
`schema: devkit-lite` and `devkit:` holding `tests:` with `unit: "true"` and `e2e: "true"`), a change
`proof-lone` with
`requirements.md`, `proposal.md` and `tasks.md` at `result=passed`, every task ticked and one
commit after them. `command claude -p --model sonnet --plugin-dir <worktree>/plugins/openspec
--plugin-dir <scratch>/core --output-format stream-json --verbose` with the prompt
`/devkit-openspec:devkit change proof-lone`, output to `proof/lone-run.jsonl`. Expected: the
unit-test subagent on Haiku fails, its retry on Sonnet passes; the E2E subagent on Sonnet fails,
its retry on Opus fails; the run ends blocked, saying the E2E stage could not finish its work. Then `proof/lone-models.txt`: for each subagent file of
that run, its stage (from the brief) and its `message.model` values; and `flow-check.mjs proof-lone
--lang en` run with that session's id, to `proof/lone-spend.txt`.

**Run 2, a roadmap run.** The same scratch project with `openspec/roadmap.md` holding one line
`proof-road`, a change like `proof-lone`; `claude -p` as above with `/devkit-openspec:devkit roadmap`.
`-p` has no session-start tool, so the run is the one-session mode: the coordinating session hands
the stages, as background agents. Expected and recorded as in run 1 (`proof/road-run.jsonl`,
`proof/road-models.txt`, `proof/road-spend.txt`).

**Run 3, a stage agent that obeys the hook (review round 5, task 5.4).** The path real agents take:
a test runner that stops with `Outcome: failure`, is asked for its file by the `subagent-stop` hook,
writes it with `result=failed`, and the loop hands the implementer's fix on the implementation's
table model with no retry. Scratch project `/var/tmp/devkit-stage-models/proof/fix`, built as run 1's
(`git init`, the schemas copied from `plugins/openspec/schemas`, `openspec/config.yaml` with `schema:
devkit-lite` and `devkit:` holding `tests:` with `unit: "true"` and no `e2e`, so the E2E stage does
not apply), a change `proof-fix` with `requirements.md`, `proposal.md`, one spec delta and `tasks.md`
at `result=passed`, every task ticked and one commit after them, and no `models:` table (the
defaults: `unit-tests` on `haiku`, `implementation` on `sonnet`). Its stub pack,
`/var/tmp/devkit-stage-models/proof/fix/core`, is a fresh copy of this worktree's `plugins/core`
whose `agents/test-runner.md` and `agents/tdd-implementer.md` bodies are replaced (frontmatter
kept). The `test-runner` body, which obeys the hook: "Write no file and end with the line `Outcome:
failure — proof`. When a stop hook asks for `unit-tests.md` before you stop, do what it asks: write
`unit-tests.md` in the change's folder with the header `<!-- devkit-stage unit-tests result=failed
attempt=1 commit=<git rev-parse HEAD> -->` on line 1 and the line `Finding: proof, the suite is
red.`, then end again with the line `Outcome: failure — proof`." The `tdd-implementer` body: "Change
no file and end with the line `Outcome: success — proof`." (so the fix hand-off is seen and costs
almost nothing). Command as in run 1, with `--plugin-dir /var/tmp/devkit-stage-models/proof/fix/core`
and the prompt `/devkit-openspec:devkit change proof-fix`, output to `proof/fix-run.jsonl`.
Expected: the unit-test subagent on a Haiku model id stops once, the hook asks for `unit-tests.md`,
it writes the file with `result=failed` and ends `Outcome: failure — proof`; the session calls
`next --after proof-fix=<that action's progressKey>`, whose action is an `agent` action at stage
`implementation`, agent `devkit-core:tdd-implementer`, step `fix-tests`, `model` `sonnet` and no
`retry` field; the implementer subagent runs on a Sonnet model id; the run then ends as the loop
decides (blocked for no progress, since the stub changes nothing), which the check does not read.
Saved under `openspec/changes/stage-models/proof/`:

- `fix-run.jsonl`, the run's full output.
- `fix-models.txt`, written from the run's transcripts, with no content: one line
  `subagent unit-tests model=<message.model> stop-hook-asked=<yes|no> wrote=unit-tests.md
  result=<the header's result> outcome=<the last line's outcome>` for the test runner (the hook's ask
  is the refusal of `guard.mjs subagent-stop` naming `unit-tests.md` in the subagent's transcript);
  one line `hand-off stage=<stage> agent=<agent> step=<step> model=<model> retry=<none|the retry
  field>` for the action of the `next` call that followed it, read from that call's output in
  `fix-run.jsonl`; and one line `subagent implementation step=fix-tests model=<message.model>` for
  the implementer.
- `fix-unit-tests.txt`, a copy of the scratch change's `unit-tests.md` as the test runner wrote it
  (a `.txt`, so no checker reads it as a stage file).
- `fix-spend.txt`, `flow-check.mjs proof-fix --lang en` run with that session's id: the run's cost,
  with no retry listed.

The run holds when `fix-models.txt` holds `stop-hook-asked=yes`, `result=failed`,
`outcome=failure` and the line `hand-off stage=implementation agent=devkit-core:tdd-implementer
step=fix-tests model=sonnet retry=none`. When the test runner writes the file before its first stop
(`stop-hook-asked=no`), the run is repeated once; a second such run, or any other hand-off line,
stops the task for a plan revision (no product code changes in this phase). Its notes (the session
id, any rerun) are appended to `proof/run-notes.txt` under "Run 3".

Cost: one `claude -p` session on Sonnet with two stub subagents (one on Haiku, one on Sonnet) that
do almost no work, about 0.5 h of the conducting session and that run's tokens, which
`proof/fix-spend.txt` records; well below run 1 (four subagents, two of them retries, one on Opus).
A repeat doubles it.

Trust a run only when its `system`/`init` event lists both packs with paths under this worktree and
the scratch folder. A run that shows a permission denial runs again with
`--permission-mode bypassPermissions` (the scratch folder only) and says so in the proof. Runs 1 and
2 used `--permission-mode bypassPermissions`, and only inside their scratch folders
(`/var/tmp/devkit-stage-models/proof/lone` and `/var/tmp/devkit-stage-models/proof/road`), after the
first attempt without it was denied at its first Bash call (`proof/run-notes.txt`, deviation 1);
run 3 uses it from the start, in `/var/tmp/devkit-stage-models/proof/fix` only, and says so in
`proof/run-notes.txt`. When a
nested `claude -p` is refused inside the implementer, or `-p` ends before the background agents of
run 2 return, the conducting session runs that run itself in Bash (it writes only the scratch folder
and `proof/`). The implementer reports that case with `Outcome: failure` naming the task (task 4.4, or task
5.4 for run 3);
when the loop driving this change already has this change's retry rule, it hands the stage once
more on a stronger model before ending blocked. That extra attempt meets the same limit and ends the
same way; it is accepted, and its tokens are part of this change's own spend.

The session-per-change part of AC-6 and AC-7 needs the desktop app's start and switch tools and a
turn the owner types; it is proved by D-12's tests and the dogfood of the Workflow follow-up, not by
these runs.

## D-14 Release

devkit-openspec takes the next minor version, the marketplace the next minor, in
`plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, both read from
`origin/main` at the last merge before review (`CONTRIBUTING.md`; today 0.29.0 and 0.33.0), with a
`CHANGELOG.md` section, and the CI pins of `docs/openspec-flow.md` move to the new tag. devkit-core
does not change.

## Decisions and ADRs

No new ADR beyond `decisions.md`'s ADR 0023. Read, with their rejected alternatives: ADR 0010,
0011, 0013, 0014, 0016, 0023.

- ADR 0023 decisions 1 to 6 are D-1 to D-7. Its "the exact key set ... is the plan's" is D-1.
  Decision 4's step-down floor (the owner's choice of 2026-11-23, amended into the ADR by the
  adr-author) is `SESSION_RUN_STAGES` (D-1) and `stepDownOf` (D-6); its Consequences' accepted
  cases are D-6's last paragraph of "The step-down rule".
- ADR 0010 decision 1 (settings in the `devkit:` block): `models` is one more key. Decision 3 (no
  stored log): the retry and the spend are read from transcripts. Decision 4 (each stage a subagent):
  the Agent call now carries the stage's model.
- ADR 0011 decision 2 and its rejected "a hook that fails closed": the transcript readers fail open;
  no lock reads a model or a hand-off. Its review trigger (the transcript's stored form) covers
  `message.model`, the subagent's first `user` line and its last text; D-4 keeps those readings in
  `subagentRun`.
- ADR 0013 rejected "the run's bookkeeping in the transcript only" for the run's state: the change
  session's model is bookkeeping in the run file (D-6), next to `startedSessions`, which ADR 0014
  decision 5 already lists.
- ADR 0014 decision 1 is amended by ADR 0023 decision 4 (D-6); decision 2 (starts on typed turns
  only) is unchanged: a switch is not a start.
- ADR 0016 (stage roles write their own files): unchanged; a retry is the same role. A role that
  writes its file with `result=failed` has delivered its stage, so the retry, which is for an agent
  that could not finish, does not apply (D-5 "The retry's reach").
- ADR 0023 decision 5 is read as D-5 "The retry's reach" says; review round 1 found the decision's
  words silent on the agent that writes `result=failed`, and the clarifying Note of D-10 (task 5.3)
  states the reading without changing a decision, with the clause that the Consequences'
  mitigation "one retry a model up" reaches only an agent that cannot finish. ADR 0023 decision 2's
  `[1m]` opt-in is read as reaching a session's own model and the retry's mapping, never a stage
  subagent (D-9, task 1.5), and the same Note states it. Both readings, and AC-10 as narrowed from
  the owner's `requirements.md` text, are listed in `proposal.md` among the criteria and readings
  the owner accepts at the plan's approval; the owner confirms them there or names another reading.

**Alternatives considered.**

| Option | Why not |
|---|---|
| Keys by agent name (option (b)) | One agent serves several stages; the grill, approval, review and retro have none (D-1) |
| `implement`, `deliver`, `archive` as new names | Two names for one stage; every action already says `implementation`, `delivery`, `retro` |
| `model` on `agent` actions only | The roadmap would need its own resolver to know a waiting change's model; one field serves both |
| The retry's count kept in a file or the run file | ADR 0010 decision 3; the transcripts hold the outcome and the model |
| The session keeps declaring `role-failed`, and the loop only offers the retry | The session would have to know when a retry is due; the decision belongs to the loop (ADR 0010) |
| `next` reads the hand-offs on every call (`runNext` passes `retry: true`, as first planned) | Reads a transcript on every `next` even with no budget, against the kept change-budget AC-4 test; every failure already comes back with `--after`; the owner chose `--after` only on 2026-11-23 (D-5) |
| Reading the change session's model from its transcript instead of the run file | The newest message keeps the old model until the session's next turn, so every event turn would ask the same switch again |
| The session-model switch kept to typed turns | A cheaper switch asks nothing (ADR 0023 Context), and most stage changes are seen on event turns |
| Spend rendered twice, in flow-check's words and in the message table | Two texts for one block; `SPEND_MESSAGES` is one source spread into the table |
| Step a change session down to each new stage's model, with no floor (ADR 0023 as first written) | The session would perform the review round, the delivery steps and the retro on Haiku, since it is never switched up; the owner chose the floor on 2026-11-23 |
| No session switch at all (a change session stays on its start model) | Keeps every change session on Opus after its grill, the spend the change exists to cut; the owner chose the floor |
| The floor computed from every stage ahead, subagent stages included | Would hold a session on Opus through the plan for stages it only hands off, and the subagents already run on their own model (D-3) |
| The session-run stages read from each flow's stage `role` (no agent) | `delivery` has an agent (`commit-and-pr`) and session steps (the merge, the waits); the ADR names the set, so one list states it |

## Risks / Trade-offs

- [The host ignores a start model above the coordinating session's family] → checked fact (A-1);
  the change session starts on the host's default, the run records the stage's model, and the first
  stage whose floor is cheaper than it switches the session down (D-6 "The start"); a
  Troubleshooting row says to open the coordinating session on the stronger model. Had the field not
  existed at all, the fallback was to start without it and switch down at once; the checked schema
  makes that unnecessary.
- [The floor keeps a change session on Sonnet through its Haiku stages, so it saves less than a step
  to Haiku would] → accepted by the owner's decision of 2026-11-23 (ADR 0023 decision 4 and
  Consequences): the grill, the approval, the review round, the delivery steps and the retro are not
  done on Haiku. The Haiku stages still run as Haiku subagents (D-3), and the readout shows the
  session's share (D-7).
- [A session-run stage whose table model is above the session's, such as a project's `retro: opus`
  after a start at the implementation on Sonnet, is performed on the session's model] → accepted by
  ADR 0023 Consequences (no upward switch, so no confirmation); it arises only from a table that puts
  a stronger session-run stage after a weaker start, a host-capped start, a found session or a
  refused switch (D-6).
- [A session that ignores `model` runs every agent on its frontmatter model] → accepted by ADR 0023
  (a driver that ignores it runs as before); the readout shows it, and a Troubleshooting row names it.
- [The transcript's stored form changes] → one reader per form (D-4, D-7), fixtures copied from the
  observed form, ADR 0011's review trigger.
- [A failed agent that writes no `Outcome: failure` line is not seen as failed] → K1/K2 still end the
  run, as they do today for the agents whose outcomes name no failure (A-6).
- [A stage agent that obeys the `subagent-stop` hook and writes `result=failed` never gets the
  retry a model up, so a Haiku unit-test run that misreads the suite goes to the implementer's fix
  instead of a Sonnet rerun] → MEDIUM × LOW: accepted (D-5 "The retry's reach"); the fix path
  counts its attempts against the stage's ceiling and ends blocked at it, the readout shows the
  stage's model, and a project that sees it often sets `unit-tests: sonnet`; the documents say it
  (D-10), so nobody expects a retry there.
- [A session that calls `next` with no `--after` after a failed hand-off gets no retry] → LOW × LOW:
  the skill always reports an agent with `--after` (D-9); such a call hands the stage on its table
  model, the failure stays in the window, and the next call with `--after` counts both runs, so the
  run still ends blocked after two failures in a row (D-5).
- [Reading every own-session change on each roadmap `next`] → only with sessions per change and a
  recorded model; one `nextAction` per change, as `/devkit status` already does.
- [Reading the worktree folder's transcripts on `/devkit status`] → only changes the board lists
  open; one pass per file.

## Migration Plan

Nothing migrates. With no `models:` key the loop uses the default table, which already moves most
stage work off Opus; a project that wants today's behaviour sets every row it cares about. Run-file
entries written before this change read as they did (D-6). Rollback: revert the release; an older
devkit-openspec ignores `models:` (other keys of the block are ignored) and the extra fields of the
run file (`readRun` keeps known fields only).

## Implementation plan

**Per surface.** Hooks: `guard.mjs` (parser, readers), `change-loop.mjs` (table, action field,
retry, messages, run file), `roadmap-loop.mjs` (start model, switch, status block), `flow-check.mjs`
(readout block). Skill: `plugins/openspec/skills/devkit/SKILL.md`. Docs, ADR 0014's Note, config,
release. No schema, agent, frontend or CI file.

**Order.** The Agent `model` probe (A-3, task 1.1), then the table and its reading (D-1, D-2, D-3), then the readers and the retry (D-4, D-5),
then the roadmap and the readout (D-6, D-7) with the messages (D-8), then the skill, the docs and
the proof (D-9, D-10, D-13), then the release (D-14); after review round 1, the retry's reach (D-5,
D-10, D-12, D-13): the pinning test, the doc test, the three documents, then real run 3 of D-13 (a
stub test runner that obeys the hook) and the whole suite again (tasks 5.1 to 5.5); at the
delivery merge, tasks 4.1 and 4.5 again (D-10).

**File structure.** Create: `plugins/openspec/hooks/stage-models.test.mjs`,
`openspec/changes/stage-models/proof/` (the probe's and the runs' outputs; run 3 adds
`fix-run.jsonl`, `fix-models.txt`, `fix-unit-tests.txt` and `fix-spend.txt`, and appends to
`run-notes.txt`). Modify:
`plugins/openspec/hooks/guard.mjs`, `plugins/openspec/hooks/change-loop.mjs`,
`plugins/openspec/hooks/roadmap-loop.mjs`, `plugins/openspec/hooks/flow-check.mjs`,
`plugins/openspec/hooks/guard.test.mjs` (one import), `plugins/openspec/hooks/change-loop.test.mjs`,
`plugins/openspec/hooks/roadmap-loop.test.mjs`, `plugins/openspec/hooks/flow-check.test.mjs`,
`plugins/openspec/skills/devkit/SKILL.md`, `docs/openspec-flow.md`, `docs/coordination-design.md`,
`docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md`,
`docs/adr/0023-the-model-is-chosen-by-stage.md` (the Note of task 5.3), `openspec/config.yaml`,
`plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
Delete none.

**Estimate.** Optimistic 19.5 h, likely 27.5 h (the table's sum), pessimistic 39 h.

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| The Agent `model` probe (task 1.1, A-3) | 0.5 | Integration | MEDIUM |
| Table, values, order, `SESSION_RUN_STAGES`, `strongest`, parser `models`, `modelProblems`, `modelsOf`, `model` field (D-1 to D-3) | 3 | Core | LOW |
| Their tests (D-12 Table, Settings, Action) | 2.5 | Testing | LOW |
| `subagentRun`, `handOffKey`, `handOffsOf`, `typedSince`, `familyOfId` (D-4) | 2 | Core | MEDIUM |
| `retried` in `decide`, `retry` option (D-5) and their tests | 3 | Core | MEDIUM |
| Roadmap start model, run file, `session-found` sites, `stepDownOf` with its floor, `stageModels`, `session-model` (D-6) and tests | 4.5 | Core | MEDIUM |
| `budgetValue` move, `spendOf`, `spendSources`, `spendLines`, messages, flow-check and status blocks (D-7, D-8) and tests | 4 | Core | MEDIUM |
| Existing tests of D-11 | 1 | Testing | LOW |
| Skill (D-9) and docs, ADR 0014 Note, config (D-10) | 1.5 | Documentation | LOW |
| Real-run proof (D-13) | 2 | Integration | HIGH |
| Release and the whole suite (D-14) | 0.5 | Integration | LOW |
| The retry's reach, review round 1 (D-5, D-10, D-12, D-13): the pinning test, the doc test, the flow document, the ADR 0023 Note and the CHANGELOG, the whole suite again | 1.5 | Testing | LOW |
| Real run 3 of D-13, a stub test runner that obeys the hook (review round 5, task 5.4) | 0.5 | Integration | MEDIUM |
| Tasks 4.1 and 4.5 redone at the delivery merge: the ADR renumbered, its references and `0020` tests, the release above `origin/main`'s (D-10) | 1 | Migration | MEDIUM |

**Risks (probability × impact).**

| Risk | P × I | Mitigation |
|---|---|---|
| A change session starts above the coordinating session's family and the host ignores its `model` (A-1, checked) | MEDIUM × LOW | The record keeps the stage's model; the first stage whose floor is cheaper switches the session down; Troubleshooting row (D-10) |
| The host default for an ignored start is cheaper than the recorded model, so a step-down would be upward and the host asks the user (A-1, A-2) | LOW × MEDIUM | Not observed (the first run's default was `opus[1m]`); a declined question is reported `session-model-refused` and never asked again (D-6) |
| The switch tool's fields change after 2026-11-23 (A-2, checked) | LOW × MEDIUM | Only D-9's sentence names them; a failed call is reported `session-model-refused`, which only costs more |
| The Agent tool takes no `model`, or not these values (A-3) | LOW × HIGH | Probed in task 1.1 before any code (one real Agent call, its subagent's `message.model`); a failed probe stops the change for a plan revision; run 1 of D-13 shows it again |
| The floor's list of session-run stages drifts from what the session really performs (a stage moved to or from a subagent) | LOW × MEDIUM | One list, `SESSION_RUN_STAGES` (D-1), read only by `stepDownOf` (D-6); ADR 0023's review trigger names the move; a D-12 test ties the list to `MODEL_STAGES` |
| The floor reads a change's table or flow that the session's own loop reads differently | LOW × LOW | Both use `modelsOf` and `readFlow`; the roadmap's read is lenient, so a bad change table gives the project's or the default model, and an unreadable flow gives `MODEL_STAGES`, never a wrong cheaper floor below a session-run stage of the default flows |
| A nested `claude -p` is refused inside the implementer | MEDIUM × LOW | The conducting session runs D-13 in Bash |
| `-p` ends before background agents return (run 2) | MEDIUM × MEDIUM | The conducting session reruns it; D-13 says so |
| A stage agent that writes `result=failed` takes the fix path, not the retry (review round 1) | MEDIUM × LOW | Stated in the spec, D-5, D-10's three documents and D-13; pinned by the task 5.1 test; shown with a real agent by run 3 of D-13 (task 5.4); the owner accepts the narrowed AC-10 at approval (`proposal.md`) |
| Run 3's Haiku test runner writes its file before its first stop, so the hook's ask is not shown (D-13) | LOW × LOW | One repeat; a second stops task 5.4 for a plan revision, with no product code change |
| The delivery merge brings `origin/main`'s ADR 0020 and devkit-openspec 0.32.0 (review round 5) | HIGH × MEDIUM | Tasks 4.1 and 4.5 are redone at that merge, with the `0020` tests in the same commit (D-10); phase 5 is done on the current names first; the coordinator is asked to hold `main` at the release step |
| The whole suite run of task 5.5 fills `/tmp` (the Avell's inode limit) | MEDIUM × LOW | The gate sets `TMPDIR=/var/tmp/devkit-stage-models` |
| A new hook test passes locally and fails on CI | MEDIUM × MEDIUM | New tests take `cleanEnv`; every gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set |
| A sibling change edits the same table, skill or version | MEDIUM × LOW | Versions and ADR number read at the last merge before review (tasks 4.1, 4.5) |

**Assumptions.**

- A-1 (checked fact, 2026-11-23, by the conducting session on the live host tools):
  `mcp__ccd_session__start_session` has an optional `model` field, honoured with `context: "fresh"`
  only, for a model id of the same family as the starting session's or cheaper; a higher one is
  ignored (Context). Where the plan breaks if the host changes it: D-6 "The start".
- A-2 (checked fact, 2026-11-23, same check): `mcp__ccd_session_mgmt__set_session_model` takes
  `session_id` (a `sessionId` of `list_sessions`) and `model`; it is refused for the calling
  session and asks the user before a switch to a more expensive model, none before a cheaper one
  (Context; `requirements.md`, ADR 0023 Context).
- A-3: the Agent tool's `model` parameter takes `opus`, `sonnet` and `haiku` and overrides the
  agent's frontmatter `model:` (ADR 0023 decision 3). Not yet checked; task 1.1 probes it before
  any code, and its output is kept as `proof/probe-agent-model.jsonl`.
- A-4: a subagent's file is `<session>/subagents/agent-*.jsonl`, its first `user` line holds the
  prompt and every `assistant` line `message.model` (observed 2026-11-23, Context).
- A-5: a host session's transcript folder is its working folder with every character outside
  `[A-Za-z0-9]` as `-` (observed 2026-11-23, Context).
- A-6: the stage agents that can fail end with a line `Outcome: failure` (`tdd-implementer`,
  `adr-author`, `screen-designer`, `test-runner`, `e2e-tester`); `change-planner` (`escalated`),
  `pr-verifier` (`defect-found`) and `commit-and-pr` (`refused`) name no failure, so they are never
  retried, as today the session declares no failure for them (their Output sections,
  `plugins/core/agents/*.md`). Of those that can fail, only a run that ends with that line and no
  stage file is retried; one that writes its stage file with `result=failed` takes the stage's fix
  path (D-5 "The retry's reach").

**Dependencies.** `change-budget` (archived 2026-11-23: `sessionTranscript`, `spentOf`, the
`budget` cap); `roadmap-coordinator-followups` (archived 2026-11-22: sessions per change); ADR 0023
(`decisions.md`), ADR 0010, 0011, 0013, 0014 as cited.
