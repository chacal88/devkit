Verdict: rejected
Commit: 76e88ad3fdab3ffd0ced32b6418bc4c38cef11da

## Quality review — project-setup (round 2)

### Findings
- [blocking] openspec/changes/project-setup/specs/project-setup/spec.md:23 — The typed-only requirement and its scenario ('no file of the setup is written') were contradicted by R-6 while task 7.6 was ticked; fix: narrow the wording to what the change enforces or add the refusing hook. · fixed in 45cbd1c86593727bbf88fe940be4a4a29f196052
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:115 — CRLF configs were not read by parseDevkitBlock/readTestSettings, so a re-run asked every key again and appended duplicate keys; fix: strip \r in the shared readers and test plan after apply on CRLF. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [important] plugins/openspec/skills/devkit/scripts/setup-block.mjs:261 — checkBlock refused an inline value only on the devkit: line, so a nested flow map was written into invalid YAML; fix: refuse any block line whose value starts with { or [. · fixed in 387bf1553e85d7610c5ee64c0bf5e4b6f6a444d7
- [nit] openspec/changes/project-setup/proof/r3-merge-mode.txt — No real run shows AC-7's ruleset question or its required-check list (R-3 deferred them, O-1); still open, a follow-up re-run of R-3 once the train's tag exists would close it.
- [nit] plugins/openspec/skills/devkit/scripts/kit-installer.mjs:54 — packFolders walks marketplaces/ clones too, so a source checkout can win the highest-version rule over the installed pack; consistent with bin/devkit-kit, consider restricting both to cache/ later.
- [important] plugins/openspec/hooks/change-loop.mjs:2114 — The no-repo check tests cwd, but root is start ?? top and findRoot climbs past the repository's top: a git repo nested in a folder holding openspec/changes (reproduced: outer non-git folder) or in another devkit project (a submodule) gets mode setup with the outer folder as root, so the setup writes outside the repo the owner typed in. Fix: use start only when it is top or inside it, else top; add the nested-repo case to the setup-no-repo test.
- [praise] plugins/openspec/hooks/merge-setup.mjs:24 — SETUP_POINTER plus the single withoutSetupPointer helper replace two divergent regex strips with one exported mechanism, each pinned by a test (N-9, N-18).
- [praise] plugins/openspec/hooks/change-loop.mjs:2061 — BUILT_DRIVERS is derived from DRIVER_ROUND, and setup-block apply writes atomically with a clean exit split (2 for a call written wrong, 3 for a refused answer, nothing written).
- [praise] plugins/openspec/hooks/guard.mjs:122 — The CRLF fix lands in the shared readers (parseDevkitBlock, readTestSettings) rather than in setup-block, each pinned by an LF-twin equality test in its own suite; ciPinOf now reuses deliver-check pinsIn instead of a second pin regex.

### Summary
- 9 findings (1 blocking, 3 important, 2 nit) + 3 praise; open: F6 (important), F4 and F5 (nit). F1 to F3 from round 1 are fixed.
- Justification: this is a re-review. It covers the round-1 findings and the lines changed since 02e6780: 387bf15 (the code fixes), 45cbd1c (the owner's choice A narrowing the typed-only wording), 76e88ad (the evidence) and the train-18 merge 22d0706. The merge brings only the suite-socket-path archive, the train record, CONTRIBUTING and test-suite.mjs, none of which this change touches.
  - F1: the spec requirement, its scenario, task 7.6, the R-6 row and the D-14 note now claim only that the devkit skill cannot be invoked by the model. The owner's words are quoted. proof/r6-typed-only.txt matches: no Skill call in any case, and an empty git status in R-1's project. Running the scripts by hand is recorded as evidence F-1, with the refusing hook proposed for the retro. The claim and the proof no longer contradict each other.
  - F2: I applied driver, delivery none, ship merge and merge_method squash to a CRLF config. plan then lists only the tests.* keys as missing, CRLF is kept on every line, and second ship and merge_method answers are refused with exit 3.
  - F3: both inline shapes are refused, with tests.
  - F6 is new and sits on a line 387bf15 rewrote. The verdict is rejected because F6 is open.
- Tests, through scripts/test-suite.mjs with TMPDIR=/var/tmp/devkit-project-setup and --concurrency=3 (no other suite was running): setup-block, delivery-models, flow-check and change-loop. 4 files, 594 tests, 594 pass. scripts/check.py: all checks passed.

### Acceptance
- AC-1: the typed-only half now matches its narrowed wording and R-6 (F1 fixed). The setup root can still fall outside the repository the owner typed in (F6).
- AC-4: the CRLF re-run was probed on this head and keeps every value with no duplicates (F2 fixed).
- AC-7: the ruleset question still has no real run (F4, nit). The text added to step 7 for a blocked ruleset is pinned by a guard test.
- AC-2, AC-3, AC-5, AC-6, AC-8, AC-9 and AC-10: unchanged since round 1, and their inputs did not move.
