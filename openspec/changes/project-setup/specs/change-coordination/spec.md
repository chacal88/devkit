<!-- devkit-stage specs result=passed attempt=1 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The devkit command reads its verb
`/devkit` SHALL read the first word of its arguments as the verb and the rest as the request. Only
the verbs `change`, `roadmap`, `status`, `setup` and `project` SHALL run anything (`roadmap` and
`status` as the roadmap-coordination capability says, `project` as the project-definition capability
says, `setup` as the project-setup capability says); every other verb SHALL answer in one plain
sentence and create or run nothing. `setup` outside a git repository SHALL answer in one plain
sentence that it runs inside one, and run nothing.

#### Scenario: A verb of a later round
- **WHEN** the person types `/devkit help`
- **THEN** the reply says in one sentence that the verb is not built yet and names round 23, and no file, branch or worktree is created

#### Scenario: The roadmap and status verbs
- **WHEN** the person types `/devkit roadmap`, `/devkit roadmap 3`, `/devkit roadmap stop` or `/devkit status` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers that verb's mode with the rest of the arguments, creates nothing itself, and the session carries on as the roadmap-coordination capability says

#### Scenario: The project verb
- **WHEN** the person types `/devkit project` or `/devkit project billing` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers the `project` mode with the rest of the arguments, creates nothing itself, and the session carries on as the project-definition capability says

#### Scenario: The setup verb
- **WHEN** the person types `/devkit setup` in any folder of a git repository, set up for devkit or not, whatever its driver and the values of its settings, with an `openspec/config.yaml` that is absent or can be read
- **THEN** the command's script answers the `setup` mode, creates nothing itself, and the session carries on as the project-setup capability says

#### Scenario: The setup verb outside a git repository
- **WHEN** the person types `/devkit setup` in a folder that is in no git repository
- **THEN** the command's script answers the `setup-no-repo` mode, whose reply says in one sentence that `/devkit setup` runs inside a git repository, and nothing is created or run

#### Scenario: No verb or an unknown verb
- **WHEN** the person types `/devkit` alone or `/devkit` with a word that is not a verb, `/devkit setups` included
- **THEN** the reply says in one sentence that `/devkit change`, `/devkit roadmap`, `/devkit status`, `/devkit setup` and `/devkit project` exist and what each is for, and nothing is created or run

#### Scenario: A usage error
- **WHEN** the command's script meets an unknown option, a missing argument or an unreadable `openspec/config.yaml`
- **THEN** it exits 3, its reply says in plain words that the request could not be read and to type `/devkit change` with what the person wants done, the reply holds no script name, no option, no file name and no placeholder for a missing change, the raw message is only in the separate error field, which the session does not show, and nothing is created or run

### Requirement: The command runs only in a project set up for devkit
`/devkit change` SHALL run nothing in a folder without `openspec/`, or whose project schema is not
`devkit` or `devkit-lite`, and SHALL say so in one plain sentence that names `/devkit setup`.

#### Scenario: A project not set up
- **WHEN** `/devkit change add an export` is typed in a project whose `openspec/config.yaml` selects another schema
- **THEN** the reply says the project is not set up for devkit and names `/devkit setup`, and nothing is created
