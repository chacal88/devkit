<!-- devkit-stage readiness result=passed attempt=3 commit=34e3500db260bff6af03280818740ef85a2eb1a3 -->
# Readiness review: archive-release-pin

Round 3, the review of the plan amended after its first approval (phase 4, ADR 0030, grill answer A3). Reviewed at `34e3500` with the amended plan files uncommitted in the worktree (`decisions.md`, `design.md`, `proposal.md`, `requirements.md`, `specs/reviews-check/spec.md`, `tasks.md`, and the untracked `docs/adr/0030-...md`). Checks run, with `TMPDIR=/var/tmp/devkit-archive-release-pin` and no whole suite: `openspec validate archive-release-pin --strict` valid; `python3 scripts/check.py` all checks passed; `python3 scripts/gen-catalog.py --check` exit 0; `claude plugin validate .` passed. Filtered runs on the base: the phase-4 gate command of task 4.6 as written (ten files, fourteen name patterns) gave 148 tests, 148 pass, exit 0; the red-run command of task 4.1 on the base gave 11 tests, 11 pass (the phase-3 versions, as it must before the flip). No instruction on the verdict was given by the caller.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Phases 1 to 3 are history (ticked, shipped on PR 107) and stay as the record. Phase 4 (tasks 4.1 to 4.6) is the new work, and an implementer can build every task from `design.md` D-2, D-5, D-6, D-7, D-8, D-9, D-10 and D-12 amended without a design choice. No blocker was found; the findings below are Low.

## 2. Scope validation
Classification: correct

The amendment has one cause and one remedy: the delivery train cannot join the pin block of the loop's test, so the test reads the manifest and the test-file half of the archive rule goes. Scope is: delete 29 lines of one test, delete `PIN_TEST_LINES` and the test-file branch of `pinLinesOnly`, delete two fixtures, flip eight tests and add one, edit three docs, two ADR headers and Notes, the config line and the CHANGELOG bullet, and run a second real-run set. The non-goals in `requirements.md` ("Teaching `release-merge.mjs` to resolve any test file") match ADR 0030's rejected alternatives. The removal of the test-file half is consistent in `requirements.md` (A3, AC-3, AC-4, AC-9, AC-10, Out of scope), `proposal.md` (Why, What Changes, AC table, Impact), `design.md` (amendment block, D-2, D-5, D-6, D-7, D-8, D-9, D-10, D-12, risks), the spec delta (new requirement "No test file passes the archive file check by its content"), `tasks.md` (table, phase 4) and ADR 0030 (Decisions 1 and 2).

## 3. Proposal review
- Problem, goal and the amendment's reason (train carries one release) are clear and cite A3 and ADR 0030.
- `reviews-check` stays a modified capability; no new capability.
- AC-1 to AC-10 are copied with ids and each has a delivery row; AC-3, AC-4 and AC-9 are rewritten for the one-file rule.
- Impact names the code, the tests (with the file `deliver-check-archive.test.mjs` where the tests live since suite-speed), the two fixtures, the docs, the release files and the dependency on ADR 0030 being accepted by `accept-decisions`.

## 4. Design review
No ADR is contradicted: ADR 0030 amends ADR 0027 and ADR 0003 by the ADR 0018 pattern (header line plus Note) and builds on ADR 0022. `openspec/config.yaml` rules re-read: `rules.tasks` (no literal version, a test file named for changed text, a gate task per phase) and `rules.design` (a sentence about a test names its file) hold for phase 4.

Claims re-derived against the code at `34e3500`:

