<!-- devkit-stage readiness result=passed attempt=2 commit=acacc172e3fd1e3e5b4c325674d75f11511d8af0 -->
# Readiness review: test-map-hub-links

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 2. Round 1 (NEEDS-REVISION) had one mandatory finding, F-1 (the base of the scratch clone in tasks 2.2
and 2.5), and three Low items. All four are fixed in the artifacts; I re-read them and re-derived the F-1 fix
against the code. No mandatory finding is open.

Checks run by the reviewer on the branch at `acacc172` (base `origin/main` at `02713b3a`; no fetch, as asked):

- `openspec validate test-map-hub-links --strict`: valid (`skip_specs: true`, zero deltas accepted).
- `node scripts/test-suite.mjs --own-files`: `selected no test file: 2 own files, none maps to a test`.
  `python3 scripts/check.py`: `all checks passed`. No phase gate command is red on the base.
- `release.md`: `packs: []`, a title and a body, no open fence. `node plugins/openspec/hooks/deliver-check.mjs
  test-map-hub-links` prints no `release.md:` line. No task bumps a version, edits `CHANGELOG.md` or a CI
  pin, or numbers an ADR (2.6 checks it); `decisions.md` lists no record.
- The simulation of D-3 and D-4 on the base map, the hub anchors and the reader facts were verified in round 1
  at the same commit and base; no code or map file has changed since (`git status` shows only change-folder
  files), so they stand.

## 2. Scope validation
Classification: correct

One measured problem (a Markdown-only pull request selects 31 test files, 23 slow, and the `check` job ran
10 min 17 s) and one cause (rule S4 beats S5 and S6; `test-fixtures.mjs` links every importer to three
documents and two hubs). In scope: data of `scripts/test-map.json`, one pin in `test-suite.test.mjs`, one
sentence in `CONTRIBUTING.md`. Out of scope is explicit (rules S1 to S7, M1 to M7, the 27 non-code keys under
`plugins/`, other code keys, CI, a split of slow tests). The owner-facing flags are in `proposal.md`
"Flagged for the owner". Nothing in the design commits to a thing absent from the tasks.

## 3. Proposal review
- Problem, goal and non-goals are clear; every AC is copied from `requirements.md` with its id.
- Affected capabilities: none, correctly (no `openspec/specs/` capability describes the test selection).
- Impact lists data, test, doc, packs, CI. `packs: []` agrees with "no file under `plugins/` other than the
  test file changes".
- ADR 0036 decision 2 and its Consequences are kept; "no ADR" in `decisions.md` is sound, and the stale
  "possibly ... maybe caches a CI install step" sentence of round 1 is gone.
- Round 1 Low fixed: `proposal.md` "Why" now says the job ran 10 min 17 s and the run 10 min 19 s, as
  `design.md` and `requirements.md` do.

## 4. Design review
- F-1 re-derived. `selectOwn` (`scripts/test-suite.mjs:485-497`) takes its base from
  `deliver.stalenessBase` (`plugins/openspec/hooks/deliver-check.mjs:331-339`): `GITHUB_BASE_REF`, then the
  configured base, then `refs/remotes/origin/HEAD`, then `main`. `branchOwnPaths` (line 351 onward) diffs
  `origin/<base>...head` through `ownDiffPaths`, which drops the release files. Tasks 2.2 and 2.5 now make the
  clone with `git clone`, then `git update-ref refs/remotes/origin/main <head>` and
  `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main`, and run with `GITHUB_BASE_REF`,
  `GITHUB_HEAD_REF` and `DEVKIT_BRANCH` unset. That gives base `main`, tip equal to the pre-edit head, and own
  files equal to the one edit commit, so the expected single `selected ... guard.test.mjs by openspec/roadmap.md`
  line is what the code produces. The task also checks `git diff --name-only origin/main...HEAD` before the
  run, so a wrong base shows at once instead of in the result.
- Round 1 Low fixed: `design.md` line 452 now says T-3 passes after task 1.5 and line 451 names task 1.4's own
  check; the estimate rows (lines 604 to 610) are numbered 1.4, 1.5, 1.6.
- Other claims (rules S1 to S7, `mapProblems` M5 and M6, the hub anchors, the reader facts, 21 fast and 23 slow
  of 44 suite files) were re-derived in round 1 and nothing they rest on has changed.
