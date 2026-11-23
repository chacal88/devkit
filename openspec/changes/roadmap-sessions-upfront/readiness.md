<!-- devkit-stage readiness result=passed attempt=2 commit=b216a4692ea9f1764d1e2e614a2905d646643651 -->
# Readiness review: roadmap-sessions-upfront

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Blockers: 0. Stage reached: ready-for-implementation (phases 1 to 4 ticked; phases 5 and 6 are the next work). Round 2, over the plan revised after the merge `b216a46` (change-state, ADR 0017, commit-attribution). `requirements.md` and the wording of every AC are unchanged; the revision is in `design.md` (D-6, D-11, D-12, D-13 T-15/T-16, D-14, D-15, R-12/R-13), `tasks.md` (new phase 5, old phase 5 now phase 6), `proposal.md` and `specs/roadmap-coordination/spec.md`.

Checks run: `openspec validate roadmap-sessions-upfront --strict` valid; `python3 scripts/check.py` all checks passed. Facts taken from the caller, not re-run: the filtered gate of phase 5 ran 777/777 green at `b216a46`, so the phase 5 gate is green on the base.

## 2. Scope validation
Classification: correct. Phase 5 does one thing: it puts the "held" reading (place, load, dependency) into `changeState`, so the `held` action, the `state` command and the board read one derivation, as ADR 0017 decision 1 requires. It adds no behaviour beyond AC-3, AC-9 and AC-10. ADR 0018 amending ADR 0017 decision 4 is named as an owner-facing amendment in D-12 and proposal.

## 3. Proposal review
No findings. Impact, capabilities and the ADR amendment follow the revision; non-goals unchanged.

## 4. Design review
Every claim about internals re-derived on the branch:
- `runFactsOf(run, id, { onRoadmap })` returns only `sessionMode, started, inflight, declared, waits`: `change-loop.mjs:649-658`. Adding `queued`, `placed`, `waitsFor` is new, as D-11 says.
- `changeState` S1 to S8 chain and the title rule: `change-loop.mjs:687-717`. In session mode a started change with an action keeps `endOfAction` (running, owner or GitHub), an unstarted one reads `READY`. S9 "replaces only `running` (no reason or `ready`)" fits that chain, and the owner, GitHub and blocked states cannot be overwritten. The title rule today gives a running state `sessionTitle(icon, id)` and a stopped one `sessionTitle(icon, id, stateIcon)`; the held branch (`⏳ <id>`) is a new branch, as described.
- `WAIT_ICON` is exported at `change-loop.mjs:621`; its readers today are `sessionDecide` (`roadmap-loop.mjs:782,798,799`) and the import at `:45`. `roadmap-loop.test.mjs:3308` asserts it is exported, so keeping it exported beside `STAGE_ICON` is right.
- `sessionDecide`'s `held()` builds `sessionTitle(icon, f.id)` itself (`roadmap-loop.mjs:776-780`); D-6 replaces this with `changeState(a, runFactsOf(heldRun, ...))` using a pseudo-run `{ changeSessions: true, startedSessions: { [id] }, placed, queued, waitsFor }`. Fields suffice for `runFactsOf`; the owner case runs over `a` (the gate end), so it reads `waiting-for-owner` and `🙋 <stage icon> <id>`.
- `stateRow` reads `f.queued` and `f.waitsFor` itself (`roadmap-loop.mjs:428-430`), placing the queue rows ahead of the GitHub row; the S9 move keeps the same words for the same facts. `queued` is written only by `sessionDecide` and `placeDecision` (session mode), so dropping the non-session case changes no board.
- `PLAN_NOT_HELD` (`:734`), `partOfStage` (`:806`), `isPlanStage` (`:815`) depend only on `locate`, `locateChange`, `readFlow`, `changeSchemaAt`, all already imported in `change-loop.mjs` (`:31-33`, `locate` at `:1080`). Moving them there creates no import cycle, as D-11 says (`roadmap-loop.mjs` imports `change-loop.mjs`).
- `stateEntries` (`change-loop.mjs:1345-1368`) already passes `onRoadmap`; adding the `waitsFor` for a plan stage uses `archivedOnDefault` (defined in `change-loop.mjs`) and `readRoadmap(start)`, both available.
- D-12 list of "ADR 0017" references written by phases 1 to 4 matches the live grep exactly: `roadmap-loop.mjs:25,183,489`, `change-loop.mjs:588`, `roadmap-loop.test.mjs:2212`, ADR 0013 line 74, plus the `change-loop.test.mjs:2386` comment. So the task 6.1 `grep` "prints nothing" is achievable.
- Versions: `plugin.json` devkit-openspec 0.24.0, devkit-core 0.11.0, marketplace 0.28.0; D-14's 0.25.0 / 0.12.0 / 0.29.0 are the next minors. Highest ADR on the branch is 0017, so 0018 is free here (ADR-number-at-merge rule is stated).
- Existing "documents follow" tests: the ADR 0014 header gets a second `Amended by` line at line 5, still inside the first 8 lines the ADR 0017 test slices (`change-loop.test.mjs:4229`); the `config.yaml` ADRs regex is unanchored. Both pass unchanged as the tasks say.

