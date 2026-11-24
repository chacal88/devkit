<!-- devkit-stage specs result=passed attempt=2 commit=02208a3517799997e0a4950c46c466ec161c88c6 -->
# Spec Delta

## ADDED Requirements

### Requirement: A merge of the base is checked before the evidence
On a script with an evidence stage, from the implementation on, when the change's branch holds a
merge commit that is not on `origin/<base>` and no green check is recorded for the newest such merge,
the loop SHALL give the session step `merge-check` of the evidence stage, whose command runs
`openspec validate <id> --strict` in the change's root and records the result for that merge, before
the evidence and before every delivery step that pushes or waits on the change's pull request.

#### Scenario: A merge with no check yet
- **WHEN** the branch's newest merge commit not on `origin/<base>` has no recorded check and the delivery checker's step is `verify`
- **THEN** `change-loop.mjs next` gives an action of kind `session`, stage `evidence`, step `merge-check`, whose `detail.command` is the loop's `merge-check` command for the change and whose `detail.merge` is that merge commit's sha, and exits 0

#### Scenario: The evidence is current but the merge is not checked
- **WHEN** the same merge has no recorded check and the delivery checker's step is `review`, `push`, `open-pr`, `update-branch`, `wait-checks`, `ready` or `ready-base`
- **THEN** the next action is the same `merge-check` step

#### Scenario: Steps the check does not hold back
- **WHEN** the merge has no recorded check and the step is one of the implementation's steps, `commit`, `disable-auto-merge`, a blocked end, or any step on the archive branch
- **THEN** the next action is the one the loop gave before this requirement

#### Scenario: No merge to check
- **WHEN** no merge commit is on the branch's first-parent line outside `origin/<base>`, or `origin/<base>` does not resolve
- **THEN** the next action is the one the loop gave before this requirement and nothing runs `openspec validate`

#### Scenario: The command with no merge
- **WHEN** the session runs `change-loop.mjs merge-check <id>` on a branch with no merge commit outside `origin/<base>`
- **THEN** the command prints `result: none`, writes no record, runs no `openspec validate` and exits 0

#### Scenario: The command on an unknown change
- **WHEN** `change-loop.mjs merge-check` is given an id that names no change of the project, or no id
- **THEN** the command exits 3 with the error and writes no record

#### Scenario: A script without an evidence stage
- **WHEN** the change follows a flow with no `evidence` stage
- **THEN** no action is `merge-check`

### Requirement: A green check lets the delivery go on once per merge
When the command's validation exits 0 with the change reported valid, it SHALL record a green check
for that merge, and the loop SHALL then give the step it would have given without the check, and
SHALL not give `merge-check` again until a newer merge commit is on the branch.

#### Scenario: Green, then the evidence
- **WHEN** the session runs the `merge-check` step's command and `openspec validate <id> --strict` passes
- **THEN** the command records green for that merge, and the next call of `next` hands `verify` to the verifier's agent

#### Scenario: The same merge is not checked twice
- **WHEN** a green check is recorded for the newest merge and `next` is called again, with or without later commits that are not merges
- **THEN** no action is `merge-check` and the command is not run

#### Scenario: A newer merge is checked again
- **WHEN** a green check is recorded for one merge and the branch then takes another merge of the base
- **THEN** the next action is `merge-check` with the newer merge's sha

#### Scenario: A damaged or foreign record is no record
- **WHEN** the merge-check record of the change is missing, empty, truncated, not JSON, of another change, of another record version, or holds a result that is not green, red or cannot-run
- **THEN** the loop reads it as no record, the next action is `merge-check` for the newest merge, and the record is never read as green

### Requirement: A red check goes to the planner as a merge defect
When the validation reports the change invalid, the command SHALL record a red check with
validate's errors for that merge, and the loop SHALL hand the planner's agent a brief that names a
merge defect, quotes the errors and asks for a fix of the plan files only, leaving every stage
header and task checkbox as it is. No stage header SHALL change because of the check or the hand-off.

#### Scenario: Red, then the planner
- **WHEN** the session runs the `merge-check` step's command and `openspec validate <id> --strict` reports the change invalid
- **THEN** the next call of `next` gives an action of kind `agent` for `devkit-core:change-planner`, step `merge-defect`, whose brief holds the words `merge defect` and validate's error messages, and the `attempt=` of every stage header in the change folder is what it was before the command ran

#### Scenario: A dropped scenario of the base
- **WHEN** the base added a scenario to a requirement that the change's delta modifies, the merge changed no file of the change, and the command runs
- **THEN** the check is red and its recorded errors, and the planner's brief, name that requirement

#### Scenario: The planner's fix is checked again
- **WHEN** a red check is recorded and the change's files have changed since the command ran
- **THEN** the next action is `merge-check` again for the same merge

#### Scenario: A planner that changed nothing
- **WHEN** the planner's hand-off comes back with the same progress key because nothing changed
- **THEN** the run ends blocked as a stage that made no progress, as for every hand-off

### Requirement: Three red checks in a row on one merge end the run blocked
The loop SHALL end the run blocked, with the reason code `merge-defect` and a reply that names the
merge and the number of red checks, once the red checks recorded in a row for the same merge reach
the flow's default attempt ceiling, instead of handing the planner again. No stage's attempt or
ceiling SHALL be read or changed for it.

#### Scenario: The third red check
- **WHEN** the third red check in a row is recorded for the same merge, with the flow's `ceilings.default` at 3
- **THEN** `next` ends the run blocked with the reason code `merge-defect`, its reply names the first 7 characters of the merge's sha and the number 3, it exits 2, and the evidence stage's header is unchanged

#### Scenario: A green check resets the count
- **WHEN** a red check is followed by a green check for the same merge
- **THEN** a later merge starts its count at one

### Requirement: A check that cannot run ends the run blocked
When `openspec` is missing, times out, is refused by the project's version pin, or answers anything
but a validation result for the change, the command SHALL record that the check could not run, with
the cause, and SHALL never record green; right after the session ran the step, the loop SHALL end the
run blocked with the reason code `merge-check-failed`, naming the cause.

#### Scenario: No openspec on the path
- **WHEN** the `merge-check` step's command runs with no `openspec` program on its `PATH`, and then `next` runs with the CLI available and that step's progress key
- **THEN** `next` ends the run blocked with the reason code `merge-check-failed`, its reply names the openspec command, it exits 2, and no green check is recorded

#### Scenario: The other causes of a check that cannot run
- **WHEN** the step's command finds `openspec validate` timing out, refused by the project's version pin, answering no validation result for the change, or reporting the change valid with a non-zero exit
- **THEN** the command records `cannot-run` with that cause and keeps the count of red checks already recorded for that merge, records no green check, and `next` with that step's progress key ends the run blocked with the reason code `merge-check-failed`

#### Scenario: Called again after the cause is fixed
- **WHEN** a check that could not run is recorded and `next` is called without that step's progress key
- **THEN** the next action is the `merge-check` step again

### Requirement: A merge-defect fix follows the rule of every plan edit
The planner's fix of a merge defect SHALL leave `readiness.md`, `approval.md` and the plan stages in
the state the flow gives any other edit of the plan files once the implementation has started; the
loop SHALL add no exception to the plan gate for it.

#### Scenario: The same answer as an ordinary plan edit
- **WHEN** a change with a ticked task, an approved readiness and a current owner approval has its spec delta edited as a merge-defect fix, and the same change has its design edited instead
- **THEN** the stage checker gives the same states for readiness and approval in both cases, the approval stays current in both, and neither asks for a new review or a new approval
