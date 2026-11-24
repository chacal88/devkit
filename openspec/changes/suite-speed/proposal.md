<!-- devkit-stage proposal result=passed attempt=1 commit=720d91d3aeedc351af462f17a68b2fa680f444af -->
# Proposal

Change: `suite-speed` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, ADR 0026; the number holds only while 0022 is the next
free ADR number on `origin/main` at the last merge before review, `tasks.md` 5.1). Base: `720d91d`. Roadmap line `suite-speed`
of `openspec/roadmap.md` (after: roadmap-sessions-upfront).

## Why

The repository's one test command, `node --test plugins/openspec/hooks/guard.test.mjs`, loads 20
other test files into the guard's process through `import` lines, so Node runs about 2356 tests in
one process nearly in series: 13 minutes on an idle machine, about 43 on a loaded one. Every
evidence run, every merge of `main` during delivery and every CI run pays it. The owner set the
target in the grill on 2026-11-23: at most 10 minutes on an idle 8-core machine.

## What Changes

- **One script runs the suite** (ADR 0026 decision 1): `node scripts/test-suite.mjs` runs every
  `*.test.mjs` under `plugins/openspec/hooks/`, `plugins/openspec/skills/openspec-setup/scripts/`
  and `plugins/core/skills/review-change/scripts/` (the 21 files the old command runs today), each
  in a `node --test` process of its own, as many at once as the machine has cores (`--concurrency=<n>`
  lowers it), the largest files first. File arguments run a subset; `--test-name-pattern=` and
  `--test-skip-pattern=` pass through. It prints each file's output as one block and a summary
  with each file's duration, and exits non-zero when any test fails.
- **Each file gets its own empty `TMPDIR`** (decision 4), made by the script under the real path
  of the temporary root (`fs.realpathSync`); a file that leaves anything there fails, named with
  what it left. This replaces CI's step `Hook tests left nothing in TMPDIR`. The three
  `test-tmp.mjs` copies do not change.
- **No test file imports another** (decision 3): the 24 names other test files import today move
  to `plugins/openspec/hooks/test-fixtures.mjs`, a module with no test; the 8 exported names no
  other file imports stop being exported. `guard.test.mjs` loses its 19 aggregator imports and keeps
  only its own tests. The script refuses, before running anything, a `*.test.mjs` under `plugins/`
  that imports another, naming the file, the line and the helper module.
- **`scripts/check.py` refuses a skipped test**: a new `skip`, `only` or `todo` in a `*.test.mjs`
  of the suite (AC-5c).
- **CI's `check` job** runs `node scripts/test-suite.mjs` in one step (job id `check` unchanged,
  ADR 0002, ADR 0003); `test-tmp.test.mjs` pins it in place of the two old steps.
- **Docs**: `CLAUDE.md`, `CONTRIBUTING.md`, `plugins/openspec/README.md`, `openspec/config.yaml`
  (its test command and the 0026 entry of its ADRs line), `docs/openspec-flow.md` line 318 and the
  header comments of 17 test files name the new command; `CLAUDE.md` and `CONTRIBUTING.md` state the
  measured time instead of "13 to 21 minutes" and "about 13 minutes".
- **Measurement, late**: the owner runs the command on the idle 8-core worker once the coordinating
  session gives the change a place; a file whose own run passes 10 minutes is split by its section
  headings, with no test renamed.
- **BREAKING (repository contract)**: after the merge, `node --test plugins/openspec/hooks/guard.test.mjs`
  runs only the guard's own tests. Gate rows of other open changes that quote it run less; the
  coordinating session is told at the merge (ADR 0026, Consequences).

Non-goals: everything under "Out of scope" in `requirements.md` (the compozy and panel tests,
faster individual tests, CI caching, a newer Node or another runner, rewriting other changes' gate
rows, timing before the change has its place). The panel's `commandLabel` does not change: it labels
`node scripts/test-suite.mjs` as `test-suite`.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

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

