<!-- devkit-stage evidence result=passed attempt=4 commit=8f21e0a5801893e8aaa2ebc84d72948db8a74cb5 -->
Commit: 8f21e0a5801893e8aaa2ebc84d72948db8a74cb5

# Evidence

Change `fresh-base-check`, verified at `8f21e0a` (`git rev-parse HEAD` printed
`8f21e0a5801893e8aaa2ebc84d72948db8a74cb5`; `git status --short` printed nothing before and after the runs: the working
tree was clean). This is attempt 4. Attempt 3 was written at `c26d8c4` and found one defect: `fresh-base-check 7` left
`devkit-stop/` in `TMPDIR`, so `change-loop.test.mjs` exited 1. Since then `893fad8` fixed that test (it points
`TMPDIR` at a sandbox and removes it in a `finally`), and `8f21e0a` merged `origin/main` (trains 6 to 9, main `c09860c`)
and renumbered the release to devkit-openspec 0.45.0 and marketplace 0.50.0 (`plugins/openspec/.claude-plugin/plugin.json`
line 3 reads `"version": "0.45.0"`).

**Outcome of this attempt: verified.** Every run below exited 0 and no file left anything in its `TMPDIR`.

How this was run (rules of this refresh): no whole-suite run (the delivery train proves it); each touched test file ran
through `node scripts/test-suite.mjs --concurrency=2 <file>` with `TMPDIR=/var/tmp/devkit-fbc-ev4`, one file after the
other, as one background command; logs under `/var/tmp/devkit-fbc-ev4-logs/` (`index.txt` holds start, end, exit and load
of each run). No `GITHUB_*` variable was set. The machine was shared: the load average (`uptime`, 1 minute, then 5 and 15)
is recorded next to each time. After the six runs `ls -A /var/tmp/devkit-fbc-ev4 | wc -l` printed `0`.

### Attempt-3 defect: gone

- **Fix:** `git show 893fad8` changes only `plugins/openspec/hooks/change-loop.test.mjs` (10 insertions, 1 deletion): around
  the `stopDecision` call of test 7 (test starts at line 2174) it sets `process.env.TMPDIR` to `sandbox()`, and the `finally`
  restores it and runs `rmSync(tmp, { recursive: true, force: true })`.
- **Reproduction at `8f21e0a`:** `mkdir -p /var/tmp/devkit-fbc-ev4-t7 && TMPDIR=/var/tmp/devkit-fbc-ev4-t7 node
  scripts/test-suite.mjs --test-name-pattern="^fresh-base-check 7" plugins/openspec/hooks/change-loop.test.mjs` (log
  `/var/tmp/devkit-fbc-ev4-logs/t7.log`) ended `=== plugins/openspec/hooks/change-loop.test.mjs: pass 9.8s` and `suite: 1
  files, 1 tests, 1 pass, 0 fail, 9.8s, concurrency 8`, exit 0 (load 10.29 at the start, 9.55 at the end). At attempt 3 the same
  command printed `LEFT 7.0s ... left: devkit-stop`, exit 1. `ls -A /var/tmp/devkit-fbc-ev4-t7 | wc -l` printed `0`: the file left nothing.
- **Whole file:** the full change-loop run below (200 tests) exits 0, with no `LEFT` line (`grep -E "^=== "` of its log
  prints `pass 313.5s`).

### Gates

The gate commands of `tasks.md` are listed as written. The two `node --test` commands that filter by name (1.5 and 2.4)
were not run verbatim: the whole file ran through `node scripts/test-suite.mjs`, and one green whole-file run stands for the
filtered part (the filter runs a subset of the same file). Their rows say so.

