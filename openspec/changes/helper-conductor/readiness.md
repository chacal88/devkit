<!-- devkit-stage readiness result=failed attempt=5 commit=a1afda47249cd413f543afbd7c9c8feada0d2ea5 -->
# Readiness review: helper-conductor

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no, until the three blockers of section 9 are fixed in `tasks.md` (and one line in `design.md`)

Round 5, on a1afda4 (the commit "order the add-only tasks of helper-conductor first"). Only `tasks.md` changed since round 4 (36423ba): the order paragraph of phase 2, tasks 2.14a, 2.14, 2.17, 2.18, the tick of 1.4 and 1.10, and the Workflow follow-up line. `openspec validate helper-conductor --strict` passes. No fetch was run.

## 2. Scope validation
Classification: correct. The reorder adds no behaviour. 2.17 and 2.14a move work earlier; the scope of the change is unchanged.

## 3. Proposal review
No findings. `proposal.md` lists `tick-gate.mjs` and `test-slots.mjs` as new files; the split does not change that.

## 4. Design review
Re-derived against code and design:
- `withLockFile` is exported from `plugins/openspec/hooks/change-loop.mjs:2388`, so 2.14a can import it with no edit of that file.
- `tickReady` and `localFacts` do not exist anywhere in `plugins/openspec/hooks/` today (grep: no match). They are new, and D-3 (`design.md:185-194`) puts them in `run-file.mjs` (after task 2.1), with `commonDirOf` and `localRunFilePath` in `guard.mjs`. D-4 (`design.md:251-270`) has the hook import them by dynamic `import()`.
- 2.17's own fs-only `commonDirOf` contradicts `design.md:190-194` ("Both live in `plugins/openspec/hooks/guard.mjs`") until 3.1; `design.md` needs one line on the interim copy (finding 3).

## 5. Specs review
No findings. The spec delta is unchanged since round 4. AC-3, AC-6, AC-14 and AC-22 keep their scenarios.

## 6. Tasks review
What the split keeps:
- 2.2, 2.3, 2.14a and 2.17 create only new files and `scripts/test-map.json` keys. None of them edits `guard.mjs`, `run-file.mjs`, `roadmap-loop.mjs`, `change-loop.mjs`, `deliver-check.mjs`, `conduct-check.mjs`, `status-line.mjs`, the devkit or ship-change `SKILL.md`, or `docs/openspec-flow.md`; 2.14a imports `withLockFile` only. This part of the request holds.
- 2.14a keeps the eight ledger cases of the original 2.14 (second whole suite, train first, new gate waits, train waits for gates in flight, third gate at `gates` 2, dead pid, broken ledger, two clones on one `DEVKIT_STATE_DIR`), but drops the stderr line `waiting for the train's suite` and the "starts after the train's ends" and "starts when they end" halves (finding 2).
- 2.14 keeps the cases of the `test-run` verb (no run file, exit code, `SIGTERM`, no `--` exits 3), the `conductor AC-22 ` and `suite-capacity AC-22 ` tests, and every other edit. No AC of the original 2.14 loses its task.
- 2.18 gates the add-only tasks; its `--concurrency=2` flag exists on the base runner.

What does not hold: findings 1 to 3 of section 9.

`release.md` exists and reads; no task bumps a version, edits a CHANGELOG line or numbers a record.

## 7. Omission detection
- No contract for the ledger module's functions (finding 2).
- Test-first order of 2.14 versus 2.14a (finding 2).

