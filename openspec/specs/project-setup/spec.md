# project-setup Specification

## Purpose
Says what `openspec-setup` reports about the GitHub repository before it prepares `merge` mode,
which checks it proposes to require, and how it upgrades a project's schemas without breaking the
changes already under way.

## Requirements

### Requirement: The GitHub plan names what the repository refuses
The read-only run of `github-setup.mjs` SHALL print one line, naming the cause and what to do, when
GitHub Actions is disabled for the repository, when GitHub refuses the rulesets for the
repository's plan, and when the newest workflow runs all failed without any job starting a step.
It SHALL write nothing without `--apply`, as before.

#### Scenario: Actions disabled
- **WHEN** the repository's Actions permissions answer `enabled: false`
- **THEN** the plan prints a line saying GitHub Actions is disabled for the repository, that no check runs while it is, and where to enable it

#### Scenario: Rulesets refused by the plan
- **WHEN** reading the rulesets answers HTTP 403 with GitHub's message that the feature needs another plan or a public repository
- **THEN** the `ruleset` item is reported blocked with a line saying the plan refuses rulesets, that `merge` mode needs them, and the two ways out (a public repository or a plan with rulesets), instead of the bare GitHub error

#### Scenario: Runs that failed without starting
- **WHEN** the newest completed runs all concluded `failure` and none of their jobs started a step
- **THEN** the plan prints a line saying the newest runs failed without starting, naming the Actions billing (a failed payment or a spending limit) as one possible cause and where to check it

#### Scenario: Nothing written without apply
- **WHEN** the plan runs without `--apply` in any of these states
- **THEN** no `gh api -X` call is made and no file is written

### Requirement: A GitHub state that cannot be read is named, not blocked
When the repository's Actions permissions or its newest runs cannot be read, the plan of
`github-setup.mjs` SHALL print a line saying so and why, SHALL report that check as unknown, not
blocked, and SHALL leave the exit code as the other items and checks make it.

#### Scenario: Actions state that cannot be read
- **WHEN** reading the repository's Actions permissions, or its newest runs, fails (for example, the token lacks admin rights)
- **THEN** the plan prints a line saying that state cannot be read and GitHub's error, the check is reported `unknown` and not `blocked`, and the exit code is the one the other items give

### Requirement: Nothing that depends on refused rulesets is applied
When GitHub refuses the rulesets, `--apply` SHALL apply neither the `ruleset` item nor the
`auto-merge` item, and SHALL report both as not applied with the reason; the `workflow` and
`delete-branch` items SHALL be applied as before.

#### Scenario: Apply with rulesets refused
- **WHEN** `github-setup.mjs --apply workflow,auto-merge,delete-branch,ruleset` runs and the rulesets answer 403 for the plan
- **THEN** no ruleset call and no auto-merge setting is written, both items say why, and the workflow and delete-branch items are applied

### Requirement: The proposed required checks are checks pull requests run
The default list of checks the ruleset would require SHALL hold only the names of checks reported
on the head commits of the repository's newest pull requests, without `devkit-reviews` (added by
the ruleset itself). The owner SHALL still confirm the list or replace it with `--checks`.

#### Scenario: A job that runs only after the merge
- **WHEN** the job `test` runs on `pull_request` and the job `publish` runs only on push to the default branch
- **THEN** the proposed list holds `test` and not `publish`

#### Scenario: No pull request has run checks
- **WHEN** no pull request of the repository has a check reported on its head
- **THEN** the proposed list is empty and the plan says to give the checks with `--checks`

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

### Requirement: A full-script change whose implementation started continues
After the upgrade, a full-script change that had a ticked task before it SHALL be asked for
`approval.md` by no devkit command and by no `openspec instructions apply`. Its `approval.md`
SHALL be written as not applying, only from the owner's yes to the listing that named it, and
SHALL record no approval.

#### Scenario: Implementation started before the upgrade
- **WHEN** the owner answered yes to the listing and the schemas were replaced
- **THEN** the change's `approval.md` opens with a `not-applicable` stage header and says why, `openspec instructions apply` for the change is not blocked, and `deliver-check.mjs` gives no plan-approval stop

#### Scenario: No answer, no file
- **WHEN** the listing was shown and the owner did not answer yes
- **THEN** no `approval.md` is written and no schema is replaced

### Requirement: A full-script change with only its plan ready asks once
After the upgrade, a full-script change with an approved readiness and no ticked task SHALL stop
once at the owner's approval before any implementation, and `approval.md` SHALL be written only
from the owner's own message.

#### Scenario: Plan ready, no code
- **WHEN** the delivery checker runs on that change after the upgrade
- **THEN** it stops at the owner's plan approval, and after the owner's approval is recorded it goes on to the implementation

