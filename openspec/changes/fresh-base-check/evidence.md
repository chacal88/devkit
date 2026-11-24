<!-- devkit-stage evidence result=failed attempt=3 commit=c26d8c4042268399af2f8e6e41010967c847454a -->
Commit: c26d8c4042268399af2f8e6e41010967c847454a

# Evidence

Change `fresh-base-check`, verified at `c26d8c4` (`git rev-parse HEAD` printed
`c26d8c4042268399af2f8e6e41010967c847454a`; `git status --short` printed nothing before and after the runs: the working tree
was clean). This is attempt 3. Attempt 2 was written at `c905dcf`; since then the branch merged `origin/main` (train 4:
archive-release-pin, the pin test reads `plugins/openspec/.claude-plugin/plugin.json`) and the release was renumbered to
devkit-openspec 0.41.0 and marketplace 0.46.0 (line 3 of `plugins/openspec/.claude-plugin/plugin.json` reads
`"version": "0.41.0"`; `.claude-plugin/marketplace.json` reads `0.46.0` in `metadata` and `0.41.0` for devkit-openspec).
`git diff --stat c905dcf HEAD -- plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/roadmap-loop.mjs
plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` printed nothing: the code and the
tests of this change are the same as at attempt 2; what changed is the merged base around them.

**Outcome of this attempt: defect-found.** Every test passes, but `node scripts/test-suite.mjs
plugins/openspec/hooks/change-loop.test.mjs` exits 1, because `fresh-base-check 7` leaves a folder in the process's
`TMPDIR` (see "Defect" below). The delivery train's whole-suite command would exit 1 for the same reason.

How this was run (rules of this refresh): no unfiltered `node scripts/test-suite.mjs` and no full-suite run; one test
file at a time, each as a background command; `TMPDIR=/var/tmp/devkit-fbc`; logs under `/var/tmp/devkit-fbc-ev/`. The
machine was shared: the load average (`uptime`, 1 minute) is recorded next to each time. The first change-loop run also set
`GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main` (as the gates of `tasks.md` do); it was repeated without them, to be
sure they were not the cause of the leftover, and gave the same result.

### Defect

- **What:** `fresh-base-check 7` (`plugins/openspec/hooks/change-loop.test.mjs`, line 2162 to 2173) calls
  `changeLoopModule.stopDecision(stopInput(d.t.main, runTranscript()), { env })` in the test process (line 2170).
  `stopDecision` records a refusal under `<os.tmpdir()>/devkit-stop/` (`recordFile`, `refuseOnce` in
  `plugins/openspec/hooks/change-loop.mjs`, lines 2481 to 2490), and `os.tmpdir()` is the process's own `TMPDIR`, not
  the `env` the test passes. The test never removes that folder. `scripts/test-suite.mjs` fails a file that leaves anything in
  its `TMPDIR` (header: "fails a file that leaves anything in its TMPDIR"), so the file ends `LEFT` and the run exits 1.
- **Where:** `/var/tmp/devkit-fbc-ev/cl4.log` (last lines): `=== plugins/openspec/hooks/change-loop.test.mjs: LEFT 311.6s`,
  `LEFT 311.6s plugins/openspec/hooks/change-loop.test.mjs left: devkit-stop`,
  `suite: 1 files, 176 tests, 176 pass, 0 fail, 311.6s, concurrency 8`, `exit=1`. The same with the `GITHUB_*` variables:
  `/var/tmp/devkit-fbc-ev/cl3-with-github-env.log`, `LEFT 758.2s ... left: devkit-stop`, `exit=1`.
- **How to reproduce (7 s):** `cd <worktree> && TMPDIR=/var/tmp/devkit-fbc node scripts/test-suite.mjs
  --test-name-pattern="^fresh-base-check 7" plugins/openspec/hooks/change-loop.test.mjs` printed `1 tests, 1 pass, 0 fail,
  7.0s`, `LEFT 7.0s ... left: devkit-stop`, exit 1 (load 3.33; the output of this one run was read on the terminal, no log
  file kept).
