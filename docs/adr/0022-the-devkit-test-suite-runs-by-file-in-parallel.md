# ADR 0022: The devkit test suite runs by file in parallel, from one script, each file in its own temporary folder

- Status: accepted
- Accepted by: the owner, on 2026-11-23, in the approval of the plan of change suite-speed (openspec/changes/suite-speed/approval.md)
- Date: 2026-11-23
- Change: suite-speed

## Context

The repository's test command, `node --test plugins/openspec/hooks/guard.test.mjs`, is a contract:
`CLAUDE.md`, `CONTRIBUTING.md`, `plugins/openspec/README.md`, CI's `check` job (which ADR 0002 and
ADR 0003 require on every pull request), `plugins/openspec/hooks/test-tmp.test.mjs` and the gate
rows of open changes' `tasks.md` all quote it. `guard.test.mjs` imports 22 other test files, so Node
runs about 2356 tests in one process, nearly in series: about 43 minutes on a loaded machine.
Eleven test files import helpers from other test files, which would register those files' tests
once per importer if the files ran on their own. CI runs the suite with one `TMPDIR` and a next step
checks that nothing was left in it; the tests that check "leaves no temporary folder" compare the
whole folder, so files running at the same time in one folder would see each other's folders. The
owner set the target in the grill of `suite-speed` on 2026-11-23: at most 10 minutes on an idle
8-core machine. No record covers the test suite, `TMPDIR` or how tests share code; ADR 0010's test
commands are a devkit project's `devkit.tests.*` settings, which this change leaves as they are.

## Decision

1. The repository's one test command is a Node script under `scripts/` (the design names it) run as
   `node scripts/<name>.mjs`. It runs the `*.test.mjs` files that `guard.test.mjs` runs today (under
   `plugins/openspec/hooks/`, `plugins/openspec/skills/openspec-setup/scripts/` and
   `plugins/core/skills/review-change/scripts/`), each file in a process of its own and several at
   once, through Node's own test runner on the Node 22 of CI's `check` job. It exits non-zero when any
   test fails, and the failing test's name is in its output. This command replaces the old one in
   `CLAUDE.md`, `CONTRIBUTING.md`, `plugins/openspec/README.md`, the test files' header comments and
   CI's `check` job, which runs it in one step.
2. A script, not a command of quoted globs: the file list lives in one place that CI, the docs and
   the gate rows quote by one short name; the panel labels a `node <script>` gate by the script's
   name (`commandLabel` in `plugins/panel/hooks/detail.ts`), where a glob would give an unreadable
   label; and the script is where the checks of decisions 3 and 4 run, before and after the files.
3. No test file imports another test file. Every name a test file exports moves to a module that
   holds no test, and the importers import that module. A check refuses a `*.test.mjs` under
   `plugins/` that imports another `*.test.mjs`, naming the file and the line. `guard.test.mjs` keeps
   only the guard's own tests.
4. Each test file runs with its own empty `TMPDIR`, a real path (`fs.realpathSync`), and a file
   that leaves a folder or a file in it fails with the file's name in the output; this replaces CI's
   step `Hook tests left nothing in TMPDIR`. Whether that folder is made by the script or by the
   test-tmp helper the files already import (`plugins/openspec/hooks/test-tmp.mjs` and its two
   byte-identical copies) is left to the design, which shows it works under Node 22's runner.
5. The suite's tests are the same as before: the test names the new command reports equal those the
   old command reports at the same commit, none lost and none counted twice. A test file whose run
   alone passes the 10-minute target is split into files that stay under it.
6. The tests of `plugins/compozy/` and `plugins/panel/` stay out of this command, as they are out of
   today's suite.

## Consequences

- Positive: the suite's time becomes about that of its largest file instead of the sum of all files;
  a failure names its file; temporary folders cannot collide between files; the command the docs and
  CI quote is one short line, and adding a test file changes only the script's list or globs.
- Negative: gate rows already written in other open changes (`node --test
  plugins/openspec/hooks/guard.test.mjs`) run only the guard's own tests after this change merges
  (Mitigated: the coordinating session is told at the merge, and each such change's next plan or
  evidence takes the new command).
- Negative: a test file another open change adds that imports from a test file fails after it
  merges `main` (Mitigated: the check of decision 3 names the helper module to import instead).
- Negative: files running at once compete for cores and memory, so a loaded machine gains less
  (Mitigated: the runner's concurrency follows the core count; the time is measured only on a
  machine with no other load).
- Neutral: the panel's sample texts that quote the old command stay as sample text.

## Alternatives considered

- Keep `guard.test.mjs` as the aggregator and only raise its concurrency: rejected, because the
  imported files share one process, one `TMPDIR` and one event loop, so tests that compare the whole
  temporary folder collide and CPU-bound tests still run in series.
- A command of quoted globs, one per folder (`node --test "plugins/openspec/hooks/*.test.mjs" ...`):
  rejected for the label and the one-place reasons of decision 2, and because it gives every file
  the same inherited `TMPDIR` and has no place to run the import check and the leftover check.
- Let a test file keep exporting helpers and have the runner skip its duplicates: rejected, because
  an import still registers the file's tests in the importer's process, so the count of AC-2 could
  not hold without a rule every new file must remember.
- A different test runner or a newer Node: out of scope by the owner's request; Node's own runner
  already runs files in parallel.
