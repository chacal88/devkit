# Readiness review: conduct-one-change (round 2)

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate conduct-one-change --strict` and `python3 scripts/check.py` pass (reported by the caller). The three mandatory fixes of round 1 are closed; no new blocker.

## 2. Scope validation
Classification: correct. One change on request, round sweep only behind `round <n>`, the `unfinished` gate, ADR 0007, release 0.10.0. Out of scope is explicit. No spec delta, consistent with D1 and `skip_specs: true`.

## 3. Proposal review
Clear problem and goal. AC-1..AC-9 are identical in proposal.md and requirements.md, and now include the three exit-3 prefixes (AC-2), the `--change` on every call (AC-4) and the create-only-on-`no change` rule (AC-7). Non-goals are tight. No findings.

## 4. Design review
Claims re-derived against live code:
- `compute` (conduct-check.mjs:558) builds `ctx`, `items`, `at` only when the round has unticked lines, returns `{ result, ctx, items, at }`; `conductState`'s watch loop re-evaluates with `at + 1` (line ~600). D2's `roundOf(at)` helper (`null` in single-change mode) and `items = [{ id, after: [], text: null, notes: null }]` close the old M1 gap. The watch early-return (`result.end`, `github.length`) works for one row.
- `parseArgs` (line 620) knows only `--json --round --busy --watch`; `main` (651) turns `UsageError` into exit 3 with `{ version: 2, error }`. Confirmed.
- `evaluate` (436): the no-worktree branch yields `worktree` or `create` (448-); `findWorktree` (140) prefers `chore/archive-<id>`. A worktree found by branch with no folder goes through `planFacts`, so the D3 step-1 check before it is a real addition and is placed correctly. `archived` already has `actorOf` (`none`, line 72) and a `stateOf` case (line 98), so the D3 step-3 row is renderable.
- `backgroundOf` (526) already drops the round line when `result.round` is null and the roadmap line when `c.text` is null, so the single-change `background` is a small, safe addition.
- `locateChange` (deliver-check.mjs:219), `dirtyPaths` (149), `gitFacts` (167), `parseTasks` (270), `nextStep` (957) match the plan. The `--change` id rule equals `locateChange`'s.
- Tests: key-list test at conduct-check.test.mjs:1022; skill pins at guard.test.mjs:1063-1198; README pin at 1202; ADR test at 1219; CI pin at deliver-check.test.mjs:3037. All confirmed; line citations are current.
- Exit-3 disambiguation (D3 step 4) is sound: step 1 catches any worktree by branch, so an active folder found by `locateChange(root, id)` in the checkout means another branch; `no change` therefore guarantees no worktree and no branch, and `git worktree add -b <id>` cannot collide (D5). The worktree-without-a-folder case runs only `openspec new change` (no `git worktree add`).
- The skill today has `--json [--round <n>]` at SKILL.md:16 and the watch at SKILL.md:95; tasks 2.1 rewrites both with `--change <id>`, adds the "bare `conduct-check` is never run" sentence and a pin on the watch line. Existing pins stay valid because the session text is not rewritten.

## 5. Specs review
No spec delta by design. Behaviour is pinned by tests named per AC in tasks.md. Acceptable.

## 6. Tasks review
Every AC id appears in a task; phases 1-3 each end with a `Gate:` task naming the test command (the `parseTasks` rule is met; the follow-up section is checkbox-free). Task 2 is now split into 2.1-2.4 and each is executable with named verification. Task 1.1 is long but unambiguous.

## 7. Omission detection
Rollback (install 0.9.1) and compatibility (additive fields, version 2) are covered. Watch and recompute in single-change mode, exit-3 disambiguation and creation over an existing worktree are covered. No findings.

## 8. Execution risks (top 5 failures)
1. Cause: a continuation turn or Auto-fix wake runs a bare `conduct-check`. Impact: a round sweep. Prevention: D5 states every call carries `--change <id>`, with a pin; keep it as the first thing the dogfood checks.
2. Cause: `unfinished` flags a half-done phase on a typed `/conduct <id>` re-run after a PR wait. Impact: one routine question (accepted in D6).
3. Cause: the CI pin and `unnamedFiles` collide at archive if a retro bumps the pack. Impact: known, handled in Risks and follow-up.
4. Cause: the `/conduct` anchor rename misses a link. Impact: a broken link; 3.2 greps for the old anchor and `scripts/check.py` runs.
5. Cause: `unfinished` adds one `git status` per worktree in round mode. Impact: negligible.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, fix during implementation: in task 1.2 add a test for `chore/archive-<id>` worktree with only an archived folder in single-change mode (the row should be computed as today, not exit 3).

## 11. Explicitly out of scope
- [ ] `ship-change`, the panel, `RELEASE_FILE`, the `apply-proposals` gap (already out of scope in requirements.md).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, AC-1..AC-9 with named tests.
3. Are error behaviors defined? Yes: three exit-3 prefixes, the usage errors, the create flow.
4. Are edge cases covered? Yes, including watch and continuation turns.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes: JSON additions, prefixes as the contract, `version` stays 2.
7. Can two developers interpret this differently? Not materially.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing identified beyond the live dogfood (AC-9), which is planned.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? A continuation or wake turn missing `--change <id>` would sweep the round; it is pinned.
