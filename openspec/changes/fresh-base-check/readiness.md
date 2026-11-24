<!-- devkit-stage readiness result=failed attempt=2 commit=90ea93b33641e70b6cbbd3cc4b1943e9af907e20 -->
# Readiness review: fresh-base-check

Round 2. Round 1 (attempt 1, at `3a11b86`) listed four mandatory fixes. This round checks that each is closed and re-reads the revised plan against the code.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

The four round-1 fixes are closed. One new narrow defect remains: the checks of tasks 1.2 and 1.3 split the new tests by phase in a way that cannot be observed, because four tests drive the `next` command, which only passes `fetchBase` in task 1.3. It is fixed inside `tasks.md` (and one clause of `design.md` D-8 if the author wants the table to say it too). It changes no scope.

`openspec validate fresh-base-check --strict`: valid. Base checks at `90ea93b` (`origin/main` `4631376` is an ancestor of HEAD, no fetch): `python3 scripts/check.py` passes and `python3 scripts/gen-catalog.py --check` is clean. Between `3a11b86` and this head only `design.md`, `tasks.md` and `readiness.md` changed (`git diff --stat 3a11b86 HEAD`), so no hook, test or doc file differs from the round-1 run, where `command claude plugin validate .` passed and the phase-1 long gate (`--test-name-pattern="^change-loop"` on `change-loop.test.mjs`, 176 tests, 3 min 17 s) was green. No gate is red on the base. The whole guard suite (3.2) was not run here; it is the caller's long run.

## 2. Scope validation
Classification: correct

One problem (a stale `origin/<base>` makes the loop hand the wrong delivery step), one mechanism (the loop fetches once before judging; the checkers stay readers). In and out of scope are explicit in `proposal.md` and `design.md` Non-Goals. The revision added tests 16 to 18 and clarified the import form and the release step; it added no behavior. `decisions.md` ("no ADR needed") still holds.

## 3. Proposal review
Unchanged since round 1 and sound: problem, goal, three ADDED capabilities, impact, dependencies and the four owner-visible choices. The release number is "the next free one on `origin/main` at the last merge before review", as `openspec/config.yaml` `rules.tasks` asks. Version facts re-checked: `origin/main` and HEAD both carry devkit-openspec 0.32.0.

## 4. Design review
Re-derived against live code at `90ea93b` (code files identical to `3a11b86`):

| Claim | Result |
|---|---|
| `nextAction` signature `{ env, lang, after, openspec, gh, claims, budget }`, `clean = cleanOf(env)`, the `inDelivery` block, `baseBranch` today inside the `try` (`change-loop.mjs:1143-1176`) | Confirmed. D-2 moving `defaultBase` out of the `try` and using `clean` (in scope) is valid |
| `decisionKey` is the `const` at `change-loop.mjs:2071`, `waitLoop` at 2078, `stateEntries` 1507, `stopDecision` 2130 | Confirmed |
| `runWait`'s `poll` is `nextAction(cwd, opts.change, { env, lang, openspec, gh })` (`:2388`) | Confirmed; D-3 adds `fetchBase` there |
| `collectRoadmap` (`roadmap-loop.mjs:616`) takes a destructured option object and calls `nextAction(start, line.id, { env, lang: l, after: progress, openspec, gh })` once, inside the loop | Confirmed; one added option reaches every call |
| `conduct-check.mjs` header says "never fetches" within its first six lines; `deliver-check.mjs` line 3 is "Reads files and git; never writes, pushes or posts." | Confirmed; test 9's six-line regex can hold after D-6 (`... or fetches.`) |
| Docs anchors: `**The loop.**` at `docs/openspec-flow.md:230`, `**Waiting on GitHub.**` at 236, `conduct-check` section "never fetches (run" at 252, `**What it decides and says.**` at 341, the `deliver-check does not fetch` sentence at 486; `ship-change/SKILL.md:69` `update-branch` row; `devkit/SKILL.md` `## Loop` at 82, "An end the session declares itself" at 98, "Then run `next` again." at 100 | Confirmed; the round-1 line-number slip (242, 236) is corrected in D-7 and the Context table |
| Test helpers: `roundRepo` with `commitOrigin`, `originDir`, `ghAt`, `addWt`; `deliveredChange` is a non-exported function (`change-loop.test.mjs:819`); `readCounter` is already exported and imported by `roadmap-loop.test.mjs:13`; roadmap suite defines `cleanEnv`, `OFFLINE`, `FLAGS`, `doRun`, `doNext`, `doStatus`; `change-loop.test.mjs:19` imports `changeLoopModule` as a namespace | Confirmed |

Failed re-derivations: none. No generalization failed.

## 5. Specs review
Requirements use SHALL and carry scenarios. Every decision-table row of the design has a scenario, and after round 1 every scenario has a test: "A repository without a remote" is test 16, "A change before its delivery" is test 17, "The remote cannot be reached during a run" is test 18. The three deltas match the proposal. No requirement lives only in a support doc.

## 6. Tasks review
Phases are ordered by dependency, each ends in a gate task with one backticked command, every AC id is in the table and in tasks, filtered runs are used and the one long run (3.2) is flagged. The `1.1` check lists twelve names and its red/green split matches D-8's "Expected red". The release task (3.1) names "the next free number" and no literal. One defect, F-1 below, in the 1.2 and 1.3 checks.

