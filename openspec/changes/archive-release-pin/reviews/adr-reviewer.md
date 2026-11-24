Verdict: approved
Commit: e0c946ad9e3e83cbaa94f41ee4da75a5bbba172f

## ADR review: archive-release-pin

### Findings

ADRs reviewed: ADR 0027 (`docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`), ADR 0003 (`docs/adr/0003-auto-merge-the-archive-pr.md`), ADR 0025 (`docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`, new on the base since the previous round), ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0012, ADR 0018, ADR 0019 and ADR 0026 (checked only through the references in ADR 0027).

### Re-review
The previous verdict (approved, Commit ec2730f) had no findings, so none is re-listed.

Between `ec2730f` and `e0c946a`, the change's own work moved only the following. The reviews-check delta spec now names `plugins/openspec/hooks/change-loop-compozy.test.mjs`, which matches ADR 0027 Decision 1. The evidence and the review records were refreshed.

The base merges brought ADR 0025 and its stale-only-on-own-files rule into `plugins/openspec/hooks/deliver-check.mjs` (`ownFiles`, `staleness` with `own`, `stalenessBase`). The pin definition and `RELEASE_FILE` are untouched by those hunks.

Conformance after the merges:
- ADR 0027 point 3: `RELEASE_FILE` is unchanged, so the release list does not grow. ADR 0025's own consequence says it follows that list with no change.
- ADR 0027 point 6 and ADR 0012: `deliver-check.mjs` imports only `merge-setup.mjs` and `guard.mjs`, not `release-merge.mjs`, so the consumer CI keeps downloading three files.
- ADR 0003: the 0027 Note and the 'Amended by' line are present. ADR 0002 carries the separate 0025 Note, so the two amendments do not collide. The owner's per-proposal answer is still the gate, and no push to the default branch was added.
- ADR 0027 is listed in the ADR index of `openspec/config.yaml`, and 0025 is now listed there too. The numbering note in `decisions.md` (sibling branch held 0025) is historical and consistent with the renumber.
- `approval.md` records the owner's approval of the plan.

The release renumber moved only `plugin.json`, the marketplace manifest, the changelog and the catalog. Those are release files, never own files under ADR 0025, so they do not stale this change's evidence or reviews.

Tests: one filtered run of `deliver-check-archive.test.mjs` and `release-merge.test.mjs` with TMPDIR=/var/tmp/devkit-archive-release-pin did not finish (see above). I treat the full-suite proof as the test evidence and add no verdict weight from the aborted run.

### Summary
- 0 findings (0 blocking, 0 important, 0 nit)
