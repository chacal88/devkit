<!-- devkit-stage specs result=passed attempt=1 commit=4f4b7e201aabdebdb65b11f7ce80154463a524e9 -->
# Spec Delta

## ADDED Requirements

### Requirement: A release tag setting that cannot be used stops the command
`/devkit change` SHALL refuse with the settings reply, before anything is created or run, when the
`devkit:` block sets `release_tag` to a value that is not a path from the repository root to a
`.json` file. A project with the key absent or empty SHALL read the same settings as before.

#### Scenario: An absolute path
- **WHEN** `openspec/config.yaml` has `devkit:` with `release_tag: /etc/plugin.json` and the person types `/devkit change add an export`
- **THEN** nothing is created, the command exits 3 and the reply is the unknown-setting reply naming the release file, the value and the accepted form

#### Scenario: A valid path
- **WHEN** `release_tag: plugins/openspec/.claude-plugin/plugin.json` is set
- **THEN** the command runs as before, and the settings it reads name that path

#### Scenario: No key
- **WHEN** the `devkit:` block has no `release_tag`
- **THEN** the settings read are exactly those read before this change

### Requirement: The release tag step is a session step of the delivery
When the delivery checker answers `tag-release`, the loop SHALL give a session step of the delivery
stage whose detail carries the tag, the merge commit sha, the pull request number and the base
branch, done as the shipping skill's row for that step says; on the archive branch it SHALL do so
before ending the run archived.

#### Scenario: After the change's merge
- **WHEN** the change's pull request merged with a release bump and the delivery checker answers `tag-release`
- **THEN** `change-loop.mjs next` gives an action of kind `session`, stage `delivery`, step `tag-release`, with `detail.tag`, `detail.sha`, `detail.number` and `detail.base`, and exits 0

#### Scenario: After the archive merge, on the archive branch
- **WHEN** the change is archived in the worktree of `chore/archive-<id>`, the archive pull request merged with a release bump and its tag is missing
- **THEN** the next action is the same session step, not the archived end

#### Scenario: The same step back with nothing changed
- **WHEN** the step `tag-release` comes back with the same progress key after the session ran it
- **THEN** the run ends blocked as a step that made no progress, as for every session step

### Requirement: A tag at another commit ends the run blocked with its own reason
When the delivery checker stops because the tag already points at another commit, the loop SHALL
end the run blocked with a reason that names the tag, the commit it points at and the merge commit,
in the person's language, and that says the run never moves a tag.

#### Scenario: The tag points elsewhere
- **WHEN** the delivery checker answers `stop-archive` with `archiveStep` `tag-release`, `tag` `v1.3.0`, `at` `d4…` and `sha` `a1…`
- **THEN** the run ends blocked with the reason code `tag-elsewhere`, its reply names `v1.3.0` and the first 7 characters of both shas, and it exits 2

#### Scenario: GitHub could not answer
- **WHEN** the delivery checker answers `stop-archive` with `archiveStep` `tag-release` and no `at`
- **THEN** the run ends blocked with the reason code `archive-failed`, as every other archive stop does
