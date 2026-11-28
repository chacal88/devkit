<!-- devkit-stage specs result=passed attempt=2 commit=5a3d5cd1134419c8a804eeb76ef23c7e51c465c2 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The roadmap command reads its number
`/devkit roadmap` SHALL take the number of changes that may be open at once from the word after it:
none is 1, a whole number written in digits from 1 to 99 is that number, `stop` stops the run, and
`tick` is a firing of the run's scheduled task. Any other word, or a number below 1, SHALL be answered
in one plain sentence naming the word, and nothing SHALL be started or written.

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

#### Scenario: The tick's word
- **WHEN** the run receives `roadmap tick`
- **THEN** it reads it as a firing of the run's scheduled task, and the number of the run is unchanged

### Requirement: The number can change during a run
Typing `/devkit roadmap <n>` again while the run's scheduled task exists SHALL change the number of
that run, from any session of the clone. A higher number SHALL let more changes start; a lower one
SHALL interrupt no helper and only keep new claims back until the changes holding places fall below
it.

#### Scenario: A higher number
- **WHEN** a run with the number 1 has one open change and the person types `/devkit roadmap 2` while another line is ready
- **THEN** the other change is started at a later tick, and the change already open goes on

#### Scenario: A lower number
- **WHEN** a run with the number 3 has three changes holding places and the person types `/devkit roadmap 1`
- **THEN** no helper is stopped or interrupted, and no change takes a place while two or more still hold one

### Requirement: Starts are held while the machine is loaded
Before a tick claims an item whose next stage takes a place, the processor load of the last minute
per logical core SHALL be read as a percentage. At or above the person's limit (`load_limit`, 80 when
unset or not a whole number from 1 to 1000) no such item SHALL be claimed on this machine; the hold
SHALL be said once and released by itself at a tick below the limit. A stage under way SHALL never be
stopped by the load.

#### Scenario: Loaded with nothing open
- **WHEN** no roadmap change holds a place, an item's implementation is ready, and the load reads 92 with the limit 80
- **THEN** the item is not claimed, and one line says the start is held, with 92% and the limit 80%, and that the owner can say to start it anyway

#### Scenario: The hold is said once
- **WHEN** the load stays at or above the limit at the next ticks
- **THEN** no new line about the hold is shown

#### Scenario: The load falls
- **WHEN** a start is held and a later tick reads the load below the limit
- **THEN** the item is claimed without a word from the owner

#### Scenario: The load falls in a run with a session per change
- **WHEN** line `a` is pending while the load reads 92 with the limit 80, and the load falls below it once `a` reaches its implementation
- **THEN** `a`'s grill and plan were driven by ticks meanwhile, because they take no place, and only its taking of a place waited for the load

#### Scenario: A change under way
- **WHEN** a helper is driving a stage and the load rises above the limit
- **THEN** that stage goes on to its end

#### Scenario: An unset or unreadable limit
- **WHEN** the person's `load_limit` is absent, `80%`, `0` or not substituted
- **THEN** the limit is 80

#### Scenario: A system that reports no load
- **WHEN** the system reports a load of 0
- **THEN** the machine never counts as loaded

#### Scenario: Loaded while another machine answers
- **WHEN** the machines setting lists `avel`, `avel` answers, a line is ready at a tick, and the load reads 92 with the limit 80
- **THEN** the change is opened for `avel`, and no hold line is shown

### Requirement: Stopping a run lets each stage end
`/devkit roadmap stop` SHALL delete the run's scheduled task, claim nothing new, and let each helper in
flight finish the step it is in and record its wait; the reply SHALL say where each open change stays.
`/devkit roadmap` SHALL then go on from those places.

#### Scenario: Stop with two stages under way
- **WHEN** the person types `/devkit roadmap stop` while two helpers drive a stage each and a third change waits for the owner
- **THEN** the task is deleted, the reply says the run is stopping and where each of the three stays, and no claim is recorded after the two helpers end

