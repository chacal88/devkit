# roadmap-coordination Specification

## Purpose
Lets a person run the whole roadmap with one command, `/devkit roadmap`, which starts every change
whose dependencies are archived, several at once up to a number set per run, holds new starts while
the machine is loaded, and asks the owner's gates one change at a time; and see where everything is
with `/devkit status`.

## Requirements

### Requirement: The roadmap command reads its number
`/devkit roadmap` SHALL take the number of changes that may be open at once from the word after it:
none is 1, a whole number written in digits from 1 to 99 is that number, and `stop` stops the run.
Any other word, or a number below 1, SHALL be answered in one plain sentence naming the word, and
nothing SHALL be started or written.

#### Scenario: No number
- **WHEN** the person types `/devkit roadmap` in a project whose roadmap has three ready changes and none open
- **THEN** one change is started and the other two stay in the queue

#### Scenario: A number
- **WHEN** the person types `/devkit roadmap 3` in a project whose roadmap has three ready changes and none open
- **THEN** the three changes are started

#### Scenario: A word that is not a number
- **WHEN** the person types `/devkit roadmap many`, `/devkit roadmap 0`, `/devkit roadmap -1` or `/devkit roadmap 1.5`
- **THEN** the reply names the word and says the command takes a whole number from 1 up or `stop`, no change is started, and no file is written

#### Scenario: The arguments as typed
- **WHEN** the run receives the person's arguments as typed, `roadmap 2`, `roadmap stop`, `roadmap` or `roadmap many`, instead of the word alone
- **THEN** it reads them as `2`, `stop`, no number and `many`: the first call of `/devkit roadmap 2` starts the run with up to two changes, and `many` is answered by name

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

### Requirement: A roadmap line is started only when its dependencies are archived
A line of `openspec/roadmap.md` SHALL be a candidate when it is unticked and its change is not
archived on the default branch. A candidate SHALL start only when every change its `after:` names is
archived on the default branch, read as `/devkit change` reads it; the tick SHALL gate nothing.
Candidates SHALL start in the order of the file.

#### Scenario: Every dependency archived
- **WHEN** a line names `after: a` and `a` is archived on the default branch while its own line is still unticked
- **THEN** the line's change is started when a place is free

#### Scenario: A dependency not archived
- **WHEN** a line names `after: a` and `a` is ticked on the roadmap but has no archived folder on the default branch
- **THEN** the line's change is not started and waits for `a`

#### Scenario: A ticked line, or an archived change
- **WHEN** a line is ticked, or its change is archived on the default branch
- **THEN** its change is never started

#### Scenario: The order of the file
- **WHEN** two lines are ready and one place is free
- **THEN** the line that comes first in the file, round then line, is started

### Requirement: Every open change of the roadmap fills a place
With the person's machines setting unset, in a run whose changes run in the coordinating session,
every change of the roadmap that is open on the current script in this clone SHALL fill one place,
whatever it is doing: running, waiting for the owner, waiting on GitHub or blocked. A change open
before the run SHALL be resumed and counted before any new one starts. With every place filled
nothing SHALL start. In a run whose changes each have a session of their own, a place SHALL be held
as "A place is held only by a change that loads the machine" says. With the setting set, places
SHALL also be counted per machine as the requirement "A place is taken from the implementation on"
says.

#### Scenario: Every place filled by changes that do not run
- **WHEN** the number is 2, one open change waits for the owner's approval, another waits on GitHub, and a third line is ready
- **THEN** the third change is not started

#### Scenario: A change open before the run
- **WHEN** the run starts with the number 1 while a roadmap change opened earlier by `/devkit change` is unfinished on the current script
- **THEN** that change is resumed and no other change is started

#### Scenario: Open changes that do not load the machine, each in its own session
- **WHEN** in a run with a session per change and the number 1, `a` waits for its plan approval and `b` waits on GitHub
- **THEN** neither holds a place, and the next change that reaches its implementation takes it

#### Scenario: A change open on another machine
- **WHEN** the machines setting is unset, the number is 1, a line's change is open only on another machine, and another line is ready
- **THEN** the change open elsewhere fills no place of this run, and the ready line is started

### Requirement: The number can change during a run
Typing `/devkit roadmap <n>` again in the session of a run SHALL change the number of that run. A
higher number SHALL let more changes start; a lower one SHALL interrupt no change and only keep new
starts back until the open changes fall below it.

#### Scenario: A higher number
- **WHEN** a run with the number 1 has one open change and the person types `/devkit roadmap 2` while another line is ready
- **THEN** the other change is started, and the change already open goes on

