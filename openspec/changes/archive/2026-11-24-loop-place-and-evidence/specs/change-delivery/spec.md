<!-- devkit-stage specs result=passed attempt=1 commit=2aea5d914ea2e8266f2de39f6a5b19696d40d65d -->
# Spec Delta

## ADDED Requirements

### Requirement: The change folder is committed before a review round
When the delivery checker would answer `review` and `openspec/changes/<id>/` holds a modified,
staged or untracked path, it SHALL answer the `commit` step instead. That step SHALL name no path to
stage (`paths` empty), and its reason SHALL name the folder's paths. Once the folder is clean, the
checker SHALL answer what it answered before. With a clean folder, every answer SHALL stay the same.
The change loop SHALL hand this step to the commit role, as it hands any other `commit` step.

#### Scenario: Only the evidence is uncommitted
- **WHEN** the evidence is current, `code-quality-reviewer` has no verdict, and `openspec/changes/foo/evidence.md` is the only uncommitted path
- **THEN** `deliver-check.mjs foo --json` answers `next.step` `commit` with `next.paths` `[]`, and a reason that names `openspec/changes/foo/evidence.md`

#### Scenario: Only a ticked tasks.md is uncommitted
- **WHEN** the evidence is current, a reviewer is stale, and the only uncommitted change is a gate ticked in `openspec/changes/foo/tasks.md`
- **THEN** the checker answers `commit` with `paths` `[]`

#### Scenario: An untracked or staged file in the change folder
- **WHEN** the evidence is current, a reviewer is missing, and `openspec/changes/foo/proof/red-1.txt` is untracked, or staged and not committed
- **THEN** the checker answers `commit`, and its reason names `openspec/changes/foo/proof/red-1.txt`

#### Scenario: The review after the commit
- **WHEN** the folder's paths of the scenarios above are committed and nothing else changed
- **THEN** the checker answers `review` with the same reviewers and the same round it answered for the same state with the folder clean

#### Scenario: Product code dirty together with the folder
- **WHEN** `src/a.ts` and `openspec/changes/foo/evidence.md` are both uncommitted
- **THEN** the checker answers the product `commit` step with `paths` `["src/a.ts"]`, before `verify`, as before this change, and the same call answers no second `commit` step

#### Scenario: A dirty folder while the evidence is due
- **WHEN** `openspec/changes/foo/tasks.md` is uncommitted and the evidence is missing or stale
- **THEN** the checker answers `verify`, as before this change

#### Scenario: A dirty folder while a fix comes first
- **WHEN** `openspec/changes/foo/reviews/code-quality-reviewer.md` holds a current rejected verdict and is uncommitted
- **THEN** the checker answers `fix-review`, as before this change

#### Scenario: A clean change folder
- **WHEN** nothing under `openspec/changes/foo/` is uncommitted, the evidence is current and a reviewer is stale
- **THEN** the checker answers `review`, with the reviewers and the round it answered before this change

#### Scenario: Paths outside the change folder do not count
- **WHEN** the only uncommitted paths are `openspec/changes/foox/tasks.md` and `openspec/config.yaml`, the evidence is current and a reviewer is missing
- **THEN** the checker answers `review`

#### Scenario: The change loop hands the step to the commit role
- **WHEN** the delivery row of a `/devkit change` run is `commit` with `paths` `[]`
- **THEN** `change-loop.mjs next` answers an `agent` action for `devkit-core:commit-and-pr` with step `commit` and stage `delivery`, as for a `commit` step that names paths

#### Scenario: The round after the step records clean commits
- **WHEN** a review round runs after the change folder was committed by this step
- **THEN** each verdict's `Commit:` line carries no `(uncommitted changes)` mark, and the checker reads every verdict of the round as current
