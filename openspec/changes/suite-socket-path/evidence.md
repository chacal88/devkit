<!-- devkit-stage evidence result=passed attempt=1 commit=ec957c743b940b212a83eb06dc265c93ba8a6f99 -->
Commit: ec957c743b940b212a83eb06dc265c93ba8a6f99

# Evidence: suite-socket-path

Head verified: ec957c7 (code commit b59874b; ec957c7 only ticks tasks.md). Base d096603. Whole-suite runs
take 10 to 25 minutes, so the verifier did not repeat them: it quotes the conducting session's logs, kept in
`/private/tmp/claude-501/-Users-kauesantos-Documents-devkit/1d0d1ecf-ba76-4462-8961-a9b9120950f6/scratchpad/`
(each quoted line was read there). Live runs at this head are marked "live".

### Gates

`devkit.delivery.train` on origin/main is `node scripts/test-suite.mjs && python3 scripts/check.py`; this change does not edit that key.

| Gate | Command | Result |
| --- | --- | --- |
| 1.5 | `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` | pass: live at this head, `suite: 1 files, 28 tests, 28 pass, 0 fail, 4.6s`, exit 0 |
| 2.3 | `python3 scripts/check.py` | train: proven by the train record (live at this head it also printed `all checks passed`, exit 0) |
| 2.3 | `python3 scripts/gen-catalog.py --check` | pass: live, exit 0 |
| 2.3 | `claude plugin validate .` | pass: live (with `/Users/kauesantos/.nvm/versions/node/v22.22.0/bin/claude`), `Validation passed with warnings`, exit 0; the one warning is `plugins[5] plugin.json -> types: Unknown field 'types'`, a plugin this change does not touch |
| 2.3 | `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs` | pass: live at this head, `suite: 2 files, 228 tests, 228 pass, 0 fail, 276.2s`, exit 0, one `run root:` line (default TMPDIR); also gate-2.3.log, 228/228 |
| 3.5 | `node scripts/test-suite.mjs` | train: proven by the train record. Not run by the verifier; the conducting session's whole run at b59874b is in AC-1 (3164/3164, exit 0) |
| 3.5 | `python3 scripts/check.py` | train: proven by the train record |

