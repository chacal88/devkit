<!-- devkit-stage specs result=passed attempt=3 commit=123a7ba4a7084ed466075cfbb23bdb9b82fdbbd0 -->
# Spec Delta

## ADDED Requirements

### Requirement: Every pending change opens at the start of a run with a session per change
In a run whose changes each have a session of their own, the first decision on a turn the owner
typed SHALL open every line that is unticked, not archived and not open, whatever its dependencies
and the number, and start a session of its own for every open change of the roadmap that has none.
The board SHALL list every one of them.

#### Scenario: Three pending lines, one of them waiting for another
- **WHEN** the owner types `/devkit roadmap 1` in the desktop app with lines `a`, `b` (after: `a`) and `c`, none open
- **THEN** `a`, `b` and `c` are opened, each gets a session of its own on that turn, and the board lists all three

#### Scenario: A line on the previous script or ticked
- **WHEN** a line is ticked, archived, or open on the previous script
- **THEN** it is not opened and gets no session

#### Scenario: A run where the host cannot start sessions
- **WHEN** the host has no way to start a session
- **THEN** lines open only as places free, as before this change

### Requirement: A place is held only by a change that loads the machine
In a run with a session per change, a change SHALL hold a place only while its current stage is the
implementation, a unit or E2E test stage, the evidence or the review, whatever its state there. At
most the run's number SHALL hold a place at once; the grill and the plan SHALL need none. A change
that needs a place and finds none, or finds the machine loaded, SHALL wait in its own session. A
change no longer open SHALL hold no place.

#### Scenario: Two changes reach the implementation with one place
- **WHEN** the number is 1 and changes `a` then `b` reach their implementation
- **THEN** `a` takes the place and is handed its implementation, and `b` waits in its own session for a place

#### Scenario: A place frees
- **WHEN** `a` moves to its delivery while `b` waits for a place
- **THEN** `a` leaves the place and `b` takes it at its next check, before any change that started waiting after it

#### Scenario: Plans with every place taken
- **WHEN** the number is 1, `a` holds the place, and `c` finished its grill
- **THEN** `c`'s plan is written at once

#### Scenario: A loaded machine
- **WHEN** a place is free, `b` needs one and the load reads 92 with the limit 80
- **THEN** `b` waits in its own session, held by the load, until the load falls or the owner says to start anyway

#### Scenario: A blocked change in its implementation
- **WHEN** `a` holds the place and its gate runs red
- **THEN** `a` keeps the place

#### Scenario: A change that leaves the roadmap
- **WHEN** the number is 1, `a` holds the place, `b` waits for one, and `a`'s line is removed from the roadmap or `a` is archived while its session is gone
- **THEN** `a` holds no place and is no longer counted ahead of anyone, and `b` takes the place at the check's next firing

### Requirement: A change's plan waits for its dependencies and starts from the code of that day
In a run with a session per change, no plan file of a change SHALL be written while a change its
roadmap line names in `after:` is not archived on the default branch. Once every one is, the change
SHALL merge the default branch into its own branch before its first plan file, so the plan reads the
code of that day.

#### Scenario: A dependency not archived
- **WHEN** `b` (after: `a`) finished its grill and `a` is not archived
- **THEN** no plan file of `b` is written and `b` waits in its own session for `a`

#### Scenario: The dependency is archived
- **WHEN** `a` is archived on the default branch
- **THEN** `b` merges the default branch, holding `a`'s archive, and then its plan is written

#### Scenario: The merge conflicts
- **WHEN** merging the default branch into `b` conflicts
- **THEN** the merge is undone, `b` stops blocked with the reason, and no plan file is written

### Requirement: The grill and the plan are pushed with the change's branch
In a run with a session per change, once a change's grill has passed, and again once its plan
approval is recorded, the coordinating session SHALL commit those files on the change's branch and
push the branch to `origin`. A push that fails SHALL be said in one line and tried again at a later
decision, not in the same one. A plan SHALL be pushed once per recorded approval.

