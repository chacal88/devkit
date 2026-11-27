<!-- devkit-stage tasks result=passed attempt=2 commit=22f70c31f9bcbba9c8e6babe685dd4b07de05725 -->
# Tasks

Change: `selective-tests-by-map-2` · Date: 2026-11-26 · Owner: Kaue (chacal88) · Base: `origin/main`
at `e8991d6d` (the branch was opened on it and has merged nothing yet) · PRD / tech spec: n/a
(`proposal.md`, `design.md`, `decisions.md`, `release.md`)

"The record" is the change's own unnumbered record of `decisions.md`,
`docs/adr/a-change-runs-only-the-tests-its-files-map-to.md`. Every file a task edits cites it as
`ADR [a-change-runs-only-the-tests-its-files-map-to]` (D-8, D-9), and no task writes a number for
it, renames it or edits `decisions.md`'s `- ADR:` line. No test or fixture file cites it. The release follows the note
rule (`proposal.md`, "Release rule"): `release.md` states it, and no task bumps a version, edits a
`CHANGELOG.md` line or a CI pin line, or numbers an ADR; the delivery writes them at the merge.

Work only in this change's worktree, on its branch. Every name, text, rule, output line and test is
in `design.md`: D-1 the mode, D-2 the own files, D-3 the map and its check, D-4 the map's first
content, D-5 the selection, D-6 the output, D-7 CI, D-8 the texts, D-9 the records, D-10 the AC-8
proof, D-11 the tests and the pinned rules. The implementer copies them and makes no design choice.
`node scripts/test-suite.mjs` without `--own-files` keeps every behaviour it has (AC-8). No product
script under `plugins/` changes what it answers: `deliver-check.mjs` only gains the two exports of D-2.

