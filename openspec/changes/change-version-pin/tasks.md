<!-- devkit-stage tasks result=passed attempt=2 commit=cc4d863ed45de6268e0baab71024b91399a9e17e -->
# Tasks

Change: `change-version-pin` · Date: 2026-11-22 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, key, message, function, file and test
name is in `design.md`: D-1 the pin and its reader and writer, D-2 the kept flow versions, D-3 the one
reader in `guard.mjs`, D-4 the readers, D-5 the newer-flow line and the resume reply, D-6 the open,
D-7 the `flow` command and the `script` switch, D-8 the repository check, D-9 the tests, D-10 the
existing tests that change, D-11 documents and release. The implementer copies them and makes no
design choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every new test lives in
`plugins/openspec/hooks/version-pin.test.mjs` and its name starts `version-pin AC-<n> ` (D-9). Every
process a new test spawns takes the file's env constant, which blanks `DEVKIT_BYPASS`,
`DEVKIT_CHANGE`, `DEVKIT_BRANCH`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH`; a CI
test then sets its own `GITHUB_HEAD_REF`. Every new test must also pass with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set in the runner's env, as a pull-request run on CI has them: each phase gate runs
the suite that way. The tests need the `openspec` CLI 2.x on `PATH`. The whole suite
(`node --test plugins/openspec/hooks/guard.test.mjs`, 13 to 21 minutes) runs once per phase, at its
gate, as a background command of the tool (never with a shell `&`); a task's own check runs only its
tests, with `--test-name-pattern`.

Test first in every task: write its tests, see them fail on the code before the task, then make them
pass. An existing test changes only where `design.md` D-10 names it, in the task that changes its rule,
with its invariant named in the commit message. Leave no backup or scratch file in the tree, and end
every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `open-records-the-pin` | 2.1, 2.2, 2.6, 2.7 |
| AC-2 | `old-change-keeps-its-flow` | 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 |
| AC-3 | `new-change-takes-installed-flow` | 1.1, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.7 |
| AC-4 | `unpinned-change-unchanged` | 1.1, 1.3, 1.4, 1.5, 1.6, 1.7 |
| AC-5 | `readout-names-newer-flow` | 1.1, 1.4, 1.7, 2.1, 2.4, 2.5, 2.7 |
| AC-6 | `move-only-on-command` | 2.1, 2.3, 2.4, 2.6, 2.7, 3.3 |
| AC-7 | `flow-change-raises-version` | 1.1, 1.2, 3.1, 3.2, 3.3, 3.5 |

## 1. The flow a change follows: the reader and every reader of it (AC-2, AC-3, AC-4, AC-5, AC-7)

- [x] 1.1 Create `plugins/openspec/hooks/version-pin.test.mjs` with the D-9 env constant and helpers
  (`flowV2`, `upgradeTo2`, `packV2`, `planFiles`, `pinOf`), and add its import line to
  `plugins/openspec/hooks/guard.test.mjs` as D-9 writes it. Write the D-9 tests of the rows AC-2, AC-3
  (all but `open: a change opened after the upgrade records flow 2`), AC-4, AC-5 (the two `readout:`
  rows) and AC-7 (`schema: every kept flow is valid and named by its version`), with the pin lines
  written by hand exactly as D-1 shows them (the open writes them from phase 2 on). Run them on the
  code before this phase and save the output, as printed, to
  `openspec/changes/change-version-pin/proof/red-1.txt`. Check: the file shows each of those tests
  failing, except the five D-9 names as passing before and after (`AC-2 guard`, `AC-2 ci`,
  `AC-2 conductor`, `AC-4 guard`, `AC-4 conductor`), which it shows passing.
- [x] 1.2 Add `flows/1.json`, a byte copy of the folder's `flow.json` as the tree holds it when this
  task runs (the `cc4d863` content after `stage-roles`; no copy of the 0.21.x content), to `devkit`,
  `devkit-lite` and `devkit-project` under `plugins/openspec/schemas/` and under `openspec/schemas/`
  (D-2). Check:
  `cmp` of each `flows/1.json` with its `flow.json` exits 0, and
  `node --test --test-name-pattern="openspec/schemas copies are byte-identical" plugins/openspec/hooks/flow-check.test.mjs`
  passes.
- [x] 1.3 In `plugins/openspec/hooks/guard.mjs` add `FlowUsageError`, `readFlow`, `readFlowFile` and
  their constants moved from `plugins/openspec/hooks/flow-check.mjs` (`SOURCES`, `PARTS`, `STAGE_KEYS`
  with `appliesWhen` and `notAfter`, `SETTING_PATH`, `LANGS` as `FLOW_LANGS`), every check of
  `readFlowFile` moving unchanged (the `ceiling` `"owner"`, `appliesWhen` and `notAfter` checks
  included) but the version rule of D-3, then `readPin` (D-1), `changeFlow`, `changeDeclares` and
  `changeDeclaresOrInstalled` (D-3); make `flow-check.mjs` import and re-export the three names and
  take `LANGS` from `FLOW_LANGS`. Check:
  `node --test --test-name-pattern="^version-pin AC-4 (readPin|readFlowFile|changeDeclares)" plugins/openspec/hooks/version-pin.test.mjs`
  and `node --test --test-name-pattern="^version-pin AC-7 schema" plugins/openspec/hooks/version-pin.test.mjs`
  pass, and so do the D-10 reader tests:
  `node --test --test-name-pattern="flow-check declaration|field-fixes 7 flow-check" plugins/openspec/hooks/guard.test.mjs`.
- [x] 1.4 In `plugins/openspec/hooks/flow-check.mjs` make `collectFlow` read an active change through
  `changeFlow` and set `facts.flowVersion`, give the report its `flow` key, and print the D-5 line in
  `renderText`, in `en` and `pt-BR` (D-4 A1 to A3, D-5). The callers that read through `collectFlow`
  (D-4 A4, A5, A6, A11, A12) need no edit. In the same task add `'flow'` after `'previous'` to the key
  list of "flow-check readout: --json carries the same facts" in
  `plugins/openspec/hooks/flow-check.test.mjs` (line 1076; D-10), naming its invariant (the JSON
  readout's keys are pinned) in the commit message. Check: every `version-pin AC-2 readout`, `AC-2 loop`,
  `AC-2 where`, `AC-3 readout`, `AC-4 readout`, `AC-4 project` and `AC-5 readout` test passes, and so
  does
  `node --test --test-name-pattern="flow-check readout" plugins/openspec/hooks/flow-check.test.mjs`
  (the approved sample, unchanged, and the `--json` key list with `flow`).
- [x] 1.5 Read the readiness through `changeDeclaresOrInstalled` in `guard.mjs#writeViolation`
  (D-4 A15) and through `changeDeclares` in `plugins/openspec/hooks/deliver-check.mjs#collectState`
  and `#checkOne` (D-4 A16, A17; `runSeveral` judges through `checkOne`). Check: every
  `version-pin AC-2 guard`, `AC-2 ci`, `AC-3 guard`, `AC-3 ci`, `AC-3 deliver`, `AC-4 guard` and
  `AC-4 ci` test passes.
