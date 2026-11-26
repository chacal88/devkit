<!-- devkit-stage readiness result=passed attempt=14 commit=cccd21b93846496215600e6a9b6369080213a8f6 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD cccd21b. The last readiness report (attempt 13, header commit 0b71037) returned NEEDS-REVISION with
two Mandatory findings. The commit after it (cccd21b) revised the plan to address them. `git diff f29093d cccd21b`
on the change folder shows these edits:
- `tasks.md:525-561`: new task 6.4d.
- `tasks.md:10`: the D-16 range is now "T1 to T148".
- `tasks.md:60`, `:66`, `:68`, `:79`: the AC-1, AC-7, AC-9 and AC-19 rows now name 6.4d.
- `design.md:280-289`: D-1 now states the guard forms it leaves unmatched.
- `design.md:809-855`: D-12 now quotes the compozy-kit sentences, the ADR 0032 Note and the ADR 0023 header line.
- `design.md:1385-1387`: D-20 now says "three readers".
- `design.md:1736-1775`: the Modify list and the estimate changed, with a new 2 h row.
- `specs/change-coordination/spec.md:330`: the scenario now says "the first 200 characters".
- `specs/change-stages/spec.md:8`: the requirement now says "every `.md` file".
- `specs/file-writers/spec.md:34-35`: the requirement now says which command text the guard matches.
- Every spec delta and every artifact gets a new stage header.

The caller gave facts and no verdict. Nothing in its message was taken as a verdict.

Checks run at HEAD (`TMPDIR=/var/tmp/devkit-coordinator-loop-fixes`; before the test run, `pgrep -f
'scripts/test-suite.mjs$'` found no other run):
- `openspec validate coordinator-loop-fixes --type change --strict --no-interactive`: "Change 'coordinator-loop-fixes'
  is valid".
- `python3 scripts/check.py`: exit 1, only `openspec/changes/coordinator-loop-fixes/evidence.md:91: non-English
  text`. That line is in the evidence, not in a plan file (section 7).
- Task 6.4d's Check (`tasks.md:559`), run as written (`--concurrency=2`): "3 files, 14 tests, 14 pass, 0 fail, 35.2s".
- `grep -c "^ver-r7s .*: pass$" openspec/changes/coordinator-loop-fixes/proof/checks.txt` prints 1. That is 6.4d's
  second Check.
- `openspec/config.yaml` and `docs/adr/` are unchanged since attempt 13 (`git diff 0b71037 HEAD`), so no new rule
  applies. `rules.readiness` holds one rule: the plan-readiness-reviewer alone writes this file. `origin/main`
  (fc28735) is an ancestor of HEAD.
- The whole suite was not run. The caller's notes forbid it.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Both Mandatory findings of attempt 13 are closed (sections 4 and 6). Two of the four optional items are fixed. The
other two are recorded in section 10 as no finding. No new finding blocks implementation.

## 2. Scope validation
Classification: correct.
- Task 6.4d records work already built in 59b8350, f1acdfd, 66f3553, 3ec3322 and 5dc0830. It adds no behaviour that
  attempt 13 did not review.
- D-1's new sentence narrows the guard's claim to the form it matches. It adds no code.
- It lists widening the guard to the other forms as a follow-up, not as part of this change.
- The spec wording edits make the deltas match code that already exists. They add no scope.

## 3. Proposal review
No findings. `proposal.md` is unchanged.

## 4. Design review
I checked each revised claim against the code or the committed files:
- D-12, the three quoted blocks (`design.md:818-825`, `:833-845`, `:852-854`). Each fenced block, with its indent
  removed, is a byte-for-byte substring of the committed file:
  - the compozy-kit block: `docs/compozy-kit.md:125-130`;
  - the ADR 0032 Note: `docs/adr/0032-the-loop-declares-the-decisions-outside-the-stage-gates.md:78-88`;
  - the ADR 0023 header line: `docs/adr/0023-the-model-is-chosen-by-stage.md:5`.

  I compared them with a script. Where D-12 places each one also matches:
  - The Note comes after decision 8 (`:75-76`) and before `## Consequences` (`:90`), with one blank line on each side.
  - The header line comes after the two `- Status:` lines and before `- Date:`.
  - The compozy-kit sentences follow the sentence that ends "lists each limit." (`docs/compozy-kit.md:124`).

  Attempt 13's finding that the D-12 words were missing is closed.
