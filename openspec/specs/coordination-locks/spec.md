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

### Requirement: A project run holds no lock of a change run
A typed `/devkit project` (bare or plugin-scoped, with any argument) SHALL end a change run and a
roadmap run for every lock of this capability, and no lock of this capability SHALL refuse anything
while the newest typed slash command is `/devkit project`: the session writes the phase documents
itself.

#### Scenario: The session writes a phase document
- **WHEN** the newest typed slash command is `/devkit project billing` and the session writes `docs/design/billing/1-business-vision.md`
- **THEN** no lock of this capability refuses the write

#### Scenario: A change run followed by the project command
- **WHEN** `/devkit change` ran with a `devkit-run: <id>` line and `/devkit project billing` was typed after it
- **THEN** the session is in no change run, its stop is not refused for that change, and a hand-off to any agent is not refused by the hand-off lock

#### Scenario: A roadmap run followed by the project command
- **WHEN** a roadmap run printed `devkit-roadmap: 2` and `/devkit project billing` was typed after it
- **THEN** the session is in no roadmap run

### Requirement: The test branch never enters a task branch
In an opted-in project whose model is `two-prs`, a Bash command SHALL be refused when one of its
`git merge`, `git rebase` or `git pull` runs on a branch other than the test branch or a branch named
`<name>-<test_branch>` and would bring the test branch in. The reason SHALL name the support branch
`<branch>-<test_branch>` as the way out. Every other command, and every other project, SHALL be
allowed as before.

#### Scenario: Merging the test branch into the task branch
- **WHEN** the checkout is on `feat` and the command is `git merge origin/develop`
- **THEN** the command is refused and the reason names `feat-develop`

#### Scenario: Rebasing onto it
- **WHEN** the checkout is on `feat` and the command is `git rebase develop` or `git rebase --onto develop main`
- **THEN** the command is refused

#### Scenario: Pulling it
- **WHEN** the checkout is on `feat` and the command is `git pull origin develop`, or `git pull` with `origin/develop` as the branch's upstream
- **THEN** the command is refused

#### Scenario: On the support branch
- **WHEN** the command is `git -C <support worktree> merge origin/develop` and that worktree is on `feat-develop`
- **THEN** the command is allowed

#### Scenario: Names that only look alike
- **WHEN** the checkout is on `feat` and the command is `git merge develop-tools`, `git merge feature/develop` with no remote named `feature`, or `git log develop`
- **THEN** the command is allowed

#### Scenario: Another model
- **WHEN** the project's model is `trunk-auto`, or names none, and the command is `git merge origin/develop`
- **THEN** the command is allowed

#### Scenario: A configuration that cannot be read
- **WHEN** the project's `devkit:` block cannot be read or its delivery settings are invalid
- **THEN** the command is allowed
