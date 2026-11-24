<!-- devkit-stage specs result=passed attempt=2 commit=d2010cafc71627b2d8d365d75af477fbecd0e736 -->
# Spec Delta

## ADDED Requirements

### Requirement: The archive file check passes a CI pin move in the flow page unnamed
The archive's file check SHALL leave `docs/openspec-flow.md` out of the files no approved proposal
names when its text on the archive branch, with every CI pin masked, equals its text at the merge
base with every CI pin masked. A CI pin is each `v<X>.<Y>.<Z>` on a line holding one of the pin
markers. Any other edit SHALL keep the file in that list unless an approved proposal names it.

#### Scenario: Only the pins moved
- **WHEN** an archive branch moves every CI pin of `docs/openspec-flow.md` from `v0.21.0` to `v0.21.1`, changes nothing else in the file, and no approved proposal names it
- **THEN** the file check does not name `docs/openspec-flow.md`, and the archive raises no `apply-proposals` stop for it

#### Scenario: A sentence changed beside the pins
- **WHEN** the archive branch moves the pins and also changes a sentence or adds a paragraph of `docs/openspec-flow.md`, and no approved proposal names it
- **THEN** the archive stops with `files no approved proposal names: docs/openspec-flow.md`

#### Scenario: A pin line with other words changed
- **WHEN** the archive branch changes words other than the version on a pin line, or adds a new pin line
- **THEN** the file check names `docs/openspec-flow.md`

#### Scenario: The real archive of review-writer-prompt
- **WHEN** the flow page changes exactly as commit c561553 changed it
- **THEN** the file check does not name it

### Requirement: The archive file check passes the pin assertions of the loop's test unnamed
The archive's file check SHALL leave `plugins/openspec/hooks/change-loop.test.mjs` out of the files
no approved proposal names when every line added or removed against the merge base is an
`assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');` or `assert.doesNotMatch(flow,
/v<X>\.<Y>\.<Z>/, '<message>');` line, with any message, or a comment line starting `// Invariant:
the CI snippet pins the current release`.

#### Scenario: The current pin moves and the previous one is refused
- **WHEN** the archive branch replaces the `assert.match(flow, /v0\.21\.0/, ...)` line with an `assert.match(flow, /v0\.21\.1/, ...)` line with another message, adds `assert.doesNotMatch(flow, /v0\.21\.0/, 'no pin left on the previous release');`, rewrites the Invariant comment, and changes nothing else in the file
- **THEN** the file check does not name `plugins/openspec/hooks/change-loop.test.mjs`

#### Scenario: Another line changed
- **WHEN** the archive branch also adds or removes another line of the file: another assertion, an assertion on a subject other than `flow`, a regular expression that is not a plain version, another comment, a blank line, or a changed line of an unrelated test
- **THEN** the file check names `plugins/openspec/hooks/change-loop.test.mjs`

#### Scenario: The real archive of review-writer-prompt
- **WHEN** the test file changes exactly as commit c561553 changed it
- **THEN** the file check does not name it

### Requirement: A pin file the check cannot compare stays unnamed
The archive's file check SHALL name `docs/openspec-flow.md` or
`plugins/openspec/hooks/change-loop.test.mjs` when the file is missing at the merge base or on the
archive branch, or when either text cannot be read, unless an approved proposal names it. A change
of the final newline alone SHALL count as a change beyond the pins. An empty file is a text, not a
missing file, and SHALL be compared like any other text.

#### Scenario: The file is new on the archive branch
- **WHEN** the merge base has no `docs/openspec-flow.md` and the archive branch adds it
- **THEN** the file check names `docs/openspec-flow.md`

#### Scenario: The file is deleted on the archive branch
- **WHEN** the archive branch deletes `plugins/openspec/hooks/change-loop.test.mjs`, committed or only in the working tree
- **THEN** the file check names `plugins/openspec/hooks/change-loop.test.mjs`

#### Scenario: The file is present but cannot be read
- **WHEN** `docs/openspec-flow.md` exists at the merge base and on the archive branch, but either text cannot be read, and no approved proposal names it
- **THEN** the file check names `docs/openspec-flow.md`

#### Scenario: Only the final newline changed
- **WHEN** the archive branch removes or adds the final newline of `docs/openspec-flow.md` or `plugins/openspec/hooks/change-loop.test.mjs` and changes nothing else in it
- **THEN** the file check names that file

#### Scenario: The file is empty at the merge base
- **WHEN** `docs/openspec-flow.md` is an empty file at the merge base and is still empty on the archive branch
- **THEN** the file is compared as a text, not treated as missing, and the file check does not name it

### Requirement: The local archive stop and the reviews check apply one pin-line rule
The local archive stop of `deliver-check` and the `devkit-reviews` check on an archive pull request
SHALL reach the same verdict on the two pin files for the same archive branch. The check SHALL run
from the three files the consumer workflow downloads, and SHALL NOT count either file as a release
file when it resolves a merge conflict.

#### Scenario: A pin-only archive pull request on CI
- **WHEN** `devkit-reviews --ci` runs on an archive pull request whose only unnamed edits are a pin move in `docs/openspec-flow.md` and pin assertion lines in `change-loop.test.mjs`
- **THEN** the check passes, and it passes when run from only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`

#### Scenario: The same branch beyond the pin
- **WHEN** the same archive pull request also changes a sentence of `docs/openspec-flow.md`
- **THEN** the check fails naming `docs/openspec-flow.md`, as the local archive stop does

#### Scenario: A merge conflict in the flow page beyond the pin
- **WHEN** a change or archive pull request conflicts with its base in `docs/openspec-flow.md` beyond its pins
- **THEN** the conflict still blocks as before this change
