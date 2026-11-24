# change-coordination Specification

## Purpose
Lets a person run one change with one command, `/devkit change`, as a loop over the stage checker
that hands each stage to the role its script names, ends every run in one of four states with a
plain reply in the person's language, and resumes from the files alone.

## Requirements

### Requirement: The devkit command reads its verb
`/devkit` SHALL read the first word of its arguments as the verb and the rest as the request. Only
the verbs `change`, `roadmap`, `status`, `project` and `train` SHALL run anything (`roadmap` and
`status` as the roadmap-coordination capability says, `project` as the project-definition capability
says, `train` as the delivery-train capability says); every other verb SHALL answer in one plain
sentence and create or run nothing.

#### Scenario: A verb of a later round
- **WHEN** the person types `/devkit help`
- **THEN** the reply says in one sentence that the verb is not built yet and names round 23, and no file, branch or worktree is created

#### Scenario: The roadmap and status verbs
- **WHEN** the person types `/devkit roadmap`, `/devkit roadmap 3`, `/devkit roadmap stop` or `/devkit status` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers that verb's mode with the rest of the arguments, creates nothing itself, and the session carries on as the roadmap-coordination capability says

#### Scenario: The project verb
- **WHEN** the person types `/devkit project` or `/devkit project billing` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers the `project` mode with the rest of the arguments, creates nothing itself, and the session carries on as the project-definition capability says

#### Scenario: The train verb
- **WHEN** the person types `/devkit train` in a project set up for devkit with the `claude` driver
- **THEN** the command's script answers the `train` mode, creates nothing itself, and the session carries on as the delivery-train capability says

#### Scenario: The train verb with words after it
- **WHEN** the person types `/devkit train now`
- **THEN** the reply says in one sentence that `/devkit train` takes no words after it, and nothing is created or run

#### Scenario: No verb or an unknown verb
- **WHEN** the person types `/devkit` alone or `/devkit` with a word that is not a verb
- **THEN** the reply says in one sentence that `/devkit change`, `/devkit roadmap`, `/devkit status`, `/devkit project` and `/devkit train` exist and what each is for, and nothing is created or run

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
block or the key is absent. With `claude` it SHALL run in the session; with `compozy` it SHALL start
the change's run in CompozyOS; with `script` it SHALL say the driver is not built yet, name its
round and run nothing.

#### Scenario: No settings block
- **WHEN** `openspec/config.yaml` has no `devkit:` block and a request is typed
- **THEN** the command runs as with `driver: claude`

#### Scenario: The CompozyOS driver
- **WHEN** `devkit.driver` is `compozy` and CompozyOS runs on the machine and knows the project
- **THEN** the command starts the change's run in CompozyOS, as the requirement on the CompozyOS driver says, and asks no question of the change in the session

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
- **WHEN** a change folder, archived change, branch, archive branch or worktree already has the proposed id, or a branch of that name on `origin` holds no change folder of that id
- **THEN** nothing is created and the reply says the name is taken

#### Scenario: An id open on another machine
- **WHEN** a branch of the proposed id exists on `origin` and holds that change's folder
- **THEN** the opening is refused as the requirement "An id open on another machine is refused" says, not as a taken name

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
- **WHEN** `/devkit change <text>` is typed and another change that is not archived on the default branch, or that is a new change reusing an archived id on a later day, has an active folder or an archive branch in the main checkout or a worktree
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
step inside it from the delivery checker, with the override the retired `/conduct` applied and `/devkit change` keeps (a release-file
conflict), and hand each step to the role declared for its stage; the stage
checker's blocked ends SHALL win. The unit tests and the E2E tests, which the delivery checker does
not know, SHALL be taken from the stage checker alone.

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
- **THEN** the next action hands `resolve-release-conflict` to the implementer's agent with the release merge command and the conflicting paths

#### Scenario: A release merge that is not pushed yet
- **WHEN** GitHub still reports the pull request in conflict, the local head already holds the base and the pull request's head is an ancestor of the local head and differs from it
- **THEN** the next action hands `push` (for the change's pull request) or `open-archive-pr` (for the archive's) to the commit-and-pr agent with the command `git push origin <branch>`, which holds neither `--force` nor `--force-with-lease`

#### Scenario: A branch the loop's own rebase rewrote
- **WHEN** the pull request's head is no longer an ancestor of the local head because the branch was rewritten by a rebase, as an earlier version's release step did
- **THEN** the loop hands no push for it: the run ends blocked, saying the pull request's head is not in the local history, for the owner to push by hand

#### Scenario: No step pushes by force
- **WHEN** the loop's rows and every step the delivery checker and the override can return are listed
- **THEN** none of them is `push-rebased` and no command they carry holds `--force` or `--force-with-lease`

#### Scenario: A conflict in any other file
- **WHEN** the pull request conflicts with its base in a file that is not a release file
- **THEN** the run ends blocked, saying the pull request has a problem the session cannot fix alone

#### Scenario: GitHub reports a conflict the base merges cleanly
- **WHEN** GitHub reports a conflict, the base merges cleanly with the local head, the local head is the pull request's head, and the project merges automatically
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
- **WHEN** the loop's rows are compared with every step the delivery checker and the override can return
- **THEN** every returnable step has a row and no row names a step that no checker returns

#### Scenario: The loop and the checker name the same agent for each step
- **WHEN** the loop's own step-to-agent rows are compared with the delivery checker's step-to-agent mapping for every step both name as a hand-off to an agent
- **THEN** both name the same agent, and the one step the checker gives to an agent that the loop runs in the session, the retro, is the only one left out

#### Scenario: The delivery checker cannot read the change
- **WHEN** the delivery checker fails with a usage or settings error
- **THEN** the run ends blocked, saying the change cannot be read, and the command exits 3

#### Scenario: The unit tests are next
- **WHEN** the stage checker's next stage is the unit tests, missing, stale or offered again after a fix
- **THEN** the next action hands the stage to `devkit-core:test-runner`, its detail carrying the declared unit command, coverage command and coverage target, whatever step the delivery checker would give

#### Scenario: The E2E tests are next
- **WHEN** the stage checker's next stage is the E2E tests
- **THEN** the next action hands the stage to `devkit-core:e2e-tester`, its detail carrying the declared E2E command

#### Scenario: A red test stage goes back to the implementer
- **WHEN** the stage checker's next stage is the implementation because the unit tests or the E2E tests failed below their ceiling and nothing changed since
- **THEN** the next action hands the step `fix-tests` to the implementer's agent, its detail naming the failed stage and its file

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

#### Scenario: GitHub does not answer
- **WHEN** the stage checker cannot read the change's pull request or its checks because a `gh` call fails
- **THEN** the run ends waiting on GitHub with a reply saying GitHub did not answer, the action keeps GitHub's error for the wait, and the exit code is 1

#### Scenario: A ceiling or a closed pull request
- **WHEN** the stage checker ends blocked because a stage reached its ceiling or the pull request was closed
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

#### Scenario: A failed stage agent
- **WHEN** a stage agent returned `Outcome: failure` without writing its stage file and the loop is called with its action's progress key
- **THEN** the loop gives the retry of that stage or ends the run blocked itself, with `devkit-end: <id> blocked` after its `devkit-run: <id>` line, and the session declares no end for it

#### Scenario: An end the session declares
- **WHEN** the session renders the blocked reply for a red gate, or the reply for a pull-request decision left to the owner, naming the change
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
- **WHEN** the decision is still the same wait on the checks or the merge at every poll
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
- **WHEN** GitHub cannot be read at three polls in a row, each poll failing or giving the wait that says GitHub did not answer
- **THEN** the wait ends and the run ends blocked, quoting the error