#### Scenario: A lower number
- **WHEN** a run with the number 3 has three open changes and the person types `/devkit roadmap 1`
- **THEN** no open change is stopped or interrupted, and no change starts while any of the three is still open

### Requirement: Starts are held while the machine is loaded
Before every start the processor load of the last minute per logical core SHALL be read as a
percentage. At or above the person's limit (`load_limit`, 80 when unset or not a whole number from 1
to 1000) no change SHALL start on this machine, also when none is open; when no other machine can take
it the hold SHALL be said once, rechecked every minute and released by itself below the limit. A
change under way SHALL never be stopped by the load. In a run with a session per change and the
machines setting unset, the load SHALL hold a change's taking of a place, not its opening; with the
setting set, a loaded machine SHALL open no change, the opening goes to a machine that answers, and
it is held only when none does.

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

#### Scenario: Loaded while another machine answers
- **WHEN** the machines setting lists `avel`, `avel` answers, a line is ready on a typed turn, and the load reads 92 with the limit 80
- **THEN** the change is opened for `avel`, and no hold line is shown

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

### Requirement: Stopping a run lets each stage end
`/devkit roadmap stop` SHALL start nothing new and hand no new stage; each change under way SHALL
finish the stage it is in, and the reply SHALL say where each open change stays. `/devkit roadmap`
SHALL then go on from those places.

#### Scenario: Stop with two stages under way
- **WHEN** the person types `/devkit roadmap stop` while two changes run a stage each and a third waits for the owner
- **THEN** the reply says the run is stopping and where each of the three stays, and no stage is handed after the two end

#### Scenario: The run after a stop
- **WHEN** the two stages ended and the person types `/devkit roadmap`
- **THEN** the next stage of each change is handed

### Requirement: A blocked change keeps its place
A blocked change SHALL keep its place; the session SHALL say so once with the reason, the other
changes SHALL go on, and the changes whose `after:` names it SHALL wait.

#### Scenario: A stage fails
- **WHEN** a change's stage agent reports a failure on Opus, or its retry on the next model up fails too, in a run with two places
- **THEN** one line says the change stopped and why, the other open change goes on, and no new change takes its place

#### Scenario: A change that cannot be opened
- **WHEN** a ready line's change cannot be opened because its name is already taken by a branch
- **THEN** one line says it could not be opened, it fills its place as blocked, and its dependents wait

#### Scenario: A change stops while nothing else runs
- **WHEN** a change stops and no other change of the run is under way
- **THEN** its line says the change stopped, why, and that the changes after it wait, and does not say that the others go on

### Requirement: A run ends by itself
A run SHALL end when every roadmap line is archived; when nothing can start and nothing is under
way, listing what each open change needs (the owner's answer, a fix, a dependency); or when a stop was
asked and no stage is under way. A wait on GitHub SHALL have no time limit.

#### Scenario: Everything archived
- **WHEN** every line of the roadmap is archived
- **THEN** the reply says the roadmap is done and the run is over

#### Scenario: Every place filled by changes waiting for the owner or blocked
- **WHEN** every open change waits for the owner or is blocked and nothing is under way
- **THEN** the run ends listing, for each, the owner's gate or the reason it is blocked, and asks the first change's gate

#### Scenario: A run that was stopped
- **WHEN** a stop was asked and the last stage under way ends
- **THEN** the run ends with the stopped reply, followed by one line per open change saying where it stayed, and starts nothing

### Requirement: Calling the command again resumes from the files
Nothing SHALL be remembered between runs but one run's bookkeeping (its number, a stop asked, the
gate being asked, the stages under way, the ends the session declared, the events announced, whether
its changes run in sessions of their own, which change sessions were started, the start tickets, the
places held, the changes waiting for a place, the start-anyway of the moment, the wait loops under
way, the periodic check, which changes it opened for another machine, and what started the last turn),
kept outside every working tree. A run started from another session SHALL start that bookkeeping
empty, except the change sessions, their tickets, the places held, the changes waiting for a place, the
wait loops and which changes it opened for another machine, and continue every open change from its
files, starting no change twice and losing none. No change SHALL be given a second
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

#### Scenario: A change opened for another machine before its session started
- **WHEN** the run opened `a` for `avel`, the session was killed before `a`'s session started, and `/devkit roadmap` is typed in a new session
- **THEN** `a` is not opened again, and on that typed turn `a` gets its session on `avel`

### Requirement: A project without a roadmap is offered a draft
In a project without `openspec/roadmap.md`, `/devkit roadmap` SHALL start nothing and offer to write
a draft. On a yes, the draft SHALL be written in the session's checkout with one unticked line, with
no `after:`, per unfinished change of the current script, committed nowhere; the reply SHALL name the
changes of the previous script left out. On a no nothing SHALL be created.

