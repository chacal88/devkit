<!-- devkit-stage readiness result=passed attempt=4 commit=36423baa91daa799f6074c29090e56511fe9e5b8 -->
# Readiness review: helper-conductor

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes, after the two gates `tasks.md` already names (task 1.4 and the owner's approval of this revision)

Round 4, on 56502a1 and 36423ba (the plan headers). `openspec validate helper-conductor --strict` passes. Round 3's two findings are fixed and no new blocker was found. No fetch was run; the base stays `6f03a57`.

## 2. Scope validation
Classification: correct. The fixes added scenarios, citations and one task note only; scope did not change.

## 3. Proposal review
Consistent with the design and the specs; the citation of `requirements.md` reads "attempt 7", the header's attempt.

## 4. Design review
Re-derived against the code:
- `deliver-check.mjs:246` is `listWorktrees` and `:788` is `prFiles`, as D-3 and D-25 now say.
- D-21's table (`design.md:986-993`) has six outcome rows; each has a scenario (section 5).
- The ADR citation "ADR 0020 decision 3" matches `docs/adr/0020*.md:37` (the fewest open changes).
No failed re-derivation.

## 5. Specs review
Round 3's findings, re-checked in `specs/roadmap-conductor/spec.md`:
- D-21 rows: "A departed train with its checks running" (`:398`), "A merged train" (`:402`), "A change that leaves the train on a conflict" (`:406`), with "One change boards", "A train that needs the owner" and "A red train" for the other rows. All six rows have a scenario.
- D-5's `--after task=refused`: "The app refuses the task" (`:42-45`), with the reply `roadmap-no-task` that `design.md:320` and `:542` define.

## 6. Tasks review
Unchanged in substance. The new note at the head of phase 4 orders the merge of `origin/main` before task 4.1 and before the delivery, with the re-read of `openspec/config.yaml` and the edit of the "has merged nothing yet" header in the same commit (CLAUDE.md). `release.md` exists and reads; no task bumps a version, edits a CHANGELOG line or numbers the record; `decisions.md` lists `docs/adr/helper-conductor.md` unnumbered.

## 7. Omission detection
No findings.

## 8. Execution risks (top 5 failures)
1. A blocked firing still reaches the model, or the hook's note does not reach the session. Prevention: task 3.6 before phase 4, with its stop-and-revise cases.
2. A tick's session ends its turn mid-drive and the claim goes stale. Prevention: D-11's stop rule and the takeover.
3. The hook's file-only facts differ from the tick's git-based facts. Prevention: D-15's test on one fixture.
4. A test outside D-15's rows pins removed text. Prevention: the grep-first rule and the phase 5 gate.
5. `scripts/test-map.json` out of step with new modules. Prevention: each task names its map edit.

## 9. Mandatory fixes before implementation
None open. Round 3's High and Medium findings are closed (section 5).

## 10. Optional improvements (within scope)
- [ ] Fix during implementation: `origin/main` has moved (train 22 touched `review-change/SKILL.md` and `review-round.*`); the phase 4 note already orders the merge before task 4.1.
- [ ] Task 2.1 prunes `occupied` to the open ids before `placeDecision` (round 2's Medium), as `tasks.md` states.

## 11. Explicitly out of scope
- [ ] The CompozyOS driver, `multi-roadmaps` parsing, starting work over SSH, a phone channel beyond the host's notification tool.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes; each of the 22 ACs maps to a task and a test prefix or a `proof/` file.
3. Are error behaviors defined? Yes, including the refused task and the train's ends.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes (`multi-roadmaps`, task 1.4, the owner's approval).
6. Are contracts defined? Yes: run file shape, hook note, verbs, ledger.
7. Can two developers interpret this differently? Not on the points checked.
8. Are any decisions implicit? The cron and the notification tool wait for task 3.6, written as such.
9. Do the tasks fully deliver the outcome? Yes.
10. What will be discovered too late? A hook that does not block before the model, which task 3.6 finds before phase 4.

## 13. Final conclusion
- Can we start? Yes, once task 1.4 and the owner's approval of the revision are recorded.
- What must be fixed? Nothing.
- Main risk if ignored? Host behaviour of the prompt hook (task 3.6).
