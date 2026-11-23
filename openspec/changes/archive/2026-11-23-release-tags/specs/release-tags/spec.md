<!-- devkit-stage specs result=passed attempt=1 commit=4f4b7e201aabdebdb65b11f7ce80154463a524e9 -->
# Spec Delta

## Purpose

Says when the delivery loop tags the release that a merge into the default branch brought, how it
reads that fact from GitHub, when it stops instead of tagging, and how the session creates and
pushes the tag.

## ADDED Requirements

### Requirement: A project opts in by naming its release file
The delivery checker SHALL ask for a release tag only when the `devkit:` block of the project's
`openspec/config.yaml` sets `release_tag` to a path from the repository root to a JSON file. With
the key absent or empty it SHALL make no GitHub read for the tag and answer exactly what it
answered before this change.

#### Scenario: No key
- **WHEN** the project's `devkit:` block has no `release_tag` and the change's pull request has merged
- **THEN** `deliver-check.mjs <id>` answers the same step as before this change and makes no `gh api` call to a pull request, a commit, the release file or a tag ref

#### Scenario: The key under another map
- **WHEN** `release_tag: package.json` is written under `devkit.delivery:` instead of directly under `devkit:`
- **THEN** it is not the setting, and no tag step is asked

#### Scenario: A value that is not a path to a JSON file
- **WHEN** `release_tag` is `/abs/plugin.json`, `../plugin.json`, `plugins/plugin.yaml` or `[a.json]`
- **THEN** `deliver-check.mjs <id>` after the merge exits 3 with a configuration error naming `devkit.release_tag` and the value

### Requirement: A merge bumps the release when the release file's version changed
A merge SHALL bump the release when the top-level `version` string of the release file at the
merge commit differs from the one at the merge commit's first parent. A file absent at the parent,
or with no readable `version` there, SHALL count as no version; a file absent at the merge commit
SHALL be no bump.

#### Scenario: The version changed
- **WHEN** the release file reads `"version": "1.3.0"` at the merge commit and `"version": "1.2.0"` at its first parent
- **THEN** the merge bumps the release to `1.3.0` and the tag is `v1.3.0`

#### Scenario: The version is the same
- **WHEN** the release file reads `"version": "1.2.0"` at both commits
- **THEN** the merge bumps nothing and no tag step is asked

#### Scenario: The file is new
- **WHEN** the release file is absent at the first parent and reads `"version": "0.1.0"` at the merge commit
- **THEN** the merge bumps the release to `0.1.0`

#### Scenario: The file is gone
- **WHEN** the release file is absent at the merge commit
- **THEN** the merge bumps nothing and no tag step is asked

#### Scenario: A release file the merge left unreadable
- **WHEN** the release file at the merge commit is not JSON, has no top-level `version` string, or holds a version a tag name cannot carry
- **THEN** the delivery stops with `stop-archive`, `archiveStep: tag-release`, and a reason naming the file and the merge commit; it never skips the tag

### Requirement: The change's merge is tagged before the retro
After the change's own pull request merged into the default branch with a bump and no tag
`v<version>` on `origin`, the delivery checker SHALL answer the step `tag-release` before every
other post-merge step, the retro included, naming the tag, the full merge commit sha, the pull
request number, the version, the release file and the base branch.

#### Scenario: The change's pull request bumped the release
- **WHEN** pull request #12 of `feat` merged into `main` with merge commit `a1…` whose release file reads `1.3.0`, its first parent reads `1.2.0`, and `origin` has no `v1.3.0`
- **THEN** `deliver-check.mjs feat --json` answers `next.step` `tag-release` with `tag` `v1.3.0`, `sha` the full sha `a1…`, `number` 12, `merged` `change`, `version` `1.3.0`, `file` the release file and `base` `main`, and no `retro.md` exists yet

#### Scenario: The human line
- **WHEN** the same run prints its human report
- **THEN** its last line reads `next: tag-release v1.3.0 at <the first 7 characters of the sha> (PR #12)`

#### Scenario: Asked again until the tag is there
- **WHEN** the retro was already written but `origin` still has no `v1.3.0`
- **THEN** the answer is still `tag-release` for pull request #12, never a later archive step

### Requirement: The archive merge is tagged before the change counts as archived
After the change's archive pull request (`chore/archive-<id>`) merged into the default branch with
a bump and no tag `v<version>` on `origin`, the delivery checker SHALL answer `tag-release` for that
merge commit instead of `archived`, with `merged` set to `archive`.

#### Scenario: The archive pull request bumped the release
- **WHEN** the default branch holds `openspec/changes/archive/2026-11-23-feat/`, archive pull request #13 merged with a release file reading `1.3.1` against `1.3.0` at its first parent, and `origin` has no `v1.3.1`
- **THEN** `deliver-check.mjs feat --json` answers `tag-release` with `tag` `v1.3.1`, `number` 13 and `merged` `archive`, and its summary is not `archived`

