<!-- devkit-stage readiness result=passed attempt=4 commit=30e6cbd38ddf06bf7b0754030d53b207572d1012 -->
# Readiness review: remote-worker

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes (phases 1 to 5 are already in the tree and gate 5.8 passed; nothing of the plan is left open)

Round 4. Rounds 1 to 3 stand. This round judges one revision: the owner's decision of 2026-11-23 (`B: depois do merge`) removed
phase 6 (the owner-run live record, tasks 6.1 to 6.5, `proof/live.txt`) and moved it to post-merge live checks L-1 to L-4.
`openspec validate remote-worker --strict` prints "Change 'remote-worker' is valid".

## 2. Scope validation
Classification: correct. The revision removes a verification step from the change; it adds no behavior and touches no spec.
The specs, the Non-Goals and the acceptance criteria are unchanged. The owner's decision is quoted in `tasks.md:61-65`,
`design.md:781-785` and `proposal.md:78-81`.

## 3. Proposal review
No findings. The exit criteria (`proposal.md:76-81`) now list the suite, `check.py`, `gen-catalog.py --check`, the marketplace
validation and `openspec validate`, and say the live record is not an exit criterion, pointing at D-16 and R-10, which exist.

## 4. Design review
Re-derived from the files:
- No residue of the removed phase: grep for `phase 6`, `6.1` to `6.5`, `live.txt` finds nothing in the proposal, design or specs.
  `live.txt` survives only in `tasks.md:275`, as the future record of the follow-up change, which is intended.
- D-16 (`design.md:775-806`) separates "this change's verification" (phases 1 to 5, gate 5.8 last) from what the tests cannot
  cover (real GitHub push race, real SSH session start, real wake, real silent machine, `ssh avel`, the worker's
  `installed_plugins.json`) and names R-10 for it.
- The Proof map (`design.md:810-823`) has a "Live, after the merge" column; its L-1 to L-4 match the L-1 to L-4 of `tasks.md:288-313`
  (AC-1, 2, 3, 5, 6 to L-1; AC-8, 9 to L-2; AC-10, 11 to L-3; AC-12 to L-4). The tasks' statement of which ACs the live checks
  re-check (`tasks.md:63-64`) agrees with the map.
- R-10 (`design.md:850-860`) is honest about the cost: a defect reaches projects that update before the live check. The mitigation
  holds: with `machines` unset, no SSH, placement, place or wake runs (AC-7, D-9), so the paths that reach every project are the
  claim and the claims reading, which are tested with real `git`, a real bare remote and two real processes.
- R-2, R-7 and the Estimate (`design.md:904-905`) were updated to point at the post-merge check.
- Code claims the plan depends on exist in the tree: `plugins/openspec/hooks/machine-probe.mjs`, `run-file.mjs`,
  `docs/adr/0016-a-change-can-run-on-another-machine.md`, devkit-openspec `0.22.0` in `plugin.json:3`.

## 5. Specs review
No findings. The three deltas (`change-coordination`, `coordination-locks`, `roadmap-coordination`) are untouched and each AC still
has a task and an automated test in the Proof map. Nothing in the specs or `requirements.md` demands a live record as a condition of
delivery; the two mentions of "live" in `requirements.md` are inputs (the 2026-11-21 run), not criteria.

## 6. Tasks review
- Phases 1 to 5 are all `[x]`; the table at `tasks.md:45-58` still maps every AC to tasks that exist (no reference to a task 6.x).
- Gate 5.8 is the last gate: the whole suite, `check.py`, `gen-catalog.py --check` and the `Validation passed` file. It passed
  (1425/1425 plus the checkers, as the caller states; not re-run here, since it is the long gate and was handed over).
- The Workflow follow-up (`tasks.md:252-313`) is correctly marked as not a task of the change loop: it names no gate of this
  change and no `tdd-implementer` work. It states where the record goes (a roadmap line `remote-worker-live-checks`, proposed by
  the retro for the owner), the setup, what each record holds, the destructive-Git rule for scratch branches, and the fallback if the
  owner rejects the proposal (the retro records it and the check is not scheduled).
- The follow-up records the renumbering risk: `origin/main` has moved (devkit-openspec 0.28.0), so every version number is
  re-checked at delivery.

## 7. Omission detection
No findings. Verification is covered by tests (5.8), the live part by a named, owner-decided follow-up with a traceable home. The
retro must state that the live part of AC-1, AC-3, AC-5, AC-6 and AC-8 to AC-12 was not run before the merge
(`tasks.md:276-278`); that is written.

## 8. Execution risks (top 5 failures)
1. Cause: the push race against GitHub's "create only" lease behaves differently from the local bare remote. Impact: two machines
   both think they hold an id. Prevention: R-10 and L-1, after the merge; the local test uses two real processes.
2. Cause: `ssh avel` does not resolve (R-2). Impact: the machine reads "no answer" at once. Prevention: visible on the board; L-2.
3. Cause: version skew between machines (R-3, R-10). Impact: a `state` answer in another form is "no answer". Prevention: the same
   version on both (L-1 setup), documented in the flow page.
4. Cause: release renumbering after `origin/main` moved. Impact: wrong tag or CI pin. Prevention: the follow-up re-checks every number
   at delivery.
5. Cause: the retro's roadmap proposal is rejected or forgotten. Impact: the live checks are never run. Prevention: the retro records
   the answer; the owner decided the order.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] none

## 11. Explicitly out of scope
- [ ] The claim of a `/devkit project` slice (Non-Goals; proposed as a roadmap line by the retro).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, by the Proof map's named tests and gate 5.8; the live part by L-1 to L-4.
3. Are error behaviors defined? Yes, unchanged from round 3.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes, in D-1 to D-16 and the three spec deltas.
7. Can two developers interpret this differently? No material risk found.
8. Are any decisions implicit instead of written? No; the removal of phase 6 is written with the owner's quote in three artifacts.
9. Do the tasks fully deliver the intended outcome? Yes for the automated verification; the live part is explicitly deferred.
10. What will be discovered too late if implementation starts now? A defect only visible against real GitHub or SSH, accepted as R-10.

## 13. Final conclusion
- Can we start? Yes. The implementation is done and gated; the plan as revised is coherent and the verification boundary is explicit.
- What must be fixed? Nothing.
- Main risk if ignored? Cross-machine behavior is first seen live on the merged release (R-10).
