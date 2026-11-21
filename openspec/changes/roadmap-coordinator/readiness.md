<!-- devkit-stage readiness result=passed attempt=2 commit=6918c0d9f79ec5774fd1d243a544a14d16b87119 -->
# Readiness review: roadmap-coordinator

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The four mandatory fixes of attempt 1 (M1 to M4) are in the artifacts and hold against the code at
`6918c0d`. `openspec validate roadmap-coordinator --strict` reports the change valid. No open
mandatory finding remains.

## 2. Scope validation
Classification: correct. Problem, non-goals and the proved-here / proved-next split of each criterion
are unchanged and consistent with the specs. The reworded AC-11 (`proposal.md:74`, `requirements.md`)
no longer depends on checkout state.

## 3. Proposal review
No findings. The "Impact" line now counts five changed tests (`proposal.md:108`, T-1 to T-5), matching
`design.md` D-18.

## 4. Design review
Re-derived against the base commit:

- M1 closed. `change-loop.test.mjs:896-905` is test S2 and pins `/^Por enquanto só existe \/devkit
  change/`; `design.md` D-18 now lists it as T-4 with invariant, layer, suite and the new regex, and
  D-12 line 610 gives the new `verb-unknown` text in both languages, which matches the regex.
  `change-loop.mjs:99` and `:168` hold the current texts; `verb-unknown` is used only at `:710`; no
  other suite pins it. `S1` (`:881-889`) lists `roadmap` and `status` with round 18 and is T-1.
- M2 closed. `render` (`change-loop.mjs:245-259`) resolves `{why}` in `blocked-why.` only when
  `key === 'blocked'`; D-12 now replaces that with `BLOCKED_WHY_KEYS`, and `finish` (`:368`) gains
  `params`. The test helper `renderings` (`change-loop.test.mjs:96`) is changed the same way, with the
  `SAMPLE` values (`:82`) and `title` given, and `gate` stated as a code of the `gate.` family.
  No test compares a whole action to a literal (assertions at `:662-806` read fields), and `end` keeps
  `{ state, why }`, so `params` is additive.
- M4 closed. `flow-check.mjs:175-182` is `isPreviousScript` as D-4 describes (earliest artifact stage
  with a file; every file headerless; a later header changes nothing; no file is current). The table
  P1 to P6, Q1, Q2 and `other-work` follows from that rule by reading; the glob case (P6, Q2) matches
  `stageFiles` (`:155-172`). The fixtures need no live checkout state.
- Confirmed again: `sleepSync` at `deliver-check.mjs:1401` is `Atomics.wait` on a shared buffer, so
  the synchronous wait of D-10 and task 2.2 is fully named (it is a local function there; the task
  says to write it the same way, not import it).
- Gate patterns of task 3.5 (`^worktree`, `^approval.md`, `^devkit-lite`, `^change-loop`) match
  existing tests in `guard.test.mjs` and `change-loop.test.mjs`.

## 5. Specs review
Three deltas, all with `SHALL` language and `#### Scenario:` blocks. M3 closed: `specs/roadmap-
coordination/spec.md:200-202` adds "A run that was stopped", covering D-7 row E2. Every other outcome
row of the decision tables checked in attempt 1 still has its scenario; the spec delta did not drop
any.

## 6. Tasks review
Ordered by dependency, test first in each phase, one backticked gate per phase, every AC id in a
task (the table at `tasks.md:36-53`). Task 1.2 now builds the fixtures from D-4 and its check no
longer reads the repository. Tasks 1.3 and 1.4 carry the T-5 sample extension in the same phase, so
the replies test is green at every step (attempt 1's low point). The marketplace validation is an
owner-run task (3.4, 5.8) that gates read from a record file; no gate calls `claude`. Facts handed
over and not re-run by me: whole suite 985/985, `scripts/check.py`, `gen-catalog.py --check` and
`claude plugin validate .` green on the base.

## 7. Omission detection
Validation, error handling, idempotency, concurrency (open lock, run-file lock), rollback,
compatibility with the previous script and test strategy are defined. No finding.

## 8. Execution risks (top 5 failures)
1. A background subagent's end does not start a turn (B2). Gated by the probe of task 1.1 and the
   owner's ruling.
2. The stop lock exceeds its hook timeout when `nextAction` reads GitHub for many open changes. It
   fails open; already in the risk table.
3. Two sessions write the run file at once. Locked and tested (task 2.1).
4. A real project with many old changes behaves differently from the built fixtures. Stated as
   "proved next" in AC-11.
5. The live test finds a hook-input form the fixtures did not model. Covered by the phase 4 turn and
   the fix-test-first rule.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Task 1.5's gate filters to `^roadmap-loop` and three `change-loop` groups; it is enough because
  T-5 is edited in the same phase, but task 2.3's wider `^change-loop` is where T-4 is first seen.
  No change needed.

## 11. Explicitly out of scope
- [ ] The panels, `/devkit project`, `/devkit help` and the other drivers (rounds 19 to 24).
- [ ] The end marker's id check of `runOf` (round 16).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes (`proposal.md` Why, AC-1 to AC-16).
2. Is the result measurable? Yes; AC-11 now rests on named fixtures.
3. Are error behaviors defined? Yes, including the blocked-line rendering for every reason.
4. Are edge cases covered? Yes, including the stopped end.
5. Are dependencies clear? Yes (rounds 15 and 17b archived, probe B1 to B3 gate phase 3 and ADR 0013).
6. Are contracts defined? Yes: `next` JSON, run file, markers, message table, `params`.
7. Can two developers interpret this differently? No point found.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Only what the probe and the live
    test exist to find (B2, real hook-input forms).

## 13. Final conclusion
- Can we start? Yes, starting with task 1.1 (the probe, run by the conducting session).
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable; the residual risk is platform behaviour B1 to B3, already
  gated.
