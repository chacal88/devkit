<!-- devkit-stage specs result=passed attempt=3 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The devkit command reads its verb
`/devkit` SHALL read the first word of its arguments as the verb and the rest as the request. Only
the verbs `change`, `roadmap`, `status`, `project` and `train` SHALL run anything (`roadmap` and
`status` as the roadmap-coordination capability says, `project` as the project-definition capability
says, `train` as the delivery-train capability says); every other verb SHALL answer in one plain
sentence and create or run nothing.

#### Scenario: A verb of a later round
- **WHEN** the person types `/devkit help`
- **THEN** the reply says in one sentence that the verb is not built yet and names round 23, and no file, branch or worktree is created

#### Scenario: The roadmap and status verbs
- **WHEN** the person types `/devkit roadmap`, `/devkit roadmap 3`, `/devkit roadmap stop` or `/devkit status` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers that verb's mode with the rest of the arguments, creates nothing itself, and the session carries on as the roadmap-coordination capability says

#### Scenario: The project verb
- **WHEN** the person types `/devkit project` or `/devkit project billing` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers the `project` mode with the rest of the arguments, creates nothing itself, and the session carries on as the project-definition capability says

#### Scenario: The train verb
- **WHEN** the person types `/devkit train` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers the `train` mode, creates nothing itself, and the session carries on as the delivery-train capability says

#### Scenario: The train verb with words after it
- **WHEN** the person types `/devkit train now`
- **THEN** the reply says in one sentence that `/devkit train` takes no words after it, and nothing is created or run

#### Scenario: No verb or an unknown verb
- **WHEN** the person types `/devkit` alone or `/devkit` with a word that is not a verb
- **THEN** the reply says in one sentence that `/devkit change`, `/devkit roadmap`, `/devkit status`, `/devkit project` and `/devkit train` exist and what each is for, and nothing is created or run

#### Scenario: A usage error
- **WHEN** the command's script meets an unknown option, a missing argument or an unreadable `openspec/config.yaml`
- **THEN** it exits 3, its reply says in plain words that the request could not be read and to type `/devkit change` with what the person wants done, the reply holds no script name, no option, no file name and no placeholder for a missing change, the raw message is only in the separate error field, which the session does not show, and nothing is created or run

## ADDED Requirements

### Requirement: A boarded change ends its run waiting for the train
In a train project, when the delivery checker reports a change or its archive as boarded, the loop
SHALL end the run waiting for the owner with a reply that says the change is boarded and that
`/devkit train` departs the train, and SHALL hand no stage.

#### Scenario: Boarded at the end of its review
- **WHEN** `alpha`'s review round approves at its head and every other boarding item holds
- **THEN** `change-loop.mjs next --change alpha` exits 1 with an end waiting for the owner whose reply names `/devkit train`

### Requirement: A change on an open train waits on GitHub
When an open train's record lists a change or an archive at its current head, the loop SHALL end the
run waiting on GitHub, naming the train's pull request, SHALL never report that change or archive as
boarded while the train is open, and the background wait SHALL end when that pull request is merged or
closed.

#### Scenario: Riding train 4
- **WHEN** `alpha` is listed in the record of the open pull request of `train/4` at its head
- **THEN** `change-loop.mjs next --change alpha` exits 1 with an end waiting on GitHub naming that pull request

#### Scenario: An archive riding train 4
- **WHEN** the record at the head of the open pull request of `train/4` lists the archive of `gamma` at the head of `gamma`'s archive pull request
- **THEN** `change-loop.mjs next --change gamma` exits 1 with an end waiting on GitHub naming the pull request of `train/4`, and the archive is not reported as boarded

#### Scenario: The train merges
- **WHEN** the pull request of `train/4` merges while the wait for `alpha` runs
- **THEN** the wait ends and the next action is `alpha`'s retro

### Requirement: The setting errors of the train are replies of the command
Every verb that runs (`/devkit change`, `/devkit roadmap`, `/devkit status`, `/devkit project` and
`/devkit train`) SHALL refuse to run, creating nothing, when the train setting is refused, as each does
for a refused delivery model, with a reply in the person's language that names the setting and the
reason, from the message table.

#### Scenario: The train with two pull requests, in Portuguese
- **WHEN** the person's language is `pt-BR` and the block holds `model: two-prs` and a train value
- **THEN** the reply is the table's Portuguese text saying the train runs only with `trunk` or `trunk-auto`, and nothing is created

#### Scenario: The status verb with a refused train
- **WHEN** the block holds `train: "npm test"` and no `model`, and the person types `/devkit status`
- **THEN** the reply says the train needs the model `trunk` or `trunk-auto`, and nothing is created or run
