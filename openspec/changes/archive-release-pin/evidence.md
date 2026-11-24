<!-- devkit-stage evidence result=passed attempt=5 commit=0b4a801a6054254efea3b91c4cad4c6047ac128e -->
Commit: 0b4a801a6054254efea3b91c4cad4c6047ac128e

# Evidence: archive-release-pin

Verified on 2026-11-24 at head `0b4a801` (attempt 5; working tree clean before this file, no uncommitted change), on the
AMENDED plan: requirements answer A3, ADR 0030, design D-12, tasks phase 4. Attempt 4 (`0e76c41`) verified the same plan;
this file replaces it after `0b4a801` merged `origin/main` again (trains 1 and 2: main at devkit-openspec 0.39.1 /
marketplace 0.43.1; this release stays above it at 0.40.0 / 0.44.0). Every filtered run below ran at this head through
`node scripts/test-suite.mjs` (one process and one private TMPDIR per file) with
`TMPDIR=/var/tmp/devkit-archive-release-pin`, `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`, except the two
entry-file runs and the `merge-setup` run, which use `node --test` as `tasks.md` writes them. No fetch was done. The
whole suite was not run here, by the coordinator's instruction: the delivery train runs it at the joined head.

## Verification

### What the merge `0b4a801` changed (counted at this head)

- The change's own folder: `git diff --stat 0e76c41..HEAD -- openspec/changes/archive-release-pin` lists only
  `evidence.md`, `review.md` and the five files of `reviews/` (the evidence and review commits `b906df5` and `542a8b3`,
  not the merge). `proposal.md`, `design.md`, `tasks.md`, `requirements.md`, `decisions.md`, `specs/` and `proof/` are
  unchanged.
- The change's own code, tests, fixtures, ADRs and config are unchanged by the merge: `git diff --stat 0e76c41..HEAD --`
  on `plugins/openspec/hooks/release-merge.mjs`, `release-merge.test.mjs`, `change-loop-compozy.test.mjs`,
  `fixtures/`, `docs/adr/` and `openspec/config.yaml` prints nothing. The release numbers (`plugin.json` `0.40.0`,
  `marketplace.json` `metadata.version` `0.44.0`, the devkit-openspec entry `0.40.0`) are unchanged too.
- Two code files DID change between `0e76c41` and `HEAD`, both brought from `main` (the change `own-pr-archive-paths`),
  not by this change: `plugins/openspec/hooks/deliver-check.mjs` (`inOwnArchiveFolder` and the new `isOwnPr`, near
  line 694) and `plugins/openspec/hooks/deliver-check-archive.test.mjs` (seven `field-fixes 4` tests). This corrects
  the premise that the code files are unchanged by the merge: they are unchanged in this change's own lines. Proof: the
  added and removed lines of this change's diff against its merge base `9dff573` are the same before and after the merge
  (`diff` of the two `git diff` line sets prints nothing, for both files; `deliver-check.mjs` +56 -8, the archive test
  file +266 -2, in both `9dff573..0e76c41` and `HEAD^2..HEAD`). The remaining diff of `HEAD` against `main`
  (`HEAD^2` = `8085104`, the local `origin/main` ref) in `plugins/openspec/hooks` is 8 files, 369 insertions and 55
  deletions, all this change's.
- Other files from `main`: `CHANGELOG.md` (the 0.43.1 entry; ours is above it), `docs/openspec-flow.md` (one line,
  the "Finding the change PR" paragraph, not a pin line; the three `v0.40.0` pin lines are ours),
  `CONTRIBUTING.md` (one sentence, see the defect note below), `openspec/roadmap.md`, `openspec/specs/change-delivery/spec.md`,
  `openspec/trains/1.md` and `2.md`, and the archived `own-pr-archive-paths` folder.
- The pin block of `change-loop-compozy.test.mjs` stays removed: `git diff --merge-base 9dff573 --shortstat` on the
  file is 1 file changed, 28 deletions, no addition. The new `isOwnPr` tests are not matched by the 4.6 name
  patterns, so I ran them too: `^field-fixes 4` on `deliver-check-archive.test.mjs`: exit 0,
  `suite: 1 files, 25 tests, 25 pass, 0 fail, 16.8s`.

### Notes the reader needs

- Defect candidate, outside every acceptance criterion: `CONTRIBUTING.md` line 58 (step 5 of the release steps, arrived
  from `main` with `own-pr-archive-paths`, `git log -S` finds `d69c9c2`) ends with "A release that changes
  devkit-openspec's version also moves the CI-pin assertion of `plugins/openspec/hooks/change-loop-compozy.test.mjs`
  (the test `change-loop docs: the design records the answers`: the `match` of the new `v<version>`, a `doesNotMatch`
  for the version before it and the invariant comment above them), so list that test in the plan's release task."
  With ADR 0030 and this change that test reads the version from `plugin.json` and holds no such assertion, so no
  release moves it, and the sentence is stale: it tells a release to edit a test file that, in an archive, needs a named
  proposal. `check.py` does not catch it (exit 0). It is not in this change's files; the human decides whether to fix
  it here or in a follow-up. Reported, not fixed.
