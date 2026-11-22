<!-- devkit-stage readiness result=passed attempt=2 commit=643bc4765052e251d8e0412d3247a28d7da2d555 -->
# Readiness review: review-writer-prompt

Round 2. Scope: the revision made after review round 1 (phase 4, D-8's unclosed-fence rule, three new scenarios in `specs/change-delivery/spec.md`). Phases 1 to 3 are implemented and were approved in round 1 of this review.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes (phase 4)

## 2. Scope validation
Classification: correct. The revision only closes the finding of review.md round 1 (an unclosed fence hides later tasks) inside AC-9. It adds no reason code or step, as the Non-Goals require.

## 3. Proposal review
No findings. The revision does not touch the proposal.

## 4. Design review
Claims re-derived against live code:
- `fencedLines` is at `plugins/openspec/hooks/deliver-check.mjs:283-297`, exported, with the scan D-8 describes (single `open` state, the closing rule "same character, at least as long"). The rule "remove the opening line and every line added after it, resume at the line after the opening line" is well defined and terminates, because each resume advances at least one line.
- Mixed cases hold: a `~~~` block inside an unclosed backtick fence is re-read after the resume and hides its own lines when it closes; a text whose fences all close takes no new path, so every earlier result is unchanged.
- `parseTasks` (`deliver-check.mjs:301-313`) and `flow-check.mjs:81` (`countedTasks`) both call `fencedLines`, so one edit covers both checkers, as D-8 says. `flow-check.mjs:11` imports it.
- The reproduction of review round 1 matches the code: with the current scan, an unclosed fence puts every later line in `inside`.
- D-8's rejected alternatives (CommonMark "runs to the end", a new reason code) are stated with reasons. The decision is the owner's and is written with its date.
- Other callers of `parseTasks` (`conduct-check.mjs`, `changes-under-way.mjs`) are left to the verify stage, as the caller said; the change is a narrowing of what is hidden, so they can only see more tasks.

## 5. Specs review
Three new scenarios, each with WHEN/THEN, and each outcome of the D-8 rule has one: the rule itself, the counted task and gate, and the next step. `openspec validate review-writer-prompt --strict` passes. The third scenario's WHEN ("the plan is approved or a task is ticked") is a correct reading of the existing `stop-plan-approval` and "started exemption" tests (`deliver-check.test.mjs:1680`, `:1701`): the fixture text of the scenario has `- [x] 1.1`, so `nextStep` returns `implement` without an `approval.md`. The scenario's `planRepo({ tasks })` use is therefore sound.

## 6. Tasks review
- 4.1 (red half), 4.2 (the change), 4.3 (gate) are ordered, test first, each with a check command. The code each task names exists.
- The red-half claim "the six earlier AC-9 tests pass" is true on the base: I ran the 4.1 command with the AC-9 pattern on the code of phase 3 and got 6 pass, 0 fail. `python3 scripts/check.py` is green on the base. The 4.3 gate was not run in full (the caller runs the long suites); no part of it is known red.
- The new tests of D-8 fail on the phase 3 code (an unclosed fence hides the later lines), so the red half is real.
- Only `fencedLines` changes, and the task keeps both regular-expression literals of `parseTasks` byte-identical, which protects the panel parity check.
- Minor: D-8's `pendingTasks` test says "OpenSpec's list for the same text" without the line numbers; the implementer derives them from the text (lines of the two checkboxes), which does not change behavior.

## 7. Omission detection
No findings. Validation, error handling and idempotency do not apply (a pure function over text). Compatibility with texts whose fences all close is stated and tested by the existing tests that 4.2 and 4.3 re-run. Rollout rides the release already planned in phase 3.

## 8. Execution risks (top 5 failures)
1. Cause: the resume re-scan makes a stray fence line inside prose hide nothing, while a real example fence after it opens at the wrong parity. Impact: an example checkbox counted. Prevention: D-8 accepts this as the safe side and the tests cover a closed fence after the unclosed one.
2. Cause: `conduct-check.mjs` or `changes-under-way.mjs` tests assert counts on a text with an unclosed fence. Impact: a red full suite. Prevention: the verify stage re-runs the 3.2 gate.
3. Cause: the implementer edits a `parseTasks` literal while touching nearby code. Impact: the panel parity check fails. Prevention: 4.2 forbids it and runs `python3 scripts/check.py`.
4. Cause: quadratic re-scan on a very long unclosed text. Impact: none in practice (tasks.md is small).
5. Cause: the new tests are named outside the `review-writer-prompt AC-9 ` prefix. Impact: the 4.1 red-half pattern misses them. Prevention: 4.1 names the prefix.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: give the line numbers of the two checkboxes in D-8's `pendingTasks` test so no one derives them.

## 11. Explicitly out of scope
- [ ] Reporting an unclosed fence as a finding (rejected in D-8; needs a new reason code).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: an unclosed fence hides later tasks, reproduced in review.md.
2. Is the result measurable? Yes: the three scenarios and the AC-9 tests.
3. Are error behaviors defined? Yes: the unclosed fence is not an error, it hides nothing.
4. Are edge cases covered? Yes: unclosed then closed fence, tilde inside backtick, texts whose fences all close.
5. Are dependencies clear? Yes: 4.1, then 4.2, then 4.3.
6. Are contracts defined? Yes: the `fencedLines` rule and its comment sentence.
7. Can two developers interpret this differently? Not in a way that changes behavior.
8. Are any decisions implicit instead of written? No: the owner's rule and its alternatives are in D-8.
9. Do the tasks fully deliver the intended outcome? Yes for AC-9.
10. What will be discovered too late? Only a count assertion in a caller other than the two checkers; the verify stage covers it.

## 13. Final conclusion
- Can we start? Yes, with phase 4.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? The delivery checker passing with unticked tasks behind an unclosed fence.
