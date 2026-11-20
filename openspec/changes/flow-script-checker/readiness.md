# Readiness review: flow-script-checker

(No stage header on this file: the change is the previous-script folder that proves AC-7, and the reviewer agent of today does not write one.)

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round: 2 of this change. The four blockers of round 1 (M1 to M4) are fixed and verified against the repository. No mandatory finding is open. Section 10 lists seven small, non-blocking corrections, mostly places where the revision updated `design.md` D-10, D-11 and `tasks.md` but left a summary line elsewhere in the package in its round-1 wording.

Base facts relied on (given by the caller, not re-run): suite 671/671 in about 8.5 min; `check.py` and `gen-catalog.py --check` green; OpenSpec CLI 2.0.0. Re-run here: `openspec validate flow-script-checker --strict` is valid.

## 2. Scope validation
Classification: correct. Unchanged from round 1; the revision adds no capability. The new "waiting for the owner" outcomes are one more way into an end state that already exists, so scope did not grow.

## 3. Proposal review
Consistent with `requirements.md` and `design.md` on what matters (schemas, header, checker, readers, writers, update path, CI pin). Two summary lines are stale after the revision (section 10, items 1 and 2).

## 4. Design review

### M1, the conduct tests: verified
D-10 names three edits in `plugins/openspec/hooks/conduct-check.test.mjs`. Checked against the file:
- the `planFiles` helper (`:79-93`) writes `requirements.md` only for `devkit`, and its file loop already lists `requirements.md`, so the one-line change is enough;
- the test at `:167-173` hand-builds a `devkit-lite` change with `proposal.md` and `tasks.md` (`:170`): the one red test of round 1;
- the test at `:353-364` passes through the helper; its title ("no planning row of it is an owner row") becomes false once the lite script has a grill. The added assertion is sound: `planningStep` returns `grill` before the missing-artifact check (`conduct-check.mjs:263-265`), so it holds even with `tasks.md` also removed.

Completeness of the list: every `devkit-lite` and `writeChange(` site of the file (`:17, :80, :170, :376, :597, :769, :843, :855, :866, :933, :1318`, the `CONFIG` and ship-config strings) matches the classification in D-10 (ticked task, archived, exit 3 before planning, or synthetic facts). Round 1 already ran the emulation on a scratch copy (22 red, 1 red after the helper); with the two other edits the count of changing tests is three, and none of the other sites reaches the grill. I did not repeat the run; the list is complete by reading.

### M2, archived and answers without `artifacts`: verified as specified
D-6 "Facts gathered" decides an archived change from `locateChange` (`deliver-check.mjs:218-228`, which returns `{ archived: true }` for a dated folder) before any OpenSpec call except `--version`; walk rule 1 needs no other fact. A live change whose answer has no `artifacts` (or no `tasks` from `instructions apply`) is exit 3 quoting the body; the exit-3 list of "Command line" carries it. Tests are named in 5.1 with a real archived folder (wrapper `openspec` that fails on anything but `--version`) and a wrapper that answers the error body with exit 0. Spec scenario "An archived change" matches. One gap of detail (section 10, item 3).

### M3, owner and unshipped stages: verified, with two small gaps
Rule 2 now ends `waiting-for-owner` for a stale owner stage (`approval-stale`, the `approval` stage with `staleAfter: ["readiness"]` in the D-5 JSON) and for a pending file of a stage with `shipped: false` (`unshipped-role-pending`); rule 6 is a last guard on every `next`, with `no-role` for the rest. Consistent with section 8 of `docs/coordination-design.md` (`:280-281`): all three outcomes are the existing state "waiting for the owner", and none is a fifth state. The spec delta has the scenario "No next stage names a role that cannot act". Tests: two named in 4.1, plus the "never names `owner` or an unshipped role" assertion. Gaps: section 10, items 4 and 5.

### M4, texts the lite grill makes false: verified
`tech-lead/AGENT.md:30-32` in both copies and `loop.yaml:100` in both copies hold the quoted texts (checked; the `.compozy` and plugin copies are identical on those lines). D-11 has the replacement wording and `tasks.md` 7.3 lists all four places. No test pins those texts (searched `grill` under `plugins/compozy`, `.compozy`, `scripts`: only the four files). The other grill-related claims of the repository (`conduct/SKILL.md:24,26`, `docs/openspec-flow.md:225`) hold under a lite grill.

### Mechanics re-checked
- Every `Gate:` line (1.3, 2.7, 3.4, 4.4, 5.4, 6.6, 7.7) parses with the regex of `deliver-check.mjs:280` (`^Gate:[^`]*`([^`]+)``), none holds a `|`; headings are `## N.`.
- No checkbox line is indented or fenced; `tasks.md` has no fenced block.
- New tests are each named before their code (4.1, 5.1); the failing reason is stated in each phase's "Test first".
- Spec delta valid under `--strict`; every requirement has WHEN/THEN scenarios; the new owner scenario and the archived scenario are present.

## 5. Specs review
No finding. The exit-code scenario agrees with D-6 (0 next, archived or previous script; 1 waiting; 2 blocked; 3 usage).

