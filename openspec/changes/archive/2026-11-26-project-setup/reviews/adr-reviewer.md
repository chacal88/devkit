Verdict: approved
Commit: 2079b0f84d05c024a14338da7f9117b44b14c137

## ADR review — project-setup

### Findings
- [important] docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md § Decision 1 and 6; scripts/test-suite.mjs:21 — ADR 0026 named the removed setup folders as the suite's folders with no Note or Amended-by line, and ADR 0031's Amends line did not list it (drift from the record). · fixed in 387bf15
- [important] plugins/openspec/skills/devkit/SKILL.md:242 (Setup step 7); plugins/openspec/skills/devkit/scripts/setup-block.mjs — Tension with ADR 0002: step 5 writes ship: merge before step 7 finds the ruleset blocked, and a re-run cannot change a ship: map already present, so the project stayed opted into a blocked merge mode with no stated way out. · fixed in 387bf15
- [praise] plugins/openspec/skills/devkit/scripts/kit-installer.mjs; plugins/compozy/kit/ — The kit, its templates and its installer stay in devkit-compozy; devkit-openspec ships only a finder, as ADR 0031 decision 4 says, keeping ADR 0009's opt-in pack untouched.
- [nit] docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md:50 (Decision 1); openspec/changes/project-setup/design.md D-14 note — ADR 0031 decision 1 says the setup runs only from the owner's typed command, but after the owner's choice A the plan protects only the skill and leaves the scripts runnable by hand (evidence F-1); the ADR does not record that gap or the retro hook, so add one dated line to ADR 0031 saying so.

ADRs reviewed: ADR 0031 (`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`) and ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`), re-read for the range 76e88ad..2079b0f. Earlier rounds also reviewed ADR 0002, 0003, 0004, 0009, 0010, 0018, 0019, 0022, 0024 and 0030 (`docs/adr/`). Nothing in this range touches them, and no file under `docs/adr/` changed. Open-decisions log: `docs/coordination-design.md`, Open points. No open decision is touched.

### Changes since round 2 (76e88ad..2079b0f)

- **ac5958e (code, code-quality F6):** this commit changes the `setup` branch of `startMode` in `plugins/openspec/hooks/change-loop.mjs`.
  - A folder outside any git repository still answers `setup-no-repo`, as before.
  - The setup root is `findRoot`'s folder only when that folder, compared through its real path, is the git top level or a folder inside it. In every other case the root is the top level.
  - So the setup no longer writes outside the repository where the owner typed the command.
  - ADR 0031 decision 1 (one verb, from the owner's typed command) and decision 3 (only the configuration, pin and schemas under the project's `openspec/`) stay intact. The change narrows where the step writes. It adds no setting, no pack and no checker code, and does not affect ADR 0010 decision 1's list of what lives under `openspec/`.
  - The new test (N-20) states its invariant, the layer that owns it and its suite, as the project's working rule requires.
  - The commit message is conventional (`fix(setup): ...`), as `docs/conventions.md` requires.
- **78001de:** design D-1 now states the setup root the way the code computes it. The plan text follows the code and does not conflict with any ADR.
- **b8253f7, d51b033, 816d179, 2079b0f:** these commits change only evidence and review files, so there is nothing to check against an ADR.
- **Previous findings:** F1 and F2 stay fixed in 387bf15; the Note and Amended-by line in ADR 0026 are still present. Nit F4 is still open: ADR 0031 has no dated line yet.

### Test run

Before the run, `pgrep -f 'scripts/test-suite.mjs$'` showed no other suite run. I ran `TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3 '--test-name-pattern=setup AC-1 start' plugins/openspec/hooks/change-loop.test.mjs`. Result: 1 file, 6 tests, 6 passed, 0 failed. The new nested-repository test was among them.

### Scope

This is a staleness re-review: I checked the previous findings and the lines changed in 76e88ad..2079b0f, and did not run a new full hunt.

### Summary

- 3 findings (0 blocking, 2 important, both fixed in 387bf15, 1 nit still open), plus 1 praise.
