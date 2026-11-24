<!-- devkit-stage readiness result=passed attempt=7 commit=e4ab96393ebe360a3e1c031347b3ad0cfc01fe11 -->
# Readiness review: project-setup

Attempt 7. This reviews the plan at `e4ab963` ("fix task 6.7 of project-setup's plan (M-9)"). The
review ran on branch `project-setup` with a clean tree, and I fetched nothing. Since attempt 6
(`364a9c9`), only two commits changed the plan:
- `2a4eb1b` holds the attempt 6 report.
- `e4ab963` changes task 6.7 in `tasks.md` and the record paragraph of D-11 in `design.md`. It
  touches no other line.

The local `origin/main` is still `c09860c`, and `git rev-list --count HEAD..origin/main` prints 0.
`openspec/config.yaml` has not changed since attempt 6, so its rules are the same ones attempt 6
applied. Attempt 6 checked every other code claim and every gate part that exists on the base, on
this same base, and they all held. They are not repeated here.

Checks run on this tree:
- `openspec validate project-setup --type change --strict --no-interactive`: "Change
  'project-setup' is valid".
- `python3 scripts/check.py`: "all checks passed".
- The record part of the new task 6.7 check, run as written: it resolves `n=0031` from the file name
  and exits 0. Its ADR 0004 header part exits 1, as expected before the implementation writes that
  line.

The owner's approval is stale. `approval.md` records `Readiness: sha256:47f97f2eae4a`, the hash of
attempt 3. The owner approves the revised plan again before `implement`.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes, after the owner approves the revised plan again (`approval.md` is stale)

M-9, the only Mandatory fix of attempt 6, is fixed (section 6). No Mandatory finding is open.

## 2. Scope validation
Classification: correct. The revision adds no behaviour and no scope. No findings.

## 3. Proposal review
No findings beyond the Low length note in section 10. The proposal is unchanged since attempt 6.

## 4. Design review
D-11's record paragraph (`design.md` lines 610-618) now says three things:
- the record's title, `Number:` and `Status: accepted` lines are set;
- the implementation edits no line of the record;
- `Accepted by:` is not rewritten after the new approval.

I checked this against the tree:
- `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md` lines 1, 3 and 7 read
  `# ADR 0031: ...`, `- Status: accepted` and `- Number: 0031, ...`.
- `git show 09654b7 -M -- docs/adr/` shows that commit setting the title and `Number:` lines. The
  `Status: accepted` line is older, from `3a2c63c`. So "set on the branch since `09654b7`" is true:
  all three lines hold from that commit on.
- No commit after `09654b7` touches the record.
- Line 4, `Accepted by:`, names `openspec/changes/project-setup/approval.md`, so the reason the
  design gives for leaving it alone holds.
- The `renumber-adr` step exists: `plugins/openspec/hooks/conduct-check.mjs:56` and `:401` emit
  "renumber <from> to <to> and every reference", and `change-loop.mjs:1034` hands it to
  `tdd-implementer`. That matches the task's statement that the renumber moves the title, the
  `Number:` line and the links.

No findings.

## 5. Specs review
No findings. The specs are unchanged since attempt 6, and the package validates strictly.

## 6. Tasks review
- **M-9: fixed.**
  - `tasks.md` task 6.7 (lines 339-354) names the record as
    `docs/adr/<n>-one-setup-verb-replaces-the-two-setup-skills.md`, with `<n>` "the next free number
    on origin/main at the last merge before review". That is the wording `rules.tasks` asks for.
  - `grep -n "0031\|0025" tasks.md` finds no literal ADR number anywhere in `tasks.md`.
  - The task now says it edits no line of the record, and it decides the `Accepted by:` line: that
    line is not rewritten.
  - The check reads `<n>` from the file name. It then asserts the record's title, `Number:` and
    `Status:` lines, the `- Amended by ADR <n> (<file>)` header line in ADR 0004, and exactly one
    `Note (project-setup` there. It holds after a renumber.
  - The header form matches the existing line in `docs/adr/0004-devkit-per-project.md`
    (line 6, `- Amended by ADR 0021 (0021-...md)`) and D-11's form (`design.md:620`).
  - Task 6.4 (`tasks.md:312-314`) also writes the config's ADR line from the number the file name
    carries, so it is consistent.
