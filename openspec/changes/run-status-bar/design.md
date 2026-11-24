<!-- devkit-stage design result=passed attempt=1 commit=a11521bd439a1a20d302abf4d7f7f82fc930a32f -->
# Design

Change: `run-status-bar` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Specs: [specs/status-line/spec.md](specs/status-line/spec.md), [specs/change-state/spec.md](specs/change-state/spec.md)

## Context

See [proposal.md](proposal.md) for the why. The plan is written against `origin/main` at `3af3655`,
which the branch has not merged yet (the branch opened at `a11521b`): since then `suite-speed` replaced
the test command by `node scripts/test-suite.mjs` and split the test files (shared helpers now live in
`plugins/openspec/hooks/test-fixtures.mjs` and `change-loop-fixtures.mjs`; no test file imports another,
ADR 0026), and `stage-models`, `delivery-train` and `compozy-driver` changed `change-loop.mjs` without
touching the `state` command (`stateEntries` and `runState` read the same on both commits). The last
step of the base, from `298c3f3` (the base of the earlier readiness attempts) to `3af3655`, is
`stale-only-on-own-files` (pull request 97): it changes only `collectFlow`'s staleness inputs in
`flow-check.mjs` (not `artifactState`), leaves `change-loop.mjs`, `roadmap-loop.mjs`, `merge-setup.mjs`
and `run-file.mjs` as they were, and moves devkit-openspec to 0.39.0 (marketplace 0.43.0) with the doc's
release pins. Every path and test file below is `origin/main`'s; task 1.1 merges it first.

What exists:

- `node plugins/openspec/hooks/change-loop.mjs state [--change <id>] --lang <l>` (`runState`,
  `stateEntries`) prints `{"version": 1, "changes": [...]}`, one entry per change with `change`, `state`,
  `reason`, `stage`, `stageTitle`, `phase`, `stageIcon`, `stateIcon`, `title`, `script`, `root`, `branch`
  (spec `change-state`; ADR 0017 decision 1: the panels read this command).
