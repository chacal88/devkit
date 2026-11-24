<!-- devkit-stage readiness result=passed attempt=3 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Readiness review: delivery-train

Round 3, reviewed at `19c0196` (devkit-openspec 0.29.0, devkit-core 0.13.1) against the plan as revised after round 2 (`specs/change-coordination/spec.md`, `specs/delivery-train/spec.md`, `design.md` and `tasks.md` carry edits made after the round-2 report). `openspec validate delivery-train --strict` passes ("Change 'delivery-train' is valid"). Gates that exist on the base, run there: `python3 scripts/check.py` (all checks passed), `python3 scripts/gen-catalog.py --check` (exit 0). Not re-run: `command claude plugin validate .`, the two hook suites and the guard suite. `git diff HEAD -- plugins docs` is empty and `git status --short` shows only this change's folder and ADR 0019 as untracked, so no file the gates read changed since round 1 (823 pass, 0 fail on `release-merge.test.mjs` and `delivery-models.test.mjs`) and round 2 (check and catalog green). The implementer treats a red result on the base as a finding.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The one `Mandatory before implementation` finding of round 2 is closed, and the code claims it relied on still hold at the same commit. What remains is small and is fix-during-implementation (section 10). The plan is waiting on the owner's approval and on ADR 0019's acceptance (task 6.1 stops without it), which are not readiness gaps.

## 2. Scope validation
Classification: correct. Problem, in scope and out of scope (proposal "What Changes", "Non-goals") are explicit and match ADR 0019 and `requirements.md`. The round-3 edits add two scenarios, one requirement wording and three clarifications of existing mechanisms; they add no scope.

## 3. Proposal review
Problem, goal, five capabilities (one new, four modified), impact and dependencies are clear; AC-1 to AC-12 are observable and each has a named test (design.md D-13 table) and tasks (tasks.md map). No finding. Staleness that is not a finding: the proposal says the folder of `release-merge-conflict` "is not archived yet"; `origin/main` has archived it, the sentence says the plan does not need that, and the coordinator's merge of `origin/main` before phase 1 (tasks.md line 13) takes it in.

## 4. Design review
Round-2 finding and its re-derivation:
- A4 and override 4 step 1 (decision rows without a scenario): closed. `specs/change-coordination/spec.md:52-64` now says "a change or an archive" in the requirement and has the scenario "An archive riding train 4" (the archive is not reported as boarded); `specs/delivery-train/spec.md:229-231` has "A merge not pushed yet" (the next step pushes `chore/archive-delta`, never with force, nothing is merged again). They match design.md D-2 row A4 (line 184) and override 4 step 1 (line 194).

Round-2 optional items taken into the artifacts, each verified in the text:
- The reader of "the project's train is on" for `serializeArchives`: design.md lines 214-220 give `compute` calling `readTrainSetting(root)` once, keeping `ctx.train`, with `serializeArchives` and `trainRejoin` reading it and a P3b negative (line 652). The code seam exists: `compute` builds `ctx` at `conduct-check.mjs:615-624`; `serializeArchives:420`, `deliveryRow:407`, `unpushedMerge:344`, `conflictedPaths:354`, `releaseConflict:372`, `RELEASE_MERGE:334` are where the plan places them. Task 2.4 repeats it.
- The tick text leaving `classifyConflict`: design.md lines 450-458 add `roadmapMerged` to the return, `null` without a resolver; today the function is `classifyConflict(paths, stagesOf)` at `release-merge.mjs:162` and `PIN_FILE` is exported at `:125`, as the plan says. Task 1.5 names the field.
- Who writes `proof/real-run.md`: task 6.8 says the implementer writes it and `pr-verifier` re-runs the cases and cites it; design.md line 743 agrees.

Re-checked in the code at `19c0196` (unchanged since round 2, which derived each in full): `deliver-check.mjs` `fetchPr:564` (options `{ merge, number, branch, list, base }`), `MERGE_FIELDS:552`, `isOwnPr:606`, `archiveNext:1274`, `ciSettingsRef:1965`, `checkOne:2141` (`(root, id, facts, two = null)`), `runSeveral:2169`; `change-loop.mjs` `unfinished:1387`, `startMode:1507`, `OWNER_STEP:860`. No claim fails.

Metadata and roadmap files: `openspec/roadmap.md` lists `delivery-train`; `.openspec.yaml`, `decisions.md` and `requirements.md` exist. No finding.

## 5. Specs review
Normative language and `#### Scenario:` blocks are present throughout; modified requirements carry their full text (`change-coordination` "The devkit command reads its verb" with the `train` verb, its trailing-words scenario and the unknown-verb sentence). Every outcome row of the decision tables (T1-T9, A1-A5, override 4 steps 1-3, N0-N15, D-10 failures 1-6, D-7 rows) now has a scenario; the two that lacked one in round 2 are added. No finding.

