<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `remote-worker` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, ADRs 0010, 0011, 0013 and 0014, the "Where a change runs (proposed)"
section of `docs/coordination-design.md`). Round 28 of `openspec/roadmap.md`.

## Why

On 2026-11-21 three changes were opened on a second machine, a Linux worker reached over SSH. Their
folders and branches lived only there. `/devkit status` on the Mac listed them as ready, and a
`/devkit roadmap` run on the Mac would have opened them again. The owner required that no machine
opens a change already open on another one. The owner also asked that a roadmap run use the other
machine the way that run did: over SSH, one app session per change (grill answers 1 and 3).

## What Changes

- **The claim.** Opening a change with `change-loop.mjs open` (`/devkit change` and the roadmap run)
  in a repository with an `origin` remote now commits the change folder and pushes the new branch at
  once. The commit holds `requirements.md` and the machine's name (`x-devkit-machine` in the
  folder's `.openspec.yaml`). The push only creates the branch, so of two machines opening one id at
  once the second is refused. An open whose branch already exists on `origin` is refused, naming the
  machine that holds it, and creates nothing. With no `origin` remote, opening is as today.
  **BREAKING** for every project with a remote: the branch is public from the open on.
- **What is open where.** `/devkit status` and every roadmap decision read the branches on `origin`.
  A roadmap line whose branch exists there and is not open in this clone is open on another
  machine: it is never opened again, never shown as ready, and the board shows it with its machine.
- **The `machines` setting** (devkit-openspec, per person, beside `load_limit`). It is a JSON list of
  the other machines, each with `host` (the app's SSH connection name), `folder` (the repository
  folder there) and `places`. This machine is always first and implicit; its places are the run's
  number (`/devkit roadmap <n>`). Unset, `/devkit roadmap` behaves exactly as today.
- **With `machines` set:**
  - At open, a change goes to the machine with the fewest open changes, ties broken by the
    configured order. This machine is skipped while its processor load is at or above
    `load_limit`, and a machine that does not answer over SSH is skipped too.
  - A change on another machine gets its worktree there over SSH. The coordinating session then
    starts its app session on that machine, through the app's SSH target, on a turn the owner
    typed (ADR 0014 decision 2).
  - A place is taken only from the implementation on: the grill and the plan never wait. Before
    implementing, the change script checks its machine's places. With none free, the change ends
    its turn as ⏳ "waits for a place". With one free, it pushes its approved plan, which takes the
    place on GitHub.
  - When a place frees, the coordinating session messages one ⏳ change of that machine, which
    checks again before implementing.
  - A machine that does not answer gets no new change. The board says "no answer" for it and for
    each of its changes; they keep their places and nothing reopens them.
- **ADR 0016** (proposed here). It amends ADR 0013 (starts held only by this machine's load; the run
  file's fields) and ADR 0014 (each change session started in this machine's worktree).
- Docs, the skill and the release: devkit-openspec 0.22.0, marketplace 0.26.0.

Non-goals (requirements, Out of scope): Claude Managed Agents as a place to run; moving an open
change to another machine; starting a remote change without the desktop app; the app's cloud
sessions as a machine. Also left out: a claim for a `/devkit project` slice (it opens through
`project-loop.mjs`, outside the request: flagged as a follow-up), and an alias joining a machine's
hostname to its SSH connection name (see `design.md` R-4).

## Acceptance criteria

- AC-1 `open-refuses-claimed` — Opening a change whose branch already exists on the GitHub `origin` is refused with a reply naming the change and the machine that holds it, and creates no worktree, no folder and no local branch.
- AC-2 `open-pushes-claim` — Opening a change in a project with a GitHub `origin` leaves `refs/heads/<id>` on `origin` holding the change folder with `requirements.md` and the machine's name, with or without `machines` set.
- AC-3 `open-race-one-wins` — Of two opens of the same id racing from two checkouts against one remote, exactly one ends with a claim; the other is refused and leaves no worktree or local branch.
- AC-4 `no-origin-unchanged` — In a project with no GitHub `origin`, opening a change behaves as today: no push, no refusal.
- AC-5 `status-shows-machine` — `/devkit status` lists every open change of the roadmap, those open only on another machine included, each with its machine, and never lists a change claimed on GitHub as ready.
- AC-6 `roadmap-never-reopens` — A `/devkit roadmap` run never opens a change whose branch exists on `origin`, whichever machine claimed it.
- AC-7 `machines-setting` — With `machines` unset, `/devkit roadmap` places every change on this machine exactly as today; with it set, the run reads each entry's connection name, folder and places, and refuses an entry that lacks one of them with a reply naming the entry.
- AC-8 `open-on-fewest` — At open, the roadmap coordinator puts a change on the reachable machine with the fewest open changes, ties broken by the configured order; this machine is skipped while its processor load is above `load_limit`.
- AC-9 `remote-session-start` — A change placed on a remote machine gets a session started by the coordinating session through the app's SSH target in that change's worktree there, nested under the coordinating session, only on a turn the owner typed.
- AC-10 `place-at-implementation` — A change's grill and plan never wait for a place; after its plan is approved, the change script refuses to start the implementation while its machine has no free place, ending the turn in ⏳ with a line that says it waits for a place, and implements once a place is free.
- AC-11 `wake-on-free-place` — When a place frees on a machine, the coordinating session sends a message to a change of that machine waiting in ⏳, and that change then implements only if the change script finds the place free.
- AC-12 `unreachable-machine` — A machine that does not answer over SSH gets no new change; the board marks it "no answer"; `/devkit status` shows each of its open changes with the machine and "no answer" in place of the stage; its changes keep their places and nothing reopens them elsewhere.

