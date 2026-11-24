<!-- devkit-stage specs result=passed attempt=4 commit=697f69983efc45b037b67fecde4960ec728a0597 -->
# Spec Delta

## ADDED Requirements

### Requirement: The change id's prefix comes from the key
The id of a change opened from a task SHALL start with a prefix made from the key: the key in lower
case, each `_` turned into `-`, each run of `-` collapsed to one `-`, and any `-` at the end removed;
then a `-` and the subject follow.

#### Scenario: Lower case
- **WHEN** the key is `PROJ-482`
- **THEN** the prefix is `proj-482`

#### Scenario: Underscores become dashes
- **WHEN** the key is `PROJ_X-12`
- **THEN** the prefix is `proj-x-12`

#### Scenario: Runs of dashes are collapsed
- **WHEN** the key is `PROJ_-12`, or `A__B-1`
- **THEN** the prefix is `proj-12`, or `a-b-1`

#### Scenario: A dash at the end is removed
- **WHEN** `taskIdPrefix` is given `PROJ_`, a text that is not a key and ends in `_`
- **THEN** it returns `proj`, with no `-` at its end

### Requirement: The write-back question is asked again for a new pull request
The record of the write-back question SHALL count as asked only for the task key and the pull
request number it holds. Asked for another pull request number of the same task, the question SHALL
be asked again and the record SHALL then hold the new number. A record that cannot be read SHALL
count as asked.

#### Scenario: The same pull request
- **WHEN** `write-back ask <id>` runs with pull request 12 and the record holds the task's key and number 12
- **THEN** it answers `ask: false` with `why: asked` and leaves the record as it was

#### Scenario: A recreated pull request
- **WHEN** `write-back ask <id>` runs with pull request 15 and the record holds the task's key and number 12
- **THEN** it answers `ask: true` with the question, and the record holds number 15

#### Scenario: A record for another key
- **WHEN** the record holds another task key and the same number
- **THEN** `write-back ask <id>` answers `ask: true` and the record holds the change's key

#### Scenario: A damaged record
- **WHEN** the record is not JSON, or holds another `version`
- **THEN** `write-back ask <id>` answers `ask: false` with `why: asked` and writes nothing

### Requirement: The connector's error reaches the reply as it is
When the connector fails to write on the task, the session SHALL give the connector's error to the
script on standard input, through the quoted heredoc and its terminator rule, never as a
command-line argument, and the reply SHALL hold the error unchanged.

#### Scenario: An error with shell characters
- **WHEN** the connector's error is `it said "no" and 'never'` followed by a newline and `$(rm -rf x) and backticks`, and the session runs the reply with that error on standard input
- **THEN** the reply names the task and holds the error byte for byte, the line break included, and no command in the error runs

#### Scenario: The skill text
- **WHEN** the devkit skill's section on writing back to the task is read
- **THEN** its failed-write call passes the error on standard input through the quoted heredoc and holds no `--param error=`

#### Scenario: No error given
- **WHEN** `reply write-back-failed --param key=PROJ-482 --stdin error` runs with an empty standard input, or one that is only a line break
- **THEN** it exits 3, prints no reply, and stderr names `reply --stdin error needs the text on standard input`

#### Scenario: A reply without the option reads no standard input
- **WHEN** `reply write-back-failed --param key=PROJ-482 --param error=x` runs with its standard input left open and empty
- **THEN** it prints the reply at once and does not wait on standard input

#### Scenario: A line break at the end
- **WHEN** the standard input ends in `\n`, or in `\r\n`
- **THEN** that one final line break is not part of the error, and every other byte is

#### Scenario: The same parameter twice
- **WHEN** the call holds both `--param error=x` and `--stdin error`
- **THEN** it exits 3, prints no reply, and stderr names `--param error and --stdin error name the same parameter`

#### Scenario: A bad or missing parameter name
- **WHEN** the call holds `--stdin` as its last argument, or `--stdin Error`, or `--stdin 1x`
- **THEN** it exits 3 and prints no reply; with no name stderr says `--stdin needs a value`, with a bad name it says `--stdin needs a parameter name of letters, starting with a lower-case one`

### Requirement: Two openings for one key at once open one change
The check that a key already has an unfinished change SHALL run while the opening holds the open
lock, so two openings for one key started together SHALL open one change.

#### Scenario: Two openings started together
- **WHEN** two openings for `PROJ-482`, with the ids `proj-482-a` and `proj-482-b`, start while a third call holds the open lock, and the lock is then released
- **THEN** exactly one change is created, and the other call exits 3 with the reply that names the created change and how to continue it

#### Scenario: An opening on the id of the key's own change
- **WHEN** `proj-482-login-timeout`, which records `PROJ-482`, is unfinished and an opening for `PROJ-482` asks for the id `proj-482-login-timeout` again
- **THEN** the call exits 3 with the reply that names the unfinished change and how to continue it (task taken), not the reply that the name is taken, and creates nothing
