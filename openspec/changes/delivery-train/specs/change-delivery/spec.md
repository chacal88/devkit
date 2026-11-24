<!-- devkit-stage specs result=passed attempt=2 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Spec Delta

## ADDED Requirements

### Requirement: A train's pull request is never a change's own
A merged pull request whose head branch is `train/<n>` SHALL never be taken as a change's own pull
request, whatever files it changes, as an archive head is not.

#### Scenario: Looked up from the default branch
- **WHEN** the checkout is on `main` and the newest merged pull request that changes `openspec/changes/alpha/` is the one from `train/4`
- **THEN** that pull request is not taken as `alpha`'s own, and `alpha`'s own pull request is looked up among the others

### Requirement: A change carried by a merged train is delivered
In a train project, a change SHALL be delivered when the record of a merged train on the default
branch lists it as boarded at the head of its own pull request and every task of its `tasks.md` on the
default branch is ticked, whether GitHub reports that pull request as merged, open or closed.

#### Scenario: GitHub marked it merged
- **WHEN** `alpha`'s pull request is merged and the record of merged train 4 lists `alpha` at that pull request's head
- **THEN** `alpha` is delivered and the delivery checker answers its retro

#### Scenario: GitHub left it open
- **WHEN** `beta`'s pull request is open at the head the record of merged train 4 lists
- **THEN** `beta` is delivered, and the next step closes that pull request with a comment naming train 4 and its pull request before the retro

#### Scenario: A head the train did not carry
- **WHEN** `beta`'s pull request is open at a head other than the one the record of merged train 4 lists
- **THEN** `beta` is not delivered by that train and follows the ordinary steps

### Requirement: The whole suite of a train project is proven by the train
In a train project, a gate part of `tasks.md` equal to a part of the train's whole-suite command SHALL
not need a passing row in `evidence.md`; every other gate part SHALL, as before.

#### Scenario: The whole suite in the last gate
- **WHEN** the train's command is `node --test all.test.mjs && python3 check.py` and the last gate is `node --test area.test.mjs && node --test all.test.mjs`
- **THEN** the tasks item is met with a passing row for `node --test area.test.mjs` alone, and reports the other part as proven by the train

#### Scenario: Without the train
- **WHEN** the project has no train setting and the same gate
- **THEN** the tasks item needs a passing row for both parts, as before this change

#### Scenario: The change's own pull request in CI
- **WHEN** the default branch's configuration sets the train's command to `node --test all.test.mjs && python3 check.py`, and `devkit-reviews` runs on `alpha`'s own pull request, whose last gate is `node --test area.test.mjs && node --test all.test.mjs` and whose `evidence.md` has a passing row for `node --test area.test.mjs` only
- **THEN** the check passes the tasks item, reporting `node --test all.test.mjs` as proven by the train

#### Scenario: The change's own pull request in CI without the train
- **WHEN** the default branch's configuration has no train setting and the same pull request, gate and evidence
- **THEN** the check fails the tasks item, naming `node --test all.test.mjs` as having no passing row

#### Scenario: A row that names the train is not a pass
- **WHEN** `evidence.md` has, for `node --test all.test.mjs`, a row whose last cell reads `train: proven by the train record`, and the train setting that reader reads is missing
- **THEN** the tasks item is open, naming `node --test all.test.mjs` as having no passing row
