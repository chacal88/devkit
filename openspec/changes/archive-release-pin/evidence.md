<!-- devkit-stage evidence result=passed attempt=7 commit=eb0e00a0a5a1965911a5868c95e13cbf9be6cdb6 -->
Commit: eb0e00a0a5a1965911a5868c95e13cbf9be6cdb6

# Evidence: archive-release-pin

Verified on 2026-11-24 at head `eb0e00a` (attempt 7; working tree clean before this file, no uncommitted change outside
`openspec/`), on the AMENDED plan: requirements answer A3, ADR 0030, design D-12, tasks phase 4. Attempt 6 verified
`7d0fa7a`; this file replaces it after the merge `eb0e00a`, which merged `origin/main` after train 3 (PR 117). Per the
coordinator's instruction, attempt 7 re-ran only the cheap checks at `eb0e00a`: one filtered run of the
`archive-release-pin`, `release list`, `change-loop docs: the design records the answers`, `release-merge-conflict 15`
and `version-pin` tests, `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
`openspec validate archive-release-pin --strict`, `claude plugin validate .`, and my own re-run of A1, A3 and A6 of
`proof/real-run-amended.txt`. A gate row that was not re-run keeps the earlier observation and says at which head it
was made. The filtered run used `node scripts/test-suite.mjs` (one process and one private TMPDIR per file) with
`TMPDIR=/var/tmp/devkit-archive-release-pin`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`. No fetch was
done: `origin/main` is the local ref `a347ac0` (merge of PR 117), the first parent of the merge `eb0e00a`. The whole
suite was not run here, by the coordinator's instruction: the delivery train proves it at the joined head.

## Verification

### Release numbers and ADR numbers (read at this head, from the local `origin/main` ref `a347ac0`)

| Item | `origin/main` (`git show origin/main:...`) | This branch | Above main |
|---|---|---|---|
| devkit-openspec `plugins/openspec/.claude-plugin/plugin.json` `version` | `0.39.2` | `0.40.0` | yes |
| marketplace `.claude-plugin/marketplace.json` `metadata.version` | `0.44.0` | `0.45.0` | yes |
| marketplace entry of devkit-openspec | `0.39.2` | `0.40.0` | yes |

- `CHANGELOG.md`: main's top entry is `## 0.44.0 — release-merge leftovers`; this branch's top entry is
  `## 0.45.0 — the archive check lets the release pin lines pass unnamed` and main's 0.44.0 entry sits below it
  (`git diff --shortstat origin/main HEAD -- CHANGELOG.md`: 19 insertions, no deletion). The 0.45.0 entry says the CI
  snippet pins `v0.40.0`.
- ADR numbers 0027 and 0030 do not collide on main. `git ls-tree --name-only origin/main docs/adr/` ends at
  `0026-the-devkit-test-suite-runs-by-file-in-parallel.md`; the count of entries on main named `0027-` or `0030-` is 0.
  This branch adds `0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` and
  `0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`, both `- Status: accepted`.
- The pin lines of `docs/openspec-flow.md` are `v0.40.0` (lines 733, 734, 747; three lines); `v0.39.2` occurs 0 times.
  This is a number read from the local `origin/main` ref only: the flow's release step re-takes it from a fresh fetch,
  which this verification did not do.

### What changed since attempt 6 (counted at this head)

- `git log --oneline 7d0fa7a..HEAD` is the train 3 merge (main's `release-merge-leftovers` change, the archive of
  `stale-only-on-own-files`, the train record `openspec/trains/3.md`) and the merge commit `eb0e00a`. Most of that diff
  is main's.
