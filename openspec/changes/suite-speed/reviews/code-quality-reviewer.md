Verdict: rejected
Commit: 9b15e4d903e1529e92398f3af88ba898d878f870

## Quality review — suite-speed (round 1)

### Findings
- [important] scripts/test-suite.mjs:296 — The entry check compares resolve(process.argv[1]) with the real path of import.meta.url, so starting the script through a symlinked path never runs main and exits 0 with no output (a false green); reproduced with a symlinked absolute path. Fix: compare realpathSync(argv[1]) and add a probe that starts the copy through a symlinked folder.
- [nit] scripts/test-suite.mjs:160 — A file that fails and also leaves something in its TMPDIR shows only FAIL; the leftover names are removed and not printed (only LEFT lists them).
- [nit] plugins/openspec/hooks/test-tmp.test.mjs:198 — The kept test name still says 'run on an empty TMPDIR and a step fails when it is not empty after' while it now asserts the single Test suite step; the rewrite is declared, so the name only overstates it.
- [nit] scripts/check.py:151 — The exemption for all of plugins/compozy also lets 'only' through there; its skips are justified by a missing compozy program, but 'only' is not.
- [nit] plugins/openspec/hooks/roadmap-loop-upfront.test.mjs:409 — Stale comment: says change-loop.test.mjs puts the git identity in the environment when imported; the file now takes it from the fixtures module.
- [nit] CLAUDE.md:33 — The command row says 'Every test file' though ADR 0026 decision 6 leaves plugins/panel and the other compozy tests out; CONTRIBUTING.md names the four folders.
- [praise] scripts/test-suite.mjs — Real-path run root, one short per-file TMPDIR, LEFT marks a leftover, detached process groups for signals, NODE_TEST_CONTEXT removed, and a probe harness that runs a copy of the script in a synthetic tree.
- [praise] openspec/changes/suite-speed/evidence.md — AC-2 is proved by sorted-name equality of two TAP runs (2897 against 2897), the evidence says the lists date from a9babd2, and AC-5b and the CI half of AC-7 are marked pending instead of claimed.

### Fix of the first round's finding

Commit 21c039c is right. The branch-blank scan (guard.test.mjs testFilesUnder), the raw-temp scan (test-tmp.test.mjs rawTempCalls) and the script's testImports now read test-fixtures.mjs and every <name>-fixtures.mjs, each with a probe that fails when a split module is not read. I ran the two scan tests and the raw-temp test on this head: they pass, and python3 scripts/check.py prints 'all checks passed'.

### What I checked

- Move fidelity: a trimmed-line multiset comparison of the 31 base test files against the new test files plus fixtures modules. Besides the new suite-speed tests, the only differences are the declared ones (the v0.38.0 pin, the CI-step assertions in test-tmp.test.mjs, SET/cleanEnv renamed SET_LOOP/cleanEnvLoop, and the AC-6 instructions-follow exemption moved to deliver-check-cli.test.mjs, which holds OLD_ORDER). No assertion was lost.
- The cleanEnv that conduct-check used to define (with DEVKIT_HOST 'cli') is now the fixtures one, with the same value.
- release-merge, jira-task, release-tags and merge-setup ran through the script with HOME empty and git config disabled: 127 of 127 pass, so the change-loop IDENT lines hide no identity dependency in these.
- No product script changes; every task box is ticked.

### Acceptance

AC-1 to AC-4, AC-5c and AC-6 to AC-8 are demonstrated by logs I read or runs I made; the AC-5 time (575.7 s and 568.5 s) comes from the conducting session's logs. AC-5b and the CI-green half of AC-7 need the pull request's first check run: not a defect now, but they must be recorded before enable-auto-merge.

### Questions for the coordinating session

- CHANGELOG.md goes from 0.42.0 straight to 0.40.0, and a test comment names a sibling release 0.41.0 / openspec 0.37.0 that is not in this tree; I could not check origin/main without fetching. Re-check the release numbers before the push.
- ADR 0026 follows 0024 with no 0025 in the tree. Same check.

### Summary

- 8 findings (0 blocking, 1 important, 5 nit) + 2 praise.
- Justification: the change delivers what the plan declares and the evidence is honest. F1 is a silent false-green path in the command that now gates CI and every delivery, so it must be fixed in the round or contested with evidence. Only filtered tests and small files were run, as instructed.
