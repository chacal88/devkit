<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

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
