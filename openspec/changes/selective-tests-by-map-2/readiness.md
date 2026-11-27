<!-- devkit-stage readiness result=passed attempt=3 commit=22f70c31f9bcbba9c8e6babe685dd4b07de05725 -->
# Readiness review: selective-tests-by-map-2

Round 3. Head `22f70c31` on `origin/main` `e8991d6d` (the local ref; nothing was fetched). Artifacts read: `requirements.md`,
`proposal.md`, `design.md`, `tasks.md`, `decisions.md`, `release.md`, `.openspec.yaml` (`skip_specs: true`, so no `specs/` folder is
correct) and the record `docs/adr/a-change-runs-only-the-tests-its-files-map-to.md`. The plan files are uncommitted edits on top of
the head, so the stage-header commit is the head they were written against. Run on this tree: `openspec validate
selective-tests-by-map-2 --strict` (valid; `skip_specs` noted), `python3 scripts/check.py` ("all checks passed"),
`python3 scripts/gen-catalog.py --check` and `node plugins/compozy/kit/scripts/gen-agents.mjs --check` (both up to date);
`node plugins/openspec/hooks/deliver-check.mjs selective-tests-by-map-2` prints no `no release:` and no `release.md:` line.
`node scripts/test-suite.mjs --own-files` does not exist yet (phase 1 adds it) and the whole-suite part is long and the caller's.
`claude plugin validate .` was not run.
Earlier findings: R-1, R-2 (round 1) closed in round 2. B-1 and L-1 (round 2) are closed in this round, as below.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

An implementer can build every task without asking a question: the record is described once as unnumbered and numbered by the
release step, each repository file has its citation form, and every acceptance criterion has a task and a test row. No open
mandatory finding.

## 2. Scope validation
Classification: correct. Problem, goal, non-goals and out-of-scope are explicit and unchanged; the release files stay out of the
branch, and `release.md` carries `devkit-openspec: patch`, the one pack the change edits (`plugins/openspec/hooks/*`).

## 3. Proposal review
- B-1 is closed in `proposal.md`: lines 5-9 and 122-131 state the record `docs/adr/a-change-runs-only-the-tests-its-files-map-to.md`,
  listed unnumbered by `decisions.md`, cited `ADR [a-change-runs-only-the-tests-its-files-map-to]` and, where a file name follows,
  `(a-change-runs-only-the-tests-its-files-map-to.md)`, numbered by the release step, no file writing a number, no test or fixture
  citing it. The "drafted number", `<n>` and `renumber-adr` sentences are gone (grep over the five plan files finds `renumber-adr`
  only where `design.md:41` lists the agents that run a test command, which is true: `SKILL.md:118` and `:116`).
- L-1 is closed: `proposal.md:162-165` flags the descriptive slug against decision 3 of `0034-release-at-merge.md` for the owner to
  accept at plan approval, and says no checker enforces the wording.
- Low: `proposal.md` is about 1650 words against the two-page rule of `openspec/config.yaml`. Accepted since round 1.

