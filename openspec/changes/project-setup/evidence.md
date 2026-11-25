<!-- devkit-stage evidence result=passed attempt=2 commit=b5509177fc338e9f7c7c7b51054ebe150fcc3563 -->
Commit: b5509177fc338e9f7c7c7b51054ebe150fcc3563

# Evidence

Change `project-setup`, verified at `b550917` (the tree was clean: `git status --short` printed nothing before and
after the runs). The branch's last merge of `origin/main` is `b550917`, which brought `3ca2e47` (train 17: the change
`suite-socket-path`, which changed `scripts/test-suite.mjs`, `plugins/openspec/hooks/test-suite.test.mjs` and one line
of `CONTRIBUTING.md`, plus the archive of `forced-merge-path`); the merge before it, `a20dca4`, brought `be0c35d`
(train 16) and was already under the attempt-1 evidence written at `14aca45`. The release at this head:
devkit-openspec 0.48.0 (main's `3ca2e47` has 0.47.2), devkit-compozy 0.5.0 (main 0.4.0), marketplace 0.53.0 (main
0.52.2), read from the `version` fields of the two `plugin.json` files and `.claude-plugin/marketplace.json`; the
`CHANGELOG.md` entry `0.53.0` sits above main's `0.52.2`, and the three CI pins of `docs/openspec-flow.md` read
`v0.48.0`. The record stays `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md` (the only `0031` file).

## Verification

Who ran what:

- **The verifier** (this file's writer, not the implementer and not the conducting session) ran every gate part
  below again on `b550917`, each as its own command with its own exit code, with `TMPDIR=/var/tmp/devkit-project-setup`.
  The suite parts ran with `--concurrency=3`, the value the coordinator set for this shared worker, where `tasks.md`
  writes `--concurrency=2`; that flag is the only difference from the written commands. Before the first run,
  `pgrep -f 'scripts/test-suite.mjs$'` showed no whole-suite run on the machine; filtered suite runs of two other
  worktrees (`release-at-merge`, `coordinator-loop-fixes`) ran at the same time, and each suite row records the load
  average at its start and end. No gate runs the whole suite: this repository delivers on a delivery train, whose
  departure runs it (`tasks.md` header). No test file failed, so none needed a rerun alone. No run printed a
  `run root:` line, so the suite's run root (train 17's rule) was made under this `TMPDIR`.