- **Test 7 is the only one that leaves it:** the same file with `--test-skip-pattern="^fresh-base-check 7"` ended
  `suite: 1 files, 175 tests, 175 pass, 0 fail, 391.6s, concurrency 8`, `=== ...: pass 391.6s`, `exit=0`
  (`/var/tmp/devkit-fbc-ev/cl-skip7.log`; load 12.26 at the start, 8.79 at the end).
- **Not new at this head:** the one whole-suite run of this change (head `38b5cd9`,
  `/var/tmp/devkit-fresh-base-check/full-suite.log`, line 1888 and 3538) already had
  `=== plugins/openspec/hooks/change-loop.test.mjs: LEFT 695.3s` and `left: devkit-stop`; attempt 2 recorded only the two
  test failures of that run and missed the leftover. The test was added by `38b5cd9`.
- **Effect:** the change's own tests are green, but the train's `node scripts/test-suite.mjs` exits 1 until the
  leftover goes (the test must point `os.tmpdir()` somewhere it removes, or remove what it wrote). This verifier fixes
  nothing; the change goes back to implementation.

### Gates

The three gate commands of `tasks.md` are run as written where this refresh could (guard run, `check.py`,
`gen-catalog.py --check`, `claude plugin validate .`, `openspec validate`). The two `node --test` gate commands that filter by
name (1.5 and 2.4) were not run verbatim: this refresh ran whole files through `scripts/test-suite.mjs`, one file at a time,
and one green whole-file run of the file stands for the filtered parts (the file imports every test the name filters
name); the filter would run a subset of the same tests. Their rows say so.

| Gate | Command | Result |
|---|---|---|
| 1.5 | `mkdir -p /var/tmp/devkit-fbc` | pass: the folder exists and every run below used it as `TMPDIR`; exit 0 |
| 1.5 | `env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " --test-name-pattern="^change-loop" plugins/openspec/hooks/change-loop.test.mjs` | pass: not run verbatim; the whole file ran through `node scripts/test-suite.mjs plugins/openspec/hooks/change-loop.test.mjs` (run without `GITHUB_*`: `/var/tmp/devkit-fbc-ev/cl4.log`; with them: `cl3-with-github-env.log`): `ℹ tests 176`, `ℹ pass 176`, `ℹ fail 0`, `ℹ skipped 0`, and `suite: 1 files, 176 tests, 176 pass, 0 fail, 311.6s` (start 11:33:56, load 12.97; end 11:39:08, load 3.76); with the variables `176 tests, 176 pass, 0 fail, 758.2s` (start 11:21:01, load 30.03; end 11:33:40, load 14.29). All 16 `fresh-base-check` tests of the file pass. The runner's exit code was 1 in both runs, from the leftover `devkit-stop` (section Defect), not from a test |
| 1.5 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0 (11:21, load 30.47) |
| 2.4 | `mkdir -p /var/tmp/devkit-fbc` | pass: the folder exists; exit 0 |
| 2.4 | `env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^format: ship-change" plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: not run verbatim; the whole file ran through `node scripts/test-suite.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` (`/var/tmp/devkit-fbc-ev/roadmap-loop-5.log`): `ℹ tests 115`, `ℹ pass 115`, `ℹ fail 0`, `suite: 1 files, 115 tests, 115 pass, 0 fail, 278.1s`, `=== ...: pass`, exit 0 (start 11:39:39, load 2.66; end 11:44:17, load 4.46). All 5 roadmap `fresh-base-check` tests pass. The change-loop tests it names run in the other file's process (row 1.5) |
| 2.4 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0 (same run as row 1.5) |
| 3.2 | `mkdir -p /var/tmp/devkit-fbc` | pass: the folder exists; exit 0 |
| 3.2 | `env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/guard.test.mjs` | pass: run verbatim at `c26d8c4` (`/var/tmp/devkit-fbc-ev/guard.log`): `ℹ tests 132`, `ℹ pass 132`, `ℹ fail 0`, `ℹ skipped 0`, `ℹ duration_ms 64123`, `exit=0` (start 11:51:47, load 9.67; end 11:52:51, load 12.46) |
| 3.2 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0 |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: printed nothing, exit 0 |
| 3.2 | `command claude plugin validate .` | pass: `✔ Validation passed`, exit 0 |
| 3.2 | `openspec validate fresh-base-check --strict` | pass: `Change 'fresh-base-check' is valid`, exit 0 |
| other, not in `tasks.md` | `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` | pass: `21 CompozyOS agents are up to date`, exit 0 |
| whole-file run, change-loop | `node scripts/test-suite.mjs plugins/openspec/hooks/change-loop.test.mjs` | fail: all 176 tests pass but the runner exits 1: `LEFT ... left: devkit-stop` (section Defect); `cl4.log`, 311.6s, load 12.97 to 3.76 |
| whole-file run, change-loop without test 7 | `node scripts/test-suite.mjs --test-skip-pattern="^fresh-base-check 7" plugins/openspec/hooks/change-loop.test.mjs` | pass: `175 tests, 175 pass, 0 fail, 391.6s`, exit 0 (load 12.26 to 8.79); shows test 7 is the only leftover |
| whole-file run, roadmap-loop | `node scripts/test-suite.mjs plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: `115 tests, 115 pass, 0 fail, 278.1s`, exit 0 (load 2.66 to 4.46) |
| whole-file run, conduct-check | `node scripts/test-suite.mjs plugins/openspec/hooks/conduct-check.test.mjs` | pass: `105 tests, 105 pass, 0 fail, 74.4s`, exit 0 (load 4.46 to 4.55) |
| whole-file run, deliver-check | `node scripts/test-suite.mjs plugins/openspec/hooks/deliver-check.test.mjs` | pass: `218 tests, 218 pass, 0 fail, 107.6s`, exit 0 (load 4.55 to 2.00) |
| whole-file run, change-loop-compozy | `node scripts/test-suite.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs` | pass: `197 tests, 197 pass, 0 fail, 258.1s`, exit 0 (load 2.00 to 9.45); the list holds `✔ change-loop docs: the design records the answers` (the pin test of attempt 2, now on the merged base) |

