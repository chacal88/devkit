<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> a `/devkit project` slice is a change on `devkit-project`; today `open` claims a change on `origin` when it opens, but a slice opened through `project-loop.mjs` shares `openCheckout` and takes no claim, so two machines can still open the same slice. Make the slice open take the same create-only claim (branch pushed at once with the machine name in `.openspec.yaml`), refuse a slice already claimed, and show it in `/devkit status` and the roadmap with its machine; the claim keys are written before the version pin, as `remote-worker` does (remote-worker retro, `design.md` Non-Goals)

## Grill

Classification: domain=process type=feature flags=[contract] (strict-assumed, script devkit)

### Answered by triage

1. [scope] With no `origin` remote a slice open behaves as today, no push and no refusal → yes: the claim keys and the push run only `if (hasOrigin && claim)` (source: `plugins/openspec/hooks/change-loop.mjs:2015-2042`; `openspec/changes/archive/2026-11-23-remote-worker/design.md:127-129`)
2. [end effect] After `open <slice>` with an `origin`, `refs/heads/<slice>` holds `openspec/changes/<slice>/.openspec.yaml` with the machine key, pushed by a create-only push in a commit `chore(openspec): open <slice>`, and the claim keys come before the pin keys → the change path already does this and a slice passing `claim` gets the same (source: `plugins/openspec/hooks/change-loop.mjs:2036-2042`, `:2062-2080`; `plugins/openspec/hooks/project-loop.mjs:445`)
3. [edges] A slice's delivery push and archive-on-branch do not collide with a branch pushed at open: the delivery pushes fast-forward from the open commit (source: `plugins/openspec/hooks/project-loop.mjs:209-238`; `plugins/core/agents/commit-and-pr.md:40`)
4. [edges] The slice contract of `devkit-reviews` and the `gh pr create` hook accepts the claim keys and the open commit: it reads only the `schema:` line, the net diff paths and the later design or ADR commits (source: `plugins/openspec/hooks/guard.mjs:222-229`, `:283-290`, `:327-336`, `:1076-1082`; `plugins/openspec/hooks/deliver-check.mjs:2192-2193`)
5. [scope] Today neither `/devkit status` nor the roadmap lists a slice, and a slice open only on another machine appears nowhere; `project-loop.mjs status <slice>` prints no machine → (source: `plugins/openspec/hooks/roadmap-loop.mjs:689-711`; `plugins/openspec/hooks/change-loop.mjs:1581-1594`; `plugins/openspec/hooks/project-loop.mjs:584-605`; `openspec/specs/project-definition/spec.md:265-281`; `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md:47-49`)

### Questions asked

1. [project rules] The request asks to show a slice's claim in `/devkit status` and the roadmap with its machine; ADR 0015 and the `project-definition` spec say the change and roadmap commands never see a slice. Where is the machine shown: (A) only on the slice (its readout and the refusal), the board and the roadmap stay as they are; (B) also a separate list on the `/devkit status` board, with an amendment of ADR 0015 and the spec? → **A**: only on the slice, the owner's answer (session `project-slice-claim`, 2026-11-23).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The claim is taken by `openSlice` in `plugins/openspec/hooks/project-loop.mjs`, which passes `claim: { machine: thisMachine(), places: null }` to `openCheckout` in `plugins/openspec/hooks/change-loop.mjs`; the claim code of `openCheckout` is reused, not copied.
- A slice takes the machine name only: no `x-devkit-places` key, no place, and no `--machine`, `--places` or `--remote` option on `project-loop.mjs open` (those belong to a roadmap run, which never opens a slice).
- The claim applies when the project has an `origin` remote, as ADR 0020 decision 1 says; with none, a slice opens as today.
- The refusal of a slice already on `origin` reuses the existing keys `claimed` and `claimed-elsewhere` (`plugins/openspec/hooks/change-loop.mjs#refuseRemote`); no slice-specific text is added. A branch of that name with no change folder keeps `name-taken`.
- The refusal comes from `open`, which runs before any phase conversation of the slice, so the owner is not asked a design question for a slice that is already claimed.
- `project-loop.mjs status <slice>` shows the machine read from the slice folder's `.openspec.yaml` (`x-devkit-machine`), and shows none for a slice with no such key.
- `/devkit status`, the roadmap lines and `roadmap-loop.mjs` stay as they are, and ADR 0015 keeps saying that the change and roadmap commands never see a slice. A slice open only on another machine is shown nowhere but by the refusal of an `open` of its name.
- The claim is a decision to record as a Note on ADR 0020 (and ADR 0015 if the decisions stage finds it needed); the decisions stage decides the form, as `openspec/config.yaml` says.
- A slice's branch is public from its open, as a change's branch is since `remote-worker` (ADR 0020, Consequences).

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `slice-open-pushes-claim`: `node plugins/openspec/hooks/project-loop.mjs open <slice>` in a project with an `origin` leaves `refs/heads/<slice>` on `origin` holding `openspec/changes/<slice>/.openspec.yaml` with `x-devkit-machine: <this machine>` and no `x-devkit-places`, in a commit `chore(openspec): open <slice>`, and the local worktree stays.
- AC-2 `claim-keys-before-pin`: in that `.openspec.yaml` the `x-devkit-machine` line comes before `x-devkit-version` and `x-devkit-flow`, which remain the last lines of the file.
- AC-3 `slice-open-refuses-claimed`: `open <slice>` for a slice whose branch is on `origin` exits 3 with a reply naming the machine (`claimed`; `claimed-elsewhere` when the folder holds no machine) and creates no worktree, no folder and no local branch.
- AC-4 `slice-open-race-one-wins`: of two opens of the same slice racing from two clones against one remote, exactly one ends with the claim; the other is refused as in AC-3 and leaves no worktree or local branch.
- AC-5 `slice-no-origin-unchanged`: in a project with no `origin` remote, `open <slice>` pushes nothing, refuses nothing and writes no claim key.
- AC-6 `slice-status-shows-machine`: `project-loop.mjs status <slice>` prints the machine of the slice's claim; for a slice whose `.openspec.yaml` has no machine key it prints no machine line and nothing else changes.
- AC-7 `board-never-lists-slices`: `/devkit status` and the roadmap still list no slice, claimed or not, and `openspec/specs/project-definition/spec.md` keeps its requirement that they never do.
- AC-8 `slice-delivery-unchanged`: a claimed slice runs on to its pull request as before: the slice contract (`sliceProblems`) passes with the claim keys and the open commit in its history, and the delivery push is a fast-forward of the claimed branch.
- AC-9 `claim-shared-code`: the slice and the change take the claim from the same `openCheckout` code, with the claim keys written before the pin; no second copy of the claim steps exists in `project-loop.mjs`.

## Out of scope

- Showing a slice open on another machine in the `/devkit status` board or in the roadmap (the owner's answer; ADR 0015 keeps holding).
- Places, `--machine`, `--places` and `--remote` for a slice, and any placement of a slice on a machine by a roadmap run.
- Resuming or continuing a slice from another machine than the one that claimed it.
- A refusal text written for slices alone.
- Claims for the archive branch of a change or a slice.
