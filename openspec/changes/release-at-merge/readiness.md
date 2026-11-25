<!-- devkit-stage readiness result=passed attempt=7 commit=9b67c11f446bfd8f24407556df9c082589acd50f -->
# Readiness review: release-at-merge

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

This review covers the plan revised after review round 2. The revision is uncommitted on `9b67c11`
and touches `proposal.md`, `design.md`, the `change-delivery` delta and `tasks.md`. I focused on:
- phase 10 (`tasks.md:481-564`);
- D-28 to D-30 (`design.md:1123-1290`);
- the findings map of round 2 (`design.md:1360-1384`);
- F-11 (`design.md:1448`).

The plan matches the owner's decision of 2026-11-25 ("1a e 2b"), as the caller relayed it. Every
round 2 finding in `review.md` has an answer:
- the four important ones: adr-reviewer F7, spec-reviewer F8 and F9, and test-coverage-reviewer F16;
- every nit.

No finding is mandatory. Three Medium items can be fixed during implementation or later, and three
Low items are optional.

Checks run:
- `openspec validate release-at-merge --strict` (and `--type change --no-interactive`): valid, with
  no errors or warnings.
- `python3 scripts/check.py`: `all checks passed`.
- Gate 10.5's whole command at `9b67c11`, with the plan edits uncommitted: every file passed and
  `check.py` passed. The 12 test files ran with `--concurrency=3`, with no other suite on the
  machine. No product file changed since `c87b837`, where gate 9.18 ran the whole suite green
  (`git diff --name-only c87b837 HEAD` lists only files of this change's folder).
- `openspec/config.yaml` `rules.readiness`: this file is written only by this agent. The caller
  gave no instruction about the verdict.

## 2. Scope validation
Classification: correct

Phase 10 changes no hook:
- one record gets a dated note;
- two `ship-change` sentences change;
- four test names change;
- one roadmap line is added.

The scope narrows (2b) instead of growing. The forced-merge allowance is named as a non-goal
(`proposal.md:122`) and moved to a roadmap line.

## 3. Proposal review
- Low (L-1, Nice to have): AC-4 still says the step "leaves the evidence and the reviews current"
  with no scope (`proposal.md:129`), while D-29 limits that to the normal delivery path. The new
  non-goal covers it. Adding "(on the normal delivery path, D-29)" to AC-4 would make the two agree.
- The proposal is longer than the two-page rule (attempt 5's O6, carried). The new paragraph is only
  the summary of the owner's decision. No new finding.

## 4. Design review
I checked these claims against the code:

| Claim | Check |
|---|---|
| `stepRecord` already reads each key from the newest recorded commit that wrote it (D-20, D-28) | `deliver-check.mjs:2277-2319`: every commit with `Release-change: <id>` is collected. `linePaths` skips keys already set (`:2299`). A key counts only when the commit changed it from `^1` (`:2305`, `:2310`, `:2315`). `adrs` holds `{from,to,commit}` and `citations` holds `{path,commit}` (`:2311`, `:2315`). `commit` is the newest (`:2318`). |
| The defect 7 test proves the new scenario | `release-merge.test.mjs:1022-1063` asserts every part of the WHEN and the THEN: exit 2 naming `src/a.ts` (`:1047-1048`); exit 0 after the merge by hand (`:1052`); `1.2.0` (`:1054`); `0003-feat.md` and the base's `0002-other.md` (`:1055-1057`); the citation (`:1058`); `assigned` and current (`:1062`). `PIN_PACK` is devkit-openspec (`deliver-check.mjs:1653-1654`). The test fails before `46c3c2e` and passes after it in `proof/red-9.txt:842,920`. |
| The note fits ADR 0032 and the form of ADR 0022 and 0025 | Both 0022 and 0025 have a one-line `Note (release-at-merge, 2026-11-24)` as the first paragraph under `## Context` (`0022:12`, `0025:13`). In `0032-release-at-merge-step-record.md`, `## Context` is at `:13`, followed by a blank line. Decision 3 reads "the newest commit" (`:59-61`) and decision 4 reads "the record" (`:64-70`). The note's date differs from the 0022 and 0025 notes, so 10.1's `git grep -c` counts 1. `ADR [release-at-merge` has no hit under `docs/adr` today. |
| The flow page already states the per-line reading | `docs/openspec-flow.md:330` says "line by line, the value the newest of its own recorded commits that wrote that line gave it". `:502` holds the per-line parenthesis D-28 quotes. |
| The forced merge reads gates through a GitHub compare with `isOpenspec` and `verdictAllowed` (D-29) | `gatesAtHead` at `deliver-check.mjs:926-966`: the first file not allowed makes the gate stale (`:948-949`). The canonical requirement and its scenarios are in `openspec/specs/change-delivery/spec.md:546-563`. The over-report is pinned by `deliver-check-archive.test.mjs` G6 (`:2503`) and G8 (`:2523`). |
| The forced-merge path needs unticked tasks, and N6 comes before `enable-auto-merge` | `left.length > 0` at `deliver-check.mjs:1049`. N6 `assign` is at `:2822-2824`, and `enable-auto-merge` comes after it at `:2830`. |
| The roadmap line parses and waits on this change | `parseRoadmap` reads `(after: release-at-merge)` (`guard.mjs:1466-1470`). `classifyLines` marks it `waiting` until the change is archived (`roadmap-loop.mjs:173-174`). `roadmapFacts` matches only the line's own id (`deliver-check.mjs:1714-1715`), so the archive ticks nothing. |
| No ADR rejects the 2b scope | ADR 0031 decision 5 amends only ADR 0025 (`0031:77-90`). ADR 0028, the forced-merge record, is not amended, and D-29 says it stays unchanged. |

- Low (L-2, Nice to have): D-29 (`design.md:1219`) and task 10.4 (`tasks.md:556`) both say "28p while
  the file ends at 28o". The file actually ends with `## Round 28m` (`openspec/roadmap.md:213`); 28o
  is the highest letter (`:210`), not the last heading. The rule "the next after the highest" still
  gives `p`, so nobody is misled. Changing the parenthesis to "the highest is 28o" would make it
  accurate.

## 5. Specs review
- The new scenario "A number the step kept across a later step commit" (`spec.md:86`) is testable and
  proven by an existing test (section 4). The requirement now says "per line" (`:73-76`).
- The added sentence and THEN clause about the forced merge (`spec.md:399-402`, `:414`) use SHALL.
  They are verifiable through the canonical G6 and G8 tests, because `gatesAtHead` does not change.
- Low (L-3, Nice to have): the WHEN of "A number the step never wrote" (`spec.md:91`) still says "the
  step's recorded commit". "No recorded commit", as in the requirement's last sentence (`:76`), would
  match the per-line reading the spec now states.

## 6. Tasks review
Each task 10.1 to 10.4 has a done condition you can run, and I checked each count against the files:
- **10.2: 2 added, 2 removed.** The `assign-release` row is one line (`ship-change/SKILL.md:70`), and
  "trailers of its last commit" appears there once. The `app` bullet is one line (`:124`), and its
  anchor sentence appears once.
- **10.2: the kept phrase.** "from its own record", which `deliver-check-cli.test.mjs:717` asserts,
  is still in the row after the edit. No test asserts "Auto-fix".
- **10.3: 3/3 and 1/1.** Each old test name is on one line (`release-note.test.mjs:488,498,796`;
  `delivery-train.test.mjs:516`). Outside this change's folder, `git grep` finds the old names only
  in those two test files.
- **10.1: 2 added, 0 removed.** That is one note line plus one blank line.
- **10.4: 3 added, 0 removed.** That is a blank line, the heading and the item. The file ends on an
  item line, and the 1262-character line is shorter than the longest line already in the file.
- **Gates.** Every file in 10.5 exists and passed today (section 1). 10.6 is the whole suite at the
  final head. It is long, so the caller runs it.
- **Coverage.** Every AC that phase 10 touches is mapped (`tasks.md:34,38,45`).

Medium findings:
- **M-1 (Fix during implementation).** Task 10.1 (`tasks.md:498-510`) has the adr-author write a note
  into an accepted record. The agent's own Never list says "Edit the text of an accepted record"
  (`plugins/core/agents/adr-author.md:45`), and so does `adr-authoring/SKILL.md:23`. The plan has a
  precedent: 9.1a (`db68e70`) went the same way. But if the agent refuses, the plan gives no fallback,
  and it forbids the implementer from writing the note. Smallest fix: the brief to the adr-author
  quotes the owner's decision 1a and D-28 as the authority for this one note. If the agent still
  answers `failure`, the coordinating session stops for the owner.
- **M-2 (Fix during implementation; after phase 10, not part of it).** After phase 10 the review runs
  again. The plan only says it runs "as the loop asks" (`design.md:1650`). Round 2 was the last round
  (`review.md`, FAIL round 2/2). `review-change/SKILL.md:128` allows a further round only when the
  owner approves one in his own message: it then runs as round 1 of a new cycle, quoting his words.
  The loop will not stop at `stop-review-deadlock`, because the rejected verdicts go stale with phase
  10's commits (`deliver-check.mjs:2678-2679` requires `r.current`). So the session running the review
  must decide on its own whether "1a e 2b" is that approval. Smallest fix: one sentence in the phase
  10 intro or the Workflow follow-up saying that the next review is the owner's further round (quoting
  "1a e 2b") or that the coordinator asks the owner first.
- **M-3 (Nice to have).** Task 10.5 says it covers "every test file that reads the `ship-change`
  skill". Two other files read it too: `review-round.test.mjs:1072` and `change-loop.test.mjs:2592`.
  They read only the `review`, `fix-review` and `update-branch` rows, which phase 10 does not touch,
  and 10.6 runs them. The wording could say "every test file that reads the rows phase 10 edits".

## 7. Omission detection
No findings:
- Rollback is a text revert.
- Running a task twice is caught by its count checks.
- Compatibility is unchanged, because no hook changes.
- The release numbering: the note in 10.1 has no `ADR [<slug>]` and no ADR number. ADR 0032 is a
  `Release-adr` path of `923aab5`, so a later renumbering runs `git mv` and rewrites only its tokens,
  which an extra paragraph does not affect.
- The test history rule (`config.yaml`): no new test reads git history.

## 8. Execution risks (top 5 failures)
1. **The adr-author refuses 10.1** (M-1).
   - Cause: its Never line.
   - Impact: phase 10 stops after 10.1.
   - Prevention: M-1's brief sentence.
2. **The re-review starts with no stated round** (M-2).
   - Cause: no rule names a third review.
   - Impact: the session asks the owner again, or runs an unauthorized round.
   - Prevention: M-2.
3. **The base moves before the merge.**
   - Cause: trains keep landing.
   - Impact: `assign-release` runs again. The record now spans more than one commit, which the
     per-line reading and the defect 7 test cover.
   - Prevention: as planned (D-20, D-17).
4. **The base appends a roadmap round with the same letter.**
   - Cause: `openspec/roadmap.md` is a shared place to append.
   - Impact: a conflict under `openspec/`.
   - Prevention: as planned. 10.4 takes the next free letter, and the conflict is resolved by keeping
     both rounds.
5. **The ADR note gets wrapped over two lines.**
   - Cause: the writer wraps prose.
   - Impact: 10.1's numstat check (2/0) fails.
   - Prevention: the check catches it. The note is one line, as in ADR 0022 and 0025.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] M-1 (Medium, Fix during implementation). `tasks.md:498`: give 10.1 the authority line for the
  adr-author and a fallback if it refuses.
