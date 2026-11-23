<!-- devkit-stage design result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Design

Change: `change-budget` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the two spec deltas of this change).

## Context

See `proposal.md` (Why). The code this change touches, read at `c561553` (devkit-openspec 0.21.1):

| Piece | Where | What it does today |
|---|---|---|
| Settings | `plugins/openspec/hooks/change-loop.mjs#readDevkitSettings`, `#plainValue`, `#projectGate` | Reads the top-level `devkit:` block of `openspec/config.yaml` into `{ driver, language, unknown }`; other keys of the block are ignored. `projectGate` answers the first `unknown` entry with `setting-unknown` in `start` and `open` (and in `roadmap-loop.mjs` and `project-loop.mjs`, which call it) |
| The decision | `change-loop.mjs#decide` | Pure. Every `agent` and `session` action goes through the inner `guard` (K1 no progress, K2 not delivered). Ends come from `finish`/`waiting`/`blocked` |
| `next` | `change-loop.mjs#nextAction`, `#runNext`, `#loopOutput` | Reads files, git and GitHub; prints `devkit-run: <id>`, then `devkit-end: <id> <state>` on an end, then the JSON |
| Other callers of `nextAction` | `change-loop.mjs#stopDecision`, `#runWait`; `roadmap-loop.mjs#collectRoadmap`, `#draftCmd`, `#waitCmd` | Each calls `nextAction(cwd, id, { env, lang, after?, openspec?, gh? })` |
| Transcript scan | `plugins/openspec/hooks/guard.mjs#transcriptEvents`, `#runOf`, `#roadmapRunOf`, `#marksOf` | One scan of `input.transcript_path`: only `user` lines that are not `isMeta` or `isSidechain`; events `{ typed }` or `{ texts, stdout }`. `runOf` reads the `devkit-run:`/`devkit-end:` markers with a closure `markers` |
| Stop lock | `change-loop.mjs#stopDecision`, `guard.mjs#lock` | `run.ended` (the newest marker is an end line) lets the stop through before `nextAction` is called (T3a). The hook reads the transcript once and passes `events` |
| Roadmap gates | `roadmap-loop.mjs#GATE_OF_WHY`, `#gateOf` | Maps every `waiting-*` key of the table but `waiting-github` to a `gate.*` code; an unknown one throws `LoopUsageError` |
| Message table | `change-loop.mjs#MESSAGES`, `#render`, `#FAMILY` | `{setting}` renders `setting.<code>` |
| Skill | `plugins/openspec/skills/devkit/SKILL.md`, "Loop" | `end`: `waiting-for-owner` ends the turn, "the owner's next message is the answer" |

What the host records, observed on 2026-11-22 in the desktop app's Claude Code 2.1.326 (this
planning session, by reading its own transcript; numbers only, no content):

- The Bash tool's environment holds `CLAUDE_CODE_SESSION_ID`, the session's id; inside a subagent it
  holds the parent session's id.
- The session's transcript is `~/.claude/projects/<project folder>/<session id>.jsonl`; each subagent
  has `~/.claude/projects/<project folder>/<session id>/subagents/agent-<agent id>.jsonl` and a
  `.meta.json` beside it. Every line of a subagent file has `isSidechain: true`.
- Each model response is stored as one `assistant` line per content block: 49 lines held 25 distinct
  `message.id` values in the main transcript, 23 lines held 14 in a subagent file, and every line of
  one id carried the same `usage`. `usage` holds `input_tokens`, `output_tokens`,
  `cache_creation_input_tokens` and `cache_read_input_tokens` as numbers, beside other fields.
- Every `user` and `assistant` line carries an ISO-8601 UTC `timestamp` ending in `Z`.

The ambiguity of `requirements.md` (where `budget:` sits in `.openspec.yaml`), checked with
`openspec` 2.0.0 on a scratch copy of this repository's `openspec/`: a change whose `.openspec.yaml`
holds (a) a top-level `budget: 2000000`, or (b) a block `devkit:` with `budget: 2000000`, passes
`openspec status --change`, `openspec instructions proposal --change --json`, `openspec instructions
apply --change --json` and `openspec validate --strict` with exit 0, and the JSON on standard output
is unchanged. Both forms draw the same notice on the human output (and on standard error of
`instructions apply --json`): "Unrecognized key name(s) in .openspec.yaml ... Unknown keys are ignored
and have no effect; prefix a key with x- ... to keep tool-specific metadata without this warning". A
key prefixed `x-` draws none. Neither form errors, so the owner's test does not separate them; D-1
picks (b).

