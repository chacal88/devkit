<!-- devkit-stage design result=passed attempt=1 commit=466f908cf1f23235f45246423900b23e45ab524a -->
# Design

Change: `state-listing-speed` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `proposal.md`, the spec delta `specs/change-state/spec.md`,
`decisions.md`, `release.md`). Base: `origin/main` at `6f03a57c`.

## Context

See `proposal.md` (Why). The path the listing takes today, in `plugins/openspec/hooks/`:

- `change-loop.mjs` line 3644 (`if (isMain())`) calls `runCommand(argv, { stdin })` (line 3605), which
  hands every verb but `wait` to the synchronous `main` (line 3580); `main` calls `runState`
  (line 3391), which parses `--change`, `--lang` and `--offline` with `parseArgs` (line 3244) and
  calls `stateEntries(cwd, { id, lang, env, openspec, gh })` with `gh` set to `OFFLINE_GH`
  (`merge-setup.mjs` line 52) under `--offline`. Any throw becomes `failure(argv, e)` (line 3571):
  exit 3, `{ version: 1, error, reply }` on stdout, `change-loop: <message>` on stderr, the reply's
  language read from `argv`'s `--lang`.
- `stateEntries` (line 2093) reads the run file and the roadmap, builds the sorted ids
  (`unfinished(start, { env, gh })` plus the ids the run file names, line 2101), then maps each id,
  one after another, through `unplacedAction`, `knownChange`, `nextAction(..., { stages: true })`,
  the archive checks and `runFactsOf`, into
  `{ change, ...changeState(action, facts), script, root, branch, stages }` (line 2120). With
  `id` given, `ids` is `[id]` and the map body is the same.
- `nextAction` (line 1588) is synchronous throughout: `collectFlow` runs the `openspec` CLI through
  `spawnSync` (`flow-check.mjs` line 47) and the git reads use `execFileSync`. Measured by the
  conducting session on the avel machine: two `openspec` calls per change
  (`status --change <id> --json`, `instructions apply --change <id> --json`, about 0.75 s each) and
  about 100 short git calls; `state --offline` over 7 changes about 14 s. A delivery read that
  throws is caught there (line 1631) and becomes the `blocked` end `unreadable` (line 1410).
- The status line starts `state` in a process group of its own and kills the whole group with
  SIGTERM at its 20 s bound or at an abort, then waits for the process to close
  (`status-line.mjs` lines 157 to 172).
- Tests call `main(['state', ...], { cwd, env, gh, openspec })` in process with stand-in runners
  (`change-state-stages.test.mjs` line 16, `change-loop-remote-state.test.mjs` lines 1257 and 1622,
  `roadmap-loop-upfront.test.mjs` line 1001) and read its result synchronously; a stand-in function
  cannot cross into another process.

ADR 0017 decision 1: the state is derived on every read by the code that decides the loop's next
action, and stored nowhere. ADR 0026 bounds the suite's parallel files by `availableParallelism()`
(`scripts/test-suite.mjs` line 280).

## Goals / Non-Goals

**Goals:**

- The listing of a command-line `state` reads its changes at once, at most the machine's cores, and
  prints byte for byte what the sequential read prints, failures included; the one new outcome is a
  read process that gives no entry, which fails the command with exit 3 (D-5 rule 2).
- Every entry is still derived by the loop's own `nextAction`, unchanged (ADR 0017 decision 1).

**Non-Goals:**

- Making one change's read faster, or `nextAction` asynchronous.
- A setting, flag or environment variable for the bound.
- Any change to `state --change <id>`, `next`, `wait`, the board, `status-line.mjs`,
  `machine-probe.mjs` or `roadmap-loop.mjs`.
- Parallel reads for in-process callers of `main` or `stateEntries`.

## Decisions

### D-1 The parallel listing runs only from `runCommand` (AC-1, AC-6)

`runCommand(argv, opts)` gains one branch before `main`: when `argv[0] === 'state'`, `opts.openspec`
and `opts.gh` are both `undefined`, and `parseArgs(argv.slice(1), STATE_ARGS)` succeeds with no
positional word and no `change`, it returns `await stateListing(argv, { env: opts.env ?? process.env,
cwd: opts.cwd ?? process.cwd() })`. Every other call goes to `main` as today. `STATE_ARGS` is the
constant `{ values: ['--change', '--lang'], flags: ['--offline'] }`, which `runState` then uses too, so
both parse one way. A parse that throws goes to `main`, which gives the same usage failure as today.