No full-suite run was made (the delivery train runs it once for all the changes); the whole-file runs above are
the files the owner's rules named plus `guard.test.mjs`. `git status --short` printed nothing at the end of the runs.

### Acceptance criteria

The `fresh-base-check N` tests are named as they print. The timings are from `/var/tmp/devkit-fbc-ev/cl4.log` (change-loop
file, load 12.97 at its start) and `/var/tmp/devkit-fbc-ev/roadmap-loop-5.log` (roadmap-loop file, load 2.66 at its start).
The change-loop file holds 16 of the change's tests (1 to 11 without 12 to 15, plus 16, 17, 19, 19b, 20) and the roadmap file 5
(12, 13, 14, 15, 18): 21 in all, none skipped, none failing.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `next-fetches-before-judging`: with `origin/main` one commit behind the remote, `change-loop.mjs next` for a change in delivery moves `refs/remotes/origin/main` to the remote's sha and returns `resolve-release-conflict`; the same fixture without the fetch returns `update-branch` | `✔ fresh-base-check 1: next fetches the base before it judges, and a call with no record judges from the stale copy (6283.6 ms)` in `cl4.log`: the test builds the stale merge fixture, asserts the no-fetch `nextAction` gives step `update-branch` with the origin copy still stale, then asserts `next` exits 0 with an `agent` action at step `resolve-release-conflict`, `baseFetch` deep-equal `{ ok: true, base: 'main' }`, and `origin/main` at the remote's sha. `✔ fresh-base-check 8` (8750 ms) backs the per-call rule | pass |
| AC-2 | `wait-and-roadmap-fetch`: `change-loop.mjs wait` (each poll), `roadmap-loop.mjs next` and `roadmap-loop.mjs wait` fetch the base before judging; `stateEntries`, `stopDecision` and `status` do not | Change-loop file (`cl4.log`): `✔ fresh-base-check 6: a wait fetches the base at every poll (7808 ms)` (three polls, three logged fetches through the `git` shim); `✔ fresh-base-check 10: a wait that only gains the failed-fetch line goes on waiting`; `✔ fresh-base-check 19: a wait whose fetch really fails keeps waiting, and ends on the real change of decision (6626 ms)`; `✔ fresh-base-check 19b: a reply that is only the failed-fetch line is no new decision either (7238 ms)`. Negative: `✔ fresh-base-check 7: state, the stop lock and a call with no record never fetch (7240 ms)` (it asserts `shim.fetches()` is empty and `origin/main` stays at the stale sha; this is also the test that leaves `devkit-stop`, section Defect). Roadmap file (`roadmap-loop-5.log`): `✔ fresh-base-check 12: roadmap next fetches the base once for the changes it reads (12130 ms)`, `✔ fresh-base-check 13: the roadmap wait fetches the base at every poll (8479 ms)`, `✔ fresh-base-check 14: status, status --json and the stop lock never fetch (23457 ms)`. `git grep -n "fetchBase" -- plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/roadmap-loop.mjs` places the option in `nextAction` (line 1463, use at 1499), `runNext` (3007), `runWait`'s poll (3181), `collectRoadmap` (749, 808), the roadmap `run` and `next` commands (1467, 1516) and its `wait` poll (1759): none in `stateEntries`, `stopDecision`, `status` | pass |
| AC-3 | `checkers-stay-pure`: `conduct-check.mjs` and `deliver-check.mjs` on the stale fixture leave `refs/remotes/origin/main` unchanged and their headers still say they never fetch; a test fails when either runs `git fetch` | `✔ fresh-base-check 9: the two checkers never fetch, and their headers say so (1294 ms)` in `cl4.log` (the stale fixture, both checkers spawned through the logging `git` shim, no fetch logged, `origin/main` unchanged, the header pattern in the first six lines of each file, and a self-check that a `git fetch` through the shim is logged). `git diff origin/main...HEAD -- plugins/openspec/hooks/deliver-check.mjs` printed one line changed: `-// Reads files and git; never writes, pushes or posts. No dependencies.` became `+// Reads files and git; never writes, pushes, posts or fetches. No dependencies.`; `git diff --stat origin/main...HEAD -- plugins/openspec/hooks/deliver-check.mjs plugins/openspec/hooks/conduct-check.mjs` printed `1 file changed, 1 insertion(+), 1 deletion(-)` (deliver-check only). `conduct-check.mjs` line 4 reads `... never fetches.`; `grep -n "fetch" plugins/openspec/hooks/conduct-check.mjs` finds only lines 4, 637 and 685 (comment and error texts) and `grep -n "git.*fetch\|'fetch'" plugins/openspec/hooks/deliver-check.mjs` only lines 3, 1706 and 2338 (comment and message texts): no call to `git fetch`. The conduct-check and deliver-check test files, merged from train 4, also pass whole (105 and 218 tests, rows above) | pass |
| AC-4 | `fetch-failure-does-not-block`: with the remote unreachable or the fetch past the timeout, `next` returns the same action as today from the local copy, with `baseFetch.ok` false, git's first error line in `baseFetch.error` and a `reply` line saying the base was judged from the local copy; the exit code is the action's own | Change-loop file: `✔ fresh-base-check 2: a fetch that fails decides from the local copy, records it and says it in one line, in both languages (9642 ms)` (missing remote: same `kind`, step and exit code as the no-fetch action, `baseFetch.ok` false, one-line `error`, the `base-unfetched` reply in English and Portuguese); `✔ fresh-base-check 3: a fetch that outlives its timeout fails with a plain line and writes nothing (1235 ms)`; `✔ fresh-base-check 4: a ref that is locked fails the fetch, and the action is the local copy's (6523 ms)`; `✔ fresh-base-check 16: a repository with no remote fetches nothing and decides as it did (4248 ms)`; `✔ fresh-base-check 20: a failed fetch appends its line to a reply the local action already has (4571 ms)`; test 19 (AC-2 row) covers the failed fetch through a real wait. Roadmap file: `✔ fresh-base-check 18: a remote that cannot be reached leaves every change decided from the local copy, and the failure is read once (27868 ms)` | pass |
| AC-5 | `fetch-writes-only-the-base`: after a successful fetch only `refs/remotes/origin/<base>` differs (no new tag, no other remote branch moved, the working tree and the index untouched) | `✔ fresh-base-check 5: the fetch writes the one ref and nothing else (3182 ms)` in `cl4.log`: after a push of a branch and a tag from a second clone, `next` moves only `refs/remotes/origin/main`; the other refs, the status and index snapshots of the repository and the worktree are equal before and after, no new tag or remote branch, no `FETCH_HEAD` (and a self-check that a plain `git fetch` would create one). The command the code runs, `plugins/openspec/hooks/change-loop.mjs` line 1427: `git -C <root> fetch --no-tags --quiet --no-write-fetch-head origin +refs/heads/<base>:refs/remotes/origin/<base>` | pass |
| AC-6 | `one-fetch-per-process`: a roadmap `next` over three changes in delivery runs one `git fetch` for the base, counted through a fake `git` | `✔ fresh-base-check 12: roadmap next fetches the base once for the changes it reads (12130 ms)` and `✔ fresh-base-check 15: roadmap run fetches the base once (11835 ms)` in `roadmap-loop-5.log` (three implementation-stage changes, `git` shim, exactly one logged fetch, `origin/main` at the remote's sha); `✔ fresh-base-check 18` asserts the failed fetch is also read once; `✔ fresh-base-check 8` in `cl4.log` asserts two `nextAction` calls sharing one record log one fetch, and two `next` calls log two | pass |
| AC-7 | `docs-state-the-rule`: `docs/openspec-flow.md` states that the loop fetches the base before it asks the checkers and that `conduct-check` and `deliver-check` never fetch; `python3 scripts/check.py` passes | `✔ fresh-base-check 11: the docs and the skills state the rule of the fetch (1.5 ms)` in `cl4.log` (the five texts of `design.md` D-7 in `docs/openspec-flow.md`, the old `never fetches (run` wording gone, the `update-branch` row of `ship-change` and the `## Loop` section of the `devkit` skill). `git grep -n "fetches the base\|never fetches" -- docs/openspec-flow.md` printed three lines, 238 (the wait: each poll fetches the base first), 256 (`conduct-check` never fetches; the loops fetch the base before they ask it) and 517 (`deliver-check never fetches`); `git grep -n "never fetches (run" -- docs/openspec-flow.md` printed nothing (exit 1). The CI example pins read `v0.41.0` (`docs/openspec-flow.md` lines 733, 734 and 747), the renumbered release. `python3 scripts/check.py`: `all checks passed`, exit 0. The pin test of the merged base, `change-loop docs: the design records the answers`, passes in `change-loop-compozy.test.mjs` (197 of 197) | pass |

### Notes for the reviewers

- **One defect, open:** `fresh-base-check 7` leaves `<TMPDIR>/devkit-stop`, which makes `scripts/test-suite.mjs` exit 1 for
  `change-loop.test.mjs` (section Defect). The whole suite the train runs would exit 1. It was in the earlier whole-suite
  run too and was not noticed.
- Everything else is green at `c26d8c4`: the 21 tests of this change (16 + 5), `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `gen-agents.mjs --check`, `claude plugin validate .`,
  `openspec validate fresh-base-check --strict`, the guard suite (132), and the five whole-file runs named in the task.
- Not run: the whole suite (the train's job), and the two name-filtered `node --test` gate commands of 1.5 and 2.4 verbatim
  (stood in for by the whole-file runs, rows above).
- Times are not benchmarks: the machine was shared (load 30 at the first run, 2 to 12 later), and each is recorded with its
  load next to it.
