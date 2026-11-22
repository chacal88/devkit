<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `test-fixture-cleanup` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the answers relayed by the coordinating session). Round 17g of
`openspec/roadmap.md`.

## Why

The test files of the repository create their fixture folders with `mkdtempSync(join(tmpdir(), …))`
and never remove them. On the owner's Linux worker `/tmp` is a tmpfs with 1,048,576 inodes: one run
of `deliver-check.test.mjs` plus `flow-check.test.mjs` left about 230,000 inodes, the guard suite
about 200,000 more, and three sessions running suites at once filled `/tmp` four times on
2026-11-22. Gates went red for no defect (572 of 994 tests) and the owner approved each cleanup by
hand (`review-writer-prompt` retro, learning 4). Every later change pays the same until the tests
clean up after themselves.

## What Changes

- A helper module `test-tmp.mjs`, one copy per pack with the same bytes:
  `plugins/openspec/hooks/test-tmp.mjs`, `plugins/core/skills/review-change/scripts/test-tmp.mjs`,
  `plugins/compozy/skills/test-tmp.mjs`. It creates a temporary folder under `os.tmpdir()` (read at
  call time) with a prefix that starts with `devkit-`, removes it when the test that made it ends,
  passed or failed, and sweeps what is left (module-level fixtures, a removal that failed) when the
  process exits or gets `SIGINT` or `SIGTERM`.
- The 18 test files that create temporary folders today (the list in `requirements.md`) create them only through their pack's helper. Prefixes that do
  not start with `devkit-` gain it (`change-loop-bare-` becomes `devkit-change-loop-bare-`). Three
  fixtures that write a file beside their repository, directly in the temporary root
  (`flow-check.test.mjs` `pinWorld`, `change-loop.test.mjs` `pinnedLoop`, `project-loop.test.mjs`
  `ciEnv`), write it into a helper folder instead. The tests that only read the temporary root (the
  `devkit-pin-*` listings of `conduct-check.test.mjs` and `release-rebase.test.mjs`, a path in
  `guard.test.mjs`, a working folder in `change-loop.test.mjs`) read it through the helper.
- A new test file, `plugins/openspec/hooks/test-tmp.test.mjs`, imported by `guard.test.mjs`, proves
  the helper (AC-1, AC-2), refuses a raw `mkdtempSync` or `tmpdir()` call in any `*.test.mjs` under
  `plugins/` (AC-3), compares the three copies (AC-4) and reads the CI step (AC-5).
- `.github/workflows/ci.yml`: the "Hook tests" step runs with `TMPDIR` set to a fresh empty folder
  under the runner's temporary folder, and a new step right after it fails when anything is left
  there.
- `CONTRIBUTING.md` states the rule next to the branch-variable rule of the test fixtures. A patch
  release of devkit-openspec, devkit-core and devkit-compozy.

Non-goals: everything under "Out of scope" in `requirements.md` (fixture folders already left on any
machine, how product scripts handle their own temporary folders, the compozy tests in CI, a run
killed with `SIGKILL`). No product script (`*.mjs` that is not a test or the helper) changes; when a
leftover can be fixed only in a product script, the implementation stops and the owner decides.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `helper-removes-on-pass-and-fail` — a folder created through the helper inside a test no longer exists once that test ends, whether the test passed or threw; a test of the helper proves both cases.
- AC-2 `sweep-at-run-end` — folders the helper created outside a test (module-level fixtures) or that a test's own cleanup missed are removed when the file's run ends, and also on `SIGINT` or `SIGTERM`.
- AC-3 `no-raw-temp-in-tests` — a static test in the guard suite fails when any `*.test.mjs` under `plugins/` calls `mkdtempSync` or `tmpdir()` outside the helper modules, naming each offending `file:line`.
- AC-4 `helper-copies-identical` — a test fails when the three helper modules differ in content.
- AC-5 `ci-empty-tmpdir` — the CI hook-test step runs `node --test plugins/openspec/hooks/guard.test.mjs` with `TMPDIR` set to a fresh empty folder, and the next step fails when anything is left in that folder.
- AC-6 `all-files-migrated` — the 18 test files create their temporary folders only through their pack's helper, every suite stays green, and a local run of the guard suite with `TMPDIR` set to a fresh empty folder leaves it empty.