#### Scenario: A wait that began with GitHub silent
- **WHEN** the run ended waiting because GitHub did not answer, and at a later poll GitHub answers with the checks still pending
- **THEN** the wait ends with the wait on the checks, and the session starts a new wait for it

### Requirement: Replies use no internal term
Every reply of the command SHALL come from one message table with the same keys in English and in
Brazilian Portuguese, and SHALL hold no stage id or role id with a dash, no step name of a checker,
no file name and no checker name; the reply of a usage error is one of them. The one exception is the
budget stop's reply, which names the change's `.openspec.yaml` and the key `budget` it is raised in.

#### Scenario: The message table is checked
- **WHEN** every message and parameter of the table is rendered in both languages, the usage error's reply included
- **THEN** none holds a backtick, a file name, a hyphenated stage, role or step id, a checker's reason code, a checker's name, the loop script's name, the roadmap script's name, a setting's key, an option or a placeholder for a missing change, except the budget stop's reply, which holds the path of the change's settings file and the key budget; both languages have the same keys, and no Portuguese string equals its English one except the three that are the same word in both languages, the driver's name CompozyOS and the setting names driver and budget, and the three that hold only parameters and punctuation: the line saying where a change stays, the owner's need in the list of a run that ends, and the bare stage title of a board row

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

### Requirement: A change archived on the default branch is not unfinished
The command SHALL NOT list as unfinished a change whose archived folder
(`openspec/changes/archive/<date>-<id>/`) is on the default branch, read from GitHub, else from the
remote-tracking default branch, else from the main checkout, whatever old checkout still holds its
active folder, sits on its branch or its archive branch, except a new change reusing the id (next
requirement). It SHALL still list a change on its archive branch whose archive is not on the
default branch yet.

#### Scenario: An old worktree holds the active folder
- **WHEN** `foo` is archived on the default branch and a worktree on another branch still holds the old copy of `openspec/changes/foo/`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: An old worktree on the change's branch
- **WHEN** `bar` is archived on the default branch and a worktree on branch `bar` still holds the old copy of `openspec/changes/bar/`
- **THEN** `change-loop.mjs start` does not list `bar`

#### Scenario: An archive branch whose pull request merged
- **WHEN** `foo` is archived on the default branch and a worktree still sits on `chore/archive-foo`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: An archive pull request not merged yet
- **WHEN** a worktree sits on `chore/archive-baz` and the default branch has no archived folder of `baz`
- **THEN** `change-loop.mjs start` lists `baz` as being archived

#### Scenario: The main checkout's default branch is behind
- **WHEN** the main checkout's local default branch is eight commits behind the remote one, which archived `foo`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: GitHub cannot be read
- **WHEN** `gh` fails and the remote-tracking default branch holds the archived folder of `foo`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: Resuming an archived change by its id
- **WHEN** `/devkit change foo` names a change archived on the default branch
- **THEN** the run continues `foo` as before this change, ending archived

### Requirement: A new change that reuses an archived id is unfinished
An active folder `openspec/changes/<id>/` whose `.openspec.yaml` records a `created:` day later
than the latest archived day of `<id>` on the default branch is a new change that reuses the id; the
command SHALL list it as unfinished. The comparison is by day, as an archived folder's name carries
only its day: a folder created on the archive's day or before, or whose `.openspec.yaml` records no
`created:` day, is the old copy of the archived change and SHALL NOT be listed.

#### Scenario: A new change reuses an archived id on a later day
- **WHEN** the latest archived folder of `foo` on the default branch is `2026-11-20-foo` and a worktree holds `openspec/changes/foo/` whose `.openspec.yaml` records `created: 2026-11-21`
- **THEN** `change-loop.mjs start` lists `foo`

#### Scenario: An active folder created on the day of the archive
- **WHEN** the latest archived folder of `foo` on the default branch is `2026-11-20-foo` and a worktree holds `openspec/changes/foo/` whose `.openspec.yaml` records `created: 2026-11-20`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: An active folder created before the archive
- **WHEN** the latest archived folder of `foo` on the default branch is `2026-11-20-foo` and a worktree holds `openspec/changes/foo/` whose `.openspec.yaml` records `created: 2026-11-10`
- **THEN** `change-loop.mjs start` does not list `foo`

#### Scenario: An active folder that records no creation day
- **WHEN** `foo` is archived on the default branch and a worktree holds `openspec/changes/foo/` whose `.openspec.yaml` has no `created:` line
- **THEN** `change-loop.mjs start` does not list `foo`

### Requirement: Two openings at once do not collide
Opening a change SHALL be serialized per repository: while one opening runs, another SHALL wait for
it, up to one minute, and then go on. Each opening alone SHALL behave as before; two openings of two
ids SHALL both create their change, and two of one id SHALL create it once.

#### Scenario: Two ids at once
- **WHEN** the opening of `a` and the opening of `b` are started at the same moment in one repository
- **THEN** both worktrees, branches and change folders exist, and each requirements file holds its own request

#### Scenario: One id twice at once
- **WHEN** two openings of `a` are started at the same moment
- **THEN** one creates the change and the other is refused because the name is taken, and nothing of the second is left behind

#### Scenario: A lock left by a dead opening
- **WHEN** an opening finds a lock older than ten minutes
- **THEN** it takes the lock over and opens the change

### Requirement: The mock-up and the decisions go to their roles
Before the plan, the loop SHALL hand the mock-up to `devkit-core:screen-designer` and the decisions
to `devkit-core:adr-author` when the stage checker offers them, each with a brief that names the
stage's own instructions, and SHALL hand nothing for a stage the checker reports not applicable.

#### Scenario: The decisions of a full-script change
- **WHEN** the requirements of a `devkit` change passed and it has no `decisions.md`
- **THEN** the next action hands the decisions to `devkit-core:adr-author`, after the mock-up when the mock-up applies

#### Scenario: A change with a screen
- **WHEN** the requirements of a `devkit` change passed, its classification lists `ui`, and it has no `mockup.md`
- **THEN** the next action hands the mock-up to `devkit-core:screen-designer`

#### Scenario: A change with no screen
- **WHEN** the classification of a `devkit` change has no `ui` flag
- **THEN** no action hands the mock-up to any agent

### Requirement: The mock-up waits for the owner's answer
When the drawn mock-up waits for the owner, the run SHALL end waiting for the owner with a reply
asking to approve it or say what to change, and a detail naming its folder. An answer recorded as
changes SHALL make the next action hand the mock-up to its agent again as a new attempt, naming the
owner's notes; an answer recorded as approval SHALL let the walk go on.

#### Scenario: The mock-up is drawn
- **WHEN** `mockup.md`'s header says `result=pending`
- **THEN** the run ends waiting for the owner with the mock-up reply, its detail names the change's `mock/` folder and `mockup.md`, and the exit code is 1

#### Scenario: The owner asks for changes
- **WHEN** the owner's answer was recorded as changes (`mockup.md`'s header `result=failed attempt=1`, the owner's notes appended)
- **THEN** the next action hands the mock-up to `devkit-core:screen-designer`, its brief saying the owner asked for changes at attempt 1 and the notes are in `mockup.md`

#### Scenario: The owner approves
- **WHEN** the owner's answer was recorded as approval (`mockup.md`'s header `result=passed`)
- **THEN** the next stage is offered as for any passed stage

### Requirement: Approved decisions are accepted before the implementation
When the owner's plan approval is current and `decisions.md` lists an ADR whose status is still
proposed, and the change is not being archived, the next action SHALL be the session step
`accept-decisions` carrying the command that sets every listed ADR to accepted; that command SHALL
refuse, changing nothing, while the approval is not current.

#### Scenario: The plan was just approved
- **WHEN** `approval.md` is current for `readiness.md` and `decisions.md` lists two ADRs with status proposed
- **THEN** the next action is the session step `accept-decisions`, whose command, run, sets both to accepted with the approval's date and the change's id, and the next call offers the implementation