## 6. Tasks review
Every AC maps to tasks and a way to verify (table unchanged and consistent with 4.1, 5.1). One wording slip in 4.2 (section 10, item 4). The size of 4.2 (the state engine in one task) was noted in round 1 and stays acceptable.

## 7. Omission detection
Validation, errors, owner waits, archive and previous-script legacy are now covered. No new omission.

## 8. Execution risks (top 5 failures)
1. Cause: the implementer follows 4.2's "rules 1 to 3 and 5" literally and skips rule 6. Impact: the guard test of 4.1 is red and sends them to D-6. Prevention: item 4 below.
2. Cause: 7.3 touches eight files of the CompozyOS pack and its copy under `.compozy/`. Impact: one copy edited, one not. Prevention: the "byte-identical" idea of D-9 applies; run `diff` of each template pair after 7.3.
3. Cause: AC-7 self-proof depends on no header in this folder. Impact: 7.5 as written already runs before the verifier; keep it so.
4. Cause: an archived-change readout whose title line needs the script name. Impact: two implementations differ in the text (item 3).
5. Cause: `docs/openspec-flow.md` edits touch lines 19, 37-63, 72, 104-107, 327, 489-512 in one task (7.1 and 7.3 together). Impact: a pin test red in the middle; 7.1 names the order.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] `proposal.md` Impact, bullet `devkit-compozy`: says "one description line of the loop template (and of this repo's `.compozy/`)". After M4 it is also `loop.yaml:100` and `agents/tech-lead/AGENT.md:30-32`, in both places. The owner reads the proposal at plan approval.
- [ ] `design.md` "Implementation plan": the per-surface list says `conduct-check.test.mjs (helper)` (now three edits), lists the devkit-compozy surface as `loop.yaml` only and the repository surface as `.compozy/loops/openspec-change/loop.yaml:39` only (add `loop.yaml:100` and both `tech-lead/AGENT.md`), and omits `skills/openspec-setup/SKILL.md` (the `@latest` line 18). D-11's version line and CHANGELOG text call the compozy change "one template line" / "the loop's schema description"; say "the loop's and the tech-lead's grill wording". `requirements.md:187-188` says the loop grills only `devkit` and cites D-10; the cite is D-11.
- [ ] D-6 / D-7 for an archived change: the title line shows the script name (`roteiro devkit`), which needs the schema; say whether it is read from the archived folder's `.openspec.yaml` or left out, and that `stages` is `[]`. The 5.1 test checks only the exit code and `end.state`.
- [ ] `tasks.md` 4.2 says "the walk (rules 1 to 3 and 5 of D-6)": rule 6 (the last guard) is not named; D-6 lists rule 6 before rule 5. Say "rules 1 to 3, 5 and 6" (rule 4 is the delivery, phase 5) and renumber so the guard is last.
- [ ] D-6 rule 2 and rule 6, reason codes: `mockup` has both `owner: true` and `shipped: false`, so a pending `mockup.md` matches two sentences (owner wait and `unshipped-role-pending`); and rule 6 names `approval-stale` for any `owner` role, which is wrong for an `approval.md` with `result=failed`. State which code wins (suggestion: `unshipped-role-pending` for any unshipped stage; `approval-stale` only for a stale one; `no-role` otherwise) and keep the `TEXT` table in step.
- [ ] `tasks.md` 2.2: the `approval.md` template line says "the four lines of the `stop-plan-approval` row"; the row at `ship-change/SKILL.md:37` is the form, as D-10 now cites. No change needed beyond keeping the placeholder values unreadable as `APPROVED`.
- [ ] After 7.3, `diff` each template file of `plugins/compozy/skills/compozy-setup/templates/` against its `.compozy/` copy for `loop.yaml` and `tech-lead/AGENT.md` (they are identical on the edited lines today).

## 11. Explicitly out of scope
- [ ] The coordinators, `/devkit`, locks, the language setting, the two-PR model, `devkit-project`, removing the old checkers (rounds 15 to 24).
- [ ] The CompozyOS loop's own grill for lite changes (round 21 replaces the loop; only its text is corrected here).
- [ ] The `panel` plugin.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: nine criteria, each with a named test or a recorded output.
3. Are error behaviors defined? Yes, including the OpenSpec error body and the archived change.
4. Are edge cases covered? Yes, including stale approval and a pending file of an unshipped role.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes: header grammar, `flow.json`, JSON v1, exit codes, readout text. Archived title line is the one loose detail.
7. Can two developers interpret this differently? Only at items 3 and 5 of section 10, both without effect on a gate.
8. Are any decisions implicit instead of written? No material one.
9. Do the tasks fully deliver the intended outcome? Yes; M1 and M4 are now in 2.5 and 7.3.
10. What will be discovered too late? Nothing material: the conduct red at gate 2.7 is gone from the plan.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation; section 10 is for the author or the implementer to apply in passing.
- Main risk if ignored? The owner reads a proposal whose Impact understates the compozy edits, and 4.2's rule list leaves the last guard to a failing test.
