# Readiness review: conduct-rounds (round 3)

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate conduct-rounds --strict` passes (re-run here). No open mandatory fix. The owner's change to Open question 1 is applied consistently across requirements, proposal, design and tasks.

## 2. Scope validation
Classification: correct. The owner's answers (Open question 1 changed to "always ask"; 2 and 3 confirmed) change behavior inside existing scope: no new component, and every AC-1..AC-13 id still appears in a task.

## 3. Proposal review
AC-1 and AC-4 (proposal.md:25,28; requirements.md:89-102) agree with each other and with design D6: every proposed schema, `devkit-lite` included, is confirmed by the owner as the change's first question, and a `devkit-lite` change then reaches its first `implement` with no further owner question. The "Schema per change" and "Go-ahead for devkit-lite" assumptions were reworded.

## 4. Design review
Re-derived for this round:
- D6 rows C1 (`create`) and C2 (`new-change`) are askable owner rows with `proposedSchema` and `reason`; the schema is created only after the answer, so `.openspec.yaml` records it and a resumed run does not ask again for an existing folder. The two lost-answer windows (killed before `git worktree add`, or before `openspec new change`) are named and accepted. P-1 does not ask the schema again for `devkit`.
- D10 `owner` lists `create` and `new-change`; D4's "none of the above" row, D14 (Start, Planning rows, go-ahead) and risk R11 are consistent with it. The JSON example still carries `schema`. The ADR 0005 draft is not affected (owner gates stay in the owner's session).
- Behavior of the unchanged rows still matches live code (`nextStep` order at `deliver-check.mjs:941-1028`, `writeViolation` gate rule, `RELEASE_FILE`). Round-2 closures (D9 override 2, D11 sides, D17) are untouched.
- Cosmetic leftovers, not blocking: D6 intro says "Rows P-5 to P-8" while the table ends at P-5; D17 names the other change's branch `claude/devkit-opt-in-37291e`, the local branch is `devkit-opt-in`.

## 5. Specs review
No spec delta by design (`skip_specs: true`; no `openspec/specs/` in this repo).

## 6. Tasks review
Task 2.3 tests the askable `create`/`new-change` rows with `proposedSchema` and `reason`, the keyword proposal, the no-`text` default of `devkit`, and that a `devkit-lite` change has no `grill` or `approve` row after creation (AC-1, AC-4). Task 4.1 pins the schema question asked before `git worktree add` and the "after that answer, invoking `/conduct` is the go-ahead" sentence. Phase 2 remains one large run (size risk only).

## 7. Omission detection
No open gaps for the next phase.

## 8. Execution risks (top 5 failures)
1. Runtime tools differ from assumption (cron, background subagents, hook cwd). Impact: D12/D14 rework in phase 4. Prevention: the smoke precondition in task 4.1 and the foreground-batch fallback.
2. `devkit-opt-in` merges first and the overlapping edits in `guard.mjs`/`guard.test.mjs` conflict. Impact: manual merge. Prevention: D17 rules and task 4.0.
3. Phase 2 is too large for one `tdd-implementer` run. Impact: partial phase, resumed by the unticked tasks. Prevention: the phase gate and resume rule; consider splitting if it stalls.
4. The first real release conflict happens only in the dogfood. Impact: late discovery. Prevention: the real-input smoke in task 3.3 and the six task 2.6 cases.
5. Parallel steps hit git ref locks on one `.git`. Impact: transient step failure. Prevention: one retry (R4), only the main session fetches.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Correct the other change's branch name in design.md D17 to `devkit-opt-in`, and "P-5 to P-8" in D6 to "P-5".
- [ ] Consider splitting phase 2 into two phases with their own gates.

## 11. Explicitly out of scope
- [ ] A `deliver-check` or CI check for `approval.md` and for `after:`; resolving conflicts outside release files; the `commit-and-pr` trailer fix (a round-5 change).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes; AC-1..AC-13 are observable.
3. Are error behaviors defined? Yes, per row, including the rewritten-branch sequence and the manifest-edit abort.
4. Are edge cases covered? Yes (resume, foreign push, stale reviews, prunable worktrees, auto-merge on).
5. Are dependencies clear? Yes, including the parallel `devkit-opt-in` change (D17).
6. Are contracts defined? Yes (D2 JSON, D6/D8/D9 tables, D7 `approval.md`, D11 functions and CLI).
7. Can two developers interpret this differently? Not materially; the rebase sides and the push order are now explicit.
8. Are any decisions implicit instead of written? No; the three Open Questions are answered and recorded in design.md.
9. Do the tasks fully deliver the intended outcome? Yes; AC-13 is delivered by the post-merge bullets, as in the archive-after-merge precedent.
10. What will be discovered too late if implementation starts now? Runtime differences in cron, background subagents and hook cwd; task 4.1 makes them surface before the skill is written.

## 13. Final conclusion
- Can we start? Yes. Product code stays closed until the owner's own message approves the plan and the main session writes `approval.md` (tasks Workflow follow-up).
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Phase 2 size and the runtime assumptions.
