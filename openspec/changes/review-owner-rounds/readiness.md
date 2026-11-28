<!-- devkit-stage readiness result=failed attempt=1 commit=19a5f36b419cc402287b6cafd547ba05de9d3155 -->
# Readiness review: review-owner-rounds

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

One narrow, mandatory fix (a decision-table row with no spec scenario). Everything else re-derived clean.

## 2. Scope validation
Classification: correct. The delivered half (`roundLimit`, `(round N/<limit>)`) is kept and pinned; the five ACs map to the five asks; non-goals are tight.

## 3. Proposal review
No findings. Capability `review-round` is correctly "modified"; contract flag and impact are explicit; release rule follows `release.md` (packs: patch x2, title and body present, no task bumps a version).

## 4. Design review
Claims re-derived against code at 19a5f36:
- Rules section markers and `new Function` load, `NAMES`, `SUBCOMMANDS`, `COMMANDS`, `treeState` export: `review-round.mjs:12-49,169,183`; `validateArgs` round-range check precedes where D-1 inserts (`review-round.workflow.js:69-80`), so T42 (`round 4, limit 3`) and the no-limit round 3 message keep passing.
- `declare review-round` records `{ key, scope, round: REVIEW_ROUNDS + authorizedRounds + 1, words: words.slice(0, 200) }`: `change-loop.mjs:3313-3314`; `recordDeclared` is exported (`:3330`).
- `readDeclared` messages and rules match D-2's list (`deliver-check.mjs:2713-2733`); `RECORDED_KEYS` as stated.
- `readReviewMd` regex is anchored at line start, so an `Owner's words` line is never read as a Consensus line (`deliver-check.mjs:3013-3018`).
- Every text anchor of D-5 exists once in its file (review skill args line and rounds bullet, both ship-change rows, `round N/2` in `docs/openspec-flow.md:454`).
- T41 to T43 are as described; T43 calls `consolidate` unvalidated, so it stays green with no owner line.
- CompozyOS review loop never passes a `limit`, so it never reaches the new rule.
No failed re-derivation. Minor: D-6's parity test says `recordedOwner` finds words "exactly when" `readDeclared` lists an entry, but `recordedOwner` also requires non-blank string `words` and `readDeclared` does not; the chosen fixture records must avoid that case (Low, fix during implementation).

## 5. Specs review
Delta is valid (`openspec validate review-owner-rounds --strict` passes). The MODIFIED requirement carries all five original scenarios. Decision-table check of D-1 and D-2:
- Row `owner` not a plain object (array included) -> `args.owner must be an object` (D-1 line 68): no scenario in `specs/review-round/spec.md`. Mandatory finding below.
- All other D-1 rows (early round with owner, no owner, wrong round, wrong scope, bad words) and D-2 outcomes (found, none, unreadable, early round, malformed input, parity) have scenarios.

## 6. Tasks review
Ordered, checkboxed, each with a runnable check; every ACs has tasks (table). Paths exist; the test files named in 1.8 exist; `--test-name-pattern`, `--concurrency` and `--own-files` are real flags of `scripts/test-suite.mjs`. No version, CHANGELOG, CI pin or ADR number is set by a task; no file is added, so `scripts/test-map.json` is untouched. Real-run proof RR1 to RR5 covers the conducting session's part and the refusal path. Gate commands were not run (the suite is long; the caller runs them). Low: task 1.1 asks every new test to fail "not for an import error", while the owner-command tests may import `recordedOwner`; they should drive the CLI so the file still loads before task 1.3.

## 7. Omission detection
Validation, error handling, rollout/rollback, idempotency, compatibility with older `declared.json` and the mid-review round 3 case are covered (Risks, Migration Plan). Observability: none needed. No other omission.

## 8. Execution risks (top 5 failures)
1. Cause: the `args.owner must be an object` branch is written differently by two developers (no scenario). Impact: an array or string passes or throws a different message on one path. Prevention: add the scenario.
2. Cause: parity test fixtures include a blank-words entry. Impact: false failure against `readDeclared`. Prevention: keep such entries out or state the exception.
3. Cause: a reader test of an edited skill text is outside the selective gate. Impact: red suite later. Prevention: task 1.8 already runs them by name.
4. Cause: a sibling change edits the same SKILL.md rows. Impact: merge conflict. Prevention: merge `origin/main` before review (already planned).
5. Cause: RR1's real reviewer fails its stage. Impact: delay only. Prevention: re-run once, as planned.

## 9. Mandatory fixes before implementation
- [ ] Medium - `openspec/changes/review-owner-rounds/specs/review-round/spec.md` (add a scenario under "A round beyond the second needs the owner's recorded words"; source row at `design.md:68`) - the D-1 row `owner` not a plain object (an array included) -> `review input invalid: args.owner must be an object` has no scenario, so the D-6 `validateArgs` test and the two paths have no spec to hold them - add `#### Scenario: An owner that is not an object` with WHEN a round above 2 gets `args.owner` as an array or a string, THEN the arguments are refused with that message.

## 10. Optional improvements (within scope)
- [ ] State in D-6's parity row that blank-words entries are outside the "exactly when" claim.
- [ ] Say in task 1.1 that the owner-command tests drive the CLI by process, not by importing `recordedOwner`.

## 11. Explicitly out of scope
- [ ] The `test-map.json` gap for the two SKILL.md files (reported to the owner, as the plan says).

## 12. Mandatory review questions
1. Objectively defined: yes. 
2. Measurable: yes, five ACs with tests and real runs.
3. Error behaviors: defined, except the not-an-object row's scenario.
4. Edge cases: covered (round 1 and 2, other round or scope, resolution, 200-char cut, whitespace, Markdown in words).
5. Dependencies: clear; `coordinator-loop-fixes` is archived on the base.
6. Contracts: defined (`args.owner`, `owner` command input and output, exit 3).
7. Two readings: only at the not-an-object row.
8. Implicit decisions: none found.
9. Tasks deliver the outcome: yes.
10. Discovered too late: a parity drift between `recordedOwner` and `readDeclared` on blank words (Low).

## 13. Final conclusion
- Can we start? Not yet.
- What must be fixed? One spec scenario (section 9).
- Main risk if ignored? The array/string `owner` branch is unspecified and may behave differently on the Workflow and CLI paths.