#### Scenario: A grill answered
- **WHEN** the owner answered the last question of `a`'s grill in the coordinating session
- **THEN** `a`'s branch on `origin` holds its `requirements.md` with the passed header

#### Scenario: A plan approved
- **WHEN** the owner approved `a`'s plan in the coordinating session
- **THEN** `a`'s branch on `origin` holds its plan files and its `approval.md`

#### Scenario: A push that fails
- **WHEN** the push of `a`'s branch fails
- **THEN** one line says so with the reason, the decision that follows the push asks for no other push of `a`, and a later decision asks for it again

#### Scenario: Tasks ticked after the plan was pushed
- **WHEN** `a`'s plan and approval are on `origin` and `a`'s session ticks tasks in its `tasks.md`
- **THEN** no decision asks for another push of `a`'s plan

#### Scenario: A plan approved again
- **WHEN** `a`'s plan was pushed, then revised, and the owner approves it again in the coordinating session
- **THEN** `a`'s branch on `origin` holds the new approval with the plan files

### Requirement: A roadmap run keeps one periodic check while it lasts
When the host offers a session cron, the run's first decision SHALL ask for one periodic check of the
run, about every 30 minutes, in the coordinating session. A run SHALL hold at most one. When the run
ends, for any reason, or is stopped, the check SHALL be deleted. A run started from another session
SHALL ask for its own check.

#### Scenario: A run starts
- **WHEN** the owner types `/devkit roadmap 2` and the host offers a session cron
- **THEN** one periodic check is created in that session and recorded by the run

#### Scenario: A run ends
- **WHEN** the last line of the roadmap is archived, or the owner types `/devkit roadmap stop`
- **THEN** the periodic check is deleted and the run records none

#### Scenario: A host with no session cron
- **WHEN** the host offers no session cron
- **THEN** the run goes on with no periodic check, and nothing is retried

#### Scenario: The check's own turn
- **WHEN** the check fires in the coordinating session
- **THEN** the turn is not one the owner typed and does not end the run

### Requirement: A firing of the check acts and reports only what changed
Each firing SHALL have the triage answer ahead the grills not being asked, hand a freed place to the
first change waiting for one, stop the run's stale wait loops, and archive the session of each
archived change. It SHALL show the owner one message only when something changed or needs them. It
SHALL NOT write an approval or a retro answer, hand a stage or start a session. Only a process
still a wait loop of the run SHALL be stopped.

#### Scenario: A freed place
- **WHEN** the check fires, a place is free and `b` waits for one
- **THEN** `b` holds the place, and its session goes on at its next check of the place

#### Scenario: A stale wait loop
- **WHEN** a wait loop of the run belongs to an archived change, or an older wait loop of the same change and kind is still running beside a newer one
- **THEN** that wait loop is stopped and the newest one keeps running

#### Scenario: Wait loops stopped
- **WHEN** the check stops two stale wait loops of the run
- **THEN** one line says that 2 wait loops were stopped because their changes no longer need them

#### Scenario: A recorded wait loop that is no longer one
- **WHEN** a stale wait loop is recorded under a process number that now belongs to a process that is not a wait loop of the run
- **THEN** that process is not stopped, and the run no longer records it

#### Scenario: A place given to a session that is not watching
- **WHEN** the check gives `b` a place and no wait loop of `b`'s session is running
- **THEN** one line asks the owner to type any message in `b`'s session

#### Scenario: An archive not done yet
- **WHEN** archiving the session of archived change `c` is refused, waits for the owner's approval, or meets a session still working
- **THEN** one line says it is tried again later, once for that state, and the next firing or the run's end tries again

#### Scenario: A triage heading that is no section
- **WHEN** the check fires, `b`'s grill is not the one being asked, and `b`'s requirements hold the triage's heading only inside a fenced block or with words after it
- **THEN** the check has the triage answer `b`'s questions

