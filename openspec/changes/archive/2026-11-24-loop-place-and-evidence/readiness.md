<!-- devkit-stage readiness result=passed attempt=2 commit=2aea5d914ea2e8266f2de39f6a5b19696d40d65d -->
# Readiness review: loop-place-and-evidence

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 2. The one Mandatory finding of round 1 (F-1: task 1.1's pass/fail list disagreed with tests 12
and 13) is fixed in both files, and the four optional improvements of round 1 were applied as well.
I re-read every artifact again at `2aea5d9` (`origin/main` is still `c1ac8c4`, the base of the
branch; no fetch was made) and re-derived the claims that the revision touched. No Mandatory finding
is open.

## 2. Scope validation
Classification: correct

The waiting-for-a-place end is already on `main`, and the package drops it
(`requirements.md`, `proposal.md` Why and Non-goals). What is left is one rule: a `commit` step
before a `review` round while the change folder is uncommitted. It is justified by the proposal's
Why and specified by one ADDED requirement. No new step, row, role or agent. The design's
Non-Goals keep `change-loop.mjs`, `dirtyPaths`, `staleness()` and the reviewer-side question
(`jira-entry-followups`) out.

## 3. Proposal review
- Problem, goal, non-goals, impact, release and the sibling overlap are explicit.
- `nextStep(` is called only by `buildReport` and the `--watch` loop, so "CI: none" holds.
- AC-1 to AC-7 are observable; AC-5 depends on the change's own real round, which D-5 and the
  Workflow follow-up schedule.
- `openspec validate loop-place-and-evidence --strict`: valid (run in this round).

## 4. Design review
Metadata / roadmap: the project uses `openspec/roadmap.md`; the change is listed in round 19b and
its dependency is met. No current-state file is required.

Claims about internals, re-derived at `2aea5d9`:

| Claim | Result |
|---|---|
| `dirtyPaths` (line 250) keeps only paths outside `openspec/` | true (`deliver-check.mjs:250-264`) |
| `changedUnder` (line 851): modified, staged, untracked (`-uall`), renamed (new path) | true (`:851-859`); item 5 is its only user (`:886`) |
| `collectState` pre-merge return has no folder field; the `items,` line closes it (`:1796-1814`) | true |
| `nextStep`: line 1551 `commit`, `toReview` block at 1582-1588 holding `reRejected` and `round` | true |
| `staleness()` reads `recorded.uncommitted` and `facts.dirty` (`:289-293`) | true; so a verdict marked `(uncommitted changes)` is stale, which test 13's control relies on |
| K1 guard in `change-loop.mjs` (`:1043-1047`) ends `no-progress` when the same `progressKey` repeats | true |
| `commit` has no `describeNext` entry; `ROWS.commit` is `handOff('delivery', 'commit-and-pr')` | true |
| `ship-change/SKILL.md` rows `commit` (56) and `review` (57) hold the quoted sentences | true |
| `docs/openspec-flow.md`: order paragraph at 462; `v0.33.0` on lines 661, 662, 675; line 123 is a release fact | true (3 lines, 4 occurrences; 123 says `devkit-openspec 0.33.0 on`) |
| The grep of task 2.2 over `plugins/*/hooks/*.test.mjs` and `scripts/` | prints 0 lines today, so only test 16 will hold the text |
| Helpers named in D-4 (`state`, `open`, `rejectedState`, `review`, `reviewAt`, `fullEvidence`, `ev`, `tick`, `head`, `BOTH`, `shipRepo`, `committedChange`) | all exist in `deliver-check.test.mjs` |
| Existing tests turned red by the condition are exactly E1 to E9 (a generalization) | verified in round 1 by running D-1 and D-2 on a throwaway clone and the whole guard suite: 9 failures, E1 to E9. The code and the E list are unchanged since, except the fix below |

Round 2 re-checks of the revised parts:

- The red/green column of D-4 now agrees with task 1.1. Fail before D-1/D-2: 1, 6, 7, 8, 9, 10,
  11, 12, 14. Pass: 2, 3, 4, 5, 13, 15. Test 12 reads `folderDirty`, which is `undefined` before
  D-1, so it is red, and the text says so. Test 13's build reads neither the field nor a step of
  D-2 (no `t.next()` before the round), so it is green, and the text says so. I walked each row
  against the code: 2, 3, 4, 5 and 15 pin today's behaviour; 1, 6, 8, 9, 10 and 11 expect the new
  step; 7, 12 and 14 read the new field.
- E2 and E7 edits as written in D-4 were applied to a throwaway clone with D-1 and D-2; the four
  `walkthrough` tests pass (E2's list of ten steps, E7's `taken` and `seen` lists with the extra
  `commit`). The three sequence lists that task 1.4's check allows to be replaced are exactly E2's
  one and E7's two.
- The throwaway clone is in the session scratchpad, not in the change's worktree. A further probe
  of tests 8, 10, 12, 13 in it was refused by the devkit hook (the reviewer may not write test
  files). I did not work around it. Those tests were checked by reading the code paths above, not by
  running them.

Decisions checked against the ADRs: the rule moves ordering from prose to the checker (ADR 0010
decision 2); no ADR rejected this approach; `decisions.md` ("no record needed") is consistent. The
alternatives rejected in D-1 and D-2 are real.

