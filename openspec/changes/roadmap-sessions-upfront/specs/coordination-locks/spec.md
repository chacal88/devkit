<!-- devkit-stage specs result=passed attempt=2 commit=123a7ba4a7084ed466075cfbb23bdb9b82fdbbd0 -->
# Spec Delta

## ADDED Requirements

### Requirement: A change session started by a roadmap run runs only on the run's ticket
The skill that runs a change session with no typed command SHALL be let through only when the
session's first message is the host's form of a started session whose task names `/devkit change
<id>` and a start line with that id and a ticket, the run records that ticket for `<id>`, and no
other session claimed it. The first session let through SHALL claim it. Any other call SHALL be
refused, saying the owner can type `/devkit change <id>`.

#### Scenario: The run's own start of the change
- **WHEN** a session's first message is the started form with the task `/devkit-openspec:devkit change a` and the line `devkit-start: a <ticket>`, the run records that ticket for `a` unclaimed, and the session calls the change-session skill
- **THEN** the call is allowed, and the run records the ticket as claimed by that session

#### Scenario: The run's own start after a note of the host
- **WHEN** the same first message begins with a note of the host (a `<system-reminder>` block) before the started form
- **THEN** the call is allowed as in the scenario before, and a first message in that form whose task is a hand-written brief, not `/devkit change a`, is refused

#### Scenario: The same session again
- **WHEN** the session that claimed `a`'s ticket calls the change-session skill again
- **THEN** the call is allowed

#### Scenario: A session the owner started
- **WHEN** a session whose first message is a typed message, not the started form, calls the change-session skill
- **THEN** the call is refused

#### Scenario: A started session with no ticket
- **WHEN** a session's first message is the started form with the task `/devkit-openspec:devkit change a` and no start line for `a`
- **THEN** the call is refused

#### Scenario: A ticket the run does not hold
- **WHEN** the start line names a ticket the run does not record for `a`, or the run records no ticket for `a`
- **THEN** the call is refused

#### Scenario: A ticket another session claimed
- **WHEN** the ticket of `a` is recorded as claimed by another session
- **THEN** the call is refused

#### Scenario: An unreadable record
- **WHEN** the session's record or the run's bookkeeping cannot be read
- **THEN** the call is refused

#### Scenario: Another skill
- **WHEN** a session calls any other skill
- **THEN** this rule lets the call through

#### Scenario: The devkit skill itself
- **WHEN** the model of any session calls the devkit skill, which only the owner's typed command runs
- **THEN** the host refuses it, as before this change

## MODIFIED Requirements

### Requirement: A run is known from the session's own record
A session SHALL be in a run of a change when the newest slash command typed in it is `/devkit change`
(bare or plugin-scoped) and a line `devkit-run: <id>` printed by the loop follows it; the change of
the run SHALL be the newest such id. The task another session started this session with, in the
host's form of a started session, SHALL count as a command typed in it, whatever lines follow its
first line and whatever notes of the host come before that form. The run's last recorded action SHALL
be an end while the newest `devkit-run:` or
`devkit-end:` line after that command is an end line. Nothing else SHALL be remembered.

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

#### Scenario: A started task with a start line
- **WHEN** the task is `/devkit-openspec:devkit change a` followed by the line `devkit-start: a <ticket>`, and a `devkit-run: a` line follows the message
- **THEN** the session is in a run of `a`

#### Scenario: A started task after a note of the host
- **WHEN** the session's first message begins with a note of the host (a `<system-reminder>` block), then the started form with the task `/devkit-openspec:devkit change a`, and a `devkit-run: a` line follows the message
- **THEN** the session is in a run of `a`

#### Scenario: Words before the started form
- **WHEN** the session's first message begins with any other line before the started form
- **THEN** that message is not read as the started form

#### Scenario: A command named inside a message
- **WHEN** a message the owner typed holds `/devkit change a` on a line other than its first, and is not the host's form of a started session
- **THEN** that message is not a typed command

#### Scenario: The periodic check's prompt
- **WHEN** the periodic check of a roadmap run fires in the coordinating session with its prompt
- **THEN** the prompt is no typed command, and the roadmap run goes on

