Verdict: rejected
Commit: 76b2987d2fe5e6e0cd31cdd109057f2a2ba26348

## Coverage analysis: test-map-hub-links (origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/test-suite.test.mjs:1094-1111 (T-3) and scripts/test-map.json keys plugins/openspec/hooks/change-loop.mjs, plugins/openspec/hooks/deliver-check.mjs — [5] T-3 pins only the dropped hub links and the hub's own test; the kept readers (24 for change-loop.mjs, 29 for deliver-check.mjs) are not asserted, so removing a real reader such as change-state-stages leaves every test green and a selective gate would skip it after a hub edit.
- [nit] scripts/test-map.json keys .gitignore, .claude/settings.json, docs/getting-started.md, .github/workflows/devkit-reviews.yml — [4] The fast readers of document keys outside the eight named documents are not pinned; dropping one of two entries stays green (dropping the only entry is caught by the empty-list check).
- [praise] plugins/openspec/hooks/test-suite.test.mjs:1094 — T-3 reads the real map through readTestMap and resolves each reader against the real suite listing, so a renamed or deleted reader fails instead of matching a stale string.

In-scope surfaces: scripts/test-map.json (data), plugins/openspec/hooks/test-suite.test.mjs, CONTRIBUTING.md sentence.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): slow-links-in-documents -> T-3 slowDocumentLinks deepEqual []; named-document readers -> T-3 readers table (8 documents); dropped hub links -> T-3 dropped table; hub keeps its own test -> T-3 includes asserts; empty list (S7 trap) -> T-3 empty check; removed document key selects nothing (S5/S6) -> existing selective-tests-by-map-2 AC-4 T-8; whole run unchanged -> proof/same-tests.txt (recorded diff, not a standing test).
The three new tests were run alone: 3 pass, 0 fail. The working tree was clean.

### Well covered
- No slow test linked to a document: exact [] deepEqual naming each offender, with T-1 (key classifier) and T-2 (helper) pinning the rule in isolation.
- Named documents' fast readers (guard, test-suite, review-round, status-line, project-settings): asserted by file stem in T-3.
- Over-narrowing was checked by the one-off proofs (doc-reads trace, hub-coverage run, reader-fails run, whole-suite equality); that fits a data-only change but is point-in-time evidence, hence F1.
