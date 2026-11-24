<!-- devkit-stage design result=passed attempt=1 commit=720d91d3aeedc351af462f17a68b2fa680f444af -->
# Design

Change: `suite-speed` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (sources:
`requirements.md`, `decisions.md`, ADR 0026, `proposal.md`). Base: `720d91d`. No spec delta
(`skip_specs: true`, see `proposal.md`, Capabilities).

## Context

See `proposal.md` (Why). Facts read at `720d91d`:

- `plugins/openspec/hooks/guard.test.mjs` lines 12 to 31 import 20 test files: line 12 imports five
  helpers from `./deliver-check.test.mjs` by name, lines 13 to 31 import 19 files for their side
  effect (each line's comment names the change that added it). With its own tests, the old command
  runs 21 files, exactly the `*.test.mjs` of three folders: `plugins/openspec/hooks/` (14, the
  guard's own included), `plugins/openspec/skills/openspec-setup/scripts/` (6) and
  `plugins/core/skills/review-change/scripts/` (1, `review-round.test.mjs`).
- Eleven other test files import names from test files: 19 import lines in 11 files ("Pinned
  rules" below, table C, every row but `guard.test.mjs`). A test file's import registers its tests in the importer's process, so run apart,
  `deliver-check.test.mjs` would run once per importer; in the guard's one process the module cache
  hides it today.
- 32 names are exported by test files. 24 of them are imported by another test file:
  `deliver-check.test.mjs` `git`, `gitRepo`, `put`, `commitAll`, `openspecStub`, `fakeGh`,
  `PR_FILES_KEY`, `TASKS_ON_KEY`, `filesFixture`, `tasksFixture`, `tasksText`, `mergedPr`,
  `archivePrJson`, `ARCHIVE_LISTING`, `ARCHIVE_PRS`, `retroMd`, `writeRetro`, `pm`;
  `conduct-check.test.mjs` `roundRepo`; `release-merge.test.mjs` `pinDoc`; `change-loop.test.mjs`
  `readCounter`; `delivery-models.test.mjs` `TWO_PRS`, `scenario`, `archiving`. Eight are imported
  by no other file: `deliver-check.test.mjs` `archiveFolder`, `flow-check.test.mjs` `sampleChange`,
  `roadmap-loop.test.mjs` `previousForms`, `version-pin.test.mjs` `flowV2`, `upgradeTo2`, `packV2`,
  `planFiles`, `pinOf`. `packV2` returns `PACK_V2`, a copy of the whole pack made at module level
  (`version-pin.test.mjs:83`).
- `plugins/openspec/hooks/test-tmp.mjs` (three byte-identical copies) makes folders with
  `mkdtempSync(join(tmpdir(), prefix))` and reads `tmpdir()` at call time; `test-tmp.test.mjs`
  `test-fixture-cleanup AC-4 ...` compares the copies. Every suite file but `jira-task.test.mjs`
  imports it.
- Two tests list the whole temporary root for the product's `devkit-pin-*` folders:
  `conduct-check.test.mjs:1445` `pinTmpFolders` and `release-merge.test.mjs:328` `pinTmp`. Run at the
  same time in one `TMPDIR`, each would see the other's folders.
- `.github/workflows/ci.yml` lines 20 to 33: step `Hook tests` (`TMPDIR: ${{ runner.temp
  }}/hook-tests-tmp`, `mkdir "$TMPDIR"`, two `git config` lines, the old command) and step
  `Hook tests left nothing in TMPDIR`. CI uses `actions/setup-node@v4` with `node-version: 22` on
  `ubuntu-latest` (4 vCPU for a public repository). The worker this plan was written on (the Avell)
  reports `nproc` 8: 4 cores, 2 threads each.
- `plugins/panel/hooks/detail.ts:43` labels `node --test <file>` as `<file> suite`, and line 44
  labels `node <script> <args>` as `<script without .mjs> <args>`.
- `scripts/check.py` takes `--root <dir>` and already scans `plugins/**/*.test.mjs` for un-awaited
  subtests (`check_awaited_subtests`, lines 125 to 135); `guard.test.mjs:674` and
  `version-pin.test.mjs:885` spawn it on a synthetic root.

## Goals / Non-Goals

**Goals:**

- One command, `node scripts/test-suite.mjs`, that runs the 21 files (and the file this change
  adds) by file, in parallel, each in its own empty real-path `TMPDIR`, and fails on a failing test,
  a leftover or a test-to-test import.
- The same tests as before, none dropped, none run twice, none skipped.
- Every text that quotes the old command or its minutes says the new one, and a test keeps it so.

**Non-Goals:**

- No change to `test-tmp.mjs` (any copy), to devkit-compozy, to devkit-panel or to any product
  script (`*.mjs` under `plugins/` that is neither a test file nor `test-fixtures.mjs`). A failure
  that only a product change would fix stops the phase, and the session asks the owner.
- No per-file timeout, no retry of a failed file, no result cache.
- No assertion is weakened, skipped or removed to make a file pass alone or under load.

## Decisions

### D-1 The script: `scripts/test-suite.mjs`

A Node module with no dependency beyond node built-ins, run as `node scripts/test-suite.mjs`. Its
root is the parent of its own folder (`fileURLToPath(new URL('..', import.meta.url))`), so a copy of
the script inside a synthetic tree runs that tree (the tests of D-12 rely on it). It exports
`suiteFiles(root)` and `testImports(root)` (D-6) and runs `main(process.argv.slice(2))` only when it
is the entry file (`process.argv[1]` resolves to its own path).

**Files.** `suiteFiles(root)` lists, recursively, every file whose name ends `.test.mjs` under
`<root>/plugins/openspec/hooks`, `<root>/plugins/openspec/skills/openspec-setup/scripts` and
`<root>/plugins/core/skills/review-change/scripts`, skipping any `node_modules` segment, as paths
relative to the root with `/`, sorted. A folder that does not exist adds nothing. No other folder is
read (ADR 0026 decision 6: the compozy and panel tests stay out).

**Arguments.** Only these forms; anything else exits 2 with a usage line on stderr:

| Form | Meaning |
|---|---|
| `<path>` (any number) | run only these files; each must be one of `suiteFiles(root)` (given relative to the root or absolute), else exit 2 naming it |
| `--concurrency=<n>` | at most `n` files at once; `n` is a whole number from 1; empty, `0`, negative or not a number exits 2 |
| `--reporter=<name>` | passed to each child as `--test-reporter=<name>`; default `spec` |
| `--test-name-pattern=<re>`, `--test-skip-pattern=<re>` | passed to each child as written (repeatable) |

**Children.** Each file runs as `process.execPath --test --test-reporter=<r> [patterns] <file>`,
`cwd` the root, `detached: true` (its own process group), stdout and stderr piped, with
`env = { ...process.env, TMPDIR: <its folder> }` minus `NODE_TEST_CONTEXT`: a script started from
inside a test process (D-12) would otherwise make each nested `node --test` act as a child runner and
write serialized reports instead of text.

**Order and concurrency (D-3).** Files start largest first (`statSync(file).size`, descending; ties
by path), and a new file starts as soon as one ends, until all have run.

**Output.** When a file starts: `start <file>`. When it ends: its whole output as one block, framed
by `=== <file>` and `=== <file>: pass|FAIL|LEFT <seconds>s`, so files never interleave. At the end,
a summary: one line per file, sorted by path (`pass`, `FAIL` or `LEFT`, its seconds, its path, and
for `LEFT` what it left, at most 10 names then `and <k> more`), then
`suite: <files> files, <tests> tests, <pass> pass, <fail> fail, <seconds>s, concurrency <n>`. The
counts sum the children's `ℹ tests|pass|fail <n>` (spec) or `# tests|pass|fail <n>` (TAP) lines; a
file whose output holds none counts as `?` and the totals print `?`. The exit code never depends on
these counts.

**Exit codes.** 0 when every child exited 0 and left nothing; 1 when any child exited non-zero or by
a signal, any file left something (D-2), or the import check refused (D-6, before any file starts);
2 for a usage error; 130 after `SIGINT`, 143 after `SIGTERM` (D-2).

**Parser limits** (the config's Parsers rule). The arguments are read one by one, with no shell
quoting of its own; `--concurrency` is written only `--concurrency=<n>` (the space form
`--concurrency <n>` is an unknown argument and exits 2), and so are the two patterns. A name pattern
that matches no test of a file is not an error: that child exits 0 and its counts read 0. The count lines are read per line of a child's output; a child that dies
mid-line leaves `?`, never a crash.

Alternatives: one quoted glob per folder (`node --test "plugins/openspec/hooks/*.test.mjs" ...`),
rejected by ADR 0026 decision 2 (no place for the per-file `TMPDIR`, the import check or the
leftover check, and the panel would label it by a glob); Node's `run()` API with `files` and
`concurrency`, rejected because every file inherits the one `process.env`, so no per-file `TMPDIR`.

### D-2 The per-file `TMPDIR` comes from the script; `test-tmp.mjs` does not change

At start the script makes one run root:
`mkdtempSync(join(realpathSync(os.tmpdir()), 'devkit-suite-'))`. `realpathSync` resolves a symlinked
temporary root (macOS `/var/folders/...` is under the symlink `/var` → `/private/var`; AC-4's
symlinked `TMPDIR` on Linux), so every child sees a real path and a path a test builds from
`tmpFolder(...)` equals the path git or the product resolves. Each file gets
`<run root>/<nn>-<name>`, made with `mkdirSync` just before its child starts, where `<nn>` is the
file's two-digit place in `suiteFiles` order and `<name>` its file name without `.test.mjs` (two
files of one name in different folders stay apart by `<nn>`).

When the child ends, the script reads its folder (`readdirSync`). Not empty: the file is `LEFT` (a
failure, even when every test passed), the names are kept for the summary, and the folder is removed
(`rmSync(..., { recursive: true, force: true, maxRetries: 3 })`) so a red run does not pile inodes
on the worker. Empty: `rmdirSync`. After the last file the run root is removed the same way. This
replaces CI's `Hook tests left nothing in TMPDIR` step and covers every machine, not only CI.

On `SIGINT` or `SIGTERM` the script sends `SIGTERM` to each running child's process group
(`process.kill(-pid, 'SIGTERM')`; `test-tmp.mjs` sweeps on `SIGTERM`), waits up to 10 seconds for
them, prints `interrupted; still running: <files>`, removes the run root and exits 130 or 143. A
`SIGKILL` of the script leaves its children and its run root (documented, as for the helper). T-16
proves the `SIGTERM` path (exit 143, the children's process group gone, the run root removed); the
`SIGINT` path is the same code with another exit code.

Alternative rejected: each `test-tmp.mjs` copy points `process.env.TMPDIR` at a fresh folder of its
own when loaded. It changes three byte-identical copies (and devkit-compozy's release) for nothing
compozy uses; it misses `jira-task.test.mjs`, which never imports the helper, and any process a test
spawns before the import; and the helper's own exit sweep would remove a leftover before anything
could report it, which is exactly what the check must see. The copies stay as they are, and
`test-tmp.test.mjs` `test-fixture-cleanup AC-4 ...` keeps checking they are identical.

### D-3 Concurrency on CI's 4-core runner and on the 8-core Avell

Default `--concurrency` is `os.availableParallelism()` (Node 18.14 and later): 4 on `ubuntu-latest`,
8 on the Avell (4 cores × 2 threads). The parent script only waits on pipes, so the full count goes
to the children, whose own work (git, spawned hooks, the `openspec` CLI) is the load. Largest-first
order keeps the long files (`change-loop.test.mjs` 6189 lines, `deliver-check.test.mjs` 5621,
`roadmap-loop.test.mjs` 5362) from starting last. On a loaded machine the owner or a session passes
`--concurrency=<n>`; the gates of `tasks.md` run at the default, since only phase 4 times anything.

Alternatives: Node's own default (`availableParallelism() - 1`), rejected because the parent is
idle; a fixed cap of 4, rejected because the target is set on the 8-thread worker.

### D-4 The helpers leave the test files: `plugins/openspec/hooks/test-fixtures.mjs`

One module, holding no `test(` call, in devkit-openspec (ADR 0004: the core test imports nothing
from it). It exports the 24 imported names of "Context", grouped in sections headed by a comment
naming the file each came from. Rules:

- **The closure moves with the name.** Each moved name takes every file-local binding it uses,
  directly or through another (for example `pm` takes `shipRepo`, `presetSetup`, `ACTIVE_ON_MAIN`,
  `NOT_FOUND`, `retroPath`, `ARCHIVED_DIR` and what they use; `scenario` takes `prove`,
  `simGitHub` and `SET`). A binding the source file's tests still use is imported back from the
  module, never kept twice. Imports of product modules move with the code that needs them.
- **The module also exports the closure bindings its sources import back**, under their current
  names (for example `ACTIVE_ON_MAIN`, `ARCHIVED_DIR`, `shipRepo`, `prove`, `simGitHub`, `BODY`,
  when a source file's tests use them). So the module's export list is the 24 names plus those
  bindings, and nothing else.
- **Two different bindings of one name stay apart.** Only a binding inside a moved closure moves.
  A same-named binding of another file that no moved closure uses stays local to its file and is
  not imported from the module: `deliver-check.test.mjs:1055` `check` moves if `pm`'s closure uses
  it; `conduct-check.test.mjs:604` `check` (another shape, outside `roundRepo`'s closure) stays in
  `conduct-check.test.mjs`, and that file does not import `check`. When two moved closures need two
  different bindings of one name, the second one is renamed in the module only, with its source
  file's stem as suffix (`checkConduct`), and its source imports it `as` its old name, so no test
  body changes.
- **It makes nothing at import.** No module-level `tmpFolder`, spawn or git call; a folder is made
  only when a moved function runs. Prefixes stay as they are (`devkit-deliver-`, `devkit-gh-`,
  `devkit-origin-`, `devkit-change-loop-lock-`, ...).
- **The eight unimported exports lose `export`** and stay in their files. Moving `packV2` would copy
  the whole pack in every importer's process. After the change no `*.test.mjs` exports a name.
  (`decisions.md` / ADR 0026 decision 3 say every exported name moves; this is flagged for the owner
  in `proposal.md`.)
- **The importers** (table C) import from `./test-fixtures.mjs`, or
  `../../../hooks/test-fixtures.mjs` from `skills/openspec-setup/scripts/`, with the same local
  names (`git as gitIn` in `guard.test.mjs` stays).
- **The tests' bodies do not change.** A commit of this decision names the invariant ("fixture
  location only; assertions unchanged"), the layer (test fixtures) and the suite (the file's own,
  under the old command until phase 2).

Phase 1 keeps `guard.test.mjs` lines 13 to 31, so the old command still runs every file once and is
phase 1's gate; phase 2 removes them with the script in place. Line 12 is today the only line that
loads `deliver-check.test.mjs` into the guard's process, so when it moves to `./test-fixtures.mjs`
phase 1 adds `import './deliver-check.test.mjs'; // suite-speed: until the script runs the suite`
beside the other side-effect imports, and phase 2 removes it with them (20 lines).

### D-5 The two static scans read `test-fixtures.mjs` too

Moving code out of `*.test.mjs` would take it out of two scans that read only test files:

- `guard.test.mjs:1216` `testFilesUnder` feeds `no test env blanks DEVKIT_BRANCH without also
  blanking GITHUB_HEAD_REF` (line 1224). It also returns files named `test-fixtures.mjs`.
  Invariant: no fixture env blanks `DEVKIT_BRANCH` alone (CONTRIBUTING, testing rules). Layer:
  static scan of test code. Suite: `guard.test.mjs`.
- `test-tmp.test.mjs` `rawTempCalls` (line 136) feeds `test-fixture-cleanup AC-3 no test file under
  plugins makes a temporary folder or reads the root by hand`. It also reads files named
  `test-fixtures.mjs`. Invariant: test code makes folders only through `test-tmp.mjs`. Layer: static
  scan of test code. Suite: `test-tmp.test.mjs`.

Each gains a new test (D-12, T-12 and T-13) with a synthetic `test-fixtures.mjs`. The existing test
names and their assertions stay.

### D-6 The import check, in the script, before any file runs

`testImports(root)` reads every `*.test.mjs` under `<root>/plugins` (recursive, no `node_modules`)
and returns, sorted, `{ file, line, spec }` for each line matching

```
/(?:\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"]([^'"]*\.test\.mjs)['"]/
```

(a named or namespace import's `from` line, including the last line of a multi-line import; a
side-effect import; a dynamic `import('...')` on one line; an `export ... from`). Comment lines are
read too: the check is strict. A dynamic import split across lines, or a specifier built at run
time, is not seen (accepted limit; no such form exists at the base). An unreadable file exits 2
naming it. When the list is not empty the script prints, per entry,
`<file>:<line>: imports <spec>, a test file; move what it needs to a module that holds no test (in devkit-openspec, plugins/openspec/hooks/test-fixtures.mjs) and import that`,
then `refused: <k> test-file imports` and exits 1 without starting any file. The check covers all of
`plugins/` (AC-3), the suite's folders and the others. Alternative: put it in `scripts/check.py`;
rejected because ADR 0026 decision 2 makes the script the place where it runs, so a sibling change
that merges `main` and runs the suite meets it at once.

### D-7 `scripts/check.py` refuses a skipped test (AC-5c)

A new `check_no_skipped_tests()`, called from `main()` after `check_awaited_subtests()`, over
`plugins/**/*.test.mjs` minus `SKIP_DIRS` and minus every path under `plugins/compozy/` (its five
`skip`s guard a missing `compozy` CLI, and its tests are outside the suite, ADR 0026 decision 6).
A line is refused when it matches either

```
\b(?:test|it|describe|suite|t)\.(?:skip|only|todo)\s*\(
^\s*(?:await\s+)?(?:test|it|describe|suite|t\.test)\s*\(.*[{,]\s*(?:skip|only|todo)\s*:
```

with the problem `<path>:<n>: a test is skipped (skip, only or todo); the suite runs every test`.
At the base it finds nothing (the `skip:` keys of `flow-check.test.mjs` lines 907 to 1957 and the
`only:` key of `guard.test.mjs:455` are on lines that are not test calls). Limit: an options object
split over several lines is not seen. The module docstring gains a line for the check.

### D-8 CI: one step

In `.github/workflows/ci.yml`, job `check`, the steps `Hook tests` and `Hook tests left nothing in
TMPDIR` become one step, after `Install OpenSpec (the hook tests and the schema step need it)`:

```yaml
      - name: Test suite
        run: |
          git config --global user.email ci@example.com
          git config --global user.name ci
          node scripts/test-suite.mjs
```

No `TMPDIR` is set: the script makes its run root under the runner's temporary folder and checks
each file's folder itself. The job keeps its id `check` (ADR 0002, ADR 0003) and its other steps.
`test-tmp.test.mjs` `test-fixture-cleanup AC-5 the hook tests run on an empty TMPDIR and a step fails
when it is not empty after` is rewritten in place (its name stays, still true of the one step):
a step named `Test suite` exists after the `Install OpenSpec` step and holds
`node scripts/test-suite.mjs`; no step is named `Hook tests` or `Hook tests left nothing in TMPDIR`;
no step holds `hook-tests-tmp` or `guard.test.mjs`. Invariant: CI runs the one suite command in one
step, and that command owns each file's empty `TMPDIR`. Layer: the CI workflow text. Suite:
`test-tmp.test.mjs`. The name is kept so that AC-2's name lists stay equal.

### D-9 The texts that quote the old command

| Where | Now | After |
|---|---|---|
| `CLAUDE.md:32` | row "Every hook test and the review round (13 to 21 minutes; ...)" with the old command | "Every test file, each in its own process, several at once (about <m> minutes on an idle 8-core machine, written in phase 4; run it as a background command of the tool, never with a shell `&`)" with `node scripts/test-suite.mjs` |
| `CONTRIBUTING.md:38-42` | old command block and the paragraph on what `guard.test.mjs` imports ("about 13 minutes; 12m54s observed on 279c830") | `node scripts/test-suite.mjs` block; a paragraph: the three folders, one process and one empty real-path `TMPDIR` per file, as many at once as the machine has cores (`--concurrency=<n>` on a loaded machine), file arguments and `--test-name-pattern=`, the refused test imports (`test-fixtures.mjs`), the leftover failure, and the measured time (phase 4: "about <m> minutes on an idle 8-core machine; <m:ss> observed on <short sha>"); "give reviewers its result" kept |
| `CONTRIBUTING.md:46` | "CI runs the hook tests with `TMPDIR` set to an empty folder ... before the first push a new or changed test file runs with a fresh empty `TMPDIR`" | "the suite script runs each file with its own empty `TMPDIR` and fails a file that leaves anything there ...; before the first push run a new or changed test file with `node scripts/test-suite.mjs <file>`" |
| `CONTRIBUTING.md:90` | "put the `plugin test` part first, before the guard suite" | "... before the test suite" |
| `plugins/openspec/README.md:73` | `- **Tests**: \`node --test plugins/openspec/hooks/guard.test.mjs\`.` | `- **Tests**: \`node scripts/test-suite.mjs\`, from the repository root (every test file in a process of its own).` |
| `openspec/config.yaml:29` | `Test command: node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` | `Test command: node scripts/test-suite.mjs && python3 scripts/check.py` |
| `openspec/config.yaml:31` | ADRs line ends with the 0021 entry | `; <N> the devkit test suite runs by file in parallel, each file in its own temporary folder` appended before `)`, `<N>` the ADR's number (0022 unless task 5.1 renumbers it); the rest of the line, among it `amends 0004, 0006, 0010, 0011, 0013, 0014, 0017 and 0020`, unchanged |
| `docs/openspec-flow.md:318` | "the whole guard suite runs once" | "the whole test suite runs once" |
| test header comments | "Imported by (hooks/)guard.test.mjs so that `node --test plugins/openspec/hooks/guard.test.mjs` runs this file too" | "Run by `node scripts/test-suite.mjs`, in a process of its own; alone: `node scripts/test-suite.mjs <this file>`" |

The header comments: `plugins/openspec/hooks/` `conduct-check.test.mjs:1-2`,
`deliver-check.test.mjs:1-2`, `merge-setup.test.mjs:1-2`, `release-merge.test.mjs:1-2`,
`version-pin.test.mjs:2-3`, `jira-task.test.mjs:3`, `project-loop.test.mjs:1,3`,
`roadmap-loop.test.mjs:1`, `test-tmp.test.mjs:3`, `guard.test.mjs:1` (the guard's own tests);
`plugins/openspec/skills/openspec-setup/scripts/` `changes-under-way.test.mjs:2`,
`gh-version.test.mjs:1-2`, `github-setup.test.mjs:1-2`, `install-schemas.test.mjs:1-2`,
`project-settings.test.mjs:1-2`, `ship-entry.test.mjs:1-2`;
`plugins/core/skills/review-change/scripts/review-round.test.mjs:2`. The two `--test-name-pattern`
headers (`project-loop.test.mjs:1`, `roadmap-loop.test.mjs:1`) name their own file instead of the
guard's. Only comments change in these lines: 17 files, the two `project-loop.test.mjs` lines
counted once.

**The ADR's number.** `0022` is the number while it is the next free ADR number on `origin/main`.
The rule (`openspec/config.yaml`, tasks) is "the next free number on origin/main at the last merge
before review": task 5.1, after the last merge of `origin/main` into the branch, lists
`git ls-tree --name-only origin/main docs/adr/`. When a sibling change has taken 0022, this change's
ADR takes the next free number `<N>`, and in one commit: the file is renamed
(`git mv docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md docs/adr/<N>-the-devkit-test-suite-runs-by-file-in-parallel.md`),
its title line `# ADR 0026:` becomes `# ADR <N>:`, the `openspec/config.yaml` ADRs entry of this
table names `<N>`, `openspec/changes/suite-speed/decisions.md` links the new path, and every
`ADR 0026` and `0026-the-devkit-test-suite` of this change's own texts (`proposal.md`, `design.md`,
`tasks.md`, the `CHANGELOG.md` section of task 5.1, and the `CONTRIBUTING.md` paragraph if it names
the ADR) names `<N>`. Nothing outside these files names the ADR. The check:
`git grep -n "0026-the-devkit-test-suite"` prints nothing, `docs/adr/<N>-the-devkit-test-suite-runs-by-file-in-parallel.md`
exists, and `openspec/config.yaml` holds `<N> the devkit test suite runs by file in parallel`. When
0022 is still free, nothing is renamed and the task records "0022 still free at <sha of origin/main>".

ADR 0026 (or `<N>`): `- Status: proposed` becomes `- Status: accepted`, followed by
`- Accepted by: the owner, on <date>, in the message that approved the plan of the change: \`<words>\`; recorded in \`openspec/changes/suite-speed/approval.md\``,
the date and words read from `approval.md` (the form ADR 0021 uses).

### D-10 AC-2: the same test names

**No cheap listing exists.** A skip or name filter does not list names: on the worker's Node
26.13.1, a scratch file with three tests and one subtest, run with `--test-reporter=tap` and
`--test-skip-pattern=.`, `--test-name-pattern=<no match>` or `--test-only`, reports only the file
(`ok 1 - a.test.mjs`, `# tests 1`), and with `--test-isolation=none` nothing at all; a custom
reporter sees no `test:enqueue` event for a filtered test (tried 2026-11-23, scratch files only).
Node 22 is not installed on the worker, and this proof runs only on the worker, so its behaviour
there does not matter. The names therefore come from **two full runs with the TAP reporter**. On
the same scratch file a full run prints every name, the subtest included and indented four spaces
(`ok 1 - one`, `    ok 1 - two sub`, `ok 2 - two`, ...), with no line for the file itself, and an
aggregator file that imports the others prints the same name lines as the files run apart: so the
old command's one process and the new command's many processes give comparable lists. The TAP
line form `ok <n> - <name>` (subtests indented) is the TAP reporter's documented output on Node 22
as on 26.

**Cost.** Not cheap: the base run is the old command (13 minutes idle, up to 45 loaded on the
worker), the head run is one whole run of the new command. The conducting session runs both in
task 5.3, each as a background command of the tool, one after the other (never at the same time,
never at the same time as a gate), with `TMPDIR` set as `tasks.md` says.

1. `base=$(git merge-base HEAD origin/main)`; `git archive "$base"` extracted into
   `/var/tmp/devkit-suite-speed-proof/base` (no git state changes); then the copy gets a
   repository of its own:
   `git -C /var/tmp/devkit-suite-speed-proof/base init -q && git -C /var/tmp/devkit-suite-speed-proof/base add -A -f`.
   Two tests of the old command read the repository through git with `cwd` the repository root:
   `deliver-check.test.mjs:3198-3199` (`git ls-files`, which throws outside a repository) and
   `change-loop.test.mjs:2491-2494` `repoFiles()` (`git ls-files --cached --others
   --exclude-standard -z`, asserting status 0). Both read only the index and the working tree:
   no test of the old command reads `HEAD`, a ref or a commit of the repository root (the other
   git calls of the suite run in their own fixture repositories), so no commit and no identity are
   needed. `add -A -f` puts every extracted file in the index, ignored or not, so `git ls-files`
   there lists exactly the files tracked at `$base`, as it does in a checkout. A detached
   `git worktree add` of `$base` was rejected: it writes `.git/worktrees/` and a checkout outside
   `.claude/worktrees/` into the repository shared with the root checkout, while `init` writes only
   inside the copy under `/var/tmp`. The base copy does not hold this change's folder
   (`openspec/changes/suite-speed/` exists only at the head), and no test of the old command reads
   it, so its absence changes no name.
2. In that copy, with `TMPDIR=/var/tmp/devkit-suite-speed`:
   `node --test --test-reporter=tap plugins/openspec/hooks/guard.test.mjs > /var/tmp/devkit-suite-speed-proof/base.tap 2>&1`;
   it must exit 0.
3. At the head, with the same `TMPDIR`:
   `node scripts/test-suite.mjs --reporter=tap > /var/tmp/devkit-suite-speed-proof/head.tap 2>&1`;
   it must exit 0. The script's own lines (`start <file>`, `=== <file>...`, the summary, `suite:`)
   never take the form `ok <n> - `, and a probe's output inside `test-suite.test.mjs` is captured by
   the probe test, never echoed, so only the children's TAP lines match.
4. From each file, every line matching `^\s*(not )?ok [0-9]+ - `, reduced to the name
   (`sed -E 's/^\s*(not )?ok [0-9]+ - //; s/ # (SKIP|TODO).*$//'`), sorted with `LC_ALL=C sort`
   (duplicates kept) into `base.names` and `head.names`; from `head.names` the names starting
   `suite-speed ` are removed (this change's tests, T-1 to T-16, which make no subtests). Then
   `diff base.names head.names` prints nothing. `evidence.md` records both counts, the count
   removed, and the empty diff.

Subtests are in both lists (both are full runs), so a subtest lost or doubled shows as well. The
same procedure, on one file, proves a split of task 4.2: the original file at the commit before the
split (`git archive` copy given its own repository as in step 1, `node --test --test-reporter=tap <file>`) against
`node scripts/test-suite.mjs --reporter=tap <its parts>` at the split commit; that costs one file's
run on each side.

### D-11 AC-5, AC-5b, AC-6: the proofs

- **AC-5** (phase 4, task 4.1). Only after the coordinating session gives this change a place with
  no other change running on the worker: the owner runs, on the Avell,
  `nproc; uptime; time -p node scripts/test-suite.mjs` (bash) and passes the summary (per-file
  seconds and the `suite:` line), `nproc`, the load averages and the `real` time to the session,
  which records them. A file whose own seconds pass 600 is split (task 4.2): its `// ----` section
  headings become `<name>-<part>.test.mjs` files of fewer than 600 seconds each, its shared local
  helpers go to `plugins/openspec/hooks/<name>-fixtures.mjs` (no test, made nothing at import), no
  test is renamed, and the owner runs the measurement again. When the whole run passes 600 seconds
  with no file above it, the session stops and asks the owner (no silent change of the target or of
  the concurrency).
- **AC-5b** (after `open-pr`, Workflow follow-up of `tasks.md`). Once the pull request's first
  `check` run has finished, before `enable-auto-merge`, the session reads the job's duration
  (`gh run view <run id> --json jobs`), records the row `AC-5b` in `evidence.md` (a commit under
  `openspec/` only, which leaves the reviews current, ADR 0012 decision 4), and stops for the owner
  when it passes 15 minutes. Before the PR, the evidence row `AC-5b` reads
  `pending: the pull request's first check run`; `deliver-check#acceptanceItem` reads `AC-5b` and
  `AC-5c` rows as `AC-5` rows (its id pattern is `AC-\d+`), so the `AC-5` and `AC-5c` passing rows
  carry the item, and a `fail` row on either would block it.
- **AC-6** (task 5.3). `git archive HEAD` extracted into `/var/tmp/devkit-suite-speed-proof/red`;
  in that copy, the first assertion of the first test of `plugins/openspec/hooks/jira-task.test.mjs`
  is preceded by `assert.fail('suite-speed red on purpose');`; then
  `node scripts/test-suite.mjs plugins/openspec/hooks/jira-task.test.mjs plugins/openspec/hooks/merge-setup.test.mjs`
  exits 1, its output names that test and the file, and `merge-setup.test.mjs` passes. Output kept
  in `/var/tmp/devkit-suite-speed-proof/red.log` for the evidence.
- **AC-4, symlink** (task 2.4). `mkdir /var/tmp/devkit-suite-speed-link-target`, then
  `ln -s /var/tmp/devkit-suite-speed-link-target /var/tmp/devkit-suite-speed-link`, then
  `env TMPDIR=/var/tmp/devkit-suite-speed-link node scripts/test-suite.mjs --test-name-pattern="^change-budget " plugins/openspec/hooks/change-loop-remote.test.mjs`
  passes; the tests named `change-budget ...` of `change-loop-remote.test.mjs` (`change-loop.test.mjs` from line 4882 before the split of task 4.2, among them
  `change-budget AC-9 sessionTranscript finds the session file under CLAUDE_CONFIG_DIR`, which
  compares a path built from a temporary folder with the path the guard returns) are the
  change-budget tests that compare paths. T-8 proves the real path for any file.

### D-12 Tests

New test file `plugins/openspec/hooks/test-suite.test.mjs`, in the suite (its folder is listed).
Its probes copy `scripts/test-suite.mjs` into a `tmpFolder('devkit-suite-tree-')` as
`<tree>/scripts/test-suite.mjs`, write small test files (importing only `node:test`, `node:assert`,
`node:fs`, `node:path`) under `<tree>/plugins/...`, and spawn
`process.execPath <tree>/scripts/test-suite.mjs ...` with `cwd: <tree>`. The probes read the
temporary root through `process.env.TMPDIR`, never through a raw call (`test-tmp.test.mjs`
`rawTempCalls` scans this file); every import line, skip form and old command text a probe or a
fixture needs is built by joining pieces, so the repository scans of T-5, T-11, T-14 and of
`rawTempCalls` do not find them in this file. Every new test's name starts `suite-speed AC-<n> `,
and no new test makes a subtest (`t.test`), so D-10's `suite-speed ` filter removes all of them; a
probe's own output stays in the probe test's captured stdout and never reaches the suite's output.

| Id | Test (file) | Invariant | Layer | AC |
|---|---|---|---|---|
| T-1 | `suite-speed AC-1 the script runs the test files of the three folders and no other` (test-suite) | files of `hooks/`, `openspec-setup/scripts/`, `review-change/scripts/` run; a failing `plugins/compozy/.../c.test.mjs` and a `plugins/openspec/hooks/notes.mjs` do not | the script's file list | AC-1 |
| T-2 | `suite-speed AC-1 the repository's suite holds every file the old command ran` (test-suite) | `suiteFiles(REPO_ROOT)` includes the 21 paths of "Context" | the script's file list | AC-1 |
| T-3 | `suite-speed AC-1 files run at the same time up to --concurrency` (test-suite) | two probes each wait (up to 5 s) for the other's marker in a shared folder passed by env: exit 0 at `--concurrency=2`; at `--concurrency=1` with a 1.5 s wait, exit 1 | the script's pool | AC-1 |
| T-4 | `suite-speed AC-1 a bad argument exits 2 and runs nothing` (test-suite) | unknown option, `--concurrency=0`, `--concurrency=x`, a path outside the suite: exit 2, no `start` line | the script's arguments | AC-1 |
| T-5 | `suite-speed AC-3 a test file that imports another is refused by file and line before any file runs` (test-suite) | a `from` line, a side-effect import, the last line of a multi-line import and a dynamic import are each named `<file>:<line>` with `test-fixtures.mjs` in the message; exit 1; no `start` line | the import check | AC-3 |
| T-6 | `suite-speed AC-3 no test file under plugins imports another test file` (test-suite) | `testImports(REPO_ROOT)` is `[]` | the repository | AC-3 |
| T-7 | `suite-speed AC-4 each file runs in its own empty TMPDIR under one run root, removed after` (test-suite) | two probes write their `TMPDIR` and its entry count: paths differ, share a parent named `devkit-suite-*`, were empty, and that parent is gone after the run | the script's folders | AC-4 |
| T-8 | `suite-speed AC-4 a symlinked TMPDIR gives each file a real path` (test-suite) | with `TMPDIR` a symlink to a `tmpFolder`, a probe's `realpathSync(TMPDIR) === TMPDIR` and its run root's parent is the target's real path | the script's folders | AC-4 |
| T-9 | `suite-speed AC-4 a file that leaves something in its TMPDIR fails the run and is named with what it left` (test-suite) | a passing probe that makes `left-behind/`: exit 1, summary line `LEFT` with the file and `left-behind`; the run root is gone | the leftover check | AC-4 |
| T-10 | `suite-speed AC-6 a failing test exits 1 and prints its name and file; the other files still run` (test-suite) | a probe test `suite-speed probe fails on purpose` and a passing probe: exit 1, both names in stdout, `FAIL` on the first file | the script's exit and output | AC-6 |
| T-11 | `suite-speed AC-5c check.py refuses skip, only and todo in the suite's test files, not in compozy's` (test-suite) | `python3 scripts/check.py --root <synthetic>`: a `.skip(`, an `{ only: true }` option and a `.todo(` in `plugins/openspec/hooks/a.test.mjs` are three problem lines; the same in `plugins/compozy/skills/x/b.test.mjs` are none; a clean tree prints `all checks passed` | `scripts/check.py` | AC-5c |
| T-12 | `suite-speed AC-3 the branch-blank scan reads test-fixtures.mjs` (guard) | `testFilesUnder` returns a synthetic `test-fixtures.mjs` and its offending line is found | static scan | AC-3 |
| T-13 | `suite-speed AC-3 the raw-temp scan reads test-fixtures.mjs` (test-tmp) | `rawTempCalls` names a raw call in a synthetic `plugins/x/test-fixtures.mjs` | static scan | AC-3 |
| T-14 | `suite-speed AC-7 the docs and the agents' context name the one command, and no file outside the records names the old one` (test-suite) | `CLAUDE.md`, `CONTRIBUTING.md`, `plugins/openspec/README.md` and `openspec/config.yaml` hold `node scripts/test-suite.mjs`; no line of a file of `git ls-files` outside the exemptions matches `OLD_COMMAND` or `OLD_HEADER` (below) | the documents | AC-7 |
| T-15 | `suite-speed AC-8 CLAUDE.md and CONTRIBUTING.md state the measured time` (test-suite, phase 4) | neither holds `13 to 21 minutes` or `about 13 minutes`; the `CLAUDE.md` line holding `node scripts/test-suite.mjs` matches `MEASURED`, and the `CONTRIBUTING.md` paragraph after its `node scripts/test-suite.mjs` block matches `MEASURED_AT` (below) | the documents | AC-8 |
| T-16 | `suite-speed AC-4 SIGTERM stops every running file, removes the run root and exits 143` (test-suite) | a probe that writes its `process.pid` and its `TMPDIR` into a marker folder passed by env, then waits 30 s; once the marker exists the test sends `SIGTERM` to the script: the script exits 143 within 15 s, stdout holds `interrupted; still running: ` and the probe's path, `process.kill(<probe pid>, 0)` throws `ESRCH`, and the parent of the probe's `TMPDIR` (the run root) is gone | the script's signals | AC-4 |
| changed | `test-fixture-cleanup AC-5 the hook tests run on an empty TMPDIR and a step fails when it is not empty after` (test-tmp) | D-8 | CI workflow text | AC-7 |
| changed at the release | `change-loop docs: the design records the answers` (change-loop) | the CI snippet pins the current release: its match of the current pin (`v0\.33\.0` at the base) moves to the new devkit-openspec version and the old pin joins the `doesNotMatch` list; changed in task 5.2 together with the bump and the doc pin, since it is red from the doc pin move until it moves | documentation test | — |

T-14 reads the index with `git ls-files` (no history; `deliver-check.test.mjs` "AC-6
instructions-follow" does the same) and tests each line of each file against two expressions,
written in the test by joining pieces (D-12) so that `test-suite.test.mjs` does not match them
itself:

```
OLD_COMMAND = /node --test(?: [^ `\n]+)* plugins\/openspec\/hooks\/guard\.test\.mjs/
OLD_HEADER  = /Imported by (?:hooks\/|plugins\/openspec\/hooks\/)?guard\.test\.mjs/
```

`OLD_COMMAND` is the command with or without options before the path, so it catches the plain
form (`ci.yml:27`, `CLAUDE.md:32` and `AGENTS.md:32`, which is a symlink to `CLAUDE.md` and is read
through it, `CONTRIBUTING.md:39`, `openspec/config.yaml:29`,
`plugins/openspec/README.md:73`, `test-tmp.test.mjs:183`, the header comments' second lines and
`guard.test.mjs:1`) and the `--test-name-pattern="^..."` forms of `project-loop.test.mjs:1` and
`roadmap-loop.test.mjs:1`. `OLD_HEADER` catches the headers that name the guard without the
command (`jira-task.test.mjs:3`, `project-loop.test.mjs:3`, `test-tmp.test.mjs:3`,
`review-round.test.mjs:2` and the first lines of the others). The bare file name is not a needle:
it stays, correctly, in `deliver-check.test.mjs:4489,4504` (sample paths of `unnamedFiles`),
`openspec/roadmap.md:177` (the roadmap line, ticked at the archive) and `CONTRIBUTING.md:44` (the
guard's own test of branch variables), and none of them matches either expression. At the base
both expressions hit the files above, so T-14 is red there (task 3.3's red half); after tasks 2.3,
3.1 and 3.3 they hit nothing outside the exemptions.

Exemptions, by path prefix: `openspec/changes/` (archived and open changes' records, this change's
included), `CHANGELOG.md`, `plugins/panel/` (sample texts and `commandLabel` tests) and `docs/adr/`
(ADR 0026's Context quotes the old command as the state it replaces; flagged in `proposal.md`).

T-15 uses, written in the test:

```
MEASURED    = /about \d+ minutes on an idle 8-core machine/
MEASURED_AT = /about \d+ minutes on an idle 8-core machine; \d+:\d{2} observed on [0-9a-f]{7,40}\b/
```

The figure itself is evidence (`measure.md`, `evidence.md`), never a constant of the test: T-15
recognises the measured time by that form, and the texts of D-9 write it in that form ("about <m>
minutes on an idle 8-core machine" in `CLAUDE.md`; the same followed by "; <m:ss> observed on
<short sha>" in `CONTRIBUTING.md`).

## Pinned rules: every test and check that quotes what this change replaces

Searched at `720d91d` in `plugins/openspec/hooks`, `plugins/openspec/skills/openspec-setup/scripts`,
`plugins/core/skills/review-change/scripts`, `plugins/compozy`, `plugins/panel/hooks` (`*.test.tsx`
and `fixtures/`) and `scripts/check.py`, for: the old command's text, the CI step names and
`hook-tests-tmp`, the label `guard suite`, the 13 and 21 minute figures, and test-file-to-test-file
imports.

**A. The command text, the CI steps, the minutes.**

| file:line | What it holds | This change |
|---|---|---|
| `plugins/openspec/hooks/test-tmp.test.mjs:179-192` | the AC-5 test: step `Hook tests` with `hook-tests-tmp`, `mkdir "$TMPDIR"` and the old command (183); step `Hook tests left nothing in TMPDIR` (188-190) | rewritten, D-8 |
| `.github/workflows/ci.yml:20-33` | the two steps | one step, D-8 |
| `CLAUDE.md:32` | old command, "13 to 21 minutes" | D-9, time in phase 4 |
| `CONTRIBUTING.md:39,42` | old command, "about 13 minutes; 12m54s observed on 279c830" | D-9, time in phase 4 |
| `CONTRIBUTING.md:46` | "CI runs the hook tests with `TMPDIR` set to an empty folder" | D-9 |
| `CONTRIBUTING.md:90` | "before the guard suite" | D-9 |
| `plugins/openspec/README.md:73` | old command | D-9 |
| `openspec/config.yaml:29` | old command as the Test command | D-9 |
| `docs/openspec-flow.md:318` | "the whole guard suite runs once" | D-9 |
| header comments, 17 files (D-9 list) | "Imported by guard.test.mjs so that `node --test ...guard.test.mjs` runs this file too" | D-9 |
| `plugins/openspec/hooks/roadmap-loop.test.mjs:5046` | "the guard suite takes about 13 minutes", inside `REAL_STARTED_2026_11_22`, a recorded transcript | unchanged: a record, its text line for line |
| `plugins/openspec/hooks/deliver-check.test.mjs:4489,4504` | `plugins/openspec/hooks/guard.test.mjs` as a sample path of `unnamedFiles` | unchanged: sample data |
| `plugins/openspec/hooks/flow-check.test.mjs:1810` | `unit: "npm test"   # the whole suite`, a sample config | unchanged |
| `plugins/panel/hooks/report.test.tsx:756,765` | `commandLabel('node --test plugins/openspec/hooks/guard.test.mjs')` is `guard suite` | unchanged: the label of that command is still right; the panel is out of scope |
| `plugins/panel/hooks/panel.test.tsx:416,418,2085,2089` | the old command in a sample gate and its `guard suite` label | unchanged: sample text |
| `plugins/panel/hooks/detail.ts:30` | `guard suite` as an example in a doc comment | unchanged; line 44 labels the new command `test-suite` |
| `plugins/panel/hooks/fixtures/change.ts:58`, `tasks.ts:7`, `proposal.ts:5`, `deliver-open.ts:7` | recorded sample texts with the old command | unchanged |
| `plugins/compozy/**` | no hit (`install-kit.test.mjs:39` only filters `.test.mjs` when copying) | unchanged |
| `scripts/check.py` | no hit; `check_awaited_subtests` (125-135) scans `plugins/**/*.test.mjs` | unchanged; D-7 adds a check beside it |

**B. Tests whose scope the helper move touches.**

| file:line | Test | This change |
|---|---|---|
| `plugins/openspec/hooks/guard.test.mjs:1216-1234` | `no test env blanks DEVKIT_BRANCH without also blanking GITHUB_HEAD_REF` | `testFilesUnder` also returns `test-fixtures.mjs`, D-5 |
| `plugins/openspec/hooks/test-tmp.test.mjs:136-164` | `test-fixture-cleanup AC-3 ...` (two tests) | `rawTempCalls` also reads `test-fixtures.mjs`, D-5 |
| `plugins/openspec/hooks/deliver-check.test.mjs:3198-3209` | `AC-6 instructions-follow: no tracked file outside the records still says review before evidence` | unchanged; `test-fixtures.mjs` must hold none of `OLD_ORDER` (line 3143), checked by the phase 1 gate |
| `plugins/openspec/hooks/deliver-check.test.mjs:3795-3803` | `the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec version, with the tag in a comment, never the tag in the URL (R-10, security)` | unchanged; red from the devkit-openspec bump until the pin of `docs/openspec-flow.md:661-675` names the new version, so task 5.1 does both in one task (no Check between them) |
| `plugins/openspec/hooks/deliver-check.test.mjs:3806-3825` | `AC-8 release-ready: every pack version matches its marketplace entry, the doc pin names the devkit-openspec version and CONTRIBUTING holds the tag rule` | unchanged; red between the bump and the doc pin move for the same reason; green after task 5.1 |
| `plugins/openspec/hooks/roadmap-loop.test.mjs:5132-5133` | the ADRs line of `openspec/config.yaml` includes `amends 0004, 0006, 0010, 0011, 0013, 0014, 0017 and 0020` | unchanged; stays green with the append of D-9 (the append adds an entry before `)` and leaves those words as they are); task 3.3 runs it |
| `plugins/openspec/hooks/change-loop.test.mjs:2543-2600` | `change-loop docs: the design records the answers` | the pin assertion (line 2578) moves at the release, in task 5.2 with the doc pin it reads |
| `plugins/openspec/hooks/test-tmp.test.mjs:121-133` `test-fixture-cleanup AC-4 ...` (two tests) | the three helper copies are identical | unchanged and still true: no copy changes |

**C. Test-file-to-test-file imports (all removed).**

| file:line | Imports |
|---|---|
| `plugins/openspec/hooks/guard.test.mjs:12` | `gitRepo, put, commitAll, git as gitIn, openspecStub` from `./deliver-check.test.mjs` |
| `plugins/openspec/hooks/guard.test.mjs:13-31` | 19 side-effect imports of the other suite files, plus the `deliver-check.test.mjs` one phase 1 adds (all removed in phase 2) |
| `plugins/openspec/hooks/conduct-check.test.mjs:9,11` | ten names from `./deliver-check.test.mjs`; `pinDoc` from `./release-merge.test.mjs` |
| `plugins/openspec/hooks/flow-check.test.mjs:14,16` | eleven names from `./deliver-check.test.mjs`; `roundRepo` from `./conduct-check.test.mjs` |
| `plugins/openspec/hooks/change-loop.test.mjs:12,13` | five names; `roundRepo` |
| `plugins/openspec/hooks/roadmap-loop.test.mjs:10,16,17` | four names; `roundRepo`; `readCounter` from `./change-loop.test.mjs` |
| `plugins/openspec/hooks/delivery-models.test.mjs:11,12` | three names; `roundRepo` |
| `plugins/openspec/hooks/release-tags.test.mjs:19,20` | eight names; `scenario, archiving, TWO_PRS` from `./delivery-models.test.mjs` |
| `plugins/openspec/hooks/version-pin.test.mjs:17,18` | five names; `roundRepo` |
| `plugins/openspec/hooks/merge-setup.test.mjs:13` | four names |
| `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs:11` | three names from `../../../hooks/deliver-check.test.mjs` |
| `plugins/openspec/skills/openspec-setup/scripts/gh-version.test.mjs:9` | `fakeGh` |
| `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs:12` | five names |

## Risks / Trade-offs

- [Files that shared one process depend on each other: an env change, a module-level fixture, an
  order] → Phase 2's gate runs every file alone through the script. A file that fails alone and
  passed in the aggregate is fixed in its own fixture (the commit names invariant, layer and suite),
  never by skipping; a fix that needs product code stops the phase for the owner.
- [Timing-sensitive tests (fake `gh` with `sleep`, lock waits) flake when 4 to 8 files load the
  CPU] → the gate runs at the default concurrency on the loaded worker and CI runs at 4, so a flake
  shows before review; it is fixed by widening that test's own wait, never its assertion; AC-5c's
  check refuses a skip.
- [A nested `node --test` inherits `NODE_TEST_CONTEXT`] → the script removes it from the children's
  env (D-1); T-10 fails if a nested run's output is not text.
- [Moved helpers leave the static scans] → D-5.
- [Node 22 on CI differs from the worker's Node 26.13.1 (reporter lines, `--test-skip-pattern`
  from 22.1 as a pass-through option, `readdirSync` `recursive` from 20.1; the AC-2 proof does not
  depend on it, D-10)] → the PR's `check` job runs T-1 to T-11 on Node
  22; the counts may print `?` without changing the exit code.
- [The suite misses 10 minutes without a file above it] → D-11: the session stops and asks the
  owner.
- [Other open changes: their gate rows run only the guard's tests after the merge, and a new test
  file importing `deliver-check.test.mjs` is refused] → the refusal names `test-fixtures.mjs`; the
  coordinating session is told at the merge (Workflow follow-up).
- [AC-5b is read after `open-pr`] → D-11 and the Workflow follow-up; flagged in `proposal.md`.

## Migration Plan

Phases 1 to 5 of `tasks.md`. Phase 1 keeps the old command whole (its gate), phase 2 switches to the
script (its gate is the first full run of the new command), phase 3 moves CI and the texts, phase 4
measures, phase 5 releases. Rollback: revert the merge commit; `ci.yml` returns to its two steps and
`guard.test.mjs` to its imports in the same revert, and the old command runs everything again.
Changes that already quote `node scripts/test-suite.mjs` would then need the old one back.

## Implementation plan

**Per surface.**

- Test code (devkit-openspec): `test-fixtures.mjs`; the importers; the exports dropped; the two
  scans; `test-suite.test.mjs`; the AC-5 test; header comments; at the release, the pin assertion.
- Test code (devkit-core): one header comment.
- Repository tooling: `scripts/test-suite.mjs`, `scripts/check.py`, `.github/workflows/ci.yml`.
- Docs: `CLAUDE.md`, `CONTRIBUTING.md`, `plugins/openspec/README.md`, `openspec/config.yaml`,
  `docs/openspec-flow.md`, ADR 0026, `CHANGELOG.md`.

**File structure.**

- Create: `scripts/test-suite.mjs`; `plugins/openspec/hooks/test-fixtures.mjs`;
  `plugins/openspec/hooks/test-suite.test.mjs`; only if task 4.2 splits a file, its parts and
  `plugins/openspec/hooks/<name>-fixtures.mjs`.
- Modify: `plugins/openspec/hooks/{guard,deliver-check,conduct-check,release-merge,change-loop,delivery-models,flow-check,roadmap-loop,version-pin,release-tags,merge-setup,jira-task,project-loop,test-tmp}.test.mjs`;
  `plugins/openspec/skills/openspec-setup/scripts/{github-setup,gh-version,changes-under-way,install-schemas,project-settings,ship-entry}.test.mjs`;
  `plugins/core/skills/review-change/scripts/review-round.test.mjs`; `scripts/check.py`;
  `.github/workflows/ci.yml`; `CLAUDE.md`; `CONTRIBUTING.md`; `plugins/openspec/README.md`;
  `openspec/config.yaml`; `docs/openspec-flow.md`; `docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`;
  `CHANGELOG.md`; `.claude-plugin/marketplace.json`; `plugins/openspec/.claude-plugin/plugin.json`;
  `plugins/core/.claude-plugin/plugin.json`; `docs/catalog.md` if `gen-catalog.py` rewrites it.
- Delete: nothing.

**Estimate.** Optimistic 12 h, likely 18 h, pessimistic 30 h (a split of the largest file, or
inter-file couplings and flakes found by phase 2).

| Component | Hours | Type | Risk |
|---|---|---|---|
| `test-fixtures.mjs`, the 12 importing files (20 import lines), the 8 exports, the two scans (phase 1) | 5 | Migration | Medium |
| Old-command gate run of phase 1 (background, 15 to 45 min wall) | 1 | Testing | Low |
| `scripts/test-suite.mjs` (phase 2) | 3 | Core | Medium |
| `test-suite.test.mjs` T-1 to T-10, T-16, T-12, T-13 (phase 2) | 3.5 | Testing | Medium |
| Fixes of couplings or flakes found by the first run (phase 2) | 2 | Testing | Medium |
| CI step, AC-5 test, `check.py` check and T-11, T-14 (phase 3) | 2 | Integration | Low |
| Texts, header comments, ADR 0026 (phase 3) | 1.5 | Documentation | Low |
| Measurement with the owner, times in the docs, T-15 (phase 4; a split adds 4 to 8 h) | 1.5 | Testing | Medium |
| ADR number, release, pin, AC-2 and AC-6 proofs (phase 5; the AC-2 runs are two whole-suite runs in background, 30 to 90 min wall) | 2.5 | Documentation | Low |

**Risks** (probability × impact, mitigation).

| Risk | P × I | Mitigation |
|---|---|---|
| Hidden coupling between files | MEDIUM × MEDIUM | phase 2 gate; fix in the fixture; product fix stops for the owner |
| Flaky timing under parallel load | MEDIUM × MEDIUM | default-concurrency gates on the loaded worker and CI; widen waits, never assertions |
| `NODE_TEST_CONTEXT` in nested runs | MEDIUM × MEDIUM | stripped by the script; T-10 |
| Moved code escapes the static scans | HIGH × LOW | D-5, T-12, T-13 |
| `pm` or `scenario` closure larger than read | MEDIUM × LOW | the closure rule of D-4; phase 1 gate on the old command |
| Node 22 behaviour on CI | LOW × MEDIUM | the PR's CI runs the script's tests on Node 22 |
| Largest file alone above 10 minutes | LOW × MEDIUM | task 4.2 splits it |
| Whole run above 10 minutes, no file above | LOW × HIGH | stop and ask the owner (D-11) |
| Sibling changes' gate rows and test imports | HIGH × LOW | the refusal names the module; the coordinating session is told |
| AC-5b only after `open-pr` | MEDIUM × MEDIUM | recorded before `enable-auto-merge`; stop above 15 minutes |

**Assumptions** (where the plan breaks if reality differs).

- No test file depends on another beyond the import lines of table C (`guard.test.mjs:12-31`, and
  19 import lines in 11 other files; read at `720d91d`: no other file names another test file's path).
- `node --test <file>` prints `ℹ tests <n>` (spec) and `# tests <n>` (TAP) on Node 22 and 26
  (Node's test runner docs); only the summary counts depend on it.
- `os.availableParallelism()` is 4 on `ubuntu-latest` for a public repository (GitHub's runner
  docs) and 8 on the Avell (`nproc`, 2026-11-23).
- `--test-skip-pattern` exists on CI's Node 22 (added in 22.1.0; `setup-node` resolves `22` to the
  latest 22.x); it is only passed through, and no proof relies on it.
- The TAP reporter prints `ok <n> - <name>` per test, subtests indented, on the worker's Node
  26.13.1 (scratch run, D-10); the AC-2 proof runs only on the worker.
- No test file sets `concurrency` or uses `describe` (none at `720d91d`), so a file's tests still run
  one after another inside its process.
- The `openspec` CLI 2.x is on `PATH` (`CONTRIBUTING.md:76`), as today.
- The coordinating session gives the change an idle place before phase 4 (requirements, Assumptions).

**Dependencies.** ADR 0026 (`decisions.md`; accepted at plan approval, task 3.4; its number
re-checked against `origin/main` in task 5.1).
`test-fixture-cleanup` (archived) delivered `test-tmp.mjs`. `roadmap-sessions-upfront` (archived,
PR 88 and PR 92) is merged at the base, with devkit-openspec 0.33.0 and marketplace 0.37.0.

## Open Questions

None.

## Revisions

- **The base merge of the stack (2026-11-24).** Merging `origin/compozy-driver` (`38953b6`: stage-models, delivery-train and
  compozy-driver) into the branch changed three facts this plan was written on, and the implementation follows the new ones
  (the sections above keep the plan's original counts as its record):
  - **The folders (D-2).** The stack's `guard.test.mjs` imported 28 test files, among them five suites of devkit-compozy under
    `plugins/compozy/skills/compozy-setup/scripts/` (`adoption`, `devkit-kit`, `gen-agents`, `install-kit`, `loop-templates`)
    and three new hook suites (`stage-models`, `delivery-train`, `compozy-driver`). The old command ran all of them, so the
    script reads a fourth folder, `plugins/compozy/skills/compozy-setup/scripts`: 30 files (the 18 of `hooks/`, the 6 of
    `openspec-setup/scripts/`, `review-round`, the 5 of devkit-compozy, `test-suite` included). The other tests of
    `plugins/compozy/` (`screen-demo`, `screen-design`) and those of `plugins/panel/` stay out, as they were out of the old
    command. T-1 and T-2 follow (four folders, 29 files the old command ran).
  - **The skip check (D-7).** The five compozy suites run in the suite now, and `loop-templates.test.mjs` calls `t.skip(...)`
    when the `compozy` CLI is missing. The exemption of `plugins/compozy/` in `scripts/check.py` stays: those skips guard a
    missing program on the machine, not a test that was dropped, and T-11 keeps proving the exemption.
  - **The helpers (D-4).** The stack's test files imported more from test files (`fakeCompozy`, `underOwnTmp`, `simGitHub`,
    `proposal`, and from `change-loop.test.mjs` and `roadmap-loop.test.mjs` the helpers `stage-models.test.mjs` uses). They moved
    to `test-fixtures.mjs` with their closures, as D-4 says; the `SET`/`cleanEnv` pair that `change-loop.test.mjs` and
    `roadmap-loop.test.mjs` each held (the same text) is one pair there, `SET_LOOP` and `cleanEnvLoop`, imported `as SET` and
    `as cleanEnv`; `simGitHub` is the stack's version (it has `pr comment`, `pr merge`, `setPr` and `setAutoMerge`).
- **The ADR's number (task 5.1).** The stack took 0022, 0023 and 0024, and a sibling change (`stale-only-on-own-files`) takes 0025
  right before this one, so the ADR is `0026` and every text of this change names it.
- **D-11, task 4.2 reopened (2026-11-24).** The measure on the merged branch (`cbd47bc` plus the 5.3 tick; idle 8-core
  Avell; 30 files, 2915 tests) is 816.6 s, not the 558.7 s of the first decision ("no split"): `change-loop.test.mjs`
  (816.6 s) and `roadmap-loop.test.mjs` (685.9 s) are above 600 s and set the wall clock, and the next files are
  `deliver-check` 495 s, `delivery-train` 373 s, `stage-models` 373 s and `project-loop` 285 s. The seconds of all files add
  to 3827 s, so about 480 s is the best packing on 8 cores, and only a split of the two files meets the target. D-11's rule
  applies as written, with three parts each, cut at `// ----` headings and balanced by the cost of each test in a TAP run of
  the head (about 300, 269 and 263 s for `change-loop`; 254, 226 and 229 s for `roadmap-loop`):
  - `change-loop.test.mjs` keeps the history of the original (`git log --follow`) and the loop, its commands and its locks;
    `change-loop-compozy.test.mjs` takes the command and the wiring, the skill and the documents, stage-roles and the
    compozy driver; `change-loop-remote.test.mjs` takes the remote worker, the Jira entry, the budget, change-state and the
    held state of the upfront sessions. `roadmap-loop.test.mjs` keeps the pure core, the commands and the locks;
    `roadmap-loop-followups.test.mjs` takes the skill, the documents, the followups and the roadmap on CompozyOS (with the
    first half of the upfront sessions); `roadmap-loop-upfront.test.mjs` takes the check, the second half of the upfront
    sessions, the remote worker and change-state.
  - What a part shares with another is in `change-loop-fixtures.mjs` and `roadmap-loop-fixtures.mjs` (D-4's rules: no test, no
    folder, spawn or git call at import; the two hold only builders, paths and constants, and import what they use). A helper
    only one part uses lives in that part. The fixtures that the tests make are made by each test or part as before: none is
    made at module level. The git identity that `change-loop.test.mjs` put in the environment for the whole file
    (`IDENT`) is set by each of its three parts, so every test runs with the environment it had.
  - The suite goes from 30 to 34 files. T-1 and T-2 count the 29 files the old command ran, which still exist (the two
    names are the first parts), so they do not change. No test is renamed and no assertion changes; the only edit inside a
    test is the exemption of the test that scans the repository for `/conduct` (`change-loop retire: ...`), whose `records`
    list names the file that holds the test (now `change-loop-compozy.test.mjs`).
  - The proof is D-10's, per split file (4.2): the sorted titles of the original's `test(` and `t.test(` calls, with the titles
    of the tests that enclose them, against the same list over the three parts, and the owner's measure again (4.1's command).
    The checks that named a split file for a test (the AC-4 symlink run of D-11, tasks 2.4, 5.1, 5.2 and 5.3) name the part that
    holds it now.
