Verdict: rejected
Commit: 02e67807136fa670f73202efc2601e0f3b1936c0

## ADR review — project-setup

### Findings
- [important] docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md § Decision 1 and 6 (lines 29, 52); scripts/test-suite.mjs:21 — ADR 0026's Decision (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`) names the suite's folders as the two removed setup folders, and this change moves SUITE_FOLDERS to `plugins/openspec/skills/devkit/scripts` and `plugins/compozy/kit/scripts`. Unlike ADR 0004, which got a dated Note and an Amended-by line for the same kind of stale Decision text, ADR 0026 gets neither, and ADR 0031's Amends line (`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`) does not list it. The tests that run are the same, so this is drift from the record, not a violation. Fix: add a dated Note to ADR 0026 naming the two new folders (same files, moved by project-setup) and its Amended-by line, and name ADR 0026 in ADR 0031's Amends line.
- [important] plugins/openspec/skills/devkit/SKILL.md:218, :239, :242 (Setup steps 5 and 7); plugins/openspec/skills/devkit/scripts/setup-block.mjs:165, :226 — Tension with ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`) § Decision (merge by opt-in, blocked not downgraded, the owner's merge stays the default). Step 5 now suggests `merge` and writes `ship: merge` before step 7 reads whether GitHub allows the ruleset. On `ruleset: blocked`, step 7 tells the session to stay in `plan` or `pr` mode, but setup-block.mjs `check` refuses an answer for a `ship` map already present. A re-run therefore cannot carry that out, and the project stays opted into a merge mode where every delivery stops at `stop-merge-setup`. The design cites ADR 0002 but does not address this ordering. Fix: in step 7's ruleset-blocked bullet, have the session say that the owner changes the written `ship:` map to `pr` or `plan` by hand, or ask `ship` only after step 7's read-only plan.
- [praise] plugins/openspec/skills/devkit/scripts/kit-installer.mjs; plugins/compozy/kit/ — The kit, its templates and its installer stay in devkit-compozy. devkit-openspec ships only a finder that locates and runs the installer, reads `~/.claude/plugins` without writing to it, and ships no kit file. This is exactly ADR 0031 decision 4 (`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`), and it keeps ADR 0009's opt-in pack (`docs/adr/0009-compozy-loop-as-a-second-driver.md`) and its review trigger untouched.

## ADR review — project-setup

ADRs reviewed: ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0004 (`docs/adr/0004-devkit-per-project.md`), ADR 0009 (`docs/adr/0009-compozy-loop-as-a-second-driver.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0018 (`docs/adr/0018-the-delivery-model-is-chosen-per-project.md`), ADR 0019 (`docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md`), ADR 0022 (`docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`), ADR 0024 (`docs/adr/0024-compozy-runs-the-short-loop.md`), ADR 0026 (`docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`), ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`), ADR 0031 (`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`). Open-decisions log: `docs/coordination-design.md`, Open points.

### Conformance checked

- **ADR 0004:** the opt-in stays in the project's `.claude/settings.json`. The machine-wide schema install happens only on the owner's explicit request. The Never list keeps the rule against installing at user scope. ADR 0004 carries the Amended-by line and the dated Note, in the same form as its earlier Notes.
- **ADR 0010 decision 1 and ADR 0018:** no checker is copied into the project, and CI still downloads the checkers at the pinned commit. `setup-block.mjs` cannot write a `ship:` map that disagrees with `delivery.model`: it skips `ship` once a model is answered and skips `delivery` once a `ship:` map exists.
- **ADR 0010 decision 4:** the driver question offers only `BUILT_DRIVERS`, so `script` is never offered.
- **ADR 0019:** `release_tag` is a question the owner answers, not a value written on its own, so the project's opt-in stays the owner's.
- **ADR 0022:** the setup never writes or removes `delivery.train`.
- **ADR 0030:** the devkit-openspec bump to 0.48.0 moves only the CI pins of `docs/openspec-flow.md` and edits no pin test.
- **ADR 0031:** each decision is carried. The skill keeps `disable-model-invocation: true`. The `setup` start mode runs before the project gate. No alias of the old skills is left. The packs that are not enabled are named. The kit question is separate from the driver question. The fixture of an old project is in place.
- **Old names:** outside the history folders, the only lines that still name the removed skills are the MODIFIED requirement blocks of the two canonical specs, which design D-9 excludes until the archive.
- **Open decisions:** the open point "Project setup" of `docs/coordination-design.md` is acknowledged and answered.
- **Numbering and versions:** 0031 is free on the base 3ca2e47, and the versions take the next minor of the base (devkit-openspec 0.47.2 to 0.48.0, marketplace 0.52.2 to 0.53.0).

### Test run

I waited until no other suite was running. Then I ran `TMPDIR=/var/tmp/devkit-project-setup node scripts/test-suite.mjs --concurrency=3` on `plugins/openspec/skills/devkit/scripts/setup-block.test.mjs`, `plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs` and `plugins/openspec/hooks/guard.test.mjs`. Result: 3 files, 164 tests, 164 passed, 0 failed. This includes `setup AC-2 tree: no file outside the history names the removed setup skills, and neither skill folder exists`.

### Scope

The remit was the in-scope ADRs, the plan files, and the product, document, CI and version files the diff touches. I did not treat the moved tests' bodies, the proof logs under `proof/` or the one-line header changes of the regenerated agents as ADR-conformance surfaces.

### Summary

- 2 findings (0 blocking, 2 important, 0 nit), plus 1 praise.