| Gate | Command | Result |
|---|---|---|
| 1.5 | `mkdir -p /var/tmp/devkit-fbc` | pass: not run; this refresh used `/var/tmp/devkit-fbc-ev4` (`mkdir -p` exit 0) as `TMPDIR` for the same purpose |
| 1.5 | `env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " --test-name-pattern="^change-loop" plugins/openspec/hooks/change-loop.test.mjs` | pass: not run verbatim; the whole file ran as `TMPDIR=/var/tmp/devkit-fbc-ev4 node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/change-loop.test.mjs`: `ℹ tests 200`, `ℹ pass 200`, `ℹ fail 0`, `ℹ skipped 0`, `suite: 1 files, 200 tests, 200 pass, 0 fail, 313.5s, concurrency 2`, exit 0 (14:39:16 load 10.70, 14:44:30 load 1.68). All 16 `fresh-base-check` tests of the file pass (list under AC rows) |
| 1.5 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0 (14:39, load about 10) |
| 2.4 | `mkdir -p /var/tmp/devkit-fbc` | pass: not run; `/var/tmp/devkit-fbc-ev4` stood in, exit 0 |
| 2.4 | `env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 --test-name-pattern="^fresh-base-check " --test-name-pattern="^roadmap-loop" --test-name-pattern="^change-loop" --test-name-pattern="^format: ship-change" plugins/openspec/hooks/roadmap-loop.test.mjs` | pass: not run verbatim; the whole file ran as `TMPDIR=/var/tmp/devkit-fbc-ev4 node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/roadmap-loop.test.mjs`: `ℹ tests 115`, `ℹ pass 115`, `ℹ fail 0`, `suite: 1 files, 115 tests, 115 pass, 0 fail, 254.6s, concurrency 2`, exit 0 (14:44:30 load 1.68; 14:48:45 load 1.07). All 5 roadmap `fresh-base-check` tests pass |
| 2.4 | `python3 scripts/check.py` | pass: same run as row 1.5 |
| 3.2 | `mkdir -p /var/tmp/devkit-fbc` | pass: not run; `/var/tmp/devkit-fbc-ev4` stood in, exit 0 |
| 3.2 | `env TMPDIR=/var/tmp/devkit-fbc GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-concurrency=1 plugins/openspec/hooks/guard.test.mjs` | pass: not run verbatim; ran as `TMPDIR=/var/tmp/devkit-fbc-ev4 node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/guard.test.mjs`: `ℹ tests 132`, `ℹ pass 132`, `ℹ fail 0`, `suite: 1 files, 132 tests, 132 pass, 0 fail, 30.6s, concurrency 2`, exit 0 (14:55:13 load 2.46; 14:55:44 load 2.68) |
| 3.2 | `python3 scripts/check.py` | pass: `all checks passed`, exit 0 |
| 3.2 | `python3 scripts/gen-catalog.py --check` | pass: printed nothing, exit 0 |
| 3.2 | `command claude plugin validate .` | pass: `✔ Validation passed`, exit 0 (run at the end of this refresh, after the test runs) |
| 3.2 | `openspec validate fresh-base-check --strict` | pass: `Change 'fresh-base-check' is valid`, exit 0 |
| other, not in `tasks.md` | `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` | pass: `21 CompozyOS agents are up to date`, exit 0 |
| other, not in `tasks.md` | `pinsIn` of `plugins/openspec/hooks/deliver-check.mjs` over `docs/openspec-flow.md` | pass: printed `["v0.45.0","v0.45.0","v0.45.0","v0.45.0"]`; `grep -n "v0\.4[0-9]\.0" docs/openspec-flow.md` finds lines 733, 734 and 747, all `v0.45.0` |
| whole-file run, change-loop-compozy | `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/change-loop-compozy.test.mjs` | pass: `200 tests, 200 pass, 0 fail, 219.6s, concurrency 2`, exit 0 (14:48:45 load 1.07; 14:52:24 load 0.60); the list holds `✔ change-loop docs: the design records the answers` |
| whole-file run, deliver-check | `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/deliver-check.test.mjs` | pass: `226 tests, 226 pass, 0 fail, 109.6s`, exit 0 (14:52:24 load 0.60; 14:54:14 load 1.63) |
| whole-file run, conduct-check | `node scripts/test-suite.mjs --concurrency=2 plugins/openspec/hooks/conduct-check.test.mjs` | pass: `105 tests, 105 pass, 0 fail, 59.4s`, exit 0 (14:54:14 load 1.63; 14:55:13 load 2.46) |