## 6. Tasks review
Phases are ordered by dependency; each opens with a test-first task that saves its red run and ends with a gate of one backticked command with its `env` prefix; every AC id is in the map and has a task and a test; paths fall under real directories; ADR and version tasks use the next free number on `origin/main`. Gate commands that exist on the base are green (section opening). The new test file named in the 1.7 to 5.5 gates does not exist yet, which is the point of test-first. No finding.

## 7. Omission detection
Validation and errors (the setting, the record, the join, the suite and the red base, an archive that cannot join), retries and idempotency (lock with six-hour takeover, a second request starts none, `close-boarded-pr` and `clean-train` idempotent), permissions (ruleset unchanged, merge commits through `github-setup.mjs --method merge`), observability (the record keeps runs, failure output, left reasons), rollback and migration (Migration Plan), compatibility with projects without the key (a test per delivery row, the `gh` argument-list test for `trunk`, the shape tests of `readDevkitSettings`) and test strategy (one test per P1-P13) are all stated. No finding.

## 8. Execution risks (top 5 failures)
1. Two archives edit the same canonical spec, so one leaves the train and stops for the owner with the path (A3, override 4). Designed outcome, not a loop; the owner resolves it by hand. The first train's retro records how often it happens.
2. A flaky test makes the bisection name an innocent change. Impact: a wrong culprit loses a train. Prevention: the record keeps every run and the culprit's output; its own cycle reruns its tests before it boards.
3. GitHub leaves boarded pull requests open after the train merges. Impact: none on delivery; the train closes them with a comment (D-9). The first train's retro records which ending GitHub gives.
4. The CI check imports a module the job does not download (a later edit takes `PIN_FILE` from `release-merge.mjs`). Impact: `devkit-reviews` fails everywhere the train is on. Prevention: the test that runs `--ci` from a folder holding only the three downloaded files.
5. A pinned test breaks late at 6.9 (13 to 21 minutes after five phases). Prevention: the D-13 inventory of existing tests is grep-derived; the implementer re-runs the `rg` of `openspec/config.yaml` ("Existing tests") over the skill text and message table before 3.5 and 3.6.

## 9. Mandatory fixes before implementation
None. No `Mandatory before implementation` finding is open.

## 10. Optional improvements (within scope)
- [ ] Fix during implementation: write the literal English and Portuguese texts of the new messages (`train-off`, `train-running`, `train-nothing`, `train-blocked`, `train-base-red`, `train-checks`, `train-auto-merge-on`, `train-ready`, `train-delivered`, `what.train`, `gate.train`; `waiting-train` has its English text at design.md line 227). The D-5 table shows N0 with backticks around the key (design.md line 342), and `change-loop replies: no internal term in either language` (`change-loop.test.mjs:122-141`) refuses backticks, hyphenated step names (`on-train`, `wait-train`, `rejoin-train`, `close-boarded-pr`, `rejoin-archive`) and `name=value` in message texts. The test will force it in task 3.4.
- [ ] Fix during implementation: add one test of D-3 step 2 for a branch name that contains two change ids (the rule is stated: the last segment equals the id, else the single id the name contains).

## 11. Explicitly out of scope
- [ ] GitHub's merge queue, the train under `two-prs`, any timer or cron departure, a stop lock for a train run, `devkit-project` slices on a train, switching the train on in this repository (non-goals of the proposal).
- [ ] The coordinating session sending `/devkit train` on its own (`roadmap-sessions-upfront`).
- [ ] The `origin/main` merge before phase 1 and before 6.5 (the change coordinator's, tasks.md line 13), and the owner's acceptance of ADR 0019 at plan approval.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: 13 to 21 minutes per update, `stage-roles` four times on 2026-11-22, bounded by ADR 0019.
2. Is the result measurable? Yes: AC-1 to AC-12 each name a test, and AC-2 and AC-5 are reachable in CI.
3. Are error behaviors defined? Yes: setting, record, join, suite, red base, an archive that cannot join, a stale lock, a failed update of the train.
4. Are edge cases covered? Yes, including an archive riding an open train and a merge made and not pushed.
5. Are dependencies clear? Yes: `release-merge-conflict` code on `main`, `delivery-models` archived, the siblings' meeting points listed.
6. Are contracts defined? Yes: the record, the setting table, the row tables, the script's JSON and exit codes; the literal message texts are left to the reply test (section 10).
7. Can two developers interpret this differently? Not on a behavior; only on the wording of messages, which the reply test constrains.
8. Are any decisions implicit instead of written? None that changes behavior.
9. Do the tasks fully deliver the intended outcome? Yes: a change boards in CI, a leaving archive has a path, every AC has tasks and a gate.
10. What will be discovered too late if implementation starts now? Nothing the plan's tests and the 6.9 whole-suite run would not catch earlier; the open facts (which ending GitHub gives boarded pull requests, how often archives conflict) are assigned to the first train's retro.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan and accepts ADR 0019 (task 6.1).
- What must be fixed? Nothing before implementation; the two items of section 10 during it.
- Main risk if ignored? The message texts failing the "no internal term" reply test at task 3.4, which is caught there.