- [x] 1.6 Read the change's flow through `changeFlow` in `plugins/openspec/hooks/change-loop.mjs`
  (`subagentStopFor`, `handOffFor`: D-4 A7, A8), `plugins/openspec/hooks/roadmap-loop.mjs#stageTitleOf`
  (A9) and `plugins/openspec/hooks/conduct-check.mjs#planArtifactsOf` (A13: the exported
  `planArtifactsOf(root, schema, dir)` keeps its signature and argument order and reads
  `changeFlow(root, dir)` inside, its `appliesWhen` / `notAfter` filter unchanged); read `needsReadiness` and `needsRequirements` in
  `conduct-check.mjs#planFacts` through `changeDeclaresOrInstalled` (A14) and drop the
  `schemaHasArtifact` import when unused; export `stageTitleOf` and `isPreviousScript` from
  `roadmap-loop.mjs` (A9, A10). Check: every `version-pin AC-2 locks`, `AC-2 roadmap`,
  `AC-2 conductor`, `AC-3 locks`, `AC-3 conductor`, `AC-4 conductor` and `AC-4 roadmap` test passes;
  and the sweep of D-4,
  `grep -rnE "readFlow\(|schemaHasArtifact\(" plugins/openspec/hooks plugins/openspec/skills --include=*.mjs --exclude=*.test.mjs`,
  prints only the lines D-3 and D-4 table B keep: the definitions of `readFlow` and
  `schemaHasArtifact` and their calls in `changeDeclares` and `changeDeclaresOrInstalled`
  (`guard.mjs`), the archived branch of `collectFlow` (`flow-check.mjs`, B1), `recordPin` and
  `moveFlow` (`change-loop.mjs`, B4 and B5, which phase 2 adds; before phase 2 they are absent) and
  the not-opened slice of `project-loop.mjs#readFacts` (B7).
