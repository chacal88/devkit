<!-- devkit-stage readiness result=passed attempt=2 commit=9184debf298ce02dbf1268f0ccbc8417947dce3d -->
# Readiness review: coordinator-field-fixes

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes, once the owner approves the plan (`approval.md`)

`openspec validate coordinator-field-fixes --strict` is valid. Round 1 found four decision-table
outcomes with no spec scenario; all four are now in `specs/` and carry a task. No open blocker.

## 2. Scope validation
Classification: correct. Eight defects, each with an AC, a decision (D-1 to D-8), a spec and tasks;
non-goals are explicit (`proposal.md:51-53`, `design.md:45-51`).

## 3. Proposal review
Problem, goal, capabilities (five new, two modified), impact, exit criteria and the owner's
approval items are clear (`proposal.md:159-176`). The breaking CI contract is flagged and tied to
ADR 0012. The roadmap line is in `openspec/roadmap.md` (still uncommitted in the working tree; it
travels with the change and task 7.1 checks it).

## 4. Design review
HEAD is still `9184deb`, the commit round 1 verified; claims re-derived again:
- `flow-check.mjs:153` `isPreviousScript = hasStageFile && !hasHeader`, called at `:220` and `:425`: as D-2 says.
- OpenSpec starts: only `flow-check.mjs:111` and `guard.mjs:583` spawn `openspec` in the hooks: the D-1 callers are the whole set.
- `deliver-check.mjs:468` `findChangePr`, `:1387` `selectCiChange`, `:1437` `archivePrCheck`; `guard.mjs:136` `changeSchemaAt`, `:145` `DEVKIT_SCHEMAS`: exist as D-4 and D-5 describe.
- Round 1 verified `change-loop.mjs#unfinished` ranks, the D-7 approval mechanism, the flow order and ADR numbering (last ADR is 0011); nothing in those files changed since.
- Gates on the base: `python3 scripts/check.py` passes. `python3 scripts/gen-catalog.py --check` passed in round 1 and nothing it reads changed. The other gates run new tests that fail by design before their phase.
- Tag `v0.13.0` exists locally (task 5.3 fixture source).

No failed re-derivation.

## 5. Specs review
Seven capability specs with normative text and WHEN/THEN scenarios. The four round 1 gaps are closed:
- D-7 "any other" row: `specs/project-setup/spec.md:76-78`.
- D-8 `same`: `specs/compozy-kit-setup/spec.md:31-33`.
- D-6 `unknown`: `specs/project-setup/spec.md:34-41`.
- D-1 session text: `specs/openspec-cli/spec.md:51-63`.
Every outcome row of the D-2 to D-8 decision tables has a scenario.

## 6. Tasks review
Ordered by dependency; every phase starts with red tests and saved failing output and has one
backticked gate without `|`. The four new scenarios are named in tasks 1.1, 5.1, 5.3 and 6.1. Task
4.4 now says which fenced block to copy; task 6.4 says the owner's yes is the plan approval. Paths
fall under real directories; the proof map covers AC-1 to AC-14. Ticked tasks stay a pure checkbox
list (the `Workflow follow-up` items are bullets).

## 7. Omission detection
Validation, errors, idempotency (`--apply` never overwrites), rollback (Migration Plan), legacy
records (previous script, first re-run with no manifest), compatibility (a `PATH` 1.x keeps
today's copy) and test strategy are stated. No finding.

## 8. Execution risks (top 5 failures)
1. `findChangePr` rewrite breaks a delivery path covered only by fixtures. Prevention: D-11 names each test; phase 3 gate runs all three modules' tests.
2. One `gh` call per merged PR for the files. Prevention: newest first, stop at the first own PR.
3. `changes-under-way.mjs --apply` writes `approval.md` into other checkouts. Prevention: only the `approval-not-applicable` rows, never overwrites, tested.
4. Real `gh` behaviour for `pulls/<n>/files` and the rulesets 403 text is assumed (Assumptions list); tests use fakes, so the next change's field check (A-16) is where it surfaces.
5. A project keeps the 0.16.0 workflow pin and sees no CI fix. Prevention: CHANGELOG and CI docs say to bump.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Commit `openspec/roadmap.md` with the plan so task 7.1's test reads a tracked file.

## 11. Explicitly out of scope
- Moving a previous-script change to the current script; OpenSpec 1.x; the round 16 points; worktree removal.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes, eight reproductions in `requirements.md`.
2. Is the result measurable? Yes, AC-1 to AC-14 with red-then-green proof files.
3. Are error behaviors defined? Yes, including the unreadable GitHub state.
4. Are edge cases covered? Yes (stale local main, worktree, no manifest, declared pin not installed, another schema).
5. Are dependencies clear? Yes, order and the CI three-file import constraint.
6. Are contracts defined? Yes: messages, JSON shapes, manifest, header form.
7. Can two developers interpret this differently? Not materially; texts to copy are in the design.
8. Are any decisions implicit? No; A-4, A-6, A-9, A-11 are resolved in writing.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? Real `gh` responses (see risk 4).

## 13. Final conclusion
- Can we start? Yes, after the owner's plan approval and acceptance of ADR 0012.
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable; the remaining risk is the unverified real `gh` behaviour, checked in the next change's field run.
