<!-- devkit-stage readiness result=passed attempt=7 commit=cd03c1d66c74c0213221d863b13650f7cf3c62f8 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD cd03c1d (clean tree). One commit came after attempt 6 (db28ef2): cd03c1d changes only
`design.md` (D-22's ADR 0023 bullet, D-16 row T139, the D-22 line of "Decisions and ADRs") and `tasks.md`
(5.6), plus their stage headers. Nothing outside the change folder changed since attempt 6 reviewed 41c69c5
(`git diff 41c69c5 HEAD --stat` excluding the change folder is empty). So `openspec/config.yaml` has no new rule
and the base of every gate is the one attempt 6 ran. I read the whole diff. I re-derived the placement it
describes against `docs/adr/0023-the-model-is-chosen-by-stage.md` and the tests that read that file. Parts not
touched since attempt 6 carry that report's verification and that of attempt 5.

Checks run at HEAD: `openspec validate coordinator-loop-fixes --strict` and `... --type change --strict
--no-interactive` both print "Change 'coordinator-loop-fixes' is valid"; `python3 scripts/check.py` exits 0.
No gate command, test pattern or test file changed in this revision. The gates attempt 6 ran green on the same
base were not run again.

The caller gave no verdict, and this review relies on none.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The one mandatory finding of attempt 6 is fixed as proposed:
- D-22 now appends the Note to ADR 0023's `## Decision` section, right after the stage-models Note and
  before `## Consequences`.
- T139 holds the section's text as it is on the base (decisions 1 to 7 and the stage-models Note). It asserts
  that this text is unchanged and immediately followed by the new Note.
- 5.6 and the "Decisions and ADRs" line say the same.

No artifact of the change still says "after its stage-models Note" with "`## Decision` untouched". No mandatory
finding is open.

Because `readiness.md` changes, the readiness hash recorded in `approval.md` (`sha256:6dff42735a92`) is stale.
As D-7 says, the owner approves the revised plan again, and that approval also lets `accept-decisions` accept
the change's settings ADR. This is the flow's next step, not a blocker of this review.

## 2. Scope validation
Classification: correct. The revision moves one Note's stated place and the matching test definition. It adds
no behaviour.

## 3. Proposal review
No findings. Unchanged since attempt 6. The Low length item stands (section 10).

## 4. Design review
Re-derived at HEAD:
- `docs/adr/0023-the-model-is-chosen-by-stage.md`: `## Decision` at line 28, decisions 1 to 7 at lines 30 to 65,
  `Note (stage-models, 2026-11-23)` at line 67, ending "No decision's text changes." and one blank line,
  `## Consequences` at line 76. "Appended right after the stage-models Note and before `## Consequences`"
  therefore names a single place. "The section's text on the base (decisions 1 to 7 and the stage-models Note)"
  is exactly lines 28 to 75 today.
- Task 5.1 writes T139 before 5.6 edits the ADR, so the held text is copied from the base file. T139 fails
  until 5.6, which is the red-first order 5.1 already states for T135 to T140.
- The tests that read ADR 0023 today (`plugins/openspec/hooks/stage-models.test.mjs:1364` to `:1432`) check only
  the file name, the title, and the inclusion of the phrases "without writing its stage file", "result=failed"
  and "never a stage subagent". Appending a Note keeps every one of them true, so no existing test row is
  missing (the `rules.tasks` grep rule).
- D-12's ADR 0011 Note goes in `## Context` and keeps "`## Decision` is not touched" (`design.md:721-727`, T78).
  That is consistent: the two ADRs differ in where their Notes live, and each bullet names its own place.

## 5. Specs review
No findings. The deltas did not change, and strict validation passes.

## 6. Tasks review
No findings. 5.6's new wording matches D-22 and T139. Gate 5.9 already runs `change-loop-declared.test.mjs`
under `^coordinator-loop-fixes`, which covers T139.

## 7. Omission detection
No findings.

## 8. Execution risks (top 5 failures)
1. Cause: the held Decision text is sliced with a different end than T139 states (for example, it drops the
   blank line before `## Consequences`). Impact: "immediately followed by the new Note" fails on whitespace
   alone. Prevention: as planned. T139 names the boundary, and the repository's tests already slice with
   `indexOf('## Decision')` and `indexOf('## Consequences')`.
2. Cause: `post-merge-validate` archives a sibling between phase 3 and this change's last merge. Impact: the
   main spec keeps a scenario the code no longer meets. Prevention: as planned (6.1's re-check, D-7).
3. Cause: `deliver-check.test.mjs` takes most of the new checker tests. Impact: it crosses CONTRIBUTING's 300 s
   mid-change. Prevention: as planned (D-16 split rule).
4. Cause: a sibling takes 0033, or the number of the change's ADR, before the last merge. Impact: stale links in
   the Notes of ADR 0011 and ADR 0023. Prevention: as planned (`renumber-adr` covers both; T78 and T139 read the
   number through `decisions.md`).
5. Cause: the stage walk's ceiling and the delivery checker's limit drift apart. Impact: an authorized round is
   refused by one of them. Prevention: as planned (`authorizedRounds`, `ceilingOf`, T105 to T113, T132).

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: `docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md:52`. Decision 5 still
  says "ADR 0023 gains a dated Note pointing to this record, its `## Decision` section untouched", while D-22
  now appends the Note inside that section. The plan reads "untouched" as "its text on the base unchanged", so
  the implementer has nothing to decide. A reader of the accepted ADR, though, would find the Note in the section
  it calls untouched. Smallest correction, before the owner's approval accepts the record: "... a dated Note
  appended after its stage-models Note, the text of its `## Decision` section unchanged".
- [ ] Low, Nice to have: `proposal.md` is 2,471 words against `rules.proposal`'s "Keep it under two pages"
  (unchanged since attempt 6).
- [ ] Low, Nice to have: `decisions.md` says 0033 "was the next free number across the remote branches when it
  was drafted". This was not checked (no fetch). Nothing depends on it, because `renumber-adr` handles a clash.

## 11. Explicitly out of scope
- [ ] A plan revised after the approval in `ship-change` used without the loop, beyond the sentence D-7 adds.
- [ ] `decisions.md` and `mockup.md` edited after the start are not in the digest.
- [ ] The roadmap coordinator's third review round in session-per-change mode (a design Non-Goal).
- [ ] The `fresh-base-check` half of item 21 and every "Dropped" item.
- [ ] Whether the desktop app's monitor wakes the session on green checks (AC-11's deferred half).
- [ ] The CompozyOS driver's red-gate question and two-round review loop (Non-Goals, D-19).
- [ ] `resolve-base-conflict` in a project with the delivery train (D-5).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. Four retros and four field findings, each kept item anchored to code.
2. Is the result measurable? Yes. T1 to T141 and the real runs of D-14.
3. Are error behaviors defined? Yes. Exit codes, refusals in both languages, the record reader's errors and the
   guard's refusals.
4. Are edge cases covered? Yes, including both drivers, both archive orders, the `devkit:` fallback, both blocks
   in one file, and either ADR renumbered.
5. Are dependencies clear? Yes. The siblings (D-17), and the two records with the approval that accepts each one
   (D-7).
6. Are contracts defined? Yes. Unchanged since attempt 6.
7. Can two developers interpret this differently? No longer on T139. The place of the Note and the held text
   are both named.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing known. The residual risks are
    section 8's, each with a planned prevention.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the revised plan again (D-7). The readiness hash changed with this
  file, and that approval also accepts the change's settings ADR.
- What must be fixed? Nothing mandatory. Before that approval, consider rewording decision 5 of the settings
  ADR (section 10).
- Main risk if ignored? Low. The accepted settings ADR would describe ADR 0023's `## Decision` as untouched
  while it holds the new Note.