- **What the merge of train 17 changed** (`git diff --name-only 14aca45 HEAD`, the train's records and the archive of
  `forced-merge-path` left aside): `scripts/test-suite.mjs`, `plugins/openspec/hooks/test-suite.test.mjs`,
  `plugins/openspec/hooks/delivery-train.test.mjs` (one line), `CONTRIBUTING.md` (the suite paragraph), the
  `pr-verifier` text in `plugins/core/agents/pr-verifier.md`, `plugins/compozy/kit/templates/agents/pr-verifier/AGENT.md`
  and `.compozy/agents/pr-verifier/AGENT.md`, `plugins/core/skills/review-change/SKILL.md`,
  `plugins/openspec/skills/ship-change/SKILL.md` (one line), `plugins/core/.claude-plugin/plugin.json`,
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `openspec/roadmap.md` and three canonical specs. At this head
  `SUITE_FOLDERS` of `scripts/test-suite.mjs` names `plugins/openspec/skills/devkit/scripts` and
  `plugins/compozy/kit/scripts` (this change's folders), and the suite paragraph of `CONTRIBUTING.md` keeps main's new
  run-root text with the same two folders. The only canonical requirement the merge added to
  `openspec/specs/change-coordination/spec.md` is "The loop leads an owner's forced merge to the retro", which this
  change's delta does not modify; `openspec/specs/project-setup/spec.md` and `openspec/specs/compozy-kit-setup/spec.md`
  did not change. Of this change's setup files, only the kit template `agents/pr-verifier/AGENT.md` changed (one line,
  main's text), and `gen-agents.mjs --check` stays green.
- **Re-run because the merge can affect them:** every gate part (the suite parts above all because of the new
  `scripts/test-suite.mjs`), and the start mode, the plan's driver list and the old-name `git grep` of the Checks
  section below, in a new scratch repository on `b550917`.
- **Kept from attempt 1, because the merge changed none of their inputs:** the real runs R-1 to R-6 (design D-14,
  tasks 7.1 to 7.7), run by the session that conducts this change, never by `tdd-implementer`, and committed under
  `openspec/changes/project-setup/proof/`; `git diff --stat 14aca45 HEAD -- openspec/changes/project-setup/proof`
  prints nothing, and `git diff --stat 14aca45 HEAD -- plugins/openspec/skills/devkit plugins/compozy/kit
  plugins/openspec/hooks/change-loop.mjs plugins/openspec/hooks/guard.mjs plugins/openspec/hooks/merge-setup.mjs`
  lists only the kit template's `pr-verifier` line. The attempt-1 verifier read every proof file and the R-1 session
  transcript; this attempt re-read the owner's words quoted in `proof/r3-merge-mode.txt` (line 2) and its
  repository line (line 3). The real runs read devkit-openspec 0.47.0: they ran before train 16 renumbered the release
  to 0.48.0.
- **Earlier gate files** of the conducting session, kept as the phases ran: `proof/gate-2.9.txt`, `gate-3.6.txt`,
  `gate-4.5.txt`, `gate-5.6.txt`, `gate-6.10.txt`, `gate-7.8.txt` and `post-merge-6a67628.txt`. The red runs of the
  test-first tasks are `proof/red-3.txt` to `red-6.txt`. The rows below quote only the verifier's own runs at
  `b550917`.

### Gates

One row per `&&` part of every gate task of `tasks.md` (1.4, 2.9, 3.6, 4.5, 5.6, 6.10, 7.8); a part that several gates
name has one row, naming them all.

| Gate | Command | Result |
|---|---|---|
| 1.4 | `git merge-base --is-ancestor c09860c HEAD` | pass: exit 0 (the branch also holds `3ca2e47`, train 17, through its last merge `b550917`: `git merge-base --is-ancestor 3ca2e47 HEAD` exits 0) |
| 1.4 | `test -d openspec/changes/archive/2026-11-24-compozy-driver` | pass: exit 0 at this head |
| 1.4 | `test -d openspec/changes/archive/2026-11-24-delivery-train` | pass: exit 0 at this head |
| 1.4 | `test -f plugins/openspec/hooks/compozy-driver.mjs` | pass: exit 0 at this head |
| 1.4 | `test -f plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs` | pass: the precondition of the base, exit 0 on the tree of the base `f1dcefa` (extracted again with `git archive f1dcefa` into a scratch folder under `/var/tmp/devkit-project-setup/` and run there by the verifier, then removed); at this head it exits 1 by design, because phase 2 moved the file: `test -f plugins/compozy/kit/scripts/gen-agents.mjs` exits 0 here (the workflow follow-up of tasks.md runs gate 1.4's checks "at the paths phase 2 left") |
| 1.4 | `test -f scripts/test-suite.mjs` | pass: exit 0 at this head |
| 1.4 | `grep -q "const DRIVER_ROUND = { script: 22 };" plugins/openspec/hooks/change-loop.mjs` | pass: exit 0 at this head |
| 2.9 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs plugins/compozy/kit/scripts/install-kit.test.mjs plugins/compozy/kit/scripts/adoption.test.mjs plugins/compozy/kit/scripts/gen-agents.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs plugins/compozy/kit/scripts/loop-templates.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/release-tags.test.mjs` | pass: `suite: 32 files, 2940 tests, 2937 pass, 0 fail, 1508.9s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); the 3 tests neither pass nor fail are the skipped `compozy-loops ... compozy loop validate accepts the raw template` tests (`compozy` is not on `PATH`); load average at start 7.16 6.50 10.10, at end 10.95 10.70 9.98 (8 cores) |
| 2.9, 7.8 | `node plugins/compozy/kit/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 2.9, 5.6, 6.10, 7.8 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` |
| 2.9, 6.10, 7.8 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output |
| 3.6 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" --test-name-pattern="^change-loop start" --test-name-pattern="^roadmap-loop start" --test-name-pattern="^project-loop start" --test-name-pattern="^project-loop next: S23" --test-name-pattern="^nextStep row 3a" --test-name-pattern="^mergeSetup" --test-name-pattern="^flow-check AC-7" --test-name-pattern="^compozy-driver readiness" --test-name-pattern="^field-fixes 7 apply" --test-name-pattern="^delivery-train P13" --test-name-pattern="^delivery-train P9 N7" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs` | pass: `suite: 11 files, 76 tests, 76 pass, 0 fail, 45.1s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 5.25 6.03 10.45, at end 6.79 6.33 10.34 (8 cores) |
| 4.5 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" --test-name-pattern="^stage-roles setup" --test-name-pattern="^format: the config template" plugins/openspec/skills/devkit/scripts/setup-block.test.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/test-suite.test.mjs` | pass: `suite: 6 files, 37 tests, 37 pass, 0 fail, 8.9s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 6.41 6.26 10.30, at end 6.49 6.29 10.26 (8 cores) |
| 5.6 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup " --test-name-pattern="^format: the Setup section" --test-name-pattern="^field-fixes 5 skill" --test-name-pattern="^gh-version 19" --test-name-pattern="^stage-roles" --test-name-pattern="^change-loop skill" --test-name-pattern="^roadmap-loop skill" --test-name-pattern="^project-loop skill" --test-name-pattern="^release-merge-conflict 16" --test-name-pattern="^delivery-train docs" --test-name-pattern="^upfront AC-1 skill" --test-name-pattern="^upfront AC-16 skill" --test-name-pattern="^stage-models AC-9" --test-name-pattern="^AC-6 instructions-follow" plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs` | pass: `suite: 10 files, 139 tests, 139 pass, 0 fail, 16.2s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 6.21 6.23 10.22, at end 6.77 6.37 10.19 (8 cores) |
| 6.10, 7.8 | `claude plugin validate .` | pass: exit 0, `Validation passed` |
| 6.10, 7.8 | `openspec validate project-setup --type change --strict` | pass: exit 0, `Change 'project-setup' is valid` |
| 6.10 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-2" --test-name-pattern="^docs sweep" --test-name-pattern="^change-loop docs" --test-name-pattern="^suite-speed AC-7" --test-name-pattern="^suite-speed AC-8" --test-name-pattern="^upfront AC-5 docs" plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/test-suite.test.mjs` | pass: `suite: 7 files, 9 tests, 9 pass, 0 fail, 7.4s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 6.63 6.35 10.16, at end 6.58 6.35 10.13 (8 cores) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r1-first-install.txt` | pass: exit 0 (15999 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r2-rerun.txt` | pass: exit 0 (5671 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r3-merge-mode.txt` | pass: exit 0 (18805 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r4-kit-yes.txt` | pass: exit 0 (16974 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r5-driver-compozy.txt` | pass: exit 0 (19344 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r6-typed-only.txt` | pass: exit 0 (20681 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs plugins/openspec/skills/devkit/scripts/setup-block.test.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs plugins/compozy/kit/scripts/install-kit.test.mjs plugins/compozy/kit/scripts/adoption.test.mjs plugins/compozy/kit/scripts/gen-agents.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs plugins/compozy/kit/scripts/loop-templates.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/release-tags.test.mjs` | pass: `suite: 34 files, 2962 tests, 2959 pass, 0 fail, 1432.5s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); the 3 tests neither pass nor fail are the same three skipped `compozy-loops` tests; the 12 `suite-socket-path` tests that train 17 brought into `test-suite.test.mjs` passed; load average at start 10.20 10.54 9.94, at end 5.39 8.32 8.82 (8 cores) |

### Checks the verifier ran on this head, outside the gates

On `b550917`, in a new scratch git repository under `/var/tmp/devkit-project-setup/` with only a `package.json`
(version `1.0.0`, a `test` script) and one commit, removed afterwards:

- `change-loop.mjs start --lang en` with `setup` on standard input, no `openspec/`: exit 0, JSON fields `version`,
  `mode` (`setup`), `verb` (`setup`), `text`, `change`, `unfinished`, `task`, `settings`, `root` (the scratch
  repository's root), `reply` (null); `git status --short --untracked-files=all` printed nothing (nothing was created).
- `change-loop.mjs start` with `change add a thing`, same folder: exit 0, `mode` `not-set-up`, and the reply "This
  project is not set up for devkit yet: type /devkit setup first. Nothing was run."
- With an `openspec/config.yaml` holding `schema: devkit-lite` and a `devkit:` block with `driver: compozy`: `start`
  with `setup` still answers `mode` `setup`, `reply` null (no CompozyOS run).
- `setup-block.mjs plan <root> --json` with no config: exit 0, fields `version`, `config`, `block`, `present`, `kept`,
  `missing`, `drivers`, `driverNotBuilt`, `releaseFile`, `kit`, `pluginVersion`, `ciPin`, `fill`; `drivers`
  `["claude","compozy"]`, `driverNotBuilt` null, `pluginVersion` `0.48.0`, `releaseFile` `package.json`, `kit`
  `absent`, `fill` `schema, context, rules, operations`, and `missing` in order: `language` (default `en`), `driver`
  (default `claude`; options `claude`, `compozy`), `delivery` (default `none`; options `none`, `trunk`, `trunk-auto`,
  `two-prs`), `tests.unit` (proposed `npm test`), `tests.coverage.command`, `tests.coverage.target`, `tests.e2e`,
  `ship` (default `merge`; options `plan`, `pr`, `merge`), `merge_method` (default `squash`), `release_tag` (default
  `package.json`).
- The same plan with a block holding `driver: script`: exit 0, `drivers` `["claude","compozy"]`, `driverNotBuilt`
  `{ driver: script, round: 22 }`, and `driver` is not among the `missing` keys (it is neither offered nor asked).
- `plugins/openspec/skills/devkit/SKILL.md` frontmatter: `disable-model-invocation: true`; `argument-hint` lists
  `setup` right after `status`. `ls plugins/openspec/skills` prints `devkit`, `devkit-session`, `ship-change`;
  `ls plugins/compozy/skills` prints `screen-demo`, `screen-design`, `test-tmp.mjs`; `plugins/compozy/kit` holds
  `scripts` and `templates`.
- `git grep -l -E "openspec-setup|compozy-setup"` outside `openspec/changes`, `openspec/trains`, `docs/adr` and
  `CHANGELOG.md` lists five files, all of them exemptions design D-9 names: the two canonical specs
  (`openspec/specs/project-setup/spec.md`, `openspec/specs/compozy-kit-setup/spec.md`, lines inside requirement
  blocks this change's deltas MODIFY), the two fixtures of `plugins/openspec/hooks/fixtures/c561553/` and
  `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/config.yaml`. The test `setup AC-2 tree: no file outside
  the history names the removed setup skills, and neither skill folder exists` (N-10) passed in gate 6.10's run.

### Acceptance criteria

| AC | Criterion | Proof | Result |
|---|---|---|---|
| AC-1 | `setup-verb`: typing `/devkit setup` in a scratch project with the packs and no `openspec/` leaves `.claude/settings.json` enabling the packs, the `devkit` and `devkit-lite` schemas under `openspec/schemas/` and an `openspec/config.yaml` with a `devkit:` block; accepted only from the owner's typed command, as `/devkit change` is | R-1 (`proof/r1-first-install.txt`, unchanged since attempt 1): the typed `/devkit-openspec:devkit setup` in a new git repository with no `openspec/` ran `change-loop.mjs start` with `setup`, then the Setup steps; the file shows `.claude/settings.json` enabling `devkit-core@devkit` and `devkit-openspec@devkit`, `ls openspec/schemas` listing `devkit`, `devkit-lite`, `devkit-project`, and `openspec/config.yaml` holding an uncommented `devkit:` block. On `b550917` the verifier saw `start` answer `mode` `setup` with no `openspec/` (and on the `compozy` driver), the reply `not-set-up` naming `/devkit setup`, and the skill's `disable-model-invocation: true` with `setup` in its hint (Checks section). The `setup AC-1` tests passed in gates 3.6, 5.6 and 7.8 at this head. Typed-only: R-6 (`proof/r6-typed-only.txt`) shows no Skill call for a plain-words request in any case and an empty `git status --short` in the declared case (R-1's project); its extra case shows a session can still run the setup scripts by hand and write a setup's files, as it can for `/devkit change`: finding F-1 | pass (the typed-only part holds as for `/devkit change`; see finding F-1, which the owner weighs) |
| AC-2 | `old-skills-gone`: the skills `openspec-setup` and `compozy-setup` no longer exist; no reply, hook message or document names them or `/openspec-setup`; each names `/devkit setup`; `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass | Neither skill folder exists (`ls plugins/openspec/skills`, `ls plugins/compozy/skills`, Checks section). `git grep` on `b550917` finds the old names outside the history only in the five files design D-9 exempts; train 17's `CONTRIBUTING.md` line names the new folders. Tests `setup AC-2 tree` (N-10), `setup AC-2 replies`, `setup AC-2 project`, `setup AC-2 train` passed in gate 6.10's run at this head, and the `setup AC-2` tests in gates 3.6 and 7.8; the `not-set-up` reply on this head names `/devkit setup`. `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` exit 0 (Gates) | pass |
| AC-3 | `block-written`: after a first setup with answers, `openspec/config.yaml` holds `devkit.language`, `devkit.driver`, the delivery settings, the confirmed `devkit.tests.*` and the ship mode; `budget` and `design:` only as commented examples; `release_tag` only when a release file exists | R-1: answers `en`, `claude`, delivery `none`, `npm test` confirmed, no coverage, ship `pr`, release `package.json`; the file holds `language: en`, `driver: claude`, `tests.unit: "npm test"`, `release_tag: package.json` and `ship:` `pr` for `devkit-lite`, `devkit`, `devkit-project`, written by `setup-block.mjs apply` (the R-1 transcript holds the call); delivery `none` writes no key by design. R-3: the same with ship `merge` and `merge_method: squash`. R-4 (no `package.json`): no `release_tag` and none asked. Neither key `budget` nor `design:` was written by any run (observation O-4). The `setup AC-3` tests (block apply, plan, parser, suite; the apply test writes `delivery` `two-prs` with `base` and `test_branch` and checks `budget` and `design:` stay comments, and `release_tag is asked only with a package.json version`) passed in gates 4.5 and 7.8 at this head; `setup-block.test.mjs` passed in gate 7.8's run | pass |
| AC-4 | `rerun-keeps`: a second `/devkit setup` keeps every value present, asks only what is missing, and leaves `openspec/config.yaml` byte-identical when nothing is missing | R-2 (`proof/r2-rerun.txt`) on R-1's project: plan `missing` = the three optional test keys R-1 left unset, `fill` empty; no question about a key R-1 answered; the optional keys were asked again and declined (accepted in design.md, Risks); `shasum -a 256 openspec/config.yaml` before and after `12f78412f958ca309ef842b439d5e22333d6067e25f6e5657ec30c87e75f5d20`, equal; `git status --short` empty. R-5's re-run on the `compozy` driver: `3e154f17201be2ad77ddaa6c7ca41013c101da49b6b34361f66c7305a675b736` before and after, equal, `git status --short` empty, `setup-block.mjs apply` with `{}` wrote nothing. The `setup AC-4` tests (apply byte-identical with nothing missing, a present key refused, one missing key inserted, `fill` only when absent, kept values, skill step 5) passed in gates 4.5, 5.6 and 7.8 at this head | pass |
| AC-5 | `no-checker-copy`: no checker code copied; the step records the plugin version and names each pack not enabled in `.claude/settings.json` | R-1: `find . -name guard.mjs -o -name flow-check.mjs -o -name deliver-check.mjs -o -name merge-setup.mjs` printed nothing; the report names "devkit-openspec 0.47.0" as the schemas' version and `devkit-design` as not enabled; `setup-block.mjs plan` after the run reads `pluginVersion` `0.47.0`, `ciPin` null. On `b550917` the plan reads `pluginVersion` `0.48.0`. The `setup AC-5` tests (block plan, `settings: a dry run names a pack set to false and writes nothing`, skill) passed in gates 4.5, 5.6 and 7.8 at this head | pass |
| AC-6 | `driver-rule`: only the drivers `/devkit change` runs are offered, never a `driver-not-built` value; the `.compozy/` kit's yes/no question is asked separately, and a yes installs the kit as `compozy-setup` did | R-1, R-3, R-4 and R-5 offered `claude` and `compozy` and never `script`; the kit question came after the block, apart from the driver (R-1 and R-3 no, R-2 no again, nothing written). R-4 (`proof/r4-kit-yes.txt`) yes: the installer printed 27 `create` lines under `.compozy/`, `.compozy/kit-manifest.json` exists (pack `0.5.0`, `__TIMEZONE__` recorded), and `devkit-compozy@devkit` is enabled. R-5 driver `compozy`: the kit installed with no kit question, only the time zone asked; the re-run asked no kit question and the installer ran again with the recorded inputs. On `b550917` the plan offers `["claude","compozy"]`, and a block with `driver: script` gives `driverNotBuilt` `{ script, 22 }` and the driver is not offered (Checks section). The `setup AC-6` tests (drivers, block apply and plan, kit finder 5, skill) passed in gates 3.6, 4.5, 5.6 and 7.8 at this head; `kit-installer.test.mjs` passed in gate 7.8's run | pass |
| AC-7 | `github-one-by-one`: in `merge` mode each GitHub item (ruleset, required checks, auto-merge) is shown and confirmed one by one, never in bulk; `merge` is the suggested ship answer | R-3 (`proof/r3-merge-mode.txt`), in a disposable private repository the owner allowed (observation O-2): the ship question showed `merge` as recommended (as in R-1, R-4 and R-5), `merge_method` was asked after it, and the GitHub plan was shown with the required-check list (`devkit-reviews`); `auto-merge` and `delete-branch` each got their own question, both declined; `workflow` and `ruleset` were deferred by `github-setup.mjs` itself and not asked (observation O-1); the plan read again gave the same states, and the repository kept `allow_auto_merge=false`, `delete_branch_on_merge=false`, 0 rulesets. On `b550917` the plan with no config gives `ship` default `merge`. The ruleset's own question is proven by the tests `setup AC-7 skill: step 5 asks the ship mode with merge suggested and step 7 asks one question per item`, `setup AC-7 block plan` and the `github-setup` file, which passed in gates 4.5, 5.6 and 7.8 at this head | pass |
| AC-8 | `old-projects-work`: a project set up with the old skills (a fixture) passes the flow checker and runs `/devkit change` with no setup step | The test `setup AC-8 old project: the configuration the old skill wrote opens a change with no setup step and its readout reads` (fixture `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/`, the bytes of `c1ac8c4`) passed in gate 5.6's run (`^setup ` pattern, `guard.test.mjs`) and in gate 7.8's run at this head. No real run used an old project | pass |
| AC-9 | `behaviour-kept`: schema installation, the opt-in, the `gh` check, the changes-under-way list, the ship entry and the GitHub step behave as before: their tests pass in their new place | Gate 7.8's run at this head passed every moved file in its new folder: `changes-under-way`, `gh-version`, `github-setup`, `install-schemas`, `project-settings`, `ship-entry` under `plugins/openspec/skills/devkit/scripts/`, and `install-kit`, `adoption`, `gen-agents`, `devkit-kit`, `loop-templates` under `plugins/compozy/kit/scripts/` (one `pass` line each); gate 2.9's run passed the same eleven files; train 17's suite script, whose `SUITE_FOLDERS` names both new folders, accepted every path (it exits 2 for a file outside its folders). The real runs used each behaviour in its new place (R-1 to R-5) | pass |
| AC-10 | `real-run`: a real run in a scratch project proves each case the plan declares: first install, re-run, `merge` mode, and the kit's yes and no answers | `proof/r1-first-install.txt` (first install, kit no), `r2-rerun.txt` (re-run, equal hashes), `r3-merge-mode.txt` (`merge` mode, every offered item declined), `r4-kit-yes.txt` (kit yes), `r5-driver-compozy.txt` (driver `compozy`, then the re-run on it), `r6-typed-only.txt` (the conducting session's own part, with finding F-1); each run is a `claude -p` session with `--plugin-dir` for this worktree's three packs, one `--resume` turn per answer, run by the conducting session in scratch projects under `/var/tmp/devkit-project-setup`; the six files are not empty at this head (gate 7.8's `test -s` parts), are committed (`git status --short` clean) and unchanged since attempt 1 | pass |

### Findings

- **F-1, the typed-only part (against AC-1's "accepted only from the owner's typed command" and the spec scenario "A
  request that is not the typed command" of `specs/project-setup/spec.md`).** Source: `proof/r6-typed-only.txt`. A
  plain-words request makes no Skill call: the `devkit` skill is `disable-model-invocation: true` and did not run in
  any R-6 case. But a session can still run the setup scripts it reads on disk and write a setup's files. In the
  declared case (R-1's project, already set up) the session ran the old `openspec-setup` scripts of the user-level
  devkit-openspec 0.33.0 cache and changed nothing only because the project already held the same files
  (`git status --short` empty). In the extra case (a new repository, not set up) it wrote `.claude/settings.json`,
  `openspec/` (the schemas and a config) and `.agents/skills`. Repeated in isolation (`HOME` and `CLAUDE_CONFIG_DIR`
  on an empty folder, only this change's three packs loaded by `--plugin-dir`), the session found this change's own
  `## Setup` section on disk and ran its steps by hand (`change-loop.mjs start` with `setup`, `project-settings.mjs`,
  `openspec init`, `install-schemas.sh`, `setup-block.mjs plan`), wrote the same kinds of files and stopped before
  `setup-block.mjs apply` to ask the block's questions. So the scenario's THEN, "no file of the setup is written",
  does not hold for a project that is not set up, and the requirement's "no agent, stage or other session can start
  the setup" holds only for the skill, not for its scripts. The same is true of `/devkit change` (its scripts are on
  disk too), which is the comparison AC-1 names. The coordinator recorded this as a finding of the evidence, not a
  change of scope; the follow-up (a hook that refuses the setup scripts without a typed `/devkit setup`) is a retro
  proposal. Until then a project should type `/devkit setup` and never ask for the setup in plain words. The owner
  weighs whether the scenario's wording stands as written. The merge of train 17 changed none of the files involved,
  so the finding stands at `b550917`.
- **O-1, R-3 could not ask the ruleset.** `github-setup.mjs` itself deferred the `workflow` item (the tag `v0.47.0`
  did not exist in `chacal88/devkit`) and so the `ruleset` item (its required check `devkit-reviews` had never
  reported); a deferred item is shown and not asked (the Setup section, step 7). The two items it offered
  (`auto-merge`, `delete-branch`) got one question each, both declined, nothing applied. The ruleset's own question
  and the confirmation of its required-check list are proven by the tests only (row AC-7).
- **O-2, the disposable repository still waits for the owner's deletion.** R-3 ran in the private repository
  `chacal88/devkit-setup-proof-20261124`, which the owner allowed: asked by the coordinator
  `Posso criar e depois apagar um repositório privado descartável na sua conta do GitHub para provar o modo merge?`,
  the owner typed in the coordinating session on 2026-11-24 `Sim, pode criar`. The run created it at
  2026-11-24T18:30:12-03:00 and did not delete it (the machine's `gh` token lacks `delete_repo`);
  `proof/r3-merge-mode.txt` records that it waits for the owner's deletion. The verifier did not contact GitHub in
  either attempt, so this file cannot say whether it has been deleted since.
- **O-3, the test keys were asked as one question in R-5.** In both R-5 sessions the four `tests.*` keys, which the
  repository gave nothing to propose, were asked together as one question, where the Setup section says one question
  each. The answer (leave all unset) wrote nothing, so no value is affected. In R-1, R-2, R-3 and R-4 they were asked
  one at a time.
- **O-4, budget and design in the real runs.** In R-1, R-3, R-4 and R-5 `openspec init` created the config, so the
  template's commented `budget` and `design:` examples were not copied and the files hold neither key at all; they
  appear as comments only on the path with no config (the template copy), which the test `setup AC-3 block apply: a
  first answer set appends the block, readDevkitSettings reads it with no unknown, and budget and design stay
  comments` checks. No real run wrote either key.
