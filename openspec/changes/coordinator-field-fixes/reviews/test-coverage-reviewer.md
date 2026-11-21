Verdict: rejected
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

## Coverage analysis — coordinator-field-fixes (origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs mergedOnBranch (open PR branch); test near deliver-check.test.mjs:4729 — [6] A further open PR on the same head after a merge with tasks left is returned as the PR; no test supplies an OPEN PR in pr-list, so always returning none (and mergedBefore) goes unnoticed.
- [nit] plugins/openspec/hooks/change-loop.mjs archivedOnDefault — [4] Archived ids suppress by id alone, so a reused id of a new active change would be hidden; no test pins the intent.
- [praise] plugins/openspec/hooks/*.test.mjs — Every new seam has a test that asserts the observable wire, and a red run per defect is recorded in proof/.

Verdict: approved
Commit: 403b38c5370d0279c75d0c2ad20824c72570e014

In-scope surfaces: openspec hooks (guard, flow-check, change-loop, deliver-check), openspec-setup scripts (github-setup, install-schemas, changes-under-way), compozy-setup install-kit.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): isOwnPr and prFiles into findChangePr, deliveryOf into collectState and flow-check readDelivery, isPreviousScript, selectCiChange several into runSeveral, archivePrCheck per-folder schema, archivedOnDefault, openspecCli at four call sites, github-setup, changes-under-way and install-kit are each caught by named tests. The only uncaught seam is the open-PR branch of mergedOnBranch (F1).

### Well covered
- Delivered means the change's own PR (by files) with every task ticked on the default branch.
- The CI check follows the change's script and handles several changes through both entries.
- The previous-script rule reads the earliest stage file.
- The pinned CLI wins over PATH and is refused when it is 1.x or not installed, at all four call sites.
- The kit re-run keeps local edits.
