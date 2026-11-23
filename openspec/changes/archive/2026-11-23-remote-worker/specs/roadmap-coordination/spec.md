<!-- devkit-stage specs result=passed attempt=3 commit=ccb3dfbe2170e76a9b17224e8dcc98db8ca8ee74 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: Every open change of the roadmap fills a place
With the person's machines setting unset, every change of the roadmap that is open on the current
script in this clone SHALL fill one place, whatever it is doing: running, waiting for the owner,
waiting on GitHub or blocked. A change open before the run SHALL be resumed and counted before any new
one starts. With every place filled nothing SHALL start. With the setting set, places SHALL be counted
per machine as the requirement "A place is taken from the implementation on" says.

#### Scenario: Every place filled by changes that do not run
- **WHEN** the number is 2, one open change waits for the owner's approval, another waits on GitHub, and a third line is ready
- **THEN** the third change is not started

#### Scenario: A change open before the run
- **WHEN** the run starts with the number 1 while a roadmap change opened earlier by `/devkit change` is unfinished on the current script
- **THEN** that change is resumed and no other change is started

#### Scenario: A change open on another machine
- **WHEN** the machines setting is unset, the number is 1, a line's change is open only on another machine, and another line is ready
- **THEN** the change open elsewhere fills no place of this run, and the ready line is started

### Requirement: Starts are held while the machine is loaded
Before every start the processor load of the last minute per logical core SHALL be read as a
percentage. At or above the person's limit (`load_limit`, 80 when unset or not a whole number from 1
to 1000) no change SHALL start on this machine, also when none is open; when no other machine can take
it the hold SHALL be said once, rechecked every minute and released by itself below the limit. A
change under way SHALL never be stopped by the load.

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

#### Scenario: Loaded while another machine answers
- **WHEN** the machines setting lists `avel`, `avel` answers, a line is ready on a typed turn, and the load reads 92 with the limit 80
- **THEN** the change is opened for `avel`, and no hold line is shown

### Requirement: Calling the command again resumes from the files
Nothing SHALL be remembered between runs but one run's bookkeeping (its number, a stop asked, the
gate being asked, the stages under way, the ends the session declared, the events announced, whether
its changes run in sessions of their own, which change sessions were started, which changes it opened
for another machine, and what started the last turn), kept outside every working tree. A run started
from another session SHALL start that bookkeeping empty, except which change sessions were started and
which changes it opened for another machine, and continue every open change from its files, starting
no change twice and losing none. No change SHALL be given a second session while a session of its own
is still open; only a run asked to start fresh forgets the change sessions.

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

#### Scenario: A change opened for another machine before its session started
- **WHEN** the run opened `a` for `avel`, the session was killed before `a`'s session started, and `/devkit roadmap` is typed in a new session
- **THEN** `a` is not opened again, and on that typed turn `a` gets its session on `avel`

### Requirement: A change session shows the stage its change is in
A change session SHALL be titled with its change's stage icon (❓ requirements, 📝 plan, 🛠️ code, 🔍
review, 🚀 delivery, 📦 archive) and the change id while the change runs; while it is stopped, with
the state icon (🙋 waiting for the owner, ⏳ waiting on GitHub, ⛔ blocked), a space, then that
title; `📦 <id>` once archived; `⏳ <id>`, with no other icon, while it waits for a free place on its
machine; cut to 59 code points. When the title changes, the session SHALL rename itself before it
goes on.

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

#### Scenario: Waiting for a place
- **WHEN** the change's plan is approved and its machine has no free place
- **THEN** the session's title goes from `🙋 📝 <id>` to `⏳ <id>`, with no state icon, and to `🛠️ <id>` once it takes a place

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

## ADDED Requirements

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
