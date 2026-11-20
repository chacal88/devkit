<!-- devkit-stage readiness result=passed attempt=2 commit=6e4c0635215b4a1da287461e3713c9efe010db4d -->
# Readiness review: change-coordinator

Round 2. The planner revised the package after round 1 (every changed file says `attempt=2`:
`proposal.md`, `design.md`, `tasks.md`, `specs/change-coordination`, `specs/coordination-locks`;
`requirements.md` and `specs/change-stages` are unchanged). Each round 1 finding was re-checked against
the files and the code as they are now, and the changes were read for new problems. Commands run:
`openspec validate change-coordinator --strict` (valid, exit 0) and `python3 scripts/check.py` (all
checks passed, exit 0). The 13-minute hook suite was not run.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

All five round 1 Mandatory findings are closed, with the evidence below. No Mandatory finding is
open. Four small points are left as optional (section 10); none blocks a task.

## 2. Scope validation
Classification: correct

Unchanged from round 1. The additions (the `deliveryRow` export, ADR 0011, the probe task 3.1) are
needed by the findings and add no behaviour of rounds 16 to 26. "No behaviour of X changes" wording
holds: `conduct-check.mjs` gains one `export` keyword and nothing else (D-11 evidence row,
`design.md:812-813`; task 1.2 verifies with `git diff -U0`).

## 3. Proposal review
The bullet on the loop now says the step comes from `deliver-check` "or one of the two overrides
`conduct-check` adds ... reused through one new export" (`proposal.md:22-26`), which is true. A new
section "What the owner approves" (`proposal.md:167-176`) names ADR 0011 and the stated limits of AC-5,
AC-6, AC-11 and AC-14, with the criteria left worded as `requirements.md` has them. Impact lists, version
bumps and dependencies still match the files (0.15.1, 0.7.1, 0.2.1, 0.19.1).

## 4. Design review

**Round 1 finding 1 (the two `conduct-check` overrides): closed.** Re-derived in
`plugins/openspec/hooks/conduct-check.mjs`:
- `rewrittenBranch` (`:363-372`) gives `push-rebased`; `releaseConflict` (`:397-421`) gives
  `resolve-release-conflict`, `update-branch` (clean merge, `merge` mode) or a `blocked` step for other
  paths; `deliveryRow` (`:423-430`) puts `disable-auto-merge` first, then override 2, then override 1.
  `deliver-check.mjs` contains neither new step name, as round 1 found.
- Does one `export` on `deliveryRow` leave behaviour unchanged? Yes. It is a function declaration;
  adding `export` changes no binding, no call site and no order, and `conduct-check.mjs` has no
  top-level code that reads its own export list. Its dependencies (`deliveryStep`, `rewrittenBranch`,
  `releaseConflict`, `actorOf`, `stateOf`) stay module-private and are called from inside.
- Does it give the loop what D-5 says? Yes. `deliveryRow(ctx, row, d)` reads from `ctx` only `ref`
  (`:404`, `:410`, `:412`) and `base` (`:416-417`); from `row` only `worktree` (`:365`, `:404`, `:412`);
  from `d` the `state` (`branch`, `dirty`, `pr`, `archive`, `ship`) and `report` (`next`, `summary`, `met`,
  `host`) that `collectState` (`:1098`) and `buildReport` (`:1195`) of `deliver-check.mjs` return, both
  exported. D-5's `ctx = { ref: "origin/<base>", base }`, `row = { id, worktree: root }` is therefore
  enough. It returns `{ next, state, delivered }` and the step is in `next.step`, as D-5 reads it.
  Override 3 (`serializeArchives`, `:436`) is not used, correctly: one run is one change.
- The B rows now cover the outcomes: B1a and B2a (`design.md:382-384`), `update-branch` and the
  override's `blocked` inside B6 and B14, and the B16 test fails both on a returnable step with no row and
  on a row naming a step no checker returns (`:398`, task 1.1). The spec delta has four scenarios
  (`specs/change-coordination/spec.md:192-205`: release files only, a branch the loop's own rebase
  rewrote, a conflict in another file, a clean merge in `merge` mode). Task 1.1 adds a fixture of a pull
  request conflicting in `CHANGELOG.md` and `marketplace.json`, in the form of `conflictRepo`
  (`conduct-check.test.mjs:636`, which exists and is file-private, so the test builds its own).

**Round 1 finding 2 (ADR 0010 decision 8): closed; ADR 0011 as drafted holds.**
- Repository rules (`openspec/config.yaml:34-35`): a decision that changes an ADR is proposed as a new
  ADR, and an ADR-rejected approach needs its own ADR. D-16 (`design.md:1034-1100`) drafts ADR 0011 in
  full; D-15 no longer concludes "no new ADR"; the Alternatives table lists the Note-only option and the
  fail-closed hook as rejected, with the reason. The Note on ADR 0010 now points at it (D-13).
