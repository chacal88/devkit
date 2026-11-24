<!-- devkit-stage evidence result=passed attempt=3 commit=54f947e2848bf86dd89463b165322f16db05a6a5 -->
Commit: 54f947e2848bf86dd89463b165322f16db05a6a5

# Evidence: archive-release-pin

Verified on 2026-11-24 at head `54f947e` (attempt 3; working tree clean; no uncommitted change). Since attempt 2
(`211c1eb`) the branch merged `origin/main` twice: `b72c47a` renumbered the release to devkit-openspec 0.40.0 and
marketplace 0.44.0 (PR #97, `stale-only-on-own-files`, took 0.39.0 / 0.43.0) and moved the pin block to 0.40.0;
`54f947e` brought PR #103, which turned the delivery train on for this repository (`openspec/config.yaml`
`devkit.delivery`: model `trunk-auto`, train `node scripts/test-suite.mjs && python3 scripts/check.py`).
The repository now delivers through the train, which runs the whole suite at the joined head. For that reason no
new full run was started here: the whole-suite row below cites `proof/full-suite.txt` (38 files, 2928 tests, 0 fail,
run at `687535a`, before the two merges) as the last full run. Every filtered run below ran at this head, through
`node scripts/test-suite.mjs` (one process and one private TMPDIR per file) with
`TMPDIR=/var/tmp/devkit-archive-release-pin`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`.

## Verification

### Notes the reader needs

- Entry files. After the `suite-speed` split the entry files `conduct-check.test.mjs` and `guard.test.mjs` no longer
  import the deliver-check, release-merge and change-loop suites (`tasks.md` says they do). The gate commands of
  tasks 1.5 and 2.4, run exactly as written at this head, exit 0 but select few tests (10 and 2). Their rows below
  say so, and each is backed by a second run of the same patterns, through `node scripts/test-suite.mjs`, on the
  files that now hold the tests. Run A: `deliver-check-archive.test.mjs`, `deliver-check-cli.test.mjs`,
  `deliver-check.test.mjs`, `release-merge.test.mjs`, `conduct-check.test.mjs`: 5 files, 78 tests, 78 pass, 0 fail
  (22, 4, 1, 41 and 10 tests), holding `archive-release-pin 1` to `11` and `release list`. Run B (the 2.4 patterns):
  `guard.test.mjs`, `deliver-check-archive.test.mjs`, `deliver-check-cli.test.mjs`, `release-merge.test.mjs`,
  `change-loop-compozy.test.mjs`, `roadmap-loop-upfront.test.mjs`, `release-tags.test.mjs`: 7 files, 38 tests,
  38 pass, 0 fail. Run C (no name filter): `merge-setup.test.mjs` 24 tests and `change-loop-compozy.test.mjs`
  197 tests, 221 pass, 0 fail, 347.7s (this file holds the pin block). Run D: `version-pin.test.mjs` filtered to
  `^version-pin AC-2`: 10 tests, 10 pass, 0 fail.
- The whole suite was not re-run here, by the coordinator's instruction. The last full run is
  `proof/full-suite.txt` (merged head `687535a`, before both merges of `origin/main`): `suite: 38 files,
  2928 tests, 2925 pass, 0 fail, 806.7s, concurrency 8`, `exit=0` (38 `pass` file lines and 0 `fail` lines,
  counted at this head). Since `5ca9329` the pin code of this change did not change (`git diff 5ca9329 HEAD --
  plugins/openspec/hooks/deliver-check.mjs` has 12 hunks, in `gitFacts`, `touchedPaths`, `staleness`,
  `readReviews`, `tasksItem`, `acceptanceItem`, `collectState`, `judgeBoarded` and `runCi`, and none of its lines
  holds `pinLinesOnly`, `PIN_LINE`, `PIN_TEST`, `textAt` or `unnamedFiles`), but the merges brought code of other
  changes (`git diff --stat 687535a HEAD -- plugins scripts docs CHANGELOG.md .claude-plugin`:
  19 files, among them `deliver-check.mjs` +72 -12 lines of PR #97 and the pin block of
  `change-loop-compozy.test.mjs`). The delivery train (`openspec/config.yaml`: `node scripts/test-suite.mjs &&
  python3 scripts/check.py`) runs the whole suite once at the joined head, so no new full run was started here.
- Pin test file. The pin test file is `plugins/openspec/hooks/change-loop-compozy.test.mjs`: the rule's
  `PIN_LINE_FILES` (`deliver-check.mjs:1361`) is `['docs/openspec-flow.md', 'plugins/openspec/hooks/change-loop-compozy.test.mjs']`,
  and ADR 0027 and ADR 0003's Note name that path. `requirements.md` and `tasks.md` still say `change-loop.test.mjs`
  (the name before the split). Not a defect.
- The release moved. `plugins/openspec/.claude-plugin/plugin.json` is `0.40.0` and `metadata.version` of
  `.claude-plugin/marketplace.json` is `0.44.0`; `docs/openspec-flow.md` has three `v0.40.0` pins and none of
  `v0.39.0`. `origin/main` is `9dff573` and is an ancestor of this head (no fetch was done; this is the local ref).
  ADR numbers: `0025` and `0026` are other changes', `0027` is this change's, no collision. The comment above the
  pin-block `assert.match` in `change-loop-compozy.test.mjs` now reads "archive-release-pin moves it to 0.40.0
  (release 0.44.0), above stale-only-on-own-files' 0.39.0".
- Proof logs: `proof/red-1.txt` (ten new tests plus `release list` fail before the fix), `proof/red-2.txt`
  (test 11 fails before the documents), `proof/real-run.txt` (cases R1 to R8, run before the first merge, when the
  pin file was still `change-loop.test.mjs`: the pre-merge record, on the old path), `proof/real-run-head.txt`
  (cases R1 to R8 and the extra X1, run at `5ca9329` on the shipped path `change-loop-compozy.test.mjs`: the proof on
  the shipped path; it holds the verbatim build commands and, per run, its command, exit code and `archive.unnamed`),
  `proof/full-suite.txt` (the conducting session's full run at `687535a`).
- Real-run proof on the shipped path: `proof/real-run-head.txt`. Each case is a fresh clone of a scratch origin, an
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
- My own re-run of R3, R4 and R8 at `54f947e` (the same recipe as the build script of `proof/real-run-head.txt`,
  scratch repository `/var/tmp/devkit-archive-release-pin/reverify-head2`, removed afterwards; R3 and R4 against a
  scratch `main` holding the c561553^ text at the new path). R3: exit 0, `archive.unnamed` `[]`. R4: exit 1,
  `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`. R8 against the merge base of this head, now `9dff573`
  (it was `44ca321`): `docs/openspec-flow.md` false, `change-loop-compozy.test.mjs` true, exit 0. All equal to the log.
- `openspec/roadmap.md` ticks of `archive-release-pin` and `release-pin-is-a-release-file` happen at archive; no
  acceptance criterion depends on it.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.5 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^P3j" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" plugins/openspec/hooks/conduct-check.test.mjs` | pass: exit 0, 10 tests, 10 pass, 0 fail (the release-merge-conflict, `conduct pin` and `P3j`/`P13` tests that `conduct-check.test.mjs` still imports; the deliver-check tests are no longer imported by this file). Run A (same patterns, the five files that hold the tests): exit 0, 78 tests, 78 pass, 0 fail, including `archive-release-pin 1` to `11` and `release list` |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/merge-setup.test.mjs` | pass: exit 0, 24 tests, 24 pass, 0 fail (run C, through `node scripts/test-suite.mjs`, same file) |
| 1.5 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.4 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 2.4 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^change-loop docs: the design records the answers" --test-name-pattern="^release-merge pin" --test-name-pattern="^release-merge-conflict 1[56]:" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^upfront AC-5 docs" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^upfront D-18 docs" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 2 tests, 2 pass, 0 fail (`guard.test.mjs` holds only `ADR 0003 exists` and `upfront AC-5 docs`). Run B (same patterns, the seven files that hold the tests): exit 0, 38 tests, 38 pass, 0 fail |
| 2.4 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.4 | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| 2.4 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" |
| 3.2 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 3.2 | `env TMPDIR=/var/tmp/devkit-archive-release-pin node scripts/test-suite.mjs` | pass: not re-run at this head. Last full run: `proof/full-suite.txt`, merged head `687535a` (before both merges of `origin/main`), `suite: 38 files, 2928 tests, 2925 pass, 0 fail, 806.7s, concurrency 8`, `exit=0 end 2026-11-24T07:57:48-03:00`. The delivery train runs the whole suite at the joined head, so no new full run was started. Filtered runs A to D at this head, listed in the notes, all pass |
| 3.2 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (re-run at `54f947e`) |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run at `54f947e`) |
| 3.2 | `command claude plugin validate .` | pass: exit 0, "Validation passed" (re-run at `54f947e`) |
| 3.2 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" (re-run at `54f947e`) |

### Acceptance criteria

| Id | Criterion | What was done and observed | Result |
|---|---|---|---|
| AC-1 | A pin-only change to `docs/openspec-flow.md` is absent from `unnamedFiles`, no `apply-proposals` stop | `archive-release-pin 1` (pin-only doc text and the real c561553 doc hunks), `6` (c561553's 16-file list passes with proposals naming neither pin file) and `7` (local stop through `collectState`: pin-only edits open the archive PR) pass in run A (78 tests) at `54f947e`. Real run on the shipped path, `proof/real-run-head.txt`: R1 (doc as at c561553) exit 0, `archive.unnamed` `[]` (lines 141 to 142); R6 (both files) exit 0, `[]` (181 to 182). Pre-merge record: `proof/real-run.txt` R1, same result | pass |
| AC-2 | A doc change beyond the pin lines stays in `unnamedFiles` and stops with `files no approved proposal names: docs/openspec-flow.md` | `archive-release-pin 2` (changed sentence, added paragraph, marker line with other words changed) and the beyond-pin halves of `7`, `8`, `9` pass in run A. `proof/real-run-head.txt` R2: exit 1, `["docs/openspec-flow.md"]` (lines 151 to 152). Pre-merge record: `proof/real-run.txt` R2, same result | pass |
| AC-3 | Only the two line forms of the test file leave it unnamed-free | `archive-release-pin 3` (added and removed `assert.match` / `assert.doesNotMatch(flow, /vX.Y.Z/, '<message>')` lines, `// Invariant: the CI snippet pins the current release`) passes in run A, with the c561553 hunks (`fixtures/c561553/change-loop.test.{before,after}.txt`). `proof/real-run-head.txt` R3 on the shipped path `change-loop-compozy.test.mjs`: exit 0, `[]` (lines 157 to 158); my re-run at `54f947e`: exit 0, `[]`. At this head the file's own diff against the merge base (`git diff --merge-base origin/main -U0`) holds only those forms: one Invariant comment removed and one added, one `assert.match` removed and one added (now `/v0\.40\.0/`), one added `assert.doesNotMatch(flow, /v0\.39\.0/, ...)`; R8 (re-run at this head): `pinLinesOnly` is true for it. Pre-merge record on the old path: `proof/real-run.txt` R3, exit 0, `[]` | pass |
| AC-4 | Any other added or removed line keeps the file in `unnamedFiles` | `archive-release-pin 4` (other assertion, assertion on another subject, regex that is not a plain `vX.Y.Z`, unrelated test, other comment) and the other-line halves of `7`, `8`, `9` pass in run A. `proof/real-run-head.txt` R4 (c561553 text plus `assert.ok(flow.length > 0, 'x');`, shipped path): exit 1, `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]` (lines 169 to 170); my re-run at `54f947e`: exit 1, the same list. X1 (pin-only text at the old path): exit 1, `["plugins/openspec/hooks/change-loop.test.mjs"]` (198 to 199). Pre-merge record on the old path: `proof/real-run.txt` R4, exit 1 | pass |
| AC-5 | A file missing on either side, or unreadable, stays in `unnamedFiles` | `archive-release-pin 5` (missing, unreadable, other path, CRLF, lost and gained final newline, empty base against text; the two empty-base `true` cases) and the deleted-file half of `7` pass in run A. `proof/real-run-head.txt` R5: `git rm docs/openspec-flow.md`, exit 1, `["docs/openspec-flow.md"]` (lines 175 to 176). No real-run case deletes the test file on the shipped path; that half rests on the unit tests above | pass |
| AC-6 | `RELEASE_FILE` unchanged, `RELEASE_FILE.test('docs/openspec-flow.md')` false, conflict classification unchanged | `RELEASE_FILE` at `deliver-check.mjs:1380` is the same regular expression as on `origin/main` (`git show origin/main:plugins/openspec/hooks/deliver-check.mjs`, line 1325: `/^(plugins\/[^/]+\/\.claude-plugin\/plugin\.json|\.claude-plugin\/marketplace\.json|CHANGELOG\.md|docs\/catalog\.md)$/`; `diff` of the two `export const RELEASE_FILE` lines prints nothing). Test `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` passes in run A; in `proof/red-1.txt` it failed only on its new pin-only half. `release-merge.test.mjs` (whole file, 41 tests, in run A), `release-merge-conflict 15` and `16` (run B) and the `conduct pin` tests pass. `git grep -n "PIN_MARKER\|PIN_TOKEN" -- plugins/openspec/hooks/release-merge.mjs` prints nothing. `deliver-check.mjs` has no import of `release-merge.mjs` (its `import` lines 7 to 19 name `node:*`, `merge-setup.mjs` and `guard.mjs`); `git grep -n "release-merge"` on it prints only the comment lines 1381 and 1382 (the pin file path is written there, from the delivery-train change, and a test holds the two equal) | pass |
| AC-7 | `devkit-reviews --ci` applies the same rule through the shared function | `archive-release-pin 8` (`--ci` on an archive branch: same pin rule) and `9` (`--ci` from only `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`: pin-only passes, beyond-pin fails) pass in run A. `archive-release-pin 10` passes: `release-merge.mjs` re-exports the one pin definition of `deliver-check.mjs`, which never imports `release-merge.mjs`. R7 (consumer folder of the three files only, `proof/real-run-head.txt`): exit 0, `[]`. `git grep -n "unnamedFiles(" -- plugins/openspec/hooks/deliver-check.mjs` prints 3 lines at this head: the definition (1388) and two callers (1702 `filesStop` with `a.changed?.texts`, 2516 `archivePrCheck` with `changes.texts`), both pass texts | pass |
| AC-8 | `docs/openspec-flow.md` and ADR 0003 state the rule; `check.py` and `gen-catalog.py --check` pass | `archive-release-pin 11` passes in run A (failed in `proof/red-2.txt` on "the P13 row names the flow page"). `git diff --merge-base origin/main --numstat` at this head: ADR 0003 3 added and 0 removed (the header `Amended by ADR 0027` and the Note), `docs/openspec-flow.md` 6 added and 6 removed, `openspec/config.yaml` 1 and 1. `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` is new (108 lines) and holds `- Status: accepted`. `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check`: exit 0 | pass |
| AC-9 | The real-run proof covers every declared case, on a real archive branch | `proof/real-run-head.txt` (shipped path `change-loop-compozy.test.mjs`, at `5ca9329`) holds the verbatim build commands (lines 24 to 109) and cases R1 to R8 (output from line 111), each with its command, exit code and `archive.unnamed`, each equal to D-10's Expected column (the test-file column read as the shipped path): pin-only doc passes; doc beyond the pin does not; c561553 test file passes; test file plus another assert does not; missing file does not; both files pass; the three-file consumer folder passes; R8 `pinLinesOnly` true for the test file and false for the doc. They ran on `deliver-check.mjs --ci --json` against scratch git repositories, not unit tests. the changes to `deliver-check.mjs` since `5ca9329` are the 12 hunks of PR #97 listed in the notes, none in the pin code, and I re-ran R3, R4 and R8 at `54f947e` with the same results as the log (see notes). `proof/real-run.txt` is the pre-merge record on the old path. The local stop (`filesStop`) is proved by `archive-release-pin 7` through `collectState` with the fake gh, as both logs say | pass |
| AC-10 | The c561553 diffs are fixtures and both pass; so does the matching pair of a bump that names neither file | Four fixture files exist under `plugins/openspec/hooks/fixtures/c561553/` (`openspec-flow.before.txt` 15 lines, `openspec-flow.after.txt` 15, `change-loop.test.before.txt` 7, `change-loop.test.after.txt` 8; counted at this head), read by `archive-release-pin 1` (doc hunks) and `3` (test hunks), both pass in run A; `6` runs the 16-path list of c561553 through `unnamedFiles` with proposals naming neither pin file and gets `[]` | pass |