- This change's own lines changed in two files only, both the renumbering above the new main:
  `git diff --stat 7d0fa7a HEAD` on the change's code, tests, fixtures, docs, config, `CONTRIBUTING.md`, `CHANGELOG.md`
  and manifests lists `CHANGELOG.md` (the 0.44.0 heading became 0.45.0; main's 0.44.0 entry was added below it) and
  `.claude-plugin/marketplace.json` (`metadata.version` 0.44.0 to 0.45.0, plus main's devkit-panel entry 0.3.0 to 0.3.1).
  `deliver-check.mjs`, `release-merge.mjs`, both test files, the fixtures, `docs/openspec-flow.md`, the ADRs,
  `CONTRIBUTING.md` and `openspec/config.yaml` have no line of this change that differs from `7d0fa7a`.
- The diff of the merge head against main in `plugins/openspec/hooks` (`git diff --stat origin/main HEAD`): 8 files,
  369 insertions and 56 deletions: `change-loop-compozy.test.mjs` (30 deletions, no addition),
  `deliver-check-archive.test.mjs`, `deliver-check-fixtures.mjs` (the `base` option of `archivePrRepo`),
  `deliver-check.mjs`, the two `c561553` fixtures, `release-merge.mjs` and `release-merge.test.mjs`, all this change's.
  `conduct-check.test.mjs` is not in this list: main's train 3 changed it (43 lines, `release-merge leftovers`) and this
  branch carries it unchanged.
- The attempt 6 correction of `CONTRIBUTING.md` step 5 (line 58) stays: it says a release moves the CI pins of
  `docs/openspec-flow.md` and no test, names the test as reading the manifest, and links ADR 0030. It is identical at
  `7d0fa7a` and now.

### Notes the reader needs

- No defect is open. The defect candidate of attempt 5 (`CONTRIBUTING.md` telling a release to move the CI-pin
  assertion of `change-loop-compozy.test.mjs`) was fixed in `7d0fa7a` and still reads as fixed at this head.
- Attempt 7 filtered run at `eb0e00a`: `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch
  GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^archive-release-pin "
  --test-name-pattern="^release list" --test-name-pattern="^change-loop docs: the design records the answers$"
  --test-name-pattern="^release-merge-conflict 15" --test-name-pattern="^version-pin "` on `deliver-check-archive`,
  `release-merge`, `change-loop-compozy` and `version-pin` test files: exit 0,
  `suite: 4 files, 81 tests, 81 pass, 0 fail, 64.2s, concurrency 2`, all four files `pass`. The log shows
  `archive-release-pin 1` to `12` each ✔ (the log lists `10` last, from `release-merge.test.mjs`),
  `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` ✔,
  `change-loop docs: the design records the answers` ✔ and
  `release-merge-conflict 15: the CI-pin check names the pin that differs from the manifest` ✔. The log is at
  `/var/tmp/devkit-archive-release-pin/attempt7-filtered.txt` (scratch, not committed). `release-merge-conflict 16` was
  not in this run's patterns (it was in attempt 5's runs and is covered by the delivery train's whole suite).
- Whole suite. The whole-suite row (task 3.2) is proved by the delivery train at the joined head (`openspec/config.yaml`
  `devkit.delivery`: `node scripts/test-suite.mjs && python3 scripts/check.py`). `proof/full-suite.txt` (merged head
  `687535a`: `suite: 38 files, 2928 tests, 2925 pass, 0 fail, 806.7s, concurrency 8`, `exit=0`) is a historical record
  of an earlier head, before the amendment and before the later merges of `origin/main`; it is not proof of this head.
- Entry files. After the `suite-speed` split, `conduct-check.test.mjs` and `guard.test.mjs` no longer import the
  deliver-check, release-merge and change-loop suites (tasks 1.5 and 2.4 say they do). Those two gate commands, run
  exactly as written, exit 0 but select few tests (10 and 2) when last run (attempt 5, at `0b4a801`); each was backed by
  a second run of the same patterns through `node scripts/test-suite.mjs` on the files that now hold the tests (Run A,
  79 tests, and Run B, 39 tests, both 0 fail). These were not repeated at `eb0e00a`; main's train 3 changed
  `conduct-check.test.mjs` (43 lines, not this change's), so the rows below that rest on it say "attempt 5, at `0b4a801`".
  The phase-4 gate (4.6) uses the file list that holds the tests and is the current gate.
- Superseded records. `proof/real-run.txt` (cases R1 to R8, run before the first merge, pin file `change-loop.test.mjs`)
  and `proof/real-run-head.txt` (cases R1 to R8 and X1 at `5ca9329`, pin file `change-loop-compozy.test.mjs`) are the
  earlier-phase records of the test-file half of the rule, which A3 and ADR 0030 withdraw. Their R3, R4, R6, R8 and X1
  results (a pin-only test file passes) no longer describe the code and prove nothing about it now. The cited proof of
  the amended code is `proof/real-run-amended.txt` and `proof/red-4.txt`.
- Pin test. `change-loop docs: the design records the answers` in `plugins/openspec/hooks/change-loop-compozy.test.mjs`
  (starts at line 325; the pin lines are 362 to 364) reads `version` from `plugins/openspec/.claude-plugin/plugin.json`
  (`0.40.0` here) and asserts `pinMismatches(flow, version)` is `[]`. Inside that test the only version literals are the
  `v0.20.0` slice-merge floor lines (359 to 361).
- Fixtures. `git ls-files plugins/openspec/hooks/fixtures/c561553` lists only `openspec-flow.after.txt` and
  `openspec-flow.before.txt` (15 lines each, counted at this head); the two `change-loop.test.*.txt` fixtures are gone.
- `openspec/roadmap.md` ticks of `archive-release-pin` and `release-pin-is-a-release-file` happen at archive; no
  acceptance criterion depends on it.
- My own re-run of A1, A3 and A6 at this head (recipe of the build script in `proof/real-run-amended.txt`, scratch
  repository `/var/tmp/devkit-archive-release-pin/verify-merge`, a fresh bare origin and clones, an archive branch whose
  approved proposal names only `CONTRIBUTING.md`, run as `env GITHUB_BASE_REF=main GITHUB_HEAD_REF=chore/archive-demo
  node plugins/openspec/hooks/deliver-check.mjs --ci --json`; the folder was removed afterwards and `ls` confirms it is
  gone): A1 (the doc as at c561553): exit 0, `archive.unnamed` `[]`. A3 (`change-loop-compozy.test.mjs` set to the
  c561553 pin hunk, `git diff --stat` 2 insertions and 1 deletion): exit 1, `archive.unnamed`
  `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`. A6 in the worktree: the pin test passes (`ℹ tests 1`,
  `pass 1`, `fail 0`, exit 0), and `git grep -c -E '[0-9]+\\?\.[0-9]+\\?\.[0-9]+'` on the test file counts 11 now
  against 40 at `34e3500`, a drop of 29. All equal to `proof/real-run-amended.txt`. A2, A4 and A5 were not re-run.

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.5 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 (re-run at `eb0e00a`, attempt 7) |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^P3j" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" plugins/openspec/hooks/conduct-check.test.mjs` | pass: exit 0, 10 tests, 10 pass, 0 fail (the tests `conduct-check.test.mjs` still holds or imports; attempt 5, at `0b4a801`; not re-run: coordinator's instruction, only the filtered run named above). Run A, same patterns on the five files that hold the tests: exit 0, 79 tests, 79 pass, 0 fail, including `archive-release-pin 1` to `12` and `release list` (attempt 5, at `0b4a801`). The attempt 7 filtered run at `eb0e00a` holds the same `archive-release-pin 1` to `12` and `release list` tests and passes (81 tests, 0 fail) |
| 1.5 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/merge-setup.test.mjs` | pass: exit 0, 24 tests, 24 pass, 0 fail (attempt 5, at `0b4a801`; not re-run at `eb0e00a`: coordinator's instruction) |
| 1.5 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (re-run at `eb0e00a`, attempt 7) |
| 2.4 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 (re-run at `eb0e00a`, attempt 7) |
| 2.4 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^change-loop docs: the design records the answers" --test-name-pattern="^release-merge pin" --test-name-pattern="^release-merge-conflict 1[56]:" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^upfront AC-5 docs" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^upfront D-18 docs" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/guard.test.mjs` | pass: exit 0, 2 tests, 2 pass, 0 fail (`guard.test.mjs` holds only `ADR 0003 exists` and `upfront AC-5 docs`; attempt 5, at `0b4a801`; not re-run at `eb0e00a`). Run B, same patterns on the seven files that hold the tests: exit 0, 39 tests, 39 pass, 0 fail (attempt 5, at `0b4a801`). The attempt 7 filtered run at `eb0e00a` re-ran `archive-release-pin 1` to `12`, `release list`, the pin test and `release-merge-conflict 15`: all pass |
| 2.4 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (re-run at `eb0e00a`, attempt 7) |
| 2.4 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run at `eb0e00a`, attempt 7) |
| 2.4 | `command claude plugin validate .` | pass: exit 0, "Validation passed" (re-run at `eb0e00a`, attempt 7) |
| 2.4 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" (re-run at `eb0e00a`, attempt 7) |
| 3.2 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 (re-run at `eb0e00a`, attempt 7) |
| 3.2 | `env TMPDIR=/var/tmp/devkit-archive-release-pin node scripts/test-suite.mjs` | pass: not run here by the coordinator's instruction; the delivery train proves the whole suite at the joined head. Last full run, historical: `proof/full-suite.txt` at `687535a`, `suite: 38 files, 2928 tests, 2925 pass, 0 fail, 806.7s`, `exit=0`. The attempt 7 filtered run at `eb0e00a` passes (4 files, 81 tests, 0 fail) |
| 3.2 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (re-run at `eb0e00a`, attempt 7) |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run at `eb0e00a`, attempt 7) |
| 3.2 | `command claude plugin validate .` | pass: exit 0, "Validation passed" (re-run at `eb0e00a`, attempt 7) |
| 3.2 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" (re-run at `eb0e00a`, attempt 7) |
| 4.6 | `mkdir -p /var/tmp/devkit-archive-release-pin` | pass: exit 0 (re-run at `eb0e00a`, attempt 7) |
| 4.6 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" --test-name-pattern="^change-loop docs: the design records the answers$" --test-name-pattern="^version-pin " --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^delivery-models docs: the documents follow" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/release-tags.test.mjs` | pass: exit 0, `suite: 10 files, 149 tests, 149 pass, 0 fail, 128.3s, concurrency 2`; all ten files `pass` (attempt 5, at `0b4a801`; the full ten-file run was not repeated at `eb0e00a`: coordinator's instruction). The attempt 7 filtered run at `eb0e00a` repeats the part of it that holds this change's tests, on `deliver-check-archive`, `release-merge`, `change-loop-compozy` and `version-pin`: `archive-release-pin 1` to `12`, `release list`, `change-loop docs: the design records the answers`, `release-merge-conflict 15` and the `version-pin` tests each ✔ (4 files, 81 tests, 0 fail) |
| 4.6 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (re-run at `eb0e00a`, attempt 7) |
| 4.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 (re-run at `eb0e00a`, attempt 7) |
| 4.6 | `command claude plugin validate .` | pass: exit 0, "Validation passed" (re-run at `eb0e00a`, attempt 7) |
| 4.6 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" (re-run at `eb0e00a`, attempt 7) |

### Acceptance criteria

| Id | Criterion | What was done and observed | Result |
|---|---|---|---|
| AC-1 | A pin-only change to `docs/openspec-flow.md` is absent from `unnamedFiles`, no `apply-proposals` stop | `archive-release-pin 1` (pin-only doc text and the real c561553 doc hunks), `6` (c561553's file list, proposals naming neither file) and `7` (the local stop through `collectState`: a pin-only doc edit opens the archive PR) pass in the attempt 7 filtered run at `eb0e00a`. My re-run of A1 at this head (doc as at c561553, archive branch whose proposal names only `CONTRIBUTING.md`): exit 0, `archive.unnamed` `[]`, equal to `proof/real-run-amended.txt` A1 | pass |
| AC-2 | A doc change beyond the pin lines stays in `unnamedFiles` and stops with `files no approved proposal names: docs/openspec-flow.md` | `archive-release-pin 2` (changed sentence, added paragraph, marker line with other words changed) and the beyond-pin halves of `7`, `8`, `9` pass in the attempt 7 run. `proof/real-run-amended.txt` A2 (A1 plus one edited sentence): exit 1, `["docs/openspec-flow.md"]`. I did not re-run A2; the unit tests above prove it at this head | pass |
| AC-3 | Any change to `plugins/openspec/hooks/change-loop-compozy.test.mjs`, a pin-assertion-only edit included, leaves it in `unnamedFiles` | `archive-release-pin 3` (the pin-assertion-only edit is named) and `4` pass in the attempt 7 run. `PIN_LINE_FILES` at `plugins/openspec/hooks/deliver-check.mjs:1373` is `['docs/openspec-flow.md']`; `git grep -n "PIN_TEST_LINES\|change-loop-compozy" -- plugins/openspec/hooks/deliver-check.mjs` prints nothing (task 4.2's check). My re-run of A3 at this head (the test file set to the c561553 pin hunk, 2 insertions and 1 deletion): exit 1, `archive.unnamed` `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`, equal to `proof/real-run-amended.txt` A3 | pass |
| AC-4 | The pin test reads the pin from `plugin.json`, holds no release version literal or change name outside the `v0.20.0` floor, and passes | `archive-release-pin 12` passes in the attempt 7 run (it failed in `proof/red-4.txt` on the first version literal of the pin block). `change-loop docs: the design records the answers` passes at this head (attempt 7 run, and my A6 re-run: `tests 1`, `pass 1`, `fail 0`). Reading the test body (lines 362 to 364): `version` comes from `plugins/openspec/.claude-plugin/plugin.json` and `pinMismatches(flow, version)` is asserted `[]`; the only `v0.20.0` hits are the floor lines 359 to 361. The test passes at `0.40.0` with the three flow-page pins at `v0.40.0`. Version-like literals in the test file: 11 now, 40 at `34e3500`, a drop of 29 (`git grep -c`). Its diff against the merge base `9dff573` is 28 deletions and no addition | pass |
| AC-5 | A file missing on either side, or unreadable, stays in `unnamedFiles` | `archive-release-pin 5` (missing, unreadable, other path, CRLF, lost and gained final newline, empty base against text; the two empty-base `true` cases) and the deleted-file half of `7` pass in the attempt 7 run. `proof/real-run-amended.txt` A4 (`git rm docs/openspec-flow.md`): exit 1, `["docs/openspec-flow.md"]`. I did not re-run A4 | pass |
| AC-6 | `RELEASE_FILE` unchanged, `RELEASE_FILE.test('docs/openspec-flow.md')` false, conflict classification unchanged | `export const RELEASE_FILE` at `deliver-check.mjs:1385` (the same line as on `main`, which this branch's diff does not touch). `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` passes in the attempt 7 run, and so does `release-merge-conflict 15`, the CI-pin check that names the pin differing from the manifest. The whole `release-merge.test.mjs` (the conflict classification, `release-merge-conflict 16` included) and the `conduct pin` tests passed at `0b4a801` (attempt 5; not repeated). `git grep -n "PIN_MARKER\|PIN_TOKEN" -- plugins/openspec/hooks/release-merge.mjs` prints nothing. `deliver-check.mjs` has no import of `release-merge.mjs`; `git grep -n "release-merge"` on it prints only the two comment lines 1386 and 1387 | pass |
| AC-7 | `devkit-reviews --ci` applies the same rule through the shared function | `archive-release-pin 8` (`--ci` on an archive branch applies the same pin rule) and `9` (`--ci` from only `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`: a pin-only archive passes, one beyond the pin fails) pass; `archive-release-pin 10` (`release-merge.mjs` re-exports the one pin definition and the archive check reads by content exactly `docs/openspec-flow.md`) passes in `release-merge.test.mjs`; all in the attempt 7 run. `git grep -n "unnamedFiles(" -- plugins/openspec/hooks/deliver-check.mjs` prints the definition (1393) and two callers (1707 with `a.changed?.texts`, 2521 with `changes.texts`). `proof/real-run-amended.txt` A5 (consumer folder of only the three files): exit 0, `[]`; not re-run | pass |
| AC-8 | The flow page, ADR 0003's list and ADR 0027's header state the one-file rule; the config names ADR 0030; `check.py` and `gen-catalog.py --check` pass | `archive-release-pin 11` passes in the attempt 7 run (it failed in `proof/red-4.txt` on the first missing document text). `docs/openspec-flow.md` line 571 (the file-check paragraph) names ADR 0030; `git grep -n "change-loop-compozy.test.mjs" -- docs/openspec-flow.md docs/adr/0003-auto-merge-the-archive-pr.md` prints nothing (exit 1). ADR 0003 holds `- Amended by ADR 0030` (line 6) and ADR 0027 holds `- Amended by ADR 0030` (line 9); ADR 0027 and ADR 0030 hold `- Status: accepted`. `openspec/config.yaml` names ADR 0030. Against `origin/main` (`a347ac0`): ADR 0003 4 insertions and no deletion; flow page and config 7 insertions and 7 deletions together. `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `claude plugin validate .` all exit 0 at this head. The `CONTRIBUTING.md` sentence (step 5, line 58) says a release moves the CI pins of the flow page and no test, and links ADR 0030 (fixed in `7d0fa7a`, unchanged since) | pass |
| AC-9 | The real-run proof covers every case the plan declares, on a real archive branch, and the pin test passes with no release literal | `proof/real-run-amended.txt` holds the verbatim build script and cases A1 to A6, each with command, exit code and `archive.unnamed`, each equal to D-10 amended's Expected column: A1 pin-only doc passes (exit 0, `[]`); A2 doc beyond the pin does not (exit 1, doc named); A3 pin-assertion-only edit of `change-loop-compozy.test.mjs` is named (exit 1); A4 deleted doc is named (exit 1); A5 consumer folder of the three downloaded files passes a pin-only doc archive (exit 0, `[]`); A6 the pin test passes, 11 literals now against 40 at `34e3500`. They ran `deliver-check.mjs --ci --json` on scratch git repositories, not unit tests. I re-ran A1, A3 and A6 myself at `eb0e00a`, with the same results (see notes). `proof/real-run.txt` and `proof/real-run-head.txt` are earlier-phase records of the superseded test-file half and are not cited as proof. The local stop (`filesStop`) needs GitHub's answers, so it is proved by `archive-release-pin 7` through `collectState` with the fake `gh`, as the log says | pass |
| AC-10 | The c561553 doc diff is a fixture and passes; the file list leaves the doc out of `unnamedFiles`; the test-file fixtures are deleted | `plugins/openspec/hooks/fixtures/c561553/` holds `openspec-flow.before.txt` and `openspec-flow.after.txt` (15 lines each) and nothing else (`git ls-files`). `archive-release-pin 1` (doc hunks pass) and `6` (c561553's file list, no proposal naming the doc, leaves the doc out and names its test file as any test file is) pass in the attempt 7 run. `proof/red-4.txt` shows test `6` failing before phase 4's code and the amended tests 3, 5, 6, 7, 8, 10, 11 and 12 failing for the amended behaviour while 1, 2, 4 and 9 passed | pass |
