# ADR 0029: A project slice is claimed on GitHub when it opens, as a change is

- Status: accepted
- Accepted by: the owner, on 2026-11-23, in the approval of the plan of change project-slice-claim (openspec/changes/project-slice-claim/approval.md)
- Date: 2026-11-23
- Change: project-slice-claim
- Amends: ADR 0015 (0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md), decision 1,
  the slice's branch, which becomes public at the slice's open; ADR 0020
  (0020-a-change-can-run-on-another-machine.md), decision 1, whose claim at open now also covers a
  slice opened by `/devkit project`

## Context

ADR 0020 decision 1 makes the open of a change, in a repository with an `origin` remote, commit the
change's folder with the machine's name and push its branch at once by a push that only creates it;
a branch already on `origin` with the change's folder refuses the open and names the machine. The
change that built it (`remote-worker`) left a `/devkit project` slice out on purpose (its design's
Non-Goals): a slice opens through `project-loop.mjs`, which shares `openCheckout` but passes no
claim. So two machines can still open the same slice, and nothing tells the second one.

ADR 0015 decision 1 makes a slice an OpenSpec change on `devkit-project`, in its own worktree and
branch, delivered in one pull request; today its branch reaches `origin` only at that pull request.
ADR 0015's Consequences also say the change and roadmap commands never see a slice.

The owner asked for the same claim on a slice, and chose, in the grill of `project-slice-claim`
(question 1, answer A), to show the claim's machine only on the slice itself (its readout and the
refusal of a second open), leaving `/devkit status` and the roadmap as they are.

## Decision

1. ADR 0020 decision 1 applies to a slice: `/devkit project`'s open of a slice, in a repository
   with an `origin` remote, commits the slice's folder with the machine's name and pushes its branch
   at once, by a push that only creates it, in a commit `chore(openspec): open <slice>`. The claim
   keys are written before the version pin, which stays last. The slice takes the claim through the
   same code as a change; there is no second copy of the claim steps.
2. A slice claims a machine only: no places, and no option to place a slice on another machine.
   Places and machines stay a roadmap run's (ADR 0020 decisions 2 to 5), and a roadmap run never
   opens a slice.
3. A slice whose branch is already on `origin` with its folder refuses the open with ADR 0020's
   refusal (naming the machine, or saying another machine when the folder names none), and leaves no
   worktree, folder or local branch. A branch of that name with no slice folder keeps the name-taken
   refusal. The refusal comes before any phase conversation.
4. With no `origin` remote, a slice opens as before: no push, no refusal, no claim key.
5. The slice's own readout (`project-loop.mjs status <slice>`) shows the machine of its claim. ADR
   0015 is otherwise unchanged: `/devkit status`, the roadmap and the roadmap commands still never
   see a slice, claimed or not, and the slice's delivery, its contract in `devkit-reviews` and the
   `gh pr create` hook are unchanged; the delivery push is a fast-forward of the claimed branch.
6. The rest of ADR 0015 and ADR 0020 is unchanged.

## Consequences

- Positive: no machine opens a slice already open on another one; the second open is refused before
  the owner spends a phase conversation on it. One claim rule serves changes and slices.
- Negative: a slice's branch is public from its open, not from its pull request, as a change's is
  since ADR 0020 (Accepted: the owner asked for the claim, and ADR 0020 accepted the same exposure
  for changes). A slice open only on another machine is shown nowhere but by the refusal of an open
  of its name (Accepted: the owner's answer A; ADR 0015 keeps the board free of slices). A slice
  cannot be continued on a machine other than the one that claimed it (Accepted: out of scope, as
  for a change under ADR 0020 decision 3).

### Review trigger

A slice is found open on two machines; the owner asks to see slices on the `/devkit status` board or
the roadmap; a roadmap run starts opening slices; GitHub stops honouring a push's expected old value.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Show claimed slices in a separate list on the `/devkit status` board (grill question 1, B) | A slice open elsewhere is visible before an open | Amends ADR 0015's "never see a slice" and the `project-definition` spec; the owner chose A | low |
| A claim step of its own in `project-loop.mjs` | No change to the shared open path | A second copy of the claim steps that can drift from ADR 0020's; the request asks for the same claim | low |
| Places and `--machine`/`--places` for a slice | Same options as a change | A slice runs in the owner's session (ADR 0015 decision 2), never placed by a run | low |
| A draft pull request or a `refs/devkit/claims/<slice>` ref as the claim | No branch before the pull request | Both rejected by ADR 0020 for changes; a second record beside the branch | medium |
| Leave slices unclaimed (today) | No public branch before the pull request | Two machines can open the same slice, which the owner asked to prevent | low |
