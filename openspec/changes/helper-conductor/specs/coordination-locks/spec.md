<!-- devkit-stage specs result=passed attempt=3 commit=0c64ce1bf67c10215f0db9357142192c2b28fcdd -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A run is known from the session's own record
A session SHALL be in a run of a change when the newest slash command typed in it is `/devkit change`
(bare or plugin-scoped) and a line `devkit-run: <id>` printed by the loop follows it; the change of
the run SHALL be the newest such id. The task another session started this session with, in the
host's form of a started session, SHALL count as a command typed in it, whatever lines follow its
first line and whatever notes of the host come before that form. The run's last recorded action SHALL
be an end while the newest `devkit-run:` or
`devkit-end:` line after that command is an end line that names the run's change; an end line that
names another change SHALL be read as if it were absent. Nothing else SHALL be remembered.

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

#### Scenario: A session started by another session
- **WHEN** a session's first message is the host's form of a session started by another session, with a background block and then the task `/devkit-openspec:devkit change a`, and a `devkit-run: a` line follows it
- **THEN** the session is in a run of `a`, and its product edits and its hand-offs follow the rules of a change run

#### Scenario: A started task after a note of the host
- **WHEN** the session's first message begins with a note of the host (a `<system-reminder>` block), then the started form with the task `/devkit-openspec:devkit change a`, and a `devkit-run: a` line follows the message
- **THEN** the session is in a run of `a`

#### Scenario: Words before the started form
- **WHEN** the session's first message begins with any other line before the started form
- **THEN** that message is not read as the started form

#### Scenario: A command named inside a message
- **WHEN** a message the owner typed holds `/devkit change a` on a line other than its first, and is not the host's form of a started session
- **THEN** that message is not a typed command

#### Scenario: A started task with a start line
- **WHEN** the task is `/devkit-openspec:devkit change a` followed by a line of its own, and a `devkit-run: a` line follows the message
- **THEN** the session is in a run of `a`

#### Scenario: The periodic check's prompt
- **WHEN** a scheduled task fires in a session with a prompt whose first line is no slash command
- **THEN** the prompt is no typed command

#### Scenario: The tick's prompt
- **WHEN** the scheduled task of a roadmap run fires, its first message holding the scheduler's header and the `<scheduled-task>` tag around the line `devkit-roadmap-tick: <root>`
- **THEN** the session is in no run of a change, and is in the roadmap run once the tick's `devkit-roadmap:` line follows

#### Scenario: An end naming another change
- **WHEN** the run's change is `feat`, the newest line after the newest `/devkit change` is `devkit-end: other blocked` after the newest `devkit-run: feat`, and a stage of `feat` is ready
- **THEN** the run's last recorded action is not an end, and the stop is refused once, naming that stage

#### Scenario: An end naming the run's change
- **WHEN** the run's change is `feat`, its record ends with `devkit-end: feat waiting-for-owner` after the newest `devkit-run: feat`, and a stage of `feat` is ready
- **THEN** the run's last recorded action is an end, and the stop is allowed at the first attempt

#### Scenario: The owner's pause declared
- **WHEN** the session ended its turn after `change-loop.mjs reply waiting-pause --param id=feat` printed `devkit-end: feat waiting-for-owner`, while a stage of `feat` is ready
- **THEN** the stop is allowed at the first attempt

#### Scenario: A decision outside the gates declared
- **WHEN** the session ended its turn after `change-loop.mjs reply waiting-owner-decision --param id=feat --param decision="the dependency upgrade"` printed `devkit-end: feat waiting-for-owner`, while a stage of `feat` is ready
- **THEN** the stop is allowed at the first attempt

#### Scenario: The same turn without the declared end
- **WHEN** the session tries to stop with neither declared end in its record and a stage of `feat` ready
- **THEN** the stop is refused once, naming that stage

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

#### Scenario: A change session waiting for a place
- **WHEN** a session whose first message is the started form of `/devkit-openspec:devkit change a` tries to stop, `a`'s implementation is ready, and every place of a roadmap run is taken
- **THEN** the stop is judged as in any change run: refused once, naming the implementation

#### Scenario: A change session with its place
- **WHEN** the same session tries to stop again with nothing changed
- **THEN** the stop is allowed

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

#### Scenario: The entry cannot read
- **WHEN** a skill named `devkit-session` is called and the session's record cannot be read
- **THEN** no lock refuses the call, because no lock decides a skill call

#### Scenario: A skill call
- **WHEN** any session calls any skill
- **THEN** no lock of this capability refuses the call

### Requirement: Lock decisions can be recorded
When the session was started with `DEVKIT_HOOK_LOG` naming a file, each decision of the two stop locks,
of the hand-off lock and of the tick's prompt hook SHALL be appended to it as one JSON line; without it
nothing SHALL be written.

#### Scenario: A recorded refusal
- **WHEN** `DEVKIT_HOOK_LOG` names a file and the coordinator's stop is refused
- **THEN** the file gains one line with the mode, the session, the change, the decision and its reason

