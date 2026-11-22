<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: The project script declares the slice's stages
The `devkit-project` schema SHALL declare, as OpenSpec artifacts and in this order, `business`,
`domain-model`, `architecture`, `implementation-plan`, `roadmap` and `review`, with no `apply`
requirement and no spec artifact, and its stage declaration SHALL list `open` first and `delivery`
last around them.

#### Scenario: A new slice lists its stages
- **WHEN** a change is created with the shipped `devkit-project` schema and `openspec status --change <id> --json` is read
- **THEN** its `artifacts` ids are exactly that list, in that order, and its `.openspec.yaml` sets `skip_specs: true`

#### Scenario: The declaration around them
- **WHEN** the `devkit-project` stage declaration is read
- **THEN** its stage ids are `open`, the six artifacts in order, and `delivery`, the review declares a ceiling of 2 and the architecture stage as its fix stage

### Requirement: The project script follows the declaration rules
The `devkit-project` schema SHALL hold a stage declaration whose stages with a file are its status
artifacts with the same file names, templates that each start with their stage's header with
`result=pending`, no tool of one platform or `devkit-core:` agent type in any instruction, template
or declaration, a role document section for every role it names, and two copies kept byte-identical.

#### Scenario: Templates and declaration agree
- **WHEN** the `devkit-project` templates, `flow.json` and `schema.yaml` are read
- **THEN** each artifact's `generates` is its stage's file, and each template's first line is that stage's header with `result=pending`

#### Scenario: No platform tool and every role documented
- **WHEN** the schema's files are searched for `devkit-core:`, `subagent_type`, `Agent tool`, `AskUserQuestion`, `Workflow tool` and `Claude`, and its roles are looked up in the role document
- **THEN** none of those words is found and `project-coordinator`, `adr-reviewer` and `commit-and-pr` each have a section

#### Scenario: Agents declare the stage skills
- **WHEN** the agents of the roles the declaration names are compared with it
- **THEN** each shipped role's agent lists exactly its stages' skills, and only `project-coordinator`, besides the roles already exempt, has no agent file

#### Scenario: The two copies
- **WHEN** `plugins/openspec/schemas/devkit-project/` and `openspec/schemas/devkit-project/` are compared
- **THEN** every file is byte-identical

### Requirement: A stage the script does not declare is never offered
When the walk would offer a stage that the change's stage declaration does not hold, the checker SHALL
end the run as blocked, naming the stage the script lacks, instead of offering it.

#### Scenario: A delivered slice with no retro stage
- **WHEN** every stage of an active `devkit-project` change passed, its delivery included
- **THEN** the run ends blocked saying the script declares no retro stage, and no next stage is given

#### Scenario: A failing check on a script with no implementation stage
- **WHEN** the delivery of an active `devkit-project` change reads a failing check on its pull request
- **THEN** the run ends blocked saying the script declares no implementation stage, and names the failing check
