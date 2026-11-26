<!-- devkit-stage readiness result=passed attempt=10 commit=98ffb172675d7d320587e3c7d2ca8f51ae6ec410 -->
# Readiness review: release-at-merge

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes, once the owner approves the plan (task 11.1a waits for that approval)

This review covers the plan revised after the readiness review of attempt 9. The revision is still
uncommitted on `98ffb17`. It touches `proposal.md`, `design.md`, the `change-coordination` and
`change-delivery` deltas and `tasks.md`. I re-checked B-3, the two Low items and every changed
place:
- D-34's "The records" (`design.md:1735-1755`) and "The note in the record" (`:1757-1775`);
- D-36's numbering paragraph (`:1868-1877`);
- the attempt 9 answer table (`:2020-2026`), F-12 (`:2089-2104`), and the phase 11 order and Records
  bullet (`:2320-2339`);
- the risk row of the note (`:2372`);
- `proposal.md:24-31`;
- tasks 11.1a and 11.3 (`tasks.md:602-657`), the phase intro (`:573-576`), the AC map (`:34`, `:44`)
  and the workflow follow-up (`:785-789`).

The caller gave no instruction about the verdict.

**B-3 is closed.** The plan takes option (a) of attempt 9:
- the record gets a dated note whose text is carried word for word (`design.md:1766`);
- task 11.1a has the adr-author write it after the owner's approval and before any phase 11 code;
- F-12 no longer defers the question to a later review, and a refusal sends the plan back for
  option (b) before phase 11 starts (`design.md:1773-1775`, `:2101-2102`).

**Both Low items are closed.** The MODIFIED intro is now conditioned on the masked merge
(`specs/change-coordination/spec.md:102-111`). Task 11.3's done condition excludes the one-line
list's conduct test, and 11.8 checks it (`tasks.md:649-651`, `:721-723`).

Checks run, all at `98ffb17` with the plan edits uncommitted:
- `openspec validate release-at-merge --strict`, and the same with `--type change --no-interactive`:
  `Change 'release-at-merge' is valid` both times.
- Task 11.1's check, `git diff --quiet 98ffb17 HEAD --` on the two spec files: exit 0.
- The shared block: I extracted "From the implementation on, the step inside the stage goes to its
  role" from both deltas and ran `diff`. The only differences are this change's lines: the
  conditioned intro sentence, ", and the change carries no release note" in two WHENs, the release
  files WHEN, and the two noted scenarios.
