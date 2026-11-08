# Readiness review: ship-modes (round 3)

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate ship-modes --strict` passes (INFO only: `skip_specs` set). Round 2's blocker is closed: the owner's decision is recorded and the artifacts agree. Nothing mandatory is open.

## 2. Scope validation
Classification: correct

Scope and out-of-scope are unchanged and explicit (`requirements.md:109-116`, `proposal.md:23`). The item 7 carve-out is now part of the owner's own requirement text, not a design-only interpretation.

## 3. Proposal review
No findings. The 12 ACs in `proposal.md:27-38` still match the requirements. The proposal does not detail item 7, so the bot rule creates no inconsistency there.

## 4. Design review
Round 2 blocker re-checked:

- `requirements.md:57-60` item 7 now reads: every review thread and outstanding "changes requested" review, from people or bots, answered or resolved. People's top-level comments count too. Bots' top-level comments and review bodies that request nothing do not.
- `requirements.md:162-165` records owner decision 13, dated and attributed to readiness round 2. It repeats the rule and says the skill never posts acknowledgements to bots.
- `design.md:96` and `design.md:99` implement the rule. Threads and `CHANGES_REQUESTED` count for bots and people. Bot top-level comments and review bodies are ignored, found by `author.__typename`. `design.md:99` now cites decisions 6 and 13 instead of claiming earlier acceptance.
- `design.md:216` (the `answer` step), `design.md:367` (R6) and `design.md:398` (Open Questions, which now says the rule went to the owner after round 2) match.
- `tasks.md:23` has tests for each branch: person comment, bot top-level ignored, bot thread, bot `CHANGES_REQUESTED`. `tasks.md:39` and `tasks.md:40` put the rule into the skill and into `docs/openspec-flow.md`.

All earlier round-1 and round-2 verifications of code claims still hold (`guard.mjs` cites, `tdd-implementer.md:12,22,55-60`, `commit-and-pr.md:41,59-69`, `review-change/SKILL.md:27,51-52,88-92,109,125`, gate convention in both schema files, `gh` 2.88.1 flags). The revisions since then touched only planning files; no product code changed (`git status` shows only untracked planning files).

The round-1 fixes (deadlock row, review rounds across calls, precondition-3 statement, README order, versions, the all-modes note on `tdd-implementer`) are present and consistent.

## 5. Specs review
No findings. `skip_specs: true` holds, and behavior is pinned by `deliver-check.test.mjs`.

## 6. Tasks review
No findings. Four phases, tests first, gate tasks in the schema's format, and every AC has a task (AC-1 in 1.4 and 2.5, AC-2 in 2.6, AC-3 in 2.5, AC-4 in 2.5 and 3.7, AC-5 in 2.5 and 2.6, AC-6 and AC-10 in 2.7, AC-7 in 1.5 and 2.5, AC-8 in 2.5, AC-9 in 2.8 and 3.7, AC-11 in 4.1 to 4.3, AC-12 in 1.2 and 4.5).

## 7. Omission detection
No findings. Validation, error handling, retries, permissions, observability, rollback, compatibility and resume are all defined (see round 1).

## 8. Execution risks (top 5 failures)
1. Cause: AC-2 and AC-9 live behavior depends on the desktop app's Auto-fix. Impact: proven at the logic level only; the plan says so (`tasks.md:55-56`). Prevention: the optional live run at `tasks.md:56`.
2. Cause: `gh` or GraphQL output shape changes. Impact: the item turns `blocked`, never `met`. Prevention: fail-closed rule at `design.md:101`.
3. Cause: fix loops make reviews and evidence stale on each commit. Impact: cost. Prevention: caps and scoped re-review (R3).
4. Cause: `isMain` misdetects in `guard.mjs`. Impact: the gate stops running. Prevention: spawn tests plus a symlink test (R1, task 1.1).
5. Cause: a bot top-level comment that does request something is ignored, because the checker cannot tell. Impact: `ready` reported over it. Prevention: see section 10.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low — `requirements.md:58-60` says bots' top-level comments "that request nothing" do not count, while `design.md:96` ignores all bot top-level comments, because the checker cannot judge intent. Say in `docs/openspec-flow.md` (task 3.8) that the rule is by author type, so a bot that wants a change should use an inline thread or a "changes requested" review. This is a documentation sentence, not a behavior change.

## 11. Explicitly out of scope
- [ ] The `merge` mode, the CI check, `openspec-setup` GitHub setup (round 2); the archive Action (round 3); `conduct` (round 4); live proof of Auto-fix wake-ups.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, eight items and 12 ACs.
3. Are error behaviors defined? Yes.
4. Are edge cases covered? Yes. Decoys, merge commits, symlinks, stale and rejected reviews, bots.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes. `Commit:` line, dispositions, evidence tables, JSON version 1, exit codes.
7. Can two developers interpret this differently? Not on anything that changes behavior. The one nuance is the Low note above.
8. Are any decisions implicit instead of written? No. The owner's decisions 1 to 13 are written.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Only what needs the app: Auto-fix behavior, which is acknowledged and optional to prove live.

## 13. Final conclusion
- Can we start? Yes. Phase 1 may begin.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Editing any planning artifact after this approval makes it stale; dispatch this review again if that happens.