Ordering edge cases walked: a dirty folder with a current rejected verdict goes to `fix-review`
first; product plus folder dirty returns line 1551's step once; after the folder commit
`toReview` and `round` are as before, because the commit touches only `openspec/` (AC-2).

## 5. Specs review
`specs/change-delivery/spec.md`: one ADDED requirement with SHALL language and eleven scenarios.
Every outcome row of D-2 has one (dirty evidence, dirty `tasks.md`, untracked or staged file,
review after the commit, product plus folder dirty, `verify` first, `fix-review` first, clean
folder, paths outside the folder, loop hand-off, clean round). The capability exists in
`openspec/specs/`. No parser is written or moved, so the unterminated-input rule does not apply.

## 6. Tasks review
- Phases 1 to 3 each end with a gate task naming one command; the `&&` parts are valid; every AC id
  is in the table and in a task; the release task says "the next minor version ... after
  `origin/main`'s at the last merge before review", not a literal.
- The "Existing tests" rule of `openspec/config.yaml`: the grep for the replaced texts is task 2.2,
  and E1 to E9 are rows of the table with invariant, layer and suite.
- Task 3.1 now gives the pattern `v0\.33\.0` and keeps line 123; both match the file.
- Gate commands on the base: `python3 scripts/check.py` passes and `gen-catalog.py --check` is
  clean on the base (run in this round). The guard suite is the long command the tasks mark; round 1
  ran it whole on a clone of this base with the change applied, and only E1 to E9 failed, so it is
  green on the base.
- Task paths are all under real directories (`plugins/openspec/hooks`, `plugins/openspec/skills/ship-change`,
  `docs`, `.claude-plugin`, `openspec/changes/<id>/proof/`, which task 1.1 creates).

## 7. Omission detection
- Validation, error handling, idempotency: an empty commit ends `no-progress` through K1; a rerun
  after the commit sees a clean folder.
- Permissions: the hand-off goes to the same role as today; no new write.
- Migration, rollout, rollback: Migration Plan names the one extra `commit` for a change under way,
  and the rollback (two hunks, tests, two texts).
- Observability: the reason names up to three folder paths.
- Legacy records: a state with no `folderDirty` behaves as before (`?.length`).
- Test strategy and evidence: 17 new tests with their red run, E1 to E9 with invariant, layer and
  suite, and the real-run proof S and V0 to V4 that CLAUDE.md asks for.
- No findings.

## 8. Execution risks (top 5 failures)
1. Cause: sibling `jira-entry-followups` merges first on the same rows. Impact: a re-merge, evidence
   and review (1 to 2 h). Prevention: in the Risks table and task 3.1.
2. Cause: the whole guard suite is slow (49 minutes in round 1 under load). Impact: a gate that looks
   hung. Prevention: the tasks say background command and `TMPDIR=/var/tmp`.
3. Cause: the conducting session uses the installed 0.33.0 `next`, which hands `review` on a dirty
   folder. Impact: AC-5 not shown. Prevention: D-5 and the Workflow follow-up.
4. Cause: a hook refuses the session's Edit or Write in a clone (V2, V3). Impact: V cases without
   proof. Prevention: the Risks table says to stop and record `no proof: <the refusal>`. The refusal
   I met in this round (a reviewer writing a test file) is the same kind of event.
5. Cause: a file written into the change folder between the folder commit and the round brings
   `commit` back. Impact: one extra commit. Prevention: named in the Risks table; S and V keep their
   records in the scratchpad.

## 9. Mandatory fixes before implementation
- none.

## 10. Optional improvements (within scope)
- [ ] `tasks.md:115` (task 3.1 check) — `grep -c 'v0\.33\.0'` counts lines, so the pre-change value is 3
  for four occurrences. The post-change expected value 0 is right; no edit needed unless the
  implementer reads the "four matches" as a count.

## 11. Explicitly out of scope
- [ ] The reviewer-side treatment of a dirty change folder and the `fix-review` loop after a fix
  inside the folder (`jira-entry-followups`).
- [ ] The merge-turn wait (`delivery-merge-hold`) and the suite's speed (`suite-speed`).
- [ ] The waiting-for-a-place end, already on `main`.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: the checker hands `review` on a tree dirty only in the change folder.
2. Is the result measurable? Yes: AC-1 to AC-7, tests 1 to 17, and the real-run proof S and V0 to V4.
3. Are error behaviors defined? Yes: an empty commit ends `no-progress` (K1); a refused hook in a clone is recorded as `no proof`.
4. Are edge cases covered? Yes: modified, staged, untracked, renamed, `featx` and `config.yaml` outside the folder, product plus folder dirty, `verify` and the fix steps first.
5. Are dependencies clear? Yes: none to build on; the sibling overlap and its merge order are named.
6. Are contracts defined? Yes: `folderDirty` (field), `commit` with `paths: []` and the exact reason text; no new step name.
7. Can two developers interpret this differently? No: task 1.1's list and D-4's column now agree for every test.
8. Are any decisions implicit instead of written? No; the ADR question is answered in `decisions.md`.
9. Do the tasks fully deliver the intended outcome? Yes: code, nine existing-test edits, texts, release and the real round.
10. What will be discovered too late if implementation starts now? Nothing found: the red list was checked by running the change on a clone in round 1, and the E2 and E7 edits in this round.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation.
- Main risk if ignored? A re-merge cost if the sibling change takes the release first, and AC-5 not shown if the session drives with the installed 0.33.0 checker.
