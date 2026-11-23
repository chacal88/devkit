<!-- devkit-stage proposal result=passed attempt=1 commit=4f4b7e201aabdebdb65b11f7ce80154463a524e9 -->
# Proposal

Change: `release-tags` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, with the owner's four answers, and `decisions.md`, which proposes
[ADR 0019](../../../docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md)).

## Why

`openspec-setup` pins a project's CI and vendored schemas to the commit of the tag
`v<devkit-openspec version>` (ADR 0002), but nothing in the delivery loop creates that tag:
CONTRIBUTING.md step 5 leaves it as a by-hand step after the merge, and seven releases between
v0.21.0 and v0.28.0 merged without it until they were pushed by hand on 2026-11-23. A project set
up after an untagged release cannot pin it. The loop already sees every merge; it should own the tag.

## What Changes

- A new optional key `devkit.release_tag` in `openspec/config.yaml` names the release file: a path
  from the repository root to a JSON file with a top-level `"version"` string. Without the key
  nothing changes. A value that is not such a path is refused by `/devkit change` with the existing
  settings reply (`setting-unknown`) and by `deliver-check` after the merge (configuration error,
  exit 3).
- After a merge into the default branch, the delivery checker compares the release file's
  `version` at the merge commit with the one at its first parent, reading both, the merge commit
  and the tag `v<version>` from GitHub through `gh`. A changed version with no tag on `origin`
  gives the new step `tag-release` (the tag, the merge commit sha, the pull request number): before
  `retro` for the change's own pull request, before `archived` for its archive pull request
  (`chore/archive-<id>`). In `two-prs` only merges into the base branch count.
- A tag already at the merge commit is the step done; a tag at another commit stops the run
  (`stop-archive`, `archiveStep: tag-release`) naming the tag, its commit and the merge commit; a
  fact GitHub does not answer stops the same way with the "cannot read ... on GitHub" reason. The
  loop never moves, deletes or force-pushes a tag.
- `change-loop.mjs` turns `tag-release` into a session step of the delivery stage, and a tag at
  another commit into a blocked end with its own reason (`tag-elsewhere`) naming the tag and both
  commits. `conduct-check.mjs` maps the step to the main session.
- `ship-change` gains the `tag-release` row: fetch the base, create the lightweight tag on the
  named sha, push only that tag, never with force; a refused push stops the run with git's
  refusal; the report names each tag pushed. The `devkit` skill says how a refused push ends a
  `/devkit change` run.
- This repository sets `devkit.release_tag: plugins/openspec/.claude-plugin/plugin.json`, lists
  ADR 0019 in its `context:`, and documents the key and the step in CONTRIBUTING.md step 5 and
  `docs/openspec-flow.md`; the by-hand commands stay for a release made outside the loop.
- Release: devkit-openspec 0.28.0 → 0.29.0, marketplace 0.32.0 → 0.33.0 (re-read on `origin/main`
  before the release task), a CHANGELOG entry, and the CI snippet pin moved to `v0.29.0`.

Non-goals: tags for releases before v0.13.0, annotated or signed tags, GitHub Releases, tags for
packs the release file does not name, moving or deleting a tag, a change in the CompozyOS driver
(`devkit-compozy`, which follows `ship-change`'s rows), `plan` ship mode (it never reaches the
post-merge rows), `openspec-setup` asking for the key, and a panel label for the new step (the
panel shows an unknown step by its id).

## Acceptance criteria

- AC-1 `tag-after-change-merge`: with `release_tag` set, after the change's PR merges with a commit whose release file version differs from its first parent's, and no tag `v<version>` exists on `origin`, `deliver-check` answers the step `tag-release` naming the tag and the merge commit sha before `retro`, and `change-loop.mjs next` turns it into a session action of the delivery stage. A test shows it.
- AC-2 `tag-after-archive-merge`: with `release_tag` set, after the archive PR merges with a version bump and the tag is missing, the answer is `tag-release` for that merge commit instead of `archived`. A test shows it.
- AC-3 `no-tag-when-unchanged`: a merge whose release file version equals its first parent's, a tag already on `origin` at that merge commit, or a project without `release_tag`, gives no `tag-release` step: the loop answers what it answers today. Tests show each case.
- AC-4 `tag-on-other-commit-stops`: a tag `v<version>` on `origin` at a different commit than the merge stops the run blocked, naming the tag, its commit and the merge commit. A test shows it.
- AC-5 `tag-unreadable-stops`: when GitHub cannot answer one of the facts the tag step needs, the run stops as the existing unreadable stop, never skipping the tag. A test shows it.
- AC-6 `ship-change-runs-the-step`: `plugins/openspec/skills/ship-change/SKILL.md` has a row for `tag-release` that creates the lightweight tag on the named sha and pushes it, then runs the loop again; CONTRIBUTING.md step 5 and `docs/openspec-flow.md` describe the key and the step.
- AC-7 `devkit-sets-the-key`: this repository's `openspec/config.yaml` sets `release_tag: plugins/openspec/.claude-plugin/plugin.json`.

## Capabilities

### New Capabilities

- `release-tags`: when a merge into the default branch brought a new release version, how the
  delivery checker reads that from GitHub, when it asks for the tag step, when it stops instead,
  and how the session creates and pushes the tag.

### Modified Capabilities

- `change-coordination`: the loop's handling of the release tag (requirements added, none
  changed): the setting that cannot be used stops `/devkit change`, `tag-release` is a session step
  of the delivery stage, and a tag at another commit ends the run blocked with its own reason.

## Impact

- Hooks (`plugins/openspec/hooks/`): `guard.mjs` (`parseDevkitBlock` reads `release_tag`, a new
  `releaseTagSetting`), `deliver-check.mjs` (the tag facts, the rows, the human line),
  `change-loop.mjs` (settings, `ROWS`, the blocked reason, two message keys per language),
  `conduct-check.mjs` (one actor entry). No new module and no new import: `deliver-check.mjs`,
  `guard.mjs` and `merge-setup.mjs` stay the three files a project's CI downloads.
- Skills: `plugins/openspec/skills/ship-change/SKILL.md` (row, report, never-list),
  `plugins/openspec/skills/devkit/SKILL.md` (one sentence).
- Tests: a new suite `plugins/openspec/hooks/release-tags.test.mjs` (imported by `guard.test.mjs`);
  named edits in `deliver-check.test.mjs`, `change-loop.test.mjs`, `roadmap-loop.test.mjs`,
  `conduct-check.test.mjs` (`design.md`, D-9).
- Docs and config: `CONTRIBUTING.md` step 5, `docs/openspec-flow.md`, `openspec/config.yaml`,
  `CHANGELOG.md`, `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`.
- GitHub: up to six read-only `gh api` calls per merged pull request per post-merge run, only with
  the key set; the session pushes one ref under `refs/tags/` per release. No CI workflow changes.
- Dependencies: ADR 0019 (proposed in `decisions.md`, accepted at plan approval). Decisions cited:
  ADR 0002, 0003, 0004, 0010, 0018. No open-decisions log exists in this repository.
