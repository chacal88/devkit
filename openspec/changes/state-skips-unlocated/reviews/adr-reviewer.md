Verdict: approved
Commit: faddf80f7035fb873748b734bd3515341ab62456

## ADR review — state-skips-unlocated

### Findings
- [important] docs/openspec-flow.md:240; docs/adr/0017-a-change-state-is-derived-in-one-place.md — The state of an unplaced change is derived outside nextAction, so next, wait and session-next still exit 3; docs and ADR were silent on it. · fixed in f636733
- [nit] openspec/changes/state-skips-unlocated/design.md § D-3 — D-3 did not cite ADR 0017 decision 1 for the stand-in kept outside nextAction. · fixed in f636733

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`), ADR 0027 (`docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`, amended by 0030).

Re-review scope: the previous findings and cb79a38..HEAD. Both previous findings stay closed after the merge of origin/main (train 4) and the renumbering to devkit-openspec 0.40.1 / marketplace 0.45.1.

- The ADR 0017 Note and the state-paragraph sentence of docs/openspec-flow.md (line 240) are intact. unplacedAction is still exported at change-loop.mjs:1790 and called at change-loop.mjs:1850 and roadmap-loop.mjs:807.
- The five product and test files of this change are unchanged since cb79a38 (empty git diff --stat).
- The release files agree: plugin.json 0.40.1, marketplace.json 0.45.1 with devkit-openspec 0.40.1, a CHANGELOG 0.45.1 entry, and the CI pins in docs/openspec-flow.md say v0.40.1. ADR 0030 (pin test reads the manifest) does not conflict, since this change does not edit change-loop-compozy.test.mjs.
- decisions.md is unchanged; no open-decisions log exists, so no open decision is touched.

No test run, as instructed. No new finding.

### Summary
- 2 findings carried from the previous round (0 blocking, 0 important open, 0 nit open), both closed by f636733.