- D-1's unmatched forms (`design.md:280-289`). `DECLARE_CALL` (`plugins/openspec/hooks/guard.mjs:746`) skips only
  words that start with `-`. I called `declareViolation` for `devkit-core:tdd-implementer`:
  - Refused: `node --no-warnings "<path>/change-loop.mjs" declare ...`, and the `cd <dir> && ... --stdin words
    <<'DEVKIT_ARGS'` form.
  - Allowed: `node -r ./x.cjs <path> declare ...`, `node --stack-size 2000 <path> declare ...` and `node "$S"
    declare ...`.

  These results are what D-1 decides. The claim that the harm is bounded also holds. `declare` accepts only two
  keys, `gate-red` and `review-round` (`plugins/openspec/hooks/change-loop.mjs:3209-3210`). The readiness file, the
  approval and the reviews keep their own writers. Attempt 13's open question on option values is now decided in
  writing.
- D-20's "three readers" (`design.md:1385-1387`). On `origin/main`, `isArchiveHead` drops a head in three places:
  `isOwnPr`, the `rest` filter of `findChangePr` and `findByCommits` (`git show origin/main:...deliver-check.mjs`,
  lines 730, 808 and 839). At HEAD all three call `foreignArchiveHead` (`deliver-check.mjs:746`, `:824`, `:855`).
- D-12's compozy-kit entry (`design.md:809-816`) now says "two sentences". That matches the committed file.
- The ADR rule ("a decision that changes an ADR is a proposal for a new ADR") does not apply. The ADR 0032 Note
  states it changes no decision's text, and T147 checks decisions 1 to 8.

No findings.

## 5. Specs review
Strict validation passes.
- `specs/change-coordination/spec.md:330` now matches D-4's cut: `words.slice(0, 200)` at `change-loop.mjs:3250`.
- `specs/change-stages/spec.md:8` now matches `specFiles`, which takes `.md` files only.
- The requirement at `specs/file-writers/spec.md:31-35` now names the matched form: "the script's path written
  after `node` and any option words that start with `-`". That is the form `DECLARE_CALL` matches and T99 tests. The
  scenario at `:48-50` stays consistent with it.

No findings.

## 6. Tasks review
- Task 6.4d (`tasks.md:525-561`) names every unit of the revision as D-1, D-4, D-12 and D-16 give them:
  - `runDeclare`'s `--stdin words` through `withStdinParam`, the entry point's stdin read and `USAGE`;
  - the two skill rows;
  - `DECLARE_CALL`'s option words and the two forms it leaves unmatched;
  - T146;
  - the three document edits.

  It writes T143 to T148 and brings T44 and T99 to their D-16 rows. It names each test's file.
- The `tasks` rule on texts that a test pins holds:
  - The old `--param words` skill text was asserted only in `change-loop-declared.test.mjs` (T44). That is the file
    the task names. The `--param words` hits in `guard.test.mjs:1845` and `:1857` are command inputs, not
    skill-text assertions.
  - 6.4d's grep for the replaced compozy-kit sentence finds nothing. I re-ran it.
- 6.4d names no literal ADR number. It reads the ADRs by file pattern, as the `tasks` rule on ADR numbers requires.
- Its Check passes as written. It runs at concurrency 2 and carries a count that was run at HEAD.
- The D-16 range (`tasks.md:10`) and the AC-1, AC-7, AC-9 and AC-19 trace rows are updated.
- Task 6.4d is written ticked, with the commits that did the work. That is the planner's call (attempt 13,
  section 6).
- Gate 6.6 is unchanged, and it is still the train's command.

Attempt 13's tasks finding is closed. No findings.

## 7. Omission detection
No findings in the plan.
- Error handling of `--stdin words`, an unterminated input, idempotency, rollback and migration are unchanged from
  attempt 13, and all are defined there.
