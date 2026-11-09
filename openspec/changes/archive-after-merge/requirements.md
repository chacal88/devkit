# Requirements

Classification: domain=process type=feature flags=[architecture, contract] (confirmed)

## Request

Round 3 of `openspec/roadmap.md`, `archive-after-merge`: once a change's PR is merged, the
change is archived without the owner doing it by hand. (Owner, in Portuguese: "Sim, começa",
after the round was described as archiving the change automatically after GitHub's merge.)

## Assumptions

- `ship-change` (`plugins/openspec/skills/ship-change/SKILL.md`) archives, in the session the
  owner typed in. No GitHub Action, no workflow that pushes, no state outside the repository and
  GitHub (ADR 0001 unchanged).
- `deliver-check` (`plugins/openspec/hooks/deliver-check.mjs`) stays the only source of the next
  step: after `merged` it names the archive steps, recomputed from disk and GitHub on every run.
- The archive steps, in order: run the `devkit-core:retro` skill for the change; show its proposed
  doc/rule updates to the owner and stop until the owner approves or rejects each one; move the
  change to `openspec/changes/archive/<YYYY-MM-DD>-<id>/` with `openspec archive`; tick the change's
  line in `openspec/roadmap.md` when listed; apply only the approved proposals; open one archive PR
  with all of it through the `devkit-core:commit-and-pr` agent.
- The archive PR's commit and title follow the existing form:
  `chore(openspec): archive <id> with its retro`. Packs whose files an approved proposal changes
  get their version bump and CHANGELOG line, as for any change.
- Who merges the archive PR follows the schema's `ship` mode (`openspec/config.yaml`, key
  `ship.<schema>`): `merge` → `ship-change` enables auto-merge (same method `merge_method`);
  `pr` → the owner merges. `plan` mode never reaches a PR, so it never archives.
- In `pr` mode, and in `merge` mode when a run ended before GitHub merged, the next `ship-change`
  run sees the change PR merged and continues with the archive steps.
- The run ends at `archived`: the change folder is under `openspec/changes/archive/` on the
  default branch. In `merge` mode, one capped wait for the archive PR (the existing
  `deliver-check --watch` limits); if it has not merged, stop with
  `archive PR open: waiting for <what>` and the next run resumes. In `pr` mode, stop at
  `archive PR ready` for the owner's merge; the next run after that merge reports `archived`.
- No ruleset bypass. The `devkit` ruleset keeps refusing direct pushes to `main` for everyone.
  `docs/adr/0002-merge-without-the-owner-opt-in.md` gets a note that round 3 archives through a
  PR and dropped the bypass (replacing "Accepted until round 3's bypass").
- A failure in any archive step (retro, `openspec archive`, a red check or conflict on the
  archive PR) stops the run naming the step and the reason; nothing is pushed to `main` directly.

## Acceptance criteria

- AC-1: With the change PR merged and the change folder still under `openspec/changes/<id>/` on
  the default branch, `deliver-check <id> --json` names the first archive step (retro) as
  `next.step`, in both `pr` and `merge` mode.
- AC-2: `ship-change` runs the retro and then stops, showing each proposed update; no archive PR
  exists until the owner has answered every proposal.
- AC-3: Only the proposals the owner approved appear in the archive PR's diff; rejected ones stay
  recorded in `retro.md` and change no other file.
- AC-4: The archive PR moves `openspec/changes/<id>/` to `openspec/changes/archive/<date>-<id>/`,
  adds `retro.md`, and ticks the change's line in `openspec/roadmap.md` when it is listed.
- AC-5: In `merge` mode the archive PR has auto-merge enabled with `merge_method`; in `pr` mode it
  does not.
- AC-6: When the archive PR is merged, `deliver-check <id> --json` reports `archived` and
  `ship-change` reports `archived` as the final state.
- AC-7: A failing archive step stops the run with a message naming the step and the reason; no
  commit reaches `main` except through a PR.