Test first in every task that adds a test: write it, see it fail on the code before the task, then
make it pass. Every new test's name starts `selective-tests-by-map-2 AC-<n> `. The one exception is
the base test task 2.6 extends, which keeps its `release-note AC-14 texts:` prefix (D-11). Before a test is
changed, its commit message names its invariant, the layer that owns it and the suite it lives in
(CLAUDE.md); the "Pinned rules" table of `design.md` gives the three for each test this plan touches.
Leave no scratch file in the tree (the D-4 seed script lives in the session's scratch folder), and
end every task with `git status --short`.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own. All three gates name the same command, so one passing
row of its selective part in `evidence.md` serves them all (the `python3 scripts/check.py` part is
the train's). Run each whole-suite run (1.1, 3.3) as a background command of the tool, never with a
shell `&`. Run it with no other suite on the machine, a load average under about 20 (`uptime`) and
the free disk checked (`df -h /`).

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `gate-runs-mapped-tests` | 1.3, 1.5, 1.7, 2.9, 3.4 |
| AC-2 | `slow-only-when-linked` | 1.3, 1.6, 3.4 |
| AC-3 | `shared-helper-fast-only` | 1.3, 3.4 |
| AC-4 | `unmapped-code-runs-all` | 1.2, 1.3, 1.5, 3.4 |
| AC-5 | `base-merge-selective` | 2.2, 2.3, 3.1, 3.5 |
| AC-6 | `proof-selective` | 1.5, 2.2, 2.3, 3.4, 3.6 |
| AC-7 | `pr-ci-selective-train-whole` | 1.5, 2.1, 2.8, 3.4 |
| AC-8 | `whole-suite-unchanged` | 1.1, 1.5, 2.6, 3.3 |
| AC-9 | `map-checked` | 1.4, 1.5, 1.6, 2.7, 3.4, 3.7 |

## 1. The selection, the map and its check (phase 1)

- [x] 1.1 Conductor: the AC-8 baseline and the source of the slow marks (D-10 steps 1 and 2, D-4
  rule 1). Make the base copy of the branch's current base: the `origin/main` sha the branch stands
  on when the task runs (`e8991d6d`, the sha it was opened on, while it has merged nothing; the sha
  of its latest merge of `origin/main` otherwise). The proof of AC-8 compares against the
  `origin/main` sha of the last merge before review: when 3.1 brings a newer one, 3.3 re-derives the
  copy on it (D-10 step 1). Put the copy under `/var/tmp/devkit-stbm/base`, run
  `node scripts/test-suite.mjs --reporter=tap` there, and keep `/var/tmp/devkit-stbm/base.tap`.
  Commit the run's per-file summary lines, its `suite:` line and the base sha as
  `openspec/changes/selective-tests-by-map-2/proof/base-whole.txt`, with the machine's core count and
  `uptime`. Check: exit 0; the `suite:` line ends `0 fail, ...`; the file lists one `pass` line per
  suite file of the base copy (44 at `e8991d6d`).
- [x] 1.2 The own files (D-2). In `plugins/openspec/hooks/deliver-check.mjs`, export `ownDiffPaths`
  and `branchOwnPaths`, and make `ownFiles` call `ownDiffPaths`. Write T-27 in
  `plugins/openspec/hooks/deliver-check.test.mjs` with the `ownFilesRepo` fixture of
  `deliver-check-fixtures.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(selective-tests-by-map-2|own-files) " plugins/openspec/hooks/deliver-check.test.mjs`
  passes, and the `own-files AC-1` to `AC-6` tests pass unchanged.
- [x] 1.3 The selection (D-5). In `scripts/test-suite.mjs`, export `selectTests` and `sharedUses`
  with rules S1 to S7 and the import scan. Write T-1 to T-9 in
  `plugins/openspec/hooks/test-suite.test.mjs`. Check:
  `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` passes.
- [x] 1.4 The map's reader and check (D-3). In `scripts/test-suite.mjs`, export `readTestMap` and
  `mapProblems` with M1 to M7 and the three input cases (missing, empty or not JSON, not an object).
  Write T-10 to T-15 in `plugins/openspec/hooks/test-suite.test.mjs`. Check: as in 1.3.
- [x] 1.5 The mode (D-1, D-5's train rule, D-6). In `scripts/test-suite.mjs`:
  - wire `--own-files` (`USAGE`, the header comment citing `ADR [a-change-runs-only-the-tests-its-files-map-to]`, the dynamic import, the refusals, the three
    outputs, exit 0 on `none`);
  - guard the own-files call and the head branch read (D-2's git failure, D-5's unknown branch);
  - in `plugins/openspec/hooks/test-suite.test.mjs`, extend `tree()` with the git repository, the
    `origin/main` ref, the symlinked `deliver-check.mjs` and the blanked env of D-11, with an option
    for T-22 to make the tree without `git init`;
  - write T-17 to T-26.

  The existing tests of the file keep passing unchanged ("Pinned rules"). Check:
  `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` passes. It passes again
  as `env GITHUB_HEAD_REF=selective-tests-by-map-2 GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`,
  so the CI branch variables cannot leak into a test.
- [x] 1.6 The map's first content (D-4). Write `scripts/test-map.json` by rules 1 to 6: slow marks
  from `proof/base-whole.txt` of 1.1, the four shared helpers, then file keys and folder keys. A
  mention on a comment line links nothing (D-4, rules 3 and 4). Write T-16 in
  `plugins/openspec/hooks/test-suite.test.mjs`. Check: T-16 passes, and
  `node scripts/test-suite.mjs --own-files` on this branch prints one `selected ... by ...` line per
  file. It does not print `selected the whole suite`: every own file is mapped, or is under
  `openspec/` or is any `.md` outside `plugins/` (S6).
- [x] 1.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1,
  AC-2, AC-3, AC-4, AC-9).

## 2. CI, the texts and the records (phase 2)

- [x] 2.1 CI (D-7). In `.github/workflows/ci.yml` job `check`, add the `fetch-depth` expression to the
  checkout and the `--own-files` expression to the `Test suite` step. Write T-29 in
  `plugins/openspec/hooks/test-tmp.test.mjs`, beside `test-fixture-cleanup AC-5`, which keeps passing
  unchanged. Check: `node scripts/test-suite.mjs plugins/openspec/hooks/test-tmp.test.mjs` passes,
  and the job id is still `check` (AC-7).
- [x] 2.2 The config and the gate part (D-8, D-6). In `openspec/config.yaml` `context:`, edit the
  `Test command:` line, the `Gates:` line (its citation is
  `ADR [a-change-runs-only-the-tests-its-files-map-to]`) and the parenthesis of `Test history:`, and
  append the ADR list entry
  `; ADR [a-change-runs-only-the-tests-its-files-map-to] a change runs only the tests its own files map to, amends 0022, 0025 and 0026`
  after the base's `ADR 0035 ...` entry (D-8).
  Commit before the phase gate: an uncommitted `openspec/` path is not an own file (D-2). Do not edit the 0026 entry,
  `devkit.delivery.train` or the `Live roadmap:` line. Write T-28 in
  `plugins/openspec/hooks/delivery-train.test.mjs`, and the config half of T-30 in
  `plugins/openspec/hooks/test-suite.test.mjs`. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^(selective-tests-by-map-2|setup AC-2 records|coordinator-loop-fixes AC-20 T140|delivery-train AC-5)" plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/change-loop-declared.test.mjs`
  passes. It covers the pinned tests of `guard.test.mjs` "setup AC-2 records" and
  `change-loop-declared.test.mjs` "coordinator-loop-fixes AC-20 T140" (AC-5, AC-6).
- [x] 2.3 The docs (D-8). Edit these files:
  - `CLAUDE.md`: the Commands row after the whole-suite row, and the two working rules (the selective
    gate row; the map upkeep);
  - `CONTRIBUTING.md`: the new paragraph after the one that states the measured time;
  - `docs/openspec-flow.md:347`: the one sentence;
  - the comment at `plugins/openspec/hooks/change-loop-compozy.test.mjs:1129` and the comment at
    `plugins/openspec/hooks/deliver-check.test.mjs:1324` (comments only).

  Write the docs half of T-30. Check: `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`
  passes, its `suite-speed AC-7` and `suite-speed AC-8` tests included, and `python3 scripts/check.py`
  passes (English, links) (AC-5, AC-6).
- [x] 2.4 The records (D-9). Mark the record listed in `decisions.md` accepted, unless the loop's
  `accept-decisions` already set it, with the `- Accepted by:` line naming the owner's approval in `openspec/changes/selective-tests-by-map-2/approval.md`; its file name stays unnumbered. Add the line
  `- Amended by ADR [a-change-runs-only-the-tests-its-files-map-to] (a-change-runs-only-the-tests-its-files-map-to.md)`
  to the headers of `docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`,
  `docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md` and
  `docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`. In ADR 0022 and ADR 0025 the
  line goes right after their `- Amended by ADR 0034 (0034-release-at-merge.md)` line; in ADR 0026
  after its 0031 line (D-9). Check: `python3 scripts/check.py` passes;
  `node scripts/test-suite.mjs --test-name-pattern="^setup AC-2 records" plugins/openspec/hooks/guard.test.mjs`
  passes; `git grep -n -F "a-change-runs-only-the-tests-its-files-map-to" -- . ":(exclude)openspec/changes"`
  shows, besides the record's own file, the three `Amended by` lines, the two `openspec/config.yaml`
  citations and the header comment of `scripts/test-suite.mjs` (and any `CLAUDE.md` or `CONTRIBUTING.md` line that names the record), each in the form
  `ADR [a-change-runs-only-the-tests-its-files-map-to]`, and no line in a test or fixture file.
Tasks 2.6 to 2.9 were added after round 1 of the code review (`review.md`; code-quality F1 and F2,
architecture F1, test-coverage F1). They sit before the phase gate 2.5, because a phase ends with its
gate. Gate 2.5 is open again and runs after them. They are inside D-2, D-3, D-5 and D-11 as revised
in `design.md`, and no AC changes. 2.6 records a fix already committed; 2.7 to 2.9 are for the
implementer.

- [x] 2.6 The ADRs-line test of `release-note.test.mjs`. Done in commit `02eb93ed`, after gate 2.5
  failed on it: task 2.2's ADR list entry is the first record after the release-at-merge pair, and the
  test required the pair to end the line. Test file: `plugins/openspec/hooks/release-note.test.mjs`.
  Invariant: the ADRs line keeps the two release-at-merge records linked and lets later records
  follow them. Layer: config text (`openspec/config.yaml` `ADRs:`). Suite: `release-note.test.mjs`.
  The edit adds `ADRS_LINE_TAIL` (line 895), the old regex with a trailing `(?:; [^;]+)*` before
  `\)$`, used by the `documents:` subtest (line 999). It also adds the test
  `release-note AC-14 texts: the ADRs line keeps the two records linked and lets later records follow them`
  (two later-record positives, two broken-pair negatives), named after the base test it extends
  (D-11). D-10 step 4 drops that one name. Check:
  `node scripts/test-suite.mjs --test-name-pattern="^release-note AC-14 texts" plugins/openspec/hooks/release-note.test.mjs`
  passes.
- [x] 2.7 M5 on git's list (D-3, "The M5 list"). In `scripts/test-suite.mjs`, add the private
  `trackedSuitePaths(root, env)` and the `env = process.env` argument of `mapProblems`. Use git's list
  for M5 and the disk walk when it is `null`. Write T-31 and T-32 (direct calls) and T-33 (end to
  end) in `plugins/openspec/hooks/test-suite.test.mjs`, test first: T-31 and T-33 fail on the code
  before the task, because the stray files are refused. T-33's tree commits a `.gitignore` that
  ignores `.DS_Store` and `__pycache__/` (as the repository's does), so its ignored files are no own
  file; its case (2), an untracked, not ignored, uncovered `stray.tmp`, exits 0 with
  `selected the whole suite: no entry of scripts/test-map.json covers <path>` and no
  `is not covered by the map` line (the fail safe of D-3, "The M5 list"). T-13 keeps passing
  unchanged ("Pinned rules"). Check: `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` passes, and
  passes again under
  `env GITHUB_HEAD_REF=selective-tests-by-map-2 GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`,
  so the CI branch variables cannot leak into a test.
- [x] 2.8 The head branch from its owner (D-5). In `scripts/test-suite.mjs`, delete `headBranch`, drop
  `spawnSync` from the `node:child_process` import (`headBranch` is its only user), and make
  `selectOwn` read the branch with `deliver.currentBranch(root, process.env)`. Write T-34 in
  `plugins/openspec/hooks/test-suite.test.mjs`, test first (its `DEVKIT_BRANCH=train/4` case fails
  before the task). T-20 keeps passing unchanged. Check: as in 2.7, and
  `git grep -n -e headBranch -e abbrev-ref -e spawnSync -- scripts/test-suite.mjs` prints nothing.
  Commit 2.8 before 2.9 starts.
- [ ] 2.9 The CI base (D-2). Write T-35 in `plugins/openspec/hooks/test-suite.test.mjs` (a second
  origin branch, `GITHUB_BASE_REF` set and blank). It passes on the code as it stands, so prove it
  bites: make `selectOwn` pass `{}` in place of `process.env` to `stalenessBase` for one run, see
  T-35 fail, and restore the line before the commit. Record the red run's failing line in the
  commit message. 2.9 starts after 2.8's commit, so the mutation is the only edit of
  `scripts/test-suite.mjs` it can leave. Check: as in 2.7, and
  `git diff --quiet HEAD -- scripts/test-suite.mjs` exits 0 before 2.9's commit, so the restored
  line is what ships.
- [ ] 2.5 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-5,
  AC-6, AC-7). It passed once before 2.6 to 2.9 were added; it runs again after them.

## 3. Release and the proofs (phase 3)

- [x] 3.1 Conductor: merge `origin/main` into the branch, the last merge before review (fetch first,
  then `git merge origin/main`). The branch holds no release line before the delivery, so a release
  file cannot conflict here; a conflict after the delivery's `assign-release` is classified by the
  loop (`assignConflict` in `plugins/openspec/hooks/conduct-check.mjs`). Keep both entries of the ADR list line of `openspec/config.yaml` when it
  conflicts. Re-read every `file:line` anchor and helper name `design.md` cites
  (`deliver-check.mjs` `ownFiles`, `gitFacts`, `dirtyPaths`, `TRAIN_BRANCH`, `RELEASE_FILE`,
  `tasksItem`; `docs/openspec-flow.md:347`; the two test comments of D-8). If the merge moved or
  renamed a file or a helper this plan names, the same commit edits `proposal.md` and `tasks.md`
  (CLAUDE.md). Check: `git log -1 --format=%P` shows two parents, and `git status --short` is empty.
- [x] 3.2 The release note and the record stay readable, after 3.1's merge. This change follows the
  note rule (`proposal.md`, "Release rule"; `docs/adr/0034-release-at-merge.md` decisions 1, 2 and
  7; `CONTRIBUTING.md` step 5): `openspec/changes/selective-tests-by-map-2/release.md`, written with
  the plan, states `devkit-openspec: patch`, and the delivery writes the versions, the
  `CHANGELOG.md` entry, the CI pin lines of `docs/openspec-flow.md` and `docs/catalog.md` at the
  merge; the same step numbers the unnumbered record and rewrites its `ADR [<slug>]` citations
  (D-9). This task edits none of them and does not edit `release.md` (the approval holds its hash,
  decision 2), the record's file name or `decisions.md`.

  Check: `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and
  `openspec validate selective-tests-by-map-2 --strict` pass;
  `git diff --name-only origin/main...HEAD -- CHANGELOG.md .claude-plugin/marketplace.json plugins/openspec/.claude-plugin/plugin.json docs/catalog.md`
  prints nothing; `node plugins/openspec/hooks/deliver-check.mjs selective-tests-by-map-2` prints
  no `no release:` and no `release.md:` line; the `- ADR:` path of `decisions.md` names a file that
  exists, and
  `node --input-type=module -e "const m = await import('./plugins/openspec/hooks/change-loop.mjs'); console.log(JSON.stringify(m.decisionRecords(process.cwd(), 'openspec/changes/selective-tests-by-map-2')))"`
  prints `"unreadable":[]` and `"proposed":[]`.
- [x] 3.3 Conductor: AC-8 at the head (D-10 steps 3 to 5). When 3.1 merged a newer `origin/main`
  than the base of 1.1's copy, first redo 1.1's copy and run on that sha (D-10 step 1), and keep its
  sha in `proof/same-tests.txt`. With no `TMPDIR` override, run
  `node scripts/test-suite.mjs --reporter=tap > /var/tmp/devkit-stbm/head.tap 2>&1` and compare its
  names and `start` lines with the base run's. Commit the counts, the removed count and the two empty diffs
  as `proof/same-tests.txt`. Check: exit 0; both diffs are empty.
- [x] 3.4 Conductor: the real runs of every case the plan declares. Use a scratch clone of the
  branch under `/var/tmp/devkit-stbm/clone`, with `refs/remotes/origin/main` set to this worktree's
  `origin/main` sha. Each case is one scratch commit there (case (j) is a copy instead) and one run of
  `node scripts/test-suite.mjs --own-files`, with its output kept as `proof/case-<x>.txt`:
  - (a) a mapped module (`plugins/openspec/hooks/status-line.mjs`) runs only its tests, each named
    with `by` (AC-1);
  - (b) `plugins/openspec/hooks/test-fixtures.mjs` runs its fast importers and no slow file (AC-2,
    AC-3);
  - (c) a slow test file edited runs itself (AC-2);
  - (d) a new unmapped `scripts/x.py` gives `selected the whole suite: no entry ...`. Stop it after the
    first `start` lines with SIGINT and record exit 130 (AC-4);
  - (e) a docs and `openspec/` only commit gives `selected no test file`, exit 0 (AC-4, AC-6);
  - (f) the branch renamed `train/99` gives the whole suite with the train reason, stopped as in (d)
    (AC-7);
  - (g) a map entry naming a missing file exits 1 naming it (AC-9);
  - (h) on a local merge commit of the scratch branch into `origin/main`, with
    `GITHUB_BASE_REF=main GITHUB_HEAD_REF=scratch`, the run selects what the branch brings, as CI's
    merged ref does (AC-7);
  - (i) `node scripts/test-suite.mjs` with no argument on a broken map runs the whole suite, stopped as
    in (d) (AC-8);
  - (j) a copy of the branch's head with no `.git` (`git archive` into
    `/var/tmp/devkit-stbm/nogit`, run with `GIT_CEILING_DIRECTORIES=/var/tmp/devkit-stbm`) gives
    `selected the whole suite: git cannot tell the own files: ...` and no stack trace, stopped as in
    (d) (AC-4, the fail safe of D-2).

  Remove the clone and the copy afterwards. Check: each file shows the outcome named here.
- [x] 3.5 Conductor: AC-5. Record two things in `proof/base-merge.txt`:
  - the run of `node scripts/test-suite.mjs --own-files` on the head after 3.1's merge, its `selected`
    lines naming only this change's own files' tests;
  - the `Test command:` and `Gates:` lines of `openspec/config.yaml` at that head, the texts the loop's
    agents read after a merge.

  Check: no `selected the whole suite` line.
- [ ] 3.7 Conductor: case (k), the reviewer's reproduction of code-quality F1, after 2.7. It was added
  after round 1 and sits before the phase gate 3.6, which is open again. In a scratch clone set up as
  in 3.4, make case (a)'s scratch commit, then make two runs of
  `node scripts/test-suite.mjs --own-files`, both kept in `proof/case-k.txt`:
  - run 1, with an untracked `plugins/openspec/hooks/.DS_Store` (the repository's `.gitignore`
    ignores it): exit 0, no `is not covered by the map` line, and the same `selected` line as case
    (a);
  - run 2, with an untracked, not ignored `plugins/openspec/hooks/stray.tmp` added: no
    `is not covered by the map` line and no refusal. The file is an own file that no key covers, so
    the run prints
    `selected the whole suite: no entry of scripts/test-map.json covers plugins/openspec/hooks/stray.tmp`
    (the fail safe of D-3, "The M5 list"). Stop it as in 3.4 (d) and record exit 130.

  Remove the clone afterwards. Check: each run shows the outcome named here.
- [ ] 3.6 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1 to
  AC-9). The pr-verifier writes its row with the `selected` lines (D-6). It words the AC-5 row
  `pass:` followed by what is proven here (the texts the loop's agents read, the selective run on
  the head in `proof/base-merge.txt`, and case (h)'s run on a merge commit in `proof/case-h.txt`)
  and what is next-change dogfood (the loop asking for the selective run after a real base merge),
  as the AC-7 row splits what is proven here from its CI half (`proposal.md`, "Flagged for the
  owner"); never a bare `pass`. It passed once before 3.7
  was added; it runs again after it.

## Workflow follow-up

- The `check` job of this change's pull request runs `node scripts/test-suite.mjs --own-files`, and its
  log shows the `selected` lines. This is AC-7's CI half, read before `enable-auto-merge`. The evidence
  cites the run.
- The next train's pull request runs the whole suite in `check` (`selected the whole suite: train/<n> is a train branch`),
  and `push` to `main` runs it with no flag.
- Before `enable-auto-merge`, the delivery's `assign-release` step (or a train's join) writes this
  change's release from `release.md` (`0034-release-at-merge.md` decision 1); no task does it.
- After the merge, `deliver-check` answers `tag-release` and the session tags the new devkit-openspec
  version on the merge commit (CONTRIBUTING.md, ADR 0019).
