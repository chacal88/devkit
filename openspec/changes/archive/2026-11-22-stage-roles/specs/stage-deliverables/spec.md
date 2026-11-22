<!-- devkit-stage specs result=passed attempt=1 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Spec Delta

## Purpose

Says what each stage role delivers into a devkit change: the mock-up and its screen files, the
decisions and their records, the unit and E2E runs, and the demonstration as text, so that the
checker, the loop and the owner can rely on each file's form.

## ADDED Requirements

### Requirement: The mock-up is drawn as files the owner can open
The screen designer SHALL draw each screen the change alters as one file under the change's `mock/`
folder, in the target's own form (a self-contained static `<screen>.html` for a web page or panel, a
monospaced text `<screen>.md` for a terminal, CLI or band), with a real example's data, and SHALL
write `mockup.md` listing each screen, its file and the data it shows, with `result=pending`.

#### Scenario: A web screen
- **WHEN** the change alters a web page
- **THEN** `mock/<screen>.html` opens in a browser with no network access and no file outside itself, and shows values taken from a real example the change names

#### Scenario: A terminal band
- **WHEN** the change alters a line the session prints above the prompt
- **THEN** `mock/<screen>.md` holds that line in a fenced monospaced block, and `mockup.md` names the example it was drawn from

#### Scenario: No image is kept
- **WHEN** the screen designer finishes any attempt
- **THEN** the change's folder holds no `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp` or `.svg` file it wrote

### Requirement: A redraw answers the owner's notes
On an attempt after the owner asked for changes, the screen designer SHALL redraw from the owner's
notes recorded in `mockup.md`, keep those notes, and write the header with the attempt one more
than the replaced one and `result=pending`; it SHALL never set `result=passed` itself.

#### Scenario: The second attempt
- **WHEN** `mockup.md` says `result=failed attempt=1` and holds the owner's notes for attempt 1
- **THEN** after the screen designer's run its header says `result=pending attempt=2`, the notes of attempt 1 are still there, and the screen files changed

### Requirement: The decisions name each proposed record
The ADR author SHALL write `decisions.md` with one line `- ADR: <path from the repository root>`
in backticks, followed by the record's title, for each record it drafted in the project's ADR
folder with status proposed and `result=passed`; or, when no decision needs a record, one line
saying why and `result=not-applicable`. It SHALL never change an accepted record.

#### Scenario: A change that needs a record
- **WHEN** the change introduces a locked decision the project's records do not hold
- **THEN** a new record in the project's ADR folder follows its naming pattern and says `Status: proposed`, and `decisions.md` lists it on a `- ADR:` line

#### Scenario: A change that needs none
- **WHEN** no decision of the change is hard to reverse, crosses a boundary or contradicts a record
- **THEN** `decisions.md` holds the header with `result=not-applicable` and one line saying why

#### Scenario: A change that contradicts an accepted record
- **WHEN** the change needs what an accepted record rules out
- **THEN** the author drafts a new proposed record that amends or supersedes it, and the accepted record's text is unchanged

### Requirement: The unit run decides its stage from the suite and the target
The test runner SHALL run the declared unit command over the whole suite and the declared coverage
command, and write `unit-tests.md` with each command, its exit code and its summary, and the
coverage against the target; `result=passed` only when every command exits 0 and, with a target
declared, the coverage reaches it; `result=failed` otherwise. It SHALL edit no file but its own.

#### Scenario: Green and above the target
- **WHEN** the unit command exits 0 and the coverage command reports 87% against a target of 80
- **THEN** `unit-tests.md` lists both commands with exit 0 and their summaries, says 87% against 80, and its header says `result=passed`

#### Scenario: Below the target
- **WHEN** the unit command exits 0 and the coverage reaches 72% against a target of 80
- **THEN** the header says `result=failed` and the file says the coverage is below the target

#### Scenario: A red suite
- **WHEN** the unit command exits 1
- **THEN** the header says `result=failed`, the file names each failing test and the likely cause, and no product or test file changed

#### Scenario: No target declared
- **WHEN** the project declares a unit command and a coverage command and no target, and both exit 0
- **THEN** the coverage is recorded, the file says no target is declared, and the header says `result=passed`

### Requirement: The E2E tests come from the criteria, apart from the implementer
The E2E tester SHALL write E2E tests from the acceptance criteria without reading the test files
the change's diff adds or modifies, write only test files, run the declared E2E command, and write
`e2e-tests.md` with one row per scenario (the scenario, the criterion it covers, its file, its
result) and the command's exit code; a red scenario SHALL make the header `result=failed`.

#### Scenario: Every scenario green
- **WHEN** the change has three criteria that can be exercised end to end and the E2E command exits 0
- **THEN** `e2e-tests.md` has a row per scenario naming its criterion and file with `pass`, and its header says `result=passed`

#### Scenario: A red scenario
- **WHEN** one scenario fails
- **THEN** its row says `fail` with what it observed, the header says `result=failed`, and no product file changed

#### Scenario: A criterion with no end-to-end surface
- **WHEN** a criterion cannot be exercised end to end
- **THEN** `e2e-tests.md` says so for that criterion with the reason, and that alone does not fail the stage

### Requirement: The demonstration is recorded as text
The verifier SHALL record, in `evidence.md` and per acceptance criterion, what it did, what it
observed and whether it passed, as text; it SHALL take no screenshot, keep no image file and post no
pull-request comment, and SHALL keep the stage header, the `Commit:` line on line 2 and the
`### Gates` table in the form the hooks read.

#### Scenario: A screen criterion
- **WHEN** a criterion is about a screen
- **THEN** its row says what was opened, the text and the state the screen showed, and whether it passed, and no image is written anywhere

#### Scenario: The delivery checker reads it
- **WHEN** `deliver-check` reads an `evidence.md` written in this form for the current commit
- **THEN** it counts the gates and the criteria as before and gives the same next step as for today's form

#### Scenario: A pull request exists
- **WHEN** the verifier runs after the change's pull request was opened
- **THEN** it posts no comment on the pull request
