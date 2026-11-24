<!-- devkit-stage proposal result=passed attempt=2 commit=bbb831f9b6dc488a64d519a4d02d3e05ab521e9d -->
# Proposal

Change: `project-slice-claim` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md` and ADR 0022, ADRs 0015 and 0020, the archived
`remote-worker` change whose design left the slice out in its Non-Goals).

## Why

Since `remote-worker` (ADR 0020), opening a change in a repository with an `origin` remote pushes its
branch at once with the machine's name, so no second machine can open it. A `/devkit project` slice
opens through `project-loop.mjs open`, which shares the open path but passes no claim: its branch
reaches `origin` only at its pull request, so two machines can open and plan the same slice and
nothing tells the second one.

## What Changes

- **The claim at a slice's open.** `project-loop.mjs open <slice>` in a repository with an `origin`
  remote now commits the slice's folder with this machine's name (`x-devkit-machine` in its
  `.openspec.yaml`, written before the version pin) in a commit `chore(openspec): open <slice>`, and
  pushes the branch at once by a push that only creates it. This is the same code a change's open
  runs; `project-loop.mjs` gets no copy of it. A slice takes the machine only: no places, and no
  `--machine`, `--places` or `--remote` option. **BREAKING** for a project with a remote: a slice's
  branch is public from its open, not from its pull request, and a remote that answers the fetch but
  refuses the new branch (a read-only token, a ruleset on branch names) now fails the open: exit 3
  with the existing `project-unreadable` reply, as a change's open gives `request-unreadable` for the
  same failure, and nothing left here or on `origin` (`design.md` D-2).
- **The refusal.** An open of a slice whose branch is already on `origin` with its folder is refused
  with the existing `claimed` reply (naming the machine) or `claimed-elsewhere` reply (when the
  folder names none), and creates nothing. Of two machines opening one slice at once, exactly one
  wins. The refusal comes from `open`, so it comes before any phase conversation.
- **No remote, no change.** With no `origin` remote, a slice opens as before: no commit, no push, no
  claim key.
- **The slice's readout** (`project-loop.mjs status <slice>`) gains one line naming the machine of
  the slice's claim, right after its title; a slice with no claim key shows no such line.
- **Unchanged on purpose** (the owner's grill answer A): `/devkit status`, the roadmap lines and the
  roadmap commands still never list a slice, claimed or not. The slice's delivery, its contract in
  `devkit-reviews` and the `gh pr create` hook are unchanged: the delivery push fast-forwards the
  claimed branch.
- **Decisions.** ADR 0022 (written by the decisions stage, `decisions.md`) amends ADR 0015 decision 1
  and ADR 0020 decision 1. ADR 0015 and ADR 0020 gain their `Amended by` line and a Note.
- Documents and the release: `docs/openspec-flow.md` (the project section, including a sentence
  about `/devkit status` and the slice readout that is wrong today), `docs/coordination-design.md`,
  `openspec/config.yaml`, a devkit-openspec minor release and a marketplace minor release.

Non-goals (requirements, Out of scope): showing a slice open on another machine in `/devkit status` or
the roadmap; places and `--machine`, `--places`, `--remote` for a slice; continuing a slice on a
machine other than the one that claimed it; a refusal text for slices alone; claims for archive
branches.

## Acceptance criteria

- AC-1 `slice-open-pushes-claim`: `node plugins/openspec/hooks/project-loop.mjs open <slice>` in a project with an `origin` leaves `refs/heads/<slice>` on `origin` holding `openspec/changes/<slice>/.openspec.yaml` with `x-devkit-machine: <this machine>` and no `x-devkit-places`, in a commit `chore(openspec): open <slice>`, and the local worktree stays.
- AC-2 `claim-keys-before-pin`: in that `.openspec.yaml` the `x-devkit-machine` line comes before `x-devkit-version` and `x-devkit-flow`, which remain the last lines of the file.
- AC-3 `slice-open-refuses-claimed`: `open <slice>` for a slice whose branch is on `origin` exits 3 with a reply naming the machine (`claimed`; `claimed-elsewhere` when the folder holds no machine) and creates no worktree, no folder and no local branch.
- AC-4 `slice-open-race-one-wins`: of two opens of the same slice racing from two clones against one remote, exactly one ends with the claim; the other is refused as in AC-3 and leaves no worktree or local branch.
- AC-5 `slice-no-origin-unchanged`: in a project with no `origin` remote, `open <slice>` pushes nothing, refuses nothing and writes no claim key.
- AC-6 `slice-status-shows-machine`: `project-loop.mjs status <slice>` prints the machine of the slice's claim; for a slice whose `.openspec.yaml` has no machine key it prints no machine line and nothing else changes.
- AC-7 `board-never-lists-slices`: `/devkit status` and the roadmap still list no slice, claimed or not, and `openspec/specs/project-definition/spec.md` keeps its requirement that they never do.
- AC-8 `slice-delivery-unchanged`: a claimed slice runs on to its pull request as before: the slice contract (`sliceProblems`) passes with the claim keys and the open commit in its history, and the delivery push is a fast-forward of the claimed branch.
- AC-9 `claim-shared-code`: the slice and the change take the claim from the same `openCheckout` code, with the claim keys written before the pin; no second copy of the claim steps exists in `project-loop.mjs`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-definition`: "The project command opens a slice" gains the claim on `origin`, the
  refusal of a slice open on another machine, the race, a push that fails for another reason and the
  no-remote case; "The slice readout
  shows the five stages" gains the machine line; "A slice is not a change of the other commands"
  gains a scenario for a slice claimed on `origin` (its rule is unchanged).

`change-coordination` ("Opening a change claims it on the remote" and the two requirements after it)
is referenced, not modified: its behaviour for changes does not change (`design.md` D-1).

## Impact

- Hooks: `plugins/openspec/hooks/project-loop.mjs` (`openSlice` passes the claim; `readFacts` and
  `statusText` read and show the machine); `plugins/openspec/hooks/change-loop.mjs` (one message key
  in both languages; `openCheckout` itself is unchanged).
- Tests: `plugins/openspec/hooks/project-loop.test.mjs` (new tests, and the one existing readout test
  whose expected lines gain the machine line, `design.md` D-6).
- Skill: none (`plugins/openspec/skills/devkit/SKILL.md` already says the `reply` of any exit 3 of
  `open` and ends the turn).
- Documents: ADR 0015 and ADR 0020 (header line and Note), `docs/openspec-flow.md`,
  `docs/coordination-design.md`, `openspec/config.yaml`.
- Release: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `CHANGELOG.md`, `docs/catalog.md`.
- Systems: every project with an `origin` remote that uses `/devkit project`: the slice's branch is
  pushed at its open. No CI file and no workflow changes.

Exit criteria: the phase gates of `tasks.md`, the whole suite `node --test
plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`, `python3 scripts/gen-catalog.py
--check`, `claude plugin validate .` and `openspec validate project-slice-claim --strict`.

Decisions cited: ADR 0015 (decision 1 and its Consequences), ADR 0020 (decisions 1 and 3), ADR 0022
(proposed, `decisions.md`). Open decisions inherited: none (the repository keeps no open-decisions
log; ADR 0022 is accepted by the `accept-decisions` step after the owner approves the plan).