- [x] 1.7 Gate: `env GITHUB_HEAD_REF=change-version-pin GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green, the whole suite run once as a background command; covers AC-2, AC-3 and AC-4 for every D-4 table A reader (the readout, the change, roadmap and project loops, the hook, the check, the conductor and the locks), AC-5 for the readout, AC-7 for the kept files, and every D-10 test of this phase.

## 2. The writers: open, switch, move and the resume line (AC-1, AC-3, AC-5, AC-6)

- [x] 2.1 Write the D-9 tests of the rows AC-1, AC-3 `open: a change opened after the upgrade records
  flow 2`, AC-5 (the two `resume:` rows) and AC-6 in `plugins/openspec/hooks/version-pin.test.mjs`.
  Run them on the code before this phase and save the output, as printed, to
  `openspec/changes/change-version-pin/proof/red-2.txt`. Check: the file shows each of those tests
  failing, except the three D-9 names as passing before and after (`AC-1 skill`,
  `AC-5 resume: an equal installed flow adds no line`,
  `AC-6 flow: next, wait, another open, a setup re-run and a pack update leave the pin`), which it
  shows passing.
- [x] 2.2 Add `packVersion`, `writePin` and `recordPin` to `plugins/openspec/hooks/change-loop.mjs`
  (D-1) and call `recordPin` in `openUnderLock` after `openspec new change` (D-6). Check: every
  `version-pin AC-1` test but the `skill:` one passes, and so does
  `version-pin AC-3 open`; and
  `node --test --test-name-pattern="^change-loop open|^project-loop start: open" plugins/openspec/hooks/guard.test.mjs`
  passes unchanged.
- [x] 2.3 Call `recordPin` in `change-loop.mjs#switchScript` case C1 (D-7). Check: both
  `version-pin AC-6 script` tests pass, and so does
  `node --test --test-name-pattern="^change-loop script" plugins/openspec/hooks/change-loop.test.mjs`
  unchanged (C2 and C3 byte-equal).
- [x] 2.4 Add `moveFlow`, `runFlow`, the `flow` branch of `main` and `| flow <id> --lang <l>` to
  `USAGE` (line 1464 at `cc4d863`, right after `| accept-decisions <id> --lang <l>`) in
  `change-loop.mjs`, and the keys `flow-newer`, `flow-moved` and `flow-ahead` to `MESSAGES` in `en`
  and `pt-BR` (D-5, D-7). In the same task add `version: 1, installed: 2` to `SAMPLE` in
  `plugins/openspec/hooks/change-loop.test.mjs` (D-10), naming its invariant in the commit message.
  Check: every `version-pin AC-6 flow` test passes, and so does
  `node --test --test-name-pattern="change-loop replies" plugins/openspec/hooks/change-loop.test.mjs`.
- [x] 2.5 Add `flowNotice` to `change-loop.mjs` and the second line of the `resume` reply in
  `startMode` (D-5). Check: both `version-pin AC-5 resume` tests pass, and so does
  `node --test --test-name-pattern="^change-loop start" plugins/openspec/hooks/change-loop.test.mjs`
  unchanged.