#### Scenario: The plan is under revision
- **WHEN** `decisions.md` lists an ADR with status proposed and `approval.md` is missing or for an earlier `readiness.md`
- **THEN** no action is `accept-decisions`, and the command, run by hand, exits 3 naming the missing approval and leaves the ADR proposed

#### Scenario: A record the command cannot set
- **WHEN** a listed ADR has no status line, or lies outside a folder named `adr`, `adrs` or `decisions`
- **THEN** the command exits 3 naming the file and changes no file

#### Scenario: A listed record the loop cannot read
- **WHEN** `approval.md` is current for `readiness.md` and `decisions.md` lists an ADR that has no status line, or that lies outside a folder named `adr`, `adrs` or `decisions`, and no ADR with status proposed
- **THEN** the next action is still the session step `accept-decisions`, its records name that ADR, and its command, run, exits 3 naming that file and changes no file

#### Scenario: Nothing left to accept
- **WHEN** every ADR `decisions.md` lists can be read and already says accepted, or `decisions.md` lists none
- **THEN** no action is `accept-decisions`

#### Scenario: The change is being archived
- **WHEN** the session is on the change's archive branch (`chore/archive-<id>`), `approval.md` is current for `readiness.md` and `decisions.md` lists an ADR with status proposed
- **THEN** no action is `accept-decisions`, and the loop goes on to the archive steps

### Requirement: The test settings are read from the devkit block
The loop and the checker SHALL read `devkit.tests.unit`, `devkit.tests.coverage.command`,
`devkit.tests.coverage.target` and `devkit.tests.e2e` from the nested `devkit:` block of
`openspec/config.yaml`. A coverage target that is not a whole number from 0 to 100 SHALL stop the
command like any unknown setting value.

#### Scenario: The nested block
- **WHEN** the block holds `tests:` with `unit: "npm test"`, `coverage:` with `command: "npm run cov"` and `target: 80`, and `e2e: "npm run e2e"`
- **THEN** the four values are read, and `driver` and `language` are read as before

#### Scenario: A target that is not a whole number
- **WHEN** `devkit.tests.coverage.target` is `80%`
- **THEN** `/devkit change` replies that the coverage target has an unknown value, names the accepted values, and nothing is created or run

### Requirement: A run can carry a token budget
`/devkit change` SHALL read an optional cap, a whole number of tokens, from `budget:` in the
`devkit:` block of the change's `.openspec.yaml`, else from `budget:` in the `devkit:` block of
`openspec/config.yaml` as the change's own checkout holds it. With neither, or with an empty value,
the run SHALL have no cap, and every output of the loop SHALL be what it is without the setting.

#### Scenario: The project's cap
- **WHEN** `openspec/config.yaml` has `budget: 2000000` in its `devkit:` block and the change's `.openspec.yaml` has no `devkit:` block
- **THEN** the cap of the change's run is 2000000 tokens

#### Scenario: The change's cap wins for that change only
- **WHEN** `openspec/config.yaml` has `budget: 2000000` in its `devkit:` block, change `a`'s `.openspec.yaml` has a `devkit:` block with `budget: 500000`, and change `b`'s has none
- **THEN** the cap of `a`'s run is 500000 tokens and the cap of `b`'s run is 2000000 tokens

#### Scenario: No budget anywhere
- **WHEN** neither file has a `budget:` key in a `devkit:` block
- **THEN** every output of `change-loop.mjs` is the same as before the setting existed, and no transcript is read for a count

#### Scenario: An empty value
- **WHEN** a `devkit:` block holds `budget:` with no value
- **THEN** that file sets no cap, as if the key were absent

#### Scenario: A key outside the devkit block
- **WHEN** the change's `.openspec.yaml` holds a top-level `budget: 100` and no `devkit:` block
- **THEN** that line sets no cap, and the project's value, or no cap, applies

#### Scenario: A quoted value, a comment and an unclosed quote
- **WHEN** a `devkit:` block holds `budget: "2000000"  # two million`, or `budget: "2000000` with no closing quote
- **THEN** the cap is 2000000 tokens, as the other settings of the block read a value

### Requirement: An invalid budget is refused before any stage runs
A `budget:` value that is not a whole number greater than zero, in either file, SHALL be refused with
the settings-error reply naming the setting `budget`, the value and the accepted values, and nothing
SHALL be created, handed off or run.

#### Scenario: In the project's settings
- **WHEN** the `devkit:` block of `openspec/config.yaml` holds `budget: abc` (or `0`, `-5`, `1.5`, `2e6`, `2_000_000`) and `/devkit change add an export` is typed
- **THEN** the reply is the settings-error reply naming `budget` and that value, and no folder, branch or worktree is created

#### Scenario: In the change's file
- **WHEN** the `devkit:` block of the change's `.openspec.yaml` holds `budget: 0` and the loop is asked for the change's next action
- **THEN** it exits 3 with the settings-error reply naming `budget` and `0`, and gives no hand-off

### Requirement: The run's spend is counted from the session's transcripts
A run's spend SHALL be the sum of `input_tokens + output_tokens + cache_creation_input_tokens` of each
model message recorded after the change's first `devkit-run: <id>` line in the session's transcript,
and in each subagent transcript of that session started after that line. `cache_read_input_tokens`
SHALL NOT count, and a message recorded on several lines SHALL count once.

#### Scenario: Known numbers
- **WHEN** after the change's first run line the session's transcript records two model messages of 10 input, 200 output, 3000 cache-write and 50000 cache-read tokens each, and one subagent started after that line records one message of 5 input, 100 output and 1000 cache-write tokens
- **THEN** the spend is 7525 tokens

#### Scenario: Before the first run line
- **WHEN** model messages are recorded before the change's first `devkit-run: <id>` line
- **THEN** they do not count

#### Scenario: The first run line, not the newest
- **WHEN** the transcript holds two `devkit-run: <id>` lines for the change, from two calls of `/devkit change`
- **THEN** the count starts at the first

#### Scenario: Another change's run line
- **WHEN** the only run line in the transcript names another change
- **THEN** the change's spend is 0

#### Scenario: A message split over several lines
- **WHEN** one model message is recorded on three lines with the same message id and the same usage
- **THEN** its tokens count once

#### Scenario: A subagent started before the run
- **WHEN** a subagent transcript of the session started before the change's first run line
- **THEN** none of its tokens count, even those recorded after that line

#### Scenario: A new session
- **WHEN** the change is resumed in another session, or on another machine
- **THEN** the count starts again from zero in that session

### Requirement: The loop stops at the budget between hand-offs
When a cap applies and the run's spend is at or above it, the loop's next action SHALL be an end
waiting for the owner, with the reason budget reached, in place of a stage hand-off or a session
step. Below the cap, or when the spend cannot be read, the action SHALL be the one given with no
cap. The grill and every end SHALL be unchanged.

#### Scenario: At the cap
- **WHEN** the cap is 2000000, the spend is 2000000, and the next action would hand a stage to its agent
- **THEN** the run ends waiting for the owner with the reason budget reached, the exit code is 1, and the output's first line is `devkit-run: <id>` and its second `devkit-end: <id> waiting-for-owner`

#### Scenario: Above the cap with a session step ready
- **WHEN** the spend is above the cap and the next action would be a session step
- **THEN** the run ends waiting for the owner with the reason budget reached

#### Scenario: The turn can end
- **WHEN** the loop ended the run at the budget and the session then tries to end its turn
- **THEN** the stop is allowed at the first attempt

#### Scenario: Under the cap
- **WHEN** the spend is below the cap
- **THEN** the next action is the one the loop gives with no cap

#### Scenario: No transcript to read
- **WHEN** a cap is set and the session's transcript cannot be found or read
- **THEN** the next action is the one the loop gives with no cap