## Goals / Non-Goals

**Goals:**

- One parser for the `devkit:` block of both files, one helper for the count, one place that holds a
  hand-off (`decide`).
- Nothing read, and nothing printed differently, when no cap is set.
- Every lock keeps its behaviour; the turn ends at the budget through the existing end marker.

**Non-Goals:**

- Counting in the stop lock, the subagent-stop lock, the hand-off lock or `change-loop.mjs wait`.
- A budget for the roadmap coordinator's session, `/devkit project` or the CompozyOS loop.
- Silencing the CLI's notice about the `devkit:` block of `.openspec.yaml`.
- Showing the spend anywhere but the stop reply.

## D-1 The setting and where it is read (AC-4, AC-5, AC-8; spec `change-coordination`)

The key is `budget:` inside a `devkit:` block in both files: `openspec/config.yaml` (the project) and
`openspec/changes/<id>/.openspec.yaml` (the change, option (b) of `requirements.md`). Option (b) is
chosen because it is the same key path in both files (`devkit.budget`), read by the same parser.

In `plugins/openspec/hooks/change-loop.mjs`:

- `devkitBlock(text)` (new, not exported): the loop body of today's `readDevkitSettings`, moved as is.
  It returns `{ <key>: plainValue(<rest>) }` for the lines of the top-level `devkit:` block. Rules,
  unchanged from today: the block starts at a line `devkit:` (optional comment) and ends at the next
  line that is not blank, not a comment and not indented; a later duplicate key wins; CR is dropped; a
  value in quotes is the text inside them, and an unclosed quote gives the text after it; an empty
  file, or a file with no such line, gives `{}`; the last line needs no newline.
- `readDevkitSettings(root)` calls `devkitBlock` and, after the `driver` and `language` checks, pushes
  `{ setting: 'budget', value, accepted: '1, 2, 3, …' }` to `unknown` when `budgetValue(found.budget)`
  is `{ invalid }`. Its return shape stays `{ driver, language, unknown }`.
- `budgetValue(raw)` (new, exported for tests): `null` for `undefined` or `''`; `{ cap: n }` when `raw`
  matches `/^\d+$/`, `n = Number(raw)` is greater than 0 and `Number.isSafeInteger(n)`; else
  `{ invalid: raw }`. So `0`, `-5`, `1.5`, `2e6`, `2_000_000` and `abc` are invalid; `007` is 7.
- `budgetOf(root, dir, lang)` (new, exported): reads `join(dir, '.openspec.yaml')` (a missing file is
  `{}`; any other read error is a `LoopUsageError`, as `openspec/config.yaml` is today) and
  `join(root, 'openspec', 'config.yaml')` through `devkitBlock`. When either value is `{ invalid }`
  (the change's first), it throws `new LoopRefusal('setting-unknown', render(lang, 'setting-unknown',
  { setting: 'budget', value, accepted: '1, 2, 3, …' }))`. Otherwise it returns
  `{ cap, from: 'change' | 'project', file: join(dir, '.openspec.yaml') }` for the change's value, else
  the project's, else `null`. `file` is always the change's own file: see D-5.
- The project's value is the one in the change's own checkout (`found.root`), as `filesLanguage` is
  today. Other keys of the change's `devkit:` block are not read.

`projectGate` is unchanged: an invalid project budget is `unknown[0]` or later, so `start` and `open`
answer `setting-unknown` and create nothing, like an unknown driver. That also stops `/devkit roadmap`,
`/devkit status` and `/devkit project`, which pass through the same gate.

## D-2 Finding the session's transcript (AC-9)

`change-loop.mjs next` runs as a Bash command of the session: it gets no hook input, so it finds the
transcript from its environment. In `plugins/openspec/hooks/guard.mjs` (beside `transcriptEvents`):

- `sessionTranscript(env)` (new, exported): `id = env.CLAUDE_CODE_SESSION_ID`; `null` unless it matches
  `/^[A-Za-z0-9][\w-]*$/`. `base = env.CLAUDE_CONFIG_DIR || join(env.HOME || homedir(), '.claude')`.
  It lists `join(base, 'projects')`, sorted by name, and returns the first
  `join(base, 'projects', <folder>, `${id}.jsonl`)` that exists; `null` when none does or when any
  read throws. It reads no file content.

`nextAction` passes the caller's `env` (not `cleanOf(env)`, which keeps these keys anyway).

## D-3 The count: one shared helper (AC-7, AC-9)

`guard.mjs#transcriptEvents(input, { usage = false } = {})` gains a usage mode. With `usage` false
(every existing caller) its result is identical to today's. With `usage` true:

- a line is parsed when it matches `/"type"\s*:\s*"(user|assistant)"/` (today: `user` only);
- the first parsed line with a string `timestamp` yields `{ start: <that timestamp> }` as the first
  event, whether or not it is `isMeta` or `isSidechain`;
- every other event carries `at`, its line's `timestamp` or `null`;
- a `user` line gives the events it gives today (skipped when `isMeta` or `isSidechain`);
- an `assistant` line whose `message.usage` is an object gives
  `{ usage: { id: message.id ?? null, tokens }, at }`, sidechain lines included, where `tokens` is the
  sum of `input_tokens`, `output_tokens` and `cache_creation_input_tokens`, each taken when it is a
  finite number of at least 0, else 0. `cache_read_input_tokens` is never read.

`runOf`'s closure `markers` moves to a module-level `runMarkers(text)` (same regular expression,
same `{ run }` / `{ end }` entries); `runOf` calls it through `marksOf` as today.

`spentOf(transcript, change)` (new, exported) is the only code that sums usage:

1. `events = transcriptEvents({ transcript_path: transcript }, { usage: true })`; `null` gives `null`.
2. `first` = the index of the first event with `texts` whose `marksOf(event, runMarkers)` holds
   `{ run: change }`. None: return `{ spent: 0, since: null }`.
3. `since = events[first].at`. Sum the `usage` events after `first`, counting each non-null `id` once
   (a `Set` shared with step 4); a `null` id counts every time.
4. Subagents: `join(dirname(transcript), basename(transcript, '.jsonl'), 'subagents')`, its
   `agent-*.jsonl` files sorted by name. For each, scan it the same way; a `null` scan adds nothing.
   It counts when `since` is a string, its first event is `{ start }` with a string, and
   `start >= since` (ISO-8601 UTC strings order as times); then every `usage` event of the file is
   summed. A folder that cannot be listed adds nothing.
5. Return `{ spent, since }`.

The function lives in `guard.mjs` because the transcript's stored form is read there (ADR 0011's
probe) and `change-loop.mjs` already imports `runOf` from it.

## D-4 The hold, in the decision (AC-1, AC-3, AC-6, AC-9; spec `change-coordination`)

`nextAction(cwd, id, { env, lang, after, openspec, gh, budget = false })`:

- With `budget` false (`stopDecision`, `runWait`, every call in `roadmap-loop.mjs`) nothing of this
  design runs, and an invalid budget is not even read.
- With `budget` true, right after `readDevkitSettings` (before any checker runs): `dir` as today
  (`locateChange(...)?.dir ?? join(found.root, 'openspec', 'changes', id)`, moved up), then
  `cap = budgetOf(found.root, dir, lang)` (a `LoopRefusal` leaves through `main`'s `failure`: exit 3,
  `{ version, error, reply }`). With a cap: `path = sessionTranscript(env)`,
  `spent = path ? spentOf(path, id)?.spent ?? null : null`. The fact passed to `decide` is
  `budget: cap ? { cap: cap.cap, file: cap.file, spent } : null`.
- `runNext` passes `budget: true`; nothing else does.

In `decide`, a new inner `hold(action)` wraps the result of `guard` in `agent(...)` and
`sessionAction(...)`, so a no-progress or not-delivered end comes first:

