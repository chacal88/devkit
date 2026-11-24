<!-- devkit-stage evidence result=passed attempt=2 commit=211c1eb8713d82358ed76faffd577b2c9d037601 -->
Commit: 211c1eb8713d82358ed76faffd577b2c9d037601

# Evidence: archive-release-pin

Verified on 2026-11-24 at head `211c1eb` (attempt 2, after review round 1; working tree clean; no uncommitted
change). The whole suite was not re-run here: the conducting session ran it once at `687535a`
(`proof/full-suite.txt`), and since then only `openspec/` files changed: `git diff --stat 5ca9329 HEAD` lists
`proof/real-run-head.txt` and `specs/reviews-check/spec.md` only, and the code files of the change are those
of `ce168fa` and `5ca9329` (the filtered gate runs below were run at `ce168fa` and stay valid: no file they
import changed). Every
filtered run below used `TMPDIR=/var/tmp/devkit-archive-release-pin`, `GITHUB_HEAD_REF=probe-branch` and
`GITHUB_BASE_REF=main`.

## Verification

### Notes the reader needs

- After the `suite-speed` split the entry files `conduct-check.test.mjs` and `guard.test.mjs` no longer
  import the deliver-check, release-merge and change-loop suites (`tasks.md` says they do). The gate
  commands of tasks 1.5 and 2.4, run exactly as written, exit 0 but select few tests (9 and 2). Their
  rows below say so, and each is backed by a second run of the same patterns on the files that now hold
  the tests: `deliver-check-archive.test.mjs` (tests 1 to 9, 11, `release list`), `release-merge.test.mjs`
  (test 10), `deliver-check-cli.test.mjs`, `change-loop-compozy.test.mjs`, `roadmap-loop-upfront.test.mjs`,
  `release-tags.test.mjs`, `conduct-check.test.mjs`. The whole-suite run covers every file.
- The pin test file is now `plugins/openspec/hooks/change-loop-compozy.test.mjs`: the rule's
  `PIN_LINE_FILES` (`deliver-check.mjs:1303`) is `['docs/openspec-flow.md', 'plugins/openspec/hooks/change-loop-compozy.test.mjs']`,
  and ADR 0027 and ADR 0003's Note name that path. `requirements.md` and `tasks.md` still say
  `change-loop.test.mjs` (the name before the split). The c561553 test-file pair under the old path is
  `false` at this head (checked with `pinLinesOnly`), as expected after the move. Not a defect.
- Proof logs: `proof/red-1.txt` (ten new tests plus `release list` fail before the fix), `proof/red-2.txt`
  (test 11 fails before the documents), `proof/real-run.txt` (cases R1 to R8, run before the merge, when
  the pin file was still `change-loop.test.mjs`: the pre-merge record, on the old path),
  `proof/real-run-head.txt` (cases R1 to R8 and the extra X1, run at `5ca9329` on the shipped path
  `change-loop-compozy.test.mjs`: the proof on the shipped path; it holds the verbatim build commands and,
  per run, its command, exit code and `archive.unnamed`), `proof/full-suite.txt` (same as
  `/var/tmp/devkit-archive-release-pin/full-suite.log`, byte for byte, checked with `cmp`).
