<!-- devkit-stage specs result=passed attempt=2 commit=6fce9721974668c73a1403e5d3121aa24349d8a2 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A failed stage offers its fix, then itself
A failed stage below its attempt ceiling SHALL offer its declared fix stage (`onFail`, or itself
when it declares none) while nothing changed since the failure, and SHALL offer itself again once
the fix changed its inputs, until its attempt ceiling is reached. The reason SHALL name the
attempt, the failures in a row and the ceiling.

#### Scenario: A failed stage offers its fix stage first
- **WHEN** the code review's header says `result=failed attempt=1`, its ceiling is 2, its declared fix stage is the implementation, and no product commit came after its header commit
- **THEN** the next stage is the implementation, with the reason that the review failed at attempt 1, one failure in a row of a ceiling of 2, and the fix comes first

#### Scenario: After the fix the failed stage runs again
- **WHEN** the same failed review's header commit is behind a later commit that changes product code
- **THEN** the review is still reported failed and the next stage is the review itself, with the reason that the work changed since the failure

#### Scenario: A failure after passed takes is offered its fix
- **WHEN** the evidence's header says `result=failed attempt=3`, its ceiling is 3, and its file was committed with `result=passed` at attempts 1 and 2
- **THEN** the next stage is the evidence's fix stage, with the reason that the evidence failed at attempt 3, one failure in a row of a ceiling of 3, and the run is not blocked

### Requirement: Attempt ceilings and no progress stop the run
A failed stage whose failures in a row reach its declared ceiling SHALL end the run as blocked with
that reason, naming the attempt, the failures in a row and the ceiling. Given the previous run's
progress key, the checker SHALL end the run as blocked when the same stage comes back and nothing
in the working tree or history changed.

#### Scenario: The ceiling is reached
- **WHEN** the review's header says `result=failed attempt=2`, its file was committed with `result=failed` at attempt 1, and its ceiling is 2
- **THEN** the run ends blocked, naming the review, its two failures in a row and its ceiling

#### Scenario: Three failures in a row block a stage with a ceiling of three
- **WHEN** the evidence's header says `result=failed attempt=3`, its file was committed with `result=failed` at attempts 1 and 2, and its ceiling is 3
- **THEN** the run ends blocked with `ceiling-reached`, as before this rule

#### Scenario: The same stage comes back with nothing changed
- **WHEN** the checker is run with `--after` set to the progress key it printed last and nothing changed
- **THEN** the run ends blocked, naming the stage that came back

## ADDED Requirements

### Requirement: A failed stage counts its failures in a row from its file's history
For a failed stage with a numeric ceiling, the checker SHALL count the failures in a row as the
distinct failed headers of the stage, the current one included, that its file carried (line 1) in
the commits since it last carried a passed header, newest first, without subtracting attempt
numbers. With no passed header visible, the count SHALL be at least `attempt`.

#### Scenario: A pass between failures resets the count
- **WHEN** the evidence's file was committed with `result=failed` at attempt 1 and `result=passed` at attempt 2, and its header now says `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: A header carried by several commits counts once
- **WHEN** the evidence's file was committed with `result=passed attempt=1`, then with `result=failed attempt=2`, then again with the same failed header and a changed body
- **THEN** the evidence counts one failure in a row

#### Scenario: A passed stage counts no failure
- **WHEN** the evidence's file was committed with `result=failed` at attempts 1 and 2 and its header now says `result=passed attempt=3`
- **THEN** the evidence is reported passed, and a later `result=failed attempt=4` counts one failure in a row

#### Scenario: Takes retaken after merges of main do not count
- **WHEN** the evidence's file was committed with `result=passed` at attempts 1, 2 and 3, a merge of main came after each, and its header now says `result=failed attempt=4` with a ceiling of 3
- **THEN** the evidence counts one failure in a row and the run is not blocked

#### Scenario: A restarted round does not reset the count
- **WHEN** the review's file was committed with `result=passed attempt=1`, then `result=failed attempt=1`, then `result=failed attempt=2`, newest last, and its ceiling is 2
- **THEN** the review counts two failures in a row and the run ends blocked with `ceiling-reached`

#### Scenario: A take never committed is not counted
- **WHEN** the evidence's file was committed with `result=passed attempt=1`, a `result=failed attempt=2` was written and overwritten without a commit, and the file was then committed with `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: A passed header whose recorded commit is not in history still counts
- **WHEN** the evidence's file was committed with `result=passed attempt=2 commit=<a sha that is not in the history>`, and its header now says `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: History that shows no pass keeps the attempt as the count
- **WHEN** the failed stage's file was never committed, or the checkout is a depth-1 clone whose only commit holds the current header
- **THEN** the count is the header's `attempt`, and the stage is blocked exactly when `attempt` reaches its ceiling

#### Scenario: A partial history counts what it shows
- **WHEN** the checkout is a shallow clone that still holds the commit where the evidence's file said `result=passed attempt=2`, and its header now says `result=failed attempt=3`
- **THEN** the evidence counts one failure in a row

#### Scenario: The readout says the failures in a row
- **WHEN** the checker prints a failed stage, a fix offered after a failure, or a blocked end at the ceiling, in English or in pt-BR
- **THEN** the stage's line and the reason say the attempt and the failures in a row against the ceiling, in the chosen language
