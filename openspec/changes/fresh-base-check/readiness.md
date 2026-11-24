<!-- devkit-stage readiness result=failed attempt=1 commit=3a11b864b2a6dce13fa9fd46329478f122ce4ef2 -->
# Readiness review: fresh-base-check

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

The plan is close: the scope is tight, the internal claims about code check out, and the structure is sound. Four narrow, explicitly fixable defects remain (one test that cannot pass as written, three spec scenarios or guards with no test, a literal version in a task that a sibling release will make wrong, and an ambiguous import form that breaks the red runs). None changes scope.

`openspec validate fresh-base-check --strict`: valid. Base checks run on `3a11b86` (fork point `4631376` is an ancestor of HEAD, no fetch): `python3 scripts/check.py` passes, `python3 scripts/gen-catalog.py --check` is clean, `command claude plugin validate .` passes, and the phase-1 gate's long part (`--test-name-pattern="^change-loop"` on `change-loop.test.mjs`) is green on the base (176 tests, 3 min 17 s). No gate is red on the base. The whole guard suite (3.2) was not run here; it is the caller's long run.

## 2. Scope validation
Classification: correct

One problem (a stale `origin/<base>` makes the loop hand the wrong delivery step), one mechanism (the loop fetches once before judging; the checkers stay readers). In and out of scope are explicit (`proposal.md` Non-goals; `design.md` Non-Goals). The design adds no behavior the proposal does not justify. Support content (D-8 tests, D-10 release) is tied to tasks. The decision "no ADR needed" (`decisions.md`) holds: the change contradicts no accepted record, and `design.md` Alternatives records the rejected "fetch inside the checkers".

## 3. Proposal review
Problem, goal, affected capabilities (three ADDED, none new), impact (hooks, tests, docs, release, JSON contract) and dependencies are stated. The four choices the plan makes on top of `requirements.md` are listed for the owner. Facts about the repository that I re-derived are true at `3a11b86` (see section 4), with the exception of the two docs line numbers listed there.

## 4. Design review
Re-derived against live code (all at `3a11b86`):

| Claim | Result |
|---|---|
| `nextAction` options and flow, `inDelivery`, `defaultBase`, `tryGit` (`change-loop.mjs:1143`, `:813`, `:1123`, `:1111`) | Confirmed. `BUILD_PARTS` includes `build`, so an `implementation`-stage change is "in delivery" and test 12's fixture does reach the fetch |
| `LS_REMOTE_TIMEOUT_MS` (`:1668`) and `gitPasses` (`:1683`) are declared after `nextAction` | Confirmed; both are used inside a function body, so no temporal dead zone |
| Callers of `nextAction`: `runNext` 2271, `runWait` 2388, `stateEntries` 1521, `stopDecision` 2139; `waitLoop` 2078, `decisionKey` 2071 | Confirmed (the plan says 2268 for `runNext`; the call is at 2271, immaterial) |
| Roadmap callers: `collectRoadmap` 661, `statusJson` 973, `draftCmd` 1025, `waitCmd` 1068; no other non-test caller of `nextAction` in `plugins/` | Confirmed |
| `conduct-check.mjs` header says "never fetches"; `releaseConflict` at 372 and the `update-branch` "merges cleanly" step at 395 | Confirmed |
| `deliver-check.mjs` line 3 is "Reads files and git; never writes, pushes or posts." | Confirmed |
| Existing test anchors of D-9 (`change-loop.test.mjs` 124, 2424, 2444, 5557; `roadmap-loop.test.mjs` 585; `deliver-check.test.mjs` 3231; `guard.test.mjs` 1582; `SAMPLE` holds `base`) | Confirmed |
| `roundRepo`, `ghFor`, `addWt`, `commitOrigin`, `originDir`, `presetMerge`, `MERGE_*`, `doNext`/`doRun`/`doStatus` (roadmap suite passes `gh: OFFLINE`), `stopInput`, `runTranscript`, `cleanEnv` | Confirmed; `roadmap-loop.test.mjs` already imports from `change-loop.test.mjs` |
| `git fetch --no-tags --quiet --no-write-fetch-head origin +refs/heads/main:refs/remotes/origin/main` on git 2.53 | Confirmed in a scratch repository: moves only the ref, leaves `FETCH_HEAD` untouched, a missing remote gives a first line `fatal: '<path>' does not appear to be a git repository`, a ref lock gives `cannot lock ref` |
| `docs/openspec-flow.md` anchors: "never fetches (run `git fetch origin --prune --quiet` first)", "and `deliver-check` does not fetch" (486), "holds no state and exits as soon as GitHub's answer changes the decision;", "the loop copies their decision and adds none." (all present exactly once); CI pins `v0.32.0` at 653, 654, 667 | Anchors confirmed. **Line numbers wrong**: D-7 and the Context table say "The loop." is line 236 and "Waiting on GitHub." line 242; they are lines 230 and 236 |

