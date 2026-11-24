<!-- devkit-stage specs result=passed attempt=2 commit=bbb831f9b6dc488a64d519a4d02d3e05ab521e9d -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The project command opens a slice
`/devkit project <slice>`, in a project set up for devkit with the `claude` driver, SHALL create a git
worktree and a branch named after the slice from the default branch and an OpenSpec change of that
name on the `devkit-project` schema, reply with the slice and what comes next, and start the first
stage's conversation in the same session. In a repository with an `origin` remote it SHALL claim the
slice there before it replies, as opening a change does: it commits the slice's folder naming the
machine that opened it and pushes the new branch by a push that only creates it.

#### Scenario: A new slice
- **WHEN** `/devkit project billing` is typed and no change, slice, branch or worktree is named `billing`
- **THEN** a worktree on branch `billing` holds `openspec/changes/billing/` whose `.openspec.yaml` names `devkit-project`, the reply names the slice and the business stage, and the session asks the business phase's first question

#### Scenario: The claim is on the remote
- **WHEN** `/devkit project billing` opens the slice in a repository with an `origin` remote
- **THEN** `origin` has the branch `billing`, its last commit is `chore(openspec): open billing` and holds `openspec/changes/billing/.openspec.yaml` naming this machine's hostname up to its first dot and no number of places, the local branch `billing` is that same commit, and the worktree stays

#### Scenario: The machine's name comes before the recorded versions
- **WHEN** a slice is opened in a repository with an `origin` remote
- **THEN** in its `.openspec.yaml` the line naming the machine comes before the lines recording the pack and flow versions, which stay the last lines of the file

#### Scenario: A slice open on another machine
- **WHEN** `/devkit project billing` is typed while `origin` holds the branch `billing` with `billing`'s folder, whose metadata names `avel`
- **THEN** the open exits 3 with a reply that names `billing` and `avel` and says to continue it there or choose another name, writes no stage record, and leaves no worktree, folder or local branch `billing`

#### Scenario: A slice branch from before the claim
- **WHEN** `/devkit project billing` is typed while `origin` holds the branch `billing` with `billing`'s folder and no machine's name in it
- **THEN** the open exits 3, the reply names `billing` and says it is open on another machine, and nothing is created

#### Scenario: Two machines open one slice at once
- **WHEN** two clones of one repository open the slice `billing` at the same time against one `origin`
- **THEN** exactly one of them exits 0 and `origin`'s branch `billing` is its claim; the other exits 3 with the reply of a slice open on another machine and has no worktree, folder or local branch `billing`

#### Scenario: A push that fails for another reason
- **WHEN** the push of the claim fails for a reason other than the branch already existing on `origin`, for example a remote that refuses the new branch
- **THEN** the open exits 3 with the reply of a request it could not read, as a change's open does, `origin` has no branch `billing`, and the worktree, its folder and the local branch are removed as for any opening that fails half-way

#### Scenario: No remote
- **WHEN** a slice is opened in a repository with no `origin` remote
- **THEN** no commit is made, nothing is pushed, the slice's `.openspec.yaml` names no machine, and the slice is created as before

#### Scenario: A name that cannot be used
- **WHEN** the name is not 2 to 48 lowercase letters and digits in words joined by single dashes, or a change, a branch or a worktree already has that name, here or as a branch on `origin` that holds no folder of that name
- **THEN** the reply says why in one plain sentence and nothing is created

#### Scenario: A slice folder already on the default branch
- **WHEN** `docs/design/billing/` exists on the default branch
- **THEN** the reply says the slice's folder already exists and to choose another name, and nothing is created

#### Scenario: A name already delivered
- **WHEN** `/devkit project billing` is typed and the slice `billing` is already delivered on the default branch
- **THEN** the reply says the slice is already delivered and to choose another name, and nothing is created

#### Scenario: The design pack is not enabled
- **WHEN** the project's `.claude/settings.json` (and `.claude/settings.local.json`) does not enable `devkit-design@devkit`
- **THEN** the reply names the pack and the setup step that enables it, and nothing is created

#### Scenario: A project not set up for devkit
- **WHEN** the project's schema is not `devkit` or `devkit-lite`, a setting is unknown, or the driver is not `claude`
- **THEN** the reply is the one `/devkit change` gives in that project, and nothing is created

### Requirement: The slice readout shows the five stages
The readout of a slice SHALL list the five stages, each as passed, not applicable, ready or blocked,
in the person's language, followed by one line on what comes after the roadmap stage when every stage
is settled. When the slice's metadata names the machine that claimed it, the readout SHALL show that
machine on the line after its title; when it names none, the readout SHALL have no such line.

#### Scenario: A slice in its architecture stage
- **WHEN** the business stage passed, the domain model stage does not apply, and the architecture stage has no record
- **THEN** the readout shows business passed, domain model not applicable, architecture ready, implementation plan and roadmap blocked

#### Scenario: Every stage settled
- **WHEN** the five stages passed or do not apply and the ADR review is pending
- **THEN** the readout shows the five stages and one line saying the ADR review comes next

#### Scenario: A claimed slice
- **WHEN** the slice `billing` was opened on the machine `avel` in a repository with an `origin` remote
- **THEN** the line after the readout's title names `avel`, in the person's language, and the stage lines follow it unchanged

#### Scenario: A slice with no claim
- **WHEN** the slice's metadata names no machine, or names one that is not 1 to 64 letters, digits, dots, underscores or dashes starting with a letter or a digit
- **THEN** the readout has no machine line and is otherwise the same

### Requirement: A slice is not a change of the other commands
`/devkit change`, `/devkit roadmap` and `/devkit status` SHALL never list, resume, start or ask about
a slice, and `/devkit change <slice>` SHALL answer that it names a slice and that `/devkit project
<slice>` continues it. `/devkit project <id>` on a change SHALL answer that `/devkit change <id>`
continues it.

#### Scenario: A slice under way while a change is requested
- **WHEN** the slice `billing` is unfinished and `/devkit change add an export` is typed with no other unfinished change
- **THEN** the change is opened without asking about `billing`

#### Scenario: The slice named to the change command
- **WHEN** `/devkit change billing` is typed
- **THEN** the reply names `/devkit project billing`, and nothing is run

#### Scenario: The board
- **WHEN** `/devkit status` runs while `billing` is unfinished
- **THEN** no row names `billing`

#### Scenario: The board with a slice claimed on the remote
- **WHEN** `/devkit status` runs while `origin` holds the claimed branch of the slice `billing`, opened on this machine or on another one
- **THEN** no row names `billing`, and no roadmap line or machine row counts it