#### Scenario: The grill and the ends
- **WHEN** the spend is above the cap and the next action is the grill or an end
- **THEN** that action is given unchanged

#### Scenario: A stage that made no progress
- **WHEN** the loop is called with the previous action's progress key, the same action comes back, and the spend is above the cap
- **THEN** the run ends blocked, saying that stage came back with nothing changed

#### Scenario: A hand-off that crosses the cap
- **WHEN** a stage agent's own work takes the spend past the cap
- **THEN** nothing stops that agent, and the loop's next call ends the run at the budget

#### Scenario: The roadmap coordinator's own reading
- **WHEN** the roadmap coordinator reads a change's next action for its run or its board
- **THEN** no budget applies to that reading

### Requirement: The budget stop says how to go on
The reply of a budget stop SHALL state, in the person's language, the tokens spent, the cap, the
absolute path of the change's `.openspec.yaml` and the key `budget` of its `devkit:` block as the
place to raise the cap, and that typing `/devkit change` again goes on.

#### Scenario: In English
- **WHEN** the run of `feat` stops at a cap of 2000000 with 2100000 tokens spent and the person's language is `en`
- **THEN** the reply names `feat`, 2100000, 2000000, the absolute path of `feat`'s `.openspec.yaml`, `budget` in the `devkit` block and `/devkit change`

#### Scenario: In Brazilian Portuguese
- **WHEN** the same stop happens and the person's language is `pt-BR`
- **THEN** the reply says the same in Brazilian Portuguese

### Requirement: A raised budget resumes the run
After a budget stop, once the cap that applies is above the spend, the loop's next action SHALL be
the hand-off the stop held back, with no other step; while the cap is not above the spend, every call
SHALL stop the run again at the budget.

#### Scenario: The cap is raised
- **WHEN** the run of `feat` stopped at the budget, the owner sets `budget:` in the `devkit:` block of `feat`'s `.openspec.yaml` above the spend, and types `/devkit change` again
- **THEN** the next action is the hand-off the stop held back

#### Scenario: The cap is not raised
- **WHEN** the run stopped at the budget and `/devkit change` is typed again with no change to either file
- **THEN** the run stops again at the budget with the same kind of reply

### Requirement: A gh too old to read the checks ends the run with its own reason
When the stage checker ends blocked because the installed `gh` is too old to read the pull request's
checks, the loop SHALL end the run blocked with the reason `gh-too-old`, exit 2, and a reply in the
person's language naming the installed version (or saying it is unknown) and 2.50.0, telling the
person to update `gh` and to call `/devkit change` again. The wait on GitHub SHALL NOT retry it.

#### Scenario: The run ends with the old-gh reason
- **WHEN** the change's open pull request is at the local head, `gh pr checks` fails with `unknown flag: --json` and `gh --version` prints `gh version 2.46.0 (2024-03-18)`, and `change-loop.mjs next` runs
- **THEN** the run ends blocked with the reason `gh-too-old` and exit code 2, and its reply, in English and in Brazilian Portuguese, names `2.46.0` and `2.50.0`, says to update `gh` and to call `/devkit change` with the change's id again, and does not say that GitHub cannot be read

#### Scenario: The version cannot be read
- **WHEN** the same failure happens and `gh --version` cannot be read
- **THEN** the run ends blocked with the reason `gh-too-old`, its reply giving the installed version as unknown and naming `2.50.0`

#### Scenario: The wait meets an old gh
- **WHEN** the session waits on GitHub and a poll ends blocked with the reason `gh-too-old`
- **THEN** the wait ends at that poll with that decision, without the retries an unreadable GitHub gets

#### Scenario: The roadmap shows the reason
- **WHEN** a change of a roadmap run ends blocked with the reason `gh-too-old`
- **THEN** its blocked line in the roadmap reply names both versions in the person's language

### Requirement: In the two-pull-request model a change opens from the base branch
In `two-prs`, opening a change SHALL cut its branch from `origin/<base>` after the fetch, and SHALL
refuse, creating nothing, while the test branch does not exist on `origin`, while the base branch is
not the repository's default branch, or when the proposed id ends with `-<test_branch>`.

#### Scenario: The starting point
- **WHEN** a change opens in a project with `base: main` and `test_branch: develop`, both on `origin`
- **THEN** the new branch starts from the fetched `origin/main`

#### Scenario: The test branch is missing
- **WHEN** `origin` has no branch `develop`
- **THEN** nothing is created, the exit code is 3 and the reply says the test branch `develop` must exist on `origin` first

#### Scenario: The base is not the default branch
- **WHEN** the configuration says `base: master` and the repository's default branch is `develop`
- **THEN** nothing is created and the reply names both branches

#### Scenario: An id that looks like a support branch
- **WHEN** the proposed id is `fix-develop`
- **THEN** nothing is created and the reply says the name cannot end with `-develop`

### Requirement: A delivery setting that cannot be used stops the command
`/devkit change` and the opening step SHALL refuse to run, creating nothing, when the project's
delivery model is unknown, a branch name it needs is missing, or the two branch names are the same,
with a reply that names the setting.

#### Scenario: An unknown model
- **WHEN** the configuration says `delivery: { model: gitflow }`
- **THEN** the reply names `delivery.model`, the value and the accepted values, and nothing runs

#### Scenario: A missing branch name
- **WHEN** the configuration says `model: two-prs` with no `base`
- **THEN** the reply names `delivery.base` as missing, and nothing runs

### Requirement: In the two-pull-request model a change is archived when both branches hold it
In `two-prs`, a change SHALL count as archived, for the unfinished changes and for the roadmap, only
when its archived folder is on the base branch and on the test branch; until then a worktree on its
archive branch to the test branch SHALL keep it unfinished.

#### Scenario: Only the base branch holds the archive
- **WHEN** `main` lists `openspec/changes/archive/<date>-feat/` and `develop` does not, and a worktree is on `chore/archive-feat-develop`
- **THEN** `feat` is listed as unfinished, and calling the command again resumes it

#### Scenario: Both hold it
- **WHEN** both branches list the archived folder
- **THEN** `feat` is not unfinished

### Requirement: A hand-off on the support branch names the support worktree
A hand-off for work on the support branch SHALL name the support branch's worktree and branch in its
brief, in place of the task branch's.

#### Scenario: The conflict resolution
- **WHEN** the next step is the resolution of a conflict on `feat-develop`
- **THEN** the hand-off goes to the implementer and its brief says to work only in the worktree of `feat-develop`, on that branch

### Requirement: A release-only conflict is resolved by a merge of the base
The release-conflict step's command SHALL merge `origin/<base>` into the branch, never rebase it,
resolve the release files by the renumbering rule and commit the merge, so that the branch's old
head and its pull request's head stay ancestors of the new head. It SHALL never push. A merge it
cannot resolve SHALL be aborted, leaving the branch at its old head, no merge in progress and the
working tree as it was.

#### Scenario: A base that released after the branch forked
- **WHEN** the base bumped a pack and added a changelog entry after the branch forked, and the branch bumped the same pack with its own entry
- **THEN** the command exits 0, the new head is a merge commit whose first parent is the old head and whose second parent is `origin/<base>`, and the working tree has nothing uncommitted

#### Scenario: The release is renumbered above the base's
- **WHEN** the merge is resolved
- **THEN** each pack the branch bumped carries the base's version plus the branch's own bump kind in its manifest and in the marketplace, the branch's changelog entry sits above the base's newest with that number, every CI pin names the resolved devkit-openspec version, and the catalog is regenerated when a manifest changed

#### Scenario: The result goes up with a plain push
- **WHEN** the pull request's head was pushed before the command ran
- **THEN** a plain `git push` of the new head to the same remote is accepted, with no force

