<!-- devkit-stage specs result=passed attempt=1 commit=c055e55abb97096383583ece9efba9250a4d3e1c -->
# Spec Delta

## ADDED Requirements

### Requirement: A change is validated by its type
Every instruction the devkit packs give an agent or a stage to validate one change SHALL name the
command `openspec validate <id> --type change --strict`, with any other flag it has, and SHALL name no
fallback form without `--type change`. A change whose id is also the name of a canonical spec is then
validated as that change.

#### Scenario: A change and a spec share one id
- **WHEN** a project on OpenSpec 2.x holds the change `same` and the canonical spec `same`, and an agent or a stage runs the validation its devkit text names, with `same` for the id
- **THEN** the CLI validates the change `same` and exits 0, where the bare `openspec validate same --strict` exits 1 with `ambiguous_item`

#### Scenario: The review skills name one form
- **WHEN** the readiness-review skill or the review-change skill states its structural check of a change
- **THEN** it names `openspec validate <id> --type change --strict --no-interactive` and no other form for an older CLI

#### Scenario: The schemas' plan gates
- **WHEN** a plan stage of the `devkit` or the `devkit-lite` schema states its gate
- **THEN** the gate is that `openspec validate <id> --type change --strict` passes

### Requirement: The repository refuses a change validation without its type
This repository's `scripts/check.py` SHALL exit 1 when an agent, skill, schema or CompozyOS agent file
holds, inside code, an `openspec validate` command that names an id and lacks `--type change`, naming
the file and the line. Code is a backtick span or a line of a fenced block. A command that names no id,
text outside code and files outside those kinds SHALL NOT be refused.

#### Scenario: The bare form in an agent file
- **WHEN** a file under `plugins/<pack>/agents/` holds the line ``3. Run `openspec validate <id> --strict` when the project uses OpenSpec.`` at line 5
- **THEN** `python3 scripts/check.py` exits 1 with a line that starts with `plugins/<pack>/agents/<file>.md:5:` and says the command lacks `--type change`

#### Scenario: The bare form in a fenced block of a schema
- **WHEN** a `schema.yaml` of a pack's schemas, or of `openspec/schemas/`, holds `openspec validate <change-id> --strict` on a line inside a fenced block
- **THEN** `python3 scripts/check.py` exits 1 naming that file and that line

#### Scenario: A fallback beside the typed form
- **WHEN** one line of a skill holds `openspec validate <id> --type change --strict` in one backtick span and `openspec validate <id> --strict` in another
- **THEN** `python3 scripts/check.py` exits 1 naming that line once

#### Scenario: The typed form passes
- **WHEN** every such command of those files names `--type change`, with or without `--no-interactive` or `--json`
- **THEN** `python3 scripts/check.py` reports no problem of this kind

#### Scenario: Commands with no id and prose
- **WHEN** those files hold `openspec validate --all --strict`, `` `openspec validate` rejects a change`` or `` `openspec validate --strict` fails``, or the words `openspec validate rejects` outside code
- **THEN** `python3 scripts/check.py` reports no problem of this kind

#### Scenario: Files outside the kinds
- **WHEN** the bare form is in `docs/`, in the `README.md` of the repository or of a pack, in a change folder under `openspec/changes/` or in a file whose path has a `fixtures` folder
- **THEN** `python3 scripts/check.py` reports no problem of this kind
