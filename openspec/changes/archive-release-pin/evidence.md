<!-- devkit-stage evidence result=passed attempt=4 commit=0e76c413b45074e97db712dfe21ed4f443ef55d8 -->
Commit: 0e76c413b45074e97db712dfe21ed4f443ef55d8

# Evidence: archive-release-pin

Verified on 2026-11-24 at head `0e76c41` (attempt 4; working tree clean, no uncommitted change), on the AMENDED
plan: requirements answer A3, ADR 0030, design D-12, tasks phase 4. Attempt 3 (`54f947e`) verified the plan before
the amendment; its criteria AC-3, AC-4, AC-8, AC-9 and AC-10 described the test-file half of the rule, which A3
withdraws, so this file replaces it. Every filtered run below ran at this head through `node scripts/test-suite.mjs`
(one process and one private TMPDIR per file) with `TMPDIR=/var/tmp/devkit-archive-release-pin`,
`GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`, except the two entry-file runs said so. No fetch was done.
The whole suite was not run here, by the coordinator's instruction: the delivery train runs it at the joined head.

## Verification

### Notes the reader needs

- Whole suite. The whole-suite row (task 3.2) is proved by the delivery train at the joined head (`openspec/config.yaml`
  `devkit.delivery`: `node scripts/test-suite.mjs && python3 scripts/check.py`). `proof/full-suite.txt` (merged head
  `687535a`: `suite: 38 files, 2928 tests, 2925 pass, 0 fail, 806.7s, concurrency 8`, `exit=0`) is a historical record
  of an earlier head, before the amendment and before two merges of `origin/main`; it is not proof of this head.
- Entry files. After the `suite-speed` split, `conduct-check.test.mjs` and `guard.test.mjs` no longer import the
  deliver-check, release-merge and change-loop suites (tasks 1.5 and 2.4 say they do). Those two gate commands, run
  exactly as written, exit 0 but select few tests (10 and 2); each is backed by a second run of the same patterns
  through `node scripts/test-suite.mjs` on the files that now hold the tests. Run A (the 1.5 patterns;
  `deliver-check-archive`, `deliver-check-cli`, `deliver-check`, `release-merge`, `conduct-check` test files): exit 0,
  `suite: 5 files, 79 tests, 79 pass, 0 fail, 30.9s`, holding `archive-release-pin 1` to `12` and `release list`.
  Run B (the 2.4 patterns; `guard`, `deliver-check-archive`, `deliver-check-cli`, `release-merge`,
  `change-loop-compozy`, `roadmap-loop-upfront`, `release-tags` test files): exit 0, `suite: 7 files, 39 tests,
  39 pass, 0 fail, 4.6s`. The phase-4 gate (4.6) uses the file list that holds the tests, and is the current gate.
- Superseded records. `proof/real-run.txt` (cases R1 to R8, run before the first merge, pin file `change-loop.test.mjs`)
  and `proof/real-run-head.txt` (cases R1 to R8 and X1 at `5ca9329`, pin file `change-loop-compozy.test.mjs`) are the
  earlier-phase records of the test-file half of the rule, which A3 and ADR 0030 withdraw. Their R3, R4, R6, R8 and X1
  results (a pin-only test file passes) no longer describe the code and prove nothing about it now. The cited proof of
  the amended code is `proof/real-run-amended.txt` and `proof/red-4.txt`.
- Pin test. `change-loop docs: the design records the answers` in `plugins/openspec/hooks/change-loop-compozy.test.mjs`
  (line 325) reads `version` from `plugins/openspec/.claude-plugin/plugin.json` (`0.40.0` here) and asserts
  `pinMismatches(flow, version)` is `[]`. `docs/openspec-flow.md` holds three lines with `v0.40.0`. Inside that
  test the only version literals are the `v0.20.0` slice-merge floor assertions (three lines, counted at this head),
  and the only change name is `review-writer-prompt` in the roadmap-line assertion (outside the pin block). Its diff
  against `main`'s merge base `9dff573` (`git diff --merge-base origin/main --stat`) is 28 deletions and no addition.