```js
const hold = (action) => {
  const b = facts.budget;
  if (!b || b.spent === null || b.spent < b.cap || (action.kind !== 'agent' && action.kind !== 'session')) return action;
  return waiting('waiting-for-owner', 'waiting-budget', action.stage, { spent: b.spent, cap: b.cap, file: b.file },
    { held: { kind: action.kind, stage: action.stage, step: action.step ?? null, agent: action.agent ?? null } });
};
```

The end is `{ kind: 'end', end: { state: 'waiting-for-owner', why: 'waiting-budget' }, params: { id,
spent, cap, file }, detail: { held }, reply, stage, stageTitle, role, skills }`; `exitCodeOf` gives 1
and `loopOutput` prints `devkit-end: <id> waiting-for-owner`. The grill and every end never reach
`hold`. Nothing is stored: after the cap is raised, the same call recomputes the held action
(`detail.held` lets a test compare them).

Why only `next`: the skill runs `next` after a background wait ends ("Waiting on GitHub"), so `wait`
need not count; the stop lock lets the turn end on the recorded `devkit-end:` line before it computes
anything (T3a), and if the session tries to stop before calling `next`, the lock refuses once and
names the `next` command, whose answer is then the budget end. Counting in the hooks would also add a
parse of every `assistant` line to each Stop and PreToolUse call and break the one-read rule the
hook suite pins.

## D-5 The replies (AC-2, AC-8)

New keys of `MESSAGES`, in both languages:

| Key | en | pt-BR |
|---|---|---|
| `waiting-budget` | `The change {id} reached its token budget: {spent} tokens spent, and the cap is {cap}. To go on, raise budget in the devkit block of {file}, then type /devkit change again.` | `A change {id} atingiu o orçamento de tokens: {spent} tokens gastos, e o limite é {cap}. Para seguir, aumente budget no bloco devkit de {file} e digite /devkit change de novo.` |
| `gate.budget` | `a higher token budget` | `um orçamento de tokens maior` |
| `setting.budget` | `budget` | `budget` |

`{spent}` and `{cap}` are plain digits, as the owner types them in the file. `{file}` is the absolute
path of the change's `.openspec.yaml` in its checkout, whichever file the cap came from: the change's
file always wins (D-1), so raising it there always resumes, never edits a tracked file of the
default branch inside the change's pull request, and never misses the worktree as an edit of the main
checkout's `openspec/config.yaml` would. The settings-error reply for an invalid value is the existing
`setting-unknown`, with `setting: 'budget'`, the raw value and `accepted: '1, 2, 3, …'` (digits read the
same in both languages, unlike the English-only `accepted` text of `language`).

The budget stop's reply is the one reply that names a file and a setting's key: both spec deltas
record the exception, and the plain-words test exempts that one key from its file check only (D-8).

## D-6 The roadmap gate (spec `roadmap-coordination`)

`roadmap-loop.mjs#GATE_OF_WHY` gains `'waiting-budget': 'budget'`. No roadmap call opts in to the
budget (D-4), and a change session's ends are not read by the coordinating session, so today the
roadmap never meets this end; the entry keeps `gateOf` from throwing should one arrive, and keeps the
invariant that every owner wait of the table has a gate phrase.

## D-7 The skill

In `plugins/openspec/skills/devkit/SKILL.md`:

- Line 10, "every call re-reads the change's files, git and GitHub", gains ", and the session's
  transcripts when the project sets a token budget".
- Loop step 1 gains: "When `next` exits 3 with a `reply` and no `kind`, say `reply` and end the turn."
- The `end` item gains: "A `waiting-for-owner` end whose `end.why` is `waiting-budget` records
  nothing: the owner raises the cap in the file the reply names and types `/devkit change` again."

No new line names a `change-loop.mjs` subcommand, so the `--lang` test of the skill is unaffected.

## D-8 Existing tests that change

Searched: `grep -n` over `plugins/openspec/hooks/*.test.mjs` for `waiting-`, `setting.`,
`readDevkitSettings`, `setting-unknown`, `transcriptEvents`, `runOf(`, `Object.keys(MESSAGES`,
`nextAction(`, `v0.21.1` and `SKILL.md`. Three tests change; each change is made in the task that
changes its rule, with the invariant named in the commit message.

