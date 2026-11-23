Verdict: approved
Commit: 36ddf5f3900611fbebeadd91fe4fdac4d1de0231

## Coverage analysis — release-merge-conflict, range 3f5ecc2..HEAD (round 1 of 2)

### Findings
- [praise] plugins/openspec/hooks/conduct-check.test.mjs:790-880 (release-merge-conflict 8-13) — The unpushedMerge predicate keeps one test per condition, with the plain-push command asserted and no --force, for the change PR and the archive PR; they survived the main merges intact.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2508-2568 — The pin tests read the manifest through pinsIn, so the 0.29.0 renumber and four main merges needed no hardcoded-version edits, and a stale pin or missing CI snippet still goes red.
- [nit] plugins/openspec/hooks/change-loop.test.mjs:5159-5166 (commit-attribution T17) — implementation-coupled/duplicate: T17 now uses the same start line as T16 ('- `agent`: one Agent call'), so it asserts nothing about the plain push after a release merge; its label overstates it.
- [nit] plugins/openspec/hooks/change-loop.test.mjs:5097-5112 (commit-attribution T5) — T5 is a copy of T3 with a command; its doesNotMatch(/--force|push-rebased/) can only fail if build() adds a force flag, and the real guard for the plain push is conduct-check test 8 and change-loop test 14.
- [nit] plugins/panel/hooks/report.test.tsx:702, plugins/panel/hooks/steps.ts:133, plugins/panel/hooks/i18n.ts:182 — The panel still lists push-rebased as a step conduct-check's actorOf names, although the loop no longer returns it; the list's own comment ('every step actorOf names') is now false and no test notices.
- [nit] plugins/openspec/hooks/conduct-check.test.mjs:790-880 — [4] No conduct-check test runs the release-merge override (unpushed merge, release-file conflict) under a two-PR delivery-model config; main's item-5 conflict on the task PR relies on reading deliver-check to reach it. Write in conduct-check.test.mjs with the two-PR config from delivery-models.test.mjs.

In-scope surfaces: plugins/openspec hooks (release-merge, conduct-check, change-loop) and their tests; panel step labels only as a consumer; docs, manifests and the changelog only through the pin check.

Blocking gaps (8-10 without a plan): 0

Seams checked: unpushed release merge to plain git push origin <branch> -> caught by conduct-check.test.mjs release-merge-conflict 8 (command array, number, no --force) with 10, 11, 12 and 13 for the negatives, the archive PR and auto-merge off; SUBAGENT and ROWS conflict resolution (294b5f1) -> caught by the change-loop test 'the B rows are exactly the steps the checkers can return' (change-loop.test.mjs:533); SKILL.md conflict (8cc32e0) -> caught by release-merge-conflict 16, which asserts the full sentence verbatim; pin tests across four main merges -> caught by pinsIn against the manifest (change-loop.test.mjs:2508-2568); T5 and T17 adaptation (d53c62c) -> passes, but see F3 and F4; interplay with the two-PR delivery model -> the test-branch conflict goes through merge-into-support (delivery-models.test.mjs:682-699), the task PR item-5 conflict still reaches the override, untested under that config (F6). Spec delta (599e476) matches main's scenarios and the implemented override. Mutation runs: 0. Ran by name only: T5, T17, release-merge-conflict 14-16 (7 passed); long suites not re-run, results at a44892f taken from evidence.md.

Previously reported and known (not re-reported): the canonical commit-attribution spec still names push-rebased; recorded in evidence.md Open points.

### Well covered
- Unpushed-merge predicate: one test per condition including the no-force assertion, change PR and archive PR.
- Release-merge end-to-end git fixtures (resolve and abort paths, exit codes 2 and 3) unchanged apart from the shared tmpFolder helper.