- Low (no action needed): the trace (D-2) and coverage (D-4) numbers are measured values I did not re-run.
  Tasks 1.2 and 1.3 re-measure them and stop on any difference.

## 5. Specs review
No spec delta, by design (`skip_specs: true`; the validator accepted it). The behaviour that matters is pinned
by the new T-1 to T-3 and the unchanged T-16, plus the `selected` lines in `proof/`. Every outcome row of the
D-3 and D-4 tables has a test or a proof task.

## 6. Tasks review
- Two phases; each ends with a gate task naming `node scripts/test-suite.mjs --own-files && python3
  scripts/check.py` (1.7, 2.7). Every AC id appears in a task (table at the top). Checkboxes are `- [ ]`.
- Red then green: 1.4 writes T-1 to T-3 and expects T-3 red; 1.5 edits the map; 1.6 the sentence. The test-name
  patterns match the real tests (verified in round 1).
- Every task path is real or created by the change; the scratch paths under `/var/tmp` are outside the tree on
  purpose.
- No criterion needs the archive to be proven: the two CI-only facts are in "Workflow follow-up".
- The config rules `tasks` (pinned-text search, gate naming `--own-files` and `check.py`, no version or ADR
  number with a release note) are met.

## 7. Omission detection
No findings. Validation and error handling: a measured difference stops the task and revises the plan (1.2,
1.3, 2.5). Rollback: one revert. Legacy contracts: the whole run, the train and `push` to `main` are unchanged
and compared by test name (2.4). Observability: the `selected` lines. Test strategy: T-1, T-2, T-3 and the
AC-2 failing-reader run.

## 8. Execution risks (top 5 failures)
1. A trace or coverage run on the implementer's machine differs from the tables. Impact: a stop and a plan
   revision. Prevention: already in 1.2 and 1.3 (real-path `TMPDIR`, at most 6 at once, stop on a difference).
2. A sibling change edits `scripts/test-map.json` before the merge. Impact: a conflict or a key that returns
   with a slow test. Prevention: 2.1 re-applies D-3 and D-4; T-3 pins the result.
3. A whole run (1.1, 2.4) flakes under load. Impact: a false red in AC-5. Prevention: quiet machine, load
   under 20, lone re-run of the failed file; all in the tasks.
4. A slow test that pins a document's text stops running on that document's pull request. Impact: a red
   train, not a red pull request. Prevention: accepted by the owner, listed in `proposal.md`; the train's
   bisection finds it.
5. The Markdown-only job on CI is slower than the local run and passes 2 minutes. Impact: AC-6's CI half
   fails. Prevention: D-7 and the Workflow follow-up send it back to the owner.

## 9. Mandatory fixes before implementation
None open. Round 1's F-1 is closed (see section 4).

## 10. Optional improvements (within scope)
None.

## 11. Explicitly out of scope
- [ ] Re-running the trace (D-2) and the coverage run (D-4) here: they are tasks 1.2 and 1.3.
- [ ] A smaller hub selection (a split of the slow files, a per-function map): out by the requirements.
- [ ] The 27 non-code keys under `plugins/` and every other code key: left as they are, for the owner's
  approval with the plan.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: 31 files, 23 slow, a 10 min 17 s job, the cause in rule S4 and
   `test-fixtures.mjs`.
2. Is the result measurable? Yes: `selected` lines, counts, `mapProblems`, T-3, step times (AC-1 to AC-6).
3. Are error behaviors defined? Yes for the measured runs (stop and revise); the map is data, with no runtime
   error path.
4. Are edge cases covered? Yes: remove a key versus empty it (S4 to S7), release files, folder keys, the relink
   case, one test per helper condition.
5. Are dependencies clear? Yes: `selective-tests-by-map-2` (archived), ADR 0036, ADR 0026; no sibling change
   is open.
6. Are contracts defined? Yes: the map's shape and rules S1 to S7 are untouched.
7. Can two developers interpret this differently? No open point; the clone's base is now written to the
   command.
8. Are any decisions implicit instead of written? No; the lists are in D-3 and D-4.
9. Do the tasks fully deliver the intended outcome? Yes: map, pin, sentence, proofs and the CI-only
   follow-ups.
10. What will be discovered too late if implementation starts now? Only what 1.2 and 1.3 are built to find
    first, before the map is edited.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? Not applicable; the residual risk is a trace or coverage difference, which stops task
  1.2 or 1.3 before any edit.