#### Scenario: A recorded entry
- **WHEN** `DEVKIT_HOOK_LOG` names a file and a session calls a skill
- **THEN** no line is written for the call, because no lock decides it

#### Scenario: A recorded tick
- **WHEN** `DEVKIT_HOOK_LOG` names a file and the tick's prompt hook blocks an empty tick
- **THEN** the file gains one line with the mode `prompt`, the session, the decision and its reason

#### Scenario: No log asked
- **WHEN** `DEVKIT_HOOK_LOG` is not set
- **THEN** no lock writes any file other than its refusal record

### Requirement: A roadmap run is known from the session's own record
A session SHALL be in a roadmap run when the newest slash command typed in it, a typed `/devkit
status` aside, is `/devkit roadmap` (bare or plugin-scoped, with any argument, `tick` included) and a
line `devkit-roadmap: <number>` or `devkit-roadmap: stop` printed by the roadmap loop follows it. A
first message that the run's scheduled task started (the scheduler's header, then a
`<scheduled-task>` tag of the run's task holding the line `devkit-roadmap-tick: <root>` for the
session's own project) SHALL count as a typed `/devkit roadmap tick`. A typed `/devkit
status` SHALL neither start nor end a roadmap run. The run of `/devkit change` SHALL be read as before.

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

#### Scenario: A tick's session
- **WHEN** the session's first message is the scheduler's firing of the run's task, its tag holding `devkit-roadmap-tick: <root>` for this project, and a `devkit-roadmap: 2` line follows it
- **THEN** the session is in the roadmap run

#### Scenario: Another scheduled task, or another project
- **WHEN** the session's first message is the scheduler's firing of a task of another name, or its line names another project's root
- **THEN** the session is in no roadmap run

#### Scenario: The words typed later
- **WHEN** the owner types the line `devkit-roadmap-tick: <root>` in a later message of a session
- **THEN** that message does not make the session a tick's

#### Scenario: A change run is unchanged
- **WHEN** `/devkit status` is typed after `/devkit change x` and its `devkit-run: x` line
- **THEN** the session is in no change run, as before this change

### Requirement: The roadmap coordinator does not end its turn while work is ready
In a roadmap run whose file records no scheduled task, when the session tries to end its turn while
the run's decision has a stage of an open change ready that is not under way, a session step, a wait
to start or a change to start, the stop SHALL be refused once naming it. It SHALL be allowed when
every open change is under way, waits for the owner or is blocked, while stopping, and on a repeat
with nothing changed. A run whose file records its task SHALL be judged as "A conducted run's sessions
stop as its ticks need" says.

#### Scenario: One change under way, another with a stage ready
- **WHEN** the run file records no task, change `a` runs a stage in the background and change `b`'s next stage is ready and not handed
- **THEN** the stop is refused, the reason names `b`, its stage and the command that gives the run's next actions, and the decision's key is recorded

#### Scenario: Every change under way or waiting for the owner
- **WHEN** the run file records no task, change `a` runs a stage in the background and change `b` waits for the owner's approval
- **THEN** the stop is allowed

#### Scenario: A change could start
- **WHEN** the run file records no task, a place is free, a line is ready and the load is below the limit
- **THEN** the stop is refused, naming the change to start

#### Scenario: A held start being watched
- **WHEN** the run file records no task, a start is held by the load and the check of the load runs in the background
- **THEN** the stop is allowed

#### Scenario: The end of one change releases no other
- **WHEN** the run file records no task, change `a` was just archived and change `b` has a stage ready that is not handed
- **THEN** the stop is refused, naming `b`

#### Scenario: A stop asked
- **WHEN** the roadmap run is stopping
- **THEN** the stop is allowed

#### Scenario: The same state a second time
- **WHEN** the stop is attempted again and the run's decision has the same key as the one recorded at the refusal
- **THEN** the stop is allowed

#### Scenario: A stage whose end did not reach the session
- **WHEN** the run file records no task, a background stage agent of `a` stopped, its end never reached the session, and `a`'s next stage is ready
- **THEN** the session's next stop is refused, naming `a`'s ready stage

#### Scenario: A watch of the load that died
- **WHEN** the run file records no task, a start is held by the load, the run's mark says a watch runs, but the process of that watch has ended
- **THEN** the stop is refused once, naming the held change and the watch to start

#### Scenario: Every change in its own session
- **WHEN** a run file written before this change says its changes run in sessions of their own and records no task
- **THEN** that record is not read, and the stop is judged as in a run whose changes run in the coordinating session

#### Scenario: A change session to start on a typed turn
- **WHEN** in such a run file an open change `a` has no session of its own recorded
- **THEN** no session start is asked for, and the stop is refused only for `a`'s ready stage, as for any change of the run

#### Scenario: A start on a turn nobody typed
- **WHEN** in such a run file the last decision recorded a turn nobody typed
- **THEN** that record is not read, and a ready line with a place free refuses the stop once, naming it

### Requirement: In a roadmap run a hand-off names its change
In a run whose file records no task, the session SHALL hand work only with a prompt that starts with
the loop's brief naming an open change of the roadmap, and only to a role or helper of that change's
script under the rules of a change run, an allowed hand-off marking that stage under way. In a run
whose file records its task, the typed session SHALL hand nothing, and a tick's session SHALL hand only
a role of its claimed change's script, or the read-only researcher of the check before its opening,
with the brief naming that change; a tick's session with no live claim SHALL hand nothing.

#### Scenario: A stage of an open change
- **WHEN** in a run file with no task the session hands `devkit-core:change-planner` the brief of open change `a`
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

#### Scenario: A hand-off when every change has its own session
- **WHEN** a run file written before this change says its changes run in sessions of their own and records no task, and the session hands `devkit-core:change-planner` the brief of open change `a`
- **THEN** that record is not read: the hand-off is allowed and `a`'s stage is under way

#### Scenario: The grill's triage when every change has its own session
- **WHEN** the run file records its task and the typed session hands `devkit-core:requirements-triage` the brief of open change `a`'s requirements
- **THEN** the hand-off is refused, because the triage runs in `a`'s helper

#### Scenario: The triage with no brief, or for a change not open
- **WHEN** in a run file with no task the session hands `devkit-core:requirements-triage` a prompt that names no change, or names a change that is not open on the roadmap
- **THEN** the hand-off is refused

#### Scenario: The triage for a change on an older flow
- **WHEN** in a run file with no task the session hands `devkit-core:requirements-triage` the brief of open change `a`, whose `.openspec.yaml` records no flow version or version 1, with flow 2 installed
- **THEN** the hand-off is refused, because the flow `a` follows does not list the triage among its grill's helpers

#### Scenario: The typed session of a conducted run
- **WHEN** the run file records its task and the typed session hands `devkit-core:change-planner` the brief of open change `a`
- **THEN** the hand-off is refused, the reason says the ticks drive each change, and nothing is marked under way

#### Scenario: A tick's stage hand-off
- **WHEN** a tick's session that claimed `a` hands `devkit-core:change-planner` the brief of `a`
- **THEN** the hand-off is allowed

#### Scenario: A tick's check before an opening
- **WHEN** a tick's session that claimed `a`, not yet opened, hands `devkit-core:codebase-researcher` the brief of `a`'s check
- **THEN** the hand-off is allowed

#### Scenario: A tick's hand-off for another change
- **WHEN** a tick's session that claimed `a` hands a role the brief of `b`
- **THEN** the hand-off is refused, naming `a` as the tick's claimed change

#### Scenario: A tick's session with no claim
- **WHEN** a tick's session that claimed nothing hands any role the brief of `a`
- **THEN** the hand-off is refused

## ADDED Requirements

### Requirement: A conducted run's sessions stop as its ticks need
In a run whose file records its scheduled task or its end, the session the owner typed the run in
SHALL be allowed to stop. A tick's session SHALL be refused once while it holds a live claim whose
drive has recorded no wait and no stage of it runs in the background; it SHALL be allowed otherwise,
while a stage agent or the review round of its claim runs in the background (its notice wakes the
session), after a drive that ended at a delegated gate, and on a repeat with nothing changed.

#### Scenario: The typed session after the task is installed
- **WHEN** the session the owner typed `/devkit roadmap 2` in tries to stop while `a`'s next stage is ready and the run file records the task
- **THEN** the stop is allowed

#### Scenario: A claim with no wait
- **WHEN** a tick's session holds a live claim on `a`, `a`'s drive recorded no wait, no stage of `a` runs in the background, and the session tries to stop
- **THEN** the stop is refused once, naming `a` and the loop call that records its wait or releases its claim

#### Scenario: A stage in the background
- **WHEN** a tick's session handed `a`'s implementation to its agent in the background and tries to end its turn
- **THEN** the stop is allowed, and the agent's completion notice resumes the drive

#### Scenario: A stopping run
- **WHEN** the run is stopping, a tick's session holds `a`'s claim with no wait, and it tries to stop
- **THEN** the stop is refused once, naming the loop call that ends `a`'s drive at the stop and releases the claim

#### Scenario: A drive that ended at a delegated gate
- **WHEN** `a`'s drive ended at a plan approval the standing answers delegate, and the tick's session tries to stop with no `approval.md` written
- **THEN** the stop is allowed, and a later tick's sweep records the approval

#### Scenario: The typed session after the run's end
- **WHEN** the run file records the run's end and the session the owner typed the run in tries to stop
- **THEN** the stop is allowed

#### Scenario: A tick that claimed nothing
- **WHEN** a tick's session found nothing to claim and tries to stop
- **THEN** the stop is allowed

#### Scenario: The same state a second time
- **WHEN** the stop is attempted again with nothing changed since the refusal
- **THEN** the stop is allowed

## REMOVED Requirements

### Requirement: A change session started by a roadmap run runs only on the run's ticket
**Reason**: The change sessions, their tickets and the `devkit-session` entry skill are removed (`ADR [helper-conductor]`, decision 8).
**Migration**: A tick claims the change in the run file and drives it through a helper; the owner can still run any change by typing `/devkit change <id>`.
