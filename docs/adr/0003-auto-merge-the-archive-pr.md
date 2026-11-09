# ADR 0003: Auto-merge the archive PR without the delivery contract

- Status: accepted
- Date: 2026-11-09
- Change: archive-after-merge

## Context

This ADR builds on ADR 0001 and ADR 0002 and leaves both decisions unchanged. Under ADR 0002,
`ship-change` enables auto-merge on a change PR only when `deliver-check` reports 8/8, and
`devkit-reviews` re-checks reviews, findings, gates and acceptance proof at the PR head. Round 3
(`archive-after-merge`) archives a change after its PR merges: the retro, the owner's answer to
each of its proposals, `openspec archive`, the roadmap tick and the approved proposals land in
one archive PR on `chore/archive-<id>`. The `devkit` ruleset refuses direct pushes to the default
branch for everyone, and the owner ruled out a bypass. An archive PR has no delivery contract:
no tasks, no reviews, no acceptance criteria. `devkit-reviews` selects no change on it and passes
with a note. Yet it can change product files, because approved proposals edit docs, agents and
tests.

## Decision

In `merge` ship mode, `ship-change` enables GitHub's auto-merge on the archive PR, with the
project's `merge_method`, pinned to the head `deliver-check` checked (`--match-head-commit`),
when `deliver-check` reports that PR open with no merge conflict, no failing or cancelled
check, its head equal to the local head, nothing uncommitted, not behind its base, and no
changed file outside `openspec/` that an owner-approved retro proposal does not name (version
manifests, CHANGELOG and the generated catalog excepted). It disables auto-merge as soon as one
of those stops holding. The gate for that PR is the owner's explicit answer to each proposal,
recorded in `retro.md` before the PR exists, together with the ruleset's required checks.
GitHub performs the merge; nothing pushes to the default branch. In `pr` mode the owner
merges the archive PR. In `plan` mode no change reaches a PR, so there is nothing to archive.

## Consequences

- Positive: a change goes from merged to archived without the owner's merge; no ruleset
  bypass exists for anyone; every archive commit is a reviewable PR on GitHub.
- Negative: approved proposals land without a code review (Accepted: the owner approved each
  one by name and the file check refuses anything else; `check` runs the suite on the PR).
  `devkit-reviews` gates nothing on an archive PR (Accepted: it has no change to check; the
  hooks and CI never select another change from an archive branch). The owner's answers live
  uncommitted in `retro.md` until the archive PR, so a lost checkout means asking again
  (Accepted by the owner). Between skill runs GitHub merges on required checks alone
  (Mitigated, as in ADR 0002: the skill disables auto-merge when a condition drops).

### Review trigger

An archive PR merges a file the owner did not approve, a retro proposal needs more than a
docs or test edit (a product behavior change belongs in its own change), or the owner wants
the archive PR held to a review.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Owner merges every archive PR, in every mode | Nothing new | The owner stays the last loop after every merge, which round 3 exists to remove | low |
| Ruleset bypass so the skill pushes the archive to `main` | No PR | A bypass for everyone with the token; ruled out by the owner | medium |
| Require `review-change` and 8/8 on the archive PR | Same gate as a change | A second full contract for a retro and a folder move; reviews of a diff the owner just approved line by line | medium |
| A post-merge GitHub Action that archives | Unattended | Secrets in CI, a coordinator outside the session (ADR 0001) | medium |
