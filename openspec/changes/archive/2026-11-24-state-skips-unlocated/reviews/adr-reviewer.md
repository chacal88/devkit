Verdict: approved
Commit: 535524cac1bb7936280169bb3aec4f5082dbc716

## ADR review — state-skips-unlocated

### Findings
- [important] docs/openspec-flow.md:240; docs/adr/0017-a-change-state-is-derived-in-one-place.md — The state of an unplaced change is derived outside nextAction, so next, wait and session-next still exit 3; docs and ADR were silent on it. · fixed in f636733
- [nit] openspec/changes/state-skips-unlocated/design.md § D-3 — D-3 did not cite ADR 0017 decision 1 for the stand-in kept outside nextAction. · fixed in f636733

ADRs reviewed: ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0030 (`docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`), ADR 0027 (`docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`, amended by 0030).

Re-review scope: the previous findings and faddf80..HEAD, with this change's own diff against main (d917ae0..HEAD) after the merge of train 6.

- The ADR 0017 file holds post-merge-validate's Note and then this change's Note, each its own paragraph, with nothing lost or doubled. The state-paragraph sentence of docs/openspec-flow.md is intact.
- unplacedAction is defined at change-loop.mjs:1907 and called at change-loop.mjs:1967 and roadmap-loop.mjs:807, beside nextAction and not in it, which keeps ADR 0017 decision 1 respected.
- The release files agree: plugin.json 0.42.1, marketplace.json 0.47.1 with devkit-openspec 0.42.1, a CHANGELOG 0.47.1 entry, and the CI pins in docs/openspec-flow.md say v0.42.1.
- No open decision is touched. No test run, as instructed. No new finding.

### Summary
- 2 findings carried from the previous round (0 blocking, 0 important open, 0 nit open), both closed by f636733.
