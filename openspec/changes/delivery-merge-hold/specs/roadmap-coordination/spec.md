<!-- devkit-stage specs result=passed attempt=4 commit=bfd5c0a9bf6ac9612041b1dd7fbb39003b86b4fa -->
# Spec Delta

## ADDED Requirements

### Requirement: A run records its merge queue on origin
A roadmap run on the Claude driver in a repository with an `origin`, whose `devkit` or `devkit-lite`
changes ship in the merge mode and whose delivery settings carry no delivery train, SHALL put its
marker on `origin` when it starts or resumes, and record in its bookkeeping
that it keeps a queue. A marker it cannot write SHALL leave the run going with no queue, said in one
line.

#### Scenario: The run starts
- **WHEN** `/devkit roadmap 2` starts in a repository with an `origin`
- **THEN** `origin` holds the marker and the run file records that the run keeps a merge queue

#### Scenario: The marker cannot be written
- **WHEN** the push of the marker is refused
- **THEN** the run goes on, one line says the merge turn is off for this run and why, and no change joins a queue

#### Scenario: No origin
- **WHEN** a run starts in a repository with no `origin`
- **THEN** nothing is pushed, no queue is recorded, and no line about it is shown

#### Scenario: A project that does not ship in the merge mode
- **WHEN** a run starts in a repository with an `origin` whose changes ship in the `pr` or `plan` mode
- **THEN** nothing is pushed, no queue is recorded, and no line about it is shown

#### Scenario: A run started to stop
- **WHEN** `roadmap-loop.mjs run` is called with `stop` in a repository with an `origin` whose changes ship in the merge mode
- **THEN** no marker is pushed and no queue is recorded by that call

### Requirement: A run of a project with a delivery train or on the CompozyOS driver records no merge queue
A roadmap run of a project whose delivery settings carry a delivery train, accepted or refused, SHALL
push no marker, record that it keeps no merge queue, send no turn `wake` and show no merge turn block,
whatever refs `origin` holds. A roadmap run started on the CompozyOS driver SHALL push no marker. The
board of a project that keeps no queue (`trunk`, `two-prs`, a delivery train, the CompozyOS driver)
SHALL read no queue.

#### Scenario: A run in a train project
- **WHEN** `/devkit roadmap 2` starts in a `trunk-auto` project with a delivery train and an `origin`
- **THEN** nothing is pushed, the run file records that the run keeps no merge queue, and no line about the merge turn is shown

#### Scenario: A train project with a marker left on origin
- **WHEN** a run of a project with a delivery train starts or decides while `origin` still holds a marker and entries from a run before the train was turned on
- **THEN** the refs are left as they are, no turn `wake` is sent when they change, and no change of the project is handed a queue step

#### Scenario: A run started on the CompozyOS driver
- **WHEN** `/devkit roadmap` starts a CompozyOS run in a project with `driver: compozy` whose changes ship in the merge mode, with an `origin`
- **THEN** no marker is pushed on `origin`

#### Scenario: The board of a project that keeps no queue
- **WHEN** `/devkit status` runs in a `trunk`, a `two-prs` or a train project whose `origin` holds a marker and two entries
- **THEN** no merge turn block and no line about the merge turn is printed, and the refs on `origin` are not listed

### Requirement: The run's end removes its merge queue
When the run ends, done, stopped or stuck, whether the end is decided on a turn or at a firing of the
periodic check, it SHALL remove the marker and every entry of the queue. A removal it cannot push SHALL
be said in one line and tried again at the next end.

#### Scenario: The run ends
- **WHEN** the run ends done, stopped or stuck while the queue holds two entries
- **THEN** `origin` holds neither the marker nor any entry, and the run file no longer records a queue

#### Scenario: The removal at the end is refused
- **WHEN** the run ends while the queue holds an entry and the push that removes the queue is refused
- **THEN** one line says the merge queue could not be removed and why, the run file still records the queue, and the next decision that ends pushes the removal again

### Requirement: The periodic check passes no turn
The run's periodic check SHALL grant, take or reorder no turn and write no entry of the queue.

#### Scenario: The periodic check passes no turn
- **WHEN** the periodic check fires while `a` holds the turn and `b` waits behind it
- **THEN** no ref on `origin` changes and `a` still holds the turn

### Requirement: The coordinator tells a change its merge turn arrived
In a run where each change has a session of its own, when the turn passes from one entry to another
that was waiting, the coordinating session SHALL send one message to the session of the change that
now holds it, on its machine, and one line SHALL say so, once per hand-over, whether the coordinator
decides on a turn or at a firing of its periodic check. The message SHALL carry no authority: the
change acts only on what its own loop reads.

#### Scenario: The turn passes
- **WHEN** `a` held the turn at the last decision, `b` waited behind it, `a`'s pull request merged, and the run records no wait on GitHub of `b` (it is open on another machine, or its wait here ended)
- **THEN** the decision holds a `wake` action naming `b` and its machine, and one line says the merge turn passed to `b`

#### Scenario: The periodic check carries the wake
- **WHEN** `a`'s pull request merged since the last decision, `b` waited behind it on another machine, and the periodic check fires
- **THEN** that firing's decision holds the `wake` naming `b` and its machine, and the next decision sends no second one

#### Scenario: Once per hand-over
- **WHEN** the coordinator decides again and `b` still holds the turn
- **THEN** no second message is sent

#### Scenario: A first entry
- **WHEN** `a` joins an empty queue and holds the turn at once
- **THEN** no message is sent

#### Scenario: A run whose session runs every change
- **WHEN** the run's changes do not each have a session of their own
- **THEN** no `wake` is sent for a turn; the coordinator's own wait on the change's GitHub state sees it

### Requirement: A change already waiting for its turn is not woken
When the change that now holds the turn is open on this machine and the run records its wait on
GitHub, the coordinating session SHALL send no message for that hand-over: the change's wait sees the
turn by itself.

#### Scenario: A waiting session is not woken
- **WHEN** the turn passes from `a` to `b`, `b` is open on this machine and the run records `b`'s wait on GitHub
- **THEN** no `wake` is sent for `b` and no line says the turn passed, and a later decision while `b` holds the turn sends none either

### Requirement: The board shows the merge turn
`/devkit status` SHALL print, after the blocked changes and before the queue of roadmap lines, a merge
turn block with one row per entry of the queue in its order: "holds the merge turn" for the holder,
"waits behind `<id>`" naming the entry just ahead for the others, an archive saying so. Without a
queue the block SHALL not be printed.

#### Scenario: Two deliveries and an archive
- **WHEN** the queue holds `a`'s delivery, then `b`'s delivery, then `c`'s archive
- **THEN** the merge turn block reads `a` holds the merge turn, `b` waits behind `a`, and the archive of `c` waits behind `b`, in the person's language

#### Scenario: No queue
- **WHEN** `origin` holds no marker
- **THEN** no merge turn block is printed and the rest of the board is unchanged

#### Scenario: The queue cannot be read
- **WHEN** the refs on `origin` cannot be listed
- **THEN** the board is printed without the block, with one line saying the merge turn could not be read
