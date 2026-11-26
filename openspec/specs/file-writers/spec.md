# file-writers Specification

## Purpose
Says which stage roles other than the implementer may write files outside a devkit change's folder,
and what each may write, so that product code stays the implementer's while the ADR author and the
E2E tester deliver their own files.

## Requirements

### Requirement: The ADR author writes only decision records
In a project that opted in, a write by the `adr-author` agent to a file outside `openspec/` and
`.claude/` SHALL be allowed only for a Markdown file inside a folder named `adr`, `adrs` or
`decisions` (in any letter case), on both scripts and before or after the plan's approval; any other
such write SHALL be refused with the reason.

#### Scenario: A new record before the readiness review
- **WHEN** the ADR author writes `docs/adr/0014-x.md` in a `devkit` change whose `readiness.md` does not exist
- **THEN** the write is allowed

#### Scenario: A product file
- **WHEN** the ADR author writes `src/a.ts`
- **THEN** the write is refused, and the reason says the ADR author writes only decision records

#### Scenario: A file that is not Markdown in the folder
- **WHEN** the ADR author writes `docs/adr/diagram.png`
- **THEN** the write is refused

### Requirement: The E2E tester writes only test files
In a project that opted in, a write by the `e2e-tester` agent to a file outside `openspec/` and
`.claude/` SHALL follow the full script's readiness gate and, past it, be allowed only for a test
file: a path with a folder named `test`, `tests`, `__tests__`, `e2e`, `spec`, `specs`, `cypress` or
`playwright`, or a file name in a test form. Any other such write SHALL be refused with the reason.

#### Scenario: An E2E test after the approved readiness
- **WHEN** the E2E tester writes `e2e/export.spec.ts` in a `devkit` change whose `readiness.md` says `- Status: APPROVED`
- **THEN** the write is allowed

#### Scenario: A test file named in a test form
- **WHEN** the E2E tester writes `web/export.e2e.ts` past the approved readiness
- **THEN** the write is allowed

#### Scenario: A product file
- **WHEN** the E2E tester writes `src/export.ts` past the approved readiness
- **THEN** the write is refused, and the reason says the E2E tester writes only test files

#### Scenario: Before the approved readiness
- **WHEN** the E2E tester writes `e2e/export.spec.ts` in a `devkit` change whose readiness is not approved
- **THEN** the write is refused with the reason product code is refused today

#### Scenario: On a script without a readiness stage
- **WHEN** the E2E tester writes `src/export.ts` in a change on `devkit-lite`
- **THEN** the guard does not limit the E2E tester's writes

### Requirement: Product code stays the implementer's
On the full script, past the approved readiness, a write to a file outside `openspec/` and
`.claude/` by any agent other than the implementer, the ADR author within its records and the E2E
tester within its test files SHALL be refused as today, the screen designer and the test runner
included.

#### Scenario: The test runner edits a test
- **WHEN** the `test-runner` agent writes `src/a.test.ts` past the approved readiness
- **THEN** the write is refused, naming the implementer as the writer of product code

#### Scenario: The screen designer writes a product file
- **WHEN** the `screen-designer` agent writes `src/view.tsx` in a `devkit` change
- **THEN** the write is refused

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
write, SHALL be refused, and so SHALL a subagent's Bash command whose text runs `change-loop.mjs
declare`: the script's path written after `node` and any option words that start with `-`.

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
