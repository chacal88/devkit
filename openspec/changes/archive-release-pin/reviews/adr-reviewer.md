Verdict: approved
Commit: b906df57ecf925bffc6075204d054a14e70a4359

## ADR review: archive-release-pin (round 1, stage 1)

### Findings

ADRs reviewed: ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`), ADR 0027 (`docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0022, ADR 0012, ADR 0002 and ADR 0025 (through their references in 0027 and 0030).

### Re-review
The previous verdict (approved, Commit e0c946a) had no findings, so none is re-listed.

### Conformance of the amendment
- ADR 0030 Decision 1: the pin test in `plugins/openspec/hooks/change-loop-compozy.test.mjs` lost the literal `assert.match`, the Invariant comment and every `doesNotMatch` history line. `pinMismatches` and the `v0.20.0` floor stay. Test 12 in `deliver-check-archive.test.mjs` checks it.
- ADR 0030 Decision 2: `PIN_LINE_FILES` is the flow page only, `PIN_TEST_LINES` and the test-file branch of `pinLinesOnly` are gone, and tests 3 and 6 show the test file is named like any other.
- ADR 0030 Decision 3: `RELEASE_FILE` and `TRAIN_PIN_FILE` are untouched. The pin definition stays in `deliver-check.mjs` and is re-exported by `release-merge.mjs`. `deliver-check.mjs` imports no `release-merge`, so the ADR 0012 consumer CI still downloads three files (test 9). `release-merge.test.mjs` now asserts `PIN_LINE_FILES == [PIN_FILE]`.
- ADR 0003 carries 'Amended by ADR 0030' and the updated 0027 Note. Its Decision is unchanged, and the owner's per-proposal answer is still the gate.
- ADR 0027 carries 'Amended by ADR 0030' and a Note that redirects Decisions 1 and 2.
- ADR 0030 is accepted, and `approval.md` records the owner's approval of the amendment on 2026-11-24.
- The ADR index in `openspec/config.yaml` lists 0030 and marks 0027 as amended by it.
- `docs/openspec-flow.md` (Classification bullet, P13 and the file-check paragraph), the spec delta and the CHANGELOG entry state the same rule.

Tests: one filtered run of `deliver-check-archive.test.mjs` with `--test-name-pattern archive-release-pin`, TMPDIR=/var/tmp/devkit-archive-release-pin, in the foreground: 11 passed, 0 failed.

### Observation (no finding)
ADR 0030 takes number 0030, above 0028 and 0029, which other branches hold. `decisions.md` records that both numbers are re-checked against `origin/main` and the open branches right before the push. The worktree's `origin/main` lists ADRs only up to 0026. The note acknowledges it, so it breaks no ADR, but the check is still pending at push time.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
