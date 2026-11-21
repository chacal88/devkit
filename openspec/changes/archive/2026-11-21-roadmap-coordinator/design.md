<!-- devkit-stage design result=passed attempt=2 commit=6918c0d9f79ec5774fd1d243a544a14d16b87119 -->
# Design

Change: `roadmap-coordinator` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md`, `docs/adr/0010-openspec-as-the-harness.md`,
`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`).
Paths are written relative to the repository root and in backticks, never as links: this file moves
one folder deeper when the change is archived. Line numbers are those of `6918c0d`.

## Context

See `proposal.md` (Why). The design sources fix the commands (`docs/coordination-design.md:43-51`),
the roadmap coordinator's job and the hold on load (`:68-78`), the loop over files (`:110-118`) and
the Claude driver's roadmap mode (`:366-370`, "each change has its change coordinator as a
subagent"), which ADR 0010 decision 8 repeats (`docs/adr/0010-openspec-as-the-harness.md:139-144`).
ADR 0011 made the session the change coordinator of `/devkit change`.

What exists at `6918c0d`, each fact read in the source:

- `plugins/openspec/hooks/change-loop.mjs` (1144 lines) decides `/devkit change`. Its exports this
  design calls: `nextAction(cwd, id, { env, lang, after, openspec, gh })` (`:529`, one change's next
  action: `agent`, `session`, `grill` or `end`), `unfinished(start, { env, gh })` (`:629`),
  `archivedOnDefault(start, opts)` (`:613`, the ids archived on the default branch: the union of
  GitHub's default branch, the remote-tracking and local default branch and the main checkout's
  folder), `whereOf` (`:652`), `openChange` (`:770`), `waitLoop` (`:853`), `render` and `MESSAGES`
  (`:96-260`, one table, `en` and `pt-BR`), `readDevkitSettings` (`:63`), `locate` (`:511`),
  `PACKS` (`:967`), and the three lock decisions (`:904-1006`). `start` answers `not-built` for the
  verbs of `VERB_ROUND = { roadmap: 18, status: 18, project: 19, help: 23 }` (`:676`, `:709`).
  `readDevkitSettings` ignores every key of the `devkit:` block but `driver` and `language` (`:63-84`).
- `open` (`:770-818`) fetches, checks the id is free, runs `git worktree add` and `openspec new
  change`, all against the repository's one `.git`; nothing serializes two calls at once, and no
  test runs two.
- The run reader `guard.mjs#runOf` (`plugins/openspec/hooks/guard.mjs:354-398`) keeps only the
  newest `devkit-run:` id after the newest typed `/devkit change` (`:394`); its `devkit-end:`
  pattern matches any id (`:370`); any typed slash command that is not `/devkit change` sets the run
  to none (`:384`). The stop records are one file per session (`<tmpdir>/devkit-stop/<session>.json`,
  `<session>-<agent>.json` for a subagent) holding one progress key (`change-loop.mjs:885-899`).
- The only roadmap line parser is `guard.mjs#parseRoadmap` (`:517-538`): rounds from `## ` headings,
  items `{ id, done, after, text, notes }`, lines before the first heading skipped.
- Three places decide "archived" today: the session report by the tick and the archive folder of the
  session's checkout (`guard.mjs#roadmapReport`, `:540-563`), `conduct-check.mjs` by the tick on
  `origin/<base>` (`:35-39`), `change-loop.mjs` by the archive folders (`archivedOnDefault`). Nothing
  measures the machine's load.
- `flow-check.mjs` reports a change begun under the previous script as `script: "previous"`
  (`:449-456`), by the rule of `isPreviousScript` (`:175-182`); `nextAction` turns it into the end
  `blocked`, why `previous-script` (`change-loop.mjs:402`, row P10 of change-coordinator's design).
- An end action of `nextAction` carries `end: { state, why }` and its rendered `reply`, but not the
  parameters the reply was rendered with (`finish`, `change-loop.mjs:368-372`). `render` looks a
  `{why}` up in the `blocked-why.` family only when the key is exactly `blocked`, and in `why.` for any
  other key (`:256`); the test helper `renderings` (`change-loop.test.mjs:96`) mirrors that.
- `openChange` is synchronous (`execFileSync` through `gitRun`). Two checkers already wait
  synchronously with `sleepSync(ms)`, `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0,
  ms)` (`deliver-check.mjs:1401`, `conduct-check.mjs:621`).
- This repository holds no change of the previous script at `6918c0d`: `change-loop.mjs start` lists
  one unfinished change, this one. The fixtures of AC-11 are therefore built from the rule of
  `isPreviousScript` (D-4), never from a checkout's state.
- `guard.mjs` hands the `stop`, `subagent-stop` and `agent` modes to `change-loop.mjs` through a
  dynamic import (`:477-501`); `hooks.json` registers them already.

## Goals / Non-Goals

**Goals:** every decision of the two commands is made by a script with tests (the model follows the
actions it returns); the locks follow every change of a roadmap run and never trap a session outside
one; `/devkit change` keeps every behaviour it has; nothing is remembered beyond one run's bookkeeping.

**Non-Goals:** the change-run reader `runOf` and the three `/devkit change` locks stay as they are
(the end marker's id check of a change run is round 16's, carried there by the change-coordinator
retro); the session report and `conduct-check` keep reading the tick; no new hook event; no second
roadmap parser; nothing about where a change runs (round 28).

## D-1 Platform facts this design builds on

Documented, read on 2026-11-20 for change-coordinator (its `design.md` D-1, P1 to P9) and still the
basis here: a plugin skill reads `$ARGUMENTS`; `Stop` input carries `session_id`, `transcript_path`,
`cwd`, `background_tasks`; `SubagentStop` adds `agent_id`, `agent_type`, `agent_transcript_path`;
`PreToolUse` on `Agent` carries `tool_input.subagent_type` and `tool_input.prompt`; a subagent cannot
ask the owner; `userConfig` values reach the hooks as `CLAUDE_PLUGIN_OPTION_<KEY>` and skill text as
`${user_config.<key>}`; a background command has no time limit in an interactive session. Node's
`os.loadavg()` returns the 1, 5 and 15 minute load averages and `[0, 0, 0]` on Windows;
`os.cpus().length` is the number of logical cores.

**Not documented, and probed before anything is built on them** (D-2):

| # | Fact | Used by |
|---|---|---|
| B1 | An `Agent` call with `run_in_background: true` returns at once, and the session can end its turn while the subagent runs | D-2, D-7 |
| B2 | When such a subagent ends, the session takes a new turn by itself (under `-p`, and in the desktop app) | D-2, D-7 |
| B3 | Two background subagents at once: both ends reach the session | D-2, D-7 |
| B4 | The `PreToolUse` input of a background `Agent` call carries `tool_input.prompt` | D-11 |
| B5 | The `SubagentStop` input of a background subagent carries `agent_type`, and the first user line of its `agent_transcript_path` holds the prompt | D-11 |
| B6 | `${CLAUDE_SESSION_ID}` in a plugin skill's body is replaced by the session's id, the same as the hooks' `session_id` | D-5 |
| B7 | Inside a subagent the `Agent` tool can start a subagent, and its end reaches the parent | the ADR's record of option (a) only |

## D-2 The shape of the Claude driver (A-13, AC-7, AC-13, AC-14)

**Decision: option (b).** The session the owner typed `/devkit roadmap` in is the roadmap coordinator
and the change coordinator of every open change of the run. It asks `roadmap-loop.mjs next` for the
actions of all open changes at once (D-7), hands every stage to its role as a subagent in the
background (B1), carries out the session steps itself one at a time, in the foreground, as
`/devkit change` does, and asks the owner's gates in the session, one change at a time. One level of
subagents, as in `/devkit change`. Recorded in ADR 0013 (D-14), proposed with this plan.

| Option | Why not |
|---|---|
| (a) One change-coordinator subagent per change, the stage agents its subagents (ADR 0010 decision 8, design section 10) | Every reason ADR 0011 gives against a coordinator subagent holds per change: it cannot ask the owner the grill's questions (each would end the subagent and be relayed), cannot write `approval.md` (`guard.mjs` lets only the main session), and is gone when a wait on GitHub ends. It also relies on a nested subagent's end reaching its parent, the failure the owner reported and ADR 0010 asked to prove first. Nothing it gives (each change's work out of the session's context) outweighs those. |
| Foreground batches: one stage per open change in one message, all in the foreground | No background end to rely on, but the session is busy until the slowest stage returns: nothing moves while the owner answers another change, against the grill's question 4 and AC-7 |
| App child sessions per change (ADR 0006) | A start needs the owner's turn; ADR 0010's survey |

**The probe (task 1.1), before anything is built on the decision.** Run by the session that conducts
this change (not `tdd-implementer`, which must not start another Claude), with the desktop app's
bundled Claude Code, as change-coordinator's D-12a did:

    R="$(git rev-parse --show-toplevel)"
    C="$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"
    S="${TMPDIR%/}/devkit-probe-roadmap-coordinator"; P="$S/project"
    test ! -e "$S" || mv "$S" "$S.old-$(date +%s)"
    mkdir -p "$P/.claude/skills/probe" "$P/.claude/agents" && cd "$P" && git init -q -b main
    printf -- '---\nname: probe\ndescription: Probe. Use when the owner types /probe.\n---\nSession id: ${CLAUDE_SESSION_ID}. Print it with echo. Then start two agents of type sleeper, each with run_in_background true and the prompt "Change probe-a (devkit script), stage proposal: sleep" and "Change probe-b (devkit script), stage proposal: sleep". End your reply in one word without waiting.\n' > .claude/skills/probe/SKILL.md
    printf -- '---\nname: sleeper\ndescription: Sleeps. Use for the probe.\ntools: Bash, Agent\n---\nRun sleep 20 in Bash, then start one agent of type general-purpose with the prompt "say ok", then answer done.\n' > .claude/agents/sleeper.md
    printf '{"hooks":{"PreToolUse":[{"matcher":"Agent","hooks":[{"type":"command","command":"cat >> %s/agent-inputs.jsonl; echo >> %s/agent-inputs.jsonl"}]}],"SubagentStop":[{"hooks":[{"type":"command","command":"cat >> %s/subagent-stop-inputs.jsonl; echo >> %s/subagent-stop-inputs.jsonl"}]}],"Stop":[{"hooks":[{"type":"command","command":"cat >> %s/stop-inputs.jsonl; echo >> %s/stop-inputs.jsonl"}]}]}}\n' "$S" "$S" "$S" "$S" "$S" "$S" > .claude/settings.json
    "$C" -p "/probe" --permission-mode bypassPermissions --output-format stream-json --verbose > "$S/probe1.jsonl"

Run as a background command (it can exceed the Bash tool's 10 minutes). Recorded in
`$S/probe-record.txt`, as text: B1, the time the first `Stop` input arrived against the `sleep 20`;
B2 and B3, the turns in `probe1.jsonl` after that `Stop` and whether each names one subagent's
result; B4, `tool_input.prompt` and `tool_input.run_in_background` of both `agent-inputs.jsonl`
lines; B5, `agent_type` and the first user line of each `agent_transcript_path` in
`subagent-stop-inputs.jsonl`; B6, the printed id against the hooks' `session_id`; B7, whether the
sleeper's own `Agent` call ran and its end reached the sleeper (a third `agent-inputs.jsonl` line
with an `agent_type`, and its `SubagentStop`); and `background_tasks` of each `Stop` input. If the
`-p` run ends before the background ends, the run is repeated interactively in the desktop app with
the same project, and the record says so.

**What the probe decides.** B1, B2 and B3 true: phase 2 goes on. Any of them false: task 1.1 stops,
the conducting session reports to the owner and nothing is built on D-2 until the owner rules (the
foreground-batch option is then the one left, at the cost AC-7 names). B4 false: the hand-off lock
of a roadmap run reads no change and lets every hand-off through (D-11 rows RH0); the plan goes on
and the record says so. B5 false: the stage agent's stop lock finds its change by role (D-11 row RU1
fallback). B6 false: the skill passes `--fresh` on the first `/devkit roadmap` of a conversation (D-5).
B7 is recorded for ADR 0013 only. The stored forms are copied, with the ids replaced, into the
fixtures of the `roadmap-loop lock` tests (task 3.1).