## 4. Design review
Claims re-derived against the code at `22f70c31`; all hold:
- Record mechanics (the part that changed): `changeAdrs` (`deliver-check.mjs:2163`) keeps the `- ADR:` paths in `docs/adr/` with no
  `NNNN-` prefix, and `decisions.md:4` lists such a path. `rewriteCitations` (`release-merge.mjs:288`) turns `ADR [<slug>]` into
  `ADR <number>` and `<slug>.md` into `<number>-<slug>.md` where it names a file of an ADR folder, and `adrFileRe` handles the bare
  `(<slug>.md)` in a file of an ADR folder, which is the form of the three `Amended by` lines (`release-merge.test.mjs:939` is the
  test D-9 cites, at that line). `CITATION_PATHSPEC` (`deliver-check.mjs:35`) excludes `*.test.*`, `*-fixtures.*`, `test/`,
  `tests/` and `openspec/changes`, so "no test or fixture cites the record" and "`decisions.md` is not rewritten" are both true.
  `numberedRecord` (`change-loop.mjs:1866`) returns the listed path while it exists and resolves it to the one numbered file when it
  does not, so `decisionRecords` (task 3.2's check) reads the record before and after the step. `check.py` `check_adrs` takes an
  unnumbered record whose first line starts `# ADR [` and needs it listed by an active change, which holds.
- Header positions of D-9: ADR 0022 and ADR 0025 hold `- Amended by ADR 0034 (0034-release-at-merge.md)` at line 4; ADR 0026 holds the
  0031 line at line 7. `config.yaml` line 37's ADR list ends with the `ADR 0035` entry the plan appends after.
- `deliver-check.mjs` anchors (`isOpenspec` 266, `dirtyPaths` 299, `gitFacts` 318, `baseTip` 325, `stalenessBase` 331, `headInBase` 343,
  `ownFiles` 352 and its inline `git diff` at 359, `tasksItem` 561, `TRAIN_BRANCH` 1093, `RELEASE_FILE` 1705, `releaseEditOf` 2159),
  `docs/openspec-flow.md:347`, the two comment sites of D-8, and the pinned tests of the "Pinned rules" table were confirmed in
  round 2 at this same tree and none of them changed since (the head is the same `22f70c31`; the edits since are plan text only).
- Slug: no code reads it as the change id (`changeAdrs`, `numberedRecord`, `rewriteCitations` and `check_adrs` work from the path), so
  the descriptive slug breaks nothing and is now written as a flag.

## 5. Specs review
Not applicable: `skip_specs: true`, no capability changes. The `change-delivery` rule the plan relies on (a gate part not equal to a
train part needs its own row) is exercised by T-28. Every outcome row of S1 to S7, M1 to M7, the three D-6 outputs and the D-2 `why`
list has a row in D-11.

## 6. Tasks review
- Ordered by dependency; `- [ ]` boxes; each phase ends in a gate naming `node scripts/test-suite.mjs --own-files && python3 scripts/check.py`.
  The `check.py` part is green on this tree; the selective part does not exist on the base (it is what phase 1 adds).
- B-1 in the tasks: the preamble (`tasks.md:8-13`), 1.5, 2.2 (the `Gates:` citation and the exact ADR list entry), 2.4 (the
  accepted status without a rename, the exact `Amended by` line, the `git grep` check for the single form and for no test or fixture
  line) and 3.2 (no rename, no edit of `decisions.md` or `release.md`; `decisionRecords` must print `"unreadable":[]` and
  `"proposed":[]`, which holds after 2.4) now agree with `design.md` D-8 and D-9 and with `proposal.md`.
- Every AC id is in a task; T-1 to T-30 are placed. No task bumps a version, edits `CHANGELOG.md` or a pin line, or writes a literal
  ADR number, as the config `tasks` rule asks of a note-rule change.

## 7. Omission detection
- Error handling, rollback, compatibility, observability and test history: defined as in earlier rounds.
- Release mechanics: specified for the note rule, record citation form included.
- Nothing missing that changes behaviour or scope.

## 8. Execution risks (top 5 failures)
1. Cause: CI `fetch-depth` expression or `--own-files` on the real runner. Impact: `check` red or whole on every PR. Prevention: planned
   (T-29, the PR's first run read before auto-merge, workflow follow-up).
2. Cause: the map seed (D-4) is coarse. Impact: little saving, no wrong result. Prevention: planned (D-4, risk table, the train's whole run).
3. Cause: the release step's commit (version lines, rewritten citations, the record's number) lands after the evidence. Impact: stale
   evidence if misjudged. Prevention: `0034-release-at-merge.md` decision 5 and `releaseEditOf` treat it as release-class; D-2 states
   how the own-files list counts it.
4. Cause: a file cites the record by a literal number or a test file cites the slug. Impact: a sibling takes the number, or the step
   cannot rewrite it. Prevention: planned (D-8 and D-9 name the form, task 2.4's `git grep` check, the Risks rows).
5. Cause: a base merge near `deliver-check.mjs` or the ADR list moves an anchor. Impact: wrong anchors in the plan. Prevention: planned
   (task 3.1 re-reads each anchor and edits `proposal.md` and `tasks.md` in the merge commit).

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low — `proposal.md` length (section 3). Nice to have.
- [ ] Low — the check line of the head and the anchors in section 4 were run at `22f70c31`; task 3.1 repeats them after the last base merge.

## 11. Explicitly out of scope
- [ ] Whether `openspec/schemas/**` and `openspec/specs/**` select tests: AC-4 and the owner's answer 2 decide that `openspec/` files select nothing unless the map names them.
- [ ] Changing decision 3 of `0034-release-at-merge.md` to enforce the slug: that is a change to the release rule, not to this plan.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: AC-1 to AC-9, each with a test row and a real-run case in 3.4.
3. Are error behaviors defined? Yes, git failure included.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes: the CLI mode, output lines, map shape and refusals, the CI expression and the record's citation form.
7. Can two developers interpret this differently? No on the points that change behaviour; the record's citation form is now one string per file.
8. Are any decisions implicit instead of written? No: the slug departure from ADR 0034 decision 3 is flagged for the owner.
9. Do the tasks fully deliver the intended outcome? Yes; the CI half is a declared workflow follow-up (`tasks.md` "Workflow follow-up").
10. What will be discovered too late if implementation starts now? Only what the real runner shows (the CI expression), which the plan reads before auto-merge.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? Not applicable.
- Note for the conducting session: this review used the local `origin/main` ref (`e8991d6d`) without fetching. A different base means a new
  round. Editing `release.md` after approval asks the owner again (decision 2). The owner accepts the descriptive slug (L-1) at plan approval.
