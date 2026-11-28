<!-- devkit-stage specs result=passed attempt=4 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Spec Delta

## Purpose

Lets one typed `/devkit roadmap` drive every change of the roadmap with no session per change: one
scheduled task of the project ticks, each tick claims one ready item and its own session drives it up
to its next wait, what needs the owner waits in one place, and the conductor owns the machine's test
capacity. In this capability "the helper" of an item is that drive of the item by the tick's session
that claimed it, and "a helper in flight" is a live claim; no agent sits between a tick's session and
the stage agents.

## ADDED Requirements

### Requirement: One typed command installs one scheduled task
`/devkit roadmap [<n>]`, typed in a project set up for devkit, SHALL record the run's queue and places
in the run file and, on that typed turn, create one scheduled task of the project whose prompt names
the project's root. No other turn SHALL create a task. Typed again while that task exists, it SHALL
create no second task. Where the host offers no scheduled-tasks tool, one line SHALL say so, and
nothing SHALL be written or started.

#### Scenario: The first typed command
- **WHEN** the owner types `/devkit roadmap 2` in a project whose roadmap holds three unticked lines and no run file
- **THEN** the run file holds the three lines as the queue and 2 places, `list_scheduled_tasks` shows exactly one task of the project, and no change session is started

#### Scenario: Typed again
- **WHEN** the owner types `/devkit roadmap 3` while the run's task exists
- **THEN** the run file holds 3 places, no second task is created, and the queue is not built twice

#### Scenario: Typed again after the run ended
- **WHEN** the run ended, the owner has not deleted its task yet, and the owner types `/devkit roadmap 2`
- **THEN** that task is recorded again as the run's task, `list_scheduled_tasks` still shows exactly one task of the project, and the run's end is cleared

#### Scenario: A tick installs nothing
- **WHEN** a tick runs while the run file records no task
- **THEN** no scheduled task is created, and the reply says no roadmap run is under way

#### Scenario: A host without scheduled tasks
- **WHEN** the owner types `/devkit roadmap` in a host that offers no scheduled-tasks tool
- **THEN** one line says the roadmap needs scheduled tasks, no run file is written, no change is opened and no stage is handed

### Requirement: An empty tick is refused before the model
A prompt hook SHALL recognise only the scheduled task's prompt envelope for this project. For it the
hook SHALL read only local files, start no process and call no model, and SHALL block when no item is
ready, unless the roadmap is done or the run is stopping with no helper in flight. After the run's
recorded end it SHALL block every firing. Every other prompt, and any error, SHALL pass with no
output.

#### Scenario: Nothing is ready
- **WHEN** the task fires while the queue's only open item has a live claim and the other waits for its dependency, which is not due for a new look
- **THEN** the hook prints `{"decision":"block"}` with a one-line reason, and no model call is made

#### Scenario: An item is ready
- **WHEN** the task fires while one queued item has no claim and no wait
- **THEN** the hook adds only the tick's note (the session's id, the installed pack's paths and the tick's call) and the prompt reaches the model

#### Scenario: Any other prompt
- **WHEN** the owner types any message, `/devkit roadmap tick` included, or another scheduled task fires
- **THEN** the hook prints nothing

#### Scenario: The roadmap is done or the run is stopping
- **WHEN** the task fires and every queued item is archived, or the run file says the run is stopping and no claim is live
- **THEN** the hook prints nothing, so that the tick can record the run's end

#### Scenario: A stopping run with a helper in flight
- **WHEN** the task fires, the run file says the run is stopping, and `a`'s claim is live
- **THEN** the hook prints `{"decision":"block"}`, and no model call is made

#### Scenario: After the run's end
- **WHEN** the task fires after the run file recorded the run's end
- **THEN** the hook prints `{"decision":"block"}` with a reason saying the run is over and its task is to be deleted in the app, and no model call is made

#### Scenario: No git on the path
- **WHEN** the task fires with nothing ready, in a linked worktree of the project, and the `git` and `gh` on the hook's path exit with an error
- **THEN** the hook prints `{"decision":"block"}`, having read the run file of the repository's common git folder and the change folders of every worktree

#### Scenario: A run file that cannot be read
- **WHEN** the task fires and the run file is missing, empty or not JSON
- **THEN** the hook prints nothing

