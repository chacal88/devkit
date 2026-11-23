<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: In a CompozyOS session no tool writes the plan approval
In a session CompozyOS started for an agent, a write of any change's `approval.md` by an edit tool
or a shell command SHALL be refused, whether or not a subagent acts, with a reason saying that on the
CompozyOS driver the kit's record step writes it from the owner's answer. Outside CompozyOS the rule
of the Claude driver SHALL hold unchanged.

#### Scenario: A CompozyOS agent session writes the approval
- **WHEN** a session started by CompozyOS, with no subagent acting, writes `openspec/changes/feat/approval.md` with the edit tool or through a shell redirect
- **THEN** the write is refused and the reason names the kit's record step

#### Scenario: A subagent inside a CompozyOS session
- **WHEN** a subagent of a session started by CompozyOS writes that file
- **THEN** the write is refused, as it is for any subagent

#### Scenario: The owner's session in Claude Code
- **WHEN** a Claude Code session that CompozyOS did not start writes that file from the owner's message
- **THEN** the write is allowed, as before

#### Scenario: The kit's record step
- **WHEN** the kit's record step writes `approval.md` from the owner's answer
- **THEN** the file is written, because the step is a script the hooks do not judge