Failed re-derivations: only the two docs line numbers above (Low). No generalization failed.

## 5. Specs review
Requirements use SHALL and carry scenarios. Every decision-table row of the design (success, failure, timeout, lock, wait, once-per-call, readers) has a scenario. Gaps are tests, not scenarios (section 6, F-2). The `roadmap-coordination` and `change-delivery` deltas match the proposal. No requirement lives only in a support doc.

## 6. Tasks review
Phases are ordered by dependency, each ends in a gate task with one backticked command, every AC id appears in the table and in tasks, the gates use filtered runs and the one long run (3.2) is flagged. Test-first is explicit (red runs saved). The gate phases are executable (the phase-1 `^change-loop` run is 3 min on the base). Findings:

- F-1 (test 5 cannot pass as written), F-2 (scenarios and guards with no test), F-3 (literal version), F-4 (import form) are in section 9.

## 7. Omission detection
- Validation / error handling: defined (failure, timeout, lock, no origin, git older than 2.29).
- Retries: explicitly none (Alternatives).
- Idempotency: one fetch per base per call, memoized including failures (D-1 step 5).
- Observability: `baseFetch` field and one reply line.
- Rollback / migration: no migration; revert the release (Migration Plan).
- Compatibility: optional field, readers ignore unknown keys; the three files a project's CI downloads change only by one comment line.
- Test strategy: D-8 table plus D-9 existing-test table with the grep rule; found a hole in the table (F-1, F-2).
- Other omissions: none found.

## 8. Execution risks (top 5 failures)
1. Test 5 as written fails on any correct implementation. Cause: `roundRepo` already runs `git fetch -q origin` on the clone, which writes `FETCH_HEAD`; the test asserts the path names no file. Impact: the implementer improvises the assertion (content, mtime, delete first), and two implementers differ. Prevention: F-1.
2. Red runs not reproducible. Cause: a named ESM import of a not-yet-exported `refreshBase` or `baseFetches` fails to load the whole test file, so "7 passes" and "`^change-loop next` still passes" cannot hold in task 1.1. Prevention: F-4.
3. The no-origin guard and the plan-stage "nothing fetched" rule ship untested. A later edit that fetches in plan stages (every `next` pays up to 15 s) or throws with no remote would pass the suite. Prevention: F-2.
4. The release step reuses a stale literal. After a sibling (`stale-only-on-own-files`, `delivery-merge-hold`, both named in the proposal) releases first, the pins read `v0.33.0` or later; "move every `v0.32.0` pin" and "`git grep -c v0.32.0` prints nothing" then mislead. Prevention: F-3.
5. A fetch that hangs on a grandchild (ssh) holding stderr past the timeout. Mitigated by git's own child cleanup on SIGTERM and by test 3; accepted, Low.