Flakes in the conducting session's gate runs (reported as what they are, none touched by this change): gate-3.5.log
and gate-3.5b.log (`node scripts/test-suite.mjs` at load averages 126 and 30-40) each ended 3163/3164 with a
different single `--watch` timing test failing (`field-fixes 9 watch: the cap stops the watch ...` in
deliver-check-cli.test.mjs; `conduct: --watch returns when a per-call fixture flips the checks ...` in
conduct-check.test.mjs), `check.py` `all checks passed`. deliver-check-cli.test.mjs alone: 104/104
(gate-3.5-dccli-rerun.log). The green whole run of the same command is task-3.1.log (below).

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | suite passes with the default macOS TMPDIR, 0 fail, the 32 daemon tests pass | task-3.1.log: `env TMPDIR="$(getconf DARWIN_USER_TEMP_DIR)" node scripts/test-suite.mjs` (default TMPDIR, real path 56 bytes), load about 12-16: `suite: 38 files, 3164 tests, 3164 pass, 0 fail, 617.6s, concurrency 14`, exit 0. The files that bind the fake daemon: compozy-driver.test.mjs `pass 4.9s` (16 tests listed green), change-loop-compozy.test.mjs `pass 419.1s`, roadmap-loop-followups.test.mjs `pass 325.7s`. Before the change: 33 fails, 32 `listen EINVAL` (requirements.md). Live, the two-file run with change-loop-compozy.test.mjs is 228/228 under the default TMPDIR. The log is from b59874b, same code as this head. | pass |
| AC-2 | a TMPDIR that fits is honoured, no fallback line | task-3.2a.log: `env TMPDIR=/var/tmp/devkit-socket-path node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs`: `28 pass, 0 fail`, exit 0, zero `run root:` lines. CI-like run, task-3.2b.log (`env TMPDIR=/private/tmp GITHUB_HEAD_REF=suite-socket-path GITHUB_BASE_REF=main node scripts/test-suite.mjs`): no `run root:` line; 3163/3164, exit 1, the one failure being `conduct: --change <id> --watch returns the recomputed single row when the checks flip (AC-2)` in conduct-check.test.mjs, a 50 ms watch window at load average 28; the same file alone right after (task-3.2b-conduct-rerun.log): `105 pass, 0 fail`, exit 0. Tests in the branch's test-suite.test.mjs also cover the fits branch (28/28 live). | pass |
| AC-3 | short root when TMPDIR does not fit: one line saying where and why, per-file TMPDIR empty real path, leftover still fails with file name, root removed | live at this head: the single-file run under the default TMPDIR printed exactly one line, `run root: /private/tmp/devkit-suite-3co8nH (TMPDIR /private/var/folders/b1/<30 chars>/T: its run root would take 76 bytes, over 71, and a Unix socket path under it would pass 103 bytes)`, then 28/28 green (the existing leftover and symlinked-TMPDIR tests among them). task-3.1.log has the same one line and no `/private/tmp/devkit-suite-*` left after it; live `ls /private/tmp` also shows no `devkit-suite-*` folder. t31-before.txt / t31-after.txt (`ls $TMPDIR`): the only new entries are `genesi-*` files of another tool. | pass |
| AC-4 | regression test pins the limit; red on the base, green after; old tests keep passing; none renamed | task-3.3.log: the branch's test-suite.test.mjs against a copy of the base script (git archive d096603): `28 tests, 15 pass, 13 fail`, exit 1. The AC-4 test fails on its `bound` assertion: `the socket did not bind (EINVAL) under /private/var/folders/.../devkit-suite-xrxR38/29/devkit-long-hndkrr/devkit-suite-C1q2iS/00`, `'EINVAL' !== true`; the nine other new tests fail on `suiteScript.runRootLimit is not a function`. On the branch: 28/28 live. Names: names-base.txt has 18, names-after.txt 28 (counted with `wc -l`); the diff adds 10 lines, every one `suite-socket-path AC-...`, and removes 0. | pass |
| AC-5 | CI's `Test suite` step passes on the pull request (Linux) | no proof: the pull request does not exist yet; this is CI's `check` job on the pull request (the plan's Workflow follow-up). Local proxy: the CI-like run of AC-2 prints no `run root:` line, i.e. the fallback is not taken when TMPDIR is `/private/tmp`; its one red test is the load-timing flake above, green alone. | no proof: CI has not run yet |
| AC-6 | CONTRIBUTING states the rule | `git diff d096603 -- CONTRIBUTING.md` (1 line changed, the testing paragraph) says: "a socket path holds 104 bytes on macOS, the terminator included, so the run root takes at most 71. Otherwise the run root goes under the real path of `/tmp` (`/private/tmp` on macOS), and the script prints one `run root:` line saying where and why; when neither folder can hold it, the script exits 2"; "The run root is made under the real path of the environment's `TMPDIR` when it leaves room for the longest Unix socket path a test binds"; "A test that binds a Unix socket does so under its `TMPDIR` (as `fakeCompozy(...).daemon` does), so the leftover check covers the socket." All three statements are present. | pass |

### Files changed and non-goals

`git diff d096603 --stat` (12 files, 674 insertions, 21 deletions): `.claude-plugin/marketplace.json`, `CHANGELOG.md`,
`CONTRIBUTING.md`, `docs/openspec-flow.md`, the change folder (`.openspec.yaml`, design.md, proposal.md,
requirements.md, tasks.md), `plugins/openspec/.claude-plugin/plugin.json`,
`plugins/openspec/hooks/test-suite.test.mjs`, `scripts/test-suite.mjs`.
`git diff d096603 --stat -- plugins/openspec/hooks/test-fixtures.mjs plugins/openspec/hooks/test-tmp.mjs plugins/core/skills/review-change/scripts/test-tmp.mjs plugins/compozy/skills/test-tmp.mjs` printed nothing: the fixtures and the three `test-tmp.mjs` copies are unchanged, as the proposal's non-goals say. No product file (`compozy-driver.mjs`) is in the diff.

### Release

CHANGELOG top section: `## 0.50.2 — the suite script keeps its run root short enough for a Unix socket`
(devkit-openspec 0.45.1). `plugins/openspec/.claude-plugin/plugin.json` version 0.45.1;
`.claude-plugin/marketplace.json` metadata 0.50.2 and devkit-openspec 0.45.1; `docs/openspec-flow.md` pins
`v0.45.1`. These numbers are provisional: origin/main has moved since the plan and the delivery train renumbers a
boarded change's release above its own at the join.

### Defects

None found. The only red results are the load-timing tests named above, each green alone, none in code this change touches.
