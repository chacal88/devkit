<!-- devkit-stage specs result=passed attempt=2 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The project's driver setting decides whether the command runs
The command SHALL read `devkit.driver` from the project's `openspec/config.yaml`, `claude` when the
block or the key is absent. With `claude` it SHALL run in the session; with `compozy` it SHALL start
the change's run in CompozyOS; with `script` it SHALL say the driver is not built yet, name its
round and run nothing.

#### Scenario: No settings block
- **WHEN** `openspec/config.yaml` has no `devkit:` block and a request is typed
- **THEN** the command runs as with `driver: claude`

#### Scenario: The CompozyOS driver
- **WHEN** `devkit.driver` is `compozy` and CompozyOS runs on the machine and knows the project
- **THEN** the command starts the change's run in CompozyOS, as the requirement on the CompozyOS driver says, and asks no question of the change in the session

#### Scenario: The script driver
- **WHEN** `devkit.driver` is `script`
- **THEN** the reply says this driver is not built yet and names round 22, and nothing is created or run

#### Scenario: An unknown setting value
- **WHEN** `devkit.driver` holds a value other than `claude`, `compozy` or `script`, or `devkit.language` is not a language tag
- **THEN** the reply names the setting, the value and the accepted values, and nothing is created or run

## ADDED Requirements

### Requirement: On the CompozyOS driver the command starts a run and says where to follow it
With the `compozy` driver, `/devkit change <request>` and `/devkit change <id>` SHALL start one
CompozyOS run of the change, or find the one already running, and SHALL reply in one message with
where to follow it; the session SHALL ask none of the change's questions, and every later question
SHALL reach the owner in CompozyOS.

#### Scenario: A new request
- **WHEN** the owner types `/devkit change add a CSV export` in a project on the CompozyOS driver
- **THEN** the session names the change, starts its CompozyOS run with the request, replies with where to follow it, and ends its turn without asking a question

#### Scenario: A change that already runs
- **WHEN** the owner types `/devkit change add-csv-export` while a CompozyOS run of that change is under way
- **THEN** no second run is started and the reply says the change already runs and where to follow it

#### Scenario: A change whose run ended
- **WHEN** the owner types `/devkit change add-csv-export` and no run of that change is under way
- **THEN** a new run is started and it goes on from the change's files

#### Scenario: A name already taken
- **WHEN** the proposed name of a new request is taken by a change, a branch or a worktree
- **THEN** no run is started and the reply is the one the Claude driver gives for a taken name

### Requirement: On the CompozyOS driver the command starts nothing it cannot start
With the `compozy` driver, `/devkit change` SHALL start no run and create nothing when the name is
not a valid change name, when a new name comes with no request, or when the Claude driver would
refuse the project.

#### Scenario: An invalid name
- **WHEN** the run is asked for the name `Add_CSV`, which is not a valid change name
- **THEN** no run is started, nothing is created, and the reply is the one the Claude driver gives for an invalid name

#### Scenario: A new name with no request
- **WHEN** the run is asked for a name no checkout knows and the request is empty
- **THEN** no run is started, nothing is created, and the command fails saying the request is missing

#### Scenario: A project not set up
- **WHEN** the project's settings name the `compozy` driver but the project has not been set up for devkit
- **THEN** no run is started, nothing is created, and the reply is the one the Claude driver gives for a project not set up

### Requirement: The CompozyOS driver says when CompozyOS cannot run
With the `compozy` driver, `/devkit change` SHALL run nothing and reply in one plain sentence, with
the command that fixes it, when CompozyOS is not installed, its daemon is not running, it does not
know the project as a workspace, or the project has not installed the kit's loops.

#### Scenario: CompozyOS not installed
- **WHEN** the `compozy` command is not found
- **THEN** the reply says CompozyOS is not installed and names the command that installs it, and nothing is created or run

#### Scenario: The daemon stopped
- **WHEN** the CompozyOS daemon does not answer
- **THEN** the reply says CompozyOS is not running and names `compozy daemon start`, and nothing is created or run

#### Scenario: An unknown workspace
- **WHEN** CompozyOS runs but does not know the project's folder
- **THEN** the reply names the command that adds the folder as a workspace, and nothing is created or run

#### Scenario: The kit not installed
- **WHEN** CompozyOS knows the project but has no change loop for it
- **THEN** the reply says the CompozyOS kit is not installed in the project and how to install it, and nothing is created or run
