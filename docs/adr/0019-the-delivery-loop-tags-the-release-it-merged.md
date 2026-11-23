# ADR 0019: The delivery loop tags the release it merged, when the project names its release file

- Status: accepted
- Accepted by: the owner, on 2026-11-23, in the approval of the plan of change release-tags (openspec/changes/release-tags/approval.md)
- Date: 2026-11-23
- Change: release-tags
- Builds on: ADR 0002 (0002-merge-without-the-owner-opt-in.md), ADR 0003 (0003-auto-merge-the-archive-pr.md), ADR 0004 (0004-devkit-per-project.md), ADR 0010 (0010-openspec-as-the-harness.md), ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md); amends none of them

## Context

ADR 0002's Consequences say the consumer workflow downloads the checker pinned to the commit sha
of the release tag, resolved at setup time: `openspec-setup` reads the tag `v<version>` of
devkit-openspec and pins projects' CI and vendored schemas to its commit. CONTRIBUTING.md step 5
makes that tag a by-hand step after the merge: a lightweight `v<x>` on the merge commit on `main`,
pushed with `git push origin v<x>`. Nothing in the delivery loop (`deliver-check.mjs`,
`change-loop.mjs`, `ship-change`) did it, and seven releases between v0.21.0 and v0.28.0 merged without
their tag until the owner had them pushed by hand on 2026-11-23. A release without its tag cannot
be pinned by a project set up after it.

Until now the session pushed only its own branches and asked GitHub to merge (ADR 0002, ADR 0003);
it published nothing that other projects read. A tag on `origin` is read by every project that runs
`openspec-setup` after it, and a tag that moves changes what a later setup pins. The grill of the
change release-tags (2026-11-23) answered: the project names its release file in a new key; both
the change's merge and its archive merge are checked; the session pushes the tag itself, with no
owner stop; a tag already at another commit stops the run and is never moved.

## Decision

1. A project opts in with `devkit.release_tag: <path from the repository root to a JSON file with
   a top-level "version" string>` in `openspec/config.yaml`. Without the key the loop never tags.
   This repository sets `plugins/openspec/.claude-plugin/plugin.json`.
2. A merge into the default branch bumps the version when the release file's `version` at the merge
   commit differs from the one at its first parent (absent at the parent and present at the merge
   counts; absent at the merge does not). The change's pull request and its archive pull request
   are both checked; in the `two-prs` model of ADR 0018 only the merges into the base branch count.
3. For a merge that bumped the version and has no tag `v<version>` on `origin`, `deliver-check`
   answers the step `tag-release` naming the tag and the merge commit, before `retro` for the
   change's merge and before `archived` for the archive merge. The session then runs
   `git tag v<version> <merge sha>` and `git push origin v<version>` itself, without asking the
   owner, and the run's report names the tag. The tag is lightweight. The archive merge's tag is
   asked by the run on `chore/archive-<id>` and by `ship-change`; a `/devkit change` run from any
   other checkout, once the change is archived on the default branch, ends `archived` without
   asking it (see Consequences).
4. A tag `v<version>` already on `origin` at the merge commit is the step done. One at another
   commit stops the run blocked, naming the tag, its commit and the merge commit. The loop never
   moves, deletes or force-pushes a tag.
5. The facts (the merge commit, its first parent, the release file at each, the tag on `origin`)
   are read through `gh`, as the checker's other GitHub facts are; a fact GitHub does not answer is
   the existing unreadable stop, never a skipped tag.

Not an amendment: the tag is not a push to the default branch, so ADR 0002's ruleset and ADR
0003's "nothing pushes to the default branch" stay as they are; the owner's gates of ADR 0010
decision 6 are unchanged, and the run still ends in one of decision 3's four states.

## Consequences

- Positive: every release that bumps the named version gets its tag in the run that merged it, so
  a project set up later can pin it; the step is a checker answer that every driver reads, and a
  test can show it.
- Negative: the session publishes a ref other projects read without the owner's action
  (Accepted: the owner's answer to question 3; the tag only names a commit already merged on the
  default branch through the gates of ADR 0002 or ADR 0003, and it is opt-in per project as ADR
  0004 wants). A tag pushed to a wrong commit cannot be corrected by the loop (Mitigated: the loop
  tags only the merge commit whose release file carries that version, and never moves a tag; the
  owner deletes or moves one by hand). A tag at another commit, for example one pushed by hand
  before the merge, stops the run until the owner settles it (Accepted: the owner's answer to
  question 4). The step adds `gh` reads after each merge (Accepted: read-only, and only with the
  key set). A remote that refuses the tag push leaves the tag missing, so the next run asks for
  the step again (Accepted: the session reports git's refusal and stops; it never retries with
  force). A `/devkit change` run from a checkout other than `chore/archive-<id>` ends `archived`
  without asking the archive merge's tag (Accepted: the archive branch's run and `ship-change` do
  ask it, and a tag that run missed is still a version the owner can push by hand as
  CONTRIBUTING.md step 5 says; design R-3, `docs/openspec-flow.md`, "The release tag").
- Note: CONTRIBUTING.md step 5 keeps the by-hand commands for a release made outside the loop.

### Review trigger

A project pins a tag the loop pushed to a commit that is not the release, a tag ruleset refuses
the session's push, or the owner wants annotated or signed tags, or a GitHub Release, for each
version.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the tag a by-hand step of CONTRIBUTING.md | Nothing new | Seven releases already missed it; nothing in the loop notices | low |
| The loop stops for the owner to push the tag | The owner publishes every ref | An owner stop after every release, which the loop exists to remove; rejected by the owner (question 3) | low |
| A GitHub Action on push to the default branch tags a version change | Runs without a session | A workflow with write permission in every project that wants it; a second actor outside the loop (ADR 0010 decision 8 keeps CI from driving); the checker cannot see whether it ran | medium |
| Move or force-push a tag that points elsewhere | The run never stops | A later setup pins another commit than an earlier one under the same name; rejected by the owner (question 4) | high |
| Hard-code devkit-openspec's `plugin.json` in the checker | No new key | Only fits this repository; other projects release from other files (ADR 0004) | low |
| Tag the pull request's head before the merge | Known before the merge | The merge commit does not exist yet, and the merge method decides its sha | low |
| Annotated or signed tags | Carry a message or a signature | CONTRIBUTING.md names lightweight tags; signing needs keys in the session; out of scope | low |
| Read the tag from the local clone | No `gh` call | The clone may lack the remote's tags; the checker reads GitHub facts through `gh` | low |