#### Scenario: A conflict outside the release files
- **WHEN** the merge conflicts in a file that is not a release file, or in the CI-pin file beyond its pins
- **THEN** the command exits 2 naming the paths, the branch is at its old head, no merge is in progress, and the tracked and untracked files are as they were

#### Scenario: A release file the rule cannot resolve
- **WHEN** a manifest was edited beyond its version, the changelog does not hold exactly one new entry, the catalog conflicts without its generator, the generator fails, or the base has no devkit-openspec version for a conflicting pin
- **THEN** the command exits 2 with the reason, the branch is at its old head and no merge is in progress

#### Scenario: Uncommitted tracked changes or a rebase in progress
- **WHEN** the command starts with a tracked file changed and not committed, or with a rebase in progress
- **THEN** it exits 3 naming the cause, and the branch, the index and the working tree are not touched

#### Scenario: A merge left in progress by an earlier run
- **WHEN** the command starts while a merge is in progress
- **THEN** it aborts that merge and runs again from the branch's head

#### Scenario: The branch already holds the base
- **WHEN** `origin/<base>` is already an ancestor of the branch's head
- **THEN** the command exits 0, says there is nothing to do and makes no commit

### Requirement: A release tag setting that cannot be used stops the command
`/devkit change` SHALL refuse with the settings reply, before anything is created or run, when the
`devkit:` block sets `release_tag` to a value that is not a path from the repository root to a
`.json` file. A project with the key absent or empty SHALL read the same settings as before.

#### Scenario: An absolute path
- **WHEN** `openspec/config.yaml` has `devkit:` with `release_tag: /etc/plugin.json` and the person types `/devkit change add an export`
- **THEN** nothing is created, the command exits 3 and the reply is the unknown-setting reply naming the release file, the value and the accepted form

#### Scenario: A valid path
- **WHEN** `release_tag: plugins/openspec/.claude-plugin/plugin.json` is set
- **THEN** the command runs as before, and the settings it reads name that path

#### Scenario: No key
- **WHEN** the `devkit:` block has no `release_tag`
- **THEN** the settings read are exactly those read before this change

### Requirement: The release tag step is a session step of the delivery
When the delivery checker answers `tag-release`, the loop SHALL give a session step of the delivery
stage whose detail carries the tag, the merge commit sha, the pull request number and the base
branch, done as the shipping skill's row for that step says; on the archive branch it SHALL do so
before ending the run archived.

#### Scenario: After the change's merge
- **WHEN** the change's pull request merged with a release bump and the delivery checker answers `tag-release`
- **THEN** `change-loop.mjs next` gives an action of kind `session`, stage `delivery`, step `tag-release`, with `detail.tag`, `detail.sha`, `detail.number` and `detail.base`, and exits 0

#### Scenario: After the archive merge, on the archive branch
- **WHEN** the change is archived in the worktree of `chore/archive-<id>`, the archive pull request merged with a release bump and its tag is missing
- **THEN** the next action is the same session step, not the archived end

#### Scenario: The same step back with nothing changed
- **WHEN** the step `tag-release` comes back with the same progress key after the session ran it
- **THEN** the run ends blocked as a step that made no progress, as for every session step

### Requirement: A tag at another commit ends the run blocked with its own reason
When the delivery checker stops because the tag already points at another commit, the loop SHALL
end the run blocked with a reason that names the tag, the commit it points at and the merge commit,
in the person's language, and that says the run never moves a tag.

#### Scenario: The tag points elsewhere
- **WHEN** the delivery checker answers `stop-archive` with `archiveStep` `tag-release`, `tag` `v1.3.0`, `at` `d4…` and `sha` `a1…`
- **THEN** the run ends blocked with the reason code `tag-elsewhere`, its reply names `v1.3.0` and the first 7 characters of both shas, and it exits 2

#### Scenario: GitHub could not answer
- **WHEN** the delivery checker answers `stop-archive` with `archiveStep` `tag-release` and no `at`
- **THEN** the run ends blocked with the reason code `archive-failed`, as every other archive stop does

### Requirement: Opening a change records the versions it opened with
Opening a change, through `/devkit change`, `/devkit roadmap` or `/devkit project`, SHALL write to its
`.openspec.yaml` the devkit-openspec version that opened it and the version of its script's installed
flow, under keys that OpenSpec reads without a warning. A script with no installed flow SHALL get no
flow version.

#### Scenario: A change opened on the full or the short script
- **WHEN** a change is opened on `devkit` or on `devkit-lite`
- **THEN** its `.openspec.yaml` holds the version of the pack that opened it and flow version 1, and `openspec status --change <id>` prints no unrecognized-key warning

#### Scenario: A slice opened by the project entry
- **WHEN** a slice is opened with `/devkit project`
- **THEN** its `.openspec.yaml` holds the pack's version and the flow version of `devkit-project`

#### Scenario: A script with no installed flow
- **WHEN** a change is opened on a script whose schema folder holds no `flow.json`
- **THEN** its `.openspec.yaml` holds the pack's version and no flow version

### Requirement: A change moves to the installed flow only on request
A command of the loop SHALL move one change to the installed flow of its script and record the new
flow and pack versions, only when run for that change. Resuming, waiting on GitHub, opening another
change, re-running the setup and updating the pack SHALL leave a change's recorded versions as they
were. When the command cannot run (no active change of that name, no installed flow for the change's
script, a malformed recorded flow version) it SHALL stop with a usage error and write nothing.

#### Scenario: Moving a change
- **WHEN** the owner asks to move a change that follows flow version 1 while version 2 is installed, and the command runs
- **THEN** the change records flow version 2 and the pack's version, the reply says so, and the readout then lists version 2's stages

#### Scenario: Nothing to move
- **WHEN** the command runs for a change that already follows the installed flow version
- **THEN** nothing changes and no reply is given

#### Scenario: A change newer than the installed flow
- **WHEN** the command runs for a change that follows flow version 3 while version 2 is installed
- **THEN** nothing changes, the command exits 2 and the reply says to update devkit first

#### Scenario: The command cannot run
- **WHEN** the command runs for a change that is unknown or archived, for a change whose script has no installed `flow.json`, or for a change whose recorded `x-devkit-flow` is not a whole number from 1
- **THEN** it exits 3, its error names the cause (the change, the script or the recorded value), and the change's `.openspec.yaml`, when there is one, is byte for byte the same

#### Scenario: Other commands leave the version
- **WHEN** a change follows flow version 1, version 2 is installed, and the loop's next step, a wait, the opening of another change, a setup re-run and a pack update run
- **THEN** the change's `.openspec.yaml` is byte for byte the same

### Requirement: A script switch records the installed flow of the new script
Switching a change's script before its proposal exists SHALL record the installed flow version of the
new script and the pack's version, and SHALL keep its other lines. A switch that changes nothing SHALL
write nothing.

#### Scenario: The short script becomes the full one
- **WHEN** a change on `devkit-lite` is switched to `devkit` before any proposal
- **THEN** its `.openspec.yaml` names `devkit`, holds the flow version of the installed `devkit` flow and keeps its `created` line

#### Scenario: A switch to the same script
- **WHEN** a switch names the script the change already uses
- **THEN** its `.openspec.yaml` is byte for byte the same

### Requirement: The resume reply names a newer installed flow
When `/devkit change` resumes a change whose script's installed flow is newer than the one it
follows, the first reply SHALL carry one more line naming both versions and saying the change moves
only if the owner asks, in the person's language. When the versions are equal the reply SHALL be as
before this change.

#### Scenario: Resuming a change with a newer flow installed
- **WHEN** `/devkit change <id>` resumes a change that follows flow version 1 while version 2 is installed, in `en` and in `pt-BR`
- **THEN** the reply says it is continuing the change and where it stopped, then one line naming version 1 and version 2 and that it moves only if the owner asks

