<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: A gh too old to read the checks ends the run with its own reason
When the stage checker ends blocked because the installed `gh` is too old to read the pull request's
checks, the loop SHALL end the run blocked with the reason `gh-too-old`, exit 2, and a reply in the
person's language naming the installed version (or saying it is unknown) and 2.50.0, telling the
person to update `gh` and to call `/devkit change` again. The wait on GitHub SHALL NOT retry it.

#### Scenario: The run ends with the old-gh reason
- **WHEN** the change's open pull request is at the local head, `gh pr checks` fails with `unknown flag: --json` and `gh --version` prints `gh version 2.46.0 (2024-03-18)`, and `change-loop.mjs next` runs
- **THEN** the run ends blocked with the reason `gh-too-old` and exit code 2, and its reply, in English and in Brazilian Portuguese, names `2.46.0` and `2.50.0`, says to update `gh` and to call `/devkit change` with the change's id again, and does not say that GitHub cannot be read

#### Scenario: The version cannot be read
- **WHEN** the same failure happens and `gh --version` cannot be read
- **THEN** the run ends blocked with the reason `gh-too-old`, its reply giving the installed version as unknown and naming `2.50.0`

#### Scenario: The wait meets an old gh
- **WHEN** the session waits on GitHub and a poll ends blocked with the reason `gh-too-old`
- **THEN** the wait ends at that poll with that decision, without the retries an unreadable GitHub gets

#### Scenario: The roadmap shows the reason
- **WHEN** a change of a roadmap run ends blocked with the reason `gh-too-old`
- **THEN** its blocked line in the roadmap reply names both versions in the person's language
