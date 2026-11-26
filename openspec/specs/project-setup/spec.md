# project-setup Specification

## Purpose
Says how the typed `/devkit setup` sets a project up for the devkit flow and runs again on it (the
`devkit:` block of `openspec/config.yaml`, the schemas, and the CompozyOS kit through devkit-compozy's
kit installer), what it reports about the GitHub repository before it prepares `merge` mode, which
checks it proposes to require, and how it upgrades a project's schemas without breaking the changes
already under way.

## Requirements

### Requirement: The GitHub plan names what the repository refuses
The read-only run of `github-setup.mjs` SHALL print one line, naming the cause and what to do, when
GitHub Actions is disabled for the repository, when GitHub refuses the rulesets for the
repository's plan, and when the newest workflow runs all failed without any job starting a step.
It SHALL write nothing without `--apply`, as before. A blocked state SHALL make the run exit 1.

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

#### Scenario: A blocked state exits 1
- **WHEN** the plan reports Actions disabled, the runs failed without starting, or the rulesets refused
- **THEN** the run exits 1

#### Scenario: Nothing blocked
- **WHEN** no item and no check of the plan is blocked or in error
- **THEN** the run exits 0

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
Before `install-schemas.sh` replaces a project's schemas, `/devkit setup` SHALL list each change
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
form and the machine-wide form alike, and `/devkit setup` SHALL validate all three. When the
project's `ship:` block has no `devkit-project` key, `/devkit setup` SHALL add one with the mode of
the `devkit` key (`plan` when that is absent) and show the change.

#### Scenario: A fresh install
- **WHEN** `install-schemas.sh <project-root>` runs on a project with no schema folder
- **THEN** `openspec/schemas/` holds exactly `devkit`, `devkit-lite` and `devkit-project`, and `openspec schema validate devkit-project` passes

#### Scenario: A project in merge mode
- **WHEN** the project's `openspec/config.yaml` has `ship:` with `devkit: merge` and no `devkit-project` key, and `/devkit setup` runs
- **THEN** the `ship:` block gains `devkit-project: merge`, every other line of the file is unchanged, and the diff is shown to the owner

### Requirement: The setup asks for the project's test commands
When `/devkit setup` installs or upgrades the flow, it SHALL propose, from the repository, the
values of `devkit.tests.unit`, `devkit.tests.coverage.command` and `devkit.tests.e2e`, ask the owner
for `devkit.tests.coverage.target`, write only the values the owner confirmed into the `devkit:`
block of `openspec/config.yaml`, and keep any value the block already holds. A starting
`openspec/config.yaml` the setup writes from its template SHALL show the four keys as a commented
example; one that `openspec init` wrote earlier in the same setup gets none.

#### Scenario: A project with a unit suite and no E2E
- **WHEN** the setup runs in a project whose `package.json` has a `test` script and no E2E tool, and the owner confirms `npm test` and gives no target
- **THEN** the block gains `tests:` with `unit: "npm test"` only, and the E2E and unit stages of a change follow that block

#### Scenario: An upgrade keeps what the project set
- **WHEN** the setup runs again in a project whose block already holds `tests.unit` and `tests.coverage.target: 85`
- **THEN** both values are kept as they are and no question is asked about them

#### Scenario: The starting configuration
- **WHEN** no `openspec/config.yaml` exists when the setup writes the block (no `openspec/config.yaml` was in the project and no `openspec init` of the same setup wrote one), and the setup writes the file from its template
- **THEN** the file shows `unit`, `coverage.command`, `coverage.target` and `e2e` under `devkit.tests` as commented lines, with one line saying that a stage whose command is absent does not run

### Requirement: The setup names a gh too old for the delivery
The first step of `/devkit setup` SHALL check the installed `gh` once, next to the OpenSpec CLI, and
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

### Requirement: One typed verb sets a project up
`/devkit setup` SHALL be the one step that sets a project up for the devkit flow and SHALL be the
same step for a first install and for a re-run. It SHALL run in a folder that is not set up yet, and
SHALL opt the project in, install the `devkit`, `devkit-lite` and `devkit-project` schemas and write
`openspec/config.yaml` with a `devkit:` block.

#### Scenario: A first install
- **WHEN** the owner types `/devkit setup` in a git project that has the packs installed and no `openspec/`, and answers every question
- **THEN** `.claude/settings.json` enables `devkit-core` and `devkit-openspec`, `openspec/schemas/` holds `devkit`, `devkit-lite` and `devkit-project`, and `openspec/config.yaml` holds an uncommented `devkit:` block

