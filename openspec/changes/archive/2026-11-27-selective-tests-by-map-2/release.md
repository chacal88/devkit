# Release note

packs:
- devkit-openspec: patch

## a change runs only the tests its own files map to

- **devkit-openspec**: `deliver-check.mjs` exports the own-files computation it already had
  (`ownDiffPaths`, `branchOwnPaths`), so that the repository's test selection and the staleness
  rule share one helper; no checker answer changes. Tests of the selective mode in
  `test-suite.test.mjs`, `deliver-check.test.mjs`, `delivery-train.test.mjs` and `test-tmp.test.mjs`.
- Repository: `node scripts/test-suite.mjs --own-files` runs only the suite test files that the
  hand-kept map `scripts/test-map.json` links to the branch's own files, slow tests only when a
  touched file is linked to them, and the whole suite for unmapped code, a train branch or a
  checkout that cannot tell its own files; it refuses a map that names a missing file or leaves a
  suite script or test uncovered. The gates, the proofs and the base merges name it; the command
  with no selection argument is unchanged.
- CI: the `check` job runs `--own-files` on a change's pull request, with the full history, and the
  whole suite on a train's pull request and on `push` to `main`.
