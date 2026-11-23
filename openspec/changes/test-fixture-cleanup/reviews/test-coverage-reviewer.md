Verdict: approved
Commit: 1d75ac1cbcdefd556e433d0e43e86330b897767b

## Coverage analysis — test-fixture-cleanup (8936416..1d75ac1, merge side of d1c7fa4)

### Findings
- [nit] plugins/openspec/hooks/test-tmp.test.mjs:RAW_TEMP_CALL — The AC-3 regex matches only mkdtempSync( and tmpdir(; an async mkdtemp( or a hardcoded /tmp path in a test would pass the static refusal.
- [nit] plugins/openspec/hooks/test-tmp.mjs:afterEach — The removal-failure branches (afterEach throws 'could not remove', sweep writes 'left') have no test; a regression that swallows a failed removal would stay green.
- [nit] plugins/openspec/hooks/test-tmp.test.mjs:AC-5 test — The CI test is implementation-coupled: it asserts substrings of ci.yml (including exact step names) instead of the behavior; acceptable because the text check is the only local proof.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2478 — The docs test asserts the v0.22.1 pin present and v0.22.0 and older pins absent, so a stale CI pin after the release move goes red.
- [praise] plugins/openspec/hooks/test-tmp.test.mjs:AC-3 scan — The repository scan guards main's newly merged tests (accept-decisions, dirWith, configRoot) against raw temporary folders; 10 of 10 pass.

In-scope surfaces: CHANGELOG.md, .claude-plugin/marketplace.json, the three plugin.json files, docs/openspec-flow.md, plugins/openspec/hooks (change-loop.test.mjs, flow-check.test.mjs, test-tmp.test.mjs).

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): pin in the flow doc moved to v0.22.1 -> caught by the change-loop docs test (v0.22.1 present, v0.22.0 and older absent); versions 0.26.1 / 0.22.1 / 0.10.1 / 0.3.1 agree across plugin.json, marketplace.json and CHANGELOG (read, no cross-check test); raw temporary folders in main's new tests (accept-decisions, dirWith, configRoot) -> caught by the AC-3 scan in test-tmp.test.mjs (10 of 10 pass); pinnedLoop marker moved to a tmpFolder, stub assertions unchanged; accept-decisions usage test keeps its exit-3 and usage-text assertions after cwd moved to a tmpFolder; helper copies and CI step -> AC-4 and AC-5 tests.

### Well covered
- Pin move in docs/openspec-flow.md (change-loop docs test, 0.22.0 now guarded as absent).
- Merged-in tests from main use the helper, enforced by the AC-3 scan over plugins/.
