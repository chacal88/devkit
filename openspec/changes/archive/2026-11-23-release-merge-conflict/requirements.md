<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> when a change's pull request conflicts with its base only in release files (the two manifests, `CHANGELOG.md`, the CI pin and its pin assertion), the delivery loop hands a declared step that merges `origin/<base>` (never a rebase or force-push, which the desktop Auto-fix forbids) and renumbers the release above the base's, in place of ending the run blocked with a pull-request problem; and `release-rebase.mjs` gains that merge mode or the loop's release step stops naming it (merge-staleness-first-parent retro, item 1)

## Requirements grill: release-merge-conflict

Classification: domain=process type=feature flags=[contract] (confirmed: the step names and rows that `change-loop.mjs`, `conduct-check.mjs`, `roadmap-loop.mjs` and the `devkit` skill share change)

Live evidence: PR #51 (merge-staleness-first-parent) ended the run blocked ("the pull request has a problem") when PR #47 released devkit-openspec 0.19.0 first. Today `plugins/openspec/hooks/conduct-check.mjs#releaseConflict` classifies the conflict with `RELEASE_FILE` from `plugins/openspec/hooks/deliver-check.mjs`, so the pin assertion in `plugins/openspec/hooks/change-loop.test.mjs` counts as a blocking path; and the step's tool, `plugins/openspec/hooks/release-rebase.mjs`, rebases, which makes the next step `push-rebased` (`git push --force-with-lease`). The desktop Auto-fix forbids both.

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The rebase path leaves entirely (owner, question 1): the release-conflict step merges `origin/<base>` into the branch, and the `push-rebased` step, the rebase in `plugins/openspec/hooks/release-rebase.mjs` and every row, doc line and skill line that names them are removed. Whether the tool keeps its file name or is renamed is the planner's.
- The CI-pin assertion in `plugins/openspec/hooks/change-loop.test.mjs` stops naming a literal release number (owner, question 2): it checks that every pin in `docs/openspec-flow.md` equals the `version` of `plugins/openspec/.claude-plugin/plugin.json`. Its invariant stays the same ("the CI snippet pins the current devkit-openspec release"); the suite stays `change-loop.test.mjs`. The slice-merge floor sentence ("moves this pin to `v0.20.0` or later first") stays checked as it is.
- The release files stay the ones `docs/openspec-flow.md` lists today: `plugins/*/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`, and the CI pin in `docs/openspec-flow.md` when its only conflict is the pin. With the pin assertion reading the manifest, no test file needs to join that list.
- The renumbering rule stays the one `release-rebase.mjs#resolveVersion` applies today: each pack the change bumped gets the base's version plus the change's own bump kind; the change's `CHANGELOG.md` entry goes above the base's newest one with that number; every pin in `docs/openspec-flow.md` becomes the resolved devkit-openspec version; `docs/catalog.md` is regenerated with `scripts/gen-catalog.py` when a manifest changed.
- The step covers both places it covers today: the change PR (deliver-check item 5) and the archive PR.
- After the merge, evidence and reviews follow the staleness rule already in place (merge-staleness-first-parent): stale when the merge brought product code into the branch, so the loop runs the evidence and then the review round again.
- A clean merge that GitHub still reports as conflicting keeps today's `update-branch` step, unchanged.
- The step's subagent and its sentence in the `devkit` skill stay the same shape: `devkit-core:tdd-implementer` runs the step's command in the worktree, then the project's test command, and stops on red; the commit and the push go to `devkit-core:commit-and-pr` as a plain push.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `release-only-conflict-merges` — When a change PR or an archive PR conflicts with `origin/<base>` only in release files, the loop's next action is the release-conflict step, not an end blocked with a pull-request problem; its command merges `origin/<base>` into the branch, so the new `HEAD` is a merge commit whose parents are the old head and `origin/<base>`, and the PR's head stays an ancestor of `HEAD`.
- AC-2 `plain-push-after-merge` — After the step, the push the loop hands is a plain `git push` with no `--force` and no `--force-with-lease`; no step, row, skill line or doc line of the delivery loop names a rebase or a force push any more, and the `push-rebased` step no longer exists.
- AC-3 `renumber-above-base` — After the step, each pack the change bumped carries the base's version plus the change's own bump kind in its `plugin.json` and in `.claude-plugin/marketplace.json`, the change's `CHANGELOG.md` entry sits above the base's newest entry with that number, every pin in `docs/openspec-flow.md` names the resolved devkit-openspec version, and `docs/catalog.md` matches `python3 scripts/gen-catalog.py --check`.
- AC-4 `pin-test-reads-manifest` — The CI-pin assertion in `plugins/openspec/hooks/change-loop.test.mjs` holds no literal release number: it passes when the pins in `docs/openspec-flow.md` equal the `version` of `plugins/openspec/.claude-plugin/plugin.json` and fails when one pin differs; a release bump edits no line of that test.
- AC-5 `other-conflicts-stay-blocked` — A conflict in any path that is not a release file still ends the run blocked, naming the paths; a merge that cannot be resolved leaves the branch at its old head with no merge in progress and the working tree as it was.
- AC-6 `scratch-repo-proof` — A test builds a scratch repository with a bare remote, a base that released after the branch forked and a branch with its own release: the step's command resolves the conflict by a merge, the renumbered files are as AC-3 says, and a plain `git push` of the result to the bare remote is accepted.
- AC-7 `docs-follow` — `docs/openspec-flow.md` and `plugins/openspec/skills/devkit/SKILL.md` describe the release-conflict step as a merge of the base followed by a plain push.
- AC-8 `dogfood-owed` — `openspec/roadmap.md` gains a follow-up line for the live check: the next change whose PR falls behind another release, with this release installed, has its release conflict resolved by the loop alone.

## Questions asked

1. [scope] When the PR conflicts only in release files, does the rebase + force-push path leave or stay as an option? → It leaves entirely: merge only, renumber above the base, plain push.
2. [scope] The pin assertion in `change-loop.test.mjs` is edited by hand on every release and conflicts between changes: should the loop renumber it, or should the test read the version? → The test reads the version from the devkit-openspec manifest; no change edits that line again.
3. [end effect] The hooks run from the installed plugin, so this change's own PR is fixed by hand: how is it proven? → A scratch-repository test here with a real merge and an accepted plain push, plus a roadmap line for the live check on the next change behind a release.

## Escalations

- None. No ADR names the rebase or the force push (`docs/adr/` searched); ADR 0002 already accepts the re-run of stale reviews.

## Out of scope

- Conflicts in product code or in any file outside the release files: they stay blocked for the owner.
- A lighter evidence or review path after a merge that brought product code: the staleness rule of merge-staleness-first-parent stands.
- Resolving this change's own release collision with `stage-roles` and `delivery-models`: done by hand at this change's release step.