- Structure: the draft has the header lines (`Status`, `Date`, `Change`, `Amends`), `## Context`,
  `## Decision`, `## Consequences`, `### Review trigger` and `## Alternatives considered` with the table
  `Option | Pros | Cons | Cost to undo`. The ADR tests in `guard.test.mjs` require exactly
  `Decision`, `Consequences`, `Review trigger`, `Alternatives considered` as `^#+ X$` and a `- Status:`
  line (`:1292-1300`, `:1330-1371`; ADR 0004's test accepts `proposed`), no duplicate number, and, for ADRs
  that tests list, the number in `config.yaml`'s `ADRs:` line. Task 6.2 adds 0011 to that line, task 6.3
  adds `- Amended by ADR 0011 (...)` under ADR 0010's status, in the form ADR 0006 already uses
  (`0006-...md:4`), with ADR 0010 staying `accepted`. Task 6.1 writes a test for the four headings.
- Honesty about weakness: the Consequences state that the guarantee is weaker than a missing tool and
  fails open, and the Review trigger names the transcript form and the live run.
- The acceptance path is workable: the ADR is written as `proposed` (6.2), flipped to `accepted` only when
  `approval.md`'s `Owner's words:` line accepts it (6.3), otherwise the task stops. See O2 below.

**Platform facts.** Re-read against `platform-facts.md`: still no contradiction. New in this round: the
probe D-12a (task 3.1) tests S1 (the typed command's stored form), S6 (the tool-result line `devkit-run:`),
S7 (`--resume` keeps the typed command) and S2 (`background_tasks`) in a scratch project before any lock
is built, with a stop condition and a T2 fallback; the live test D-12 keeps S3 and S4. The `-p` plus
`--resume` plus `--plugin-dir` combination is now inside the probe. The probe's throwaway skill is
project-scoped and `--plugin-dir` loads the pack whose hooks are silent in a project that has not opted
in, so it cannot trigger a lock.

**Other claims, re-verified.** The `-p` command lines, the `Stop` settings hook and the grep in gate 7.2
(`"mode":"stop",.*"decision":"refuse"`) match the log line order the design fixes (`at`, `mode`, `session`,
`agentType`, `change`, `decision`, `why`). The 14 removed tests are named in task 4.2 and the names match
`guard.test.mjs:1083-1260`; `conductMd` at `:1081`; `grep -c conductMd` must print 0 afterwards.
`report.test.tsx:214` is now in D-11 and task 5.x. All of D-5's other claims, the lock tables and the
decision rows were rechecked and stand.

**Decision-table rows against scenarios (today's rule).** The five rows missing in round 1 now have a
scenario: `start` usage error (`spec.md:26-28`), `open` refusing when not set up or with an unbuilt driver
(`:92-94`), the worktree start point with and without a remote (`:84-90`), a blocked change called again
(`:281-283`), the `resumed` reply (`:140`, `:144`). The override rows are covered (above). Nothing else
is uncovered.

## 5. Specs review
Valid under `--strict`. 75 scenarios in `change-coordination`, all WHEN/THEN, normative `SHALL`. The
requirement "From the implementation on" now names the overrides. `coordination-locks` and
`change-stages` are consistent with D-8 and D-10; the `change-stages` delta is unchanged.

## 6. Tasks review
- Seven phases, each ending in a gate whose exit code decides: 1.4, 2.3, 3.4, 4.5, 5.3, 6.8, 7.2. Phase 3
  now starts with the owner-run probe 3.1; phase 6 starts with the ADR tests and has the ADR tasks 6.2 and
  6.3; the whole suite is gate 6.8; there is no "phase 8" any more.
- Gate 1.4 adds `^conduct` so conduct-check's 92 tests (names start `conduct:`) run against the export;
  gate 7.2 now fails unless `hooks.jsonl` holds a `stop` and a `subagent-stop` refusal.
- New hook tests run with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set in every gate and blank the six
  variables through one constant. Existing tests that change (4.2, 5.1) name invariant, layer and suite;
  the count is 14.
- No quoted Markdown checkbox line is used as an example (the only `- [ ]` lines are tasks).
- AC map: every AC id appears in tasks (AC-8 now also 6.2 and 6.3; AC-11 also 7.1).
- The "Stated limit" column (`design.md:1104-1125`) carries the limits of AC-1, AC-5, AC-6, AC-8, AC-11 and
  AC-14, and task 7.1 makes `pr-verifier` write each limit into that criterion's evidence row. Round 1
  finding 5 is closed. The requirements' wording is untouched, and the proposal asks the owner to accept
  each limit with the plan.

## 7. Omission detection
Validation, errors, retries, idempotency, fail-open, bypass, opt-in, rollback, migration, observability
and compatibility with the shipped release-conflict behaviour are now covered. One hardening point is
left to implementation (O1).

## 8. Execution risks (top 5 failures)
1. The probe shows S1, S6 or S7 false. Cause: undocumented transcript form. Impact: run detection needs
   another source. Prevention: already handled; task 3.1 runs before any lock and stops phase 3.
2. The loop's `next` blocks wrongly when the session environment carries `DEVKIT_BRANCH`, `DEVKIT_CHANGE`,
   `GITHUB_HEAD_REF` or `GITHUB_BASE_REF`. Cause: `conduct-check` removes these before calling
   `collectState` (`cleanOf`, `:320-340`); D-5 does not say the loop does. Impact: `stop-branch` from a
   stale variable. Prevention: O1.
3. The owner approves the plan without answering ADR 0011. Cause: the approval ask is written by the
   session from the proposal's What Changes, not from "What the owner approves". Impact: task 6.3 stops
   mid-implementation. Prevention: O2.
4. S3 (an interactive session takes a turn when a background command ends) is false. Impact: the owner
   calls the command again. Prevention: the reply says that is safe; the limit is stated and accepted at
   approval; round 16 proves it.
5. Model paraphrase of a reply (AC-11 limit). Prevention: locks plus the stated limit.

## 9. Mandatory fixes before implementation
No open Mandatory finding. Round 1 findings, each closed:
- [x] High, the two `conduct-check` overrides: `design.md:289-312`, `:382-384`, `:398-399`, `tasks.md` 1.1
  to 1.3, `spec.md:192-205`; `export` on `deliveryRow` verified harmless and sufficient.
- [x] High, ADR 0011: `design.md:1034-1100`, `tasks.md` 6.1 to 6.3, `proposal.md:167-176`.
- [x] Medium, five rows without a scenario: `spec.md:26-28`, `:84-94`, `:140-144`, `:281-283`; tests in
  task 2.1.
- [x] Medium, 14 tests, not 13: `tasks.md` 4.2, `design.md` D-11.
- [x] Medium, stated limits: `design.md:1104-1125`, `tasks.md` 7.1, `proposal.md:167-176`.

## 10. Optional improvements (within scope)
- [ ] O1 (new) `design.md` D-5, `tasks.md` 1.3: say that `nextAction` calls `collectState` and
  `buildReport` with the environment minus `DEVKIT_CHANGE`, `DEVKIT_BRANCH`, `GITHUB_HEAD_REF`,
  `GITHUB_BASE_REF` and `DEVKIT_BYPASS`, as `conduct-check.mjs:320-340` does (its `cleanOf` is not
  exported; copy the five names), and add one test with `DEVKIT_BRANCH` set.
- [ ] O2 (new) `tasks.md` / the `devkit` skill's approval row: state that the approval request quotes
  `proposal.md` "What the owner approves" (ADR 0011 and the stated limits), since the shipped
  `stop-plan-approval` row summarizes only What Changes, the design decisions and the phases.
- [ ] O3 (new) `design.md` D-16 and task 6.3: "accepts ADR 0011" is read from free text of at most 200
  characters; say that the conducting session asks the owner a yes/no on ADR 0011 in the approval request
  so the words are unambiguous.
- [ ] O4 (new) `tasks.md` 1.1: `conflictRepo` is private to `conduct-check.test.mjs`, so the new fixture
  duplicates its shape; acceptable, but say so in the task, or export it from that test file.
- Round 1 optional points O1 to O7 are all addressed: O1 heredoc terminator (`design.md:177-180`), O2 probe
  (D-12a, task 3.1), O3 gate 7.2 (grep of both refusals), O4 the T5 refusal names the `next` command
  (task 3.2), O5 no "phase 8", O6 ADR 0009 gets a Note (D-11 `:779`, D-13, task 6.4), O7 `report.test.tsx:214`.

## 11. Explicitly out of scope
- [ ] The Workflow path of the review stage (A-11), the other `devkit:` fields, the two A-12 findings,
  `conduct-check`'s override 3 (round mode) and the release tag stay out; correct.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes; the limits of AC-5, AC-6, AC-8, AC-11 and AC-14 are stated per criterion
   and carried to the evidence rows.
3. Are error behaviors defined? Yes, including the usage error, the unbuilt driver in `open`, fail-open
   and the release-conflict paths.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes (round 14 at `6e4c063`, the one `export`, the openspec CLI 2.x, the app's
   binary).
6. Are contracts defined? Yes.
7. Can two developers interpret this differently? Only at O1 (the environment passed to the checkers).
8. Are any decisions implicit instead of written? No; the mechanism change is ADR 0011.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? S3 only, which is stated and accepted;
    S1, S2, S6 and S7 are now found by the probe before any lock exists.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan and, in the same message, accepts or refuses ADR 0011.
- What must be fixed? Nothing mandatory; O1 to O4 are cheap and best done during phase 1 and in the approval
  request.
- Main risk if ignored? O1: a stale branch variable in the session making the loop stop with a wrong
  reason; O2 and O3: task 6.3 stopping because the owner's words did not clearly accept ADR 0011.
