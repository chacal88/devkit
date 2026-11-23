Verdict: approved
Commit: df7cfaccdb7a1bf755959dc95629713fcbbbe4b1

## ADR review — change-version-pin

### Findings
- [nit] openspec/changes/change-version-pin/design.md § Decisions and ADRs (no new ADR); docs/adr/0010-openspec-as-the-harness.md; docs/adr/0012-the-reviews-check-follows-the-change-script.md — Earlier changes that altered how a locked ADR's mechanism behaves added a dated Note to the ADR; this change adds none to ADR 0010 or ADR 0012 and the design does not say why none is needed. No decision sentence is contradicted. Still open: design.md unchanged since 043b8e0.
- [nit] openspec/changes/change-version-pin/design.md § D-1 and § Decisions and ADRs; plugins/openspec/hooks/deliver-check.mjs checkOne — A pull request can lower its own change's x-devkit-flow to an older kept flow and be judged by it; the design never records that as accepted, as ADR 0012 does for the analogous schema edit. Still open: design.md unchanged since 043b8e0.

ADRs reviewed: ADR 0002 (`docs/adr/0002-merge-without-the-owner-opt-in.md`), ADR 0010 (`docs/adr/0010-openspec-as-the-harness.md`), ADR 0011 (`docs/adr/0011-the-change-coordinator-is-the-owners-session.md`), ADR 0012 (`docs/adr/0012-the-reviews-check-follows-the-change-script.md`), ADR 0017 (`docs/adr/0017-a-change-state-is-derived-in-one-place.md`), ADR 0019 (`docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md`). ADR 0019 is new since the previous round (it came with the merge of main); the others were already in scope.

Scope of this re-review: the three new things since 043b8e0.
- Merge resolution: `git diff origin/main HEAD` of `change-loop.mjs`, `deliver-check.mjs` and `conduct-check.mjs` shows only this change's pin edits and none of main's removed. The `tag-release` step (4 occurrences in `deliver-check.mjs`, 2 in `change-loop.mjs`, 1 in `conduct-check.mjs`), the `releaseTagSetting` import and the `release-tags.test.mjs` import in `guard.test.mjs` are intact. The targeted `release-tags` run passes 45/45 (empty TMPDIR, GITHUB_HEAD_REF and GITHUB_BASE_REF set). This conforms to ADR 0019 decisions 1 to 3.
- Release renumbering: `plugins/openspec/.claude-plugin/plugin.json`, the release file ADR 0019 reads, carries devkit-openspec 0.31.0, above main's 0.30.1; `proof/merge-notes.txt` records that no v0.31.* tag exists. No ADR is touched.
- Test fix: the `version-pin.test.mjs` change only points TMPDIR at a test-owned folder; no ADR decision is touched.
- Flow reads still go through `guard.mjs#changeFlow`, so ADR 0017's single place for deriving a change's state is not contradicted. ADR 0011's rule that a lock never traps is respected by the `changeDeclaresOrInstalled` fallback.
- `evidence.md` has no ADR mention.

The previous round's two nits (F1, F2) stand with no disposition; neither blocks. The previous verdict was approved with no blocking or important finding.

### Summary
- 2 findings (0 blocking, 0 important, 2 nit)
