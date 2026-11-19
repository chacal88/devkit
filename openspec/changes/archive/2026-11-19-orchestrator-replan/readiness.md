# Readiness review: orchestrator-replan

Round 3. Reviewer: plan-readiness-reviewer. Base `99474cf` (origin/main), worktree
`claude/devkit-orchestrator-replan-75d5fd`. The caller gave no verdict to follow.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Both mandatory fixes of round 2 and both optional points are applied and verified against the
repository. Nothing the edits touched broke agreement between the four artifacts or the gate parsing.

## 2. Scope validation
Classification: correct. `openspec validate orchestrator-replan --strict` is valid (re-run today).

## 3. Proposal review
Proposal lines 42-43, 96-97, 105 and 110 say 0.14.2 / 0.18.1 / tag `v0.14.2`, as `requirements.md`
and `design.md` D-7 do. AC-6 (`proposal.md:63`, `requirements.md:424-430`) now ends "The delivered commit
carries the `devkit-openspec` 0.14.2 release (marketplace 0.18.1, `CHANGELOG.md` entry, CI pin at
`v0.14.2`)", identical in both files; the exit criteria (`proposal.md:105`) name the release too.

## 4. Design review
- N-1 fixed. `requirements.md:392` (A-9) cites `CONTRIBUTING.md` (step 5 of "Adding or changing an
  asset"); `design.md:21` cites `CONTRIBUTING.md` (lines 50 and 52); D-6 (b) and D-7 cite line 50 and
  line 52. `git grep conventions.md` in the change now only finds `design.md:541`, a list of documents
  to sweep, correct. The rule is at `CONTRIBUTING.md:50` and `:52` (verified in round 2).
- N-3 fixed. D-6 (b) is now "moot" and says (a) and (b) ship the same files because the README sentence
  requires the release anyway; it can no longer be read as the plan's rejected path.
- Versions today: `plugin.json` 0.14.1, marketplace entry 0.14.1, `metadata.version` 0.18.0, as D-7 says.
- Round 1 and 2 verifications are unchanged (nothing else moved; `git status` shows only the untracked
  change folder).

## 5. Specs review
`skip_specs: true`; AC-1 to AC-7 carry the verification.

## 6. Tasks review
- N-2 fixed. Gate 2.7 holds one part per release edit: `plugin.json` version is `0.14.2`; the
  `devkit-openspec` entry matched by name is `['0.14.2']`; `metadata.version` is `0.18.1`; a
  `## 0.18.1 ` CHANGELOG heading; the three pin strings; and `! grep v0.14.1`. Task 2.6's Verify lists
  each of them.
- I ran every release part of gate 2.7 on the base: all eight exit 1 (red), as the plan says. The three
  Python parts exit 1 by the comparison, not by an error: the values read are `['0.14.1']`, `0.18.0` and
  `0.14.1`.
- Parsing: with the regex of `deliver-check.mjs:280` (`^Gate:[^`]*`([^`]+)``), gates 1.9, 2.7 and 3.2 each
  yield a command (1702, 2865 and 769 characters), none contains a backtick or a `|`. The quotes in the
  Python parts are inside the backticks without disturbing it.
- AC mapping in tasks.md (AC-6 to 1.2, 2.6, 2.7, 3.1, 3.2; AC-4 includes 2.6) is consistent.

## 7. Omission detection
Rollback is a revert of the merge commit; a pushed tag is deleted only by an owner-authorized step.
The tag is a post-merge Workflow follow-up (`tasks.md:135`, `proposal.md:110`, `design.md:737`).
No finding.

## 8. Execution risks (top 5 failures)
1. The pin moved but one of the three lines missed: caught by the three pin parts and the AC-8 tests.
2. The tag pushed on the wrong commit: the follow-up says the merge commit.
3. The design document omits an item: 13-heading gate and change 2's retro.
4. A version edit forgotten: now caught by one gate part each.
5. A README sentence left saying "without a harness": the negative grep in gate 2.7.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] The Risks table of `design.md` could add "the tag is pushed after the merge by the owner's session,
  not by the PR" (not needed; the follow-up says it).

## 11. Explicitly out of scope
- [ ] Running the whole guard suite (669 tests, given by the caller); survey figures; whether the design
  document suffices for change 2 (confirmed by change 2).

## 12. Mandatory review questions
1. Problem objectively defined? Yes.
2. Result measurable? Yes: gates 1.9, 2.7, 3.2 and AC-1 to AC-7, each release edit with its own part.
3. Error behaviors defined? Not applicable to documents; red-first order covers it.
4. Edge cases covered? Yes: pinned sentences, roadmap grammar, pin tests.
5. Dependencies clear? Yes; the tag follows the merge.
6. Contracts defined? Yes: exact texts, versions, line numbers.
7. Two developers differ? Only in the design document's prose, bounded by the outline.
8. Implicit decisions? No.
9. Tasks deliver the outcome? Yes.
10. Discovered too late? Nothing identified; the design document's sufficiency is change 2's check.
