<!-- devkit-stage specs result=passed attempt=4 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Spec Delta

## ADDED Requirements

### Requirement: A flow newer than the reader is refused clearly
The flow reader SHALL compare a flow file's `version` with the newest version it reads for that
script before any other check, and SHALL refuse a newer file with one message naming both versions
and the update to make, never calling it malformed. A top-level `readerRelease` in the file SHALL
add that release to the message.

#### Scenario: A newer flow with no release field
- **WHEN** the reader reads a `devkit` `flow.json` whose `version` is one above the newest it reads, with no `readerRelease`, and whose stages hold a key the reader does not know
- **THEN** it fails with a message that names that version and the newest version it reads, says to update devkit-openspec and restart the session, and holds neither `malformed` nor `unknown key`

#### Scenario: A newer flow that names its release
- **WHEN** that newer file carries `"readerRelease": "9.1.0"`
- **THEN** the message also names `devkit-openspec 9.1.0 or later`

#### Scenario: A release field that is not a release number
- **WHEN** the newer file's `readerRelease` is `soon` or `9`
- **THEN** the message is the one with no release field

#### Scenario: A script the reader does not know
- **WHEN** the reader reads a valid `flow.json` whose `script` is a project's own script, at any version
- **THEN** it reads the file as before this change

#### Scenario: An unknown stage key at a known version
- **WHEN** the reader reads a `devkit` `flow.json` at a version it knows whose stage `mockup` has a key `colour`
- **THEN** it fails with `flow.json of devkit is malformed: stage mockup has an unknown key colour`

#### Scenario: A release field that cannot be read at a known version
- **WHEN** the reader reads a `devkit` `flow.json` at a version it knows whose `readerRelease` is `soon`, or `1.2`
- **THEN** it fails with `flow.json of devkit is malformed: readerRelease "<value>" is not a release number such as 1.2.3`

#### Scenario: A release field at a known version
- **WHEN** the reader reads a valid `devkit` `flow.json` at a version it knows whose `readerRelease` is `1.2.3`
- **THEN** it reads the file

### Requirement: The reader's newest versions match the shipped flows
The newest version the reader knows for each shipped script SHALL equal the `version` of that
script's shipped `flow.json`, and this release SHALL leave every shipped `flow.json` byte-identical
to its released `flows/<version>.json`.

#### Scenario: The reader and the shipped versions agree
- **WHEN** the reader's newest version for `devkit`, `devkit-lite` and `devkit-project` is compared with the `version` of each shipped `flow.json`, in both schema copies
- **THEN** they are equal, and a test fails naming the script when they are not

#### Scenario: The shipped flows stay as released
- **WHEN** the `flow.json` of `devkit` and of `devkit-lite`, in both schema copies, is compared with its `flows/2.json`
- **THEN** both are version 2 and byte-identical
