<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `review-openspec-fix` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the owner's answers). Round 17f of `openspec/roadmap.md`.

## Why

`deliver-check` reads every verdict file's `Commit:` line through one rule: commits that touch only
`openspec/` (and, for four reviewers, only test files) leave the verdict current, whatever it says.
A rejected review whose fix lives in `openspec/` (a study, a plan, a roadmap line) therefore never goes
stale: `next` keeps answering `fix-review`, the stage readout keeps offering the fix, and round 2
needs the owner's hand. That happened on `managed-agents-study` (fix `fe49b25`, retro item 1).

## What Changes

- A verdict that is neither `APPROVED` nor `DECLINED` in `openspec/changes/<id>/reviews/<reviewer>.md`
  is stale after any later commit that touches a path outside the change's own review record
  (`openspec/changes/<id>/reviews/`, `openspec/changes/<id>/review.md`,
  `openspec/changes/<id>/evidence.md`), `openspec/` and test files included. `next` then answers
  `review`, naming only the reviewers whose rejected verdict went stale, at round 2 after
  `Consensus: FAIL (round 1/2)` (the round formula is unchanged and already gives 2, `design.md` D-2).
- A commit of the review record alone (the verdicts of the rejecting round, `review.md`, the
  evidence) leaves a rejected verdict current, so `next` stays on `fix-review`.
- An approved or declined verdict keeps today's rule. Uncommitted files keep today's rule. The
  round-2 stop (`stop-review-deadlock`) is unchanged.
- The stage readout (`flow-check.mjs`) and the `devkit-reviews` check read verdicts through the same
  reader (`readReviews`), so they follow with no code of their own: after an `openspec/`-only fix of
  a failed review the readout offers the review stage again (`rerun-after-fix`).
- Docs: `docs/openspec-flow.md` (the staleness rule, the order of the delivery steps, the
  `update-branch` row) and the stale definition of `plugins/core/skills/review-change/SKILL.md`.
  Release: devkit-openspec 0.21.1 to 0.21.2, devkit-core 0.9.0 to 0.9.1, marketplace 0.25.1 to
  0.25.2, a `CHANGELOG.md` section, the CI snippet pinned to `v0.21.2`.

Non-goals (requirements, Out of scope): any change to how approved or declined verdicts go stale;
the round numbering and the round-2 owner stop; the slice contract (`devkit-project`) review
staleness of the `devkit-reviews` check; any change to `staleness()` itself, to the evidence's rule,
to the dirty-tree rule or to the reason wording.

## Acceptance criteria

Copied from `requirements.md`, with their ids. Proven in this change with scratch repositories in
`plugins/openspec/hooks/deliver-check.test.mjs` (the stage readout's cases in
`plugins/openspec/hooks/flow-check.test.mjs`), `design.md` D-3.

- AC-1 `rejected-openspec-fix-reviews` — On a scratch repository, a change whose review is rejected and whose fix is then committed touching only `openspec/` gets `review` from `deliver-check` `next`, naming the rejecting reviewer, with no hand from the owner.
- AC-2 `record-commit-keeps-fix` — On a scratch repository, a rejected review followed only by a commit of the change's review record (`reviews/`, `review.md`, `evidence.md`) still gets `fix-review` from `next`, never a new round by itself.
- AC-3 `approved-keeps-rule` — On a scratch repository, an approved review followed by an `openspec/`-only commit stays current and is not asked again; a test-spared reviewer's approved verdict followed by a test-only commit stays current too.
- AC-4 `deadlock-unchanged` — A reviewer that still rejects at the current commit after round 2 still stops `next` on `stop-review-deadlock`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `verdict-files`: the test-files requirement is limited to approved and declined verdicts, and one
  ADDED requirement says when a rejected verdict goes stale (the change's own review record).
- `change-delivery`: the merge-commit requirement's first scenario and one sentence of its text say
  that the reviews read current after an `openspec/`-only merge are the approved or declined ones;
  a rejected verdict follows `verdict-files`.

## Impact

- devkit-openspec (0.21.1 to 0.21.2): `hooks/deliver-check.mjs` (`readReviews`, one new helper, the
  `approved` predicate moved up), new tests in `hooks/deliver-check.test.mjs` and
  `hooks/flow-check.test.mjs`, the CI pin assertion in `hooks/change-loop.test.mjs`. No change to
  `staleness()`, `flow-check.mjs`, `guard.mjs`, `change-loop.mjs`, `conduct-check.mjs` or the panel.
- devkit-core (0.9.0 to 0.9.1): `skills/review-change/SKILL.md`, one sentence (docs only).
- The `devkit-reviews` check: a rejected review already fails it; its reason now also says the
  verdict is stale after an `openspec/` fix. A project's workflow gets the new reader when its pin
  moves to `v0.21.2`; nothing a project has to do.
- Docs and release files: `docs/openspec-flow.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`,
  `plugins/openspec/.claude-plugin/plugin.json`, `plugins/core/.claude-plugin/plugin.json`.
- Surfaces: hooks of devkit-openspec and one skill text of devkit-core. No backend, frontend, worker
  or panel surface.

**Exit criteria.** The gates of `tasks.md`: the flow-check suite (which loads the deliver-check
suite) under `GITHUB_HEAD_REF`/`GITHUB_BASE_REF`, then the whole hook suite
(`node --test plugins/openspec/hooks/guard.test.mjs`), `python3 scripts/check.py`,
`python3 scripts/gen-catalog.py --check` and `claude plugin validate .`; and
`openspec validate review-openspec-fix --strict`.

**Dependencies.** `merge-staleness-first-parent` (archived 2026-11-22: `staleness()` takes the
`allowed` option through its first-parent walk, which this change reuses); `review-writer-prompt`
(archived 2026-11-22: devkit-openspec 0.21.x, the test-spared reviewers and the `allowed` option);
`managed-agents-study` (archived: the retro item this change answers).

**Decisions cited.** ADR 0008 decision 4 (the `Verdict:` and `Commit:` lines and the writer rules
stay as they are); ADR 0012 decision 4 (the check still recomputes reviews at the PR head); ADR 0002
(its consequence "strict up-to-date re-runs stale reviews after each base update" stays true). No new
ADR (`design.md`, Decisions and ADRs).

**Open decisions inherited.** None; no point of `docs/coordination-design.md` ("Open points") is
touched. Two consequences of the owner-confirmed rule are recorded for the owner to see at approval
(`design.md` D-4): a merge of the base that brings only `openspec/` files (an "Update branch")
also makes a rejected verdict stale, so a rejecting reviewer runs again even when the fix is not in
yet; and any file committed together with a rejecting round's record, outside that record, counts
as a fix. Both follow from assumption 1 of `requirements.md` as written; the docs say to commit a
rejecting round's record on its own.