#### Scenario: A folder that is not set up
- **WHEN** `/devkit setup` is typed where `openspec/config.yaml` is absent or selects another schema
- **THEN** the command answers with the setup step and not with the reply that the project is not set up

#### Scenario: A project on the CompozyOS driver
- **WHEN** the owner types `/devkit setup` again in a project whose `devkit:` block holds `driver: compozy`
- **THEN** the session runs the setup step as on every other driver, starts no CompozyOS run, and asks only what is missing

### Requirement: The setup skill is invoked only from the owner's typed command
`/devkit setup` SHALL be accepted only from the owner's typed command, as `/devkit change` is: the
`devkit` skill SHALL stay not invocable by the model, so no agent, stage or session can invoke it.
This covers the skill only: this change does not prevent a session from running the setup's
scripts by hand, which can write a setup's files in a project that is not set up.

#### Scenario: The skill cannot be invoked by the model
- **WHEN** the `devkit` skill's frontmatter is read
- **THEN** it holds `disable-model-invocation: true` and its argument hint lists `setup`

#### Scenario: A request that is not the typed command
- **WHEN** a session is asked in plain words, with no typed `/devkit setup`, to set the project up
- **THEN** the session makes no Skill call: the `devkit` skill does not run, and its `## Start` does not send the request to the Setup section, as for a request in plain words to run a change

#### Scenario: A typed setup ends a change run's hold
- **WHEN** the owner types `/devkit setup` in a session that was running `/devkit change` or `/devkit roadmap`
- **THEN** that run no longer holds the session, as for any other typed command (a roadmap run also stays on through `/devkit status` and `/devkit train`)

### Requirement: The setup asks each key of the devkit block
The setup SHALL ask one short question each for `devkit.language`, `devkit.driver` and the delivery
model (`model`, `base`, `test_branch`), each with its default; propose `devkit.tests.*` from the
repository for the owner to confirm; ask the ship mode with `merge` suggested; and write `release_tag`
only when a release file exists. It SHALL write only answered values and SHALL NOT write `budget` or
`design:`; their commented examples appear only in a file the setup writes from its template.

#### Scenario: A first setup with answers given
- **WHEN** the owner answers `en`, `claude`, no delivery model, `npm test` for the unit tests, no coverage, no E2E and `merge` with `squash`
- **THEN** the block holds `language: en`, `driver: claude` and `tests.unit: "npm test"`, the file holds `ship:` with `merge` for `devkit`, `devkit-lite` and `devkit-project` and `merge_method: squash`, and no uncommented line holds a `budget` key or a top-level `design:` key: when `openspec init` wrote the file earlier in the same setup, the setup adds only the block, the `ship:` map, `merge_method` and the parts its plan names to fill, so neither key appears at all; when the setup wrote the file from its template, both appear only on its commented lines

#### Scenario: No release file
- **WHEN** the project's root has no `package.json` with a top-level `version`
- **THEN** no question is asked about `release_tag` and the key is not written

#### Scenario: A release file
- **WHEN** the project's root has a `package.json` with a top-level `version` and the owner confirms it
- **THEN** the block holds `release_tag: package.json`

#### Scenario: A delivery model chosen
- **WHEN** the owner chooses the delivery model `trunk-auto`
- **THEN** the block holds `delivery.model: trunk-auto`, no ship-mode question is asked, no `ship:` entry is written, and `merge_method` is asked because the model merges

#### Scenario: A ship mode that does not merge
- **WHEN** the owner answers `pr` to the ship question
- **THEN** no question is asked about `merge_method` and the key is not written

### Requirement: A re-run keeps every value and asks only what is missing
On a re-run the setup SHALL keep every value the block and the `ship:` map already hold, SHALL ask
only for the keys that are absent, and SHALL leave `openspec/config.yaml` byte-identical when nothing
is missing or every answer leaves a key unset. The block writer SHALL refuse an answer for a key
already present.

#### Scenario: Nothing missing
- **WHEN** the setup runs again on a project whose config holds every key it asks
- **THEN** no question about the block is asked and `openspec/config.yaml` has the same bytes as before

#### Scenario: One key missing
- **WHEN** the block holds every key but `tests.e2e` and the owner gives `npm run e2e`
- **THEN** only the line `e2e: "npm run e2e"` is added under `tests:` and every other byte of the file is unchanged

#### Scenario: An answer for a key already present
- **WHEN** the block holds `language: en` and the answers given to the block writer hold `language: pt-BR`
- **THEN** the writer exits 3, names the key, and the file is unchanged

