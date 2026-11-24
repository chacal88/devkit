# ADR 0031: A change carries a release note and an unnumbered ADR, and the delivery numbers both once, at the merge

- Status: accepted
- Accepted by: the owner, on 2026-11-24, in the approval of the plan of change release-at-merge (openspec/changes/release-at-merge/approval.md)
- Date: 2026-11-24
- Change: release-at-merge
- Amends: ADR 0022 (0022-reviewed-changes-leave-on-a-delivery-train.md), decision 3's sentence "Each change branch keeps its own number, so its reviews stay current" (a change with a release note carries no number at all; its rejected alternative "Renumber releases on each change branch" stays rejected); ADR 0025 (0025-a-base-merge-stales-only-on-the-changes-own-files.md), decision 1's list of files that are never own files, which grows by the numbering of an ADR (the renamed ADR file and the citations rewritten outside `openspec/changes/`), and decision 3's sentence "A plain commit on the branch is judged as before" (for a change with a release note, a plain commit's release edits are judged as release-class edits, decision 5)
- Builds on: ADR 0027 (0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md) and ADR 0030 (0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md), whose pin definition, `pinMismatches` test and archive-check rule for the CI pin lines of `docs/openspec-flow.md` stay as written (decision 7); ADR 0003 (0003-auto-merge-the-archive-pr.md), whose exemption list, as ADR 0027 and ADR 0030 amended it, is unchanged; ADR 0019 (0019-the-delivery-loop-tags-the-release-it-merged.md), whose tag rule is unchanged; ADR 0002 (0002-merge-without-the-owner-opt-in.md) and ADR 0004 (0004-devkit-per-project.md); amends none of them

This record was written without a number; the delivery of its change gives it one, together with
the change's release. The change's own folder cites it by the change's id, before and after.

## Context

Every change of this repository writes its release into files every other change also edits: the
packs' `plugin.json`, `.claude-plugin/marketplace.json` (with `metadata.version`), `CHANGELOG.md`,
`docs/catalog.md` and the CI pin lines of `docs/openspec-flow.md`. It also picks the next free ADR
number. Any two changes in flight therefore conflict on those lines by design. ADR 0022 decision 3
keeps each change branch on its own number and has the train renumber the release files when it
joins the heads (`release-merge.mjs --merge <rev>`); ADR 0025 keeps the release files from staling
evidence and reviews. Both still leave a branch holding a number the base will take from it: the
train left every boarded change of train 2 for the literal pin assertion that
`plugins/openspec/hooks/change-loop-compozy.test.mjs` then held (ADR 0030 has since made that test
read the version from the manifest, so no release edits it), and ADR numbers picked in parallel collided
four times in one day (`conduct-check.mjs`, the `renumber-adr` step), each renumbering staling
reviews and, when it touched `decisions.md`, the owner's plan approval.

On 2026-11-24, after the first two trains, the owner asked that a change stop choosing numbers: a
change carries a small release note of its own and names its ADR without a number, and the
delivery assigns the version and the ADR number once, when the change reaches the default branch.
The grill's questions 1 to 4 were answered by the coordinating session under the owner's
delegation of 2026-11-24 ("responda o maximo possivel"); the decisions below marked as such are
the coordinator's, and the owner can overturn each one at the plan approval.

## Decision

1. **Who writes the numbers, and when** (decision 1 of the requirements, taken by the coordinator
   under delegation). With a delivery train, the join (`release-merge.mjs --merge <rev>`) writes
   them, reading the change's release from its note instead of from the branch's manifests. With no
   train, one delivery step, `assign-release`, writes them on the change's own branch as the last
   step before `enable-auto-merge`, and runs again after every merge of the base that moved the
   release. No other step and no change author writes a release line. The step commits only
   release-class files (decision 5).
2. **The release note** (decision 2, taken by the coordinator). A change carries
   `openspec/changes/<id>/release.md`, a plain file written with the plan, not a stage and not a
   new flow version. It holds, in this order, a `packs:` list (a pack and `patch`, `minor` or
   `major`; an empty list is no release), an optional `marketplace:` bump (default: the largest
   pack bump), an optional `release:` bump for the file `devkit.release_tag` names, a changelog
   title and a changelog body. One function reads it and refuses a malformed note with a plain
   message naming the field. Because a file outside a stage is not covered by the plan approval,
   the approval records the note's hash: `approval.md` gets a `- Release note: sha256:<hash>` line,
   written with the approval. `deliver-check` refuses a change whose `release.md` at the head hashes
   differently from the recorded line, so a changed note needs the owner's approval again. An
   approval with no such line (a change with no note, or one approved before this change) is judged
   as before. (The stage files are written uncommitted on top of the commit their header names, so
   that commit holds no plan file and the note cannot be read from it.)
