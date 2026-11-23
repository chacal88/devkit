<!-- devkit-stage proposal result=passed attempt=1 commit=8c8b7b89ca898242699b60e964e74a183e98258f -->
# Proposal

Change: `release-merge-conflict` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, the merge-staleness-first-parent retro, item 1).

## Why

When another change releases first, a change's pull request conflicts with its base in the release
files, and the delivery loop cannot get past it. PR #51 ended the run blocked ("the pull request
has a problem") after PR #47 released devkit-openspec 0.19.0. Two things cause it. The CI-pin
assertion in `plugins/openspec/hooks/change-loop.test.mjs` names a literal release number, so
every release edits it and it conflicts, and it is not a release file, so the conflict is blocking.
And the tool behind the release-conflict step, `plugins/openspec/hooks/release-rebase.mjs`, rebases
the branch, so the next step, `push-rebased`, runs `git push --force-with-lease`. The desktop
Auto-fix forbids both the rebase and the force push. A merge-mode pull request behind another
release should go on by itself.

## What Changes

- The release-conflict step merges `origin/<base>` into the branch instead of rebasing it. The
  tool, renamed `plugins/openspec/hooks/release-merge.mjs`, runs the merge, resolves the release
  files with today's renumbering rule (the base's version plus the change's own bump, the change's
  `CHANGELOG.md` entry above the base's newest, every CI pin set to the resolved devkit-openspec
  version, the catalog regenerated), and commits the merge. It never pushes. When the merge cannot
  be resolved, it aborts and leaves the branch, the index and the working tree as they were.
- **BREAKING** (for readers of the loop's JSON): the `push-rebased` step and the conduct-check
  override that handed it are removed. After the merge, the loop runs the evidence and the review
  again (the renumbered files are outside `openspec/`, so both go stale) and then hands a plain
  `push` (`open-archive-pr` on an archive pull request), carrying the command `git push origin
  <branch>`. GitHub still reports the conflict until that push, so the release-conflict override
  hands that push when the local head already holds `origin/<base>` and is ahead of the pull
  request's head. A pull request whose head is not in the local history (someone else pushed, or an
  earlier version rebased the branch) ends blocked with that reason. It is never handed
  `update-branch` and never a push.
- The CI-pin assertion in `change-loop.test.mjs` stops naming a release number: it checks that
  every pin in `docs/openspec-flow.md` equals the `version` in
  `plugins/openspec/.claude-plugin/plugin.json`. A release bump no longer edits that test.
- `docs/openspec-flow.md`, the `devkit` skill, `plugins/openspec/README.md` and `CONTRIBUTING.md`
  describe the step as a merge of the base followed by a plain push. No line of theirs about the
  delivery loop names `push-rebased`, a rebase of the branch or a force push any more. The lines
  about the hooks' force-push refusal, the ruleset and the dependency rebase of the planning rows are
  not about the delivery loop and stay.
- `openspec/roadmap.md` gains a follow-up line for the live check (AC-8).
- Release: devkit-openspec 0.21.1 to 0.22.0 and the marketplace 0.25.1 to 0.26.0 (the next
  numbers above `origin/main` as of 2026-11-22). A sibling that releases first is met at this
  change's own release step, by hand (requirements, Out of scope).

**Non-goals.** Conflicts outside the release files stay blocked. The staleness rule of
merge-staleness-first-parent is unchanged. The dependency rebase of conduct-check's planning rows
(`rebase`, before any work starts) is unchanged. So are `deliver-check.mjs` and its `RELEASE_FILE`
list, the `guard.mjs` force-push rule, the `commit-and-pr` agent of devkit-core and the panel's
step labels (the panel still labels `push-rebased`, which an older installed devkit-openspec can
still send). Fetching the base before the conflict is judged is roadmap line `fresh-base-check`, and
counting the CI pin as a release file in the archive check is `archive-release-pin`. Neither is
widened into this change.

## Acceptance criteria