#### Scenario: A value the loop refuses
- **WHEN** the block holds `language: xx_bad`
- **THEN** the setup keeps the value, names the setting, the value and the accepted values, and asks no question about it

#### Scenario: A delivery train the loop refuses
- **WHEN** the block holds `delivery.train` and no delivery `model`
- **THEN** the setup keeps the train value and names it as needing the model `trunk` or `trunk-auto`, and the delivery-model question offers only `trunk` and `trunk-auto`

### Requirement: A re-run writes outside the block only what is unset
Outside the `devkit:` block the setup SHALL write `schema`, `context`, `rules` and `operations` only
where the key is absent, where `schema` names a schema other than `devkit` and `devkit-lite` (after
asking), or where `context` still holds a `<...>` placeholder. It SHALL NOT merge keys into a
present `rules` or `operations` map.

#### Scenario: A filled config outside the block
- **WHEN** the setup runs again on a project whose config holds `schema: devkit-lite`, a `context` with no placeholder, and `rules` and `operations` maps that lack some of the template's keys
- **THEN** none of those four parts is written, and the keys the template has and the maps lack are not added

#### Scenario: A context still holding placeholders
- **WHEN** the config's `context` still holds the template's `<languages, frameworks, database>` line
- **THEN** the setup fills `context` from the repository and writes no other part outside the block that is already set

### Requirement: The driver question offers only drivers that run
The driver question SHALL offer only the values `/devkit change` runs with on the installed plugin,
and the setup SHALL NOT write a value `/devkit change` answers as not built.

#### Scenario: The drivers offered
- **WHEN** the driver question is asked with the CompozyOS driver built and the script driver not built
- **THEN** it offers `claude` and `compozy` and does not offer `script`

#### Scenario: A value not offered
- **WHEN** the answers given to the block writer hold `driver: script`
- **THEN** the writer exits 3, names the drivers it accepts, and writes nothing

#### Scenario: A value already present that is not built
- **WHEN** the block already holds `driver: script`
- **THEN** the setup keeps it, says the driver is not built yet with its round, and does not ask the driver question

### Requirement: The CompozyOS kit is a question of its own
The setup SHALL ask whether to install the CompozyOS kit as one yes/no question, apart from the
driver. A yes SHALL run the installer devkit-compozy ships and enable `devkit-compozy`; a no SHALL
write nothing for the kit. Choosing the `compozy` driver SHALL install the kit with no separate
question.

#### Scenario: Yes to the kit
- **WHEN** the owner answers yes to the kit question in a project with no `.compozy/`
- **THEN** `.compozy/` holds the kit and its `kit-manifest.json`, and `.claude/settings.json` enables `devkit-compozy`

#### Scenario: No to the kit
- **WHEN** the owner answers no to the kit question
- **THEN** no `.compozy/` folder is written and `devkit-compozy` is not enabled

#### Scenario: The compozy driver chosen
- **WHEN** the owner chooses `compozy` at the driver question
- **THEN** the kit is installed as for a yes, and the kit question is not asked

#### Scenario: devkit-compozy not installed
- **WHEN** the kit is wanted and no installed devkit-compozy ships the kit installer
- **THEN** the setup says so, naming `devkit-compozy`, and writes nothing for the kit

#### Scenario: A kit already installed
- **WHEN** the project has `.compozy/kit-manifest.json`
- **THEN** the setup runs the installer again with the recorded inputs, asks one question per file the project edited, and does not ask the kit question

### Requirement: The setup copies no checker and names what the project uses
The setup SHALL copy no checker code into the project. It SHALL name the devkit-openspec version the
schemas come from and the version the CI pin points at in `merge` mode, and SHALL name each pack the
project uses that `.claude/settings.json` does not enable.

#### Scenario: The files written
- **WHEN** a first setup ends
- **THEN** no file named `guard.mjs`, `flow-check.mjs`, `deliver-check.mjs` or `merge-setup.mjs` exists in the project outside its `node_modules/`

#### Scenario: A pack not enabled
- **WHEN** `.claude/settings.json` sets `devkit-openspec@devkit` to `false` and the setup checks the packs
- **THEN** it names `devkit-openspec` as not enabled before it writes the opt-in

#### Scenario: The version named
- **WHEN** the setup installs the schemas
- **THEN** its report names the version of the devkit-openspec that installed them