3. **The unnumbered ADR** (decision 3, taken by the coordinator). A change names its ADR
   `docs/adr/<slug>.md` (the slug is the change id, or `<change-id>-<topic>` for a second record)
   and cites it `ADR [<slug>]`. The step that gives the version gives the number: it renames the
   file to `docs/adr/<NNNN>-<slug>.md` with the next free number on the base and rewrites every
   citation in a tracked text file outside `openspec/changes/`. Every change folder, the archive
   included, keeps its citations as written, so no plan file, approval, review or evidence of this
   change changes and no other change's approved plan is ever edited; the record's
   `Change:` line resolves the citations left there afterwards. A second file with one slug is refused. Every reader of ADRs accepts
   the unnumbered form before the delivery and `scripts/check.py` refuses it on the base branch. A
   citation of another open change's unnumbered ADR resolves once that ADR has landed; while it has
   not, the step refuses, naming the slug.
4. **Consumer projects** (decision 4, taken by the coordinator). A project that names
   `devkit.release_tag` gets the same behaviour, minimally: the delivery writes the top-level
   `version` of that file from the note's `release:` bump and, only when the project has a root
   `CHANGELOG.md`, the note's changelog entry there. It creates no file and assumes no other layout.
   This repository's layout (pack manifests, marketplace, changelog, catalog through
   `scripts/gen-catalog.py`, CI pin lines) is a second set of rules, active when those files exist.
   A project with no `devkit.release_tag`, no train, no release file or no `docs/adr` sees no new
   step, refusal or file. The kind of bump comes from the note and is never derived.
5. **Release-class files and release edits** (amends ADR 0025 decisions 1 and 3). The renamed ADR
   file and the citations the step rewrites outside `openspec/changes/` join the release files: they
   are never own files, and the train check allows them in a train commit. For a change with a note,
   a release edit counts as untouched in a plain commit on the branch as well as in a merge of the
   base. A release edit is `CHANGELOG.md` or `docs/catalog.md`; a path whose texts before and after
   are equal once the release lines are masked (a manifest's or the release file's version fields,
   the CI pin lines, a numbered ADR citation or file name that stands for an unnumbered one); and the
   rename of an unnumbered ADR to its numbered form with its text otherwise unchanged. In a merge it
   is judged against the first parent, so a base edit to an own file still stales (ADR 0025 decision
   2). ADR 0025 decision 3 judged every plain commit on the branch as before; that cannot hold here,
   because the step's commit is a plain commit on the change's own branch and would stale the
   evidence and the reviews it is meant to leave current. Every other edit of a plain commit, and
   every commit of a change with no note, keeps decision 3's rule, and a rejected verdict keeps its
   rule as ADR 0025's per-reviewer allowances say.
6. **The delivery's state is derived**, with no marker commit: release files at the head equal to
   the base's mean `assign-release` is next; equal to what the step computes from the base and the
   notes mean done; anything else is refused as "release lines edited by hand". A change that
   touches a pack's files with neither a note nor a bump of its own is refused as "no release".
7. **The CI pin lines** (builds on ADR 0027 and ADR 0030; amends neither, nor ADR 0003). On a change
   with a note no branch edits a pin line of `docs/openspec-flow.md`; the delivery step (the join, or
   `assign-release`) rewrites them with the version it assigns, through the one pin definition ADR
   0027 placed in `deliver-check.mjs`, and the test's `pinMismatches` assertion (ADR 0030) still
   checks them against the manifest. The pin lines are release lines of a change's own branch only
   in the sense of decision 5 (masked when its evidence and reviews are judged); `RELEASE_FILE` does
   not grow. The archive check's pin-line rule (ADR 0027 decision 1 for the flow page, as ADR 0030
   narrowed it) stays as written: an archive pull request carries no note, and a change on the old
   rule (decision 8) still moves the pins on its own branch, so the rule remains the safety net for
   both. Removing it belongs with removing the old rule.
8. **The old rule stays for changes with no note.** A change opened before this one (no note, a
   bump of its own) joins a train, merges alone and is renumbered on a base update exactly as
   before (`release-merge.mjs --base` and `--merge`), and a clashing ADR number still takes
   `renumber-adr`. A change moves over only when the owner asks; removing the old rule is another
   change.
9. **The release tag is unchanged** (builds on ADR 0019). `releaseTagFacts` reads the release
   file's `version` at the merge commit and its first parent; the merge that carries the numbers is
   the one tagged, by the same rules, through a train or a single merge.