### Requirement: A short-script change under way is not sent to the grill
After the upgrade, a short-script change begun on the previous script SHALL NOT be sent to the
`requirements` stage by any devkit command.

#### Scenario: Old short-script change
- **WHEN** `change-loop.mjs next` runs on a `devkit-lite` change whose files carry no stage header and that has no `requirements.md`
- **THEN** it ends blocked as begun on the previous script and does not answer the grill

### Requirement: The GitHub plan prints every check the ruleset will require
The plan of `github-setup.mjs` SHALL print, on its required-checks line, every check the ruleset
`devkit` will require: the checks given with `--checks` or found on the newest pull requests,
`devkit-reviews`, and any check the existing ruleset `devkit` already requires, each part labelled
with where it comes from. The line SHALL NOT say "none" while the ruleset requires a check. The
JSON plan SHALL carry the same list.

#### Scenario: An empty checks option
- **WHEN** `github-setup.mjs --checks ""` runs
- **THEN** the required-checks line lists `devkit-reviews`, says it is always required and that `--checks` gave no other check, and the line holds no "none"

#### Scenario: Checks found on the newest pull requests
- **WHEN** the newest pull requests report the checks `test` and `lint` and no option is given
- **THEN** the line lists `test, lint, devkit-reviews`, labelling `test, lint` as reported on the newest pull requests

#### Scenario: No pull request has a check reported
- **WHEN** no pull request of the repository has a check reported on its head and no option is given
- **THEN** the line lists `devkit-reviews` and says that no other check was reported and that `--checks` adds one

#### Scenario: Checks the existing ruleset already requires
- **WHEN** the ruleset `devkit` exists and requires `e2e` and the checks given are `test`
- **THEN** the line lists `e2e`, `test` and `devkit-reviews`, labelling `e2e` as already required by the ruleset

#### Scenario: The JSON plan
- **WHEN** `github-setup.mjs --json` runs
- **THEN** its `requires` field is the list the line prints, in the same order, and its `contexts` field is unchanged

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

### Requirement: The setup asks for the project's test commands
When `openspec-setup` installs or upgrades the flow, it SHALL propose, from the repository, the
values of `devkit.tests.unit`, `devkit.tests.coverage.command` and `devkit.tests.e2e`, ask the owner
for `devkit.tests.coverage.target`, write only the values the owner confirmed into the `devkit:`
block of `openspec/config.yaml`, and keep any value the block already holds. The starting
`openspec/config.yaml` SHALL show the four keys as a commented example.

#### Scenario: A project with a unit suite and no E2E
- **WHEN** the setup runs in a project whose `package.json` has a `test` script and no E2E tool, and the owner confirms `npm test` and gives no target
- **THEN** the block gains `tests:` with `unit: "npm test"` only, and the E2E and unit stages of a change follow that block

#### Scenario: An upgrade keeps what the project set
- **WHEN** the setup runs again in a project whose block already holds `tests.unit` and `tests.coverage.target: 85`
- **THEN** both values are kept as they are and no question is asked about them

#### Scenario: The starting configuration
- **WHEN** a project has no `openspec/config.yaml` and the setup writes it from its template
- **THEN** the file shows `unit`, `coverage.command`, `coverage.target` and `e2e` under `devkit.tests` as commented lines, with one line saying that a stage whose command is absent does not run

### Requirement: The setup names a gh too old for the delivery
The first step of `openspec-setup` SHALL check the installed `gh` once, next to the OpenSpec CLI, and
print one line: `ok` with the version for 2.50.0 or newer, else a warning naming the installed
version and 2.50.0, or saying `gh` is not installed or its version cannot be read. A warning SHALL
NOT stop the setup: the `plan` ship mode needs no `gh`.

#### Scenario: A gh older than 2.50.0
- **WHEN** `gh --version` prints `gh version 2.46.0 (2024-03-18)`
- **THEN** the check prints a warning naming `2.46.0` and `2.50.0` and saying the `pr` and `merge` ship modes need the newer one, exits 0, and the setup goes on

#### Scenario: No gh installed
- **WHEN** `gh` is not on `PATH`
- **THEN** the check prints a warning saying `gh` is not installed and naming `2.50.0`, exits 0, and the setup goes on

#### Scenario: A recent gh
- **WHEN** the first line of `gh --version` is `gh version 2.50.0` or `gh version 2.105.0`, each followed by its build date
- **THEN** the check prints `ok` with that version and exits 0

#### Scenario: A version that cannot be read
- **WHEN** `gh --version` fails or prints a first line that is not `gh version <major>.<minor>.<patch>`
- **THEN** the check prints a warning saying the version cannot be read and naming `2.50.0`, exits 0, and the setup goes on
