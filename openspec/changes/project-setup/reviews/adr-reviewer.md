Verdict: approved
Commit: 76e88ad3fdab3ffd0ced32b6418bc4c38cef11da

## ADR review — project-setup

### Findings
- [important] docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md § Decision 1 and 6; scripts/test-suite.mjs:21 — ADR 0026 named the removed setup folders as the suite's folders with no Note or Amended-by line, and ADR 0031's Amends line did not list it (drift from the record). · fixed in 387bf15
- [important] plugins/openspec/skills/devkit/SKILL.md:242 (Setup step 7); plugins/openspec/skills/devkit/scripts/setup-block.mjs — Tension with ADR 0002: step 5 writes ship: merge before step 7 finds the ruleset blocked, and a re-run cannot change a ship: map already present, so the project stayed opted into a blocked merge mode with no stated way out. · fixed in 387bf15
- [praise] plugins/openspec/skills/devkit/scripts/kit-installer.mjs; plugins/compozy/kit/ — The kit, its templates and its installer stay in devkit-compozy; devkit-openspec ships only a finder, as ADR 0031 decision 4 says, keeping ADR 0009's opt-in pack untouched.
- [nit] docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md:50 (Decision 1); openspec/changes/project-setup/design.md D-14 note — ADR 0031 decision 1 says the setup runs only from the owner's typed command, but after the owner's choice A the plan protects only the skill and leaves the scripts runnable by hand (evidence F-1); the ADR does not record that gap or the retro hook, so add one dated line to ADR 0031 saying so.

ADRs reviewed: ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`), ADR 0031 (`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`). These were re-read in round 2 to check the fixes and the lines changed since 02e6780. Round 1 covered ADR 0003, 0004, 0009, 0010, 0018, 0019, 0022, 0024 and 0030 (`docs/adr/`); none of the lines changed since then touch them. Open-decisions log: `docs/coordination-design.md`, Open points.

### Changes since round 1

- **387bf15 (code):** these fixes come from other reviewers' findings. None of them conflicts with an ADR:
  - `guard.mjs` `parseDevkitBlock` and `flow-check.mjs` `readTestSettings` now read CRLF files.
  - `setup-block.mjs` refuses an inline map or list in the devkit block.
  - `setup-block.mjs` `ciPinOf` now reads the pin through `deliver-check` `pinsIn`. This keeps one pin reader, in line with ADR 0030.
  - `change-loop.mjs` answers `setup-no-repo` outside a git repository even where `openspec/changes` exists.
- **387bf15 (F2 fix):** step 7 of `plugins/openspec/skills/devkit/SKILL.md` now tells the owner to change a written `ship: merge` (or `trunk-auto`) by hand when the ruleset is blocked. So `merge` mode stays blocked, not silently downgraded, and changing it is left to the owner, as ADR 0002 requires.
- **45cbd1c (plan wording, owner's choice A):** the typed-only requirement now covers only the `devkit` skill not being invocable by the model, as for `/devkit change`. That fits the scope ADR 0031 decision 1 gives in its parenthesis. The ADR's wording, which is still stronger, is nit F4.
- **22d0706 (merge of train 18):** 0031 is still the next free ADR number. The version bumps still take the next minor of base fc28735: marketplace 0.52.2 to 0.53.0, devkit-openspec 0.47.2 to 0.48.0, devkit-compozy 0.4.0 to 0.5.0.
- **76e88ad:** evidence only.

### Test run

No other suite was running. I ran `TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3` on `plugins/openspec/skills/devkit/scripts/setup-block.test.mjs`, `plugins/openspec/hooks/guard.test.mjs` and `plugins/openspec/hooks/flow-check.test.mjs`. Result: 3 files, 321 tests, 321 passed, 0 failed.

### Scope

This is a re-review: I checked the previous findings and the lines changed in 02e6780..76e88ad (387bf15, 45cbd1c, the merge 22d0706 for numbering and versions, and 76e88ad). I did not run a new full hunt.

### Summary

- 3 findings (0 blocking, 2 important, both fixed in 387bf15, 1 nit), plus 1 praise.