#### Scenario: Nothing changed
- **WHEN** the check fires and nothing changed since the last decision
- **THEN** no message is shown to the owner

#### Scenario: A plan ready during the check
- **WHEN** the check fires while `a` waits for its plan approval
- **THEN** no approval is written, the owner is asked as on any other turn, and only the owner's own typed answer approves

#### Scenario: A session to start on the check's turn
- **WHEN** a change needs a session of its own when the check fires
- **THEN** no session is started on that turn, and its line says it starts at the owner's next message

### Requirement: The end of a run cleans up after itself
When a run ends with every line archived, the coordinating session SHALL delete the periodic check,
stop every wait loop of the run still running, stop its own background tasks of the run, and archive
the session of every archived change. A stopped run SHALL delete the check and do the same for the
archived changes only. Only a process that is still a wait loop of the run SHALL be stopped; the
record SHALL forget every wait loop it was asked to stop.

#### Scenario: The last change archived
- **WHEN** the last change of the roadmap is archived
- **THEN** no periodic check, no wait loop of the run and no open session of an archived change is left

#### Scenario: A stop while two changes go on
- **WHEN** the owner types `/devkit roadmap stop` while `a` and `b` go on in their sessions and `c` is archived
- **THEN** the check is deleted, `c`'s session is archived, and `a`'s and `b`'s sessions and wait loops keep running

#### Scenario: A process that took a wait loop's number
- **WHEN** the last change is archived and a wait loop of the run is recorded under a process number that now belongs to a process that is not a wait loop
- **THEN** that process keeps running, and the run records no wait loop

### Requirement: The board shows what each change session waits for
In a run with a session per change, `/devkit status` SHALL show a change waiting in its own session
in the queue with what it waits for (a place, the load or a dependency), and a change at its grill,
plan approval or retro answers among those waiting for the owner. Such a wait SHALL be the change's
state, `running` with the reason `held-place`, `held-load` or `held-after` and the row's words, alike
in the state command, the change session's action and the board.

#### Scenario: Waits of each kind
- **WHEN** `a` holds the place, `b` waits for a place, `c` waits for `a` before its plan, and `d` is at its grill
- **THEN** `a` is under way, `b` reads "open, waits for a place", `c` reads "open, waits for a", and `d` is under "Waiting for you" with the grill

#### Scenario: The board, the state command and the change session agree on a held change
- **WHEN** `b` waits in its own session for a place, and `c` waits in its own session for `a` before its plan
- **THEN** the state command prints `b` as `running` with the reason `held-place`, "open, waits for a place", and the title `⏳ b`, and `c` as `running` with the reason `held-after`, "open, waits for a", and the title `⏳ c`; the action each session's loop gives carries the same state; and the board shows both in the queue with those words

#### Scenario: A stopped change is not held
- **WHEN** a change with a place request left in the run's queue waits for the owner, is blocked, or waits on GitHub
- **THEN** its state, its reason and its title are the ones it has with no queue entry

## MODIFIED Requirements

### Requirement: Every open change of the roadmap fills a place
In a run whose changes run in the coordinating session, every change of the roadmap that is open on
the current script SHALL fill one place, whatever it is doing: running, waiting for the owner,
waiting on GitHub or blocked. A change open before the run SHALL be resumed and counted before any
new one starts. With every place filled nothing SHALL start. In a run whose changes each have a
session of their own, a place SHALL be held as "A place is held only by a change that loads the
machine" says.

#### Scenario: Every place filled by changes that do not run
- **WHEN** the number is 2, one open change waits for the owner's approval, another waits on GitHub, and a third line is ready
- **THEN** the third change is not started

#### Scenario: A change open before the run
- **WHEN** the run starts with the number 1 while a roadmap change opened earlier by `/devkit change` is unfinished on the current script
- **THEN** that change is resumed and no other change is started

