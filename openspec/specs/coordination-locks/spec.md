# coordination-locks Specification

## Purpose
Holds a `/devkit change` run in the Claude driver: the session running it does not end its turn
while a stage is ready, a stage agent does not stop before delivering its stage file, and the session
writes no product code and hands work only to the roles of the change's script. No lock acts outside
a run, and none can trap a session.

## Requirements

### Requirement: A run is known from the session's own record
A session SHALL be in a run of a change when the newest slash command typed in it is `/devkit change`
(bare or plugin-scoped) and a line `devkit-run: <id>` printed by the loop follows it; the change of
the run SHALL be the newest such id. The run's last recorded action SHALL be an end while the newest
`devkit-run:` or `devkit-end:` line after that command is an end line. Nothing else SHALL be remembered.

#### Scenario: No run
- **WHEN** the session's record holds no typed `/devkit change`, or holds one with no `devkit-run:` line after it
- **THEN** the session is in no run and no lock of this capability refuses anything

#### Scenario: Another command typed after the run
- **WHEN** a slash command other than `/devkit` was typed after the newest `/devkit change`
- **THEN** the session is in no run

#### Scenario: The run's change
- **WHEN** two `devkit-run:` lines follow the newest `/devkit change`
- **THEN** the run's change is the id of the later line

#### Scenario: The run's last recorded action is an end
- **WHEN** the newest line after the newest `/devkit change` is `devkit-end: <id> blocked`, printed after the `devkit-run: <id>` line of the same output or by the session's own declaration of an end
- **THEN** the session is still in a run of that change, and its last recorded action is an end

#### Scenario: A new action after an end
- **WHEN** a `devkit-run:` line follows the newest `devkit-end:` line
- **THEN** the run's last recorded action is not an end

#### Scenario: The other locks after an end
- **WHEN** the run's last recorded action is an end and the session edits `src/a.ts` of a short-script change or hands work to a general-purpose agent
- **THEN** the edit and the hand-off are refused as in any run: only the stop lock reads the end

### Requirement: The coordinator does not end its turn while a stage is ready
When the session in a run tries to end its turn while the loop's next action hands a stage to an
agent or is a session step, the stop SHALL be refused once with that stage named; it SHALL be allowed
in the four end states, whether the loop computes the end or the run's record holds one, during the
grill, while a background task runs, and on a repeat with nothing changed.

#### Scenario: A stage is ready
- **WHEN** the session in a run tries to stop, the run's last recorded action is not an end, and the next action is an agent hand-off or a session step whose progress key was not refused before
- **THEN** the stop is refused, the reason names the change, the stage and the command that gives the next action, and the key is recorded

#### Scenario: An end state
- **WHEN** the next action is an end (archived, waiting for the owner, waiting on GitHub or blocked)
- **THEN** the stop is allowed

#### Scenario: An end the session declared after a failed stage agent
- **WHEN** a stage agent returned a failure, the session declared the run blocked (its record ends with `devkit-end: <id> blocked`), and the next action computed now would hand that stage to its agent again
- **THEN** the stop is allowed at the first attempt

#### Scenario: An end the session declared after a red gate
- **WHEN** a phase gate ran red, the session declared the run blocked, and the next action computed now would be the same gate step
- **THEN** the stop is allowed at the first attempt

#### Scenario: A no-progress end
- **WHEN** the loop, called with the previous action's progress key, ended the run blocked because nothing changed (its output ends with `devkit-end: <id> blocked`), and the next action computed now with no previous key hands that stage to its agent
- **THEN** the stop is allowed at the first attempt

#### Scenario: The owner goes on after a declared end
- **WHEN** after a declared end the owner's next message leads the session to call the loop again, which prints `devkit-run: <id>` and a ready stage whose progress key was not refused before, and the session tries to stop
- **THEN** the stop is refused, naming that stage

#### Scenario: The grill waits for the owner
- **WHEN** the next action is the grill
- **THEN** the stop is allowed

#### Scenario: A background task runs
- **WHEN** the stop's input lists a background task
- **THEN** the stop is allowed

#### Scenario: The same state a second time
- **WHEN** the stop is attempted again and the next action's progress key equals the one recorded at the refusal
- **THEN** the stop is allowed

#### Scenario: The owner interrupts
- **WHEN** the person interrupts the session's turn
- **THEN** no stop event reaches the lock and nothing is refused

### Requirement: A stage agent does not stop before its stage file is delivered
When a subagent whose role is the role of the stage the checker names next tries to stop while that
stage's file is missing, or its header still says pending or is not a valid header for the stage, the
stop SHALL be refused once with the file named.

#### Scenario: The stage file is missing
- **WHEN** the planner's agent tries to stop in a run and the next stage is the proposal with no `proposal.md`
- **THEN** the stop is refused and the reason names `proposal.md`

#### Scenario: The stage file is pending
- **WHEN** the readiness reviewer's agent tries to stop and `readiness.md` says `result=pending` or has no valid stage header
- **THEN** the stop is refused and the reason names `readiness.md`

#### Scenario: The same state a second time
- **WHEN** that agent tries to stop again with nothing changed since the refusal
- **THEN** the stop is allowed