- No product file changed since attempt 9:
  - `git diff --quiet 98ffb17 -- plugins docs scripts openspec/config.yaml openspec/specs openspec/roadmap.md CLAUDE.md`
    exits 0;
  - `decisions.md` and `approval.md` are unmodified.

  So attempt 9's gate 11.9 run on `98ffb17` still stands (`suite: 15 files, 1997 tests, 1997 pass,
  0 fail, 595.9s, concurrency 3`; `check.py` passed; `gen-agents --check` passed). No test was run
  again. `bash /var/tmp/devkit-release-at-merge/wholesuite.sh` printed nothing at the start of this
  review.
- `openspec/config.yaml` rules: `rules.readiness` (this file is written only by this agent) and
  `rules.design` (lines 53-55) were applied. The config is unchanged since `98ffb17`.

## 2. Scope validation
Classification: correct

The only addition is the dated note in the change's own record (`design.md:2337-2339`, "Records").
B-3 required that note, and the change ships that record. Nothing else is added.

## 3. Proposal review
- `proposal.md:28-31` states the narrowing of decision 5 and the note, and says that the owner's
  approval accepts it. F-12 sits under "Flagged for the owner" (`design.md:2028`, `:2089`), so the
  owner sees the question at the approval.
- Proposal length (two-page rule) is the carried O6. No new finding.

## 4. Design review
I checked these new claims against the repository. The code rows of attempt 9 still hold, because no
product file changed.

| Claim | Check |
|---|---|
| The step's record is the one `docs/adr` file ending `-release-at-merge-step-record.md`, numbered 0035 at `6836ad2` | `git log -- docs/adr/0035-release-at-merge-step-record.md`: the rename is in `6836ad2`. |
| The 2026-11-25 note is the first paragraph under `## Context`, and the new note goes above it | `docs/adr/0035-release-at-merge-step-record.md:13` is `## Context`, `:15` the 2026-11-25 note. |
| Newest first, as ADR 0004's notes stand | `docs/adr/0004-*.md:11,13,15`: 2026-11-24, 2026-11-23, 2026-11-20. |
| The note holds no citation the step or the state would read | `design.md:1766` holds no `ADR`, no `[`, no four-digit number other than the date, and no `<NNNN>-<slug>.md`. The state reads the record through `adrValue` (`deliver-check.mjs:2279-2285`): the file's presence and `citedAt`'s `ADR [<slug>]` (`:2273-2276`). `citationsOf` reads only `ADR [x]` (`:2347`). So the note leaves the state `assigned` and `current`. |
| A note added after a recorded step commit is a path the step has already met | `8b50758` (task 10.1's note) came after `923aab5`'s step on the first-parent line, and `e633b9a`'s step ran over it. |
| Task 11.1a's before-counts | `git grep -c -F "ADR [" 98ffb17 --` gives 2 for the record, and `git grep -c -E "ADR [0-9]{4}"` gives 17. `"Note (release-at-merge, "` gives 1 today, so 2 after the task. A note line plus one blank line gives `2 added, 0 removed`. |
| The note quotes the Consequence it narrows | `docs/adr/0035-release-at-merge-step-record.md:120-121`: "(Mitigated: exit 2 naming the path, the tree restored, decision 5)". |
| A later give-back of the record path still merges the note cleanly | The note goes at line 15. The masked text differs from the recorded text only on lines holding a number (the title, `Amends:`, the body citations). Lines 9-14 hold none, so the whole-text merge does not touch the insertion. If it ever did, D-34's span search covers it. |
| The note says what D-34 does | It says the whole-text merge runs first, a span search to the left and then the right follows, and the merge base's text only refuses. Exit 2 is kept for a span that cannot be found, and words added beside a citation now give back. This matches steps 1-5 (`design.md:1681-1696`). |

`openspec/config.yaml:53` asks that a decision that changes an ADR be recorded "as a proposal for a
new ADR, not as a silent deviation". The deviation is no longer silent and no longer deferred: it
has a dated note, the owner's approval decides it, and a refusal leads to a new record. This is the
path attempt 9 offered as option (a). `:55` does not apply (attempt 9, section 4).

## 5. Specs review
- `change-coordination` MODIFIED "From the implementation on, ..." (lines 97-111):
  - the intro sends "a pull request behind its base or in conflict with it, when every conflict of
    its merge with that base is one the release step's masked merge resolves" to `assign-release`;
  - it sends "any other conflict, a pull request behind a base whose merge would conflict elsewhere
    included" to `resolve-base-conflict`.

  This matches its scenarios and the ADDED requirement (line 56). Validation passes.
- `change-delivery`: no new finding. The give-back requirement and its scenarios match D-34, as in
  attempt 9.

## 6. Tasks review
- 11.1a is ordered after the owner's approval and before 11.2. Its done condition is a set of
  commands with stated outputs, and each before-count was verified above. It names the agent (the
  adr-author, not the implementer) and the commit message. The AC map lists it under AC-4 and AC-14
  (`tasks.md:34`, `:44`).
- 11.3's done condition now excludes the one-line list's conduct test, and 11.8's names it. The two
  agree with 11.3's opening.
- Gate 11.9 is green on the base (section 1). The task paths are unchanged from attempt 9, and they
  exist.

## 7. Omission detection
No findings. The refusal path of the note is defined (`design.md:1773-1775`). Validation, error
ends, idempotency and rollback of the give-back are as in attempt 9.

## 8. Execution risks (top 5 failures)
1. **The owner approves the plan without reading the note.**
   - Cause: the note claims "the owner accepted, in his approval of the revised plan".
   - Impact: the record would state an acceptance the owner did not consciously give.
   - Prevention: F-12 is under "Flagged for the owner", `proposal.md:28-31` says it, and
     `approval.md` records the owner's own words. This is acceptable.
2. **The real implementer turns the step's numbers on the list back to slugs, or renumbers them.**
   - Impact: the step exits 2 and the run blocks. Nothing is mis-numbered.
   - Prevention: D-31's "Never" sentence and S-13 (b).
3. **A span is given back to the wrong place.**
   - Cause: a person writes the step's exact surrounding text for another record.
   - Impact: one wrong number on one citation.
   - Prevention: the base-text test and the D-35 guards. The residual risk is acceptable.
4. **The base moves again before the delivery.**
   - Impact: one merge, one push and one step run, an extra loop of one to two hours.
   - Prevention: D-36. The note holds no number, so a renumbering leaves it as written.
5. **coordinator-loop-fixes archives with its own block after this change.**
   - Prevention: F-13's relay, a workflow follow-up. This is acceptable.

## 9. Mandatory fixes before implementation
No findings.

## 10. Optional improvements (within scope)
- [ ] Low. `design.md:1869`: "task 11.1a's note in the step's record holds none and names that file
  by its slug" reads as if the note names a file. It is task 11.1a that finds the file by its slug
  ending. Suggested wording: "task 11.1a finds that file by its slug, and its note holds none".

## 11. Explicitly out of scope
- [ ] `CLAUDE.md`'s command table names `plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs`,
  which does not exist. The plan rightly uses `plugins/compozy/kit/scripts/gen-agents.mjs`. That file
  belongs to the repository, not to this change.
- [ ] The carried round 1 and round 2 follow-ups and `forced-merge-release-edit`, unchanged.

## 12. Mandatory review questions
1. **Is the problem objectively defined?** Yes. Every round 3 finding and every item of attempts 8
   and 9 is mapped (`design.md:1984-2026`).
2. **Is the result measurable?** Yes. Each fix has named red and guard tests, and the note has a
   count check.
3. **Are error behaviors defined?** Yes, including the owner refusing the note.
4. **Are edge cases covered?** Yes, as in attempt 9.
5. **Are dependencies clear?** Yes: the owner's approval comes before 11.1a, then 11.2 follows.
6. **Are contracts defined?** Yes. The note's text is given word for word.
7. **Can two developers interpret this differently?** No.
8. **Are any decisions implicit instead of written?** No. The change to decision 5 is now a note,
   with its text in the plan.
9. **Do the tasks fully deliver the intended outcome?** Yes: the code, the proof, and a record that
   matches the code.
10. **What will be discovered too late if implementation starts now?** Nothing known.

## 13. Final conclusion
- **Can we start?** Yes, after the owner approves the plan. His approval also accepts the note of
  task 11.1a; if he refuses it, the plan goes back for option (b).
- **What must be fixed?** Nothing. The one Low item is optional.
- **Main risk if ignored?** None that blocks. The adr-reviewer still reviews the note in the next
  review round, as it reviews every record.
