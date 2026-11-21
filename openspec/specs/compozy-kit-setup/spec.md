# compozy-kit-setup Specification

## Purpose
Says how `compozy-setup` installs the CompozyOS kit's files into a project and installs them again
on a later run without losing a project's own edits, and what the kit tells an unattended run
about the grill.

## Requirements

### Requirement: The kit records what it installed
Every run of `compozy-setup` SHALL record, for each kit file it writes under `.compozy/`, a digest
of the bytes written and the inputs it filled them with, so that a later run can tell a file the
project edited from one it did not.

#### Scenario: A first install
- **WHEN** `compozy-setup` runs in a project with no `.compozy/`
- **THEN** it writes `config.toml`, `README.md`, the four role shells, `loops/openspec-change/loop.yaml` and `bin/devkit-kit`, and records a digest for each with the inputs used

### Requirement: A re-run updates the files the project did not edit
On a re-run, a kit file whose bytes still match the recorded digest SHALL be replaced by the
current template, filled with the recorded inputs, without a question. A kit file whose bytes
already equal that rendering SHALL be reported `same`, SHALL NOT be written, and SHALL have its
digest recorded.

#### Scenario: An unedited file with a newer template
- **WHEN** the kit's `README.md` template changed and the project's `.compozy/README.md` matches its recorded digest
- **THEN** the re-run writes the new `README.md` and records its new digest

#### Scenario: A file already equal to its rendering
- **WHEN** the project's `.compozy/config.toml` already equals the current template filled with the recorded inputs and `compozy-setup` runs again
- **THEN** the re-run reports it `same`, does not write it, and records its digest in the manifest

### Requirement: A re-run never replaces an edited file without the owner's yes
On a re-run, a kit file that differs from its recorded digest, or has none, and differs from the
current template SHALL be left in place; the run SHALL show its difference from the current
template and write it only when the owner accepts that file.

#### Scenario: An edited loop
- **WHEN** the project edited `.compozy/loops/openspec-change/loop.yaml` after the install and `compozy-setup` runs again
- **THEN** the file is left as the project edited it, its difference from the current template is shown, and the other unedited files are updated

#### Scenario: The owner accepts the difference
- **WHEN** the owner answers yes for `loop.yaml` and the run is repeated with that file accepted
- **THEN** `loop.yaml` is replaced by the current template and its digest recorded

#### Scenario: An install from before the record existed
- **WHEN** `.compozy/` has no record of digests and its `config.toml` differs from the current template
- **THEN** `config.toml` is treated as edited: shown, and left in place until the owner accepts it

### Requirement: The kit does not let an unattended run answer the grill
The kit's loop template and its planner shell SHALL tell the planning run, on both scripts, to
record the grill's questions as open questions for the operator with its assumptions marked
`strict-assumed`, never to answer them itself, and the plan approval node SHALL show those
questions to the operator.

#### Scenario: A short-script run reaches the grill
- **WHEN** the planning node of the kit's loop plans a `devkit-lite` change
- **THEN** its instructions say to return the grill's questions in `open_questions` and not to answer them, and the plan approval node lists them for the operator