| Claim | Result |
|---|---|
| `deliver-check.mjs` 1359-1376: comment, `PIN_LINE_FILES` (two paths), `PIN_TEST_LINES`, `pinLinesOnly` with `if (path === PIN_LINE_FILES[0]) return ...`, the `kept` helper, the array comparison | true (line 1359 is the comment, 1376 the closing brace) |
| `RELEASE_FILE` comment at 1379 and the `unnamedFiles` comment at 1386-1387 read as D-2 amended quotes them | true |
| `archiveChanges` loop over `PIN_LINE_FILES` at 1329, unchanged by the amendment | true |
| `change-loop-compozy.test.mjs`: test at 325, closing `});` at 401, pin block 359-387 (Invariant comment, one `assert.match`, 27 `assert.doesNotMatch`) = 29 lines; the `v0.20.0` floor, `readRepo(... 'plugin.json')`, `pinsIn(flow).length >= 3` and `pinMismatches(flow, version)` follow it | true; I simulated the deletion: the body drops to 48 lines, no line holds a version outside the floor lines, no Invariant comment, none of D-6 test 12's 21 change names; test 12 is red now and green after |
| `pinMismatches` (line 303) filters every pin not equal to `v<version>`, so older pins still fail once the `doesNotMatch` lines go | true; `release-merge-conflict 15` (line 305) tests it |
| Test 11 inputs: `docs/openspec-flow.md` Classification bullet at 314, P13 row at 550, file-check paragraph at 571; every quoted source string (`([ADR 0027](...))`, the test-file clause with its trailing space, `Two files pass ... classified as above.`) is present once; line 571 holds `change-loop-compozy.test.mjs`, `assert.match(flow,` and `Invariant` only inside the replaced segment | true |
| ADR 0003 header (lines 3-8) and the `Note (archive-release-pin, 2026-11-23)` at line 16; ADR 0027 header (`Builds on:` at line 8, `## Context` at line 10); a new 0030 line stays inside "first nine" and "first ten" lines | true |
| ADR 0030 exists, `Status: proposed`, 0028 and 0029 absent locally (the numbering rule of `decisions.md` covers a collision) | true |
| `openspec/config.yaml` ADRs line holds `0027 the archive check lets the release pin lines pass unnamed, amends 0003` and no 0030 | true |
| CHANGELOG entry `## 0.44.0` with the `**devkit-openspec** 0.40.0` bullet and the `Docs:` bullet as D-9 amended rewrites them; manifests at 0.40.0 and 0.44.0 | true |
| Fixtures to delete: `fixtures/c561553/change-loop.test.before.txt` and `.after.txt`; read only by tests 3 and 6 (lines 1117 and 1192 of `deliver-check-archive.test.mjs`) | true; no other reader (grep over the repository) |
| Tests 1 to 11 live in `deliver-check-archive.test.mjs` (1093-1264), test 10 in `release-merge.test.mjs:651`; `LOOP_PATH`, `FLOW_PATH`, `PIN_BASE`, `PIN_EDITS`, `PIN_DOC`, `loopLines`, `loopText`, `PIN_LOOP_*`, `textOf`, `fixtureText`, `pinArchive` exist; `LOOP_EDIT` is the one new constant | true |
| `D.PIN_LINE_FILES.includes(R.PIN_FILE)` in test 10 becomes `deepEqual(D.PIN_LINE_FILES, [R.PIN_FILE])` | true (current line 659) |
| Consumer CI: `deliver-check.mjs` imports only `merge-setup.mjs` and `guard.mjs` among local files; the amendment adds no import | true; case A5 and test 9 prove it |
| `c561553` and `c561553^` resolve in the clone; `change-loop.test.mjs` at `c561553^`/`c561553` is 2807/2808 lines, the doc at `c561553^` 696 lines | true, so A1 to A5 can be built |

The "Red before 4.2" column of D-6 amended is right for each test. Tests 1, 2, 4 and 9 do not depend on the removed half or only assert `false` cases that stay false. Tests 3, 5 (the two `LOOP_PATH` cases), 6 (paths `[FLOW_PATH, LOOP_PATH]` with pin-only texts for both gives `[LOOP_PATH]`, today `[]`), 7 and 8 (the `LOOP_EDIT` case), 10 (`deepEqual` on a two-element array), 11 and 12 fail on the base.

## 5. Specs review
Five requirements, each with SHALL and WHEN/THEN scenarios. The new one covers the flipped behavior: a change to a test file, the loop's test included, is named in the local stop and in `devkit-reviews --ci`. Every outcome of the D-2 amended rule (pin-only, beyond the pin, missing or unreadable side, final newline, empty text, other path) has a scenario or a named D-6 case; the `LOOP_PATH` outcome is held by test 3, 5, 6, 7 and 8 and by the requirement's scenario. The spec delta says nothing the proposal does not justify.

## 6. Tasks review
- Phase 4 is `## 4.` with six tasks, ending in a gate task (4.6) with one backticked command. Phases 1 to 3 stay ticked as history; their old file names and the withdrawn wording are marked as such in the header paragraph and in the AC table.
- Test-first order is real: 4.1 writes the flipped tests and test 12, runs them on `34e3500` and saves `proof/red-4.txt`, naming exactly which of the twelve fail (3, 5, 6, 7, 8, 10, 11, 12) and which pass (1, 2, 4, 9); 4.2 turns tests 1 to 10 green; 4.3 turns 12 green; 4.4 turns 11 green.
- No task writes a version or release number (phase 4 states so, and I found no `x.y.z` literal in the section). ADR 0030 is read, not edited, by tasks; 4.4 writes its number into header lines and Notes of ADR 0003 and ADR 0027, the config line and test 11, and the follow-up section covers a collision (see item 2 of section 10).
- Every gate selects tests that exist: I matched each of the fourteen patterns of 4.6 and the patterns of 4.3 against test titles and ran the 4.6 command (148 of 148 pass on the base, 142 s). `scripts/test-suite.mjs` accepts `--concurrency=2`, repeated `--test-name-pattern` and file arguments. `release-merge-conflict 15:` and `archive-release-pin 12:` (after 4.1) exist for 4.3.
- Checks carry counts that I confirmed at `34e3500`: 29 removed lines (4.3), twelve test names (4.1), two surviving fixtures (4.2), and A6's drop of 29 lines (every deleted line holds a dotted number; the grep pattern, after bash double-quote handling, is `[0-9]+\\?\.[0-9]+\\?\.[0-9]+`).
- Tests that assert changed text: D-7 amended greps for the identifiers and fixture names; the doc, ADR and config strings are asserted only by `archive-release-pin 11` (I grepped the repository for `Two files pass`, `pin assertion lines`, `pass unnamed` and `0027`), which task 4.1 flips and 4.4 turns green. The wider doc tests (`delivery-models docs`, `upfront ADR 0021`, `ADR 0003 exists`, `release-tags 4:`) are in the 4.6 gate and pass on the base.
- Every task path falls under a real directory.

