<!-- devkit-stage readiness result=passed attempt=10 commit=57967ccf75cb7f645c5499ec6780c752c97750d3 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD 57967cc (clean tree). Since attempt 9 (1a74229) the only commit is the plan revision 57967cc. It
edits `design.md` (the Context at lines 40-43, two rows of the D-15 table, D-17 and the paragraph after the siblings
table) and `tasks.md` (the preamble, 2.2's Check, and the Checks of 3.0, 4.0 and 5.0). No code changed:
`git diff --stat b439e7a HEAD` lists only `design.md`, `tasks.md` and `readiness.md`. Phase 1 is done, 2.0 to 2.2 are
ticked, and 2.3 to 2.5 are open.

Checks run at HEAD:
- `openspec validate coordinator-loop-fixes --strict` and `... --type change --strict --no-interactive` both print
  "Change 'coordinator-loop-fixes' is valid".
- `python3 scripts/check.py` prints "all checks passed".
- I did not run the gates' whole-suite part, `node scripts/test-suite.mjs`. The caller's machine notes forbid it,
  and no result was handed over. The revision changes no test or code, so attempt 8's filtered runs still apply.
  Those runs showed three failures, which are exactly the ones 2.3 and 2.4 fix.
- `openspec/config.yaml` is identical on HEAD and on the local `origin/main` ref (4eccbdc). No rule was added since
  the last approval. `rules.readiness` (author is not the writer) is applied.

The caller gave no verdict, and this review relies on none.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes. Both of attempt 9's blockers are closed, and no copy of the old gate policy is left.

## 2. Scope validation
Classification: correct. The revision only aligns the remaining copies of the gate rule. It adds no behaviour.

## 3. Proposal review
No findings. The exit criteria (`proposal.md:135-137`) match D-17. The length item is carried in section 10.

## 4. Design review
Attempt 9's B2 is closed. `design.md:40-43` now says the whole suite runs at each phase gate from 2.5 on, from the
conducting session, and again on the train. It also says the files a phase touches run with `--concurrency=2` in its
last task's Check. Both statements match D-17 (`design.md:1170-1199`).

I searched `design.md`, `proposal.md`, `requirements.md`, `tasks.md` and the spec deltas for any other copy of the
old policy: "only on the delivery train", "delivery train's whole suite", "it chooses" and "passes as written". The
only hit is the ticked 1.6 / 2.0 text, which D-17 keeps on purpose. The D-15 rows (`design.md:939`, `:974`) and the
risk rows (`:1573`, `:1587`) now say "the gates' whole suite, the train".

The code anchors the gate rule depends on hold, re-read at HEAD:
- `trainParts` splits on `&&` and trims (`plugins/openspec/hooks/deliver-check.mjs:846`).
- `byTrain` and `missingGates` filter on `trainParts.includes(c)` (`:526-527`).
- `parseTasks` sets `command` only on `Gate:` lines (`:487`).
- `trainOn` needs a devkit script (`:2074`).
- The train is `node scripts/test-suite.mjs && python3 scripts/check.py` (`openspec/config.yaml:30`), and the
  `Gates:` rule is at `openspec/config.yaml:42`.

The new D-17 sentence says the session runs the gate "as the `gate` item of `plugins/openspec/skills/devkit/SKILL.md`
says: the gate's command as written, locally, in the background". The gate item (`SKILL.md:114`) says "Run
`detail.command` in Bash, alone". It does not say "in the background". This is a Low wording item (section 10). The
plan's own instruction (background) is unambiguous, and it matches `CLAUDE.md`'s rule for the suite.

## 5. Specs review
No findings. Strict validation passes. The revision touches no spec delta.

## 6. Tasks review
Attempt 9's B1 is closed. The Checks of 3.0 (`tasks.md:216`), 4.0 (`:298`) and 5.0 (`:365`) now name the previous
phase's moved runs, `check.py` and the previous gate's other parts. Each also says "gate N's whole suite is the
conducting session's, never this task's":
- 3.0 runs 2.4's `Then` part with the `^jira-entry-followups AC-10 ` call (`tasks.md:201-206`, `:193`).
- 4.0 runs 3.8's `Then` part (`tasks.md:286-288`) and `gen-agents.mjs --check`. These are gate 3.9's other parts
  (`:289`).
- 5.0 runs 4.6's `Then` part (`tasks.md:353-355`), `gen-agents.mjs --check` and `test -s .../proof/checks.txt`. These
  are gate 4.7's other parts (`:356`).

6.1's Check (`tasks.md:435-437`) never named gate 5.9, and it is unchanged. The preamble (`tasks.md:36-39`) and
D-17's last bullet (`design.md:1196-1199`) say the same thing.

## 7. Omission detection
No findings.

## 8. Execution risks (top 5 failures)
1. Cause: the local `origin/main` (4eccbdc, train 14) is ahead of this branch. It holds the archive of
   `stage-ceiling-consecutive` (6556d19), whose delta shares the "Attempt ceilings" requirement with this change.
   Impact: 3.0's merge or `merge-check` may report a spec delta that no longer applies cleanly.
   Prevention: as planned. 3.0 merges, D-17 names this meeting, and `merge-check` sends a red result to
   `merge-defect` (D-7).
2. Cause: a flaky or unrelated test anywhere in the suite reds a phase gate.
   Impact: `gate-red` hands a `fix-gate` for a test the phase never touched.
   Prevention: as planned (D-17's base-added tests first, and `waiting-owner-decision`).
3. Cause: the session runs the whole-suite gate in the foreground, by the gate item's "alone".
   Impact: the Bash tool's 10-minute ceiling cuts a run of about 10 minutes.
   Prevention: the plan says "in the background" (`tasks.md:37-38`, `design.md:1180-1181`), and `CLAUDE.md` says the
   same.
4. Cause: `deliver-check.test.mjs` grows with phase 3's tests.
   Impact: it crosses CONTRIBUTING's 300 s.
   Prevention: as planned (the D-16 split rule, and each file run alone before the gate).
5. Cause: a sibling takes 0032 or 0033 before 6.1.
   Impact: stale ADR links.
   Prevention: as planned (`renumber-adr` in 6.1).

## 9. Mandatory fixes before implementation
No findings.

## 10. Optional improvements (within scope)
- [ ] Low, Nice to have: `design.md:1180-1181` and `tasks.md:36-38` attribute "in the background" to the `gate` item
  of `plugins/openspec/skills/devkit/SKILL.md`, but that item (`:114`) says "alone". Smallest correction: write "as
  written, alone (the `gate` item), as a background command".
- [ ] Low, Nice to have: `docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md:53` still says ADR
  0023's "`## Decision` section untouched", while D-22 appends a Note inside it. Carried.
- [ ] Low, Nice to have: `proposal.md` exceeds `rules.proposal`'s "under two pages". Carried.
- [ ] Low, Nice to have: the claim in `decisions.md` that 0033 "was the next free number across the remote branches"
  is not checked (no fetch). `renumber-adr` handles a clash. Carried.

## 11. Explicitly out of scope
- [ ] The other open plans in `openspec/changes/` that still use filtered gates.
- [ ] Everything attempts 7 to 9 listed as out of scope.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. It is unchanged.
2. Is the result measurable? Yes. Each gate is one command, and each AC maps to tasks (`tasks.md:57-77`).
3. Are error behaviors defined? Yes. A red gate goes through D-3, and a base-added failing test becomes a D-15 row
   and one plan revision.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes. The merge tasks, the conducting session's fetch and the siblings table (D-17) cover
   them.
6. Are contracts defined? Yes. The train parts and `byTrain` are confirmed in code.
7. Can two developers interpret this differently? No. The merge tasks now name their exact runs.
8. Are any decisions implicit instead of written? No. Gate 1.6's exception is written.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing plan-level. The only known late item is
    the sibling archive in risk 1, which 3.0 and `merge-check` are planned to meet.

## 13. Final conclusion
- Can we start? Yes. Continue with 2.3.
- What must be fixed? Nothing mandatory. The four Low items are optional.
- Main risk if ignored? Ignoring the Lows risks only wording drift. The real risk is the sibling archive already on
  `origin/main`, which 3.0 is planned to merge.
