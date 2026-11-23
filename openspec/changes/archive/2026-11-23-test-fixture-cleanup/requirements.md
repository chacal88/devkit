<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> every hook and review-round test removes the temporary folders it creates (`mkdtempSync` and the like) when it ends, failed or not, through one shared helper of each test file, and a test proves that a run leaves no folder behind. Found on 2026-11-22 in `review-writer-prompt`: on the owner's Linux worker `/tmp` is a tmpfs with 1,048,576 inodes, and one run of `deliver-check.test.mjs` plus `flow-check.test.mjs` left about 230,000 inodes of fixture folders (`/tmp/devkit-deliver-*`, `/tmp/devkit-gh-*`, `/tmp/devkit-origin-*` and others, each a git repository), the guard suite about 200,000 more; three sessions running suites in parallel filled `/tmp` four times in one day, gates went red for no defect (572 of 994 tests) and the owner had to approve each cleanup by hand

## Classification

domain=process type=bug flags=[] (devkit-lite, as opened)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Scope: every `*.test.mjs` file of the repository that creates a temporary folder (18 files today): under `plugins/openspec/hooks/` (`guard`, `deliver-check`, `flow-check`, `conduct-check`, `merge-setup`, `release-rebase`, `change-loop`, `roadmap-loop`, `project-loop`), under `plugins/openspec/skills/openspec-setup/scripts/` (`github-setup`, `install-schemas`, `changes-under-way`, `project-settings`, `ship-entry`), `plugins/core/skills/review-change/scripts/review-round.test.mjs`, and under `plugins/compozy/skills/` (`screen-design/scripts/screens-check`, `compozy-setup/scripts/install-kit`, `compozy-setup/scripts/devkit-kit`).
- Helper modules, one per pack with the same content: `plugins/openspec/hooks/test-tmp.mjs`, `plugins/core/skills/review-change/scripts/test-tmp.mjs`, `plugins/compozy/skills/test-tmp.mjs`. No test imports the helper of another pack.
- Each test file creates every temporary folder through its pack's helper, with a prefix that starts with `devkit-` (today's prefixes such as `devkit-deliver-`, `devkit-gh-`, `devkit-origin-` stay readable).
- The end-of-run sweep also runs when the process gets `SIGINT` or `SIGTERM`; a `SIGKILL` cannot be covered and is accepted.
- Temporary folders that product scripts make for themselves while under test (`plugins/openspec/hooks/release-rebase.mjs`, `plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs`) already remove them; the CI step of AC-5 catches any that does not.
- The compozy tests are not imported by `guard.test.mjs`, so CI covers them only through the static refusal of AC-3, not through the empty-`TMPDIR` step of AC-5.
- `TMPDIR` stays whatever the caller set (it is `/var/tmp` on the owner's Linux worker); the helper reads `os.tmpdir()` at call time.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `helper-removes-on-pass-and-fail` — a folder created through the helper inside a test no longer exists once that test ends, whether the test passed or threw; a test of the helper proves both cases.
- AC-2 `sweep-at-run-end` — folders the helper created outside a test (module-level fixtures) or that a test's own cleanup missed are removed when the file's run ends, and also on `SIGINT` or `SIGTERM`.
- AC-3 `no-raw-temp-in-tests` — a static test in the guard suite fails when any `*.test.mjs` under `plugins/` calls `mkdtempSync` or `tmpdir()` outside the helper modules, naming each offending `file:line`.
- AC-4 `helper-copies-identical` — a test fails when the three helper modules differ in content.
- AC-5 `ci-empty-tmpdir` — the CI hook-test step runs `node --test plugins/openspec/hooks/guard.test.mjs` with `TMPDIR` set to a fresh empty folder, and the next step fails when anything is left in that folder.
- AC-6 `all-files-migrated` — the 18 test files create their temporary folders only through their pack's helper, every suite stays green, and a local run of the guard suite with `TMPDIR` set to a fresh empty folder leaves it empty.

## Questions asked

1. [scope] Which test files does the change cover? → A: all of them (18 files; the grill first counted 19), the compozy ones included, so no test of the repository leaves a folder behind. (Answer the owner delegated to the coordinating session, relayed by it on 2026-11-22.)
2. [end effect] When is each temporary folder removed? → C: each test removes the folders it created when it ends, pass or fail, wherever it can; one sweep when the file's run ends removes what escaped (module-level fixtures included). The peak during a run is what filled the worker's `/tmp`, not only what is left after it. (Delegated to the coordinating session, relayed on 2026-11-22.)
3. [end effect] How does a test prove a run leaves no folder behind? → A: three layers, no suite run twice: (1) a test of the helper proves its folder is gone after a passing and after a failing test; (2) a static test refuses `mkdtempSync` or `tmpdir()` in any `*.test.mjs` outside the helper; (3) in CI the guard suite runs with `TMPDIR` set to a fresh empty folder and a following step fails when anything is left in it. (Delegated to the coordinating session, relayed on 2026-11-22.)

4. [scope] Where does the helper live? → A: one module per pack with the same content, and a test that fails when the copies diverge; each pack stays installable on its own. (Delegated to the coordinating session, relayed on 2026-11-22.)

## Out of scope

- Removing fixture folders already left on any machine (never delete fixture folders by age).
- Changing how product scripts handle their own temporary folders.
- Adding the compozy tests to the CI run.
- Covering a run killed with `SIGKILL`.
