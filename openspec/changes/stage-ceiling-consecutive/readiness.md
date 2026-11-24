<!-- devkit-stage readiness result=passed attempt=4 commit=96f7a7638c645e54bcba6bc76122beb5e20f5963 -->
# Readiness review: stage-ceiling-consecutive

Delta re-review (attempt 4) at `96f7a76`, after the plan was implemented and reviewed. Commit `96f7a76` changes only the wording of AC-8 (`git show 96f7a76 --stat`: `requirements.md` and `proposal.md`, one line each). Scope of this round: the new AC-8, its consistency across the artifacts, its task and proof path, and any remaining use of the old wording. The rest of the plan is as round 3 approved it (attempt 3, `6fce972`), and no behaviour, task, design or spec file changed. Run here: `openspec validate stage-ceiling-consecutive --strict` (valid). Not run: test suites and gates (nothing they cover changed).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes (already implemented; the plan stays executable and AC-8 is now provable before the pull request merges)

The new AC-8 can be observed and proved before archive. No open Mandatory finding. One Medium finding on `evidence.md` (not a plan artifact) is listed in section 10, and it needs the evidence stage to be redone before the delivery gate reads it.

## 2. Scope validation
Classification: correct. The reword narrows AC-8 to what holds before archive and moves the ticks to the archive follow-up the plan already had. It adds no scope.

## 3. Proposal review
- `proposal.md:55` and `requirements.md:38` carry the same AC-8 text, character for character (checked with `git show 96f7a76`: both added lines are identical). Id and slug `roadmap-ticks-both` are unchanged, so the `tasks.md:34` row still resolves.
- `proposal.md:40-41` ("At archive, both roadmap lines ... are ticked; the second says this change delivered it") and `requirements.md:17` (assumption 1, "ticked ... when this change is archived") still say the old thing in prose. Neither is an acceptance criterion. Each describes what happens at the archive step, which is what the new AC-8 delegates to the follow-up, so they do not contradict it. Not a finding.
- The rule "every sentence stating a fact about the repository is true at the commit that ships it" (`openspec/config.yaml`, proposal) holds: lines 40-41 state a future act, not a present fact.

## 4. Design review
`design.md` does not state AC-8 or the tick. Its only `roadmap.md` mentions are file lists (`design.md:392`, `:402`: the file is modified, which task 3.2 does) and unrelated uses of the word "roadmap" (`:20`, `:21`, `:73`, `:205`, `:371`, `:452`). No claim about internals changed. No finding.

## 5. Specs review
Both spec deltas (`specs/`) do not mention AC-8, ticks or the roadmap line (grep over `specs/`: no match except an unrelated `billing` scenario). Nothing depends on the old wording.

## 6. Tasks review
- Row `tasks.md:34`: `AC-8 | roadmap-ticks-both | 3.2 (the line); the ticks at archive (Workflow follow-up)`. It still maps to the right places for both clauses of the new text.
- Clause 1 (the line says it was delivered by this change): task 3.2 (`tasks.md:98-100`, ticked `[x]`) with its check `grep -n "evidence-attempts-by-failure" openspec/roadmap.md`. I ran the equivalent: `openspec/roadmap.md:79` reads `- [ ] evidence-attempts-by-failure — ... — delivered by stage-ceiling-consecutive (fused, 2026-11-23)`. Observable now. Met.
- Clause 2 (the archive follow-up in `tasks.md` ticks both lines): `tasks.md:133-135` says "At archive (`ship-change`'s archive steps): tick both `stage-ceiling-consecutive` and `evidence-attempts-by-failure` in `openspec/roadmap.md` (AC-8), the second keeping the 'delivered by' text of 3.2". The line of `stage-ceiling-consecutive` is `openspec/roadmap.md:178`, present and unticked. The clause is a statement about the content of `tasks.md`, so a grep proves it before the merge. It does not need the archive to have happened. Met.
- The follow-up is a plain bullet, not a `- [ ]` task, so it does not add an open checkbox that the task checker or the delivery gate would count. Consistent with how `ship-change` treats the archive.
- `tasks.md:99` ("leaving both lines unticked until the archive (AC-8)") matches the new AC-8, and the 3.2 check expects `- [ ]` on the line, which is true at `roadmap.md:79`.
- Config rule "every acceptance criterion id appears in at least one task": holds (AC-8 at `tasks.md:34`).