#### Scenario: Open changes that do not load the machine, each in its own session
- **WHEN** in a run with a session per change and the number 1, `a` waits for its plan approval and `b` waits on GitHub
- **THEN** neither holds a place, and the next change that reaches its implementation takes it

### Requirement: Starts are held while the machine is loaded
Before every start the processor load of the last minute per logical core SHALL be read as a
percentage. At or above the person's limit (`load_limit`, 80 when unset or not a whole number from 1
to 1000) no change SHALL start, also when none is open; the hold SHALL be said once, rechecked every
minute and released by itself below the limit. A change under way SHALL never be stopped by the load.
In a run with a session per change, the load SHALL hold a change's taking of a place, not its
opening.

#### Scenario: Loaded with nothing open
- **WHEN** no roadmap change is open, a line is ready, and the load reads 92 with the limit 80
- **THEN** no change is started and one line says the start is held, with 92% and the limit 80%, and that the owner can say to start it anyway

#### Scenario: The hold is said once
- **WHEN** the load stays at or above the limit at the next decisions of the run
- **THEN** no new line about the hold is shown

#### Scenario: The load falls
- **WHEN** a start is held and the load reads below the limit at a check, in a run whose changes run in the coordinating session
- **THEN** the change is started without a word from the owner

#### Scenario: The load falls in a run with a session per change
- **WHEN** in a run whose changes each have a session of their own, the load reads 92 with the limit 80 when line `a` is pending, and later falls below it
- **THEN** `a` is opened and started in a session of its own on the owner's typed turn, and only its taking of a place waited for the load, which it takes in its own session once the load falls

#### Scenario: A change under way
- **WHEN** a change is running a stage and the load rises above the limit
- **THEN** that change's next stages are handed as usual

#### Scenario: An unset or unreadable limit
- **WHEN** the person's `load_limit` is absent, `80%`, `0` or not substituted
- **THEN** the limit is 80

#### Scenario: A system that reports no load
- **WHEN** the system reports a load of 0
- **THEN** the machine never counts as loaded

### Requirement: The owner sees one line per event
While a run goes on, the coordinating session SHALL show, unasked, one short line per event and
nothing else: a change started (with the open count and the number), resumed, waiting at a gate of
the owner, archived, blocked (with the reason), skipped as a previous-script change, a start held, a
ready change waiting for the owner's next message; and the stop and the end of the run. Each SHALL be
shown once. In a run whose changes each have a session of their own, a change's grill, plan approval
and retro answers SHALL be said in the coordinating session, and its other gates and its stop in that
change's session.

#### Scenario: A change starts
- **WHEN** the run starts the first of three places
- **THEN** one line says the change was started and that 1 of 3 is under way

#### Scenario: A change reaches a gate
- **WHEN** an open change reaches the plan approval while others run, in a run whose changes run in the coordinating session
- **THEN** one line names the change, says it waits for the owner's approval of the plan and that the others go on

#### Scenario: A change reaches a gate while nothing else runs
- **WHEN** an open change reaches the plan approval and no other change of the run is under way: none runs a stage, has a stage or step handed in the same decision, waits on GitHub or starts
- **THEN** its line names the change and the gate and does not say that the others go on

#### Scenario: A gate in a change's own session
- **WHEN** in a run whose changes each have a session of their own, change `a` reaches the plan approval
- **THEN** the coordinating session shows one line for it and asks for the approval, and `a`'s own session asks nothing

#### Scenario: Another gate in a change's own session
- **WHEN** in a run whose changes each have a session of their own, change `a` waits for a merge left to the owner
- **THEN** `a`'s own session asks for it, and the coordinating session shows no line for it

#### Scenario: Moving from one stage to the next
- **WHEN** an open change goes from one stage to the next, or starts waiting on GitHub
- **THEN** no line is shown

#### Scenario: The same state again
- **WHEN** the run decides again and a change is in the same announced state
- **THEN** its line is not shown again

