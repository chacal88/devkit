<!-- devkit-stage specs result=passed attempt=1 commit=b7acf8f5042142eb9fcdd89dc96dbf1be40a5263 -->
# Spec Delta

## ADDED Requirements

### Requirement: A train that empties keeps its record outside every checkout
When every boarded change leaves the train, the departure SHALL end with the result empty, create
no train branch, worktree, commit or pull request, and take no train number. It SHALL write the
train record, with the result empty and every left change with its reason and its failing output,
as an uncommitted file `<git common dir>/devkit-trains/<n>.md` outside every checkout's tracked
tree, and name that file in its output and in its reply.

#### Scenario: Every change left red
- **WHEN** `alpha` and `beta` are boarded, the highest train is 3, and the suite fails on every train that holds either of them
- **THEN** the departure ends with the result empty and lists `alpha` and `beta` as left `red`, each with the failing output of its last red run
- **AND** `<git common dir>/devkit-trains/4.md` holds a record whose result is empty, whose Boarded table is empty, which lists both as left with their reason, and which holds the failing output of each
- **AND** the reply says the train emptied and nothing was boarded, and names that file
- **AND** no `train/4` branch, no train worktree and no commit exist, and the root checkout's status is what it was before the departure

#### Scenario: Emptied by a conflict
- **WHEN** the only boarded change conflicts with the base branch in product code
- **THEN** the departure ends with the result empty, the change is listed as left by `conflict` with its paths and no failing output, and the record file is written as for a red train

#### Scenario: A second empty departure
- **WHEN** a departure emptied as train 4 and the next departure empties too
- **THEN** the next departure is numbered 4 again and its record replaces the file `<git common dir>/devkit-trains/4.md`
