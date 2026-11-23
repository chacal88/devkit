# commit-attribution Specification

## Purpose
Says which attribution lines a commit and a pull request made for a change carry: those of the
session that conducts the change, asked for by the loops, passed by the session to the commit agent,
and written by the commit agent over the lines of its own environment.

## Requirements

### Requirement: A hand-off to the commit agent asks the session for its attribution lines
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

#### Scenario: A branch the loop's own rebase rewrote
- **WHEN** the change loop's next action hands the step `push-rebased` to the commit agent
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
- **WHEN** the shipping skill's rows `commit`, `open-pr`, `push` and `open-archive-pr`, and the devkit skill's `agent` items and `push-rebased` item, are read
- **THEN** each of them says to append the attribution block when it hands work to the commit agent

### Requirement: The commit agent writes the caller's attribution lines over its own
The commit agent SHALL take the attribution lines of its commits and pull requests from the caller's
attribution block over the lines its own environment gives it. Without a block it SHALL keep its
earlier behaviour: the lines the environment or the user requires, and none of its own.

#### Scenario: The caller gives lines
- **WHEN** the caller's block holds commit-trailer lines and pull-request-footer lines
- **THEN** the commit message ends with exactly the commit-trailer lines, in order, with no other `Co-Authored-By` line or attribution trailer, and the pull-request description ends with exactly the footer lines, with no other footer

#### Scenario: The caller gives no footer line
- **WHEN** the caller's block holds commit-trailer lines and no pull-request-footer line
- **THEN** the pull request the agent opens has no attribution footer

#### Scenario: The caller says none
- **WHEN** the caller's block is `Attribution (from the caller): none`
- **THEN** the commit message has no `Co-Authored-By` line and no attribution trailer, and the pull-request description has no attribution footer

#### Scenario: An older caller gives no block
- **WHEN** the prompt holds no attribution block
- **THEN** the agent adds the attribution lines its environment or the user requires, and none of its own

#### Scenario: A real commit in a scratch project
- **WHEN** the commit agent, run on its own model, makes a commit-only call in a scratch git project whose prompt carries the block with `Commit trailer: Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- **THEN** `git log -1 --format='%(trailers)'` shows exactly that line and no line naming the agent's own model
