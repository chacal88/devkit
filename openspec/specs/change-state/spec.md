# change-state Specification

## Purpose
Gives every surface that shows where a change is (the status board, the session title, the panels)
one answer: the change's state, derived on each read from its files, git, GitHub and the roadmap run
file by the same code that decides the loop's next action, and stored nowhere.

## Requirements

### Requirement: The state command prints one change's state
`change-loop.mjs state --change <id> --lang <l>` SHALL print JSON holding, for that change, its state
(`running`, `waiting-for-owner`, `waiting-on-github`, `blocked` or `archived`), its reason when one
applies (a code and a phrase in the person's language), its stage with the stage's title in the
person's language, the stage icon, the state icon and the session title. It SHALL exit 0, write
nothing, call no AI and print no run marker.

#### Scenario: A change waiting for the plan approval
- **WHEN** `state --change feat --lang en` runs on a change whose plan is reviewed and not yet approved
- **THEN** its entry says `waiting-for-owner`, the reason code `waiting-approval` with the phrase "your approval of the plan", the stage `approval` titled "Owner's approval", the stage icon 📝, the state icon 🙋 and the title `🙋 📝 feat`, and the exit code is 0

#### Scenario: The person's language
- **WHEN** the same command runs with `--lang pt-BR`
- **THEN** the reason's phrase and the stage's title are in Brazilian Portuguese and every code is the same

#### Scenario: Nothing is written
- **WHEN** the command runs in a project with a roadmap run file
- **THEN** `git status`, the run file and the list of worktrees are the same before and after, and a project with no run file still has none

#### Scenario: No run marker
- **WHEN** the command prints a change that is blocked or waiting
- **THEN** its output holds no `devkit-run:` line and no `devkit-end:` line

#### Scenario: A change that does not exist
- **WHEN** `--change` names an id with no folder, no line in the run file and no archived folder
- **THEN** the command exits 3 with the plain reply asking for the request again, and the raw message only in its `error` field

#### Scenario: A usage error
- **WHEN** the command gets an unknown option or a word it does not take
- **THEN** it exits 3 with the plain reply and prints no state

### Requirement: Without a change the command lists every change in play
Without `--change`, the command SHALL print one entry per unfinished change of `/devkit change` (an
open folder under `openspec/changes/` in any checkout, or an archive branch whose pull request is not
merged) and one per change the roadmap run file names in its starts, its changes in flight, its
declared ends, its change sessions or its starts left for the owner's next message, each id once, in
id order, each as for one change.

#### Scenario: Open folders and the run file
- **WHEN** changes `a` and `b` are open in the main checkout, `c` in a worktree, and the run file names `d` as a start handed, `e` as a declared end and `f` as a start left for the owner's next message, none of the three with a folder
- **THEN** the command prints six entries, `a` to `f`, in that order

#### Scenario: What is not listed
- **WHEN** the project holds a `/devkit project` slice, a change archived on the default branch, and the run file announced another change as archived
- **THEN** none of the three is listed

#### Scenario: Nothing in play
- **WHEN** no change is open and the project has no run file
- **THEN** the command prints an empty list and exits 0

### Requirement: The state is the loop's own decision
The state and its reason SHALL come from the action `change-loop.mjs next` gives for the same files
and the same GitHub answers: an end's state and reason are the end's own (a wait on GitHub's reason
is what it waits for), the grill is `waiting-for-owner` with the reason `grill`, a stage or step
handed out is `running` with no reason, and `next` SHALL carry the same state in its action.

#### Scenario: A stage under way
- **WHEN** the loop hands the change's proposal to its agent
- **THEN** the state is `running`, with no reason, the stage `proposal` and the title `📝 <id>`

#### Scenario: The grill
- **WHEN** the loop's action is the grill
- **THEN** the state is `waiting-for-owner`, the reason code is `grill` with the phrase "your answers about its request", and the title is `🙋 ❓ <id>`

#### Scenario: Every end waiting for the owner
- **WHEN** the loop ends waiting for the owner for any reason it can give (the approval, the approval again, an unfinished file no role can finish, a merge by hand, the archive's merge by hand, a disputed review, the retro answers, a delivery by hand)
- **THEN** the state is `waiting-for-owner`, the reason code is the end's own and its phrase is the gate the board names for it

#### Scenario: Every wait on GitHub
- **WHEN** the loop ends waiting on GitHub for the checks, the merge, the archive's merge, or because GitHub did not answer
- **THEN** the state is `waiting-on-github` and the reason code is `checks`, `merge`, `archive-merge` or `silent`, with its phrase

#### Scenario: Every blocked reason
- **WHEN** the loop ends blocked for any reason it can give
- **THEN** the state is `blocked`, the reason code is the end's own, and its phrase is the blocked reason the board shows, with its details

#### Scenario: Archived
- **WHEN** the loop ends archived
- **THEN** the state is `archived`, with no reason, and the title is `📦 <id>`

#### Scenario: The command and next agree
- **WHEN** `next --change <id>` and `state --change <id>` run on the same files with the same GitHub answers, outside a roadmap run
- **THEN** the state in `next`'s action and the command's entry hold the same state, reason, stage and title

### Requirement: The roadmap run file's facts weigh on the state
In a roadmap run the state SHALL follow the run file as the board does: an end the session declared
gives that end; a stage or wait in flight gives `running` or `waiting-on-github`; in a run with a
session per change, a roadmap change with no session of its own, and a change whose start is handed
or waits for the owner's next message, gives `running` with the reason `ready`, "ready, waiting for
someone to continue", and only its stage icon in the title.

#### Scenario: No session of its own
- **WHEN** in a run with a session per change, roadmap change `a` is open, waits for the plan approval and has no session recorded
- **THEN** `a` is `running`, its reason is `ready` with "ready, waiting for someone to continue", and its title is `📝 a`

#### Scenario: A start waiting for a place
- **WHEN** the run file records change `x`, which has no folder yet, as a start handed or left for the owner's next message
- **THEN** `x` is `running` with the reason `ready`, its stage is the opening of the change, and its title is `❓ x`

#### Scenario: A change with its own session
- **WHEN** in the same run change `a` has its session recorded
- **THEN** `a`'s state is the loop's, `waiting-for-owner` at the approval

#### Scenario: A declared end
- **WHEN** the run file holds a blocked end declared for `a` (a stage that could not finish its work) or a wait for the owner's decision on a pull request
- **THEN** `a` is `blocked` with that reason, or `waiting-for-owner` with the reason `waiting-pr-decision`

#### Scenario: Work in flight
- **WHEN** in a run without sessions per change the run file holds a stage of `a` in flight, or a wait on GitHub of `b`
- **THEN** `a` is `running` at that stage and `b` is `waiting-on-github`

#### Scenario: No roadmap run file
- **WHEN** the project has no run file and the loop hands `a`'s proposal to its agent
- **THEN** `a` is plain `running`, with no reason

#### Scenario: A change outside the roadmap
- **WHEN** in a run with a session per change, open change `z` is not a line of the roadmap and has no session
- **THEN** `z`'s state is the loop's, with no `ready` reason

### Requirement: A GitHub that does not answer reads as a wait on GitHub
When the change's stage needs GitHub and GitHub does not answer, the state SHALL be
`waiting-on-github` with the reason `silent`, "GitHub did not answer"; a change whose stage does not
need GitHub SHALL show the state it has with GitHub answering.

#### Scenario: The delivery with GitHub silent
- **WHEN** the change waits on its pull request's checks and every `gh` call fails
- **THEN** the command prints `waiting-on-github`, reason `silent`, "GitHub did not answer", and the title `⏳ 🚀 <id>`

#### Scenario: The grill and the plan with GitHub silent
- **WHEN** every `gh` call fails and the change is at its grill, at a plan stage or at the plan approval, read from a checkout that is not on the change's branch
- **THEN** the command prints the same state, reason and stage as with GitHub answering

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
