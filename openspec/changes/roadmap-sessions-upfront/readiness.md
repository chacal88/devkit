<!-- devkit-stage readiness result=passed attempt=5 commit=a808b48d56281207a2fdd6ba19bcce830c4987d9 -->
# Readiness review: roadmap-sessions-upfront

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Blockers: 0. Stage reached: phases 1 to 7 ticked, phase 8 (flow version 2, design D-17) planned and not started. Attempt 5, over design attempt 7, tasks attempt 7, proposal attempt 6 and the four spec deltas, at `a808b48`. The caller named points to check and suggested no verdict; this verdict is mine.

Checks run here: `openspec validate roadmap-sessions-upfront --strict` valid; `python3 scripts/gen-catalog.py --check` exit 0; `python3 scripts/check.py` prints only the two errors D-17 names (the `flow.json` of `devkit` and `devkit-lite` differ from `flows/1.json`), which task 8.2 fixes, so that gate is red on the base by design. The attempt-4 file also tripped the language check at its line 39 (it quoted the Portuguese newer-flow line); this file describes that line in English and does not quote it, so that error goes away with the overwrite. A probe in a scratch copy of `a808b48` (under `/var/tmp/devkit-roadmap-sessions-upfront/probe5`, not the worktree): task 8.2 applied as written gives `check.py` clean (apart from the stale attempt-4 line above). The worktree is clean. Not run, left to the caller: the whole suite (task 8.6 runs it as a background command).

## 2. Scope validation
Classification: correct. Phase 8 does what the owner chose (flow version 2) and no more: a release of two flows, a filter by the flow's `helpers` in three readers, two skill sentences, test fixtures, documents. The proposal's criteria and the spec deltas now say the same thing about which grills get the triage.