- Fixtures. `git ls-files plugins/openspec/hooks/fixtures/c561553` lists only `openspec-flow.after.txt` and
  `openspec-flow.before.txt` (15 lines each, counted at this head); the two `change-loop.test.*.txt` fixtures are gone.
- The release number and ADR numbers. `plugin.json` is `0.40.0`. The local `origin/main` ref is `8085104` and the
  merge base is `9dff573`; the flow's release step re-takes the number from a fresh `origin/main` (no fetch here),
  so a number collision, if any, is not checked by this verification. ADR 0027 and ADR 0030 both hold
  `- Status: accepted`.
- `openspec/roadmap.md` ticks of `archive-release-pin` and `release-pin-is-a-release-file` happen at archive; no
  acceptance criterion depends on it.
- My own re-run of A3 and A1 (recipe of the build script in `proof/real-run-amended.txt`, scratch repository
  `/var/tmp/devkit-archive-release-pin/verify-amended`, removed afterwards; a fresh clone, an archive branch whose
  approved proposal names only `CONTRIBUTING.md`, run as `env GITHUB_BASE_REF=main GITHUB_HEAD_REF=chore/archive-demo
  node plugins/openspec/hooks/deliver-check.mjs --ci --json`): A3 (`change-loop-compozy.test.mjs` set to the
  c561553 pin hunk, `git diff --stat` 2 insertions and 1 deletion): exit 1, `archive.unnamed`
  `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`. A1 (the doc as at c561553): exit 0, `[]`. A6 re-run in the
  worktree: the pin test passes (`ℹ tests 1`, `pass 1`, `fail 0`, exit 0), and `git grep -c -E
  '[0-9]+\\?\.[0-9]+\\?\.[0-9]+'` on the test file counts 11 now against 40 at `34e3500`, a drop of 29. All equal to
  `proof/real-run-amended.txt`.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.5 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^P3j" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" plugins/openspec/hooks/conduct-check.test.mjs` | pass: exit 0, 10 tests, 10 pass, 0 fail (the tests `conduct-check.test.mjs` still holds or imports). Run A, same patterns on the five files that hold the tests: exit 0, 79 tests, 79 pass, 0 fail, including `archive-release-pin 1` to `12` and `release list` |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/merge-setup.test.mjs` | pass: exit 0, 24 tests, 24 pass, 0 fail |