#### Scenario: The run after a stop
- **WHEN** the two helpers ended and the person types `/devkit roadmap`
- **THEN** one task is installed again, and the next ticks drive each change from its files

### Requirement: A run ends by itself
A run SHALL end when every roadmap line of its queue is archived, the tick that finds it deleting the
task, or when a stop was asked. A run whose every open change waits for the owner or is blocked SHALL
keep its task, its ticks refused before the model until an answer or a fix makes an item ready. A wait
on GitHub SHALL have no time limit.

#### Scenario: Everything archived
- **WHEN** a tick fires and every line of the queue is archived
- **THEN** the task is deleted, and the reply says the roadmap is done and the run is over

#### Scenario: Every place filled by changes waiting for the owner or blocked
- **WHEN** every open change waits for the owner or is blocked
- **THEN** the task stays, each firing is refused before the model, and `/devkit status` lists, for each, the owner's gate or the reason it is blocked

#### Scenario: A run that was stopped
- **WHEN** a stop was asked and the last helper in flight ends
- **THEN** no task is left and no claim is recorded

### Requirement: The status command shows the whole picture
`/devkit status` SHALL change nothing and print a count line, a load line only while starts are held,
then, in order and each only when it has a row: the machines (only with the machines setting set),
waiting for the owner (from the run file's lines), under way, blocked, in the queue and outside the
roadmap. Each open change's row SHALL name its machine whenever a machine other than this one is
listed or holds a change. It SHALL work in any session, with or without a run.

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
- **WHEN** the number is 3, one change holds a place, three lines `a`, `b` and `c` are ready to take one in that order, and the load is below the limit
- **THEN** `a` and `b` read "ready to start", `c` reads "ready, waits for a place", and no load line is printed

#### Scenario: Every place taken
- **WHEN** the number is 1, one change holds the place and a line is ready to take one
- **THEN** the ready line reads "ready, waits for a place" whatever the load

#### Scenario: A free place and a loaded machine
- **WHEN** the number is 2, nothing holds a place, two lines are ready to take one and the load is at or above the limit
- **THEN** the load line is printed and both lines read "ready, held by the load"

#### Scenario: A line for the owner
- **WHEN** the run file holds a line for `a`'s plan approval
- **THEN** `a` is listed under the owner's block with that gate, and the row says the answer is given in the session the run was typed in

#### Scenario: A ready line waiting for the owner's next message
- **WHEN** a run file written before the run had a task records line `a` as a start left for the owner's next message
- **THEN** that record is not read, and `a`'s row reads as any ready line of the queue

#### Scenario: A claimed change
- **WHEN** `a` has a live claim and its helper drives its design
- **THEN** `a` is listed under way at its design

#### Scenario: A change open only on another machine
- **WHEN** line `a`'s branch is on `origin` with a claim naming `avel`, `a` is not open in this clone, and the machines setting is unset
- **THEN** `a` is listed under way with its row naming `avel` and saying it is open there, it is not in the queue, and the rows of this clone's open changes name this machine

#### Scenario: The machines block
- **WHEN** the machines setting lists `avel` with 2 places, the number is 1, `avel` answers and holds one change in its implementation and one at its grill, and this machine holds one change at its plan
- **THEN** the count line gives the open changes, the queue and the archived ones with no number of places, the machines block lists this machine first with 0 of 1 places taken and 1 open, then `avel` with 1 of 2 places taken and 2 open, and each open change's row names its machine and its stage

#### Scenario: GitHub cannot be read
- **WHEN** `/devkit status` runs and the branches on `origin` cannot be listed
- **THEN** the board is printed from this clone alone with one line saying the changes open on other machines could not be read

### Requirement: The board places each open change by its state
`/devkit status` SHALL place the row of each open change by the change's state as the state command
gives it: `waiting-for-owner` in the block of changes waiting for the owner, `blocked` in the blocked
block, `running` and `waiting-on-github` under way. Its blocks, its counts and the words of every row
SHALL stay as they are.

#### Scenario: One change in each state
- **WHEN** a run holds one change at the plan approval, one claimed and driven by its helper, one waiting on GitHub's checks, one blocked by red tests and one archived
- **THEN** the board lists the first under "Waiting for you", the second and third under "Under way", the fourth under "Blocked", and the archived one in no block

#### Scenario: A change with no session of its own
- **WHEN** a run file written before the run had a task says its changes run in sessions of their own, and open change `a` has no session recorded
- **THEN** that record is not read, and `a`'s row is the one its claim, its waits and its lines give

#### Scenario: A change waiting for the next tick
- **WHEN** an open roadmap change has no claim and no wait recorded
- **THEN** its row is under "Under way" and says it goes on at the next tick

#### Scenario: GitHub does not answer
- **WHEN** an open roadmap change waits on GitHub because GitHub did not answer
- **THEN** its row is under "Under way" and says it is waiting on GitHub, which did not answer

#### Scenario: The board and the command agree
- **WHEN** `/devkit status` and the state command run on the same project and run file
- **THEN** every open roadmap change's block on the board is the block of its state in the command's output

### Requirement: A change opens on the machine with the fewest open changes
With the machines setting set, each change a tick opens SHALL go to the machine that answers with the
fewest open changes, every stage counted, ties broken by the order of the setting with this machine
first. This machine SHALL be skipped while its load is at or above the limit. With no machine able to
take it, the start SHALL be held, with its line.

#### Scenario: The fewest open changes
- **WHEN** this machine holds two open changes, `avel` holds one, both answer, the load is below the limit, and line `e` is ready at a tick
- **THEN** `e` is opened for `avel`

#### Scenario: A tie
- **WHEN** this machine and `avel` hold one open change each, both answer and the load is below the limit
- **THEN** the ready change is opened on this machine

#### Scenario: Several ready lines
- **WHEN** this machine and `avel` hold nothing, three lines are ready and the load is below the limit
- **THEN** the first three ticks open them, the first on this machine, the second on `avel`, the third on this machine, because the grill and the plan take no place

#### Scenario: Loaded and nobody answers
- **WHEN** the load reads 92 with the limit 80 and `avel` does not answer
- **THEN** no change is opened, and the hold line and the board say the start is held

### Requirement: A place is taken from the implementation on
With the machines setting set, a change SHALL take a place on its machine only from its implementation
on; its grill and its plan SHALL start at once. This machine's places SHALL be the run's number,
counted over the places its run file holds; another machine's those of its entry, recorded in each
change's claim when it is opened and counted from `origin`.

#### Scenario: Grill and plan never wait
- **WHEN** the machines setting lists `avel`, which does not answer, this machine's only place is held by change `b` in its implementation, and line `c` is ready at a tick with the load below the limit
- **THEN** `c` is opened on this machine and its grill is driven by that tick's helper

#### Scenario: The board's places
- **WHEN** `avel`'s entry gives 2 places and `avel` holds one change in its review and two at their plan
- **THEN** the machines block reads 1 of 2 places taken and 3 open for `avel`

### Requirement: A machine that does not answer keeps its changes
A listed machine that does not answer over SSH within the bounded time SHALL get no new change. The
board SHALL mark it "no answer", and each of its open changes SHALL be shown with the machine and "no
answer" in place of the stage; they keep their places, and nothing reopens them on another machine.

#### Scenario: The Linux worker is asleep
- **WHEN** `avel` holds changes `a` and `b`, does not answer, and line `e` is ready at a tick with this machine below the load limit
- **THEN** `e` is opened on this machine, `a` and `b` are not opened anywhere, and one line says `avel` does not answer

#### Scenario: The board of a silent machine
- **WHEN** `/devkit status` runs while `avel` does not answer
- **THEN** the machines block reads "no answer" for `avel`, and the rows of `a` and `b` name `avel` and read "no answer" in place of their stage

#### Scenario: The machine answers again
- **WHEN** `avel` answers at a later tick
- **THEN** its changes show their stages again and it may take new changes

### Requirement: A place is held only by a change that loads the machine
In a roadmap run, a change SHALL hold a place only while its current stage is the implementation, a
unit or E2E test stage, the evidence or the review, whatever its state. At most the run's number of
changes SHALL hold a place at once; the grill and the plan SHALL need none. A change that needs a place
and finds none, or finds the machine loaded, SHALL wait, recorded in the run file. A change no longer
open SHALL hold no place.

#### Scenario: Two changes reach the implementation with one place
- **WHEN** the number is 1 and changes `a` then `b` reach their implementation
- **THEN** `a` takes the place and is handed its implementation, and `b` waits for a place, recorded in the run file

#### Scenario: A place frees
- **WHEN** `a` moves to its delivery while `b` waits for a place
- **THEN** `a` leaves the place and the next tick claims `b`, before any change that started waiting after it

#### Scenario: Plans with every place taken
- **WHEN** the number is 1, `a` holds the place, and `c` finished its grill
- **THEN** the next tick drives `c`'s plan

#### Scenario: A loaded machine
- **WHEN** a place is free, `b` needs one and the load reads 92 with the limit 80
- **THEN** `b` waits, held by the load, until a tick reads the load below the limit or the owner says to start anyway

#### Scenario: A blocked change in its implementation
- **WHEN** `a` holds the place and its gate runs red
- **THEN** `a` keeps the place

#### Scenario: A change waiting with no helper
- **WHEN** the number is 1 and `a`, at its review, waits on GitHub with no helper running, and `b` reaches its implementation
- **THEN** `a` keeps the place, and `b` waits for a place, recorded in the run file

#### Scenario: A change that leaves the roadmap
- **WHEN** the number is 1, `a` holds the place, `b` waits for one, and `a`'s line is removed from the roadmap or `a` is archived
- **THEN** `a` holds no place and is no longer counted ahead of anyone, and the next tick claims `b`

### Requirement: The owner can start held changes anyway
While a start is held by the load, the owner's own message saying to start anyway, typed in the
session the run was typed in, SHALL let the next tick claim the changes held at that moment whatever
the load. It SHALL hold for those changes only: a change that becomes ready later SHALL be held again
and its hold line shown again. Nothing but the owner's own message SHALL start a held change.

#### Scenario: Start anyway
- **WHEN** two places are free, two items are held by the load at 95 with the limit 80, and the owner says to start anyway
- **THEN** the next ticks claim both items and no line about the hold is shown

#### Scenario: A change ready later
- **WHEN** after that, in the same run, a third item becomes ready to take a place with the load still at 95
- **THEN** its start is held, the hold line is shown again, and the owner is asked again

#### Scenario: No kept permission
- **WHEN** the held changes were claimed anyway
- **THEN** the run's bookkeeping holds nothing that starts a later change

### Requirement: A change's plan waits for its dependencies and starts from the code of that day
In a roadmap run, no plan file of a change SHALL be written while a change its roadmap line names in
`after:` is not archived on the default branch. Once every one is, the change SHALL merge the default
branch into its own branch before its first plan file, so the plan reads the code of that day.

#### Scenario: A dependency not archived
- **WHEN** `b` (after: `a`) finished its grill and `a` is not archived
- **THEN** no plan file of `b` is written and the run file records `b` waiting for `a`

#### Scenario: The dependency is archived
- **WHEN** `a` is archived on the default branch
- **THEN** the next helper of `b` merges the default branch, holding `a`'s archive, and then its plan is written

#### Scenario: The merge conflicts
- **WHEN** merging the default branch into `b` conflicts
- **THEN** the merge is undone, `b` stops blocked with the reason, and no plan file is written

### Requirement: The grill and the plan are pushed with the change's branch
In a roadmap run, once a change's grill has passed, and again once its plan approval is recorded, the
conductor SHALL commit those files on the change's branch and push the branch to `origin`. A push that
fails SHALL be said in one line and tried again at a later tick, not in the same one. A plan SHALL be
pushed once per recorded approval.

#### Scenario: A grill answered
- **WHEN** the owner answered the last question of `a`'s grill in the typed session, or the helper settled every question
- **THEN** `a`'s branch on `origin` holds its `requirements.md` with the passed header

#### Scenario: A plan approved
- **WHEN** the owner approved `a`'s plan in the typed session
- **THEN** `a`'s branch on `origin` holds its plan files and its `approval.md`

#### Scenario: A push that fails
- **WHEN** the push of `a`'s branch fails
- **THEN** one line says so with the reason, the helper asks for no other push of `a` in that tick, and a later tick asks for it again

#### Scenario: Tasks ticked after the plan was pushed
- **WHEN** `a`'s plan and approval are on `origin` and a helper ticks tasks in `a`'s `tasks.md`
- **THEN** no push of `a`'s plan is asked again

#### Scenario: A plan approved again
- **WHEN** `a`'s plan was pushed, then revised, and the owner approves it again in the typed session
- **THEN** `a`'s branch on `origin` holds the new approval with the plan files

### Requirement: The end of a run cleans up after itself
When a run ends with every line archived, or is stopped, the scheduled task SHALL be deleted and the
watch of the typed session SHALL end. Only a process that is still a wait loop of the run SHALL be
stopped; the record SHALL forget every wait loop it was asked to stop.

#### Scenario: The last change archived
- **WHEN** the last change of the roadmap is archived and a tick finds it
- **THEN** no scheduled task, no claim and no wait loop of the run is left

#### Scenario: A stop while two changes go on
- **WHEN** the owner types `/devkit roadmap stop` while `a`'s and `b`'s helpers drive a stage each
- **THEN** the task is deleted at once, and both helpers finish their step and record their waits

#### Scenario: A process that took a wait loop's number
- **WHEN** the run ends and a wait loop of the run is recorded under a process number that now belongs to a process that is not a wait loop
- **THEN** that process keeps running, and the run records no wait loop

### Requirement: A roadmap line the loop cannot place is shown blocked
When a roadmap line's change has its folder in a checkout the loop does not read it in,
`/devkit status` SHALL show that line in the blocked block with the reason the state command gives
it, in the person's language, exit 0 and show every other line as it would without that line; a
roadmap run SHALL treat that line as any blocked change.

#### Scenario: The board, from the main checkout
- **WHEN** `/devkit status` runs in the main checkout of a project whose roadmap holds lines `a` and `x`, `a` open in the main checkout and `x`'s folder only in a worktree on branch `side`
- **THEN** the board exits 0, lists `x` under "Blocked" with "its folder is on a branch with another name", and lists `a` in the block and with the words it has on the same project without that worktree

#### Scenario: The board in Brazilian Portuguese
- **WHEN** the same board is printed with `--lang pt-BR`
- **THEN** `x`'s row is in the Brazilian Portuguese blocked block, with the Brazilian Portuguese text of `wrong-branch` from the message table

#### Scenario: The board and the state command agree
- **WHEN** `/devkit status` and the state command run on that project
- **THEN** every open roadmap change's block on the board is the block of its state in the command's output, and `x`'s row text is the phrase of its reason in the command's output

#### Scenario: A roadmap run with such a line
- **WHEN** a tick decides on that project while `a` has a stage ready
- **THEN** the decision exits 0, one line says once that `x` stopped with that reason and that the others go on, and `a` is claimed as before

#### Scenario: The stop lock of a roadmap run with such a line
- **WHEN** the session of a tick that claimed `a` ends its turn before starting `a`'s helper, or a tick that found nothing to claim ends its turn
- **THEN** the stop is refused once for `a`'s helper, or let through because nothing was claimed

### Requirement: The roadmap's decisions are judged from a freshly fetched base
The roadmap command's `run`, `next`, `tick` and `wait` SHALL fetch the base, as the change command's
`next` does, before they decide the action of a change in its delivery part: at most once per base in
one call, and again at each poll of a wait. A failed fetch SHALL NOT stop the decision. The status
command, its machine-readable form, the draft, the run's stop lock and the tick's prompt hook SHALL
never fetch.

#### Scenario: Three changes in delivery
- **WHEN** `next` decides a roadmap whose three open changes are in delivery against the same base
- **THEN** the base is fetched exactly once in that call

#### Scenario: The roadmap's wait
- **WHEN** the roadmap's wait for a change in delivery polls twice
- **THEN** the base is fetched before each poll

#### Scenario: The status board on a stale base
- **WHEN** the status command reads a change in delivery whose base's tracking ref is behind the remote
- **THEN** no fetch runs and the tracking ref stays where it was

#### Scenario: The remote cannot be reached during a run
- **WHEN** `next` runs and the base cannot be fetched
- **THEN** the decision is made from the local copy, and each change in delivery records the failed fetch

#### Scenario: The prompt hook
- **WHEN** the tick's prompt hook decides on a run with a change in delivery
- **THEN** no fetch runs

## ADDED Requirements

### Requirement: The typed session shows one line per event
While a run goes on, the session the owner typed the run in SHALL show, when its watch wakes it, one
short line per event and nothing else: a change started, waiting for the owner, archived, blocked
(with the reason), skipped as a previous-script change, a start held; and the stop and the end of the
run. Each SHALL be shown once. A tick's session SHALL show the owner nothing.

#### Scenario: A change starts
- **WHEN** a tick opens the first change of a run with 3 places while the typed session is open
- **THEN** that session shows one line saying the change was started and that 1 of 3 is under way

#### Scenario: A change reaches a gate
- **WHEN** `a` reaches its plan approval in a helper while the typed session is open
- **THEN** that session shows one line naming `a` and the gate, once

#### Scenario: A change reaches a gate while nothing else runs
- **WHEN** `a` reaches its plan approval and no other change of the run has a claim or a wait on GitHub
- **THEN** its line names the change and the gate and does not say that the others go on

#### Scenario: Moving from one stage to the next
- **WHEN** a change goes from one stage to the next, or starts waiting on GitHub
- **THEN** no line is shown

#### Scenario: The same state again
- **WHEN** a later tick finds a change in the same announced state
- **THEN** its line is not shown again

#### Scenario: The tick's own session
- **WHEN** a tick claims `a` and its helper ends at a wait
- **THEN** the tick's session asks nothing and opens no box

### Requirement: The owner's lines are asked one change at a time
When open changes wait for the owner, the session the owner typed the run in SHALL ask their lines one
change at a time, in the order of the roadmap file, naming the change, and write each answer into that
change's files; the next change's questions SHALL come only when that change's gate is answered. The
ticks SHALL go on driving the other changes meanwhile.

#### Scenario: Two changes at their grill
- **WHEN** the run file holds lines for the grills of `a` and `b`, `a` first in the file
- **THEN** the typed session asks `a`'s questions, naming `a`, writes the answers into `a`'s `requirements.md`, and asks `b`'s only after `a`'s are answered

#### Scenario: A gate of a change earlier in the file during another change's grill
- **WHEN** the grill of `b` is being asked and a line for `a`'s plan approval, earlier in the file, is written
- **THEN** the questions of `b`'s grill go on, and `a`'s approval is asked after them

#### Scenario: The others keep running
- **WHEN** `a` waits for the owner and `b` has a stage ready
- **THEN** a tick drives `b` while `a`'s line is asked

#### Scenario: A plan approval
- **WHEN** `a`'s line asks for its plan approval
- **THEN** the typed session shows the plan's summary and asks the owner; the owner's own typed answer there is written as `a`'s approval, and a later tick goes on from it

#### Scenario: The retro answers
- **WHEN** `a`'s line asks for its retro answers
- **THEN** the typed session shows each proposal and records the owner's own answers in `a`'s `retro.md`, and a later tick drives `a` to its archive

### Requirement: A typed command or a tick resumes from the files
Nothing SHALL be remembered between ticks but one run's bookkeeping (its number, a stop asked, its
queue, its claims, its lines for the owner, the ends declared, the events announced, the places held,
the changes waiting for a place, the start-anyway of the moment, which changes it opened for another
machine, and its scheduled task), kept outside every working tree. A tick or a typed command SHALL
continue every open change from its files, starting no change twice and losing none.

