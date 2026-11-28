<!-- devkit-stage evidence result=passed attempt=1 commit=f81f5ab789f68fa69c1e71329fa50015e0a5501e -->
Commit: f81f5ab789f68fa69c1e71329fa50015e0a5501e

# Evidence

Change `train-empty-failure-text`. Proof files: `proof/own-files-phase-1.txt` (the phase gate run, reused: product
files unchanged since, only change-folder files were added after f81f5ab) and `proof/empty-departure-real-run.txt` (a
real `train-loop.mjs depart` that empties, in a throwaway fixture repository under /var/tmp, since deleted).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.6 | `node scripts/test-suite.mjs --own-files` | pass: reused from `proof/own-files-phase-1.txt` (run as `--own-files --concurrency=2`, exit 0, on the same product files; head b7acf8f plus the uncommitted phase diff, under load 12); it selected 34 files (the `selected` lines are in that file) and ended `suite: 34 files, 3673 tests, 3673 pass, 0 fail, 3225.3s, concurrency 2`. Not a whole-suite pass. |
| 1.6 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0, run again at f81f5ab |

Also run at f81f5ab: `openspec validate train-empty-failure-text --strict` exit 0 (`valid`);
`git diff --quiet origin/main -- openspec/specs/` exit 0.

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | An emptying departure exits 1, `result: empty`, `left` entries have `why: red` and `failure` | Real run (`proof/empty-departure-real-run.txt`): code 1, `result: "empty"`, left `alpha` and `beta` each `why: "red"` with `failure: "not-green"`. Filtered run of `delivery-train.test.mjs` (names P8, train-empty-failure-text, nothing): 13 tests, 13 pass, exit 0. | pass |
| AC-2 | Record written at `<git common dir>/devkit-trains/<n>.md`, path in `record`, header `result=empty`, Left rows, `## Failure of` sections | Real run: `record` is an absolute path ending `/.git/devkit-trains/1.md`; the file starts `<!-- devkit-train n=1 base=main result=empty -->`, has an empty Boarded table, two Left rows with `red`, a Runs table, and `## Failure of` sections for `alpha` and `beta` holding `not-green`. | pass |
| AC-3 | No branch, worktree or commit, root status unchanged, same number next time | Real run: `git status --porcelain` before and after identical (`?? .claude/`), local branch refs identical, worktree list holds only main, alpha and beta (no train worktree). P8 test asserts the same plus no scratch folder and a second departure numbered 1 again (it passed in the filtered run). | pass |
| AC-4 | Conflict-only emptying also writes the record, `failure: null` | Test `train-empty-failure-text AC-4: a train emptied only by a conflict writes its record...` passed in the filtered run (13/13). No separate real run. | pass |
| AC-5 | Reply is `train-empty` with the path, English and pt-BR; nothing boarded still replies `train-nothing` | Real run reply: "The train emptied: every boarded change left it, so nothing was boarded and no train branch was created. ... is in /var/tmp/.../.git/devkit-trains/1.md." The P8 test also asserts the pt-BR render and passed; the `delivery-train-after.test.mjs` key-list/docs test passed (1 test, exit 0); the nothing-boarded `train-nothing` test is in the 13 passing. | pass |
| AC-6 | Spec gains the scenario; `docs/openspec-flow.md` says where the record is written | `openspec validate --strict` exit 0; the delta has the scenarios "Every change left red", "Emptied by a conflict" and "A second empty departure"; `docs/openspec-flow.md` changed by one line (diff vs origin/main); `check.py` passes; canonical `openspec/specs/` is unchanged against origin/main. | pass |

Outcome: verified. No defect found.