## 8. Execution risks (top 5 failures)
1. 2.17's test cannot pass: the hook needs `tickReady` and `localFacts` and the new run file shape, which only 2.1 (after the `multi-roadmaps` merge) adds. The implementer either stops or writes a second copy of D-3's rules, which drifts from 2.1's.
2. Two copies of `commonDirOf` outlive 3.1 because 2.17's text sends the move to the wrong task (2.15 does not do it).
3. Two developers write different ledger APIs for 2.14a, and 2.14's `test-run` verb then has to be bent to them.
4. The same ledger cases are written twice (2.14a and 2.14), or the second author skips "tests first, seen failing".
5. The hook's file-only facts differ from the tick's facts (D-15's one-fixture parity) when the hook carries its own copy.

## 9. Mandatory fixes before implementation
1. **Critical, Mandatory before implementation.** `tasks.md:268-274` (task 2.17) says the new `tick-gate.mjs` has `localRunFilePath`, `localFacts` and `tickReady`, and its test runs "every case 3.1 names" with no `hooks.json` entry. D-3 and D-4 put `tickReady` and `localFacts` in `run-file.mjs` and the hook imports them dynamically; task 2.1 (`tasks.md:114-131`) builds them and the run file's new fields (`task`, `ended`, `claims`, `holds`, `train`) in `run-file.mjs`, which the order paragraph (`tasks.md:105-110`) keeps for after the merge. Today none of them exists. The cases of 3.1 (`stopping-busy`, `no-task`, `ended`, a held place) need those rules and fields, so the test cannot pass add-only unless 2.17 copies D-3's rules into the module, which the plan neither says nor limits, and which splits D-15's parity test. Smallest correction: choose one and write it. Either (a) 2.17 carries an interim, fs-only copy of the D-3 rules and of the run file's reading in `tick-gate.mjs` (name which cases it tests), and 3.1 replaces it by the dynamic imports and deletes the copy, naming the parity test; or (b) 2.17 builds only the raw-envelope match, the output shapes and the cases that need no run facts, and 3.1 keeps the rest.
2. **High, Mandatory before implementation.** `tasks.md:211-222` (2.14a) and `:223-251` (2.14) overlap. 2.14 still says it creates `test-slots.mjs`, still lists the full ledger case list and the `files` map key, and keeps "tests first, seen failing" over cases 2.14a already wrote; 2.14a drops from its list the stderr line `devkit-test: waiting for the train's suite` and the "starts after the train's ends" and "starts when they end" halves. Also neither task nor `design.md:1073-1100` names the module's functions (acquire, release, read, the wait loop and its 15-second step), so "driving the module's own functions" has no contract. Smallest correction: in 2.14a, name the exports and their arguments (the caps `gates` and the state folder in; a slot or a "wait" out) and list every ledger case in full, stderr line included; in 2.14, cut the module, the ledger cases and the map key, and say it extends `test-slots.test.mjs` with the verb's cases and calls the module.
3. **Medium, Mandatory before implementation.** `tasks.md:270-272` says "2.15 moves [commonDirOf] into `guard.mjs` when `deliver-check.mjs` needs it". Task 2.15 (`tasks.md:252-264`) only adds `conductedOf` to `guard.mjs` over `localRunFilePath`; the task that places `commonDirOf` and `localRunFilePath` in `guard.mjs` is 2.1 (`tasks.md:118`). Also `design.md:190-194` says both live in `guard.mjs` with no word on 2.17's interim copy. Smallest correction: say "2.1 moves it" in 2.17 and 3.1, and add one line to D-4 or the risks of `design.md`: the hook's `commonDirOf` is its own fs-only copy from task 2.17 until task 2.1 puts the single copy in `guard.mjs` and 3.1's dynamic import replaces it, and the conductor test of `design.md:1344` checks both against `git rev-parse --git-common-dir`.

## 10. Optional improvements (within scope)
- [ ] Fix during implementation: 2.18's `selected` lines go in `evidence.md` as their own `pass` row (CLAUDE.md); the task may say so.

## 11. Explicitly out of scope
- [ ] The CompozyOS driver, `multi-roadmaps` parsing, starting work over SSH, a phone channel beyond the host's notification tool.
- [ ] The `flow-check.mjs` defect (its own follow-up change; the plan keeps it in the Workflow follow-up, as it should).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes.
3. Are error behaviors defined? Yes.
4. Are edge cases covered? Yes, apart from the dropped halves of finding 2.
5. Are dependencies clear? No: 2.17 depends on 2.1 and says it does not (finding 1).
6. Are contracts defined? Not the ledger module's functions (finding 2).
7. Can two developers interpret this differently? Yes, on 2.17's copy of the rules and on the ledger API.
8. Are any decisions implicit? The interim copy of `commonDirOf` and of the hook's facts.
9. Do the tasks fully deliver the outcome? Yes once the split is fixed; no AC lost its task.
10. What will be discovered too late? That the hook's test needs run-file code that waits for the merge.

## 13. Final conclusion
- Can we start? Not on 2.17 and 2.14a. 2.2, 2.3 are clear; phase 1 is done.
- What must be fixed? Findings 1 to 3 of section 9, all in `tasks.md` plus one line of `design.md`.
- Main risk if ignored? A second, drifting copy of D-3's rules in the hook.
