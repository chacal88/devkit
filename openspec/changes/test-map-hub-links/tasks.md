<!-- devkit-stage tasks result=passed attempt=1 commit=acacc172e3fd1e3e5b4c325674d75f11511d8af0 -->
# Tasks

Change: `test-map-hub-links` · Date: 2026-11-27 · Owner: Kaue (chacal88) · Base: `origin/main`
at `02713b3a` (the branch was opened on it and has merged nothing yet) · PRD / tech spec: n/a
(`proposal.md`, `design.md`, `decisions.md`, `release.md`)

Work only in this change's worktree, on its branch. Every key, list, rule, name, text and proof is
in `design.md`: D-1 the document keys, D-2 the trace, D-3 the new document lists, D-4 the hub keys
and the coverage run, D-5 the tests, D-6 the `CONTRIBUTING.md` sentence, D-7 CI, D-8 the proofs.
The implementer copies them and makes no design choice. When a measured run gives another set
than D-3's or D-4's table, the task stops there and the plan is revised before the map is edited.
No behaviour changes in `scripts/test-suite.mjs`, `.github/workflows/ci.yml` or any file under
`plugins/` other than `plugins/openspec/hooks/test-suite.test.mjs`.

The release follows the note rule (`docs/adr/0034-release-at-merge.md`; `CONTRIBUTING.md` step 5):
`release.md` reads `packs: []`, and no task bumps a version, edits a `CHANGELOG.md` line or a CI pin
line, or numbers an ADR. This change has no ADR (`decisions.md`).

Test first: T-3 of D-5 is written and seen red on the base map before the map is edited (task 1.4).
Every new test's name starts `test-map-hub-links AC-<n> `. No existing test is changed; the
"Pinned rules" table of `design.md` names the invariant, layer and suite of each test that reads
what this change edits. The map, the test and `CONTRIBUTING.md` land in one commit (D-6,
`CLAUDE.md:53`). The tracer and the coverage script live in the session's scratch folder and are
copied into their proof files; leave no scratch file in the tree, and end every task with
`git status --short`.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own. Both gates name the same command; the
`node scripts/test-suite.mjs --own-files` part is not a part of the train's command, so it has its
own passing row in `evidence.md` after the last merge of the base (`openspec/config.yaml`,
`Gates:`). Run each whole-suite run (1.1, 2.4) and the coverage run (1.3) as a background command of
the tool, never with a shell `&`, with no other suite on the machine, a load average under about 20
(`uptime`) and the free disk checked (`df -h /`). Give each test file run outside the suite script
a fresh `TMPDIR` made under `/var/tmp` and passed by its real path (`/private/var/tmp/...` on
macOS; D-2, D-4): a longer one breaks the Unix socket tests, and a symlinked one fails
`change-loop-remote-state`'s path comparison.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `doc-selects-no-slow` | 1.1, 1.2, 1.4, 1.5, 1.7, 2.3, 2.7 |
| AC-2 | `doc-readers-stay-fast` | 1.2, 1.4, 1.5, 2.2, 2.7 |
| AC-3 | `hub-narrowed` | 1.1, 1.3, 1.4, 1.5, 2.3, 2.7 |
| AC-4 | `map-still-checked` | 1.4, 1.5, 1.7, 2.3, 2.7 |
| AC-5 | `whole-suite-unchanged` | 1.1, 2.4 |
| AC-6 | `fixed-part-measured` | 2.5 |

## 1. The measured links, the map and its pin (phase 1)

- [x] 1.1 Conductor: the baselines, before any edit (D-8). Run
  `node scripts/test-suite.mjs --reporter=tap > /var/tmp/devkit-tmhl/base.tap 2>&1` with no
  `TMPDIR` override on the branch's current head, and commit its per-file summary lines, its
  `suite:` line, the `origin/main` sha, the core count and `uptime` as
  `openspec/changes/test-map-hub-links/proof/base-whole.txt` (AC-5, D-8 step 1). Then write a scratch
  simulation script that calls `suiteFiles`, `readTestMap`, `sharedUses` and `selectTests` of
  `scripts/test-suite.mjs` as `selectOwn` does, for one own path at a time, and commit its output
  for each of the eight documents and the two hubs as `proof/before-selection.txt`: the `selected`
  lines and the count of files and of slow files (AC-1, AC-3). Check: the whole run exits 0 with one
  `pass` line per suite file (44 at `02713b3a`) and `0 fail` on its `suite:` line; the counts equal
  those of `design.md` Context (31 and 23 for `openspec/roadmap.md`, 33 and 23 for each hub).
