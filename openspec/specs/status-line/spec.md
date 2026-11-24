# status-line Specification

## Purpose
Gives the Claude Code session that conducts a change or coordinates a roadmap run one line under its
message box saying where the work stands, read from the change state command and written nowhere.

## Requirements

### Requirement: The session's line is chosen from its input
The status line command SHALL read Claude Code's JSON on standard input: `session_id`, and the folder
from `workspace.current_dir`, else `cwd`, waiting at most 1 second for it. The session whose id the roadmap run file records as its
session shows the counts line; otherwise a folder that is a worktree of a change, on the change's own
branch or its archive branch, shows that change's line; any other session shows nothing.

#### Scenario: The coordinator of a roadmap run
- **WHEN** the input's `session_id` is the session the run file records, whatever its folder
- **THEN** the command prints the counts line

#### Scenario: A change's worktree
- **WHEN** the folder is the worktree of change `feat` on branch `feat`, and the session coordinates no run
- **THEN** the command prints the line of `feat`

#### Scenario: Nothing conducted
- **WHEN** the folder is the main checkout on the default branch and the session coordinates no run, or the folder is not a git checkout, or the project has no `openspec/` folder
- **THEN** the command prints nothing and exits 0

#### Scenario: A branch that is no change
- **WHEN** the folder's branch names no change folder of its checkout, or its HEAD is detached
- **THEN** the command prints nothing and runs no state command

#### Scenario: The change's archive branch
- **WHEN** the folder is the checkout of change `feat` on the branch `chore/archive-feat`, and the state entry of `feat` names that checkout and that branch
- **THEN** the command prints the line of `feat`

#### Scenario: An entry that names another checkout or branch
- **WHEN** the folder's branch names change `feat`, but the state entry of `feat` has another `root` or another `branch`
- **THEN** the command prints nothing and exits 0

#### Scenario: An unknown option
- **WHEN** the command gets an option it does not know
- **THEN** it prints nothing on standard output, one line on standard error, and exits 0

#### Scenario: Missing or broken input
- **WHEN** standard input is empty, a terminal, not JSON, cut off before its end, or JSON without both folder fields
- **THEN** the folder is the command's own working directory and no session coordinates a run

#### Scenario: Input left open
- **WHEN** standard input stays open and nothing is written to it
- **THEN** the command stops waiting after 1 second, reads it as no fields, and exits 0 within a few seconds of its start

### Requirement: The change's line
The line of one change SHALL be its state icon, its stage icon (once when both are the same), its id,
then, separated by ` · `, its stage title, the strip, `<n> of <N>` and, when its state is not
`running`, its reason's text. The strip has one mark per stage that applies: `■` before the current
stage, `◆` for it, `□` after it; N counts those stages and n is the current one's place.

#### Scenario: Waiting for the plan approval
- **WHEN** change `run-status-bar`, whose 15 stages apply, waits for the plan approval
- **THEN** the line is `🙋 📝 run-status-bar · Owner's approval · ■■■■■■■■■◆□□□□□ · 10 of 15 · your approval of the plan`

#### Scenario: Running
- **WHEN** the same change runs its implementation
- **THEN** the line is `🛠️ run-status-bar · Implementation · ■■■■■■■■■■◆□□□□ · 11 of 15`, with no state icon and no reason

#### Scenario: Running with a reason
- **WHEN** the change's state is `running` with the reason `ready` or a held reason
- **THEN** the line carries no reason text

#### Scenario: Blocked, waiting on GitHub, archived
- **WHEN** the change is `blocked`, `waiting-on-github` or `archived`
- **THEN** the line starts with `⛔`, `⏳` or a single `📦`, the first two end with the reason's text, and an archived change shows no strip and no `<n> of <N>`

#### Scenario: A stage outside the list
- **WHEN** the entry's `stages` is `null` or does not hold its stage
- **THEN** the line has no strip and no `<n> of <N>`

