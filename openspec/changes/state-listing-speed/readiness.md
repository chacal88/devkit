<!-- devkit-stage readiness result=passed attempt=2 commit=466f908cf1f23235f45246423900b23e45ab524a -->
# Readiness review: state-listing-speed

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 2. Round 1 (NEEDS-REVISION) listed F-1 to F-4 as mandatory and F-5 as optional. Each is closed in the revised artifacts (section 9). Checked: `openspec validate state-listing-speed --strict` is valid (0 errors); `python3 scripts/check.py` passes; `release.md` reads (`packs:` with one `devkit-openspec: patch` line, a `##` title, a body, no open fence). The base is `origin/main` at `6f03a57`, and the branch has merged nothing.

## 2. Scope validation
Classification: correct. One listing path in `change-loop.mjs`, one new test file, one document sentence, one map entry, one release note. The non-goals match `requirements.md`. The proposal's "Why" figures (37 to 45 s, about 100 git calls) are the conducting session's measurements, and AC-5 proves the result on a real run.

## 3. Proposal review
Problem, goal, impact, non-goals and dependencies are explicit. The proposal's wording of the failure outcomes now matches the spec: the `merge_method` failure is the reachable one, `no change named <id>` stays for `--change`, and the dead-child exit is named as the one new outcome. `STATE_BOUND_MS` at `status-line.mjs:20` is confirmed.

## 4. Design review
Claims re-derived against live code, all confirmed at the cited lines:
- `nextAction` 1588, `refreshBase` call 1624 (only under `fetchBase`), the catch at 1631, `stateEntries` 2093, the `id === null` ids line 2101, `knownChange` 2113, the `none` entry 2115, the entry map 2120, `json` 3259, `runState` 3391, `failure` 3571, `main` 3580, `runCommand` 3605 and `isMain` 3644.
- `flow-check.mjs:47` runs `spawnSync('openspec')`; `fingerprint` runs `git status --porcelain` at `flow-check.mjs:171` and `dirtyPaths` at `deliver-check.mjs:300`; `OFFLINE_GH` is at `merge-setup.mjs:52`; the pin `fresh-base-check 7` is at `change-loop.test.mjs:2631`; `availableParallelism` is used at `test-suite.mjs:280`.
- D-2 now states the write-safety analysis: the path never fetches, writes nothing, and the one lock-taking call (`git status`) is covered by `GIT_OPTIONAL_LOCKS=0` in the children, with the grep that backs it.

## 5. Specs review
The ADDED requirement uses SHALL, and its first sentence now states the one new outcome. Eight scenarios: overlap, one core, same output, unreadable change, a read that fails the command (reachable `merge_method` example), a read process that gives no entry (F-1), a small listing (F-2), and one change and next. Every outcome row of D-5 and D-6 has a scenario and a named test in D-7.

## 6. Tasks review
Tasks are ordered (tests first and red, helpers, child read and join, routing, doc, real run, delivery checks, gate), checkable and small. The eleven tests of task 1.1 match the D-7 rows. Task 1.3's check now says which tests run the process or `main` (F-5). The release rule is respected: no task bumps a version, edits `CHANGELOG.md` or a CI pin, or numbers an ADR, and `decisions.md` is `not-applicable` with a reason. The `--own-files` gate and `check.py` exist on the base and `check.py` is green. AC-5 is proved by task 2.1 (`proof/listing-11.txt`) before the pull request merges. The `scripts/test-map.json` edit is in the same commit as the new test file (task 1.1).

## 7. Omission detection
- Validation, error handling, idempotency, rollback: covered (D-5, D-6, Migration Plan).
- Concurrency of the reads: covered (D-2).
- Observability, permissions, migration, feature flags: not applicable (no stored state, no setting).
- Test strategy: eleven new tests plus the pinned existing tests, each with invariant, layer and suite named.

## 8. Execution risks (top 5 failures)
1. Cause: the real run (D-9) stays at or above 10 s because `openspec` and git calls compete for cores. Impact: AC-5 fails late. Prevention: D-9 names the split to measure and a stop that returns to the owner.
2. Cause: the overlap test flakes on a slow runner. Impact: red CI. Prevention: R-5's 400 ms hold and the `Math.min(2, listingBound())` lower bound.
3. Cause: a child dies (OOM, signal) under 8 parallel Node plus `openspec` processes. Impact: the listing exits 3 with `state of <id> could not be read`. Prevention: stated in the spec and tested (`AC-4 a child that dies is a usage failure`).
4. Cause: a caller kills only the parent pid (R-3). Impact: children finish on their own within the 60 s per call timeout. Prevention: accepted, read-only.
5. Cause: a merge of the base moves `change-loop.mjs` lines. Impact: stale anchors in the plan. Prevention: `CLAUDE.md` rule on a merge of the base editing `proposal.md` and `tasks.md` in the same commit.

## 9. Mandatory fixes before implementation
No open mandatory fix. Round 1 fixes, closed:
- [x] F-1 High: scenario "A read process that gives no entry" and the reworded requirement are in `specs/change-state/spec.md`.
- [x] F-2 Medium: scenario "A small listing" is in the spec, and the test `AC-6 a listing of one change or none starts no read process` is in D-7 and task 1.1.
- [x] F-3 High: the scenario "A read that fails the command" cites the reachable unknown `merge_method`; `proposal.md` AC-4 states `no change named <id>` is kept for `--change`.
- [x] F-4 Medium: D-2 states the read path takes no fetch or write and adds `GIT_OPTIONAL_LOCKS=0` for the children; the proposal and `release.md` say so.

## 10. Optional improvements (within scope)
- [x] F-5 Low: task 1.3's check names which tests run the process or `main`.
- [ ] Low: D-5 rule 3 drops a child's stderr on success; the AC-2 test could also compare the process's stderr (empty). Fix during implementation.

## 11. Explicitly out of scope
- The status line, `machine-probe.mjs`, `roadmap-loop.mjs`, an async `nextAction` and a setting for the bound, as the proposal says.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: the status bar's 20 s bound against a 37 to 45 s read.
2. Is the result measurable? Yes: AC-5 (under 10 s, load recorded) and AC-2 (`cmp`).
3. Are error behaviors defined? Yes, including the dead child and the small listing.
4. Are edge cases covered? Yes: one core, none or one change, an unreadable change, a failing change, a dead child.
5. Are dependencies clear? Yes; none under way, base current.
6. Are contracts defined? Yes: signatures in D-8, the child's JSON in D-2 and D-5.
7. Can two developers interpret this differently? No material point left.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes; AC-5 has its own proof task.
10. What will be discovered too late if implementation starts now? Only the real-run time (AC-5), which task 2.1 stops on.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? The real run at the avel machine may not reach 10 s; D-9 already names the stop.
