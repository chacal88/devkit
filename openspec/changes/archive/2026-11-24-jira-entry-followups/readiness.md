<!-- devkit-stage readiness result=passed attempt=3 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Readiness review: jira-entry-followups

Round 3, read at `697f699` (worktree `jira-entry-followups`; the plan files are uncommitted on top of it).
`openspec validate jira-entry-followups --strict` is valid (run for this round).
No test suite and no gate was run (the caller said both machines are full tonight). **Owed, not run:** the
short gate parts on the base (`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
`command claude plugin validate .`). They must be run, and their result recorded, at the first implement
step (or before the plan approval is asked); a red one is a Mandatory finding then. The long suites (1.9,
2.9, 3.9, 4.9, 5.9) are run by the phase gates. The claims about the code that the round-2 fix touches were
re-read at the lines cited; the others were derived in round 2 at the same commit and the code files have no
uncommitted change (`git status` lists change-folder files only).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The one Mandatory fix of round 2 (the AC-8 call form) is done in every artifact that carries AC-8, and the
revision introduced no inconsistency. An implementer can build every task without asking a question, and
every AC has a task and a way to be verified. The short gate parts on the base are owed (see above); that is
a run the caller makes, not a plan gap.

## 2. Scope validation
Classification: correct. Eleven ACs, each with at least one task (`tasks.md:27-39`); out of scope explicit
(`requirements.md:53-60`, `proposal.md:48-52`). The consequence flagged to the owner (an approved verdict
with an undisposed finding follows the rejected staleness rule) and now the AC-8 call form are both in
"Flagged for the owner" (`proposal.md:128-135`), so the approval accepts them knowingly.

## 3. Proposal review
Clear and consistent with the design. The impact list now names `roadmap-loop.test.mjs`
(`proposal.md:103`), which closes the Low item of round 2. No finding.

## 4. Design review
Round-2 Mandatory fix, re-checked:

| Part of the fix | Where | Result |
|---|---|---|
| AC-8 names the call as built (`reply write-back-failed --param key=<KEY> --stdin error`) | `proposal.md:65`, `requirements.md:48` (identical text) | fixed |
| One line in "Flagged for the owner" that the call form carries the option, and a `reply` without it reads no standard input | `proposal.md:133-135` | fixed |
| The rejected alternative (automatic read for `write-back-failed`, rejected for the 10 s wait on an open empty pipe and the implicit parameter) | `design.md:226-230` | fixed |

Code behind it, re-read: `runReply` (`change-loop.mjs:2425-2436`) parses only `--lang` and `--param` and
builds `params` from `--param` alone, so `--stdin` is new; `parseArgs` (`:2387`) already throws
`<flag> needs a value` for the last-argument case that the spec scenario expects; `isMain` (`:2606`) reads
standard input for `start`, `open`, `write-back` only, so the `--stdin` condition in D-5 is a real change and
the "no wait on an empty pipe" reason holds; the skill line `devkit/SKILL.md:115` and its pin
`change-loop.test.mjs:4794` are the text D-10 rewrites in task 4.2. `writeBackAsk` `:1414` and
`readFlowFile` `:421-433` (stage keys checked at `:433`, no version check before) are as the design says.

Round-2 optional items, all taken: `roadmap-loop.test.mjs` in the impact; task 2.5 now runs after 2.4 and
says the clone also receives this worktree's uncommitted change files (`tasks.md:115-117`); task 3.1 runs the
design's grep (`:157`); the scenario "A reply without the option reads no standard input"
(`specs/jira-tasks/spec.md:66-68`); D-2 says `readReviews` builds `reviews/<name>.md` from `verdictFiles`'
`name` (`design.md:129-131`); task 4.3 names the helper `openTaskChild(cwd, id)` (`tasks.md:190-191`).

New surface from this revision: none beyond those text edits. D-5's rejected alternative cites no number or
claim that fails against the code.

Constraints respected: no new import in `deliver-check.mjs` or `guard.mjs`; the rules section of
`review-round.workflow.js` stays pure; no ADR is contradicted; `config.yaml` rules (`tasks`: gate task per
phase, every AC in a task, version numbers as "the next free minor ... at that merge", test files named for
pinned texts; `design`: tests named by file) are met.

## 5. Specs review
`verdict-files`, `review-round`, `jira-tasks`, `change-stages`: normative language, `#### Scenario:` blocks,
MODIFIED requirements carry their text. Every outcome row of D-2, D-3, D-5, D-6 and the `tree` refusals has a
scenario; the `--stdin` scenarios use the call form of AC-8. No finding.

## 6. Tasks review
Ordered by dependency, `- [ ]`, one backticked gate per phase, tests first, every changed pinned text names
its test, files under real folders. Gates on the base: not run (head of this file), owed at the first
implement step. Task 3.1 stays large but unambiguous.

## 7. Omission detection
No gap: validation and refusals are defined with messages and exit codes; no retry or rollback surface beyond
the revert of the merge (`design.md` Migration Plan); the open lock is held longer by `unfinished()` and D-6
says so; compatibility is stated (older readers ignore top-level keys, `args.dirty` a stated breaking change,
update both packs per the follow-up). Observability, migration, feature flags: not applicable.

## 8. Execution risks (top 5 failures)
1. Cause: a fixture leaves a non-record change-folder file uncommitted next to a rejected verdict, so it now
   gets `commit`. Impact: red `deliver-check`, `conduct-check` or `change-loop` tests in phase 1. Prevention:
   the phase 1 gate as written; named in the design's risks.
2. Cause: the AC-9 race test waits a fixed 1 s with the lock held. Impact: flaky on a loaded machine; the
   assertion `[0, 3]` does not depend on which child wins. Prevention: as designed.
3. Cause: an approved verdict with an undisposed finding goes stale after any later commit outside the review
   record. Impact: one extra round-1 `review`, not a loop. Prevention: flagged to the owner.
4. Cause: the short gate parts on the base were not run for this change. Impact: a red base found at 1.9 or
   5.9. Prevention: run them at the first implement step, as stated at the head.
5. Cause: a project updates devkit-openspec and not devkit-core, so a `ship-change` row naming `tree` meets a
   core without it (exit 3, `review usage:`). Impact: one refused call. Prevention: the follow-up says to
   update both (`tasks.md:234`).

## 9. Mandatory fixes before implementation
None open. The round-2 fix is done (section 4). The three short gate parts on the base are owed by the
caller, at the first implement step; they are not a plan edit.

## 10. Optional improvements (within scope)
- [ ] `requirements.md:48` and `proposal.md:65` still end AC-8 with "the planner fixes the option's literal
  behaviour"; the design has fixed it, so the clause can go at the next edit of those lines (Low, no effect on
  the build).