- Whole suite. The whole-suite row (task 3.2) is proved by the delivery train at the joined head (`openspec/config.yaml`
  `devkit.delivery`: `node scripts/test-suite.mjs && python3 scripts/check.py`). `proof/full-suite.txt` (merged head
  `687535a`: `suite: 38 files, 2928 tests, 2925 pass, 0 fail, 806.7s, concurrency 8`, `exit=0`) is a historical record
  of an earlier head, before the amendment and before the later merges of `origin/main`; it is not proof of this head.
- Entry files. After the `suite-speed` split, `conduct-check.test.mjs` and `guard.test.mjs` no longer import the
  deliver-check, release-merge and change-loop suites (tasks 1.5 and 2.4 say they do). Those two gate commands, run
  exactly as written, exit 0 but select few tests (10 and 2); each is backed by a second run of the same patterns
  through `node scripts/test-suite.mjs` on the files that now hold the tests. Run A (the 1.5 patterns;
  `deliver-check-archive`, `deliver-check-cli`, `deliver-check`, `release-merge`, `conduct-check` test files): exit 0,
  `suite: 5 files, 79 tests, 79 pass, 0 fail, 70.8s, concurrency 2`, holding `archive-release-pin 1` to `12` and
  `release list`. Run B (the 2.4 patterns; `guard`, `deliver-check-archive`, `deliver-check-cli`, `release-merge`,
  `change-loop-compozy`, `roadmap-loop-upfront`, `release-tags` test files): exit 0, `suite: 7 files, 39 tests,
  39 pass, 0 fail, 7.1s`. The phase-4 gate (4.6) uses the file list that holds the tests, and is the current gate.
- Superseded records. `proof/real-run.txt` (cases R1 to R8, run before the first merge, pin file `change-loop.test.mjs`)
  and `proof/real-run-head.txt` (cases R1 to R8 and X1 at `5ca9329`, pin file `change-loop-compozy.test.mjs`) are the
  earlier-phase records of the test-file half of the rule, which A3 and ADR 0030 withdraw. Their R3, R4, R6, R8 and X1
  results (a pin-only test file passes) no longer describe the code and prove nothing about it now. The cited proof of
  the amended code is `proof/real-run-amended.txt` and `proof/red-4.txt`.
- Pin test. `change-loop docs: the design records the answers` in `plugins/openspec/hooks/change-loop-compozy.test.mjs`
  (starts at line 325; the pin lines are 362 to 364) reads `version` from `plugins/openspec/.claude-plugin/plugin.json`
  (`0.40.0` here) and asserts `pinMismatches(flow, version)` is `[]`. `docs/openspec-flow.md` holds three lines with
  `v0.40.0` (733, 734, 747). Inside that test the only version literals are the `v0.20.0` slice-merge floor lines (359
  to 361), and the only change name is `review-writer-prompt` in the roadmap-line assertion (outside the pin block).
- Fixtures. `git ls-files plugins/openspec/hooks/fixtures/c561553` lists only `openspec-flow.after.txt` and
  `openspec-flow.before.txt` (15 lines each, counted at this head); the two `change-loop.test.*.txt` fixtures are gone.
- The release number and ADR numbers. `plugin.json` is `0.40.0`. The local `origin/main` ref is `8085104`, equal to the
  merge parent `HEAD^2`; the flow's release step re-takes the number from a fresh `origin/main` (no fetch here), so a
  number collision with a sibling merged after `8085104`, if any, is not checked by this verification. ADR 0027 and
  ADR 0030 both hold `- Status: accepted`.
- `openspec/roadmap.md` ticks of `archive-release-pin` and `release-pin-is-a-release-file` happen at archive; no
  acceptance criterion depends on it.