`main` stays synchronous and keeps the sequential `stateEntries`, so every in-process caller (the
tests with stand-in runners, `roadmap-loop-upfront.test.mjs`'s board helper) reads exactly as today.
The command line (`isMain`) never injects a runner, so the status line and every session that runs
`change-loop.mjs state` take the parallel path.

Rejected: making `main` asynchronous for `state`. Every synchronous caller and test reads
`main(...).stdout` at once, so they would all need editing (against AC-6).

### D-2 One change, one child process of the same script (AC-1, AC-2)

Each id of the listing is read by `node <this script> state <the parent's own arguments> --change <id>`:
`process.execPath`, the script's own path (`fileURLToPath(import.meta.url)`, held as
`LOOP_SCRIPT`), then `argv.slice(1)` as the parent got it (so `--offline` and `--lang <l>` pass as
given, and a missing `--lang` stays missing), then `--change` and the id. The child runs in the
parent's `cwd`, with the parent's `env` plus `GIT_OPTIONAL_LOCKS=0` (`{ ...env, GIT_OPTIONAL_LOCKS: '0' }`),
`stdio: ['ignore', 'pipe', 'pipe']`, and not detached.

- The children only read, and take no lock on what they share. Checked by the conducting session on
  the base: `nextAction` called without `fetchBase`, as `stateEntries` calls it, never reaches
  `refreshBase` (line 1624, the only fetch of the path; `fresh-base-check 7`,
  `change-loop.test.mjs` line 2631, pins that `state` never fetches), and the files the hook
  writes (`saveWriteBack` from `mergeCheck` and `writeBackAsk`, lines 1805 and 1831, the run file,
  the approvals) are written by other verbs, not on that path. The one git call of the path that
  can take a lock is `git status --porcelain`, which every read runs on its change's checkout
  (`fingerprint`, `flow-check.mjs` line 171; `dirtyPaths`, `deliver-check.mjs` line 300, in the
  delivery read): it refreshes that checkout's index under `index.lock` when it can, and skips the
  refresh when the lock is held, so it never fails on it; several changes share the main checkout,
  so two children could run it at once there. `GIT_OPTIONAL_LOCKS=0` (git's environment form of
  `--no-optional-locks`) turns that refresh off in the children: they never take `index.lock`, so
  they neither contend with each other nor make a `git commit` of a session in that checkout fail
  on a held lock. It changes no git output, so no entry changes (AC-2); the in-process sequential
  read is not given it (D-1). The search behind this: `grep -n "'status'\|'fetch'\|writeFileSync\|renameSync"`
  over `change-loop.mjs`, `flow-check.mjs` and `deliver-check.mjs`, each hit traced to its caller.

- Same output by construction: the child runs the code `state --change <id>` runs today, whose
  map body is the listing's (Context); the spec already says each listing entry is "as for one
  change". The parent parses the child's `{ version: 1, changes: [entry] }` and puts `entry` back
  through the same `json` helper (line 3259); a parse and a stringify of the same object give the
  same text.
- Same script: the child is the file the parent loaded, so a worktree's own `change-loop.mjs`
  reads with its own code (`CLAUDE.md`, the rule on `unknown key` in `flow.json`).
- The status line's bound still holds: a child that is not detached is in the parent's process
  group, which the status line kills as a whole (Context). No child inherits the parent's stdout,
  so the status line's pipe closes when the parent ends.

### D-3 The listing's ids come from one helper (AC-2)

The id computation of `stateEntries` (line 2101, the `id === null` branch) moves, unchanged, into
`export function listingIds(start, run, { env, gh })`: the ids of `unfinished(start, { env, gh })`
and of `namedByRun(run)`, each once, sorted with `localeCompare`. `stateEntries` calls it when
`id === null`; `stateListing` calls it with `gh` = `OFFLINE_GH` under `--offline` and `undefined`
otherwise, the values `runState` passes today. `stateListing` reads `findRoot(cwd)` first and throws
the same `LoopUsageError` (`no openspec/ folder found from <cwd>`) when there is none, and reads the
run file with `readRun(runFilePath(start))`, as `stateEntries` does.

### D-4 The bound and the pool (AC-1, AC-3)