## 7. Omission detection
- Validation / error handling: failure, timeout, lock, no origin, git older than 2.29 are defined.
- Retries: none, stated in Alternatives.
- Idempotency: one fetch per base per call, failures memoized (D-1 step 5), and tests 8 and 18.
- Observability: `baseFetch` field and one reply line, in two languages.
- Rollback / migration: no migration; revert the release.
- Compatibility: optional field; the three CI-downloaded files change only by one comment line.
- Test strategy: D-8 (18 rows, each with a negative or self-check where a guard exists) and the D-9 table with the grep rule.
- Parsers rule (`config.yaml`): the plan adds no parser.
- Other omissions: none.

## 8. Execution risks (top 5 failures)
1. Task 1.2's check cannot pass. Cause: tests 2, 4, 5 and 8 call the `next` command, and `runNext` passes `fetchBase` only in task 1.3; after 1.2 they still see no fetch. Impact: the implementer sees red tests the plan says are green, and either stops to ask or pulls 1.3 forward and breaks the task order. Prevention: F-1.
2. Test 5's "stale" fixture needs a remote commit. Cause: `deliveredChange` calls `commitOrigin` only when `conflicts` is non-empty, and `staleBase` rewinds to `<remote sha>^`; "Delivered fixture (PR mode), stale" does not say how the remote moves (see optional item). Impact: a fixture where the base never moved, so the fetch changes nothing and the "only the base differs" assertion proves less than AC-5 asks. Prevention: name the commit.
3. A fetch that hangs on a grandchild (ssh) past the timeout. Mitigated by git's child cleanup and test 3. Accepted, Low.
4. Sibling releases (`stale-only-on-own-files`, `delivery-merge-hold`) move the devkit-openspec number before the merge. Mitigated: D-10 and 3.1 now name the pins by the manifest's version at the last merge, and the workflow follow-up names the renumbering.
5. Test 16 removes the remote, which also deletes `refs/remotes/origin/*`, so `deliveryRow` may see no `origin/main`. The assertions compare `next` with `nextAction` on the same state, so they hold either way. Accepted, Low.

## 9. Mandatory fixes before implementation
- [ ] Medium — `tasks.md:64-65` and `tasks.md:69-70` (checks of 1.2 and 1.3), against `design.md:260-267` (D-8 rows 1, 2, 4, 5, 8) and `design.md:130` (D-3) — the 1.2 check says "tests 2, 3, 4, 5, 8, 10 and 16 pass", but tests 2, 4, 5 and 8 drive the `next` command (row 2 "same exit code", row 4 "`next` gives `baseFetch.ok` false", row 5 "after `next`", row 8 "Two `next` calls log two"), and `runNext` gets `fetchBase` only in 1.3. Test 1 is already placed in 1.3 for the same reason. After 1.2 those four tests still fail, so the stated check is unobservable. Smallest correction: 1.2's check lists only the tests that call `refreshBase`, `waitLoop` or `nextAction` directly (3, 10 and 16, plus the first half of 8, plus `^change-loop replies`), and 1.3's check lists 1, 2, 4, 5, 6, 7, 8 and 17; or swap the order of 1.2 and 1.3's code so `nextAction` and its caller land together. Name the choice. (F-1)

## 10. Optional improvements (within scope)
- [ ] `design.md:260-267` (D-8 rows 5, 6, 8, 17) — say how the remote moves in rows that need a stale base on a PR-mode fixture (for example `deliveredChange({ conflicts: ['README.md'] })`, which commits to `origin`, or `t.commitOrigin(...)` after it), as row 1's merge fixture already does through `conflicts`. `staleBase` needs a remote commit to rewind.
- [ ] `design.md:10` calls `98145b0` "the branch head"; HEAD is now `90ea93b` (plan files only). No code claim is affected.
- [ ] `tasks.md:70` and `tasks.md:95` — the `git grep "fetchBase"` checks also match the comment above `nextAction`/`collectRoadmap` that 1.2 and 2.2 update to name the option; say "code lines" or accept comment lines.
- [ ] Test 3 proves the timeout on `refreshBase` only; one assertion through `next` would close the spec scenario "the fetch runs past its time". Optional, as in round 1.

## 11. Explicitly out of scope
- [ ] `stale-only-on-own-files`, `delivery-merge-hold`, `delivery-train` (what a base move invalidates, merge holds, batching).
- [ ] Fetching in the checkers, `release-merge.mjs`, `project-loop.mjs`, the panel, the CompozyOS loop; fetching the test branch in `two-prs`.
- [ ] A setting to turn the fetch off or change the timeout.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: a stale tracking ref gives `update-branch` where `resolve-release-conflict` is right (AC-1 reproduces it).
2. Is the result measurable? Yes: seven ACs, each with a test row or a gate command.
3. Are error behaviors defined? Yes, including the roadmap failure case (test 18).
4. Are edge cases covered? Yes: no-origin (16), plan-stage (17), lock (4), timeout (3), flapping wait (10).
5. Are dependencies clear? Yes: three archived changes and two siblings that meet the bump at the release merge.
6. Are contracts defined? Yes: `baseFetch` shapes, the reply line in both languages, the exit code, the refspec and flags.
7. Can two developers interpret this differently? Only at which task makes tests 2, 4, 5 and 8 pass (F-1) and at how the base moves in test 5 (optional).
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes once F-1 is fixed.
10. What will be discovered too late if implementation starts now? That the 1.2 check is red for four tests until 1.3.

## 13. Final conclusion
- Can we start? Not yet: one small revision of `tasks.md` (the checks of 1.2 and 1.3).
- What must be fixed? Item F-1 of section 9.
- Main risk if ignored? A phase check the implementer cannot satisfy, costing a question or a reordering in the middle of the build.
