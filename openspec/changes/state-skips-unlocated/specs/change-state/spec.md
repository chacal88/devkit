<!-- devkit-stage specs result=passed attempt=1 commit=35b4b579715c1b3f8f5a078a358efb793a5f703d -->
# Spec Delta

## ADDED Requirements

### Requirement: A change the loop cannot place is listed blocked
When a checkout of the repository holds change `<id>`'s folder but the checkout the loop reads
the change in does not, the state command SHALL list `<id>` as `blocked` with the reason
`wrong-branch` and its phrase in the person's language, its `root` and `branch` those of the
checkout that holds the folder, its stage fields null, and exit 0, with or without `--change`.

#### Scenario: The list, from the main checkout
- **WHEN** `state --lang en` runs in the main checkout, change `a` is open there, and change `x`'s folder is only in a worktree on branch `side`
- **THEN** the command exits 0, lists `a` exactly as it would without that worktree, and lists `x` as `blocked` with the reason code `wrong-branch` and the phrase "its folder is on a branch with another name", the stage, stage title, phase and stage icon null, the state icon ⛔, the title `⛔ x`, the script null, the root that worktree and the branch `side`

#### Scenario: The person's language
- **WHEN** the same command runs with `--lang pt-BR`
- **THEN** `x`'s reason code is the same and its phrase is the Brazilian Portuguese text of `wrong-branch` in the message table

#### Scenario: One change
- **WHEN** `state --change x` runs in the same setup
- **THEN** the command exits 0 and prints that one entry, equal to `x`'s entry in the list

#### Scenario: The run file weighs first
- **WHEN** the same setup is in a roadmap run whose run file declares an end for `x`, or holds a stage of `x` in flight
- **THEN** `x`'s state follows the run file as for any other change (a declared blocked end gives that end's reason, not `wrong-branch`; a stage in flight gives `running` with that stage), and the board shows the same

#### Scenario: An id nobody knows
- **WHEN** `state --change nope` runs and no checkout holds a folder of `nope`, none holds it archived and the run file does not name it
- **THEN** the command exits 3 with the plain reply and `no change named nope` in its `error` field, and prints no state

#### Scenario: A change the loop can place
- **WHEN** the change's folder is in the main checkout, in the worktree on branch `<id>`, or the change is on its archive branch
- **THEN** its entry is the one the loop's action gives, exactly as before

### Requirement: The archive is checked before a change is listed unplaced
Before the state command lists a change it cannot place as `blocked`, it SHALL check whether the
change is archived on the default branch; when it is and the folder a checkout holds records no
creation day after the archive day (a stale copy), the command SHALL list the change as `archived`,
as it lists an archived change that no checkout holds.

#### Scenario: A change archived on the default branch
- **WHEN** `state --change foo` runs in a main checkout whose default branch is behind `origin`, `origin`'s default branch holds `foo` archived, and `foo`'s active folder, recording no creation day after the archive, is only in a worktree on branch `old-wt`
- **THEN** the command exits 0 and prints `foo` as `archived` with no reason and the title `📦 foo`, not `blocked`

#### Scenario: A new change that reuses an archived id
- **WHEN** the same command runs and that active folder records a creation day after the archive day
- **THEN** the command exits 0 and prints `foo` as `blocked` with the reason `wrong-branch`, its branch `old-wt`

### Requirement: The checkout a change is read in
The loop SHALL read change `<id>` in the worktree on `chore/archive-<id>`, else the worktree on
branch `<id>`, else the checkout it is called from when that checkout holds the change's active
folder and the main checkout holds no folder of the change, else the main checkout.

#### Scenario: Called from a worktree on another branch
- **WHEN** `next --change x` runs in a worktree on branch `side` that holds `openspec/changes/x/`, no worktree is on `x` or `chore/archive-x`, and the main checkout holds no folder of `x`
- **THEN** the loop reads `x` in that worktree and gives its action, and the change run's stop lock in that worktree reads the same action

#### Scenario: The archive worktree wins
- **WHEN** the same call runs while a worktree on `chore/archive-x` exists
- **THEN** the loop reads `x` in the archive worktree

#### Scenario: The change's own worktree wins
- **WHEN** the same call runs while a worktree on branch `x` exists
- **THEN** the loop reads `x` in the worktree on branch `x`

#### Scenario: Called from the main checkout or the change's own worktree
- **WHEN** the call runs in the main checkout, or in the worktree on branch `x`
- **THEN** the loop reads `x` in the same checkout as before this change

#### Scenario: The main checkout holds a folder of the change
- **WHEN** the call runs in a worktree on branch `side` that holds `openspec/changes/x/` while the main checkout holds `x`'s folder, active or archived
- **THEN** the loop reads `x` in the main checkout, as before

#### Scenario: The caller holds only an archived folder
- **WHEN** the call runs in a worktree on branch `side` that holds `x` only under `openspec/changes/archive/`
- **THEN** the loop reads `x` in the main checkout, as before
