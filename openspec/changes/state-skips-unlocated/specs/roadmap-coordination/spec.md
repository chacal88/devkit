<!-- devkit-stage specs result=passed attempt=1 commit=35b4b579715c1b3f8f5a078a358efb793a5f703d -->
# Spec Delta

## ADDED Requirements

### Requirement: A roadmap line the loop cannot place is shown blocked
When a roadmap line's change has its folder in a checkout the loop does not read it in,
`/devkit status` SHALL show that line in the blocked block with the reason the state command gives
it, in the person's language, exit 0 and show every other line as it would without that line; a
roadmap run SHALL treat that line as any blocked change.

#### Scenario: The board, from the main checkout
- **WHEN** `/devkit status` runs in the main checkout of a project whose roadmap holds lines `a` and `x`, `a` open in the main checkout and `x`'s folder only in a worktree on branch `side`
- **THEN** the board exits 0, lists `x` under "Blocked" with "its folder is on a branch with another name", and lists `a` in the block and with the words it has on the same project without that worktree

#### Scenario: The board in Brazilian Portuguese
- **WHEN** the same board is printed with `--lang pt-BR`
- **THEN** `x`'s row is in the Brazilian Portuguese blocked block, with the Brazilian Portuguese text of `wrong-branch` from the message table

#### Scenario: The board and the state command agree
- **WHEN** `/devkit status` and the state command run on that project
- **THEN** every open roadmap change's block on the board is the block of its state in the command's output, and `x`'s row text is the phrase of its reason in the command's output

#### Scenario: A roadmap run with such a line
- **WHEN** `/devkit roadmap` decides on that project while `a` has a stage ready
- **THEN** the decision exits 0, one line says once that `x` stopped with that reason and that the others go on, and `a`'s stage is handed out as before

#### Scenario: The stop lock of a roadmap run with such a line
- **WHEN** the session of that roadmap run ends its turn while `a` has a stage ready, or while no other line has anything ready
- **THEN** the stop is refused for `a`'s ready stage, or let through because nothing is ready