| 1.5 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.4 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 2.4 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^change-loop docs: the design records the answers" --test-name-pattern="^release-merge pin" --test-name-pattern="^release-merge-conflict 1[56]:" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^upfront AC-5 docs" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^upfront D-18 docs" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 2 tests, 2 pass, 0 fail (`guard.test.mjs` holds only `ADR 0003 exists` and `upfront AC-5 docs`). Run B, same patterns on the seven files that hold the tests: exit 0, 39 tests, 39 pass, 0 fail |
| 2.4 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 2.4 | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| 2.4 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" |
| 3.2 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 3.2 | `env TMPDIR=/var/tmp/devkit-archive-release-pin node scripts/test-suite.mjs` | pass: not run here by the coordinator's instruction; the delivery train proves the whole suite at the joined head. Last full run, historical: `proof/full-suite.txt` at `687535a`, `suite: 38 files, 2928 tests, 2925 pass, 0 fail, 806.7s`, `exit=0`. The filtered runs of gates 1.5, 2.4 and 4.6 at this head all pass |
| 3.2 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 3.2 | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| 3.2 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" |
| 4.6 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 |
| 4.6 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" --test-name-pattern="^change-loop docs: the design records the answers$" --test-name-pattern="^version-pin " --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^delivery-models docs: the documents follow" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/release-tags.test.mjs` | pass: exit 0, `suite: 10 files, 149 tests, 149 pass, 0 fail, 76.8s, concurrency 2`; all ten files `pass`; `archive-release-pin 1` to `12`, `release list` and `change-loop docs: the design records the answers` each ✔ |
| 4.6 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 4.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.6 | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| 4.6 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" |

### Acceptance criteria

| Id | Criterion | What was done and observed | Result |
|---|---|---|---|
| AC-1 | A pin-only change to `docs/openspec-flow.md` is absent from `unnamedFiles`, no `apply-proposals` stop | `archive-release-pin 1` (pin-only doc text and the real c561553 doc hunks), `6` (c561553's file list, proposals naming neither file) and `7` (the local stop through `collectState`: a pin-only doc edit opens the archive PR) pass in the 4.6 run and in run A at this head. `proof/real-run-amended.txt` A1 (doc as at c561553, archive branch whose proposal names only `CONTRIBUTING.md`): exit 0, `archive.unnamed` `[]`; my re-run of A1 at this head: exit 0, `[]` | pass |
| AC-2 | A doc change beyond the pin lines stays in `unnamedFiles` and stops with `files no approved proposal names: docs/openspec-flow.md` | `archive-release-pin 2` (changed sentence, added paragraph, marker line with other words changed) and the beyond-pin halves of `7`, `8`, `9` pass in the 4.6 run. `proof/real-run-amended.txt` A2 (A1 plus one edited sentence): exit 1, `["docs/openspec-flow.md"]`. I did not re-run A2; the unit tests above prove it at this head | pass |
| AC-3 | Any change to `plugins/openspec/hooks/change-loop-compozy.test.mjs`, a pin-assertion-only edit included, leaves it in `unnamedFiles` | `archive-release-pin 3` (renamed in phase 4: the pin-assertion-only edit is named, with the c561553 test hunks no longer read from a fixture) and `4` pass in the 4.6 run. `PIN_LINE_FILES` at `plugins/openspec/hooks/deliver-check.mjs:1360` is `['docs/openspec-flow.md']`; `git grep -n "PIN_TEST_LINES\|change-loop-compozy" -- plugins/openspec/hooks/deliver-check.mjs` prints only `PIN_LINE_FILES` lines (1329, 1360, 1364, 1371), no `PIN_TEST_LINES` and no test path. `proof/real-run-amended.txt` A3 (the test file set to the c561553 pin hunk, 2 insertions and 1 deletion): exit 1, `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`; my re-run of A3 at this head: the same exit and list | pass |
| AC-4 | The pin test reads the pin from `plugin.json`, holds no release version literal or change name outside the `v0.20.0` floor, and passes | `archive-release-pin 12` passes in the 4.6 run (it failed in `proof/red-4.txt` on the first version literal of the pin block). `change-loop docs: the design records the answers` passes at this head (4.6 run, and my A6 re-run: `tests 1`, `pass 1`, `fail 0`). Reading the test body (line 325 and following): `version` comes from `plugins/openspec/.claude-plugin/plugin.json` and `pinMismatches(flow, version)` is asserted `[]`; the only `v0.20.0` hits are the three floor lines. Version-like literals in the test file: 11 now, 40 at `34e3500`, a drop of 29 (`git grep -c`), equal to the 29 lines task 4.3 removes. Its diff against the merge base is 28 deletions and no addition | pass |
| AC-5 | A file missing on either side, or unreadable, stays in `unnamedFiles` | `archive-release-pin 5` (missing, unreadable, other path, CRLF, lost and gained final newline, empty base against text; the two empty-base `true` cases) and the deleted-file half of `7` pass in the 4.6 run. `proof/real-run-amended.txt` A4 (`git rm docs/openspec-flow.md`): exit 1, `["docs/openspec-flow.md"]`. I did not re-run A4 | pass |
| AC-6 | `RELEASE_FILE` unchanged, `RELEASE_FILE.test('docs/openspec-flow.md')` false, conflict classification unchanged | `export const RELEASE_FILE` at `deliver-check.mjs:1372` is the same line as on `origin/main` (`diff` of the two lines prints nothing). `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` passes in the 4.6 run; the whole `release-merge.test.mjs` (the conflict classification, `release-merge-conflict 15` and `16` included) and the `conduct pin` tests pass. `git grep -n "PIN_MARKER\|PIN_TOKEN" -- plugins/openspec/hooks/release-merge.mjs` prints nothing. `deliver-check.mjs` has no import of `release-merge.mjs`; `git grep -n "release-merge"` on it prints only the two comment lines 1373 and 1374 | pass |
| AC-7 | `devkit-reviews --ci` applies the same rule through the shared function | `archive-release-pin 8` (`--ci` on an archive branch applies the same pin rule) and `9` (`--ci` from only `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`: a pin-only archive passes, one beyond the pin fails) pass; `archive-release-pin 10` (changed in phase 4 to the one-file list: `release-merge.mjs` re-exports the one pin definition and the archive check reads by content exactly `docs/openspec-flow.md`) passes in `release-merge.test.mjs` (it failed in `proof/red-4.txt` with the extra test path). `git grep -n "unnamedFiles(" -- plugins/openspec/hooks/deliver-check.mjs` prints the definition (1380) and two callers (1694 with `a.changed?.texts`, 2508 with `changes.texts`). `proof/real-run-amended.txt` A5 (consumer folder of only the three files): exit 0, `[]` | pass |
| AC-8 | The flow page, ADR 0003's list and ADR 0027's header state the one-file rule; the config names ADR 0030; `check.py` and `gen-catalog.py --check` pass | `archive-release-pin 11` passes in the 4.6 run (it failed in `proof/red-4.txt` on the first missing document text). `docs/openspec-flow.md` line 571 (the file-check paragraph) says one file passes by its content, `docs/openspec-flow.md`, "as amended by ADR 0030", and "No test file passes by its content"; `git grep -n "change-loop-compozy.test.mjs" -- docs/openspec-flow.md docs/adr/0003-auto-merge-the-archive-pr.md` prints nothing. ADR 0003 holds `- Amended by ADR 0030` (line 6) and ADR 0027 holds `- Amended by ADR 0030` (line 9); both ADRs and ADR 0030 hold `- Status: accepted`. `openspec/config.yaml` line 37 names `0030 the pin test reads the manifest, so only the flow page pins pass unnamed, amends 0003 and 0027`. Against the merge base: ADR 0003 4 added 0 removed, ADR 0027 111 added 0 removed, flow page 6 and 6, config 1 and 1. `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check`: exit 0 | pass |
| AC-9 | The real-run proof covers every case the plan declares, on a real archive branch, and the pin test passes with no release literal | `proof/real-run-amended.txt` holds the verbatim build script and cases A1 to A6, each with command, exit code and `archive.unnamed`, each equal to D-10 amended's Expected column: A1 pin-only doc passes (exit 0, `[]`); A2 doc beyond the pin does not (exit 1, doc named); A3 pin-assertion-only edit of `change-loop-compozy.test.mjs` is named (exit 1); A4 deleted doc is named (exit 1); A5 consumer folder of the three downloaded files passes a pin-only doc archive (exit 0, `[]`); A6 the pin test passes, 11 literals now against 40 at `34e3500`. They ran `deliver-check.mjs --ci --json` on scratch git repositories, not unit tests. I re-ran A1, A3 and A6 myself at this head, with the same results (see notes). `proof/real-run.txt` and `proof/real-run-head.txt` are earlier-phase records of the superseded test-file half and are not cited as proof. The local stop (`filesStop`) needs GitHub's answers, so it is proved by `archive-release-pin 7` through `collectState` with the fake `gh`, as the log says | pass |
| AC-10 | The c561553 doc diff is a fixture and passes; the file list leaves the doc out of `unnamedFiles`; the test-file fixtures are deleted | `plugins/openspec/hooks/fixtures/c561553/` holds `openspec-flow.before.txt` and `openspec-flow.after.txt` (15 lines each) and nothing else (`git ls-files`). `archive-release-pin 1` (doc hunks pass) and `6` (c561553's file list, no proposal naming the doc, leaves the doc out and names its test file as any test file is) pass in the 4.6 run. `proof/red-4.txt` shows test `6` failing before phase 4's code and the amended tests 3, 5, 6, 7, 8, 10, 11 and 12 failing for the amended behaviour while 1, 2, 4 and 9 passed | pass |