#### Scenario: The offer
- **WHEN** `/devkit roadmap` is typed in a project without a roadmap
- **THEN** the reply offers to write a draft, and no file is written and no change started

#### Scenario: The draft on a yes
- **WHEN** the owner says yes and the project has `a` and `b` unfinished on the current script and `c` on the previous one
- **THEN** `openspec/roadmap.md` holds a round with the lines `a` and `b` and no `after:`, it is not committed, the reply names `c` as left out, and no change is started

#### Scenario: A file that appeared meanwhile
- **WHEN** the draft is asked for and `openspec/roadmap.md` exists
- **THEN** the file is not overwritten

### Requirement: Changes outside the roadmap are left alone
A change that is not on the roadmap, and a change begun under the previous script, SHALL never be
started or resumed by a run, SHALL fill no place and SHALL raise no question. A roadmap line whose
change began under the previous script SHALL be skipped with one line, and its dependents SHALL wait.

#### Scenario: An unfinished change not on the roadmap
- **WHEN** a change is unfinished on the current script and not on the roadmap
- **THEN** the run never hands it a stage and it fills no place

#### Scenario: A roadmap line on the previous script
- **WHEN** a roadmap line's change is unfinished and the earliest stage of its script that has a file has no stage header on any of its files, with or without headed later files
- **THEN** one line says it is left alone, it fills no place, and every line whose `after:` names it waits

#### Scenario: A headerless file that does not make a change previous
- **WHEN** a roadmap line's change has a headed earliest stage file and a headerless later one, or a stage of several files of which only some are headerless
- **THEN** the change is open on the current script and fills its place

### Requirement: The status command shows the whole picture
`/devkit status` SHALL change nothing and print a count line, a load line only while starts are held,
then, in order and each only when it has a row: the machines (only with the machines setting set),
waiting for the owner, under way, blocked, in the queue and outside the roadmap. Each open change's row
SHALL name its machine whenever a machine other than this one is listed or holds a change. It SHALL
work in any session, with or without a run.

#### Scenario: The owner's board
- **WHEN** a run with the number 4 holds one change at the plan approval, one in phase 2 of 4 of its implementation, one blocked by red tests, two lines in the queue (one ready, one waiting for another change), nine archived lines, an unfinished change of the previous script, and the load reads 92 with the limit 80, with the machines setting unset and no change open on another machine
- **THEN** the board's first line reads "Roadmap: 3 abertas de 4 · 2 na fila · 9 arquivadas" in Portuguese, the second "Começos segurados: processador em 92% (limite 80%)", and the five blocks follow in order with one row per change, ids aligned

#### Scenario: Blocks with nothing in them
- **WHEN** no change is blocked and none waits for the owner
- **THEN** those two blocks are not printed

#### Scenario: Nothing is changed
- **WHEN** `/devkit status` runs
- **THEN** no file, branch, worktree or bookkeeping is written and no change is started

#### Scenario: A ticked line not archived, and an archived line not ticked
- **WHEN** one line is ticked without an archived folder and another is archived but unticked
- **THEN** both are listed outside the roadmap, each saying which it is

#### Scenario: No roadmap
- **WHEN** `/devkit status` is typed in a project without `openspec/roadmap.md`
- **THEN** the reply says there is no roadmap and lists each unfinished change with where it stopped

#### Scenario: A ready line waits for a place only when the places are taken
- **WHEN** the number is 3, one change is open, three lines `a`, `b` and `c` are ready in that order, and the load is below the limit
- **THEN** `a` and `b` read "ready to start", `c` reads "ready, waits for a place", and no load line is printed

#### Scenario: Every place taken
- **WHEN** the number is 1, one change is open and a line is ready
- **THEN** the ready line reads "ready, waits for a place" whatever the load

#### Scenario: A free place and a loaded machine
- **WHEN** the number is 2, nothing is open, two lines are ready and the load is at or above the limit
- **THEN** the load line is printed and both lines read "ready, held by the load"

#### Scenario: A ready line waiting for the owner's next message
- **WHEN** in a run whose changes each have a session of their own, the last decision left ready change `a` for the owner's next message
- **THEN** `a`'s row in the queue says it starts in a session of its own at the owner's next message

#### Scenario: A change open only on another machine
- **WHEN** line `a`'s branch is on `origin` with a claim naming `avel`, `a` is not open in this clone, and the machines setting is unset
- **THEN** `a` is listed under way with its row naming `avel` and saying it is open there, it is not in the queue, and the rows of this clone's open changes name this machine

