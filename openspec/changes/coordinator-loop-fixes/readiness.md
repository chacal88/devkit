<!-- devkit-stage readiness result=failed attempt=9 commit=b439e7ad8b250260b84a769b16b22359442236bd -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD b439e7a (clean tree). Since attempt 8 (c789b9b) the only commit is the plan revision b439e7a. It
answers attempt 8's B1 with option (a), the owner's choice ("Train's command (a)"). It changes D-17, the risk
table and R7b in `design.md`, the exit criteria in `proposal.md`, and in `tasks.md` the preamble, the gates 2.5,
3.9, 4.7, 5.9 and 6.6, and the Checks of 2.4, 3.8, 4.6, 5.8 and 6.5. No code changed. Phase 1 is done. 2.0 to 2.2
are ticked. 2.3 and 2.4 are coded but not ticked.

Checks run at HEAD:
- `openspec validate coordinator-loop-fixes --strict` and `... --type change --strict --no-interactive` both print
  "Change 'coordinator-loop-fixes' is valid".
- `python3 scripts/check.py` prints "all checks passed".
- I did not run the gates' whole-suite part, `node scripts/test-suite.mjs`, because the caller's machine notes
  forbid it, and no result was handed over. The filtered runs now in 2.4's Check are the ones attempt 8 ran: three
  failures, exactly the ones 2.3 and 2.4 fix. No code changed since.

The caller gave no verdict, and this review relies on none.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no. The revision missed two copies of the old gate policy. The worse one makes three
  implementer tasks run the whole suite (B1).

## 2. Scope validation
Classification: correct. The revision changes only which commands the gates name and where the filtered runs
happen. It adds no behaviour.

## 3. Proposal review
The new exit criteria (`proposal.md:135-137`) match D-17. The Low length item is carried (section 10).

## 4. Design review
Claims of the revision, re-derived at HEAD:
- The `Gates:` rule is quoted correctly from `openspec/config.yaml:42`.
- The train's command is `node scripts/test-suite.mjs && python3 scripts/check.py` (`openspec/config.yaml:30`).
- "Each part byte-equal to the train's part so that `deliver-check`'s `tasksItem` counts it as proven by the
  train" holds:
  - `trainParts` splits on `&&` and trims (`plugins/openspec/hooks/deliver-check.mjs:846`).
  - `tasksItem` moves a part with no row into `byTrain` when `trainParts.includes(c)` (`deliver-check.mjs:526-527`).
  - `trainOn` holds for a change on the `devkit` script (`deliver-check.mjs:2074`), and this change's
    `.openspec.yaml` says `schema: devkit`.
  - Every new gate's first two parts are exactly `node scripts/test-suite.mjs` and `python3 scripts/check.py`.
- "No pass row for the parts the train proves" holds:
  - `pr-verifier` writes a `train:` row for them and does not run them (`plugins/core/agents/pr-verifier.md:39`).
  - Only gate commands need rows. `parseTasks` sets `command` only on `Gate:` lines (`deliver-check.mjs:487`), so
    the filtered runs moved into Checks need no evidence row.
- The new R7b clause (the fake `gh` reports the remote tip as the PR head) closes attempt 8's Low item. It matches
  `test-fixtures.mjs:403`.
- "Gate 1.6 keeps its filtered text, and its filtered parts keep needing `pass` rows" is stated explicitly, with
  its cost. That cost is two filtered parts at verify. Accepted.

Finding B2 (section 9): the Context section still states the old policy (`design.md:40-42`).

## 5. Specs review
No findings. The "A phase gate" scenario (`specs/change-coordination/spec.md:61-63`) states what a gate step
carries, not what its command is, so the revision leaves it true. Strict validation passes.

## 6. Tasks review
The new gates follow the rule. The filtered runs moved into the last implementation task of each phase:
- 2.4 keeps the `^jira-entry-followups AC-10 ` call. The new text refers to it as "above", and it is in 2.4's Check
  (`tasks.md:193`).
- The runs added to 3.8, 4.6, 5.8 and 6.5 are the old gates' filtered parts, copied unchanged. The non-test parts
  (`gen-agents.mjs --check`, `test -s`, `grep -q`, `gen-catalog.py --check`, `command claude plugin validate .`)
  stay in the gates.

Finding B1 (section 9): the merge tasks 3.0, 4.0 and 5.0 still say "gate N passes as written".

## 7. Omission detection
No new findings. A Low item on the session's `--concurrency` choice is in section 10.

## 8. Execution risks (top 5 failures)
1. Cause: 3.0, 4.0 and 5.0 check "gate 2.5 / 3.9 / 4.7 passes as written", which is now the whole suite inside an
   implementer subagent.
   Impact: the subagent's run exceeds the Bash tool's 10-minute ceiling (the suite takes about 10 minutes on an
   idle 8-core machine, per `CLAUDE.md`). A base-added test that fails then fails the merge task's Check, though
   D-17 (`design.md:1166-1167`) makes it "a row for D-15 and one plan revision, not a failure of the phase".
   Prevention: B1.
