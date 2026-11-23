<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## ADDED Requirements

### Requirement: The setup asks for the project's test commands
When `openspec-setup` installs or upgrades the flow, it SHALL propose, from the repository, the
values of `devkit.tests.unit`, `devkit.tests.coverage.command` and `devkit.tests.e2e`, ask the owner
for `devkit.tests.coverage.target`, write only the values the owner confirmed into the `devkit:`
block of `openspec/config.yaml`, and keep any value the block already holds. The starting
`openspec/config.yaml` SHALL show the four keys as a commented example.

#### Scenario: A project with a unit suite and no E2E
- **WHEN** the setup runs in a project whose `package.json` has a `test` script and no E2E tool, and the owner confirms `npm test` and gives no target
- **THEN** the block gains `tests:` with `unit: "npm test"` only, and the E2E and unit stages of a change follow that block

#### Scenario: An upgrade keeps what the project set
- **WHEN** the setup runs again in a project whose block already holds `tests.unit` and `tests.coverage.target: 85`
- **THEN** both values are kept as they are and no question is asked about them

#### Scenario: The starting configuration
- **WHEN** a project has no `openspec/config.yaml` and the setup writes it from its template
- **THEN** the file shows `unit`, `coverage.command`, `coverage.target` and `e2e` under `devkit.tests` as commented lines, with one line saying that a stage whose command is absent does not run