- AC-8: The `devkit` ruleset has no bypass actors after this change, and ADR 0002 no longer says
  the direct-push block lasts until round 3.
- AC-9: Dogfood: this change (`archive-after-merge`) is archived by `ship-change` itself — retro,
  the owner's answers, archive PR merged by GitHub in this repository's `merge` mode.

## Out of scope

- A GitHub Action or any CI job that archives, commits or pushes.
- A ruleset bypass for anyone, the owner included.
- Applying retro proposals without the owner's answer.
- Round 4 (`conduct-rounds`) and archiving several changes at once.
- Resolving merge conflicts on the archive PR automatically (stops, as in item 5 today).

## Questions asked

1. [scope] Who archives in round 3? → `ship-change`, in the same session, after `merged`; no
   Action, no bypass.
2. [project rules] What happens to the retro's proposals? → Stop and ask the owner about each one
   before the archive PR.
3. [scope] Who merges the archive PR? → Follows the `ship` mode: GitHub in `merge`, the owner in
   `pr`.
4. [edges] Does it apply in `pr` mode, where the session does not see the merge? → Yes, on the
   next `ship-change` run.
5. [end effect] Final state? → `archived`: archive PR merged; one capped wait in `merge` mode,
   resumable.
6. [project rules] ADR 0002 expects a bypass in round 3. → No bypass; ADR 0002 gets a note.
7. [end effect] Dogfood on this change? → Yes.

## Planning resolutions accepted by the owner

On 2026-11-09 the owner accepted, as a whole, the resolutions R-1..R-11 that the change-planner
recorded in `design.md` where this file was ambiguous or contradicted the code, with the two
explicit answers A and B below (given in Portuguese, through the coordinator):

1. R-1: the archive PR's branch is `chore/archive-<id>`; an archive branch never selects another
   open change in the hooks or in the `devkit-reviews` CI check.
2. R-2: the owner's answers live in the change's `retro.md` (`- Answer:` per proposal),
   uncommitted until the archive PR; a lost checkout means the retro and the questions run again.
3. R-3: in `pr` mode a merged change PR leads to the archive steps instead of `blocked: item 5`;
   `merged` is no longer a final step in any mode.
4. R-4: AC-9's pre-merge part is proven in `evidence.md`, the dogfood's steps in `retro.md`
   (`## Dogfood`), and the archive PR's own merge on GitHub and in `ship-change`'s final `archived`.
5. R-5: the archive PR's auto-merge without 8/8 (gate: the owner's per-proposal answers, the file
   check, the required checks); see answer A.
6. R-6: AC-3 is machine-checked; retro proposals name their targets as backticked repository paths.
7. R-7: approved proposals are applied by `tdd-implementer` (apply-proposals call); `user memory`
   proposals by the main session, outside the diff.
8. R-8: devkit-openspec 0.6.0, devkit-core 0.5.0, marketplace 0.6.0; docs pin `v0.6.0`; the owner
   creates the tag after the merge.
9. R-9: the `merged` step is removed; the `deliver-check` JSON stays `version: 1`.
10. R-10: the dogfood (AC-9) is in `## Workflow follow-up` as plain bullets, since checkboxes would
    hold this change's PR below 8/8.
11. R-11: this change is applied on a branch named `archive-after-merge` (the coordinator renames
    the worktree branch).

Answers:

- A (question 5, R-5): auto-merging the archive PR without 8/8 is a new decision. It is drafted as
  ADR 0003 in `design.md` D10 and written to `docs/adr/0003-auto-merge-the-archive-pr.md` in
  apply; ADR 0002 gets only a pointer to ADR 0003 and the AC-8 bypass note. The ADR file and its
  citations are tasks with an AC reference.
- B (question 4, R-2): keep the answers uncommitted in `retro.md` until the archive PR; the re-ask
  risk is accepted; no early push.

## Escalations

- None open. ADR 0002's consequence line changes (a note): confirmed by the owner in question 6.
  The archive PR's auto-merge is a new decision, ADR 0003 (answer A above).