2. Cause: a flaky or unrelated test anywhere in the suite now reds a phase gate.
   Impact: `declare gate-red` hands a `fix-gate` to the implementer for a test the phase never touched. A second
   red ends the run blocked.
   Prevention: as planned. The N.0 merge runs the tests the base added first (D-17). An unrelated red is a
   decision for the owner, through `waiting-owner-decision`.
3. Cause: `post-merge-validate` archives a sibling between phase 3 and the last merge.
   Impact: a main-spec scenario no longer holds.
   Prevention: as planned (3.6a, and 6.1's re-check, D-7).
4. Cause: `deliver-check.test.mjs` grows with phase 3's tests.
   Impact: it crosses CONTRIBUTING's 300 s.
   Prevention: as planned (the D-16 split rule, and each file run alone before the gate).
5. Cause: a sibling takes 0032 or 0033 before the last merge.
   Impact: stale links in the Notes of ADR 0011 and ADR 0023.
   Prevention: as planned (`renumber-adr` in 6.1).

## 9. Mandatory fixes before implementation
- [ ] B1. High, Mandatory before implementation (of 3.0).
  - Where: `tasks.md:216` (3.0), `:298` (4.0) and `:365` (5.0) each end their Check with "gate 2.5 / 3.9 / 4.7
    passes as written". After b439e7a, those gates are `node scripts/test-suite.mjs && python3 scripts/check.py
    ...`. These are implementer tasks: D-17 says "The implementer then runs ..." (`design.md:1161`).
  - Conflict: the plan says "No implementer task runs the whole suite" (`tasks.md:36`, `design.md:1188`), and it
    gives the whole-suite part to the conducting session.
  - Why it matters: two implementers will diverge. One runs the whole suite in a subagent, where it times out or
    hits base tests that D-17 says are not the phase's failure. The other runs the filtered runs and skips
    `check.py`.
  - Smallest correction: in each of 3.0, 4.0 and 5.0, replace "gate N passes as written" with "the runs of 2.4's
    Check that gate 2.5 held (resp. 3.8's, 4.6's) pass, and `python3 scripts/check.py` passes". For 4.0, add
    `gen-agents.mjs --check`. For 5.0, add `test -s openspec/changes/coordinator-loop-fixes/proof/checks.txt`.
    2.0's "gate 1.6 passes as written" is ticked and stays.
- [ ] B2. Medium, Mandatory before implementation.
  - Where: the Context of `design.md:40-42` still says "The whole suite runs only on the delivery train
    (`devkit.delivery.train`, below); a phase gate of this plan runs the files its phase touches with
    `--concurrency=2` (D-17)".
  - Conflict: that is the opposite of the revised D-17 (`design.md:1170-1195`). Each fix must change every copy of
    the literal it changes.
  - Smallest correction: one sentence. The whole suite runs at each phase gate, from the conducting session, and
    on the train. The files a phase touches run with `--concurrency=2` in its last task's Check (D-17).

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: D-17 (`design.md:1179-1181`) and the preamble (`tasks.md:37-38`) let the conducting
  session run the whole-suite part with a `--concurrency` it chooses. The `gate` item of
  `plugins/openspec/skills/devkit/SKILL.md:114` says "Run `detail.command` in Bash, alone", and the default is
  already `availableParallelism()` (`scripts/test-suite.mjs:86`). Smallest correction: drop the permission, or say
  that the session runs `detail.command` as written, in the background.
- [ ] Low, Nice to have: `docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md:53` still says ADR
  0023's "`## Decision` section untouched", while D-22 appends the Note inside it. Carried.
- [ ] Low, Nice to have: `proposal.md` is 2,494 words, against `rules.proposal`'s "Keep it under two pages".
  Carried.
- [ ] Low, Nice to have: `decisions.md` says 0033 "was the next free number across the remote branches". Not
  checked (no fetch). `renumber-adr` handles a clash. Carried.

## 11. Explicitly out of scope
- [ ] The other open plans in `openspec/changes/` that still use filtered gates.
- [ ] Everything attempts 7 and 8 listed as out of scope.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. It is unchanged since attempt 8.
2. Is the result measurable? Yes. Each gate is one command and each AC maps to tasks (`tasks.md:57-77`).
3. Are error behaviors defined? Yes. A red gate goes through D-3. The merge tasks' failure path is the open point,
   B1.
4. Are edge cases covered? Yes, except a base-added failing test under a whole-suite Check (B1).
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes. The train parts and the `train:` rows are confirmed in code.
7. Can two developers interpret this differently? Yes, on what 3.0, 4.0 and 5.0 run (B1).
8. Are any decisions implicit instead of written? No. Gate 1.6's exception is written.
9. Do the tasks fully deliver the intended outcome? Yes, once B1 is fixed.
10. What will be discovered too late if implementation starts now? At 3.0: an implementer asked to run the whole
    suite (B1).

## 13. Final conclusion
- Can we start? 2.3 to 2.5 can proceed: nothing in them depends on B1 or B2. Fix B1 before 3.0 is handed.
- What must be fixed? B1: the Checks of 3.0, 4.0 and 5.0 name the moved filtered runs, not "gate N as written".
  B2: the Context sentence at `design.md:40-42`.
- Main risk if ignored? An implementer subagent runs the whole suite at each phase's merge and times out, or
  fails a base test the plan says is not the phase's failure.
