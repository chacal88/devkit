Verdict: approved
Commit: a4f215885a9627fefa1348001fd2374c11bbd7e5

## Coverage analysis — test-map-hub-links, re-review (76b2987d..a4f21588)

### Findings
- [important] plugins/openspec/hooks/test-suite.test.mjs:1094-1111 and scripts/test-map.json hub keys — [5] Kept readers of change-loop.mjs (24) and deliver-check.mjs (29) were not asserted; removing a real reader left every test green. · fixed in cfaefc9f
- [nit] scripts/test-map.json keys .gitignore, .claude/settings.json, docs/getting-started.md, .github/workflows/devkit-reviews.yml — [4] Fast readers of document keys outside the eight named documents are not pinned; dropping one of two entries stays green (dropping the only entry is caught by the empty-list check).
- [praise] plugins/openspec/hooks/test-suite.test.mjs:1123-1180 — The hub tests read the real map and the real suite listing (a stem that names no single file throws), with a helper test covering missing, extra, order and absent-key cases.

## Coverage analysis — test-map-hub-links, re-review (76b2987d..a4f21588)

In-scope surfaces: plugins/openspec/hooks/test-suite.test.mjs (KEPT_HUB_READERS, suiteStem, hubLinkProblems, three tests), scripts/test-map.json (two hub keys), evidence refresh.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0): change-loop hub list -> AC-3 exact-set test; deliver-check hub list -> AC-4 exact-set test; stem resolution -> helper test (throws on 0 or several matches); helper -> its own unit test (missing, extra, both, order, absent key). KEPT_HUB_READERS counts (24, 29) match the map and the kept rows of design.md.

The test file was run alone: 72 tests, 72 pass, 0 fail. The working tree was clean. The evidence states that the whole suite was not re-run at cfaefc9f (a new run would count 3903); the fix commit only adds tests to one file, so this is acceptable.

### Well covered
- Kept hub readers of change-loop.mjs and deliver-check.mjs: exact-set deepEqual against the real map and real suite listing, plus a unit test of the comparison helper.