- Low (carried over, unchanged): task 5.1 runs `--test-name-pattern="^format: the Setup section"`
  before any task renames T-15. See section 10.
- Everything else: no new findings. The task paths and gate commands are unchanged since attempt 6,
  which checked them on this base.

## 7. Omission detection
No findings. The revision closes the one open decision of attempt 6 (whether `Accepted by:` is
rewritten).

## 8. Execution risks (top 5 failures)
1. **Cause:** T-15 is not renamed before the red run of 5.1. **Impact:** red-5 lacks T-15, and gate
   5.6 skips it. **Prevention:** section 10. N-10 still forces the rename by gate 6.10.
2. **Cause:** `main` moves before the last merge before review. **Impact:** the deltas, file names or
   ADR number drift. **Prevention:** as written: D-12 step 6, tasks 6.5 to 6.7, and the loop's
   `merge-check` and `renumber-adr` steps. The 6.7 check now follows a renumber.
3. **Cause:** `change-loop.test.mjs` grows past its recorded 371.4 s. **Impact:** the suite's wall
   clock grows. **Prevention:** as written (Risks: a split is its own change).
4. **Cause:** the host's `-p` mode cannot drive the typed skill with `--resume` answers. **Impact:**
   R-1 to R-6 need an interactive run. **Prevention:** as written (D-14 fallback).
5. **Cause:** implementation starts on the stale approval. **Impact:** the gate refuses, or code
   lands on a plan the owner has not seen. **Prevention:** the owner approves the revised plan again
   before `implement`.

## 9. Mandatory fixes before implementation
No findings. M-9 is fixed.

## 10. Optional improvements (within scope)
- [ ] Fix during implementation: in task 5.1 (or 2.4), apply T-15's rename
  (`format: the Setup section has the GitHub step: ...`) before the red run, so its pattern finds the
  test.
- [ ] Nice to have: `proposal.md` is 177 lines, and `rules.proposal` asks for "under two pages".
- [ ] Nice to have: `design.md:614` says the three record lines are set "since `09654b7`". The
  `Status: accepted` line dates from `3a2c63c`. The statement is true, but "already set on the
  branch" alone would be exact.

## 11. Explicitly out of scope
- [ ] Out of scope (all listed in `requirements.md`, unchanged since attempt 6): the `script` driver,
  the checkers, a task-source key, `budget`/`design:`/`models:`, `delivery.train`, re-running setup in
  consumer projects, and bulk GitHub settings.
- [ ] Owner-run: the real-run proof of R-3 on a GitHub repository (D-14 fallback).
- [ ] Separate change: splitting `change-loop.test.mjs` under the 300 s rule.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes. There are ten ACs, each with tasks and a test or a real run.
3. Are error behaviors defined? Yes (exits 2 and 3, the verb outside a repository, an unreadable
   config, a missing kit installer, a refused `delivery.train`).
4. Are edge cases covered? Yes (CRLF, a missing final newline, an empty file, an inline `devkit:`, a
   second block, tabs, the re-run, old projects).
5. Are dependencies clear? Yes. The base is `f1dcefa`/`c09860c`, and the siblings and the renumber
   step are named.
6. Are contracts defined? Yes (the `plan`/`apply` JSON, `--where`, the suite command, the record's
   lines).
7. Can two developers interpret this differently? No material point. The open point of attempt 6,
   task 6.7, is now one reading.
8. Are any decisions implicit instead of written? No. `Accepted by:` is decided in D-11 and task 6.7.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing blocking. At worst, a
    renumber at the last merge, which the 6.7 check now tolerates.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the revised plan again. `approval.md` holds the
  approval of attempt 3.
- What must be fixed? Nothing mandatory. Section 10 lists one fix to make during implementation
  (T-15's rename before red-5).
- Main risk if ignored? Low: gate 5.6 might skip T-15, but gate 6.10 catches it.
