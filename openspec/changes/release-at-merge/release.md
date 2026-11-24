# Release note

packs:
- devkit-openspec: minor
- devkit-core: minor
- devkit-compozy: patch

marketplace: minor

## a change states its release in a note and the delivery numbers it

- **devkit-openspec**: in a project that names `devkit.release_tag`, a change carries
  `openspec/changes/<id>/release.md` (the packs it bumps and by how much, the changelog title and
  body) and names its ADR `docs/adr/<slug>.md`, cited `ADR [<slug>]`; no change branch edits a
  version, a changelog line, a CI pin or an ADR number. The delivery writes them once: a train's join
  (`release-merge.mjs --merge`) reads the note, and with no train the new session step
  `assign-release` (`release-merge.mjs --assign`) runs last, before `enable-auto-merge` or `ready`,
  and again after a merge of the base. `deliver-check` refuses release lines edited by hand, a change
  that touches a pack with neither a note nor a bump of its own, and a note changed after the plan
  approval; a commit that only writes release lines leaves the evidence and the reviews current.
  Changes opened before keep the old rule.
- **devkit-core**: the planner writes the release note with the plan and does not stop without it,
  the ADR author drafts unnumbered records, the implementer never edits a release line of a change
  with a note, and the readiness review checks the note.
- **devkit-compozy**: the CompozyOS agents regenerated from those texts.
- Repository: `scripts/check.py` refuses an ADR with no number on the default branch and two ADRs
  with one slug.