### Requirement: The owner's gates are asked one change at a time
When open changes wait at gates of the owner (the grill, the mock-up approval, the plan approval,
the retro answers, a pull-request decision only the owner can take, a merge left to the owner) in a
run whose changes run in the coordinating session, that session SHALL ask the gates of one change at a time, in the order
of the roadmap file, naming the change; the next change's questions SHALL come only when that
change's gate is answered. In a run whose changes each have a session of their own, the coordinating
session SHALL ask the grills, the plan approvals and the retro answers the same way, writing each
answer into that change's files, and each change's other gates SHALL be asked in its own session.

#### Scenario: Two changes at their grill
- **WHEN** two open changes wait for their grill, the first in the file being `a`
- **THEN** the questions asked name `a`, and `b` is asked only after `a`'s grill is answered

#### Scenario: A gate of a change earlier in the file during another change's grill
- **WHEN** the grill of `b` is being asked and `a`, earlier in the file, reaches its plan approval
- **THEN** the questions of `b`'s grill go on, and `a`'s approval is asked after them

#### Scenario: The others keep running
- **WHEN** a change waits for the owner and another open change has a stage ready
- **THEN** the other change's stage is handed in the same decision

#### Scenario: Two changes at their grill, each in its own session
- **WHEN** in a run whose changes each have a session of their own, `a` and `b` both wait for their grill
- **THEN** the coordinating session asks `a`'s questions, naming `a`, writes the answers into `a`'s `requirements.md`, then asks `b`'s, and neither change session asks a question

#### Scenario: A plan approval for a change in its own session
- **WHEN** `a`'s plan is ready in its own session
- **THEN** the coordinating session shows the plan's summary and asks the owner; the owner's own typed answer there is written as `a`'s approval, and `a`'s session goes on from it without a message from the owner

#### Scenario: The retro answers for a change in its own session
- **WHEN** `a`'s retro is written in its own session and waits for the owner's answers
- **THEN** the coordinating session shows each proposal and records the owner's own answers in `a`'s `retro.md`, and `a`'s session goes on to its archive

#### Scenario: A mock-up waits while another change is asked
- **WHEN** `a`'s plan approval is being asked and `b`, later in the file, reaches its mock-up approval
- **THEN** `b`'s mock-up is shown and asked only after `a`'s approval is answered

### Requirement: Each change of a roadmap run runs in a session of its own where the host can start sessions
Where the host can start sessions, every change a run opens or resumes SHALL run in a session of its
own, nested under the coordinating session, in the change's worktree, running its loop from its first
turn with no command typed in it. Its stages SHALL happen there. The coordinating session SHALL open,
start sessions, ask the grills, plan approvals and retro answers, and show the lines and board; it
SHALL hand no stage. Where the host cannot start sessions, the changes SHALL run in the coordinating
session as before.

#### Scenario: Two changes start, each in its own session
- **WHEN** the owner types `/devkit roadmap 2` in the desktop app with two pending lines `a` and `b`
- **THEN** both are opened, each gets a session of its own nested under the owner's session and started in its own worktree, each session runs its change's loop with no message from the owner, one line per change says it runs in a session of its own, and the coordinating session hands no stage

#### Scenario: A change open before the run
- **WHEN** the run starts in the desktop app while roadmap change `a`, opened earlier, is unfinished and has no session of its own
- **THEN** `a` gets a session of its own that goes on from where it stopped

#### Scenario: A change already in its session
- **WHEN** the coordinating session decides again and change `a` runs in the session it was given
- **THEN** no second session is started for `a`, and no stage of `a` is handed by the coordinating session

#### Scenario: A session the app already lists
- **WHEN** on a typed turn change `a` has no session recorded by the run, and the app's list of the sessions the coordinating session started holds one, not archived, in `a`'s worktree or titled with `a`'s id
- **THEN** no second session is started for `a`, and the run records `a` as running in that session

