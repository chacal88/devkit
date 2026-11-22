<!-- devkit-stage readiness result=passed attempt=1 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Readiness review: merge-setup-field-fixes

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate merge-setup-field-fixes --strict` passes (0 errors). Blockers: 0.

## 2. Scope validation
Classification: correct. Three field items (9, 10, 11), each with a decision (D-1, D-3, D-2), a spec delta and tasks. Non-goals are explicit (design.md Goals / Non-Goals); the archive-PR wait is rejected in writing and left for the owner to widen.

## 3. Proposal review
No findings. Problem, the three defects and the 0.18.0 base are stated; item 10 being unreproducible on the base is raised to the owner in the proposal.

## 4. Design review
Claims re-derived against code at 6e803eb:
- `deliver-check.mjs:1664-1676`: the watch runs only at `wait-checks` (with `state.pr`) and `wait-merge`; the inline args match D-1's `watchChecks` description.
- `deliver-check.mjs:971, 1076`: `stop-merge-setup` is returned in both `nextStep` and `archiveNext`, after the plan-approval stop and before the phases (A-1 holds).
- `deliver-check.mjs:632-660`, `1147`: item 6 carries `details.pending` and `details.required`; `collectState` builds it before `nextStep` (A-2 holds).
- `guard.mjs:176-184`: `readValue` uses a non-global regex, so the first match wins (the base behaviour D-3 relies on).
- Readers of `Verdict` (grep over non-test code): `deliver-check.mjs:246`, `guard.mjs:192`, `conduct-check.mjs:255`; `changes-under-way.mjs` reads `Status` only. This matches the Context table (A-3 holds); the panel has no reader of its own.
- `github-setup.mjs:228-237`: `--checks ""` gives `[]`, which is truthy, so discovery is skipped (A-4 holds); `rulesetItem` line 195 holds the inline `desiredRuleset(...)` that D-2 replaces; `render` line 266 holds the line D-2 replaces.
- Version pins: `docs/openspec-flow.md:554,555,562` hold `v0.18.0`; `contextsOf` is defined at line 142.
No failed re-derivation.

## 5. Specs review
Three deltas (`change-delivery`, `project-setup`, `verdict-files`) use SHALL and WHEN/THEN scenarios. Every outcome of D-1 (watch ends, cap hit, no pending, no PR, no `--watch`), D-2 (the field case, empty discovery, kept checks, JSON plan) and D-3 (both orders per reader) has a scenario. No findings.

## 6. Tasks review
Ordered test-first per phase, each phase ends in a gate or check, the AC table maps every AC to tasks. Test fixtures named in tasks exist in `deliver-check.test.mjs` (`mergeReady` 2222, `presetSetup` 1559, `pendingChecks` 2697, `ciProve` 2974, `ciRepo` 2988, `bothEntries` 3306), and the gate test-name prefixes (`readValue`, `reviewConsensus`, `gh pr create`, `conduct`) exist in `guard.test.mjs` and `conduct-check.test.mjs`. The red runs are checks, not gates, as the flow requires. No Mandatory finding. Gate 3.4 selects every test starting with `conduct` (92), which is slower than needed but correct.

## 7. Omission detection
Validation, error handling, idempotency, rollback (revert PR), compatibility (no JSON field removed), test strategy and evidence are covered. Retries, permissions and migration do not apply (read-only watch; no data).

## 8. Execution risks (top 5 failures)
1. Cause: tests pass locally, fail on CI under `GITHUB_HEAD_REF`. Impact: red PR. Prevention: every gate runs with the variables set (tasks.md header).
2. Cause: item 10 tests pass on the base, so AC-4 has no red run for it. Impact: weak proof. Prevention: `proof/base-10.txt` and the owner's acceptance recorded in the proposal.
3. Cause: the fake `gh` answers `pr checks` identically with and without `--required`. Impact: watch tests cannot tell the arguments apart. Prevention: tests assert the same argument list as the existing watch test.
4. Cause: sibling change bumps devkit-openspec too. Impact: release-file conflict. Prevention: the release rebase.
5. Cause: a watch at `stop-merge-setup` on a PR behind the local head waits on old checks. Impact: wasted wait, no wrong merge. Prevention: state is collected again and item 5 still says push.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low — tasks.md 3.4 — narrow the `^conduct` pattern to the plan-audit tests to shorten the gate.

## 11. Explicitly out of scope
- [ ] A wait at `stop-merge-setup` on the archive pull request (design.md D-1 Alternatives; the owner may widen it at approval).

## 12. Mandatory review questions
1. Yes: three defects, each with a reproduction or a recorded base run.
2. Yes: tests and `proof/` files per item.
3. Yes: failing check, timeout, unreadable discovery are specified.
4. Yes: no PR, no pending, archive PR, empty `--checks`, kept checks.
5. Yes: `coordinator-field-fixes` is archived; ADR 0002, 0008, 0012 cited.
6. Yes: function signatures, the exact line wording and the `requires` JSON field are written.
7. Unlikely: wording and test names are copied from design.md.
8. No implicit decisions found.
9. Yes.
10. Item 10 may prove to have no defect; the plan already handles it.

## 13. Final conclusion
- Can we start? Yes, after the owner's plan approval.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Local-green, CI-red tests; covered by the gate environment.
