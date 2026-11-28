<!-- devkit-stage readiness result=passed attempt=2 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Readiness review: helper-conductor

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

`openspec validate helper-conductor --strict` passes. On the base, `python3 scripts/check.py` passes, `python3 scripts/gen-catalog.py --check` is clean and `node scripts/test-suite.mjs --own-files` reports `selected no test file: 3 own files` (the phase 1 gate reads green on the base). The whole suite was not run by this review. The plan was revised after round 1 (attempt 1, NEEDS-REVISION, four blockers); each blocker is now closed, re-derived below against the code. No open `Mandatory before implementation` finding remains.

## 2. Scope validation
Classification: correct. Problem, ACs, non-goals and the dependency on `multi-roadmaps` are written. The helper pick and the tick's envelope stay deferred to phase 1's decision point, with stop-and-revise cases named.

## 3. Proposal review
Clear. The proposal is now 107 lines (it was 154); the capability list (1 new, 5 modified) matches the spec folders.

## 4. Design review
Round 1 blockers, re-checked:
1. Hook and git (was Critical): closed. D-3 (`design.md:178-195`) now builds the facts from `node:fs` only: `commonDirOf(root)` reads `.git` (a folder, or a `gitdir:` file plus `commondir`), `localRunFilePath`, and `open` from the `worktrees/<name>/gitdir` entries. Checked on this worktree: `.git` is `gitdir: .../.git/worktrees/helper-conductor`, and that folder holds `commondir` (`../..`) and `gitdir`, so the derivation works. `runFilePath` (`run-file.mjs:24-28`, `git rev-parse`) is kept for other callers. D-4 (`design.md:252-258`) states the import chain honestly (`run-file.mjs:9` imports `change-loop.mjs`, which "runs nothing when imported", `change-loop.mjs:6`) and the dynamic import after the raw match; the failing-`git`-stub test (task 3.1, `tasks.md:212`) is now consistent, with a spec scenario "No git on the path".
2. `heldPlaces` (was High): closed. D-3 (`design.md:196-201`) fixes one derivation: the `run.occupied` ids that are in `open`, the record `placeDecision` writes (`roadmap-loop.mjs:1070-1079`, `LOAD_PARTS`). No stage header is read. Task 2.1 (`tasks.md:106-113`) and the scenarios "Places count test load" and "The hook and the tick agree" (`spec.md:458-466`) pin it.
3. `stopping` with no typed session (was High): closed. D-3 rule 2 splits `stopping-busy` (hook blocks) from `stopping` (hook passes); D-5 and D-6 rule 3 make the tick that finds `stopping` with no live claim print `delete-task` and `roadmap-ended-stopped`; scenario "A stop whose typed session closed" exists.
4. Missing scenarios (was Medium): closed. Scenarios now exist for the `blocked` end, the owner's answer to a blocked line, the `archived` end, the elsewhere hold ("Claimed elsewhere", "...then released"), and the train's owner-needing and red ends ("A train that needs the owner", "A red train"). D-7's table says a `blocked` end writes an owner line and one push.
Other anchors re-checked and true at this base: `limitOf` and `DEFAULT_LIMIT` at `roadmap-loop.mjs:60-71` (D-3 moves them to `run-file.mjs` with a re-export), `limitOf` read at `:891`, `pruneRecords` at `:1236-1240`, `placeDecision` at `:1023`, `listWorktrees` in `conduct-check.mjs`/`deliver-check.mjs` area as cited, `run-file.mjs` `emptyRun` and `readRun`.

## 5. Specs review
`roadmap-conductor/spec.md` has SHALL requirements with WHEN/THEN scenarios for every row of the D-3 to D-7 decision tables, including the former gaps. The "reads only local files" sentence is now backed by D-3 and D-4.

## 6. Tasks review
Phases are ordered, each ends with a gate command, every AC id has a task, `release.md` exists and reads (`packs:`, `marketplace:`, title, body, fences closed), no task bumps a version, edits `CHANGELOG.md` or numbers the record, and `decisions.md` lists `docs/adr/helper-conductor.md` unnumbered. Test-map edits are named in the adding tasks. Tasks 2.1 and 3.1 are now executable.

## 7. Omission detection
Validation, permissions, retries, idempotency (claim, push, delegated record), rollback and migration, observability (the `blocked` owner line and push) and test strategy are covered.

## 8. Execution risks (top 5 failures)
1. Host behaviour (envelope, nesting, block before the model): wrong regex or helper. Prevention: phase 1 proof and its stop-and-revise cases, already planned.
2. A `occupied` entry of a change whose folder vanished (see 9, Medium): the hook ignores it, `placeDecision` still counts it, so the hook lets a firing through that the tick then finds full. Cost: one wasted tick, no wrong state.
3. A hand-parsed `commondir` on an unusual layout (a `.git` file with a relative `gitdir`): the hook finds no run file and prints nothing, so an empty tick runs the model. Prevention: the conductor test checks `commonDirOf` against `git rev-parse --git-common-dir` (`design.md:1152`).
4. An unlisted test or fixture that pins removed text (the D-15 rewrite): phase 5 gate red late. Prevention: the pin rule of D-15 and the AC-10 greps.
5. The scheduler refusing `*/5 * * * *`: P-6 records it and AC-15 is revised before phase 2.

## 9. Findings
- [ ] Medium, Fix during implementation: `design.md:200-201` says `helper-next`'s `placeDecision` "counts the same entries" as `heldPlaces`, but `placeDecision` counts every `occupied` entry (`roadmap-loop.mjs:1024`, `entriesCount`) while `heldPlaces` leaves out ids no longer open, and `pruneRecords` (`:1236`) runs only for `run.changeSessions`, which this change removes. Smallest correction: task 2.1 makes `helper-next`/`tick` prune `occupied` to the open ids before `placeDecision` (or pass the filtered record), with a test; the scenario "The hook and the tick agree" already states the intent.

## 10. Optional improvements (within scope)
- [ ] `design.md:987` and `:200` could name the prune call once, as the single place the rule lives.

## 11. Explicitly out of scope
- [ ] Removing `decideRoadmap` and the legacy locks (stated non-goal).
- [ ] `multi-roadmaps` parsing.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes; each AC has a task and a proof file or test.
3. Are error behaviors defined? Yes (blocked, stopping, train ends, no git, unreadable run file).
4. Are edge cases covered? Yes; the closed-typed-session stop now has a scenario.
5. Are dependencies clear? Yes (`multi-roadmaps`, ADR 0034 to 0036, phase 1).
6. Are contracts defined? Yes; the hook's file access and `heldPlaces` are fixed.
7. Can two developers interpret this differently? Only on the stale-`occupied` corner (finding 9).
8. Are any decisions implicit instead of written? No material ones.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? Host envelope details (phase 1 is built to find them) and the stale-`occupied` corner.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation; the Medium finding goes into task 2.1.
- Main risk if ignored? A wasted tick when the hook and the tick count places differently.
