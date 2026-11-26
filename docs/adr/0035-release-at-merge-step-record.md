# ADR 0035: The release step's commits record the lines they wrote, so a branch merged by hand is numbered again instead of refused

- Status: accepted
- Accepted by: the owner, on 2026-11-24, in the approval of the plan of change release-at-merge (openspec/changes/release-at-merge/approval.md)
- Date: 2026-11-24
- Change: release-at-merge
- Amends: ADR 0034 (0034-release-at-merge.md), decision 6 ("The delivery's state is derived, with no marker commit: … anything else is refused as 'release lines edited by hand'"): the state stays a comparison of the trees, and a value the step's own recorded commit wrote is told apart from a hand edit
- Builds on: ADR 0034 decisions 1, 3 and 5 (who writes the numbers, the unnumbered ADR, release-class edits), unchanged; ADR 0025 (0025-a-base-merge-stales-only-on-the-changes-own-files.md), decision 2 (a base edit to an own file stales), unchanged; ADR 0020 (0020-a-change-can-run-on-another-machine.md), whose clones must keep reading the record; amends none of them

This record was written without a number; the delivery of its change gives it one, together with
the change's release. The change's own folder cites it by its slug, before and after.

## Context

Note (release-at-merge, 2026-11-26): after the readiness review of phase 11 of change release-at-merge the owner accepted, in his approval of the revised plan, the give-back of decision 5 at the unit of a span (D-34 of the change's design): the three-way merge of the path's text at the record's commit, the working text and the record commit's text with the record's numbers masked runs first, as decision 5 says, and when that whole-text merge conflicts, each number the step wrote in the path is given back on its own, found in the working text by the text around it at the record's commit, taken on its line to the left first and then to the right until it stands once in the working text and nowhere in the path's text at the merge base, which the step reads as a third input of that search and which can only refuse a give-back, never widen one. Exit 2 naming the path, with the tree restored, then means a span that cannot be found so (a citation changed after the record, or dropped by the merge where the base cites its own record with that number), not any conflict of the whole-text merge; only the tokens the step wrote still go back, and a citation the base brought with the same number keeps it. Words a person added beside a citation the step wrote now give back, so the Consequences' "Mitigated: exit 2" for a line the person edited where the step had written holds only for a citation the person changed or the merge dropped. The Decision is otherwise unchanged.

Note (release-at-merge, 2026-11-25): after review round 2 of change release-at-merge the owner acknowledged the per-line reading of decisions 3 and 4: `stepRecord` reads every commit on the branch's first-parent line above the base whose last paragraph names `Release-change: <id>`, and each release line takes the value of the newest of those commits that wrote it, a trailer still counting only when its commit changed what it names (decision 2), so a number an older step commit wrote and a later step commit kept stays the step's own. "The newest commit" of decision 3 and "the record" of decision 4 read that way. The Decision is otherwise unchanged.

ADR 0034 has the `assign-release` step (`release-merge.mjs --assign`) number a change's release and
ADR on the change's own branch, and run again after every merge of the base that moved the release.
Decision 6 derives the delivery's state from the trees alone: release lines equal to the merge
base's mean the step is next, equal to what the step computes from the base mean done, and anything
else is refused as "release lines edited by hand".

Review round 1 of change release-at-merge (code-quality-reviewer F1) reproduced a dead end in a
scratch repository. A branch `feat` is assigned (devkit-openspec 1.1.0, its record numbered
`docs/adr/0002-feat.md`). The base then releases 1.1.0 itself, takes ADR 0002 for another record
(`docs/adr/0002-other.md`) and changes `src/a.ts`, which `feat` also changed. `--assign` exits 2 on
the conflict in `src/a.ts`, a file outside the release lines, and restores the branch. The only way
on is a merge of the base by hand: `src/a.ts` resolved, every release line taken from the base.
After it the merge base is the base's tip, and the change's record still holds the 0002 the earlier
run gave it. That value is neither the merge base's nor the computed one, so the state reads `hand`
and every later `--assign` refuses with `release lines edited by hand: docs/adr/feat.md`. The
conductor no longer offers `renumber-adr` or `resolve-release-conflict` to a change with a note
(ADR 0034 decision 8 keeps them for the old rule), and no document names a way out.

This is not a rare path. Changes in this repository merge the base two to five times before they
land (the branch of change release-at-merge has merged it six times so far), trains land several
times a day, and two changes in flight often touch the same hook files. Every such merge after the
first assignment meets a base that also released, and any one of them with a code conflict reaches
the dead end.

The planner's fix (design D-20 of the change) has the step leave a record of what it wrote on its own
commits and read it back. The readiness review of the revised plan (blocker 1) found that this
contradicts decision 6, which refuses "anything else" and derives the state "with no marker
commit", and the project's design rule asks for a new record rather than a reading. ADR 0034 is
accepted and stays as written; this record amends its decision 6 for the owner to decide.

## Decision

1. **The record.** Every commit the step makes for `--assign`, a plain commit or a merge commit,
   keeps its subject and ends its message with a block of Git trailers, one per thing it wrote:
   `Release-change: <id>` first, then `Release-line: <path>` for each release line ADR 0034 compares
   that the commit wrote (a pack manifest, the marketplace, `CHANGELOG.md`, the CI pin page, the
   file `devkit.release_tag` names), `Release-adr: <from> -> <to>` for each record it renamed, and
   `Release-citation: <path>` for each path whose citations it rewrote. `docs/catalog.md` is not
   named (`gen-catalog.py --check` owns it). The train's join writes no record: a train's commits
   never come back to a change branch.
2. **Who writes it.** Only the step, in the commit it already makes. No person and no other step
   writes a trailer. A trailer typed by hand counts for nothing on its own: the values are read from
   the recorded commit's tree, never from the trailer text, and a named path counts only when that
   commit changed it from its first parent. A trailer on a commit that wrote nothing is ignored.
3. **Who reads it.** One function, `stepRecord` in `deliver-check.mjs` (`node:` imports only, so the
   module boundary of the change holds), reads the newest commit on the branch's first-parent line
   above the base whose last paragraph names `Release-change: <id>`. The release state
   (`releaseStateAt`, behind the checker's next step) and the step read the record through it, and
   only where the branch's history is present: a local clone or the train's scratch worktree of one.
4. **The state, amended.** It stays a comparison of the trees, with one more input. A release line
   whose head value is neither the merge base's nor the computed one counts as the step's own when
   the record holds that same value for it. Then, first match wins: every line equal to the computed
   value is `assigned`; every line equal to the merge base's or to the record's is `unassigned`,
   listing the lines taken from the record for the step to give back; anything else is `hand` and
   refused as before. A line whose head value equals the merge base's is never listed as taken from
   the record, even when the record holds that same value: only a line whose head value equals the
   record's and differs from the merge base's is listed. A value no recorded commit wrote (a number typed by hand, a record lost to an
   amend) is still refused. No commit is ever made to mark a state; decision 6's "no marker commit"
   holds in that sense, and its "anything else is refused" now excludes the step's own recorded
   output.
5. **The step gives back what it wrote.** When the state is `unassigned` with lines taken from the
   record and no merge is needed (the person merged the base), the step first gives back what the
   record names, and only its `Release-adr` and `Release-citation` entries: each `Release-adr`
   record among the listed lines moved back to its `from`, and the `Release-citation` paths that
   belong to it, each path through a three-way merge of its text at the record's commit, the
   working text, and the record commit's text with the record's numbers masked, so only the tokens
   the step wrote go back to their unnumbered form and a citation the base brought with the same
   number stays as it is. A conflict there is exit 2 naming the path (`cannot give back the numbers
   the step wrote in <path>`), with the tree restored. A `Release-line` the record names (a pack or
   marketplace version, `CHANGELOG.md`, the CI pins, the release file's version) is not given back:
   the step's normal computation from the base rewrites it, as it writes every release line. The
   step then numbers the branch above the base as always.
6. **A clone that cannot read the record falls back to the refusal.** When `git log` fails or finds
   no record (a shallow clone that cannot reach the range, a commit amended or rebased without its
   trailers, a commit made before this record existed), the trees decide alone: `hand`, refused as
   decision 6 says. The record can only turn a refusal into "the step runs again"; it never makes a
   branch read `assigned`, so a missing or forged record never gives a false pass.
7. **A shallow CI checkout changes no verdict.** `deliver-check --ci` never computes the release
   state: it judges staleness through the masked comparison of ADR 0034 decision 5, which reads no
   trailer. CI's `check` job (checkout at depth 1) runs `scripts/check.py` and the test suite, and
   neither reads a record; the suite's tests build their own repositories. The `devkit-reviews`
   workflows check out the full history anyway.
8. **The recovery is written down.** After exit 2 for a conflict outside the release lines, the
   `ship-change` `assign-release` row and the flow page say what to do: merge the base by hand,
   resolve those files, take the base's side of every release line in conflict, commit, and run the
   loop again; the step then renumbers the branch from its record. That merge stales the evidence and
   the reviews when it resolves a conflict in one of the change's own files (ADR 0025 decision 2);
   the step's commit after it stales nothing more.

## Consequences

- Positive: a branch with a note that meets a code conflict with a base that also released recovers
  with one merge by hand and one run of the step, so ADR 0034's "runs again after every merge of the
  base that moved the release" holds for every merge, not only clean ones. No change author writes a
  release line (ADR 0034 decision 1 holds). No file is added: the record travels with its commit
  through push, fetch and merge, on the very commit whose diff proves it.
- Negative: the state now depends on commit-message metadata as well as the trees, so an amend that
  drops the trailers changes the state while the trees stay the same (Accepted: the change can only
  fall back to the refusal decision 6 already gave, never to a pass, decision 6 of this record; the
  flow pushes the step's commit plainly and never rewrites it). A trailer typed by hand could claim a
  line (Mitigated: a key counts only when the recorded commit's own diff wrote that value, decision
  2). Commits made by the step before this record carry no trailer, among them this change's own
  dogfood commit (Mitigated: the change gives those lines back by hand before its own step runs
  again, so its next step commit carries a record). The give-back can meet a line the person edited
  where the step had written (Mitigated: exit 2 naming the path, the tree restored, decision 5). The
  merge by hand stales the records when it resolves a conflict in an own file (Accepted: a real code
  conflict deserves new evidence and reviews, ADR 0025 decision 2). Every reader of the release
  state must read it through `stepRecord` (Mitigated: one function, one test of its contract, and a
  reader that skips it only refuses more, never less).

### Review trigger

A branch merged by hand after a code conflict is still refused as edited by hand with its record
present; a value no recorded commit wrote is accepted as the step's; a CI job or any reader without
the branch's history starts computing the release state; the train's join starts writing to change
branches; or the old rule of ADR 0034 decision 8 is removed and the conductor's recovery steps go
with it.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| A guess from the trees: a numbered record whose text masks equal to the unnumbered one, with no `ADR [<slug>]` left, counts as the step's (the review's first suggestion) | No metadata; decision 6 stays a pure tree comparison | Cannot tell a number the step wrote from one a person typed, which decision 6 exists to refuse; covers records only, not a version or a changelog entry the person kept | low |
| `--assign --continue`: the step leaves its merge in progress for the person to resolve the code conflict, then finishes it | No record; the step resolves the release lines itself | A half-merged worktree across a session boundary, which the checker cannot read while it waits and a session that ends leaves behind; every later command meets a merge in progress | medium |
| A file holding the numbers the step wrote | Readable from any checkout, shallow or not | Under `openspec/changes/<id>/` it changes the change folder and stales the approval, the evidence and the reviews on every run; anywhere else it is one more shared file every change edits, the conflict ADR 0034 removed | medium |
| `git notes` on the step's commit | Leaves the commit message as it is | Notes are neither pushed nor fetched by default, so another machine (ADR 0020), the train's clone or CI loses them and refuses; each project would need its fetch and push configuration changed | medium |
| Keep refusing and document a manual recovery (rename the record back, rewrite the step's citations back to `ADR [<slug>]`, then run the step) | Decision 6 stays as written; no code | The person hand-edits release lines, which ADR 0034 decision 1 forbids, and must undo only the tokens the step wrote while keeping the base's citations of the same number, an error-prone edit repeated at every conflicting merge of the base | low |
