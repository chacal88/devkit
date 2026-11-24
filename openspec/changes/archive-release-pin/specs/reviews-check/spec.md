<!-- devkit-stage specs result=passed attempt=3 commit=34e3500db260bff6af03280818740ef85a2eb1a3 -->
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

### Requirement: A pin file the check cannot compare stays unnamed
The archive's file check SHALL name `docs/openspec-flow.md` when the file is missing at the merge
base or on the archive branch, or when either text cannot be read, unless an approved proposal names
it. A change of the final newline alone SHALL count as a change beyond the pins. An empty file is a
text, not a missing file, and SHALL be compared like any other text.

#### Scenario: The file is new on the archive branch
- **WHEN** the merge base has no `docs/openspec-flow.md` and the archive branch adds it
- **THEN** the file check names `docs/openspec-flow.md`

#### Scenario: The file is deleted on the archive branch
- **WHEN** the archive branch deletes `docs/openspec-flow.md`, committed or only in the working tree
- **THEN** the file check names `docs/openspec-flow.md`

#### Scenario: The file is present but cannot be read
- **WHEN** `docs/openspec-flow.md` exists at the merge base and on the archive branch, but either text cannot be read, and no approved proposal names it
- **THEN** the file check names `docs/openspec-flow.md`

#### Scenario: Only the final newline changed
- **WHEN** the archive branch removes or adds the final newline of `docs/openspec-flow.md` and changes nothing else in it
- **THEN** the file check names `docs/openspec-flow.md`

#### Scenario: The file is empty at the merge base
- **WHEN** `docs/openspec-flow.md` is an empty file at the merge base and is still empty on the archive branch
- **THEN** the file is compared as a text, not treated as missing, and the file check does not name it

### Requirement: The local archive stop and the reviews check apply one pin-line rule
The local archive stop of `deliver-check` and the `devkit-reviews` check on an archive pull request
SHALL reach the same verdict on `docs/openspec-flow.md` for the same archive branch. The check SHALL
run from the three files the consumer workflow downloads, and SHALL NOT count the file as a release
file when it resolves a merge conflict.

#### Scenario: A pin-only archive pull request on CI
- **WHEN** `devkit-reviews --ci` runs on an archive pull request whose only unnamed edit is a pin move in `docs/openspec-flow.md`
- **THEN** the check passes, and it passes when run from only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`

#### Scenario: The same branch beyond the pin
- **WHEN** the same archive pull request also changes a sentence of `docs/openspec-flow.md`
- **THEN** the check fails naming `docs/openspec-flow.md`, as the local archive stop does

#### Scenario: A merge conflict in the flow page beyond the pin
- **WHEN** a change or archive pull request conflicts with its base in `docs/openspec-flow.md` beyond its pins
- **THEN** the conflict still blocks as before this change

### Requirement: No test file passes the archive file check by its content
The archive's file check SHALL pass no file other than `docs/openspec-flow.md` by its content. A
change to a test file, `plugins/openspec/hooks/change-loop-compozy.test.mjs` included, SHALL be named
unless an approved proposal names it, in the local archive stop and in `devkit-reviews --ci` alike.

#### Scenario: Only the pin assertions of the loop's test changed
- **WHEN** an archive branch changes `plugins/openspec/hooks/change-loop-compozy.test.mjs` only in `assert.match(flow, /v<X>\.<Y>\.<Z>/, ...)` or `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, ...)` lines or the `// Invariant: the CI snippet pins the current release` comment, and no approved proposal names the file
- **THEN** the local archive stop and `devkit-reviews --ci` both name `plugins/openspec/hooks/change-loop-compozy.test.mjs`
