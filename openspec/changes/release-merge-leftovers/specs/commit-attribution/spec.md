<!-- devkit-stage specs result=passed attempt=1 commit=8432791edc714cfd226a61a0fab66ee1afe3ccd0 -->
# Spec Delta

## REMOVED Requirements

### Requirement: A hand-off to the commit agent asks the session for its attribution lines
**Reason**: Its scenario "A branch the loop's own rebase rewrote" hands the `push-rebased` step to the commit agent, a step no checker has returned since devkit-openspec 0.29.0. A MODIFIED block cannot drop a scenario the current spec has, so the requirement is removed and added again, under the header below, without that scenario.
**Migration**: None. The requirement "Every hand-off to the commit agent asks the session for its attribution lines" holds the same text and every other scenario, unchanged.

## MODIFIED Requirements

### Requirement: The session appends its own attribution lines to the commit agent's prompt
When the session hands work to the commit agent, it SHALL end the prompt with the attribution block,
after the brief and the shipping skill's sentence for that step: a header line, one commit-trailer
line per line the session ends its own commit messages with, one pull-request-footer line per line
it ends its own pull-request descriptions with, each verbatim, and a closing line saying that the
caller's lines win over the agent's own environment.

#### Scenario: The session has attribution lines
- **WHEN** the session would end its own commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and its pull-request descriptions with a footer line
- **THEN** the block holds `Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `PR footer: ` followed by that footer line, each once, and the closing line

#### Scenario: The session has none
- **WHEN** the session would end its own commit messages and pull-request descriptions with no attribution line
- **THEN** the block is the line `Attribution (from the caller): none` followed by the closing line

#### Scenario: Every dispatch of the commit agent names the block
- **WHEN** the shipping skill's rows `commit`, `open-pr`, `push` and `open-archive-pr`, and the devkit skill's `agent` items, are read
- **THEN** each of them says to append the attribution block when it hands work to the commit agent

## ADDED Requirements

### Requirement: Every hand-off to the commit agent asks the session for its attribution lines
Every action of the change loop and of the project loop that hands work to the commit agent SHALL end
its brief with one fixed request: the session handing it off appends below the brief, verbatim, the
lines it ends its own commit messages and pull-request descriptions with, as an attribution block, or
a block saying it has none. The request SHALL name no attribution line itself, and no hand-off to
another agent SHALL carry it.

#### Scenario: A commit before the review
- **WHEN** the change loop's next action hands the step `commit` to the commit agent
- **THEN** the action's brief ends with the attribution request, after the sentence naming the files' language

#### Scenario: Opening or updating the change's pull request
- **WHEN** the change loop's next action hands the step `open-pr` or `push` to the commit agent
- **THEN** the action's brief ends with the attribution request

#### Scenario: The archive pull request
- **WHEN** the change loop's next action hands the step `open-archive-pr` to the commit agent
- **THEN** the action's brief ends with the attribution request

#### Scenario: A slice's commit
- **WHEN** the project loop hands a slice's uncommitted files to the commit agent, before the review or after the archive in `plan` ship mode
- **THEN** the action's brief ends with the attribution request, after the sentence naming the files the commit may hold

#### Scenario: A slice's pull request
- **WHEN** the project loop hands the step `open-pr` or `push` of a slice to the commit agent
- **THEN** the action's brief ends with the attribution request

#### Scenario: A roadmap run
- **WHEN** a roadmap run hands a change's commit step to the commit agent
- **THEN** the brief it hands is the change loop's brief unchanged, attribution request included

#### Scenario: A hand-off to another agent
- **WHEN** the next action hands a stage or a step to the planner, the readiness reviewer, the implementer, the verifier or the ADR reviewer
- **THEN** its brief holds no attribution request and still ends with the loop's own last sentence

#### Scenario: The request follows the agent the action names
- **WHEN** the delivery checker's row for a commit step names an agent other than the commit agent
- **THEN** the action hands the step to that agent and its brief holds no attribution request

#### Scenario: The request names no line of its own
- **WHEN** the attribution request is read
- **THEN** it names the block's header, its two kinds of line and the word `none`, and holds no model name, no e-mail address and no footer text