## D-3 The entry: `start` routes the two verbs (A-1, A-2, AC-2, AC-15)

`change-loop.mjs start` keeps its table (change-coordinator D-3) with two rows changed: `VERB_ROUND`
becomes `{ project: 19, help: 23 }`, and, after the project gate (S3 not set up, S4 a setting unknown,
S5 a driver not built, unchanged), the verbs `roadmap` and `status` return `mode: "roadmap"` or
`mode: "status"` with `text` (the rest of the arguments, trimmed) and no reply. The skill then calls
`roadmap-loop.mjs` (D-13). The reply to no verb or an unknown verb (`verb-unknown`) names the three
commands that exist: "So far /devkit change, /devkit roadmap and /devkit status exist: type /devkit
change and what you want done, /devkit roadmap to run the roadmap, or /devkit status to see where
everything is." (The test S2 pins the old Portuguese opening and changes with it: T-4, D-18.) The order
of the rows keeps the S0 case: an unreadable `openspec/config.yaml` exits 3
for `roadmap` as for `change` (the test `change-loop start: S0 a usage error exits 3 and creates
nothing` keeps passing).

**The number (A-2).** `roadmap-loop.mjs run` reads `text`: empty is 1; a whole number written in
digits, 1 or more, at most 99, is that number; `stop` (any case) is the stop of D-9; anything else, a
number below 1 or one with a sign or a decimal, gives the reply `roadmap-invalid` naming the word and
starts nothing, prints no run line and exits 0.

**Alternatives rejected.** A separate skill `/devkit-roadmap`: the owner's commands are one `/devkit`
with verbs (design section 1). Putting the roadmap decisions into `change-loop.mjs`: it already holds
1144 lines and every lock of a change run; a script of its own keeps `/devkit change`'s file and its
suite untouched but for the routing, the messages and the open lock (AC-15). A1 left the choice to
the planner.

## D-4 The roadmap, its lines and the archived set (A-4, A-5, A-11, A-12, AC-1, AC-11)

**Which file.** `openspec/roadmap.md` of the session's checkout (`findRoot(cwd)`), the file the owner
edits and the one the session report already reads; parsed by `guard.mjs#parseRoadmap`, the only
parser (no second one). A line's change is its `id`; its request, when the run opens it, is the
line's `text` followed by its `notes` (the description after the id and the indented lines). An id
that appears twice counts at its first line.

**Archived (A-4).** One source: `archivedOnDefault(start, { env, gh })` of `change-loop.mjs`, the
union that `/devkit change` already uses. The tick reports and gates nothing. The two other readers
(the session report, `conduct-check`) are left as they are (non-goal).

**Open.** The roadmap's ids in `unfinished(start, { env, gh })`, each with its checkout, and, for each,
`nextAction` in that checkout. A change whose action is the end `blocked` with why `previous-script`
is on the previous script.

**Each line, first match wins** (`classifyLines`, pure):

| # | The line | Class | Fills a place | `/devkit status` |
|---|---|---|---|---|
| C1 | archived and ticked | `archived` | no | counted in the archived number |
| C2 | archived, not ticked | `archived-unticked` | no | counted as archived, and listed outside the roadmap: "archived, its line not ticked yet" |
| C3 | ticked, not archived | `ticked` | no | outside the roadmap: "ticked on the roadmap but not archived"; never started |
| C4 | unticked, open, on the previous script | `previous` | no | outside the roadmap: "began under the previous script"; one event line `roadmap-skipped` per run |
| C5 | unticked, open, on the current script | `open` | yes | by its action (D-7) |
| C6 | unticked, not open, a declared end of the run (D-5: it could not be opened) | `blocked` | yes | blocked, with the reason |
| C7 | unticked, not open, every `after:` change archived | `ready` | no | in the queue: "ready, waits for a place" (or "held by the load") |
| C8 | unticked, not open, an `after:` change not archived | `waiting` | no | in the queue: "waits for <first id of `after:` not archived, in its written order>" |

A dependency that is on the previous script (C4) is not archived, so its dependents stay C8 (A-12).
Two changes run at once only when neither names the other in `after:` and both are archived-ready,
which C7 gives (A-5). A change open on the current script that is not on the roadmap, and one on the
previous script, are listed outside the roadmap with where each stopped (`whereOf`), and the run never
touches them (A-12).

**The previous-script forms and their fixtures (AC-11).** AC-11 reads: "Proved here, on fixtures of
both cases: a change that is not on the roadmap, and a change of the previous script in each form
`plugins/openspec/hooks/flow-check.mjs#isPreviousScript` recognises. Proved next: in a project that
holds many old changes." The rule (`flow-check.mjs:175-182`): take the artifact stages of the change's
script in the order its `flow.json` declares them (`devkit`: requirements, mockup, decisions,
proposal, specs, design, tasks, readiness, approval, unit-tests, e2e-tests, evidence, review, retro;
`devkit-lite`: the same without design, readiness and approval); the earliest of them that has any
file decides; the change is of the previous script when every file of that stage has no stage header.
A header on a later file does not change it; a change with no artifact file at all is current. The
forms, each a committed change folder with its `.openspec.yaml` (`schema: <script>`), built by one
helper `previousForms(root)` of `roadmap-loop.test.mjs` (in the manner of `addChange` and the
`field-fixes 2 change-loop` fixtures of `change-loop.test.mjs`); "headerless" is a file whose first
line is `# <Title>`, "headed" one whose first line is a well-formed `devkit-stage` header of its own
stage with `result=passed`:

| # | Id | Script | Files | Earliest stage with a file | `isPreviousScript` |
|---|---|---|---|---|---|
| P1 | `old-lone-proposal` | `devkit` | `proposal.md` headerless | proposal | true |
| P2 | `old-headerless-plan` | `devkit` | `proposal.md`, `design.md`, `tasks.md` (one unticked task), all headerless | proposal | true |
| P3 | `old-plan-headed-later` | `devkit` | P2's files headerless, and `readiness.md` headed | proposal | true (a later header changes nothing) |
| P4 | `old-lite-form` | `devkit-lite` | `proposal.md` and `tasks.md` headerless, `evidence.md` headed | proposal | true |
| P5 | `old-headerless-requirements` | `devkit` | `requirements.md` headerless, `proposal.md` headed | requirements | true |
| P6 | `old-specs-only` | `devkit` | `specs/a/spec.md` and `specs/b/spec.md`, both headerless | specs (two files, every one headerless) | true |
| Q1 | `new-headed-requirements` | `devkit` | `requirements.md` headed, `proposal.md` headerless | requirements | false: current, its proposal pending |
| Q2 | `new-specs-mixed` | `devkit` | `specs/a/spec.md` headed and `specs/b/spec.md` headerless | specs | false: not every file is headerless |

Each row was checked against `stageFiles` and `isPreviousScript` of `6918c0d` on 2026-11-21, with
the files above written to a scratch folder (P1 to P6 true, Q1 and Q2 false). P1 to P6 are every form
the rule recognises: one file or several in the deciding stage, a deciding
stage that is the first artifact (P5), a middle one reached through a glob (P6) or a single file (P1 to
P4), with and without headed later files (P3, P4, P5), under both scripts. Q1 and Q2 are the two
boundaries where a headerless file does not make the change previous. The outside case is `other-work`,
a change of the current script (`requirements.md` headed) that is not on the roadmap.

Tests over them: `roadmap-loop lines: the previous-script forms are the ones flow-check recognises`
(task 1.2) calls `nextAction` on each fixture and asserts the end `blocked`, why `previous-script`, for
P1 to P6 and not for Q1, Q2 and `other-work`; it pins the fixtures to the rule and passes on the base,
where `nextAction` exists. `roadmap-loop next: changes left alone` and `roadmap-loop status: changes
left alone` (task 2.1) put P1 to P6, Q1 and a line `- [ ] after-old (after: old-lone-proposal)` on a
roadmap fixture, with `other-work` unfinished beside it, and assert: P1 to P6 are class C4, one
`roadmap-skipped` line each, no action, no `ask` and no place; Q1 is C5 and fills one place;
`after-old` is C8 waiting for `old-lone-proposal`; `other-work` gets no action, no place and no
question; the board lists P1 to P6 under `status-outside` as `outside.previous` and `other-work` as
`outside.other` with its `whereOf`. A change whose schema has no `flow.json` is also reported as the
previous script (`computeFlow`, `flow-check.mjs:451`), not by `isPreviousScript`; it reaches C4 through
the same action and is not one of AC-11's fixtures.

**Alternatives rejected.** Reading the roadmap from `origin/<default>` (as `conduct-check`): the draft
of A-11 and a project with no remote would never be read. Ticks as the archived signal: A-4 says the
tick gates nothing.

## D-5 The run and its bookkeeping file (A-2, A-9, A-14, AC-2, AC-12)

**Decision (A-14 (a)).** The number of the run is kept in one bookkeeping file outside every working
tree: `<git-common-dir>/devkit/roadmap-run.json` (`git rev-parse --path-format=absolute
--git-common-dir`), so every checkout of the clone and every session see the same file and no commit
ever holds it. It is one run's bookkeeping in the sense of ADR 0010 decision 8, and holds nothing the
files, git or GitHub can say:

    { "version": 1, "session": "<session id>", "places": 3, "stopping": false,
      "asking": "<change id or null>",
      "inflight": { "<id>": { "kind": "agent" | "wait", "stage": "<stage or step>", "agentType": "<type or null>", "at": "<ISO time>" } },
      "declared": { "<id>": { "state": "blocked" | "waiting-for-owner", "why": "<code>", "params": { ... } } },
      "announced": { "<id>": "<event key>" }, "starting": ["<id>"],
      "held": false, "holding": false, "updatedAt": "<ISO time>" }

Every write is a read-modify-write under an exclusive lock file `roadmap-run.lock` next to it
(created with the `wx` flag, retried every 100 ms for up to 10 s, a lock older than 60 s taken over),
written to a temporary file and renamed. `updateRun` is synchronous, so the hook decisions that write
the file stay synchronous too; it waits between tries with `sleepSync` (D-10), a local copy of the
checkers' function. An unreadable or missing file is an empty run with
`places: 1`. Losing it costs: the number falls to 1 until the owner types it again, a stage under way
may be handed once more (K1 or K2 then ends it), and an event may be announced twice.