| Test (file) | Change | Invariant (owner: spec, layer, suite) |
|---|---|---|
| "change-loop replies: no internal term in either language" (`change-loop.test.mjs`) | `SAMPLE` gains `spent: 2100000, cap: 2000000, file: '/work/repo/.claude/worktrees/add-csv-export/openspec/changes/add-csv-export/.openspec.yaml'`; the "names a file" assertion skips the keys of a new constant `NAMES_ITS_FILE = ['waiting-budget']`; `EXEMPT_EQUAL` gains `'setting.budget'` | No reply names a file but the budget stop, which names the change's settings file; identical strings only for words that are the same in both languages (spec `change-coordination` "Replies use no internal term", MODIFIED; message table; run by `guard.test.mjs`) |
| "roadmap-loop replies: every owner wait has a gate" (`roadmap-loop.test.mjs`) | `expected` gains `'waiting-budget': 'budget'` | Unchanged: every owner wait of the table maps to a gate phrase in both languages (spec `roadmap-coordination`, MODIFIED; roadmap gates; run by `guard.test.mjs`) |
| "change-loop docs: the design records the answers" (`change-loop.test.mjs`) | The pin assertion moves to the release's tag (`v0.22.0`, D-10), and `assert.doesNotMatch(flow, /v0\.21\.1/)` joins the list | Unchanged: the flow doc's CI snippet pins the current release (release docs; run by `guard.test.mjs`) |

One fixture changes with no invariant: `SET` of `change-loop.test.mjs` gains
`CLAUDE_CODE_SESSION_ID: ''`, so no test reads the live transcript of a session that runs the suite;
every budget test sets `CLAUDE_CONFIG_DIR` and `CLAUDE_CODE_SESSION_ID` itself.

Checked and unchanged: the settings tests (the return shape stays), "one scan of the transcript yields
the typed commands and the tool results in order, and no more" (usage mode is opt-in), "a hook call
in a change run reads the transcript once on every lock" (no lock counts), the stop-lock tests T1 to
T7 (no lock code changes), the `decide` tests (their facts carry no `budget`), the skill tests (D-7).

## D-9 New tests

All in `plugins/openspec/hooks/change-loop.test.mjs`, each named `change-budget AC-<n> <what>`, one
per condition and labelled branch, negatives included. Fixtures: `planChange({ have: ['requirements'] })`
(its next action hands the proposal to the planner), the transcript helpers of the "locks" section
(`stored`, `toolResultLine`, `runLine`, `nextEndLine`, `transcriptOf`), and a new
`usageLine({ id, input, output, cacheWrite, cacheRead, at, sidechain })` beside `assistantLine`, plus
`budgetEnv(dir, id)` giving `{ ...cleanEnv, CLAUDE_CONFIG_DIR: dir, CLAUDE_CODE_SESSION_ID: id }` with
`<dir>/projects/p/<id>.jsonl` written. New functions are called through the file's namespace imports
(`guardModule`, `changeLoopModule`), so the file still loads before they exist. Tests marked "(kept)"
pin behaviour this change keeps, so they pass on the old code too.

