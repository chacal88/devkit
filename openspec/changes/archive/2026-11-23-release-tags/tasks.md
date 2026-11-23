<!-- devkit-stage tasks result=passed attempt=1 commit=4f4b7e201aabdebdb65b11f7ce80154463a524e9 -->
# Tasks

Change: `release-tags` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. The how is fixed in `design.md` (D-1 to D-9):
the implementer copies the names, texts, calls and rules from there and makes no design choice; a
choice the design does not settle stops the phase and goes to the owner.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every hook gate runs with
`TMPDIR=/var/tmp`, `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does: a new
test that passes only without them is not done. Every new test takes its env from its file's existing
helpers (`cleanEnv`, `SET`, `gh.env`), which blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`,
`GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`. The tests need the `openspec` CLI 2.x on
`PATH`. Gates that load `deliver-check.test.mjs` (the new suite imports it) take several minutes and
run as a background command of the tool, never with a shell `&`; the whole suite runs once, in 4.6.

Test first. The first task of each phase writes that phase's tests, runs them on the code as it is
and saves the output, as printed, to `openspec/changes/release-tags/proof/red-<phase>.txt`. That run
is the task's check, never a gate. Every new test's name starts `release-tags <phase>: `, in every
suite. A test of a function this change adds reaches it through a namespace import
(`import * as deliver from './deliver-check.mjs'`, `import * as guard from './guard.mjs'`), so the red
run fails test by test instead of failing the file at load. No test reads this repository's git
history: commits, versions and tags are `fakeGh` fixtures.

