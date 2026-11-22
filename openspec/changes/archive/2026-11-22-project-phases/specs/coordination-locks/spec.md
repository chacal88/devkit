<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: A project run holds no lock of a change run
A typed `/devkit project` (bare or plugin-scoped, with any argument) SHALL end a change run and a
roadmap run for every lock of this capability, and no lock of this capability SHALL refuse anything
while the newest typed slash command is `/devkit project`: the session writes the phase documents
itself.

#### Scenario: The session writes a phase document
- **WHEN** the newest typed slash command is `/devkit project billing` and the session writes `docs/design/billing/1-business-vision.md`
- **THEN** no lock of this capability refuses the write

#### Scenario: A change run followed by the project command
- **WHEN** `/devkit change` ran with a `devkit-run: <id>` line and `/devkit project billing` was typed after it
- **THEN** the session is in no change run, its stop is not refused for that change, and a hand-off to any agent is not refused by the hand-off lock

#### Scenario: A roadmap run followed by the project command
- **WHEN** a roadmap run printed `devkit-roadmap: 2` and `/devkit project billing` was typed after it
- **THEN** the session is in no roadmap run
