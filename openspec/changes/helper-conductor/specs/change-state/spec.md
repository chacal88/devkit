<!-- devkit-stage specs result=passed attempt=1 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Without a change the command lists every change in play
Without `--change`, the command SHALL print one entry per unfinished change of `/devkit change` (an
open folder under `openspec/changes/` in any checkout, or an archive branch whose pull request is not
merged) and one per change the roadmap run file names in its starts, its changes in flight, its
declared ends, its claims or its lines for the owner, each id once, in id order, each as for one
change.

#### Scenario: Open folders and the run file
- **WHEN** changes `a` and `b` are open in the main checkout, `c` in a worktree, and the run file names `d` as a start handed, `e` as a declared end and `f` as a claim, none of the three with a folder
- **THEN** the command prints six entries, `a` to `f`, in that order

#### Scenario: What is not listed
- **WHEN** the project holds a `/devkit project` slice, a change archived on the default branch, and the run file announced another change as archived
- **THEN** none of the three is listed

#### Scenario: Nothing in play
- **WHEN** no change is open and the project has no run file
- **THEN** the command prints an empty list and exits 0

### Requirement: The roadmap run file's facts weigh on the state
In a roadmap run the state SHALL follow the run file as the board does: an end the session declared
gives that end; a stage or wait in flight gives `running` or `waiting-on-github`; a line for the owner
gives `waiting-for-owner` with that gate; a live claim gives `running` at the change's stage; an open
roadmap change with no claim, no wait and no line, and a start not yet open, give `running` with the
reason `ready`, "ready, waiting for someone to continue", and only its stage icon in the title.

#### Scenario: Waiting for the next tick
- **WHEN** in a run whose file records its task, roadmap change `a` is open at its design with no claim, no wait and no line
- **THEN** `a` is `running`, its reason is `ready` with "ready, waiting for someone to continue", and its title is `📝 a`

#### Scenario: A start waiting for a place
- **WHEN** the run file records change `x`, which has no folder yet, as a start handed
- **THEN** `x` is `running` with the reason `ready`, its stage is the opening of the change, and its title is `❓ x`

#### Scenario: No session of its own
- **WHEN** a run file written before the run had a task says its changes run in sessions of their own, and roadmap change `a`, open at its plan approval, has no session recorded
- **THEN** that record is not read, and `a` is `waiting-for-owner` only when the run file holds a line for its approval, else `running` with the reason `ready`

#### Scenario: A change with its own session
- **WHEN** a run file written before the run had a task records a session of `a`'s own
- **THEN** that record is not read, and `a`'s state is the one its claim, its waits and its lines give

#### Scenario: A claimed change
- **WHEN** the run file holds a live claim on `a` at its design
- **THEN** `a` is `running` at its design, with no reason

#### Scenario: A line for the owner
- **WHEN** the run file holds a line for `a`'s plan approval
- **THEN** `a` is `waiting-for-owner` at the approval

#### Scenario: A declared end
- **WHEN** the run file holds a blocked end declared for `a` (a stage that could not finish its work) or a wait for the owner's decision on a pull request
- **THEN** `a` is `blocked` with that reason, or `waiting-for-owner` with the reason `waiting-pr-decision`

#### Scenario: Work in flight
- **WHEN** the run file holds a stage of `a` in flight, or a wait on GitHub of `b`
- **THEN** `a` is `running` at that stage and `b` is `waiting-on-github`

#### Scenario: No roadmap run file
- **WHEN** the project has no run file and the loop hands `a`'s proposal to its agent
- **THEN** `a` is plain `running`, with no reason

#### Scenario: A change outside the roadmap
- **WHEN** in a run whose file records its task, open change `z` is not a line of the roadmap
- **THEN** `z`'s state is the loop's, with no `ready` reason