#### Scenario: The machines block
- **WHEN** the machines setting lists `avel` with 2 places, the number is 1, `avel` answers and holds one change in its implementation and one at its grill, and this machine holds one change at its plan
- **THEN** the count line gives the open changes, the queue and the archived ones with no number of places, the machines block lists this machine first with 0 of 1 places taken and 1 open, then `avel` with 1 of 2 places taken and 2 open, and each open change's row names its machine and its stage

#### Scenario: GitHub cannot be read
- **WHEN** `/devkit status` runs and the branches on `origin` cannot be listed
- **THEN** the board is printed from this clone alone with one line saying the changes open on other machines could not be read

### Requirement: The run's replies come from the one message table
Every line and reply of `/devkit roadmap` and `/devkit status` SHALL come from the message table of
`/devkit change`, in the person's language (`pt-BR` or `en`), with no internal term.

#### Scenario: Both languages
- **WHEN** every new message of the table is rendered in English and in Brazilian Portuguese
- **THEN** both languages have the same keys and none holds a stage, role or step id, a file name, a script name or an option, except the budget stop's reply of `/devkit change`, which names the change's settings file

#### Scenario: A blocked line for every reason
- **WHEN** a change of the run stops for any reason a change can stop with (a stage failed too often, a change of the previous script, a change that could not be opened, and every other)
- **THEN** its line and its entry in the list of a run that ends say that reason in the person's language, with the reason's own details, and the run goes on

#### Scenario: A gate phrase for every owner gate
- **WHEN** a change of the run waits for the owner at any gate a change can wait at (the grill, the plan approval, the retro, a merge, a decision, a disputed review, an unfinished file, a delivery by hand, a token budget reached)
- **THEN** its line names the change and says what the owner is asked for in the person's language

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
for a place (also a free place on its machine, with the machines setting set), for the load or for its
dependencies, its title SHALL be ⏳ and the change id, the stage icon replaced and no other icon, and
its stage icon again once it goes on. When the title changes, the session SHALL
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

#### Scenario: Waiting for a place
- **WHEN** the change's plan is approved and its machine has no free place
- **THEN** the session's title goes from `🙋 📝 <id>` to `⏳ <id>`, with no state icon, and to `🛠️ <id>` once it takes a place

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

### Requirement: Each decision of a run with a session per change names its turn
The session SHALL name each decision's turn as one the owner typed or not. A decision whose turn is
not named SHALL be read as not typed, and a turn word the loop does not know SHALL be refused with a
message naming it, before anything is written.

#### Scenario: No turn named
- **WHEN** in a run with a session per change, line `a` is ready with a place free, and the session asks for the next decision without naming its turn
- **THEN** `a` is not opened, and one line says `a` starts in a session of its own at the owner's next message

#### Scenario: A turn word the loop does not know
- **WHEN** the session asks for the next decision naming its turn with a word other than the two the loop knows (for example `message`, or an empty word)
- **THEN** the call exits with a message naming the word, nothing is started or opened, and the run's bookkeeping is unchanged

### Requirement: The owner can start held changes anyway
While a start is held by the load, the owner's own message saying to start anyway SHALL start, in
the next decision, the changes held at that moment whatever the load. It SHALL hold for that decision
only: a change that becomes ready later SHALL be held again and its hold line shown again. Nothing
but the owner's own message SHALL start a held change, and no permission SHALL be kept anywhere.

#### Scenario: Start anyway
- **WHEN** two places are free, two lines are ready, the load reads 95 with the limit 80, and the owner says to start anyway
- **THEN** both changes are started in the next decision and no line about the hold is shown

#### Scenario: A change ready later
- **WHEN** after that, in the same run, a third line becomes ready with a place free and the load still at 95
- **THEN** its start is held, the hold line is shown again, and the owner is asked again

#### Scenario: No kept permission
- **WHEN** the held changes were started anyway
- **THEN** the run's bookkeeping holds nothing that starts a later change, and a decision that is not the owner's start-anyway call holds by the load as before

### Requirement: A watch of the load that died holds nothing
A watch of the load that ended without clearing its mark (its process killed, the machine asleep, the
session stopped) SHALL count as no watch: the next decision SHALL start the held change when the load
is below the limit, and when the load is still at or above it SHALL hold the start again and ask for
a new watch.

#### Scenario: Killed while the machine is loaded
- **WHEN** the watch of a held start is killed and the next decision reads the load at 92 with the limit 80
- **THEN** the start stays held and the decision asks for a new watch of the load

#### Scenario: Killed and the load fell
- **WHEN** the watch of a held start is killed and the next decision, on a turn the owner typed, reads the load at 40 with the limit 80
- **THEN** the held change is started

#### Scenario: A watch still alive
- **WHEN** the watch of a held start is running and the load is still at 92
- **THEN** no second watch is asked for