- My own re-run of A1, A3 and A6 (recipe of the build script in `proof/real-run-amended.txt`, scratch repository
  `/var/tmp/devkit-archive-release-pin/verify-merge`, a fresh bare origin and clones, an archive branch whose approved
  proposal names only `CONTRIBUTING.md`, run as `env GITHUB_BASE_REF=main GITHUB_HEAD_REF=chore/archive-demo node
  plugins/openspec/hooks/deliver-check.mjs --ci --json`; the folder was removed afterwards and `ls` confirms it is
  gone): A1 (the doc as at c561553): exit 0, `archive.unnamed` `[]`. A3 (`change-loop-compozy.test.mjs` set to the
  c561553 pin hunk, `git diff --stat` 2 insertions and 1 deletion): exit 1, `archive.unnamed`
  `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`. A6 in the worktree: the pin test passes (`ℹ tests 1`,
  `pass 1`, `fail 0`, exit 0), and `git grep -c -E '[0-9]+\\?\.[0-9]+\\?\.[0-9]+'` on the test file counts 11 now
  against 40 at `34e3500`, a drop of 29. All equal to `proof/real-run-amended.txt`. A2, A4 and A5 were not re-run.

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
| 4.6 | `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" --test-name-pattern="^change-loop docs: the design records the answers$" --test-name-pattern="^version-pin " --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^delivery-models docs: the documents follow" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/release-tags.test.mjs` | pass: exit 0, `suite: 10 files, 149 tests, 149 pass, 0 fail, 128.3s, concurrency 2`; all ten files `pass` (including `deliver-check-archive`, `release-merge`, `change-loop-compozy` and `version-pin`); `archive-release-pin 1` to `12`, `release list` and `change-loop docs: the design records the answers` each ✔ |
| 4.6 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 4.6 | `python3 scripts/gen-catalog.py --check` | pass: exit 0 |
| 4.6 | `command claude plugin validate .` | pass: exit 0, "Validation passed" |
| 4.6 | `openspec validate archive-release-pin --strict` | pass: exit 0, "Change 'archive-release-pin' is valid" |

### Acceptance criteria

