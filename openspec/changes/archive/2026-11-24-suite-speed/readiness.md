<!-- devkit-stage readiness result=passed attempt=3 commit=720d91d3aeedc351af462f17a68b2fa680f444af -->
# Readiness review: suite-speed (attempt 3)

Reviewed at `720d91d` (worktree `suite-speed`, plan files uncommitted). `openspec validate suite-speed --strict`
passes (`skip_specs`, zero deltas accepted). No whole-suite command was run or timed (instruction of the
caller); gates 1.5, 2.5, 3.5, 4.4 and 5.4 and the two AC-2 runs are the conducting session's and their base
state is not established by this review. Scratch runs only: a one-file archive given a repository, and two
filtered runs (see section 2).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

The one blocker of attempt 2 is fixed in `design.md` D-10 step 1 and `tasks.md` 5.3. The fresh pass over the
whole plan against the repository found no blocker; one Low finding (an ADR count) is for task 3.4.

## 2. Attempt 2 follow-up

Blocker: the AC-2 base copy had no git state (High). Fixed.
- `design.md:354-370` D-10 step 1 now gives the `git archive` copy its own repository
  (`git -C <copy> init -q && git -C <copy> add -A -f`, no commit, no identity), names the two tests that need
  it (`deliver-check.test.mjs:3198-3199`, `change-loop.test.mjs:2491-2494`), says why a detached
  `git worktree add` was rejected (it writes `.git/worktrees/` into the shared repository), and says the base
  copy does not hold this change's folder and no test reads it (the optional item of attempt 2, also done).
  `design.md:387-388` repeats the repository for the one-file split proof.
- `tasks.md:216-227` (5.3) repeats the command, says "no `git worktree add`", says the AC-6 copy needs none, and
  its Check keeps "both AC-2 runs exited 0".
- I re-derived it. The two `git ls-files` calls are the only git reads of the repository root in the suite
  (`grep` over the suite's test files for `cwd:` of a repository-root binding and for `git` calls with
  `REPO_ROOT` / `repoRoot` finds exactly `deliver-check.test.mjs:3199` and `change-loop.test.mjs:2492`; the
  other `cwd: root` hits are fixture roots). On a scratch `git archive` copy, `git init -q && git add -A -f`
  makes `git ls-files` and `git ls-files --cached --others --exclude-standard -z` list the files with exit 0, and
  needed no commit or identity. In a full `git archive HEAD` copy given a repository the same way, the filtered
  run of `^AC-6 instructions-follow` (`deliver-check.test.mjs`, 3 tests) and of the `change-loop retire|docs`
  tests (3 tests, including the `repoFiles()` ones and `change-loop reply: the script runs from its file`, which
  runs the script with the copy as `cwd`) pass. `.gitattributes` does not exist, so `git archive` omits nothing
  by `export-ignore`. The AC-6 claim holds: `jira-task.test.mjs` reads no repository by git, and
  `merge-setup.test.mjs:16,28-29` reads files only.

## 3. Scope validation
Classification: correct. One script, one helper module, one CI step, one skip check, the texts that quote the
old command. Non-goals are tight; the plan's own scope extensions (8 exports dropped instead of moved,
`docs/adr/` exempt in T-14, `plugins/compozy/` out of the skip check) are labelled for the owner in
`proposal.md`.

## 4. Proposal and design review
Claims re-derived against the code at `720d91d`, all confirmed: `ci.yml:20-33` (the two steps, `TMPDIR` at
`hook-tests-tmp`, the old command at line 27); `CLAUDE.md:32`; `guard.test.mjs:1216` (`testFilesUnder`);
`test-tmp.test.mjs:136` (`rawTempCalls`) and `:179-192` (the AC-5 test, step names and parts exactly as D-8
describes); `plugins/panel/hooks/detail.ts:43-44`; `scripts/check.py` `SKIP_DIRS = {".git", "node_modules"}` and
`UNAWAITED_SUBTEST`; `change-loop.test.mjs:2578` (`v0\.33\.0`); `roadmap-loop.test.mjs:5132-5133` (ADRs line);
`openspec/config.yaml:31`; the ADRs on `origin/main` end at 0021 (0022 free); `guard.test.mjs` lines 12 to 31
hold 20 test-file imports (19 side-effect lines plus line 12). Everything attempt 2 confirmed is unchanged
(`proposal.md`, requirements and the rest of `design.md` and `tasks.md` were not edited after attempt 2; only
D-10 and 5.3 were).

