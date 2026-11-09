# Readiness review: auto-merge

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 1 of this review. `openspec validate auto-merge --strict` passes (only the INFO that `skip_specs` is set). Owner acceptance of R-1..R-11 is recorded in `requirements.md:126-150`. No finding is `Mandatory before implementation`.

## 2. Scope validation
Classification: correct. The problem (merge by GitHub in opted-in repos, gated by a CI check that sees stale reviews) is justified in `proposal.md` Why. Out of scope is explicit (`requirements.md:98-104`, `proposal.md` Non-goals). The design adds `update-branch` (D6 row 15a) and row 17a for all modes; both are justified (R-6, R-7, owner-accepted) and do not widen scope beyond the strict rule the owner chose.

## 3. Proposal review
Problem, goal, new vs modified capabilities (none, `skip_specs`), impact per pack, exit criteria and non-goals are explicit. About 1,070 words, borderline against the "under two pages" rule in `openspec/config.yaml`, not worth a revision (Low).

## 4. Design review
Claims about internals re-derived against live code. All hold:
- `SHIP_MODES = ['plan','pr']` at `deliver-check.mjs:15`; `setMode` rejects `merge` at `:46-48`; `nextStep` row 1 tests `state.ship !== 'pr'` at `:607`.
- `prItem` blocks any state but OPEN at `:418`; `PR_FIELDS` at `:386` lacks `autoMergeRequest` and `mergeStateStatus`.
- `guard.mjs ci` at `:392-407` uses `prViolation` (`:266-276`) and `reviewConsensus` (`:139-148`), which read verdict values only; `readReviews`/`staleness` in `deliver-check.mjs:162-198` do apply the `Commit:` rule.
- `guard.mjs:257` refuses only `gh pr merge --admin`. `commit-and-pr.md:10` and the Never line say it never merges. `review-change/SKILL.md:150` says the merge is the human's. `plugins/core/README.md:27` says "Never merges".
- `.github/workflows/ci.yml`: workflow `ci`, job `check` with no `name:`, so the check name is `check` (R-1 correct).
- `docs/openspec-flow.md:224-245` holds the `guard.mjs ci` snippet pinned to `v0.4.0`; tags in the repo are only `v0.1.0` and `v0.2.0` (R-10 correct).
- `main()` already returns `{ code, stdout, stderr }` and the module is guarded by `isMain()`, so the new `ciMain` and the dynamic import from `guard.mjs` fit with no load-time cycle. `ciMain` does not exist yet; it is new work in task 1.3.
- `resolveChange` semantics (tail, then contained, then single) match D5 steps 2 and 4.

The GitHub API shapes in D4 and D8 (`rules/branches/<b>`, ruleset payload with `~DEFAULT_BRANCH`, `required_status_checks`, `non_fast_forward`, `do_not_enforce_on_create`) match the documented fields. The bootstrap problem (a required check that never reports) is handled by the D8 ordering guard. Rollback is written (Migration Plan). ADR 0002 is drafted in D10 as the config rule requires; ADR 0001 is respected (state read from GitHub each run, no state file).

## 5. Specs review
No spec delta, deliberately: `skip_specs: true`, precedent in the two archived rounds, reasoning in D1. Behavior is pinned by named tests in tasks 1.1-2.7, 3.1-3.3 and 4.2. The one weakness of the precedent is unchanged: nothing is pinned outside tests (Nice to have, not a blocker).

## 6. Tasks review
- Five phases, each ends with a gate task naming the test command (1.8, 2.10, 3.8, 4.6, 5.5), as the config rule requires.
- AC-1..AC-11 each appear in at least one task. AC-10 is covered by 5.1-5.3, the Workflow follow-up and R-5 (the merge itself goes to `retro.md`, owner-accepted).
- Tests come first in each behavior task. Retro lessons are applied: smoke runs on real input (1.6, 2.9, 3.7), the stop paths go through the real collector (2.5), and the cross-pack format is pinned on the producer's text (1.5).
- Every task path falls under a real directory (`plugins/openspec/skills/openspec-setup/scripts/` and `.github/workflows/` exist).
- Dependency order is clear. Phase 5 runs in the main session because each GitHub change needs the owner's answer, and it writes only under `openspec/`, so review `Commit:` lines stay current.
- `.github/workflows/ci.yml` needs no edit: `guard.test.mjs` imports the new test files and the `check` job already sets the git identity the tests use.

