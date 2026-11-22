<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The changes under way are listed before the schemas are replaced
Before `install-schemas.sh` replaces a project's schemas, `openspec-setup` SHALL list each change
under way in the main checkout and its worktrees, with its script and what the upgrade changes for
it, and SHALL ask the owner once before replacing them. A slice under way on `devkit-project` SHALL be
listed as continuing on the new project script with its files kept. A change under way on a schema
other than `devkit`, `devkit-lite` or `devkit-project` SHALL be listed as untouched by the upgrade.
Nothing SHALL be written for either.

#### Scenario: Three changes under way
- **WHEN** the project has a full-script change with a ticked task, a full-script change with an approved readiness and no ticked task, and a short-script change, all under way
- **THEN** the listing names each with its script and says, respectively, that it continues where it was with no approval asked, that it asks the owner's approval once before its implementation, and that it continues where it was without going back to the grill

#### Scenario: A change on another schema
- **WHEN** a change on a schema that is neither `devkit`, `devkit-lite` nor `devkit-project` is under way and the owner answers yes to the listing
- **THEN** the listing names it as untouched by the upgrade, and no `approval.md` or other file is written for it

#### Scenario: A slice under way
- **WHEN** a slice on `devkit-project` is under way and the owner answers yes to the listing
- **THEN** the listing names it as continuing on the new project script with its stage records and documents kept, and no file is written for it

## ADDED Requirements

### Requirement: The project script is installed beside the two others
`install-schemas.sh` SHALL install `devkit-project` with `devkit` and `devkit-lite`, in the project
form and the machine-wide form alike, and `openspec-setup` SHALL validate all three. When the
project's `ship:` block has no `devkit-project` key, `openspec-setup` SHALL add one with the mode of
the `devkit` key (`plan` when that is absent) and show the change.

#### Scenario: A fresh install
- **WHEN** `install-schemas.sh <project-root>` runs on a project with no schema folder
- **THEN** `openspec/schemas/` holds exactly `devkit`, `devkit-lite` and `devkit-project`, and `openspec schema validate devkit-project` passes

#### Scenario: A project in merge mode
- **WHEN** the project's `openspec/config.yaml` has `ship:` with `devkit: merge` and no `devkit-project` key, and `openspec-setup` runs
- **THEN** the `ship:` block gains `devkit-project: merge`, every other line of the file is unchanged, and the diff is shown to the owner
