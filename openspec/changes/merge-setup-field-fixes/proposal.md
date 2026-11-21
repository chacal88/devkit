<!-- devkit-stage proposal result=passed attempt=1 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Proposal

Change: `merge-setup-field-fixes` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`, with the owner's answers). Round 17c of `openspec/roadmap.md`.

## Why

The first project that moved to `merge` mode on devkit-openspec 0.16.0 left three defects that
round 17b (`coordinator-field-fixes`) did not cover; they are still in 0.18.0, the code this change
starts from:

- **Field item 9.** In a project's first `merge`-mode pull request the `devkit` ruleset does not
  exist yet, because it is applied only after `devkit-reviews` has reported on the default branch
  (`docs/openspec-flow.md`, "Preparing the repository (setup order)", step 1). `deliver-check`
  answers `stop-merge-setup` for that pull request, and `deliver-check --watch` returns at once
  with the checks still pending. It waits only at `wait-checks` and `wait-merge`, so the session
  that has to merge by hand never sees the checks finish.
- **Field item 11.** `github-setup.mjs --checks ""` prints a list of required checks that says
  "none" above a ruleset payload that requires `devkit-reviews`. In 0.16.0 the line ended "found on
  main: none". In 0.18.0 it ends "none: no pull request has a check reported yet; pass --checks",
  which is also wrong when the owner did pass `--checks`. The owner confirms the ruleset from that
  line (`openspec-setup` step 7), so the line has to show what the ruleset really requires.
- **Field item 10.** A reviewer's verdict file can carry a second `Verdict:` line: the stage-1
  text the writer pastes below its findings. The owner decided that the first `Verdict:` line
  counts for every reader and that the second is ignored without a message. Every reader has to be
  shown to follow that rule.

## What Changes

- `deliver-check.mjs --watch` also waits when the next step is `stop-merge-setup` and the change's
  open pull request has pending checks. It runs the same single capped `gh pr checks --watch` as at
  `wait-checks`, then computes the contract again: the report shows the checks' final state, and
  the step stays `stop-merge-setup` while the repository is not prepared (field item 9).
- `github-setup.mjs` prints every check the ruleset will require: the checks given or found,
  `devkit-reviews` (always), and any check the existing ruleset `devkit` already requires. Each part
  is labelled with its source, and the line never says "none". The JSON plan gains the same list as
  `requires`, plus `checksFrom` (field item 11).
- Every reader of a verdict file (the delivery checker's reviews item, the `devkit-reviews` check
  from both of its entries, the hook on `gh pr create`, and the plan-audit reader of
  `conduct-check.mjs`) reads the first `Verdict:` line and ignores any later one without a message.
  The panel has no reader of its own: it shows what `deliver-check` and `conduct-check` report.
  Tests pin each reader (field item 10).
- `docs/openspec-flow.md`, the `openspec-setup` skill text, the roadmap line of round 17c, the
  devkit-openspec patch release (0.18.0 to 0.18.1, marketplace 0.22.0 to 0.22.1) and its
  `CHANGELOG.md` section.

Non-goals: field item 12 (release notes that warn when a new `devkit-reviews` check verifies less);
any other behaviour of `deliver-check --watch` (its minute cap, the waits at `wait-checks` and
`wait-merge`) and of `github-setup.mjs`. Also out: a wait at `stop-merge-setup` on the archive pull
request, whose checks the report does not show (`design.md` D-1); `ship-change`, `/devkit change` and
`conduct-check`, which still stop at `stop-merge-setup` without waiting; and the review writer
leaving the stage-1 `Verdict:` line out of the file, which is round 25's `review-writer-prompt`.

## Acceptance criteria

Copied from `requirements.md`, with their ids. All are proved by tests on scratch repositories
with a faked `gh`, as the existing suites do.

- AC-1 `watch-waits-during-merge-setup`: on a scratch repository whose pull request has pending
  checks and whose next step is `stop-merge-setup`, `deliver-check --watch` does not return until
  the checks finish or its minute cap ends, and its report then shows the checks' final state.
- AC-2 `setup-lists-required-checks`: `github-setup.mjs --checks ""` on a scratch repository
  prints the checks the ruleset will require, `devkit-reviews` included, and never prints "none"
  above a ruleset that requires a check.
- AC-3 `first-verdict-line-wins`: a verdict file with two `Verdict:` lines that disagree is read
  as its first line's verdict by `deliver-check`, by the `devkit-reviews` check and by every other
  reader of verdicts in the repository.
- AC-4 `red-before-fix`: each of the three defects has a test that fails on the code before its
  fix and passes after it. For field item 10, see "Open decisions inherited" below.

## Capabilities

### New Capabilities

- `verdict-files`: how every devkit reader reads a verdict file (a reviewer's `reviews/<reviewer>.md`,
  the plan audit) when the file holds more than one `Verdict:` line.

### Modified Capabilities

- `change-delivery`: the delivery checker waits for a pull request's pending checks while merge
  mode is not set up (one ADDED requirement).
- `project-setup`: the GitHub plan prints every check the ruleset will require (one ADDED
  requirement; the existing "proposed required checks" requirement is unchanged).

## Impact

- devkit-openspec (0.18.0 to 0.18.1): `hooks/deliver-check.mjs` and `hooks/deliver-check.test.mjs`;
  `skills/openspec-setup/scripts/github-setup.mjs`, its test and `skills/openspec-setup/SKILL.md`;
  new tests in `hooks/guard.test.mjs` and `hooks/conduct-check.test.mjs`. No change to `guard.mjs`,
  `conduct-check.mjs`, `merge-setup.mjs` or the panel is expected (`design.md` D-3).
- The `devkit-reviews` check: the CI workflow still downloads the same three files
  (`guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`). The change to `deliver-check.mjs` touches only
  `--watch`, which `--ci` refuses, so what the check judges does not change.
- Docs: `docs/openspec-flow.md` (the wait, the reviews item, the CI pin `v0.18.1`),
  `openspec/roadmap.md` (the round 17c line), `CHANGELOG.md`, `.claude-plugin/marketplace.json`.
- Projects: none has to act. A project in `merge` mode gets the new wait when it updates the pack. Its
  pinned `devkit-reviews` workflow behaves the same at either pin.

**Dependencies.** `coordinator-field-fixes` (archived on 2026-11-21: the 0.17.0 required-checks
discovery and the `github-setup` states this change builds on). A sibling change,
`roadmap-coordinator-followups`, also bumps devkit-openspec; the release rebase settles the version
collision (`CONTRIBUTING.md`).

**Decisions cited.** ADR 0002 (merge mode stays blocked, not downgraded, without the rule that requires
`devkit-reviews`: the wait never enables anything); ADR 0008 (decision 4: the `Verdict:` and
`Commit:` lines stay as they are); ADR 0012 (decision 4: what the check recomputes is unchanged). No
new ADR is needed (`design.md`, "Decisions and ADRs").

**Open decisions inherited.** No point of `docs/coordination-design.md` ("Open points") is touched.
One owner decision is needed at plan approval. Reading the code at `6e803eb` shows that every
verdict reader already goes through `readValue` in `plugins/openspec/hooks/guard.mjs`, which takes
the first matching line. So the field item 10 tests are expected to pass on the unchanged code,
which means AC-4 cannot have a red test for that item. The plan runs those tests on the unchanged
code first and records the run (`design.md` D-4). The owner either accepts that run as AC-4's proof
for item 10 (no reader is wrong, and the tests pin the rule) or names what else counts.