#### Scenario: The typed session is killed
- **WHEN** the session the owner typed the run in is killed while two helpers drive a stage each
- **THEN** both helpers record their waits, the next ticks go on from the files, and no change is opened twice

#### Scenario: The command typed in a new session
- **WHEN** `/devkit roadmap 2` is typed in a new session while the run's task exists
- **THEN** no second task is created, the claims and lines are kept, and the new session shows the lines for the owner

#### Scenario: Another session reads the number
- **WHEN** `/devkit status` is typed in another session of the same repository during a run with the number 3
- **THEN** its first line shows the open changes of 3

#### Scenario: A change opened for another machine
- **WHEN** a tick opened `a` for `avel` and the typed session was killed
- **THEN** `a` is not opened again, and it stays open on `avel`

### Requirement: A change opened for another machine is driven there by its own conductor
A change a tick opens for another machine SHALL get its claim naming that machine and its branch
pushed to `origin`; no session SHALL be started there and no step SHALL be run there from this
machine. That machine's own run SHALL add the worktree from the branch and drive it when its owner
typed `/devkit roadmap` there; until then the change SHALL stay open on that machine, filling no place
of this one.

#### Scenario: Opened for avel
- **WHEN** a tick opens `e` for `avel`
- **THEN** `e`'s branch is on `origin`, no session is started on `avel`, and the board lists `e` open on `avel`

