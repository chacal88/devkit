<!-- devkit-stage readiness result=passed attempt=6 commit=41dd40ed6cb3017dd2a8cc5c623ffa6d19934303 -->
# Readiness review: release-at-merge

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

This is the re-review of the plan at attempt 6. The plan files are uncommitted on `41dd40e`, and
`docs/adr/release-at-merge-step-record.md` is still untracked. Attempt 5's only blocker, N1, is
closed. I checked everything changed since attempt 5 against the code and the repository's records:
- task 9.1a;
- tasks 9.2, 9.6 and 9.17;
- D-20's "What the give-back touches" and "The `Amended by` line";
- the new D-26 guard row;
- F-8;
- decisions 4 and 5 of the step record.

No blocker is open. Two Low items remain, both optional.

`openspec validate release-at-merge --strict`: valid. It prints the one expected INFO line, "Archive
would refuse this delta … The loop fetches the base branch before it judges a delivery step - not
found". The line goes away when task 9.1 merges train 15 (D-25), and 9.1's done condition checks
that it is gone.

`python3 scripts/check.py`: `all checks passed` on the working tree. The precondition in the
paragraph before 9.1 is met: `review.md` and `reviews/code-quality-reviewer.md` now quote
`` `rewriteCitations('See [the roles](docs/roles.md) ...', …)` `` in a code span, and no other word
changed. I checked this with `git diff`.

`openspec/config.yaml` `rules.readiness` applies: this file is written by this agent only. The
caller gave no instruction about the verdict.

## 2. Scope validation
Classification: correct

Since attempt 5 the plan adds one header line to an accepted record (9.1a) and its guard test. The
repository's convention covers that line (section 4). Nothing else widens.

