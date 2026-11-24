Verdict: approved
Commit: 06debd008f35ce62404123847b823611d47c2400

## Coverage analysis: suite-speed round 2 (9b15e4d..HEAD, code fixes in 21d1d4d)

### Findings
- [praise] plugins/openspec/hooks/*.test.mjs (splits) and test-fixtures.mjs — Test titles of the 29 old files vs the 38 files at the round 1 commit: 2709 vs 2728, 19 added, none removed; AC-2 and AC-5c hold. Unchanged by the round 2 diff.
- [nit] scripts/test-suite.mjs:interrupt/main (exit 130, STOP_WAIT_MS SIGKILL) — [3] No test sends SIGINT or makes a child ignore SIGTERM; swapping 130 and 143 or dropping the SIGKILL escalation stays green. Write in: plugins/openspec/hooks/test-suite.test.mjs next to the AC-4 SIGTERM probe.
- [nit] scripts/test-suite.mjs:IMPORTED_TEST_FILE — [3] The import check is line-based: a specifier on the line after `from` or `import(`, or a helper not named *-fixtures.mjs, is not seen; by design, rare.
- [nit] scripts/check.py:SKIPPED_TEST — [3] A skip/only/todo option on a line after the `test(` call is not seen (documented in the comment); no test pins that limit.
- [nit] scripts/test-suite.mjs:SUITE_FOLDERS — [3] Nothing flags a *.test.mjs outside the four folders; inherited from the old command and ADR 0026 decision 6, so backlog, not a gap of this change.
- [nit] scripts/test-suite.mjs:main (order by size) — [2] The largest-first order that makes the 10-minute target reachable is pinned by no test; a regression would show only in the measured time.
- [nit] scripts/test-suite.mjs:isEntry — [2] The ENOENT/ENOTDIR return-false branch of the new entry check is pinned by no test; defensive, no observable behavior change.
- [praise] plugins/openspec/hooks/test-suite.test.mjs (AC-1 symlink, AC-4 FAIL with leftovers, AC-5c compozy only) — The three round 1 fixes each have a test that would go red if the fix were reverted: symlinked folder and file start, FAIL line naming what was left, and compozy refusing only while allowing skip and todo.

In-scope surfaces: scripts/test-suite.mjs, scripts/check.py, plugins/openspec/hooks/test-suite.test.mjs, plugins/openspec/hooks/roadmap-loop-upfront.test.mjs (comment only), CLAUDE.md, design.md, evidence.md.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): symlinked start (isEntry realpath vs import.meta.url) -> AC-1 symlink test (a symlinked folder and a symlinked file, bad argument exits 2 with usage; the old resolve() comparison would exit 0 silently, so it goes red); FAIL result that also left files (summary uses result.left.length) -> extended AC-4 leftover test (FAIL line names left-by-failure, exit 1, base folder empty); only refused under plugins/compozy, skip and todo allowed (kind group and exempt set in check.py) -> extended AC-5c test (skip+todo exit 0, skip+only exit 1 with exactly one problem line at :3:); documentation changes (comment, CLAUDE.md row, design D-7 and T-11 text) -> not behavior; AC-7 doc test still covers CLAUDE.md. Filtered live run of the three affected tests in test-suite.test.mjs: 3 tests, 3 pass. The whole suite was not run, as instructed; it was already green on this tree per evidence.md.

### Well covered
- Starting the script through a symlinked folder or file, which exercises the real entry-point guard.
- A failing file that also leaves something in its TMPDIR: exit 1, the leftover named on the FAIL line, and the run root removed.
- The compozy exemption, tested in both directions: skip and todo pass, only is refused, with the exact line number.
