<!-- devkit-stage readiness result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: change-state

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate change-state --strict` reports the change valid. No blocker is open. Two Low
findings are listed in section 10 for the implementation to settle.

## 2. Scope validation
Classification: correct. The proposal, the specs and the tasks agree on one derived state
(`changeState`), one read-only command, one GitHub rule, one title rule and a board that reads the
state. The design's Non-Goals are explicit: no state for `/devkit project` slices, `entriesOf` and
`decideRoadmap` untouched, and the delivery checker's own GitHub failures keep their blocked end.
Nothing in the specs or the design is absent from `proposal.md`.

## 3. Proposal review
The problem (three surfaces read the state three ways) and the goal are clear. The affected
capabilities (`change-state` new, `change-coordination` and `roadmap-coordination` modified) have
deltas. Non-goals are tight. The risk of one `next` per change in `state` is visible in the design's
risk table.

## 4. Design review
I re-derived the internal claims against the code at `c561553`:

- `decide`, `nextAction`, `stageIcon`, `sessionTitle`, `BLOCKED_OF`, `blockedEnd` (called from the plan
  part and from `buildPart`), `waitLoop`/`isUnreadable`, `whereOf`, `unfinished`, `knownChange`,
  `archivedOnDefault`, `exitCodeOf` (waiting is exit 1, blocked exit 2) are in
  `plugins/openspec/hooks/change-loop.mjs` as the design says (lines 485-518, 589, 689, 772, 866-905,
  1167-1195).
- `gh-error` and `checks-unreadable` are the stage checker's only two GitHub blocked ends
  (`flow-check.mjs:192`, `:199`); no other module emits them.
- `runFilePath`, `readRun`, `emptyRun`, `GATE_OF_WHY`, `gateOf`, `entriesOf`, `boardOf`, `ownRow`,
  `runningText` and `sessionStartOf` are in `roadmap-loop.mjs` (82-98, 136-175, 335-412, 429-475).
  `entriesOf`'s order (declared, own, in flight, declared, rest) is the order of D-2's S1 to S8.
- `waitLoop`'s `decisionKey` includes `reply`, so a silent first decision followed by another wait
  compares as different, as the test `[silent, WAIT]` expects.
- The versions on the base are plugin 0.21.1 and marketplace 0.25.1, so 0.22.0 and 0.26.0 are the next
  ones; ADR 0016 is the next free number; the roadmap line and the ADRs line of `openspec/config.yaml`
  are there.

No claim failed.

## 5. Specs review
Normative language and `#### Scenario:` blocks are present in the three deltas. The outcome rows of
D-1 (each state with each reason), D-2 (S1 to S8 and the plain-run cases), D-4 (the silent wait, the
three-poll end) and D-3 (exit 0 and 3, no run marker, nothing written) each have a scenario. The S2
branch "started with no action" has no scenario of its own, but D-9's S1 to S8 test covers it (Low,
section 10).

## 6. Tasks review
Phases are ordered by dependency and test first; each test task names the tests that pass on the base.
Every path is under a real directory. The gate parts that exist on the base were run there:
`python3 scripts/check.py` passes (all checks passed) and `python3 scripts/gen-catalog.py --check`
passes. The gate parts that run the new `change-state` tests are red on the base by design (test
first). The whole suite (gate 3.5) was not run by this review; it is a long command the caller owns.
`approval.md`, which task 3.1 cites, does not exist yet; it is the owner's artifact after this review.

## 7. Omission detection
Validation, error handling (exit 3, plain reply, three-poll end), side effects (none: nothing written),
idempotency (read-only), rollback (revert the pull request), compatibility (re-exports keep importers
working) and test strategy (D-9 and D-10, with the parity test) are defined. Retries are the existing
three-poll wait. No finding.

## 8. Execution risks (top 5 failures)
1. Cause: the board's words change for a case no test pins. Impact: `/devkit status` regresses.
   Prevention: the parity test and the unchanged board tests (D-6, D-9).
2. Cause: a missing or signed-out `gh` reads as GitHub silent. Impact: a wait of three polls before
   blocked. Prevention: accepted in the design; the blocked reply quotes gh's error.
3. Cause: the move of the run-file reader breaks an importer. Impact: hooks fail at load.
   Prevention: re-exports and the whole suite in gate 3.5.
4. Cause: another change takes ADR 0016 or 0.22.0 first. Impact: stale references. Prevention:
   CONTRIBUTING step 5, renumbering at merge.
5. Cause: the state command prints a run marker. Impact: the stop lock starts a run. Prevention:
   `change-state AC-1 command: the output holds no run marker`.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, fix during implementation: `design.md` D-2 and task 1.2 move `emptyRun` "with its
  `isObject`", but `roadmap-loop.mjs` still uses its own `isObject` in `watchAlive` (line 446) and in
  the run-file check (line 589), and `readRun` needs `isChangeId` from `guard.mjs` in its new home.
  Export `isObject` from `change-loop.mjs` and import it back (one helper, not a copy), and import
  `isChangeId` in `change-loop.mjs`. The existing `watchAlive` tests catch a miss.
- [ ] Low: add a scenario for a change in a session-per-change run that is recorded as started and
  has no action (S2 with no action).

## 11. Explicitly out of scope
- [ ] A state for `/devkit project` slices.
- [ ] Telling a missing `gh` from an outage; the delivery checker's own GitHub failures.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes (proposal Why).
2. Is the result measurable? Yes; every AC has named tests (Proof map).
3. Are error behaviors defined? Yes (exit 3, `request-unreadable`, the silent wait and its end).
4. Are edge cases covered? Yes; the long id, no run file, off-roadmap changes, a slice, an empty list.
5. Are dependencies clear? Yes (`managed-agents-study` archived; ADRs 0010, 0013, 0014).
6. Are contracts defined? Yes (D-1 JSON and reason table, D-3 output, D-7 keys).
7. Can two developers interpret this differently? Only on the `isObject` placement (Low).
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes, up to the release and ADR.
10. What will be discovered too late? Whether a live app session renames to the new title, which the
    design assigns to the next roadmap run.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? The board parity: a changed word in a status row that no test pins.
