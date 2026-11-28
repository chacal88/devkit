# Release note

packs: []

## a document or a hub module selects only the tests that read or run it

- Repository: in `scripts/test-map.json`, a document key (a non-code path outside `plugins/`, such
  as `openspec/roadmap.md`, `openspec/config.yaml`, `CONTRIBUTING.md` or `docs/openspec-flow.md`)
  lists only the fast suite test files that read it from the checkout, never a slow one; a
  document that no linked fast test reads has no key, so it selects no test file. The keys of
  `plugins/openspec/hooks/change-loop.mjs` and `plugins/openspec/hooks/deliver-check.mjs` drop the
  test files that neither import, read or spawn the module nor run any of its code (33 to 24 and
  33 to 29 test files). A pull request that edits only documents runs a few fast test files instead of about 31;
  the train and `push` to `main` still run the whole suite. No pack changes.