- Real-run proof on the shipped path: `proof/real-run-head.txt` (review round 1 found that the earlier proof
  of the test-file cases on this path was prose only). Each case is a fresh clone of a scratch origin, an
  archive branch with an approved retro proposal naming only `CONTRIBUTING.md`, run as
  `env GITHUB_BASE_REF=main GITHUB_HEAD_REF=chore/archive-demo node plugins/openspec/hooks/deliver-check.mjs --ci --json`
  (build commands at lines 24 to 109, output from line 111). Results, by line of that file:
  - R1 (doc as at c561553): exit 0, `[]` (lines 141 to 142). R2 (R1 plus one doc edit): exit 1, `["docs/openspec-flow.md"]` (151 to 152).
  - R3 (`change-loop-compozy.test.mjs` as the c561553 pin hunk): exit 0, `[]` (157 to 158).
  - R4 (R3 plus `assert.ok(flow.length > 0, 'x');`): exit 1, `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]` (169 to 170).
  - R5 (`git rm docs/openspec-flow.md`): exit 1, `["docs/openspec-flow.md"]` (175 to 176).
  - R6 (both files as c561553): exit 0, `[]` (181 to 182). R7 (the same from a folder of `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`): exit 0, `[]` (188 to 189).
  - R8 (`pinLinesOnly` against merge base `44ca321`): `docs/openspec-flow.md` false, `change-loop-compozy.test.mjs` true, exit 0 (lines 225 to 227).
  - X1 (the c561553 text written to the old path `change-loop.test.mjs`): exit 1, `["plugins/openspec/hooks/change-loop.test.mjs"]` (198 to 199): the old path is no longer a pin file.
  - Gap: no case there deletes the test file (R5 deletes the doc). The deleted-test-file half rests on the unit tests (`archive-release-pin 5`, `7`).
- My own re-run of R3, R4 and R8 at `211c1eb` (same recipe, scratch repository under
  `/var/tmp/devkit-archive-release-pin/reverify-head`, removed afterwards): R3 exit 0, `[]`; R4 exit 1,
  `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`; R8 `docs/openspec-flow.md` false,
  `change-loop-compozy.test.mjs` true. All equal to the log.
- The spec delta `specs/reviews-check/spec.md` now names `plugins/openspec/hooks/change-loop-compozy.test.mjs` in
  line 81 (the `--ci` scenario), as it already did in lines 29, 37, 41, 49, 59, 60 and 67. `git diff --stat 5ca9329 HEAD`
  shows that one-line change; `openspec validate archive-release-pin --strict` passes at this head.
- Roadmap ticks of `archive-release-pin` and `release-pin-is-a-release-file` happen at archive; both lines
  are still `[ ]` in `openspec/roadmap.md` now (no acceptance criterion depends on it).

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.5 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^P3j" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" plugins/openspec/hooks/conduct-check.test.mjs` | pass: exit 0, 9 tests, 9 pass, 0 fail (release-merge-conflict 8 to 13 and 3 `conduct pin` tests; the deliver-check tests are no longer imported by this file). Same patterns on `deliver-check-archive.test.mjs`, `deliver-check-cli.test.mjs`, `release-merge.test.mjs`, `conduct-check.test.mjs`: exit 0, 76 tests, 76 pass, 0 fail, including `archive-release-pin 1` to `11` and `release list` |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/merge-setup.test.mjs` | pass: exit 0, 24 tests, 24 pass, 0 fail |
| 1.5 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.4 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 2.4 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^change-loop docs: the design records the answers" --test-name-pattern="^release-merge pin" --test-name-pattern="^release-merge-conflict 1[56]:" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^upfront AC-5 docs" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^upfront D-18 docs" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 2 tests, 2 pass, 0 fail (`guard.test.mjs` holds only `ADR 0003 exists` and `upfront AC-5 docs`). Same patterns on `guard.test.mjs`, `deliver-check-archive.test.mjs`, `deliver-check-cli.test.mjs`, `release-merge.test.mjs`, `change-loop-compozy.test.mjs`, `roadmap-loop-upfront.test.mjs`, `release-tags.test.mjs`: exit 0, 38 tests, 38 pass, 0 fail |
| 2.4 | `python3 scripts/check.py` | pass: exit 0 |
| 2.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.4 | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| 2.4 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" |
| 3.2 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 3.2 | `env TMPDIR=/var/tmp/devkit-archive-release-pin node scripts/test-suite.mjs` | pass: not re-run here; the conducting session's log (merged head `687535a`, only `openspec/` files changed since) ends `suite: 38 files, 2928 tests, 2925 pass, 0 fail, 806.7s, concurrency 8` and `exit=0 end 2026-11-24T07:57:48-03:00`; 38 `pass` file lines, 0 `fail` lines (counted in the log) |
| 3.2 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (re-run at `211c1eb`) |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run at `211c1eb`) |
| 3.2 | `command claude plugin validate .` | pass: exit 0, "Validation passed" (re-run at `211c1eb`) |
| 3.2 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" (re-run at `211c1eb`) |

