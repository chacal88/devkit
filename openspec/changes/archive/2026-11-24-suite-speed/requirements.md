<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> the whole suite takes about 43 minutes (2356 tests, 40k lines under plugins/openspec/hooks, most of it tests) because `plugins/openspec/hooks/guard.test.mjs` imports every test file into one process and Node runs them nearly in series. Run the test files directly and in parallel (`node --test plugins/openspec/hooks/*.test.mjs`), each with its own `TMPDIR` (the "leaves no temporary folder" tests compare the whole folder), then change the test command in CLAUDE.md, CONTRIBUTING.md, docs/openspec-flow.md and the CI snippet; keep one command that runs everything. Asked by the owner on 2026-11-23 after 43-minute runs on a loaded machine.

## Requirements grill: suite-speed

Classification: domain=process type=feature flags=[contract] (strict-assumed; the repository's test command is a contract that CLAUDE.md, CONTRIBUTING.md, CI, a test and open changes' gate rows quote; no ADR covers tests or `TMPDIR`, so there is no collision)

Facts read from the code on 2026-11-23, before the questions:

- `plugins/openspec/hooks/guard.test.mjs` (1740 lines of its own tests) starts with 22 `import './<file>.test.mjs'` lines; Node runs the imported tests in its one process.
- Eleven test files import helpers from other test files (`plugins/openspec/hooks/deliver-check.test.mjs` exports 19 names, `conduct-check.test.mjs`, `change-loop.test.mjs`, `release-merge.test.mjs` and `delivery-models.test.mjs` export the rest). An import of a test file registers its tests again, so running those files directly would run `deliver-check.test.mjs` once per importer.
- The largest files are `plugins/openspec/hooks/change-loop.test.mjs` (6189 lines), `deliver-check.test.mjs` (5621) and `roadmap-loop.test.mjs` (5362): a run by file cannot finish before the largest file does.
- Temporary folders already go through `plugins/openspec/hooks/test-tmp.mjs` (three byte-identical copies, in `plugins/openspec/hooks/`, `plugins/core/skills/review-change/scripts/` and `plugins/compozy/skills/`), read at call time through `tmpRoot()`.
- `.github/workflows/ci.yml` runs `node --test plugins/openspec/hooks/guard.test.mjs` with `TMPDIR: ${{ runner.temp }}/hook-tests-tmp` and a next step, `Hook tests left nothing in TMPDIR`; `plugins/openspec/hooks/test-tmp.test.mjs` pins both steps by their text.
- The command is quoted in `CLAUDE.md` (with "13 to 21 minutes"), `CONTRIBUTING.md` (step 4, "about 13 minutes") and `plugins/openspec/README.md` (line 73); `docs/openspec-flow.md` only shows `npm test` as an example of a project's `commands.unit`. Header comments of the test files and of the openspec-setup scripts' tests quote it too.
- `plugins/panel/hooks/report.test.tsx` and `plugins/panel/hooks/panel.test.tsx` use the old command as sample text; `plugins/panel/hooks/detail.ts` labels a `node --test <file>` gate by the file's name.

### Questions asked

1. [end effect] What is the time target of the whole suite? → The owner (typed in the session, 2026-11-23): "Até 10 min", that is, at most 10 minutes on an idle 8-core machine; if the largest file alone passes it, the plan splits that file.

## Assumptions

