<!-- devkit-stage specs result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A run is known from the session's own record
A session SHALL be in a run of a change when the newest slash command typed in it is `/devkit change`
(bare or plugin-scoped) and a line `devkit-run: <id>` printed by the loop follows it; the change of
the run SHALL be the newest such id. The task another session started this session with, in the
host's form of a started session, SHALL count as a command typed in it, whatever lines follow its
first line and whatever notes of the host come before that form. The run's last recorded action SHALL
be an end while the newest `devkit-run:` or
`devkit-end:` line after that command is an end line that names the run's change; an end line that
names another change SHALL be read as if it were absent. Nothing else SHALL be remembered.

#### Scenario: No run
- **WHEN** the session's record holds no typed `/devkit change`, or holds one with no `devkit-run:` line after it
- **THEN** the session is in no run and no lock of this capability refuses anything

#### Scenario: Another command typed after the run
- **WHEN** a slash command other than `/devkit` was typed after the newest `/devkit change`
- **THEN** the session is in no run

#### Scenario: The run's change
- **WHEN** two `devkit-run:` lines follow the newest `/devkit change`
- **THEN** the run's change is the id of the later line

#### Scenario: The run's last recorded action is an end
- **WHEN** the newest line after the newest `/devkit change` is `devkit-end: <id> blocked`, printed after the `devkit-run: <id>` line of the same output or by the session's own declaration of an end
- **THEN** the session is still in a run of that change, and its last recorded action is an end

#### Scenario: A new action after an end
- **WHEN** a `devkit-run:` line follows the newest `devkit-end:` line
- **THEN** the run's last recorded action is not an end

#### Scenario: The other locks after an end
- **WHEN** the run's last recorded action is an end and the session edits `src/a.ts` of a short-script change or hands work to a general-purpose agent
- **THEN** the edit and the hand-off are refused as in any run: only the stop lock reads the end

#### Scenario: A session started by another session
- **WHEN** a session's first message is the host's form of a session started by another session, with a background block and then the task `/devkit-openspec:devkit change a`, and a `devkit-run: a` line follows it
- **THEN** the session is in a run of `a`, and its product edits and its hand-offs follow the rules of a change run

#### Scenario: A started task with a start line
- **WHEN** the task is `/devkit-openspec:devkit change a` followed by the line `devkit-start: a <ticket>`, and a `devkit-run: a` line follows the message
- **THEN** the session is in a run of `a`

#### Scenario: A started task after a note of the host
- **WHEN** the session's first message begins with a note of the host (a `<system-reminder>` block), then the started form with the task `/devkit-openspec:devkit change a`, and a `devkit-run: a` line follows the message
- **THEN** the session is in a run of `a`

#### Scenario: Words before the started form
- **WHEN** the session's first message begins with any other line before the started form
- **THEN** that message is not read as the started form

#### Scenario: A command named inside a message
- **WHEN** a message the owner typed holds `/devkit change a` on a line other than its first, and is not the host's form of a started session
- **THEN** that message is not a typed command

#### Scenario: The periodic check's prompt
- **WHEN** the periodic check of a roadmap run fires in the coordinating session with its prompt
- **THEN** the prompt is no typed command, and the roadmap run goes on

#### Scenario: An end naming another change
- **WHEN** the run's change is `feat`, the newest line after the newest `/devkit change` is `devkit-end: other blocked` after the newest `devkit-run: feat`, and a stage of `feat` is ready
- **THEN** the run's last recorded action is not an end, and the stop is refused once, naming that stage

#### Scenario: An end naming the run's change
- **WHEN** the run's change is `feat`, its record ends with `devkit-end: feat waiting-for-owner` after the newest `devkit-run: feat`, and a stage of `feat` is ready
- **THEN** the run's last recorded action is an end, and the stop is allowed at the first attempt

#### Scenario: The owner's pause declared
- **WHEN** the session ended its turn after `change-loop.mjs reply waiting-pause --param id=feat` printed `devkit-end: feat waiting-for-owner`, while a stage of `feat` is ready
- **THEN** the stop is allowed at the first attempt

#### Scenario: A decision outside the gates declared
- **WHEN** the session ended its turn after `change-loop.mjs reply waiting-owner-decision --param id=feat --param decision="the dependency upgrade"` printed `devkit-end: feat waiting-for-owner`, while a stage of `feat` is ready
- **THEN** the stop is allowed at the first attempt

#### Scenario: The same turn without the declared end
- **WHEN** the session tries to stop with neither declared end in its record and a stage of `feat` ready
- **THEN** the stop is refused once, naming that stage
