Verdict: approved
Commit: 6367ac8e199d37497453b3d6cdca557ca2194b40

## Coverage analysis — test-fixture-cleanup, delta 1d75ac1..6367ac8

### Findings
- [nit] plugins/openspec/hooks/test-tmp.test.mjs:RAW_TEMP_CALL — The AC-3 regex matches only mkdtempSync( and tmpdir(; an async mkdtemp( or a hardcoded /tmp path in a test would pass the static refusal.
- [nit] plugins/openspec/hooks/test-tmp.mjs:afterEach — The removal-failure branches (afterEach throws 'could not remove', sweep writes 'left') have no test; a regression that swallows a failed removal would stay green.
- [nit] plugins/openspec/hooks/test-tmp.test.mjs:AC-5 test — The CI test is implementation-coupled: it asserts substrings of ci.yml (including exact step names) instead of the behavior; acceptable because the text check is the only local proof.
- [praise] plugins/openspec/hooks/change-loop.test.mjs:2478 — The docs test asserts the v0.22.1 pin present and v0.22.0 and older pins absent, so a stale CI pin goes red.
- [praise] plugins/openspec/hooks/test-tmp.test.mjs:AC-3 scan — The repository scan guards plugins/ against raw temporary folders and still covers the merged-in main tests; the new stage-roles edit only reads files.

In-scope surfaces: plugins/openspec/hooks/change-loop.test.mjs (main's 5-line edit to the stage-roles ADR 0016 docs test).

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): the edited test only reads (existsSync, readdirSync, readFileSync); no mkdtempSync or tmpdir call (grep empty), so the AC-3 scan holds; no write outside a helper folder; a missing live and archived folder would raise ENOENT and fail loudly; the date-prefixed archive names sort correctly so the newest archive is picked. test-tmp.test.mjs was not run because the delta does not touch it.

### Well covered
- v0.22.1 pin in the flow doc: change-loop docs test.
- Raw temporary folders in plugins/: AC-3 scan in test-tmp.test.mjs.
