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
unknown setting, and with a driver other than `claude`.

#### Scenario: A project not set up
- **WHEN** `/devkit roadmap` or `/devkit status` is typed in a project whose schema is another one
- **THEN** the reply says the project is not set up for devkit, and nothing is started or written

#### Scenario: Another driver
- **WHEN** `devkit.driver` is `compozy` and `/devkit roadmap` is typed
- **THEN** the reply says that driver is not built yet and names round 21, and nothing is started

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
Every change of the roadmap that is open on the current script SHALL fill one place, whatever it is
doing: running, waiting for the owner, waiting on GitHub or blocked. A change open before the run
SHALL be resumed and counted before any new one starts. With every place filled nothing SHALL start.

#### Scenario: Every place filled by changes that do not run
- **WHEN** the number is 2, one open change waits for the owner's approval, another waits on GitHub, and a third line is ready
- **THEN** the third change is not started

#### Scenario: A change open before the run
- **WHEN** the run starts with the number 1 while a roadmap change opened earlier by `/devkit change` is unfinished on the current script
- **THEN** that change is resumed and no other change is started

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
to 1000) no change SHALL start, also when none is open; the hold SHALL be said once, rechecked every
minute and released by itself below the limit. A change under way SHALL never be stopped by the load.

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
- **WHEN** a start is held in a run whose changes each have a session of their own, and the load reads below the limit at a check
- **THEN** the change is not started on that turn, and one line says it starts in a session of its own at the owner's next message, with the reason

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
shown once. In a run whose changes each have a session of their own, a change's gates and its stop
SHALL be said in that change's session and not in the coordinating session.

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
- **THEN** `a`'s own session asks for the approval, and the coordinating session shows no line for it

#### Scenario: Moving from one stage to the next
- **WHEN** an open change goes from one stage to the next, or starts waiting on GitHub
- **THEN** no line is shown

#### Scenario: The same state again
- **WHEN** the run decides again and a change is in the same announced state
- **THEN** its line is not shown again

### Requirement: The owner's gates are asked one change at a time
When open changes wait at gates of the owner (the grill, the mock-up approval, the plan approval,
the retro answers, a pull-request decision only the owner can take, a merge left to the owner) in a
run whose changes run in the coordinating session, that session SHALL ask the gates of one change at
a time, in the order of the roadmap file, naming the change; the next change's questions SHALL come
only when that change's gate is answered. In a run whose changes each have a session of their own,
each change's gates SHALL be asked in its own session, and the coordinating session SHALL ask none.

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
- **THEN** `a`'s questions are asked in `a`'s session and `b`'s in `b`'s, and the coordinating session asks neither

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
- **WHEN** a change's stage agent reports a failure in a run with two places
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
its changes run in sessions of their own, which change sessions were started, and what started the
last turn), kept outside every working tree. A run started from another session SHALL start that
bookkeeping empty, except which change sessions were started, and continue every open change from
its files, starting no change twice and losing none. No change SHALL be given a second session while
a session of its own is still open; only a run asked to start fresh forgets the change sessions.

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
- **THEN** `a` is not given a second session, and the run counts it in its place

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
`/devkit status` SHALL change nothing and print a count line (open changes and the number, the queue,
the archived ones), a load line only while starts are held, then, in this order and each only when
it has a row: waiting for the owner, under way, blocked, in the queue (with what each waits for) and
outside the roadmap. It SHALL work in any session, with or without a run.

#### Scenario: The owner's board
- **WHEN** a run with the number 4 holds one change at the plan approval, one in phase 2 of 4 of its implementation, one blocked by red tests, two lines in the queue (one ready, one waiting for another change), nine archived lines, an unfinished change of the previous script, and the load reads 92 with the limit 80
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

### Requirement: The run's replies come from the one message table
Every line and reply of `/devkit roadmap` and `/devkit status` SHALL come from the message table of
`/devkit change`, in the person's language (`pt-BR` or `en`), with no internal term.

#### Scenario: Both languages
- **WHEN** every new message of the table is rendered in English and in Brazilian Portuguese
- **THEN** both languages have the same keys and none holds a stage, role or step id, a file name, a script name or an option

