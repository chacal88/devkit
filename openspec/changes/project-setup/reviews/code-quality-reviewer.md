Verdict: approved
Commit: 816d17933190f34f883f55651ac90c99d3bfd5d5

## Quality review — project-setup (round 4, owner-authorized; numbered 2 of 2 by the round script)

### Findings
- [blocking] openspec/changes/project-setup/specs/project-setup/spec.md:23 — The typed-only requirement and its scenario ('no file of the setup is written') were contradicted by R-6 while task 7.6 was ticked; fix: narrow the wording to what the change enforces or add the refusing hook. · fixed in 45cbd1c86593727bbf88fe940be4a4a29f196052
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:115 — parseDevkitBlock and readTestSettings did not read CRLF configs, so a re-run asked every key again and appended duplicate keys; fix: strip \r in the shared readers and test plan after apply on a CRLF file. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:261 — checkBlock refused an inline value only on the devkit: line, so a nested flow map was written into invalid YAML; fix: refuse any block line whose value starts with { or [. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [nit] openspec/changes/project-setup/proof/r3-merge-mode.txt — No real run shows AC-7's ruleset question or its required-check list (R-3 deferred them, O-1); a follow-up re-run of R-3 once the train's tag exists would close it.
- [nit] plugins/openspec/skills/devkit/scripts/kit-installer.mjs:54 — packFolders also walks the marketplaces/ clones, so a source checkout can win the highest-version rule over the installed pack; bin/devkit-kit does the same, so a later change could restrict both to cache/.
- [important] plugins/openspec/hooks/change-loop.mjs:2114 — A git repository nested in a folder holding openspec/changes got mode setup with the outer folder as root, because findRoot climbs past the repository's top; fix: use start only when it is the top or inside it, else the top, and add the nested case to the tests. · fixed in ac5958ea4f92ca7d1f2de948484f9ba8655bcbd7
- [praise] plugins/openspec/hooks/merge-setup.mjs:24 — SETUP_POINTER plus the single withoutSetupPointer helper replace two divergent regex strips with one exported mechanism, each pinned by a test (N-9, N-18).
- [praise] plugins/openspec/hooks/change-loop.mjs:2061 — BUILT_DRIVERS is derived from DRIVER_ROUND, and setup-block apply writes atomically and exits 2 for a call written wrong, 3 for a refused answer, writing nothing.
- [praise] plugins/openspec/hooks/guard.mjs:122 — The CRLF fix lands in the shared readers rather than in setup-block, each pinned by a test that compares it with its LF twin; ciPinOf reuses deliver-check's pinsIn instead of a second pin regex.
- [blocking] openspec/changes/project-setup/design.md:175 — D-1 still said root is findRoot(cwd), else the git top, else null (no-repo), while the code checks the git top first (387bf15) and drops a findRoot answer above the top (ac5958e); fix: restate D-1 as the code does it and add the nested-repository test to the N table. · fixed in 78001deab6fa351e075e439ad583fe9a07142c9e
- [praise] plugins/openspec/hooks/change-loop.test.mjs:1035 — The F6 test names its invariant, layer and suite, covers both outer variants at two cwd depths, and asserts nothing is created; probed red on 76e88ad and green on HEAD in round 3.
- [nit] openspec/changes/project-setup/tasks.md:15 — With N-20 added, tasks.md:15 still says 'N-1 to N-19' and design.md:1000 says 'N-1 to N-9'; the N-20 row also sits between N-3 and N-4 (design.md:822) instead of after N-19; a follow-up could widen the counts and move the row.
- [praise] openspec/changes/project-setup/design.md:175 — The restated D-1 follows startMode's setup branch step by step (top first, setup-no-repo with no top even when findRoot finds a folder, findRoot's folder only when its real path is the top or inside it, settings still read from findRoot's folder) and records why the order holds, citing spec-reviewer F2 and code-quality F6 with the tests that pin each.

### Summary
- 13 findings (2 blocking, 3 important, 3 nit) + 5 praise. Open: F4, F5 and F12 (nit). F1, F2, F3, F6 and F10 are fixed.
- Justification: this is a re-review, the fourth round the owner authorized ("Sim", limited to code-quality and F10). It covers my round-3 findings and the lines changed since b8253f7: 78001de (D-1 restated, N-3 row extended, N-20 row added) and 816d179 (round-3 review files). `git diff b8253f7..816d179` touches only `openspec/changes/project-setup/design.md`, `review.md` and `reviews/code-quality-reviewer.md`. No product or test file changed.
  - F10: I checked the new D-1 text against `startMode` (`plugins/openspec/hooks/change-loop.mjs`, setup branch after the `VERB_ROUND` check). `tryGit(... show-toplevel)` runs first, and no top answers `setup-no-repo` whatever `findRoot` found. `relative(top, realpathSync(start))` decides inside versus outside, and a null `start` falls back to `'..'` and so to the top. `settings` still comes from `readDevkitSettings(start)` at the top of the function. The text says each of these. The N-3 and N-20 test names in the table match `change-loop.test.mjs:1011` and `:1037` exactly, and the N-20 description (both outer variants, the inner top and a subfolder as cwd, nothing created under the outer folder) matches the test body. Fixed.
  - F12 is a new nit from 78001de: adding N-20 left the N counts in tasks.md and the design's risk table stale, and the row is out of numeric order. Tests are found by name, so nothing breaks.
  - F4 and F5 stay nits, unchanged.
- Checks: `python3 scripts/check.py` prints all checks passed. I ran no test suite: no product or test file changed since round 3, whose filtered run of `change-loop.test.mjs` (setup pattern, 9 of 9 pass) still covers the same code.

### Acceptance
- AC-1: unchanged since round 3. The real run in evidence attempt 4 and the N-20 test cover the nested-repository root, and the design now states the rule the code enforces (F10 fixed).
- AC-7: still no real run of the ruleset question (F4, nit).
- AC-2 to AC-6 and AC-8 to AC-10: unchanged since round 2. No product line changed in this range.
