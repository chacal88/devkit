Verdict: approved
Commit: 06debd008f35ce62404123847b823611d47c2400

## Quality review — suite-speed (round 2)

### Findings
- [important] scripts/test-suite.mjs:231-243,305 — Entry check compared resolve(argv[1]) with the real path, so a symlinked start exited 0 silently; now realpathSync with ENOENT/ENOTDIR handling and a probe over a symlinked file and folder; reproduced live: both exit 2 with usage. · fixed in 21d1d4d
- [nit] scripts/test-suite.mjs:219 — A FAIL file hid what it left in its TMPDIR; the summary now prints left: for any result with leftovers, proved by a failing-probe test. · fixed in 21d1d4d
- [nit] plugins/openspec/hooks/test-tmp.test.mjs:198 — Kept test name still says a step fails when TMPDIR is not empty after, while it now asserts the single Test suite step.
- [nit] scripts/check.py:140-157 — Exemption of plugins/compozy let 'only' through; now only skip and todo pass there and 'only' is refused, with T-11 and design D-7 updated. · fixed in 21d1d4d
- [nit] plugins/openspec/hooks/roadmap-loop-upfront.test.mjs:409 — Stale comment about the git identity source; now names GIT_ENV in test-fixtures.mjs. · fixed in 21d1d4d
- [nit] CLAUDE.md:33 — Command row said 'Every test file'; now 'The suite's test files'. · fixed in 21d1d4d
- [nit] openspec/changes/suite-speed/evidence.md AC-2 — The AC-2 name lists date from a9babd2 and the claim that they still hold rests on a diff and a count, not a fresh TAP extraction; the evidence says so openly.
- [praise] plugins/openspec/hooks/test-suite.test.mjs:74 — The symlink probe covers both a symlinked folder and a symlinked file and asserts the exit code and the usage text, so a silent exit 0 cannot pass.

### Summary

- 8 findings (0 blocking, 0 important, 2 nit open) + 1 praise in this list; the round 1 praise items on the script and the evidence stand.
- Justification: round 2 re-checked the previous findings against 21d1d4d and the lines changed since (9b15e4d..HEAD, all ten files opened). The one important finding (silent false green on a symlinked start) is fixed and reproduced fixed on the real script through a symlinked file and a symlinked folder (exit 2 with usage). The filtered probes (AC-1 symlinked start, AC-4 leftover including the failing file, AC-5c check.py compozy `only`) pass and `python3 scripts/check.py` prints all checks passed. Nothing new blocks. The whole suite was not rerun, as instructed: 2917 tests, 0 fail were recorded on this tree.

### Carried questions for the coordinating session

- Re-check CHANGELOG release numbers and the ADR numbering against origin/main before the push (not fetched here).
- AC-5b and the CI-green half of AC-7 still need the pull request's first check run before enable-auto-merge.