- [x] 2.6 Write the `flow` sentence and the `resume` bullet of D-11 in
  `plugins/openspec/skills/devkit/SKILL.md`, and add `flow` to the subcommand regex and list of
  "change-loop skill: every change-loop command and the readout carry the person's language" in
  `change-loop.test.mjs` (D-10), naming its invariant in the commit message. Check:
  `version-pin AC-1 skill` and `version-pin AC-6 skill` pass,
  `node --test --test-name-pattern="^change-loop skill" plugins/openspec/hooks/change-loop.test.mjs`
  passes, and `python3 scripts/check.py` passes.
- [x] 2.7 Gate: `env GITHUB_HEAD_REF=change-version-pin GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green, the whole suite run once as a background command; covers AC-1, AC-3 for the open, AC-5 for the resume reply, AC-6, and every D-10 test of this phase.

## 3. The repository check, the documents and the release (AC-6, AC-7)

- [x] 3.1 Write the D-9 tests of the AC-7 rows whose names start `check:` in
  `plugins/openspec/hooks/version-pin.test.mjs` (each spawns `python3 scripts/check.py --root` on a
  scratch root, as the install-scope lint tests of `guard.test.mjs` do). Run them on the code before
  this phase and save the output, as printed, to
  `openspec/changes/change-version-pin/proof/red-3.txt`. Check: the file shows each of those tests
  failing, `check: a root without the schemas skips the check` excepted (it passes before and after).
- [x] 3.2 Create `scripts/released-flows.json` with the digests of the three
  `plugins/openspec/schemas/<script>/flows/1.json` files (D-8 format), and add `check_flow_versions()` to
  `scripts/check.py`, called from `main()` after `check_panel_parity()`, with the D-8 rules and
  messages; add the check to the list in the module's docstring. Check: every
  `version-pin AC-7 check` test passes, and `python3 scripts/check.py` on the tree prints
  `all checks passed`.
- [x] 3.3 Write the D-11 text in `docs/openspec-flow.md`, `CONTRIBUTING.md` (the schema paragraph),
  `plugins/openspec/README.md` and `plugins/openspec/skills/openspec-setup/SKILL.md`. Check:
  `python3 scripts/check.py` passes; `docs/openspec-flow.md` names `x-devkit-flow`, `flows/<n>.json`
  and `change-loop.mjs flow`; `CONTRIBUTING.md` names `scripts/released-flows.json`.
- [x] 3.4 Release as D-11 says: read the versions on `origin/main` as the worktree's ref holds them
  (`git show origin/main:plugins/openspec/.claude-plugin/plugin.json` and
  `git show origin/main:.claude-plugin/marketplace.json`; the coordinating session fetches and merges
  `main` before this task when siblings merged), then set devkit-openspec's next minor version
  (0.23.0 while `main` holds 0.22.0) in `plugins/openspec/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json`, the marketplace's next minor `metadata.version` (0.27.0 while it
  is 0.26.0), the `CHANGELOG.md` entry with its "Projects" line above the top entry
  (`## 0.26.0 — the stage roles` at `cc4d863`), the new tag in the CI snippet of
  `docs/openspec-flow.md`, and in "change-loop docs: the design records the answers"
  (`change-loop.test.mjs`) the positive match on the new tag plus a `doesNotMatch` for `v0.22.0`
  (D-10, invariant named in the commit message), and regenerate `docs/catalog.md` with
  `python3 scripts/gen-catalog.py`. Check:
  `node --test --test-name-pattern="release-ready|the pin in docs/openspec-flow.md|change-loop docs: the design records the answers" plugins/openspec/hooks/guard.test.mjs`
  passes, `python3 scripts/check.py` passes and `python3 scripts/gen-catalog.py --check` passes.
- [x] 3.5 Gate: `env GITHUB_HEAD_REF=change-version-pin GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate change-version-pin --strict` green, the whole suite run once as a background command; covers AC-7 and the documents of AC-6, and every test of every suite at once.

## Workflow follow-up

- After the merge, tag `v<the devkit-openspec version>` on the merge commit and push the tag
  (`CONTRIBUTING.md` step 5).
- Dogfood, owed to the next change opened in this repository after the release: its
  `.openspec.yaml` carries `x-devkit-version` and `x-devkit-flow`; record it in that change's retro.
- The re-install check in the consumer projects, owed when the owner next works in them (out of
  scope here).
