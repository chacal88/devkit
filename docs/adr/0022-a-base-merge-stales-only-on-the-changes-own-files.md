# ADR 0022: A merge of the base stales the evidence and reviews only when it brings the change's own files

- Status: accepted
- Accepted by: the owner, on 2026-11-23, in the approval of the plan of change stale-only-on-own-files (openspec/changes/stale-only-on-own-files/approval.md)
- Date: 2026-11-23
- Change: stale-only-on-own-files
- Amends: ADR 0002 (0002-merge-without-the-owner-opt-in.md), the accepted cost "Strict up-to-date
  re-runs stale reviews after each base update"

## Context

ADR 0002 lets a change merge without the owner only on a default branch that requires the
`devkit-reviews` check, which recomputes reviews, findings, gates and acceptance proof at the pull
request's head, and it accepts that every base update re-runs stale reviews. The `Commit:`
staleness rule of `docs/openspec-flow.md` makes that true for any base update that brings a file
outside `openspec/`: a merge commit counts what differs between its first parent and itself, so a
merge of `main` that brings another change's product code stales `evidence.md` and every review of
the change, even when it touches none of the change's files. One rule, `staleness()` in
`plugins/openspec/hooks/deliver-check.mjs`, serves the local loop, the evidence, the reviews and
`deliver-check --ci`.

On 2026-11-23 several changes ran in parallel and every merge of `main` made each of the others
redo its suite (13 to 45 minutes) and its review bench, which ADR 0002 accepted as a cost when
changes ran one at a time (change-state retro, learning 3). The owner asked that a busy `main` no
longer cost a whole suite and a review per merge.

## Decision

1. A change's own files are the paths the branch itself changed against the base
   (`git diff origin/<base>...HEAD`, product files and tests) and `openspec/changes/<id>/`. The
   release files (`RELEASE_FILE` of `deliver-check.mjs`: the plugin manifests,
   `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md`) are never own files.
2. A merge commit's first-parent diff that holds none of the change's own files leaves the recorded
   evidence and reviews current. One own path in it is enough to stale them, and the reason names
   the merge commit and that path.
3. The exemption covers only what a merge of the base brought in. A plain commit on the branch is
   judged as before, and the per-reviewer allowances (approved or declined against rejected
   verdicts, the test-spared reviewers, the `openspec/`-only rule) are unchanged.
4. The rule fails safe: with `origin/<base>` missing, no merge is exempted, and the branch's own set
   is computed so that an unfetched base makes more paths count as own, never fewer.
5. The same rule holds locally and in `deliver-check --ci`: the `devkit-reviews` check passes on
   reviews recorded before a merge that brought only unrelated paths.
6. The pull request's required `check` CI, which runs the suite on the merged ref, is the backstop
   for a base change that breaks the change without touching its own files.
7. ADR 0002's Decision (the opt-in, auto-merge pinned to the checked head, the required
   `devkit-reviews` check) is unchanged; only its accepted cost narrows to a base update that brings
   the change's own files.

## Consequences

- Positive: a merge of a busy `main` no longer forces the suite and the review bench again when it
  brings nothing of the change; parallel changes stop paying for each other's merges. One function
  keeps the local loop and CI in agreement.
- Negative: the recorded evidence and reviews no longer prove the change against the base's newest
  code it depends on but does not own, such as a module it imports that another change edited
  (Accepted by the owner's delegation, Q1 of the requirements: the required `check` CI runs the
  suite on the merged ref). A reviewer's verdict may rest on a view of shared code that the base
  has since changed (Accepted: the same backstop; the next change touching that code is reviewed
  against it).
- Note: the release-file list is the one `deliver-check.mjs` exports; when it grows (the CI pin of
  `archive-release-pin`) the exemption follows it with no change here.

### Review trigger

A change merges green on `check` with a defect that a re-run review or suite after a base merge
would have caught; CI's `check` stops running on the merged ref; the release-file list stops being
one exported constant.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep every base merge outside `openspec/` stale (ADR 0002 as it is) | Strictest proof at the head | A suite and a review bench per merge of `main` for every open change; the cost the owner refused | low |
| Own files plus their dependency closure (the files they import) | Catches a base edit to a dependency | Needs an import graph per language; rejected in Q1 | medium |
| A per-project setting for the release-file list | Projects name their own release files | A second list beside `RELEASE_FILE`; rejected in Q2 | low |
| Stale only the reviewers whose area the merge touches | Narrower re-review | Each reviewer needs an area map; out of scope, every reviewer follows the same own-files rule | medium |
| Merge `main` only right before the last gate (the stopgap) | No code change | Depends on the coordinator's discipline and still costs one round per merge; it stays as a practice | low |