## 3. Proposal review
Attempt-4 blocker (AC-5 and AC-14 said "every grill"): closed. `proposal.md:39-42` (What Changes), `:62-63` (the check), `:76-78` (the ADR), `:83-85` (a paragraph under Acceptance criteria saying the owner's answer of 2026-11-23 narrowed the grill's "every grill" and that `requirements.md`, the owner's record, keeps its words), `:90` (AC-5), `:99` (AC-14) and `:130-131` (Capabilities) all carry the clause "of a change that follows flow 2 or later of its script; a change on flow 1 keeps its grill with no triage until the owner moves it (D-17)". The spec delta says "whose flow lists the triage agent", which is the same condition, so proposal and spec no longer disagree. The sentence at `:83-85` is how a verifier who reads only the proposal learns that `requirements.md:47` is the older wording. No new scope was added; the tasks table already maps AC-5 and AC-14 to phase 8.

No other finding.

## 4. Design review
Claims re-derived on the branch (HEAD `a808b48`), beyond what attempt 4 confirmed:

- The null-safe read in `isRequirementsHelper` (D-17, "What the locks and the grill do"): `readFlow` returns null for a script with no `flow.json` (`guard.mjs:482-486`, `changeFlow` returns `flow: null`), so the `?.`/`?? []` form the revision names is the right one. Closed.
- The check's triage filter (`roadmap-loop.mjs:1439-1441`) maps `facts.actions` entries of kind `grill`; the revision's D-17 item 3 says the filter reads `helpers` of that action and that the emitted `triage` action keeps its shape (`change`, `kind`, `root`, `progressKey`, exactly the object built at `:1441`) with no `helpers`. Matches the code. The skill sentences now say where each reader finds the permission (the `next`/`session-next` action, `ask.action` in the coordinating session, the check's `triage` action itself). Closed.
- T-22 (the readout of the sample change): `flow-check.mjs:635-638` prints the newer-flow line only when the installed version is greater than the change's version, so a sample change that records `x-devkit-flow: 2` under an installed flow 2 reads as before and `SAMPLE_PT` and `SAMPLE_EN` stay as they are. `sampleChange()` (`flow-check.test.mjs:1179-1203`) opens the change with `openspec new change`, which records no pin, so adding the pin line to its `.openspec.yaml` is the right place; its only other user, `flow-check AC-9` (`:1361-1373`), compares the full and lean `--json` output with each other, so a pin line does not change it. Closed. (I could not run the edited test in the scratch copy: the devkit guard refuses my writes to product test files, and I did not route around it. The conclusion rests on the code above.)
- D-13 now lists T-18 to T-22 everywhere it must (design table, closing paragraph, R-18, the file list, the effort table, tasks.md header and phase 8 intro, 8.4). No stale "T-21" range is left; `grep` for "T-18 to T-21" and "task 8.4 runs the whole suite" finds nothing.

Everything attempt 4 confirmed (the version pin machinery in `check.py`, the four copies of the flow, `devkit-project` staying at 1, `recordPin`, `changeFlow`, `handOffFor`, `isRequirementsHelper`, ADR 0020, `rules.design`) is unchanged by `a808b48`: its diff touches only `design.md`, `proposal.md`, `tasks.md` and the readiness file.

## 5. Specs review
Unchanged since attempt 4 and complete: normative language and WHEN/THEN scenarios in all four deltas; every outcome of D-17's "What the locks and the grill do" has a scenario ("A change opened on flow 2", "A project slice", "A change on flow 1 keeps its flow's grill", "A change moved to flow 2", "The triage for a change on an older flow", "A grill on an older flow"). The null-safety the revision added is an implementation detail of an existing refused-`not-open` scenario, which covers it.

## 6. Tasks review
- Order: 8.1 (10 new tests, a named red command and `proof/red-8.txt`), 8.2 (data, digests, the untouched list with a `git diff --exit-code`), 8.3 (code and skills), 8.4 (T-18 to T-22, with a focused check command over `^upfront`, `^version-pin`, `^flow-check`), 8.5 (documents), 8.6 (gate). The attempt-4 Medium point is closed: the whole-suite run moved from 8.4 to 8.6, after the documents of 8.5, as a background command of the tool (13 to 45 minutes), with `check.py`, `gen-catalog.py --check` and `openspec validate --strict`; the rule for a failure beyond T-18 to T-22 moved with it and 8.6 points to it.
- 8.3 now names, per reader, where the permission is read and the null-safe form. Closed.
- Workflow follow-up lists the triage variants for the next real run (a flow-2 grill in the coordinating session and in a lone `/devkit change`; a flow-1 grill that asks the owner every question and shows the newer-flow line). Closed, as the project rule on real-run proof asks.
- Paths: every path is a real directory of the repo. The 8.2 check (`check.py` printing `all checks passed`) is confirmed by my probe.

## 7. Omission detection
Validation and errors, legacy records (no pin means flow 1, R-19), rollout (the three version numbers are already in the tree), rollback (revert; the downgrade behavior is change-version-pin's), observability (the newer-flow line in the readout and resume reply) and test strategy (named per layer, D-13 and D-15) are covered. No finding.

## 8. Execution risks (top 5 failures)
1. The whole-suite run of 8.6 finds a test beyond T-18 to T-22 that assumed flow 1 is installed. Impact: a 13 to 45 minute loop. Prevention: 8.4's rule (change it only where it assumed flow 1, with a row added to D-13; anything else is a defect of the change) and R-18.
2. The sibling change merges again and moves a flow or a version number. Impact: a conflict in `released-flows.json`, or flow 3 is the next free number. Prevention: the plan re-merges main before review (R-9); the implementer takes the flow version from the base's `released-flows.json` at that merge (Low, optional 1).
3. A copy of `flows/2.json` is missed in the `openspec/schemas/` folders. Prevention: 8.2 names all four and the `flow-check ... byte-identical` and `version-pin AC-7` tests go red.
4. The skills read `helpers` from the wrong place in a coordinating session. Prevention: 8.3 and D-17 item 2 now name each place; the `AC-5 skill` test checks the words `helpers` and the owner-asked-everything sentence.
5. The grill of a change under way (flow 1) shows no triage and an owner reads that as a defect. Prevention: the newer-flow line, the CHANGELOG "Projects" line, the flow doc and the proposal's own sentence at `:83-85`.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low — `design.md` R-9 / `tasks.md` 8.2: say that the version number of a flow follows the base's `released-flows.json` at the last merge, so a sibling's release in the meantime moves this one to the next free number.
- [ ] Low — `approval.md` on disk is the owner's approval of the plan before phase 8 (its header names ADR 0019). Phase 8 needs the owner's approval of this revision before 8.1, and 8.1's red base is the commit that holds it, as `tasks.md` says. This is the owner's gate, not a plan defect.

## 11. Explicitly out of scope
- [ ] Moving changes under way to flow 2 by a migration (D-17 "Rejected": the move is the owner's request).
- [ ] Raising `devkit-project` to version 2 (no content change).
- [ ] The release version numbers (already in the tree: devkit-openspec 0.32.0, devkit-core 0.14.0, marketplace 0.36.0).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: `check.py` prints two named errors on the base; the owner's choice (flow version 2) is recorded.
2. Is the result measurable? Yes: `check.py` green, the digests, 10 named new tests with a red record, T-18 to T-22 and the whole suite.
3. Are error behaviors defined? Yes: `not-a-role`, `own-sessions`, `not-open`, the check's silence, the owner asked every question, null-safety of the new read.
4. Are edge cases covered? Yes: no pin, pin 1, pin 2, a change moved by `flow <id>`, a brief naming no folder, `devkit-project`, the grill sent back by `unsourced`.
5. Are dependencies clear? Yes: 8.1 to 8.6 in order; the owner's approval of this revision before 8.1.
6. Are contracts defined? Yes: the `helpers` key on `grill` actions only (`[]` when none), the filter on `includes('requirements-triage')`, the `triage` action's unchanged shape, the digest function.
7. Can two developers interpret this differently? Not materially: the criteria now carry the flow-2 clause, and each skill names where it reads the permission.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? At most a test outside D-13's list that assumed flow 1 is installed; the whole-suite run of 8.6 finds it and 8.4's rule says what to do.

## 13. Final conclusion
- Can we start? Yes, at 8.1, once the owner approves this revision (the plan's approval gate, which this review does not replace).
- What must be fixed? Nothing before implementation. One Low note on the flow version number at the last merge.
- Main risk if ignored? A late sibling merge that moves the flow number; the plan already re-merges main before review.
