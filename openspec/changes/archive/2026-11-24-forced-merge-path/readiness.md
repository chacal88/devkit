<!-- devkit-stage readiness result=passed attempt=2 commit=def86377b435bf281d5a933226deb5a4782e4de4 -->
# Readiness review: forced-merge-path

Round 2, after the planner's revision of round 1 (NEEDS-REVISION, three findings). The conducting session asked for
no test suite and no long gate tonight; this round ran only `openspec validate forced-merge-path --strict`,
`python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` (all three pass), plus reads of the code.
ADR 0022 is `proposed` on purpose (the owner accepts it at plan approval); that is not a finding.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Each round 1 finding is fixed in the artifacts and re-derived against the code; the revision opened no
Mandatory gap. Two Low items below are for the implementer; neither changes behaviour the owner approves.

## 2. Scope validation
Classification: correct. Scope, non-goals and the three modified capabilities are unchanged by the revision. The new
`unreadMerge` fact and its `blocked` row stay inside AC-1 to AC-4 (a read that fails must not reopen the bug) and
add no capability.

## 3. Proposal review
No finding. The proposal stays under two pages and its facts about the repository still hold at `def8637`.

## 4. Design review
Round 1 findings, one by one:

1. **High, `blocked` promised and never produced: fixed.** D-4 (`design.md:152-183`) now names the mechanism: a new
   `deliveryOf` field `unreadMerge: { number, error } | null`, set only by a failed `forcedMerge` or by a commit-arm
   error (`arm: 'commit'`); `collectState` sets `mergedLeft` only when `forced` and `unreadMerge` are both null (this
   closes `PR #undefined`); one `nextStep` row after `if (state.archive) return archiveNext(state);` and before the
   `!state.branchOk` row, with the two reason forms. Re-derived against the code:
   - `nextStep` order is `disable-auto-merge`, `stop-plan-mode`, the `two` default-branch row, `state.archive`, then
     `!state.branchOk` (`deliver-check.mjs:1517-1527`), so the new row lands where D-4 says; `state.archive` is only
     built on the `postMerge` path (`:1767`), so it is null for a failed read, as D-4 claims.
   - `deliveryOf` replaces `fetched` with `{ error }` after the tasks read (`:709-710`) and computes `left` from
     `tasks`, not from `fetched`; D-4 says the forced read comes "after `left` is known", so it cannot run when the
     tasks read failed.
   - `change-loop.mjs:941` maps `blocked` to `pr-problem`, so the loop already has a place for the new answer.
2. **The new fact does not change `deliver-check.test.mjs:5066`: confirmed.** The test (`pm()`, tasks read fails with
   `gh: boom`) asserts `!s.archive`, `s.items[4].status === 'blocked'` and `/gh: boom/`. On the revised design the
   tasks read fails first, so `left` is empty, no forced read runs, `unreadMerge` stays null, `postMerge` stays
   false, `mergedLeft` stays null and item 5 is built from `fetched = { error }` exactly as today. E1 pins it, and D-4
   says so in one sentence ("The row below is limited to the forced and commit reads").