#### Scenario: A stop in a run with a session per change
- **WHEN** `/devkit roadmap stop` is typed while `a` and `b` each run in a session of their own
- **THEN** the run ends at once, no session is started, each change goes on in its own session, and one line per change says it stays

#### Scenario: A host that cannot start sessions
- **WHEN** the owner types `/devkit roadmap 2` in a session whose host has no way to start a session
- **THEN** the run hands the stages of both changes from that session, as before this change

### Requirement: A change session tells the coordinating session when its change is archived
The report that ends each turn of a change session a roadmap run started reaches the coordinating
session, and the report of the turn that archives the change SHALL say so in one line. The
coordinating session SHALL decide again on the turn each report starts. That turn is not one the
owner typed, so a change that still needs a session of its own SHALL wait for the owner's next
message, with its line; a change already open in its session SHALL take the freed place itself.

#### Scenario: A change archived in its session
- **WHEN** `a`'s session archives `a` and its end-of-turn report reaches the coordinating session, while `c` waits in its own session for the place `a` held
- **THEN** the coordinating session says `a` was archived, and `c` takes the place in its own session with no message from the owner

#### Scenario: A report with nothing new
- **WHEN** a change session's end-of-turn report reaches the coordinating session and nothing changed for the run
- **THEN** the coordinating session shows no line and starts nothing

### Requirement: A change session shows the stage its change is in
A change session SHALL be titled with its change's stage icon (❓ requirements, 📝 plan, 🛠️ code, 🔍
review, 🚀 delivery, 📦 archive) and the change id while the change runs; while it is stopped, with
the state icon (🙋 waiting for the owner, ⏳ waiting on GitHub, ⛔ blocked), a space, then that
title; `📦 <id>` once archived; cut to 59 code points. While a change session of a roadmap run waits
for a place, for the load or for its dependencies, its title SHALL be ⏳ and the change id, the stage
icon replaced, and its stage icon again once it goes on. When the title changes, the session SHALL
rename itself before it goes on.

#### Scenario: The icon of each stage
- **WHEN** a change is in its grill, its proposal, its implementation, its code review, its delivery or its retro and archive
- **THEN** the icon reported for it is ❓, 📝, 🛠️, 🔍, 🚀 or 📦 in that order

#### Scenario: A new stage
- **WHEN** the change session's change goes from its plan approval to its implementation
- **THEN** the session's title goes from `🙋 📝 <id>` to `🛠️ <id>`

#### Scenario: A stage of the same icon
- **WHEN** the change goes from its proposal to its design
- **THEN** the title is not renamed

#### Scenario: The first title
- **WHEN** the coordinating session starts the session of a change that is at its grill
- **THEN** the session starts titled `🙋 ❓ <id>`

#### Scenario: A change under way
- **WHEN** the change's implementation is handed to its agent
- **THEN** the title is `🛠️ <id>`, with no state icon

#### Scenario: Waiting for a place, then going on
- **WHEN** the change reaches its implementation with no place free, and later takes a place
- **THEN** the title goes from `🙋 📝 <id>` to `⏳ <id>`, then to `🛠️ <id>`

#### Scenario: Waiting for the load
- **WHEN** the change reaches its implementation with a place free while the load is above the limit
- **THEN** the title is `⏳ <id>` until the load falls or the owner says to start anyway, then `🛠️ <id>`

#### Scenario: Waiting for a dependency
- **WHEN** the change finished its grill and its dependency is not archived
- **THEN** the title is `⏳ <id>` until the dependency is archived, then `📝 <id>`, the icon of its plan

#### Scenario: Waiting for the owner in the coordinating session
- **WHEN** the change waits for its grill, plan approval or retro answers in the coordinating session
- **THEN** the title is 🙋 beside the icon of that stage: `🙋 ❓ <id>`, `🙋 📝 <id>` or `🙋 📦 <id>`

#### Scenario: Waiting on GitHub
- **WHEN** the change waits on its pull request's checks, or GitHub did not answer
- **THEN** the title is `⏳ 🚀 <id>`, the stage icon kept