## 5. Specs review
`roadmap-coordination` carries the held state ("A change session shows the stage its change is in", "The board shows what each change session waits for", scenario "The board, the state command and the change session agree on a held change", "A stopped change is not held", the ⏳ title scenarios at lines 377-393). Every row of the D-11 decision table (held-place, held-load, held-after, owner/GitHub/blocked keep their state, no reason outside a session-per-change run) has a scenario. No findings.

## 6. Tasks review
- 5.1 lists eight `change-loop.test.mjs` and three `roadmap-loop.test.mjs` tests, one per guard and label, negatives included; counts in 5.2 ("the eight tests") and 5.3 ("the three tests") match. The red run on `b216a46` is saved to `proof/red-5.txt` with the tests that already pass listed; the expectation is coherent (the negatives and phase 2's title test pass on the base).
- 5.2 and 5.3 name every function, constant and move; checks name existing tests that must pass unchanged (`change-state AC-6/AC-7`, `upfront AC-3 status`, `upfront AC-8 session-next`, `upfront AC-9`), all present in the suites. T-15 and T-16 name real existing tests (`roadmap-loop.test.mjs:3029`, `:3307`) with invariant, layer and suite.
- 5.4 and 6.4 gates: 5.4 is the filtered gate green on the base per the caller; 6.4 is the long full suite, run by the caller as a background command. 6.1 to 6.3 are specific (files, versions, pin, assertion).
- Every path falls under a real directory.

## 7. Omission detection
No findings. Validation, idempotency (the held state is derived, no new write), compatibility (non-session runs keep their rows), rollout (release task 6.3) and evidence (D-15, red run file) are covered.

## 8. Execution risks (top 5 failures)
1. Cause: S9 is placed after S1 to S8 but a later edit to the chain reorders it. Impact: a waiting-on-GitHub or owner state shows ⏳ without its stage icon. Prevention: the negative test "keeps its state and title over a queue entry or a waitsFor" in 5.1.
2. Cause: the pseudo-run in `sessionDecide` omits `startedSessions`, so S4 reads `ready` and the held action loses its state. Impact: a wrong title. Prevention: D-6 writes `startedSessions: { [id]: { at: now } }`; the `session-next` agreement test checks it.
3. Cause: moving `partOfStage` and `isPlanStage` leaves a copy behind in `roadmap-loop.mjs`. Impact: two readers of a plan stage diverge. Prevention: 5.3 removes the copies; `roadmap-loop.mjs` imports them.
4. Cause: a sibling takes ADR 0018 or the release numbers first. Impact: a failed number-pinned assertion. Prevention: 6.1 and 6.3 say to take the next free number and renumber.
5. Cause: new comments in phase 5 cite "ADR 0017" for change-state in the four files the 6.1 grep covers. Impact: the 6.1 check prints a line though nothing is wrong. Prevention: cite change-state by its D-numbers there, or read the grep by hand; see the optional note below.

## 9. Mandatory fixes before implementation
- [ ] none

## 10. Optional improvements (within scope)
- [ ] Low, Fix during implementation: `tasks.md` 5.3 changes T-15 and T-16 inside the code task rather than in 5.1, so those two edits have no saved red run. They are existing tests whose expectation moves, D-13 names them, and the "test first" sentence covers only new tests, so this does not block. Smallest correction: move the two expectation edits into 5.1 and add them to `proof/red-5.txt`.
- [ ] Low: the 6.1 check `grep -n "ADR 0017" ... prints nothing` over `change-loop.mjs` and `roadmap-loop.mjs` would also catch a legitimate new reference to change-state's ADR 0017. Phase 5 as written adds none; if the implementer adds one, read the result by hand.

## 11. Explicitly out of scope
- [ ] Phases 1 to 4 (ticked, implemented); judged only as context.
- [ ] Whether the live app tools behave as D-15 says (proved in the next real run, as D-15 states).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: one derivation for the held state, one title rule.
2. Is the result measurable? Yes: the eight plus three named tests and the agreement scenario.
3. Are error behaviors defined? Yes: a stopped state keeps its own reason; no held reason outside a session-per-change run.
4. Are edge cases covered? Yes: 70-character id cut to 59 code points, a `ready` change with an unarchived dependency, claimed change.
5. Are dependencies clear? Yes: `roadmap-loop.mjs` imports `change-loop.mjs`, never the reverse; phase 6 after phase 5.
6. Are contracts defined? Yes: the facts, the S9 rule, `HELD_TEXT`, the `held` action's `state`, `sessionTitle` and `icon`.
7. Can two developers interpret this differently? Not materially; the rule, order and words are written.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes, with phase 6 for the ADR, documents and release.
10. What will be discovered too late if implementation starts now? Only the live host behavior D-15 assigns to the next real run.

## 13. Final conclusion
- Can we start? Yes, phase 5, then phase 6.
- What must be fixed? Nothing mandatory.
- Main risk if ignored? Moving the T-15/T-16 expectations only inside the code task leaves them without a red run.