Existing tests change only where `design.md` D-9 ("Existing tests that assert what this change
touches") names them, each time with its invariant, its layer and its suite; name them in the commit
message. Leave no backup or scratch file in the tree, and end every task with `git status --short`.

## 1. The setting

- [x] 1.1 Merge `origin/main` into the branch, then write the phase-1 tests (D-9 P1 and P2): create
  `plugins/openspec/hooks/release-tags.test.mjs` with P1 (`parseDevkitBlock` and `releaseTagSetting`,
  every listed form), P2's `readDevkitSettings` cases, and add its import line to
  `plugins/openspec/hooks/guard.test.mjs` after `delivery-models.test.mjs`; add to
  `plugins/openspec/hooks/change-loop.test.mjs` the test `release-tags 1: /devkit change refuses a
  release_tag that is not a path to a JSON file` (both languages, exit 3, nothing created). Check:
  `proof/red-1.txt` holds the red run of these tests.
- [x] 1.2 In `plugins/openspec/hooks/guard.mjs`, read `release_tag` in `parseDevkitBlock` and add
  `releaseTagSetting` exactly as D-1 states (the path rule and the parser edge cases). Check: the P1
  tests pass.
- [x] 1.3 In `plugins/openspec/hooks/change-loop.mjs`, extend `readDevkitSettings` (the `release-tag`
  unknown entry after the test settings' entries, `releaseTag` only when set), add
  `RELEASE_TAG_ACCEPTED` and the `setting.release-tag` key in both languages (D-1). Check: the P2 tests
  and every existing `change-loop settings` test pass unchanged.
- [x] 1.4 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^release-tags 1" --test-name-pattern="^change-loop settings" --test-name-pattern="^change-loop start" --test-name-pattern="^change-loop replies" --test-name-pattern="^delivery-models config" plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/delivery-models.test.mjs && python3 scripts/check.py` green; covers the setting half of AC-3 (no key, no change) and the refusal of the spec `change-coordination`.

## 2. The checker's facts and rows

- [x] 2.1 Write the phase-2 tests: in `plugins/openspec/hooks/deliver-check.test.mjs` export the
  fixture helpers D-9 names and give `shipRepo` and `pm` the optional `extra` config text (default
  `''`), and add `tag-release` to the `steps` list of `format: ship-change names every next.step the
  checker can return`; in `release-tags.test.mjs` add `releaseFixtures` and the tests P3 and P4; in
  `plugins/openspec/hooks/conduct-check.test.mjs` add `tag-release` to the `main` list of `conduct:
  deliveryStep maps every deliver-check step ...` (D-9). Check: `proof/red-2.txt` holds the red run; every
  existing deliver-check test still passes with the exports.
- [x] 2.2 In `plugins/openspec/hooks/deliver-check.mjs` add `releaseTagOf` (D-1) and
  `releaseTagFacts` with the six calls, their order, the `404` rules, the array answer and the tag
  rule (D-2). Check: the P3 and P4 tests that call it through `collectState` reach each call they fake
  (`gh.calls()`).
- [x] 2.3 Wire the facts (D-3): `collectState`'s post-merge branch passes the release file;
  `archiveBaseFacts` sets `release.change` once `base` is known and `release.archive` when the change is
  archived on the default branch; move the archive PR list read into `archivePrList`, used by
  `archivePrFacts`; `archiveFacts` keeps `release`; `archiveReport` unchanged. Check: the test
  `release-tags 2: without release_tag the answer and the gh calls are today's` passes, and
  `deliver-check.test.mjs:4464` (the `archive` keys) passes unchanged.
- [x] 2.4 Add rows R1 to R3 at the top of `archiveNext` and the `tag-release` entry of `describeNext`
  (D-4). Check: the AC-1, AC-2, AC-3, AC-4 and AC-5 tests of D-9 named `release-tags 2: ...` pass,
  including the CLI exit codes (0 at `tag-release`, 2 at the stop, 3 for a bad `release_tag`).
- [x] 2.5 Give the step its consumers that the existing scans require: `'tag-release'` in `MAIN` of
  `plugins/openspec/hooks/conduct-check.mjs`, `'tag-release': session('delivery')` in `ROWS` of
  `change-loop.mjs`, and the `tag-release` row of `plugins/openspec/skills/ship-change/SKILL.md` with
  the exact text of D-6. Check: `change-loop decide: the B rows are exactly the steps the checkers can
  return` and `format: ship-change names every next.step the checker can return` pass.
- [x] 2.6 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/conduct-check.test.mjs && env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^change-loop decide" plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green (a background command: the new suite loads the deliver-check suite); covers AC-1, AC-2, AC-3, AC-4 and AC-5 at the checker.

## 3. The loop and the skills

- [x] 3.1 Write the phase-3 tests: P5 in `release-tags.test.mjs` (`decide` on `deliveryStep` of the
  real phase-2 report, the archiving case, `no-progress`, `tag-elsewhere`, `archive-failed` for R1),
  `release-tags 3: ship-change has the tag-release row, its report line and its never line` and the
  `devkit` skill sentence test (P6, skills); in `change-loop.test.mjs` add `tag: 'v1.3.0', at:
  'd4e5f60', sha: 'a1b2c3d'` to `SAMPLE` and the `tag-elsewhere` case to `change-state AC-3 state: each
  blocked reason ...`; in `roadmap-loop.test.mjs` add `tag`, `at` and `sha` to `BLOCKED_PARAMS`.
  Check: `proof/red-3.txt` holds the red run.
- [x] 3.2 In `change-loop.mjs` add the `tag-elsewhere` branch of `buildPart` and the
  `blocked-why.tag-elsewhere` key in both languages, with the texts of D-5. Check: the P5 tests pass,
  and `change-loop replies: ...` passes with the new keys rendered in both languages.
- [x] 3.3 In `plugins/openspec/skills/ship-change/SKILL.md` add the Report sentence and the Never
  line, and in `plugins/openspec/skills/devkit/SKILL.md` the `session` sentence for a stopped
  `tag-release` (D-6). Check: the P6 skill tests pass and `python3 scripts/gen-catalog.py --check`
  reports no change (no description moved).
- [x] 3.4 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^release-tags" --test-name-pattern="^format: ship-change" plugins/openspec/hooks/release-tags.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check` green (a background command); covers AC-1 and AC-2 in the loop, AC-4 in the loop's reply and the skill half of AC-6.

## 4. Documents, configuration and release

- [x] 4.1 Write the phase-4 tests (P6, docs) in `release-tags.test.mjs`: `release-tags 4: CONTRIBUTING
  and the flow page describe the key and the step` and `release-tags 4: this repository names
  devkit-openspec's plugin.json as its release file` (reads the working tree: `openspec/config.yaml`
  through `readDevkitSettings`, the ADRs line, and `plugins/openspec/.claude-plugin/plugin.json`'s
  string `version`); update the CI pin invariant of `change-loop.test.mjs:2538-2545` to `v0.29.0`
  with `doesNotMatch(/v0\.28\.0/)` and its comment. Check: `proof/red-4.txt` holds the red run.
- [x] 4.2 Edit `openspec/config.yaml`: `release_tag: plugins/openspec/.claude-plugin/plugin.json` in
  the `devkit:` block with its comment line, and ADR 0019 in the `ADRs:` line of `context:` (D-1,
  D-7). Check: the AC-7 test passes and `openspec validate release-tags --strict` still passes.
- [x] 4.3 Edit `CONTRIBUTING.md` step 5 and `docs/openspec-flow.md` as D-7 lists (the paragraph, rows
  R1 to R3, the merge-mode `tag-release` row, the main-session list, the Troubleshooting row, no
  literal version outside `## CI`). Check: the AC-6 docs test, `AC-8 release-ready ...` and
  `release-rebase pin: the real docs/openspec-flow.md ...` pass.
- [x] 4.4 Release: re-read `version` of devkit-openspec and the marketplace release on `origin/main`
  (merge it first) and take the next after them (0.29.0 and 0.33.0 at `4f4b7e2`); set them in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, move the three
  CI pin lines of `docs/openspec-flow.md` to that version, and add the CHANGELOG entry
  (`## 0.33.0 — release tags`: devkit-openspec's `release_tag` key and `tag-release` step, ADR 0019,
  the CI snippet pin). Check: the pin tests (`deliver-check.test.mjs:3795`, `:3805`,
  `change-loop.test.mjs:2541`) pass and `command claude plugin validate .` exits 0.
- [x] 4.5 Run `openspec validate release-tags --strict` and `python3 scripts/check.py` once all
  documents are written. Check: both exit 0.
- [x] 4.6 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate release-tags --strict` green (the guard suite as a background command); covers AC-1 to AC-7 and every other suite at once.

## Workflow follow-up

- After the change's pull request merges, `v0.30.0` (or the version 4.4 settled) must be on `origin`
  at its merge commit. The installed devkit-openspec runs the loop, so the step appears only once a
  version with this change is installed; until then push the tag by hand as CONTRIBUTING.md step 5
  says, and record in `retro.md` whether the loop or the owner pushed it.
- ADR 0019 is accepted by the loop's `accept-decisions` step after the owner approves the plan.
- Archive the change after the review bench and the owner's answers to the retro, as `ship-change`
  leads it.
