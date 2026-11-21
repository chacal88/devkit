<!-- devkit-stage specs result=passed attempt=2 commit=6918c0d9f79ec5774fd1d243a544a14d16b87119 -->
# Spec Delta

## ADDED Requirements

### Requirement: A roadmap run is known from the session's own record
A session SHALL be in a roadmap run when the newest slash command typed in it, a typed `/devkit
status` aside, is `/devkit roadmap` (bare or plugin-scoped, with any argument) and a line
`devkit-roadmap: <number>` or `devkit-roadmap: stop` printed by the roadmap loop follows it. A typed
`/devkit status` SHALL neither start nor end a roadmap run. The run of `/devkit change` SHALL be read
as before.

#### Scenario: No roadmap run
- **WHEN** the session's record holds no typed `/devkit roadmap`, or holds one with no `devkit-roadmap:` line after it
- **THEN** the session is in no roadmap run and no roadmap lock refuses anything

#### Scenario: The status command during a roadmap run
- **WHEN** `/devkit status` is typed after `/devkit roadmap 2` and its `devkit-roadmap: 2` line
- **THEN** the session is still in the roadmap run

#### Scenario: Another command typed after the roadmap run
- **WHEN** a slash command other than `/devkit roadmap` and `/devkit status` is typed after the newest `/devkit roadmap`
- **THEN** the session is in no roadmap run

#### Scenario: A stop asked
- **WHEN** the newest typed command is `/devkit roadmap stop` and its `devkit-roadmap: stop` line follows it
- **THEN** the session is in a roadmap run that is stopping

#### Scenario: A change run is unchanged
- **WHEN** `/devkit status` is typed after `/devkit change x` and its `devkit-run: x` line
- **THEN** the session is in no change run, as before this change

### Requirement: The roadmap coordinator does not end its turn while work is ready
When the session in a roadmap run tries to end its turn while the run's decision has a stage of an
open change ready that is not under way, a session step, a wait to start, or a change to start, the
stop SHALL be refused once naming it. It SHALL be allowed when every open change is under way, waits
for the owner or is blocked, while stopping, and on a repeat with nothing changed.

#### Scenario: One change under way, another with a stage ready
- **WHEN** change `a` runs a stage in the background and change `b`'s next stage is ready and not handed
- **THEN** the stop is refused, the reason names `b`, its stage and the command that gives the run's next actions, and the decision's key is recorded

#### Scenario: Every change under way or waiting for the owner
- **WHEN** change `a` runs a stage in the background and change `b` waits for the owner's approval
- **THEN** the stop is allowed

#### Scenario: A change could start
- **WHEN** a place is free, a line is ready and the load is below the limit
- **THEN** the stop is refused, naming the change to start

#### Scenario: A held start being watched
- **WHEN** a start is held by the load and the check of the load runs in the background
- **THEN** the stop is allowed

#### Scenario: The end of one change releases no other
- **WHEN** change `a` was just archived and change `b` has a stage ready that is not handed
- **THEN** the stop is refused, naming `b`

#### Scenario: A stop asked
- **WHEN** the roadmap run is stopping
- **THEN** the stop is allowed

#### Scenario: The same state a second time
- **WHEN** the stop is attempted again and the run's decision has the same key as the one recorded at the refusal
- **THEN** the stop is allowed

#### Scenario: A stage whose end did not reach the session
- **WHEN** a background stage agent of `a` stopped, its end never reached the session, and `a`'s next stage is ready
- **THEN** the session's next stop is refused, naming `a`'s ready stage

### Requirement: In a roadmap run a hand-off names its change
In a roadmap run, the session SHALL hand work only with a prompt that starts with the loop's brief
naming an open change of the roadmap, and only to a role or helper of that change's script under the
rules of a change run. Any other hand-off SHALL be refused with the reason. An allowed hand-off SHALL
mark that change's stage as under way.

#### Scenario: A stage of an open change
- **WHEN** the session hands `devkit-core:change-planner` the brief of open change `a`
- **THEN** the hand-off is allowed and `a`'s stage is under way

#### Scenario: No brief
- **WHEN** the session hands work to a role with a prompt that names no change
- **THEN** the hand-off is refused, and the reason says the prompt must be the brief the loop gave

#### Scenario: A change that is not open
- **WHEN** the brief names a change that is not an open change of the roadmap
- **THEN** the hand-off is refused, naming the open changes

#### Scenario: A role the change's script does not list
- **WHEN** the brief names a change on the short script and the agent is the plan readiness reviewer, which only the full script lists
- **THEN** the hand-off is refused, naming the change, its script and its roles

#### Scenario: A general-purpose agent
- **WHEN** the session in a roadmap run hands work to a general-purpose agent, or with no agent type
- **THEN** the hand-off is refused

#### Scenario: A subagent's own hand-off
- **WHEN** a subagent hands work to another agent during a roadmap run
- **THEN** the hand-off is allowed

### Requirement: A stage agent of a roadmap change delivers before it stops
In a roadmap run, a stage agent's stop SHALL be judged against its own change, found from its
prompt, else from the stage under way for its role when only one is; a stage agent whose change
cannot be found SHALL be allowed to stop. A stop that is allowed SHALL clear that stage as under way.

#### Scenario: Two planners of two changes
- **WHEN** the planners of `a` and `b` run at once, `a`'s proposal is written and `b`'s is missing, and `b`'s planner tries to stop
- **THEN** the stop is refused naming `b`'s missing file, and `a`'s planner is allowed to stop

#### Scenario: The same state a second time
- **WHEN** `b`'s planner tries to stop again with nothing changed
- **THEN** the stop is allowed and `b`'s stage is no longer under way

#### Scenario: An agent whose change cannot be found
- **WHEN** a stage agent's prompt names no change and two stages of its role are under way
- **THEN** the stop is allowed

### Requirement: The session writes no product code in a roadmap run
In a roadmap run, an edit or a shell write by the session itself to a file outside `openspec/` and
`.claude/` SHALL be refused, whatever the script of the changes; planning files, the approval record
and every subagent's writes SHALL follow the existing rules.

#### Scenario: A product edit by the session
- **WHEN** the session in a roadmap run edits `src/a.ts`, by an edit tool or a shell redirect
- **THEN** the edit is refused and the reason says the implementation is handed to the implementer by the loop

#### Scenario: A planning file
- **WHEN** the session in a roadmap run writes a change's `approval.md` or the draft roadmap
- **THEN** the existing rules decide, as outside a run
