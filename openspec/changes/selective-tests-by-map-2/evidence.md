<!-- devkit-stage evidence result=passed attempt=1 commit=02eb93edb470f02f60c83ca508c25245233f7a55 -->
Commit: 02eb93edb470f02f60c83ca508c25245233f7a55

# Evidence

Change: `selective-tests-by-map-2` · Verified by the pr-verifier on head `02eb93ed`. The only
uncommitted paths are under `openspec/changes/selective-tests-by-map-2/` (the `proof/` folder,
`approval.md`, tick edits of `tasks.md`); none is an own file, so none changes a selection.
Machine: 14 cores, `df -h /` 408 Gi free, `uptime` load 3.98 before the gate run, no other suite
running. The selective gate was run once, with `env TMPDIR=/var/tmp/devkit-suite`, as a background
command of the tool.

## Verification

### Gates

| Gate | Command | Result |
|---|---|---|
| 1.7, 2.5, 3.6 | `node scripts/test-suite.mjs --own-files` | pass: run by the verifier on this head, exit 0, `suite: 35 files, 3724 tests, 3724 pass, 0 fail, 696.1s, concurrency 14`. 35 `selected` lines (each names the own file that selected it), 35 `pass` lines, no `selected the whole suite` line. The selected files are the tests of this change's own files (`scripts/test-suite.mjs`, `scripts/test-map.json`, `plugins/openspec/hooks/deliver-check.mjs`, `openspec/config.yaml`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/openspec-flow.md`, the three amended ADRs, the touched tests). This is the selective run, not a pass of the whole suite. |
| 1.7, 2.5, 3.6 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0, run by the verifier on this head |

Other checks re-run by the verifier on this head, all exit 0: `python3 scripts/gen-catalog.py --check`;
`node plugins/compozy/kit/scripts/gen-agents.mjs --check` (`21 CompozyOS agents are up to date`);
`openspec validate selective-tests-by-map-2 --strict` (`Change 'selective-tests-by-map-2' is valid`;
the `skip_specs` note is informational). `claude plugin validate .` was not re-run here.

### Acceptance criteria

