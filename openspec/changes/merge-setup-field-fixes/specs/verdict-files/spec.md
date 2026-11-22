<!-- devkit-stage specs result=passed attempt=1 commit=6e803ebbf35af6c2cc94cb622bdd1a4a1ecd3662 -->
# Spec Delta

## Purpose

Says how every devkit reader reads a verdict file (a reviewer's `reviews/<reviewer>.md`, the plan
audit) when the file holds more than one `Verdict:` line, so that every gate agrees on its verdict.

## ADDED Requirements

### Requirement: A verdict file is read from its first Verdict line
Every devkit reader of a verdict file SHALL take the file's verdict from its first `Verdict:` line
and SHALL ignore any later `Verdict:` line, printing nothing about it. This holds for the delivery
checker, the `devkit-reviews` check from both of its entries, the hook on `gh pr create`, and the
plan-audit reader of the conduct checker. The panel SHALL show only what those checkers report.

#### Scenario: The delivery checker
- **WHEN** a required reviewer's file has `Verdict: approved` on line 1 and `Verdict: rejected` further down, and `deliver-check.mjs <id>` runs
- **THEN** the reviews item counts that reviewer as approved and no output line mentions the second `Verdict:` line

#### Scenario: The first line rejects
- **WHEN** a required reviewer's file has `Verdict: rejected` on line 1 and `Verdict: approved` further down
- **THEN** `deliver-check.mjs <id>` reports that reviewer as rejected

#### Scenario: The devkit-reviews check
- **WHEN** a pull request's change has a reviewer file with `Verdict: approved` on line 1 and `Verdict: rejected` further down, and every other item is met
- **THEN** `deliver-check.mjs --ci` and `guard.mjs ci` both pass, and with the two lines the other way round both fail naming that reviewer as rejected

#### Scenario: The pull request hook
- **WHEN** `gh pr create` is run for a change whose reviewer file has `Verdict: rejected` on line 1 and `Verdict: approved` further down
- **THEN** the hook refuses the pull request naming that reviewer as rejected, and with the lines the other way round it does not refuse it for that reviewer

#### Scenario: The plan audit
- **WHEN** a change's plan audit has `Verdict: ACCURATE` first and `Verdict: OUTDATED` further down
- **THEN** the conduct checker does not answer `revise-plan` for that audit, and with the lines the other way round it answers `revise-plan`