3. **Medium, scenarios missing: fixed.** `specs/change-delivery/spec.md` now has scenarios for N2 ("The forced retro
   from the change's own branch"), N3 ("... another change's branch"), N9 ("A retro proposal not answered"), G7 ("A
   verdict recorded on another line of history"), F7 ("A status-context entry") and F8 ("Two entries of one name, one
   failing"), plus the two `blocked` families the revision added ("The gate files cannot be read", "The commits cannot
   be read") and "A tasks read that fails keeps its answer".
4. **Medium, the retro line's language: fixed.** D-7 (`design.md:217-236`) writes the opening line in `filesLanguage`,
   carries each item's `text` as the checker wrote it, keeps the D2 match on `next.forced`, "Went wrong", `items` and
   "files' language", and adds one `pt-BR` fixture run to the proof (D-13 and the workflow follow-up).
5. **Lows fixed:** the test anchors in D-12 now match the file (`:4985`, `:4998`, `:5008`, `:5016`, `:5028`, `:5041`,
   `:5054`, `:5066` are the first lines of their `test(` calls); task 1.2 names the pattern `readValue|valueIn` and
   both existing `readValue` tests match it (`guard.test.mjs:76`, `:1330`); V1 is in `guard.test.mjs` in the task, the
   D-12 table and the file list; D-4 says `two-prs` is covered and where `base` comes from outside it; D-3 defines a
   contents answer that is a folder or has no `content` string; D-13 says "live once merged, else its fixture".

Helpers the design reuses all exist: `requiredChecks` (`merge-setup.mjs:100`), `readContents` (`deliver-check.mjs:1156`,
takes any ref, a sha included), `ghJson` (`:1195`), `isArchiveHead` (`:604`), `verdictAllowed` (`:243`), `approved`
(`:232`), `parseCommitLine` and `parseStageHeader` and `REQUIRED_REVIEWERS` (`guard.mjs:252`, `:238`, `:60`; the
`parseStageHeader` import into `deliver-check.mjs` is the one new import line, D-3 says it comes from `guard.mjs`).

## 5. Specs review
Normative language and `#### Scenario:` blocks everywhere; `openspec validate --strict` passes. Every outcome row of
D-4, D-5 and the F, G, L, N tables has a scenario now, the `two-prs` base pull request aside (N11 is a test row, not a
decision-table row; see section 10). `reviews-check` and `change-coordination` deltas are unchanged and still agree
with D-6, D-7 and D-9.

## 6. Tasks review
Ordered by dependency; one gate per phase naming one command; each phase begins with its red proof; every AC id is in a
task (AC-1 to AC-4 and AC-6 in 1.6 and 1.9, AC-5 in 2.3, AC-7 in 3.2 and 3.5, AC-8 in 2.4 and the follow-up). Task 1.6
now names the `unreadMerge` fact and the `blocked` row, and 1.1 lists F10, F11, G9, G10, E1 and L3. The ADR and version
tasks (3.2, 3.3) name "the next free ... at the last merge before review", as `openspec/config.yaml` requires; tasks that
change pinned text (2.3) name the test files. Gates `1.9`, `2.5` and `3.6` run the long suites and were not run here
(the conducting session's instruction); nothing says any is red on the base, and the short parts of `3.6` are green.

## 7. Omission detection
- Error handling: now defined for every new read (rules, rollup, contents, compare, commits).
- Parsers rule of `config.yaml`: empty text is `null` for `valueIn`; empty or headerless gate files have a `why`.
- Idempotency, rollback, migration, observability: stated (N10, Migration Plan, read-only routes).
- Low, `design.md:441-443` (Assumptions): "if not, the gate items say `unreadable at the merged head` and the step stays
  `retro`" contradicts D-3, which gives a 404 as `missing` and any other failure as `{ error }` and the `blocked` row.
  Round 1 confirmed the assumption live (contents at a squash-merged head, PR 85), so the clause is dead, but an
  implementer could build the fallback. Delete the clause when the implementer touches the file.
- Low, `design.md` Non-Goals: the stage readout keeps its code, yet a failed forced read now reaches it as
  `fetched = { error }`, so `flow-check.mjs#readDelivery` (`:202`) ends `blocked gh-error` where it said
  `implementation` / `tasks-left-after-merge` before. That is the intended fail-closed answer and needs no code; say it
  in one sentence of D-4 and add one `flow-check.test.mjs` assertion beside `:998` while adding its green fixtures.

## 8. Execution risks (top 5 failures)
1. An existing test reaches the new `pr view <n>` or rules read without a fixture. Cause: the fake falls back to the
   plain `pr-view`. Impact: red suite at the 1.9 gate. Prevention: D-12 names every test; a missing field is an error.
2. A forced read error answers `stop-branch` or `implement` instead of `blocked`. Cause: the row placed wrongly.
   Impact: the original bug on a read failure. Prevention: F10, F11, G9, G10 and L3 pin it from both checkouts.
3. N is inflated by gate files read as `missing`. Cause: a 404 at an unreachable sha. Impact: a wrong count in the retro.
   Prevention: verified live for PR 85; the evidence keeps one live call per route.
4. The real `claude -p` retro runs hit the scratch clone's hooks. Cause: the harness loads the plugin. Impact: the AC-5
   proof stalls. Prevention: task 2.4's dry run; the pr-verifier records any refusal verbatim.
5. A sibling takes ADR 0022 or the version. Cause: parallel changes. Impact: a rename late in the change. Prevention:
   3.2 and 3.3 name "next free ... at the last merge before review"; `renumber-adr` handles a clash.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Delete the `unreadable at the merged head` fallback clause in the Assumptions (`design.md:441-443`).
- [ ] One sentence in D-4 and one `flow-check.test.mjs` assertion for the readout's `blocked gh-error` on an unreadable
  forced read (section 7).
- [ ] One scenario for the `two-prs` base pull request merged with a task left and a red check (retro, `forced` set; the
  test-branch pull request never judged), so N11 maps to a written requirement.
- [ ] Hand over the long gates' result on the base when the machines are free (not a finding: no red is known).

## 11. Explicitly out of scope
- [ ] The devkit hook refusing `gh pr create` while the review is not approved (live case 2).
- [ ] Merging, auto-merge or `--admin` by any session; the stage readout keeps its code and text.
- [ ] A merge with every task ticked and a red check (stays delivered, with today's reason).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: PR 88's facts, the lookups and the rule that loses it.
2. Is the result measurable? Yes: AC-1 to AC-8, each with a test or a replay.
3. Are error behaviors defined? Yes: the `unreadMerge` fact, its row, both reason forms and E1 for the unchanged read.
4. Are edge cases covered? Yes: negatives, SKIPPED and NEUTRAL, absent checks, status contexts, duplicate names, full and
   short lists, archive heads, folders where files are expected, non-ancestor commits.
5. Are dependencies clear? Yes: ADR 0019, the post-merge rows, `requiredChecks`; all on `main`.
6. Are contracts defined? Yes: `next.forced` shape, item texts and order, reply key, the three message sentences.
7. Can two developers interpret this differently? Only on the two Low items of section 7.
8. Are any decisions implicit instead of written? No Mandatory one; the readout's error answer is implicit (Low).
9. Do the tasks fully deliver the intended outcome? Yes: every AC has a task, a test and, for AC-4 to AC-8, a real run.
10. What will be discovered too late if implementation starts now? Only a red existing test the grep missed, which the
    1.9 gate shows in the first phase.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan and accepts ADR 0022.
- What must be fixed? Nothing before implementation; the section 10 items ride with the phases that touch those files.
- Main risk if ignored? A dead fallback clause or an unexplained readout answer, both caught by review, neither a
  wrong behaviour.
