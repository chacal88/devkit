<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> One change for three roadmap lines that all cut the time a change loses when the default branch moves, asked by the owner on 2026-11-23 after a day where every merge of main made the other changes redo their evidence and reviews ("nao e possivel demorar tanto"). Tick all three lines in openspec/roadmap.md when this change is archived.
>
> stale-only-on-own-files: a merge of the default branch that changes none of a change's files (outside its release files) leaves its evidence and reviews current, so a busy `main` does not cost a whole suite and a review per merge (change-state retro, learning 3)
>
> fresh-base-check: the delivery loop fetches origin/<base> before it judges a pull request's conflict or decides update-branch, so a step never says the base merges cleanly from a stale copy (review-writer-prompt retro, item 3)
>
> post-merge-validate: after a merge from the base, the delivery loop runs `openspec validate <id> --strict` before the evidence and sends a failure to the planner as a merge defect, and an evidence attempt that a base merge made stale or red does not count toward the stage's limit; in stage-roles a merge from main left the roadmap-coordination delta without main's new scenario, and the evidence's third attempt hit the limit (stage-roles retro, item 3)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Q1 (answered by the coordinating session under the owner's delegation, 2026-11-23): "the change's own files" are the paths the branch itself changed against the base (`git diff origin/<base>...HEAD`, product files and tests) plus `openspec/changes/<id>/`; release files are left out. A merge of the base that touches none of those paths leaves the recorded evidence and reviews current.
- Accepted risk of Q1: the base can change a file the change depends on without touching any of the change's own files. The backstop is the pull request's required `check` CI, which runs the suite on the merged ref anyway.

- Q2 (answered by the coordinating session under the owner's delegation, 2026-11-23): "release files" are `RELEASE_FILE` of `plugins/openspec/hooks/deliver-check.mjs` as it is (the plugin manifests, `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`). The CI pin and its assertion stay with `archive-release-pin` / `release-pin-is-a-release-file`; this change picks them up when that list grows.
- Settled from the code (no owner question needed): evidence.md and every reviews/*.md go through the same `staleness()`, and `deliver-check --ci` (the `devkit-reviews` check) shares `readReviews`, so one rule covers the local loop, evidence, reviews and CI. The exemption applies only to a merge commit's first-parent diff (what the base brought in); a plain commit on the branch is judged as today. Per-reviewer allowances (`verdictAllowed`: openspec-only, test-spared reviewers, rejected verdicts) stay as they are.
- When `origin/<base>` is not available locally, no exemption is given: the verdict is "stale" as today, the safe side. Fetching the base before judging is the `fresh-base-check` line, not this one.
- Design detail left to the plan, from the code: the branch's own set is computed so that a base left unfetched makes more commits count as the branch's own (more stale), never fewer.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1: On a scratch repository, after evidence.md and the reviews are recorded at a commit, a merge of `origin/<base>` that brings only paths outside the change's own files (not in `git diff origin/<base>...HEAD`, not under `openspec/changes/<id>/`) leaves evidence.md and every review current: `deliver-check` reports no `verify` and no `review` step because of that merge.
- AC-2: On the same scratch repository, a merge that brings a path the branch itself changed (a product file or a test file) makes evidence.md and the reviews stale, and the reason names the merge commit and that path.
- AC-3: A merge that brings both an unrelated path and one of the change's own paths is stale (one own path is enough), and the reason names the own path.
- AC-4: A merge that brings only release files (`RELEASE_FILE`), the ones the branch itself bumped included, leaves evidence.md and the reviews current.
- AC-5: A plain, non-merge commit on the branch that touches a path outside `openspec/` still makes the recorded evidence and reviews stale, as before this change.
- AC-6: The per-reviewer rules are unchanged: a rejected verdict, the test-spared reviewers and the openspec-only allowance behave as before, each with its existing test still green.
- AC-7: With `origin/<base>` missing, no merge is exempted and the verdict is the one given before this change.
- AC-8: `deliver-check --ci` (the `devkit-reviews` check) applies the same rule: after a merge that brings only unrelated paths, the check still passes on the recorded reviews; after a merge that brings an own path, it reports them stale.
- AC-9: `docs/openspec-flow.md` states the rule: which merges leave evidence and reviews current, which do not, and that CI's `check` is the backstop for the base changing something the change depends on.
- AC-10: Real-run proof covers every case above (AC-1 to AC-5 and AC-7, AC-8) on a scratch repository with an `origin`, not one case plus prose.

## Out of scope

- `delivery-train` and `delivery-merge-hold`: the train batches deliveries into one train, and the hold stops the roadmap coordinator from merging another change that touches the same packs. This change schedules and orders no merge; it only decides whether a recorded evidence or review is still current after the base was merged in.
- A dependency closure (files the change's files import) as part of "own files": rejected in Q1.
- A per-project setting for the release-file list: rejected in Q2.
- Narrowing which reviewers a merge makes stale by their area: every reviewer follows the same own-files rule.
- Changing the stopgap practice (merge main right before the last gate): it stays as the coordinator's rule; this change makes it less necessary.
- `fresh-base-check` and `post-merge-validate`: the coordinating session moved each of them to a change of its own, with its own session, on 2026-11-23 (one change per roadmap line). This change delivers the `stale-only-on-own-files` line only, and only that line is ticked in `openspec/roadmap.md` at archive. 
