Verdict: approved
Commit: d0a2b37eb677790cbbb1422d2ecf4b5143da5d89

## Coverage analysis, forced-merge-path (0de71c21..d0a2b37, round 2 of 2)

### Findings
- [important] plugins/openspec/hooks/deliver-check-archive.test.mjs:2418-2464 (L5, L6, L7) over deliver-check.mjs deliveryOf — [6] The commit arm's success path was never composed with deliveryOf, collectState and nextStep. L5 (forced, count 4), L6 (task left, checks green: stop-branch, no forced fact, no gate read) and L7 (all ticked: today's retro row, no rollup read) now do, from the default branch and from another change's branch; the 13 focused tests pass. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:1198-1213 ('a further open pull request ...') — [4] The scenario 'A further pull request is open' was pinned only by accident; the test now sets a red rollup on merged #12 and asserts forced null, unreadMerge null and no 'pr view 12' call. · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:2187-2223 (N2, N4, assertOpenItems1And6) — [4] The items, summary and exit-code readout of a forced merge was asserted only on the list arm (N5); N2 and N4 now assert it on the change's own branch (exit 1, items open/met x4/open/met/met, reasons of items 1 and 6, summary 'merged: archive step retro'). · fixed in 8058ecf67985073eea1bffe55730dd33479c17f0
- [nit] openspec/changes/forced-merge-path/evidence.md gate 1.9 (observation 5) — [3] Gate 1.9's first attempt ended with exit 1, 110 passes and no failure line at load average 33; the cause is still not found and the evidence still says so (honestly, not claimed as a pass). Follow-up: have the train's whole-suite run keep its raw log and look for a child killed under load.
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:1881-1884 (F1), 2313-2316 (L1), 2094-2100 (G9), 1939, 2413 (commitRoutes in L5-L7) — [2] Implementation-coupled: tests assert exact gh argument lists (per_page=10), the compare route and the producer's own error strings; the new L5-L7 reuse the same commitRoutes. They fail on breakage; this is a refactor-friction note only.
- [nit] plugins/openspec/hooks/deliver-check-archive.test.mjs:927-936 (D2), plugins/openspec/hooks/change-loop-compozy.test.mjs:261-265 (D1) — [2] The skill-prose regexes pin sentence wording, not what the agent writes; the behavior is proven only by the live replay in evidence.md, which the CLAUDE.md rule asks for.
- [nit] openspec/changes/forced-merge-path/proof/gh-shim.test.mjs, proof/replay.test.mjs — [2] The proof-harness tests live outside the four folders scripts/test-suite.mjs reads, so no gate runs them again. They passed in evidence (27/27) and the harness is change-scoped; informational only.
- [praise] deliver-check-archive.test.mjs N1-N10, F1-F11, G0-G10, L1-L7; proof/red-1.txt — The forced signal and the open items are well covered with exact reasons, counts and item order; N6 and N8 check negatives by the gh calls log, N10 compares bytes before and after, and red-1 shows 47 of 49 red for the missing behavior.
- [praise] deliver-check-archive.test.mjs T1-T3, change-loop.test.mjs C1-C3, delivery-models.test.mjs N11 — The seams that cross layers are covered: T3 drives change-loop next through collectState and deliveryRow to the retro session step, T1 and T2 cover train projects, C2 and N11 pin the stage-checker precedence and the two-prs base pull request.

In-scope surfaces: plugins/openspec/hooks (deliver-check, change-loop, guard), plugins/openspec/skills (ship-change, devkit), the change's proof harness.

Blocking gaps (8-10 without a plan): 0

Seams checked: commit arm into deliveryOf/collectState/nextStep, forced case -> caught by L5 (exact reason, count 4, url, head, via commit, from main and another branch); same seam, partial case -> caught by L6 (stop-branch, forced null, unreadMerge null, no gate file read); same seam, all ticked -> caught by L7 (today's retro row, no rollup read, no forced key); spec scenario 'A further pull request is open' -> caught by the 'further open pull request' test (red rollup on #12, forced null, unreadMerge null, no pr view 12 call); forced merge read from the change's own branch -> caught by N2 and N4 through assertOpenItems1And6 (exit 1, item statuses, reasons of items 1 and 6, summary, next step). (mutation runs: 0)

I ran the focused tests (N2, N4, N5, L1-L7, 'further open pull request') under TMPDIR=/private/tmp/devkit-fmp: 13 of 13 pass. No whole-suite run. Remaining open: F4 to F7 are nits (the gate 1.9 follow-up, implementation coupling, skill-prose regexes, proof-harness tests outside the gated folders). Ship mode 'pr' on a forced merge from the change's own branch is still asserted only through N11 from the default branch; minor and not a verdict matter.

### Well covered
- Forced-merge signal, open items, exit code and summary: N1-N10, F1-F11, G0-G10 and L1-L7 assert exact reasons, counts and order; N6/N8 prove negatives by the gh calls log; N10 compares bytes before and after a run.
- Cross-layer seams: T1-T3, C1-C3 and N11 cover train projects, stage-checker precedence, the two-prs base pull request and change-loop next through to the retro session step; proof/red-1.txt shows 47 of 49 tests red for the missing behavior.