| Field | Written by | Read by |
|---|---|---|
| `session`, `places` | `run` (D-9) | `next`, `status` (the number in the count line), the stop lock |
| `stopping` | `run stop`; cleared by `run [<n>]` | `next`, the stop lock |
| `asking` | `next` (the head of the owner's queue, D-8) | `next` |
| `inflight` | the hand-off lock on an allowed hand-off (D-11 RH4), `wait` at its start; cleared by the stage agent's stop lock when it lets the agent stop (RU6), by `wait` at its end, by `next --after <id>=<key>` and by a declared end | `next`, the stop lock, `status` |
| `declared` | `roadmap-loop.mjs reply` of an end key (D-12), and `next` for a change it could not open | `next`, `status` |
| `announced`, `starting`, `held` | `next` (D-8) | `next` |
| `holding` | `hold` at its start and end (D-6) | `next`, the stop lock |

**Same session or a new one.** `run` receives the session's id (`--session ${CLAUDE_SESSION_ID}`,
B6). The same session typing `/devkit roadmap <n>` again keeps `inflight`, `asking`, `announced` and
`holding` (its subagents and waits still run), sets `places`, clears `stopping`, `held` and
`declared` (a change the session declared blocked is handed again, as `/devkit change` re-reads it,
and K1 or K2 end it again if nothing changed). Another session (or `--fresh`, the B6 fallback) starts
the file from empty with the new `places`: the subagents of a dead session are gone, so nothing it
recorded is under way (AC-12).

**What `/devkit status` in another session shows.** The number from the file, or 1 when there is no
file; whether a run is alive is not claimed (the board says what each change is doing, which is read
from the files).

**Alternatives rejected.** (b) The transcript only: `/devkit status` in another session would show no
number, a hook would have to re-parse the conversation for the number and for what is under way, and
a later turn would rely on the model remembering the number. A file in `.claude/` of a checkout: a
worktree session and the main checkout would see different runs. A file under the system's temporary
folder: it would not follow the clone.

## D-6 Holding a start while the machine is loaded (A-6, A-7, AC-4)

**The reading.** `load = round(os.loadavg()[0] / os.cpus().length * 100)`, a whole percentage, read
by `readLoad()` (injectable in every function that uses it). On a system that reports `0` (Windows),
the machine never counts as loaded; the flow page says so. Memory is not measured.

**The setting (A-6 (b)).** The pack's per-person option `load_limit` in
`plugins/openspec/.claude-plugin/plugin.json`, beside `language`: `{ "type": "string", "title": "Load
limit", "description": "Processor load per core, in percent, at or above which /devkit roadmap holds
new starts: a whole number, 80 by default", "default": "80" }`. The name follows the key form the
hooks receive (`CLAUDE_PLUGIN_OPTION_LOAD_LIMIT`) and says what it limits; `loadLimit` would arrive as
`CLAUDE_PLUGIN_OPTION_LOADLIMIT`. The type is `string`, as `language`, because the change-coordinator
test of the user settings and `claude plugin validate .` already accept that form; `limitOf(value)`
reads a whole number from 1 to 1000 and anything else (an unsubstituted placeholder included) as 80.
A limit above 100 lets starts through a load above one process per core, which is how the owner
forces a start (A-7). Every `roadmap-loop.mjs` call of the skill carries
`--load-limit ${user_config.load_limit}`; the stop lock reads `CLAUDE_PLUGIN_OPTION_LOAD_LIMIT`.

**The decision.** Read before every start (each `next`, and the stop lock). With `load >= limit`
and at least one change ready with a place free, no change starts, also when none is open (A-7):
`next` returns the action `hold` and, the first time only, the event line `roadmap-held` with the load
and the limit (`held` set; cleared when a change starts or a `next` finds the load below the limit).
A change under way is never touched by the load.

**`roadmap-loop.mjs hold --load-limit <p> [--interval <s>]`** (default 60, at least 5), started by the
session in the background: sets `holding`, then every interval reads the load and exits 0 printing
`{ load, limit }` once it is below the limit, or once the run file says `stopping`; clears `holding`
at its end, also on error. Its end starts the session's next turn, which runs `next`. It announces
nothing (A-7: once, not at every check).

**Alternatives rejected.** The 5-minute average: too slow to release a start after a build ends. A
project setting: the load follows the machine (A-6). A `number` type: no test of this repository has
proved Claude Code's validation of it. Free memory: A-6 rules it out.

## D-7 The decision of a run: `roadmap-loop.mjs next` (A-3, A-8, A-10, A-15, AC-1 to AC-3, AC-7, AC-9)

`node roadmap-loop.mjs next --lang <l> --load-limit <p> [--after <id>=<key>]...`
reads the roadmap (D-4), the run file (D-5), every open change's `nextAction` (with `--after` for the
changes named) and the load, computes the decision with the pure `decideRoadmap(facts)`, writes the run
file's `asking`, `announced`, `starting`, `held` and the cleared `inflight` entries of `--after`, and
prints `devkit-roadmap: <places>` (or `devkit-roadmap: stop` while stopping) and then one JSON:

    { "version": 1, "places", "open": [ids], "stopping",
      "lines": [rendered event lines, in order],
      "actions": [ { "change", "kind": "agent" | "session" | "wait" | "start" | "hold", ...the change-loop action fields,
                     "request" (start only), "progressKey" } ],
      "ask": { "change", "kind": "grill" | "gate", "action" } | null,
      "end": { "why": "done" | "stuck" | "stopped", "reply" } | null }

Exit 0, or 3 with change-loop's usage-error form (`{ version, error, reply }`, reply
`request-unreadable`).

**Per open change** (C5 and C6), in roadmap order, first match wins:

| # | The change | Result |
|---|---|---|
| N1 | `inflight` holds it | under way: no action |
| N2 | `declared` holds it | blocked, or waiting for the owner (a pull-request decision), as declared: no action |
| N3 | its action is an `agent` hand-off | action `agent` (the change-loop action, its `brief` unchanged); dispatched in the background |
| N4 | its action is a `session` step | action `session`; done by the session in the foreground, one at a time |
| N5 | its action is the end waiting on GitHub | action `wait` |
| N6 | its action is the `grill`, or an end waiting for the owner | an entry of the owner's queue (below) |
| N7 | its action is the end `blocked` | blocked, with change-loop's `why` |
| N8 | its action is the end `archived` (its archive landed between the list and the action) | archived: frees its place at the next call |

While `stopping`, N3 to N5 give no action (A-9): the changes under way finish their stage, nothing
new is handed.

**Starts (AC-1 to AC-3).** `free = places - (C5 + C6 count)`. When `free > 0`, not stopping, and the
load is below the limit: the first `free` lines of class C7 in roadmap order become `start` actions
(`change`, `request`), and each is added to `starting`. When `free > 0`, C7 lines exist and the load
is at or above the limit: the action `hold` (D-6), unless `holding` is set. `free <= 0` (the number
lowered below the open count included): no start and no hold; nothing open is touched (AC-2).

**The owner's queue (A-10, AC-7).** The N6 entries in roadmap order. Its head is `asking` when that
change is still in the queue, else the first entry; `asking` is set to the head. `ask` carries the head
only: the next change's questions come when the head leaves the queue, so a change earlier in the file
that reaches a gate while another change's grill is under way waits for that grill to end.

**Event lines (A-8, AC-5).** One per change and state, in this order, each only when `announced[id]`
differs from the new key, which is then recorded:

| Event | Key | Message |
|---|---|---|
| a change of `starting` is now open | `started` | `roadmap-started` (`id`, `open`, `places`) |
| an open change never announced in this run (it was open before the run) | `resumed` | `roadmap-resumed` (`id`, `where`, `open`, `places`) |
| it joined the owner's queue at a gate | `gate:<kind>` | `roadmap-gate` (`id`, `gate`) |
| it is blocked | `blocked:<why>` | `roadmap-blocked` (the action's `params`, D-12, or the `declared` entry's `params`, with `why`) |
| it is archived | `archived` | `roadmap-archived` (`id`) |
| a C4 line | `skipped` | `roadmap-skipped` (`id`) |
| a start is held | `held` (run-level) | `roadmap-held` (`id` of the first held line, `load`, `limit`) |

Moving from one stage to the next, or waiting on GitHub, is no event: the board shows it. The lines
for the stop and the end of the run are the `run stop` reply and `end.reply`.

**The end of a run (A-15, AC-9).** When nothing is in flight (`inflight` empty; while stopping, `wait`
entries do not count), no action is returned and `holding` is not set:

| # | Then | `end` |
|---|---|---|
| E1 | every roadmap line is C1 or C2 | `done`: `roadmap-ended-done` |
| E2 | stopping | `stopped`: `roadmap-ended-stopped`, followed by one `roadmap-stayed` line per open change (`id`, `where`) |
| E3 | otherwise | `stuck`: `roadmap-ended-stuck` with one `need` per open change and per C8 line whose dependency is not open (the owner's answer and the gate, the blocked reason, or the change it waits for) |

An `ask` may come with E3: the run ends its own work and the owner's answer resumes it (the session
records it and runs `next`). Waiting on GitHub has no time limit (A-15).

**K1 and K2.** `--after <id>=<key>` passes `<key>` to that change's `nextAction` as `after`, so a stage
that came back with nothing changed, or was not delivered, ends blocked exactly as in `/devkit change`
(change-coordinator D-5 K1, K2), and clears `inflight[<id>]`.

**A change that cannot be opened (A-15).** The session reports it with `roadmap-loop.mjs reply blocked
--param id=<id> --param why=cannot-open --param error=<the open reply>` (D-12), which records it in
`declared` (class C6: it fills its place until the next run from another session or `/devkit roadmap`
typed again).

## D-8 `/devkit status` (AC-6)

`node roadmap-loop.mjs status --lang <l> --load-limit <p>` reads the same facts as `next`, writes
nothing, prints no marker, and prints the board, each line from the message table, ids padded to the
longest id of the board plus three spaces, two spaces before each row:

1. `status-count` (`open`, `places`, `queue` = C7 + C8 lines, `archived` = C1 + C2 lines).
2. `status-held` (`load`, `limit`) only when a C7 line has a place free and the load is at or above the
   limit.
