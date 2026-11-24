Verdict: approved
Commit: 9b15e4d903e1529e92398f3af88ba898d878f870

## Coverage analysis — suite-speed (38953b6..HEAD, fix commit 21c039c)

### Findings
- [praise] plugins/openspec/hooks/*.test.mjs (splits) and test-fixtures.mjs — Test titles of the 29 old files vs the 38 files at HEAD: 2709 vs 2728 title lines, 19 added (all `suite-speed `), none removed or changed; no assertion lost except the replaced CI-step ones, so AC-2 and AC-5c hold at HEAD.
- [nit] scripts/test-suite.mjs:interrupt/main (exit 130, STOP_WAIT_MS SIGKILL) — [3] No test sends SIGINT or makes a child ignore SIGTERM; swapping 130 and 143 or dropping the SIGKILL escalation stays green. Write in: plugins/openspec/hooks/test-suite.test.mjs, next to the AC-4 SIGTERM probe.
- [nit] scripts/test-suite.mjs:IMPORTED_TEST_FILE — [3] The import check is line-based: a specifier on the line after `from` or `import(`, or a helper not named *-fixtures.mjs, is not seen; by design, rare.
- [nit] scripts/check.py:SKIPPED_TEST — [3] A skip/only/todo option on a line after the `test(` call is not seen (documented in the comment); no test pins that limit.
- [nit] scripts/test-suite.mjs:SUITE_FOLDERS — [3] Nothing flags a *.test.mjs outside the four folders (plugins/compozy/skills/screen-demo and screen-design already hold two); inherited from the old command and ADR 0026 decision 6, so backlog, not a gap of this change.
- [nit] scripts/test-suite.mjs:main (order by size) — [2] The largest-first order that makes the 10-minute target reachable is pinned by no test; a regression would show only in the measured time.

In-scope surfaces: scripts/test-suite.mjs, scripts/check.py, the test and fixtures modules under plugins/openspec/hooks/, the openspec-setup and review-round test files, CI, the docs.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): script file list -> AC-1 four-folders and every-old-file tests; pool and concurrency -> AC-1 concurrency probe; argument parsing -> AC-1 bad-argument and pattern probes; NODE_TEST_CONTEXT deletion -> every probe; per-file TMPDIR and real path -> AC-4 probes; leftover detection -> AC-4 leaver probe; failing file exit 1 and name -> AC-6 probe; SIGTERM -> AC-4 SIGTERM probe; test-file import refusal -> AC-3 probes (test files and fixtures modules) and repo scan; fix 21c039c (branch-blank, raw-temp and import scans read every *-fixtures.mjs) -> AC-3 scan tests in guard, test-tmp and test-suite (right and pinned; filtered live run 8 tests, 8 pass); check.py skip check -> AC-5c probe; CI step -> test-fixture-cleanup AC-5; docs and agents context -> AC-7 and AC-8; helper move and splits -> title-line comparison base vs head (19 added, 0 removed) plus the whole-suite green run.

### Well covered
- The refusal of a test-file import, by file and line, for test files and fixtures modules (from, side-effect, multi-line, dynamic), before any file runs.
- The per-file TMPDIR: own, empty, real path under a symlinked base, short place name, run root removed, leftover named.
- The red path: one failing file gives exit 1, the test name and file in the output, and the other files still run.
- The parallel and serial behavior, proven with probes that wait for each other.
- The CI step pin, which also refuses the old steps and strings.
