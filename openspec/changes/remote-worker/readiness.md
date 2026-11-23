<!-- devkit-stage readiness result=passed attempt=3 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: remote-worker

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes (phases 1 to 4 and tasks 5.1, 5.3 to 5.6 are already in the tree; the open work is 5.7, 5.8 and phase 6)

Round 3. Rounds 1 and 2 stand. The plan was revised after approval: `design.md` D-14 gained T-6 to T-13 and
`tasks.md` gained task 5.7 (the old gate is now 5.8). This round judges that revision.
`openspec validate remote-worker --strict` passes ("Change 'remote-worker' is valid").

## 2. Scope validation
Classification: correct. The revision adds no behavior; it changes eight existing tests that the behavior of
D-4, D-8, D-9, D-10, D-12 and D-15 turned red. The proposal, the specs and the Non-Goals are untouched.

## 3. Proposal review
No findings. `proposal.md:109` points at D-14 and that section exists.

## 4. Design review
Each T row of D-14 was re-derived against the test files (still at their base text, so 5.7 is open) and the code:
- Test names and positions match: `change-loop.test.mjs:117` (T-6), `:2446` (T-10); `roadmap-loop.test.mjs:561` (T-7),
  `:578` (T-8), `:2187` (T-9), `:2278` (T-11), `:2593` (T-13), `:2634` (T-12).
- T-6: `SAMPLE` (`change-loop.test.mjs:83`) already holds `machine` and `taken`; it lacks `entry`, `field`, `name`.
  `machine-incomplete` (`{entry}`,`{field}`), `machine-duplicate` (`{entry}`) and `machine.this` (`{name}`) exist at
  `change-loop.mjs:184,185,191`. The row says so.
- T-7: `BLOCKED_PARAMS` (`roadmap-loop.test.mjs:559`) lacks `machine`, `taken`, `places`; `blocked-why.no-place` and
  `blocked-why.cannot-check-out` need them (`change-loop.mjs:216,232`).
- T-8: `waits` at `roadmap-loop.test.mjs:584` filters only `waiting-github`; `waiting-place` exists (`change-loop.mjs:126`)
  and is the reply of the blocked end `no-place` (`change-loop.mjs:756`). `gateOf` (`roadmap-loop.mjs:141`) throws
  `LoopUsageError` for any end that is not `waiting-for-owner`, so the two new assertions hold.
- T-9: the exact key-list assertion is at `roadmap-loop.test.mjs:2193`; the run file now holds `placed`
  (`roadmap-loop.mjs:310-311`). Adding `placed: {}` to the fixture keeps the invariant.
- T-10: the pin assertion is at `change-loop.test.mjs:2480` (`v0.21.1`); `docs/openspec-flow.md:580-590` already pins `v0.22.0`.
- T-11, T-12, T-13: assertions at `roadmap-loop.test.mjs:2283`, `:2638`, `:2618` and the Never text at `:2619-2620`
  read as D-14 quotes them. T-13 is given in full, with the reason the wake does not contradict ADR 0014.
No failed re-derivation.

## 5. Specs review
No change. Every decision-table outcome row listed in rounds 1 and 2 still has a scenario.

## 6. Tasks review
Task 5.7 is executable. Each T row states invariant, owning layer, suite and the exact edit, as the Never-change rule
of `tasks.md` requires. The check command's seven name patterns select exactly 8 tests (`^roadmap-loop replies` matches
two, the other six one each; confirmed by grep of the test names), runs through `guard.test.mjs` with the two GitHub
env vars, is a background command, and its diff check names T-1, T-2 and T-6 to T-13 as the only existing tests that
change. Gate 5.8 is the whole suite once, background, exit code. Phase 5 order (5.7 before 5.8) is right.

## 7. Omissions
No findings. Test strategy, rollback of an edit (a revision, not a silent change) and the stop rule for a failure
outside D-14 are written.

## 8. Execution-readiness test and simulation
Major doubts: 0. A developer edits two test files at the listed lines, runs the 8-test check, then the whole suite.
Top residual risks:
1. A test outside D-14 fails at 5.8 again. Prevention: the plan says it stops for a plan revision.
2. T-13's `wake` line count: the skill must carry `SendMessage` on exactly one line starting with `` - `wake`: ``.
   The check at 5.7 shows it at once.
3. The live risks of phase 6 (R-4, R-7, the race against GitHub) stay recorded live, as in round 2.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, fix during implementation: the AC table of `tasks.md` (lines 54 to 66) still lists `5.7` for AC-5, AC-7,
  AC-9, AC-10 and AC-11, from before the renumbering. `5.7` now changes tests and `5.8` is the gate; list `5.7, 5.8`
  or `5.8`. It changes no behavior.

## 11. Explicitly out of scope
- [ ] Slice claim for `/devkit project`, an alias between hostname and connection name, Managed Agents, moving
  an open change: named in the plan's Non-Goals.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: 12 ACs with named tests and a live record; 5.7 has an 8-of-8 check.
3. Are error behaviors defined? Yes.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes; 5.7 before 5.8.
6. Are contracts defined? Yes; T-6 to T-13 give exact constants, texts and assertions.
7. Can two developers interpret this differently? No for the test edits.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? Only the live items of phase 6.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? Not applicable; the one Low item is a cross-reference.
