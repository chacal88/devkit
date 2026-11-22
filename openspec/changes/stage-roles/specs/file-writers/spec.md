<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## Purpose

Says which stage roles other than the implementer may write files outside a devkit change's folder,
and what each may write, so that product code stays the implementer's while the ADR author and the
E2E tester deliver their own files.

## ADDED Requirements

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