| Id | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `gate-runs-mapped-tests` | `proof/case-a.txt`: the scratch commit touches `plugins/openspec/hooks/status-line.mjs`; the run prints one line `selected plugins/openspec/hooks/status-line.test.mjs by plugins/openspec/hooks/status-line.mjs`, starts only that file, `suite: 1 files, 184 tests, 184 pass, 0 fail`, exit 0. `proof/case-c.txt`: an edited slow test file selects itself. The verifier's own gate run above lists 35 `selected ... by ...` lines and ran exactly those 35 files. The tests `selective-tests-by-map-2 AC-1 T-1` to `T-4`, `T-17`, `T-21`, `T-24`, `T-26` in `plugins/openspec/hooks/test-suite.test.mjs` ran in that gate (it selects `test-suite.test.mjs`) and passed. | pass |
| AC-2 | `slow-only-when-linked` | `proof/case-b.txt`: the scratch commit touches the shared helper `plugins/openspec/hooks/test-fixtures.mjs`; 7 files are selected, each `by plugins/openspec/hooks/test-fixtures.mjs`, and none is in the map's `slow` list (23 files; the verifier checked the 7 names against it). `proof/case-c.txt`: the slow `github-setup.test.mjs` runs when it is itself edited. Tests `AC-2 AC-3 T-5`, `AC-2 T-6`, `AC-9 AC-2 T-16` passed in the gate run. | pass |
| AC-3 | `shared-helper-fast-only` | `proof/case-b.txt` as above: the helper selects the fast importers (`change-state-stages`, `compozy-driver`, `guard`, `merge-setup`, `status-line`, `changes-under-way`, `gh-version`). The verifier did not re-count the importers independently; test `AC-2 AC-3 T-5` (`sharedUses finds the tests that import a shared helper`) passed in the gate run. | pass |
| AC-4 | `unmapped-code-runs-all` | `proof/case-d.txt`: a new unmapped `scripts/x.py` prints `selected the whole suite: no entry of scripts/test-map.json covers scripts/x.py`, the pool starts 14 files, stopped with SIGINT, exit 130. `proof/case-e.txt`: a docs and `openspec/` only commit prints `selected no test file: 2 own files, none maps to a test`, exit 0. `proof/case-j.txt`: a copy with no `.git` prints `selected the whole suite: git cannot tell the own files: Command failed: git -C ... status --porcelain -z -uall`, no stack trace, stopped by SIGINT, exit 130. Tests `AC-4 T-7` to `T-9`, `T-18`, `T-19`, `T-22` passed in the gate run. | pass |
| AC-5 | `base-merge-selective` | `proof/base-merge.txt`: the selective run on the head after task 3.1; its `selected` lines name this change's own files' tests, no `selected the whole suite` line. Task 3.1's merge of `origin/main` (`e8991d6d`) was `Already up to date`, so no base merge brought new files. The texts the loop's agents read after a merge are in that file and in `openspec/config.yaml` (`Test command: node scripts/test-suite.mjs --own-files && python3 scripts/check.py`; `Gates:` names the selective part). Test `AC-5 T-30` (config and `CLAUDE.md` name the selective command) passed in the gate run. Proven by prose and by the texts here; the loop actually asking for the selective run after a real base merge is next-change dogfood, as the plan flags. | pass |
| AC-6 | `proof-selective` | This file: the gate table above has its own passing row for `node scripts/test-suite.mjs --own-files` with the run's `suite:` line and the selected files, and says it is not a whole-suite pass. `proof/case-e.txt` shows the run that selects no test file, exit 0, with its own message. `CLAUDE.md` working rule line 52 requires this row. The pr-verifier's row for a gate that selects no test file is next-change dogfood: this change's own gate always selects tests. | pass |
| AC-7 | `pr-ci-selective-train-whole` | `.github/workflows/ci.yml` job `check`: checkout `fetch-depth: "${{ github.event_name == 'pull_request' && '0' || '1' }}"` and the test step `node scripts/test-suite.mjs ${{ github.event_name == 'pull_request' && '--own-files' || '' }}` (read by the verifier); job id still `check`. `proof/case-f.txt`: a branch `train/99` prints `selected the whole suite: train/99 is a train branch`, stopped by SIGINT, exit 130. `proof/case-h.txt`: on a local merge commit with `GITHUB_BASE_REF=main GITHUB_HEAD_REF=scratch` the run selects only `status-line.test.mjs` by `status-line.mjs`, `184 tests, 184 pass`, exit 0. Test `T-29` in `test-tmp.test.mjs` passed in the gate run. The pull request's own `check` run is a workflow follow-up. | pass: the workflow text and the local reproductions above. The CI log of this change's own pull request does not exist yet (no pull request); `tasks.md` "Workflow follow-up" reads that real run before `enable-auto-merge`, and it is not proven here |
| AC-8 | `whole-suite-unchanged` | `proof/same-tests.txt`: whole suite with no flag on the base copy of `e8991d6d` and on the head: base `44 files, 3855 tests, 3852 pass, 0 fail`, head `44 files, 3892 tests, 3889 pass, 0 fail`, exit 0; start lines 44 and 44 and their sorted diff is empty; the sorted names differ only by the 36 `selective-tests-by-map-2 ` tests and one `release-note AC-14` test added by `02eb93ed` (no base name missing; the 3 skips are the compozy-loops tests without a daemon). `proof/case-i.txt`: no argument on a broken map runs the whole suite (14 start lines, stopped, exit 130). The verifier did not re-run the whole suite (the brief says 3.3's run is the proof) and read the files, not the raw `.tap` files. | pass |
| AC-9 | `map-checked` | `proof/case-g.txt`: a map entry naming `plugins/openspec/hooks/does-not-exist.mjs` prints `scripts/test-map.json: plugins/openspec/hooks/does-not-exist.mjs: names plugins/openspec/hooks/does-not-exist.mjs, which does not exist` and `refused: 1 test map problems`, exit 1, no test run. Tests `AC-9 T-10` to `T-15`, `T-23` and `AC-9 AC-2 T-16` (the repository's own map has no problem) passed in the gate run. | pass |

### Notes for the owner

- Proven only by prose or a later change: AC-5 (the loop's asking after a real base merge) and AC-6
  (the "selected no test file" row of a verifier), both flagged by the plan as next-change dogfood;
  AC-7's CI half (the pull request's own `check` log).
- The case files (`proof/case-a.txt` to `case-j.txt`) were produced by the conducting session's
  implementer in a scratch clone; the verifier read each header, command, `selected`/refusal lines and
  exit line, and did not re-run the cases. Cases (d), (f), (i) and (j) end with SIGINT by design.
- `proof/base-whole.txt` notes its run took 741.0 s because short runs overlapped it; the slow marks
  (23 files) may be slightly over-marked, which only makes the helper rule run fewer files.
- No defect found.
