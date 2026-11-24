# jira-tasks Specification

## Purpose
Lets a person start a change from a Jira task by typing its key or link to `/devkit change`, and
write the change's pull request back to that task only when they say yes.

## Requirements

### Requirement: A Jira key or link typed alone is read as a task
`/devkit change` SHALL read its request as a Jira task when the whole request is an upper-case key
(`PROJ-482`) or an http(s) link whose path holds `/browse/<KEY>` or whose query holds
`selectedIssue=<KEY>`. Any other request SHALL behave as it did before.

#### Scenario: A key
- **WHEN** `/devkit change PROJ-482` is typed in a project set up for devkit with no unfinished change
- **THEN** the command's script answers that the session is to read task `PROJ-482`, and creates no folder, branch or worktree

#### Scenario: A browse link
- **WHEN** `/devkit change https://acme.atlassian.net/browse/PROJ-482` is typed in the same project
- **THEN** the answer is the same as for the key `PROJ-482`, with the link kept

#### Scenario: A board link
- **WHEN** `/devkit change https://acme.atlassian.net/jira/software/projects/PROJ/boards/7?selectedIssue=PROJ-482` is typed
- **THEN** the answer is the same as for the key `PROJ-482`, with the link kept

#### Scenario: A key with more words
- **WHEN** `/devkit change PROJ-482 please hurry` is typed
- **THEN** the request is free text, as before this change

#### Scenario: A lower-case word, a change id or no text
- **WHEN** `/devkit change proj-482`, `/devkit change <id of a known change>` or `/devkit change` alone is typed
- **THEN** each behaves exactly as before this change: free text, the resume of that change, or the resume or choice of unfinished changes

#### Scenario: A link without a key
- **WHEN** the request is an http(s) link whose path holds no `/browse/<KEY>` and whose query holds no `selectedIssue=<KEY>`
- **THEN** the request is free text

### Requirement: Jira is reached only through the session's connector
The command's script SHALL make no network call to Jira and SHALL keep no Jira token. It SHALL hold
no Jira setting in the project's configuration. The session SHALL read and write the task through its
own Atlassian connector.

#### Scenario: The script reads no task
- **WHEN** the command's script answers a key or a link
- **THEN** it names the key and the link for the session to read, and opens no connection

#### Scenario: No setting is read
- **WHEN** a project's configuration has no Jira setting
- **THEN** a key or a link is read as a task all the same

### Requirement: A task that cannot be read opens nothing
When the session has no Atlassian connector, or the connector cannot read the task, nothing SHALL be
opened. The reply SHALL say why in the person's language and ask for the request as text.

#### Scenario: No connector
- **WHEN** `/devkit change PROJ-482` is typed in a session with no Atlassian connector
- **THEN** no folder, branch or worktree is created, and the reply says Jira cannot be read in this session and asks for the request in the person's own words

#### Scenario: A task the connector cannot read
- **WHEN** the connector answers that `PROJ-482` does not exist or cannot be seen with the session's account
- **THEN** no folder, branch or worktree is created, and the reply names the task, says it could not be read and asks for the request in the person's own words

### Requirement: A change opened from a task records the task
A change opened from a task SHALL have an id that starts with the key in lower case and a dash. Its
requirements file SHALL hold, under its request section, one `Jira: <KEY> <link>` line and then the
task's title, description and acceptance-criteria field, each copied literally as a quotation.

#### Scenario: The opened change
- **WHEN** the session opens a change for `PROJ-482` with the id `proj-482-login-timeout` and the connector's title, description and acceptance-criteria field
- **THEN** the change exists in its own worktree, and its requirements file's request section holds the line `Jira: PROJ-482 <link>` followed by the title, the description and the acceptance-criteria field, each quoted line by line

#### Scenario: Only the three parts of the task
- **WHEN** the task also has comments, subtasks, linked tasks or attachments
- **THEN** the requirements file holds none of them

#### Scenario: A project with no acceptance-criteria field
- **WHEN** the task has no acceptance-criteria field, or the field is empty
- **THEN** the requirements file holds the key line, the title and the description only

#### Scenario: An id that does not start with the key
- **WHEN** the session asks to open a change for `PROJ-482` with an id that does not start with `proj-482-`
- **THEN** nothing is created and the command exits 3

#### Scenario: A task answer the script cannot read
- **WHEN** the task given to the opening step is not JSON, is cut short, names another key, or has no title
- **THEN** nothing is created and the command exits 3

#### Scenario: Text in the task that looks like a heading or a key line
- **WHEN** the task's description holds a line starting with `## ` or a line `Jira: OTHER-1`
- **THEN** that line is quoted like every other line, the requirements file keeps its sections, and the change records `PROJ-482` only

### Requirement: The key resumes its unfinished change
Typing a key or a link again SHALL resume the unfinished change whose requirements file records that
key, and SHALL NOT open a second change for it.

