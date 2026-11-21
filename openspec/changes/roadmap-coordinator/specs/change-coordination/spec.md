<!-- devkit-stage specs result=passed attempt=2 commit=6918c0d9f79ec5774fd1d243a544a14d16b87119 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The devkit command reads its verb
`/devkit` SHALL read the first word of its arguments as the verb and the rest as the request. Only
the verbs `change`, `roadmap` and `status` SHALL run anything (`roadmap` and `status` as the
roadmap-coordination capability says); every other verb SHALL answer in one plain sentence and create
or run nothing.

#### Scenario: A verb of a later round
- **WHEN** the person types `/devkit project` or `/devkit help`
- **THEN** the reply says in one sentence that the verb is not built yet and names round 19 or 23 respectively, and no file, branch or worktree is created

#### Scenario: The roadmap and status verbs
- **WHEN** the person types `/devkit roadmap`, `/devkit roadmap 3`, `/devkit roadmap stop` or `/devkit status` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers that verb's mode with the rest of the arguments, creates nothing itself, and the session carries on as the roadmap-coordination capability says

#### Scenario: No verb or an unknown verb
- **WHEN** the person types `/devkit` alone or `/devkit` with a word that is not a verb
- **THEN** the reply says in one sentence that `/devkit change`, `/devkit roadmap` and `/devkit status` exist and what each is for, and nothing is created or run

#### Scenario: A usage error
- **WHEN** the command's script meets an unknown option, a missing argument or an unreadable `openspec/config.yaml`
- **THEN** it exits 3, its reply says in plain words that the request could not be read and to type `/devkit change` with what the person wants done, the reply holds no script name, no option, no file name and no placeholder for a missing change, the raw message is only in the separate error field, which the session does not show, and nothing is created or run

### Requirement: Replies use no internal term
Every reply of the command SHALL come from one message table with the same keys in English and in
Brazilian Portuguese, and SHALL hold no stage id or role id with a dash, no step name of a checker,
no file name and no checker name; the reply of a usage error is one of them.

#### Scenario: The message table is checked
- **WHEN** every message and parameter of the table is rendered in both languages, the usage error's reply included
- **THEN** none holds a backtick, a file name, a hyphenated stage, role or step id, a checker's reason code, a checker's name, the loop script's name, the roadmap script's name, a setting's key, an option or a placeholder for a missing change, both languages have the same keys, and no Portuguese string equals its English one except the two that are the same word in both languages, the driver's name CompozyOS and the setting name driver, and the three that hold only parameters and punctuation: the line saying where a change stays, the owner's need in the list of a run that ends, and the bare stage title of a board row

#### Scenario: A usage error's reply in both languages
- **WHEN** the command's script exits 3 on an unknown option, in English and in Brazilian Portuguese
- **THEN** the reply is the usage error's message of the table in that language, and the raw error, with the script's name and options, is only in the error field

## ADDED Requirements

### Requirement: Two openings at once do not collide
Opening a change SHALL be serialized per repository: while one opening runs, another SHALL wait for
it, up to one minute, and then go on. Each opening alone SHALL behave as before; two openings of two
ids SHALL both create their change, and two of one id SHALL create it once.

#### Scenario: Two ids at once
- **WHEN** the opening of `a` and the opening of `b` are started at the same moment in one repository
- **THEN** both worktrees, branches and change folders exist, and each requirements file holds its own request

#### Scenario: One id twice at once
- **WHEN** two openings of `a` are started at the same moment
- **THEN** one creates the change and the other is refused because the name is taken, and nothing of the second is left behind

#### Scenario: A lock left by a dead opening
- **WHEN** an opening finds a lock older than ten minutes
- **THEN** it takes the lock over and opens the change
