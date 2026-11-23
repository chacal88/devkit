<!-- devkit-stage specs result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Spec Delta

## ADDED Requirements

### Requirement: A slice's run names a gh too old to read its checks
When the slice's pull request is open at the local head and its checks cannot be read because the
installed `gh` is too old, the project command SHALL end the run blocked with the reason
`gh-too-old`, writing nothing, with a reply naming the installed version (or saying it is unknown)
and 2.50.0, telling the person to update `gh` and to call `/devkit project` again.

#### Scenario: An old gh reads the slice's checks
- **WHEN** the slice `billing` is archived on its branch, its pull request is open at the local head, `gh pr checks` fails with `unknown flag: --json` and `gh --version` prints `gh version 2.46.0 (2024-03-18)`
- **THEN** `project-loop.mjs next` ends blocked with the reason `gh-too-old` and exit code 2, its reply names `2.46.0`, `2.50.0` and `/devkit project billing`, nothing is pushed or merged, and auto-merge is not enabled

#### Scenario: Other failures keep their reason
- **WHEN** the slice's checks cannot be read for any other reason
- **THEN** the run ends blocked saying GitHub cannot be read, as before this change