#### Scenario: Both merges bumped the release
- **WHEN** both the change's and the archive's merges bumped the release and neither tag is on `origin`
- **THEN** the change's tag is asked first, and the archive's once the change's is on `origin`

#### Scenario: The archive pull request bumped nothing
- **WHEN** the archive pull request merged with the release file unchanged and the change's tag is on `origin` at its merge commit
- **THEN** the answer is `archived`, as before this change

### Requirement: Only merges into the default branch are tagged
The delivery checker SHALL ask for a tag only for a pull request whose base branch is the
repository's default branch. In the `two-prs` model the merges into the test branch, the
test-branch archive pull request included, SHALL never be tagged.

#### Scenario: A pull request to the test branch
- **WHEN** in `two-prs` the release-bumping commit merged into `develop` (the test branch) and into `main` (the base)
- **THEN** only the merge commit on `main` is named by `tag-release`

#### Scenario: A pull request whose base is not the default branch
- **WHEN** GitHub reports the pull request's base branch as another branch than the default one
- **THEN** no tag step is asked for it

### Requirement: A tag already at the merge commit is the step done
A tag `v<version>` on `origin` that points at the merge commit SHALL be the step done, whether it is
lightweight or annotated (an annotated tag is read through the commit it points at).

#### Scenario: The lightweight tag is there
- **WHEN** `origin` has `refs/tags/v1.3.0` pointing at the merge commit
- **THEN** no tag step is asked and the next step is what it was before this change

#### Scenario: An annotated tag at the merge commit
- **WHEN** `refs/tags/v1.3.0` names a tag object whose target is the merge commit
- **THEN** no tag step is asked

### Requirement: A tag at another commit stops the delivery
A tag `v<version>` on `origin` that points at another commit than the merge commit SHALL stop the
delivery with `stop-archive`, `archiveStep: tag-release`, naming the tag, the commit it points at
and the merge commit. The loop SHALL never move, delete or force-push a tag.

#### Scenario: The tag was pushed by hand before the merge
- **WHEN** `origin` has `v1.3.0` at `d4…` and the merge commit is `a1…`
- **THEN** `deliver-check.mjs feat --json` answers `stop-archive` with `archiveStep` `tag-release`, `tag` `v1.3.0`, `at` `d4…` and `sha` `a1…`, its reason names all three, its summary is `blocked: archive (tag-release)` and it exits 2

### Requirement: A fact GitHub does not answer stops the delivery
When `gh` fails, times out or returns an unreadable answer for the pull request, the merge commit,
the release file at either commit, the tag ref or the tag object, the delivery checker SHALL stop
with `stop-archive`, `archiveStep: tag-release`, and the reason `cannot read the release of PR #<n>
on GitHub: <error>`; it SHALL never answer as if no tag were needed. A `404` on the release file or
on the tag ref is the fact "absent", not a failure.

#### Scenario: The tag ref cannot be read
- **WHEN** `gh api repos/{owner}/{repo}/git/ref/tags/v1.3.0` fails with `HTTP 502`
- **THEN** the answer is `stop-archive` with `archiveStep` `tag-release` and the reason names pull request #12 and the error, never `retro`

#### Scenario: The merge commit cannot be read
- **WHEN** the pull request answers with no merge commit sha, or the commit read fails
- **THEN** the answer is the same stop

#### Scenario: No tag yet
- **WHEN** the tag ref read fails with `HTTP 404`
- **THEN** the tag is absent and the answer is `tag-release`

### Requirement: The session creates the lightweight tag and pushes it without force
At `tag-release` the session SHALL fetch the base branch, create the lightweight tag on the named
sha, push only that tag to `origin` without force, report the tag pushed and ask the delivery
checker again. A local tag of that name at another commit, or a push the remote refuses, SHALL stop
the run with the reason, never retried with force.

#### Scenario: The tag is pushed
- **WHEN** the step is `tag-release` with `tag` `v1.3.0` and `sha` `a1…`
- **THEN** the session runs `git fetch origin main`, `git tag v1.3.0 a1…` and `git push origin refs/tags/v1.3.0`, its report names `v1.3.0` and the next answer is the step after it

#### Scenario: The remote refuses the push
- **WHEN** `git push origin refs/tags/v1.3.0` exits non-zero
- **THEN** the run stops as `blocked: archive (tag-release)` with git's first error line, and no push with `--force` or `-f` is run

#### Scenario: A local tag at another commit
- **WHEN** the local clone already has `v1.3.0` at another commit than `a1…`
- **THEN** the run stops naming both commits, without deleting or moving the local tag