- Which stages apply is decided today only inside the stage walk: `artifactState` in
  `plugins/openspec/hooks/flow-check.mjs` reports a stage `not-applicable` with the code `skipped`,
  `past-point`, `flag-absent`, `setting-absent` or `role-not-shipped` (spec `change-stages`, "A conditional
  stage applies only when its condition holds", "A stage that arrived after the change passed its point").
  `computeFlow` then overwrites the code of every stage after the current one with `waits-for`, so
  `report.stages` cannot be read back for this; `planArtifactsOf` in `conduct-check.mjs` filters plan
  files for another purpose (it drops every `appliesWhen` stage). No other copy exists: `grep -rn
  appliesWhen plugins/openspec/hooks/*.mjs` finds only these two and the flow validator in `guard.mjs`.
- `roadmap-loop.mjs run` records `--session ${CLAUDE_SESSION_ID}` as the run file's `session`
  (`plugins/openspec/skills/devkit/SKILL.md`, roadmap part 1; ADR 0021), read by `readRun(runFilePath(cwd))`
  of `plugins/openspec/hooks/run-file.mjs`. The run file stays after a run ends.
- Claude Code (2.1.69, read from the installed binary's own status line instructions) runs the
  `statusLine` command of the settings (`{"type": "command", "command": "...", "padding": n}`) and writes
  one JSON object to its standard input with, among others, `session_id`, `transcript_path`, `cwd`,
  `model`, `workspace.current_dir`, `workspace.project_dir`, `version`, `output_style`, `context_window`,
  and an optional `worktree`. It refreshes the line 300 ms after the conversation changes and aborts the
  run still in flight when a new one starts.
- Measured in this worktree on 2026-11-24 (load average 23 to 31) with `gh`, `git` and `openspec`
  wrappers that log each call: `state --change run-status-bar` took 4.8 s with 0 `gh`, 2 `openspec` and
  about 80 `git` calls; the listing `state` took 26 s with 16 `gh` calls, and 14 s with a `gh` that
  fails at once. The listing exits 3 here today (`no change named delivery-train`), the defect
  `state-skips-unlocated` fixes.

## Goals / Non-Goals

**Goals:** the three lines of the approved mock-up, exactly; one `state` call per refresh at most; no
GitHub call on the roadmap listing; one shared helper for the stages that apply.

**Non-Goals:** a cache or any stored state (a write, which AC-5 forbids); colours; reading the terminal's
width; a refresh timer (Claude Code decides when to run the command); a new verb of `/devkit`; changes to
`plugins/panel`, the session title or `/devkit status`.

## Decisions

### D-1 The command and how the owner turns it on

New file `plugins/openspec/hooks/status-line.mjs`: `node status-line.mjs [--lang <en|pt-BR>]`, Node
built-ins plus imports of `change-loop.mjs` (the message table and `normalizeLang`) and `run-file.mjs`.
It always exits 0 (a status line with an error code shows nothing anyway); an unknown option prints
one line on standard error and nothing on standard output. `--lang` is passed to `state` as given and
normalized like every other surface (`normalizeLang`: `en`, else `pt-BR`).

The README and `docs/openspec-flow.md` give the owner this entry for `.claude/settings.json` (the
project's or the user's), which picks the newest installed copy, so a plugin update needs no edit:

```json
{ "statusLine": { "type": "command", "command": "f=$(ls -d \"${CLAUDE_CONFIG_DIR:-$HOME/.claude}\"/plugins/cache/*/devkit-openspec/*/hooks/status-line.mjs 2>/dev/null | sort -V | tail -n 1); [ -n \"$f\" ] && node \"$f\" --lang pt-BR" } }
```

The newest copy is safe for a project pinned to an older flow: every released flow version stays
readable (spec `change-stages`, "Every released flow version stays readable"). The change writes no
settings file (requirements, out of scope).

Alternatives: a plugin root variable in the setting (rejected: the setting is the owner's file, not
the plugin's, and nothing documents such a variable for `statusLine`); a fixed versioned path (rejected: every update breaks it,
against "turns it on once"); a `/devkit` verb that writes the setting (rejected: a write the owner
excluded).

### D-2 The input

Fields read: `session_id` (string), `workspace.current_dir` (string), else `cwd` (string). Every other
field is ignored, `transcript_path` included (AC-2). The folder used is the first of those two that is
a non-empty string, else `process.cwd()`; the session is `session_id` when a non-empty string, else
none.

Parser decisions (the project's parser rule): standard input that is a terminal is not read; otherwise
it is read to its end, for at most 1 second; empty input, input cut off before its end (an unclosed
object), input that is not JSON, or JSON that is not an object all read as "no fields": the folder is
`process.cwd()` and no session. This keeps a hand run (`node status-line.mjs --lang en < /dev/null` in a
worktree) useful.

The read reuses `change-loop.mjs`'s exported `readStdin` (the project's one-helper rule; `guard.mjs` keeps
its own older copy, which this change does not touch). `readStdin` gains one optional parameter, the
wait in milliseconds, defaulting to today's `STDIN_WAIT.ms` (10 s), so `start`, `open`, `write-back`,
`compozy-start` and the importers in `project-loop.mjs` and `roadmap-loop.mjs` read exactly as before;
the bar passes 1000. The bound differs because the callers differ: a `start` request may be piped by a
person or a script that writes late, while Claude Code writes the status line's JSON at once and
refreshes 300 ms after the conversation changes, so a 10 s wait would only keep a stale run alive.
B-46 pins the 1 s bound on the real process (standard input a pipe left open and never written); the
10 s default stays pinned by the existing tests of `start`, which this change does not edit.

### D-3 Which line, and the calls it costs

First match wins:

1. **Coordinator.** The session is not none and equals `readRun(runFilePath(folder)).session` (one
   `git rev-parse` and one file read; the run file sits in the common git folder, so this holds from any
   checkout of the clone): one call `state --offline --lang <l>`, then the counts line (D-7).
2. **One change.** `git -C <folder> rev-parse --show-toplevel` gives the checkout, `git -C <folder>
   symbolic-ref --short -q HEAD` its branch. The candidate id is `<id>` for a branch `chore/archive-<id>`,
   else the branch itself when `<checkout>/openspec/changes/<branch>/` is a folder. No candidate (a
   detached HEAD, `main`, a branch with no folder): nothing is printed and no `state` runs. With a
   candidate: one call `state --change <id> --lang <l>`; the line is drawn only when the entry's
   `root` is the checkout (both through `realpathSync`) and its `branch` is the branch; else nothing.
3. Otherwise nothing.

So a refresh costs at most one `state` call and three `git` calls, and none of `state` in a session
that conducts nothing. The order puts the coordinator first because its session can sit in any
folder, while a change session is always in its change's worktree (ADR 0014, ADR 0021).

Requirements' option (a) is kept and made cheap: the root and branch are still checked against the
`state` entry, but the id comes from the branch instead of from a listing (26 s measured). Option (b),
the transcript, is rejected: AC-2 forbids reading it. Falling back to "the only active change of the
checkout" when the branch names none is rejected: on an unrelated branch it would show a change the
session does not conduct.

Reading the run file's `session` is not a read of a change's state: ADR 0017 decision 1 governs the
state of a change, which the bar takes only from `state`; which session started a run is the run's
bookkeeping, read through the one parser every reader shares (`readRun`).

### D-4 The `state` additions and the one shared helper

In `plugins/openspec/hooks/flow-check.mjs`:

- `export function notApplicableOf(stage, facts)`: the rule-based code or `null`, in `artifactState`'s
  first-match order: `skipped` (the stage is in `facts.skipped`); then, only when the stage has no file,
  `past-point`, `flag-absent`, `setting-absent`, `role-not-shipped`. `artifactState` calls it in place of
  its own lines, so the walk does not change (its tests in `flow-check.test.mjs` pass unchanged).
- `export function appliedStages(facts, flow)`: `null` when `facts.archived`, when `flow` is null, or
  when `isPreviousScript(facts.files, flow)`; else the ids of `flow.stages`, in order, without those
  whose `source` is `artifact` and whose `notApplicableOf` is not `null`. A stage whose own header says
  `not-applicable` is kept (the mock-up keeps `decisions` as a done mark). This is the one helper; the
  bar never computes the list.

In `plugins/openspec/hooks/change-loop.mjs`:

- `nextAction` gains the option `stages = false`; when true it sets `action.stages = appliedStages(facts,
  flow)` from the `facts` and `flow` it already holds. `next` never passes it, so its output does not
  change.
- `stateEntries` passes `stages: true` and adds `stages: action.stages ?? null` to each entry, after
  `branch`; the archived and start-with-no-folder entries it builds itself get `null`.
- `runState` takes the flag `--offline`: when set, `gh` is the offline stub (below) for the whole
  read. `USAGE` reads `state [--change <id>] [--offline] --lang <l>`.

The offline stub `() => ({ status: 1, stdout: '', stderr: 'offline' })` exists as `OFFLINE_GH` in
`roadmap-loop.mjs`. It moves to `plugins/openspec/hooks/merge-setup.mjs`, beside `makeGh`, exported as
`OFFLINE_GH`; `roadmap-loop.mjs` imports it and loses its own copy; `change-loop.mjs` imports it. The
test files' own `OFFLINE`/`noGh` stubs stay as they are (fixtures, not product code).

No existing field changes meaning; `stages` is added at the end of each entry. A remote machine's
`state` (`machine-probe.mjs`) is another command and is not touched.

Proof against the `state` spec: with `--offline`, a stage that does not need GitHub keeps its state
(`change-state`, "The grill and the plan with GitHub silent"), and a stage that needs it reads
`waiting-on-github` / `silent`, which the counts line counts in play only, like a real wait on GitHub.
The lone-change call keeps GitHub. What was measured: a change on its own branch, before the delivery,
whose roadmap line has no `after` dependency, makes no `gh` call (0 calls at the proposal stage; the
delivery reads start only in `inDelivery`). Two sessions the bar serves do call GitHub on every refresh:

- a session on the archive branch `chore/archive-<id>` is off its own branch (`offOwnBranch` in
  `flow-check.mjs`), and with a `ship` other than `plan` (the test `config.ship !== 'plan'` of
  `postMerge` in `flow-check.mjs`, so `pr` as well as `merge`) the walk runs the delivery's reads (`delivery()`), which call
  `gh`;
- a change session of a roadmap run whose roadmap line has `after` dependencies, at a plan stage, reads
  `archivedOnDefault` (one `gh api` call per `state` run, cached inside `stateEntries`).

Both are kept as they are: those calls show the real state (the archive's merge wait, a dependency
still unarchived), where `--offline` would print "GitHub did not answer" instead; each refresh's calls
sit inside the one `state` call and its 20 s bound (D-9), and a newer refresh aborts a stale one. At
the delivery the same holds for a change on its own branch, and the session mostly sits in its `wait`
command, so the conversation, and with it the refresh, rarely moves. B-10 pins the archive-branch case:
its one `state` call is `state --change <id>` with no `--offline`.

Alternative rejected: a bounded `gh` (a short timeout) on every listing: it still sends 16 requests per
refresh of the coordinator, the load the owner asked to avoid.

### D-5 The change's line

From the entry: `head` is `[stateIcon, stageIcon, change]` without nulls, the stage icon left out when
it equals the state icon (archived: `📦` once), joined by spaces. Then the parts, joined by ` · `:
`head`; `stageTitle` when not null; the strip and `<n> of <N>` when `stages` is a list holding `stage`;
`reason.text` when `state` is not `running` and `reason` is not null.

Strip: for each id of `stages` at index `i`, with `k` the index of `stage`: `■` when `i < k`, `◆` when
`i == k`, `□` when `i > k`. `n = k + 1`, `N = stages.length`. The marks are positional: when the loop
sends the change back (a failed review goes to the implementation), the strip shows where it is now,
and every stage before it as done, as the mock-up asks ("the earlier stages marked done").

`stages`, and with it N, is read anew on every refresh (the bar keeps nothing between runs, D-10), so N
follows the change: it can change when the classification line is written (a `ui` flag adds `mockup`)
or when a test setting appears (`tests.unit` adds `unit-tests`). A change whose grill has not yet
written its classification reads 14 for a flow whose `mockup` then applies, and 15 after. S-12 pins it
on the `state` side; the bar draws whatever list it reads.

The reason is shown for `waiting-for-owner`, `waiting-on-github` and `blocked`; a `running` entry with
the reason `ready` or a held reason (ADR 0021) shows none, as requirements says ("while the change is
stopped"); its `⏳` state icon already says that it waits. Alternative rejected: a reason whenever one
exists (it would print "ready, waiting for someone to continue" in the very session that continues it).

Glyphs: `■` U+25A0, `◆` U+25C6, `□` U+25A1, `…` U+2026, as approved.

### D-6 Width and the cut rule

`columns(text)`: each code point counts 1, except U+FE0F, U+200D and combining marks (0) and
Extended_Pictographic code points (2). So `🛠️` is 2, `🙋` 2, `■` 1, `…` 1, `ç` 1. The limit is 100.

When the line is wider: (1) while the reason has more than one word, drop its last word and end it in
`…` (no space before it), until the line fits; (2) if it still does not fit, drop the reason and its
` · `; (3) if it still does not fit, cut the id (defined below); a line still wider is printed as it
is (the stage title, the strip and `<n> of <N>` are never cut). Checked on the mock-up: the grill line
is 104 whole and 97 cut (`your answers about its…`), the long-id line is exactly 100.

The id cut of step 3: `fitting` is the largest number of the id's leading columns such that
`columns(line with those columns of the id followed by "…") <= 100`; the `…` is not part of `fitting`.
The id keeps `max(20, fitting)` of its leading columns (whole code points; change ids are ASCII, one
column each) and then `…`, so the cut id with its `…` is `max(21, fitting + 1)` columns. Pinned
numbers (B-31), for a `running` entry at `Implementation` with the 15-stage strip and `11 of 15`, whose
parts other than the id take 49 columns (`🛠️ ` 3, ` · Implementation · ` 20, the strip 15, ` · ` 3,
`11 of 15` 8): an id of 60 ASCII letters keeps 50 of them and the line is exactly 100 columns; with the
stage title replaced by 60 letters (the other parts then take 95), an id of 40 letters keeps 20, and
the line, 116 columns, is printed as it is.

### D-7 The counts line

From the listing's `changes`: `in play` = all; `working` = `state` `running`; waiting = `waiting-for-owner`;
blocked = `blocked`. Every count is printed, zero included. `waiting-on-github` and `archived` count in
play only. A listing that fails (non-zero exit, not JSON, past 20 s) prints nothing.

### D-8 The words

New keys in the message table of `change-loop.mjs` (`MESSAGES`, read through `render`), in both languages:

| Key | en | pt-BR |
|---|---|---|
| `bar.progress` | `{n} of {total}` | `{n} de {total}` |
| `bar.counts` | `{all} in play · {running} working · 🙋 {waiting} waiting on the owner · ⛔ {blocked} {blockedWord}` | `{all} em jogo · {running} em andamento · 🙋 {waiting} aguardando o dono · ⛔ {blocked} {blockedWord}` |
| `bar.blocked-one` | `blocked` | `bloqueada` |
| `bar.blocked-other` | `blocked` | `bloqueadas` |

`bar.blocked-one` is used when the count is 1. Stage titles and reason texts come from the `state`
entry, already in the person's language.

### D-9 Bounds and processes

The `state` call is `spawn(process.execPath, [<hooks>/change-loop.mjs, 'state', ...])` with the folder as
its working directory and a 20 s bound (the bound `roadmap-loop.mjs` already gives a remote `state`
read, `ASK_TIMEOUT_MS.state`), killed with `SIGTERM` at the bound. On `SIGTERM`, `SIGINT` or `SIGHUP`
(Claude Code aborting a run for a newer one) the bar kills its child before it exits, so runs never
pile up. The `git` calls use `execFileSync` with a 5 s bound each.

Injection points, for the tests only (a real 20 s wait is not a test): `status-line.mjs` exports
`main(argv, { stdin, cwd, stateCommand, boundMs, signal })`, returning a promise of
`{ stdout, stderr, code }` (`code` always 0). `stdin` is the input text (the process passes
`readStdin(1000)`, D-2); `cwd` defaults to `process.cwd()`; `stateCommand` is the program and leading
arguments of the `state` call, default `[process.execPath, <hooks>/change-loop.mjs]`; `boundMs` defaults
to 20 000; `signal` is an `AbortSignal` that, when aborted, kills the child as the bound does. The
process entry wires `SIGTERM`, `SIGINT` and `SIGHUP` to one `AbortController` whose signal it passes,
writes `stdout` and `stderr`, and exits 0. So B-14 points `stateCommand` at a fixture script that
counts its runs in a file and prints a valid listing; B-18 points it at a fixture script that writes
its pid and sleeps, with `boundMs` 300, and checks that pid is gone; B-19 aborts `signal` while that
sleeping script runs and checks the same. The fixture scripts live in the test's `tmpFolder`; the
product code reads no environment variable for this.

### D-10 Read-only and no AI

The command spawns only `process.execPath` (the `state` command) and `git` (read-only verbs), opens only
the run file and standard input, and writes only its line to standard output. It prints neither
`devkit-run:` nor `devkit-end:`. A test reads the source and fails on any write call, any spawn of
another program, any read of `transcript_path`, `spentOf` or `budget`.

### D-11 Tests

Every new test is named `run-status-bar <AC-n> <area>: ...`, one test or awaited `t.test` subtest per
guard and label, negatives included. Fixtures come from `test-fixtures.mjs` and `change-loop-fixtures.mjs`
(`approvedChange`, `planChange`, `roundRepo`, `gitRepo`), temporary folders through `tmpFolder` of
`test-tmp.mjs`, envs from the fixtures' shared constant that blanks the branch variables.

New tests, `plugins/openspec/hooks/flow-check.test.mjs` (the helper):

| Id | Test |
|---|---|
| H-1 | `notApplicableOf` gives `skipped` for a skipped stage, file or not |
| H-2 | `past-point` for a stage with no file whose `notAfter` file exists |
| H-3 | `flag-absent` for an `appliesWhen.flag` the flags lack; `null` when they hold it |
| H-4 | `setting-absent` for an `appliesWhen.setting` not set; `null` when set |
| H-5 | `role-not-shipped` for `shipped: false` (a synthetic flow) |
| H-6 | `null` for a stage with a file, whatever its condition |
| H-7 | `appliedStages` keeps flow order and drops exactly the stages H-1 to H-5 flag; keeps a header `not-applicable` stage |
| H-8 | `appliedStages` is `null` for an archived change, no flow, a previous-script change |

New file `plugins/openspec/hooks/change-state-stages.test.mjs` (the `state` additions):

| Id | Test |
|---|---|
| S-1 | a `devkit` change with flags `[ui, contract]` and no test settings lists the 15 ids |
| S-2 | without the `ui` flag and no `mockup.md`, `mockup` is not listed |
| S-3 | with `tests.unit` set, `unit-tests` is listed |
| S-4 | a `decisions.md` with `result=not-applicable` keeps `decisions` |
| S-5 | `stages` is `null`, read through the command, for an archived change, for a start the run file names with no folder, and for a change begun under the previous script (its folder holds the previous script's files, so `isPreviousScript` holds) |
| S-6 | `next` prints no `stages` key |
| S-7 | `--offline`, listing and `--change`, in a real process with a logging `gh` first on `PATH`, on a plan-stage fixture (`planChange`) and on a delivery-stage fixture (`deliveredChange`, its pull request waiting on checks): no call in either |
| S-8 | `--offline` at the plan approval: same state, reason, stage and title as with GitHub answering |
| S-9 | `--offline` at the delivery's checks: `waiting-on-github`, `silent` |
| S-10 | `--offline yes` exits 3 with the plain reply |
| S-11 | `roadmap-loop.mjs` defines no offline stub of its own and imports `OFFLINE_GH` from `merge-setup.mjs` |
| S-12 | two `state --change feat` reads of the same `devkit` change with no `mockup.md`, before and after its classification line gains the `ui` flag: the first `stages` has no `mockup`, the second holds it, so N goes from 14 to 15 |

New file `plugins/openspec/hooks/status-line.test.mjs` (the bar). The drawing functions are exported
(`lineOfChange(entry, lang)`, `countsLine(changes, lang)`, `columns(text)`, `inputOf(text)`) and tested
directly; the choice of line and the process behaviour run the real command in a fixture repository,
with the injection points of D-9 (`stateCommand`, `boundMs`, `signal`) where the test names one:

| Id | Area | Test |
|---|---|---|
| B-1 | input | `workspace.current_dir` wins over `cwd` |
| B-2 | input | `cwd` when `workspace` is missing |
| B-3 | input | empty standard input: the process's folder, no session |
| B-4 | input | not JSON: same as B-3 |
| B-5 | input | an unclosed object: same as B-3 |
| B-6 | input | JSON that is an array or a string: same as B-3 |
| B-7 | choice | coordinator: the session the run file records prints the counts line, from the main checkout and from a change worktree |
| B-8 | choice | another session id, no session id, no run file: no counts line |
| B-9 | choice | a change worktree on its branch prints its line |
| B-10 | choice | an archive branch `chore/archive-feat` reads `feat` and prints its line; its one `state` call, recorded through `stateCommand`, is `state --change feat --lang en` with no `--offline` (D-4) |
| B-11 | choice | a branch with no change folder, a detached HEAD, `main`: nothing, no `state` call |
| B-12 | choice | an entry whose `root` or `branch` differs: nothing |
| B-13 | choice | not a git folder, no `openspec/`: nothing, exit 0 |
| B-14 | calls | each refresh makes at most one `state` call (counted by the fixture script `stateCommand` names, D-9) |
| B-15 | calls | a plan-stage `state --change` in a real process with a logging `gh`: no `gh` call |
| B-16 | failure | `state` exits 3: nothing, exit 0 |
| B-17 | failure | `state` prints no JSON: nothing |
| B-18 | failure | `state` passes the bound (`boundMs` 300, a sleeping fixture script): nothing, exit 0, the child's pid is gone |
| B-19 | failure | an abort of `signal` (what `SIGTERM`, `SIGINT` and `SIGHUP` do) ends the sleeping child before `main` returns |
| B-20 | line | `running`: no state icon, no reason |
| B-21 | line | `waiting-for-owner`: `🙋`, the reason |
| B-22 | line | `waiting-on-github`: `⏳`, the reason |
| B-23 | line | `blocked`: `⛔`, the reason |
| B-24 | line | `archived`: `📦` once, no strip, no progress |
| B-25 | line | `running` with `ready` and with a held reason: no reason |
| B-26 | strip | first stage current, a middle one, the last one |
| B-27 | strip | `stages` null, and a stage not in `stages`: no strip, no progress |
| B-28 | width | `columns` of `🛠️`, `🙋`, `■`, `…`, `ç` |
| B-29 | cut | step 1: the reason loses words, ends in `…`, keeps its first word |
| B-30 | cut | step 2: the reason is dropped with its ` · ` |
| B-31 | cut | step 3, the numbers of D-6: a 60-letter id keeps 50 letters and `…`, line exactly 100; with a 60-letter stage title, a 40-letter id keeps 20 letters and `…`, line 116, printed as is |
| B-32 | cut | a line of exactly 100 is not cut |
| B-33 | counts | AC-3's mix: `6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked` |
| B-34 | counts | zero entries: all four zeros |
| B-35 | counts | `waiting-on-github` and `archived` count in play only |
| B-36 | counts | the listing fails: nothing |
| B-37 | language | `of`/`de`; the counts words; `bloqueada` for 1, `bloqueadas` for 0 and 2; same codes, icons and numbers |
| B-38 | language | the new message keys exist in both languages |
| B-39 | budget | a `budget` cap in the fixture's config and a `transcript_path` naming a real transcript: no `%`, no `budget` or `orçamento` in either language (that the file is never opened is B-41's) |
| B-40 | read-only | `git status`, the run file and `git worktree list` unchanged after a run in each view; no `devkit-run:`/`devkit-end:` |
| B-41 | read-only | the source test of D-10 |
| B-42 | mock | each line of `mock/lone-change.md` (four moments, two languages, the long id) from entries holding the mock's facts, character for character |
| B-43 | mock | each line of `mock/roadmap-run.md` (10 running, and AC-3's mix, two languages) |
| B-44 | mock | `mock/nothing-conducted.md`: empty standard output |
| B-45 | usage | an unknown option: nothing on standard output, one line on standard error, exit 0 |
| B-46 | input | the real process, spawned with `stdio` `pipe` in a `tmpFolder` that is no git folder, its standard input left open and never written: nothing on standard output, exit 0, and the process ends within 5 s of its start (the 1 s bound of `readStdin(1000)`; the 10 s default would fail it) |

Existing tests this change touches (searched with `git grep` on `origin/main` for the `state` output, its
usage line and the offline stub):

| Id | File, test | Why | What changes |
|---|---|---|---|
| E-1 | `plugins/openspec/hooks/change-loop-remote-state.test.mjs`, `change-state AC-1 command: one change prints its state, reason, stage and title in the person's language` | it compares the whole standard output of `state --change feat` as a string | the expected entry gains `stages` with the fixture's list at its end; invariant (the exact contract of one entry), layer (the `state` command), suite (the change loop's) unchanged |
| E-2 | same file, `change-state ADR 0017: the documents follow` | reads the "A change's state" paragraph of `docs/openspec-flow.md` | nothing: the edit keeps the paragraph after "Waiting on GitHub" and citing ADR 0017 |
| E-3 | `plugins/openspec/hooks/change-loop-compozy.test.mjs`, `change-loop docs: the design records the answers` (line 325 on `origin/main` at `3af3655`) | line 360 asserts `assert.match(flow, /v0\.39\.0/, 'the CI snippet pins the current release (stale-only-on-own-files: 0.39.0)')` on `docs/openspec-flow.md`, and line 361 `assert.doesNotMatch(flow, /v0\.38\.0/, ...)` for the release before it; after the bump of D-13 the doc holds no `v0.39.0` (its only three occurrences, lines 733, 734 and 747, are the pins the bump moves), so line 360 fails | done in the same task as the bump (3.1), as every earlier release did with its own: the regex and the message of line 360 name the new devkit-openspec version (`run-status-bar: <new>`); one `assert.doesNotMatch` line for `v0.39.0` (`'no pin left on the release before it (stale-only-on-own-files)'`) goes right after it, and no other line of the test changes; the comment of line 359 gains this change's release in front of the list (`run-status-bar moves it to <new> (release <marketplace>), above stale-only-on-own-files' 0.39.0 (release 0.43.0), which moved it above ...`). Invariant (the CI snippet pins the current release, and no earlier one), layer (the documents), suite (the change loop's) unchanged |

Searched with `git grep` on `origin/main` at `3af3655` for a test that pins a release version of a
document (`v0\.`, `0.39.0`, `0.43.0`, `PIN_MARKER`, `commit sha of v` in every `*.test.mjs`, the
fixtures and `scripts/`): E-3 is the only test holding the current version as a literal. The others
that read the doc's pins follow the manifest's version and are not edited: the two tests of
`plugins/openspec/hooks/deliver-check-cli.test.mjs` named in D-13, and `release-merge pin: the real
docs/openspec-flow.md: setPins changes exactly its CI pin lines` of
`plugins/openspec/hooks/release-merge.test.mjs` (it reads `plugin.json`'s version and checks that
`setPins` with it leaves the doc as it is). The same E-3 test's own tail (`pinMismatches(flow,
version)`) reads the manifest too. The `v0.20.0` assertions (`change-loop-compozy.test.mjs:387-389`,
`project-loop.test.mjs:1899`, `openspec-setup/scripts/ship-entry.test.mjs:96`) pin the slice-merge
floor, which the bump does not touch; `change-loop-compozy.test.mjs:308` and the `release-merge.test.mjs`
literals use synthetic versions.

No other test pins the exact `state` output or its usage line; `roadmap-loop-upfront.test.mjs` compares
named fields of an entry (unchanged) and the remote `machine-probe` `state` (another command).
The tests that use `OFFLINE_GH` through `roadmap-loop.mjs` keep passing unchanged (the stub's body is
the same).

### D-12 What is proven here, what is left to dogfood

The bar is a harness tool: Claude Code is the caller. Proven here means a real run of
`node plugins/openspec/hooks/status-line.mjs` in this worktree, with standard input shaped as D-2 says,
recorded in `evidence.md`; dogfood means the owner's own session with the `statusLine` entry on, after
the release is installed.

| AC | Proven in this change | Left to dogfood |
|---|---|---|
| AC-1 | B-9, B-21, B-26 and a real run in this worktree at its real stage (the implementation: `🛠️ run-status-bar · Implementation · ■■■■■■■■■■◆□□□□ · 11 of 15`); the approval moment by a real run on the `approvedChange` fixture | the line under the message box of the next change's session at its plan approval |
| AC-2 | B-39, B-41; a real run with a `budget` cap in a fixture project | none |
| AC-3 | B-7, B-33, B-43; a real run in a fixture repository whose run file records the input's session | the counts under the coordinator's message box in the next roadmap run of this repository, after `state-skips-unlocated` (the listing exits 3 here today) |
| AC-4 | B-11, B-44; a real run from the root checkout on `main` with a session id that no run file records | the empty line in an ordinary session |
| AC-5 | B-40, B-41; the real runs of AC-1 and AC-3 between two snapshots of `git status`, the run file and `git worktree list` | none |
| AC-6 | B-37; the real run of AC-1 with `--lang pt-BR` | the owner's own language setting |
| AC-7 | B-42 to B-44; the real AC-1 run equals the mock's implementation line | the owner's look at the line in the app |

### D-13 Documents and release

- `docs/openspec-flow.md`: the "A change's state" paragraph names `[--offline]` and the `stages` field;
  a new paragraph "**The status line.**" after it gives the three lines, the settings entry of D-1, what
  the bar reads and that it writes nothing.
- `plugins/openspec/README.md`: a row for `hooks/status-line.mjs` in "What's inside".
- `CHANGELOG.md`: one entry, headed by the new marketplace version and written in the same step as the
  bump (`scripts/check.py` refuses a marketplace version with no `## <version>` heading). devkit-openspec's
  `plugin.json` and `marketplace.json` take the next minor version after `origin/main`'s at the last merge
  before review, and the marketplace's own version the next after its own; the loop pushes the tag after
  the merge (ADR 0019).
- The same bump moves every release pin of `docs/openspec-flow.md` to the new devkit-openspec version:
  the `<commit sha of v...>` URL line, the `pinned to the commit of v...` comment, the
  `` (`v...` above) `` sentence and the `gh api repos/chacal88/devkit/git/ref/tags/v...` command, the
  set `PIN_MARKER` of `plugins/openspec/hooks/release-merge.mjs` names (`v0.39.0` on `origin/main` at
  `3af3655`, the plan's base, lines 733, 734 and 747). Two existing tests of
  `plugins/openspec/hooks/deliver-check-cli.test.mjs` read `plugin.json`'s version and refuse a doc that
  names another: `the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version,
  with the tag in a comment, never the tag in the URL (R-10, security)` and `AC-8 release-ready: every
  pack version matches its marketplace entry, the doc pin names the devkit-openspec version and
  CONTRIBUTING holds the tag rule`. Neither test changes, nor `release-merge pin: the real
  docs/openspec-flow.md: setPins changes exactly its CI pin lines` of `release-merge.test.mjs`, which
  reads the version the same way; the doc follows the version, as the previous release did with its own
  bump.
- The same bump edits E-3 (D-11), the one test that holds the current release as a literal, in the same
  step. When a sibling's merge renumbers the release before review, the version, the doc's pins and E-3
  move together to the new number, as `suite-speed` did when it renumbered above `compozy-driver`.
- At archive, the archive step rewords this change's line of `openspec/roadmap.md` when it ticks it:
  the line still names the budget share the owner dropped (requirements, question 3). This change does
  not edit the roadmap.

## Implementation plan

**Per surface.** devkit-openspec hooks: the helper (flow-check), the `state` additions (change-loop,
merge-setup, roadmap-loop), the optional wait of `readStdin` (change-loop, D-2), the command
(status-line). Docs: `docs/openspec-flow.md`, the README.
Release: `plugin.json`, `marketplace.json`, `CHANGELOG.md`. No frontend, no worker, no panel.

**File structure.**

| Action | Path |
|---|---|
| Create | `plugins/openspec/hooks/status-line.mjs` |
| Create | `plugins/openspec/hooks/status-line.test.mjs` |
| Create | `plugins/openspec/hooks/change-state-stages.test.mjs` |
| Modify | `plugins/openspec/hooks/flow-check.mjs`, `plugins/openspec/hooks/flow-check.test.mjs` |
| Modify | `plugins/openspec/hooks/change-loop.mjs` |
| Modify | `plugins/openspec/hooks/merge-setup.mjs`, `plugins/openspec/hooks/roadmap-loop.mjs` |
| Modify | `plugins/openspec/hooks/change-loop-remote-state.test.mjs` (E-1), `plugins/openspec/hooks/change-loop-compozy.test.mjs` (E-3) |
| Modify | `docs/openspec-flow.md` (the state paragraph, the status line paragraph, the release pins), `plugins/openspec/README.md`, `CHANGELOG.md` |
| Modify | `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` |
| Delete | none |

**Estimate.** Optimistic 12 h, likely 18 h, pessimistic 28 h (the whole suite runs 13 to 21 minutes, the
figure of this branch's `CLAUDE.md`, measured again after the last merge of the base as the project
asks; a merge of `main` between phases costs a rerun).

| Component | Hours | Type | Risk |
|---|---|---|---|
| Merge `origin/main`, baseline gates | 1 | Integration | LOW |
| `notApplicableOf`, `appliedStages` and H-1 to H-8 | 2 | Core | LOW |
| `stages` field, `--offline`, `OFFLINE_GH` move, S-1 to S-11, E-1 | 3 | Core | MEDIUM |
| `status-line.mjs`: input, choice, calls, bounds | 4 | Core | MEDIUM |
| Line drawing, cut rule, counts, words | 2 | Core | LOW |
| B-1 to B-46 | 4 | Testing | MEDIUM |
| Docs and README | 1 | Documentation | LOW |
| Release and full gates | 1 | Integration | LOW |

**Risks.**

| Risk | P × I | Mitigation |
|---|---|---|
| `state --change` takes several seconds on a busy machine, so the line lags | MEDIUM × LOW | one call per refresh; Claude Code aborts a stale run; the 20 s bound and the child kill (D-9) keep processes from piling up |
| The listing fails in this repository today (`state-skips-unlocated`) | HIGH × LOW | the bar prints nothing on failure (B-36); AC-3 proven on a fixture, the real line left to dogfood |
| `CLAUDE_SESSION_ID` in the skill and `session_id` on the bar's input differ in some host | LOW × MEDIUM | both are Claude Code's session id; the dogfood row of AC-3 checks it; on a mismatch the line is empty, never wrong |
| `■ ◆ □` are East Asian ambiguous width: a CJK terminal draws them two columns wide | LOW × LOW | the approved glyphs stay; the count follows the mock-up; noted in the docs paragraph |
| The newest installed copy differs from the project's pinned plugin | LOW × LOW | old flows stay readable (spec `change-stages`); the bar only reads |
| A sibling merges into `main` and renumbers the release | MEDIUM × LOW | version taken from `origin/main` at the last merge before review (CONTRIBUTING step 5) |

**Assumptions.** Claude Code passes `session_id`, `cwd` and `workspace.current_dir` and runs the command
in a shell (its own status line instructions in the 2.1.69 binary); `--session ${CLAUDE_SESSION_ID}` is
what the run file holds (`plugins/openspec/skills/devkit/SKILL.md`); `git` and `node` are on the status
line's `PATH` (the plugin's hooks already need both).

**Dependencies.** `change-state` (archived) for the command; `suite-speed` (merged, ADR 0026) for the test
command and fixture layout; `state-skips-unlocated` (open) only for the dogfood of AC-3 in this repository.

## Risks / Trade-offs

- [The counts line reads GitHub as silent] → a change waiting for a merge by hand reads `waiting-on-github`
  and counts in play only, not as waiting on the owner; `/devkit status` stays the full reading. Accepted
  to keep the coordinator's refresh free of GitHub calls (D-4).
- [A session that once coordinated a run keeps the counts line after the run ends] → the run file stays;
  the line then counts what is still in play, zeros included, which is true.
- [Positional marks hide a stale earlier stage] → the current stage is where the loop goes back to, so
  the strip still shows where the change is.

## Migration Plan

Opt-in: nothing happens until the owner adds the `statusLine` entry. Rollback: remove the entry; the
`stages` field and `--offline` are additive and read by no one else.