- `export const listingBound = () => Math.max(1, availableParallelism())`, read at each listing
  (`availableParallelism` imported from `node:os`, the call ADR 0026 uses for the suite).
- `export async function boundedMap(items, limit, run, { stopWhen = () => false } = {})`: starts
  `run(item, index)` for the items in order while fewer than `Math.max(1, limit)` are running;
  once a result makes `stopWhen(result)` true, it starts no further item; it resolves when every
  started item has settled, to an array in item order whose unstarted slots are `null`. It is the
  shape of `runPool` in `scripts/test-suite.mjs` (line 428), written again in the hook because the
  packs ship without `scripts/`.

### D-5 The join and the failures (AC-2, AC-4)

`stateListing` runs `boundedMap(ids, listingBound(), childRead, { stopWhen: (r) => !r.ok })`, where
`childRead(id)` resolves, once the child has closed, to `{ id, code, signal, stdout, stderr,
error }`, and `ok` is `code === 0` with a stdout that parses to `{ version: 1, changes: [e] }`
holding exactly one entry whose `change` is `id`. Then, in id order:

1. The first result that is not `ok` decides the command. A child that exited 3 is a failure the
   sequential read would have given at that same id (every id before it read cleanly, and the
   sequential read stops at the first throw), with the same `argv` language: `stateListing` returns
   that child's `{ code: 3, stdout, stderr }` as they are. This keeps byte for byte every
   per-change failure a listing can reach (an unknown `merge_method` in that change's checkout,
   which `state --change <id>` refuses with exit 3). `no change named <id>` is not one of them: the
   listing's ids come from `unfinished()` (each has a folder in some checkout, so `knownChange` is
   true, `change-loop.mjs` lines 2101 and 2113) and from `namedByRun` (an id named only by the run
   file gives the `none` entry, line 2115); that failure is reached by `state --change <id>`, which
   D-1 sends to `main` unchanged.
2. Any other result that is not `ok` (another exit code, a signal, a start error, or a stdout that
   is not one entry for `id`) throws a `LoopUsageError` with the message
   `state of <id> could not be read: <why>`, `<why>` being `exit <code>`, `signal <name>`, the start error's message or `no single entry`;
   `runCommand` turns it into `failure(argv, e)`, exit 3. This is the one outcome the sequential
   read has no counterpart for (an in-process read has no child to die), so it is new behaviour,
   stated by the spec delta's scenario "A read process that gives no entry"; no existing output
   changes. When an earlier id's result is a rule-1 failure, rule 1 decides, since the first result
   that is not `ok` in id order decides.
3. When every result is `ok`, the command prints `json({ version: 1, changes: entries })` with
   exit 0 and an empty stderr; a child's stderr on success is dropped, as the sequential read prints
   none.

A change that cannot be read (`blocked`, `unreadable`) is an `ok` result: its child exits 0 with
that entry, as `state --change <id>` does today.

### D-6 Small listings stay in process (AC-6)

When `listingIds` gives one id or none, `stateListing` returns `main(argv, { env, cwd })`: no child
is started (`readOne` is never called), and the output is the sequential read's. The ids are then
read twice (once here, once in `stateEntries`), a cost of one `unfinished` read. The spec delta's
scenario "A small listing" states it; the test `AC-6 a listing of one change or none starts no read
process` (D-7) proves it.

### D-7 Tests

A new file, `plugins/openspec/hooks/change-state-listing.test.mjs`, header comment
`// node scripts/test-suite.mjs plugins/openspec/hooks/change-state-listing.test.mjs`, imports only
`test-fixtures.mjs`, `change-loop-fixtures.mjs` and `change-loop.mjs` (ADR 0026 decision 3). Every
test name starts `state-listing-speed AC-<n> `. It takes its env from `cleanEnvLoop` and `SET_LOOP`
(`test-fixtures.mjs` lines 680 and 681), runs the real script as `LOOP`
(`change-loop-fixtures.mjs` line 17) with `spawnSync(process.execPath, [LOOP, 'state', ...])`, and
reads no git history of this repository.