- [ ] M-2 (Medium, Fix during implementation). `tasks.md:481-497` or the Workflow follow-up: say how
  the review after phase 10 is authorized (`review-change/SKILL.md:128`).
- [ ] M-3 (Medium, Nice to have). `tasks.md:563`: make 10.5's coverage claim exact.
- [ ] L-1 (Low). `proposal.md:129`: scope AC-4 to the normal delivery path.
- [ ] L-2 (Low). `design.md:1219` and `tasks.md:556`: "the highest is 28o", not "ends at 28o".
- [ ] L-3 (Low). `specs/change-delivery/spec.md:91`: "no recorded commit".

## 11. Explicitly out of scope
- [ ] The release-edit allowance for `gatesAtHead`, which becomes the roadmap line
  `forced-merge-release-edit` (D-29).
- [ ] Nits F18, F19 and architecture F8 from round 2, and the follow-ups carried from round 1
  (`tasks.md:579-585`).
- [ ] F-11: the owner confirms how the merge `a47cec8` was resolved. No task depends on it.

## 12. Mandatory review questions
1. **Is the problem objectively defined?** Yes. Each round 2 finding is mapped to an answer
   (`design.md:1360-1384`).
2. **Is the result measurable?** Yes. Every task has command-level counts, and I checked each count
   against the current files.
3. **Are error behaviors defined?** Yes for the code, which does not change. The adr-author refusal is
   not handled (M-1).
4. **Are edge cases covered?** Yes. They include a number kept across a later step commit, the
   forced-merge over-report and a base that appends a roadmap round.
5. **Are dependencies clear?** Yes: the owner's decision, ADR 0032, `gatesAtHead` and ADR 0028
   unchanged.
6. **Are contracts defined?** Yes. `stepRecord`'s return shape matches the code.
7. **Can two developers interpret this differently?** Only at the re-review step after phase 10 (M-2).
8. **Are any decisions implicit instead of written?** No. 1a and 2b are written as D-28 and D-29.
9. **Do the tasks fully deliver the intended outcome?** Yes, with the follow-up on the roadmap.
10. **What will be discovered too late if implementation starts now?** At worst, an adr-author refusal
    at 10.1 or a question about the review round after phase 10.

## 13. Final conclusion
- **Can we start?** Yes. Phase 10 can be implemented as written.
- **What must be fixed?** Nothing mandatory. M-1 and M-2 are best settled in the coordinating
  session's briefs.
- **Main risk if ignored:** the run stalls on the adr-author's Never line, or on whether the owner
  allowed one more review round.
