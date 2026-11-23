<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A change session shows the stage its change is in
A change session SHALL be titled with its change's stage icon (❓ requirements, 📝 plan, 🛠️ code, 🔍
review, 🚀 delivery, 📦 archive) and the change id while the change runs; while it is stopped, with
the state icon (🙋 waiting for the owner, ⏳ waiting on GitHub, ⛔ blocked), a space, then that
title; `📦 <id>` once archived; cut to 59 code points. When the title changes, the session SHALL
rename itself before it goes on.

#### Scenario: The icon of each stage
- **WHEN** a change is in its grill, its proposal, its implementation, its code review, its delivery or its retro and archive
- **THEN** the icon reported for it is ❓, 📝, 🛠️, 🔍, 🚀 or 📦 in that order

#### Scenario: A new stage
- **WHEN** the change session's change goes from its plan approval to its implementation
- **THEN** the session's title goes from `🙋 📝 <id>` to `🛠️ <id>`

#### Scenario: A stage of the same icon
- **WHEN** the change goes from its proposal to its design
- **THEN** the title is not renamed

#### Scenario: The first title
- **WHEN** the coordinating session starts the session of a change that is at its grill
- **THEN** the session starts titled `🙋 ❓ <id>`

#### Scenario: A change under way
- **WHEN** the change's implementation is handed to its agent
- **THEN** the title is `🛠️ <id>`, with no state icon

#### Scenario: Waiting on GitHub
- **WHEN** the change waits on its pull request's checks, or GitHub did not answer
- **THEN** the title is `⏳ 🚀 <id>`

#### Scenario: Blocked
- **WHEN** the change stops blocked in its implementation, or blocked with no stage, as a change begun under the previous script
- **THEN** the title is `⛔ 🛠️ <id>`, or `⛔ <id>`

#### Scenario: Archived
- **WHEN** the change is archived
- **THEN** the title is `📦 <id>`, with no second icon

#### Scenario: A long id
- **WHEN** the change id has 70 characters, in any of the forms above
- **THEN** the title is cut to its first 59 code points

## ADDED Requirements

### Requirement: The board places each open change by its state
`/devkit status` SHALL place the row of each open change by the change's state as the state command
gives it: `waiting-for-owner` in the block of changes waiting for the owner, `blocked` in the blocked
block, `running` and `waiting-on-github` under way. Its blocks, its counts and the words of every row
SHALL stay as they are.

#### Scenario: One change in each state
- **WHEN** a run holds one change at the plan approval, one handed to its agent, one waiting on GitHub's checks, one blocked by red tests and one archived
- **THEN** the board lists the first under "Waiting for you", the second and third under "Under way", the fourth under "Blocked", and the archived one in no block

#### Scenario: A change with no session of its own
- **WHEN** in a run with a session per change an open roadmap change has no session
- **THEN** its row is under "Under way" and says it starts in a session of its own at the owner's next message

#### Scenario: GitHub does not answer
- **WHEN** an open roadmap change waits on GitHub because GitHub did not answer
- **THEN** its row is under "Under way" and says it is waiting on GitHub, which did not answer

#### Scenario: The board and the command agree
- **WHEN** `/devkit status` and the state command run on the same project and run file
- **THEN** every open roadmap change's block on the board is the block of its state in the command's output
