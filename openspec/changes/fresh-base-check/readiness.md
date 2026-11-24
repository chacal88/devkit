<!-- devkit-stage readiness result=passed attempt=3 commit=bdcd6bc7c09ac64db5df0eeffca039cfa6f36351 -->
# Readiness review: fresh-base-check

Round 3. Round 2 (attempt 2, at `90ea93b`) left one mandatory fix (F-1: the checks of tasks 1.2 and 1.3 split the new tests by phase in a way nobody could observe) and four optional items. This round checks that F-1 is closed, re-reads the revised text against the code and runs the gates.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

F-1 is closed. The checks of 1.2 and 1.3 now list the tests each task can turn green, and `design.md` D-8 has a phase table that agrees with them row by row. Three of the four optional items were taken up too. No blocker is open.

`openspec validate fresh-base-check --strict`: valid. Base checks at `bdcd6bc` (`origin/main` `4631376` is an ancestor of HEAD, no fetch; devkit-openspec 0.32.0 on both): `python3 scripts/check.py` passes ("all checks passed") and `python3 scripts/gen-catalog.py --check` is clean. Between `3a11b86` and this head no code, test or doc file changed: only `design.md`, `tasks.md` and `readiness.md` (`git diff --stat 3a11b86 HEAD`). So the round-1 results still hold for the existing gates: `command claude plugin validate .` passed and the phase-1 gate (`--test-name-pattern="^change-loop"` on `change-loop.test.mjs`, 176 tests) was green.

This round ran the phase-2 gate of task 2.4 on the base, as written (`TMPDIR=/var/tmp/devkit-fbc`, `GITHUB_HEAD_REF=probe-branch`, `GITHUB_BASE_REF=main`, patterns `^fresh-base-check `, `^roadmap-loop`, `^change-loop`, `^format: ship-change`, on `roadmap-loop.test.mjs`): 299 tests, 299 pass, 0 fail, 7 min 39 s, exit 0, tree clean afterwards. No gate is red on the base. The whole guard suite (3.2) was not run; it is the caller's long run.

## 2. Scope validation
Classification: correct

One problem (a stale `origin/<base>` makes the loop hand the wrong delivery step), one mechanism (the loop fetches once before it judges; the checkers stay readers). In and out of scope are explicit in `proposal.md` and `design.md` Non-Goals. The round-2 edits added no behavior: a phase table, a sentence about how the remote moves in the "stale" fixtures, and a split of test 8's assertion. `decisions.md` ("no ADR needed") still holds.

## 3. Proposal review
Unchanged since round 1 and sound: problem, goal, three ADDED capabilities, impact, dependencies and four owner-visible choices. The release number is "the next free one on `origin/main` at the last merge before review". No sentence about the repository is false at this head (devkit-openspec 0.32.0, `origin/main` `4631376`).

## 4. Design review
Re-derived this round, against live code and the test helpers:

| Claim | Result |
|---|---|
| New in D-8: `commitOrigin` pushes from the clone, so the clone's `origin/main` moves with it and a base is stale only after `staleBase` | Confirmed: `conduct-check.test.mjs:51-56` does `put`, `commitAll`, then `git push -q origin main` from `main` |
| `commitOrigin(files, message)` signature used by rows 5, 12 and 17 (`t.commitOrigin({ 'other.txt': 'o\n' }, 'origin moves')`) | Confirmed, same lines |
| `deliveredChange` calls `commitOrigin` only for non-empty `conflicts` (`change-loop.test.mjs:841`) | Confirmed; this is why rows 5, 12 and 17 now name their own remote commit |
| `roadmap-loop.test.mjs` imports `readCounter` from `./change-loop.test.mjs` (line 15) and `nextAction, render, … ` by name from `./change-loop.mjs` (line 13) | Confirmed; task 2.1's added imports follow the existing form |
| Everything else from round 2 (`nextAction` at `change-loop.mjs:1143-1176`, `decisionKey` 2071, `runWait` poll 2388, `collectRoadmap` 616/661, checker headers, docs anchors, skill rows) | Unchanged: the code files are identical to the round-2 run |

Failed re-derivations: none. No generalization failed.

The release text in D-10 gives "0.33.0 and 0.37.0 when this plan was written" as an example inside a sentence that says the numbers are "the next free numbers on `origin/main` at the last merge before review". That is design prose, not a task, and task 3.1 names no literal; it complies with the `rules.tasks` rule.

## 5. Specs review
Requirements use SHALL and carry scenarios. Every decision-table row of the design has a scenario, and every scenario has a test (16 for "a repository without a remote", 17 for "a change before its delivery", 18 for "the remote cannot be reached during a run"). The three deltas match the proposal. No requirement lives only in a support doc.

## 6. Tasks review
Phases are ordered by dependency and each ends in a gate task with one backticked command. Every AC id is in the table and in tasks. Filtered runs are used and the one long run (3.2) is flagged for a background command. The release task (3.1) names "the next free number".

