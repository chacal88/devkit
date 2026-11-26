<!-- devkit-stage specs result=passed attempt=5 commit=f29093d9bb2a0c013b32c0cb223795f16b20d544 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A project and a change can set a stage's model
The loop SHALL read `models:` in the `devkit:` block of `openspec/config.yaml`, as the change's own
checkout holds it, and in the settings block of the change's `.openspec.yaml` (its `x-devkit:` block,
or its `devkit:` block when the file has no `x-devkit:` block), each a map from a stage id to a model.
A stage's model SHALL be the change's entry, else the project's, else the default. An empty value
SHALL count as absent.

#### Scenario: The project's entry
- **WHEN** `openspec/config.yaml` has `models:` with `design: sonnet` in its `devkit:` block
- **THEN** the action of every change at the design stage carries `sonnet`, and every other stage keeps its default

#### Scenario: The change's entry wins for that change only
- **WHEN** the project's table has `design: sonnet`, change `a`'s `.openspec.yaml` has an `x-devkit:` block with `models:` holding `design: opus`, and change `b`'s has none
- **THEN** `a`'s design action carries `opus` and `b`'s carries `sonnet`

#### Scenario: An empty value
- **WHEN** the change's table holds `design:` with no value and the project's holds `design: haiku`
- **THEN** the design action carries `haiku`

#### Scenario: The change's table passes the strict validation
- **WHEN** a change's `.openspec.yaml` holds, as the flow document shows it, an `x-devkit:` block whose `models:` holds `review: opus`, and `openspec validate <id> --type change --strict` is run on the change
- **THEN** the validation exits 0, and the change's review action carries `opus`

#### Scenario: A devkit block written before the x-devkit block
- **WHEN** a change's `.openspec.yaml` holds a `devkit:` block with `models:` holding `design: opus` and no `x-devkit:` block
- **THEN** the change's design action carries `opus`, as before

#### Scenario: Both blocks in the change's file
- **WHEN** a change's `.openspec.yaml` holds an `x-devkit:` block whose `models:` holds `design: opus` and a `devkit:` block whose `models:` holds `design: haiku` and `review: haiku`
- **THEN** the change's design action carries `opus` and its review action the project's value or the default, read from the `x-devkit:` block alone
