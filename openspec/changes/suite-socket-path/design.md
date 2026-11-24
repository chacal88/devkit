# Design: the suite's run root fits a Unix socket path

Change: `suite-socket-path` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`). Plan base: `d096603`. devkit-lite has no design stage; this file
holds the how that `tasks.md` executes, so the implementer makes no design choice.

## The numbers

| Piece | Bytes | Source |
| --- | --- | --- |
| Longest Unix socket path both platforms accept | 103 | macOS `sun_path` holds 104 with the terminator; Linux 108 |
| `/devkit-ch-XXXXXX` + `/daemon.sock` (the deepest socket a suite test binds) | 17 + 12 = 29 | `plugins/openspec/hooks/test-fixtures.mjs` (`tmpFolder('devkit-ch-')` line 607, `daemon` line 622) |
| `/<nn>`, the file's place (`runFile`, line 141) | 3 while the suite has at most 100 files (38 today) | `String(place).padStart(2, '0')` |
| Run root limit | 103 − 29 − 3 = 71 | |
| `/devkit-suite-XXXXXX`, the run root's own name | 20 | `mkdtempSync(... 'devkit-suite-')`, line 268 |
| Largest base that fits | 71 − 20 = 51 | |

Measured at plan time on this Mac: `realpathSync(tmpdir())` is
`/private/var/folders/b1/<30 chars>/T`, 56 bytes, so the run root is 76 bytes and the socket path 108
(the failing path quoted in `requirements.md`, recomputed with this machine's folder, is 108 bytes;
the grill first wrote 60/79/111, corrected to 56/76/108 in `requirements.md` at plan time; 108 is over 103 either way). `realpathSync('/tmp')` is
`/private/tmp` (12 bytes), so a run root there is 32 bytes and each file's `TMPDIR` 35. On Linux CI it
is `/tmp`: run root 24, each file 27.

## D-1 The run root: TMPDIR when it fits, else the real `/tmp`, else a usage error

New exports of `scripts/test-suite.mjs`, the one helper for this arithmetic (the tests import it; no
copy of these numbers in a test):

- `SOCKET_PATH_MAX_BYTES = 103`, `SOCKET_TAIL_BYTES = 29`, `RUN_ROOT_NAME_BYTES = 20`,
  `SHORT_TMP = '/tmp'`, each with a one-line comment that gives its source (the table above).
- `runRootLimit(fileCount)`: `SOCKET_PATH_MAX_BYTES - SOCKET_TAIL_BYTES - (1 + Math.max(2, String(fileCount - 1).length))`.
  71 for 1 to 100 files, 70 from 101. The place width is computed, so a suite that grows past 100 files
  cannot quietly push a socket path over again.
- `runRootFits(realBase, fileCount)`: `Buffer.byteLength(realBase) + RUN_ROOT_NAME_BYTES <= runRootLimit(fileCount)`.
  Bytes, not characters (a non-ASCII folder name counts its UTF-8 bytes).
- `makeRunRoot({ tmp, short, limit })` returns `{ runRoot, line }`. In order:
  1. `realBase = realpathSync(tmp)`. If it resolves and `Buffer.byteLength(realBase) + RUN_ROOT_NAME_BYTES <= limit`,
     try `mkdtempSync(join(realBase, 'devkit-suite-'))`; on success return it with `line: null`.
     The reason recorded for the next step: `its run root would take <n> bytes, over <limit>, and a Unix socket path under it would pass 103 bytes`
     when it does not fit, or `cannot be used: <error.code or message>` when `realpathSync` or
     `mkdtempSync` throws (missing, not a folder, not writable).
  2. The same for `short`. On success return the root with
     `line: 'run root: <runRoot> (TMPDIR <tmp shown as real path when it resolved>: <reason>)'`, one line.
  3. Else throw `new UsageError('no folder can hold the run root: TMPDIR <tmp>: <reason>; <short>: <reason>')`.
  The step 1 check comes before `mkdtempSync`, so a TMPDIR that does not fit is never written to.
  When TMPDIR fits and can be written, the fallback is never used (AC-2).
- `main(argv, root = ROOT, short = SHORT_TMP)`: inside the existing `try` and after `order` is built, it calls
  `makeRunRoot({ tmp: tmpdir(), short, limit: runRootLimit(files.length) })`. A `UsageError` then
  takes the existing `catch`: the message and `USAGE` go to stderr, the script returns 2, and no file runs (AC-3, requirements' fourth
  assumption). Because the call is last in the `try`, a bad argument is still refused before anything
  is made. After the `try`, a non-null `line` is written to stdout, before the first `start` line. The third
  parameter exists only so the exit-2 test can point `short` at an unusable folder; the CLI never
  passes it.
- `runFile` is unchanged apart from its line-141 comment, which now cites `runRootLimit`. The header
  comment (lines 5-9) gains one sentence: the run root is under the real TMPDIR when it fits, else
  under the real `/tmp`.

Alternatives considered:

- Bind the socket in a short folder outside the file's `TMPDIR` (change `test-fixtures.mjs`): rejected
  by the owner (requirements, question 1). The leftover check would no longer see a socket a test leaves behind.
- Always use the real `/tmp`: rejected by the owner (question 4). `env TMPDIR=...` must keep working
  (AC-2).
- A shorter run root name (`ds-XXXXXX`): it saves 11 bytes, but the default Mac still needs 108 − 103 = 5
  bytes on top of that, and it renames what the summary and the test of line 275 call the run root. Not enough alone.
- An environment variable to override the short folder: a new interface used only by tests. The third
  parameter of `main` does the same in-process without adding to the CLI.

ADR check: ADR 0026 decision 4 requires an empty real-path `TMPDIR` per file and the leftover check;
both stay. Its rejected alternatives (an aggregator, a glob command, helpers exported from test files)
are not this approach. The base `realpathSync(tmpdir())` was the archived suite-speed design's choice
(`openspec/changes/archive/2026-11-24-suite-speed/design.md`, D-2), and this change takes it over as
step 1 of D-1. No ADR is written (devkit-lite; `requirements.md`, sixth assumption).

## D-2 The tests

All tests are in `plugins/openspec/hooks/test-suite.test.mjs`, named `suite-socket-path AC-<n> ...`.
The file reaches the new exports through a namespace import added beside the existing one
(`import * as suiteScript from '../../../scripts/test-suite.mjs';`). The named import
`{ suiteFiles, testImports }` stays as it is. A missing export is then `undefined` and does not stop the
module from linking, so on the plan base's script the file still loads and the AC-4 test fails on its own
assertion (the bind), not with a link error. No test text contains a raw `mkdtempSync(` or `tmpdir(`
call (`test-tmp.test.mjs` refuses it). Every folder is a `tmpFolder(...)`, or a folder made with
`mkdirSync` under one.

The new tests: one per labelled branch and condition, negatives included.

| # | Name (after `suite-socket-path `) | How | AC |
| --- | --- | --- | --- |
| 1 | `AC-4 under a TMPDIR of 60 bytes or more a child binds <TMPDIR>/devkit-ch-xxxxxx/daemon.sock and its TMPDIR is at most 71 bytes` | `base = tmpFolder('devkit-long-')`, then `mkdirSync` of `nested` folders inside it until `Buffer.byteLength(realpathSync(base)) >= 60` (a loop on the AC's 60, not the formula). One probe file. Its body takes `createServer` from `await import('node:net')` and makes `join(process.env.TMPDIR, 'devkit-ch-xxxxxx')` with `mkdirSync`. It listens on `daemon.sock` there, records `{ tmp, bound: true }` or `{ tmp, bound: <error.code> }` in `PROBE_MARKS`, then closes and removes the folder. Asserts, in this order: exit 0; `bound === true`; `Buffer.byteLength(tmp) <= suiteScript.runRootLimit(1)`; exactly one stdout line starts with `run root: `; `dirname(dirname(tmp)) === realpathSync(suiteScript.SHORT_TMP)`; the run root is gone; `readdirSync(base)` is empty | AC-4, AC-3 |
| 2 | `AC-3 under the short run root a file that leaves something still fails the run with its name, and the root is removed` | the same long base; a `leaver` probe (makes `left-behind`) and a `clean` probe. Asserts: exit 1; `^LEFT .*leaver\.test\.mjs.*left-behind`; `^pass .*clean\.test\.mjs`; one `run root: ` line; the root it names no longer exists | AC-3 |
| 3 | `AC-2 a TMPDIR whose run root fits exactly holds it and gives no line` | in-process: `tmp = tmpFolder('devkit-fit-')`, `limit = Buffer.byteLength(realpathSync(tmp)) + suiteScript.RUN_ROOT_NAME_BYTES`; `makeRunRoot({ tmp, short: tmpFolder('devkit-short-'), limit })`. Asserts: `dirname(runRoot) === realpathSync(tmp)`, name `^devkit-suite-`, `line === null`, `short` empty. The test removes `runRoot` itself (`rmSync`) before it ends | AC-2 |
| 4 | `AC-3 a TMPDIR one byte over the limit puts the run root under the short folder with one line naming where and why` | the same with `limit - 1`. Asserts: root under `realpathSync(short)`; `tmp` empty (nothing written there); `line` starts `run root: <runRoot> (TMPDIR <real tmp>: its run root would take ` and holds `over <limit>` and `103 bytes`; no newline in it | AC-3 |
| 5 | `AC-3 a TMPDIR that cannot be used puts the run root under the short folder and the line says why` | `tmp = join(<a regular file made with writeFileSync in a tmpFolder>, 'below')` (ENOTDIR on every platform, no `chmod`), a generous `limit`. Asserts: root under `short`; `line` holds `cannot be used: ENOTDIR` | AC-3 |
| 6 | `AC-3 when the short folder is too long as well, a usage error names both folders and nothing is made` | `tmp` and `short` both `tmpFolder`s, `limit` below both. Asserts: throws `UsageError` (`name === 'UsageError'`) whose message starts `no folder can hold the run root: ` and names both real paths; both folders empty | AC-3 |
| 7 | `AC-3 when the short folder cannot be used either, a usage error names both folders` | `tmp` too long for `limit`; `short` under a regular file. Same assertions, and the message holds `cannot be used: ENOTDIR` | AC-3 |
| 8 | `AC-3 when no folder can hold the run root, the script exits 2 with the usage before any file runs` | first asserts `typeof suiteScript.makeRunRoot === 'function'`, so on the plan base's script it fails before running anything; then in-process `suiteScript.main([], root, shortUnderAFile)` on a `tree(...)` with one probe, with `process.env.TMPDIR` set to the long base of test 1 and put back in `finally` (CONTRIBUTING, testing paragraph: a test that calls in-process code under the temporary root points it at a `tmpFolder` and restores it). `process.stdout.write` and `process.stderr.write` are swapped for collectors around the call and put back in `finally`. The swap is safe because the refusal returns before the first `await` of `main`. Asserts: result 2; stderr holds `no folder can hold the run root` and `usage: node scripts/test-suite.mjs`; no `start ` line in stdout; the long base is empty | AC-3 |
| 9 | `AC-4 the run root fits by bytes: 51 fits, 52 does not, a non-ASCII byte counts` | pure: `runRootFits('/' + 'a'.repeat(50), 1)` true; `'/' + 'a'.repeat(51)` false; `'/' + 'é' + 'a'.repeat(48)` (51 bytes, 50 characters) true and `'/' + 'é' + 'a'.repeat(49)` false. The lengths are built from `suiteScript.runRootLimit(1) - suiteScript.RUN_ROOT_NAME_BYTES`, never a literal 51 | AC-4 |
| 10 | `AC-4 the run-root limit leaves room for a wider place: 71 up to 100 files, one less from 101` | pure: `runRootLimit(1) === runRootLimit(100)`, `runRootLimit(101) === runRootLimit(100) - 1`, and `runRootLimit(100) + 3 + suiteScript.SOCKET_TAIL_BYTES === suiteScript.SOCKET_PATH_MAX_BYTES` | AC-4 |

Test 1 is the regression test. On the plan base's script, the child's `TMPDIR` is at least
60 + 20 + 3 = 83 bytes and the socket path at least 112 (over macOS's 104 and Linux's 108), so
`bound` is `EINVAL` and the second assertion fails. On the fixed script, the run root is under the real
`/tmp` and the child's `TMPDIR` is 35 (macOS) or 27 (Linux) bytes. Tests 3 to 7 inject `limit` relative
to the folders they make, so they pass whatever the length of the test's own `TMPDIR`. Tests 9 and 10
cover the arithmetic without the filesystem.

Tests 1 and 2 make the run root in the real `/tmp`, outside the test's `TMPDIR`, because that is the
behaviour under test. The script removes it in its `finally`, and test 1 asserts it is gone.

## D-3 The existing tests that place a run root

The search, before this plan: `grep -rnE "devkit-suite-|realpathSync\(tmpdir\(\)\)|run root"` over every
`*.mjs`, `*.py` and `*.md` outside the change records. Only `plugins/openspec/hooks/test-suite.test.mjs` pins the run root.
No test pins the sentence of `CONTRIBUTING.md` that this change edits.

The problem: those tests run the copied script with `TMPDIR` set to a `tmpFolder` under the test's
own `TMPDIR`. With the fix, under the suite, the test's `TMPDIR` is 35 bytes (macOS, short root) or 27
(Linux CI). The default base `tmpFolder('devkit-suite-base-')` adds 25 bytes, giving 60 or 52, so the inner run root
would be 80 or 72. Both are over 71, so the inner script would take the fallback, even in CI. The prefix
`devkit-b-` adds 16 bytes: 51 or 43, so the inner run root is at most 71 and fits. Edits, each named in its commit
with its invariant, layer (the suite script's tests) and suite (`test-suite.test.mjs`):

| Test (line at base) | Today | After | Invariant kept |
| --- | --- | --- | --- |
| helper `start` (line 55) | default `base = tmpFolder('devkit-suite-base-')` | `tmpFolder('devkit-b-')`; the comment above it says why (the inner run root must fit) | the child's run root lives in a folder the test owns |
| `suite-speed AC-4 each file runs in its own empty TMPDIR under one run root, removed after` (260) | line 276 asserts `dirname(dirname(a.tmp)) === realpathSync(out.base)` | asserts `dirname(dirname(a.tmp)) === runParent(out.base, 2)`. The new local helper `runParent(base, fileCount)` returns `realpathSync(base)` when `suiteScript.runRootFits(realpathSync(base), fileCount)`, else `realpathSync(suiteScript.SHORT_TMP)`. It also asserts that the count of `run root: ` lines is 0 or 1, to match | one run root, its two-digit folders, removed after |
| `suite-speed AC-4 a symlinked TMPDIR gives each file a real path` (282) | `target = tmpFolder('devkit-suite-target-')` (27 bytes more); line 297 compares with `realpathSync(target)` | `tmpFolder('devkit-t-')`; line 297 compares with `runParent(target, 1)` | a child sees a real path when TMPDIR is a symlink |
| `suite-speed AC-4 a file that leaves something ...` (301), `suite-speed AC-4 SIGTERM ...` (345), the other child-run tests | default base | unchanged text; they take the shorter default base | the leftover check, the signals, the usage exits |

`runParent` makes these tests pass under any `TMPDIR`. Under `env TMPDIR=/var/tmp/<name>`, the
suite-speed evidence's form, the test's own `TMPDIR` is long enough to push the inner run root to the
fallback. They do not change meaning in the gate environments: on a default Mac and on CI, the inner base
is 51 or 43 bytes and the "fits" branch runs, as before. On macOS the 51 is exactly at the limit, so
the margin is zero. Risk R-2 covers this. The sorted test names before and after are equal except for
the ten tests that D-2 adds: no test is renamed or removed.

The file's line 1 already says to run it alone with `node scripts/test-suite.mjs <file>`. Run bare with
`node --test` under the default macOS `TMPDIR` (56 bytes), the bases are 72 bytes or more, so the
inner script takes the fallback and `runParent` follows it. No test depends on being run bare.

## D-4 Docs and release

- `CONTRIBUTING.md` line 42 (the paragraph that the test `suite-speed AC-8 ...` reads for the measured
  time; that sentence stays as it is). After `(a real path, under one run root the script removes at the end)`, it states three things.
  First, the run root is made under the real path of the environment's `TMPDIR` when it leaves room for the longest Unix
  socket path a test binds: a socket path holds 104 bytes on macOS, the terminator included, so the
  run root takes at most 71. Second, otherwise the run root goes under the real path of `/tmp` (`/private/tmp` on macOS), and the script
  prints one `run root:` line saying where and why; when neither folder can hold it, the script exits 2. Third, a test that binds a Unix
  socket does so under its `TMPDIR` (as `fakeCompozy(...).daemon` does), so the leftover check covers
  the socket (AC-6).
- Release (CONTRIBUTING.md step 5; precedent: `CHANGELOG.md` 0.49.2, a test-only devkit-openspec patch): devkit-openspec patch version in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, marketplace patch version, a
  `CHANGELOG.md` section, and the CI pin lines of `docs/openspec-flow.md` (lines 733, 734, 747 at the
  base) moved to the new devkit-openspec version. The numbers are the next free ones on `origin/main` at the last merge before review.
  The pin test reads the manifest, so no test changes (ADR 0030).

## Implementation plan

Order: the tests (red) → the script → the existing tests' prefixes → docs → release → the whole suite.

Files: modify `scripts/test-suite.mjs`, `plugins/openspec/hooks/test-suite.test.mjs`, `CONTRIBUTING.md`,
`CHANGELOG.md`, `docs/openspec-flow.md`, `plugins/openspec/.claude-plugin/plugin.json`,
`.claude-plugin/marketplace.json`. Create none. Delete none.

Estimate: optimistic 4 h, likely 6 h, pessimistic 9 h (the whole suite takes about 12 minutes on this Mac and runs at least twice).

| Deliverable | Hours | Type | Risk |
| --- | --- | --- | --- |
| Ten new tests, red on the base (D-2) | 2.5 | Testing | MEDIUM: the in-process test 8 |
| `makeRunRoot`, the limit, `main` wiring (D-1) | 1.5 | Core | LOW |
| Existing tests' prefixes and `runParent` (D-3) | 0.5 | Testing | MEDIUM: the zero margin on macOS |
| CONTRIBUTING paragraph (D-4) | 0.5 | Documentation | LOW |
| Release files and CI pin (D-4) | 0.5 | Documentation | LOW |
| Whole-suite runs on this Mac, CI | 0.5 | Testing | LOW |

Risks:

- R-1 Test 8 swaps `process.stdout.write` inside a `node --test` child, whose stdout carries the
  runner's report. (LOW × MEDIUM.) Mitigation: the swap covers only the synchronous part of `main`,
  which returns 2 before its first `await`; `finally` restores both writers before the test awaits. If
  the report is ever garbled, test 8 becomes a child run of a copied script given `short` through
  `main`'s parameter by a two-line wrapper module in the tree.
- R-2 The macOS inner base in D-3 is exactly at the limit (51 bytes). A longer short root, a wider place, or
  a longer prefix would push those tests to the fallback. (LOW × LOW.) Mitigation: `runParent` keeps them green
  either way. Test 10 pins the limit's arithmetic.
- R-3 A run killed with SIGKILL leaves its root in `/private/tmp` instead of in `TMPDIR`. (LOW × LOW.)
  Mitigation: same as today (the `finally` covers SIGINT and SIGTERM); the root's name says what it is.
- R-4 A sibling release takes the version numbers first. (MEDIUM × LOW.) Mitigation: the numbers are taken at the last
  merge of `origin/main` before review (CONTRIBUTING step 5).

Assumptions (the plan breaks if these differ):

- The deepest socket a suite test binds is `fakeCompozy`'s `daemon.sock` under `devkit-ch-XXXXXX` (source:
  `grep -rn "listen(" plugins --include='*.mjs'` at the plan base finds no other Unix socket under `TMPDIR`; the implementer repeats
  the grep in task 1.1).
- `/tmp` exists and is writable on macOS and on CI's `ubuntu-latest` (source: `.github/workflows/ci.yml`
  runs `mktemp -d` there).
- Node's `os.tmpdir()` reads `TMPDIR` at call time (test 8 relies on it; `test-tmp.mjs` `tmpRoot()` relies on the same).

Dependencies: none open. ADR 0026 is accepted. The suite-speed change, which brought the script, is archived.

Rollback: revert the merge commit. The script falls back to `realpathSync(tmpdir())`, and the
release files revert with it. Nothing persists outside the run root.
