<!-- devkit-stage readiness result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Readiness review: review-writer-prompt

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

## 2. Scope validation
Classification: correct. The proposal, the four spec deltas, `design.md` D-1 to D-10 and `tasks.md`
cover the nine acceptance criteria of `requirements.md` and nothing more. The one item beyond
`requirements.md` (the six reviewers' "Staged round" bullet, task 1.5) is flagged for the owner in
`proposal.md` and is droppable without touching another task (D-3 still strips the pasted lines).

## 3. Proposal review
No findings. Problem, non-goals, capabilities (new vs modified), impact, release and the BREAKING
`args.head` are explicit. ADR 0002, 0008 and 0012 are cited with the decisions the change keeps.

## 4. Design review
No findings. Internal claims re-derived against the code at `2300f84`:
- `validateArgs` checks `change`, `changeDir`, `range` and has no `head`
  (`review-round.workflow.js:63-67`); `validateStage1(reviewer, value)` takes two parameters and checks
  `commit` only as 40 hex (`:85`, `:90`); the disposition regex already refuses two shas (`:106`).
- `sections: value.sections` is copied verbatim (`:~120`); `checkFileCommand` checks lines 1 and 2 and
  the blocking or important lines only (`review-round.mjs:124-139`); `outcomesCommand` returns
  `{ outcomes, failed, verifiersFailed }` (`:98-113`); `readStage1` calls `validateStage1` with two
  arguments (`:78`); `NAMES` lists the exported rules (`:11`).
- `staleness(root, recorded, facts)` has no options and uses `isOpenspec` per commit
  (`deliver-check.mjs:193-216`); `readReviews` calls it with no option (`:239-251`); `parseTasks`
  reads every checkbox line (`:270-284`).
- `fencedLines` is a private function of `flow-check.mjs:81` and `countedTasks` uses it (`:99`);
  `flow-check.mjs` already imports from `deliver-check.mjs` (`:11`); `artifactState` has the
  `codeBound` loop (`:404`) where D-7 hooks in.
- The six agent files carry the Stage 1 sentence D-5 replaces (checked in `spec-reviewer.md:72`).
- D-9 targets exist: `SHA2` uses at `review-round.test.mjs:246,381,389,658`; the pin and the roadmap
  line at `change-loop.test.mjs:2473,2482`; the reason-code test at `flow-check.test.mjs:1146`;
  three `v0.18.1` lines in `docs/openspec-flow.md`; the roadmap line `review-writer-prompt` exists.
No generalization in the plan failed on enumeration.

## 5. Specs review
No findings. Every requirement uses SHALL and has WHEN/THEN scenarios. Every decision-table outcome
of D-1 (five checks), D-3 (strip, `check-file` refusal), D-6 (six reviewers, evidence, mixed commit,
uncommitted, other-name reviewer, CI) and D-7 (stale under current header, current, after merge) has a
scenario. `openspec validate review-writer-prompt --strict` passes.

## 6. Tasks review
No findings. Tasks are test-first, ordered, checkboxed, each with a check and a spec-scenario list;
the AC table maps every criterion to tasks, and the three gates are single backticked commands. Gates
run on the base: `review-round.test.mjs` 55/55 pass, `deliver-check` plus `flow-check` tests 957/957
pass (with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set), `scripts/check.py` passes. The `gen-catalog`
check printed nothing on the base (no failure reported). The whole guard suite (3.2, about 13 minutes)
and `claude plugin validate .` were not run here; the tasks mark the suite as long.

## 7. Omission detection
No findings. Validation, refusal paths, idempotency (re-run after a refused reviewer), rollout
(Migration Plan, pin at `v0.19.0`), rollback, compatibility with old verdict files, and test strategy
are covered.

## 8. Execution risks (top 5 failures)
1. Cause: a reviewer lists part of a large remit in `notRead`. Impact: the round refuses twice and
   escalates. Prevention: written in the design risks; the skill re-runs once.
2. Cause: the fixture cascade in `review-round.test.mjs`. Impact: a changed invariant hides. Prevention:
   D-9 lists each edit with its invariant.
3. Cause: D-7 changes a `flow-check` or `change-loop` result when reviewer files are stale under a
   current header. Impact: an existing test goes red. Prevention: phase 3 runs the whole suite.
4. Cause: a security-relevant file under a `fixtures` or `test` folder spares two reviewers. Impact:
   a missed review. Prevention: the owner's fixed pattern, documented in `docs/openspec-flow.md`.
5. Cause: the sibling `roadmap-coordinator-followups` bumps devkit-openspec too. Impact: version
   collision. Prevention: release rebase.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: `design.md` D-1 says `validateStage1` is called "with `run.head`" in the
  Workflow script; confirm during task 1.1 that the script's `run` variable is the validated args
  (it is the one `writeJobs(run, ...)` uses in D-4), so no second name is introduced.

## 11. Explicitly out of scope
- [ ] The panel's own `tasks.md` reader, `guard.mjs#parseRoadmap`, a reason in the review-stage
  `failed` entry, a writer prompt in the Workflow script's result (all named non-goals).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes, nine ids with observable outcomes.
2. Is the result measurable? Yes, each AC has a named test prefix and gate.
3. Are error behaviors defined? Yes: exit 3 without `head`, the exact `invalid(...)` messages, `failed` entries, exit 2 for `check-file`.
4. Are edge cases covered? Yes: padded short sha, declined with empty `read`, indented lines, mixed commits, tilde fences, default-branch tasks.
5. Are dependencies clear? Yes: `merge-setup-field-fixes` archived; the sibling release collision named.
6. Are contracts defined? Yes: args, stage-1 schema, `jobs` shape, header-line regex, `isTestFile` pattern.
7. Can two developers interpret this differently? Not materially; code and prompt text are given verbatim.
8. Are any decisions implicit instead of written? No; alternatives are recorded per decision.
9. Do the tasks fully deliver the intended outcome? Yes, including docs, release and tests.
10. What will be discovered too late? Possibly an existing `flow-check` or `change-loop` fixture reading stale reviewer files (D-7); the phase 3 whole-suite run catches it before review.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Fixture cascade from D-7 and the `args.head` requirement in existing tests.