Finding:
- Low, Fix during implementation: `docs/adr/0022-...md:12` says `guard.test.mjs` "imports 22 other test files".
  The code and `design.md:12` say 20 (21 files in the suite, the guard's own included). Task 3.4 edits this ADR
  anyway; correct the count there. The same sentence's "about 2356 tests" is the ADR's own figure and is not
  re-derived here (it needs a whole-suite run); phase 2's `suite:` line gives the real count.

## 5. Specs review
`skip_specs: true`, no delta, no capability. Justified: no behaviour of a shipped hook, skill, agent or schema
changes. D-1's exit-code table (0, 1, 2, 130, 143; `pass`/`FAIL`/`LEFT`) is covered by T-3, T-4, T-5, T-9,
T-10 and T-16. No decision-table row without a test.

## 6. Tasks review
Ordered by dependency, each phase ends with a gate command, every AC id is in a task (`tasks.md:36-47`),
test-first is stated, gate commands are single backticked texts with `&&` parts. Short gate parts that exist on
the base (`openspec validate suite-speed --strict`, `check.py`, `gen-catalog.py --check`,
`claude plugin validate .`) passed at this commit; nothing outside the change folder differs. Whole-suite gates
are marked as the conducting session's. The rule "a task that writes an ADR names the next free number, never a
literal" is met by 3.4 and 5.1. Task 4.2's one-file split proof refers to D-10's one-file form, which carries the
repository for the base copy (`design.md:387-388`).

## 7. Omission detection
No findings. Validation, errors, signals, leftovers, symlinked `TMPDIR`, rollback (revert the merge commit),
compatibility (Node 22 on CI, 26.13.1 on the worker), observability (per-file seconds, `suite:` line) and
evidence are defined. Retries and timeouts are explicit non-goals.

## 8. Execution risks (top 5)
1. A coupled or timing-sensitive file shows only at phase 2's first full run. Impact: hours within the 18 h
   estimate; the rule (fix the fixture or the wait, never skip) and the stop-for-the-owner rule cover it.
2. The 10-minute target missed with no file above it: D-11 stops and asks the owner; contingent.
3. A sibling change takes ADR 0022 or the release number before review: covered by 5.1 and 5.2.
4. An interrupted run leaves children or the run root: T-16 covers `SIGTERM`; `SIGKILL` is documented.
5. The old-command base run in the AC-2 copy fails on a test that depends on a commit of the repository root. I
   found none (see section 2), and a failure would be visible at 5.3 with its name; the plan says the run must
   exit 0, so the session would stop rather than guess.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Correct "22 other test files" to 20 in the ADR at task 3.4 (section 4).

## 11. Explicitly out of scope
- [ ] The compozy and panel tests, `commandLabel`, the other open changes' gate rows.
- [ ] Whether 10 minutes on the 8-core worker and 15 minutes on CI's 4 cores are reachable: measured in phase 4
  and after `open-pr`, both with a stop for the owner.
- [ ] The base state of the whole-suite gates (the conducting session's).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: 43 minutes by one process, target 10, same tests.
2. Is the result measurable? Yes: time (phase 4, AC-5b), test names (AC-2, base copy with its own repository).
3. Are error behaviors defined? Yes: exit codes, refusal text, leftover, signals.
4. Are edge cases covered? Yes: symlinked `TMPDIR`, same-named files in two folders, crash mid-line, unknown counts.
5. Are dependencies clear? Yes: `roadmap-sessions-upfront` merged, Node 22 on CI, `openspec` 2.x on `PATH`.
6. Are contracts defined? Yes: arguments table, output frame, exit codes, module exports, T-14 matcher.
7. Can two developers interpret this differently? No material point left.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? A coupled test file at phase 2 (budgeted); a missed time target at phase 4 (stop rule).

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation; the ADR count at task 3.4.
- Main risk if ignored? Only the Low ADR count: a wrong number in an accepted record.
