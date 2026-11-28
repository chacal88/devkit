<!-- devkit-stage readiness result=failed attempt=10 commit=e523e62479ba8edb93e6ca6783451bf7dfbbaa61 -->
# Readiness review: helper-conductor

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no; the move of the scheduled firing from task 3.6 to task 6.1 reached `tasks.md` and `proof/` but not `design.md`, the AC map, the phase gate or the proposal, and it leaves the "second decision point" without a statement of what now guards phases 4 and 5

Round 10, on e523e62, after round 9 (d720a5f, APPROVED). Changed since: `tasks.md` (3.6, 6.1), `proof/p5-empty-tick.md` (new), `proof/decision.md`, `proof/probe-3-instructions.md`, `docs/adr/helper-conductor.md`, `approval.md`, `decisions.md`. `design.md`, `proposal.md`, `requirements.md` and `specs/` did not change. `openspec validate helper-conductor --strict` passes. No fetch was run.

## 2. Scope validation
Classification: incomplete. The scope is unchanged, but the plan now says two things about where the scheduled firing is measured.

## 3. Proposal review
- F4 below (stale 3.6 claims, `proposal.md:33`, `:127`, `:133`).

## 4. Design review
- F1, F2 and F3 below.

## 5. Specs review
No findings. `specs/**` never cites task 3.6, and no scenario depends on a scheduled firing being measured before phase 4.

## 6. Tasks review
- F5 below (`tasks.md:31`, `:88`, `:400`, the AC map rows).
- Task 3.6 itself (`tasks.md:384-397`) is coherent with `proof/p5-empty-tick.md`: three blocked headless runs, a control run, 0 turns / 0 tokens / cost 0, the scratch folder removed, `git status` check. Task 6.1 (`tasks.md:521-528`) holds the moved observations and names the stop-and-revise case.
- AC-1 judgment. AC-1 (`requirements.md:64`) asks for "the measured cost of three empty ticks ... with the real refusal hook installed in a scratch project". `p5-empty-tick.md` meets that as written: the real `tick-gate.mjs` in a scratch project, three blocked runs, the cost measured. AC-1 does not say "scheduled firing". It is met. The footing it gives is weaker than the one design.md claims (see F1), and that is a design problem, not an AC-1 one. No change to AC-1 is needed. Optional: add "headless" to the AC so a reader does not take it for a scheduled firing.

## 7. Omission detection
- F1: no statement of what happens when 6.1 (after phases 4 and 5) shows a scheduled firing that does cost a model call or drops the note.

## 8. Claims against code
`probe-3-setup.mjs` and `tick-gate.mjs` agree with the 3.6 text, as in round 9. No new code claim in the diff. The ADR and `decision.md` (lines 60-75) state the same footing as 3.6 and 6.1: measured headless, scheduled unmeasured until 6.1. The design does not.

## 9. Findings

**F1. Critical, Mandatory before implementation. `design.md:125-130` (D-1 "The second decision point, task 3.6"), `:1222-1230` (risks), `:1319`, `:1349-1351`, `:1421-1424`; `tasks.md:31`.**
These still say that task 3.6, before phase 4, shows the blocked firing's cost and the note's arrival in the firing's session, and that a failure stops the plan before any later phase starts. After the move that holds only for a headless session. Whether a scheduled firing passes the hook's block and reaches the session with the note is measured in 6.1, after phases 4 and 5 are built. Two developers will read D-1 differently: one thinks the gate was cleared before phase 4, the other that it was not. `decision.md` says it was not.
Smallest correction: rewrite the D-1 paragraph, the two risk lines (`:1225`, `:1228`), the estimate line (`:1319`, pessimistic case), the risks bullet (`:1350`), the Open Questions (`:1423`) and `tasks.md:31` to say: 3.6 is the headless decision point before phase 4 (decision 2 fails there if a headless block costs a model call); the scheduled-firing half (a block costs a model call there, or the note does not reach a task's session) is found in 6.1, its stop-and-revise case sends the plan back from phase 6 with phases 4 and 5 built, and that residual risk is accepted and priced. Mark the "note's arrival" risk as headless-measured (the control run) and scheduled-unmeasured.

**F2. High, Mandatory before implementation. `design.md:273`, `:341-343`, `:523`, `:703`, `:1078-1080`.**
Each assigns a measurement to 3.6 that 3.6 no longer makes: "Task 3.6 logs the payload of real firings; the form it does not see is dropped in that task, with its test" (D-4); "unless task 3.6 shows the host refuses [`*/5`] ... before phase 4 starts" (D-4 cron, AC-15); "when task 3.6 named a notification tool" (D-4 push); "task 3.6 records which model that is" (D-14); "the cron, the notification tool and the model of the task's session come from task 3.6" and "two runs at once" (D-24). `p5-empty-tick.md` and `decision.md:75` say these are 6.1's. Implementers cannot tell whether phase 2 and 4 code must wait for them, and no task in phases 2 to 5 drops the unseen payload form (D-4's regex, with its test) since 3.6 no longer sees the real firing's payload.
Smallest correction: change each to name 6.1; for the cron, say AC-15 is revised after 6.1 if refused, and that phases 2 to 5 build `*/5`; for the payload form, say the regex keeps both forms (envelope tag and bare first line) until 6.1 shows which one the hook sees, and add to 6.1 the dropping of the unseen form with its test (or state that both stay); for the push, say what the skill's push step does before 6.1 names the tool (for example, the `pushed` verb exists and the note's tool name is filled by 6.1's result), and for the model, say D-14 reads it from 6.1.

