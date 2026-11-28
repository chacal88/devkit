# openspec-cli Specification

## Purpose
Says which OpenSpec CLI the devkit packs start in a project, so that a project's pinned version
always wins over the one on `PATH`, and what the packs say when that pin cannot be used.

## Requirements

### Requirement: The project's pinned CLI is used
Every start of the OpenSpec CLI by `flow-check.mjs`, `change-loop.mjs`, `guard.mjs` and
`install-schemas.sh` SHALL use the project's installed CLI, `node_modules/.bin/openspec` of the
checkout or, from a worktree, of the main checkout, when one exists, and SHALL never use the one
on `PATH` instead. With no installed or declared pin, the one on `PATH` SHALL be used, as before.

#### Scenario: A pin and a different CLI on PATH
- **WHEN** the project has `node_modules/.bin/openspec` answering `2.0.0` and the `PATH` has an `openspec` answering `2.1.0`
- **THEN** `flow-check.mjs`, `change-loop.mjs next`, the session text of `guard.mjs` and `install-schemas.sh` start the project's one and never the `PATH` one

#### Scenario: From a worktree
- **WHEN** the checkout is a worktree with no `node_modules/` and the main checkout has `node_modules/.bin/openspec`
- **THEN** the main checkout's CLI is started

#### Scenario: No pin
- **WHEN** the project has no `node_modules/.bin/openspec` and no `package.json` naming `@fission-ai/openspec`
- **THEN** the `openspec` on `PATH` is started

### Requirement: A declared pin that is not installed is named
When the project's `package.json` declares `@fission-ai/openspec` and no installed CLI exists, the
packs SHALL start no OpenSpec CLI, and SHALL say that the project pins OpenSpec in that file, the
version it declares, and to install the project's dependencies.

#### Scenario: Declared, not installed
- **WHEN** `package.json` lists `"@fission-ai/openspec": "^2.0.0"` in `devDependencies` and `node_modules/` is absent
- **THEN** `flow-check.mjs` exits 3 saying the pin is declared in `package.json` and not installed and to run the install, and no `openspec` on `PATH` is started

### Requirement: A pinned CLI other than 2.x is named
When the project's pinned CLI answers a major other than 2, the packs SHALL start it for nothing
else, and SHALL say the version found, the path it was found at, and that the project's pin must
move to OpenSpec 2.x. OpenSpec 1.x SHALL NOT be supported.

#### Scenario: A 1.x pin
- **WHEN** the project's `node_modules/.bin/openspec` answers `1.16.0`
- **THEN** `flow-check.mjs` and `change-loop.mjs next` exit 3, and `guard.mjs`'s session text prints one line, each naming `1.16.0`, the path of that CLI and that the pin must move to 2.x

#### Scenario: The schemas are not installed over a 1.x pin
- **WHEN** `install-schemas.sh <project>` runs and the project's pinned CLI answers `1.16.0`
- **THEN** it exits 1 naming the version, the path and the move to 2.x, and replaces no schema

### Requirement: The session text names a pin it cannot use
When a session starts in a project whose pinned CLI answers a major other than 2, or whose
`package.json` declares `@fission-ai/openspec` with no installed CLI, the session text of
`guard.mjs` SHALL be the one line `[devkit] <message>`, the message being the one the packs give for
that case, and SHALL NOT run `openspec status`.

#### Scenario: A session over a 1.x pin
- **WHEN** a session starts in a project whose `node_modules/.bin/openspec` answers `1.16.0`
- **THEN** the session text is the one line `[devkit] <message>` naming `1.16.0`, the path of that CLI and the move to 2.x, and no `openspec status` is run

#### Scenario: A session over a declared pin not installed
- **WHEN** a session starts in a project whose `package.json` declares `@fission-ai/openspec` and has no `node_modules/`
- **THEN** the session text is the one line `[devkit] <message>` saying the pin is declared in `package.json` and not installed and to run the install, and no `openspec` CLI is started

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