## 7. Omission detection
Validation, error handling (fail closed, exit codes, messages), idempotency (AC-7), permissions (read-only token, no `pull_request_target`, no secrets), rollback, compatibility (plan/pr JSON byte-identical, pinned by a test) and test strategy are defined. Observability beyond the summary lines is not needed. No findings.

## 8. Execution risks (top 5 failures)
1. Cause: after an immediate `gh pr merge --auto`, the next `deliver-check` reads the PR with `gh pr view` and no number (D6 Assumptions, row 4). Impact: if the branch is gone or the PR is not found, row 0a never matches and the run reports `open-pr` or item 5 open. Prevention: have `collectState` pass the PR number it already knows (`--watch` does); the plan names this fallback but no task pins it. Add a test during task 2.3/2.6.
2. Cause: `guard.mjs ci` used to exit 0 with "nothing to check" when there is no `openspec/` and used 1/0 only, while `--ci` exits 3 there (D5). Impact: a consumer that bumps the tag in a repo without `openspec/` newly fails. Prevention: decide in task 1.4 whether `guard.mjs ci` keeps exit 0 for that case; list it in the CHANGELOG line.
3. Cause: the docs snippet replacement (task 1.7) drops the existing `openspec validate --all --strict` step. Impact: consumers lose that validation in CI silently. Prevention: keep the step in the new workflow text or say it is dropped.
4. Cause: the `rules/branches` response differs from the fixtures (evaluate-mode rules, org rulesets), R6. Impact: false `ok` or false missing. Prevention: smoke 2.9 and 3.7 on the real repository, already planned.
5. Cause: the owner locked out of direct pushes to `main` (R9) before round 3's bypass. Impact: an archive or hotfix needs a PR. Prevention: stated before confirmation (5.1) and in CONTRIBUTING.md (4.3).

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, Fix during implementation: `tasks.md` 1.4: state the exit code of `guard.mjs ci` when there is no `openspec/` (see risk 2).
- [ ] Medium, Fix during implementation: `tasks.md` 2.3 or 2.6: add a test that `collectState` keeps working after the PR is MERGED and the branch or checkout changed, by using the PR number (see risk 1).
- [ ] Low, Fix during implementation: `tasks.md` 1.7: keep or drop `openspec validate --all --strict` explicitly in the replacement CI snippet.
- [ ] Low: `proposal.md` is near the two-page rule; no action needed.

## 11. Explicitly out of scope
- [ ] Archive after merge, the post-merge Action, the ruleset bypass (round 3); `conduct` (round 4); conflict resolution; a hook veto of `gh pr merge`; organization-level required workflows; merge queue.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: `proposal.md` Why and `requirements.md` Request.
2. Is the result measurable? Yes: AC-1..AC-11, each with a test, a command or a recorded read-back. AC-10's merge is proven after the fact (R-5, accepted).
3. Are error behaviors defined? Yes: exit 3 messages for config and checkout, fail closed on `gh` errors, `stop-merge-setup`, `blocked: item 6`, write errors per item.
4. Are edge cases covered? Yes: push after enabling, BEHIND, squash-merged unarchived change, shallow clone, merge-ref checkout, immediate merge, bootstrap ordering, idempotent re-run.
5. Are dependencies clear? Yes: the Dependencies section, gh 2.88.1 features, admin rights for phase 5.
6. Are contracts defined? Yes: next-step rows, `merge` JSON object, `--ci` JSON and output, ruleset payload, workflow YAML, ADR text.
7. Can two developers interpret this differently? Little. Residual ambiguity is the points in section 10.
8. Are any decisions implicit instead of written? No material ones; R-1..R-11 are written and accepted.
9. Do the tasks fully deliver the intended outcome? Yes, with the merge itself and the tag handled in the Workflow follow-up.
10. What will be discovered too late? Real GitHub API behavior (rules response, `gh pr merge --auto` immediate-merge side effects); the plan front-loads smoke runs against the real repository for this.

## 13. Final conclusion
- Can we start? Yes. Dispatch phase 1 to `tdd-implementer`.
- What must be fixed? Nothing before implementation; take the three section 10 items during phases 1 and 2.
- Main risk if ignored? Risk 1 would leave the run unable to report `merged` after an immediate merge, which is the dogfood's final step.
