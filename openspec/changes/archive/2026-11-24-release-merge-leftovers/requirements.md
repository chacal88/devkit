<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> `openspec/specs/commit-attribution/spec.md` drops the scenario that hands `push-rebased` and its mention in the devkit skill's rows, the panel's step vocabulary (`plugins/panel/hooks/steps.ts`, `plugins/panel/hooks/i18n.ts`) drops the label, and a conduct-check test runs the release-merge override under a two-PR delivery-model config (release-merge-conflict retro, items 1)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Classification: domain=process, type=cleanup (removal of leftovers) plus one new test; no product behaviour changes (the `push-rebased` step is already gone from `plugins/openspec/hooks/change-loop.mjs`, `conduct-check.mjs` and the `devkit` skill, as the test `release-merge-conflict 16` pins). The short script `devkit-lite` stays.
- `openspec/specs/commit-attribution/spec.md`: the scenario `A branch the loop's own rebase rewrote` (the one that hands `push-rebased` to the commit agent) is removed, and the scenario `Every dispatch of the commit agent names the block` stops listing "the devkit skill's `agent` items and `push-rebased` item" (it keeps the `agent` items). The skill itself holds no `push-rebased` text any more, so nothing in `plugins/openspec/skills/` changes.
- `openspec/specs/change-coordination/spec.md` keeps its scenario `No step pushes by force` (it says no step is `push-rebased`): it is the guard that the step stays gone, not a leftover.
- `plugins/panel/hooks/steps.ts` (the `pr` group), `plugins/panel/hooks/i18n.ts` (the `push-rebased` label pair) and the list `ACTOR_STEPS` in `plugins/panel/hooks/report.test.tsx` drop `push-rebased`; a step id the panel does not know already falls back to its id, so no other panel behaviour changes.
- The new conduct-check test lives in `plugins/openspec/hooks/conduct-check.test.mjs`, reuses its `conflictRepo` fixture and the `TWO_PRS` config exported by `plugins/openspec/hooks/delivery-models.test.mjs` (`model: two-prs`, `base: main`, `test_branch: develop`). It proves the release-merge override (`releaseConflict` in `conduct-check.mjs`) answers `resolve-release-conflict` for a change PR that conflicts only in release files, with the merge command on the base branch (`main`, never the test branch), and that a conflict in any other file still ends `blocked`.
- Historic text stays as it is: `CHANGELOG.md` (0.33.0 entry) and `openspec/changes/archive/**` name `push-rebased` as history.
- If the new test shows the override does not fire under `two-prs`, that is a defect of the override, not a leftover: this change stops and reports it to the owner instead of fixing it here.
- Release: a spec, a panel and a test edit. The plan decides the version bumps from `CONTRIBUTING.md` (panel pack patch; `devkit-openspec` only if a shipped file changes).

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: `openspec/specs/commit-attribution/spec.md` holds no `push-rebased` and no scenario that hands a rewritten branch to the commit agent; the scenario on every dispatch of the commit agent still names the shipping skill's rows and the devkit skill's `agent` items.
- AC-2: `plugins/panel/hooks/steps.ts`, `plugins/panel/hooks/i18n.ts` and `plugins/panel/hooks/report.test.tsx` hold no `push-rebased`, and the panel's own suite passes with the label table and the step table still agreeing.
- AC-3: with `openspec/config.yaml` set to the two-PR delivery model, a change PR that conflicts only in `CHANGELOG.md` and the manifests makes conduct-check answer `resolve-release-conflict` with the paths and a command ending in `--base main`; a conflict in `README.md` as well makes it answer `blocked`.
- AC-4: no behaviour changes: the release step, the override and the delivery checker answer every input as before, and the other suites keep their results.

## Out of scope

- Any change to how the release step, the override or the delivery checker work.
- Rewriting `CHANGELOG.md` history or archived changes.
- The attempt counting of the evidence stage (`evidence-attempts-by-failure`) and the live check (`release-merge-live-check`), which have their own roadmap lines.