## 3. Proposal review
Unchanged since attempt 5 (file time 18:34, before attempt 5's report). O6 (over two pages) is
declined because the file is outside this revision (`design.md:1172`). I accept that. No findings.

## 4. Design review
Re-derived against live code:

| Claim | Check |
|---|---|
| Every amended accepted record carries `- Amended by` lines, and ADR 0003 carries four | `docs/adr/0003-*.md:4,5,6,9` (0018, 0027, 0030, 0022). |
| ADR 0027 puts its `Amended by` line after `- Builds on:` | `docs/adr/0027-*.md:8-9`. The header of `docs/adr/0031-release-at-merge.md` also ends with `- Builds on:` (`:8`), so 9.1a's place is well defined. |
| Today's file form of a citation is rewritten anywhere, so the new D-26 row (`design.md:1019`) is a guard | `release-merge.mjs:288-291`: the `<slug>.md` regex has no folder condition. |
| The citation pass reads the record the step just renamed | `git mv` updates the index (`release-merge.mjs:452`). The pass then runs `git grep` over the tracked `*.md`/`*.yaml` (`:465`, `CITATION_PATHSPEC` at `deliver-check.mjs:34`), so `docs/adr/<N>-feat.md` is found and its `(feat-store.md)` is rewritten with `feat-store`'s number (`:471`). The own-record rewrite (`:453`) and the slug check (`:422`) never touch a `feat-store` token while rewriting `feat`. Both forms need a closing `]` or a `.md`. |
| `reassign` holds state keys only, and citation paths go back with their `Release-adr` (O2) | `design.md:743-748`. This matches `releaseStateAt`'s keys (`deliver-check.mjs:2068-2080`). |
| 9.6's new checks can pass | `docs/openspec-flow.md:494` is the whole "The release note" paragraph on one line (1996 characters). `derived, with no marker commit` counts 1 today and is absent from D-20's new sentence (`design.md:821-827`). `what the step's own last recorded commit wrote` counts 0 today and appears once in the new sentence. The bullet's addition ("its own last recorded commit wrote") and the N3 row ("the step's own record wrote") do not match it. |
| 9.6's `ADRs:` grep | `openspec/config.yaml:37` is one line ending `amends 0022 and 0025)`. The `-F` string in `tasks.md:401-402` is exactly the text D-20 prescribes (`design.md:848-852`). |
| 9.17's grep finds nothing outside the change folder after the step | `git grep -F` for `ADR [release-at-merge`, `(release-at-merge.md)` and `(release-at-merge-step-record.md)` outside `openspec/changes/` finds no test or source literal today. The only hits of the slug are comments with the bare id (`release-at-merge D-9` etc.), which are not citation forms. |

### Attempt 5's items
- **N1: closed.** 9.6 now checks a phrase only the old text holds, and that the new sentence is present
  (`tasks.md:399-401`; `design.md:1166`).
- **O1: closed.** Decisions 4 and 5 of `docs/adr/release-at-merge-step-record.md` (`:63-85`) now say
  that a line equal to the merge base's is never listed as taken from the record. They also say that
  only `Release-adr` and `Release-citation` entries are given back, with `Release-line` keys left to
  the step's computation. Both match D-20 (`design.md:738-752`).
- **O2: closed.** See the table.
- **O3: closed.** It is decided rather than asked:
  - 9.1a (`tasks.md:322-331`) adds the line after 9.1 and before 9.6;
  - D-20, "The `Amended by` line" (`design.md:865-886`), gives the reasons;
  - F-8 (`:1200-1214`) records it.

  The line stales no stage file, because the `decisions` stage is `decisions.md` only. Its two tokens
  are numbered at 9.17, which checks the result (`tasks.md:470`).
- **O4: closed.** `tasks.md:300-302`.
- **O5: closed.** `design.md:1375`.

## 5. Specs review
Unchanged since attempt 5 (spec files dated 18:09). The `Amended by` header citation needs no new
scenario: it falls under the existing citation-rewrite requirement, and D-26 gives it a test. No
findings.

## 6. Tasks review
- 9.1a's done condition is executable. The `-F -e` grep counts the one line. `git diff --numstat <9.1's
  merge commit> HEAD -- docs/adr/release-at-merge.md` pins "one added, none removed". `check.py`
  closes it.
- 9.2 names the guard by its D-26 name, and the name matches `design.md:1019` word for word.
- 9.6 no longer edits either record, and it points to 9.1a for the header line (`tasks.md:395-398`).
- 9.17 lists the first record's `Amended by` line among the citations, and it checks the numbered
  form (`tasks.md:466-471`).
- I ran no test gate. No product code has changed since `4a6e858`, gate 8.2 recorded the whole suite
  green at `c7b86d9`, and the phase 9 gates are filtered or long runs that the implementer and the
  caller make.
- Low (O-A): the tasks do not say where the implementer stops for 9.1a, which another session does
  in the middle of the phase. Section 10 has the details.

## 7. Omission detection
No findings. Validation, error handling, rollback, idempotency and compatibility are as at attempt 5.
The real runs P-13 and S-12 cover the failure and success paths.

## 8. Execution risks (top 5 failures)
1. **9.1a skipped or done late.**
   - Cause: 9.1a is the coordinating session's step in the middle of phase 9, and the implementer is
     not told to stop for it.
   - Impact: 9.6's checks do not read the line. The miss shows only at 9.17, whose done condition
     requires the numbered `Amended by` line.
   - Prevention: O-A.
2. **The base moves again during phase 9.**
   - Cause: trains keep landing.
   - Impact: another merge at 9.17.
   - Prevention: as planned. 9.17 runs the step, which now carries its record, and the coordinator
     holds `main` at the release step.
3. **9.1's revert meets a conflict outside the one expected.**
   - Cause: the base moved past `a815222`.
   - Impact: the phase stops for the owner.
   - Prevention: as written in 9.1.
4. **A D-19 caller left without the path.**
   - Cause: 9.3 changes `rewriteCitations` to take a path, and line `:453` (the record's own rewrite)
     is a caller as well as the pass.
   - Impact: a record's own `(other.md)` is left unrewritten.
   - Prevention: 9.3 says "its callers", and the new 9.2 guard pins the pass's side.
5. **The `newestPlan` wording in the phase 9 summary.**
   - Cause: `design.md:1325` lists `planFacts`' `newestPlan`, while D-21 and task 9.9 say `newestNote`,
     with `newestPlan` unchanged.
   - Impact: if an implementer follows the summary, the dependency audit is staled by the note.
   - Prevention: 9.9 is explicit, and O-B fixes the summary.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] O-A (Low, Fix during implementation). Where: `tasks.md:322` (9.1a). Say how phase 9 is split
  around 9.1a. For example, the implementer returns after 9.1 and the coordinating session resumes it
  at 9.2 once 9.1a is committed. Alternatively, state that 9.1a may come at any point before 9.6.
- [ ] O-B (Low, Nice to have). Where: `design.md:1325`. Change "`planFacts`' `newestPlan`" to
  "`planFacts`' `newestNote`", as D-21 and task 9.9 say.
- [ ] O-C (Low, Nice to have). Where: `design.md:1167`. Row O1 still reads "not taken here … has the
  adr-author align it before the approval", but the record is now aligned (`docs/adr/release-at-merge-step-record.md:63-85`).
  The row could say "taken by the adr-author".

## 11. Explicitly out of scope
- [ ] The follow-ups at `tasks.md:487-492`.
- [ ] The decision text of `ADR [release-at-merge]`, which is accepted and not edited. Only 9.1a's
  header line is added.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes. Every task in phase 9 has a command-level done condition, 9.1a and
   9.6 included.
3. Are error behaviors defined? Yes. The give-back's exit 2 has its scenario and its test.
4. Are edge cases covered? Yes. They include a citation in one record's header naming the other record
   of the same change (new guard), slug-prefixed records, and a merge-base value equal to the
   record's.
5. Are dependencies clear? Yes. The base is `a815222` or later, 9.1a comes after 9.1 and before 9.6,
   and the second record is committed with the approval.
6. Are contracts defined? Yes. `reassign` holds state keys only, and the trailers, `stepRecord` and
   the give-back are specified.
7. Can two developers interpret this differently? Only on when to stop for 9.1a (O-A), and 9.17's
   check catches a miss.
8. Are any decisions implicit instead of written? No. The `Amended by` line is now written as a
   decision (D-20, F-8).
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? Nothing material. At worst, 9.1a is
    found missing at 9.17.

## 13. Final conclusion
- Can we start? Yes, once the owner approves the plan. The approval commit includes
  `docs/adr/release-at-merge-step-record.md`, as the paragraph before 9.1 says.
- What must be fixed? Nothing mandatory. N1 and O1 to O5 of attempt 5 are closed. O-A to O-C are
  optional.
- Main risk if ignored: 9.1a happens late or is skipped mid-phase, and 9.17's done condition catches
  it, at the cost of one more commit before review.