#### Scenario: Resuming a change on the installed flow
- **WHEN** `/devkit change <id>` resumes a change that follows the installed flow version
- **THEN** the reply is the continuing reply alone, as before this change

### Requirement: Opening a change claims it on the remote
In a repository with an `origin` remote, opening a change SHALL commit the new change folder, holding
the requirements file and the name of the machine that opened it, and push the new branch to `origin`
before it replies. The push SHALL only create the branch: it never overwrites one. With no `origin`
remote, opening SHALL commit and push nothing, as before.

#### Scenario: The claim is on the remote
- **WHEN** change `a` is opened in a repository with an `origin` remote, with or without the person's machines setting
- **THEN** `origin` has the branch `a`, its last commit holds `openspec/changes/a/requirements.md` and the change's metadata file naming the machine, and the local branch `a` is that same commit

#### Scenario: The machine's name
- **WHEN** a change is opened by `/devkit change`, or by a roadmap run for this machine
- **THEN** the machine named in the claim is this machine's hostname, up to its first dot

#### Scenario: A change opened for another machine
- **WHEN** a roadmap run opens a change for the machine listed as `avel` in the person's machines setting
- **THEN** the claim names `avel`, and no worktree or local branch of the change is left on the machine that opened it

#### Scenario: A machine name or a places value that is not valid
- **WHEN** the opening is given a machine name that is not 1 to 64 letters, digits, dots, underscores or dashes starting with a letter or a digit, a number of places that is not a whole number from 1 to 99 or `run`, or the remote opening without a machine name
- **THEN** the command exits 3 with the reply of a request it could not read, and nothing is created, committed or pushed

#### Scenario: No remote
- **WHEN** a change is opened in a repository with no `origin` remote
- **THEN** no commit is made, nothing is pushed, and the change is created as before

#### Scenario: A push that fails for another reason
- **WHEN** the push of the claim fails because the remote cannot be reached
- **THEN** the command exits 3, and the worktree, its folder and the local branch are removed as for any opening that fails half-way

### Requirement: An id open on another machine is refused
Opening a change whose branch already exists on `origin` with that change's folder SHALL be refused
with a reply naming the change and the machine its claim names, or saying another machine when the
claim names none. Nothing SHALL be created: no worktree, no folder and no local branch.

#### Scenario: Claimed by another machine
- **WHEN** `a` is opened on the Mac while `origin` holds the branch `a` whose claim names `avel`
- **THEN** the command exits 3, the reply names `a` and `avel` and says to continue it there or pick another name, and the Mac has no worktree, folder or branch `a`

#### Scenario: A branch from before the claim
- **WHEN** `a` is opened while `origin` holds the branch `a` with `a`'s folder but no machine's name in it
- **THEN** the command exits 3 and the reply names `a` and says it is open on another machine

### Requirement: Of two machines opening one id, one wins
When two clones of one repository open the same id at once against one `origin`, exactly one SHALL
end with its claim on `origin`. The other SHALL be refused as an id open on another machine, naming
the winner's machine, and SHALL leave no worktree, folder or local branch behind.

#### Scenario: The other clone pushed first
- **WHEN** clone A has checked that `origin` has no branch `a`, and clone B opens `a` and pushes its claim before clone A pushes
- **THEN** clone A's push is refused by the remote, clone A exits 3 naming `a` and B's machine, clone A has no worktree, folder or branch `a`, and `origin`'s branch `a` is B's claim

#### Scenario: Both at the same moment
- **WHEN** clones A and B start opening `a` at the same moment
- **THEN** exactly one of them exits 0, the other exits 3 with the reply of an id open on another machine, and `origin`'s branch `a` is the claim of the one that exited 0

### Requirement: The implementation waits for a free place on its machine
A change whose claim records its machine's places SHALL take a place before its first step from the
implementation on. With no free place on its machine, the loop SHALL end as blocked, waiting for a
place, naming the machine and how many places are taken. The grill and the plan SHALL never wait for
a place. A change whose claim records no places SHALL never wait.

#### Scenario: No free place
- **WHEN** change `c` on `avel`, whose claim records 1 place, has its plan approved while change `b` on `avel` holds that place
- **THEN** `c`'s next action is a blocked end waiting for a place, its reply says `c` waits for a free place on `avel` with 1 of 1 taken, its icon is ⏳, and no implementation step is handed

#### Scenario: A free place
- **WHEN** change `c` on `avel`, whose claim records 2 places, has its plan approved while one place on `avel` is held
- **THEN** `c`'s next action is the step that takes the place; once it ran, `origin`'s branch `c` holds `c`'s approved plan and the next action is the first implementation step

#### Scenario: The grill and the plan
- **WHEN** change `c` on a machine whose every place is held is at its grill or its plan
- **THEN** its next action is that stage, as for any change

#### Scenario: A change that records no places
- **WHEN** a change opened by `/devkit change`, or with the person's machines setting unset, reaches its implementation
- **THEN** its implementation starts as before, with no place taken or checked

#### Scenario: A place already taken
- **WHEN** change `c` took its place and comes back to an implementation step after its review
- **THEN** no place is checked again and the step is handed

### Requirement: Taking a place is checked again and serialized per machine
The step that takes a place SHALL count the places held on its machine from `origin` again, under a
lock shared by every checkout of the clone, and take the place only when one is free. A place SHALL be
held by a change whose branch on `origin` names that machine and holds its approved plan, until the
change is archived on the default branch or its branch leaves `origin`.

#### Scenario: Two changes of one machine at once
- **WHEN** changes `c` and `d` on `avel`, whose claims record 1 place, run the step that takes a place at the same moment with no place held
- **THEN** exactly one of them takes the place, and the other's next action is the blocked end waiting for a place

#### Scenario: A message that comes too early
- **WHEN** change `c` is told a place is free but every place on its machine is held when it runs its next action
- **THEN** its next action is the blocked end waiting for a place, and no implementation step is handed

#### Scenario: A change archived frees its place
- **WHEN** change `b`, holding `avel`'s only place, is archived on the default branch
- **THEN** a change of `avel` waiting for a place finds the place free at its next action

### Requirement: Every grill asks the triage agent first
In every grill whose flow lists the triage agent, of a lone `/devkit change` or of a roadmap run,
the questions SHALL first go to the triage agent,
which reads the project's files and answers each one they settle, naming its source. Only the
questions nothing written settles SHALL be asked of the owner. Each triage answer SHALL be recorded
in `requirements.md` under its own heading, apart from the owner's answers, and shown in the grill's
summary so the owner can correct it.

#### Scenario: A question an ADR answers
- **WHEN** a grill question asks whether the change may use a cron, and an ADR of the project decides it
- **THEN** the owner is not asked, and `requirements.md` records the answer as answered by triage with the ADR's path as its source

#### Scenario: A question nothing written settles
- **WHEN** a grill question asks what the owner wants to see when a change is done, and no file says it
- **THEN** the question is asked of the owner, one at a time

#### Scenario: The summary
- **WHEN** the grill ends
- **THEN** its summary lists the answers by triage apart from the owner's, each with its source

### Requirement: The triage ships as flow version 2
The triage agent SHALL be a helper of the requirements stage from version 2 of the `devkit` and
`devkit-lite` flows on; version 1 SHALL stay as it was released, and the `devkit-project` flow SHALL
stay at version 1. A change that follows version 1 (recorded, or no recorded flow) SHALL keep its
flow's grill: the triage SHALL NOT be offered, and every question SHALL be asked of the owner, until
the owner moves the change to the installed flow.

#### Scenario: A change opened on flow 2
- **WHEN** a `devkit` or `devkit-lite` change is opened with this release's schemas installed
- **THEN** its `.openspec.yaml` records `x-devkit-flow: 2`, and its grill hands the drafted questions to the triage agent first

