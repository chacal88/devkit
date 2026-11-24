<!-- devkit-stage specs result=passed attempt=1 commit=def86377b435bf281d5a933226deb5a4782e4de4 -->
# Spec Delta

## ADDED Requirements

### Requirement: The loop leads an owner's forced merge to the retro
When the delivery checker answers the retro of an owner's forced merge, the loop SHALL give the
retro session step with the checker's open items in its detail and a reply, in the person's
language, that names the pull request and the count of open items and says the retro records them
before the archive. No test stage the stage checker names SHALL replace that step.

#### Scenario: The forced retro
- **WHEN** the delivery checker answers `retro` with `forced` for pull request #88 and 4 open items
- **THEN** `change-loop.mjs next --change <id>` gives an action of kind `session`, stage `retro`, step `retro`, with `detail.forced` as the checker gave it and `reply` the table's forced-merge message naming #88 and 4, and exits 0

#### Scenario: In both languages
- **WHEN** the same step is read with `--lang en` and with `--lang pt-BR`
- **THEN** the reply is the forced-merge message of that language, and it holds no step name, file name or checker name

#### Scenario: A test stage pending in the checkout
- **WHEN** the stage checker's next stage is the unit tests and the delivery checker answers the forced retro
- **THEN** the action is the retro session step, not a hand-off to the test runner

#### Scenario: A partial merge
- **WHEN** the delivery checker answers `stop-branch` for a pull request merged with tasks left and every required check green
- **THEN** the run ends blocked with the reason `wrong-branch`, as before this change