### Acceptance criteria

| Id | Criterion | What was done and observed | Result |
|---|---|---|---|
| AC-1 | A pin-only change to `docs/openspec-flow.md` is absent from `unnamedFiles`, no `apply-proposals` stop | `archive-release-pin 1` (pin-only doc text and the real c561553 doc hunks), `6` (c561553's 16-file list passes with proposals naming neither pin file) and `7` (local stop through `collectState`: pin-only edits open the archive PR) pass in the 76-test run. Real run on the shipped path, `proof/real-run-head.txt`: R1 (doc as at c561553) exit 0, `archive.unnamed` `[]` (lines 141 to 142); R6 (both files) exit 0, `[]` (181 to 182). Pre-merge record: `proof/real-run.txt` R1, same result | pass |
| AC-2 | A doc change beyond the pin lines stays in `unnamedFiles` and stops with `files no approved proposal names: docs/openspec-flow.md` | `archive-release-pin 2` (changed sentence, added paragraph, marker line with other words changed) and the beyond-pin halves of `7`, `8`, `9` pass. `proof/real-run-head.txt` R2: exit 1, `["docs/openspec-flow.md"]` (lines 151 to 152). Pre-merge record: `proof/real-run.txt` R2, same result | pass |
| AC-3 | Only the two line forms of the test file leave it unnamed-free | `archive-release-pin 3` (added and removed `assert.match` / `assert.doesNotMatch(flow, /vX.Y.Z/, '<message>')` lines, `// Invariant: the CI snippet pins the current release`) passes, with the c561553 hunks (`fixtures/c561553/change-loop.test.{before,after}.txt`). `proof/real-run-head.txt` R3 on the shipped path `change-loop-compozy.test.mjs`: exit 0, `[]` (lines 157 to 158; my re-run at `211c1eb`: the same). Pre-merge record on the old path: `proof/real-run.txt` R3, exit 0, `[]`. At this head the file's own diff against the merge base holds only those forms (one Invariant comment pair, one `assert.match` pair, one added `assert.doesNotMatch`) and `pinLinesOnly` is true for it. The path is `change-loop-compozy.test.mjs` since the split (see notes) | pass |
| AC-4 | Any other added or removed line keeps the file in `unnamedFiles` | `archive-release-pin 4` (other assertion, assertion on another subject, regex that is not a plain `vX.Y.Z`, unrelated test, other comment) and the other-line halves of `7`, `8`, `9` pass. `proof/real-run-head.txt` R4 (c561553 text plus `assert.ok(flow.length > 0, 'x');`, shipped path): exit 1, `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]` (lines 169 to 170; my re-run at `211c1eb`: the same). X1 (pin-only text at the old path): exit 1, `["plugins/openspec/hooks/change-loop.test.mjs"]` (198 to 199). Pre-merge record on the old path: `proof/real-run.txt` R4, exit 1 | pass |
| AC-5 | A file missing on either side, or unreadable, stays in `unnamedFiles` | `archive-release-pin 5` (missing, unreadable, other path, CRLF, lost and gained final newline, empty base against text; the two empty-base `true` cases) and the deleted-file half of `7` pass. `proof/real-run-head.txt` R5: `git rm docs/openspec-flow.md`, exit 1, `["docs/openspec-flow.md"]` (lines 175 to 176). No real-run case deletes the test file on the shipped path; that half rests on the unit tests above | pass |
| AC-6 | `RELEASE_FILE` unchanged, `RELEASE_FILE.test('docs/openspec-flow.md')` false, conflict classification unchanged | `RELEASE_FILE` at `deliver-check.mjs:1322` is the same regular expression as on `origin/main` (`git show origin/main:plugins/openspec/hooks/deliver-check.mjs`, line 1267: `/^(plugins\/[^/]+\/\.claude-plugin\/plugin\.json\|\.claude-plugin\/marketplace\.json\|CHANGELOG\.md\|docs\/catalog\.md)$/`). Test `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` passes; in `proof/red-1.txt` it failed only on its new pin-only half. `release-merge.test.mjs` (whole file, in the 76-test run), `release-merge-conflict 8` to `13`, and the `conduct pin` tests (doc paragraph conflict beyond the pin still blocked) pass. `git grep -n "PIN_MARKER\|PIN_TOKEN" -- plugins/openspec/hooks/release-merge.mjs` prints nothing; `git grep -n "release-merge" -- plugins/openspec/hooks/deliver-check.mjs` prints only the comment at line 1323 (no import) | pass |
| AC-7 | `devkit-reviews --ci` applies the same rule through the shared function | `archive-release-pin 8` (`--ci` on an archive branch: same pin rule) and `9` (`--ci` from only `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`: pin-only passes, beyond-pin fails) pass. `archive-release-pin 10` passes: `release-merge.mjs` re-exports the one pin definition of `deliver-check.mjs`, which never imports `release-merge.mjs`. R7 (consumer folder of the three files only): exit 0, `[]`. One `unnamedFiles(` definition and two callers, `filesStop` and `archivePrCheck`, both pass texts (task 1.4's check) | pass |
| AC-8 | `docs/openspec-flow.md` and ADR 0003 state the rule; `check.py` and `gen-catalog.py --check` pass | `archive-release-pin 11` passes (failed in `proof/red-2.txt` on "the P13 row names the flow page"). `git diff origin/main -- docs/adr/0003-auto-merge-the-archive-pr.md` adds 3 lines and removes none: the header `Amended by ADR 0027` and the Note. `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` holds `- Status: accepted`. `docs/openspec-flow.md` changed 14 lines, `openspec/config.yaml` 1 line. `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check`: exit 0 | pass |
| AC-9 | The real-run proof covers every declared case, on a real archive branch | `proof/real-run-head.txt` (shipped path `change-loop-compozy.test.mjs`, at `5ca9329`, code unchanged since) holds the verbatim build commands (lines 24 to 109) and cases R1 to R8 (output from line 111), each with its command, exit code and `archive.unnamed`, each equal to D-10's Expected column (the test-file column read as the shipped path) (pin-only doc passes; doc beyond the pin does not; c561553 test file passes; test file plus another assert does not; missing file does not; both files pass; the three-file consumer folder passes; R8 `pinLinesOnly` true for the test file and false for the doc). They ran on `deliver-check.mjs --ci --json` against scratch git repositories, not unit tests. `proof/real-run.txt` is the pre-merge record on the old path `change-loop.test.mjs`; because the merge moved the pin test file, `proof/real-run-head.txt` is the proof on the shipped path (R8: `docs/openspec-flow.md` false, `change-loop-compozy.test.mjs` true, lines 225 to 226; X1 shows the old path is named). I re-ran R3, R4 and R8 at `211c1eb` with the same results. The local stop (`filesStop`) is proved by `archive-release-pin 7` through `collectState` with the fake gh, as both logs say | pass |
| AC-10 | The c561553 diffs are fixtures and both pass; so does the matching pair of a bump that names neither file | Four fixture files exist under `plugins/openspec/hooks/fixtures/c561553/` (`openspec-flow.before.txt`, `openspec-flow.after.txt`, `change-loop.test.before.txt`, `change-loop.test.after.txt`), read by `archive-release-pin 1` (doc hunks) and `3` (test hunks), both true; `6` runs the 16-path list of c561553 through `unnamedFiles` with proposals naming neither pin file and gets `[]`. `pinLinesOnly` on the c561553 doc pair: true (checked at this head). The test-file pair under the old path `change-loop.test.mjs` is false at this head because the pin test file moved; the fixture test passes through `PIN_LINE_FILES` | pass |
