Verdict: approved
Commit: 749eb53227b1b77287b354bc952761e43b03374d

## Coverage analysis — forced-merge-release-edit (round 1)

### Findings
- [praise] plugins/openspec/hooks/deliver-check-archive.test.mjs:2647-2740 — Each new seam has an assertion that would go red: release-only edit current (AC-1), a sentence edit (AC-2), a product commit (AC-3), the no-note/no-config/refused-tag variants (AC-4), rejected and undisposed reviews (AC-5), and the base_commit ref. The failed-read path is covered end to end, from gatesAtHead down to the blocked step naming PR 12.
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:2647 — implementation-coupled: the AC-1 test asserts each contents key is read at most once (new Set(reads).size === reads.length). That pins the memo, not the contract. A legitimate change to the read strategy turns it red.
- [nit] plugins/openspec/hooks/deliver-check.mjs:1052 — No test says a non-passed evidence (result failed, no stage header) stays open across the step's commit. The `exempt=true` argument sits only on the passed branch, and the code is correct by reading. A one-line case in the same FMRE group would pin it.

In-scope surfaces: plugins/openspec hooks (deliver-check.mjs: gatesAtHead, releaseContext and releaseOnlyEdit reader), docs/openspec-flow.md (prose only).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- `exempt` argument at the evidence callsite: the AC-1 and AC-2 tests would go red. The AC-3 test would go red if a refused path were left current.
- `!open` at the approved-review callsite: the AC-5 test would go red, with the undisposed finding and the rejected review both stay open.
- `base_commit.sha` as the recorded side's ref: the AC-1 base_commit test would go red. It asserts there is no read at the short sha, and the `base: false` fallback gives the same empty gates.
- `ctx.reader` and the `releaseContext(root, file, reader)` default: the existing deliver-check staleness rows and the delivery-train-after row cover the normal path (task 1.3, AC-4). The own-files gate is green.
- `readError` propagation: six failing-read cases in the blocked test, plus the unreadable-merge case that blocks with unreadMerge and never forces.
- Lazy note and config read: the 'compare of only openspec/ files reads no release note' test and the no-note variant (no step file read).

Well covered:
- Release-only edit after the step's commit leaves the gates current, and forcedMerge counts only the red check.
- A mixed commit (the step's files plus a sentence or a product file) names the offending path.
- A failed or empty GitHub read is never read as current or as not forced.

No new script or test file is added, so scripts/test-map.json needs no edit.
