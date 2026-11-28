# Release note

packs:
- devkit-openspec: patch

## an owner's forced merge reads the release step's commit as current

- **devkit-openspec**: on an owner's forced merge of a change with a release note, `deliver-check.mjs`
  reads the `assign-release` step's commit the way the normal delivery path does. A path whose texts
  at the recorded `Commit:` and at the merged head are equal once the release lines are masked
  (versions, the changelog, the CI pins, the ADR numbered with its citations) no longer opens
  `evidence.md` or an approved review as an item. The texts are read through GitHub, with the same
  mask the delivery path uses. A sentence edit or a product commit still opens them, a rejected
  review or one with an undisposed finding is judged as before, and a read the comparison needs and
  cannot make is `blocked`. A change with no note, or a project with no `devkit.release_tag`, is
  read as before.
