<!-- devkit-stage specs result=passed attempt=4 commit=fd29ac6c22ab2b8c385200a8f357d6d7796fd281 -->
# Spec Delta

## ADDED Requirements

### Requirement: The verifier writes its evidence and its proof folder
In a project using the devkit hooks, `pr-verifier` SHALL be allowed to write the active change's
`evidence.md` and any file under the active change's `proof/` folder, by an edit tool or a shell
write, and SHALL be refused every other path. Every other writer's rules SHALL stay as they are.

#### Scenario: A run's output under proof
- **WHEN** `pr-verifier` writes `openspec/changes/feat/proof/ac1-run.txt` or `openspec/changes/feat/proof/runs/a.jsonl` while `feat` is the active change
- **THEN** the write is allowed

#### Scenario: A shell write under proof
- **WHEN** `pr-verifier` redirects a command's output into `openspec/changes/feat/proof/out.txt`
- **THEN** the write is allowed

#### Scenario: A plan file
- **WHEN** `pr-verifier` writes `openspec/changes/feat/design.md`
- **THEN** the write is refused, naming its own files

#### Scenario: Another change's proof folder
- **WHEN** `pr-verifier` writes `openspec/changes/other/proof/a.txt` while `feat` is the active change
- **THEN** the write is refused

#### Scenario: Product code
- **WHEN** `pr-verifier` writes `src/a.ts`
- **THEN** the write is refused

### Requirement: The record of declared steps is the main session's
The file `openspec/changes/<id>/declared.json` of any change SHALL be written only by the main
session, through the loop's `declare` command. A subagent's write of it, by an edit tool or a shell
write, SHALL be refused, and so SHALL a subagent's Bash command that runs `change-loop.mjs declare`.

#### Scenario: A subagent writes the record
- **WHEN** `tdd-implementer` writes `openspec/changes/feat/declared.json`
- **THEN** the write is refused, saying the main session writes it

#### Scenario: A subagent writes another change's record
- **WHEN** `tdd-implementer` writes `openspec/changes/other/declared.json` while `feat` is the active change
- **THEN** the write is refused

#### Scenario: The main session writes the record
- **WHEN** the main session writes `openspec/changes/feat/declared.json`
- **THEN** the write is allowed

#### Scenario: A subagent runs the declare command
- **WHEN** `tdd-implementer` runs `node <plugin>/hooks/change-loop.mjs declare feat review-round --param words=x`, with the script's path quoted or not, with node option words before it (`--no-warnings`, `--`) or none, alone or after a `cd`
- **THEN** the command is refused, saying the main session runs it, and nothing is recorded

#### Scenario: The main session runs the declare command
- **WHEN** the main session runs the same command
- **THEN** the guard lets it through

#### Scenario: Other loop commands and text that names the command
- **WHEN** a subagent runs `change-loop.mjs next` or `change-loop.mjs reply`, commits with a message that names `change-loop.mjs` and `declare` without a `node` call, or writes a file through a heredoc whose body holds the declare command
- **THEN** the guard lets it through

#### Scenario: A project without the devkit schemas
- **WHEN** the session's project selects no devkit schema and a subagent runs the declare command
- **THEN** the guard lets it through
