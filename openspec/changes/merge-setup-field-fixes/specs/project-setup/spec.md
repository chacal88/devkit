<!-- devkit-stage specs result=passed attempt=1 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Spec Delta

## ADDED Requirements

### Requirement: The GitHub plan prints every check the ruleset will require
The plan of `github-setup.mjs` SHALL print, on its required-checks line, every check the ruleset
`devkit` will require: the checks given with `--checks` or found on the newest pull requests,
`devkit-reviews`, and any check the existing ruleset `devkit` already requires, each part labelled
with where it comes from. The line SHALL NOT say "none" while the ruleset requires a check. The
JSON plan SHALL carry the same list.

#### Scenario: An empty checks option
- **WHEN** `github-setup.mjs --checks ""` runs
- **THEN** the required-checks line lists `devkit-reviews`, says it is always required and that `--checks` gave no other check, and the line holds no "none"

#### Scenario: Checks found on the newest pull requests
- **WHEN** the newest pull requests report the checks `test` and `lint` and no option is given
- **THEN** the line lists `test, lint, devkit-reviews`, labelling `test, lint` as reported on the newest pull requests

#### Scenario: No pull request has a check reported
- **WHEN** no pull request of the repository has a check reported on its head and no option is given
- **THEN** the line lists `devkit-reviews` and says that no other check was reported and that `--checks` adds one

#### Scenario: Checks the existing ruleset already requires
- **WHEN** the ruleset `devkit` exists and requires `e2e` and the checks given are `test`
- **THEN** the line lists `e2e`, `test` and `devkit-reviews`, labelling `e2e` as already required by the ruleset

#### Scenario: The JSON plan
- **WHEN** `github-setup.mjs --json` runs
- **THEN** its `requires` field is the list the line prints, in the same order, and its `contexts` field is unchanged