#### Scenario: A project slice
- **WHEN** a `devkit-project` slice is opened with this release's schemas installed
- **THEN** its `.openspec.yaml` records `x-devkit-flow: 1`

#### Scenario: A change on flow 1 keeps its flow's grill
- **WHEN** the grill of a change whose `.openspec.yaml` records `x-devkit-flow: 1`, or no flow version, is asked with flow 2 installed
- **THEN** the grill action names no triage helper, the triage agent is not handed the questions, every question is asked of the owner, and the hand-off of `devkit-core:requirements-triage` for that change is refused as a role its flow does not list

#### Scenario: A change moved to flow 2
- **WHEN** the owner asks to move a change on flow 1 to the installed flow before its grill
- **THEN** its `.openspec.yaml` records `x-devkit-flow: 2`, and its grill hands the questions to the triage agent first

### Requirement: A triage answer always names its source
The triage agent SHALL write no file. A triage answer that names no source SHALL send the change back
to its grill, so the question reaches the owner. Neither the triage agent nor the session SHALL
write a plan approval or a retro answer from a triage answer.

#### Scenario: An answer with no source
- **WHEN** the requirements stage passed and a line under the triage heading of `requirements.md` names no source
- **THEN** the change's next action is its grill, naming that question

#### Scenario: The triage agent's tools
- **WHEN** the triage agent is defined
- **THEN** it has no tool that writes or runs commands, and the approval record refuses its write as it refuses every subagent's

#### Scenario: The heading's end
- **WHEN** the triage heading is the last one of the file, or a fenced block under it holds a numbered line
- **THEN** the lines up to the next heading of the same or a higher level, or to the end of the file, are read, and a line inside a fenced block is not an answer

### Requirement: A requirement a merged change contradicts reopens the grill
When the plan is written and code merged since the grill contradicts what a requirement says, the
planner SHALL write no plan file, add the question to `requirements.md` and set its header back to
pending, so the grill asks the owner again. Any other drift (an ADR number, a release version, a
moved file) SHALL be resolved in the plan without asking the owner.

#### Scenario: A contradicted requirement
- **WHEN** a requirement names a field that a change merged after the grill removed
- **THEN** the requirements file is pending again with the question added, no proposal is written, and the next action is the grill

#### Scenario: An ADR number taken
- **WHEN** the next free ADR number moved because a sibling merged first
- **THEN** the plan takes the next free number, and the owner is not asked

### Requirement: A lone change schedules nothing
A `/devkit change` run SHALL create no schedule and no wake-up: no action of the change loop asks for
one, and the parts of the devkit skill that run one change name no scheduling tool.

#### Scenario: Every action of a change run
- **WHEN** a `/devkit change` run goes from its grill to its archive
- **THEN** no action asks for a schedule, and no periodic check exists in the session

### Requirement: A boarded change ends its run waiting for the train
In a train project, when the delivery checker reports a change or its archive as boarded, the loop
SHALL end the run waiting for the owner with a reply that says the change is boarded and that
`/devkit train` departs the train, and SHALL hand no stage.

#### Scenario: Boarded at the end of its review
- **WHEN** `alpha`'s review round approves at its head and every other boarding item holds
- **THEN** `change-loop.mjs next --change alpha` exits 1 with an end waiting for the owner whose reply names `/devkit train`

### Requirement: A change on an open train waits on GitHub
When an open train's record lists a change or an archive at its current head, the loop SHALL end the
run waiting on GitHub, naming the train's pull request, SHALL never report that change or archive as
boarded while the train is open, and the background wait SHALL end when that pull request is merged or
closed.

#### Scenario: Riding train 4
- **WHEN** `alpha` is listed in the record of the open pull request of `train/4` at its head
- **THEN** `change-loop.mjs next --change alpha` exits 1 with an end waiting on GitHub naming that pull request

#### Scenario: An archive riding train 4
- **WHEN** the record at the head of the open pull request of `train/4` lists the archive of `gamma` at the head of `gamma`'s archive pull request
- **THEN** `change-loop.mjs next --change gamma` exits 1 with an end waiting on GitHub naming the pull request of `train/4`, and the archive is not reported as boarded

#### Scenario: The train merges
- **WHEN** the pull request of `train/4` merges while the wait for `alpha` runs
- **THEN** the wait ends and the next action is `alpha`'s retro

### Requirement: The setting errors of the train are replies of the command
Every verb that runs (`/devkit change`, `/devkit roadmap`, `/devkit status`, `/devkit project` and
`/devkit train`) SHALL refuse to run, creating nothing, when the train setting is refused, as each does
for a refused delivery model, with a reply in the person's language that names the setting and the
reason, from the message table.

#### Scenario: The train with two pull requests, in Portuguese
- **WHEN** the person's language is `pt-BR` and the block holds `model: two-prs` and a train value
- **THEN** the reply is the table's Portuguese text saying the train runs only with `trunk` or `trunk-auto`, and nothing is created

#### Scenario: The status verb with a refused train
- **WHEN** the block holds `train: "npm test"` and no `model`, and the person types `/devkit status`
- **THEN** the reply says the train needs the model `trunk` or `trunk-auto`, and nothing is created or run

### Requirement: On the CompozyOS driver the command starts a run and says where to follow it
With the `compozy` driver, `/devkit change <request>` and `/devkit change <id>` SHALL start one
CompozyOS run of the change, or find the one already running, and SHALL reply in one message with
where to follow it; the session SHALL ask none of the change's questions, and every later question
SHALL reach the owner in CompozyOS.

#### Scenario: A new request
- **WHEN** the owner types `/devkit change add a CSV export` in a project on the CompozyOS driver
- **THEN** the session names the change, starts its CompozyOS run with the request, replies with where to follow it, and ends its turn without asking a question

#### Scenario: A change that already runs
- **WHEN** the owner types `/devkit change add-csv-export` while a CompozyOS run of that change is under way
- **THEN** no second run is started and the reply says the change already runs and where to follow it

#### Scenario: A change whose run ended
- **WHEN** the owner types `/devkit change add-csv-export` and no run of that change is under way
- **THEN** a new run is started and it goes on from the change's files

#### Scenario: A name already taken
- **WHEN** the proposed name of a new request is taken by a change, a branch or a worktree
- **THEN** no run is started and the reply is the one the Claude driver gives for a taken name

### Requirement: On the CompozyOS driver the command starts nothing it cannot start
With the `compozy` driver, `/devkit change` SHALL start no run and create nothing when the name is
not a valid change name, when a new name comes with no request, or when the Claude driver would
refuse the project.

#### Scenario: An invalid name
- **WHEN** the run is asked for the name `Add_CSV`, which is not a valid change name
- **THEN** no run is started, nothing is created, and the reply is the one the Claude driver gives for an invalid name

#### Scenario: A new name with no request
- **WHEN** the run is asked for a name no checkout knows and the request is empty
- **THEN** no run is started, nothing is created, and the command fails saying the request is missing

#### Scenario: A project not set up
- **WHEN** the project's settings name the `compozy` driver but the project has not been set up for devkit
- **THEN** no run is started, nothing is created, and the reply is the one the Claude driver gives for a project not set up

### Requirement: The CompozyOS driver says when CompozyOS cannot run
With the `compozy` driver, `/devkit change` SHALL run nothing and reply in one plain sentence, with
the command that fixes it, when CompozyOS is not installed, its daemon is not running, it does not
know the project as a workspace, or the project has not installed the kit's loops.

#### Scenario: CompozyOS not installed
- **WHEN** the `compozy` command is not found
- **THEN** the reply says CompozyOS is not installed and names the command that installs it, and nothing is created or run

#### Scenario: The daemon stopped
- **WHEN** the CompozyOS daemon does not answer
- **THEN** the reply says CompozyOS is not running and names `compozy daemon start`, and nothing is created or run

