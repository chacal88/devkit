<!-- devkit-stage specs result=passed attempt=4 commit=41dd40ed6cb3017dd2a8cc5c623ffa6d19934303 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A plan stage is stale after a plan file changes, until the work starts
A stage that declares `staleAfter` stages (the plan readiness after the mock-up, the decisions, the
proposal, specs, design and tasks; the owner's approval after the readiness) SHALL be reported
stale when a file of one of those stages is newer than its own file by more than two seconds. This
check SHALL NOT apply once any task of `tasks.md` is ticked (the implementer ticks tasks, which
changes `tasks.md`), nor in the walk after a merged pull request. In a project that names `devkit.release_tag`, the
change's `release.md` SHALL count with the files of the tasks stage for this check, so a release
note revised after the readiness review makes the review stale, and a failed review is offered again
rather than the same revision of the plan; `release.md` SHALL NOT be read as a file of the tasks
stage otherwise. In a project without the setting `release.md` SHALL count for nothing here.

#### Scenario: A plan file edited after the readiness review
- **WHEN** no task is ticked and `design.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported stale, naming the design, and it is the next stage

#### Scenario: A plan file within the tolerance
- **WHEN** no task is ticked and `design.md` is newer than `readiness.md` by less than two seconds
- **THEN** the plan readiness is reported passed

#### Scenario: Ticking a task does not make the plan stale
- **WHEN** one task of `tasks.md` is ticked, others are pending, and `tasks.md` is newer than `readiness.md`
- **THEN** the plan readiness is reported passed and the next stage is the implementation

#### Scenario: No plan staleness after the merge
- **WHEN** the checker runs the walk after a merged pull request
- **THEN** no stage is reported stale by a newer plan file

#### Scenario: The decisions changed after the readiness review
- **WHEN** no task is ticked and `decisions.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported stale, naming the decisions, and it is the next stage

#### Scenario: The mock-up changed after the readiness review
- **WHEN** no task is ticked and `mockup.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported stale, naming the mock-up, and it is the next stage

#### Scenario: The release note revised after the readiness review
- **WHEN** the project names `devkit.release_tag`, no task is ticked, the readiness review passed and `release.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported stale, naming the tasks, and it is the next stage

#### Scenario: A readiness review that failed on the note
- **WHEN** the project names `devkit.release_tag`, the readiness review failed on `release.md`, and the planner then changed only `release.md`
- **THEN** the plan readiness is offered again (`rerun-after-fix`), not the revision of the plan

#### Scenario: A release note in a project without the setting
- **WHEN** the project names no `devkit.release_tag` and `release.md` is newer than `readiness.md` by more than two seconds
- **THEN** the plan readiness is reported passed

#### Scenario: The note revised once the work started
- **WHEN** a task is ticked and `release.md` is newer than `readiness.md`
- **THEN** the plan readiness is reported passed, and the note is judged by the hash the approval records
