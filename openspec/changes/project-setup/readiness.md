<!-- devkit-stage readiness result=passed attempt=3 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Readiness review: project-setup

Attempt 3 (the last), after the planner fixed blocker M-15 and items M-16 to M-19 of attempt 2.
Reviewed at `df0beb0` on branch `project-setup` (the revision is in the working tree, uncommitted).
The base is `origin/main` at `c1ac8c4`. Per the caller's note I ran no test suite and fetched
nothing. I judged the revision by reading and grepping.

Checks run: `openspec validate project-setup --type change --strict` is valid.
`python3 scripts/check.py` ("all checks passed") and `python3 scripts/gen-catalog.py --check` are
green on the base. `claude plugin validate .` was not run (not executable in this shell), so it is
not counted. `grep -rnE "openspec-setup|compozy-setup" openspec/changes/project-setup/specs/` prints
nothing.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The one blocker of attempt 2 (M-15) is closed and the four optional items (M-16 to M-19) are
decided in the artifacts. No Mandatory finding is open. Known and accepted by the caller:
`decisions.md:8` says "today 0021" for the sibling record; task 1.2 re-reads the number at
implementation time and tasks 6.6 and 6.7 say "the next free number on `origin/main` at the last
merge before review".

## 2. Scope validation
Classification: correct. The problem, the in-scope list and the non-goals are explicit
(`proposal.md`, `requirements.md` Out of scope). The revision added no scope: it reworded two
requirement blocks and added sentences to decisions the design already took.

## 3. Proposal review
Unchanged since attempt 2: problem, goal, three modified capabilities, impact and non-goals are
clear, and the sibling `compozy-driver` facts were re-derived at `cb39d27` in attempt 2.

## 4. Design review
Re-derivation of the attempt-2 findings:

- M-15 closed. The two ADDED requirements of `specs/project-setup/spec.md` now read "The removed
  setup skills are named nowhere" (lines 214-226) and "A project set up with the old skills keeps
  working" (lines 228-234), and neither body holds a literal old name (the grep above is empty).
  `design.md:376-402` (D-9, point 3) now says the same: the blocks the delta ADDS are worded without
  the literal names, so after the archive no block of either canonical spec, ADDED, MODIFIED or
  untouched, holds an old name, and the scenario "The files of the repository" holds for its own
  requirement. D-9's sentence "this skip matches nothing" is now true for the MODIFIED bodies, and
  task 6.1 greps the delta files to prove it. The reading is the same in D-9, the spec, task 6.1 and
  task 6.3 (N-10 skips exactly the blocks the delta MODIFIES).
- M-16 closed. `design.md:180-184` (D-3): `plan` and `apply` exit 3 with one stderr line naming the
  file and the read error, print no JSON, write nothing; `setup` reaches the script in that case only
  when the folder has no `openspec/changes/`. B-12 (`design.md:600`) holds the case, and the spec
  scenario "A configuration file that cannot be read" (spec lines 186-188) states it.
- M-17 closed. N-16 (`design.md:587`) says the fixture holds `openspec/changes/` beside the config
  folder, and why. Re-derived against the code: `findRoot` is at `guard.mjs:78`, and `startMode`
  (`change-loop.mjs:1714-1728`) takes `start = findRoot(cwd)` before it reads the verb.
- M-18 closed. `design.md:132` and `design.md:302-304`: with no config the step copies the template,
  which brings `schema`, `rules` and `operations`, and `context` is the only part it then writes.
  Both places read the same.
- M-19 closed. `design.md:77-84` (D-1) decides it: the usage reply stays the shared one, with the
  reason.

## 5. Specs review
- Normative language and WHEN/THEN scenarios are present for every requirement. The MODIFIED
  blocks are whole copies. `openspec validate --strict` is valid.
- Every outcome row of D-1, D-3, D-5 and D-8 has a scenario (checked in attempt 2, unchanged).
- The spec's scenario "The files of the repository" ("with this change's spec deltas applied to the
  capability specs") agrees with D-9 and N-10.