#### Scenario: The same key again
- **WHEN** `/devkit change PROJ-482` is typed while `proj-482-login-timeout`, which records `PROJ-482`, is unfinished
- **THEN** the run continues that change without a question, and the first reply says it is continuing that change and where it stopped

#### Scenario: The link of the same task
- **WHEN** the browse link or the board link of `PROJ-482` is typed while that change is unfinished
- **THEN** the run continues that change, as for the key

#### Scenario: A second opening for the same key
- **WHEN** the opening step is asked to open another change for `PROJ-482` while a change recording that key is unfinished
- **THEN** nothing is created, the command exits 3, and the reply names the unfinished change and how to continue it

#### Scenario: A key while other changes are unfinished
- **WHEN** `/devkit change PROJ-482` is typed, no unfinished change records that key, and another change is unfinished
- **THEN** the reply names the unfinished change and where it stopped and asks continue or new, as for a free-text request, and nothing is created

#### Scenario: A key whose change is archived
- **WHEN** the only change that recorded `PROJ-482` is archived on the default branch
- **THEN** the key is read as a new task

### Requirement: The grill asks only what the task leaves open
The grill of a change opened from a task SHALL ask no question that the copied title, description or
acceptance-criteria field answers. It SHALL record each such point as answered by the task, and it
SHALL still ask the owner at least one question before the requirements pass.

#### Scenario: Points the task answers
- **WHEN** the task's description and acceptance-criteria field settle the scope and the end effect
- **THEN** the grill asks no question about them, and each point is an assumption in the requirements file marked as answered by the task

#### Scenario: A task that answers everything
- **WHEN** the copied parts answer every point the grill would ask
- **THEN** the grill asks the owner one question, to confirm the assumptions drawn from the task, and the requirements pass only after the owner's answer

#### Scenario: The grill knows the task
- **WHEN** the next action of a change opened from a task is the grill
- **THEN** the action names the task's key and link

### Requirement: The write-back question is asked once when the pull request opens
For a change opened from a task, the session SHALL ask once, after the change's pull request exists,
whether to write its link on the task. The question SHALL list the transitions the task accepts at
that moment, plus "only comment" and "no". It SHALL NOT hold the delivery.

#### Scenario: The pull request opens
- **WHEN** the change's pull request exists and the question was not asked for that pull request
- **THEN** the next action carries the task's key and the pull request's number and link, for the session to ask

#### Scenario: The choices
- **WHEN** the task accepts the transitions "In Review" and "Done" at that moment
- **THEN** the question names the pull request and the task and offers moving it to "In Review", moving it to "Done", only comment, and no

#### Scenario: No transition can be read
- **WHEN** the session cannot read the task's transitions
- **THEN** the question offers only comment and no

#### Scenario: Asked once
- **WHEN** the question was asked for the pull request, and the loop is called again
- **THEN** no later action asks it again, answered or not

#### Scenario: The delivery goes on
- **WHEN** the question is asked and not answered
- **THEN** every next action, the merge and the archive are the same as for a change with no task

#### Scenario: Not on the archive pull request
- **WHEN** the change is on its archive branch, or it has no recorded task
- **THEN** no action asks the question

### Requirement: Jira is written only on the developer's yes
Jira SHALL be written only after the developer's own answer picks a transition or "only comment", and
only before the change is archived. A yes SHALL give exactly one comment, in the project's files
language, with the pull request's link and the change id, plus the transition when one was picked.

#### Scenario: A transition is picked
- **WHEN** the developer answers "move it to In Review"
- **THEN** the task gets one comment with the pull request's link and the change id, and the transition "In Review", and the reply says both were done

#### Scenario: Only comment
- **WHEN** the developer answers "only comment"
- **THEN** the task gets the comment and no transition

#### Scenario: No
- **WHEN** the developer answers "no"
- **THEN** nothing is written to Jira, and the reply says so

#### Scenario: No answer
- **WHEN** the developer never answers
- **THEN** nothing is written to Jira, and the change is merged and archived as usual

#### Scenario: An answer after the archive
- **WHEN** the developer answers yes after the change is archived on the default branch
- **THEN** nothing is written to Jira, and the reply says the change is already archived

#### Scenario: A second answer
- **WHEN** the developer answers again after an answer was recorded
- **THEN** nothing more is written to Jira

#### Scenario: A transition that was not offered
- **WHEN** the answer names a transition the question did not offer
- **THEN** nothing is written, and the reply lists the choices again

#### Scenario: The comment's language
- **WHEN** the project's files language is `pt-BR`
- **THEN** the comment is in Brazilian Portuguese; for `en` or any other language it is in English

#### Scenario: Jira refuses the write
- **WHEN** the connector fails to add the comment or to apply the transition
- **THEN** the reply names the task and the error, and the write is not retried

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
