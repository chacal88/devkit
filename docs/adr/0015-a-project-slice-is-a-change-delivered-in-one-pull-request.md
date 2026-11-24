# ADR 0015: A project slice is a change on the devkit-project script, delivered in one pull request that the ADR reviewer clears

- Status: accepted
- Amended by ADR 0029 (0029-a-project-slice-is-claimed-on-github-when-it-opens.md)
- Date: 2026-11-21
- Change: project-phases
- Amends: ADR 0010 (0010-openspec-as-the-harness.md), the open point of decision 8 on whether the
  hooks also act under `devkit-project`; ADR 0012 (0012-the-reviews-check-follows-the-change-script.md),
  decisions 1 and 3, for `devkit-project` only
- Accepted by: the owner, on 2026-11-22, in the message that approved the plan of the change: `Aprovo` ("I approve"), given in answer to the question, asked in the same message that listed this ADR first among the items the owner approves, `Você aprova o plano e o ADR 0014, ou quer ajustar alguma coisa?` ("Do you approve the plan and ADR 0014, or do you want to adjust something?"); recorded in `openspec/changes/project-phases/approval.md`

## Context

ADR 0010 decision 1 names a `devkit-project` schema for the four design phases and decision 2 a
project entry that ends in the roadmap; its decision 8 leaves "whether the hooks also act under
`devkit-project`" to round 19. The owner decided in the grill of `project-phases` (2026-11-21): each
slice's documents in `docs/design/<slice>/`, ADRs in the ADR folder; any phase may not apply; the
roadmap written only after the owner approves the rounds; one pull request at the end, cleared by the
ADR reviewer alone, merged by GitHub once the checks pass; the phases in the session the command was
typed in; a flat `docs/design/` untouched. ADR 0012 makes `devkit-reviews` pass every schema but
`devkit` and `devkit-lite` with a note, active or archived, so a slice's pull request would merge on no
check of its review. ADR 0003's archive pull request needs a retro the owner's flow does not have.

## Decision

1. A slice is an OpenSpec change on `devkit-project`, named after the slice, in its own worktree and
   branch. Its folder holds one stage record per stage; the phase documents live in
   `docs/design/<slice>/`.
2. The phases are conversations in the session the owner typed `/devkit project` in; the only stages
   handed to subagents are the ADR review and the commits and pull request.
3. Hooks: the project-level opt-in of ADR 0004 is unchanged and `devkit-project` does not opt a
   project in. In a slice's checkout the edit and bash gates act as for any change; with no readiness
   stage, no path is closed. The run locks of ADR 0011 and ADR 0013 do not hold a `/devkit project`
   run.
4. The slice's folder is archived on its branch before its one pull request; no folder of the slice
   stays active on the default branch, and no archive pull request or retro follows.
5. `devkit-reviews` judges a slice's archived folder, and fails a selected active slice, by a slice
   contract: every stage record passed or not applicable, the ADR reviewer's verdict approved and
   current, the pull request's files only the slice's documents, the ADR folders, the roadmap
   (appended to, or untouched when the roadmap stage does not apply) and the archived folder. The
   `gh pr create` hook applies the same contract. This amends ADR 0012 decisions 1 and 3 for
   `devkit-project` only.
6. The pull request follows `ship: devkit-project:` as any script follows its entry (ADR 0002
   unchanged): auto-merge only in `merge` mode, on a default branch that requires `devkit-reviews`.

Note (project-slice-claim, 2026-11-23): [ADR 0029](0029-a-project-slice-is-claimed-on-github-when-it-opens.md)
makes a slice's branch public at its open: with an origin remote, the open commits the slice's
folder with the machine's name and pushes the branch by a push that only creates it, and refuses a
slice already open on another machine. The change and roadmap commands still never see a slice.
The status and the decisions above stay.

## Consequences

- Positive: a slice reaches the default branch in one pull request with a check anyone can read; the
  roadmap coordinator finds its rounds; the change and roadmap commands never see a slice; the hooks'
  question of ADR 0010 is answered without a new lock.
- Negative: the light review reads ADRs, not the documents' quality (Accepted: the owner approves each
  phase). A session that stops mid-slice is not held (Accepted: `/devkit project <slice>` resumes from
  the files). The slice contract knows the six record names without reading the schema (Mitigated: a
  test pins them to `flow.json`). A pull request that brings a slice and anything else fails
  (Accepted: one slice, one pull request). Two slices appending to the roadmap at once conflict
  (Mitigated: the loop ends blocked naming the conflicting pull request; rare with one owner).

### Review trigger

A slice's pull request merges with a stage record not settled or a review not current; the owner asks
for a fuller review of slices; OpenSpec changes how `archive` or `skip_specs` behave.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| The slice's progress only in `docs/design/<slice>/`, no OpenSpec change | No OpenSpec folder | ADR 0010 decision 1 names the schema; a second walker; no `openspec status` | medium |
| Archive after the merge, in an archive pull request (ADR 0003) | The usual path | Two pull requests against the owner's one; a retro the flow does not have | low |
| Leave the slice's folder active on the default branch | No archive step | `/devkit change`, `/devkit roadmap` and the panel would list it forever | low |
| The full review bench on a slice's pull request | The usual contract | Not asked for; the owner chose the ADR reviewer alone (grill question 4) | low |
| Keep ADR 0012's note for `devkit-project` | No CI change | The light review would rest on the session's word; ADR 0002 merges on the check | low |
| Run locks for `/devkit project` | A session held to the flow | The session writes the documents itself, so the edit lock cannot apply; every phase ends at an owner gate | medium |
| `devkit-project` as an opt-in schema (in `DEVKIT_SCHEMAS`) | One list | A project choosing it as its default would get no change flow; ADR 0004's opt-in is the project's default schema | low |
