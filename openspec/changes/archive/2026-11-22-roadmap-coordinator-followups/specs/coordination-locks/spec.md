<!-- devkit-stage specs result=passed attempt=3 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A run is known from the session's own record
A session SHALL be in a run of a change when the newest slash command typed in it is `/devkit change`
(bare or plugin-scoped) and a line `devkit-run: <id>` printed by the loop follows it; the change of
the run SHALL be the newest such id. The task another session started this session with, in the
host's form of a started session, SHALL count as a command typed in it. The run's last recorded action
SHALL be an end while the newest `devkit-run:` or `devkit-end:` line after that command is an end
line. Nothing else SHALL be remembered.

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

#### Scenario: A command named inside a message
- **WHEN** a message the owner typed holds `/devkit change a` on a line other than its first, and is not the host's form of a started session
- **THEN** that message is not a typed command

### Requirement: The roadmap coordinator does not end its turn while work is ready
When the session in a roadmap run tries to end its turn while the run's decision has a stage of an
open change ready that is not under way, a session step, a wait to start, a change to start, or a
change session to start, the stop SHALL be refused once naming it. It SHALL be allowed when every
open change is under way, runs in a session of its own, waits for the owner or is blocked, while
stopping, and on a repeat with nothing changed. In a run whose changes each have a session of their
own, a start or a session start SHALL count as ready only on a turn that may start sessions.

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

#### Scenario: A watch of the load that died
- **WHEN** a start is held by the load, the run's mark says a watch runs, but the process of that watch has ended
- **THEN** the stop is refused once, naming the held change and the watch to start

#### Scenario: Every change in its own session
- **WHEN** in a run whose changes each have a session of their own, `a` and `b` run in their sessions, `b`'s next stage is ready, and nothing can start
- **THEN** the stop is allowed

#### Scenario: A change session to start on a typed turn
- **WHEN** in such a run, on a turn the owner typed, open change `a` has no session of its own yet
- **THEN** the stop is refused once, naming `a` and the session to start

#### Scenario: A start on a turn nobody typed
- **WHEN** in such a run the last decision was made on a turn the owner did not type (a background task's end, or another session's message or report), and line `c` is ready with a place free
- **THEN** the stop is allowed, because `c` waits for the owner's next message

### Requirement: In a roadmap run a hand-off names its change
In a roadmap run whose changes run in the coordinating session, the session SHALL hand work only with
a prompt that starts with the loop's brief naming an open change of the roadmap, and only to a role
or helper of that change's script under the rules of a change run. Any other hand-off SHALL be refused
with the reason. An allowed hand-off SHALL mark that change's stage as under way. In a roadmap run
whose changes each have a session of their own, every hand-off of the coordinating session SHALL be
refused, saying that each change's stages are handed in its own session.

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

## ADDED Requirements

### Requirement: The hand-off lock answers within the hook's time when the bookkeeping is busy
In a roadmap run, the hand-off lock SHALL stop waiting for the run's bookkeeping before half of the
host's time limit for that hook has passed. It SHALL then let the hand-off through, as every lock
does when it cannot record, and the decision log SHALL name the busy bookkeeping as its reason.

#### Scenario: A hand-off while another call holds the bookkeeping
- **WHEN** the session hands a stage of an open change while another call holds the run's bookkeeping, and the log is asked for
- **THEN** the hook answers before its time limit, the hand-off goes through, the stage is not marked as under way, and the log's line names the busy bookkeeping

#### Scenario: The wait stays below the hook's time limit
- **WHEN** the host's time limit for the hand-off hook is read from the pack's hook settings
- **THEN** the longest wait for the bookkeeping is at most half of it