3. Then, each only when it has a row, in this order: `status-owner` (rows: the gate phrase of D-12),
   `status-running` (rows: the stage title of the change's action, with `phase <p> of <n>` when the
   action's `detail` names a phase, or the GitHub wait), `status-blocked` (rows: the blocked reason),
   `status-queue` (rows: C7 "ready, waits for a place" or "ready, held by the load", C8 "waits for
   <id>"), `status-outside` (rows: C2, C3, C4, and every unfinished change not on the roadmap with
   `whereOf`).

Without `openspec/roadmap.md`: `status-no-roadmap`, then one row per unfinished change with `whereOf`,
or `status-nothing` when there is none. Driver and set-up gates are those of D-3.

## D-9 `run`, `stop` and the draft (A-2, A-9, A-11, AC-2, AC-8, AC-10)

`node roadmap-loop.mjs run --lang <l> --load-limit <p> --session <s> [--fresh]`, the word after `roadmap`
on standard input (the skill passes it through the quoted heredoc of `start`, so no character of it
reaches the shell):

| # | Input | Result |
|---|---|---|
| U1 | the word is not empty, not `stop`, and not a whole number from 1 to 99 | reply `roadmap-invalid`; nothing written, no marker |
| U2 | no `openspec/roadmap.md` | reply `roadmap-none` (the offer); nothing written, no marker |
| U3 | `stop` | `stopping` set; prints `devkit-roadmap: stop`, the reply `roadmap-stopping`, one `roadmap-stayed` line per open change (`finishing <stage>` for one in flight), then the `next` JSON |
| U4 | a number or nothing, and the file's `session` is this session (and no `--fresh`) | `places` set, `stopping`, `held`, `declared` cleared; prints `devkit-roadmap: <places>`, the line `roadmap-places` when the number changed, then the `next` JSON |
| U5 | otherwise | the file started from empty with `places` and `session`; prints the marker, then the `next` JSON |

**The draft (A-11).** On the owner's yes to `roadmap-none` (asked with AskUserQuestion), the session
runs `node roadmap-loop.mjs draft --lang <l>`. It writes `openspec/roadmap.md` in the session's
checkout, only if absent: `# Roadmap`, a blank line, `## Round 1: unfinished changes` (`## Rodada 1:
changes por terminar` when `devkit.language` is `pt-BR`), then `- [ ] <id>` for every unfinished change
on the current script, in `unfinished` order, with no `after:`. It commits nothing, starts nothing, and
replies `roadmap-drafted` (the ids) or `roadmap-drafted-empty`, then `roadmap-drafted-left` naming the
changes of the previous script it left out, when there are any. On the owner's no the session says
`roadmap-draft-declined` (through `roadmap-loop.mjs reply`) and nothing is created. The draft is a
planning file under `openspec/`, which the guard leaves writable.

## D-10 Opening two changes at once (A-1, AC-1, AC-12)

`openChange` (`change-loop.mjs:770`) takes an exclusive lock `<git-common-dir>/devkit-open.lock`
(`wx`, holding the process id and the time) around its whole body after the argument checks: the
fetch, the id check (O2), `git worktree add`, `openspec new change` and the requirements file. A held
lock is retried every 200 ms for up to 60 s; a lock older than 10 minutes is taken over; it is removed
in `finally`. The wait between tries is synchronous: `sleepSync(ms)`, a function of `change-loop.mjs`
written as `deliver-check.mjs:1401` writes it (`Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),
0, 0, ms)`), so `openChange` stays synchronous and none of its callers (`main`'s `open`, its tests)
changes; no busy loop, no `async`. A timeout is a `LoopUsageError` (exit 3, the reply
`request-unreadable`). One call alone
behaves exactly as before; two calls for two ids both open their change; two calls for one id open it
once, and the other is refused `name-taken`. The skill also opens the changes of one `next` one after
the other (D-13).

## D-11 The locks of a roadmap run (A-13, AC-13, AC-14)

**Knowing the run.** `roadmapRunOf(input)` in `guard.mjs`, pure and synchronous like `runOf`, reads the
same transcript lines: a typed `/devkit roadmap ...` (bare or plugin-scoped) starts a candidate run;
a typed `/devkit status` is skipped (it neither starts nor ends a run); any other typed slash command
ends it; a tool result holding a line `devkit-roadmap: <n>` or `devkit-roadmap: stop` after the
command makes it a run. It returns `{ command, stopping }` or `null`. `runOf` is unchanged, so a
change run still ends on any other typed command, `/devkit status` included (ADR 0011's accepted
consequence; `/devkit change` resumes it).

**Routing.** `guard.mjs#lock` asks `roadmapRunOf(input)` first; when it finds a run, it imports
`roadmap-loop.mjs` and calls `roadmapStopDecision`, `roadmapSubagentStopDecision` or
`roadmapAgentDecision`; else it calls `change-loop.mjs` as today. `mainInRun` becomes
`runOf(input) !== null || roadmapRunOf(input) !== null`, and the refusal names the command of the run
("in a /devkit roadmap run this session writes no product code; the implementation is handed to
tdd-implementer by the loop"). The opt-in, `DEVKIT_BYPASS`, the fail-open catch and `DEVKIT_HOOK_LOG`
apply as to every lock.

**`roadmapStopDecision` (the session does not end its turn while work is ready).**

| # | Input | Decision |
|---|---|---|
| RS1 | the run is stopping (`roadmapRunOf(...).stopping` or the run file) | allow |
| RS2 | `decideRoadmap` over the current facts (read-only: nothing written) returns no `agent`, `session`, `wait` or `start` action, and no `hold` while `holding` is not set | allow (the owner's queue alone, every change under way, waiting or blocked, a held start being watched, or the run's end) |
| RS3 | it returns such an action, and the key (`roadmap:` followed by the sorted `<change>:<kind>:<progressKey>` of those actions) is not the recorded one | refuse once, naming the first action's change and stage and the command `node <hooks-dir>/roadmap-loop.mjs next --lang <l> --load-limit <p>`; record the key in `<tmpdir>/devkit-stop/<session>.json` |
| RS4 | the same key as recorded | allow |
| RS5 | any error | allow |

`background_tasks` is not read in a roadmap run: a subagent or a wait under way is in `inflight`, so
a run with one change under way and another change ready is still refused (AC-13), and a run whose
every change is under way is let through (the ends will call it back).

**`roadmapAgentDecision` (hand-offs by the change they name).**

| # | Input | Decision |
|---|---|---|
| RH0 | the caller is a subagent | allow |
| RH1 | `tool_input.prompt` does not start with `Change <id> (` (the brief's first words) | refuse: "in a /devkit roadmap run every hand-off starts with the brief the loop gave, which names its change" |
| RH2 | `<id>` is not an open roadmap change (C5) | refuse, naming the open changes |
| RH3 | `subagent_type` is not a role or helper of that change's script under the rules H3, H3a, H4, H4a of change-coordinator D-8 (`scriptAgents`, `PACKS`) | refuse, naming the change, its script and its roles |
| RH4 | otherwise | allow, and record `inflight[<id>] = { kind: "agent", stage, agentType }` (`stage` from the brief's `stage <stage>:`) |
| RH5 | any error | allow, recording nothing |

**`roadmapSubagentStopDecision` (a stage agent delivers before it stops).**

| # | Input | Decision |
|---|---|---|
| RU1 | the subagent's change: the `Change <id>` of the first user line of `agent_transcript_path` (B5); else the one `inflight` entry of kind `agent` whose `agentType` is the input's `agent_type`; none or several | allow |
| RU2 to RU5 | that change, with the rows U2 to U6 of change-coordinator D-8 (a role with no stage file, the stage delivered, the file missing, the file pending, the same state again), through `subagentStopFor(input, change)` | as those rows |
| RU6 | the decision is allow | also clear `inflight[<id>]` when its `agentType` is the input's |
| RU7 | any error | allow |

`subagentStopFor(input, change, opts)` and `handOffFor(input, change)` are the bodies of
`subagentStopDecision` and `agentDecision` after they found the change through `runOf`; the change
run's two functions call them with that change, so their behaviour is unchanged (their tests run
untouched).

**What happens to an end that does not arrive (AC-14).** A subagent whose end never reaches the
session still fires `SubagentStop` (RU6 clears its entry), so the next stop of the session is refused
(RS3) with the ready stage named and the session calls `next`: one re-read. A subagent that dies with
no stop event leaves its entry; the change shows under way in the board, and `/devkit roadmap` from a
new session starts the file from empty (D-5): one re-read, the place kept. This is the limit the
proposal asks the owner to accept.

**Alternatives rejected.** One progress key per change in the stop record: the decision is over the
whole run, so one key over every ready action is exact and keeps the record's form. Reading
`background_tasks` to know what runs: its shape is undocumented (change-coordinator S2) and it does
not say which change a task belongs to. Changing `runOf` to read several changes: it is the change
run's reader, whose behaviour AC-15 keeps; the roadmap run has its own marker.

## D-12 The messages (A-8, AC-5, AC-6, AC-10)

All new keys join `MESSAGES` of `change-loop.mjs` (one table), in both languages, with no internal
term; the test `change-loop replies: no internal term in either language` renders them (T-5, D-18).

**How `render` fills the new keys.** Two changes to `render` (`change-loop.mjs:245-259`), nothing else:

- `FAMILY` gains exactly one parameter family, `gate: 'gate.'`: `{gate}` is a code (`grill`,
  `approval`, `retro`, `merge`, `decision`, `dispute`, `stage`, `by-hand`), never a rendered phrase,
  and `render` looks it up in the `gate.` keys. `queue.`, `outside.`, `need.` and `running.` are key
  prefixes, not parameter families: `roadmap-loop.mjs` renders those keys by their full name
  (`render(lang, 'queue.place', ...)`), and their rendered rows fill `{list}` or a board row. (`queue`
  stays a plain number parameter of `status-count`; a `queue` family would take it for a code.)
- `{why}` is looked up in `blocked-why.` when the key is one of `BLOCKED_WHY_KEYS = ['blocked',
  'roadmap-blocked', 'need.blocked']`, and in `why.` for every other key, as today. So
  `roadmap-blocked` and `need.blocked` render every reason a change can stop with (`previous-script`,
  `ceiling`, `cannot-open`, ...), with that reason's own parameters.

**Where a blocked reason's parameters come from.** An end action of `nextAction` gains one field,
`params`: the object its `reply` was rendered with (`finish` in `decide`, `change-loop.mjs:368`:
`params: { id: ctx.id, ...params }`, the same object `say` receives). `end` keeps `{ state, why }`
exactly (the test `change-loop wait: W8 ...` compares it whole). It is additive: `/devkit change` and
its skill read no `params`, and no test compares a whole action to a literal. `roadmap-loop.mjs`
renders `roadmap-blocked`, `need.blocked` and the board's blocked row with `{ ...action.params, why:
action.end.why }`, or with a `declared` entry's `{ id, ...params, why }`.

**The gate code of a change waiting for the owner** (`gateOf(action)`, pure, in `roadmap-loop.mjs`):
the action `grill` gives `grill`; an end waiting for the owner gives, by its `end.why`,
`waiting-approval` and `waiting-approval-again` `approval`, `waiting-retro` `retro`, `waiting-merge` and
`waiting-archive-merge` `merge`, `waiting-pr-decision` `decision`, `waiting-review-dispute` `dispute`,
`waiting-unrun-stage` `stage`, `waiting-by-hand` `by-hand`. These are every `waiting-` key of the table
but `waiting-github`; a `declared` waiting entry (`reply` of a pull-request decision) carries its gate
code in its `params`. Any other `why` is a `LoopUsageError`, so a new owner wait added later fails a
test instead of printing a wrong phrase.

**The test's sample and helper** (T-5, task 1.3). `SAMPLE` of `change-loop.test.mjs` gains: `places:
3`, `open: 2`, `load: 92`, `limit: 80`, `queue: 5`, `archived: 9`, `word: 'many'`, `after:
'add-csv-import'`, `gate: 'approval'`, `phases: 4`; and `renderings`' `base` gains `title:
STAGE_SAMPLE[lang]` (a bare stage title in the person's language). `renderings` picks the `blocked-why.`
codes for a key of `BLOCKED_WHY_KEYS` (written out in the test, not imported, so the test pins the
list), and the `gate.` codes when the template holds `{gate}` (`gate` joins its slot list after
`setting`), so every gate phrase and every blocked reason is rendered in both languages. The refused
words gain `roadmap-loop` and `load_limit`; `EXEMPT_EQUAL` gains exactly `roadmap-stayed`,
`need.owner` and `running.stage`.

**New tests of the rendering** (task 1.3, in `roadmap-loop.test.mjs`): `roadmap-loop replies: a blocked
line renders every blocked reason in both languages` (for every `blocked-why.` code, the `SAMPLE`-like
parameters and both languages, `roadmap-blocked` and `need.blocked` hold the rendered
`blocked-why.<code>` text, and a `why.` code such as `small` is refused with a `LoopUsageError`);
`roadmap-loop replies: every owner wait has a gate` (`gateOf` over every `waiting-` key but
`waiting-github` and the grill returns a code whose `gate.` key exists in both languages; an unknown
`why` throws); `roadmap-loop decide: an end action carries the parameters of its reply` (on fixture P1,
`nextAction` returns `params` with `id` and `why: 'previous-script'`; on a fixture whose plan files up
to `tasks.md` are headed `passed` and whose `readiness.md` reads `result=failed attempt=3` (the form of
`change-loop.test.mjs:616`), the end is `blocked` `ceiling` and `params` holds `stage` and `attempt`, and
`render(lang, 'roadmap-blocked', { ...params, why })` reads the reason with them).

The texts (English, then Brazilian Portuguese):

| Key | en | pt-BR |
|---|---|---|
| `verb-unknown` (changed, D-3) | `So far /devkit change, /devkit roadmap and /devkit status exist: type /devkit change and what you want done, /devkit roadmap to run the roadmap, or /devkit status to see where everything is.` | `Por enquanto existem /devkit change, /devkit roadmap e /devkit status: digite /devkit change e o que você quer fazer, /devkit roadmap para rodar o roadmap, ou /devkit status para ver onde está tudo.` |
| `roadmap-invalid` | `/devkit roadmap takes a whole number from 1 up, or stop: "{word}" is neither. Nothing was started.` | `/devkit roadmap aceita um número inteiro a partir de 1, ou stop: "{word}" não é nenhum dos dois. Nada foi começado.` |
| `roadmap-none` | `This project has no roadmap yet. Should I write a draft with its unfinished changes, for you to review? Nothing starts now.` | `Este projeto ainda não tem roadmap. Escrevo um rascunho com as changes por terminar, para você revisar? Nada começa agora.` |
| `roadmap-drafted` | `I wrote a draft roadmap with {list}, not committed. Review it, deliver it as this project does, then call /devkit roadmap again.` | `Escrevi um rascunho de roadmap com {list}, sem commit. Revise, entregue como este projeto entrega e chame /devkit roadmap de novo.` |
| `roadmap-drafted-empty` | `I wrote a draft roadmap with no change in it, not committed: add one line per change, deliver it, then call /devkit roadmap again.` | `Escrevi um rascunho de roadmap sem nenhuma change, sem commit: acrescente uma linha por change, entregue e chame /devkit roadmap de novo.` |
| `roadmap-drafted-left` | `Left out, because they began under the previous script: {list}.` | `Deixei de fora, porque começaram no roteiro anterior: {list}.` |
| `roadmap-draft-declined` | `Nothing was created.` | `Nada foi criado.` |
| `roadmap-places` | `The run now takes up to {places} changes at once ({open} open).` | `A rodada agora vai até {places} changes ao mesmo tempo ({open} abertas).` |
| `roadmap-started` | `Started {id} ({open} of {places} under way).` | `Comecei {id} ({open} de {places} em andamento).` |
| `roadmap-resumed` | `Resumed {id}, which was already open: {where} ({open} of {places} under way).` | `Retomei {id}, que já estava aberta: {where} ({open} de {places} em andamento).` |
| `roadmap-held` | `{id} is ready to start, but the machine is loaded (processor at {load}%, limit {limit}%): I hold the start until it eases.` | `{id} está pronta para começar, mas a máquina está carregada (processador em {load}%, limite {limit}%): seguro o começo até aliviar.` |
| `roadmap-gate` | `{id} waits for {gate}. The others go on.` | `{id} espera {gate}. As outras seguem.` |
| `roadmap-archived` | `{id} was archived.` | `{id} foi arquivada.` |
| `roadmap-blocked` | `{id} stopped: {why}. The others go on, and the changes after it wait.` | `{id} parou: {why}. As outras seguem, e as que dependem dela esperam.` |
| `roadmap-skipped` | `{id} began under the previous script, so the roadmap leaves it alone; the changes after it wait.` | `{id} começou no roteiro anterior, então o roadmap não mexe nela; as que dependem dela esperam.` |
| `roadmap-stopping` | `Stopping: nothing new starts, and each change finishes the stage it is in.` | `Parando: nada novo começa, e cada change termina a etapa em que está.` |
| `roadmap-stayed` | `{id}: {where}.` | `{id}: {where}.` |
| `roadmap-ended-done` | `Every change of the roadmap is archived. The run is over.` | `Todas as changes do roadmap estão arquivadas. A rodada terminou.` |
| `roadmap-ended-stopped` | `The run stopped. Call /devkit roadmap to go on from where each change stayed.` | `A rodada parou. Chame /devkit roadmap para seguir de onde cada change ficou.` |
| `roadmap-ended-stuck` | `Nothing more can start or run on its own. Each open change needs: {list}.` | `Nada mais pode começar ou rodar sozinho. Cada change aberta precisa de: {list}.` |
| `need.owner` | `{id}, {gate}` | `{id}, {gate}` |
| `need.blocked` | `{id}, a fix: {why}` | `{id}, uma correção: {why}` |
| `need.after` | `{id}, {after} archived first` | `{id}, que {after} seja arquivada antes` |
| `gate.grill` / `.approval` / `.retro` / `.merge` / `.decision` / `.dispute` / `.stage` / `.by-hand` | `your answers about its request / your approval of the plan / your answers to its retro / your merge of its pull request / a decision only you can take / your decision on the disputed review points / your result for an unfinished file / your delivery by hand` | `as suas respostas sobre o pedido / a sua aprovação do plano / as suas respostas à retro / o seu merge do pull request / uma decisão que só você pode tomar / a sua decisão sobre os pontos em disputa da revisão / o resultado de um arquivo inacabado / a sua entrega à mão` |
| `status-count` | `Roadmap: {open} open of {places} · {queue} in the queue · {archived} archived` | `Roadmap: {open} abertas de {places} · {queue} na fila · {archived} arquivadas` |
| `status-held` | `Starts held: processor at {load}% (limit {limit}%)` | `Começos segurados: processador em {load}% (limite {limit}%)` |
| `status-owner` / `-running` / `-blocked` / `-queue` / `-outside` | `Waiting for you / Under way / Blocked / In the queue / Outside the roadmap (the roadmap does not touch them)` | `Esperando você / Em andamento / Travadas / Na fila / Fora do roadmap (o roadmap não toca)` |
| `queue.place` / `.load` / `.after` | `ready, waits for a place / ready, held by the load / waits for {after}` | `pronta, espera vaga / pronta, segurada pela carga / espera {after}` |
| `outside.previous` / `.ticked` / `.unticked` / `.other` | `began under the previous script / ticked on the roadmap but not archived / archived, its line not ticked yet / not on the roadmap: {where}` | `começada no roteiro anterior / marcada no roadmap, mas não arquivada / arquivada, falta marcar a linha / fora do roadmap: {where}` |
| `running.stage` / `.phase` / `.github` | `{title} / {title}, phase {phase} of {phases} / waiting on GitHub ({what})` | `{title} / {title}, fase {phase} de {phases} / esperando o GitHub ({what})` |
| `status-no-roadmap` / `status-nothing` | `This project has no roadmap. Unfinished changes: / This project has no roadmap and no unfinished change.` | `Este projeto não tem roadmap. Changes por terminar: / Este projeto não tem roadmap nem change por terminar.` |
| `blocked-why.cannot-open` | `it could not be opened ({error})` | `não foi possível abrir ({error})` |

`running.*` takes the stage's bare title in the person's language as `{title}`, so the `{stage}` noun
phrase of change-coordinator D-9 is not used in a board row. The event lines are printed with `▸ `
before each by the script, not by the table. Three keys are the same string in both languages because
they hold only parameters and punctuation: `roadmap-stayed`, `need.owner` and `running.stage`; the
test's `EXEMPT_EQUAL` gains exactly these three (task 1.3), and nothing else is exempt.

## D-13 The skill (A-1, A-10, AC-5, AC-7)

`plugins/openspec/skills/devkit/SKILL.md` keeps its sections and gains two, after `## Waiting on
GitHub` and before `## Never`: `## Roadmap` and `## Status`. Its `description` adds "/devkit roadmap
[<n>] runs the roadmap's ready changes, several at once, and /devkit status shows where everything is"
and keeps "Use when the owner types /devkit, ..." with the two forms added; `argument-hint` becomes
`"change [<request> | <change-id>] | roadmap [<n> | stop] | status"`. In `## Start`, the modes
`roadmap` and `status` send the session to those sections.

`## Roadmap`, in short (the text the implementer writes, every rule backed by a script decision):

1. Run `node <skill-dir>/../../hooks/roadmap-loop.mjs run --lang ${user_config.language}
   --load-limit ${user_config.load_limit} --session ${CLAUDE_SESSION_ID}`, with `start`'s `text` on
   standard input through the same quoted heredoc as `start`. `roadmap-invalid`: say it and end the turn. `roadmap-none`: ask it with
   AskUserQuestion (yes: run `draft`, say its reply; no: run `reply roadmap-draft-declined`); end the
   turn.
2. With the JSON of `run` or `next`: start the `start` actions one after the other, each with
   `change-loop.mjs open <id> --script <s> --why <code>` and the request through the heredoc (the
   script chosen by the rule of `## A new change`); an exit 3 is declared with `roadmap-loop.mjs reply
   blocked --param id=<id> --param why=cannot-open --param error=<reply>`. Hand every `agent` action
   to its agent with `run_in_background: true` and the prompt `brief`, all in one message. Start every
   `wait` action as a background command (`roadmap-loop.mjs wait --change <id> ...`) and a `hold`
   action as a background command (`roadmap-loop.mjs hold ...`). Then do the `session` actions one at
   a time, as `## Loop` says, each followed by `next --after <id>=<progressKey>`.
3. When a background subagent of change `<id>` returns, run `next --after <id>=<key of its action>`;
   when a wait or a hold ends, run `next`. An agent's `Outcome: failure` and a red gate are declared
   with `roadmap-loop.mjs reply blocked ...` as in `## Loop`.
4. The message that ends a turn holds, in order: every `lines` entry not shown yet, the `end.reply`
   when there is one, and last the `ask` question of the head change, naming the change (the grill's
   questions included), re-asked when other events came after it. The owner's answer is for that
   change only; record it as `## Owner gates` says, then run `next`.
5. Never hand two stages of one change at once, never start a change `next` did not return, never
   dispatch a subagent for a whole change, never write the run file by hand.

`## Status`: run `roadmap-loop.mjs status --lang ... --load-limit ...` and show its output as it is.

**The tests of the skill.** The section test changes (D-18 T-2); a new test
`roadmap-loop skill: every roadmap-loop command carries the person's language and the load limit`
holds the mode flags to every call (the owner's rule: a mode flag reaches every call).

## D-14 ADR 0013, proposed with this plan

File `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`, in the form of the existing ADRs
(the header lines, `## Context`, `## Decision`, `## Consequences`, `### Review trigger`, `## Alternatives
considered` with `Option | Pros | Cons | Cost to undo`). Task 5.1 writes it as is (the date being the
day it is written; the guard keeps `docs/adr/` closed until the plan is approved, which is why its
text lives here):

    # ADR 0013: The roadmap coordinator is the owner's session, and its stages run in the background

    - Status: proposed
    - Date: 2026-11-2x
    - Change: roadmap-coordinator
    - Amends: ADR 0010 (0010-openspec-as-the-harness.md), the bullet of decision 8 that answers ADR 0005's "One subagent per whole change"; ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md), decisions 1 and 2, which name only /devkit change

    ## Context

    ADR 0010 decision 2 asks for a roadmap coordinator that starts every change whose after:
    dependencies are archived, several at once up to a number the owner sets per run. Its decision 8
    takes up ADR 0005's rejected "One subagent per whole change" for that mode: "in the roadmap mode
    of the Claude driver each change coordinator is a subagent. A question goes up to the session and
    the roadmap coordinator asks it", with the repeated report of a nested subagent's end to be
    "proved live before it is trusted". Section 10 of docs/coordination-design.md says the same.

    ADR 0011 then decided that, in the Claude driver, the change coordinator is the session the owner
    typed /devkit change in, held by hooks, because only that session can ask the owner the grill's
    questions, write approval.md from the owner's own message, and be called back when a background
    wait on GitHub ends. Each of those reasons holds for every change of a roadmap run as much as for
    one change.

    The locks of ADR 0011 follow one change per session: the reader of the run keeps only the newest
    change id the loop printed, any slash command typed after /devkit change ends the run, and the
    stop lock keeps one progress key per session. A run of several changes needs locks that follow
    each of them.

    The grill of the change roadmap-coordinator (2026-11-21) left the shape open between (a) a
    change-coordinator subagent per change with the stage agents as its subagents, and (b) the session
    running the loop of every open change itself, each stage handed to a subagent that runs in the
    background, to be settled by a probe before anything is built on it.

    ## Decision

    1. In the Claude driver the session the owner typed /devkit roadmap in is the roadmap coordinator
       and the change coordinator of every change the run holds open. It asks the loop for the next
       action of every open change, hands each stage to its role as a subagent that runs in the
       background, carries out the session steps one at a time, and asks the owner's gates in the
       session, one change at a time. There is one level of subagents, as in /devkit change.
    2. Decision 1 holds only on facts the probe of the change roadmap-coordinator checked before
       anything was built on it: a subagent started in the background lets the session end its turn,
       its end starts a new turn of the session, and two of them at once both reach it.
    3. The locks of ADR 0011 hold a roadmap run for every change it holds open. A roadmap run is under
       way when the newest slash command typed in the session, /devkit status aside, is /devkit
       roadmap and the roadmap loop printed its run line after it, both read from the session's
       transcript. In it the session writes no product code, hands work only to a role of the script
       of the change the hand-off names, and does not end its turn while a change has a stage ready
       that is not under way, or a change could start. The end of one change releases no other.
    4. What the files cannot say about a run in progress is one run's bookkeeping, the form ADR 0010
       decision 8 accepts: one file in the repository's git directory, outside every working tree,
       holding the number the owner set, whether a stop was asked, which change's gate the owner is
       being asked, which stages and waits are under way, the ends the session declared and the events
       already announced, and nothing else. A hand-off the hook lets through marks its stage as under
       way and that subagent's stop clears it; the hooks still only veto and record.
    5. ADR 0010's decisions 1 to 7, the rest of decision 8, and ADR 0011 for /devkit change are
       unchanged.

    ## Consequences

    - Positive: every owner gate is asked in the session that can record it; the changes that do not
      wait on the owner keep running while the owner answers another one; no subagent sits two levels
      down, so the nested end ADR 0010 asked to prove is never relied on; a lost end costs one re-read.
    - Negative: one session carries every open change (Mitigated: nothing is remembered; a compacted
      or new session reads the files and the bookkeeping file again). The bookkeeping file goes stale
      when a session dies with stages under way (Mitigated: a run started from another session starts
      it from empty; /devkit status shows what it holds). Two sessions running /devkit roadmap in one
      repository share the file (Accepted: one roadmap run per repository, documented; the opening of
      a change is serialized, so none is opened twice). Run detection reads an undocumented transcript
      format (Accepted, as in ADR 0011; a wrong reading fails open).

    ### Review trigger

    A subagent started in the background stops reporting its end to the session, in real use or a
    live test; Claude Code gives a subagent a way to ask the owner, or lets a session adopt an agent
    definition; the bookkeeping file needs to hold anything the files or GitHub could hold; a product
    edit by the coordinating session is found in a roadmap run.

    ## Alternatives considered

    | Option | Pros | Cons | Cost to undo |
    |---|---|---|---|
    | (a) A change-coordinator subagent per open change, its stages its own subagents (ADR 0010 decision 8 as written) | The literal design of section 10; each change's work stays out of the session's context | ADR 0011's three reasons hold per change: no owner questions, no approval.md, gone when a wait ends; every gate would end the subagent and be relayed; it relies on a nested subagent's end, the failure the owner reported | high |
    | The session runs every loop, its stages in the foreground, one batch per turn | No background end to rely on | The session is busy until the slowest stage returns, so nothing moves while the owner answers another change | low |
    | The run's bookkeeping in the transcript only | No file | A later turn, a hook and /devkit status in another session could not tell the number or what is under way without re-parsing the whole conversation | low |
    | A program outside the session that runs the roadmap (a daemon) | No session context to fill | The owner's gates still need the session; ADR 0001 and ADR 0010 accept a daemon only as a driver of its own (round 22) | high |
    | App child sessions, one per change (ADR 0006) | Each change visible in the sidebar | A start needs the owner's turn or an unbroken chain, the failure ADR 0010's survey found | medium |

The owner accepts or refuses ADR 0013 in the message that approves the plan (`approval.md` quotes the
owner's words). Refused: the plan goes back to planning before any code. Accepted: task 5.2 flips it
to `accepted`, with an `Accepted by:` line in ADR 0011's form, only when `approval.md` accepts it and
the probe record (task 1.1) shows B1 to B3 true; otherwise it stops and reports.

**Read against the earlier ADRs' rejected alternatives.** ADR 0001's "long-running orchestrator
session or daemon": the session remembers nothing; the bookkeeping file is one run's, as ADR 0010
decision 8 accepts. ADR 0001's "A Stop hook that re-prompts until done": the roadmap stop lock is the
capped veto of ADR 0010 decision 5 (once per unchanged state, fail open). ADR 0005's "One subagent
per whole change": rejected again, for its first reason, so ADR 0013 amends ADR 0010 decision 8's
bullet that took it up. ADR 0006's "a session per step" and child sessions: not used. ADR 0007's
"Keep the sweep as the default": taken up by ADR 0010 already; the owner's gates stay the owner's.

## D-15 The documents (AC-16)

- `docs/coordination-design.md`: the tense paragraph (`:19-30`) moves `/devkit roadmap`, `/devkit
  status` and the roadmap coordinator to what exists; section 1's table marks round 18's three rows
  built; section 2's "To be built in round 18" (`:68`) becomes "Built in round 18
  (`roadmap-coordinator`)", and "How it measures load is open" (`:78`) becomes **Decided by
  `roadmap-coordinator` on 2026-11-2x (A-6, grill questions 8 and 9)**: the processor load of the
  last minute per logical core against the per-person `load_limit` (80 by default), memory not
  measured, a held start announced once and checked every minute; section 4's stage 0 row says
  "(built, round 18)"; section 10's Claude bullet (`:366-370`) says "For the roadmap the session is the
  roadmap coordinator and the change coordinator of every open change; each stage runs as a subagent in
  the background (ADR 0013)", replacing "each change has its change coordinator as a subagent, which in
  turn calls the stage subagents ... the roadmap coordinator asks it in the session"; section 13's first
  item becomes "Many background subagent ends in a row over whole changes (round 19 proves it)"; the
  open point on load (`:463`) leaves "Open points" and the sentence before the list names it among the
  answered ones.
- `docs/adr/0010-openspec-as-the-harness.md`: a dated Note after the change-coordinator Note: "Note
  (roadmap-coordinator, 2026-11-2x): in the Claude driver the roadmap coordinator is the session the
  owner typed `/devkit roadmap` in, which runs the loop of every open change and hands each stage to a
  subagent in the background. ADR 0013 (linked as `[ADR 0013](0013-the-roadmap-coordinator-is-the-owners-session.md)`) amends
  the bullet of decision 8 that takes up ADR 0005's "One subagent per whole change". The load is the
  processor's, per core, against a per-person limit. Decisions 1 to 8 are otherwise unchanged." Once
  ADR 0013 is accepted, the header gains `- Amended by ADR 0013 (0013-the-roadmap-coordinator-is-the-owners-session.md)`.
- `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`: its `## Context` gains a dated
  Note at its top: "Note (roadmap-coordinator, 2026-11-2x): the same session is the coordinator of every
  change of a `/devkit roadmap` run, and the locks follow every change of that run (ADR 0013, linked
  as in the ADR 0010 Note). For `/devkit change` nothing here changes." Once accepted, the header gains `- Amended by ADR 0013 (...)`. Its status stays `accepted`.
- `openspec/config.yaml`: the `ADRs:` line of `context` gains "0013 the roadmap coordinator is the
  owner's session, its stages in the background (proposed)", changed to "amends 0010 and 0011" once
  accepted (the tests `ADR 0010 is accepted, supersedes ADR 0001 and ADR 0007, and the config names it`
  in `guard.test.mjs` and `change-loop docs: the design records the answers` in `change-loop.test.mjs`
  read that line and keep passing).
- `docs/openspec-flow.md`: `:189` says `/devkit roadmap` and `/devkit status` exist and `project` and
  `help` are not built yet (rounds 19 and 23); "Grouping changes: the roadmap" (`:149-178`) says
  `/devkit roadmap` starts the ready changes by `after:` and the tick only reports; a new section "The
  roadmap coordinator: `/devkit roadmap` and `/devkit status`" after the change coordinator's (the
  forms, D-3; the lines, D-4; the run file, D-5; the load and `load_limit`, D-6, Windows included; the
  decision, events and owner queue, D-7; the board, D-8; stop and draft, D-9; the locks of a roadmap
  run, D-11; one roadmap run per repository); Troubleshooting gains "a start is held", "the stop was
  refused in a roadmap run", "a change shows under way but nothing runs" (call `/devkit roadmap` from a
  new session); Limits (`:641`) says `/devkit roadmap` enforces `after:` for what it starts and
  `/devkit change` and `/ship-change` still do not; the CI pin moves from `v0.17.1` to `v0.18.0`.
- `docs/roles.md`: a section `## roadmap-coordinator` after `## change-coordinator` (Does, Delivers,
  Never, Stages: none, it starts changes; Played today by: the main session running `/devkit
  roadmap`, held by the roadmap run's locks; its team name in the design is `manager`), and
  `change-coordinator`'s "Played today by" adds "or `/devkit roadmap`, for every open change of its
  run". No line in the "The agent `<pack>:<role>`" form is added (the test of `PACKS` reads those).
- `plugins/openspec/README.md`: the `devkit` skill row and the hooks table name the two verbs; a row
  for `hooks/roadmap-loop.mjs`; the user settings name `load_limit`. `README.md`: the paragraph at `:68`
  adds `/devkit roadmap` and `/devkit status`. `docs/catalog.md` regenerated.

## D-16 Versions and release

| Pack | From | To | Why |
|---|---|---|---|
| devkit-openspec | 0.17.1 | 0.18.0 | two verbs, a new script, a user setting, lock modes for a new run |
| marketplace | 0.21.1 | 0.22.0 | the release |

`devkit-openspec`'s description (both files) gains "and `/devkit roadmap`, which runs the roadmap's
ready changes, several at once, with `/devkit status`". `CHANGELOG.md` gains `## 0.22.0 — the roadmap
coordinator, /devkit roadmap and /devkit status`. The CI pin of `docs/openspec-flow.md` moves to
`v0.18.0` in the same commit as the version. The tag `v0.18.0` exists only after the merge: a Workflow
follow-up.

**Validating the marketplace (`claude plugin validate .`, `CLAUDE.md` "Commands").** In this
environment the plain `claude` command is a shell function of the user's profile, which fails in the
sessions that run this change, so no gate calls it by name. The session that conducts this change runs
the validation with the desktop app's bundled Claude Code, found exactly as D-2 finds it, from the
worktree's root:

    C="$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"
    V="${TMPDIR%/}/devkit-validate-roadmap-coordinator"; mkdir -p "$V"
    { "$C" --version; git rev-parse HEAD; "$C" plugin validate .; } > "$V/phase-<n>.txt" 2>&1

and the phase's gate checks the record with `grep -q "Validation passed"`. Run on the base `6918c0d`
on 2026-11-21 with the bundled Claude Code 2.1.326, it ended with "Validation passed" (the conducting
session's fact). It runs after the last edit of `plugin.json` in phase 3 (task 3.4, the `load_limit`
setting) and after the release files in phase 5 (task 5.8). `tdd-implementer` does not run it: like
the probe, it calls the bundled Claude Code, which the conducting session owns.

## D-17 The live test (A-17, AC-1, AC-4, AC-6, AC-7, AC-12, AC-13, AC-14)

Run once, after phase 3 is green and committed and before the documents and the review (the
change-coordinator retro), by the session that conducts this change, as background commands, with the
desktop app's bundled Claude Code and the plugins from this change's worktree. The scratch project
lives at a fixed path outside the repository; the tree must be clean at the recorded commit.

    R="$(git rev-parse --show-toplevel)"
    C="$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"
    S="${TMPDIR%/}/devkit-live-roadmap-coordinator"; P="$S/project"
    test ! -e "$S" || mv "$S" "$S.old-$(date +%s)"
    mkdir -p "$P" && git -C "$R" rev-parse HEAD > "$S/commit.txt"
    cd "$P" && git init -q -b main && openspec init --tools none --no-animation .
    bash "$R/plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh" .
    printf 'schema: devkit-lite\nship:\n  devkit: pr\n  devkit-lite: pr\ndevkit:\n  language: en\n  driver: claude\n' > openspec/config.yaml
    printf '#!/bin/sh\necho hello\n' > hello.sh
    printf '# Roadmap\n\n## Round 1: flags\n- [ ] add-version-flag - hello.sh prints 0.1.0 with --version\n- [ ] add-help-flag - hello.sh prints one usage line with --help\n- [ ] add-quiet-flag (after: add-version-flag) - hello.sh prints nothing with --quiet\n' > openspec/roadmap.md
    git add hello.sh openspec && git commit -qm init
    run() { DEVKIT_HOOK_LOG="$S/hooks.jsonl" "$C" -p "$1" $2 --plugin-dir "$R/plugins/core" --plugin-dir "$R/plugins/openspec" --permission-mode bypassPermissions --output-format json; }

| Turn | Command | What it shows |
|---|---|---|
| L0 | `"$C" --version > "$S/version.txt"`; `run "/devkit status" > "$S/turn0.json"` | the board before any run: 0 open of 1, 3 in the queue (two ready, one waiting for `add-version-flag`), and, when the machine is loaded, the real load line (AC-6, AC-4 reading) |
| L1 | `run "/devkit roadmap 2" > "$S/turn1.json"`; `SID` = its `session_id` | `add-version-flag` and `add-help-flag` opened in their worktrees, `add-quiet-flag` not (AC-1); two started lines; the first grill's question names `add-version-flag`, the other change waits in the queue (AC-7) |
| L2 | `run "Aceito as suposições propostas e a opção mais simples em cada pergunta, para esta change e para a próxima." "--resume $SID" > "$S/turn2.json"` | both grills answered in turn, each question naming its change; each change then goes through the short script's proposal, specs and tasks through background subagents (AC-14: three stages each, every end in the hook log as an `agent` allow and a `subagent-stop` allow) |
| L3 | `run "Continue o roadmap, mas encerre a sua resposta antes de entregar a próxima etapa." "--resume $SID" > "$S/turn3.json"` | the stop lock refuses once in the roadmap run (`stop` `refuse` with `roadmap:` in the record), naming a ready stage (AC-13) |
| L4 | kill: `run "/devkit status" "--resume $SID" > "$S/turn4.json"`, then `run "/devkit roadmap 2" > "$S/turn5.json"` in a new session | the board mid-run; the new session starts the run file from empty, resumes both open changes (two resumed lines), starts no change twice (`git worktree list` unchanged) (AC-12) |
| L5 | `run "Para este teste: rode git stash list e depois tente escrever hello.sh com echo." "--resume <session of L4>" > "$S/turn6.json"` | the session's product edit refused in the roadmap run (the edit lock), and a hand-off to a general-purpose agent refused if the model tries one (AC-13) |

After each turn, record into `$S/record-<n>.txt`: `git -C "$P" worktree list`, the run file
(`cat "$P/.git/devkit/roadmap-run.json"`), `node "$R/plugins/openspec/hooks/roadmap-loop.mjs" status
--lang en --load-limit 80` in `$P`, the first two lines of each stage file present in each worktree,
and, after L5, `cat "$S/hooks.jsonl"` and the transcript lines holding `<command-name>` and
`devkit-roadmap:`. `pr-verifier` copies the records, as text, into `evidence.md` with the commit the
plugin was loaded from.

**Honest limits.** The model is not deterministic: the grill may ask other questions, a stage may run
instead of the stop L3 tries; the record says what happened and the hook log shows each lock either way.
A scratch project has no pull request: no change reaches the delivery part, so AC-7's "keep running
while the owner answers" and AC-14's many ends are shown over the plan stages only (proved next). The
load is real and not driven: AC-4's hold is proved by tests, and the live test shows the reading only.

## D-18 Tests that pin a rule this plan replaces

Searched in every suite (`plugins/openspec/hooks/*.test.mjs`, `plugins/core/skills/*/scripts/*.test.mjs`,
`plugins/openspec/skills/openspec-setup/scripts/*.test.mjs`, `plugins/panel/hooks/*.test.tsx`,
`plugins/compozy/skills/compozy-setup/scripts/*.test.mjs`) for `roadmap`, `status`, `not-built`,
`VERB_ROUND`, `round 18`, the skill's sections, the CI pin, the user settings, the text of
`verb-unknown` (`Por enquanto`, `So far`), the `why` lookup of `render`, the test helper `renderings` and
the fields of an end action. Five tests pin a rule this plan replaces or extend over the table this plan
grows; each is changed in the task named, and nothing else is:

| # | Test (suite) | Invariant | Layer | What changes |
|---|---|---|---|---|
| T-1 | `change-loop start: S1 a verb of a later round says its round and creates nothing` (`plugins/openspec/hooks/change-loop.test.mjs`) | a verb not built yet answers with its round and creates nothing | `change-loop.mjs start` | its list keeps `project` 19 and `help` 23; `roadmap` and `status` leave it; a new test `roadmap-loop start: roadmap and status are routed` covers them (task 2.1) |
| T-2 | `change-loop skill: the sections of D-3 to D-9 and the modes of start` (same suite) | the skill holds its sections in order and names every mode of `start` | the skill's text | the headings list gains `## Roadmap` and `## Status` before `## Never`; the modes gain `roadmap` and `status` (task 3.3) |
| T-3 | `change-loop docs: the design records the answers` (same suite) | the CI snippet pins the current release and no earlier one | the documents | `/v0\.17\.1/` becomes `/v0\.18\.0/`, and `v0.17.1` joins the refused pins (task 5.5) |
| T-4 | `change-loop start: S2 no verb or an unknown verb says only change exists` (same suite, `change-loop.test.mjs:896-905`) | an unknown verb, or none, answers one sentence naming the commands that exist and creates nothing | `change-loop.mjs start` | renamed `change-loop start: S2 no verb or an unknown verb names the commands that exist`; its pt-BR assertion `/^Por enquanto só existe \/devkit change/` becomes `/^Por enquanto existem \/devkit change, \/devkit roadmap e \/devkit status/`; its other assertions (the mode `unknown-verb`, the reply equal to `render('en', 'verb-unknown')`, the placeholder language) stay (task 2.1) |
| T-5 | `change-loop replies: no internal term in either language` (same suite, with its helper `renderings` at `change-loop.test.mjs:96`) | every message of the one table, each parameter code included, renders in both languages with no internal term, and every key is translated but the listed exempt ones | the message table of `change-loop.mjs` (`MESSAGES`, `render`) | `SAMPLE` and `renderings` as D-12 says (the new parameters, `title`, the `blocked-why.` codes for `BLOCKED_WHY_KEYS`, the `gate.` codes); the refused words gain `roadmap-loop` and `load_limit`; `EXEMPT_EQUAL` gains exactly `roadmap-stayed`, `need.owner` and `running.stage`; every assertion stays (task 1.3) |

Read and kept, because the rule they pin stays: `change-loop wait: W8 two failed reads keep waiting,
three in a row end blocked quoting the error` (it compares `action.end` whole; `end` keeps `{ state,
why }`, and `params` sits beside it, D-12); `change-loop decide: P9 a ceiling and the other blocked ends
of the plan` and every test that reads an action through `shape` or by field (an added field changes
none of them); `change-loop replies: a stage reads as a noun phrase in each language` (`render` of
`blocked` is unchanged); `change-loop lock run: ...` (all ten; `runOf` is
unchanged); `change-loop settings: other keys of the block and keys of other blocks are ignored` (the
limit is a person's setting, not the project's block); `change-loop settings: devkit-openspec has the
language user setting` (the `language` entry is unchanged); `change-loop start: S0 a usage error exits 3
and creates nothing` (its `roadmap` case still exits 3 on an unreadable config, D-3); `change-loop
reply: the keys that end the run ...` (`start` with `roadmap` prints no end line); the session-report
roadmap tests of `guard.test.mjs` (`readRoadmap parses ...`, `session prints the current round ...`,
`roadmap is printed with no change ...`, `without a roadmap ...`, `the roadmap never blocks ...`, `an
unreadable roadmap ...`, `readRoadmap keeps the description ...`, `field-fixes 12 roadmap: ...`): the
session report is not touched; `flow-check AC-2: the role document covers every role` and `change-loop
lock agent: the accepted packs are the ones docs/roles.md names` (the new roles section adds a heading
and no `<pack>:<role>` line); the ADR tests of `guard.test.mjs` (ADR 0010 stays `accepted`; the config
line still names 0010).

## Proof map: each criterion, its tasks and where it is proved

| AC | Proved here by | Stated limit | Proved next |
|---|---|---|---|
| AC-1 | `roadmap-loop lines:` C1 to C8; `roadmap-loop decide: starts` (order, places, never a C3, C7 only); live L1 | - | the selection on this repository's roadmap |
| AC-2 | `roadmap-loop run:` U1 (a word, 0, -1, 1.5), U4 (higher number starts more, lower starts nothing and interrupts nothing) | - | - |
| AC-3 | `roadmap-loop decide: places` (an owner wait, a GitHub wait, a blocked and a declared change each fill a place; an open change is resumed first) | - | - |
| AC-4 | `roadmap-loop decide: load` (at, above and below the limit, none open, announced once), `roadmap-loop hold:` (polls, exits below the limit or on stop, clears `holding`), `roadmap-loop setting:` (`limitOf`); live L0 reading | the hold under real load is not driven in the live test | a start held and released under real load |
| AC-5 | `roadmap-loop decide: events` (each event once, order); `change-loop replies: no internal term in either language` over the new keys, every gate code and every blocked reason (T-5); `roadmap-loop replies:` (a blocked line for every reason, every owner wait has a gate) | the model's own words around the lines are not tested | - |
| AC-6 | `roadmap-loop status:` (the owner's approved board rebuilt from fixtures, both languages, blocks in order and only when filled, the load line, no roadmap, nothing written) | - | - |
| AC-7 | `roadmap-loop decide: owner queue` (order, head kept while its gate is open, each `ask` names its change); live L1, L2 | the "others keep running" part is shown live only over the plan stages | changes running while the owner answers, over a whole change |
| AC-8 | `roadmap-loop run:` U3; `roadmap-loop decide: stopping` (no dispatch, E2 when nothing is in flight: the stopped reply then one stayed line per open change, no start, waits ignored) | - | - |
| AC-9 | `roadmap-loop decide: blocked` (event, place kept, dependents wait, E3 lists every need); `roadmap-loop decide: an end action carries the parameters of its reply`; `roadmap-loop replies: a blocked line renders every blocked reason in both languages` | - | - |
| AC-10 | `roadmap-loop run:` U2; `roadmap-loop draft:` (content, previous-script changes left out and named, an existing file never overwritten, nothing committed) | - | - |
| AC-11 | `roadmap-loop lines: the previous-script forms are the ones flow-check recognises` (P1 to P6 previous, Q1, Q2 and `other-work` not; task 1.2); `roadmap-loop lines:` C3, C4 and the outside rows (task 1.3); `roadmap-loop next: changes left alone` and `roadmap-loop status: changes left alone` on the D-4 fixtures (task 2.1) | the forms are built from the rule, not taken from a real project | a project that holds many old changes |
| AC-12 | `roadmap-loop run:` U4 and U5 (same session keeps, another session starts empty); `roadmap-loop decide: resume` (killed between `next` and `open`: no change twice); live L4 | - | - |
| AC-13 | `roadmap-loop lock run:` (`roadmapRunOf`, `/devkit status` skipped, other commands end it); `roadmap-loop lock stop:` RS1 to RS5; `roadmap-loop lock agent:` RH0 to RH5; `roadmap-loop lock subagent-stop:` RU1 to RU7; `roadmap-loop lock edit:`; live L3, L5 | locks fail open on an error (ADR 0011, ADR 0013) | - |
| AC-14 | `roadmap-loop lock subagent-stop:` RU6 clears; `roadmap-loop lock stop:` a lost end is refused once naming the stage; live L2 (three stages per change in the hook log) | an agent that dies with no stop event keeps its change under way until a new session's run | many ends in a row over whole changes |
| AC-15 | the whole `change-loop` suite, untouched but for T-1 to T-5; `change-loop open: two opens at once` (D-10) | - | - |
| AC-16 | `roadmap-loop docs: the documents follow` (design sections and open point, ADR 0013's headings and status, the two Notes, the config line, the flow section, `docs/roles.md`, both READMEs); `python3 scripts/check.py`; `python3 scripts/gen-catalog.py --check` | - | - |

## Risks / Trade-offs

| Risk | P | I | Mitigation |
|---|---|---|---|
| A background subagent's end does not start a session turn (B2), so the run stalls | MEDIUM | HIGH | Probed first (D-2): false stops the plan before anything is built; in use, the stop lock and `/devkit status` show it, and `/devkit roadmap` from a new session re-reads |
| The stop lock runs `nextAction` for every open change at each end of turn, with GitHub calls in the delivery part, past the hook's 60 s | MEDIUM | MEDIUM | Fail open on timeout; RS1 returns before any read while stopping; a change in flight is not read (N1 first); documented in Troubleshooting |
| The run file goes stale (a dead session) and a change shows under way with nothing running | MEDIUM | LOW | Another session's `run` starts it from empty; the board shows it; Troubleshooting names the way out |
| Two sessions run `/devkit roadmap` in one repository and drive the same change | LOW | MEDIUM | Documented as one run per repository; D-10 keeps a change from being opened twice; K1 and K2 end a stage run twice with nothing changed |
| Several changes open at once conflict in shared files (release files, the roadmap) and make reviews stale | HIGH | MEDIUM | Only changes with no `after:` between them run at once; the delivery part's release-conflict rows of `/devkit change` resolve release files; a stale stage runs again alone (ADR 0010) |
| The session's context fills with several changes | MEDIUM | MEDIUM | Nothing is remembered; every decision is re-read; a compacted session goes on from `next` |
| The model drops an action of `next` | MEDIUM | MEDIUM | The stop lock refuses once, naming it (RS3) |
| A blocked line is rendered through the wrong reason family and throws on the first blocked change | LOW | HIGH | `BLOCKED_WHY_KEYS` in `render`, `params` on every end action, and a test that renders `roadmap-blocked` and `need.blocked` for every `blocked-why.` code in both languages (D-12) |
| An owner wait added to `/devkit change` later has no gate phrase | LOW | MEDIUM | `gateOf` throws on an unknown `why`, and `roadmap-loop replies: every owner wait has a gate` iterates every `waiting-` key of the table |
| `claude plugin validate .` cannot be run by name in the sessions of this change | HIGH | LOW | The conducting session runs the bundled binary as D-16 says and the gate reads its record |
| `load_limit` as a string confuses a person who types `80%` | LOW | LOW | `limitOf` reads it as 80 (not a whole number); the description says "a whole number" |
| Windows reports no load | LOW | LOW | The machine never counts as loaded; documented |

## Migration Plan

Projects install devkit-openspec 0.18.0; nothing changes until someone types `/devkit roadmap` or
`/devkit status`. The run file lives in `.git/devkit/` and is never committed; deleting it costs only
the number of the run. Rollback: revert the merge commit; projects reinstall 0.17.1, where the two verbs
say round 18 again; the run file is ignored by that release.

## Implementation plan

Dependency order: the probe, then the pure selection and decision core with its fixtures, then the
commands and the run file over it (with the open lock), then the locks, then the skill and the setting,
then the live test, then the documents, the ADR, the release and the whole suite.

**Per surface.**

- devkit-openspec: `hooks/roadmap-loop.mjs` and `hooks/roadmap-loop.test.mjs` (new);
  `hooks/change-loop.mjs` (`start` routing, `VERB_ROUND`, `verb-unknown`, the new message keys, the
  `gate` family and `BLOCKED_WHY_KEYS` of `render`, `params` on an end action, `projectGate` and
  `scriptAgents` exported, `subagentStopFor` and `handOffFor` extracted, the open lock with
  `sleepSync`); `hooks/guard.mjs` (`roadmapRunOf`, `lock` routing, `mainInRun`); `hooks/guard.test.mjs`
  (one import line); `hooks/change-loop.test.mjs` (T-1 to T-5 of D-18, the open concurrency test); `skills/devkit/SKILL.md`; `.claude-plugin/plugin.json` (`load_limit`,
  version, description); `README.md`.
- Repository: `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md` (new),
  `docs/adr/0010-openspec-as-the-harness.md`, `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`,
  `docs/coordination-design.md`, `docs/openspec-flow.md`, `docs/roles.md`, `openspec/config.yaml`,
  `README.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `docs/catalog.md` (generated).

**Files to create**: `plugins/openspec/hooks/roadmap-loop.mjs`, `plugins/openspec/hooks/roadmap-loop.test.mjs`,
`docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md`. **Files to delete**: none.

**`roadmap-loop.mjs` layout** (no AI, Node built-ins and the pack's hook modules only, as
`change-loop.mjs`): `limitOf`, `readLoad`, `parseWord`, `classifyLines(rounds, facts)` (pure, D-4),
`decideRoadmap(facts)` (pure, D-7), `boardOf(facts, lang)` (pure, D-8), `draftText`, the run file
(`runFilePath`, `readRun`, `updateRun` with its lock), `collectRoadmap(cwd, opts)` (the facts:
roadmap, archived, unfinished, actions, run file, load), `runCommand`, `nextCommand`, `statusCommand`,
`draftCommand`, `waitCommand`, `holdCommand`, `replyCommand`, the three lock decisions, and `main(argv,
{ env, cwd, stdin, openspec, gh, load, sleep })` with the subcommands `run`, `next`, `status`, `draft`,
`wait`, `hold`, `reply`; `isMain` as in `change-loop.mjs`. Every test env blanks `DEVKIT_BYPASS`,
`DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` through
one shared constant, and every test name starts `roadmap-loop`.

**Estimate**: optimistic 36 h, likely 50 h, pessimistic 69 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| The probe and its record (phase 1) | 2 | Testing | MEDIUM |
| The previous-script fixtures of D-4 and their test (phase 1) | 1.5 | Testing | LOW |
| `classifyLines`, `decideRoadmap`, `boardOf`, `limitOf`, `gateOf`, the message keys, the `render` changes, `params` on an end action, T-5 and their tests (phase 1) | 11 | Core | MEDIUM |
| The run file, `run`, `next`, `status`, `draft`, `wait`, `hold`, `reply`, the `start` routing, the open lock, the changes-left-alone tests, T-1, T-4 (phase 2) | 10.5 | Core | MEDIUM |
| `roadmapRunOf`, the routing, the stop, hand-off, stage-agent and edit locks with in-flight records (phase 3) | 8 | Core | HIGH |
| The skill, the setting, T-2, the skill tests, the validation record (phase 3) | 3 | Integration | MEDIUM |
| The live test and its record (phase 4) | 4 | Testing | MEDIUM |
| ADR 0013, the Notes, the design page, the flow page, roles, READMEs, config, versions, CHANGELOG, pin, T-3, the docs test, catalog, the whole suite (phase 5) | 6 | Documentation | LOW |
| Fixes from the live test (absorbed in phases 3 and 4 when found) | 4 | Core | MEDIUM |

**Assumptions** (where the plan breaks if wrong): B1 to B3 as the probe finds them (D-2); the exports of
`change-loop.mjs` named in Context exist at `6918c0d` (read in the source); `os.loadavg` behaves as
Node documents; the whole suite runs about 13 minutes (`CLAUDE.md`, "Commands") and this change adds
about two; the `openspec` CLI 2.x is on the machine (the suite needs it already); the desktop app's
bundled Claude Code validates the marketplace as the plain command would (it passed on the base,
D-16).

**Dependencies**: round 15 (`change-coordinator`) and round 17b (`coordinator-field-fixes`, archived at
`6918c0d`) for `change-loop.mjs` and the locks; ADR 0010 and ADR 0011; the desktop app's bundled
Claude Code for the probe and the live test (`CONTRIBUTING.md`, "Testing a mod pack").

## Decisions cited

ADR 0010 decisions 2 (several changes at once, the owner's number, lowering interrupts nothing), 3 (a
loop over files, four end states), 4 (each stage a subagent in the Claude driver), 5 (hooks veto,
capped), 7 (one at a time until round 18) and 8 (its ADR 0005 bullet, amended by ADR 0013; a daemon
or bookkeeping only as one run's); ADR 0011 (the session is the coordinator, held by hooks; decisions
1 and 2 extended by ADR 0013); ADR 0004 (locks act only in opted-in projects); ADR 0002 and ADR 0003
(each change's delivery and merge stay `/devkit change`'s); ADR 0006 (child sessions not used); ADR
0005 (its rejected "One subagent per whole change", rejected again).
