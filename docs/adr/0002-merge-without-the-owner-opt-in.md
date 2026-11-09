# ADR 0002: Merge without the owner, by opt-in

- Status: accepted
- Date: 2026-11-08
- Change: auto-merge

## Context

This ADR builds on ADR 0001 and leaves its gates unchanged. Since ADR 0001, `ship-change` takes an approved change to a PR that `deliver-check` reports
as ready (8/8), and the owner merges it. Owners of some repositories want that merge to happen
on its own. An agent saying "ready" is not enough to merge on: until this change, CI checked
review verdicts without checking that they were current at the PR head.

## Decision

A repository may opt in, per schema, with `ship: <schema>: merge` in `openspec/config.yaml`.
In that mode, and only there, `ship-change` enables GitHub's auto-merge when `deliver-check`
reports 8/8, pinned to the head it checked, and disables it as soon as the contract drops
below 8/8. GitHub performs the merge, and only on a default branch whose active rules require
the `devkit-reviews` check. That check recomputes reviews, findings, gates and acceptance
proof at the PR head in CI. Without that rule, `merge` mode is blocked, not downgraded. The
owner's plan approval stays a human gate in every mode; `commit-and-pr` never merges; the
default stays the owner's merge.

## Consequences

- Positive: an opted-in change goes from approved plan to merged without the owner; the merge
  rests on a CI check that anyone can read, not on the session's word.
- Negative: nobody reads the final diff before it lands (Accepted: reviews, evidence and
  `devkit-reviews` are the reading). Between skill runs GitHub merges on required checks alone,
  so a comment made after auto-merge was enabled does not stop it (Mitigated: at 8/8 the merge
  is usually immediate, and the skill disables auto-merge when it sees the contract drop). A PR
  can change the workflow or the checker it is judged by (Accepted: reviewers see those diffs;
  organization-level required workflows are out of scope). The consumer workflow downloads the checker pinned to the commit sha of the release tag, resolved at setup time, never to the movable tag. The ruleset blocks direct pushes
  for everyone, the owner included (Accepted until round 3's bypass). Strict up-to-date
  re-runs stale reviews after each base update (Accepted: cost, scoped re-review).
- Note: GitHub records the merge under the identity that enabled auto-merge, normally the
  owner's `gh` login. "Without the owner" means without the owner's action.

### Review trigger

A merge happens that `devkit-reviews` would have failed, or GitHub changes how auto-merge
or rulesets treat required checks.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the owner's merge everywhere | Nothing new | The owner stays the last loop | low |
| The skill merges directly at 8/8 | No GitHub setup | The session's word is the gate; nothing stops a stale review | medium |
| One required human approval in the ruleset | Familiar | The owner's merge in another form | low |
| Merge queue | Serializes merges | Needs org plans or more setup; not needed for one maintainer | medium |
| A label-triggered merge Action | Unattended | Secrets in CI, a second coordinator outside the session (ADR 0001) | medium |
