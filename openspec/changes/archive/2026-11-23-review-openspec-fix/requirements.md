<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> a rejected review whose findings are fixed by a commit that touches only `openspec/` (a study, a plan, a roadmap line) gets its next round from the loop: `deliver-check` reads a rejected verdict as stale after any later commit, `openspec/` included, while an approved one keeps today's rule; a test rejects a review on a scratch branch, fixes it with an `openspec/`-only commit and expects the review step (managed-agents-study retro, item 1)

Classification: domain=process type=bug flags=[] (confirmed)

Today `staleness()` in `plugins/openspec/hooks/deliver-check.mjs` lets every commit that touches only
`openspec/` (or, for the four test-spared reviewers, only test files) leave a verdict current, whatever
the verdict says. A rejected verdict therefore stays current after an `openspec/`-only fix, `next`
keeps returning `fix-review`, and the next round needs the owner's hand (managed-agents-study, fix
`fe49b25`).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- A verdict that is neither `APPROVED` nor `DECLINED` in `openspec/changes/<id>/reviews/<reviewer>.md` is stale after any commit after its `Commit:` line that touches a path other than the change's own review record, `openspec/` and test files included; `next` then returns `review` naming only the reviewers whose rejected verdict went stale.
- The change's own review record is `openspec/changes/<id>/reviews/`, `openspec/changes/<id>/review.md` and `openspec/changes/<id>/evidence.md`: a commit that touches only these paths does not make a rejected verdict stale, so committing the verdicts of a rejecting round leaves `next` on `fix-review`.
- An `APPROVED` or `DECLINED` verdict keeps today's rule: commits touching only `openspec/` (and, for `spec-reviewer`, `adr-reviewer`, `architecture-reviewer` and `security-reviewer`, only test files) leave it current; it is not re-asked because of a plan-only fix.
- The round-2 rule does not change: a reviewer that still rejects at the current commit after round 2 stops `next` on `stop-review-deadlock` for the owner.
- Uncommitted changes keep today's rule: only committed fixes count; `openspec/` files left uncommitted make no verdict stale.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `rejected-openspec-fix-reviews` — On a scratch repository, a change whose review is rejected and whose fix is then committed touching only `openspec/` gets `review` from `deliver-check` `next`, naming the rejecting reviewer, with no hand from the owner.
- AC-2 `record-commit-keeps-fix` — On a scratch repository, a rejected review followed only by a commit of the change's review record (`reviews/`, `review.md`, `evidence.md`) still gets `fix-review` from `next`, never a new round by itself.
- AC-3 `approved-keeps-rule` — On a scratch repository, an approved review followed by an `openspec/`-only commit stays current and is not asked again; a test-spared reviewer's approved verdict followed by a test-only commit stays current too.
- AC-4 `deadlock-unchanged` — A reviewer that still rejects at the current commit after round 2 still stops `next` on `stop-review-deadlock`.

## Out of scope

- Any change to how approved or declined verdicts go stale.
- The round numbering and the round-2 owner stop.
- The slice contract (`devkit-project`) review staleness of `reviews-check`.

## Owner answers

- 2026-11-22, the proposed rule (points 1 to 5, as the assumptions above state them): `confirmo`. The owner delegated this answer to the coordinating roadmap session, writing there in their own message: `Por favor, verifique todas as perguntas e as que você tiver a informação para responder, pode ir respondendo.`; the coordinating session relayed it to this session. The owner then confirmed it in this change's own session, in their own message: `Confirmo`.
