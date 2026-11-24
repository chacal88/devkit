<!-- devkit-stage specs result=passed attempt=3 commit=ccb3dfbe2170e76a9b17224e8dcc98db8ca8ee74 -->
# Spec Delta

## MODIFIED Requirements

### Requirement: A free-text request opens a change
`/devkit change <text>` with no unfinished change SHALL create the change in its own git worktree and
branch named after an id the session proposes, with the script the session chose, write the request
into the requirements file, and reply with the id, the script, the reason and what comes next.

#### Scenario: A new change is opened
- **WHEN** a valid unused id, a script and a reason are given with the request
- **THEN** a worktree on a new branch named after the id exists, its change uses that script, the requirements file holds the request with a pending stage header, no question was asked before it was created, and the reply names the id, the script, the reason and the questions that come next

#### Scenario: The worktree's starting point
- **WHEN** a change is opened in a repository with a remote `origin`
- **THEN** the remote is fetched first and the new branch starts from `origin/<default branch>`

#### Scenario: A repository with no remote
- **WHEN** a change is opened in a repository with no remote
- **THEN** the new branch starts from the main checkout's current commit

#### Scenario: Opening in a project not set up, or with an unknown setting
- **WHEN** the opening step itself runs in a project that is not set up for devkit, or whose driver or files' language setting is unknown, or whose driver is not built
- **THEN** nothing is created, the reply is the one the typed command gives for that case, and the exit code is 3

#### Scenario: An id that cannot be a change name
- **WHEN** the proposed id is not 2 to 48 characters of lowercase letters, digits and dashes, starts or ends with a dash, holds two dashes in a row, or is `archive`
- **THEN** nothing is created and the reply says the name cannot be used

