Verdict: rejected
Commit: 643bc4765052e251d8e0412d3247a28d7da2d555

## Quality review — review-writer-prompt (round 1)

### Findings
- [important] plugins/openspec/hooks/deliver-check.mjs:parseTasks (fencedLines use) — An unclosed fence hides every later task and gate from the delivery checker, so item 1 can pass with unticked tasks; reproduced: parseTasks of a tasks.md with an unclosed ``` before '- [ ] 1.2' returns only 1.1. design.md D-8 does not decide this case, and no test covers it.
- [nit] plugins/openspec/hooks/deliver-check.mjs:staleness (dirtyPaths) — An uncommitted test-file edit still stales the four spared reviewers through facts.dirty; design.md D-6 chooses this deliberately (dirty is judged against openspec/ and .claude/ only), but docs/openspec-flow.md does not say so.
- [nit] plugins/openspec/hooks/deliver-check.mjs:isTestFile — A folder named 'fixtures' or 'test' counts as test files for the four spared reviewers even where it holds product data; D-6 declares a fixed pattern, so this is a known trade-off.
- [praise] plugins/core/skills/review-change/scripts/review-round.workflow.js:writeJobs — One writeJobs function feeds both the workflow and the CLI outcomes command; the AC-1 test compares the CLI jobs to the workflow write calls, so the paths cannot drift.
- [praise] plugins/core/skills/review-change/scripts/review-round.workflow.js:validateStage1 — The head, partial-review and header-line rules sit in the shared rules section and fail the review stage with a diagnosable message; the AC-4 and AC-5 tests run each case on the CLI and on the workflow, and check there is no verifier or writer after a failure.
- [praise] plugins/openspec/hooks/deliver-check.mjs:fencedLines — The fence helper moved to the lower module with no copy left in flow-check, and a source test pins the import.
- [nit] plugins/openspec/hooks/flow-check.test.mjs: 'a commit of test files only after the review makes the review stage stale' — This test passes through the header staleness alone (design.md D-7 says so), so it does not exercise the new staleReviewers path; the second AC-8 test does. Rename it, or add a case where the header is current.
- [nit] plugins/openspec/hooks/deliver-check.test.mjs:4916-4960 — The AC-9 tests cover backtick and tilde fences, a closing fence and a fenced heading, but no unclosed fence (see F1) and no CRLF tasks.md, which D-8 says gives the same line numbers.
- [praise] plugins/openspec/hooks/deliver-check.test.mjs:AC-8 tests — The tests cover the mixed commit, a later product commit, an uncommitted edit, a reviewer outside the six, the evidence going stale first, and the CI entry through bothEntries.

### Files read
The diffs of every changed file of `main...HEAD` were read, in pieces: `review-round.mjs`, `review-round.workflow.js`, `review-round.test.mjs` (all of it), `deliver-check.mjs`, `deliver-check.test.mjs`, `flow-check.mjs`, `flow-check.test.mjs`, `change-loop.test.mjs`, the six reviewer agent files, `review-change/SKILL.md` (all of it), `ship-change/SKILL.md`, `CHANGELOG.md`, `marketplace.json` and both plugin.json files, and `docs/openspec-flow.md` (the changed hunks; a few long lines were cut at 900 characters). Also read: `tasks.md`, `evidence.md` and the decisions of `design.md` (Goals and Non-Goals, D-6, D-7, D-8, Decisions and ADRs; D-1 to D-5 and D-9 to D-10 only through `tasks.md`).

Not read: the spec deltas, `proposal.md`, `readiness.md` and `requirements.md`. The guard suite was not run, as instructed; `evidence.md` records 1183 of 1183 green at this commit.

### Notes on the new reading
- The SKILL.md, flow document, ship-change and CHANGELOG text agree with the code: `args.head` is filled from `git rev-parse HEAD`, the check-file rule is named, the staleness rule names the four spared reviewers, and the CI pin moves to v0.19.0. The change-loop test edits match D-9 (the pin, and the roadmap line found ticked or not).
- The fixture edits in `review-round.test.mjs` only add `head`, `read` and `notRead`, drop `{ commit: SHA2 }` where the head rule forces it, and pass the head to each validateStage1 call. This matches D-9.
- One real defect remains, F1.

### Summary
- 9 findings (0 blocking, 1 important, 4 nit) + 4 praise
- Justification: the stage-1 checks, the writer jobs and the scoped staleness match design.md and evidence.md, and the tests cover the declared variants on both paths. F1 is not a decision of D-8 and it weakens the delivery gate: a stray unclosed fence in tasks.md makes every later task and gate invisible, and item 1 can pass. The fix is to make an unclosed fence hide nothing, or make the checker refuse it, with a test. Without a fix or an evidence-backed contest the verdict is rejected.
