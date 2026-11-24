<!-- devkit-stage tasks result=passed attempt=3 commit=34e3500db260bff6af03280818740ef85a2eb1a3 -->
# Tasks

Change: `archive-release-pin` · Date: 2026-11-23, amended 2026-11-24 (phase 4, ADR 0030) · Owner:
Kaue (chacal88) · Base: `d2010ca` (phase 4 at `34e3500`) · PRD / tech spec: n/a

Work only in this change's worktree (`/home/kaue/repos/devkit/.claude/worktrees/archive-release-pin`),
on its branch `archive-release-pin`, with `TMPDIR=/var/tmp/devkit-archive-release-pin`. Every rule,
name, text and test is in `design.md`: D-1 the move of the pin definition, D-2 the rule, D-3 the
read, D-4 `unnamedFiles`, D-5 the fixtures, D-6 the new tests, D-7 the existing tests and helpers,
D-8 the documents, D-9 the release, D-10 the real-run proof. The implementer copies them and makes
no design choice.

Every gate is one backticked command, run as written. Each `&&` part runs on its own, no part holds
a `|` (several `--test-name-pattern` flags select the tests), and every gate exits 0 when its phase
is done. Every hook gate sets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`, as a pull-request run on CI
does, and runs with `--test-concurrency=1` and the private `TMPDIR` above. The entry files load
their imports: `conduct-check.test.mjs` runs the deliver-check and release-merge suites too, and
`change-loop.test.mjs` runs those and the conduct-check suite. The tests need the `openspec` CLI 2.x
on `PATH`.

No test suite runs during planning. The phase gates are filtered runs. The whole suite (`node --test
plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) is the gate of phase 3. The owner, or the
coordinating session, runs it once as a background command of the tool, never with a shell `&` and
never inside an implementer subagent.

Test first: tasks 1.2 and 2.1 write the tests, run them on the code before the fix, and save the
output, as printed, under `openspec/changes/archive-release-pin/proof/`. That run is the task's
check, never a gate. An existing test or helper is edited only as `design.md` D-7 says; the commit
message names its invariant, layer and suite. Leave no backup or scratch file in the tree, and end
every task with `git status --short`.

| Id | Tasks |
|---|---|
| AC-1 | 1.2, 1.4, 1.5, 3.1, 3.2; 4.1, 4.5, 4.6 |
| AC-2 | 1.2, 1.4, 1.5, 3.1, 3.2; 4.1, 4.5, 4.6 |
| AC-3 | (phases 1 to 3 delivered the withdrawn wording) 4.1, 4.2, 4.5, 4.6 |
| AC-4 | (phases 1 to 3 delivered the withdrawn wording) 4.1, 4.3, 4.5, 4.6 |
| AC-10 | 1.1, 1.2, 1.4, 1.5, 3.1; 4.1, 4.2, 4.6 |
| AC-5 | 1.2, 1.4, 1.5, 3.1, 3.2; 4.1, 4.5, 4.6 |
| AC-6 | 1.2, 1.3, 1.5, 2.4, 3.2; 4.1, 4.6 |
| AC-7 | 1.2, 1.3, 1.4, 1.5, 3.1, 3.2; 4.1, 4.5, 4.6 |
| AC-8 | 2.1, 2.2, 2.4, 3.2; 4.1, 4.4, 4.6 |
| AC-9 | 3.1 (the withdrawn case set); 4.5 |

Phases 1 to 3 are delivered and stay ticked as the record of their time; their paths (`change-loop.test.mjs`,
`deliver-check.test.mjs`) and the test-file half of the rule are what grill answer A3 and ADR 0030
withdraw. Phase 4 amends them and is the work left.

## 1. The pin-line rule in the archive check (AC-1 to AC-7, AC-10)

