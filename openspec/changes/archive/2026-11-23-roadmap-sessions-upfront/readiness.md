<!-- devkit-stage readiness result=passed attempt=7 commit=ee8341365e1e251d79857a59dca965d8ae4cfe80 -->
# Readiness review: roadmap-sessions-upfront

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes, phase 9 (phases 1 to 8 are ticked and unchanged), once the owner approves the revised plan

Blockers: 0. Stage reached: phases 1 to 8 done and reviewed; phase 9 (design D-18, after review round 1 at `5edea6b`) planned and not started. Attempt 7, over the plan at `ee83413`. The caller named points to check and suggested no verdict; this verdict is mine.

Checks run here: `openspec validate roadmap-sessions-upfront --strict` valid; `python3 scripts/check.py` prints `all checks passed`; `python3 scripts/gen-catalog.py --check` clean; the worktree is clean. Not run, left to the caller: the whole suite (task 9.6 runs it as a background command). No gate of phase 9 is red on the base except by design (the new tests do not exist yet and T-27 is still the old assertion).

The approval on disk (`approval.md`, attempt 4) predates this revision. D-18 says itself that nothing of item 3 is built before the owner approves the revised plan. That is the owner's gate, not a defect, and it is not counted below.

## 2. Scope validation
Classification: correct. Phase 9 answers the three verified findings of review round 1 (records for the ADRs, a spec qualification, two small code changes) and nothing else. No criterion of `proposal.md` and no line of `requirements.md` changes.

## 3. Proposal review
No blocking finding. The bullet at `proposal.md:81-87` states the place rule and says approving the plan approves it; the Decisions paragraph (`:184-189`) lists ADR 0020 decisions 5 and 8 as amended. One optional gap, O1 below.

## 4. Design review
Attempt-6 points, each re-checked against the text and the code at HEAD `ee83413`:

- **F1 closed (the cap stated per count).** D-18 "Never looser" (`design.md:1449-1462`) now has the bullet "The other direction: the two populations are counted apart". It says `occupied` holds only changes whose session claimed the run's ticket, and I confirmed it in code: `sessionNext` returns the change loop's action unchanged unless `run.changeSessions && run.tickets[id]?.claimedBy` (`roadmap-loop.mjs:1033`), so `sessionDecide` never records an unclaimed change. The worked case (number 1, unclaimed `d` placed on `origin`, `occupied` empty, claimed `a` reaches its implementation, so two changes load the machine and the row reads 2 of 1) follows from `placeDecision` over `occupied` and `boardOf`'s count as D-18 changes it. The cap is stated per count: the claimed changes by `occupied`, the unclaimed ones by the plans on `origin` leaving a place free, and the board's row reading above the number as the signal. R-22 (`design.md:1546`), ADR 0021's second Note (`:1330-1333`), the two flow documents (`:1357-1363`) and the changelog sentence (`:1364-1368`) carry it, and the approval line at `:1478-1479` names "the cap stated per count" and "the board's row that may read above the number" as what the owner approves.
- **Spec closed.** `spec.md` requirement "A place is held only by a change that loads the machine" now bounds "the changes on the run's ticket" at the run's number. The new requirement says the number applies "to each count apart", that with both kinds at once the places held "MAY exceed the number", and that the board's row "SHALL count both". Scenario "Both kinds of change at once" (number 1, unclaimed `d` placed, nothing held by the run's count, claimed `a` reaches its implementation, `a` takes the place and the row reads 2 of 1) matches design test 4 and the arithmetic of the code: `occupied` `{a}` plus `d`'s placed claim with no `claimedBy`, and `a`'s own placed claim excluded because its ticket is claimed. "A place held only..." scenarios stay consistent: all their changes are claimed.
- **F2 closed.** `tasks.md` 9.4 now says ADR 0020's `Amended by` line goes "right after `- Status: accepted`, as ADR 0013 and ADR 0014 hold theirs (so it is within the first eight lines the docs test reads)". `docs/adr/0013-*.md:3-4` and `docs/adr/0014-*.md:4-6` hold theirs that way. In ADR 0020 `- Status: accepted` is line 3 and `- Date:` line 4, so the inserted line lands at 4, inside the first eight lines. D-18 (`design.md:1335-1337`), 9.4 and the docs test now agree.
- **F3 closed (the fixtures' ticket states).** The shared fixture now says each test names the tickets of `a` and `b`. Test 1: `a` and `b` both claimed; board `taken: 1` (`occupied` `{a}`, both placed claims excluded as claimed). Test 2: `a` and `c` claimed, no `b`; board `taken: 0` while `a`'s claim is placed. Test 3: `a` and `b` both unclaimed, `occupied` empty; `a` ends `no-place` with `taken: 1` (requires `a`'s own plan not yet on `origin`, since `placeFacts` answers `taken: true` as soon as it is, `change-loop.mjs:1355`) and the board reads 1 by `b`'s claim. Test 4 (new): `a` claimed, `d` unclaimed with its plan on `origin`, `a`'s plan pushed, `occupied` empty; `session-next` gives `a` its hand-off and records `occupied` `{a}`, and the board reads 2 of 1. The scenarios "The places of each machine...", "An approved plan pushed...", "A change reaches its implementation before its plan is pushed", "The place frees before the claim..." and "A change of this machine with no claimed ticket" each name the ticket state of every change in them. I walked every expected number against the planned `boardOf` rule and the code and none contradicts another.
- **Red record.** 9.1 now lists two tests that pass on the unchanged code (test 3 and test 4, "which pins today's two counts") and "the other three tests and T-27" failing. I re-derived it: on today's code test 4's board reads `takenBy` = `a`'s and `d`'s placed claims = 2 (passes), test 1 reads 2 and ends `no-place` before the push (fails), test 2 reads 1 where 0 is asserted (fails), the docs test and T-27 fail on text not yet written. Consistent. 9.2's check lists tests 1 (gate half), 3 and 4 passing; 9.3's check says "every `upfront D-18 place` test that reads the board".
- **Claims about the code, unchanged since attempt 6 and re-read.** `placeFacts` (`change-loop.mjs:1349-1359`) reads `readRun(runFilePath(found.root)).places` for `run` and counts the other claims of its machine with `placed === true`; `sessionNext` and `sessionDecide` as above (`sessionDecide` runs `placeDecision` only for an `agent` or `session` action in a load part, `:984-986`); `boardOf` uses `takenBy` (`:565-570`). The proposed single gate (the condition of `sessionNext`) makes exactly one gate apply to each change. ADR 0020 decisions 5, 7 and 8 and ADR 0021 decisions 1 to 5 and 8 are the ones the Notes cite (`docs/adr/0020-*.md:42-51`, `docs/adr/0021-*.md:37-86`).

## 5. Specs review
The new requirement has normative language and six scenarios; every outcome of D-18 item 3 has one (claimed before and after its push, the place freeing before the claim does, the unclaimed change, the per-machine places, both kinds at once). `openspec validate --strict` passes.

## 6. Tasks review
Order is right and test-first: 9.1 tests plus T-27 with a named red command and `proof/red-9.txt`, 9.2 and 9.3 the code with their checks, 9.4 the documents (each file assigned, with its quoted text in D-18 item 1: ADR 0021 Amends and Note, ADR 0020 header and Note, ADR 0010 qualifier, the config `ADRs:` line, the changelog bullet, and the two flow documents' paragraphs "Opening every change at the start", which exist at `docs/openspec-flow.md:335` and `docs/coordination-design.md:103`), 9.5 the focused gate whose patterns match existing test names, 9.6 the whole suite as a background command. Paths are real directories. `check.py`, `gen-catalog.py --check` and `openspec validate --strict` are green on the base.

## 7. Omission detection
Validation, errors, idempotency, observability (the board's row, the title), rollback (revert two functions and the documents), compatibility (a run with no `changeSessions`, or an unclaimed ticket, keeps today's gate) and test strategy per layer are covered. The mixed population, open in attempt 6, is now written.

## 8. Execution risks (top 5 failures)
1. The whole suite of 9.6 finds a test outside the listed patterns that assumed the claims gate for a claimed change. Prevention: the rule in 9.6 (a defect of 9.2 or 9.3, fixed there).
2. A second merge of `main` moves `remote-worker`'s tests while phase 9 is in review. Prevention: R-9 and the gate re-run.
3. An implementer writes test 3's `a` with its plan already on `origin`, so `placeFacts` answers `taken: true` and the `no-place` assertion cannot hold. Prevention: see O2.
4. An owner reads "2 of 1 places taken" in a mixed run and takes it for a defect. Prevention: the signal is stated in D-18, ADR 0021's Note, the flow documents and the changelog.
5. A change whose claiming session died is run again by the typed command and is ungated. Prevention: stated as a known limit in D-18, no regression.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] O1 Low: the proposal bullet at `proposal.md:81-87` says the board's row counts those places but not that with both kinds at once this machine can hold more places than the run's number. The owner approves item 3 on D-18's text, which says it, so this only helps a reader of the proposal.
- [ ] O2 Low: D-18 test 3 (`design.md:1505`) could say in a clause that `a`'s plan is not on `origin` there (its `no-place` end and the board's 1 both depend on it).
- [ ] O3 Low: D-18 says "the opposite order cannot exceed the number, since `d`'s gate counts `a`'s plan on `origin`" (`design.md:1455-1456`). In the window before `a`'s plan push lands, `a` already holds `occupied` and `d`'s gate sees no claim of `a`, so that order can exceed it too. Nothing depends on the sentence (the spec says "MAY exceed" with no order), so the wording can say "after the push".

## 11. Explicitly out of scope
- [ ] The owner's approval of the revised plan (stale `approval.md`): the plan's own gate.
- [ ] One count in both gates (D-18 "Why not one count in both gates": a follow-up the owner can ask for).
- [ ] Any release number.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: three verified findings mapped to an item, a task and a spec scenario (the table at `design.md:1276-1280`).
2. Is the result measurable? Yes: four named place tests and a docs test with a red record, T-27, the focused gate and the whole suite.
3. Are error behaviors defined? Yes: the claimed change held with `place`, the unclaimed one ends `no-place` and is woken, a run without a session per change keeps its gate.
4. Are edge cases covered? Yes: plan not pushed, pushed, delivery before archive, archived, unclaimed ticket, both kinds at once, a dead session's ticket.
5. Are dependencies clear? Yes: 9.1 to 9.6 in order, the owner's approval before 9.1.
6. Are contracts defined? Yes: `placeFacts` returns `null` under the stated condition; `boardOf`'s `taken` is the union of ids, once each.
7. Can two developers interpret this differently? Not on anything attempt 6 found; O2 is a clause, not a fork.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? Only what 9.6's whole suite finds in tests outside the listed patterns, which the task routes.

## 13. Final conclusion
- Can we start? Yes for the plan; implementation of phase 9 waits for the owner's approval of the revised plan, as D-18 says.
- What must be fixed? Nothing.
- Main risk if ignored? O2 and O3 only: a fixture a developer must infer, and one sentence slightly broader than the code.