#### Scenario: avel runs its own conductor
- **WHEN** the owner typed `/devkit roadmap` on `avel` and `avel`'s tick fires with `e` claimed for `avel`
- **THEN** `avel`'s tick adds `e`'s worktree from `origin/e`, claims `e` and drives it there

#### Scenario: The worktree cannot be made
- **WHEN** `avel` cannot add `e`'s worktree from its branch
- **THEN** `e` is held blocked on `avel` with the reason, and it keeps its claim on `origin`

### Requirement: The board shows what each waiting change waits for
`/devkit status` SHALL show a change waiting for a place, the load or a dependency in the queue with
what it waits for, and a change with a line for the owner among those waiting for the owner. Such a
wait SHALL be the change's state, `running` with the reason `held-place`, `held-load` or `held-after`
and the row's words, alike in the state command, a helper's action and the board.

#### Scenario: Waits of each kind
- **WHEN** `a` holds the place, `b` waits for a place, `c` waits for `a` before its plan, and `d` has a line for its grill
- **THEN** `a` is under way, `b` reads "open, waits for a place", `c` reads "open, waits for a", and `d` is under "Waiting for you" with the grill

#### Scenario: The board, the state command and a helper agree on a held change
- **WHEN** `b` waits for a place and `c` waits for `a` before its plan
- **THEN** the state command prints `b` as `running` with the reason `held-place` and `c` with `held-after`, the action a helper of each gets carries the same state, and the board shows both in the queue with those words

