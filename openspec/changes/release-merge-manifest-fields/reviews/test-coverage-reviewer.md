Verdict: approved
Commit: 2c1069c9def7da2f59ca09568e60ae3d2ba183d2

## Coverage analysis — release-merge-manifest-fields (origin/main...HEAD)

### Findings
- [nit] plugins/openspec/hooks/release-merge.mjs:69-95 — [3] Two branches of mergeManifestFields have no test: the 'cannot keep ... the base side has no ...' ReleaseError (appears unreachable given the overlap check) and base === null (manifest absent on the base side, which is routed to both-sides refusal). Add a unit case in release-merge.test.mjs next to the AC-3 test for the null-base input.
- [nit] plugins/openspec/hooks/delivery-train.test.mjs — [3] The 'one side edited a field inside a pack entry the other side removed' case is covered only at unit level (mergeManifestFields AC-3), not through the join or --base seam. The seam shares the same code path, so the risk is low.
- [nit] plugins/openspec/hooks/release-merge.test.mjs (AC-7) — Implementation-coupled: the docs test matches exact phrases and bullet prefixes in docs/openspec-flow.md and CONTRIBUTING.md (for example 'rides the train', '- **Classification.**'). It breaks on a legitimate rewording of the docs, but it does pin the documented rule.

In-scope surfaces: plugins/openspec hooks (release-merge.mjs, join of the delivery train), docs (docs/openspec-flow.md, CONTRIBUTING.md).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- Join callsite -> mergeManifestFields -> writeStaged, keeping the head's description in both manifests: caught by delivery-train AC-1/AC-6, which also checks the catalog regenerated from it.
- Join keeping a train-only edit with the renumbered version: caught by delivery-train AC-2.
- Join refusing a field both sides edited, with a clean abort and conflicts carrying the path: caught by delivery-train AC-3. It asserts the error prefix, the 'file (description)' text, conflicts, and the old tip.
- Two different fields of one manifest: caught by delivery-train AC-4.
- Whole entry or manifest added by the head, versus one added only by the train: caught by the delivery-train 'whole entry' test.
- --base mode (release-merge step) keep and refuse with abort to oldHead: caught by the release-merge AC-5 tests. The old error text for a whole entry is pinned by the 'whole entry: --base' test.
- Unit contract of mergeManifestFields (key order, same and different values, entry removed on the other side, added and removed keys, truncated JSON): caught by the AC-1 to AC-4, whole-entry and parsers tests.
- Docs claims: caught by the release-merge AC-7 test.

Test runs: release-merge.test.mjs passed (80 of 80) and delivery-train.test.mjs passed (152 of 152). The second run started while the load average was 14.99, above the 12 limit, and the tool moved it to the background. I waited for it to finish and left nothing running.

### Well covered
- Both-sides refusal leaves the train at its old tip with a clean tree, in both modes (git rev-parse HEAD, status --porcelain and noMerge asserted).
- The whole-entry refusal keeps the pre-change error text, so the old contract still has a test.
- Reaching the join through main and through --base each have their own end-to-end test, not only the unit core.