- [x] 1.1 Setup. Confirm `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`
  holds `- Status: accepted` (set by the loop's `accept-decisions` step; stop and report if not).
  Write the four fixture files of D-5 under `plugins/openspec/hooks/fixtures/c561553/`, each with
  one command of this form (reading the commit here is allowed; the tests never do):
  `git show c561553^:docs/openspec-flow.md | sed -n '575,582p;585,591p' > plugins/openspec/hooks/fixtures/c561553/openspec-flow.before.txt`,
  the same with `c561553:` for `openspec-flow.after.txt`, and with
  `plugins/openspec/hooks/change-loop.test.mjs` and `sed -n '2475,2481p'` (before) or
  `sed -n '2475,2482p'` (after) for `change-loop.test.before.txt` and `change-loop.test.after.txt`.
  Then `git add plugins/openspec/hooks/fixtures/c561553`. Check: `git diff --cached --stat` lists the
  four files (15, 15, 7 and 8 lines); and
  `env TMPDIR=/var/tmp/devkit-archive-release-pin node --test --test-concurrency=1 --test-name-pattern="^change-loop retire: /conduct" --test-name-pattern="^AC-6 instructions-follow" plugins/openspec/hooks/change-loop.test.mjs`
  passes, so the fixtures add nothing the repository-wide scans refuse.
- [x] 1.2 Write tests `archive-release-pin 1` to `archive-release-pin 9` in
  `plugins/openspec/hooks/deliver-check.test.mjs` and `archive-release-pin 10` in
  `plugins/openspec/hooks/release-merge.test.mjs`, exactly as the table of D-6 says, with the
  namespace import `import * as DC from './deliver-check.mjs';` in `deliver-check.test.mjs`. In
  `release-merge.test.mjs`, test 10 uses `import * as D from './deliver-check.mjs';` and
  `import * as R from './release-merge.mjs';`. Make the D-7 edits: the two added assertions of
  `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)`
  (its name and existing assertions unchanged), the `base` option of `archivePrRepo`, and the new
  helper `pinArchive`. Positive cases: tests 1, 3 and 6, the pin-only halves of 7, 8 and 9, the
  two empty-base `true` cases of 5, and test 10. Negative cases: 2 and 4; in 5 the missing,
  unreadable, other-path, CRLF, lost-final-newline, gained-final-newline and empty-base-against-text
  cases; and the beyond-pin, other-line and missing-file halves of 7, 8 and 9. Run
  `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" plugins/openspec/hooks/conduct-check.test.mjs`
  on the code before 1.3 and save its output to `openspec/changes/archive-release-pin/proof/red-1.txt`.
  Check: the file holds the ten new names; every one of the ten fails (tests 1 to 6 on
  `DC.pinLinesOnly` not being a function or on texts being ignored, 7 to 9 on a pin-only edit still
  named, 10 on `D.pinsIn` being undefined), and `release list: ...` fails only on its new pin-only
  assertion. A different result is settled in this task, before 1.3.
- [x] 1.3 Move the pin definition as D-1 says. In `plugins/openspec/hooks/deliver-check.mjs`, add
  the section above `RELEASE_FILE` with `PIN_MARKER`, `PIN_TOKEN`, `pinsIn` and `setPins`, byte for
  byte. In `plugins/openspec/hooks/release-merge.mjs`, put the new import and the
  `export { pinsIn, setPins };` line and delete lines 129-141. Check: test 10 passes;
  `git grep -n "PIN_MARKER\|PIN_TOKEN" -- plugins/openspec/hooks/release-merge.mjs` prints nothing;
  `git grep -n "release-merge" -- plugins/openspec/hooks/deliver-check.mjs` prints nothing; and
  `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/release-merge.test.mjs`
  passes (every release-merge test, the conflict classification of AC-6 included).
- [x] 1.4 Add the rule and its read as D-2, D-3 and D-4 say, in
  `plugins/openspec/hooks/deliver-check.mjs`: `PIN_LINE_FILES`, `PIN_TEST_LINES`, `pinLinesOnly`,
  `textAt`, `texts` in `archiveChanges`, the third parameter of `unnamedFiles`, the two callers
  (`filesStop`, `archivePrCheck`), and the comments above `unnamedFiles` and `RELEASE_FILE`. Check:
  tests `archive-release-pin 1` to `archive-release-pin 10` and `release list: ...` pass; and
  `git grep -n "unnamedFiles(" -- plugins/openspec/hooks/deliver-check.mjs` prints the definition and
  exactly two calls, each passing texts.
- [x] 1.5 Gate: `mkdir -p /var/tmp/devkit-archive-release-pin && env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^P3j" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" plugins/openspec/hooks/conduct-check.test.mjs && env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/merge-setup.test.mjs && python3 scripts/check.py` green; covers AC-1 to AC-7 and AC-10.

## 2. Documents and the release (AC-6, AC-8)

- [x] 2.1 Write test `archive-release-pin 11` in `plugins/openspec/hooks/deliver-check.test.mjs` as
  D-6 says. Run
  `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin 11:" plugins/openspec/hooks/conduct-check.test.mjs`
  before 2.2 and save its output to `openspec/changes/archive-release-pin/proof/red-2.txt`. Check: the
  file shows test 11 failing on its first missing text.
- [x] 2.2 Edit the documents as D-8 says: the three places of `docs/openspec-flow.md` (the
  `**Classification.**` bullet's last sentence, the P13 row, the `**The file check (P13, AC-3).**`
  paragraph), the header line and the Note of `docs/adr/0003-auto-merge-the-archive-pr.md` (no other
  line of that file changes), and the `ADRs:` line of `openspec/config.yaml`. Check: test 11 passes;
  `git diff --stat -- docs/adr/0003-auto-merge-the-archive-pr.md` shows only added lines;
  `git grep -n "and the ADR 0003 exemption, do not change" -- docs/openspec-flow.md` prints nothing;
  and `python3 scripts/check.py` passes (language and links).
- [x] 2.3 Release as D-9 says. Before editing, read `version` in
  `git show origin/main:plugins/openspec/.claude-plugin/plugin.json` and `metadata.version` in
  `git show origin/main:.claude-plugin/marketplace.json` (no fetch in this task; the coordinating
  session fetches). Take the next free minor of each, as read on `origin/main` at the last merge of
  `main` before review; never copy a number from this file or from `design.md`. Bump `plugins/openspec/.claude-plugin/plugin.json` and its
  `.claude-plugin/marketplace.json` entry, set `metadata.version`, add the `CHANGELOG.md` entry, move
  every pin of `docs/openspec-flow.md` (three lines), and edit only the pin block of
  `plugins/openspec/hooks/change-loop.test.mjs` (Invariant comment, `assert.match`, one new
  `assert.doesNotMatch`). Check: `git grep -c "v<previous>" -- docs/openspec-flow.md` prints
  nothing, with `<previous>` the devkit-openspec version read on `origin/main` above;
  `git diff --merge-base origin/main -- plugins/openspec/hooks/change-loop.test.mjs` shows only lines of D-2's
  two forms; and `python3 scripts/gen-catalog.py --check` passes.
- [x] 2.4 Gate: `mkdir -p /var/tmp/devkit-archive-release-pin && env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^change-loop docs: the design records the answers" --test-name-pattern="^release-merge pin" --test-name-pattern="^release-merge-conflict 1[56]:" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^AC-8 release-ready" --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^upfront AC-5 docs" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^upfront D-18 docs" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate archive-release-pin --strict` green; covers AC-6 and AC-8, and the release's own pin lines.

## 3. Real-run proof and the whole suite (AC-1 to AC-10)

- [x] 3.1 Run the real-run proof of D-10, cases R1 to R8, in
  `/var/tmp/devkit-archive-release-pin/proof-repo` (never in the worktree). Record the build
  commands, each run's command, exit code and `archive.unnamed` (R8: the two booleans) in
  `openspec/changes/archive-release-pin/proof/real-run.txt`, with the sentence that the local stop
  is proved by test 7 through `collectState`. Remove the scratch repository afterwards. Check: the
  file holds R1 to R8 and every result equals the "Expected" column of D-10; and
  `git status --short` shows only `openspec/changes/archive-release-pin/proof/real-run.txt` as new.
- [x] 3.2 Gate: `mkdir -p /var/tmp/devkit-archive-release-pin && env TMPDIR=/var/tmp/devkit-archive-release-pin node scripts/test-suite.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate archive-release-pin --strict` green. This is the owner-run whole suite (13 to 21 minutes), started by the owner or the coordinating session as a background command of the tool. It covers AC-1 to AC-8 and AC-10 with every other suite at once.

## 4. Amendment: the pin test reads the manifest (ADR 0030)

Every rule, name and text is in `design.md`: D-2 amended (the code), D-5 amended (the fixtures), the
D-6 "Amended tests" table, the D-7 amended table, D-8 amended (the documents), D-9 amended (the
CHANGELOG), D-10 amended (cases A1 to A6) and D-12 (the pin block). Paths are those at `34e3500`. No
task writes a release number: the numbers stay as they are on the branch, and the flow's release
step re-takes the next number on `origin/main`. ADR 0030 is not edited by any task. The whole suite
is the delivery train's run, not a local one: phase 4's gate is filtered runs only. Every command
runs from the worktree with `TMPDIR=/var/tmp/devkit-archive-release-pin`.

- [ ] 4.1 Tests first (AC-1 to AC-8, AC-10). Confirm
  `docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md` holds
  `- Status: accepted` (set by `accept-decisions`; stop and report if not). In
  `plugins/openspec/hooks/deliver-check-archive.test.mjs`, flip tests `archive-release-pin 3` to `8`
  and `11`, change `PIN_BASE` and `PIN_EDITS` to the doc only, add `LOOP_EDIT`, and add test
  `archive-release-pin 12`, exactly as the D-6 "Amended tests" table says (new names for tests 3, 5
  and 6 only; every id kept). In `plugins/openspec/hooks/release-merge.test.mjs`, change test
  `archive-release-pin 10` as the table says. Tests 3 and 6 no longer read the two
  `change-loop.test.*.txt` fixtures. Run
  `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^archive-release-pin " plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/release-merge.test.mjs`
  on the code at `34e3500` and save its output, as printed, to
  `openspec/changes/archive-release-pin/proof/red-4.txt`. Check: the file names the twelve tests;
  exactly tests 3, 5, 6, 7, 8, 10, 11 and 12 fail, each on the case the table's "Red before 4.2"
  column names (11 on the first missing document text, 12 on the first version literal of the pin
  block), and tests 1, 2, 4 and 9 pass. A different result is settled in this task, before 4.2.
  `git status --short` lists only the two test files and `proof/red-4.txt`.
- [ ] 4.2 Code and fixtures (AC-3, AC-5, AC-6, AC-10). In `plugins/openspec/hooks/deliver-check.mjs`,
  apply D-2 amended: `PIN_LINE_FILES` holds only `docs/openspec-flow.md`, `PIN_TEST_LINES` and the
  test-file branch of `pinLinesOnly` are deleted, and the three comments change as written there.
  Run `git rm -q plugins/openspec/hooks/fixtures/c561553/change-loop.test.before.txt plugins/openspec/hooks/fixtures/c561553/change-loop.test.after.txt`.
  Check: `git grep -n "PIN_TEST_LINES\|change-loop-compozy" -- plugins/openspec/hooks/deliver-check.mjs`
  prints nothing; `git ls-files plugins/openspec/hooks/fixtures/c561553` lists only
  `openspec-flow.after.txt` and `openspec-flow.before.txt`; and the run of 4.1 now passes tests 1 to
  10, with tests 11 (the documents, task 4.4) and 12 (the pin block, task 4.3) still failing.
- [ ] 4.3 The pin block (AC-4). In `plugins/openspec/hooks/change-loop-compozy.test.mjs`, delete the 29
  lines D-12 names (from `  // Invariant: the CI snippet pins the current release` through the
  `assert.doesNotMatch(flow, /v0\.21\.0/, ...)` line) and nothing else. Check:
  `git diff -U0 34e3500 -- plugins/openspec/hooks/change-loop-compozy.test.mjs` shows 29 removed
  lines and no added line; and
  `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^archive-release-pin 12:" --test-name-pattern="^change-loop docs: the design records the answers$" --test-name-pattern="^release-merge-conflict 15:" plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs`
  passes.
- [ ] 4.4 Documents, ADR lines, config and CHANGELOG (AC-8). Apply D-8 amended: the Classification
  bullet, the P13 row and the file-check paragraph of `docs/openspec-flow.md`; the `- Amended by ADR
  0030 (...)` line and the replaced archive-release-pin Note of
  `docs/adr/0003-auto-merge-the-archive-pr.md`; the `- Amended by ADR 0030 (...)` line and the dated
  Note under `## Context` of
  `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` (no other line of
  either ADR changes); the `ADRs:` line of `openspec/config.yaml`. Apply D-9 amended to the
  `CHANGELOG.md` entry of this release (its heading, version and tag sentence stay as on the
  branch). Check: test `archive-release-pin 11` passes;
  `git diff 34e3500 -- docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`
  shows only added lines;
  `git grep -n "change-loop-compozy.test.mjs" -- docs/openspec-flow.md docs/adr/0003-auto-merge-the-archive-pr.md`
  prints nothing;
  and `python3 scripts/check.py` passes (language and links).
- [ ] 4.5 Real-run proof (AC-9). Run cases A1 to A6 of D-10 amended in
  `/var/tmp/devkit-archive-release-pin/proof-repo-amended` (never in the worktree; A6 in the
  worktree). Record the build commands, each run's command, exit code and `archive.unnamed` (A6: the
  test result and the two counts) in `openspec/changes/archive-release-pin/proof/real-run-amended.txt`,
  with the sentence that the local stop is proved by test 7 through `collectState`. Remove the
  scratch repository afterwards. Check: the file holds A1 to A6 and every result equals the
  "Expected" column of D-10 amended; `git status --short` shows
  `openspec/changes/archive-release-pin/proof/real-run-amended.txt` as the only new file of this
  task.