## REMOVED Requirements

### Requirement: The owner sees one line per event
**Reason**: It split a change's lines between the coordinating session and the change's own session, which no longer exists.
**Migration**: "The typed session shows one line per event".

### Requirement: The owner's gates are asked one change at a time
**Reason**: It asked the gates in the coordinating session or in each change's own session; a conducted run asks every gate from its line in the run file.
**Migration**: "The owner's lines are asked one change at a time".

### Requirement: Calling the command again resumes from the files
**Reason**: Its bookkeeping named the change sessions, their tickets and the periodic check, which are removed.
**Migration**: "A typed command or a tick resumes from the files".

### Requirement: Every open change of the roadmap fills a place
**Reason**: It described a run whose changes all ran in the coordinating session, which this change removes; a conducted run holds places only by the load stages.
**Migration**: "A place is held only by a change that loads the machine" holds every roadmap run; a change open on another machine fills no place, as "A line open on another machine is never opened again" says.

### Requirement: Each change of a roadmap run runs in a session of its own where the host can start sessions
**Reason**: No change runs in a session of its own (`ADR [helper-conductor]`, decision 8); the host refuses a start on a turn nobody typed.
**Migration**: A tick claims the change and drives it through a helper (`roadmap-conductor`).

### Requirement: A change session tells the coordinating session when its change is archived
**Reason**: There are no change sessions to report.
**Migration**: A tick reads the archive from the files; the typed session's watch shows the line.

