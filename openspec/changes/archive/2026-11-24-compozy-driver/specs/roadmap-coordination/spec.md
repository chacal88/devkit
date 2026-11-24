<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The run and the status command run only where the change command runs
`/devkit roadmap` and `/devkit status` SHALL answer as `/devkit change` does, and run nothing, in a
folder without `openspec/`, in a project whose schema is not `devkit` or `devkit-lite`, with an
unknown setting, and with the `script` driver. With the `compozy` driver they SHALL run as the
requirement on the CompozyOS roadmap says.

#### Scenario: A project not set up
- **WHEN** `/devkit roadmap` or `/devkit status` is typed in a project whose schema is another one
- **THEN** the reply says the project is not set up for devkit, and nothing is started or written

#### Scenario: Another driver
- **WHEN** `devkit.driver` is `script` and `/devkit roadmap` is typed
- **THEN** the reply says that driver is not built yet and names round 22, and nothing is started

#### Scenario: The CompozyOS driver
- **WHEN** `devkit.driver` is `compozy` and `/devkit roadmap 2` is typed
- **THEN** the roadmap runs in CompozyOS, and the session starts no change itself

## ADDED Requirements

### Requirement: On the CompozyOS driver the roadmap runs in CompozyOS
With the `compozy` driver, `/devkit roadmap [<n>]` SHALL start one CompozyOS roadmap run and reply
with where to follow it. The run SHALL start, on its own, every ready line up to `<n>` open at once,
each as one CompozyOS change run, SHALL hold new starts while the machine's load is above the
person's `load_limit`, and SHALL go on with Claude Code closed.

#### Scenario: Two places and three ready lines
- **WHEN** the roadmap has three ready lines, none open, and the owner types `/devkit roadmap 2`
- **THEN** two change runs start in CompozyOS and the third line waits for a free place

#### Scenario: A loaded machine
- **WHEN** a place is free and the load is above `load_limit`
- **THEN** no change run starts until the load falls below it

#### Scenario: An archive frees the next line
- **WHEN** a change of the run is archived and a line whose `after:` names it becomes ready
- **THEN** the roadmap run starts that line's change run, with no Claude Code session open

#### Scenario: A new number
- **WHEN** a roadmap run is under way with two places and the owner types `/devkit roadmap 3`
- **THEN** the run goes on with three places, and no change under way is interrupted

#### Scenario: The run ends
- **WHEN** every line of the roadmap is archived, or nothing can start and no change run is under way
- **THEN** the roadmap run ends

### Requirement: On the CompozyOS driver stop and status keep their meaning
With the `compozy` driver, `/devkit roadmap stop` SHALL start nothing new, let each change run under
way finish the step it is in and pause there, and reply where each open change stays; a later
`/devkit roadmap` SHALL resume the paused runs. `/devkit status` SHALL show the same board and add
how many requests wait for the owner in CompozyOS.

#### Scenario: Stop with two change runs under way
- **WHEN** the owner types `/devkit roadmap stop` while two change runs are under way
- **THEN** the roadmap run ends, each change run pauses after its current step, and the reply says where each change stays

#### Scenario: Status on the CompozyOS driver
- **WHEN** the owner types `/devkit status` and two CompozyOS requests wait for the owner
- **THEN** the board is shown as on the Claude driver, with one line saying two questions wait in CompozyOS

#### Scenario: CompozyOS not running
- **WHEN** the owner types `/devkit roadmap` on the CompozyOS driver and the daemon does not answer
- **THEN** the reply says CompozyOS is not running and names `compozy daemon start`, and nothing is started
