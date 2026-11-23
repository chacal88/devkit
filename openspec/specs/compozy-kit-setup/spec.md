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

### Requirement: The kit runs the new stages in its four shells
The kit SHALL run the decisions in its planner shell, the mock-up in its design shell, and the unit
and E2E tests in its reviewer shell, each by dispatching the devkit agent of that stage's role, and
SHALL ship no shell beyond `tech-lead`, `dev`, `qa` and `design`.

#### Scenario: A full-script change is planned
- **WHEN** the planning node plans a `devkit` change
- **THEN** the planner shell's procedure has `devkit-core:adr-author` write `decisions.md` before the proposal, and the plan approval shows the ADRs it lists

#### Scenario: A change with screens
- **WHEN** the plan declares screens and the design node runs
- **THEN** its prompt and the design shell have `devkit-core:screen-designer` draw each declared screen under the change's `mock/` folder and write `mockup.md`, besides the screen-map rows

#### Scenario: The review node
- **WHEN** the review node runs on a change
- **THEN** its prompt and the reviewer shell have `devkit-core:test-runner` write `unit-tests.md` when the project declares a unit command and `devkit-core:e2e-tester` write `e2e-tests.md` when it declares an E2E command, before the verifier and the review bench, and a red run is a blocking issue

#### Scenario: The approved plan reaches the implementer
- **WHEN** the operator approved the plan and the implement node starts
- **THEN** the implementer shell's procedure sets each ADR `decisions.md` lists to accepted and `mockup.md`'s header to passed, naming the operator's approval, before the first phase

#### Scenario: No new shell
- **WHEN** `compozy-setup` installs the kit
- **THEN** it writes exactly the four role shells it wrote before
