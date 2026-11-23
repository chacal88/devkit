<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `project-phases-followups` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the answers the owner delegated to the coordinating roadmap
session). Round 19b of `openspec/roadmap.md`; item 4 of the `project-phases` retro
(`openspec/changes/archive/2026-11-22-project-phases/retro.md`).

## Why

The slice contract that `devkit-reviews` and the `gh pr create` hook apply to a `devkit-project`
pull request (ADR 0015 decision 5) has four fail-closed branches no test pins, and one gap: an ADR
verdict whose `Commit:` line carries `(uncommitted changes)` passes the contract, and
`/devkit project` records it as the review stage, while a change's review refuses the same marker
(`plugins/openspec/hooks/deliver-check.mjs#staleness`). Reproduced while planning on a scratch
slice: `deliver-check.mjs --ci` prints `slice billing: passed the slice contract` for such a
verdict. ADR 0015's Review trigger names exactly this ("a slice's pull request merges with ... a
review not current"). The archived `project-phases` plan also calls its ADR "ADR 0014", a number
another change took first, and the roadmap line of this change carries a dogfood that needs a real
project rather than this repository.

## What Changes

- The slice contract (`guard.mjs#sliceProblems`, read by both CI entries and the `gh pr create`
  hook) refuses an ADR verdict recorded with uncommitted changes, naming it
  `reviews/adr-reviewer.md: Commit <short> was recorded with uncommitted changes`.
- `/devkit project` treats that verdict as unusable: `record-review` refuses it (exit 2,
  `verdict-unusable`, a new reason in both languages) and writes no `review.md`; `next` hands the
  review back to the ADR reviewer, for an active slice and for one archived on its branch.
- New tests in `plugins/openspec/hooks/project-loop.test.mjs` pin the four existing fail-closed
  branches (a `Commit:` that does not resolve, a record with no or a malformed stage header, a base
  that cannot be compared), the uncommitted refusal at each of its three places, and a merge of the
  default branch that brings an ADR making the slice's review stale. The comment above
  `guard.mjs#sliceReviewStale` says why that merge counts.
- A dated note under the title of the archived `project-phases` `proposal.md`, `design.md` and
  `tasks.md` says their "ADR 0014" shipped as ADR 0015; the approved text is not rewritten.
- `openspec/roadmap.md`: the dogfood leaves this change's line and becomes its own line,
  `project-slice-dogfood (after: project-phases-followups)`, in round 19b.
