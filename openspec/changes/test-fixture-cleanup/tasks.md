<!-- devkit-stage tasks result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Tasks

Change: `test-fixture-cleanup` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`)

Work only in this change's worktree, on its branch. devkit-lite has no `design.md`: the helper's
contract, the tests' names and the CI text are fixed in "How it is built" below, and the
implementer copies them and makes no design choice. No product script changes (every `*.mjs` under
`plugins/` that is neither a `*.test.mjs` nor a `test-tmp.mjs`); a leftover that only a product
script change would fix stops the phase, and the session asks the owner.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. The gates that prove an empty
`TMPDIR` make their folder with `mkdir` (which fails when it exists, so the folder is fresh) and end
with `rmdir` (which fails when anything is left in it). When such a gate fails, list that folder,
fix the test that left something, and remove that exact folder before running the gate again (never
any other folder, never by age). The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`,
13 to 21 minutes) runs once, in 3.7, as a background command of the tool, never with a shell `&`.
The tests need the `openspec` CLI 2.x on `PATH`. The marketplace check is written
`command claude plugin validate .`, so that a shell function named `claude` is skipped.

Test first in every task that adds a test: write it, see it fail on the code before the task, then
make it pass. Every new test's name starts `test-fixture-cleanup AC-<n> `. Migrating a test file
changes only where its folders are made and the prefixes; every assertion stays as it is. The commit
of each migrated file names the invariant ("fixture location only; assertions unchanged"), the layer
(test fixtures) and the suite (the guard suite, or the file's own command for compozy). Leave no
backup or scratch file in the tree, and end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `helper-removes-on-pass-and-fail` | 1.1, 1.2, 1.4 |
| AC-2 | `sweep-at-run-end` | 1.1, 1.2, 1.4, 2.2 |
| AC-3 | `no-raw-temp-in-tests` | 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 |
| AC-4 | `helper-copies-identical` | 1.1, 1.3, 1.4 |
| AC-5 | `ci-empty-tmpdir` | 4.1, 4.4 |
| AC-6 | `all-files-migrated` | 1.2, 2.1, 2.2, 2.3, 2.4, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7 |

## How it is built

**The helper, `test-tmp.mjs`.** One module, the same bytes at `plugins/openspec/hooks/test-tmp.mjs`,
`plugins/core/skills/review-change/scripts/test-tmp.mjs` and `plugins/compozy/skills/test-tmp.mjs`.
It imports only node built-ins (`node:fs`, `node:os`, `node:path`, `node:test`) and exports two
functions:

- `tmpFolder(prefix)` refuses a `prefix` that does not match `/^devkit-[a-z0-9]+(?:-[a-z0-9]+)*-$/`,
  throwing `Error('test-tmp: a prefix starts with devkit- and ends with -: <prefix>')` before it
  makes anything. Otherwise it returns `mkdtempSync(join(tmpdir(), prefix))`, the path as made (a
  caller that needs the real path keeps its own `realpathSync`), and records it with the test under
  way, or with no test when none is under way (a module-level fixture).
- `tmpRoot()` returns `os.tmpdir()` at call time. It is the only way a test reads the temporary root
  (to list it or to use it as a working folder); it makes nothing.

At its top level the module registers `beforeEach((t) => …)` and `afterEach((t) => …)` from
`node:test`. Registered outside any test, they attach to the root test and run around every test of
the process, including the tests of files that never import the helper (they make nothing to
remove). `beforeEach` pushes the test onto a stack of tests under way; `afterEach` pops it and
removes every folder recorded with it, with `rmSync(path, { recursive: true, force: true,
maxRetries: 3 })`. A removal that throws keeps that folder recorded; after trying all of the test's
folders, `afterEach` throws `Error('test-tmp: could not remove <path>: <message>')`, so the test is
reported failed. A test that removes its own folder first is fine (`force`).

The sweep removes every folder still recorded: module-level fixtures, the folders of a test that
never ended, and removals that failed. It never throws; for a folder it cannot remove it writes
`test-tmp: left <path>: <message>` to stderr. It runs on `process.on('exit', …)`, and on
`process.once(sig, …)` for `SIGINT` and `SIGTERM`; after a signal's sweep, when
`process.listenerCount(sig)` is 0, the handler sends the same signal to its own process
(`process.kill(process.pid, sig)`), so the process ends as the signal would have ended it; when
another listener exists (the test runner's), that listener ends the process and the exit sweep finds
nothing left. `SIGKILL` is not covered (`requirements.md`, Out of scope). The guard suite loads the
openspec copy and the core copy in one process: each keeps its own record and removes only its own
folders.

**Prefixes.** A prefix that does not start with `devkit-` gains it in front, nothing else changes:
`inst-`, `pset-`, `ship-entry-`, `review-round-`, `review-round-cli-`, `review-round-five-`,
`screens-check-`, `install-kit-`, `cli-path-`, `cli-wt-`, `roadmap-loop-lock-`, `loop-pathcli-`,
`flow-gate-`, `flow-session-`, every `flow-check-*` and every `change-loop-*` prefix.

**Files written beside a repository.** Three fixtures write a file in the parent of their repository,
which is the temporary root itself: `flow-check.test.mjs` `pinWorld` (the `seen-*.log` marker,
line 1362 at c561553), `change-loop.test.mjs` `pinnedLoop` (the same marker, line 2503) and
`project-loop.test.mjs` `ciEnv` (`event-<sha>.json`, line 290). Each writes the same file name into
a folder of its own from `tmpFolder` instead (`devkit-flow-check-marker-`,
`devkit-change-loop-marker-`, `devkit-project-loop-event-`), still outside the repository so the
repository stays clean.

**The helper's tests, `plugins/openspec/hooks/test-tmp.test.mjs`.** Imported by `guard.test.mjs`
with the line `import './test-tmp.test.mjs'; // test-fixture-cleanup: the temporary-folder helper`
after the `project-loop.test.mjs` import. It makes its own folders with the openspec helper.

- `probe(source, { signal })` writes `source` to `probe.mjs` in a `tmpFolder('devkit-tmp-probe-')`,
  makes the child's temporary root `tmpFolder('devkit-tmp-probe-root-')`, and spawns
  `process.execPath` on `probe.mjs` (not `--test`) with the env `{ ...process.env, TMPDIR: <child
  root>, PROBE_LOG: <a log file in the probe folder> }`. Without `signal` it waits for the exit; with
  one, it waits until the child's stdout holds `READY`, sends the signal and waits for the exit, and
  fails the test after 30 seconds without `READY`. It returns `{ code, signal, log, left }`, where
  `log` is the log file's lines and `left` is `readdirSync(<child root>)`. The probe sources import
  `tmpFolder` from the helper's `pathToFileURL(...).href` and log with `appendFileSync`.
- AC-1: a probe with three tests, `pass` (makes a folder and writes a file in it), `fail` (makes a
  folder, then throws) and `check` (logs `SEEN pass=<exists> fail=<exists>`). Assert: exit code 1,
  the log holds `SEEN pass=false fail=false`, `left` is empty. One more test: `tmpFolder('x-')`
  throws the prefix error and makes nothing.
- AC-2: (a) a probe that makes a folder at module level and a test that logs
  `SEEN module=<exists>`: the log holds `SEEN module=true`, exit code 0, `left` is empty. (b) and (c),
  for `SIGTERM` and for `SIGINT`: a probe that makes a folder at module level and one inside a test,
  logs both with `MADE <path>`, writes `READY` to stdout, then waits forever; after the signal both
  paths are gone and `left` is empty.
- AC-3: `rawTempCalls(root)` walks `<root>/plugins` (`readdirSync(…, { recursive: true })`), skips
  any path with a `node_modules` segment, keeps the files whose name ends `.test.mjs`, and returns,
  sorted, `<path relative to root>:<line>` (1-based) for each line matching
  `/\bmkdtempSync\s*\(|\btmpdir\s*\(/`, comment lines included. Test 1: on the repository root it
  returns `[]` (the message lists what it found). Test 2: on a `tmpFolder` holding
  `plugins/x/fake.test.mjs`, whose lines 2 and 3 are a raw `mkdtempSync` call and a raw `os.tmpdir`
  call, it returns `['plugins/x/fake.test.mjs:2', 'plugins/x/fake.test.mjs:3']`. The source of
  `test-tmp.test.mjs` never holds either call form: the fake lines are built by joining pieces
  (`'mkdtemp' + 'Sync(…)'`), and the regular expression's text does not match itself.
- AC-4: `differingCopies(paths)` returns the paths whose bytes differ from the first one's. Test 1:
  on the three helper paths it returns `[]`. Test 2: on the openspec copy and a copy of it with one
  byte changed, in a `tmpFolder`, it returns the changed copy's path.
- AC-5: `ciSteps(text)` splits `.github/workflows/ci.yml` into steps at each line matching
  `/^\s*- (name|uses):/`, each `{ name, text }`. The test: a step named `Hook tests` exists and its
  text holds `TMPDIR: ${{ runner.temp }}/hook-tests-tmp`, `mkdir "$TMPDIR"` and
  `node --test plugins/openspec/hooks/guard.test.mjs`; the step right after it exists, is named
  `Hook tests left nothing in TMPDIR`, and its text holds `${{ runner.temp }}/hook-tests-tmp`,
  `ls -A` and `exit 1`. A missing step, or no step after `Hook tests`, fails with a message naming
  what is missing.

**The CI steps.** In `.github/workflows/ci.yml`, job `check`, the step `Hook tests` gains
`env:` with `TMPDIR: ${{ runner.temp }}/hook-tests-tmp`, and its `run:` starts with
`mkdir "$TMPDIR"`; its other three lines stay. Right after it comes a new step, named
`Hook tests left nothing in TMPDIR`, with `env:` `HOOK_TMP: ${{ runner.temp }}/hook-tests-tmp` and a
`run:` of two lines: `left="$(ls -A "$HOOK_TMP")"`, then
`if [ -n "$left" ]; then printf 'left in %s:\n%s\n' "$HOOK_TMP" "$left"; exit 1; fi`. The job keeps
its id `check` (ADR 0002, ADR 0003: the ruleset requires it), and the schema step after them still
makes its own `mktemp -d` folder in the runner's default temporary folder.

**Estimate.** Optimistic 7 h, likely 10 h, pessimistic 16 h (a leftover from a child process or a
product script found only by the run of 3.7).

| Deliverable | Hours | Type | Risk |
|---|---|---|---|
| Helper and its tests (phase 1) | 3 | Core, Testing | Medium |
| Seven files outside the hooks folder (phase 2) | 1.5 | Migration | Low |
| Static refusal and eleven files (phase 3), one suite run | 4 | Migration, Testing | Medium |
| CI step, CONTRIBUTING, release (phase 4) | 1.5 | Integration, Documentation | Low |

**Risks.**

- A folder made inside one test and used by a later one is removed when the first test ends
  (probability MEDIUM × impact MEDIUM). No lazily cached fixture exists at c561553 (no `??=` or
  memo in any test file); mitigation: such a fixture is made at module level instead, where only the
  sweep removes it, and the gates of phases 2 and 3 run every migrated file.
- A child process that outlives its test writes into a removed folder or remakes it, or a hook spawned
  without a `TMPDIR` of its own writes its `devkit-stop` records into the temporary root (MEDIUM ×
  LOW). Mitigation: the empty-`TMPDIR` gates of 2.4 and 3.7 show it; the fix is in the test (wait for
  the child, or give the spawn a `TMPDIR` from `tmpFolder`, as the `sandbox()` spawns of
  `change-loop.test.mjs` already do); a fix that needs a product script stops the phase.
- The root-level hooks behave differently on CI's Node 22 than on the planning machine's Node
  26.13.1 (LOW × HIGH). Mitigation: the AC-1 and AC-2 tests run in the `check` job on Node 22, so the
  pull request's CI proves them there.
- `claude plugin validate .` refuses a file directly under `plugins/compozy/skills/` (LOW × MEDIUM).
  Mitigation: 1.3 runs it at once; a refusal stops the phase, and the session asks the owner, since
  the location is the owner's answer.
- Removing about 430,000 inodes during a run adds time to it (LOW × LOW). Mitigation: none needed;
  3.7 records the run's duration in its result.

**Assumptions.** node:test runs the tests of a file one after another (no test file sets
`concurrency` or uses subtests at c561553). Root-level hooks registered by an imported module run
around every test of the process, failing tests included (probed on Node 26.13.1 during planning).
`os.tmpdir()` reads `TMPDIR` at each call (`requirements.md`; `roadmap-loop.test.mjs` `withTmp`
relies on it). The `openspec` CLI writes nothing into `TMPDIR` for `init` and `list` (probed during
planning).

## 1. The helper and its own tests (AC-1, AC-2, AC-4)

- [x] 1.1 Write `plugins/openspec/hooks/test-tmp.test.mjs` with the AC-1, AC-2 and AC-4 tests and
  the `probe` and `differingCopies` functions of "How it is built", and add its import line to
  `plugins/openspec/hooks/guard.test.mjs`. This is the red half: run
  `node --test plugins/openspec/hooks/test-tmp.test.mjs` before 1.2. Check: it fails because
  `./test-tmp.mjs` does not exist.
- [x] 1.2 Write `plugins/openspec/hooks/test-tmp.mjs` as "How it is built" says. Check: the AC-1 and
  AC-2 tests of `test-tmp.test.mjs` pass (`--test-name-pattern="^test-fixture-cleanup AC-[12] "`),
  and the AC-4 tests still fail (the other two copies do not exist yet).
- [x] 1.3 Copy the module, byte for byte, to `plugins/core/skills/review-change/scripts/test-tmp.mjs`
  and `plugins/compozy/skills/test-tmp.mjs`. Check: the AC-4 tests pass, and
  `command claude plugin validate .` passes with the file under `plugins/compozy/skills/`.
- [x] 1.4 Gate: `node --test plugins/openspec/hooks/test-tmp.test.mjs && command claude plugin validate .` green; covers AC-1, AC-2 and AC-4.

## 2. The test files outside the hooks folder (AC-2, AC-6)

- [x] 2.1 Migrate `plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs`,
  `project-settings.test.mjs` and `ship-entry.test.mjs`: each imports `tmpFolder` from
  `../../../hooks/test-tmp.mjs`, makes every folder with it (prefixes `devkit-inst-`,
  `devkit-pset-`, `devkit-ship-entry-`) and drops the `mkdtempSync` and `tmpdir` imports. Check:
  `grep -nE "mkdtempSync\(|tmpdir\(" <the three files>` prints nothing, and
  `node --test` on the three files passes.
- [x] 2.2 Migrate `plugins/core/skills/review-change/scripts/review-round.test.mjs`: import
  `tmpFolder` from `./test-tmp.mjs`; the module-level `scratch` folder stays at module level
  (`devkit-review-round-cli-`), so the sweep removes it (AC-2); the other two prefixes become
  `devkit-review-round-` and `devkit-review-round-five-`. Check: the grep of 2.1 on the file prints
  nothing, and `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` passes.
- [x] 2.3 Migrate the compozy files, each importing `tmpFolder` from `../../test-tmp.mjs`:
  `plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs` (`devkit-screens-check-`);
  `plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs` (`sandbox(t)` makes
  `devkit-install-kit-`, its `t.after` removal line goes, its `t` parameter stays so no call site
  changes, and `rmSync` stays imported only if another line uses it);
  `plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` (the body of `tmp(prefix)`
  becomes `tmpFolder(prefix)`). Check: the grep of 2.1 on the three files prints nothing, and
  `node --test` on each of them passes.
- [x] 2.4 Gate: `mkdir /var/tmp/devkit-test-fixture-cleanup-p2 && env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-p2 node --test plugins/openspec/skills/openspec-setup/scripts/install-schemas.test.mjs plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs plugins/openspec/skills/openspec-setup/scripts/ship-entry.test.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs && rmdir /var/tmp/devkit-test-fixture-cleanup-p2` green; covers AC-2 and AC-6 for these seven files (the compozy ones included, which CI does not run).

## 3. The static refusal and the hook test files (AC-3, AC-6)

- [x] 3.1 Add `rawTempCalls` and the two AC-3 tests of "How it is built" to
  `plugins/openspec/hooks/test-tmp.test.mjs`. This is the red half: run
  `node --test --test-name-pattern="^test-fixture-cleanup AC-3 " plugins/openspec/hooks/test-tmp.test.mjs`.
  Check: the synthetic test passes, and the repository test fails, listing lines of exactly the
  eleven files of 3.2 to 3.5 (the comment at `roadmap-loop.test.mjs` line 1268 included) and none of
  the seven files of phase 2.
- [x] 3.2 Migrate `plugins/openspec/hooks/deliver-check.test.mjs` first, since `gitRepo` and
  `fakeGh` are shared by other files: import `tmpFolder` and `tmpRoot` from `./test-tmp.mjs`, make
  every folder with `tmpFolder` (its prefixes already start with `devkit-`), and read the root with
  `tmpRoot()` in the `makeGh(…)` call and the `devkit-no-such-retro.md` path. Then
  `plugins/openspec/hooks/merge-setup.test.mjs`,
  `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` and
  `plugins/openspec/skills/openspec-setup/scripts/changes-under-way.test.mjs` (the last two import
  from `../../../hooks/test-tmp.mjs`). Check: the grep of 2.1 on the four files prints nothing, and
  the AC-3 repository test no longer lists them.
- [x] 3.3 Migrate `plugins/openspec/hooks/flow-check.test.mjs` (the `flow-check-*`, `flow-gate-` and
  `flow-session-` prefixes gain `devkit-`; `pinWorld` writes its marker into a
  `devkit-flow-check-marker-` folder), `plugins/openspec/hooks/conduct-check.test.mjs`
  (`pinTmpFolders` lists `tmpRoot()`) and `plugins/openspec/hooks/release-rebase.test.mjs` (`pinTmp`
  lists `tmpRoot()`). Check: the grep of 2.1 on the three files prints nothing, and the AC-3
  repository test no longer lists them.
- [x] 3.4 Migrate `plugins/openspec/hooks/change-loop.test.mjs` (every `change-loop-*` prefix and
  `loop-pathcli-` gain `devkit-`; `sandbox()` and `lockDir()` use `tmpFolder`; the two
  `cwd: tmpdir()` calls use `tmpRoot()`; `pinnedLoop` writes its marker into a
  `devkit-change-loop-marker-` folder), `plugins/openspec/hooks/roadmap-loop.test.mjs`
  (`lkSandbox()` makes `devkit-roadmap-loop-lock-`; the comment above `withTmp` says
  "`os.tmpdir` reads TMPDIR at each call" without the call parentheses) and
  `plugins/openspec/hooks/project-loop.test.mjs` (`ciEnv` writes its event file into a
  `devkit-project-loop-event-` folder). Check: the grep of 2.1 on the three files prints nothing,
  and the AC-3 repository test no longer lists them.
- [x] 3.5 Migrate `plugins/openspec/hooks/guard.test.mjs` (`cli-path-` and `cli-wt-` gain
  `devkit-`; `noGitHere()` uses `tmpFolder`; the `devkit-elsewhere` path joins `tmpRoot()`). Check:
  the grep of 2.1 on the file prints nothing, and
  `node --test --test-name-pattern="^test-fixture-cleanup AC-3 " plugins/openspec/hooks/test-tmp.test.mjs`
  passes.
- [x] 3.6 Add the CONTRIBUTING rule: in `CONTRIBUTING.md`, right after the paragraph "A test fixture
  never depends on the branch variables …", a paragraph saying that a test fixture makes every
  temporary folder through its pack's `test-tmp.mjs` (`plugins/openspec/hooks/`,
  `plugins/core/skills/review-change/scripts/`, `plugins/compozy/skills/`; the three copies stay
  byte-identical), with a prefix that starts with `devkit-`; that the helper removes each folder when
  its test ends, passed or failed, and sweeps the rest when the run ends or gets `SIGINT` or
  `SIGTERM`; that a test reads the temporary root only through `tmpRoot()`; and that
  `test-tmp.test.mjs` refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` under
  `plugins/`. Check: `python3 scripts/check.py` passes, and `grep -c "test-tmp.mjs" CONTRIBUTING.md`
  prints at least 1.
- [x] 3.7 Gate: `mkdir /var/tmp/devkit-test-fixture-cleanup-run && env TMPDIR=/var/tmp/devkit-test-fixture-cleanup-run GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && rmdir /var/tmp/devkit-test-fixture-cleanup-run` green (the guard suite as a background command; record its duration); covers AC-3 and AC-6, and AC-1, AC-2 and AC-4 again inside the whole suite.

## 4. CI, release and the final checks (AC-5)

- [x] 4.1 Add `ciSteps` and the AC-5 test of "How it is built" to
  `plugins/openspec/hooks/test-tmp.test.mjs`; see it fail on the current `ci.yml`; then change
  `.github/workflows/ci.yml` as "The CI steps" says. Check:
  `node --test --test-name-pattern="^test-fixture-cleanup AC-5 " plugins/openspec/hooks/test-tmp.test.mjs`
  passes, and `ci.yml` still has the job id `check` and the steps "Catalog is up to date",
  "Names, descriptions, links, language", "Install OpenSpec (the hook tests and the schema step need
  it)" and "Schemas validate against the OpenSpec CLI" unchanged.
- [x] 4.2 Bump devkit-openspec to 0.21.2 in `plugins/openspec/.claude-plugin/plugin.json`,
  devkit-core to 0.9.1 in `plugins/core/.claude-plugin/plugin.json` and devkit-compozy to 0.2.1 in
  `plugins/compozy/.claude-plugin/plugin.json`, the same three in `.claude-plugin/marketplace.json`,
  and the marketplace to 0.25.2. Add a `CHANGELOG.md` section `## 0.25.2 — test fixtures clean up
  after themselves` with one bullet per pack (the helper and its migrated tests) and one for CI (the
  empty-`TMPDIR` step) and `CONTRIBUTING.md`. Check: `python3 scripts/gen-catalog.py --check` passes.
  At delivery the release moved to devkit-openspec 0.21.3, marketplace 0.25.3 and the pin `v0.21.3`:
  main had already released 0.21.2 / 0.25.2 (project-phases-followups, #61); see merge commit 64a9573.
- [x] 4.3 Move the CI pin to the release: the three `v0.21.1` of `docs/openspec-flow.md` (lines 578,
  579 and 588 at c561553) become `v0.21.2`. In the same task change the assertion of "change-loop
  docs: the design records the answers" in `plugins/openspec/hooks/change-loop.test.mjs`
  (`/v0\.21\.1/` becomes `/v0\.21\.2/`, its message names `test-fixture-cleanup: 0.21.2`, and the
  `doesNotMatch` on `/v0\.21\.0/` becomes `/v0\.21\.1/`), naming its invariant ("the CI snippet pins
  the current release"), its layer (documentation test) and its suite (the guard suite) in the commit
  message. Check: `grep -c "v0.21.1" docs/openspec-flow.md` prints 0, and
  `node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs`
  passes.
- [x] 4.4 Gate: `node --test plugins/openspec/hooks/test-tmp.test.mjs && node --test --test-name-pattern="change-loop docs: the design records the answers" plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate test-fixture-cleanup --strict` green; covers AC-5, and AC-1 to AC-4 again.

## Workflow follow-up

- On the pull request, the `check` job runs the hook tests with the empty `TMPDIR` and its new step;
  the evidence cites that run for AC-5.
- After the merge, tag `v0.21.3` on the merge commit and push the tag (`CONTRIBUTING.md`).
- Archive with the retro; the archive ticks the round 17g line of `openspec/roadmap.md`.
- In the projects that use devkit, update devkit-openspec, devkit-core and devkit-compozy, and move
  the pinned `devkit-reviews` workflow to `v0.21.3` through each project's own pull request.