#### Scenario: The stage is delivered
- **WHEN** the agent's stage file has a passed, failed or not-applicable header, so the checker's next stage belongs to another role
- **THEN** the stop is allowed

#### Scenario: An agent that has no stage file
- **WHEN** a reviewer, a helper, the implementer or the commit-and-pr agent stops
- **THEN** the stop is allowed

#### Scenario: Outside a run
- **WHEN** a stage agent stops in a session that is in no run
- **THEN** the stop is allowed

#### Scenario: A stage agent of a change in its own worktree
- **WHEN** the change lives in its own worktree, the session runs from the main checkout (the stop's working directory is the main checkout, which has no folder for the change), and the planner's agent tries to stop while the worktree has no `proposal.md`
- **THEN** the stop is refused and the reason names `proposal.md`

### Requirement: The coordinator writes no product code in a run
In a run, an edit or a shell write by the session itself to a file outside `openspec/` and `.claude/`
SHALL be refused with the reason, on both scripts. Planning files, the approval record and every
subagent's writes SHALL follow the existing rules, and so SHALL everything outside a run.

#### Scenario: A product edit by the session
- **WHEN** the session in a run of a short-script change edits `src/a.ts`, by an edit tool or a shell redirect
- **THEN** the edit is refused and the reason says the implementation is handed to the implementer by the loop

#### Scenario: A planning file
- **WHEN** the session in a run edits the change's `tasks.md` or writes `approval.md`
- **THEN** the existing rules decide, as outside a run

#### Scenario: Outside a run
- **WHEN** the session edits `src/a.ts` of a short-script change in a session with no run
- **THEN** the edit is allowed, as today

#### Scenario: A subagent's edit
- **WHEN** the implementer's agent edits product code during a run
- **THEN** the existing rules decide, as outside a run

### Requirement: The coordinator hands work only to the script's roles
In a run, the session SHALL hand work only to a role or a helper of a stage of the change's script,
named with no prefix or with the prefix of the devkit pack that ships that role's agent; any other
hand-off, one with no agent type included, SHALL be refused with the reason listing the roles it may
use. Outside a run every hand-off SHALL be allowed, as today.

#### Scenario: A role of the script
- **WHEN** the session in a run hands work to `devkit-core:change-planner`, a reviewer of `devkit-core`, `devkit-openspec:openspec-validator` or another role or helper of the change's script under the prefix of the pack that ships it
- **THEN** the hand-off is allowed

#### Scenario: A project's own agent named like a role
- **WHEN** the session in a run hands work to `change-planner` with no prefix
- **THEN** the hand-off is allowed

#### Scenario: Another agent
- **WHEN** the session in a run hands work to a general-purpose agent, the explore agent or an agent of another plugin whose name is not a role
- **THEN** the hand-off is refused and the reason names the script and its roles

#### Scenario: Another plugin's agent named like a role
- **WHEN** the session in a run hands work to `other-plugin:change-planner`, or to a devkit pack's prefix that does not ship that role, such as `devkit-openspec:change-planner`
- **THEN** the hand-off is refused and the reason names the script and its roles

#### Scenario: A hand-off with no agent type
- **WHEN** the session in a run calls the agent tool with no agent type, or with an empty one
- **THEN** the hand-off is refused and the reason says an agent type of the script's roles is needed and lists them

#### Scenario: A hand-off from the main checkout to a change in its own worktree
- **WHEN** the change lives in its own worktree, the session runs from the main checkout, and the session hands work to `devkit-core:change-planner` and then to a general-purpose agent
- **THEN** the first hand-off is allowed and the second is refused, the roles being read from the script of the change in its worktree

#### Scenario: Outside a run
- **WHEN** the session hands work to any agent, with or without an agent type and whatever its prefix, in a session with no run
- **THEN** the hand-off is allowed

#### Scenario: A subagent's own hand-off
- **WHEN** a subagent hands work to another agent during a run
- **THEN** the hand-off is allowed

### Requirement: A lock never traps
Every lock of this capability SHALL allow the action when it cannot read the session's record, the
checkers, git or GitHub, in a project that has not opted in to devkit, and when the session was
started with `DEVKIT_BYPASS=1`.

#### Scenario: An error while deciding
- **WHEN** the checker fails or the session's record cannot be read while a lock decides
- **THEN** the action is allowed

#### Scenario: A project that has not opted in
- **WHEN** the project's schema is not `devkit` or `devkit-lite`
- **THEN** no lock of this capability refuses anything

#### Scenario: Bypass
- **WHEN** the session was started with `DEVKIT_BYPASS=1`
- **THEN** no lock of this capability refuses anything

### Requirement: Lock decisions can be recorded
When the session was started with `DEVKIT_HOOK_LOG` naming a file, each decision of the two stop locks
and of the hand-off lock SHALL be appended to it as one JSON line; without it nothing SHALL be written.

#### Scenario: A recorded refusal
- **WHEN** `DEVKIT_HOOK_LOG` names a file and the coordinator's stop is refused
- **THEN** the file gains one line with the mode, the session, the change, the decision and its reason

#### Scenario: No log asked
- **WHEN** `DEVKIT_HOOK_LOG` is not set
- **THEN** no lock writes any file other than its refusal record