### Requirement: A tick claims at most one item
A tick SHALL record, under the run file's lock, a claim on exactly one item (its session, when, and a
heartbeat): the first item in roadmap order that is ready and has no claim or a stale one. A claim
SHALL be stale when its heartbeat is older than the stale bound. A tick SHALL claim nothing while as
many helpers as the run's places are in flight on this machine, and SHALL never run two helpers on one
change.

#### Scenario: Two ready items
- **WHEN** a tick fires with items `a` and `b` ready, no claim, and 2 places
- **THEN** the run file records one claim, on `a`, and `b` stays unclaimed for the next tick

#### Scenario: A live claim
- **WHEN** a second tick fires while `a`'s claim has a fresh heartbeat and `b` is ready
- **THEN** the second tick leaves `a` alone and claims `b`

#### Scenario: Every place has a helper
- **WHEN** a tick fires with 1 place, `a` claimed with a fresh heartbeat, and `b` ready
- **THEN** no claim is recorded and the tick ends

#### Scenario: Two ticks at once
- **WHEN** two ticks try to claim the last free item at the same moment
- **THEN** one claim is recorded and the other tick claims nothing

### Requirement: A helper drives its item to its next wait and releases it
The tick's own session SHALL drive the claimed item, with no session started and no ticket, through
the change loop in its worktree, renewing the claim's heartbeat at each step, up to its next wait:
GitHub's checks, a free place, the load, a dependency, an owner gate, a blocked end or the archive.
The wait SHALL be recorded in the run file and the claim released when the drive ends. A blocked end
SHALL also become a line for the owner; an archived end SHALL write no line and send no push.

#### Scenario: Up to the plan approval
- **WHEN** a helper drives `a` from its grill and its plan's readiness passes
- **THEN** `a`'s plan files are in its worktree, the run file records `a` waiting for the owner's plan approval, and `a` has no claim

#### Scenario: Up to GitHub's checks
- **WHEN** a helper drives `a` to its pull request and the checks run
- **THEN** the run file records `a` waiting on GitHub with the time of its next look, and `a` has no claim

#### Scenario: No free place
- **WHEN** a helper drives `a` to its implementation and every place is held by a change at its implementation, a test stage, the evidence or the review
- **THEN** the run file records `a` waiting for a place, and no implementation is handed