<!-- Each confirmed by the owner or recorded for the owner to correct; plan approval is the last check. -->
- The one command that runs everything is a single `node --test` call over the same set of files that `plugins/openspec/hooks/guard.test.mjs` runs today (the `*.test.mjs` under `plugins/openspec/hooks/`, `plugins/openspec/skills/openspec-setup/scripts/` and `plugins/core/skills/review-change/scripts/`), with the files given as quoted globs so Node expands them; Node starts one process per file and runs several at once. AMBIGUOUS: (a) one glob per folder in the command | (b) a small script at `scripts/` that lists the files and calls `node --test`; the planner resolves, and the choice must work with the Node 22 of CI's `check` job.
- The tests of `plugins/compozy/` and `plugins/panel/` are not part of the one command: today's suite does not run them, and the panel's run through `claude plugin test` is unchanged.
- No test file imports another test file. Every name a test file exports today moves to a module that holds no test (for example `plugins/openspec/hooks/test-fixtures.mjs`; the planner names it), and the files that imported it import the module. `guard.test.mjs` keeps only its own tests.
- Each test file runs with its own empty `TMPDIR`, given by the helper the file already imports (`plugins/openspec/hooks/test-tmp.mjs` and its two byte-identical copies) or by the command, whichever the design picks; the path is a real path (`fs.realpathSync`), so the change-budget test that compares paths passes on macOS. A file that leaves anything in its `TMPDIR` fails, and its name is in the failure message; this replaces CI's step `Hook tests left nothing in TMPDIR`.
- A test run by file is not weaker than today: the list of test names the command reports after the change equals the list `node --test plugins/openspec/hooks/guard.test.mjs` reports at the same commit before it (none lost, none counted twice), recorded in `evidence.md`.
- `plugins/openspec/hooks/guard.test.mjs` stays as the file of the guard's own tests. The gate rows already written in other open changes' `tasks.md` (`node --test plugins/openspec/hooks/guard.test.mjs`) then run only those tests: the coordinating session is told at the merge, and each such change's next plan or evidence takes the new command. A test file another open change adds that imports from `./deliver-check.test.mjs` (or another test file) fails loudly after it merges `main`, with a message that names the helper module.
- The speed work does not change what a test asserts: tests change only where they pin the old command or text (`plugins/openspec/hooks/test-tmp.test.mjs` for the CI steps, the sample commands of the panel tests stay as they are) or where a helper moves out of them. Before any test is changed, the plan names its invariant, the layer that owns it and the suite it lives in (CLAUDE.md working rule).
- The new command and the measured time replace "13 to 21 minutes" and "about 13 minutes" in `CLAUDE.md` and `CONTRIBUTING.md`, the command in `plugins/openspec/README.md` and in the header comments of the test files, and CI's step `Hook tests`; `docs/openspec-flow.md` is searched and changed only if it names the guard command (it names only `npm test` as an example today).
- The measured time is taken only after the coordinating session gives this change a place on a machine with no other load, in the evidence stage; nothing is timed while the plan is written.
- The panel's label for a gate (`plugins/panel/hooks/detail.ts`, `commandLabel`) is left as it is: the new command is chosen so that the label it gives is readable (a script name, not a glob), or the plan names the one-line change to it.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `one-command`: one command, written in `CLAUDE.md`, `CONTRIBUTING.md` and CI, runs every test file that `plugins/openspec/hooks/guard.test.mjs` runs today, plus guard's own tests, each file in a process of its own, with several files running at the same time.
- AC-2 `same-tests`: the names of the tests the new command reports equal the names reported by the old command at the same commit: none missing, none repeated; `evidence.md` holds both lists' counts and their difference (empty).
- AC-3 `no-test-imports`: no `*.test.mjs` under `plugins/` imports another `*.test.mjs`, and a check refuses one that does, naming the file and line.
- AC-4 `own-tmpdir`: each file runs with its own empty `TMPDIR` whose path is a real path; a test file that leaves a folder or file in it fails, and the output names that file; with `TMPDIR` set to a symlink to a folder, the change-budget test that compares paths passes.
- AC-5 `time-target`: on an idle 8-core machine the command finishes in at most 10 minutes, measured and recorded in `evidence.md` with the machine's core count and load; when the largest file alone would pass 10 minutes, it is split into files that stay under it.
- AC-5b `ci-time-target`: CI's `check` job on `ubuntu-latest` finishes in at most 15 minutes with the new command, read from a real run of the change's pull request and recorded in `evidence.md` with the job's duration (relayed by the coordinating session under the owner's delegation, 2026-11-23).
- AC-5c `no-test-dropped`: the target is reached without removing, skipping (`skip`, `todo`, `only`) or weakening any test; `scripts/check.py` or a test refuses a new `skip`/`only` in a `*.test.mjs` under `plugins/`.
- AC-6 `red-stays-red`: a failing test in any file makes the command exit non-zero and print that test's name; one test made to fail on purpose in a scratch copy proves it in `evidence.md`.
- AC-7 `ci-green-and-quoted`: CI's `check` job on `ubuntu-latest` runs the new command in one step and is green; `plugins/openspec/hooks/test-tmp.test.mjs` pins that step in place of the old two; no file of the repository outside `openspec/changes/archive/`, `CHANGELOG.md`, the panel's sample texts and the open changes' folders names `guard.test.mjs` as the command that runs every test.
- AC-8 `docs-times-true`: `CLAUDE.md` and `CONTRIBUTING.md` state the measured time of AC-5, not "13 to 21 minutes".

## Out of scope

- The tests of `plugins/compozy/` and `plugins/panel/`, and any change to how the panel's tests run.
- Making individual tests faster, caching in CI, a newer Node, or a different test runner; only the parallel run by file and the file split of AC-5 are in scope.
- Rewriting the gate rows of other open changes' `tasks.md`; each takes the new command in its own plan.
- A timing run before the change has its place on a machine with no other load.