### Requirement: The loop refuses an id that is not a change id
Every change id the session passes to the roadmap loop, to name the stage that came back, the change
an end is declared for, or the change a wait on GitHub is for, SHALL have the form of a change id on
the roadmap: a letter or a digit, then letters, digits, `_`, `.` or `-`. Any other id SHALL be
refused with a message naming it, before anything is read or written.

#### Scenario: A stage that came back with a strange id
- **WHEN** the session asks for the next decision naming the change `__proto__` as the one whose stage came back
- **THEN** the call exits with a message naming `__proto__` and the run's bookkeeping is unchanged

#### Scenario: An end declared for a strange id
- **WHEN** the session declares a blocked end for the change `../x`
- **THEN** the call exits with a message naming `../x`, no end is recorded and the bookkeeping is unchanged

### Requirement: The bookkeeping is written whole or not at all
Every write of the run's bookkeeping SHALL either replace the file whole or leave it as it was, and a
write that fails SHALL leave no temporary file beside it.

#### Scenario: A write that fails
- **WHEN** writing the run's bookkeeping fails after its temporary file was created
- **THEN** the call reports the failure, the file is as it was before the call, and no temporary file is left in its folder

### Requirement: The board places each open change by its state
`/devkit status` SHALL place the row of each open change by the change's state as the state command
gives it: `waiting-for-owner` in the block of changes waiting for the owner, `blocked` in the blocked
block, `running` and `waiting-on-github` under way. Its blocks, its counts and the words of every row
SHALL stay as they are.

#### Scenario: One change in each state
- **WHEN** a run holds one change at the plan approval, one handed to its agent, one waiting on GitHub's checks, one blocked by red tests and one archived
- **THEN** the board lists the first under "Waiting for you", the second and third under "Under way", the fourth under "Blocked", and the archived one in no block

#### Scenario: A change with no session of its own
- **WHEN** in a run with a session per change an open roadmap change has no session
- **THEN** its row is under "Under way" and says it starts in a session of its own at the owner's next message

#### Scenario: GitHub does not answer
- **WHEN** an open roadmap change waits on GitHub because GitHub did not answer
- **THEN** its row is under "Under way" and says it is waiting on GitHub, which did not answer

#### Scenario: The board and the command agree
- **WHEN** `/devkit status` and the state command run on the same project and run file
- **THEN** every open roadmap change's block on the board is the block of its state in the command's output

### Requirement: A line open on another machine is never opened again
A roadmap line whose branch exists on `origin` with its change's folder, and whose change is not open
in this clone and not archived on the default branch, SHALL be open on another machine. A run SHALL
never open it nor show it as ready; it SHALL fill no place of this machine, and lines whose `after:`
names it SHALL wait for its archive.

#### Scenario: Three changes opened on the Linux worker
- **WHEN** lines `a`, `b` and `c` were opened on another machine, their branches are on `origin`, and `/devkit roadmap 3` is typed on the Mac
- **THEN** none of them is opened on the Mac, no line says one started, and the board lists the three as open on their machine

#### Scenario: A dependent line
- **WHEN** line `d` names `after: a` and `a` is open on another machine
- **THEN** `d` waits for `a`

#### Scenario: Claimed between two decisions
- **WHEN** a decision chose to open `a`, and another machine's claim of `a` reached `origin` before this machine's push
- **THEN** the opening is refused, no blocked line is kept for `a`, and the next decision lists `a` as open on the other machine