| Id | Criterion | What was done and observed | Result |
|---|---|---|---|
| AC-1 | A pin-only change to `docs/openspec-flow.md` is absent from `unnamedFiles`, no `apply-proposals` stop | `archive-release-pin 1` (pin-only doc text and the real c561553 doc hunks), `6` (c561553's file list, proposals naming neither file) and `7` (the local stop through `collectState`: a pin-only doc edit opens the archive PR) pass in the 4.6 run and in run A at this head. My re-run of A1 at this head (doc as at c561553, archive branch whose proposal names only `CONTRIBUTING.md`): exit 0, `archive.unnamed` `[]`, equal to `proof/real-run-amended.txt` A1 | pass |
| AC-2 | A doc change beyond the pin lines stays in `unnamedFiles` and stops with `files no approved proposal names: docs/openspec-flow.md` | `archive-release-pin 2` (changed sentence, added paragraph, marker line with other words changed) and the beyond-pin halves of `7`, `8`, `9` pass in the 4.6 run. `proof/real-run-amended.txt` A2 (A1 plus one edited sentence): exit 1, `["docs/openspec-flow.md"]`. I did not re-run A2; the unit tests above prove it at this head | pass |
| AC-3 | Any change to `plugins/openspec/hooks/change-loop-compozy.test.mjs`, a pin-assertion-only edit included, leaves it in `unnamedFiles` | `archive-release-pin 3` (the pin-assertion-only edit is named) and `4` pass in the 4.6 run. `PIN_LINE_FILES` at `plugins/openspec/hooks/deliver-check.mjs:1373` is `['docs/openspec-flow.md']`; `git grep -n "PIN_TEST_LINES\|change-loop-compozy" -- plugins/openspec/hooks/deliver-check.mjs` prints nothing (task 4.2's check). My re-run of A3 at this head (the test file set to the c561553 pin hunk, 2 insertions and 1 deletion): exit 1, `archive.unnamed` `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]`, equal to `proof/real-run-amended.txt` A3 | pass |
| AC-4 | The pin test reads the pin from `plugin.json`, holds no release version literal or change name outside the `v0.20.0` floor, and passes | `archive-release-pin 12` passes in the 4.6 run (it failed in `proof/red-4.txt` on the first version literal of the pin block). `change-loop docs: the design records the answers` passes at this head (4.6 run, and my A6 re-run: `tests 1`, `pass 1`, `fail 0`). Reading the test body (lines 362 to 364): `version` comes from `plugins/openspec/.claude-plugin/plugin.json` and `pinMismatches(flow, version)` is asserted `[]`; the only `v0.20.0` hits are the floor lines 359 to 361. Version-like literals in the test file: 11 now, 40 at `34e3500`, a drop of 29 (`git grep -c`), equal to the 29 lines task 4.3 removes. Its diff against the merge base `9dff573` is 28 deletions and no addition | pass |
| AC-5 | A file missing on either side, or unreadable, stays in `unnamedFiles` | `archive-release-pin 5` (missing, unreadable, other path, CRLF, lost and gained final newline, empty base against text; the two empty-base `true` cases) and the deleted-file half of `7` pass in the 4.6 run. `proof/real-run-amended.txt` A4 (`git rm docs/openspec-flow.md`): exit 1, `["docs/openspec-flow.md"]`. I did not re-run A4 | pass |
| AC-6 | `RELEASE_FILE` unchanged, `RELEASE_FILE.test('docs/openspec-flow.md')` false, conflict classification unchanged | `export const RELEASE_FILE` at `deliver-check.mjs:1385` is the same line as on `main` (`diff` of that line at `HEAD^2` and now prints nothing). `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` passes in the 4.6 run; the whole `release-merge.test.mjs` (the conflict classification, `release-merge-conflict 15` and `16` included) and the `conduct pin` tests pass. `git grep -n "PIN_MARKER\|PIN_TOKEN" -- plugins/openspec/hooks/release-merge.mjs` prints nothing. `deliver-check.mjs` has no import of `release-merge.mjs`; `git grep -n "release-merge"` on it prints only the two comment lines 1386 and 1387 | pass |
| AC-7 | `devkit-reviews --ci` applies the same rule through the shared function | `archive-release-pin 8` (`--ci` on an archive branch applies the same pin rule) and `9` (`--ci` from only `guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`: a pin-only archive passes, one beyond the pin fails) pass; `archive-release-pin 10` (`release-merge.mjs` re-exports the one pin definition and the archive check reads by content exactly `docs/openspec-flow.md`) passes in `release-merge.test.mjs`. `git grep -n "unnamedFiles(" -- plugins/openspec/hooks/deliver-check.mjs` prints the definition (1393) and two callers (1707 with `a.changed?.texts`, 2521 with `changes.texts`). `proof/real-run-amended.txt` A5 (consumer folder of only the three files): exit 0, `[]`; not re-run | pass |
| AC-8 | The flow page, ADR 0003's list and ADR 0027's header state the one-file rule; the config names ADR 0030; `check.py` and `gen-catalog.py --check` pass | `archive-release-pin 11` passes in the 4.6 run (it failed in `proof/red-4.txt` on the first missing document text). `docs/openspec-flow.md` line 571 (the file-check paragraph) names ADR 0030 and says "No test file passes by its content"; `git grep -n "change-loop-compozy.test.mjs" -- docs/openspec-flow.md docs/adr/0003-auto-merge-the-archive-pr.md` prints nothing (exit 1). ADR 0003 holds `- Amended by ADR 0030` (line 6) and ADR 0027 holds `- Amended by ADR 0030` (line 9); ADR 0027 and ADR 0030 hold `- Status: accepted`. `openspec/config.yaml` line 37 names ADR 0030. Against the merge base: ADR 0003 4 added 0 removed; flow page, ADR 0027 and config together 119 added and 8 removed (the ADR 0027 file is new on this branch). `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check`: exit 0. The stale `CONTRIBUTING.md` sentence (notes above) is outside this criterion | pass |
| AC-9 | The real-run proof covers every case the plan declares, on a real archive branch, and the pin test passes with no release literal | `proof/real-run-amended.txt` holds the verbatim build script and cases A1 to A6, each with command, exit code and `archive.unnamed`, each equal to D-10 amended's Expected column: A1 pin-only doc passes (exit 0, `[]`); A2 doc beyond the pin does not (exit 1, doc named); A3 pin-assertion-only edit of `change-loop-compozy.test.mjs` is named (exit 1); A4 deleted doc is named (exit 1); A5 consumer folder of the three downloaded files passes a pin-only doc archive (exit 0, `[]`); A6 the pin test passes, 11 literals now against 40 at `34e3500`. They ran `deliver-check.mjs --ci --json` on scratch git repositories, not unit tests. I re-ran A1, A3 and A6 myself at this head, with the same results (see notes). `proof/real-run.txt` and `proof/real-run-head.txt` are earlier-phase records of the superseded test-file half and are not cited as proof. The local stop (`filesStop`) needs GitHub's answers, so it is proved by `archive-release-pin 7` through `collectState` with the fake `gh`, as the log says | pass |
| AC-10 | The c561553 doc diff is a fixture and passes; the file list leaves the doc out of `unnamedFiles`; the test-file fixtures are deleted | `plugins/openspec/hooks/fixtures/c561553/` holds `openspec-flow.before.txt` and `openspec-flow.after.txt` (15 lines each) and nothing else (`git ls-files`). `archive-release-pin 1` (doc hunks pass) and `6` (c561553's file list, no proposal naming the doc, leaves the doc out and names its test file as any test file is) pass in the 4.6 run. `proof/red-4.txt` shows test `6` failing before phase 4's code and the amended tests 3, 5, 6, 7, 8, 10, 11 and 12 failing for the amended behaviour while 1, 2, 4 and 9 passed | pass |