#### Scenario: Opening fails half-way: nothing is left behind and the same name can be opened again
- **WHEN** opening fails after the worktree and its branch were created (the OpenSpec command that creates the change fails, or the script's requirements template is missing or has no request section)
- **THEN** the command exits 3, the worktree, its folder and the branch it created are gone, each removed on its own so that one failed removal does not skip the next, and opening the same id again once the cause is fixed creates the change

#### Scenario: An id already in use
- **WHEN** a change folder, archived change, branch, archive branch or worktree already has the proposed id, or a branch of that name on `origin` holds no change folder of that id
- **THEN** nothing is created and the reply says the name is taken

#### Scenario: An id open on another machine
- **WHEN** a branch of the proposed id exists on `origin` and holds that change's folder
- **THEN** the opening is refused as the requirement "An id open on another machine is refused" says, not as a taken name

## ADDED Requirements

### Requirement: Opening a change claims it on the remote
In a repository with an `origin` remote, opening a change SHALL commit the new change folder, holding
the requirements file and the name of the machine that opened it, and push the new branch to `origin`
before it replies. The push SHALL only create the branch: it never overwrites one. With no `origin`
remote, opening SHALL commit and push nothing, as before.

#### Scenario: The claim is on the remote
- **WHEN** change `a` is opened in a repository with an `origin` remote, with or without the person's machines setting
- **THEN** `origin` has the branch `a`, its last commit holds `openspec/changes/a/requirements.md` and the change's metadata file naming the machine, and the local branch `a` is that same commit

#### Scenario: The machine's name
- **WHEN** a change is opened by `/devkit change`, or by a roadmap run for this machine
- **THEN** the machine named in the claim is this machine's hostname, up to its first dot

#### Scenario: A change opened for another machine
- **WHEN** a roadmap run opens a change for the machine listed as `avel` in the person's machines setting
- **THEN** the claim names `avel`, and no worktree or local branch of the change is left on the machine that opened it

#### Scenario: A machine name or a places value that is not valid
- **WHEN** the opening is given a machine name that is not 1 to 64 letters, digits, dots, underscores or dashes starting with a letter or a digit, a number of places that is not a whole number from 1 to 99 or `run`, or the remote opening without a machine name
- **THEN** the command exits 3 with the reply of a request it could not read, and nothing is created, committed or pushed

#### Scenario: No remote
- **WHEN** a change is opened in a repository with no `origin` remote
- **THEN** no commit is made, nothing is pushed, and the change is created as before

#### Scenario: A push that fails for another reason
- **WHEN** the push of the claim fails because the remote cannot be reached
- **THEN** the command exits 3, and the worktree, its folder and the local branch are removed as for any opening that fails half-way

### Requirement: An id open on another machine is refused
Opening a change whose branch already exists on `origin` with that change's folder SHALL be refused
with a reply naming the change and the machine its claim names, or saying another machine when the
claim names none. Nothing SHALL be created: no worktree, no folder and no local branch.

#### Scenario: Claimed by another machine
- **WHEN** `a` is opened on the Mac while `origin` holds the branch `a` whose claim names `avel`
- **THEN** the command exits 3, the reply names `a` and `avel` and says to continue it there or pick another name, and the Mac has no worktree, folder or branch `a`

#### Scenario: A branch from before the claim
- **WHEN** `a` is opened while `origin` holds the branch `a` with `a`'s folder but no machine's name in it
- **THEN** the command exits 3 and the reply names `a` and says it is open on another machine

### Requirement: Of two machines opening one id, one wins
When two clones of one repository open the same id at once against one `origin`, exactly one SHALL
end with its claim on `origin`. The other SHALL be refused as an id open on another machine, naming
the winner's machine, and SHALL leave no worktree, folder or local branch behind.

#### Scenario: The other clone pushed first
- **WHEN** clone A has checked that `origin` has no branch `a`, and clone B opens `a` and pushes its claim before clone A pushes
- **THEN** clone A's push is refused by the remote, clone A exits 3 naming `a` and B's machine, clone A has no worktree, folder or branch `a`, and `origin`'s branch `a` is B's claim

#### Scenario: Both at the same moment
- **WHEN** clones A and B start opening `a` at the same moment
- **THEN** exactly one of them exits 0, the other exits 3 with the reply of an id open on another machine, and `origin`'s branch `a` is the claim of the one that exited 0

### Requirement: The implementation waits for a free place on its machine
A change whose claim records its machine's places SHALL take a place before its first step from the
implementation on. With no free place on its machine, the loop SHALL end as blocked, waiting for a
place, naming the machine and how many places are taken. The grill and the plan SHALL never wait for
a place. A change whose claim records no places SHALL never wait.

#### Scenario: No free place
- **WHEN** change `c` on `avel`, whose claim records 1 place, has its plan approved while change `b` on `avel` holds that place
- **THEN** `c`'s next action is a blocked end waiting for a place, its reply says `c` waits for a free place on `avel` with 1 of 1 taken, its icon is ⏳, and no implementation step is handed

#### Scenario: A free place
- **WHEN** change `c` on `avel`, whose claim records 2 places, has its plan approved while one place on `avel` is held
- **THEN** `c`'s next action is the step that takes the place; once it ran, `origin`'s branch `c` holds `c`'s approved plan and the next action is the first implementation step

#### Scenario: The grill and the plan
- **WHEN** change `c` on a machine whose every place is held is at its grill or its plan
- **THEN** its next action is that stage, as for any change

#### Scenario: A change that records no places
- **WHEN** a change opened by `/devkit change`, or with the person's machines setting unset, reaches its implementation
- **THEN** its implementation starts as before, with no place taken or checked

#### Scenario: A place already taken
- **WHEN** change `c` took its place and comes back to an implementation step after its review
- **THEN** no place is checked again and the step is handed

### Requirement: Taking a place is checked again and serialized per machine
The step that takes a place SHALL count the places held on its machine from `origin` again, under a
lock shared by every checkout of the clone, and take the place only when one is free. A place SHALL be
held by a change whose branch on `origin` names that machine and holds its approved plan, until the
change is archived on the default branch or its branch leaves `origin`.

#### Scenario: Two changes of one machine at once
- **WHEN** changes `c` and `d` on `avel`, whose claims record 1 place, run the step that takes a place at the same moment with no place held
- **THEN** exactly one of them takes the place, and the other's next action is the blocked end waiting for a place

#### Scenario: A message that comes too early
- **WHEN** change `c` is told a place is free but every place on its machine is held when it runs its next action
- **THEN** its next action is the blocked end waiting for a place, and no implementation step is handed

#### Scenario: A change archived frees its place
- **WHEN** change `b`, holding `avel`'s only place, is archived on the default branch
- **THEN** a change of `avel` waiting for a place finds the place free at its next action