Not run: the whole suite (the train's job). All six whole-file runs ran with `TMPDIR`
pointing to a folder that was empty afterwards (`scripts/test-suite.mjs` would have printed `LEFT`; no log has that word).
`git status --short` printed nothing at the end.

### Acceptance criteria

The `fresh-base-check N` tests are named as they print. Timings come from `/var/tmp/devkit-fbc-ev4-logs/change-loop.log`
(load 10.70 at its start, 1.68 at its end) and `roadmap-loop.log` (load 1.68 at its start). The change-loop file holds 16 of
the change's tests (1 to 11, 16, 17, 19, 19b, 20) and the roadmap file 5 (12, 13, 14, 15, 18): 21 in all, all `✔`.

| Criterion | Text | Proof | Result |
|---|---|---|---|
| AC-1 | `next-fetches-before-judging`: with `origin/main` one commit behind the remote, `change-loop.mjs next` for a change in delivery moves `refs/remotes/origin/main` to the remote's sha and returns `resolve-release-conflict`; the same fixture without the fetch returns `update-branch` | `✔ fresh-base-check 1: next fetches the base before it judges, and a call with no record judges from the stale copy (4617.7 ms)` in `change-loop.log`: the test asserts the no-fetch action is `update-branch` with the origin copy stale, then that `next` gives `resolve-release-conflict`, `baseFetch` `{ ok: true, base: 'main' }` and `origin/main` at the remote's sha. `✔ fresh-base-check 8` (8488 ms) backs the per-call rule | pass |
| AC-2 | `wait-and-roadmap-fetch`: `change-loop.mjs wait` (each poll), `roadmap-loop.mjs next` and `wait` fetch the base before judging; `stateEntries`, `stopDecision` and `status` do not | `change-loop.log`: `✔ fresh-base-check 6: a wait fetches the base at every poll (6402 ms)`; `✔ fresh-base-check 10`; `✔ fresh-base-check 19` (6414 ms); `✔ fresh-base-check 19b` (6867 ms). Negative: `✔ fresh-base-check 7: state, the stop lock and a call with no record never fetch (6837 ms)` (now passes and leaves nothing). `roadmap-loop.log`: `✔ fresh-base-check 12` (11116 ms), `✔ fresh-base-check 13: the roadmap wait fetches the base at every poll` (7972 ms), `✔ fresh-base-check 14: status, status --json and the stop lock never fetch` (22321 ms). `grep -n "fetchBase"` places the option in `nextAction` (`change-loop.mjs` 1513, use at 1550), `runNext` (3153), `runWait`'s poll (3345), `collectRoadmap` (`roadmap-loop.mjs` 746 to 808), the roadmap `run` and `next` (1467, 1516) and its `wait` poll (1759): none in `stateEntries`, `stopDecision` or `status` | pass |
| AC-3 | `checkers-stay-pure`: `conduct-check.mjs` and `deliver-check.mjs` leave `origin/main` unchanged, their headers still say they never fetch; a test fails when either runs `git fetch` | `✔ fresh-base-check 9: the two checkers never fetch, and their headers say so (1303 ms)` in `change-loop.log`. `git diff --stat origin/main...HEAD -- plugins/openspec/hooks/deliver-check.mjs plugins/openspec/hooks/conduct-check.mjs` printed `deliver-check.mjs | 2 +-`, `1 file changed, 1 insertion(+), 1 deletion(-)`; line 3 of `deliver-check.mjs` reads `never writes, pushes, posts or fetches`, line 4 of `conduct-check.mjs` reads `never fetches`. Whole-file runs of both checkers' tests pass (226 and 105 tests, rows above) | pass |
| AC-4 | `fetch-failure-does-not-block`: with the remote unreachable or the fetch past the timeout, `next` returns the action from the local copy, `baseFetch.ok` false, git's first error line in `baseFetch.error`, a `reply` line saying so; the exit code is the action's own | `change-loop.log`: `✔ fresh-base-check 2: a fetch that fails decides from the local copy, records it and says it in one line, in both languages (6702 ms)`; `✔ fresh-base-check 3: a fetch that outlives its timeout fails with a plain line and writes nothing (1181 ms)`; `✔ fresh-base-check 4: a ref that is locked fails the fetch, and the action is the local copy's (4586 ms)`; `✔ fresh-base-check 16: a repository with no remote fetches nothing and decides as it did (4557 ms)`; `✔ fresh-base-check 20` (4545 ms). `roadmap-loop.log`: `✔ fresh-base-check 18: a remote that cannot be reached leaves every change decided from the local copy, and the failure is read once (27284 ms)` | pass |
| AC-5 | `fetch-writes-only-the-base`: after a successful fetch only `refs/remotes/origin/<base>` differs | `✔ fresh-base-check 5: the fetch writes the one ref and nothing else (2402 ms)` in `change-loop.log` (other refs, status and index snapshots equal before and after, no new tag or remote branch, no `FETCH_HEAD`). The command in `change-loop.mjs` line 1477: `git -C <root> fetch --no-tags --quiet --no-write-fetch-head origin +refs/heads/<base>:refs/remotes/origin/<base>` | pass |
| AC-6 | `one-fetch-per-process`: a roadmap `next` over three changes in delivery runs one `git fetch`, counted through a fake `git` | `roadmap-loop.log`: `✔ fresh-base-check 12: roadmap next fetches the base once for the changes it reads (11116 ms)` and `✔ fresh-base-check 15: roadmap run fetches the base once (10988 ms)`; `✔ fresh-base-check 18` asserts the failed fetch is read once; `change-loop.log`: `✔ fresh-base-check 8` (two `nextAction` calls sharing one record log one fetch; two `next` calls log two) | pass |
| AC-7 | `docs-state-the-rule`: `docs/openspec-flow.md` states that the loop fetches the base before it asks the checkers and that `conduct-check` and `deliver-check` never fetch; `python3 scripts/check.py` passes | `✔ fresh-base-check 11: the docs and the skills state the rule of the fetch (1.4 ms)` in `change-loop.log`. `grep -n "fetches the base\|never fetches" docs/openspec-flow.md` printed lines 238 (each poll fetches the base first), 256 (`conduct-check` never fetches; the loops fetch the base before they ask it) and 517 (`deliver-check never fetches`); `git grep -n "never fetches (run" -- docs/openspec-flow.md` printed nothing, exit 1. The pins in the CI example read `v0.45.0` (`pinsIn`, row above). `python3 scripts/check.py`: `all checks passed`, exit 0. `✔ change-loop docs: the design records the answers` passes in `change-loop-compozy.test.mjs` (200 of 200) | pass |

### Notes for the reviewers

- No defect at `8f21e0a`: the attempt-3 leftover is gone (reproduction above), and the six touched test files pass whole
  (200, 115, 200, 226, 105 and 132 tests, 0 failures, each exit 0).
- Test counts differ from attempt 3 because the merged trains added tests to those files (change-loop 176 to 200,
  change-loop-compozy 197 to 200, deliver-check 218 to 226); each number above was counted in this run's logs.
- Not run: the whole suite (the train's job), and the two name-filtered `node --test` gate
  commands of 1.5 and 2.4 verbatim (stood in for by whole-file runs).
- Times are not benchmarks: the machine was shared (load 10.7 at the first run, 0.6 to 2.7 later), each recorded next to its time.