| Group | Tests |
|---|---|
| Settings (D-1) | AC-5 the project's budget applies when the change sets none (`budgetOf` gives `from: 'project'` and the change's file; `readDevkitSettings` keeps its shape); AC-5 the change's block wins and another change keeps the project's value; AC-4 no key, or an empty value, in either file is no cap; AC-5 a top-level `budget:` of `.openspec.yaml` is not read; AC-5 a quoted value, a comment and an unclosed quote read the number; AC-4 other keys of the change's block are not read (kept); AC-8 each invalid value (`abc`, `0`, `-5`, `1.5`, `2e6`, `2_000_000`) is refused by `budgetValue`; AC-8 an invalid project budget makes `start` answer `setting-unknown` and `open` create nothing; AC-8 an invalid change budget makes `next` exit 3 with the settings reply and no hand-off; AC-8 an invalid project budget makes `next` exit 3 even under a valid change value; AC-8 the settings reply names `budget` and the value in both languages |
| Lookup (D-2) | AC-9 `sessionTranscript` finds `<CLAUDE_CONFIG_DIR>/projects/<folder>/<id>.jsonl`; AC-9 it falls back to `<HOME>/.claude`; AC-9 it is `null` with no id, an id holding `/` or `..`, no such file, or no `projects` folder |
| Count (D-3) | AC-7 the fixture of the spec's "Known numbers" counts exactly 7525; AC-7 lines before the first run line do not count, and the first run line wins over a later one; AC-7 another change's run line starts no count (`{ spent: 0, since: null }`); AC-7 a message on several lines counts once, a line with no id counts each time; AC-7 a subagent started before the run line, or whose file has no timestamp, does not count; AC-7 a sidechain model line of the session's own transcript counts; AC-7 a missing or non-number usage field counts 0; AC-9 an unreadable session transcript gives `null`, an unreadable subagent file or folder adds nothing; AC-4 the scan without the option returns the same events as before, with no `at`, `start` or `usage` (kept) |
| Decision (D-4) | AC-1 at the cap an agent hand-off becomes the budget end (state, why, exit 1, params, `detail.held`, stage); AC-1 above the cap a session step (the P3 `switch-script` fixture) becomes the budget end; AC-3 under the cap the action deep-equals the one with `budget: null` (kept); AC-9 a `spent` of `null` holds nothing (kept); AC-1 the grill and the ends (`waiting-approval`, `blocked`, `archived`) are not held (kept); AC-1 a no-progress end wins over the budget (kept) |
| `next` (D-4, D-5) | AC-1 `next` at the cap prints `devkit-run: feat`, `devkit-end: feat waiting-for-owner` and exits 1; AC-2 the reply in `en` and `pt-BR` equals `render(lang, 'waiting-budget', ...)` and holds the spend, the cap, the change's absolute file path, `budget` and `/devkit change`; AC-6 a raised cap in the change's file gives back the held hand-off (kind, agent, stage equal to `detail.held`); AC-6 an unchanged cap stops again; AC-4 with no budget, `next` prints the same output with and without a session transcript in the env, and reads no transcript (the file's `readCounter` preload) (kept); AC-9 with a cap and no session id, or with `<id>.jsonl` a folder, `next` hands the stage; AC-5 `next` on two changes uses each one's cap; AC-1 `nextAction` without the option, as the roadmap and the locks call it, applies no cap (kept); AC-1 the stop hook lets the turn end at the first attempt on a transcript holding `next`'s budget output |
| Docs | AC-10 `docs/openspec-flow.md` describes the setting (`budget:` in the `devkit:` block of `openspec/config.yaml`), the override (the change's `.openspec.yaml`), what is counted (the three fields and `cache_read_input_tokens` left out), the stop (waiting for the owner) and the resume (`/devkit change` again) |

## D-10 Documents and release

- `docs/openspec-flow.md`, section "The change coordinator": the paragraph "**The two settings.**"
  becomes "**The settings.**" and is followed by a new paragraph "**The token budget.**" (the key, the
  override, digits only, no cap when absent, the project value read from the change's checkout, what is
  counted, from when, subagents, a new session from zero, the stop between hand-offs, the reply, the
  resume, the fail-open cases: no session id or an unreadable transcript, and that only `/devkit change`
  runs count, change sessions of a roadmap run included); the "**Resuming and the unfinished
  question.**" sentence "`next` re-reads the change's folder, the stage headers, git and GitHub on every
  call" gains ", and the session's transcripts when a token budget is set," after "GitHub"; the
  Troubleshooting table gains
  two rows (a run stopped at its token budget; a budget that never stops a run); "## Cost" gains one
  bullet; the three `v0.21.1` pins become `v0.22.0`.
- `docs/coordination-design.md`, after "**The configuration's field names.**": one sentence saying
  `devkit.budget` (and its override in a change's `.openspec.yaml`) is final, decided by
  `change-budget` on 2026-11-22.
- `openspec/config.yaml`: the comment above `devkit:` names the optional token budget (`budget`); no
  value is set in this repository.
- `plugins/openspec/hooks/change-loop.mjs`, header comment: one sentence on the budget hold.
- Release: devkit-openspec 0.22.0 in `plugins/openspec/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`, marketplace 0.26.0, a `CHANGELOG.md` section. If `main` moved
  past these numbers when the change merges `main`, take the next ones (`CONTRIBUTING.md`).

## Decisions and ADRs

No new ADR. Read: ADR 0004, 0010, 0011, 0013, 0014, with their rejected alternatives.

- ADR 0010 decision 1 plans a configuration block in `config.yaml` that rounds fill; `budget` is one
  more key of it. Decision 3: the stop is a `waiting-for-owner` end, one of the four states. A dead
  session still costs nothing: a new session counts from zero, so resuming never depends on the old
  one (the owner chose this scope, `requirements.md` question 1). Decision 6 keeps the state in the
  repository and GitHub; the cap is in the repository, and the spend is per session by the owner's
  choice, not state the loop needs to resume.
- ADR 0011 decision 2 and its rejected "hook that fails closed": the count fails open the same way
  (an unreadable or missing transcript holds nothing), and no lock changes. Its review trigger (the
  transcript's stored form) now also covers `usage`; D-3 keeps that reading in one function.
- ADR 0013 rejected "the run's bookkeeping in the transcript only" for the roadmap run's state; the
  budget keeps no bookkeeping and adds nothing to the roadmap run file. ADR 0013 and 0014: the
  roadmap coordinator's own reading is not budgeted (D-4); a change session it starts runs
  `/devkit change`, so its run is.
- ADR 0004: the opt-in is untouched; an older devkit ignores the key (other keys of the block are
  ignored today).

**Alternatives considered.**

| Option | Why not |
|---|---|
| Count in the stop lock, which has `transcript_path` | A hook can only refuse, not replace the next action; it breaks the hook's one read of the transcript and parses every model line on every stop |
| Count in `wait` as well | Its end is always followed by `next` (the skill), which counts |
| The skill passes `--transcript <path>` | The session does not know its transcript's path |
| The newest `*.jsonl` of the project folder | Picks another session's file when two sessions share a folder |
| Option (a), a top-level `budget:` in `.openspec.yaml` | A second key path for one setting; the CLI notice is the same |
| An `x-devkit:` block, which silences the CLI notice | Not one of the owner's two options; put to the owner with the plan approval |
| The reply names the file the cap came from | Raising the project file in the change's worktree puts a config edit in the change's pull request, and raising it in the main checkout does not reach the worktree |
| A key without the `waiting-` prefix, to skip the roadmap gate | Breaks the table's convention that every owner wait is `waiting-*` |

## Risks / Trade-offs

- [`CLAUDE_CODE_SESSION_ID` is absent in another host or version, so no cap ever applies] → it fails
  open by design (AC-9); task 1.4 proves the lookup live in the desktop app, the docs' Troubleshooting
  row names the cause, and the next change's dogfood sees a real stop.
- [The transcript's stored form changes (usage fields, one line per block, the subagents folder)] →
  one function reads it (D-3), its fixtures copy the observed form, and ADR 0011's review trigger names
  the transcript's stored form.
- [A run of the suite inside a Claude Code session reads the live transcript] → `SET` blanks the id,
  and every budget test sets its own `CLAUDE_CONFIG_DIR`.
- [The CLI's notice about the `devkit:` block appears in agents' human `openspec` output] → it says
  the key is ignored and has no effect; JSON and exit codes are unchanged; the owner may choose
  `x-devkit:` at the approval.
- [The owner raises the main checkout's `openspec/config.yaml`, which the change does not read] → the
  reply names the change's own file by absolute path, and the docs say where the project value is read.
- [Spend of another change in the same session counts] → accepted by the owner (`requirements.md`).
- [A subagent started just before the run line is left out] → accepted by AC-7's rule.

## Migration Plan

Nothing migrates: no project has `budget:` today, and with none the loop behaves as before (AC-4).
A project opts in by adding the key after it updates devkit-openspec. Rollback: revert the release;
an older devkit-openspec ignores `budget:` in the `devkit:` block (other keys of the block are ignored),
so a project that set it keeps working without a cap.

## Implementation plan

**Per surface.** Hooks (`guard.mjs`, `change-loop.mjs`, `roadmap-loop.mjs`) and their tests; the
`devkit` skill; docs; release files. No worker, no frontend, no schema, no CI file.

**Order.** The count first (guard.mjs: D-2, D-3), since the loop's tests use it; then the setting, the
hold, the replies, the roadmap gate and the skill (D-1, D-4 to D-7) with the docs (D-10 text); then the
release and the whole suite.

**File structure.** Modify only: `plugins/openspec/hooks/guard.mjs`,
`plugins/openspec/hooks/change-loop.mjs`, `plugins/openspec/hooks/roadmap-loop.mjs`,
`plugins/openspec/hooks/change-loop.test.mjs`, `plugins/openspec/hooks/roadmap-loop.test.mjs`,
`plugins/openspec/skills/devkit/SKILL.md`, `docs/openspec-flow.md`, `docs/coordination-design.md`,
`openspec/config.yaml`, `plugins/openspec/.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`, `CHANGELOG.md`. Create none; delete none.

**Estimate.** Optimistic 10 h, likely 14 h, pessimistic 20 h.

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| `sessionTranscript` (D-2) | 0.5 | Core | LOW |
| `transcriptEvents` usage mode, `runMarkers`, `spentOf` (D-3) | 2 | Core | MEDIUM |
| Lookup and count tests, live smoke run (D-9, task 1.4) | 2.5 | Testing | MEDIUM |
| `devkitBlock`, `budgetValue`, `budgetOf`, settings check (D-1) | 1.5 | Core | LOW |
| `hold`, `nextAction` option, `runNext` (D-4) | 1.5 | Core | MEDIUM |
| Messages, roadmap gate, skill (D-5 to D-7) | 1 | Core | LOW |
| Settings, decision, `next`, stop-hook tests (D-9) | 3 | Testing | MEDIUM |
| The three existing tests and `SET` (D-8) | 0.5 | Testing | LOW |
| Docs and the AC-10 test (D-10) | 1 | Documentation | LOW |
| Release and the whole suite (D-10) | 0.5 | Integration | LOW |

**Risks (probability × impact).**

| Risk | P × I | Mitigation |
|---|---|---|
| No session id in the host's Bash environment | MEDIUM × MEDIUM | Fail open (AC-9); live proof in task 1.4; Troubleshooting row |
| The transcript's stored form moves | LOW × MEDIUM | One reader (D-3); fixtures from the observed form; ADR 0011 review trigger |
| The suite reads a live transcript | MEDIUM × LOW | `SET` blanks the id; budget tests set their own env |
| A new hook test passes locally and fails on CI, where `GITHUB_HEAD_REF` is set | MEDIUM × MEDIUM | New tests take `cleanEnv`; every hook gate runs with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set |
| Reading a large transcript slows every `next` | LOW × LOW | Only with a cap; task 1.4 records the time on a real transcript |
| A sibling change (`change-state`, `change-version-pin`) edits the same table, skill or version | MEDIUM × LOW | Take the next version at merge; re-read the moved lines after merging `main` (`CONTRIBUTING.md`) |

**Assumptions.**

- A-1: the Bash tool's environment holds `CLAUDE_CODE_SESSION_ID`, and the transcript and subagent
  files are where Context says (observed 2026-11-22, Claude Code 2.1.326 in the desktop app; the
  subagent folder is also an owner-confirmed assumption of `requirements.md`). If not, no cap applies.
- A-2: every line of one model message carries the same `message.id` and the same `usage` (observed:
  no differing usage across 72 lines). If a line carried a partial count, the first line's would be
  kept and the count would be low.
- A-3: `timestamp` is ISO-8601 UTC with `Z` on every line (observed; the suite's fixtures use the same
  form). Mixed offsets would misorder subagent starts.
- A-4: `openspec` 2.x keeps accepting an unknown block in `.openspec.yaml` with exit 0 (checked with
  2.0.0). A CLI that refused it would break every command on a change that sets the override.
- A-5: the skill runs `next` after every background wait ends (`SKILL.md`, "Waiting on GitHub").
- A-6: the stop lock lets the stop through when the newest marker is an end line (`guard.mjs#runOf`,
  `change-loop.mjs#stopDecision` T3a).

**Dependencies.** `managed-agents-study` (archived 2026-11-22; its F-2 is this change's request); the
locks of `change-coordinator` (spec `coordination-locks`), unchanged; ADR 0004, 0010, 0011, 0013, 0014
as cited.
