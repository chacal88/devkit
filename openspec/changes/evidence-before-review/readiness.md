# Readiness review: evidence-before-review

Round 2 (overwrites round 1). Reviewer: plan-readiness-reviewer, independent of the author. Base: 279c830. The owner's answers of 2026-11-13 are recorded in requirements.md Assumptions.
Validation: `openspec validate evidence-before-review --strict` is valid (run again here).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Both round-1 blockers are closed in the artifacts and no new one was found. The code claims verified in round 1 are unchanged (the base has not moved); I re-read only what the revision touched.

## 2. Scope validation
Classification: correct. In scope: reorder `fix-defect` and `verify` before `review` in `nextStep`, follow it in text and the panel ladder, release 0.13.0 and add the owner-confirmed tag rule to CONTRIBUTING. The tag push is explicitly outside the acceptance criteria and outside `deliver-check` (Out of scope: automating the tag push).

## 3. Proposal review
Clear problem, goal, impact and non-goals. The proposal's AC-8 (`release-ready`) matches requirements.md's AC-8 in meaning. The "Open decisions inherited" line now records the owner's answers instead of two open points. No other change.

## 4. Design review
Round-1 re-derivations still hold (nextStep lines 957-1028, `staleness` 193, guard 322-332, `conduct-check` mapping, `STEP_KEYS` line 12, the panel and test line numbers). Re-checked after the revision:
- D8 states that CONTRIBUTING has no tagging rule on 279c830 and that this change adds one on the owner's confirmation. Verified: `grep -in tag CONTRIBUTING.md` finds no tagging rule. The false premise of round 1 is gone.
- D8 adds the correction of CONTRIBUTING line 40. Verified: line 40 reads "about 9 minutes; 8.7 observed on 94e795d", the text task 4.4 replaces.
- D9 splits the work: the pre-PR facts are AC-8 (`release-ready`: versions, CHANGELOG, pin, the CONTRIBUTING rule, `v0.13.0` free on `origin` and locally from 5.1's record). The tag on the merge commit is a post-merge step, recorded and checked in `retro.md` (the `git ls-remote` line must name the merge commit's sha; a missing or misplaced tag goes to the owner). The "How AC-8 is proven" paragraph now says every part of AC-8 is true before the PR, so `pr-verifier` writes a plain `pass`. The `no proof` blocking problem no longer arises.
- The Open Questions section is gone; nothing in the package still depends on an unanswered owner question.
- No ADR is contradicted (ADR 0002 is served by the tag; D11 unchanged).
- Remaining accepted risk: whether a ruleset allows pushing a tag is not verified. It surfaces after the merge, has an explicit stop-and-tell-owner path, and cannot block the PR.

## 5. Specs review
No spec delta, by D1 (`skip_specs: true`, no `openspec/specs/` content); valid under `--strict`. The criteria and their named tests are the contract.

## 6. Tasks review
- One `## N.` group per phase, each ending in a gate task with one backticked command; every AC id is in the id table and in task text (`rules.tasks` met). AC-8's rename to `release-ready` is applied consistently across the table, tasks 4.1-4.5, 4.9, 5.9 and the follow-up.
- Task 1.6 now agrees with D5's table: `:1717` evidence first, `:1784` `verify`, evidence, then `review` round 1, `:2361` `seen` reads `'disable-auto-merge', 'verify', 'review', 'push'` with the call order spelled out, and `conduct-check.test.mjs:710` renamed. Round-1 ambiguity closed.
- Task 4.4 carries the CONTRIBUTING rule (both halves of the owner's wording) and the 13-minute correction; 4.9 and the preamble now say about 13 minutes.
- Task 3.2 notes that the mock's numbers are illustrative and the tests build their own data (round-1 optional item).
- Phase 5 remains conducting-session-owned with the failure outcome for a misrouted implementer; its text now says the phase proves only that the tag is free.

## 7. Omission detection
No findings. Validation, error and edge behavior, staleness, idempotency, rollback, rollout (mid-flight projects get `verify` where they got `review`) and test strategy are written. The tag-push permission is the one unverified assumption and it is handled after the merge.

## 8. Execution risks (top 5 failures)
1. Cause: tests flipped by rote. Impact: a test loses what it proved. Prevention: D5's rule and the now exact 1.6 wording.
2. Cause: a paraphrase of the old order missing from the `OLD_ORDER` list. Impact: AC-6 text test green, a doc stale. Prevention: positive markers plus reviewers; the round-1 scan over `git ls-files` found no stray file.
3. Cause: the conducting session uses the installed 0.12.0 checker. Impact: review runs before evidence on this change. Prevention: D10 and the quoted `next.step` in the `pr-verifier` dispatch.
4. Cause: tag push refused after the merge. Impact: release not pinnable. Prevention: 5.1 checks the name is free; the stop-and-tell path is written, and the retro records the result.
5. Cause: the 13-minute guard suite in a foreground call. Impact: timeout. Prevention: gates 1.9 and 4.9 run as background Bash.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] None needed.

## 11. Explicitly out of scope
- [ ] Tags for 0.9.0 to 0.12.0, the Digital-Representative repository, automating the tag push, any change to `review-change`, `review-round.mjs`, `pr-verifier`'s format, `guard.mjs`, `--ci` or `staleness()`.

## 12. Mandatory review questions
1. Objectively defined problem? Yes.
2. Measurable result? Yes: AC-1 to AC-8 each have named tests or a pre-PR fact.
3. Error behaviors defined? Yes (refused push, existing tag, misrouted phase 5).
4. Edge cases covered? Yes (defect on stale evidence, deadlock, `noProof`, fix after PR, mid-flight update).
5. Dependencies clear? Yes, both archived.
6. Contracts defined? Yes: step names and JSON unchanged; only the order moves.
7. Can two developers interpret differently? No material point left.
8. Implicit decisions? None found.
9. Do the tasks deliver the outcome? Yes, the tag excepted by design, as a post-merge step with a check in the retro.
10. Discovered too late? Only whether a tag ruleset blocks the push, which cannot be known earlier and has a written path.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable; the residual risk is the post-merge tag push, handled in the retro.
