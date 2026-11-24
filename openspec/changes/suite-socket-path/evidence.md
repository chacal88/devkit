<!-- devkit-stage evidence result=passed attempt=2 commit=5d7d35d06cea1b5a0fd67b23a0dd4088737c0fd3 -->
Commit: 5d7d35d06cea1b5a0fd67b23a0dd4088737c0fd3

# Evidence: suite-socket-path

Head verified: 5d7d35d (the round 1 fix of the review; earlier code commit b59874b). Base d096603. This replaces the
attempt-1 evidence, which was at ec957c7. Whole-suite runs take 10 to 25 minutes, so the verifier did not repeat
the whole suite: it quotes the conducting session's log at this head, `gate-3.5c.log`, kept in
`/private/tmp/claude-501/-Users-kauesantos-Documents-devkit/1d0d1ecf-ba76-4462-8961-a9b9120950f6/scratchpad/`
(each quoted line was read there). Runs marked "live" were run by the verifier at this head. Logs from
b59874b are cited as history and marked so: 5d7d35d changed no decision of the script, only the helper shape
(`runRootBytes`, `runRootFits(realBase, limit)`, `tryRunRoot` deciding through them) and two tests.

### Gates

`devkit.delivery.train` on origin/main is `node scripts/test-suite.mjs && python3 scripts/check.py`; this change does not edit that key.

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` | pass: live, `suite: 1 files, 30 tests, 30 pass, 0 fail, 4.2s`, exit 0, one `run root:` line (default TMPDIR) |
| 2.3 | `python3 scripts/check.py` | train: proven by the train record (live at this head it also printed `all checks passed`, exit 0) |
| 2.3 | `python3 scripts/gen-catalog.py --check` | pass: live, exit 0 |
| 2.3 | `claude plugin validate .` | pass: live (with `/Users/kauesantos/.nvm/versions/node/v22.22.0/bin/claude`), `Validation passed with warnings`, exit 0; the one warning is `plugins[5] plugin.json -> types: Unknown field 'types'`, a plugin this change does not touch |
| 2.3 | `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs` | pass: live, `suite: 2 files, 230 tests, 230 pass, 0 fail, 265.9s`, exit 0, one `run root:` line (default TMPDIR) |
| 3.5 | `node scripts/test-suite.mjs` | train: proven by the train record. Not run by the verifier; the conducting session's whole run at this head is in AC-1 (3166/3166, exit 0) |
| 3.5 | `python3 scripts/check.py` | train: proven by the train record |

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | suite passes with the default macOS TMPDIR, 0 fail, the 32 daemon tests pass | The conducting session's whole run at 5d7d35d, `gate-3.5c.log` (quiet machine, load average 4.9 at start): `node scripts/test-suite.mjs` under the session's default macOS TMPDIR (real path 56 bytes) printed one `run root: /private/tmp/devkit-suite-bGTMWN (TMPDIR /private/var/folders/b1/<30 chars>/T: its run root would take 76 bytes, over 71, and a Unix socket path under it would pass 103 bytes)` line, then `suite: 38 files, 3166 tests, 3166 pass, 0 fail, 880.6s, concurrency 14`. The three files that bind the fake daemon: `pass 637.1s change-loop-compozy.test.mjs`, `pass 5.7s compozy-driver.test.mjs`, `pass 448.9s roadmap-loop-followups.test.mjs`; the same log ends `all checks passed` for `python3 scripts/check.py`. Live, the two-file run with change-loop-compozy.test.mjs is 230/230 under the default TMPDIR. History: task-3.1.log at b59874b was 3164/3164, exit 0. Before the change: 33 fails, 32 `listen EINVAL` (requirements.md). | pass |
| AC-2 | a TMPDIR that fits is honoured, no fallback line | Live: `mkdir -p /var/tmp/devkit-sp-ev && env TMPDIR=/var/tmp/devkit-sp-ev node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`: `suite: 1 files, 30 tests, 30 pass, 0 fail, 4.5s`, exit 0, zero `run root:` lines (`grep -c` printed 0); the folder was removed after. The test `suite-socket-path AC-4 a TMPDIR of exactly the longest base ...` (below) also asserts `runRootLines(out)` is empty on the fits branch. History at b59874b (same decision): task-3.2b.log, the CI-like run `env TMPDIR=/private/tmp GITHUB_HEAD_REF=suite-socket-path GITHUB_BASE_REF=main node scripts/test-suite.mjs`, printed no `run root:` line; 3163/3164, exit 1, the one failure being `conduct: --change <id> --watch returns the recomputed single row when the checks flip (AC-2)`, a 50 ms watch window at load average 28; the same file alone right after (task-3.2b-conduct-rerun.log): `105 pass, 0 fail`, exit 0. | pass |
| AC-3 | short root when TMPDIR does not fit: one line saying where and why, per-file TMPDIR empty real path, leftover still fails with file name, root removed | Live at this head, the single-file run under the default TMPDIR printed exactly one line, `run root: /private/tmp/devkit-suite-EIhxJ0 (TMPDIR /private/var/folders/b1/<30 chars>/T: its run root would take 76 bytes, over 71, and a Unix socket path under it would pass 103 bytes)`, then 30/30 green (the existing leftover and symlinked-TMPDIR tests among them). gate-3.5c.log has the same one line; live `ls /private/tmp` piped to `grep -c devkit-suite` printed 0 after the AC-2 run, so no run root is left. | pass |
| AC-4 | regression test pins the limit; red on the base, green after; old tests keep passing; none renamed | Green: 30/30 live. `grep -c "suite-socket-path AC-"` on test-suite.test.mjs prints 12, and those 12 plus the 18 old names (names-base.txt, counted at the b59874b baseline) are the 30 the file runs; design.md and tasks.md say twelve. The two tests the round 1 fix added, read in the file: (1) `suite-socket-path AC-4 a TMPDIR over the limit by bytes but under it by characters puts the run root under the short folder` (line 625) builds a TMPDIR ending in `ééé` (three characters, six bytes), sets `limit` to its character count plus `RUN_ROOT_NAME_BYTES`, asserts the byte length is over the limit and the short folder's is under it, calls `makeRunRoot({ tmp, short, limit })`, and asserts `dirname(made.runRoot)` is the short folder's real path, `made.line` starts with `run root: ` and the non-ASCII folder is left empty. (2) `suite-socket-path AC-4 a TMPDIR of exactly the longest base keeps the run root inside it and a socket bound at 103 bytes` (line 698) makes a TMPDIR of exactly 51 bytes (`runRootLimit(1) - RUN_ROOT_NAME_BYTES`), runs a probe tree that binds a socket, and asserts exit 0, `seen.bound === true`, `Buffer.byteLength(dirname(seen.tmp))` equal to `runRootLimit(1)` (71), `Buffer.byteLength(join(seen.tmp, 'devkit-ch-xxxxxx', 'daemon.sock'))` equal to `SOCKET_PATH_MAX_BYTES`, no `run root:` line, the run root under the given base, removed after the run, and the base empty. Red proofs of the fix are the implementer's report, not run by the verifier: counting characters in `tryRunRoot` made the non-ASCII test fail alone; `SOCKET_TAIL_BYTES=30` made the boundary test fail alone. History, b59874b, task-3.3.log: the branch's test-suite.test.mjs against a copy of the base script (git archive d096603): `28 tests, 15 pass, 13 fail`, exit 1; the bind test failed on its `bound` assertion with `EINVAL` under `/private/var/folders/.../devkit-suite-xrxR38/29/devkit-long-hndkrr/devkit-suite-C1q2iS/00`; the other new tests failed on `suiteScript.runRootLimit is not a function`. The review's findings F1 (production decided with its own inline byte count) and F2 (limit constants never met the real boundary) are the two the new tests answer. | pass |
| AC-5 | CI's `Test suite` step passes on the pull request (Linux) | no proof: the pull request does not exist yet; this is CI's `check` job on the pull request (the plan's Workflow follow-up). Local proxy: the CI-like run of AC-2 (b59874b) prints no `run root:` line, i.e. the fallback is not taken when TMPDIR is `/private/tmp`; its one red test is the load-timing flake, green alone; at this head the `/var/tmp` run prints none either. | no proof: CI has not run yet |
| AC-6 | CONTRIBUTING states the rule | `git diff d096603 -- CONTRIBUTING.md` (the testing paragraph, not in the 5d7d35d diff) says: "a socket path holds 104 bytes on macOS, the terminator included, so the run root takes at most 71. Otherwise the run root goes under the real path of `/tmp` (`/private/tmp` on macOS), and the script prints one `run root:` line saying where and why; when neither folder can hold it, the script exits 2"; "The run root is made under the real path of the environment's `TMPDIR` when it leaves room for the longest Unix socket path a test binds"; "A test that binds a Unix socket does so under its `TMPDIR` (as `fakeCompozy(...).daemon` does), so the leftover check covers the socket." All three statements were read at b59874b. `python3 scripts/check.py` (names, links, language) passes live at this head. | pass |

### Files changed and non-goals

`git diff d096603 --stat` (16 files, 888 insertions, 21 deletions): `.claude-plugin/marketplace.json`, `CHANGELOG.md`,
`CONTRIBUTING.md`, `docs/openspec-flow.md`, the change folder (`.openspec.yaml`, design.md, evidence.md,
proposal.md, requirements.md, review.md, reviews/code-quality-reviewer.md, reviews/test-coverage-reviewer.md,
tasks.md), `plugins/openspec/.claude-plugin/plugin.json`, `plugins/openspec/hooks/test-suite.test.mjs`,
`scripts/test-suite.mjs`. `git diff 74f2444 --stat` lists the same 16 files (909 insertions, 17 deletions).
`git diff d096603 --stat -- plugins/openspec/hooks/test-fixtures.mjs plugins/openspec/hooks/test-tmp.mjs plugins/core/skills/review-change/scripts/test-tmp.mjs plugins/compozy/skills/test-tmp.mjs` printed nothing: the fixtures and the three `test-tmp.mjs` copies are unchanged, as the proposal's non-goals say. No product file (`compozy-driver.mjs`) is in the diff.

### Release

CHANGELOG top section: `## 0.50.2 — the suite script keeps its run root short enough for a Unix socket`
(devkit-openspec 0.45.1). `plugins/openspec/.claude-plugin/plugin.json` version 0.45.1;
`.claude-plugin/marketplace.json` metadata 0.50.2 and devkit-openspec 0.45.1; `docs/openspec-flow.md` pins
`v0.45.1`. These numbers are provisional: origin/main has moved since the plan and the delivery train renumbers a
boarded change's release above its own at the join.

### Defects

None found at this head. The only red results in any cited log are the load-timing tests of the b59874b runs
(`field-fixes 9 watch: the cap stops the watch ...`, `conduct: --watch returns ...`), each green alone, none in
code this change touches; the whole run at 5d7d35d has 0 fail.
