<!-- devkit-stage requirements result=passed attempt=1 commit=4f4b7e201aabdebdb65b11f7ce80154463a524e9 -->
# Requirements

## Request

From the coordinator session (2026-11-23): CONTRIBUTING.md step 5 says every release that changes devkit-openspec's version gets a lightweight `v<version>` tag on its merge commit on `main`, because `openspec-setup` pins projects' CI and vendored schemas to that tag's commit (ADR 0002). Several releases merged without their tag (v0.21.0, v0.21.1, v0.22.0, v0.22.1, v0.25.0, v0.26.0, v0.28.0, pushed by hand on 2026-11-23 with the owner's go-ahead). Nothing in `plugins/openspec/hooks/change-loop.mjs`, `deliver-check.mjs` or `skills/ship-change/SKILL.md` creates the tag. Make the delivery loop own it: a step after the change PR merges, when devkit-openspec's version changed, that tags the merge commit and pushes the tag. Done means a test shows the loop asks for the tag step after a merge that bumps devkit-openspec.

Classification: domain=process type=feature flags=[contract] (confirmed: a new `devkit:` key and a new delivery-checker step that `change-loop.mjs` and `ship-change` consume).

## Assumptions

- The project names its release version in a new key of the `devkit:` block of `openspec/config.yaml`: `release_tag: <path from the repository root to a JSON file with a top-level "version" string>`. This repository sets `release_tag: plugins/openspec/.claude-plugin/plugin.json`. A project without the key never gets the tag step (owner, question 1).
- The tag name is `v` followed by that `version` value, a lightweight tag (no annotation), as CONTRIBUTING.md step 5 states.
- A merge "bumps the version" when the `version` in the release file at the merge commit differs from the one at the merge commit's first parent. The file absent at the first parent and present at the merge counts as a bump; absent at the merge commit is no bump.
- Two merges are checked (owner, question 2): the change's own pull request and its archive pull request (`chore/archive-<id>`). Each one whose merge bumped the version needs its tag before the loop moves past it; the archive PR's is checked before the run ends as `archived`.
- In the `two-prs` delivery model only merges into the default branch (the base) count; the test branch's merges never get a tag.
- The tag step is a session step, not an owner stop (owner, question 3): with `release_tag` set, the session runs `git tag v<x> <merge sha>` and `git push origin v<x>` itself; the report names the tag pushed.
- A tag `v<x>` already on `origin` at the merge commit is the step done. A tag `v<x>` already on `origin` at another commit stops the run blocked with both shas in the reason; the loop never moves, deletes or force-pushes a tag (owner, question 4).
- The facts (the merge commit, its first parent, the release file at each, the tag on `origin`) are read through `gh` like the delivery checker's other GitHub facts; GitHub that cannot be read is the existing unreadable stop, never a pass.
- CONTRIBUTING.md step 5 and `docs/openspec-flow.md` say the loop now does the tag when `release_tag` is set; the by-hand commands stay documented for a release made outside the loop.

## Acceptance criteria

- AC-1 `tag-after-change-merge`: with `release_tag` set, after the change's PR merges with a commit whose release file version differs from its first parent's, and no tag `v<version>` exists on `origin`, `deliver-check` answers the step `tag-release` naming the tag and the merge commit sha before `retro`, and `change-loop.mjs next` turns it into a session action of the delivery stage. A test shows it.
- AC-2 `tag-after-archive-merge`: with `release_tag` set, after the archive PR merges with a version bump and the tag is missing, the answer is `tag-release` for that merge commit instead of `archived`. A test shows it.
- AC-3 `no-tag-when-unchanged`: a merge whose release file version equals its first parent's, a tag already on `origin` at that merge commit, or a project without `release_tag`, gives no `tag-release` step: the loop answers what it answers today. Tests show each case.
- AC-4 `tag-on-other-commit-stops`: a tag `v<version>` on `origin` at a different commit than the merge stops the run blocked, naming the tag, its commit and the merge commit. A test shows it.
- AC-5 `tag-unreadable-stops`: when GitHub cannot answer one of the facts the tag step needs, the run stops as the existing unreadable stop, never skipping the tag. A test shows it.
- AC-6 `ship-change-runs-the-step`: `plugins/openspec/skills/ship-change/SKILL.md` has a row for `tag-release` that creates the lightweight tag on the named sha and pushes it, then runs the loop again; CONTRIBUTING.md step 5 and `docs/openspec-flow.md` describe the key and the step.
- AC-7 `devkit-sets-the-key`: this repository's `openspec/config.yaml` sets `release_tag: plugins/openspec/.claude-plugin/plugin.json`.

## Out of scope

- Tags for releases before v0.13.0 (v0.3.0, v0.4.0, v0.7.0, v0.7.1, v0.9.0 to v0.12.0): the owner chose not to backfill them.
- Annotated or signed tags, GitHub Releases, release notes.
- Tags for packs other than the one the release file names.
- Moving or deleting an existing tag.
- The CompozyOS driver (`devkit-compozy`): it reads the same delivery checker; no change of its own.