#### Scenario: An unknown workspace
- **WHEN** CompozyOS runs but does not know the project's folder
- **THEN** the reply names the command that adds the folder as a workspace, and nothing is created or run

#### Scenario: The kit not installed
- **WHEN** CompozyOS knows the project but has no change loop for it
- **THEN** the reply says the CompozyOS kit is not installed in the project and how to install it, and nothing is created or run

### Requirement: A merge of the base is checked before the evidence
On a flow with an evidence stage, while the branch's newest merge not on `origin/<base>` has no
green check, the loop SHALL give the evidence stage's session step `merge-check`, running `openspec
validate <id> --type change --strict` and recording the result for that merge, before any step that
verifies, reviews, pushes or waits on the pull request; the hand-off of those steps to their roles,
the waits and the owner gates apply once that merge is green or there is no merge.

#### Scenario: A merge with no check yet
- **WHEN** the branch's newest merge commit not on `origin/<base>` has no recorded check and the delivery checker's step is `verify`
- **THEN** `change-loop.mjs next` gives an action of kind `session`, stage `evidence`, step `merge-check`, whose `detail.command` is the loop's `merge-check` command for the change and whose `detail.merge` is that merge commit's sha, and exits 0

#### Scenario: The evidence is current but the merge is not checked
- **WHEN** the same merge has no recorded check and the delivery checker's step is `review`, `push`, `open-pr`, `update-branch`, `wait-checks`, `ready` or `ready-base`
- **THEN** the next action is the same `merge-check` step

#### Scenario: Steps the check does not hold back
- **WHEN** the merge has no recorded check and the step is one of the implementation's steps, `commit`, `disable-auto-merge`, a blocked end, or any step on the archive branch
- **THEN** the next action is the one the loop gave before this requirement

#### Scenario: No merge to check
- **WHEN** no merge commit is on the branch's first-parent line outside `origin/<base>`, or `origin/<base>` does not resolve
- **THEN** the next action is the one the loop gave before this requirement and nothing runs `openspec validate`

#### Scenario: The command with no merge
- **WHEN** the session runs `change-loop.mjs merge-check <id>` on a branch with no merge commit outside `origin/<base>`
- **THEN** the command prints its JSON answer with `"result": "none"`, writes no record, runs no `openspec validate` and exits 0

#### Scenario: The command on an unknown change
- **WHEN** `change-loop.mjs merge-check` is given an id that names no change of the project, or no id
- **THEN** the command exits 3 with the error and writes no record

#### Scenario: A script without an evidence stage
- **WHEN** the change follows a flow with no `evidence` stage
- **THEN** no action is `merge-check`

### Requirement: A green check lets the delivery go on once per merge
When the command's validation exits 0 with the change reported valid, it SHALL record a green check
for that merge, and the loop SHALL then give the step it would have given without the check, and
SHALL not give `merge-check` again until a newer merge commit is on the branch.

#### Scenario: Green, then the evidence
- **WHEN** the session runs the `merge-check` step's command and `openspec validate <id> --type change --strict` passes
- **THEN** the command records green for that merge, and the next call of `next` hands `verify` to the verifier's agent

#### Scenario: The same merge is not checked twice
- **WHEN** a green check is recorded for the newest merge and `next` is called again, with or without later commits that are not merges
- **THEN** no action is `merge-check` and the command is not run

#### Scenario: A newer merge is checked again
- **WHEN** a green check is recorded for one merge and the branch then takes another merge of the base
- **THEN** the next action is `merge-check` with the newer merge's sha

#### Scenario: A damaged or foreign record is no record
- **WHEN** the merge-check record of the change is missing, empty, truncated, not JSON, of another change, of another record version, or holds a result that is not green, red or cannot-run
- **THEN** the loop reads it as no record, the next action is `merge-check` for the newest merge, and the record is never read as green

### Requirement: A red check goes to the planner as a merge defect
When the validation reports the change invalid, the command SHALL record a red check with
validate's errors for that merge, and the loop SHALL hand the planner's agent a brief that names a
merge defect, quotes the errors and asks for a fix of the plan files only, leaving every stage
header and task checkbox as it is. No stage header SHALL change because of the check or the hand-off.

#### Scenario: Red, then the planner
- **WHEN** the session runs the `merge-check` step's command and `openspec validate <id> --type change --strict` reports the change invalid
- **THEN** the next call of `next` gives an action of kind `agent` for `devkit-core:change-planner`, step `merge-defect`, whose brief holds the words `merge defect` and validate's error messages, and the `attempt=` of every stage header in the change folder is what it was before the command ran

#### Scenario: A dropped scenario of the base
- **WHEN** the base added a scenario to a requirement that the change's delta modifies, the merge changed no file of the change, and the command runs
- **THEN** the check is red and its recorded errors, and the planner's brief, name that requirement

#### Scenario: The planner's fix is checked again
- **WHEN** a red check is recorded and the worktree has changed since the command ran
- **THEN** the next action is `merge-check` again for the same merge

#### Scenario: A planner that changed nothing
- **WHEN** the planner's hand-off comes back with the same progress key because nothing changed
- **THEN** the run ends blocked as a stage that made no progress, as for every hand-off

### Requirement: Three red checks in a row on one merge end the run blocked
The loop SHALL end the run blocked, with the reason code `merge-defect` and a reply that names the
merge and the number of red checks, once the red checks recorded in a row for the same merge reach
the flow's default attempt ceiling, instead of handing the planner again. No stage's attempt or
ceiling SHALL be read or changed for it.

#### Scenario: The third red check
- **WHEN** the third red check in a row is recorded for the same merge, with the flow's `ceilings.default` at 3
- **THEN** `next` ends the run blocked with the reason code `merge-defect`, its reply names the first 7 characters of the merge's sha and the number 3, it exits 2, and the evidence stage's header is unchanged

#### Scenario: A green check resets the count
- **WHEN** a red check is followed by a green check for the same merge
- **THEN** a later merge starts its count at one

### Requirement: A check that cannot run ends the run blocked
When `openspec` is missing, times out, is refused by the project's version pin, or answers anything
but a validation result for the change, the command SHALL record that the check could not run, with
the cause, and SHALL never record green; right after the session ran the step, the loop SHALL end the
run blocked with the reason code `merge-check-failed`, naming the cause.

#### Scenario: No openspec on the path
- **WHEN** the `merge-check` step's command runs with no `openspec` program on its `PATH`, and then `next` runs with the CLI available and that step's progress key
- **THEN** `next` ends the run blocked with the reason code `merge-check-failed`, its reply names the openspec command, it exits 2, and no green check is recorded

#### Scenario: The other causes of a check that cannot run
- **WHEN** the step's command finds `openspec validate` timing out, refused by the project's version pin, answering no validation result for the change, or reporting the change valid with a non-zero exit
- **THEN** the command records `cannot-run` with that cause and keeps the count of red checks already recorded for that merge, records no green check, and `next` with that step's progress key ends the run blocked with the reason code `merge-check-failed`

#### Scenario: Called again after the cause is fixed
- **WHEN** a check that could not run is recorded and `next` is called without that step's progress key
- **THEN** the next action is the `merge-check` step again

### Requirement: A merge-defect fix follows the rule of every plan edit
The planner's fix of a merge defect SHALL leave `readiness.md`, `approval.md` and the plan stages in
the state the flow gives any other edit of the plan files once the implementation has started; the
loop SHALL add no exception to the plan gate for it.

#### Scenario: The same answer as an ordinary plan edit
- **WHEN** a change with a ticked task, an approved readiness and a current owner approval has its spec delta edited as a merge-defect fix, and the same change has its design edited instead
- **THEN** the stage checker gives the same states for readiness and approval in both cases, the approval stays current in both, and neither asks for a new review or a new approval