F-1 re-walked, test by test, against D-8 and the code order:

- After 1.2 (helper, option, key, message; `runNext` and `runWait` unchanged): 3 (`refreshBase` direct), 10 (`waitLoop` direct) and 16 (its `refreshBase` call; its `next` half is true today) pass; 7 stays green. 8 fails on its second half only (two `next` calls log zero fetches), and the first half (two `nextAction` calls on one record) passes. 1, 2, 4, 5, 6 and 17 fail because `next` and `wait` pass no record (17 on its `impl` self-check). This is exactly what the 1.2 check says.
- After 1.3: 1, 2, 4, 5, 6, 8 and 17 pass, 3, 10, 16 and 7 still pass. This is exactly what the 1.3 check says.
- The 1.1 red run (twelve names; 7 passes, 9 on its header only) and the 2.1 red run (eighteen names; 11, 12, 13, 15 and 18 fail, 14 passes, 1 to 10, 16 and 17 pass) match the same table.
- The `git grep` checks of 1.3 and 2.2 now say "code lines (not comment lines)", which removes the comment-line ambiguity.

No defect left in tasks.

## 7. Omission detection
- Validation / error handling: failure, timeout, lock, no origin, git older than 2.29 are defined.
- Retries: none, stated in Alternatives.
- Idempotency: one fetch per base per call, failures memoized (D-1 step 5), tests 8 and 18.
- Observability: `baseFetch` field and one reply line in two languages.
- Rollback / migration: none needed; revert the release.
- Compatibility: optional field; the three CI-downloaded files change only by one comment line.
- Test strategy: D-8 (18 rows, a negative or self-check wherever a guard exists), the D-8 phase table and the D-9 table with its grep rule.
- Parsers rule (`config.yaml`): the plan adds no parser.
- Other omissions: none.

## 8. Execution risks (top 5 failures)
1. A fetch that hangs on a grandchild (ssh) past the timeout. Cause: git's child cleanup is not total. Impact: a `next` slower than 15 s. Prevention: `GIT_TERMINAL_PROMPT=0`, closed stdin, the timeout; test 3. Accepted, Low.
2. Sibling releases (`stale-only-on-own-files`, `delivery-merge-hold`) move the devkit-openspec number before the merge. Prevention: D-10 and 3.1 name the pins by the manifest's version at the last merge, and the workflow follow-up names the renumbering.
3. Test 16 removes the remote, which also deletes `refs/remotes/origin/*`. Its assertions compare `next` with `nextAction` on the same state, so they hold either way. Accepted, Low.
4. Existing delivery tests slow by one local fetch each. The phase-2 base run took 7 min 39 s; 3.2 measures the suite after the change. Accepted, Low.
5. Test 5's `FETCH_HEAD` assertion depends on git resolving `--git-path FETCH_HEAD` in a linked worktree. The self-check (a plain fetch makes the path exist) makes the assertion falsifiable; a different result is settled in 1.1. Accepted, Low.

## 9. Mandatory fixes before implementation
None open.

- [x] F-1 (round 2) — closed: `tasks.md:64-68` and `tasks.md:72-75` now list the tests each task turns green, and `design.md` D-8 carries the matching phase table.

## 10. Optional improvements (within scope)
- [ ] Test 3 proves the timeout on `refreshBase` only; one assertion through `next` would close the spec scenario "the fetch runs past its time". The plan states why it adds none (no 15-second run); acceptable as written.
- [ ] `design.md` line 10 says "the commits after it on this branch touch plan files only"; this stays true while only plan files are committed before implementation, and the implementer's own commits come after.

## 11. Explicitly out of scope
- [ ] `stale-only-on-own-files`, `delivery-merge-hold`, `delivery-train` (what a base move invalidates, merge holds, batching).
- [ ] Fetching in the checkers, `release-merge.mjs`, `project-loop.mjs`, the panel, the CompozyOS loop; fetching the test branch in `two-prs`.
- [ ] A setting to turn the fetch off or change the timeout.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: a stale tracking ref gives `update-branch` where `resolve-release-conflict` is right (AC-1 reproduces it).
2. Is the result measurable? Yes: seven ACs, each with a test row or a gate command.
3. Are error behaviors defined? Yes, including the roadmap failure case (test 18).
4. Are edge cases covered? Yes: no origin (16), plan stage (17), lock (4), timeout (3), flapping wait (10).
5. Are dependencies clear? Yes: three archived changes and two siblings that meet the bump at the release merge.
6. Are contracts defined? Yes: `baseFetch` shapes, the reply line in both languages, the exit code, the refspec and flags.
7. Can two developers interpret this differently? No open point: which task turns which test green is now a table, and how the remote moves in each "stale" fixture is named.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Only run-time surprises the plan already routes to a task check ("settle it here, in `design.md`, before the code task"): merge mode reaching item 5 in test 1, and test 12's change read as `implementation` without `gh`.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable; the residual risks are the Low items of section 8.
