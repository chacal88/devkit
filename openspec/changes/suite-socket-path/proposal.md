<!-- devkit-stage proposal result=passed attempt=1 commit=d0966033f95093062e56e0ac7a480db755c0c9c8 -->
# Proposal

Change: `suite-socket-path` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`; the how is in `design.md`). Plan base: `d096603`.

## Why

On macOS with the default `TMPDIR`, `node scripts/test-suite.mjs` fails 32 tests with `listen EINVAL`:
the script makes its run root under `realpathSync(tmpdir())` (`scripts/test-suite.mjs:268`), so the
fake CompozyOS daemon socket a test binds (`plugins/openspec/hooks/test-fixtures.mjs`, `daemon`, at
`<TMPDIR>/devkit-ch-XXXXXX/daemon.sock`) ends up longer than the 104 bytes macOS allows for a Unix
socket path (108 bytes on this machine). CI (Linux, `/tmp`) and the suite-speed evidence (run with
`env TMPDIR=/var/tmp/...`) never took that path, so the repository's one test command is red on a
default Mac.

## What Changes

- `scripts/test-suite.mjs` chooses where to make its run root. It uses the environment's `TMPDIR` (as a
  real path) when the run root fits (at most 71 bytes for a suite of up to 100 files, so the longest socket path a test binds stays at or below 103 bytes).
  Otherwise it uses the real path of `/tmp` (`/private/tmp` on macOS) and prints one `run root:` line
  saying where and why. When neither folder can hold the run root, the script exits 2 with a usage error that names both folders, before any file runs.
  Each file still gets an empty real-path `TMPDIR` under the run root, the leftover check is
  unchanged, and the run root is still removed at the end.
- The script exports the limit and the check (one helper for the arithmetic), and the tests use them.
- `plugins/openspec/hooks/test-suite.test.mjs` gains the tests for each branch, plus a
  regression test that binds a real Unix socket under a long `TMPDIR` (AC-4). The tests that place a run root
  under a folder the test owns get shorter prefixes, so the "fits" branch stays the one they exercise.
- `CONTRIBUTING.md` (the testing paragraph) states the rule.
- Release: devkit-openspec and the marketplace get a patch version and a `CHANGELOG.md` section,
  because a file of the openspec pack changes (CONTRIBUTING.md, "Bump the `version` of every pack
  you changed"). The CI pin in `docs/openspec-flow.md` moves with it.

Non-goals: no product file changes (`compozy-driver.mjs`, the hooks, the skills); `test-fixtures.mjs`
and the three `test-tmp.mjs` copies stay as they are; a bare `node --test <file>` is not changed; temp
files that other tools leave are not cleaned. No ADR: ADR 0026 decision 4 is kept as it is
(`requirements.md`, Assumptions).

## Acceptance criteria

- AC-1 `suite-passes-default-tmpdir`: on macOS with the default TMPDIR and no `TMPDIR` override, `node scripts/test-suite.mjs` in a clean checkout of the branch ends with `0 fail` in its summary line and exit 0; the 32 tests that call `fakeCompozy(...).daemon(t)` pass.
- AC-2 `tmpdir-honoured-when-it-fits`: with `env TMPDIR=<path>` whose run root fits (at most 71 bytes as a real path), the run root is made under that path, as today, and no fallback line is printed.
- AC-3 `short-root-when-it-does-not-fit`: under a TMPDIR whose run root would not fit (the default macOS one), the run root is made under the short real path, the script prints one line naming where and why, each file's TMPDIR is still an empty real path under that root, a file that leaves anything there still fails the run with the file's name, and the run root is removed at the end.
- AC-4 `regression-test-pins-the-limit`: a test in `plugins/openspec/hooks/test-suite.test.mjs` runs the script with a TMPDIR whose real path is at least 60 bytes and asserts that the per-file TMPDIR a child sees is at most 71 bytes; the test fails on the script as it is before this change and passes after it. The existing tests of the leftover check and of the symlinked TMPDIR keep passing.
- AC-5 `ci-stays-green`: CI's `Test suite` step passes on the pull request (Linux, `/tmp`), where TMPDIR fits and the fallback is never taken.
- AC-6 `contributing-states-the-rule`: the testing paragraph of `CONTRIBUTING.md` states that the run root is a short real path because a Unix socket path holds 104 bytes on macOS, that the environment's TMPDIR is used when it fits, and that a test that binds a socket does so under its TMPDIR.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The suite script is repository tooling with no capability spec (`openspec list --specs` has
none for it); this fix restores what ADR 0026 decision 4 already requires on every machine, so the
change sets `skip_specs: true`.

## Impact

- Repository tooling: `scripts/test-suite.mjs` (run root choice, new exports).
- devkit-openspec pack: `plugins/openspec/hooks/test-suite.test.mjs` (tests only; no hook behaviour).
- Docs: `CONTRIBUTING.md` (testing paragraph), `CHANGELOG.md`, the CI pin in `docs/openspec-flow.md`.
- Release files: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`.
- CI: none; the `Test suite` step stays as it is and takes the "fits" branch.

Exit criteria: `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` green; the whole
`node scripts/test-suite.mjs && python3 scripts/check.py` green on this Mac with the default `TMPDIR`;
CI green on the pull request.

Decisions cited: ADR 0026 (decision 4 kept). Inherited open decisions: none.
