<!-- devkit-stage specs result=passed attempt=4 commit=fd29ac6c22ab2b8c385200a8f357d6d7796fd281 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: The GitHub plan names what the repository refuses
The read-only run of `github-setup.mjs` SHALL print one line, naming the cause and what to do, when
GitHub Actions is disabled for the repository, when GitHub refuses the rulesets for the
repository's plan, and when the newest workflow runs all failed without any job starting a step.
It SHALL write nothing without `--apply`, as before. A blocked state SHALL make the run exit 1.

#### Scenario: Actions disabled
- **WHEN** the repository's Actions permissions answer `enabled: false`
- **THEN** the plan prints a line saying GitHub Actions is disabled for the repository, that no check runs while it is, and where to enable it

#### Scenario: Rulesets refused by the plan
- **WHEN** reading the rulesets answers HTTP 403 with GitHub's message that the feature needs another plan or a public repository
- **THEN** the `ruleset` item is reported blocked with a line saying the plan refuses rulesets, that `merge` mode needs them, and the two ways out (a public repository or a plan with rulesets), instead of the bare GitHub error

#### Scenario: Runs that failed without starting
- **WHEN** the newest completed runs all concluded `failure` and none of their jobs started a step
- **THEN** the plan prints a line saying the newest runs failed without starting, naming the Actions billing (a failed payment or a spending limit) as one possible cause and where to check it

#### Scenario: Nothing written without apply
- **WHEN** the plan runs without `--apply` in any of these states
- **THEN** no `gh api -X` call is made and no file is written

#### Scenario: A blocked state exits 1
- **WHEN** the plan reports Actions disabled, the runs failed without starting, or the rulesets refused
- **THEN** the run exits 1

#### Scenario: Nothing blocked
- **WHEN** no item and no check of the plan is blocked or in error
- **THEN** the run exits 0