- AC-1 `release-only-conflict-merges` — When a change PR or an archive PR conflicts with `origin/<base>` only in release files, the loop's next action is the release-conflict step, not an end blocked with a pull-request problem; its command merges `origin/<base>` into the branch, so the new `HEAD` is a merge commit whose parents are the old head and `origin/<base>`, and the PR's head stays an ancestor of `HEAD`.
- AC-2 `plain-push-after-merge` — After the step, the push the loop hands is a plain `git push` with no `--force` and no `--force-with-lease`; no step, row, skill line or doc line of the delivery loop names a rebase or a force push any more, and the `push-rebased` step no longer exists.
- AC-3 `renumber-above-base` — After the step, each pack the change bumped carries the base's version plus the change's own bump kind in its `plugin.json` and in `.claude-plugin/marketplace.json`, the change's `CHANGELOG.md` entry sits above the base's newest entry with that number, every pin in `docs/openspec-flow.md` names the resolved devkit-openspec version, and `docs/catalog.md` matches `python3 scripts/gen-catalog.py --check`.
- AC-4 `pin-test-reads-manifest` — The CI-pin assertion in `plugins/openspec/hooks/change-loop.test.mjs` holds no literal release number: it passes when the pins in `docs/openspec-flow.md` equal the `version` of `plugins/openspec/.claude-plugin/plugin.json` and fails when one pin differs; a release bump edits no line of that test.
- AC-5 `other-conflicts-stay-blocked` — A conflict in any path that is not a release file still ends the run blocked, naming the paths; a merge that cannot be resolved leaves the branch at its old head with no merge in progress and the working tree as it was.
- AC-6 `scratch-repo-proof` — A test builds a scratch repository with a bare remote, a base that released after the branch forked and a branch with its own release: the step's command resolves the conflict by a merge, the renumbered files are as AC-3 says, and a plain `git push` of the result to the bare remote is accepted.
- AC-7 `docs-follow` — `docs/openspec-flow.md` and `plugins/openspec/skills/devkit/SKILL.md` describe the release-conflict step as a merge of the base followed by a plain push.
- AC-8 `dogfood-owed` — `openspec/roadmap.md` gains a follow-up line for the live check: the next change whose PR falls behind another release, with this release installed, has its release conflict resolved by the loop alone.

AC-8's live check runs in a later change. This change proves AC-1 to AC-6 with scratch-repository
tests and AC-7 with document tests (requirements, question 3).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-coordination`: the requirement "From the implementation on, the step inside the stage goes
  to its role" loses the rebased-branch override and its `push-rebased` scenario. Its release-conflict
  scenario now names the merge, and a new scenario covers a release merge that is not pushed yet.
  One ADDED requirement states how the release-conflict step resolves a release-only conflict by a
  merge of the base: the renumbering, the committed merge, the abort that restores, and no push.

## Impact

- devkit-openspec (0.21.1 to 0.22.0), hooks: `release-rebase.mjs` renamed `release-merge.mjs` (merge
  mode in place of the rebase), `conduct-check.mjs` (override 2 removed; the release-conflict
  override gains the not-pushed branch and the "not in local history" stop; the actor map loses
  `push-rebased`), `change-loop.mjs` (its
  `push-rebased` row removed); tests in `release-merge.test.mjs` (renamed), `conduct-check.test.mjs`,
  `change-loop.test.mjs` and the import line of `guard.test.mjs`.
- devkit-openspec, skills: `skills/devkit/SKILL.md` (the release-conflict line describes the merge
  and the plain push; the `push-rebased` line and its mention in the roadmap part go).
- Docs: `docs/openspec-flow.md` (delivery overrides, the release-conflict section, the CI pins to
  `v0.22.0`), `plugins/openspec/README.md` (the tool's row), `CONTRIBUTING.md` (the line about a
  change brought up to a base that merged a sibling), `CHANGELOG.md`, `openspec/roadmap.md`.
- The `devkit-reviews` check: unaffected. `deliver-check.mjs`, `guard.mjs` and `merge-setup.mjs`, the
  three files a project's workflow downloads, do not change.
- Surfaces: hooks, one skill and docs of devkit-openspec. No panel, core, backend, frontend or
  worker surface.

**Exit criteria.** The gates of `tasks.md`: the release-merge suite, then the conduct-check and
change-loop suites, under `GITHUB_HEAD_REF`/`GITHUB_BASE_REF` with `--test-concurrency=1` and a
private `TMPDIR`; then the whole hook suite (`node --test plugins/openspec/hooks/guard.test.mjs`),
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`
and `openspec validate release-merge-conflict --strict`.

**Dependencies.** `merge-staleness-first-parent` (archived, on `origin/main`): its first-parent rule
decides which reviews a merge stales. The archive of `review-writer-prompt` (#59, on `origin/main`,
devkit-openspec 0.21.1): this branch merges it first (tasks 1.1).

**Decisions cited.** ADR 0002 ("Strict up-to-date re-runs stale reviews after each base update",
accepted cost); ADR 0003 (the release files an archive PR may change without a proposal; a merge of
the base leaves that list as it is); ADR 0011 decision 2 (the release files are written by the
implementer's hand-off, never by the coordinating session); ADR 0012 decision 4 (the
`devkit-reviews` check still recomputes reviews at the PR head). No new ADR is needed (`design.md`,
"Decisions and ADRs").

**Open decisions inherited.** None. No point of `docs/coordination-design.md` ("Open points") is
touched.