## 7. Omission detection
- Validation, fail-closed reads, idempotency: unchanged and covered (D-2, D-3). No new error path; the removal narrows the rule.
- Rollback: revert the merge; the amendment adds a risk table (sibling edit of the pin block, ADR number collision, weaker stale-pin check) with mitigations that I found true (`pinMismatches`, test 12).
- Observability: the stop reason `files no approved proposal names: <path>` is unchanged.
- Test strategy: D-6 amended table (12 tests with red column), D-10 amended cases A1 to A6, the local stop proved by test 7 through `collectState`, stated as such.
- Consumer CI: three files still suffice, shown by test 9 and case A5.

## 8. Execution risks (top 5 failures)
1. Cause: a merge of `main` brings a sibling's edit of the pin block. Impact: conflict in `change-loop-compozy.test.mjs`. Prevention: D-12 says delete the whole literal block whatever the sibling wrote; test 12 fails on any literal left.
2. Cause: a sibling takes ADR number 0030 or the release numbers first. Impact: a re-merge, evidence and review (1-2 h on this machine). Prevention: the workflow follow-up re-checks `origin/main` before each push and lists every place to renumber.
3. Cause: the implementer runs `git status --short` as 4.1's check before the planning files are committed, so the list shows the plan files. Impact: a false alarm in the check. Prevention: the loop commits the plan before `implement`; otherwise read the list as "plus the plan files".
4. Cause: a later change reintroduces a version literal in the pin test. Impact: a release edits the test again and the train carries one release. Prevention: test 12, and ADR 0030's review trigger.
5. Cause: the pin markers change shape. Impact: the doc rule stops matching and every bump stops. Prevention: ADR 0027 and ADR 0030 review triggers; the rule fails closed.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low — `openspec/changes/archive-release-pin/requirements.md:19` (the assumption "The real diff of commit c561553 ... is a test fixture: its changes to `docs/openspec-flow.md` and `change-loop.test.mjs` both pass the new rule") is the one A1/A2-era assumption that A3 does not mark as withdrawn; AC-10 states the right rule (the doc passes, the test file is named). Smallest correction: append "(The test-file half is withdrawn by grill answer A3.)" as the other assumptions do. It changes no behavior and no task.
- [ ] Low — `openspec/changes/archive-release-pin/tasks.md` task 4.4 writes the literal `0030` into ADR header lines and Notes, and 4.2 runs `git rm` on two tracked fixtures (`CLAUDE.md`: destructive Git only with authorization). The first matches how task 1.1 used the literal ADR number and is covered by the follow-up renumbering list; for the second, the owner's approval of this amended plan is the authorization, so the approval should name task 4.2's `git rm`. Nothing to change in the artifacts.
- [ ] Low — `design.md` D-6 and D-10 keep the phase-1 tables above their amended tables; the "Amended" blocks say which rows flip. The reading order is clear but long. No change needed.

## 11. Explicitly out of scope
- [ ] Teaching `release-merge.mjs` to resolve a test file in a merge conflict (ADR 0030 Alternatives).
- [ ] Changing `RELEASE_FILE`, which pin lines exist, `stale-only-on-own-files`, or demanding a bump in the same diff.
- [ ] Rewriting `proof/real-run.txt`, `evidence.md` and the reviews (the evidence and the review bench run again on the amended head, by their own writers).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: a release edits the test's pin block, the train cannot join it, so two releasing changes conflict.
2. Is the result measurable? Yes: AC-1 to AC-10, each with a D-6 test, test 12 for AC-4 and a D-10 case.
3. Are error behaviors defined? Yes: missing, unreadable, other path, CRLF, final newline and empty text all fail closed and are tested; the test file is now named like any other.
4. Are edge cases covered? Yes: the escaped-quote and indentation cases remain as negatives for the test file; the doc cases are unchanged.
5. Are dependencies clear? Yes: ADR 0030 accepted before 4.1 (the task stops if not), ADR 0027 accepted, the consumer CI's three files, the release numbers left as on the branch.
6. Are contracts defined? Yes: `PIN_LINE_FILES = ['docs/openspec-flow.md']` (exported), `pinLinesOnly(path, pair)` with its last statement, `unnamedFiles(paths, proposals, texts = {})` unchanged.
7. Can two developers interpret this differently? No divergence found: the deleted lines are named by number and by first and last line, the doc texts are given verbatim, and test 12's body rule was simulated.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes: tests, code, fixtures, pin block, docs, ADR lines, config, CHANGELOG, proof and a gate.
10. What will be discovered too late? A sibling's ADR or release number (follow-up covers it) and the stale phase-3 evidence and reviews, which the plan already schedules to run again.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? A sibling release or ADR 0030 landing first and costing a re-merge; the follow-up section and the `origin/main` check before each push cover it.
