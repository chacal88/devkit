<!-- devkit-stage specs result=passed attempt=4 commit=bfd5c0a9bf6ac9612041b1dd7fbb39003b86b4fa -->
# Spec Delta

## ADDED Requirements

### Requirement: The loop joins and leaves the merge queue in session steps
The steps `join-queue` and `leave-queue` SHALL be session steps of the delivery that run the command
they carry. A change that joined the queue and is back at a stage before its implementation, with no
blocked end, SHALL get `leave-queue` before that stage. A blocked end, including GitHub not answering,
SHALL NOT make a change leave the queue. Only these steps SHALL write a change's entries.

#### Scenario: Joining
- **WHEN** the delivery checker's step is `join-queue`
- **THEN** the next action is a session step of the delivery stage whose detail carries the command that adds the change's entry

#### Scenario: Back to the plan
- **WHEN** a change that joined the queue goes back to its plan revision
- **THEN** its next action is the session step `leave-queue`, and only after it the plan stage

#### Scenario: Back to the plan on either flow version
- **WHEN** a change that joined the queue goes back to its plan revision, once following flow version 1 of its script and once following flow version 2
- **THEN** both get the session step `leave-queue` before the plan stage

#### Scenario: A GitHub error does not leave the queue
- **WHEN** a queued change's run ends blocked because GitHub did not answer about its pull request or its checks
- **THEN** its next action is not `leave-queue`, and its entry stays on `origin` in its place

#### Scenario: A blocked end with no progress keeps the entry
- **WHEN** a queued change's run ends blocked for no progress or for its ceiling
- **THEN** its entry stays on `origin` and no `leave-queue` is handed

#### Scenario: A record left by a run that ended
- **WHEN** a change whose machine still records an entry for it is back at its plan, and `origin` holds no marker
- **THEN** its next action is `leave-queue`, which pushes nothing, removes the record and succeeds, and then the plan stage

#### Scenario: A record that cannot be read
- **WHEN** the machine's record of the change's entries cannot be read
- **THEN** the change is treated as queued, and `leave-queue` removes every entry of the change found on `origin` and the record

#### Scenario: The rows match the checkers
- **WHEN** the loop's rows are compared with every step the delivery checker can return
- **THEN** `join-queue`, `leave-queue` and `wait-turn` each have a row

### Requirement: A change waits for its merge turn as a wait on GitHub
The step `wait-turn` SHALL end the run waiting on GitHub, its reply naming the change that merges
first and saying the session keeps waiting with no time limit. The session's wait on GitHub SHALL
end when the turn arrives, and a change that holds the turn SHALL go on with no message. Outside the
change loop, `ship-change` SHALL report the wait and stop at `wait-turn`, with no watch.

#### Scenario: The wait's reply
- **WHEN** `b`'s step is `wait-turn` behind `a`
- **THEN** the run ends waiting on GitHub, the reply says `b` waits for its turn to merge and that `a` merges first, the session's title is ⏳ with its stage icon, and the exit code is 1

#### Scenario: The turn arrives during the wait
- **WHEN** `b`'s session waits on GitHub for its turn and `a`'s pull request merges
- **THEN** the wait ends with `b`'s next action, the session step that merges the base or enables auto-merge

#### Scenario: Another holder ahead
- **WHEN** `b` waits behind `a`, and `a` leaves the queue while `c`, queued before `b`, takes the turn
- **THEN** the wait ends, and `b`'s next action is the same wait naming `c`

#### Scenario: ship-change at the merge turn
- **WHEN** `ship-change` runs for `b` outside the change loop and the step is `wait-turn` behind `a`'s pull request 41
- **THEN** it reports that `b` waits for the merge turn behind `a` (pull request 41) and stops, on either host, without running a watch

### Requirement: An unreadable queue is a wait on a silent GitHub
When the queue cannot be read, the `wait-turn` end SHALL be the wait on a GitHub that does not answer,
naming no holder, and the session's wait SHALL count it as a failed read.

#### Scenario: The queue cannot be read: the reply is the GitHub wait
- **WHEN** `b` joined the queue, its step without a queue is `enable-auto-merge`, and the refs on `origin` cannot be listed
- **THEN** the run ends waiting on GitHub with the reply of a GitHub that does not answer, naming no holder, the listing's error in its detail, the exit code 1, and the session's wait counts that poll as a failed read

#### Scenario: The queue cannot be read three times in a row
- **WHEN** the queue cannot be listed on `origin` at three polls in a row of the wait
- **THEN** the wait ends and the run ends blocked, quoting the error

### Requirement: A change session of a run waits for its turn in the run's wait
A change session a roadmap run started SHALL hold its wait for the turn as the run's recorded wait on
GitHub, which the run's periodic check SHALL NOT stop while the change is open.

#### Scenario: A change session of the run waits for its turn
- **WHEN** a change session a roadmap run started on this machine gets `wait-turn` behind `a`
- **THEN** it starts the run's wait on GitHub in the background, the run records that wait, and a firing of the periodic check leaves it running while the change is open
