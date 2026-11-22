<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The devkit command reads its verb
`/devkit` SHALL read the first word of its arguments as the verb and the rest as the request. Only
the verbs `change`, `roadmap`, `status` and `project` SHALL run anything (`roadmap` and `status` as the
roadmap-coordination capability says, `project` as the project-definition capability says); every
other verb SHALL answer in one plain sentence and create or run nothing.

#### Scenario: A verb of a later round
- **WHEN** the person types `/devkit help`
- **THEN** the reply says in one sentence that the verb is not built yet and names round 23, and no file, branch or worktree is created

#### Scenario: The roadmap and status verbs
- **WHEN** the person types `/devkit roadmap`, `/devkit roadmap 3`, `/devkit roadmap stop` or `/devkit status` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers that verb's mode with the rest of the arguments, creates nothing itself, and the session carries on as the roadmap-coordination capability says

#### Scenario: The project verb
- **WHEN** the person types `/devkit project` or `/devkit project billing` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers the `project` mode with the rest of the arguments, creates nothing itself, and the session carries on as the project-definition capability says

#### Scenario: No verb or an unknown verb
- **WHEN** the person types `/devkit` alone or `/devkit` with a word that is not a verb
- **THEN** the reply says in one sentence that `/devkit change`, `/devkit roadmap`, `/devkit status` and `/devkit project` exist and what each is for, and nothing is created or run

#### Scenario: A usage error
- **WHEN** the command's script meets an unknown option, a missing argument or an unreadable `openspec/config.yaml`
- **THEN** it exits 3, its reply says in plain words that the request could not be read and to type `/devkit change` with what the person wants done, the reply holds no script name, no option, no file name and no placeholder for a missing change, the raw message is only in the separate error field, which the session does not show, and nothing is created or run