## 6. Tasks review
- Order, checkboxes, one `## N.` group per phase, a gate task per phase, every AC id in at least
  one task (table at lines 30-41), "next free number" wording in 6.6 and 6.7, and no literal ADR
  number or version to write.
- Task 6.1's check holds the grep of the spec deltas (nothing printed) and N-10's failure list;
  task 6.3 leaves the canonical requirement bodies alone, as D-9 says.
- Gate patterns were verified in attempt 2 on the trees where they run; `^compozy-driver readiness`
  lives only on the sibling's tree, which task 1.1 merges.
- Gates that exist on the base and are short ran green here (`scripts/check.py`,
  `gen-catalog.py --check`). The long suite is run by the caller.
- The config rule "names each test file" is met through D-13.

## 7. Omission detection
- Idempotency and re-run: covered (B-4, B-15, N-17, R-2). Error handling and refusals: covered in
  D-3, the tests and the spec, now including the unreadable config for `plan` and `apply`.
- Rollback and migration: covered. Observability: not applicable. Test strategy: real run per case
  (D-14); phases 3 to 6 are test-first.

## 8. Execution risks (top 5 failures)
1. Cause: task 6.9 cannot go green before `compozy-driver` is archived on `main` (N-10 is red by
   design until 6.5). Impact: phase 6 waits on a sibling. Prevention: declared in the risk table and
   in 6.5; the owner knows.
2. Cause: the moved kit tests' path arithmetic (one level up). Impact: gates 2.3 and 2.5 fail with
   "cannot find" errors. Prevention: D-10 lists the lines; the gates show the rest.
3. Cause: two records numbered 0022 from task 1.1 to 6.6. Impact: a link or the config ADR line
   points at the wrong record. Prevention: task 1.2 and the risk table say every reference names the
   file.
4. Cause: the host's `-p` mode cannot answer a skill's questions. Impact: R-1 to R-5 fall back to an
   interactive run. Prevention: D-14 records the fallback.
5. Cause: the sibling's text moved between `cb39d27` and its merge. Impact: a line number or a name
   in D-10 is off. Prevention: task 1.2 re-reads every named file and fixes drift in the plan first.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Nice to have: `design.md:269-271` (D-7): the frontmatter description grows by one sentence
  (about 1193 characters now). `scripts/check.py` has no limit, but the host may cut a long
  description in its skill list. Keep the new sentence short.

## 11. Explicitly out of scope
- [ ] The `script` driver, changing the checkers, a task-source key, writing `budget` or `design:`,
  re-running setup in the consumer projects, bulk GitHub settings (all in `requirements.md`).
- [ ] The real-run proof of R-3 on a GitHub repository (owner-run; D-14 records the fallback).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: ten ACs, each with tasks and a test or a real run.
3. Are error behaviors defined? Yes: the writer's refusals and usage errors (D-3, B-6 to B-16), the
   unreadable config for `start`, `plan` and `apply` (D-1, D-3, N-16, B-12) and the spec scenarios.
4. Are edge cases covered? Yes: the block parser, the re-run, the empty file, CRLF, the inline value.
5. Are dependencies clear? Yes: `compozy-driver` is a declared precondition (gate 1.4, 1.2, 6.5).
6. Are contracts defined? Yes: `plan` and `apply` JSON, exit codes 2 and 3, `kit-installer.mjs`,
   the replies in both languages.
7. Can two developers interpret this differently? No open point found; D-9 point 3, the spec and
   task 6.1 now read the same.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Only what task 1.2 and 6.5 are
    there to catch: drift in the sibling's files and the number of the record.

## 13. Final conclusion
- Can we start? Yes, after the owner approves the plan (`approval.md`).
- What must be fixed? Nothing before implementation.
- Main risk if ignored? Phase 6 waits on the archive of `compozy-driver`, as declared.