Exit criteria: every phase gate of `tasks.md` green; `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
`openspec validate suite-speed --strict` pass; on the pull request, the `check` job runs the one
step and is green.

## Capabilities

None. The change alters how this repository runs its own tests, one CI step and the docs that quote
the command; no behaviour of a shipped hook, skill, agent or schema changes (the
`stage-deliverables` requirement that the test runner runs a project's declared `devkit.tests.unit`
command is untouched), so `.openspec.yaml` sets `skip_specs: true`, as `test-fixture-cleanup` did.

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- devkit-openspec (patch): `hooks/test-fixtures.mjs` and `hooks/test-suite.test.mjs` (new); the
  test files of `hooks/` and `skills/openspec-setup/scripts/` (imports, header comments, the
  exports); `hooks/test-tmp.test.mjs` (the CI test and the scan scope); `README.md`.
- devkit-core (patch): the header comment of `skills/review-change/scripts/review-round.test.mjs`.
- Repository: `scripts/test-suite.mjs` (new), `scripts/check.py`, `.github/workflows/ci.yml`,
  `CLAUDE.md`, `CONTRIBUTING.md`, `openspec/config.yaml`, `docs/openspec-flow.md` (line 318 and the
  CI pin at the release), `docs/adr/0026-*.md` (accepted), `CHANGELOG.md`,
  `.claude-plugin/marketplace.json`.
- Unchanged: devkit-compozy (its `test-tmp.mjs` copy stays byte-identical), devkit-panel, the
  `devkit.tests.*` settings of projects (ADR 0010).
- Runtime: the suite's time becomes about that of its slowest file plus the queue; CI's 4-core
  runner runs 4 files at once.

**Dependencies.** `roadmap-sessions-upfront` (archived, PR 88 and 92) is merged at the base.
Nothing this change uses is still under way.

**Decisions cited.** ADR 0026 (proposed in `decisions.md`; this plan follows its six decisions;
accepted at plan approval; renumbered by task 5.1 if a sibling change takes 0022 on `origin/main`
first). ADR 0002 and ADR 0003 (the ruleset requires the `check` job; its id is
kept). ADR 0004 (each pack carries its own helpers: `test-fixtures.mjs` is in devkit-openspec, and
the core test imports nothing from it). ADR 0010 (a project's `devkit.tests.*` commands are not this
command). ADR 0012 decision 4 (`test-fixtures.mjs` is not a test file by
`deliver-check.mjs#isTestFile`, so a commit to it stales every review, as `test-tmp.mjs` does).

**Open decisions inherited.** None: no point of `docs/coordination-design.md` "Open points" is
touched.

**Flagged for the owner at plan approval.**

- AC-5b reads a fact that exists only after `open-pr` (the PR's own `check` run), while
  `CONTRIBUTING.md` says a criterion states what can be proven before the PR. The plan records the
  AC-5b row after the first `check` run and before `enable-auto-merge` (`tasks.md`, Workflow
  follow-up), and stops for the owner when the job passes 15 minutes. `deliver-check` reads the ids
  `AC-5b` and `AC-5c` as `AC-5` (its id pattern is `AC-\d+`), so the pre-PR rows of AC-5 and AC-5c
  carry the item.
- AC-2 at "the same commit": after this change the old command runs only the guard's tests, so the
  comparison is the old command at the plan's base (the merge base with `origin/main` the branch
  holds) against the new command at the head, less the tests this change adds (every one named
  `suite-speed ...`). Their difference must be empty. The names come from two full runs with the TAP
  reporter (`design.md` D-10): Node 26 reports no name of a test a skip or name filter excludes, so
  no cheap listing exists. The two runs take about as long as two whole-suite runs (the base one
  13 to 45 minutes on the worker); the conducting session runs them in background at task 5.3.
- ADR 0026 decision 3 says every exported name moves; 8 exports no other file imports (among them
  `packV2`, a module-level copy of the whole pack) stop being exported instead of moving, so the
  module makes nothing at import. No test file exports a name afterwards.
- AC-5c "under `plugins/`": the check covers every `*.test.mjs` under `plugins/` except
  `plugins/compozy/`, whose five `skip`s are guards for a missing `compozy` CLI and whose tests are
  outside this suite (ADR 0026 decision 6).
- AC-7's exemptions gain `docs/adr/`: ADR 0026's Context quotes the old command as the state it
  replaces.
- `requirements.md` says `guard.test.mjs` starts with 22 test imports; at `720d91d` it has 20
  (lines 12 to 31), and the old command runs 21 files with its own.