#### Scenario: A CI pin that differs
- **WHEN** `.github/workflows/devkit-reviews.yml` is pinned to the commit of a tag other than `v<the devkit-openspec version>`
- **THEN** the report names both, says that the GitHub step's `workflow` item moves the pin, and the setup writes no other record of the version

### Requirement: In merge mode each GitHub item is confirmed on its own
When the ship mode the owner chose merges, the setup SHALL show the GitHub plan and ask one question
per item that is not `ok` (the workflow, the auto-merge setting, the branch deletion and the ruleset
with its required checks), and SHALL apply only the items that got a yes, never all at once.

#### Scenario: Every item declined
- **WHEN** the plan lists four items that are not `ok` and the owner answers no to each
- **THEN** four questions were asked, one per item, and no GitHub setting and no workflow file is written

#### Scenario: One item confirmed
- **WHEN** the owner answers yes only to `delete-branch`
- **THEN** the apply call names only `delete-branch`, and the plan run again shows it `ok` and the others as before

#### Scenario: A mode that does not merge
- **WHEN** the owner answers `plan` or `pr` to the ship question and does not ask for the GitHub step
- **THEN** the GitHub plan is not run and no GitHub question is asked

### Requirement: The block writer refuses what it cannot read or accept
The block writer SHALL write nothing, SHALL exit 3 and SHALL say why when it cannot read
`openspec/config.yaml` or its `devkit:` block, or when an answer is for a key already present or
outside the values that key accepts. It SHALL exit 2, writing nothing, on a usage error. It SHALL
keep the file's line endings, and SHALL add a final newline only when it appends to a file that
lacks one.

#### Scenario: A configuration file that cannot be read
- **WHEN** `openspec/config.yaml` is a folder, or cannot be read, and the writer is asked for its plan or to apply answers
- **THEN** it exits 3, names the file, prints no plan, and nothing is written

#### Scenario: An inline value
- **WHEN** the file holds `devkit: {}`
- **THEN** the writer exits 3, says the block cannot be read and is edited by hand, and the file is unchanged

#### Scenario: A second devkit line or a tab indent
- **WHEN** the file holds two column-0 `devkit:` lines, or a block line indented with a tab
- **THEN** the writer exits 3, names the line, and the file is unchanged

#### Scenario: An answer outside its values
- **WHEN** the answers hold a `language` that is not a language tag, a delivery `model` outside `trunk`, `trunk-auto` and `two-prs`, `two-prs` without `base` or `test_branch`, a `ship` outside `plan`, `pr` and `merge`, a `merge_method` outside `squash`, `merge` and `rebase`, or a coverage `target` that is not a whole number from 0 to 100
- **THEN** the writer exits 3, names the key and its accepted values, and the file is unchanged

#### Scenario: A usage error
- **WHEN** the writer is called with an unknown subcommand, or its standard input is not one JSON object
- **THEN** it exits 2 and the file is unchanged

#### Scenario: Line endings kept
- **WHEN** the file uses CRLF line endings and one key is added
- **THEN** every line of the file, the added one included, ends with CRLF

#### Scenario: An empty file
- **WHEN** `openspec/config.yaml` exists and is empty
- **THEN** the writer treats it as having no block and writes the block

### Requirement: The removed setup skills are named nowhere
No reply of the scripts, hook message, skill, document or capability spec SHALL name either of the
two removed setup skills. Each SHALL name `/devkit setup`. Decision records, past `CHANGELOG.md`
entries, change folders, train records, the test fixture that holds an old project's configuration
and the test fixtures that hold a document's bytes at a past commit SHALL keep their text as
history.

#### Scenario: The replies
- **WHEN** every reply key of the change loop is rendered in `en` and in `pt-BR`
- **THEN** none names either of the two removed setup skills, and the reply for a project not set up names `/devkit setup`

#### Scenario: The files of the repository
- **WHEN** the repository's files are read outside `docs/adr/`, `openspec/changes/`, `openspec/trains/`, `CHANGELOG.md`, the old-project fixture and the past-commit fixtures, with this change's spec deltas applied to the capability specs
- **THEN** none names either of the two removed setup skills, and neither skill folder exists

### Requirement: A project set up with the old skills keeps working
A project set up by the earlier setup skill of the OpenSpec pack before this change SHALL run
`/devkit change` and pass the flow checker with no setup step.

#### Scenario: The old configuration
- **WHEN** a project holds the configuration the old skill wrote (all of its `devkit:` example commented), its `.claude/settings.json` and its installed schemas, and `/devkit change add an export` is typed
- **THEN** the command opens a new change on the `claude` driver, and the stage readout of that change reads it with no error