### Requirement: The person's machines setting
The devkit-openspec pack SHALL have a per-person `machines` setting: a JSON list whose entries each give
`host` (the app's SSH connection name), `folder` (the absolute path of the repository there) and
`places` (a whole number from 1 up). Unset, empty or not substituted, every change SHALL run on this
machine exactly as before. A malformed setting, or an entry that lacks a field, SHALL be refused
naming it.

#### Scenario: Unset
- **WHEN** the setting is absent, empty, `[]` or not substituted, and `/devkit roadmap 2` is typed
- **THEN** the run behaves as before this change: every change opens on this machine, every open change fills one of the 2 places, and no machine is reached over SSH

#### Scenario: An entry that lacks a field
- **WHEN** the setting is `[{"host":"avel","folder":"/home/kaue/repos/devkit"}]` and `/devkit roadmap` or `/devkit status` is typed
- **THEN** the reply names the entry `avel` and its missing `places`, nothing is started or written, and no machine is reached

#### Scenario: Not a list
- **WHEN** the setting is `avel:/home/kaue/repos/devkit:2`
- **THEN** the reply says the machines setting is not a list it can read and shows the form of one entry, and nothing is started or written

#### Scenario: Read entries
- **WHEN** the setting is `[{"host":"avel","folder":"/home/kaue/repos/devkit","places":2}]`
- **THEN** the run reaches `avel` over SSH in `/home/kaue/repos/devkit`, counts 2 places there, and this machine comes first with the run's number as its places

### Requirement: A change opens on the machine with the fewest open changes
With the machines setting set, each change a run opens SHALL go to the machine that answers with the
fewest open changes, every stage counted, ties broken by the order of the setting with this machine
first. This machine SHALL be skipped while its load is at or above the limit. With no machine able to
take it, the start SHALL be held, with its line.

#### Scenario: The fewest open changes
- **WHEN** this machine holds two open changes, `avel` holds one, both answer, the load is below the limit, and line `e` is ready on a typed turn
- **THEN** `e` is opened for `avel`

#### Scenario: A tie
- **WHEN** this machine and `avel` hold one open change each, both answer and the load is below the limit
- **THEN** the ready change is opened on this machine

#### Scenario: Several ready lines
- **WHEN** this machine and `avel` hold nothing, three lines are ready, the load is below the limit, and the turn was typed
- **THEN** all three are opened, the first on this machine, the second on `avel`, the third on this machine, because the grill and the plan take no place

#### Scenario: Loaded and nobody answers
- **WHEN** the load reads 92 with the limit 80 and `avel` does not answer
- **THEN** no change is opened, and the hold line and the board say the start is held

### Requirement: A change on another machine gets its session there
A change a run opened for another machine SHALL get its worktree on that machine, in the setting's
folder, from its branch on `origin`, and then an app session started by the coordinating session on
that machine's SSH connection, in that worktree, nested under it, only on a turn the owner typed. A
change opened there by someone else SHALL get no session from the run.

#### Scenario: The session starts on a typed turn
- **WHEN** on a typed turn the run opened `e` for `avel`
- **THEN** `e`'s worktree exists in `/home/kaue/repos/devkit/.claude/worktrees/e` on `avel`, the coordinating session starts a session on the SSH connection `avel` in that folder, titled `❓ e`, running `/devkit change e`, and one line says `e` started on `avel`

#### Scenario: A turn nobody typed
- **WHEN** a change session's end-of-turn report starts a turn, and `e`, opened for `avel` earlier, has no session yet
- **THEN** no session is started, and one line says `e` starts on `avel` at the owner's next message

#### Scenario: The host refuses
- **WHEN** the coordinating session asks the host to start `e`'s session on `avel` on a typed turn and the host refuses
- **THEN** one line says `e` could not start and starts at the owner's next message, and no other session start is asked for on that turn

#### Scenario: The worktree cannot be made
- **WHEN** the worktree of `e` cannot be made on `avel`
- **THEN** `e` is declared blocked with the reason and the machine, it keeps its claim and its place on `avel`, and no session is started for it

#### Scenario: A change someone else opened there
- **WHEN** `avel` holds change `f` that the run did not open
- **THEN** the run starts no session for `f` and shows it on the board with `avel`

### Requirement: A place is taken from the implementation on
With the machines setting set, a change SHALL take a place on its machine only from its implementation
on; its grill and its plan SHALL start at once. A machine's places SHALL be held by its changes that
took one. This machine's places SHALL be the run's number, and another machine's those of its entry,
recorded in each change's claim when it is opened.

#### Scenario: Grill and plan never wait
- **WHEN** the machines setting lists `avel`, which does not answer, this machine's only place is held by change `b` in its implementation, and line `c` is ready on a typed turn with the load below the limit
- **THEN** `c` is opened on this machine and its session starts at its grill

#### Scenario: The board's places
- **WHEN** `avel`'s entry gives 2 places and `avel` holds one change in its review and two at their plan
- **THEN** the machines block reads 1 of 2 places taken and 3 open for `avel`

### Requirement: A freed place tells one waiting change to go on
When a machine has a free place and a change of it waits for a place, the coordinating session SHALL
send one message to that change's session, first such change in the roadmap's order, saying a place
is free. It SHALL send it once while nothing changes on that machine. The change SHALL implement only
if its own check finds the place free.

#### Scenario: A change archived frees a place
- **WHEN** `b`, holding `avel`'s only place, is archived, its session's end-of-turn report reaches the coordinating session, and `c` on `avel` waits for a place
- **THEN** the coordinating session sends `c`'s session a message saying a place on `avel` is free, and one line says so

#### Scenario: Once per state
- **WHEN** the coordinating session decides again and nothing on `avel` changed since that message
- **THEN** no second message is sent

#### Scenario: The place was taken meanwhile
- **WHEN** `c` is told a place is free but another change of `avel` took it first
- **THEN** `c` stays waiting for a place, and the coordinating session sends no new message until a place frees again

### Requirement: A machine that does not answer keeps its changes
A listed machine that does not answer over SSH within the bounded time SHALL get no new change. The
board SHALL mark it "no answer", and each of its open changes SHALL be shown with the machine and "no
answer" in place of the stage; they keep their places, and nothing reopens them on another machine.

#### Scenario: The Linux worker is asleep
- **WHEN** `avel` holds changes `a` and `b`, does not answer, and line `e` is ready on a typed turn with this machine below the load limit
- **THEN** `e` is opened on this machine, `a` and `b` are not opened anywhere, and one line says `avel` does not answer

#### Scenario: The board of a silent machine
- **WHEN** `/devkit status` runs while `avel` does not answer
- **THEN** the machines block reads "no answer" for `avel`, and the rows of `a` and `b` name `avel` and read "no answer" in place of their stage

#### Scenario: The machine answers again
- **WHEN** `avel` answers at a later decision
- **THEN** its changes show their stages again and it may take new changes

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
implementation, a unit or E2E test stage, the evidence or the review, whatever its state. At most
the run's number of the changes on the run's ticket SHALL hold a place at once; the grill and the
plan SHALL need none. A change that needs a place and finds none, or finds the machine loaded, SHALL wait
in its own session. A change no longer open SHALL hold no place.

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

### Requirement: With the machines setting set, a change session of this machine takes its place from the run's own count
With the machines setting set, the run's number SHALL be this machine's places, applied to each count
apart. A change of this machine on the run's ticket SHALL take its place only from the run's count,
its plan on `origin` no place taken. Any other change SHALL keep "A place is taken from the
implementation on". With both kinds at once the places held MAY exceed the number; the board's row
of this machine SHALL count both.

#### Scenario: The places of each machine with the machines setting set
- **WHEN** the number is 1, the machines setting lists `avel` with 2 places, `a` of this machine, whose session claimed the run's ticket, holds this machine's place, and `e` on `avel` reaches its implementation with no place of `avel` taken
- **THEN** `e` takes a place on `avel`, and `b` of this machine, whose session claimed the run's ticket, waits in its own session for this machine's place when it reaches its implementation

#### Scenario: An approved plan pushed is no place taken on this machine
- **WHEN** the machines setting is set, the number is 1, `a` of this machine, whose session claimed the run's ticket, holds the place in its implementation, and `b` of this machine, whose session also claimed the run's ticket, has its approved plan on `origin` and waits for a place
- **THEN** the row of this machine in the machines block reads 1 of 1 place taken, and `b` waits in its own session with the title `⏳ b`, never blocked waiting for a place

#### Scenario: A change reaches its implementation before its plan is pushed
- **WHEN** the machines setting is set, the number is 2, two other changes of this machine, each on a ticket a session claimed, have their approved plans on `origin`, one holds a place in its implementation and the other is in its delivery, and `c` of this machine, whose session claimed the run's ticket, reaches its implementation before the coordinating session pushed its plan
- **THEN** `c` takes the free place and is handed its implementation, and no step of `c` takes or waits for a place counted from `origin`

#### Scenario: The place frees before the claim on origin does
- **WHEN** the machines setting is set, the number is 1, `a` of this machine, whose session claimed the run's ticket, held the place and moved to its delivery while its branch on `origin` still holds its approval, and `b` of this machine, whose session claimed the run's ticket, waits for a place
- **THEN** the row of this machine reads 0 of 1 place taken until `b` takes the place at its next check, and once `a` is archived nothing of `a` is counted on this machine

#### Scenario: A change of this machine with no claimed ticket
- **WHEN** the machines setting is set, the number is 1, `occupied` holds no change, `b` of this machine, whose ticket no session claimed either, has its approved plan on `origin`, and `d` of this machine, whose ticket no session claimed, reaches its implementation
- **THEN** `d` ends blocked waiting for a place on this machine (1 of 1 taken), titled `⏳ d`, and the row of this machine reads 1 of 1 place taken

#### Scenario: Both kinds of change at once
- **WHEN** the machines setting is set, the number is 1, `d` of this machine, whose ticket no session claimed, holds a place by its approved plan on `origin`, no change holds one by the run's count, and `a` of this machine, whose session claimed the run's ticket, reaches its implementation
- **THEN** `a` takes the place by the run's count and is handed its implementation, and the row of this machine reads 2 of 1 places taken

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
Each firing SHALL have the triage answer ahead the grills not being asked whose flow lists it, hand
a freed place to the first change waiting for one, stop the run's stale wait loops, and archive the
session of each archived change. It SHALL show the owner one message only when something changed or
needs them. It SHALL NOT write an approval or a retro answer, hand a stage or start a session. Only
a process still a wait loop of the run SHALL be stopped.

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

#### Scenario: A grill on an older flow
- **WHEN** the check fires, `b`'s grill is not the one being asked, and `b` follows flow 1 of its script (no recorded flow, or version 1) with flow 2 installed
- **THEN** the check gives no triage for `b`, and `b`'s questions wait for the owner in its grill

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

### Requirement: A change session starts on its stage's model
In a run with a session per change, the start of a change session SHALL carry, in the host start
tool's input, the model of the stage the change is at, and the run SHALL record that model as the
session's. A session found already running SHALL be recorded with no known model.

#### Scenario: A new change starts at its grill
- **WHEN** on a typed turn ready change `a` is opened and its session is started, with no `models:` table set
- **THEN** the start's input holds the model `opus`, and the run records `opus` for `a`'s session

#### Scenario: A change resumed at its implementation
- **WHEN** on a typed turn open change `b`, at its implementation, has no session of its own
- **THEN** the start's input holds the model `sonnet`

#### Scenario: A session the app already lists
- **WHEN** the app's list holds a session in `a`'s worktree and the coordinating session reports it found instead of started
- **THEN** the run records `a`'s session with no known model and never switches it, counts it as `a`'s own session as it counts a started one (no second start, no stage of `a` handed by the coordinating session), and announces it once as started

### Requirement: A change session only steps down
When a change session's floor is cheaper than the session's recorded model (Haiku below Sonnet
below `sonnet[1m]` below Opus below `opus[1m]`), the run SHALL return one action switching the
session to the floor, on any turn, and record it once reported done. It SHALL NOT return a switch
below the floor, to an equal or more expensive model, or again after that switch was refused.

#### Scenario: From the plan to the approval
- **WHEN** `a`'s session is recorded on `opus` and `a`'s end-of-turn report arrives while `a` waits at the plan approval, whose model is `sonnet`, with no `models:` table set
- **THEN** the decision holds one action switching `a`'s session to `sonnet`, and after it is reported done the run records `sonnet`

#### Scenario: A Haiku stage with a session-run stage ahead
- **WHEN** `a`'s session is recorded on `sonnet`, `a` is at its unit tests or at its delivery, whose model is `haiku`, and no `models:` table is set
- **THEN** no switch is returned, because the retro still ahead runs on `sonnet`, and `a`'s own loop hands the Haiku stage to its agent on `haiku`

#### Scenario: A floor above the stage's model
- **WHEN** `a`'s session is recorded on `opus`, `a` is at its unit tests, whose model is `haiku`, and the project's table holds `review: opus`
- **THEN** no switch is returned, because the floor is `opus`

#### Scenario: Haiku once no session-run stage needs more
- **WHEN** `a`'s session is recorded on `sonnet`, `a` is at its delivery, whose model is `haiku`, and the project's table holds `retro: haiku`
- **THEN** the decision holds one action switching `a`'s session to `haiku`

#### Scenario: A refused switch
- **WHEN** the switch of `a`'s session to `sonnet` was reported refused
- **THEN** no later decision returns that switch again while `a`'s session is recorded on the same model

#### Scenario: A stopping run
- **WHEN** the run is stopping
- **THEN** no switch is returned

### Requirement: A change session's floor is set by the session-run stages ahead
A change session's floor SHALL be the strongest model among its change's current stage and the
session-run stages of its script still ahead, that stage included. The session-run stages SHALL be
the grill, the owner's approval, the review, the delivery and the retro, the stages a change
session performs itself; every other stage runs as a stage subagent, so the table's Haiku rows
reach a change session only when no session-run stage ahead needs more.

#### Scenario: The default table never steps a session to Haiku
- **WHEN** no `models:` table is set and a change session goes through every stage of its change
- **THEN** no switch to `haiku` is ever returned for it, and its unit tests and delivery hand-offs carry `haiku`

### Requirement: A stage above the session's model never switches it
A stage whose model is above the change session's recorded model SHALL NOT switch the session: a
stage that runs as a stage subagent SHALL be handed on its own model, and a session-run stage SHALL
be performed on the session's model.

#### Scenario: A stage above the session's model
- **WHEN** `a`'s session is recorded on `sonnet` and `a` is at the design stage, whose model is `opus`
- **THEN** no switch is returned; `a`'s own loop hands the design stage to its agent on `opus`

#### Scenario: A session-run stage above the session's model
- **WHEN** `a` was resumed at its implementation, its session is recorded on `sonnet`, the project's table holds `retro: opus`, and `a` reaches its retro
- **THEN** no switch is returned, and the session performs the retro on `sonnet`

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