- [x] 1.2 The trace of the fast tests (D-2). Write the tracer of D-2 in the scratch folder and run
  each fast suite test file alone under it. Grep the fast test files for `spawnSync('python3'`,
  `'bash'` and `git grep` and note each hit that runs on the checkout. Compute D-3's table from the
  trace and the base map (the rule of D-3, the 56 keys of D-1). Commit `proof/doc-reads.txt`: the
  tracer's source, per test file its exit code and the document paths it opened, the grep hits and
  the computed table. Check: every traced file exits 0, and the computed table equals D-3's row for
  row (action and new list); a difference stops here (AC-1, AC-2).
- [x] 1.3 Conductor: the coverage run of the hubs (D-4). Write the coverage script of D-4 in the
  scratch folder, run the baseline and then each of the 35 test files of the two base hub lists
  alone, at most 6 at once. Commit `proof/hub-coverage.txt`: the script's source, the baseline's
  function count per hub, and per test file and hub its class as D-4's tables give it (own or
  other, with the line that makes it own), its exit code, its count beyond load and the first names
  of the functions it ran beyond load. Check: every file exits 0, every count of 0 and above 0
  falls on the same side as in D-4's tables, and so the kept and dropped links equal D-4's; a
  difference stops here (AC-3).
- [x] 1.4 The pin, red (D-5). Add `isDocumentKey`, `slowDocumentLinks` and the tests T-1, T-2 and
  T-3 to `plugins/openspec/hooks/test-suite.test.mjs` after T-16, with D-5's invariant comment.
  Check (the red half, not a gate):
  `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs --test-name-pattern="^test-map-hub-links AC-"`
  runs three tests, T-1 and T-2 passing and T-3 failing, its message naming
  `openspec/roadmap.md: plugins/openspec/hooks/change-loop.test.mjs` (AC-1 to AC-4).
- [x] 1.5 The map (D-3, D-4). Edit `scripts/test-map.json`: apply each row of D-3 (narrow, remove the
  key, relink) and remove from the two hub lists each test D-4 drops. Leave `slow`, `shared` and every
  other key as they are; keep each list sorted. Check:
  `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs --test-name-pattern="^(test-map-hub-links AC-|selective-tests-by-map-2 AC-9 AC-2 T-16)"`
  runs four tests and all pass;
  the simulation script of 1.1 on the edited map gives `map problems: 0` and, for each of the eight
  documents, the selection of D-3 with no slow file (AC-1, AC-2, AC-3, AC-4).
- [x] 1.6 `CONTRIBUTING.md` (D-6). Add D-6's sentence to the paragraph of line 44, right after "A
  comment line links nothing, only code lines do.". Check: `python3 scripts/check.py` passes, and
  `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs --test-name-pattern="^(suite-speed AC-7|suite-speed AC-8|selective-tests-by-map-2 AC-5 T-30)"`
  runs four tests and all pass (the two T-30 tests share the prefix). Commit 1.4, 1.5 and 1.6 together.
- [x] 1.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1,
  AC-2, AC-3, AC-4). Its `selected` lines name `guard` and `test-suite` (by `CONTRIBUTING.md`,
  `scripts/test-map.json` and `plugins/openspec/hooks/test-suite.test.mjs`) and no slow file.

## 2. The proofs on the head (phase 2)

- [ ] 2.1 Conductor: merge `origin/main` into the branch, the last merge before review (fetch
  first, then `git merge origin/main`). When the merge brings an edit of `scripts/test-map.json`,
  apply D-3 and D-4 to the merged keys in the merge commit and rerun 1.5's check. When it moves or
  renames a file or a helper this plan names, the same commit edits `proposal.md`, `design.md` and
  `tasks.md` (CLAUDE.md). When it brings a newer `origin/main` than 1.1's run, redo 1.1's whole run
  on that sha before 2.4. Check: `git status --short` is empty, and `git log -1 --format=%P` shows two
  parents or the merge said "Already up to date".
- [ ] 2.2 Conductor: AC-2's run (D-3). Make the scratch clone so that its base is the head itself
  and its own files are the one rename commit alone (`stalenessBase` in
  `plugins/openspec/hooks/deliver-check.mjs` reads `GITHUB_BASE_REF`, then `refs/remotes/origin/HEAD`,
  then `main`): with `<head>` the output of `git rev-parse HEAD` in this worktree after 2.1, run
  `git clone --quiet /Users/kauesantos/Documents/devkit/.claude/worktrees/test-map-hub-links /var/tmp/devkit-tmhl/clone`,
  then in the clone `git update-ref refs/remotes/origin/main <head>` and
  `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main`. In the clone, rename the
  heading `Round 17b: field fixes of 0.16.0` of `openspec/roadmap.md`, commit it, check that
  `git diff --name-only origin/main...HEAD` prints `openspec/roadmap.md` alone and
  `git status --short` prints nothing, and run
  `env -u GITHUB_BASE_REF -u GITHUB_HEAD_REF -u DEVKIT_BRANCH node scripts/test-suite.mjs --own-files`.
  Commit its output, with `<head>` and the clone's commands, as `proof/reader-fails.txt` in this
  worktree, and remove the clone. Check: the only `selected` line is
  `selected plugins/openspec/hooks/guard.test.mjs by openspec/roadmap.md`, the run exits 1, and the
  failed test is `field-fixes 12 roadmap: the round 17b line is read before round 18` (AC-2).
