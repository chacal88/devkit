Verdict: approved
Commit: df7cfaccdb7a1bf755959dc95629713fcbbbe4b1

## Architecture review — change-version-pin (scoped re-review, 043b8e0..df7cfac)

### Findings
- [nit] plugins/openspec/hooks/change-loop.mjs:1482 — openTitle reads the installed devkit flow (no change, no pin) but is absent from D-4 tables A and B, which the design calls exhaustive; add a B row or soften the wording. Still open: the line only moved with the merge.
- [nit] plugins/openspec/hooks/guard.mjs (readPin); plugins/openspec/hooks/change-loop.mjs (writePin, PIN_KEYS) — The pin key names are literals in readPin and again in writePin's PIN_KEYS; export them once from guard.mjs. Still open.
- [nit] openspec/changes/change-version-pin/design.md:536 — The pin contract and the kept-flows rule are a durable cross-reader mechanism with no ADR; an ADR candidate for the owner, with no conflict with any ADR. Still open.

Analyzed: owners, boundaries, contract consumers and the merge resolution, bounded to what this change touches (`git diff origin/main HEAD`) and to the delta since 043b8e0.

**Merge resolution.**
- Every reader of a change's flow goes through `changeFlow`, `changeDeclares` or `changeDeclaresOrInstalled` in guard.mjs, the single owner of the pin.
- The remaining direct `readFlow` or `schemaFile` callers are intended: openTitle (F1), the pin writers (`open` and `script`), `flow` (comparing the installed version), `project-loop`'s not-opened branch, and flow-check's own fallback.
- Main's PR 86 additions are intact: `tag-release` is still in conduct-check's MAIN list, and `releaseTagSetting` is imported next to this change's `changeFlow`, `readFlow` and `readPin`. deliver-check's `tag-release` step reads the release file and the merge commit, not a flow, so it has no pin consumer to add.
- `git diff origin/main` of deliver-check.mjs and conduct-check.mjs shows only this change's pin edits. The two readiness reads in deliver-check go through `changeDeclares`.
- Main's PR 87 edits (`BULLETED_STATUS`) auto-merged and do not appear in the diff.

**Release renumbering.** plugin.json is 0.31.0, marketplace.json is 0.35.0, and the CHANGELOG puts `## 0.35.0 — change-version-pin` above main's `## 0.34.1`. The CI-pin tags in docs/openspec-flow.md take v0.31.0 consistently. This matches merge-notes.txt, with no stale 0.30.0 or v0.30.0 left for this release.

**CI fix of version-pin.test.mjs (+11 -1).** The in-process stop test now points TMPDIR at a `tmpFolder` and restores it in a `finally`. It asserts the refusal record lands in that folder. It stays inside the test layer, with no product coupling. The 2 AC-2 locks tests pass.

**Evidence.** evidence.md was rewritten at 4b75272. It lists main's PR 86 and PR 87 content and this change's resolution consistently with merge-notes.txt and with the diff I read.

**Deletion test.** No new module in this delta; the previous round's passes carry over.

**Previous findings.** All three were nits, and all stand: F1 (openTitle missing from table B), F2 (pin key literals), F3 (ADR candidate). None is blocking or important.