### Requirement: A change session shows the stage its change is in
**Reason**: There are no change sessions to title.
**Migration**: The state command and `/devkit status` give each change's stage and state icon (ADR 0017).

### Requirement: A change ready on a turn nobody typed waits for the owner's next message, with a line
**Reason**: Nothing waits for a typed turn: a tick starts the work.
**Migration**: The scheduled task's ticks (`roadmap-conductor`).

### Requirement: Each decision of a run with a session per change names its turn
**Reason**: The `--turn` word served only the session starts, which are removed.
**Migration**: None; `next` takes no `--turn`.

### Requirement: A watch of the load that died holds nothing
**Reason**: No process watches the load; each tick reads it.
**Migration**: "Starts are held while the machine is loaded".

### Requirement: A change on another machine gets its session there
**Reason**: The conductor never starts work on another machine over SSH (`ADR [helper-conductor]`, decision 10).
**Migration**: "A change opened for another machine is driven there by its own conductor".

### Requirement: A freed place tells one waiting change to go on
**Reason**: No session waits to be told; the next tick claims the first change waiting for a place.
**Migration**: "A place is held only by a change that loads the machine".

### Requirement: Every pending change opens at the start of a run with a session per change
**Reason**: Opening every change up front existed to start their sessions on the typed turn.
**Migration**: Each tick opens or drives the first ready item (`roadmap-conductor`).