- [ ] 4.6 Gate: `mkdir -p /var/tmp/devkit-archive-release-pin && env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^archive-release-pin " --test-name-pattern="^release list" --test-name-pattern="^unnamedFiles" --test-name-pattern="^P13" --test-name-pattern="^--ci on an archive branch" --test-name-pattern="^the pin in docs/openspec-flow.md" --test-name-pattern="^release-merge" --test-name-pattern="^conduct pin" --test-name-pattern="^change-loop docs: the design records the answers$" --test-name-pattern="^version-pin " --test-name-pattern="^ADR 0003 exists" --test-name-pattern="^delivery-models docs: the documents follow" --test-name-pattern="^upfront ADR 0021" --test-name-pattern="^release-tags 4:" plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/release-tags.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate archive-release-pin --strict` green; covers AC-1 to AC-8 and AC-10 on the amended code, documents and pin test. The whole suite runs on the delivery train's joined head, not here.

## Workflow follow-up

- Before each push and before `enable-auto-merge`: compare the release numbers and ADR numbers 0027
  and 0030 with `origin/main` after a fresh fetch (CONTRIBUTING.md step 5). On a collision, renumber
  the release (every place of D-9) or the ADR (file, title, every reference: decisions.md,
  proposal.md, design.md, ADR 0003's lines and Note, ADR 0027's line and Note, the config line, the
  flow doc, CHANGELOG, test 11).
- After phase 4: the evidence and the review bench run again on the amended head (their own writers;
  `proof/real-run.txt` stays as the record of phase 3).
- After the merge: the loop's `tag-release` step tags the devkit-openspec release on the merge
  commit (ADR 0019).
- At the archive: tick both roadmap lines in `openspec/roadmap.md`, `archive-release-pin` and
  `release-pin-is-a-release-file`.
- First live use: the next archive whose retro bumps devkit-openspec, run with this release
  installed, names neither pin file in its proposal. Its retro records whether the archive stopped.