The stand-in `openspec`: a Node script named `openspec` in a fresh folder put first on `PATH`,
holding the absolute path of the real CLI (`command -v openspec` on the test's own `PATH`, read once
at load). Each call appends `start <change> <Date.now()>` to a log file named by an environment
variable, followed by the value of `GIT_OPTIONAL_LOCKS` it was started with (`-` when unset),
waits 400 ms (`Atomics.wait` on a `SharedArrayBuffer`), runs the real CLI with the same
arguments and `stdio: 'inherit'`, appends `end <change> <Date.now()>`, and exits with the real
CLI's status; `<change>` is the value after `--change`, or `-`. The overlap of a log is the largest
number of distinct changes with a `start` and no `end` at one instant.

The fixture `listing()`: `roundRepo({ roadmap: '# Roadmap\n\n## Round 1: x\n- [ ] d\n', config: 'schema: devkit\n', changes })`
with three changes `a`, `b`, `c` at the grill (`.openspec.yaml` `schema: devkit\n` only), plus a run
file naming a start `d` with no folder (written with `runFilePath` exactly as
`change-state-stages.test.mjs` lines 84 to 87 write it), and a worktree `side` (`t.addWt('side')`) holding change `x` through `addChange`
(`change-loop-fixtures.mjs` line 177), which the listing gives as `blocked`, `wrong-branch`.

| Test | AC | What it proves |
| --- | --- | --- |
| `AC-1 the reads of the listing overlap` | AC-1, AC-3 | Over `listing()` with the stand-in, `state --offline --lang en` exits 0; the log's overlap is at least `Math.min(2, listingBound())` and at most `listingBound()`; every `start` line of a change carries `GIT_OPTIONAL_LOCKS` `0` (D-2) |
| `AC-2 the listing is byte-identical to the sequential read` | AC-2 | On the same `listing()`, unchanged, the process's stdout equals `main(['state', '--offline', '--lang', 'en'], { cwd, env })`'s stdout (the in-process sequential read, D-1), and its stderr is empty, as `main`'s is (D-5 rule 3 drops a child's stderr on success), with and without `--offline` (without it, both reads take the env `{ ...t.ghAt(t.main).env, ...SET_LOOP }`, the fake `gh` of `roundRepo` with the loop's variables blanked) |
| `AC-2 each entry is the one state --change prints` | AC-2 | Each entry of the process's listing deep-equals the one entry of a process `state --change <id> --offline --lang en`; the ids are `a, b, c, d, x`, in that order |
| `AC-3 the pool never runs more than its limit` | AC-3 | `boundedMap` over 6 stand-in tasks that each wait 50 ms and count how many run at once: with limit 2 the largest count is 2 and the results are in item order; with limit 0 and limit 1 it is 1; `listingBound()` equals `Math.max(1, os.availableParallelism())` |
| `AC-3 the pool stops starting after a stop` | AC-3, AC-4 | `boundedMap` with limit 1 and `stopWhen` true on item 2's result leaves items 3 to 6 `null` and never starts them |
| `AC-4 an unreadable change is listed blocked` | AC-4 | `stateListing` over `gitRepo({ config: 'schema: devkit\n', changes })` with the grill changes `a`, `b`, `c` only, and a stand-in reader (`readOne`, D-8) that answers the three ids, the second with exit 0 and a `blocked` `unreadable` entry: the command exits 0 and lists the three entries in id order, the second as given |
| `AC-4 a read that fails the command fails the listing` | AC-4 | Over the same three-change repository, with a stand-in reader whose answer for `b` is exit 3 and the stdout and stderr `failure` gives for `b`'s unknown `merge_method` (the error `state --change b` prints in the real test below), and `c` the same for `c`: the command's result equals `b`'s answer byte for byte (the first such id in id order) |
| `AC-4 a child that fails in a checkout of its own fails the listing as one after another` | AC-4 | A real listing where `b`'s worktree (`t.addWt('b')`, the change's folder there) has `merge_method: bogus` in its `openspec/config.yaml` and the main checkout does not (the test first asserts that `state --change b` alone exits 3 with `merge_method` in its `error`): the process's code, stdout and stderr equal those of `main(['state', '--offline', '--lang', 'en'], ...)`, code 3, `error` naming `merge_method` |
| `AC-4 a child that dies is a usage failure` | AC-4 | Over the same three-change repository, a stand-in reader answering `signal: 'SIGKILL'` for `b`: exit 3, `error` `state of b could not be read: signal SIGKILL`, and no entry on stdout (the spec scenario "A read process that gives no entry") |
| `AC-6 a listing of one change or none starts no read process` | AC-6, AC-2 | `stateListing(['state', '--offline', '--lang', 'en'], { env, cwd, readOne })`, with a `readOne` that records each id it is called with, over `gitRepo({ config: 'schema: devkit\n', changes })` with the one grill change `a`, then over one with no change: `readOne` is never called, and the result's code, stdout and stderr equal those of `main(['state', '--offline', '--lang', 'en'], { env, cwd })` (D-6, the spec scenario "A small listing") |
| `AC-6 in-process state stays synchronous` | AC-6 | `main(['state', '--lang', 'en'], { cwd, env, gh: () => ({ status: 1, stdout: '', stderr: 'offline' }) })` returns an object, not a promise, with code 0 |