- `docs/openspec-flow.md` ("The slice contract") says what a current ADR verdict is.
- Release: devkit-openspec patch (0.21.1 to 0.21.2, marketplace 0.25.1 to 0.25.2, or the next
  patch after `origin/main`'s at the merge), its `CHANGELOG.md` section, and the CI snippet's pin.

Non-goals: the dogfood itself (AC-7 moves it to its own line); ignoring what a merge brings through
its second parent (grill question 3); any other change to the slice contract, the `/devkit project`
loop or ADR 0015; rewriting ADR 0015's quotation of the owner's words, which name "ADR 0014" as the
owner typed them.

## Acceptance criteria

Copied from `requirements.md`, with their ids. Every test named here is in
`plugins/openspec/hooks/project-loop.test.mjs` (`design.md` D-4).

- AC-1 `commit-does-not-resolve` — A slice whose `reviews/adr-reviewer.md` names a `Commit:` sha that resolves to no commit fails the slice contract from both CI entries with `does not resolve to a commit`, and a test pins it.
- AC-2 `record-header-missing-or-malformed` — A slice record whose first line is not a stage header fails with `has no stage header on its first line`, and one whose first line starts like a header but is not one fails with `has a malformed stage header`; a test pins each.
- AC-3 `no-base-ref` — A slice checked when the base ref does not exist fails with `is not available to compare the slice with; fetch the full history`, and is not thrown; a test pins it.
- AC-4 `uncommitted-verdict-refused` — An ADR verdict whose `Commit:` line carries `(uncommitted changes)` fails the slice contract from both CI entries and the `gh pr create` hook with `was recorded with uncommitted changes`; the same verdict at HEAD makes `record-review` refuse (exit 2, `verdict-unusable`) without writing `review.md`, and makes `project-loop next` hand the review to the ADR reviewer instead of recording it. A test pins each of the three.
- AC-5 `merge-bringing-adr-is-stale` — A slice whose branch merges a default branch that added a file under `docs/adr/` after the review fails with `the ADR review is behind`; the comment above `sliceReviewStale` says why; a test pins it beside the existing unrelated-product-commit merge test, which still passes.
- AC-6 `adr-renumbering-note` — The three archived plan files of `project-phases` carry the note that their ADR 0014 is ADR 0015; `python3 scripts/check.py` passes.
- AC-7 `dogfood-roadmap-line` — `openspec/roadmap.md` holds the dogfood as a line of its own, after this change, and the `project-phases-followups` line no longer names it.
- AC-8 `suite-green` — The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`), `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `claude plugin validate .` pass.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `reviews-check`: the slice contract requires an ADR verdict recorded with no uncommitted changes,
  and names how a merge that brings an ADR, a record with no or a malformed header, and a commit
  that does not resolve are judged; the pull request hook refuses a slice whose default branch
  shares no history with it.
- `project-definition`: the ADR reviewer's verdict recorded with uncommitted changes is not
  recorded as the review stage and the review runs again.

## Impact

- devkit-openspec (0.21.1 to 0.21.2): `hooks/guard.mjs` (`sliceProblems`, the comment of
  `sliceReviewStale`), `hooks/project-loop.mjs` (`readVerdict`, `recordReviewCommand`),
  `hooks/change-loop.mjs` (one message key, `why.uncommitted`, in both languages),
  `hooks/project-loop.test.mjs` (new tests only), `hooks/change-loop.test.mjs` (the CI pin
  assertion only), `README.md` (one ADR number, see "Open decisions inherited").
- The `devkit-reviews` check: `guard.mjs` is one of the three files a project's workflow downloads,
  so a project gets the refusal when its pin moves to `v0.21.2`; until then it behaves as before.
  devkit's own workflow runs the tree's checker, so the refusal applies here from the merge.
- Docs and records: `docs/openspec-flow.md` (the slice contract sentence, three pin lines),
  `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `plugins/openspec/.claude-plugin/plugin.json`,
  `openspec/roadmap.md`, and the archived `project-phases` `proposal.md`, `design.md`, `tasks.md`.
- Surfaces: hooks and docs of devkit-openspec only. No backend, frontend, worker or panel surface;
  no other pack.

**Exit criteria.** The gates of `tasks.md`: the project-loop suite under `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF`, then the whole hook suite (`node --test plugins/openspec/hooks/guard.test.mjs`),
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `claude plugin validate .`;
and `openspec validate project-phases-followups --strict`.

**Dependencies.** `project-phases` (archived on 2026-11-22; devkit-openspec 0.20.0, the slice
contract and the loop this change tests and fixes) and `review-writer-prompt` (archived on
2026-11-22; devkit-openspec 0.21.1, the version this change bumps). A sibling that also bumps
devkit-openspec meets this bump at the release rebase (`CONTRIBUTING.md`, step 5).

**Decisions cited.** ADR 0015 decision 5 (the slice contract: "the ADR reviewer's verdict approved
and current"; this change makes "current" refuse the uncommitted marker, as it does for a change)
and its Review trigger; ADR 0008 decision 4 (the `Verdict:` and `Commit:` lines and the writer rules
stay as they are; the marker is the one the reviewer agents already write); ADR 0012 decision 4 (the
check recomputes reviews at the PR head); ADR 0002 (the check GitHub merges on). No new ADR is
needed (`design.md`, "Decisions and ADRs").

**Open decisions inherited.** None of `docs/coordination-design.md` ("Open points") is touched.
Two refinements are recorded for the owner to see at approval:

- `plugins/openspec/README.md` line 20 says the `devkit-project` schema is "Not an opt-in schema
  (ADR 0014)"; that decision is ADR 0015's (its alternatives table rejects the opt-in schema). The
  plan corrects it to ADR 0015 with the archived notes of AC-6, since it is the same renumbering;
  it is the only shipped file outside the archive with the wrong number (`git grep -n "0014"`
  checked while planning). The owner may strike it at approval.
- AC-3 through the CI entries: with no `origin/<base>`, or one that shares no history with the
  branch, both CI entries stop earlier (exit 3, `fetch the full history`) and never reach
  `sliceProblems`; the hook with no default branch answers `no origin/<default branch> to compare
  the slice with`. So AC-3 is pinned by a direct call of `sliceProblems` with a base that does not
  exist, and by the `gh pr create` hook with a default branch that shares no history, the one entry
  that reaches the message (`design.md` D-4, tests 4 and 5). Requirements assumption 1's "both CI
  entries with `failsWith`" holds for AC-1, AC-2, AC-4 and AC-5.
