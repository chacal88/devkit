<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: The review stage is stale while a reviewer is stale
The checker SHALL report the review stage stale whenever the delivery checker's reviews item lists a
stale reviewer, also when the review stage's header commit is current, and the reason SHALL name
those reviewers. This SHALL NOT apply in the walk after the merge. The review stage SHALL otherwise
keep the staleness rule of every stage after the implementation.

#### Scenario: A commit of tests only after the review
- **WHEN** `review.md`'s header and the reviewers' files record commit A, and one later commit touches only test files
- **THEN** the checker reports the review stage stale, and the delivery checker's `review` step, once the evidence is current again, names only `code-quality-reviewer` and `test-coverage-reviewer`

#### Scenario: A stale reviewer under a current header
- **WHEN** `review.md`'s header records the head, `reviews/code-quality-reviewer.md` records the head, and `reviews/spec-reviewer.md` records an older commit followed by a commit that touches `src/a.ts`
- **THEN** the checker reports the review stage stale with a reason that names `spec-reviewer`, and the review stage is the next stage once the stages before it passed

#### Scenario: Every reviewer current
- **WHEN** `review.md`'s header and every reviewer's file are current at the head
- **THEN** the checker reports the review stage passed

#### Scenario: After the merge
- **WHEN** the checker runs the walk after the merge of a delivered change whose reviewer files record commits squashed away
- **THEN** the review stage is reported from its header alone, and not stale