#### Scenario: Blocked
- **WHEN** the change stops blocked in its implementation, or blocked with no stage, as a change begun under the previous script
- **THEN** the title is `⛔ 🛠️ <id>`, or `⛔ <id>`

#### Scenario: Archived
- **WHEN** the change is archived
- **THEN** the title is `📦 <id>`, with no second icon

#### Scenario: A long id
- **WHEN** the change id has 70 characters, in any of the forms above
- **THEN** the title is cut to its first 59 code points

### Requirement: A change ready on a turn nobody typed waits for the owner's next message, with a line
In a run with a session per change, a change session SHALL start only on a turn the owner typed. On
any other turn, the check's own included, or when the host refuses the start, a change that still
needs a session SHALL NOT be opened or started: one line SHALL say it starts in a session of its own
at the owner's next message, with the reason, and the board SHALL say the same. Such a change SHALL
never be left without a line, nor run in the coordinating session in place of its own session.

#### Scenario: A report from a change session
- **WHEN** a change session's end-of-turn report starts a turn in the coordinating session while line `b` is pending and not open
- **THEN** `b` is not opened on that turn, and one line says `b` starts in a session of its own at the owner's next message

#### Scenario: The load eased on a turn nobody typed
- **WHEN** a line `e` was added to the roadmap during the run, the watch of the load ends below the limit, and the coordinating session decides on that turn nobody typed
- **THEN** `e` is not opened, and one line says `e` starts in a session of its own at the owner's next message because the app starts a session only on a turn the owner typed, and the board's row for `e` says the same

#### Scenario: The owner's next message
- **WHEN** after that the owner types any message in the coordinating session
- **THEN** `e` is opened and started in a session of its own, and one line says so

#### Scenario: The host refuses the start
- **WHEN** the coordinating session asks the host to start `a`'s session on a typed turn and the host refuses
- **THEN** one line says `a` could not start in a session of its own and starts at the owner's next message, and no other session start is asked for on that turn

#### Scenario: Never without a line
- **WHEN** a decision leaves a pending change unstarted for any reason
- **THEN** that decision shows a line for it, or the line was already shown for the same state

### Requirement: Calling the command again resumes from the files
Nothing SHALL be remembered between runs but one run's bookkeeping (its number, a stop asked, the
gate being asked, the stages under way, the ends the session declared, the events announced, whether
its changes run in sessions of their own, which change sessions were started, the start tickets, the
places held, the changes waiting for a place, the start-anyway of the moment, the wait loops under
way, the periodic check, and what started the last turn), kept outside every working tree. A run
started from another session SHALL start that bookkeeping empty, except the change sessions, their
tickets, the places held, the changes waiting for a place and the wait loops, and continue every open
change from its files, starting no change twice and losing none. No change SHALL be given a second
session while a session of its own is still open; only a run asked to start fresh forgets them.

#### Scenario: The session is killed and a new one runs the roadmap
- **WHEN** a session is killed while two changes run a stage each, and `/devkit roadmap 2` is typed in a new session
- **THEN** both changes are resumed from their files, each stage is handed again, and no change is opened twice

#### Scenario: The same session types the command again
- **WHEN** `/devkit roadmap 3` is typed in the session of a run while two stages run in the background
- **THEN** those two stages are not handed again

#### Scenario: Another session reads the number
- **WHEN** `/devkit status` is typed in another session of the same repository during a run with the number 3
- **THEN** its first line shows the open changes of 3

#### Scenario: A change that already has a session
- **WHEN** `/devkit roadmap 2` is typed in a new session while change `a` still has an open session of its own from the earlier run
- **THEN** `a` is not given a second session, and the place `a` holds stays its own

#### Scenario: A new coordinating session and the periodic check
- **WHEN** `/devkit roadmap 2` is typed in a new session while the run file records a periodic check of the earlier session
- **THEN** the new run asks for a periodic check of its own