## 11. Explicitly out of scope
- [ ] Committing `evidence.md` after verify and the waiting-for-a-place end: `loop-place-and-evidence`.
- [ ] What a merge of main makes stale: `stale-only-on-own-files`.
- [ ] Teaching an installed script to read a newer `flow.json`.
- [ ] Flow version 3 and any `readerRelease` in a shipped file (owner's answer of 2026-11-23).
- [ ] The other `--param error=` uses of the devkit skill.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: three loop defects and five nits, each with a cause found in code.
2. Is the result measurable? Yes: AC-1 to AC-11 are observable, each in a task, AC-8's call form now equal to the design's.
3. Are error behaviors defined? Yes: the reader, `tree` and `reply --stdin` refusals have messages, exit codes, scenarios and test rows.
4. Are edge cases covered? Yes: approved-with-finding loop, round-2 stop, record-only edit, nothing to fix, root with no commit, relative root, both line-break forms, release field at known and newer versions.
5. Are dependencies clear? Yes: four archived changes and two siblings, merge order stated.
6. Are contracts defined? Yes: exact messages, the `tree` output, `args.dirty`, `reply --stdin`.
7. Can two developers interpret this differently? No open point found.
8. Are any decisions implicit instead of written? No; the rejected alternative to `--stdin` is now written (D-5).
9. Do the tasks fully deliver the intended outcome? Yes, including the two `roadmap-loop` rewrites and the real-run proof (2.5).
10. What will be discovered too late if implementation starts now? Only a red short gate on the base, which the first implement step runs.

## 13. Final conclusion
- Can we start? Yes, after the caller runs the three short gate parts on the base at the first implement step (a red one is a Mandatory finding then) and the owner approves the plan with the two flagged consequences.
- What must be fixed? Nothing in the plan.
- Main risk if ignored? A red base found late at 1.9 or 5.9.