## 9. Mandatory fixes before implementation
- [ ] High — `design.md:252` (D-8 test 5) — "`git rev-parse --git-path FETCH_HEAD` names no file, in both" cannot hold in `t.main`: `roundRepo` (`conduct-check.test.mjs:26-27`, `git fetch -q origin`) leaves a `FETCH_HEAD` there. AC-5 ("fetch writes only the base") would be unprovable as specified — smallest correction: say the test removes `FETCH_HEAD` from `t.main` before the run (or compares its bytes and mtime before and after, and checks the worktree's does not exist), and name which. (F-1)
- [ ] Medium — `design.md:246-262` (D-8 table) and the specs — three scenarios or guards have no test: (a) `change-coordination` "A repository without a remote" (D-1 step 2, the `null` return and no `baseFetch` key); (b) "A change before its delivery" (a plan-stage change fetches nothing; the design's own rule at line 44 asks each guard for a test with its negative); (c) `roadmap-coordination` "The remote cannot be reached during a run" (each change in delivery records the failed fetch). Smallest correction: add rows (for example 16 to 18) to D-8 with their expected red/green status, and name them in tasks 1.1 or 2.1 and the red-run checks. (F-2)
- [ ] Medium — `tasks.md:107,110` and `design.md:299` (D-10) — "move every `v0.32.0` pin" and "`git grep -c v0.32.0` prints nothing" hard-code the version on the plan's base; `openspec/config.yaml` `rules.tasks` and the sibling releases the proposal names make it wrong after the merge before review. Smallest correction: "move every CI pin of `docs/openspec-flow.md` (the lines `git grep -n 'v[0-9]*\.[0-9]*\.[0-9]*' -- docs/openspec-flow.md` lists inside the CI example) to the new devkit-openspec tag" and check by the new tag, not the old one. (F-3)
- [ ] Medium — `design.md:246-262` (D-8) and `tasks.md:41,76` — tests 3, 8 and 12 call `refreshBase` and `baseFetches`, which do not exist at task 1.1; a named import makes the whole file fail to load, so the expected red/green split (7 and `^change-loop next` pass) cannot be observed. `change-loop.test.mjs:19` already imports the module as a namespace. Smallest correction: state that the new tests reach them as `changeLoopModule.refreshBase` and `changeLoopModule.baseFetches` (no named import) in task 1.1, and that task 2.1 may import `baseFetches` by name only because 1.2 has landed. (F-4)

## 10. Optional improvements (within scope)
- [ ] `design.md:15-23` and D-7 — correct the docs line numbers (230 "The loop.", 236 "Waiting on GitHub."); the anchors by text are right, so an implementer who edits by text is unaffected.
- [ ] `design.md:107` says `baseFetch` is declared with `let` at the top of the function, but the D-2 snippet uses `const baseFetch` inside the `if`. Pick one.
- [ ] `design.md:330` cites "the whole-suite gate (3.3)"; the gate is 3.2.
- [ ] Test 3 proves the timeout only on `refreshBase`; the spec scenario says the action records it. One assertion through `next` would close it, optional.
- [ ] The Workflow follow-up "tag the new version" duplicates the loop's own `tag-release` step (ADR 0019); say it is done by that step.

## 11. Explicitly out of scope
- [ ] `stale-only-on-own-files`, `delivery-merge-hold`, `delivery-train` (what a base move invalidates, merge holds, batching).
- [ ] Fetching in the checkers, `release-merge.mjs`, `project-loop.mjs`, the panel, the CompozyOS loop; fetching the test branch in `two-prs`.
- [ ] A setting to turn the fetch off or change the timeout.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: a stale tracking ref gives `update-branch` where `resolve-release-conflict` is right (AC-1 reproduces it).
2. Is the result measurable? Yes: seven ACs, each with a test row or a gate command; AC-5's test needs F-1.
3. Are error behaviors defined? Yes: failed fetch, timeout, ref lock, no network, old git, and the no-origin case; the roadmap failure case lacks a test (F-2).
4. Are edge cases covered? Mostly; no-origin and plan-stage tests are missing (F-2).
5. Are dependencies clear? Yes: three archived changes, two siblings that meet the bump at the release merge.
6. Are contracts defined? Yes: `baseFetch` shapes, the reply line in both languages, the exit code, the refspec and flags.
7. Can two developers interpret this differently? Only at test 5's FETCH_HEAD assertion and the test import form (F-1, F-4).
8. Are any decisions implicit instead of written? No; the four choices are written and owner-visible.
9. Do the tasks fully deliver the intended outcome? Yes once F-2 closes the test gaps.
10. What will be discovered too late if implementation starts now? That test 5 cannot pass, that the red runs do not split as promised, and that the release pins moved under a sibling.

## 13. Final conclusion
- Can we start? Not yet: one revision round on the plan.
- What must be fixed? The four items of section 9, all inside `design.md` D-8 and D-10 and tasks 1.1, 2.1 and 3.1.
- Main risk if ignored? A test that no implementation can pass and red runs that do not match their stated results, which cost a round trip and a plan edit in the middle of the implementation; and a release step that follows a stale version.
