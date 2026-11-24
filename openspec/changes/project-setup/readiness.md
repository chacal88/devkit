<!-- devkit-stage readiness result=failed attempt=6 commit=364a9c9f9784f72209881ee5dbb6eacf73de1a9e -->
# Readiness review: project-setup

Attempt 6. This reviews the plan as revised at `364a9c9` ("revise project-setup's plan on the merge of
trains 5 to 9"), on top of the merge `f1dcefa` that brought `origin/main` at `c09860c`. The review ran
on branch `project-setup` with a clean tree. I fetched nothing. The local `origin/main` is `c09860c`,
and `git rev-list --count HEAD..origin/main` prints 0, so the base has not moved since the revision.

Checks run on this tree:
- `openspec validate project-setup --type change --strict`: valid. The bare `--strict` form says the
  id is ambiguous, because a change and a spec share the name. That is not an error of the package.
- `python3 scripts/check.py`: "all checks passed".
- `python3 scripts/gen-catalog.py --check`: exits 0.
- `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check`: "21 CompozyOS agents are
  up to date".
- `claude plugin validate .`: "Validation passed".
- Gate 1.4, run as written: exits 0.
- Gate 6.10's test part, whose files all exist on the base: green (7 files, 8 tests).
- The named-test parts of gates 3.6 and 5.6, run at the paths before the move with
  `--concurrency=2` and the two `GITHUB_*` variables: green (18 files, 222 tests).
- Not run here: the touched-file list of gates 2.9 and 7.8, which is long and is the caller's run.

The owner's approval is stale. `approval.md` records `Readiness: sha256:47f97f2eae4a`, the hash of
attempt 3. The plan files have changed since then, so the owner approves the revised plan again once
it passes this review.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

Both Mandatory fixes of attempt 5 hold on the merged tree (section 4):
- M-7: the base check names the fixed commit `c09860c` and is green.
- M-8: every gate runs through `node scripts/test-suite.mjs`, T-1 and T-2 are dropped, T-31 moves
  `SUITE_FOLDERS`, and the suites `suite-speed` split are pointed at their new files.

Every code claim I re-derived checks out. One Mandatory fix is left, M-9. It is narrow and fits in
one task. Task 6.7 names a literal ADR number, which the project's task rule forbids, and it tells the
implementer to make edits to the record that are already on the tree. The fix is a rewording of task
6.7 with no change of scope.

## 2. Scope validation
Classification: correct. The problem, the in-scope list, the ten ACs and the non-goals have not
changed. The revision adds no behaviour. It brings the plan in line with what trains 5 to 9 brought:
- the train records `openspec/trains/` are treated as history;
- the `c561553` fixtures are skipped;
- the `merge-check` step is named.

## 3. Proposal review
Problem, goal, the three modified capabilities, Impact and Dependencies are clear and true at
`364a9c9`:
- The Impact list names `test-suite.test.mjs`, `scripts/test-suite.mjs`, `train-loop.mjs` and the
  split suites.
- Dependencies give `f1dcefa`/`c09860c` and name `suite-speed`, `post-merge-validate` and
  `project-slice-claim`.
- The exit criteria use the suite script.

Low: the proposal is 177 lines (section 10).

## 4. Design review
Attempt 5's fixes, checked against the tree:

- **M-7 (base check): fixed.** Task 1.1 and gate 1.4 check `git merge-base --is-ancestor c09860c HEAD`.
  It exits 0, and so does the whole of gate 1.4. D-12 step 6 and the Workflow follow-up put the next
  check on the commit the next merge brings, never on the moving ref.
- **M-8 (suite command and wiring): fixed.**
  - `scripts/test-suite.mjs` has the shape D-10 and the tasks header state. `SUITE_FOLDERS` lists the
    four folders, two of them the setup folders. File arguments outside them exit 2 (`parseArgs`
    throws `UsageError`, and `main` returns 2). Several `--test-name-pattern` flags pass through.
    `suiteFiles` is exported.
  - `test-suite.test.mjs` holds the constants `SETUP` and `COMPOZY_SETUP` and the probe text "only the
    compozy-setup folder is in the suite" that T-31 names. Its two `suite-speed AC-1` tests exist.
  - Every test file the gates name exists on the base. Under the old setup paths, the only exceptions
    are `setup-block.test.mjs` and `kit-installer.test.mjs`, which phase 4 creates.
  - Every `--test-name-pattern` of the gates matches a test in a file that the same gate names. The
    exceptions are the new names `^setup ...` and `^format: the Setup section`, which the plan
    creates.
- **D-13 grep, re-run by me** over every `*.test.mjs` of the four suite folders, for `openspec-setup`,
  `compozy-setup` and the two `verb-unknown` texts:
  - Every hit is a row of D-13: T-3 to T-14, T-15, T-17, T-18, T-19, T-20, T-22, T-30, T-31, and the
    run comments of tasks 2.1 and 2.2.
  - Each named test exists in the file its row gives.
  - The tests outside the touched-file list that read the devkit skill only read the `- \`review\``
    item and a `## Loop` line, which the Setup text leaves alone: `review-round.test.mjs` and
    `change-loop.test.mjs` `post-merge-validate 3`.
- **D-8 sources.** Every non-test line outside the history that names an old skill is covered:
  - in the hooks: `change-loop.mjs`, the ten reply texts; `compozy-driver.mjs` `FIX['kit-missing']`;
    `flow-check.mjs`, two texts; `guard.mjs` `changeFlow`; `merge-setup.mjs` `POINTER` and its comment;
    the strips in `project-loop.mjs` and `train-loop.mjs`. `train-loop.mjs` already imports from
    `merge-setup.mjs`.
  - in the documents and other files: D-11, task 2.6 (the agents' generated headers) and task 2.2.
  - `git grep` finds no other file.
- **D-1, D-2.** The `startMode` order is `findRoot`, `readDevkitSettings`, `VERB_ROUND`, the verb list
  `['change', 'roadmap', 'status', 'project', 'train']`, then `projectGate`. `DRIVERS` is exported,
  `DRIVER_ROUND = { script: 22 }`, and `LANGUAGE_TAG` is not exported. These match the design.
- **D-7.** The `##` headings of `plugins/openspec/skills/devkit/SKILL.md` are the twelve that T-28 pins
  (`change-loop-compozy.test.mjs`). The `argument-hint` ends `| status | train | project [<name>]`.
  The first item of `## Start` ends with the `settings.driver` sentence that D-7 rewords.
- **D-9.** The history claims hold:
  - `openspec/trains/7.md` names the setup test paths 11 times.
  - Both `c561553` fixtures name `openspec-setup`.
  - No spec delta of an unarchived merged change names an old skill, so a later archive brings none
    into `openspec/specs/`.
- **D-12 steps 4 and 7.** I diffed the six MODIFIED blocks of the `compozy-kit-setup` delta against the
  canonical spec. They differ only where the canonical text says `compozy-setup`. The canonical block
  "The kit's agents are generated from the Claude agents" names no old skill. The
  `change-coordination` block equals the canonical requirement plus `setup`. The canonical scenarios
  "The train verb" and "The train verb with words after it" are both kept. No unarchived merged change
  MODIFIES any of these requirements: `post-merge-validate` and the others only ADD, or touch other
  capabilities.
- `c1ac8c4`, `c09860c` and `f1dcefa` resolve, so the N-15 fixture's source bytes can be read from git
  by the implementer. The test itself reads the fixture, not history.

One re-derivation fails:

- **M-9 (task 6.7).** `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md` already reads
  `# ADR 0031: ...`, `- Status: accepted` and `- Number: 0031, ...`. The plan revision `09654b7`
  renamed the record and edited its title and `Number:` line: `git show 09654b7 -M -- docs/adr/` shows
  the diff. Task 6.7 says the opposite: "the guard kept the plan stage from editing it, so this task
  also sets its title line to `# ADR 0031: ...` and its `Number:` line". Its check is
  `grep -c "^# ADR 0031: "`. Details in section 6.

## 5. Specs review
- The package validates. The language is normative, and every requirement has WHEN/THEN scenarios.
- The `project-setup` delta now exempts the train records and the past-commit fixtures in "The
  removed setup skills are named nowhere". That matches D-9 points 1 and 2, and N-10's skips.
- The `compozy-kit-setup` and `change-coordination` deltas match the canonical text as described in
  section 4.
- No requirement lives only in a support doc.

## 6. Tasks review
- The tasks have checkboxes and are ordered by dependency. Each phase is one `## N.` group ending in a
  gate that names its command, and every AC id is in at least one task (the table at the top of
  `tasks.md`).
- Every gate is one command made of `&&` parts with no `|`. Every test run passes `--concurrency=2`
  and sets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF`. The parts that exist on the base are green
  (header).
- **M-9: task 6.7 breaks the project's task rule and describes work already done.**
  - The rule, in the `rules.tasks` of `openspec/config.yaml`: "A task that writes an ADR or bumps a
    version names 'the next free number on origin/main at the last merge before review', never a
    literal number or version".
  - Task 6.7 names that rule. It then writes the literal into an instruction ("sets its title line to
    `# ADR 0031: ...`") and into its check (`grep -c "^# ADR 0031: " docs/adr/0031-...`). The
    fallback "or the number the renumber step gave it" is prose, not a command.
  - Its reason ("the guard kept the plan stage from editing it") is false at `364a9c9`. The title,
    `Number:` and `Status: accepted` lines are already there. So the task's three edits to the record
    are no-ops, and "Set the record ... to `accepted`, quoting `approval.md`" leaves open whether the
    `Accepted by:` line, which quotes the approval of attempt 3, is rewritten after the new approval.
  - Two implementers can differ here: one leaves the line alone, the other rewrites it.
- Low: task 5.1 runs its red file with `--test-name-pattern="^format: the Setup section"` and expects
  T-15 to fail in it. No task before 5.1 says to apply T-15's rename (task 5.1 says "Apply T-15's
  `ship`/`merge_method` assertion"). Without the rename, the pattern matches nothing, and the suite
  treats that as no error. Gate 5.6 would then skip the test, which only gate 7.8 would run. Section 10
  has the fix.
- Every task path falls under a real folder, or under a folder that the task itself creates by
  `git mv`: `plugins/openspec/skills/devkit/` exists and holds only `SKILL.md`, and `plugins/compozy/`
  holds `README.md` and `skills/`.

## 7. Omission detection
- Validation, error handling and refusals: covered (D-3 exits 2 and 3, B-12, B-14, B-16; D-1 for an
  unreadable config, N-16).
- Idempotency and re-runs: covered (`fill`, B-4, B-15, R-2, R-5).
- Parser decisions for unterminated or odd input: covered (D-3 "How it writes", B-11, B-12). This
  satisfies the "Parsers" rule of `context`.
- Rollback and migration: covered (Migration Plan, N-15).
- Compatibility with the siblings and trains 5 to 9: covered (D-12, D-9).
- Test strategy and evidence: phases 3 to 6 are test-first with red files, D-14 has the real runs per
  case, and the conducting session's own part is R-6, which follows the `CLAUDE.md` real-run rule.
- Observability: not applicable.

## 8. Execution risks (top 5 failures)
1. **Cause:** task 6.7 run as written. **Impact:** the implementer sets a title that is already set and
   then decides alone whether to rewrite the `Accepted by:` line after the re-approval. If a later
   merge renumbers the record, the literal check either fails or is skipped by judgment.
   **Prevention:** M-9.
2. **Cause:** T-15 not renamed before the red run of 5.1. **Impact:** red-5 lacks T-15, and gate 5.6
   skips it. **Prevention:** section 10, first item. N-10 would still force the rename by gate 6.10,
   because the old test name holds `openspec-setup`.
3. **Cause:** `main` moves again before the last merge before review (several changes are in flight).
   **Impact:** the deltas or the file names drift. **Prevention:** as written: D-12 step 6, the
   Workflow follow-up, tasks 6.5 and 6.6, and the loop's `merge-check` step.
4. **Cause:** `change-loop.test.mjs` grows past its recorded 371.4 s (`archive-release-pin`'s
   `proof/full-suite.txt`), above the roughly 300 s per file that `CONTRIBUTING.md` asks for.
   **Impact:** the train's whole-suite wall clock grows. **Prevention:** as written (Risks: a split is
   its own change, and the evidence names the time).
5. **Cause:** the host's `-p` mode cannot drive the typed skill with `--resume` answers. **Impact:**
   R-1 to R-6 need an interactive run. **Prevention:** as written (D-14 fallback, recorded per file).

## 9. Mandatory fixes before implementation
- [ ] Medium — `openspec/changes/project-setup/tasks.md` task 6.7 (the sentences from "The record was
  renamed to ..." to the end of its Check) — M-9: a literal ADR number in an instruction and in a check,
  against `rules.tasks` of `openspec/config.yaml`; and a stated fact ("the guard kept the plan stage
  from editing it") that is false at `364a9c9`, so the task asks for edits already made and leaves the
  `Accepted by:` line undecided — Smallest correction: say that the record's title, `Number:` and
  `Status:` lines already carry the number of its file name (set at the plan revision `09654b7`) and
  move only with the renumber step. Say in one sentence whether `Accepted by:` is rewritten to quote
  the new `approval.md` once the owner approves the revised plan. Write the check without a literal,
  for example: the record's title line names the number its file name carries
  (`docs/adr/<n>-one-setup-verb-replaces-the-two-setup-skills.md` and `# ADR <n>: `, with `<n>` read
  from the file name).

## 10. Optional improvements (within scope)
- [ ] Fix during implementation: in task 5.1 (or 2.4), apply T-15's rename
  (`format: the Setup section has the GitHub step: ...`) before the red run, so its pattern finds the
  test (section 6).
- [ ] Nice to have: `proposal.md` is 177 lines, and the rule in `rules.proposal` is "under two pages".
  The Impact and Dependencies paragraphs repeat `design.md` Context and D-12 and could point to them.
- [ ] Nice to have: the design header still says the first draft and earlier revisions were written
  against `f81f53b`/`cf34ff2` and `6569874`/`c663f21`. That is history, so it is accurate but long.

## 11. Explicitly out of scope
- [ ] Out of scope (all in `requirements.md`): the `script` driver, changing or copying the checkers, a
  task-source key, writing `budget`, `design:` or `models:`, writing or removing `delivery.train`,
  re-running setup in consumer projects, and bulk GitHub settings.
- [ ] Owner-run: the real-run proof of R-3 on a GitHub repository. D-14 records the fallback.
- [ ] Separate change: splitting `change-loop.test.mjs` under the 300 s rule.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes. There are ten ACs, each with tasks and a test or a real run.
3. Are error behaviors defined? Yes: the writer's exits 2 and 3, the verb outside a repository, an
   unreadable config, a missing kit installer, and a `delivery.train` that the loop refuses.
4. Are edge cases covered? Yes: CRLF, a missing final newline, an empty file, an inline `devkit:`
   value, a second block, tab indents, the `compozy` driver re-run, and old projects.
5. Are dependencies clear? Yes. The base is `f1dcefa`/`c09860c`, the siblings are named, and the
   checks are fixed.
6. Are contracts defined? Yes: the `plan`/`apply` JSON, `--where`, the suite command and the folder
   list.
7. Can two developers interpret this differently? On one point: task 6.7's handling of the record
   (M-9).
8. Are any decisions implicit instead of written? One: whether `Accepted by:` is rewritten after the
   re-approval (M-9).
9. Do the tasks fully deliver the intended outcome? Yes, once task 6.7 is reworded.
10. What will be discovered too late if implementation starts now? A phase 6 task that asks for edits
    already made, and a check that names a number the renumber step may change.

## 13. Final conclusion
- Can we start? No. Reword task 6.7 (M-9), then run the readiness review again. After it passes, the
  owner approves the revised plan, because `approval.md` is stale.
- What must be fixed? Section 9, M-9 only. M-7 and M-8 of attempt 5 need no further work, and every
  code claim I re-derived holds at `364a9c9`.
- Main risk if ignored? Low operationally: a no-op task and a literal check at the record's renumber.
  But it breaks a written project rule that the readiness review enforces, and it leaves one decision
  to the implementer.