### Requirement: With the machines setting set, a change session of this machine takes its place from the run's own count
**Reason**: Every change of this machine is driven by this machine's ticks, so no change of this machine is counted from `origin`.
**Migration**: "A place is taken from the implementation on".

### Requirement: A roadmap run keeps one periodic check while it lasts
**Reason**: The session cron is replaced by the project's scheduled task.
**Migration**: "One typed command installs one scheduled task" (`roadmap-conductor`).

### Requirement: A firing of the check acts and reports only what changed
**Reason**: The check is removed.
**Migration**: A tick (`roadmap-conductor`); the triage runs in the helper's grill.

### Requirement: The board shows what each change session waits for
**Reason**: There are no change sessions.
**Migration**: "The board shows what each waiting change waits for".

### Requirement: A change session starts on its stage's model
**Reason**: There are no change sessions.
**Migration**: "A helper starts on the model of the stages it runs" (`roadmap-conductor`).

### Requirement: A change session only steps down
**Reason**: No session's model is switched by the run.
**Migration**: "A helper starts on the model of the stages it runs" (`roadmap-conductor`).

### Requirement: A change session's floor is set by the session-run stages ahead
**Reason**: There are no change sessions.
**Migration**: A helper's model is the strongest of the stages it performs up to its next wait (`roadmap-conductor`).

### Requirement: A stage above the session's model never switches it
**Reason**: No session's model is switched by the run.
**Migration**: Each stage agent runs on its stage's model (`roadmap-conductor`).
