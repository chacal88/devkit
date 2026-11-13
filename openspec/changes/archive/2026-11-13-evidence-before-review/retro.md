## Retro: evidence-before-review

Merged as PR chacal88/devkit#27, squash commit `e9d94438d4f2ad7eee5a9ca95eabae7aa2ed8893` on `main`.
Tag (design D9, post-merge step): `git ls-remote origin refs/tags/v0.13.0` prints
`e9d94438d4f2ad7eee5a9ca95eabae7aa2ed8893	refs/tags/v0.13.0`, the merge commit's sha.

Dogfood (owner-confirmed proof here): the working tree's `deliver-check` sent this change to `verify`
before any review, `pr-verifier` recorded `evidence.md` first, and the review round passed in round 1
(4 of 4 approved, one `important` finding refuted 3 of 3, no finding about missing evidence).

1. Went wrong:
   - The session was started by another session, and its first owner-facing words were grill
     questions. Mid-grill the owner asked what the session was doing and said they had only asked for a
     plugin install. Nothing had been explained up front.
   - Readiness round 1 was NEEDS-REVISION. AC-8 required the tag on `origin`, a fact that can exist
     only after the merge, while `deliver-check` needs every criterion proven before the PR. The
     requirements also stated a CONTRIBUTING tag rule as existing when this change was adding it.
   - `review-round.mjs outcomes` returns no writer prompt, although `review-change`'s `agents` path says
     stage 3 sends "the writer prompt the command gives". The session imported `writerPrompt` from the
     module by hand to run stage 3.
   - Phase 4's CHANGELOG line named a step (`evidence`) that does not exist. It was caught and fixed
     before verification, so nothing went stale.
2. Better next time:
   - A session started by another session opens with two or three plain sentences: who started it,
     the problem, and what it will do. Only then comes the first owner question.
   - In the grill, write each acceptance criterion as a fact that can be proven before the PR. A
     post-merge fact (a tag, a release, a deploy) is a Workflow follow-up checked in `retro.md`.
   - Make `outcomes` give the stage-3 prompts, so the `agents` path needs no hand import.
3. Remember: evidence first held. Round 1 passed with nothing to verify about the evidence.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | A side session explains itself before its first question | process-friction | memory-only | user |
| 2 | Acceptance criteria are provable before the PR; post-merge facts go to the retro | project-rule | doc-update | project |
| 3 | `review-round.mjs outcomes` lacks the writer prompts its skill promises | tooling | followup | project |
| 4 | A release line can name a step that does not exist; read it against `next.step` names | doc-gap | memory-only | project |

## Proposed updates

### `CONTRIBUTING.md` (project-rule)
An acceptance criterion holds only what can be proven before the PR. Learning 2 (readiness round 1).
- before: (no such paragraph; insert after the paragraph that starts "When a change alters how the owner works")
+ after: An acceptance criterion states only what can be proven before the PR: `deliver-check` reads every criterion's row in `evidence.md` before `open-pr`. A fact that exists only after the merge (a tag, a release, a deploy) is a bullet under the change's `## Workflow follow-up`, done after the merge and recorded in `retro.md`.
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (process-friction)
Record this change, and queue the review-round tooling gap as a change of its own. Learning 3.
- before: (the file ends after round 9)
+ after: ## Round 10: evidence before review
+ after: - [x] evidence-before-review — deliver-check reports verify (and fix-defect) before a review round; schemas, skills, docs and the panel follow; release tagged v0.13.0 (requests from chacal88/Digital-Representative retros)
+ after:
+ after: ## Round 11: review round tooling
+ after: - [ ] review-writer-prompt — `review-round.mjs outcomes` returns each outcome's stage-3 writer prompt (`writerPrompt`), as `review-change`'s agents path says (evidence-before-review retro, item 3)
- Answer: approved
- Applied: yes

### user memory (memory-only)
A side session started by another session opens with two or three plain sentences (who started it, the problem, what it will do) before its first question to the owner.
- Answer: approved
- Applied: yes