#### Scenario: A blocked line for every reason
- **WHEN** a change of the run stops for any reason a change can stop with (a stage failed too often, a change of the previous script, a change that could not be opened, and every other)
- **THEN** its line and its entry in the list of a run that ends say that reason in the person's language, with the reason's own details, and the run goes on

#### Scenario: A gate phrase for every owner gate
- **WHEN** a change of the run waits for the owner at any gate a change can wait at (the grill, the mock-up approval, the plan approval, the retro, a merge, a decision, a disputed review, an unfinished file, a delivery by hand)
- **THEN** its line names the change and says what the owner is asked for in the person's language

### Requirement: Each change of a roadmap run runs in a session of its own where the host can start sessions
Where the host can start sessions, every change a run starts or resumes SHALL run in a session of its
own, nested under the coordinating session, in the change's worktree, running `/devkit change`. Its
stages, owner questions and approvals SHALL happen there. The coordinating session SHALL pick, open,
start sessions, hold for the load and show the lines and board, and hand no stage. Where the host
cannot start sessions, the changes SHALL run in the coordinating session as before.

#### Scenario: Two changes start, each in its own session
- **WHEN** the owner types `/devkit roadmap 2` in the desktop app with two ready lines `a` and `b`
- **THEN** both are opened, each gets a session of its own nested under the owner's session and started in its own worktree, one line per change says it runs in a session of its own, and the coordinating session hands no stage

#### Scenario: A change open before the run
- **WHEN** the run starts in the desktop app while roadmap change `a`, opened earlier, is unfinished and has no session of its own
- **THEN** `a` gets a session of its own that goes on from where it stopped, and it counts in its place

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
owner typed, so a change made ready by the archive SHALL wait for the owner's next message, with its
line.

#### Scenario: A change archived in its session
- **WHEN** `a`'s session archives `a` and its end-of-turn report reaches the coordinating session, and line `c` is ready with the place `a` left
- **THEN** the coordinating session says `a` was archived, `c` is not opened on that turn, and one line says `c` starts in a session of its own at the owner's next message

#### Scenario: A report with nothing new
- **WHEN** a change session's end-of-turn report reaches the coordinating session and nothing changed for the run
- **THEN** the coordinating session shows no line and starts nothing

### Requirement: A change session shows the stage its change is in
A change session SHALL be titled with its change's stage icon (❓ requirements, 📝 plan, 🛠️ code, 🔍
review, 🚀 delivery, 📦 archive) and the change id while the change runs; while it is stopped, with
the state icon (🙋 waiting for the owner, ⏳ waiting on GitHub, ⛔ blocked), a space, then that
title; `📦 <id>` once archived; cut to 59 code points. When the title changes, the session SHALL
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

#### Scenario: Waiting on GitHub
- **WHEN** the change waits on its pull request's checks, or GitHub did not answer
- **THEN** the title is `⏳ 🚀 <id>`

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
any other turn, or when the host refuses the start, a ready change SHALL NOT be opened: one line
SHALL say it starts in a session of its own at the owner's next message, with the reason, and the
board SHALL say the same. A ready change SHALL never be left without a line, nor run in the
coordinating session in place of its own session.

#### Scenario: A report from a change session
- **WHEN** a change session's end-of-turn report starts a turn in the coordinating session while line `b` is ready with a place free
- **THEN** `b` is not opened on that turn, and one line says `b` starts in a session of its own at the owner's next message

#### Scenario: The load eased on a turn nobody typed
- **WHEN** a start of `a` is held, the watch of the load ends below the limit, and the coordinating session decides on that turn
- **THEN** `a` is not opened, one line says `a` starts in a session of its own at the owner's next message because the app starts a session only on a turn the owner typed, and the board's row for `a` says the same

#### Scenario: The owner's next message
- **WHEN** after that the owner types any message in the coordinating session
- **THEN** `a` is opened and started in a session of its own, and one line says so

#### Scenario: The host refuses the start
- **WHEN** the coordinating session asks the host to start `a`'s session on a typed turn and the host refuses
- **THEN** one line says `a` could not start in a session of its own and starts at the owner's next message, and no other session start is asked for on that turn

#### Scenario: Never without a line
- **WHEN** a decision leaves a ready change unstarted for any reason
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
