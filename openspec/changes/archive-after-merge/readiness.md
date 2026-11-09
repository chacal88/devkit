# Readiness review: archive-after-merge

Round 2. Round 1 (NEEDS-REVISION, three blockers and two Low findings) is overwritten.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate archive-after-merge --strict` passes. No open blocker.

## 2. Scope validation
Classification: correct. Problem, scope and non-goals are explicit; specs are skipped by design (D1, `skip_specs: true`, precedent in three archived changes). The revision added no scope.

## 3. Proposal review
The Low finding is closed: the `devkit-reviews.yml` template no longer appears in proposal.md Impact, and design D12 says it is not modified (this repository's own workflow runs the checkout's checker, so the dogfood archive PR gets the D2 rule). ACs match requirements.md.

## 4. Design review
Round 1's code anchors stay confirmed (`deliver-check.mjs:653`, `:410-424`, `:971-996`, `:1070`; `guard.mjs:84-98`; ADR 0002 line 35; versions 0.5.0 / 0.4.1 / 0.5.1). Re-checks of the fixes:

- B1 (closed): D4 step 2 now drops archive heads first, matches on the body's `openspec/changes/<id>/evidence.md` link, falls back to a head whose last segment equals `<id>` exactly, and has no "contains" match. The rule is re-derived against this repository's real PR history (#5 `auto-merge` with the link, #6 `archive-auto-merge` without it): it returns #5. Task 2.3 carries a fixture shaped on that history, plus a `feat/auto-merge-docs` decoy and a no-link variant.
- B2 (closed): D2 says `archiveBranchChange` also finds the id on a resumed run; D9 adds Start step 1 (argument, else the selected change, else the id in `chore/archive-<id>`, else ask); task 3.1 pins it with a format test and a round-trip test in `deliver-check.test.mjs` (`archiveBranchChange` returns `x` while `resolveChange` returns null, and `deliver-check x --json` answers).
- B3 (closed): D6 and R-6 require every changed file, a regression gate's test file included, as an exact repository-relative path; D8 defines P13 matching as string equality after normalising `./`, with no directory, prefix or glob matching and a fixed release-file list. Task 2.7 tests the pass cases (exact, `./` form, a proposal naming both a doc and its test) and the stop cases (rejected-only, unnamed, unnamed test file).
- Low (closed): R-3 now says only the collector/CLI test at `deliver-check.test.mjs:1894` is rewritten and the `prItem` unit tests (`:820`, `:1576`) stay because `prItem` is unchanged. This matches the code.

No ADR conflict: ADR 0001 kept, ADR 0002 gets a note and pointer, ADR 0003 is drafted in full with the owner's answer A recorded.

## 5. Specs review
No spec package, by design (D1); behavior is pinned by the D7 row table and the tests in tasks 1.x and 2.x. Acceptable under the project's precedent.

## 6. Tasks review
Ordered by dependency, tests first, each phase gated with its exact command. Every AC has a task and a way to verify it: AC-1 2.6; AC-2 2.6, 3.2; AC-3 2.5, 2.7, 3.4; AC-4 2.6, 3.3; AC-5 2.6, 2.9; AC-6 2.2, 2.6, 2.9, 2.10; AC-7 1.3, 2.6, 2.9; AC-8 3.7; AC-9 1.5, 2.9, 2.10 plus the Workflow follow-up bullets (owner-accepted R-4, R-10). Post-merge work is plain bullets, so `tasksItem` is not held below 8/8. Suggestion, not a blocker: have the 2.10 smoke on `auto-merge` also assert `archive.changePr.number` is 5.

## 7. Omission detection
Validation, error handling, timeouts, idempotency, rollback, rollout, permissions (no bypass, read back in 3.7), observability and test strategy are covered. Accepted residual risks (R1 contents-API lag, R2 lost checkout, R9 `git switch` over an untracked file) are named with their stop messages. No open omission.

## Execution-readiness and mandatory questions
Major doubts for the next phase: none. Problem defined, result measurable, error behaviors defined, edge cases covered, dependencies and contracts clear, no implicit decision found. Residual late discovery: the dogfood on real GitHub behavior, which is the plan's own AC-9 and has its mitigations (R1, R4, R11).
