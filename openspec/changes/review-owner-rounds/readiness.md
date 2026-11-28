<!-- devkit-stage readiness result=passed attempt=3 commit=7d449663c6de29472c5424b7b6367a0e01ff5207 -->
# Readiness review: review-owner-rounds

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes (phase 3; phases 1 and 2 are implemented and uncommitted in the tree)

Attempt 3 reviews the revision that moves the owner's line into a backtick span. The defect it fixes is real and its fix is fully specified.

## 2. Scope validation
Classification: correct. The revision touches only the line's form (D-3) and what pins it; the five ACs, the non-goals and the delivered half are unchanged. `check.py` is explicitly not edited.

## 3. Proposal review
No findings. `openspec validate review-owner-rounds --strict` passes. `release.md` is present and readable (two `patch` packs, title, body quoting the new form), no task bumps a version or numbers an ADR, and `decisions.md` still records that no ADR is needed. `proposal.md:31` and the spec delta (`specs/review-round/spec.md:99-110`) state the same literal as D-3.

## 4. Design review
Claims re-derived against the code:
- `scripts/check.py:86-100` (`check_language`) blanks fenced blocks and then every single-backtick span before matching the Portuguese word list, so a line whose words sit in a backtick span passes. That is the mechanism D-3 relies on. The plain-quoted line of attempt 2 fails it, as the plan says (`proof/rr2-review.md:11` and `:35` hold plain Portuguese today).
- `review-round.workflow.js:93` holds the attempt-2 `ownerLine` (plain quotes, no backtick replacement). Task 3.2 changes exactly it. D-3's expression (collapse spaces, trim, replace each backtick by `'`) keeps the span from closing early, and the span never starts or ends with a space.
- The old-form literals are exactly those the D-6 attempt-3 table lists: a grep for `Owner's words for round` finds `review-round.test.mjs:1377, 1384, 1388, 1396, 1398, 1501, 1516`, `deliver-check.test.mjs:3591`, `SKILL.md:128` and `review-round.workflow.js:93`. Each is in the table or in tasks 3.2 and 3.3; `ship-change/SKILL.md` and `docs/openspec-flow.md` carry no literal, as the plan states.
- The scratch fixture `/var/tmp/devkit-ror/fixture.mjs` exists; phase 3 builds it again with backticks in the resolution words (D-8).

## 5. Specs review
No findings. The delta carries the backtick scenario (words with a backtick print each as `'` inside the span) beside the round-3 scenario, and every D-1 to D-3 outcome row has a scenario.

## 6. Tasks review
Phase 3 (3.1 to 3.7) is ordered test first, then code, then text, then the by-name run, the conductor's re-run, validation and the gate. Each check is an executable command with an expected result: 3.1 requires assertion failures and no syntax error; the `grep -c` counts in 3.5 (1, 1 and 2 owner's lines in `rr1`, `rr5` and `rr2`) match the rounds each run holds; the `grep -v` check finds no plain-quoted line once 3.2 and 3.3 land. Every AC appears in a task. Task 2.4 is deliberately ticked with 3.7. No task adds or moves a test file, so `scripts/test-map.json` stays as is. No task bumps a version.

## 7. Omissions
No findings. A backtick inside the words (the one new edge) has a rule, a test case and a spec scenario. Blank words, refusals and legacy rounds are covered as in attempt 2.

## 8. Execution-readiness and top 5 production risks
No open doubt for phase 3.
1. A double-backtick span in the SKILL.md clause is mis-split by `check.py`'s span regex. Impact: a language-check false positive. Prevention: the clause is English except placeholders, and 3.3 plus the gate run `check.py`.
2. The words hold a backtick pair the replacement misses. Prevention: the new test case with a backtick in the words.
3. A re-run of RR1, RR2 or RR5 leaves old proof lines. Prevention: 3.5 replaces the files and the `checks.txt` lines and greps for plain-quoted lines.
4. The real reviewer of RR1 fails its stage. Impact: delay only; re-run once.
5. `test-map.json` links too few test files to the two SKILL.md files. Prevention: reported to the owner.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
None open.

## 11. Explicitly out of scope
- [ ] The `test-map.json` gap for the two SKILL.md files (reported to the owner, as the plan says).

## 12. Mandatory review questions
1. Objectively defined: yes.
2. Measurable: yes, five ACs with tests and real runs.
3. Error behaviors: defined.
4. Edge cases: covered, including a backtick in the words.
5. Dependencies: clear.
6. Contracts: defined.
7. Two readings: none found.
8. Implicit decisions: none found.
9. Tasks deliver the outcome: yes.
10. Discovered too late: nothing beyond the risks above.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable.