#### Scenario: A blocked end
- **WHEN** a helper drives `a` to a blocked end (a stage file missing after its retry, or a branch of `a`'s id with no change folder)
- **THEN** the run file records `a` blocked with its reason and one line for the owner's decision naming that reason, one push is sent for it when the host offers a notification tool, `a` has no claim, and no tick claims `a` until the owner answers that line

#### Scenario: The owner answers a blocked line
- **WHEN** the owner answers `a`'s blocked line in the session the run was typed in
- **THEN** the line and `a`'s blocked wait are gone from the run file, and the next tick claims `a` and goes on from its files

#### Scenario: An archived end
- **WHEN** a helper drives `a` to its archive
- **THEN** the run file records `a` archived, no line for the owner and no push are written for it, `a` has no claim, and no later tick claims `a`

### Requirement: A tick's session hands each stage one level below it
A tick's session SHALL hand each stage of its claimed item to that stage's role as an agent one level
below it, in the background, with no agent in between, ending its turn after each hand-off and going
on when the agent's completion notice wakes it. It SHALL run the review round as the review bench's
Workflow, or with the Agent tool where the host refuses the Workflow.

#### Scenario: The stages of a drive
- **WHEN** a tick's session drives `a` from its approved plan
- **THEN** each stage of `a` is handed by that session to its role's agent in the background, the session ends its turn and goes on at each completion notice, no agent hands a stage of `a` on for it, and the session itself writes no product code

#### Scenario: The review round of a drive
- **WHEN** a tick's drive of `a` reaches its review
- **THEN** the round runs from the tick's session as the review bench's Workflow, or with the Agent tool where the host refuses it, each reviewer's file is written by its own agent, and `review.md` names the path that ran

### Requirement: The next tick goes on from the files
No state of a change SHALL live in a session: a tick SHALL decide from the change's folder and the run
file only. A helper killed mid-stage SHALL leave its claim, which goes stale; the tick that takes the
stale claim SHALL go on from the change's files, the stage agent's failure keeping the paths it has
(a missing stage file refused once at the agent's stop, one retry a model up, then a blocked end).

#### Scenario: A killed helper
- **WHEN** `a`'s helper is killed during its design stage and its heartbeat is older than the stale bound
- **THEN** the next tick claims `a`, and its helper hands the design stage again from `a`'s files

#### Scenario: A closed typed session
- **WHEN** the session the owner typed the run in is closed while `a` waits on GitHub
- **THEN** a later tick drives `a` on once the checks pass, with no message from the owner

### Requirement: A helper never asks the owner
No tick's session, no stage agent it hands and no agent of its review round SHALL ask the owner a
question or start a session. A
grill question SHALL be answered by the triage agent from the project's files, then from the owner's
standing answers; a question neither settles SHALL become part of the item's line for the owner,
unless the standing answers delegate the grill. Every answer the conductor writes SHALL name its
source, a file and line.

#### Scenario: A question the files settle
- **WHEN** `a`'s grill asks whether the change may add a cron, and an ADR of the project decides it
- **THEN** `requirements.md` records the answer under the triage's heading with the ADR's path and line, and the owner is not asked

#### Scenario: A question the standing answers settle
- **WHEN** `a`'s grill asks which language the replies use, and `openspec/standing-answers.md` answers it on line 7
- **THEN** `requirements.md` records the answer with the source `openspec/standing-answers.md:7`

#### Scenario: A question nothing settles
- **WHEN** a question of `a`'s grill is settled by no file and the standing answers delegate no grill
- **THEN** no box is opened, the run file holds one line for `a` waiting for the owner with that question, and `a` has no claim

#### Scenario: A delegated grill
- **WHEN** the standing answers delegate the grill and a question is settled by no file
- **THEN** the question is answered by the most conservative reading of the request, the answer names the standing answer's line as its source, and no line for the owner is written

### Requirement: The standing answers are the owner's file
`openspec/standing-answers.md` SHALL be read and never written by the conductor. A missing file SHALL
read as no answer and no delegation. A delegation SHALL name its gate and who decides. Lines inside a
fenced block, and every line after a fence that is never closed, SHALL be ignored.

#### Scenario: No file
- **WHEN** the project has no `openspec/standing-answers.md`
- **THEN** no question is answered from it and no gate is delegated

#### Scenario: An unclosed fence
- **WHEN** the file opens a fence on line 4 and never closes it, and a delegation of the plan approval stands on line 9
- **THEN** no gate is delegated

#### Scenario: The conductor learns an answer
- **WHEN** the owner answers a question in the typed session
- **THEN** the answer is written into the change's `requirements.md`, and `openspec/standing-answers.md` is unchanged

### Requirement: The owner's gates wait in one place
A gate that needs the owner (grill questions nothing settles, the plan approval, the retro answers,
a review round past its ceiling, a pull-request decision, a blocked end, a train's owner merge) SHALL
become one run-file line for its change, shown by `/devkit status` and the session the run was typed
in, with one push per new line when the host offers a notification tool. The owner's answer there
SHALL be recorded and make the item ready.

#### Scenario: A plan waits
- **WHEN** `a` reaches its plan approval in a helper and the standing answers delegate no plan approval
- **THEN** the run file holds one line for `a`'s plan approval, `/devkit status` lists it under the owner's block, and no `approval.md` is written

#### Scenario: Shown in the typed session
- **WHEN** that line is written while the session the owner typed the run in is open
- **THEN** that session shows the line once and asks the owner, naming `a`

#### Scenario: The owner answers
- **WHEN** the owner types the approval in that session
- **THEN** `a`'s `approval.md` records the owner's own words, the line is gone from the run file, and the next tick claims `a`

#### Scenario: One push per line
- **WHEN** the host offers a notification tool and two ticks see the same line
- **THEN** one push was sent for it

### Requirement: A delegated gate is recorded with the quoted standing answer
A gate the standing answers delegate by name SHALL be recorded by a tick's session in its sweep,
never in the drive that reached the gate and never by a stage agent, with the quoted standing answer
and its line as its words and who decides. A gate not delegated SHALL never be recorded by the
conductor.

#### Scenario: A delegated plan approval
- **WHEN** the standing answers delegate the plan approval to the coordinator on line 12 and `a`'s plan is ready
- **THEN** `a`'s drive ends with the gate waiting, a later tick's sweep writes `a`'s `approval.md` quoting line 12 and naming who decides, and no line for the owner is written for it

#### Scenario: A retro not delegated
- **WHEN** the standing answers delegate only the plan approval and `a`'s retro waits for answers
- **THEN** no retro answer is written, and the run file holds one line for `a`'s retro answers

### Requirement: The run ends and its task is blocked
After `/devkit roadmap stop`, once no helper is in flight, and on the tick that finds every queued item
archived, the run SHALL record its end, and the tick's prompt hook SHALL block every later firing of
the task before the model. No session SHALL delete, pause or run the task: the conductor SHALL say
once, in the owner's one list, that the owner deletes the task with one click in the app. A stop SHALL
let each helper in flight finish its step and record its wait.

#### Scenario: Stop while a helper runs
- **WHEN** the owner types `/devkit roadmap stop` while `a`'s helper runs
- **THEN** `a`'s helper finishes its step and records its wait, no new claim is recorded, and the firings meanwhile are blocked by the hook

#### Scenario: Stop with nothing in flight
- **WHEN** the owner types `/devkit roadmap stop` while no claim is live
- **THEN** the run file records the run's end, the reply says the run stopped and that the owner deletes the task with one click in the app, and no call to delete, pause or run the task is made

#### Scenario: Done
- **WHEN** a tick fires and every queued item is archived
- **THEN** the run file records the run's end, the reply says the roadmap is done, the owner's list holds one line saying to delete the task in the app, and no call to delete, pause or run the task is made

#### Scenario: A stop whose typed session closed
- **WHEN** the owner typed `/devkit roadmap stop` and that session closed, and `a`'s helper has since released its claim
- **THEN** the next firing passes the hook, its tick records the run's end and the owner's line, and the run file records no task

#### Scenario: Every firing after the end
- **WHEN** the task fires three times after the run's recorded end
- **THEN** each firing is blocked by the hook with no model call, and the task stays in the app's list until the owner deletes it

#### Scenario: Said once
- **WHEN** the run ends while the typed session is open and the host offers a notification tool
- **THEN** that session shows the line about deleting the task once, one push is sent for it, and `/devkit status` lists it under the owner's block

### Requirement: A tick's prompt is the run's command
The scheduled task's prompt SHALL name the project's root on its first line and ask the session to run
the tick as the hook's note says, with no slash command and no entry skill; the session the task
starts SHALL be in the roadmap run for the locks. A tick's session SHALL claim, drive its claimed
item, record the delegated gates of its sweep and send the pushes for lines, and nothing else.

#### Scenario: The tick's session
- **WHEN** the task fires with an item ready
- **THEN** the session is in the roadmap run, claims the item, drives it to its next wait and writes no product code

#### Scenario: A firing with no note
- **WHEN** the task's prompt reaches a session with no tick's note
- **THEN** the session changes nothing and ends its turn

#### Scenario: A pack update
- **WHEN** the pack is updated to a new version while the run's task exists
- **THEN** the next firing's note names the new version's paths, and the task is not changed

#### Scenario: The tick's steps outside a tick
- **WHEN** a session that the task's prompt did not start, and in which the owner did not type `/devkit roadmap tick`, tries to run the tick's steps
- **THEN** its hand-offs and gate writes are judged as outside a tick, and nothing is claimed for it

#### Scenario: The owner types the tick's words
- **WHEN** the owner types `/devkit roadmap tick` while the run's task exists
- **THEN** the session acts as a firing of the task would, under the same claim rules

#### Scenario: A tick with no run
- **WHEN** `/devkit roadmap tick` runs while the run file records no scheduled task
- **THEN** nothing is claimed, and the reply says no roadmap run is under way

### Requirement: A tick's stage agents run on their stages' models
Each stage agent a tick's session hands a stage to SHALL run on that stage's own model, as the stage
table gives it, with a `[1m]` suffix dropped on the call. The tick's session SHALL run on the model the
host starts the task's session on, and the stages it performs itself run there. No session's model
SHALL be switched by the run.

#### Scenario: The unit tests of a drive
- **WHEN** a tick's session hands `a`'s unit tests with no `models:` table set
- **THEN** the unit tests' agent runs on `haiku`

#### Scenario: A 1M stage in a drive
- **WHEN** the project's `models:` holds `implementation: sonnet[1m]` and a tick's session hands `a`'s implementation
- **THEN** the implementation's agent runs on `sonnet`

#### Scenario: No switch
- **WHEN** any decision of a conducted run is made
- **THEN** no action switches the model of a session

### Requirement: A decision travels as a request file, never as a message
A helper that needs a decision SHALL write a request file in the change's folder holding the
question, the facts it rests on and its recommendation; the answer SHALL be a file beside it, written
by the conductor when the standing answers settle or delegate it, else from the owner's typed answer.
No decision of a conducted run SHALL travel by a message between sessions.

#### Scenario: A request the owner answers
- **WHEN** `a`'s helper needs a decision nothing settles
- **THEN** `openspec/changes/a/requests/` holds the request with its recommendation, the run file holds a line for the owner pointing at it, and the owner's typed answer is written as the answer file beside it

#### Scenario: A request the conductor may answer
- **WHEN** `a`'s request asks a decision the standing answers delegate
- **THEN** the next tick writes the answer file, quoting the standing answer's line, and no line for the owner is written

#### Scenario: Another machine
- **WHEN** `e` runs on `avel` and its helper writes a request
- **THEN** the request reaches this machine only through `e`'s branch and the board, never as a session message

### Requirement: The task fires every five minutes and a tick sweeps the run
The scheduled task SHALL fire every five minutes. A tick that passes the prompt hook SHALL first read
each queued change's state, record the holds that state settles, answer the pending request files it
may answer, take over the stale claims, and only then claim one item.

#### Scenario: The schedule
- **WHEN** the typed command installs the task
- **THEN** the task's schedule is every five minutes

#### Scenario: A pull request merged between ticks
- **WHEN** `a` waits on GitHub and its pull request merged since the last tick
- **THEN** the tick's sweep records `a`'s new state, and `a` is claimable in the same tick

#### Scenario: A change that stopped with work left
- **WHEN** `a`'s helper released its claim without recording a wait, and `a`'s next stage is ready
- **THEN** the tick claims `a` and its helper goes on from the files

### Requirement: A plan approval is asked with a short summary
A line for a plan approval SHALL carry a summary of at most 12 lines: what is built, the acceptance
criteria, the records, the files and the risks. The approval recorded from it SHALL quote the owner's
typed words or the delegating standing answer, and its words line SHALL hold at most 200 characters.

#### Scenario: A summary too long
- **WHEN** a helper asks for a plan approval with a summary of 15 lines
- **THEN** the line is refused, and the helper writes it again within 12 lines

#### Scenario: Long words
- **WHEN** the owner approves with a message of 400 characters
- **THEN** `approval.md`'s words line holds the first 200 characters

### Requirement: Siblings on the same file get an order with their approval
When a plan is approved while another queued change's plan names one of the same files, the
approval SHALL record an order between them, or the rule "the second to reach its pull request merges
the base first".

#### Scenario: Two plans on one file
- **WHEN** `a`'s plan and `b`'s approved plan both name `plugins/openspec/hooks/guard.mjs`, and `a`'s plan is approved
- **THEN** `a`'s `approval.md` names `b`, the shared file and the order

#### Scenario: No shared file
- **WHEN** no other queued plan names a file of `a`'s plan
- **THEN** `a`'s approval names no sibling

### Requirement: A boarded change gets its train dispatched
When a change of a conducted run boards the delivery train, the next tick SHALL dispatch the train
through a helper, before it claims any change, unless a train already runs. No boarded change SHALL
wait without a dispatch.

#### Scenario: One change boards
- **WHEN** `a`'s helper ends with `a` boarded and no train runs
- **THEN** the next tick claims the train and its helper departs it

#### Scenario: A train already runs
- **WHEN** `b` boards while the train's helper has a live claim
- **THEN** no second train is dispatched, and `b` leaves on the next one

#### Scenario: A train that needs the owner
- **WHEN** the train's helper reaches a merge that the project's model leaves to the owner, or finds the base itself red
- **THEN** the run file holds one line for the owner naming the train (its merge, or the red base), the train's claim is released, and no further train is dispatched until the owner answers it

#### Scenario: A red train
- **WHEN** the train's bisection names `b` as the change that makes the train red
- **THEN** the run file records `b` blocked with the reason `train-red` and one line for the owner's decision, the train departs with the other boarded changes, and no tick claims `b` until the owner answers

#### Scenario: Outside a conducted run
- **WHEN** a change boards in a project whose run file records no scheduled task
- **THEN** no train is dispatched until the owner types `/devkit train`

### Requirement: An item is checked before it is opened
Before opening an item, the conductor SHALL look for a branch of the same id, in the clone and on
`origin`, and for code that already delivers the item. A parked branch SHALL be reused instead of a
new change; an item already delivered SHALL be recorded `skipped: delivered` with its source and a
line for the owner, and SHALL not be opened.

#### Scenario: A parked branch
- **WHEN** item `a` is ready to open and `origin` holds a branch `a` with `a`'s change folder
- **THEN** no change is opened twice: the worktree is made from that branch and the item goes on from its files

#### Scenario: A branch with no change folder
- **WHEN** item `b` is ready to open and a branch `b` exists that holds no `b` change folder
- **THEN** `b` is not opened, and it ends blocked with the reason that its branch is taken

#### Scenario: Already delivered
- **WHEN** the files show that item `c`'s request is already done in the code
- **THEN** `c` is recorded `skipped: delivered` with the file and line that show it, no change is opened, and the owner's line asks to confirm it

### Requirement: An escalated plan goes on once the decision is recorded
A planner's escalation SHALL end that change's loop `blocked: not-delivered` with a request file for
the decision. Once `requirements.md` holds the decision, the next tick SHALL run the change's plain
next step, and the stage SHALL be handed again.

#### Scenario: The planner escalates
- **WHEN** `a`'s planner returns an escalation and writes no proposal
- **THEN** `a` ends `blocked: not-delivered`, and `a`'s folder holds a request naming the decision

#### Scenario: The decision is recorded
- **WHEN** the answer is written into `a`'s `requirements.md`
- **THEN** the next tick claims `a`, and its helper hands the proposal to the planner again

### Requirement: A change splits over machines by its pushed branch
A tick SHALL open every item on its own machine and push its branch to `origin` after the opening. A
change claimed by another machine SHALL not be driven here while that claim stands; once it is
released or stale, a conductor SHALL claim it and add its worktree from the pushed branch. No step
SHALL run on another machine from this one, and a machine the app reaches as an SSH host, which
holds no task, SHALL run no conductor.

#### Scenario: Opened here
- **WHEN** the machines setting lists `avel` and a tick opens `e`
- **THEN** `e` is opened on this machine, its branch is on `origin` and its claim names this machine

#### Scenario: Loaded with another machine listed
- **WHEN** the machines setting lists `avel`, this machine's load is above the limit and `e`'s implementation is ready
- **THEN** `e` is held for the load and not opened for `avel`

#### Scenario: Taken over from the pushed branch
- **WHEN** `e` was claimed by `avel` on `origin` and that claim is released, with `e`'s branch on `origin`
- **THEN** this machine's tick claims `e`, adds its worktree from `origin/e` and drives it

#### Scenario: Claimed elsewhere
- **WHEN** this machine's tick finds `e` in its queue with no local folder and its claim on `origin` naming `avel`
- **THEN** the run file records `e` waiting elsewhere with a new look in 30 minutes, no worktree is added, no helper is started and no place is taken; the firings before that time are blocked by the hook

#### Scenario: Claimed elsewhere, then released
- **WHEN** the 30 minutes have passed and `e`'s claim on `origin` is gone or stale
- **THEN** the next tick may claim `e` for this machine as any ready item

### Requirement: One whole suite at a time on a machine, the train's first
In a conducted run, at most one whole-suite run SHALL be in flight on one machine at a time, across
every clone of that machine. While the train's suite runs or waits to run, no other test run SHALL
start on the machine: a change's whole suite and every new gate SHALL wait for the train's end; the
train's SHALL wait only for the runs already started. A test run whose process is gone SHALL hold no
slot.

#### Scenario: Two whole suites
- **WHEN** `a`'s whole suite runs and `b`'s evidence starts its whole suite on the same machine
- **THEN** `b`'s run waits, says once that it waits for a whole-suite slot, and starts when `a`'s ends

#### Scenario: The train first
- **WHEN** `a`'s whole suite runs, the train's departure asks for its suite, and then `b` asks for its whole suite
- **THEN** the train's suite starts when `a`'s ends, and `b`'s starts only after the train's

#### Scenario: Gates wait for the train
- **WHEN** the train's departure asks for its suite while one gate of `a` runs, and then `b`'s gate asks to start
- **THEN** the train's suite starts when `a`'s gate ends, `b`'s gate says once that it waits for the train's suite, and starts only after the train's suite ends

#### Scenario: Two clones on one machine
- **WHEN** a second clone of the project on the same machine has its own run, and both runs ask for a whole suite
- **THEN** one whole suite runs at a time

#### Scenario: A killed test run
- **WHEN** a gate's process is killed and leaves its slot recorded
- **THEN** the next test run that asks takes that slot

### Requirement: The gates and the files at once are capped by the run file
In a conducted run, the gates in flight at once on a machine and each test run's files at once SHALL
be capped by the values the run file records: 2 gates and 4 files unless the owner's pack settings
say otherwise. A typed `/devkit roadmap` SHALL record them again from the settings. Every brief a
helper hands to a stage agent SHALL carry the cap. Outside a conducted run nothing SHALL be capped.

#### Scenario: The gates' cap
- **WHEN** the run file records 2 gates and three changes' gates ask to start at once
- **THEN** two run, and the third starts when one of them ends

#### Scenario: The files' cap
- **WHEN** the run file records 4 files at once and a gate of this repository's suite starts through the run's test command with `--concurrency=14`
- **THEN** the run's summary line reads `concurrency 4`

#### Scenario: The defaults and the settings
- **WHEN** the owner types `/devkit roadmap` with no test setting filled, then sets 3 gates and 6 files in the pack's settings and types `/devkit roadmap` again
- **THEN** the run file records 2 gates and 4 files after the first command, and 3 gates and 6 files after the second

#### Scenario: The brief carries the cap
- **WHEN** a helper hands `a`'s implementation to its agent with the run file recording 4 files at once
- **THEN** the brief tells the agent to run every test command through the run's test command and with at most 4 files at once

#### Scenario: A lone change
- **WHEN** a lone `/devkit change` runs its gate in a project with no conducted run
- **THEN** the gate starts at once, with no slot and no cap

### Requirement: A run's places count the changes that load the tests
A conducted run's places SHALL count the changes whose current stage loads the tests (the
implementation, a test stage, the evidence or the review), whether a helper runs for them or not, and
never sessions or helpers as such. The tick's prompt hook and the tick SHALL count the same changes
from the same record of the run file.

#### Scenario: Places count test load
- **WHEN** the number is 1, `a` is at its review waiting on GitHub with no helper, `b` reaches its implementation, and `c`'s helper drives its grill
- **THEN** `b` waits for a place, and `c`'s grill goes on

#### Scenario: The hook and the tick agree
- **WHEN** the number is 1, `a` holds the place at its review with its next look on GitHub not yet due, and `b` waits for a place
- **THEN** the hook blocks the firing, and a `tick` run on the same run file claims nothing; once `a` is archived both let `b` go

### Requirement: A pull request of openspec files only boards no train
In a conducted run of a project with a delivery train, a ready pull request whose every changed file
is under `openspec/` (an archive, a roadmap edit) SHALL NOT board a train and SHALL NOT run a whole
suite; it SHALL merge on its required checks as in a project with no train. Outside a conducted run
such a pull request SHALL board as before.

#### Scenario: An archive in a conducted run
- **WHEN** `a`'s archive pull request, whose files are all under `openspec/`, is ready in a conducted run of a `trunk-auto` train project
- **THEN** `a` is not boarded, auto-merge is enabled on its pull request, GitHub merges it once `check` and `devkit-reviews` pass, and no train carries it

#### Scenario: A change with code
- **WHEN** `b`'s pull request changes `plugins/openspec/hooks/guard.mjs` and its own change folder, and is ready in the same run
- **THEN** `b` boards the train as before

#### Scenario: Outside a conducted run
- **WHEN** an archive pull request of `openspec/` files only is ready in a train project whose run file records no task
- **THEN** it boards the train as before
