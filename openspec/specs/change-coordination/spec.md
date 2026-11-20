# change-coordination Specification

## Purpose
Lets a person run one change with one command, `/devkit change`, as a loop over the stage checker
that hands each stage to the role its script names, ends every run in one of four states with a
plain reply in the person's language, and resumes from the files alone.

## Requirements

### Requirement: The devkit command reads its verb
`/devkit` SHALL read the first word of its arguments as the verb and the rest as the request. Only
the verb `change` SHALL run anything; every other verb SHALL answer in one plain sentence and create
or run nothing.

#### Scenario: A verb of a later round
- **WHEN** the person types `/devkit roadmap`, `/devkit status`, `/devkit project` or `/devkit help`
- **THEN** the reply says in one sentence that the verb is not built yet and names round 18, 18, 19 or 23 respectively, and no file, branch or worktree is created

#### Scenario: No verb or an unknown verb
- **WHEN** the person types `/devkit` alone or `/devkit` with a word that is not a verb
- **THEN** the reply says in one sentence that only `/devkit change` exists, and nothing is created or run

#### Scenario: A usage error
- **WHEN** the command's script meets an unknown option, a missing argument or an unreadable `openspec/config.yaml`
- **THEN** it exits 3, its reply says in plain words that the request could not be read and to type `/devkit change` with what the person wants done, the reply holds no script name, no option, no file name and no placeholder for a missing change, the raw message is only in the separate error field, which the session does not show, and nothing is created or run

### Requirement: The command runs only in a project set up for devkit
`/devkit change` SHALL run nothing in a folder without `openspec/`, or whose project schema is not
`devkit` or `devkit-lite`, and SHALL say so in one plain sentence.

#### Scenario: A project not set up
- **WHEN** `/devkit change add an export` is typed in a project whose `openspec/config.yaml` selects another schema
- **THEN** the reply says the project is not set up for devkit and names the setup command, and nothing is created

### Requirement: The project's driver setting decides whether the command runs
The command SHALL read `devkit.driver` from the project's `openspec/config.yaml`, `claude` when the
block or the key is absent. With `claude` it SHALL run; with `compozy` or `script` it SHALL say the
driver is not built yet, name its round and run nothing.

#### Scenario: No settings block
- **WHEN** `openspec/config.yaml` has no `devkit:` block and a request is typed
- **THEN** the command runs as with `driver: claude`

#### Scenario: The CompozyOS driver
- **WHEN** `devkit.driver` is `compozy`
- **THEN** the reply says this driver is not built yet and names round 21, and nothing is created or run

#### Scenario: The script driver
- **WHEN** `devkit.driver` is `script`
- **THEN** the reply says this driver is not built yet and names round 22, and nothing is created or run

#### Scenario: An unknown setting value
- **WHEN** `devkit.driver` holds a value other than `claude`, `compozy` or `script`, or `devkit.language` is not a language tag
- **THEN** the reply names the setting, the value and the accepted values, and nothing is created or run

### Requirement: Two language settings
The files a stage writes SHALL be in the project's `devkit.language` (`en` when absent). Every reply
of the command SHALL be in the person's language, the `language` setting of the `devkit-openspec`
plugin (`pt-BR` by default, or `en`); any other value SHALL be read as `pt-BR`.

#### Scenario: The owner's settings
- **WHEN** `devkit.language` is `en` and the person's language is `pt-BR`
- **THEN** every stage hand-off asks for English files and every reply of the command is in Brazilian Portuguese

#### Scenario: English replies
- **WHEN** the person's language is `en`
- **THEN** every reply of the command is in English

#### Scenario: An unset or unknown person's language
- **WHEN** the person's language reaches the command empty, unknown or as an unsubstituted placeholder
- **THEN** the replies are in Brazilian Portuguese

### Requirement: A free-text request opens a change
`/devkit change <text>` with no unfinished change SHALL create the change in its own git worktree and
branch named after an id the session proposes, with the script the session chose, write the request
into the requirements file, and reply with the id, the script, the reason and what comes next.

#### Scenario: A new change is opened
- **WHEN** a valid unused id, a script and a reason are given with the request
- **THEN** a worktree on a new branch named after the id exists, its change uses that script, the requirements file holds the request with a pending stage header, no question was asked before it was created, and the reply names the id, the script, the reason and the questions that come next

#### Scenario: The worktree's starting point
- **WHEN** a change is opened in a repository with a remote `origin`
- **THEN** the remote is fetched first and the new branch starts from `origin/<default branch>`