- Outside the plan, carried over: `python3 scripts/check.py` fails at HEAD on
  `openspec/changes/coordinator-loop-fixes/evidence.md:91`. Gate 6.6 (`tasks.md`) and the train's command both run
  `check.py`, so the train goes red until `devkit-core:pr-verifier` rewrites that line in English or replaces it
  with a pointer to the proof file. The caller's note says the verifier rewrites it after the next base merge. This
  is not a plan blocker.

## 8. Execution risks (top 5 failures)
1. Cause: the train runs `check.py` before the verifier rewrites `evidence.md:91`. Impact: the train goes red after
   the review. Prevention: the verifier's evidence rewrite after the base merge, before the train.
2. Cause: a later subagent prompt writes `node -r <m> <path>/change-loop.mjs declare ...`. Impact: the guard lets
   it through. Prevention: D-1 bounds the harm: a review round or a red gate can be recorded, but nothing can be
   approved. The follow-up D-1 names widens the pattern.
3. Cause: `renumber-adr` renumbers ADR 0032 or 0033 at a later merge. Impact: the ADR 0023 header line and the
   compozy-kit link name the old number. Prevention: `renumber-adr` carries the references, and T147 and T148 read
   the numbers by file pattern, so a missed carry fails them.
4. Cause: the owner approves without re-recording `approval.md`. Impact: the plan digest and readiness hash in the
   approval are stale, and `next` returns the plan to its gates. Prevention: the owner records the approval of
   this plan again.
5. Cause: the owner's words exceed 200 characters. Impact: `declared.json` holds the first 200 characters only.
   Prevention: this is now the stated contract (`specs/change-coordination/spec.md:330`), so it is not a defect.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low: `tasks.md:350` (task 4.6, ticked) says "the sentence of `docs/compozy-kit.md` that D-12 names", but D-12
  now names two sentences. Task 6.4d delivers the second one, so the work is covered. Only the older task's
  singular is stale. Smallest correction: "the sentences".
- [ ] No finding: attempt 13's D-1 item (option values) and its two spec wording items are fixed (sections 4 and 5).

## 11. Explicitly out of scope
- [ ] Widening `DECLARE_CALL` to an option with a separate value, or to a script path held in a variable. D-1 calls
  this a follow-up.
- [ ] The round 2 code-quality nit F3 (`planDigest`'s checkbox regex and `- [text]` links). It is a code nit on an
  approved D-7 rule.
- [ ] The `evidence.md:91` language fix. It belongs to the verifier's file, not to the plan.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. Each round 1 finding has a unit, a test and a commit in task 6.4d.
2. Is the result measurable? Yes. T44, T96 to T102 and T143 to T148 pass by name at HEAD (14 of 14). The `ver-r7s`
   proof line is recorded.
3. Are error behaviors defined? Yes. Each refusal of `--stdin` exits 3 and records nothing (T145). A subagent's
   matched `declare` call is refused with a message (T99).
4. Are edge cases covered? Yes. D-1 decides the guard forms it does not match, and the spec states the
   200-character cut.
5. Are dependencies clear? Yes. `withStdinParam` is shared with `reply`, the terminator rule lives in the devkit
   skill, and `renumber-adr` carries the ADR references.
6. Are contracts defined? Yes. The CLI form, the guard pattern and the three document texts are given word for word
   in D-4, D-1 and D-12.
7. Can two developers interpret this differently? No, not in a way that changes behaviour. The texts are quoted,
   and the guard's reach is stated.
8. Are any decisions implicit instead of written? No. The decision left open in attempt 13 (option values) is now
   written in D-1.
9. Do the tasks fully deliver the intended outcome? Yes. Task 6.4d covers the revision, and gate 6.6 covers the
   rest.
10. What will be discovered too late if implementation starts now? Only the `evidence.md:91` failure of
    `check.py`, which is outside the plan and already known (section 7).

## 13. Final conclusion
- Can we start? Yes. The revised plan is consistent with the code and the committed documents. Strict validation
  passes, and the revision's tests pass at HEAD.
- What must be fixed? Nothing in the plan. Before the train, the verifier must fix `evidence.md:91`. The owner
  approves the revised plan again, which re-records `approval.md`, because this report changes the readiness hash.
- Main risk if ignored? The train goes red on `check.py` if the evidence line is not rewritten.
