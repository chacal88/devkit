<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The project command opens a slice
`/devkit project <slice>`, in a project set up for devkit with the `claude` driver, SHALL create a git
worktree and a branch named after the slice from the default branch and an OpenSpec change of that
name on the `devkit-project` schema, reply with the slice and what comes next, and start the first
stage's conversation in the same session.

#### Scenario: A new slice
- **WHEN** `/devkit project billing` is typed and no change, slice, branch or worktree is named `billing`
- **THEN** a worktree on branch `billing` holds `openspec/changes/billing/` whose `.openspec.yaml` names `devkit-project`, the reply names the slice and the business stage, and the session asks the business phase's first question

#### Scenario: A name that cannot be used
- **WHEN** the name is not 2 to 48 lowercase letters and digits in words joined by single dashes, or a change, a branch or a worktree already has that name
- **THEN** the reply says why in one plain sentence and nothing is created

#### Scenario: A slice folder already on the default branch
- **WHEN** `docs/design/billing/` exists on the default branch
- **THEN** the reply says the slice's folder already exists and to choose another name, and nothing is created

#### Scenario: A name already delivered
- **WHEN** `/devkit project billing` is typed and the slice `billing` is already delivered on the default branch
- **THEN** the reply says the slice is already delivered and to choose another name, and nothing is created

#### Scenario: The design pack is not enabled
- **WHEN** the project's `.claude/settings.json` (and `.claude/settings.local.json`) does not enable `devkit-design@devkit`
- **THEN** the reply names the pack and the setup step that enables it, and nothing is created

#### Scenario: A project not set up for devkit
- **WHEN** the project's schema is not `devkit` or `devkit-lite`, a setting is unknown, or the driver is `script`
- **THEN** the reply is the one `/devkit change` gives in that project, and nothing is created

#### Scenario: The CompozyOS driver
- **WHEN** `devkit.driver` is `compozy` and `/devkit project billing` is typed
- **THEN** the reply says in one plain sentence that `/devkit project` does not run on CompozyOS yet, and nothing is created or run