**F3. Medium, Mandatory before implementation. `design.md:1244`, `:1384-1392`, `:1332`, `:1382`.**
Assumptions and the cost table still send observations to 3.6 that a headless run cannot make: tool-approval pauses (`:1244`, `:1385`), a firing started while an earlier run's session waits (`:1387`), `additionalContext` reaching "a task's session" (`:1389`), and the table row "Phase 3 real run: three blocked firings, the note, the payload's form, two runs at once, cron, notification tool, model (task 3.6)" (`:1332`). `:1382` ("genesi's measured 0 tokens; task 3.6 again here") is fine as headless. Smallest correction: repoint those assumptions and the risk at 6.1 (the `:1389-1392` sentence already points the pack settings to 6.1) and reduce the `:1332` row to what 3.6 is now (headless blocked runs and the note's arrival headless), moving the rest to the Phase 6 row.

**F4. Medium, Mandatory before implementation. `proposal.md:33`, `:127`, `:133`.**
`:33` "A real run with the hook installed measures three blocked firings and the note (task 3.6)"; `:127` "the blocked firing and the note with the real hook (task 3.6)"; `:133` "the cost of a blocked firing, the note's arrival, the hook's payload form and the cron, settled by task 3.6, which can still stop the plan". The proposal is the owner's approval text; it must say what the owner approved: a headless measurement before phase 4 and the scheduled firing in 6.1. Smallest correction: edit the three lines to say so; `:133` names 6.1 for the payload form, the cron and the scheduled firing's cost.

**F5. Medium, Mandatory before implementation. `tasks.md:88`, `:400`, `:36`, `:38`, `:46`, `:50`.**
`:88` says task 3.6 holds "P-5, P-6's two runs, the cron, P-7"; 3.6 now holds P-5 only (headless). The gate task 3.7 (`:399-400`) still lists "AC-11 (the runs at once)" and "AC-15 (the cron)" as proved by that gate: 3.6 proves neither, and the whole-suite and own-files gate cannot prove a cron. The map rows AC-11 and AC-15 list 3.6 (`:46`, `:50`) and AC-3 and AC-1 list 3.6 (right for the headless block). A criterion with no task that proves it blocks the delivery contract. Smallest correction: `:88` read "task 3.6 (P-5, headless) and task 6.1 (P-6's two runs, the cron, P-7)"; in 3.7 drop the cron and "runs at once" from the 3.6 gate list, leaving the ACs the gate proves (the conductor tests for AC-11's cap; 6.2 and 6.1 for AC-15's cron); in the map, replace 3.6 with 6.1 for AC-11 and AC-15 (6.2 already holds AC-15; 6.1 holds AC-11 already).

## 10. Execution-readiness test
Four of the five findings are wording that routes to 6.1. F1 is the one that changes risk: a developer finishing phase 3 sees "3.6 done, D-1 cleared" and builds phases 4 and 5 on a gate whose scheduled-firing half is unmeasured. More than three major doubts for phase 4 exist while F1 to F3 stand, so the plan is not ready until the design says what 3.6 and 6.1 each settle.

## 11. Mandatory questions
1. Problem objectively defined: yes.
2. Result measurable: yes; AC-1 is met by the headless run as written.
3. Error behaviors defined: the scheduled-firing failure path (a block that costs a call, a note that does not arrive) is defined in 6.1 and the ADR, not in design.md (F1).
4. Edge cases: covered.
5. Dependencies clear: no; phases 2, 4 depend on values (cron, push tool, payload form, model) that 6.1 now measures later (F2).
6. Contracts defined: yes.
7. Two developers interpret differently: yes, on whether D-1 is cleared before phase 4 (F1).
8. Implicit decisions: the acceptance of the residual risk in phases 4 and 5 (F1).
9. Tasks deliver the outcome: yes, once F5 is fixed.
10. Discovered too late: a scheduled firing that costs a model call or drops the note, found at 6.1. That is the accepted risk F1 asks to be written down.