`stateListing(argv, { env, cwd, readOne = childRead })`: the reader is a parameter so the AC-4 join
tests need no process; the command line never passes one.

Existing tests that read what this change touches (they pass unedited, AC-6):

| Test | File | Invariant · layer · suite | Why it still passes |
| --- | --- | --- | --- |
| `run-status-bar AC-5 offline: --offline makes no gh call, listing and --change` | `change-state-stages.test.mjs` lines 112 to 131 | no `gh` process under `--offline` · command, real process · fast | the listing now runs children; each gets `--offline` from the parent's arguments (D-2), so no `gh` starts |
| every `stateCmd` and `entryOf(main(['state', ...]))` | `change-state-stages.test.mjs`, `change-loop-remote-state.test.mjs` (lines 1257 to 1650, the `unlocated` tests) | the entry of one change and of the listing · command, in process · fast and slow | `main` is unchanged and sequential (D-1) |
| `change-state AC-1 command: an unknown change exits 3 with the plain reply`, `unlocated 1: state --change nope in the unplaced setup still exits 3` | `change-loop-remote-state.test.mjs` lines 1315 and 1638 | `state --change <id>` with an id no file can place exits 3 with `no change named <id>` (AC-4's `--change` case) · command · slow | `state --change` takes `main` (D-1), unchanged |
| `stateEntriesOf` | `roadmap-loop-upfront.test.mjs` line 1001 | the board and the state agree · in process · slow | the same |
| `fresh-base-check 7` | `change-loop.test.mjs` lines 2630 to 2640 | `state` never fetches · in process · slow | `stateEntries`'s signature and body are unchanged but for the helper call (D-3) |
| the paragraph checks (`change-state`, `unlocated 3`) | `change-loop-remote-state.test.mjs` lines 1699 to 1745 | the paragraph follows "Waiting on GitHub", cites ADR 0017, names `wrong-branch`, `chore/archive-<id>` and `the checkout it is called from` · document · slow | the sentence of D-8 is added inside the paragraph, with no blank line, and removes none of these phrases |
| the state call of the status line | `status-line.test.mjs` line 383, and its stubbed `state` calls | `state --change` in a real process; the line from the entry · command · fast | `state --change` takes `main` (D-1) |
| `stage-models AC-9 ... the loop names no session-model tool` | `stage-models.test.mjs` line 464 | `change-loop.mjs` names no `set_session_model`, `session-model` or `start_session` · source scan · slow | the new code uses none of these words |

The grep that built this table: `grep -n "'state'" plugins/openspec/hooks/*.test.mjs`,
`grep -rn "stateEntries(" plugins scripts`, `grep -rn "readFileSync(.*change-loop.mjs" plugins`
and `grep -n "A change's state" plugins/openspec/hooks/*.test.mjs`. No test pins `runCommand`'s
routing of `state`, and no output field or message key changes.

`scripts/test-map.json`: the new file goes, in sorted place, into the list of
`files["plugins/openspec/hooks/change-loop.mjs"]` (between `change-loop.test.mjs` and
`change-state-stages.test.mjs`), in the commit that adds it (`CLAUDE.md`; rule M6 of the map). It is
not added to `slow`.

### D-8 Signatures, documents and release (AC-6)

New in `change-loop.mjs`, all exported for the tests: `listingIds(start, run, { env, gh })`,
`listingBound()`, `boundedMap(items, limit, run, { stopWhen })`, `childRead(id, { argv, env, cwd })`
and `stateListing(argv, { env, cwd, readOne })`; the constants `STATE_ARGS` and `LOOP_SCRIPT`. The
imports gain `availableParallelism` (`node:os`) and `spawn` (`node:child_process`). `USAGE` is
unchanged.

`docs/openspec-flow.md`, the "A change's state." paragraph (line 242), after the sentence ending
"one per unfinished change without it.", gains: "Without `--change` the command reads the changes
at once, each in a process of its own, at most as many as the machine's cores, and prints what
reading them one after another prints." No other document names the listing's order of reads.

`release.md`: `devkit-openspec: patch` (ADR 0034).

### D-9 The real-run proof (AC-5, AC-2)

A conductor task on the avel machine, with no test suite running and with `TMPDIR` under
`/var/tmp`:

1. Check first that the session can delete a folder it makes under `/var/tmp`, then make a scratch
   clone of this repository there, on the branch's head, and bring it to 11 changes in play: the
   folders open on the branch plus `openspec new change listing-probe-<nn>` for the rest
   (`<nn>` from `01`), committed in the clone only.
2. Make two copies of the pack beside the clone, both outside it: `base-pack`, from
   `git archive origin/main plugins/openspec`, and `branch-pack`, from
   `git archive HEAD plugins/openspec`.
3. In the clone, run `uptime`, then
   `time node <base-pack>/plugins/openspec/hooks/change-loop.mjs state --offline --lang en > base.json`,
   then the same with `<branch-pack>` into `branch.json`, then `uptime` again and
   `cmp base.json branch.json`.
4. Save the commands, the count of entries, both times, both loads and the `cmp` result as
   `proof/listing-11.txt`, and remove the clone and the two copies.

The branch's run under 10 s passes AC-5, and an empty `cmp` is a real-run proof of AC-2. A run at
or above 10 s stops the task and goes back to the owner with the split measured: the parent's own ids
read (`listingIds`, timed alone with `node --input-type=module -e`) and the slowest child
(`state --change <id> --offline` timed for each id).

## Alternatives considered

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| Child process per change, from `runCommand` (D-1, D-2) | Each entry is `state --change <id>`'s output by construction; `nextAction` untouched; the status line's group kill covers the children | One Node start and module load per change (about 0.1 s); in-process callers stay sequential | Chosen |
| An asynchronous rewrite of `nextAction`, `collectFlow` and the git reads | One process | `nextAction` is synchronous through the whole loop; every caller (`next`, `wait`, the board, the locks) would change; a large diff for a listing | Rejected: scope and risk |
| Worker threads, joined synchronously (`Atomics.wait` and `receiveMessageOnPort`) | `main` could stay synchronous for every caller | The module loads in every worker anyway; stand-in runners cannot cross into a worker either; a blocking join on the main thread is a pattern no other hook uses | Rejected: no gain over D-2 and more machinery |
| Start the two `openspec` calls of every change at once, then derive in series from their answers | Keeps one process | The ~100 git calls per change stay in series (about 0.5 s each change on avel, more on the owner's Mac); it holds the CLI's answers for the length of the command, near the "caching" the requirements put out of scope; needs an asynchronous prefetch anyway | Rejected |
| Skip the reads the offline listing does not need | Faster still | Drops or changes fields: out of scope (requirements, question 3) | Rejected |
| A shell pool (`xargs -P`) | No Node code | Differs between GNU and BSD; quoting of ids; the failure mapping of D-5 has no home | Rejected |

No ADR rejected any of these: ADR 0017's rejected options are an event log and per-surface
readings, both of which store or split the state; the children derive it with the loop's own code
and store nothing. ADR 0026's rejected options concern the test runner.

## Implementation plan

Dependency order: the id helper and the pool (pure), then the child read and the join, then the
routing in `runCommand`, then the document.

- **Backend (`devkit-openspec`)**: `plugins/openspec/hooks/change-loop.mjs` only (D-1 to D-6, D-8).
- **Frontend, workers, integrations**: none. `status-line.mjs`, `machine-probe.mjs` and
  `roadmap-loop.mjs` are not edited.

File structure:

- Create: `plugins/openspec/hooks/change-state-listing.test.mjs`.
- Modify: `plugins/openspec/hooks/change-loop.mjs`, `scripts/test-map.json`,
  `docs/openspec-flow.md`.
- Delete: none.

Estimate: optimistic 5 h, likely 7 h, pessimistic 11 h (the pessimistic case is a stand-in `openspec`
whose timing is unsteady on CI, or the AC-5 run above 10 s).

| Component | Hours | Type | Risk |
| --- | --- | --- | --- |
| `listingIds` split, `listingBound`, `boundedMap` | 1 | Core | LOW |
| `childRead`, `stateListing` and the join of D-5 | 1.5 | Core | MEDIUM |
| `runCommand` routing and `STATE_ARGS` | 0.5 | Core | LOW |
| `change-state-listing.test.mjs` (the stand-in, the fixture, eleven tests) and its red run | 2.5 | Testing | MEDIUM |
| `scripts/test-map.json` entry | 0.25 | Integration | LOW |
| `docs/openspec-flow.md` sentence | 0.25 | Documentation | LOW |
| The real run of D-9 | 1 | Testing | MEDIUM |

## Risks / Trade-offs

| Id | Risk | Probability × impact | Mitigation |
| --- | --- | --- | --- |
| R-1 | Children compete for cores with `openspec` and git, so a loaded machine gains less and AC-5 misses 10 s | MEDIUM × MEDIUM | The bound is the core count (ADR 0026's same trade-off); D-9 measures with the load recorded and stops on a miss with the split measured |
| R-2 | The parent's own ids read (`unfinished`, one `archivedDates`) is a sequential part the children do not shorten | LOW × MEDIUM | D-9 times it alone when the run misses; it holds no `openspec` call |
| R-3 | A caller that kills only the parent's pid, not its group, leaves the children to finish | LOW × LOW | They read only and end on their own (each `openspec` call is cut at 60 s, `flow-check.mjs` line 36); the status line kills the group (Context) |
| R-4 | Without `--offline`, GitHub answers two children differently from one read to the next, which the sequential read shares in one command (`archivedDates`) | LOW × LOW | The listing is a read of a moving remote either way; `--offline`, the status line's call, makes no GitHub call |
| R-5 | The overlap test is flaky on a slow CI runner | MEDIUM × LOW | The stand-in holds each call 400 ms, so two children overlap unless the runner starts them more than 400 ms apart; the lower bound is `Math.min(2, listingBound())` |
| R-6 | A child's stderr warning (a Node deprecation) on success would be lost | LOW × LOW | The sequential read prints no stderr; D-5 keeps that |
| R-7 | Memory: up to one Node process per core, each starting `openspec` (Node too) | LOW × LOW | About 100 MB per pair; 8 cores about 0.8 GB for a few seconds |
| R-8 | Children reading changes that share one checkout run `git status` there at once and contend on its `index.lock`, or make a session's `git commit` in it fail on a held lock | MEDIUM × LOW | The children run with `GIT_OPTIONAL_LOCKS=0`, so no child takes the lock (D-2); the AC-1 test pins that every child's call carries it; the read path holds no fetch and no other write (D-2) |
| R-9 | A child dies (out of memory, a signal) under many parallel Node and `openspec` processes | LOW × MEDIUM | The listing exits 3 naming the id (D-5 rule 2, the spec scenario "A read process that gives no entry"), never a partial listing; the caller reads again |

## Assumptions

- `os.availableParallelism()` exists in the Node of CI's `check` job (Node 22; it exists since
  Node 18.14) and is at least 1.
- A child spawned without `detached` stays in its parent's process group on Linux and macOS, so the
  status line's `process.kill(-pid, 'SIGTERM')` reaches it (`status-line.mjs` line 168).
- `state --change <id>` and the listing derive one id's entry with the same code (`stateEntries`
  line 2108 to 2120); the spec states it ("each as for one change"), and
  `change-loop-remote-state.test.mjs`'s `unlocated 1: state --change x prints the list's entry`
  pins it for one case.
- The test fixtures declare no `openspec` pin, so `makeOpenspec` starts the `openspec` first on
  `PATH`, which is the stand-in (`flow-check.mjs` lines 41 to 47).

## Dependencies

- ADR 0017 decision 1, ADR 0026 (the bound), ADR 0034 (the release note), ADR 0036 (the gate's
  `--own-files` part). `decisions.md`: no record needed.
- Spec `change-state` (this change's ADDED requirement). The status line's bound and group kill,
  and `--offline`, are on the base (change `run-status-bar`).
- No entry of an open-decisions log (the repository keeps none).

## Migration Plan

Nothing to migrate: no stored state, no setting. Rollback: remove the `runCommand` branch of D-1;
the listing is then sequential again, through code that never stopped serving `main`.

## Open Questions

None.
