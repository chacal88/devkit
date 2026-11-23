<!-- devkit-stage readiness result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Readiness review: delivery-models

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Blockers: 0. `openspec validate delivery-models --strict` is valid. Round 2: both blockers of round 1 are closed (section 9).

## 2. Scope validation
Classification: correct. One problem (one PR to the default branch only), three models, the lock, the support branch and the two archives, with tight non-goals (no real GitHub run, no `project-setup`, no base other than the default branch). The owner's escalations (D-2, D-8) and the acceptance of ADR 0015 are named and stay the owner's gate at plan approval (no `approval.md` yet; not a finding here).

## 3. Proposal review
Problem, ten ACs with ids, capabilities and impact (the three files the `devkit-reviews` job downloads, the template) are clear. No findings.

## 4. Design review
Claims re-derived against the code at `2300f84` in this round: `parseShip` (`deliver-check.mjs:63`), `findChangePr` (524), `archiveNext` (960), `ciPreflight` (1514), `runCi` (1552); `plainValue` (`change-loop.mjs:51`), `readDevkitSettings` (63), `openUnderLock` (934); `classify` (`guard.mjs:208`), `guardBash` (495), `mainCheckout` (642, unexported, as the plan says); `rebaseBranch` (`conduct-check.mjs:109`), `listWorktrees` (122). All exist as described. The round-1 derivations stand.
- D-7 now names the settings source: `ciSettingsRef` with S1 (event payload `repository.default_branch`, else `pull_request.base.repo.default_branch`), S2 (`origin/HEAD`), S3 (`origin/<GITHUB_BASE_REF>`, local runs only, the limit stated and documented). `eventPayload` is extracted from `ciPreflight` (D-11), and the template gets `pull-requests: read`.
- `origin/main` (local ref, not fetched) is at `a8cef47` with both siblings merged and plugin versions 0.19.1 / 0.8.1, which matches the plan's next-minor releases (0.20.0 / 0.9.0) and its "merge `origin/main` before phase 1". The branch base does not yet hold ADR 0014 or the siblings' files; that merge is a planned coordinator step, not a gap.
No failed derivations.

## 5. Specs review
Normative language, WHEN/THEN scenarios on every requirement. The round-1 gaps are covered: `delivery-models` has scenarios for T0 (base not default), T1 (task branch holds a test-branch commit), T5 (test PR closed), the resolution deadlock (round 2 rejected), and the three archive stops (test archive PR closed, failing check, cherry-pick conflict, plus the owner finishing it). `reviews-check` has scenarios for the test-branch PR with no model in its own copy and for S1, S2, S3. No findings.

## 6. Tasks review
Ordered by dependency, test first per phase with saved red output, one backticked gate per phase, paths under real directories. Task 3.1/3.4/4.4 now carry S1 to S3 and the no-model row. Gates run on the base: `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` green (coordinator's run 2026-11-22), `openspec validate delivery-models --strict` green. The new-suite gates need code this change writes, and the 13-minute guard suite is task 6.9's run (the caller said so). Low: the AC table lists 6.7 under AC-2 and AC-6 and 6.9 under AC-1 (AC-1's second half is explained; the rest harmless).

## 7. Omission detection
Validation, errors, idempotency, rollback, compatibility, permissions, rollout and test strategy are covered. Low, safe to fix during implementation: T1 reads local `origin/<test>` and the checker never fetches (design line 225 now states the session's last fetch).

## 8. Execution risks (top 5 failures)
1. Cause: `simGitHub` drifts from real `gh` output. Impact: first real use fails. Prevention: listed risk; real run is a later change.
2. Cause: `deliver-check.mjs` grows large. Impact: review cost. Prevention: one headed section.
3. Cause: merge conflicts with the siblings in `change-loop.mjs`, `guard.mjs`, `roadmap-loop.mjs`. Impact: rework. Prevention: merge `origin/main` before phase 1 (planned); the diff to `origin/main` in the hooks is 8 files.
4. Cause: S3 on a local `--ci` run without `origin/HEAD`. Impact: test-branch PR judged by its own older copy. Prevention: documented and accepted in D-7.
5. Cause: a new test passes only without `GITHUB_HEAD_REF`. Impact: red on CI. Prevention: every gate sets both variables (tasks header).

## 9. Mandatory fixes before implementation
None. Closed from round 1:
- [x] Spec scenarios for T0, T1, T5, `stop-review-deadlock` and the archive stops: present in `specs/delivery-models/spec.md`.
- [x] Settings source for a test-branch PR: D-7 `ciSettingsRef` S1 to S3 and the `reviews-check` scenarios.

## 10. Optional improvements (within scope)
- [ ] Tasks AC table: explain or drop 6.7 under AC-2 and AC-6.

## 11. Explicitly out of scope
- [ ] A real two-pull-request run on GitHub (first real use, later change).
- [ ] A base branch other than the default branch (D-2).
- [ ] The owner's two escalations (D-2, D-8) and the ADR 0015 acceptance: the owner's gate at plan approval.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: ten ACs, each with a named test (D-14).
3. Are error behaviors defined? Yes, every blocked and stop row has a scenario.
4. Are edge cases covered? Yes, one test per predicate condition, negatives included.
5. Are dependencies clear? Yes, siblings and the pre-phase merge included.
6. Are contracts defined? Yes: settings shape, source table, step params, messages, JSON keys.
7. Can two developers interpret this differently? No material divergence found.
8. Are any decisions implicit instead of written? None found.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Only real-GitHub behavior (`gh` output shapes), declared out of scope.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan and the two escalations.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Simulated GitHub output differing from the real one at first use.