#### Scenario: A repository with no remote
- **WHEN** a change is opened in a repository with no remote
- **THEN** the new branch starts from the main checkout's current commit

#### Scenario: Opening in a project not set up, or with an unknown setting
- **WHEN** the opening step itself runs in a project that is not set up for devkit, or whose driver or files' language setting is unknown, or whose driver is not built
- **THEN** nothing is created, the reply is the one the typed command gives for that case, and the exit code is 3

#### Scenario: An id that cannot be a change name
- **WHEN** the proposed id is not 2 to 48 characters of lowercase letters, digits and dashes, starts or ends with a dash, holds two dashes in a row, or is `archive`
- **THEN** nothing is created and the reply says the name cannot be used

#### Scenario: Opening fails half-way: nothing is left behind and the same name can be opened again
- **WHEN** opening fails after the worktree and its branch were created (the OpenSpec command that creates the change fails, or the script's requirements template is missing or has no request section)
- **THEN** the command exits 3, the worktree, its folder and the branch it created are gone, each removed on its own so that one failed removal does not skip the next, and opening the same id again once the cause is fixed creates the change

#### Scenario: An id already in use
- **WHEN** a change folder, archived change, branch, archive branch, remote branch or worktree already has the proposed id
- **THEN** nothing is created and the reply says the name is taken

### Requirement: The script follows the grill until the plan is written
A change on the short script SHALL move to the full script, before any plan file exists, when the
grill's classification names an architecture, contract or screen change, or when the owner asks.
Once the proposal exists the script SHALL NOT change.

#### Scenario: The grill finds a flag
- **WHEN** the requirements passed, the change is on the short script, no proposal exists and the classification flags hold `architecture`, `contract` or `ui`
- **THEN** the next action switches the change to the full script and its reply says why

#### Scenario: The owner asks for the other script
- **WHEN** the owner asks for the other script before any proposal exists
- **THEN** the change's script is switched and the reply says so

#### Scenario: A switch after the plan is written
- **WHEN** a script switch is asked for a change whose proposal exists
- **THEN** the script does not change and the reply says the plan is already written

#### Scenario: A switch to the same script
- **WHEN** a switch names the script the change already uses
- **THEN** nothing changes

### Requirement: Unfinished work is asked about before a new request
When a new request is typed while another change is unfinished, the command SHALL name each
unfinished change and where it stopped and ask whether to continue it or start the new request,
before anything is created or run.

#### Scenario: A new request while a change is unfinished
- **WHEN** `/devkit change <text>` is typed and another change has an active folder or an archive branch in the main checkout or a worktree
- **THEN** the reply names that change and where it stopped and asks continue or new, and no folder, branch or worktree is created

### Requirement: Calling the command again resumes from the files
`/devkit change` with no text, or with a change id, SHALL continue the change from what its files,
git and GitHub say, remembering nothing between runs.

#### Scenario: Resuming by id
- **WHEN** `/devkit change <id>` names an active or archived change
- **THEN** the run continues that change without a question, and the first reply says it is continuing that change and where it stopped

#### Scenario: Resuming the only unfinished change
- **WHEN** `/devkit change` is typed with no text and exactly one change is unfinished
- **THEN** the run continues that change without a question, and the first reply says it is continuing that change and where it stopped

#### Scenario: Several unfinished changes
- **WHEN** `/devkit change` is typed with no text and two or more changes are unfinished
- **THEN** the reply lists each with where it stopped and asks which one to continue

#### Scenario: Nothing to resume
- **WHEN** `/devkit change` is typed with no text and no change is unfinished
- **THEN** the reply says there is nothing to continue and how to start a change

#### Scenario: A killed session reaches the same stage
- **WHEN** the next action of a change is computed, the session is killed, and the command is called again on the same files
- **THEN** the same next action is given

### Requirement: Each stage before the implementation goes to the role its script names
Before the implementation, the loop SHALL ask the stage checker for the next stage and hand it to the
role the script's stage declaration names; it SHALL NOT choose the order itself.

#### Scenario: The grill
- **WHEN** the checker's next stage is the requirements, or the run waits for the owner at the requirements
- **THEN** the next action is the grill, run by the session with the owner

#### Scenario: A plan stage
- **WHEN** the checker's next stage is a plan stage or the plan readiness, missing, unjudged, stale or offered again after a fix
- **THEN** the next action hands that stage to the agent of the role the declaration names

#### Scenario: A failed stage below its ceiling
- **WHEN** the plan readiness failed below its ceiling and nothing changed since
- **THEN** the next action hands the proposal stage to the planner's agent, naming the failed stage and its attempt

#### Scenario: A change folder that was never opened
- **WHEN** the change folder has no OpenSpec metadata file
- **THEN** the run ends blocked, saying the folder is incomplete

### Requirement: From the implementation on, the step inside the stage goes to its role
From the implementation to the archive, the loop SHALL take the stage from the stage checker and the
step inside it from the delivery checker, with the two overrides the retired `/conduct` applied and `/devkit change` keeps (a release-file
conflict, a branch the loop rebased), and hand each step to the role declared for its stage; the stage
checker's blocked ends SHALL win.

#### Scenario: Implementation and fixes
- **WHEN** the delivery checker's step is `implement`, `fix-review`, `fix-defect`, `fix-checks` or `apply-proposals`
- **THEN** the next action hands it to the implementer's agent

#### Scenario: The agent of a delivery step comes from the checker's row
- **WHEN** the row the delivery checker returns for a step the loop hands to an agent names that step's agent
- **THEN** the next action's agent is the one the row names

#### Scenario: Commits and pull requests
- **WHEN** the step is `commit`, `open-pr`, `push` or `open-archive-pr`
- **THEN** the next action hands it to the commit-and-pr agent

#### Scenario: A conflict only in release files
- **WHEN** the change's or the archive's pull request conflicts with its base only in release files (versions, changelog, catalog, the CI pin)
- **THEN** the next action hands `resolve-release-conflict` to the implementer's agent with the release rebase command and the conflicting paths

#### Scenario: A branch the loop's own rebase rewrote
- **WHEN** the pull request's head is no longer an ancestor of the local head but the branch held it before a rebase
- **THEN** the next action hands `push-rebased` to the commit-and-pr agent with the old head for a force-with-lease push

#### Scenario: A conflict in any other file
- **WHEN** the pull request conflicts with its base in a file that is not a release file
- **THEN** the run ends blocked, saying the pull request has a problem the session cannot fix alone

#### Scenario: GitHub reports a conflict the base merges cleanly
- **WHEN** GitHub reports a conflict, the base merges cleanly with the local head, and the project merges automatically
- **THEN** the next action is the session step `update-branch`

#### Scenario: The demonstration
- **WHEN** the step is `verify`
- **THEN** the next action hands it to the verifier's agent

#### Scenario: The code review
- **WHEN** the step is `review`
- **THEN** the next action is a session step that runs the review skill and sets the review file's stage header

#### Scenario: A phase gate
- **WHEN** the step is `gate`
- **THEN** the next action is a session step carrying the gate's command and task; a green run ticks the task and a red run ends the run blocked, saying the phase's tests failed

#### Scenario: A pull-request or archive step of the session
- **WHEN** the step is `edit-pr-body`, `enable-auto-merge`, `disable-auto-merge`, `update-branch`, `answer`, `retro`, `archive` or `tick-roadmap`
- **THEN** the next action is a session step naming it, done as the shipping skill's row for that step says

#### Scenario: A question on the pull request only the owner can answer
- **WHEN** the session's answer step finds a decision only the owner can take
- **THEN** the run ends waiting for the owner, with a reply naming the comment's link

#### Scenario: A step this version does not know
- **WHEN** the delivery checker returns a step the loop has no row for
- **THEN** the run ends blocked, saying the next step is unknown

#### Scenario: The loop's rows match what the checkers return
- **WHEN** the loop's rows are compared with every step the delivery checker and the two overrides can return
- **THEN** every returnable step has a row and no row names a step that no checker returns

#### Scenario: The loop and the checker name the same agent for each step
- **WHEN** the loop's own step-to-agent rows are compared with the delivery checker's step-to-agent mapping for every step both name as a hand-off to an agent
- **THEN** both name the same agent, and the one step the checker gives to an agent that the loop runs in the session, the retro, is the only one left out

#### Scenario: The delivery checker cannot read the change
- **WHEN** the delivery checker fails with a usage or settings error
- **THEN** the run ends blocked, saying the change cannot be read, and the command exits 3

### Requirement: A run ends in one of four states with a plain reason
Every call of the loop SHALL give either one action or one end among archived, waiting for the
owner, waiting on GitHub and blocked, with a reply, and SHALL exit 0 for an action or archived, 1 for
a wait, 2 for blocked and 3 for an error.

#### Scenario: Archived
- **WHEN** the delivery checker says the change is archived
- **THEN** the run ends archived, the reply says nothing is left to do, and the exit code is 0

#### Scenario: Archived with no archive branch left
- **WHEN** the change's folder is archived and no worktree is on its archive branch
- **THEN** the run ends archived without reading GitHub

#### Scenario: The plan waits for approval
- **WHEN** the stage checker waits for the owner at the approval, the approval being missing or stale
- **THEN** the run ends waiting for the owner with a reply asking for the approval (or for it again), carries the readiness hash the approval record needs, and the exit code is 1

#### Scenario: A stage no shipped role can finish
- **WHEN** the stage checker waits for the owner because a stage whose role is not shipped has a pending file
- **THEN** the run ends waiting for the owner with a reply asking the owner to set its result or remove it

#### Scenario: Other owner gates
- **WHEN** the delivery checker's step is `ready`, `archive-pr-ready`, `stop-review-deadlock`, `stop-retro-answers`, `stop-plan-approval` or `stop-plan-mode`
- **THEN** the run ends waiting for the owner, with the reply for merging by hand, the disputed review, the retro answers, the approval or delivering by hand

#### Scenario: The owner answers in the session
- **WHEN** the run ended waiting for the owner and the owner's next message in the same session answers the gate
- **THEN** the session records the answer as the shipping skill's row for that gate says, and the loop asks for its next action

#### Scenario: Waiting on GitHub
- **WHEN** the delivery checker's step is `wait-checks` or `wait-merge`
- **THEN** the run ends waiting on GitHub with a reply naming the checks, the merge or the archive's merge, and the exit code is 1

#### Scenario: A ceiling or a closed pull request
- **WHEN** the stage checker ends blocked because a stage reached its ceiling, the pull request was closed, or GitHub cannot be read
- **THEN** the run ends blocked with that reason in plain words, and the exit code is 2

#### Scenario: A change begun under the previous script
- **WHEN** the change's files carry no stage header
- **THEN** the run ends blocked, saying the change is finished with `/ship-change <id>`

#### Scenario: A blocked change called again
- **WHEN** a run ended blocked by a cause the files or GitHub still show (a ceiling, a closed pull request, a stop of the delivery checker) and `/devkit change` is called again
- **THEN** the run ends blocked again with the same reason

#### Scenario: A stop of the delivery checker
- **WHEN** the delivery checker's step is `stop-branch`, `stop-merge-setup`, `stop-archive`, `stop-not-approved` or `blocked`
- **THEN** the run ends blocked with the matching plain reason

### Requirement: Every end of a run is marked in the session's record
Every command of the loop that ends a run SHALL print the line `devkit-end: <id> <state>` (the state
`archived`, `waiting-for-owner`, `waiting-on-github` or `blocked`), after its `devkit-run: <id>` line
where it prints one. No other output SHALL hold that line, and the reply the session shows SHALL NOT
hold it.

#### Scenario: An end computed by the loop
- **WHEN** the next action, or the action the background wait ends with, is an end
- **THEN** the output's first line is `devkit-run: <id>`, its second is `devkit-end: <id> <state>` with the end's state, and the action follows

#### Scenario: A no-progress or not-delivered end
- **WHEN** the loop is called with the previous action's progress key and ends the run blocked for no progress or for a stage that was not delivered
- **THEN** its output holds `devkit-end: <id> blocked` after its `devkit-run: <id>` line

#### Scenario: An end the session declares
- **WHEN** the session renders the blocked reply for a failed stage agent or a red gate, or the reply for a pull-request decision left to the owner, naming the change
- **THEN** the output's first line is `devkit-end: <id> blocked` (or `devkit-end: <id> waiting-for-owner`), the reply follows on its own lines, and the session shows only the reply

#### Scenario: An action that is not an end
- **WHEN** the next action hands a stage to an agent, is a session step or is the grill
- **THEN** the output holds no `devkit-end:` line

### Requirement: The loop does not repeat a stage that made no progress
Given the progress key of the previous action, the loop SHALL end the run blocked when the same
action comes back with nothing changed, and when a stage handed to its agent comes back with its file
still missing or pending.

#### Scenario: Nothing changed
- **WHEN** the loop is called with the previous action's progress key and the new action has the same key
- **THEN** the run ends blocked, saying that stage came back with nothing changed

#### Scenario: A stage that was not delivered
- **WHEN** the previous action handed a stage to its agent and that stage's file is still missing or still says it is pending
- **THEN** the run ends blocked, saying the stage ended without delivering its result

### Requirement: The hand-off names the role, the change and the stage
An action that hands a stage to an agent SHALL carry the agent type of the stage's role and a brief
naming the change, the stage, the worktree, the branch and the files' language, and SHALL NOT carry
the text of the role's skills.

#### Scenario: A brief
- **WHEN** a stage is handed to its agent
- **THEN** the brief names the change, the stage, the worktree and branch and the files' language, and holds no line of any skill the stage lists

### Requirement: The session waits on GitHub with no time limit
When a run ends waiting on GitHub, the session SHALL start a background wait that holds no state but
the first decision, has no limit of its own, and ends with the new action as soon as the decision
changes; the reply SHALL say the session is waiting and that calling the command again is safe.

#### Scenario: The reply that starts the wait
- **WHEN** a run ends waiting on GitHub
- **THEN** its reply says the session keeps waiting with no time limit and that calling `/devkit change` again is safe

#### Scenario: GitHub has not answered
- **WHEN** the decision is still the same wait at every poll
- **THEN** the wait keeps polling, whatever the number of polls

#### Scenario: The checks pass in merge mode
- **WHEN** the checks pass and auto-merge is not on
- **THEN** the wait ends with the action that turns auto-merge on

#### Scenario: The checks pass in pr mode
- **WHEN** the checks pass and the project merges by hand
- **THEN** the wait ends and the run waits for the owner to merge

#### Scenario: A check fails
- **WHEN** a check of the pull request fails
- **THEN** the wait ends with the action that hands the fix to the implementer's agent

#### Scenario: The pull request merges
- **WHEN** the change's pull request merges
- **THEN** the wait ends with the retro as the next action

#### Scenario: The archive pull request merges
- **WHEN** the archive pull request merges
- **THEN** the wait ends and the run ends archived

#### Scenario: The pull request is closed
- **WHEN** the pull request is closed without merging
- **THEN** the wait ends and the run ends blocked, naming the pull request

#### Scenario: A comment asks something
- **WHEN** a new comment or review on the pull request needs an answer
- **THEN** the wait ends with the answer step as the next action

#### Scenario: GitHub cannot be read
- **WHEN** GitHub cannot be read at three polls in a row
- **THEN** the wait ends and the run ends blocked, quoting the error

### Requirement: Replies use no internal term
Every reply of the command SHALL come from one message table with the same keys in English and in
Brazilian Portuguese, and SHALL hold no stage id or role id with a dash, no step name of a checker,
no file name and no checker name; the reply of a usage error is one of them.

#### Scenario: The message table is checked
- **WHEN** every message and parameter of the table is rendered in both languages, the usage error's reply included
- **THEN** none holds a backtick, a file name, a hyphenated stage, role or step id, a checker's reason code, a checker's name, the loop script's name, an option or a placeholder for a missing change, both languages have the same keys, and no Portuguese string equals its English one except the two that are the same word in both languages: the driver's name CompozyOS and the setting name driver

#### Scenario: A usage error's reply in both languages
- **WHEN** the command's script exits 3 on an unknown option, in English and in Brazilian Portuguese
- **THEN** the reply is the usage error's message of the table in that language, and the raw error, with the script's name and options, is only in the error field

### Requirement: The conduct command is no longer shipped
The `devkit-openspec` pack SHALL NOT ship the `conduct` skill in either mode; the session text, the
panel's buttons and every document SHALL name `/devkit change` in its place.

#### Scenario: The skill is gone
- **WHEN** the pack's skills and the catalog are listed
- **THEN** there is a `devkit` skill and no `conduct` skill

#### Scenario: The session text
- **WHEN** a session starts in a project with an active change
- **THEN** the session text names `/devkit change` and does not name `/conduct`

#### Scenario: The panel's buttons
- **WHEN** the person presses the panel's continue button or another change's button
- **THEN** the prompt box holds `/devkit change <id>`

#### Scenario: The panel finds the change of a run
- **WHEN** the session's newest typed command is `/devkit change <id>`, or an older transcript's `/conduct <id>`
- **THEN** the panel shows that change as the conducted one, and a free-text request names no change

#### Scenario: Documents point at the new command
- **WHEN** a tracked file outside the records names `/conduct`, the command `/devkit change` replaced
- **THEN** the same line names `/devkit change`
