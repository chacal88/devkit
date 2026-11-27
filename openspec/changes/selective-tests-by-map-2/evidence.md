<!-- devkit-stage evidence result=passed attempt=2 commit=ad271ce5a3018e8e37c7adb54f6fbba80d97722e -->
Commit: ad271ce5a3018e8e37c7adb54f6fbba80d97722e

# Evidence

Change: `selective-tests-by-map-2` · Second evidence pass, by the pr-verifier on head `ad271ce5`, after
code review round 1 rejected `02eb93ed` and tasks 2.6 to 2.9 and 3.7 were implemented. The tree was
clean at the head (`git status --short` empty); the only file written afterwards is this one, under
`openspec/changes/selective-tests-by-map-2/`, which is no own file and changes no selection.
Machine: 14 cores, `df -h /` 403 Gi free, no suite of any project running. `uptime` showed load
averages 34 to 21 when the verifier arrived (other sessions' work, no devkit suite), so the run waited
until the 1-minute load was 18, under the plan's 20; load was 7.78 after the run. The selective gate
was run once, with `env TMPDIR=/var/tmp/devkit-suite`, through the suite script, as a background
command of the tool.

What changed in code since the first pass (`git diff 02eb93ed HEAD`, outside `openspec/`): only
`scripts/test-suite.mjs` (37 lines) and `plugins/openspec/hooks/test-suite.test.mjs` (135 lines added).
Every change in `scripts/test-suite.mjs` sits in code that runs only under `--own-files`:
`trackedSuitePaths` is called only by `mapProblems`, whose only caller is the `options.ownFiles` branch
of `main` (read at line 523 of that file), and `selectOwn` is called from the same branch.
`git grep -n -e headBranch -e abbrev-ref -e spawnSync -- scripts/test-suite.mjs` prints nothing.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.7, 2.5, 3.6 | `node scripts/test-suite.mjs --own-files` | pass: run by the verifier on head `ad271ce5`, exit 0, `suite: 35 files, 3729 tests, 3729 pass, 0 fail, 868.7s, concurrency 14`. 35 `selected` lines, 35 `pass` lines, 0 `FAIL` lines, no `selected the whole suite` line. The selected files are the tests of this change's own files. The run listed 41 passing tests whose names start `selective-tests-by-map-2 `, among them the new T-31, T-32 and T-33 (AC-9), T-34 (AC-7) and T-35 (AC-1), and the passing `release-note AC-14 texts: the ADRs line keeps the two records linked and lets later records follow them`. This is the selective run, not a pass of the whole suite. |
| 1.7, 2.5, 3.6 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0, run by the verifier on head `ad271ce5` |

Other checks re-run by the verifier on this head, all exit 0: `python3 scripts/gen-catalog.py --check`;
`node plugins/compozy/kit/scripts/gen-agents.mjs --check` (`21 CompozyOS agents are up to date`);
`openspec validate selective-tests-by-map-2 --strict` (`Change 'selective-tests-by-map-2' is valid`;
the `skip_specs` note is informational). `claude plugin validate .` was not re-run here. The whole
suite was not run again: task 3.3's proof (`proof/same-tests.txt`) stands, because the fixes since it
touch only the `--own-files` path, which a plain whole run never loads (see above).

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `gate-runs-mapped-tests` | `proof/case-a.txt`: the scratch commit touches `plugins/openspec/hooks/status-line.mjs`; the run prints one line `selected plugins/openspec/hooks/status-line.test.mjs by plugins/openspec/hooks/status-line.mjs`, starts only that file, `suite: 1 files, 184 tests, 184 pass, 0 fail`, `exit: 0`. `proof/case-k.txt` run 1 gives the same `selected` line and `184 tests, 184 pass`, exit 0, on the fixed head `6ffbe2f2`. `proof/case-c.txt`: an edited slow test file selects itself. The verifier's own gate run above lists 35 `selected ... by ...` lines and ran exactly those 35 files. T-1 to T-4, T-17, T-21, T-24, T-26 and the new T-35 (the CI base is read from `GITHUB_BASE_REF`, a blank one diffs against `origin/main`) ran in that gate and passed. | pass |
| AC-2 | `slow-only-when-linked` | `proof/case-b.txt`: the scratch commit touches the shared helper `plugins/openspec/hooks/test-fixtures.mjs`; 7 files are selected, each `by plugins/openspec/hooks/test-fixtures.mjs`, and none is in the map's `slow` list (checked by the first pass against the 23 slow files). `proof/case-c.txt`: the slow `github-setup.test.mjs` runs when it is itself edited (`suite: 1 files, 49 tests, 49 pass`, exit 0). T-6 and `AC-9 AC-2 T-16` passed in this pass's gate run. | pass |
| AC-3 | `shared-helper-fast-only` | `proof/case-b.txt` as above: the helper selects the fast importers (`change-state-stages`, `compozy-driver`, `guard`, `merge-setup`, `status-line`, `changes-under-way`, `gh-version`). The verifier did not re-count the importers independently; the `sharedUses` test (T-5, `AC-2 AC-3`) is in `test-suite.test.mjs`, which the gate ran and passed whole. | pass |
| AC-4 | `unmapped-code-runs-all` | `proof/case-d.txt`: a new unmapped `scripts/x.py` prints `selected the whole suite: no entry of scripts/test-map.json covers scripts/x.py`, the pool starts 14 files, stopped with SIGINT, exit 130. `proof/case-e.txt`: a docs and `openspec/` only commit prints `selected no test file: 2 own files, none maps to a test`, exit 0. `proof/case-j.txt`: a copy with no `.git` prints `selected the whole suite: git cannot tell the own files: Command failed: git -C ... status --porcelain -z -uall`, no stack trace, SIGINT, exit 130. `proof/case-k.txt` run 2: an untracked, not ignored `plugins/openspec/hooks/stray.tmp` prints `selected the whole suite: no entry of scripts/test-map.json covers plugins/openspec/hooks/stray.tmp`, no refusal, SIGINT, exit 130. T-7 to T-9, T-19, T-22 passed in the gate run. | pass |
| AC-5 | `base-merge-selective` | pass: proven here, and next-change dogfood for the rest. Proven here: the texts the loop's agents read after a merge, `openspec/config.yaml` (`Test command: node scripts/test-suite.mjs --own-files && python3 scripts/check.py`, read by the verifier; `Gates:` names the selective part and says it needs its own passing row after a base merge that stales the evidence), and `proof/base-merge.txt`, the selective run on the head after task 3.1's merge (`origin/main` `e8991d6d`, `Already up to date`; the file's head is `02eb93ed`, its own files are the same ones): 35 `selected` lines, `suite: 35 files, 3724 tests, 3724 pass, 0 fail`, exit 0, no `selected the whole suite` line; and `proof/case-h.txt`, the run on a local merge commit with `GITHUB_BASE_REF=main GITHUB_HEAD_REF=scratch`, which selects only `status-line.test.mjs` by `status-line.mjs`, `184 tests, 184 pass`, exit 0. This pass's own gate run on `ad271ce5` has the same shape (35 selected, no whole-suite line). The `AC-5 T-30` tests (config and `CLAUDE.md` name the selective command) passed in the gate run. Next-change dogfood, not proven here: the loop asking for the selective run after a real base merge. | pass: the texts, `proof/base-merge.txt` and `proof/case-h.txt` as above; the loop's request after a real base merge is next-change dogfood |
| AC-6 | `proof-selective` | This file: the gate table above has its own passing row for `node scripts/test-suite.mjs --own-files` with the run's `suite:` line and the selected files, and says it is not a whole-suite pass. `proof/case-e.txt` shows the run that selects no test file, exit 0, with its own message. `CLAUDE.md` working rules require this row. The pr-verifier's row for a gate that selects no test file is next-change dogfood: this change's own gate always selects tests. | pass |
| AC-7 | `pr-ci-selective-train-whole` | Proven here: `.github/workflows/ci.yml` job `check` has checkout `fetch-depth: "${{ github.event_name == 'pull_request' && '0' || '1' }}"` (line 11) and the test step `node scripts/test-suite.mjs ${{ github.event_name == 'pull_request' && '--own-files' || '' }}` (line 28), read by the verifier; the job id is still `check`. `proof/case-f.txt`: a branch `train/99` prints `selected the whole suite: train/99 is a train branch`, SIGINT, exit 130. `proof/case-h.txt` as in AC-5. T-20, the new T-34 (the branch is read through `currentBranch`: `DEVKIT_BRANCH=train/4` runs the whole suite, `feature` beside `GITHUB_HEAD_REF=train/7` stays selective) and T-29 (`test-tmp.test.mjs`) ran in gate runs and passed. The pull request's own `check` run is a workflow follow-up. | pass: the workflow text and the local reproductions above. The CI log of this change's own pull request does not exist yet (no pull request); `tasks.md` "Workflow follow-up" reads that real run before `enable-auto-merge`, and it is not proven here |
| AC-8 | `whole-suite-unchanged` | `proof/same-tests.txt` (head `02eb93ed`, base `e8991d6d`): whole suite with no flag, base `44 files, 3855 tests, 3852 pass, 0 fail`, head `44 files, 3892 tests, 3889 pass, 0 fail`, exit 0; start lines 44 and 44, their sorted diff empty; after removing the 36 `selective-tests-by-map-2 ` names, the only name against the base is `release-note AC-14 texts: the ADRs line keeps the two records linked and lets later records follow them`, as the plan reads AC-8 (no base name missing; the 3 skips are the compozy-loops tests without a daemon). `proof/case-i.txt`: no argument on a broken map runs the whole suite (14 start lines, stopped, exit 130). The whole suite was not run again in this pass, on purpose: the commits since (`30a7136f`, `4ae8dd5d`) touch `scripts/test-suite.mjs` only on the `--own-files` path (`mapProblems` and `selectOwn` are reached only there) and add tests to `test-suite.test.mjs`, so 3.3's proof stands; the 5 tests added since (T-31 to T-35) are `selective-tests-by-map-2 ` names, which D-10 removes before the comparison. The verifier read the files, not the raw `.tap` files. | pass |
| AC-9 | `map-checked` | `proof/case-g.txt`: a map entry naming `plugins/openspec/hooks/does-not-exist.mjs` prints `scripts/test-map.json: plugins/openspec/hooks/does-not-exist.mjs: names plugins/openspec/hooks/does-not-exist.mjs, which does not exist` and `refused: 1 test map problems`, exit 1, no test run. `proof/case-k.txt` (the review's reproduction of M5, on head `6ffbe2f2`, which holds the fix `30a7136f`): run 1 with an untracked, ignored `plugins/openspec/hooks/.DS_Store` gives no `is not covered by the map` line, the case (a) `selected` line, `184 tests, 184 pass`, exit 0; run 2 with an untracked `stray.tmp` gives no refusal and the whole suite with the `no entry ... covers` reason (AC-4 row). T-10 to T-15, T-23, `AC-9 AC-2 T-16`, and the new T-31 (M5 on git's list), T-32 (the disk walk where git cannot tell) and T-33 (end to end, `.DS_Store` and `__pycache__` change no selected line; a committed uncovered file is refused) passed in the gate run. `git grep` for `headBranch`, `abbrev-ref` and `spawnSync` in `scripts/test-suite.mjs` prints nothing (task 2.8's check). | pass |

### Notes for the owner

- Proven by prose and by the local reproductions only: AC-5 (the loop asking for the selective run
  after a real base merge is next-change dogfood), AC-6 (the "selected no test file" row of a verifier,
  same), and AC-7's CI half (the pull request's own `check` log, a workflow follow-up).
- The case files `proof/case-a.txt` to `case-j.txt`, `proof/base-merge.txt` and `proof/same-tests.txt`
  were produced on head `02eb93ed`; `proof/case-k.txt` on `6ffbe2f2`. The verifier read each header,
  command, `selected` or refusal line and exit line, and did not re-run the cases. The code that changed
  since `02eb93ed` is the M5 list, the branch read and their tests; the verifier's gate run on
  `ad271ce5` and case (k) cover those. Cases (d), (f), (i), (j) and (k) run 2 end with SIGINT by design.
- `proof/base-whole.txt` notes its run took 741.0 s because short runs overlapped it; the slow marks
  (23 files) may be slightly over-marked, which only makes the helper rule run fewer files.
- The gate run took 868.7 s against 696.1 s in the first pass: the machine's load was higher (other
  sessions' work); no test failed and none is a flake candidate.
- No defect found.