## Consequences

- Positive: no change branch edits a shared release line or picks an ADR number, so two changes
  never conflict on them; the version and the ADR number are given once, by the step that knows the
  base, and the train's joins stop renumbering branch-chosen numbers. A rename at merge touches no
  file under `openspec/changes/`, so the readiness verdict, the plan approval, the reviews and the
  evidence stay current and the owner is not asked again, for this change or any other. Consumer projects with
  `devkit.release_tag` get the same one behaviour with or without a train.
- Negative: before the merge a change's branch shows no version and its ADR no number, so the
  reader of a pull request sees `ADR [<slug>]` and a note instead of final numbers (Accepted: the
  note names the bump, and the record's `Change:` line resolves the citation after the merge). With
  no train, `assign-release` runs again after each merge of the base that moved the release, one
  commit each (Mitigated: the commit holds only release-class files, which leave evidence and
  reviews current under ADR 0025 and decision 5). The note sits outside the stages the approval
  covers (Mitigated: the approval records the note's hash, decision 2, so any edit of the note after
  the approval asks the owner again). A plain commit's release edits no longer stale evidence or
  reviews (Accepted: only edits that mask equal or that ADR 0025 already counts as release files are
  spared, and only on a change with a note; the required `check` CI still runs on the merged
  ref). Two rules run side by side until the open changes move over or merge (Accepted: the open changes keep their
  flow, as a pinned `x-devkit-flow` does; removing the old rule is another change). Readers of ADRs
  (`conduct-check.mjs`, `scripts/check.py`, the agents, the `context:` list of
  `openspec/config.yaml`, tests that pin ADR file names) must accept two forms (Accepted: the
  unnumbered form exists only before the delivery, and `scripts/check.py` refuses it on the base).
  A citation of another open change's ADR blocks the step until that ADR lands (Accepted: the
  refusal names the slug, and the order matches the dependency). The step now writes text outside
  release manifests (ADR citations in other files) without a review (Mitigated: it rewrites only
  `ADR [<slug>]` tokens to the assigned number, and the train check and `devkit-reviews` allow no
  other path). The archive check keeps its pin-line rule although no branch with a note writes a
  pin line (Accepted: archive pull requests and changes on the old rule still move the pins, decision
  7; the rule goes with the old rule).
- Note: this change cannot be delivered by the mechanism it adds, since the installed plugin does not
  have it yet. Its own step, run from its worktree after the last merge of the base before review,
  numbers this record and writes the change's release on its branch; from then on the installed
  delivery treats the change as one on the old rule (decision 8).

### Review trigger

A change merges with a release line or an ADR number written by hand; a rename at merge stales an
approval, an evidence or a review; two changes still conflict on a release line or an ADR number;
a consumer project needs a release layout other than its `devkit.release_tag` file and a root
`CHANGELOG.md`; or the open changes have all merged and the old rule can be removed.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| A release pull request after the merge (release-please style) | Change branches hold no numbers; one release PR batches several changes | One more pull request and one more wait per change, and a release that lands after the code it describes; rejected by the coordinator under delegation (decision 1) | medium |
| Keep the old rule, and number only at the train's join | No new step for single merges | A project with no train (three consumer projects) keeps the conflicts; two behaviours by delivery model, which the owner does not want | low |
| A new stage (and flow version) for the release note | The note is covered by the stage machinery and the approval | Leaves open changes on two flows and has, each time, left the installed plugin unable to read `main`'s `flow.json`; decision 2's recorded note hash covers the approval gap | medium |
| Derive the bump from the diff (conventional commits or touched packs) | No note to write | A guessed `minor` versus `patch` is a release decision nobody made; the owner's request asks for the size to be stated | low |
| A number-free ADR scheme for good (date plus slug) | No numbering at all, no rename | Breaks every existing citation `ADR NNNN` and the habit of ordering records; changes the scheme of every existing record | high |
| Keep renumbering ADRs on the branch (`renumber-adr`) | Nothing new | Collided four times in one day; each renumber edits `decisions.md` and stales reviews and, sometimes, the owner's approval | low |
| Remove the archive check's pin-line rule (ADR 0027, ADR 0030) with this change | One rule fewer in `unnamedFiles` | Archive pull requests and the open changes on the old rule still move the pins, and would stop on `apply-proposals` for a mechanical edit again; it goes when the old rule goes | low |
| Renumber releases on each change branch (ADR 0022's rejected alternative) | One number everywhere | Every renumber changes a change's head and stales its reviews; stays rejected: the branch now carries no number at all | low |