### Requirement: The coordinator does not end its turn while a stage is ready
When the session in a run tries to end its turn while the loop's next action hands a stage to an
agent or is a session step, the stop SHALL be refused once with that stage named; it SHALL be allowed
in the four end states, whether the loop computes the end or the run's record holds one, during the
grill, while a background task runs, on a repeat with nothing changed, and, in a change session a
roadmap run started, while its change waits for a place, the load, a dependency or the owner's
answer in the coordinating session.

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

#### Scenario: A change session waiting for a place
- **WHEN** the session that claimed `a`'s ticket tries to stop, `a`'s implementation is ready, and every place is taken
- **THEN** the stop is allowed

#### Scenario: A change session with its place
- **WHEN** the same session tries to stop while `a` holds a place and its implementation is ready
- **THEN** the stop is refused once, naming the implementation

### Requirement: In a roadmap run a hand-off names its change
In a roadmap run whose changes run in the coordinating session, the session SHALL hand work only with
a prompt that starts with the loop's brief naming an open change of the roadmap, and only to a role
or helper of that change's script under the rules of a change run. Any other hand-off SHALL be refused
with the reason. An allowed hand-off SHALL mark that change's stage as under way. In a roadmap run
whose changes each have a session of their own, the coordinating session SHALL hand only a helper of
the grill, with the brief naming an open change of the roadmap, marking nothing under way; every
other hand-off SHALL be refused, saying that each change's stages are handed in its own session.

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

#### Scenario: A hand-off when every change has its own session
- **WHEN** in a run whose changes each have a session of their own, the coordinating session hands `devkit-core:change-planner` the brief of open change `a`
- **THEN** the hand-off is refused, the reason says `a`'s stages are handed in its own session, and nothing is marked under way

#### Scenario: The grill's triage when every change has its own session
- **WHEN** in that run the coordinating session hands `devkit-core:requirements-triage` the brief of open change `a`'s requirements
- **THEN** the hand-off is allowed and nothing is marked under way

#### Scenario: The triage with no brief, or for a change not open
- **WHEN** in that run the coordinating session hands `devkit-core:requirements-triage` a prompt that names no change, or names a change that is not open on the roadmap
- **THEN** the hand-off is refused

### Requirement: A lock never traps
Every lock of this capability SHALL allow the action when it cannot read the session's record, the
checkers, git or GitHub, in a project that has not opted in to devkit, and when the session was
started with `DEVKIT_BYPASS=1`. The one exception is the entry of a change session started by a
roadmap run: it SHALL refuse when it cannot read, because its refusal leaves the owner's typed
`/devkit change <id>`; it SHALL let everything through under `DEVKIT_BYPASS=1`.

#### Scenario: An error while deciding
- **WHEN** the checker fails or the session's record cannot be read while a lock decides
- **THEN** the action is allowed

#### Scenario: A project that has not opted in
- **WHEN** the project's schema is not `devkit` or `devkit-lite`
- **THEN** no lock of this capability refuses anything, except the entry of a change session, which finds no ticket and refuses

#### Scenario: Bypass
- **WHEN** the session was started with `DEVKIT_BYPASS=1`
- **THEN** no lock of this capability refuses anything

#### Scenario: The entry cannot read
- **WHEN** the change-session skill is called and the session's record cannot be read
- **THEN** the call is refused, and the reason names the owner's typed `/devkit change <id>`

### Requirement: Lock decisions can be recorded
When the session was started with `DEVKIT_HOOK_LOG` naming a file, each decision of the two stop locks,
of the hand-off lock and of the entry of a change session SHALL be appended to it as one JSON line;
without it nothing SHALL be written.

#### Scenario: A recorded refusal
- **WHEN** `DEVKIT_HOOK_LOG` names a file and the coordinator's stop is refused
- **THEN** the file gains one line with the mode, the session, the change, the decision and its reason

#### Scenario: A recorded entry
- **WHEN** `DEVKIT_HOOK_LOG` names a file and the change-session skill is called
- **THEN** the file gains one line with the mode `skill`, the session, the change, the decision and its reason

#### Scenario: No log asked
- **WHEN** `DEVKIT_HOOK_LOG` is not set
- **THEN** no lock writes any file other than its refusal record