The new `test-tmp.test.mjs` also creates its own folders through the helper.

Exit criteria: every phase gate of `tasks.md` green, then
`node --test plugins/openspec/hooks/guard.test.mjs` (with `TMPDIR` set to a fresh empty folder, as
the gate of phase 3 runs it), `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
`claude plugin validate .` and `openspec validate test-fixture-cleanup --strict`; on the pull
request, the `check` job of `ci.yml` with its new step green.

## Capabilities

None. The change alters how the repository's own tests manage their temporary folders and one CI
step; no behaviour of a shipped hook, skill, agent or schema changes, so `.openspec.yaml` sets
`skip_specs: true`.

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

- devkit-openspec (0.21.1 to 0.21.2): `hooks/test-tmp.mjs` and `hooks/test-tmp.test.mjs` (new); the
  nine hook test files (`guard`, `deliver-check`, `flow-check`, `conduct-check`, `merge-setup`,
  `release-rebase`, `change-loop`, `roadmap-loop`, `project-loop`) and the five
  `skills/openspec-setup/scripts/` test files (`github-setup`, `install-schemas`,
  `changes-under-way`, `project-settings`, `ship-entry`).
- devkit-core (0.9.0 to 0.9.1): `skills/review-change/scripts/test-tmp.mjs` (new) and
  `review-round.test.mjs`.
- devkit-compozy (0.2.0 to 0.2.1): `skills/test-tmp.mjs` (new) and the test files of
  `screen-design/scripts/screens-check`, `compozy-setup/scripts/install-kit` and
  `compozy-setup/scripts/devkit-kit`.
- CI: `.github/workflows/ci.yml` (the `check` job keeps its id, so the ruleset's required check is
  unchanged).
- Docs and release: `CONTRIBUTING.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json` (0.25.1 to
  0.25.2), the three `v0.21.1` pins of `docs/openspec-flow.md` and their assertion in
  `plugins/openspec/hooks/change-loop.test.mjs` ("change-loop docs: the design records the
  answers"); the tag `v0.21.2` after the merge.
- Runtime: each test removes its folders as it ends, so the peak of a run on the worker's temporary
  folder drops from hundreds of thousands of inodes to the folders of the test under way plus the
  module-level fixtures; the removals add some seconds to a run.

**Dependencies.** None open. The `review-writer-prompt` retro (archived 2026-11-22) records the
incident; nothing this change uses is still under way.

**Decisions cited.** ADR 0002 and ADR 0003 (the ruleset requires the `check` job of `ci.yml` and
`devkit-reviews`; the job keeps its id, and the new step is part of it). ADR 0004 (each pack is
installed on its own, which is why each pack carries its own helper copy and no test imports another
pack's). ADR 0012 decision 4 (the reviews check still recomputes at the PR head; the helper modules
are not test files by `deliver-check.mjs#isTestFile`, so a commit that touches one stales every
review, as any source file does). No new ADR: the change records no decision beyond the owner's
answers in `requirements.md`.

**Open decisions inherited.** None: the change touches no point of `docs/coordination-design.md`
"Open points".

**Flagged for the owner at plan approval.**

- `requirements.md` first said "19 files today"; its own list and the repository at
  c56155334749cdc46bad077ba8f53c4bbec5d140 hold 18, and the count is now corrected to 18 there.
- The devkit-lite instruction asks for 1 to 3 acceptance criteria; `requirements.md` has 6, kept as
  confirmed.
- Three of the 18 files write a file directly in the temporary root (see What Changes). Moving those
  files into a helper folder is not named in `requirements.md`; without it AC-5 and AC-6 cannot pass.
