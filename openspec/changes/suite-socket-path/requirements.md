<!-- devkit-stage requirements result=passed attempt=1 commit=d0966033f95093062e56e0ac7a480db755c0c9c8 -->
# Requirements

## Request

> Fix the devkit test suite on macOS: under the default TMPDIR the suite runner nests each file TMPDIR under realpath(tmpdir())/devkit-suite-<6>/<n>/, so the fake CompozyOS daemon socket path in test-fixtures.mjs daemon() reaches 111 bytes and macOS caps a Unix socket path at 104; 32 compozy tests fail with listen EINVAL. The suite must pass on macOS with the default TMPDIR, keep the leftover check, and keep passing in CI.

## Requirements grill: suite-socket-path

Classification: domain=process type=bug flags=[] (strict-assumed: the change touches only the suite script, its tests and CONTRIBUTING.md; no screen, no boundary, no contract of the product)

Observed on main 6373424 with the default macOS TMPDIR (`/var/folders/b1/<30 chars>/T`, real path `/private/var/folders/b1/<30 chars>/T`, 56 bytes): `node scripts/test-suite.mjs` reports 33 fails. 32 are every test that calls `fakeCompozy(...).daemon(t)` (`compozy-driver.test.mjs` 5, `change-loop-compozy.test.mjs` 12, `roadmap-loop-followups.test.mjs` 15), each with `listen EINVAL: invalid argument /private/var/folders/.../T/devkit-suite-7hdn7E/10/devkit-ch-ehToVA/daemon.sock` (108 bytes). The suite-speed evidence ran with `env TMPDIR=/var/tmp/devkit-suite-speed`, so the default TMPDIR case was never run; CI runs on Linux under `/tmp`.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The socket path a test builds under the suite is `<run root>/<nn>/devkit-ch-XXXXXX/daemon.sock`: the run root plus 32 bytes (`/<nn>` 3, `/devkit-ch-XXXXXX` 17, `/daemon.sock` 12). macOS holds 104 bytes in `sun_path` (103 plus the terminator), Linux 108. Under the default macOS TMPDIR (real path 56 bytes) the run root `<real TMPDIR>/devkit-suite-XXXXXX` is 76 bytes, so the socket path is 108.
- The fix lives in `scripts/test-suite.mjs`, its tests in `plugins/openspec/hooks/test-suite.test.mjs`, and the testing paragraph of `CONTRIBUTING.md`. No product file changes: `plugins/openspec/hooks/compozy-driver.mjs` keeps resolving `$COMPOZY_HOME/daemon.sock`. `plugins/openspec/hooks/test-fixtures.mjs#fakeCompozy` and the three byte-identical `test-tmp.mjs` copies do not change (suite-speed design D-2: the per-file TMPDIR comes from the script).
- The environment's TMPDIR is used as the base of the run root when a socket path under it fits (run root at most 71 bytes, so `env TMPDIR=/var/tmp/x` keeps working as in the suite-speed evidence). Only when it does not fit does the run root go to a short real path, and the script prints one line saying where the run root was made and why. The planner picks the literal short path (a real path such as `/private/tmp` on macOS, `fs.realpathSync('/tmp')`); the fallback is never used when TMPDIR fits.
- When neither the environment's TMPDIR nor the short fallback can hold the run root (not writable, or still too long), the script exits 2 with a usage error naming the folder before any file runs, as its other usage errors do.
- A bare `node --test <file>` run under the default macOS TMPDIR already fits (`/var/folders/<xx>/<30 chars>/T/devkit-ch-XXXXXX/daemon.sock` is 77 bytes) and is not changed; CONTRIBUTING names `node scripts/test-suite.mjs <file>` as the way to run one file.
- ADR 0026 needs no amendment: its decision 4 fixes an empty real-path TMPDIR per file and the leftover check, not where the run root lives (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md:43-47`); the base `realpathSync(tmpdir())` is the archived suite-speed design's choice (`openspec/changes/archive/2026-11-24-suite-speed/design.md:129-131`). The devkit-lite script writes no ADR.
- Every criterion below is proven in this change by its own suite runs on this Mac and in CI; nothing is left for a later change to prove.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `suite-passes-default-tmpdir`: on macOS with the default TMPDIR and no `TMPDIR` override, `node scripts/test-suite.mjs` in a clean checkout of the branch ends with `0 fail` in its summary line and exit 0; the 32 tests that call `fakeCompozy(...).daemon(t)` pass.
- AC-2 `tmpdir-honoured-when-it-fits`: with `env TMPDIR=<path>` whose run root fits (at most 71 bytes as a real path), the run root is made under that path, as today, and no fallback line is printed.
- AC-3 `short-root-when-it-does-not-fit`: under a TMPDIR whose run root would not fit (the default macOS one), the run root is made under the short real path, the script prints one line naming where and why, each file's TMPDIR is still an empty real path under that root, a file that leaves anything there still fails the run with the file's name, and the run root is removed at the end.
- AC-4 `regression-test-pins-the-limit`: a test in `plugins/openspec/hooks/test-suite.test.mjs` runs the script with a TMPDIR whose real path is at least 56 bytes (the default macOS one) and asserts that the per-file TMPDIR a child sees is at most 71 bytes; the test fails on the script as it is before this change and passes after it. The existing tests of the leftover check and of the symlinked TMPDIR keep passing.
- AC-6 `contributing-states-the-rule`: the testing paragraph of `CONTRIBUTING.md` states that the run root is a short real path because a Unix socket path holds 104 bytes on macOS, that the environment's TMPDIR is used when it fits, and that a test that binds a socket does so under its TMPDIR.

CI's `Test suite` step passing on the pull request (Linux, `/tmp`, where TMPDIR fits and the fallback is never taken) is the plan's Workflow follow-up in `tasks.md`, not a criterion: nothing before the pull request exists can prove it (it was the fifth criterion until the delivery check held the change on it; the CI-like local run of AC-2 is its proxy).

## Answered by triage

1. [end effect] What proves done? → `node scripts/test-suite.mjs` ends with `suite: N files, ... 0 fail ...` and exit 0 only when every file passes (source: `scripts/test-suite.mjs:227,302`); CI runs the suite as its one `Test suite` step (source: `.github/workflows/ci.yml:26`, `CONTRIBUTING.md:46`).
2. [project rules] Does shortening the run root require an ADR 0026 amendment? → No: the ADR requires an empty real-path TMPDIR per file and the leftover check, not where the run root lives (source: `docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md:43-47`); `realpathSync(tmpdir())` is the archived design's choice (source: `openspec/changes/archive/2026-11-24-suite-speed/design.md:129-131`).

## Questions asked

1. [edges] When a daemon test leaves its socket behind, must the suite still flag it (socket under the file's TMPDIR, so the run root shortens) or is removal by the helper enough (socket in a short folder outside the file's TMPDIR)? → The suite flags it: everything stays under the file's TMPDIR and the run root moves to a short real path.
2. [end effect] Is a regression test required that goes red when the socket path can exceed 104 bytes again? → Yes (AC-4).
3. [project rules] Should CONTRIBUTING record the rule? → Yes (AC-6).
4. [scope] What happens to a TMPDIR the owner sets? → Honoured when the socket path fits; only when it does not fit does the run root go to the short real path, and the summary says where it went (AC-2, AC-3).

## Escalations

- none

## Out of scope

- Product code (`plugins/openspec/hooks/compozy-driver.mjs`), `test-fixtures.mjs#fakeCompozy` and the `test-tmp.mjs` copies.
- The AC-9 failure of `plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs` on the root checkout: it comes from an uncommitted local edit of `.compozy/config.toml` there, not from the branch.
- A bare `node --test <file>` under a TMPDIR the user sets long enough to break the 81-byte path.
- Temporary files other tools leave in `$TMPDIR` (the GENESI plugin's hooks, other projects' suites).
