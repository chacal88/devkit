Verdict: approved
Commit: c6442089e54614c6871c50400b920f810a467c85

## Coverage analysis, forced-merge-path (re-review, 8dcee76..c644208)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:951-958 (inHead); deliver-check-archive.test.mjs G13 — Previous: no test put a fixed-in sha with compare behind, diverged or 404 on a verdict; inHead always true stayed green. · fixed in ca5b3b3283eba0ede1df206d02062305ecd41b05
- [important] plugins/openspec/hooks/deliver-check.mjs:956-958 (historyError); deliver-check-archive.test.mjs G14 — Previous: a non-404 compare error blocking the gate was asserted by no test. · fixed in ca5b3b3283eba0ede1df206d02062305ecd41b05
- [nit] deliver-check-archive.test.mjs G12 — Previous nit, still open: the identical status and the head.startsWith(sha) short-circuit are not pinned.
- [nit] deliver-check-archive.test.mjs G11/G12/G13 — Previous nit, still open: tests assert exact gate text and the compare route key, not only stale or current.
- [nit] openspec/changes/forced-merge-path/evidence.md gate 1.9 — Previous nit, still open: attempt 1 ended exit 1 without a failure line under load; later attempts pass, keep the train's raw log.
- [nit] deliver-check-archive.test.mjs (F1, L1, G9, commitRoutes) — Previous nit, still open: tests coupled to exact gh argument lists and producer error strings.
- [nit] deliver-check-archive.test.mjs D2; change-loop-compozy.test.mjs D1 — Previous nit, still open: skill-prose regexes pin wording, not agent behavior; only the live replay proves it.
- [nit] openspec/changes/forced-merge-path/proof/gh-shim.test.mjs, proof/replay.test.mjs — Previous nit, still open and informational: proof-harness tests sit outside the folders test-suite.mjs reads.
- [nit] plugins/openspec/hooks/change-loop.test.mjs (near C2, post-merge-validate 2) — Previous nit, still open: no test pins that a forced retro row gets no merge-check step when facts.mergeCheck carries a merge.
- [nit] plugins/openspec/hooks/deliver-check.mjs collectState postMerge branch (planDirty: []) — Previous nit, still open: no test asserts that a forced state carries an empty planDirty.
- [praise] deliver-check-archive.test.mjs G13/G14 — G13 and G14 pin the fixed-in currency check at the seam, including the default-branch blocked path for a compare error.

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs gatesAtHead inHead and historyError, deliver-check-archive.test.mjs G13 and G14), the three new spec scenarios and design D-3.

Blocking gaps (8-10 without a plan): 0

Seams checked:
- inHead in gatesAtHead, behind, diverged and 404 leave the finding undisposed: caught by G13. Always-true inHead turns the expected gate into no gate, so the test goes red.
- historyError for a non-404 compare error returns { error } and blocks: caught by G14, in gatesAtHead and in the default-branch state (unreadMerge, forced null, nextStep blocked).
- Spec scenarios 'undisposed finding', 'fixed-in commit in history' and 'cannot be checked' map to G11, G12/G13 and G14. design.md D-3 matches the code.
- Mutation runs: 0 (the implementer's reported mutation proofs are not repeated). Tests run: G13 and G14 alone, 2/2 pass.

### Well covered
- Undisposed finding makes an approved verdict stale outside the review record: G11.
- Disposed by refuted or fixed-in-history: G12. Not in history: G13. Compare failure: G14.