Readings the owner confirms with the plan (`design.md` D-1 and D-9): "GitHub `origin`" in AC-1 to
AC-4 is read as "an `origin` remote", and AC-10 and AC-11 apply only while `machines` is set, so
that AC-7's "exactly as today" holds when it is unset.

Exit criteria: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs`,
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and the marketplace validation
pass; `openspec validate remote-worker --strict` passes. The live record on two machines is not an
exit criterion: the owner decided on 2026-11-23 (`B: depois do merge`, "B: after the merge") that it
runs after the merge, as a workflow follow-up of `tasks.md` recorded through a roadmap line the retro
proposes (`design.md` D-16, R-10).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-coordination`: opening a change claims it on the remote and refuses an id claimed on
  another machine; the implementation waits for a free place on the change's machine.
- `roadmap-coordination`: the `machines` setting; a line open on another machine is never opened
  and the board shows each open change with its machine; where a change opens; a session on another
  machine; a place taken from the implementation on and freed with a message; a machine that does
  not answer; the ⏳ title; the bookkeeping names the changes the run placed on another machine.
- `coordination-locks`: no lock reaches another machine.

## Impact

- `plugins/openspec/hooks/change-loop.mjs`: `openChange` and `openCheckout` (the claim), a
  claim reader, the place check in `decide`/`nextAction`, a `place` subcommand, `stageIcon` (⏳),
  the message table.
- `plugins/openspec/hooks/roadmap-loop.mjs`: the `machines` parser, the claims in `collectRoadmap`
  and `classifyLines`, placement and the `wake` action in `decideRoadmap`, `boardOf`, `status --json`,
  a `checkout` subcommand, the run file's `placed` field.
- `plugins/openspec/hooks/machine-probe.mjs` (new): the program sent over SSH.
- `plugins/openspec/hooks/guard.mjs`: none (the end markers are unchanged).
- `plugins/openspec/skills/devkit/SKILL.md`, `plugins/openspec/.claude-plugin/plugin.json`
  (`userConfig.machines`).
- Tests: `change-loop.test.mjs`, `roadmap-loop.test.mjs`; the existing tests this plan changes are
  named in `design.md` D-14.
- Docs: ADR 0016 (new), Notes and "Amended by" in ADRs 0010, 0011, 0013 and 0014,
  `docs/openspec-flow.md`, `docs/coordination-design.md` (its "Where a change runs (proposed)"
  section, which says the project configures two commands and that state is read with `flow-check
  --json`; both are corrected), `plugins/openspec/README.md`, `openspec/config.yaml` (the ADRs line).
- Release: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `CHANGELOG.md`, `docs/catalog.md`, the pins of `docs/openspec-flow.md`.
- Dependencies: `roadmap-coordinator` and `roadmap-coordinator-followups` (both archived). The
  desktop app's session-start tool with an SSH target, an SSH destination per connection name, and
  the same devkit-openspec version on every machine (`design.md`, Assumptions).
- Decisions cited: ADR 0010 (decisions 3, 5 and 8), ADR 0011 (decision 2; a lock that fails closed
  was rejected), ADR 0013 (decisions 3 and 4), ADR 0014 (decisions 1, 2 and 5), ADR 0006 (decision
  3, no cron). Open decisions inherited: ADR 0016 needs the owner's acceptance with the plan, and so
  do the two escalations of `requirements.md` (the ADR, and a branch made public at open).
