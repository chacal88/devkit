<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> tests for the fail-closed branches of `sliceProblems` (a Commit that does not resolve, a missing or malformed record header, no base ref, the verdict's uncommitted marker), `sliceReviewStale` judging a merge by its first parent, the plan's ADR 0014 mentions, and the dogfood of the first real slice in one of the owner's projects (the phases' conversations, the real GitHub auto-merge)

## Grill

Classification: domain=process type=bug flags=[contract] (strict-assumed; the slice contract is what CI and the `gh pr create` hook enforce)

Facts gathered before the questions:
- `plugins/openspec/hooks/guard.mjs#sliceProblems` already fails closed on a Commit that does not resolve, a record with no header, a malformed header and a base ref that is not available; `plugins/openspec/hooks/project-loop.test.mjs` (the `project-loop ci:` tests from line 314) has no test for any of the four.
- `sliceProblems` reads the `(uncommitted changes)` marker of `reviews/adr-reviewer.md` through `parseCommitLine` and ignores it, while a change's review refuses the same marker (`plugins/openspec/hooks/deliver-check.mjs:204`). `project-loop.mjs#readVerdict` and `recordReviewCommand` ignore it too.
- `sliceReviewStale` has one merge test (a merge of a base whose new commit is a product file keeps the review current); none for a merge of a base that brings a file under `docs/adr/`, `docs/decisions/` or the slice's design folder.
- The ADR 0014 mentions are in the archived plan of `project-phases` (`openspec/changes/archive/2026-11-22-project-phases/proposal.md`, `design.md`, `tasks.md`); the ADR shipped as `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`.

Questions asked:
1. [scope] What happens to the dogfood of the first real slice in one of the owner's projects? → It leaves this change and becomes a roadmap line of its own, written by this change's roadmap edit; this change keeps the tests, the uncommitted-marker fix and the ADR mentions. (Answer A, delegated by the owner to the coordinating roadmap session: `Por favor, verifique todas as perguntas e as que você tiver a informação para responder, pode ir respondendo.`)
2. [project rules] Where is an ADR verdict marked `(uncommitted changes)` refused? → In all three places, the same behaviour as a change's review: `guard.mjs#sliceProblems` names it (CI and the `gh pr create` hook), `project-loop.mjs#recordReviewCommand` refuses to write `review.md`, and the `/devkit project` loop treats the verdict as unusable and hands the review back to the ADR reviewer. (Answer A, delegated by the owner to the coordinating roadmap session under the same words.)
3. [edges] Does a merge of the default branch that brings another change's ADR make the slice's ADR review stale? → Yes, as today: a new ADR may conflict with the slice, so the ADR reviewer runs again. The comment above `guard.mjs#sliceReviewStale` says so and a test pins it. (Answer A, delegated by the owner to the coordinating roadmap session under the same words.)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The new tests live in `plugins/openspec/hooks/project-loop.test.mjs`, beside the `project-loop ci:` tests, built on its `sliceRepo` helper and run through both CI entries (`deliver-check.mjs --ci` and `guard.mjs ci`) with `failsWith`; the loop and `record-review` tests sit beside the `project-loop next:` and `project-loop review:` tests.
- The four fail-closed branches already in `guard.mjs#sliceProblems` keep their messages: `reviews/adr-reviewer.md: Commit <short> does not resolve to a commit`, `<file> has no stage header on its first line`, `<file> has a malformed stage header`, `<base> is not available to compare the slice with; fetch the full history`.
- The uncommitted refusal in `sliceProblems` reads `reviews/adr-reviewer.md: Commit <short> was recorded with uncommitted changes`, the wording of `deliver-check.mjs:204`; `recordReviewCommand` returns `result: 'verdict-unusable'` with a new `why` (`uncommitted`) and a reply in both languages; `project-loop.mjs#readVerdict` returns `usable: false` when the marker is present.
- The ADR 0014 mentions are fixed with a one-line note under the title of `openspec/changes/archive/2026-11-22-project-phases/proposal.md`, `design.md` and `tasks.md` saying the slice ADR they call 0014 shipped as ADR 0015 (`docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md`), because ADR 0014 is another decision; the approved plan text is not rewritten.
- The roadmap edit replaces the dogfood part of the `project-phases-followups` line in `## Round 19b: follow-ups of the project flow` of `openspec/roadmap.md` with a new line `- [ ] project-slice-dogfood (after: project-phases-followups) — the first real slice in one of the owner's projects through \`/devkit project\` (the phases' conversations with the owner, the real GitHub auto-merge)`; the id may change if the planner finds a better one.
- The release follows `CONTRIBUTING.md`: `devkit-openspec` takes the next patch version after `origin/main`'s on the day of the merge, with its `CHANGELOG.md` line; no new ADR.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `commit-does-not-resolve` — A slice whose `reviews/adr-reviewer.md` names a `Commit:` sha that resolves to no commit fails the slice contract from both CI entries with `does not resolve to a commit`, and a test pins it.
- AC-2 `record-header-missing-or-malformed` — A slice record whose first line is not a stage header fails with `has no stage header on its first line`, and one whose first line starts like a header but is not one fails with `has a malformed stage header`; a test pins each.
- AC-3 `no-base-ref` — A slice checked when the base ref does not exist fails with `is not available to compare the slice with; fetch the full history`, and is not thrown; a test pins it.
- AC-4 `uncommitted-verdict-refused` — An ADR verdict whose `Commit:` line carries `(uncommitted changes)` fails the slice contract from both CI entries and the `gh pr create` hook with `was recorded with uncommitted changes`; the same verdict at HEAD makes `record-review` refuse (exit 2, `verdict-unusable`) without writing `review.md`, and makes `project-loop next` hand the review to the ADR reviewer instead of recording it. A test pins each of the three.
- AC-5 `merge-bringing-adr-is-stale` — A slice whose branch merges a default branch that added a file under `docs/adr/` after the review fails with `the ADR review is behind`; the comment above `sliceReviewStale` says why; a test pins it beside the existing unrelated-product-commit merge test, which still passes.
- AC-6 `adr-renumbering-note` — The three archived plan files of `project-phases` carry the note that their ADR 0014 is ADR 0015; `python3 scripts/check.py` passes.
- AC-7 `dogfood-roadmap-line` — `openspec/roadmap.md` holds the dogfood as a line of its own, after this change, and the `project-phases-followups` line no longer names it.
- AC-8 `suite-green` — The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`), `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `claude plugin validate .` pass.

## Out of scope

- The dogfood of the first real slice in one of the owner's projects (the phases' conversations, the real GitHub auto-merge): its own line in `openspec/roadmap.md` (AC-7).
- Ignoring the commits a merge brings through its second parent (question 3).
- Any other change to the slice contract, the `/devkit project` loop or ADR 0015.