### Requirement: The line is at most 100 columns
The line SHALL be at most 100 columns, an emoji counting two and every other character one. A wider
line is cut in order: the reason loses its last words and ends in `…`, keeping its first word; then
the reason and its ` · ` go; then the id is cut at its end with `…`, keeping at least 20 columns of it. The
stage title, the strip and `<n> of <N>` are never cut.

#### Scenario: The reason is cut
- **WHEN** the grill line of `run-status-bar` would be 104 columns
- **THEN** it is `🙋 ❓ run-status-bar · Requirements (grill) · ■◆□□□□□□□□□□□□□ · 2 of 15 · your answers about its…`

#### Scenario: The reason is dropped
- **WHEN** the line is still wider than 100 columns with the reason cut to its first word
- **THEN** the line has no reason and no ` · ` before it

#### Scenario: The id is cut
- **WHEN** the line without its reason is still wider than 100 columns
- **THEN** the id keeps the most leading columns for which the line, with the `…` after them, is at most 100 columns, never fewer than 20 (the `…` not counted in them), and a line that still does not fit is printed as it is

### Requirement: The coordinator's counts
The counts line SHALL be `<n> in play · <n> working · 🙋 <n> waiting on the owner · ⛔ <n> blocked`:
every entry of the state listing read with `--offline`, then those `running`, `waiting-for-owner` and
`blocked`, each count printed even when it is zero. It has no strip and no percentage.

#### Scenario: A mixed run
- **WHEN** the listing holds six changes, three `running`, two `waiting-for-owner` and one `blocked`
- **THEN** the line is `6 in play · 3 working · 🙋 2 waiting on the owner · ⛔ 1 blocked`

#### Scenario: Nothing in play
- **WHEN** the listing is empty
- **THEN** the line is `0 in play · 0 working · 🙋 0 waiting on the owner · ⛔ 0 blocked`

#### Scenario: A state with no count of its own
- **WHEN** a change is `waiting-on-github` or `archived`
- **THEN** it counts in play only

### Requirement: The line is in the person's language
The command SHALL take `--lang en` or `--lang pt-BR`, pass it to the state command and print its own
words in that language (`de` for `of`; `em jogo`, `em andamento`, `aguardando o dono`, `bloqueada` for
one and `bloqueadas` otherwise); the icons, the marks and the numbers are the same in both.

#### Scenario: The same change in Portuguese
- **WHEN** the plan approval line runs with `--lang pt-BR`
- **THEN** it is `🙋 📝 run-status-bar · Aprovação do dono · ■■■■■■■■■◆□□□□□ · 10 de 15 · a sua aprovação do plano`

#### Scenario: The counts in Portuguese
- **WHEN** the mixed run's counts run with `--lang pt-BR`
- **THEN** the line is `6 em jogo · 3 em andamento · 🙋 2 aguardando o dono · ⛔ 1 bloqueada`

### Requirement: The command only reads
The command SHALL read the state only through `change-loop.mjs state`, at most once per run, with a
bound of 20 seconds; it SHALL write nothing, read no transcript and no budget, call no AI, print no
`devkit-run:` or `devkit-end:` line, and exit 0 with nothing printed when the state cannot be read.

#### Scenario: A budget is set
- **WHEN** the project sets a `budget` cap and the input names a transcript
- **THEN** the line has no percentage and no word about the budget, and the transcript is not opened

#### Scenario: Nothing is written
- **WHEN** the command runs in a change's worktree and in the coordinator's session
- **THEN** `git status`, the run file and the list of worktrees are the same before and after

#### Scenario: The state cannot be read
- **WHEN** the state command exits non-zero, prints something that is not its JSON, or runs past 20 seconds
- **THEN** the command prints nothing, exits 0, and no state process is left running

#### Scenario: The run is aborted
- **WHEN** the command receives `SIGTERM`, `SIGINT` or `SIGHUP` while its state command runs
- **THEN** it ends the state command before it exits, so no state process is left running