- [ ] 2.3 The selections after the change (D-8). Run 1.1's simulation script on the head's map and
  commit `proof/after-selection.txt`: per document and hub the `selected` lines and the counts, the
  files each hub lost against `proof/before-selection.txt`, and `mapProblems`' result. Check: no
  document selects a slow file, each hub's list equals D-4's, and `mapProblems` is empty (AC-1, AC-3,
  AC-4).
- [ ] 2.4 Conductor: AC-5 (D-8 steps 2 to 4). With no `TMPDIR` override, run
  `node scripts/test-suite.mjs --reporter=tap > /var/tmp/devkit-tmhl/head.tap 2>&1` and then
  `DEVKIT_BRANCH=train/1 node scripts/test-suite.mjs --own-files --reporter=tap > /var/tmp/devkit-tmhl/train.tap 2>&1`
  on the head, one after the other. Commit `proof/head-whole.txt`, `proof/train-whole.txt` and
  `proof/same-tests.txt` as D-8 says. Check: both runs exit 0; the train run's first line is
  `selected the whole suite: train/1 is a train branch`; both diffs of `same-tests.txt` are empty
  once the three names of D-5 are removed (AC-5).
- [ ] 2.5 AC-6 (D-7). Save the step names and times of run 46024905007's `check` job from
  `gh run view 46024905007 --json jobs` as `proof/ci-fixed-part.txt`, with the sum of the non-suite
  steps. Make a scratch clone exactly as in 2.2 (same path, `origin/main` and `origin/HEAD` on
  `<head>`), commit an edit of `openspec/roadmap.md` only that renames no heading (one added blank
  line at its end), check that `git diff --name-only origin/main...HEAD` prints
  `openspec/roadmap.md` alone, and run
  `time env -u GITHUB_BASE_REF -u GITHUB_HEAD_REF -u DEVKIT_BRANCH node scripts/test-suite.mjs --own-files`;
  commit its output, its time, `<head>` and the clone's commands as `proof/markdown-only.txt`, and
  remove the clone. Check: the run's only `selected` line is
  `selected plugins/openspec/hooks/guard.test.mjs by openspec/roadmap.md`, it exits 0, and the fixed
  part plus the local run is under about 2 minutes, or the task stops and the change goes back to
  the owner (D-7) (AC-6).
- [ ] 2.6 The release note stays the only release record. Check: `python3 scripts/gen-catalog.py --check`,
  `node plugins/compozy/kit/scripts/gen-agents.mjs --check`, `claude plugin validate .` and
  `openspec validate test-map-hub-links --strict` pass;
  `git diff --name-only origin/main...HEAD -- CHANGELOG.md .claude-plugin/marketplace.json plugins/openspec/.claude-plugin/plugin.json docs/catalog.md .github/workflows/ci.yml scripts/test-suite.mjs`
  prints nothing; `node plugins/openspec/hooks/deliver-check.mjs test-map-hub-links` prints no
  `no release:` line and no `release.md:` line.
- [ ] 2.7 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green (AC-1 to
  AC-6), after 2.1's merge. The pr-verifier copies the run's `selected` lines into its row, and
  writes the AC-1, AC-3 and AC-6 rows from `proof/after-selection.txt`, `proof/hub-coverage.txt`,
  `proof/ci-fixed-part.txt` and `proof/markdown-only.txt`.

## Workflow follow-up

- The `check` job of this change's pull request runs `node scripts/test-suite.mjs --own-files`
  green, and its log shows the `selected` lines of `guard` and `test-suite`. The evidence cites the
  run.
- This change's archive pull request is Markdown-only (`openspec/changes/archive/...` and
  `openspec/roadmap.md`). Its `check` job's step times are read with `gh run view <id> --json jobs`
  and go into the retro; a job above about 2 minutes goes back to the owner (D-7, AC-6's CI half).
- The next train's pull request and `push` to `main` run the whole suite in `check`.
- Before `enable-auto-merge`, the delivery reads `release.md` (`packs: []`): no version, no
  `CHANGELOG.md` entry and no ADR number to write.