## 7. Omission detection
Test strategy and evidence expectation for AC-8: the proof is two greps (the roadmap line, the follow-up text), no test. That is enough for a documentation criterion. Nothing else is missing for this delta.

## 8. Execution risks (top 5 failures)
1. Stale evidence row. Cause: `evidence.md:50` still quotes the old AC-8 ("at archive both lines are ticked ... in `openspec/roadmap.md`") and concludes `no proof`. Impact: the delivery gate reads an AC with no proof and blocks, which is the reason for this reword. Prevention: the evidence stage rewrites that row to the new text with the two greps (section 10).
2. The archive follow-up is skipped at archive, leaving `roadmap.md:79` and `:178` unticked. Impact: roadmap lags. Prevention: `tasks.md:133-135` names the step and the owner of the step (`ship-change`'s archive steps). Hypothesis only; no evidence of it happening.
3 to 5. No other risk comes from this delta.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Medium, fix during the evidence stage (not a plan defect) — `openspec/changes/stage-ceiling-consecutive/evidence.md:50`: the AC-8 row (evidence attempt 2, commit `c8b607f`) quotes the old AC-8 wording and says "no proof: the ticks happen at archive". Under the new AC-8 it has proof. Smallest correction: the evidence writer redoes the row with the new criterion text and the two checks (`grep -n "evidence-attempts-by-failure" openspec/roadmap.md` shows line 79 with "delivered by stage-ceiling-consecutive"; `grep -n "tick both" openspec/changes/stage-ceiling-consecutive/tasks.md` shows the follow-up at line 133). The evidence header's commit is also older than `96f7a76`, so the stage is retaken as the flow requires.
- [ ] Low — `openspec/changes/stage-ceiling-consecutive/tasks.md:34`: the check for clause 2 is not written anywhere as a command. Nothing blocks, because the grep above is enough, but a sentence in the AC-8 row would let the next reviewer repeat it. Not required.
- [ ] Low — prose still says "ticked at archive" at `proposal.md:40-41` and `requirements.md:17`. It is true and consistent with the follow-up; reword only if the owner wants one phrasing across the three places.

## 11. Explicitly out of scope
- [ ] Ticking the two roadmap lines now: the plan keeps them unticked until archive on purpose (`tasks.md:99`).
- [ ] Everything round 3 already settled (behaviour, design, specs, tasks 1.x and 2.x).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes, unchanged.
2. Is the result measurable? Yes: AC-8 now has two clauses, each checkable by a grep at the current commit.
3. Are error behaviors defined? Not applicable to this delta.
4. Are edge cases covered? Not applicable; the only edge is a skipped archive step, named at `tasks.md:133-135`.
5. Are dependencies clear? Yes: the clause 1 line is made by task 3.2 (done); the ticks belong to the archive steps of `ship-change`.
6. Are contracts defined? Yes, unchanged.
7. Can two developers interpret this differently? Only on "the archive follow-up ... ticks": it means the text of the follow-up says to tick, and the section above reads it that way; the AC names the follow-up in `tasks.md`, so the reading is stable.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes: 3.2 plus the follow-up.
10. What will be discovered too late? That `evidence.md:50` still carries the old wording; it is found now and listed.

## 13. Final conclusion
- Can we start? Yes; the plan is approved as reworded.
- What must be fixed? Nothing in the plan. The evidence row for AC-8 (`evidence.md:50`) is rewritten by the evidence stage.
- Main risk if ignored? The delivery gate keeps seeing "no proof" for AC-8 and blocks the pull request.
