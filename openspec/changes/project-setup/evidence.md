<!-- devkit-stage evidence result=passed attempt=3 commit=22d0706c91d1aa396ca2e7b76d0b9100ad8460b6 -->
Commit: 22d0706c91d1aa396ca2e7b76d0b9100ad8460b6

# Evidence

Change `project-setup`, verified at `22d0706` (the tree was clean: `git status --short` printed nothing before and
after the runs). Attempt 2 was verified at `b550917`. The commits since then, on the branch's first-parent line:
`02e6780` (that evidence), `ec1b42f` (review round 1, FAIL), `387bf15` (the fixes of eight round-1 findings),
`45cbd1c` (the plan's typed-only wording narrowed by the owner's choice A of 2026-11-25) and `22d0706`, the merge of
`origin/main` `fc28735` (train 18: the archive of `suite-socket-path` with its retro, and two added sentences in the
suite paragraph of `CONTRIBUTING.md`). The release at this head is unchanged: devkit-openspec 0.48.0, devkit-compozy
0.5.0, marketplace 0.53.0 (the `version` fields of the two `plugin.json` files and `.claude-plugin/marketplace.json`);
the three CI pins of `docs/openspec-flow.md` read `v0.48.0`; the record stays
`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md` (the only `0031` file).

## Verification

Who ran what:

- **The verifier** (this file's writer, not the implementer and not the conducting session) ran every gate part
  below again on `22d0706`, each with its own exit code, with `TMPDIR=/var/tmp/devkit-project-setup`. The suite parts
  ran with `--concurrency=3`, the value the coordinator set for this shared worker, where `tasks.md` writes
  `--concurrency=2`; that flag is the only difference from the written commands (each command was taken from
  `tasks.md` by a script and only that flag replaced). The runner waited for the whole-suite run of another worktree
  (`release-at-merge`) to end (`tail --pid`) before the first suite part, and no other suite run was on the machine
  when each part started; each suite row records the load average at its start and end (8 cores). No gate runs the
  whole suite: this repository delivers on a delivery train, whose departure runs it (`tasks.md` header). No test
  file failed, so none needed a rerun alone.
- **What the three commits changed.** `387bf15`: `plugins/openspec/hooks/guard.mjs` (`parseDevkitBlock` splits on
  `\r?\n`), `plugins/openspec/hooks/flow-check.mjs` (`readTestSettings` the same),
  `plugins/openspec/hooks/change-loop.mjs` (`startMode`: `setup` asks git for the top level, so a folder in no
  repository answers `setup-no-repo` even when it holds `openspec/changes`),
  `plugins/openspec/skills/devkit/scripts/setup-block.mjs` (`checkBlock` refuses an inline map or list; `ciPinOf`
  reads through `pinsIn` of `deliver-check.mjs`), `plugins/openspec/skills/devkit/SKILL.md` (Setup step 7, the
  blocked-ruleset sentence), ADR 0026 (a Note on the moved suite folders) and ADR 0031 (its Amends line),
  `openspec/config.yaml` (the ADR list), and new or extended tests in `guard.test.mjs`, `setup-block.test.mjs`,
  `change-loop.test.mjs`, `flow-check.test.mjs` and `delivery-models.test.mjs`. `45cbd1c` changed only
  `design.md` (the D-14 note and the R-6 row), `specs/project-setup/spec.md` (the requirement "The setup skill is
  invoked only from the owner's typed command" and its scenario's THEN, and the commented-examples wording of the
  `budget`/`design:` and starting-configuration texts) and `tasks.md` (task 7.6's text; no gate command changed).
  `22d0706` brought, outside the archive and train records, only `CONTRIBUTING.md`: two sentences added to the
  suite paragraph (a whole-suite gate on a quiet machine; a change to the suite script runs the whole suite once with
  no `TMPDIR` override). The resolved paragraph keeps this change's folders
  (`plugins/openspec/skills/devkit/scripts/` and `plugins/compozy/kit/scripts/`), and `SUITE_FOLDERS` of
  `scripts/test-suite.mjs` names both.
- **Re-run on `22d0706` because these commits can affect them:** every gate part (the hooks every suite file
  imports changed, and `tasks.md`, the spec and `CONTRIBUTING.md` are read by `check.py`, `openspec validate` and the
  documentation tests); the start mode, the plan's fields and driver list, the old-name `git grep`, the skill's
  frontmatter and the release numbers of the Checks section; and new checks of the four behaviours `387bf15` added
  (no repository, CRLF, inline map, CI pin).
- **Kept from attempts 1 and 2, because none of their inputs changed:** the real runs R-1 to R-6 (design D-14,
  tasks 7.1 to 7.7), run by the session that conducts this change, never by `tdd-implementer`, and committed under
  `openspec/changes/project-setup/proof/`; `git diff --stat 14aca45 HEAD -- openspec/changes/project-setup/proof`
  prints nothing. They ran on code before `387bf15`; its changes touch inputs the real runs did not use (a CRLF
  config, an inline map, a workflow file, a folder outside git) and the text of Setup step 7 on a `blocked` ruleset,
  which R-3 did not reach (O-1). The real runs read devkit-openspec 0.47.0: they ran before train 16 renumbered the
  release to 0.48.0. This attempt re-read `proof/r6-typed-only.txt` against the narrowed requirement (row AC-1,
  finding F-1) and the owner's words quoted in `proof/r3-merge-mode.txt` (O-2).
- **Earlier gate files** of the conducting session, kept as the phases ran: `proof/gate-2.9.txt`, `gate-3.6.txt`,
  `gate-4.5.txt`, `gate-5.6.txt`, `gate-6.10.txt`, `gate-7.8.txt` and `post-merge-6a67628.txt`. The red runs of the
  test-first tasks are `proof/red-3.txt` to `red-6.txt`. The rows below quote only the verifier's own runs at
  `22d0706`.

### Gates

One row per `&&` part of every gate task of `tasks.md` (1.4, 2.9, 3.6, 4.5, 5.6, 6.10, 7.8); a part that several gates
name has one row, naming them all.

| Gate | Command | Result |
|---|---|---|
| 1.4 | `git merge-base --is-ancestor c09860c HEAD` | pass: exit 0 (the branch also holds `fc28735`, train 18, through its last merge `22d0706`: `git merge-base --is-ancestor fc28735 HEAD` exits 0) |
| 1.4 | `test -d openspec/changes/archive/2026-11-24-compozy-driver` | pass: exit 0 at this head |
| 1.4 | `test -d openspec/changes/archive/2026-11-24-delivery-train` | pass: exit 0 at this head |
| 1.4 | `test -f plugins/openspec/hooks/compozy-driver.mjs` | pass: exit 0 at this head |
| 1.4 | `test -f plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs` | pass: the precondition of the base, true on the tree of the base `f1dcefa` (`git cat-file -e f1dcefa:plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs` exits 0 on this run; attempt 2 ran the written part itself on an extracted `git archive f1dcefa`); at this head the path is absent by design, because phase 2 moved the file: `test -f plugins/compozy/kit/scripts/gen-agents.mjs` exits 0 here (the workflow follow-up of tasks.md runs gate 1.4's checks "at the paths phase 2 left") |
| 1.4 | `test -f scripts/test-suite.mjs` | pass: exit 0 at this head |
| 1.4 | `grep -q "const DRIVER_ROUND = { script: 22 };" plugins/openspec/hooks/change-loop.mjs` | pass: exit 0 at this head |
| 2.9 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs plugins/compozy/kit/scripts/install-kit.test.mjs plugins/compozy/kit/scripts/adoption.test.mjs plugins/compozy/kit/scripts/gen-agents.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs plugins/compozy/kit/scripts/loop-templates.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/release-tags.test.mjs` | pass: `suite: 32 files, 2944 tests, 2941 pass, 0 fail, 1212.4s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); the 3 tests that neither pass nor fail are the skipped `compozy-loops ... compozy loop validate accepts the raw template` tests (`compozy` is not on `PATH`); 2944 is attempt 2's 2940 plus the 4 tests `387bf15` added to these files (2 in `guard.test.mjs`, 1 each in `flow-check.test.mjs` and `delivery-models.test.mjs`); load average at start 2.59 6.74 8.39, at end 4.52 5.53 6.24 (8 cores) |
| 2.9, 7.8 | `node plugins/compozy/kit/scripts/gen-agents.mjs --check` | pass: exit 0, `21 CompozyOS agents are up to date` |
| 2.9, 5.6, 6.10, 7.8 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` |
| 2.9, 6.10, 7.8 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, no output |
| 3.6 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" --test-name-pattern="^change-loop start" --test-name-pattern="^roadmap-loop start" --test-name-pattern="^project-loop start" --test-name-pattern="^project-loop next: S23" --test-name-pattern="^nextStep row 3a" --test-name-pattern="^mergeSetup" --test-name-pattern="^flow-check AC-7" --test-name-pattern="^compozy-driver readiness" --test-name-pattern="^field-fixes 7 apply" --test-name-pattern="^delivery-train P13" --test-name-pattern="^delivery-train P9 N7" plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs` | pass: `suite: 11 files, 78 tests, 78 pass, 0 fail, 32.7s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 2.93 7.56 8.74, at end 3.25 7.13 8.55 (8 cores) |
| 4.5 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-" --test-name-pattern="^stage-roles setup" --test-name-pattern="^format: the config template" plugins/openspec/skills/devkit/scripts/setup-block.test.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/test-suite.test.mjs` | pass: `suite: 6 files, 43 tests, 43 pass, 0 fail, 6.1s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 3.25 7.13 8.55, at end 3.15 7.05 8.52 (8 cores) |
| 5.6 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup " --test-name-pattern="^format: the Setup section" --test-name-pattern="^field-fixes 5 skill" --test-name-pattern="^gh-version 19" --test-name-pattern="^stage-roles" --test-name-pattern="^change-loop skill" --test-name-pattern="^roadmap-loop skill" --test-name-pattern="^project-loop skill" --test-name-pattern="^release-merge-conflict 16" --test-name-pattern="^delivery-train docs" --test-name-pattern="^upfront AC-1 skill" --test-name-pattern="^upfront AC-16 skill" --test-name-pattern="^stage-models AC-9" --test-name-pattern="^AC-6 instructions-follow" plugins/openspec/hooks/guard.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs` | pass: `suite: 10 files, 141 tests, 141 pass, 0 fail, 11.7s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 3.15 7.05 8.52, at end 2.82 6.85 8.44 (8 cores) |
| 6.10, 7.8 | `claude plugin validate .` | pass: exit 0, `Validation passed` |
| 6.10, 7.8 | `openspec validate project-setup --type change --strict` | pass: exit 0, `Change 'project-setup' is valid` (on the spec delta `45cbd1c` rewrote) |
| 6.10 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 --test-name-pattern="^setup AC-2" --test-name-pattern="^docs sweep" --test-name-pattern="^change-loop docs" --test-name-pattern="^suite-speed AC-7" --test-name-pattern="^suite-speed AC-8" --test-name-pattern="^upfront AC-5 docs" plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/test-suite.test.mjs` | pass: `suite: 7 files, 10 tests, 10 pass, 0 fail, 5.7s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); load average at start 2.82 6.85 8.44, at end 2.59 6.74 8.39 (8 cores) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r1-first-install.txt` | pass: exit 0 (15999 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r2-rerun.txt` | pass: exit 0 (5671 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r3-merge-mode.txt` | pass: exit 0 (18805 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r4-kit-yes.txt` | pass: exit 0 (16974 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r5-driver-compozy.txt` | pass: exit 0 (19344 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `test -s openspec/changes/project-setup/proof/r6-typed-only.txt` | pass: exit 0 (20681 bytes; the file is unchanged since `14aca45`) |
| 7.8 | `env GITHUB_HEAD_REF=project-setup GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=2 plugins/openspec/skills/devkit/scripts/changes-under-way.test.mjs plugins/openspec/skills/devkit/scripts/gh-version.test.mjs plugins/openspec/skills/devkit/scripts/github-setup.test.mjs plugins/openspec/skills/devkit/scripts/install-schemas.test.mjs plugins/openspec/skills/devkit/scripts/project-settings.test.mjs plugins/openspec/skills/devkit/scripts/ship-entry.test.mjs plugins/openspec/skills/devkit/scripts/setup-block.test.mjs plugins/openspec/skills/devkit/scripts/kit-installer.test.mjs plugins/compozy/kit/scripts/install-kit.test.mjs plugins/compozy/kit/scripts/adoption.test.mjs plugins/compozy/kit/scripts/gen-agents.test.mjs plugins/compozy/kit/scripts/devkit-kit.test.mjs plugins/compozy/kit/scripts/loop-templates.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/roadmap-loop-upfront.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/compozy-driver.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/test-suite.test.mjs plugins/openspec/hooks/release-tags.test.mjs` | pass: `suite: 34 files, 2970 tests, 2967 pass, 0 fail, 1119.5s, concurrency 3`, exit 0, run with `--concurrency=3`, the value the coordinator set for this shared worker (the only difference from the written command, which says 2); the 3 tests that neither pass nor fail are the same three skipped `compozy-loops` tests; 2970 is attempt 2's 2962 plus the 8 tests `387bf15` added (4 in `setup-block.test.mjs`, 2 in `guard.test.mjs`, 1 each in `flow-check.test.mjs` and `delivery-models.test.mjs`); no run printed a `run root:` line; load average at start 4.52 5.53 6.24, at end 4.17 4.00 4.67 (8 cores) |

### Checks the verifier ran on this head, outside the gates

On `22d0706`, in a new scratch git repository under `/var/tmp/devkit-project-setup/` with only a `package.json`
(version `1.0.0`, a `test` script) and one commit, removed afterwards:

- `change-loop.mjs start --lang en` with `setup` on standard input, no `openspec/`: exit 0, JSON fields `version`,
  `mode` (`setup`), `verb` (`setup`), `text`, `change`, `unfinished`, `task`, `settings`, `root` (equal to
  `git rev-parse --show-toplevel`), `reply` (null); `git status --short --untracked-files=all` printed nothing
  (nothing was created).
- `change-loop.mjs start` with `change add a thing`, same folder: exit 0, `mode` `not-set-up`, and the reply "This
  project is not set up for devkit yet: type /devkit setup first. Nothing was run."
- With an `openspec/config.yaml` holding `schema: devkit-lite` and a `devkit:` block with `driver: compozy`: `start`
  with `setup` still answers `mode` `setup`, `reply` null (no CompozyOS run).
- New in `387bf15`, no repository: a folder outside any git repository (`git rev-parse --show-toplevel` fails there)
  holding `openspec/changes/` and `openspec/config.yaml`: `start` with `setup` answers `mode` `setup-no-repo`, no
  `root`, and the reply "/devkit setup runs inside a git repository: open the project's folder, or create its
  repository there first. Nothing was run."; the folder's file list hashed the same before and after.
- `setup-block.mjs plan <root> --json` with no config: exit 0, fields `version`, `config`, `block`, `present`, `kept`,
  `missing`, `drivers`, `driverNotBuilt`, `releaseFile`, `kit`, `pluginVersion`, `ciPin`, `fill`; `drivers`
  `["claude","compozy"]`, `driverNotBuilt` null, `pluginVersion` `0.48.0`, `releaseFile` `package.json`, `kit`
  `absent`, `ciPin` null, `fill` `schema, context, rules, operations`, and `missing` in order: `language` (default
  `en`), `driver` (default `claude`), `delivery` (default `none`), `tests.unit`, `tests.coverage.command`,
  `tests.coverage.target`, `tests.e2e`, `ship` (default `merge`), `merge_method` (default `squash`), `release_tag`
  (default `package.json`); `git status --short --untracked-files=all` printed nothing.
- The same plan with a block holding `driver: script`: exit 0, `drivers` `["claude","compozy"]`, `driverNotBuilt`
  `{ driver: script, round: 22 }`, and `driver` is not among the `missing` keys (it is neither offered nor asked).
- New in `387bf15`, the CI pin: with `.github/workflows/devkit-reviews.yml` written from
  `plugins/openspec/skills/devkit/templates/devkit-reviews.yml` with `{{ref}}` and `{{tag}}` filled (`v0.48.0`), as
  `github-setup.mjs` writes it, the plan reads `ciPin` `v0.48.0`; with the raw template (`{{tag}}` unfilled) it reads
  null.
- New in `387bf15`, CRLF: a config written with CRLF line endings holding `language: en`, `driver: claude` and
  `tests.unit: "npm test"` in its block: the plan's `missing` no longer lists `language`, `driver` or `tests.unit`
  (it lists `delivery`, the three other test keys, `ship`, `merge_method`, `release_tag`).
- New in `387bf15`, an inline map: a block line `ship: { devkit-lite: pr }`: `setup-block.mjs apply` with
  `{"driver":"claude"}` exits 3 with the one stderr line "openspec/config.yaml line 4: an inline map or list in the
  devkit block; edit the block by hand, then run the setup again", and `sha256sum openspec/config.yaml` is the same
  before and after.
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
| AC-1 | `setup-verb`: typing `/devkit setup` in a scratch project with the packs and no `openspec/` leaves `.claude/settings.json` enabling the packs, the `devkit` and `devkit-lite` schemas under `openspec/schemas/` and an `openspec/config.yaml` with a `devkit:` block; accepted only from the owner's typed command, as `/devkit change` is | R-1 (`proof/r1-first-install.txt`, unchanged since attempt 1): the typed `/devkit-openspec:devkit setup` in a new git repository with no `openspec/` ran `change-loop.mjs start` with `setup`, then the Setup steps; the file shows `.claude/settings.json` enabling `devkit-core@devkit` and `devkit-openspec@devkit`, `ls openspec/schemas` listing `devkit`, `devkit-lite`, `devkit-project`, and `openspec/config.yaml` holding an uncommented `devkit:` block. On `22d0706` the verifier saw `start` answer `mode` `setup` with no `openspec/` (and on the `compozy` driver), `setup-no-repo` outside a git repository even with `openspec/changes` there, the reply `not-set-up` naming `/devkit setup`, and the skill's `disable-model-invocation: true` with `setup` in its hint (Checks section). The `setup AC-1` tests passed in gates 3.6, 5.6 and 7.8 at this head, among them `setup AC-1 start: setup outside a git repository answers setup-no-repo ...`, which `387bf15` extended with the `openspec/changes` folder (gates 3.6 and 7.8). Typed-only, as the spec words it since `45cbd1c` ("The setup skill is invoked only from the owner's typed command"; its scenario's THEN: the session makes no Skill call, the `devkit` skill does not run and its `## Start` does not send the request to the Setup section): R-6 (`proof/r6-typed-only.txt`) holds no Skill call in any of its three cases (0 Skill tool lines in the file) and an empty `git status --short` in the declared case (R-1's project). The files its extra cases show a session writing by running the setup's scripts by hand are outside that claim by the owner's choice A and stay finding F-1 | pass (the typed-only claim holds for the skill, as for `/devkit change`; F-1 records what it does not cover) |
| AC-2 | `old-skills-gone`: the skills `openspec-setup` and `compozy-setup` no longer exist; no reply, hook message or document names them or `/openspec-setup`; each names `/devkit setup`; `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass | Neither skill folder exists (`ls plugins/openspec/skills`, `ls plugins/compozy/skills`, Checks section). `git grep` on `22d0706` finds the old names outside the history only in the five files design D-9 exempts; the suite paragraph of `CONTRIBUTING.md` after the train-18 merge names the new folders. Tests `setup AC-2 tree` (N-10), `setup AC-2 replies`, `setup AC-2 project`, `setup AC-2 train` and the new `setup AC-2 records: ADR 0026 notes the two moved suite folders and is amended by the setup record` passed in gate 6.10's run at this head, and the `setup AC-2` tests in gates 3.6 and 7.8; the `not-set-up` reply on this head names `/devkit setup`. `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` exit 0 (Gates) | pass |
| AC-3 | `block-written`: after a first setup with answers, `openspec/config.yaml` holds `devkit.language`, `devkit.driver`, the delivery settings, the confirmed `devkit.tests.*` and the ship mode; `budget` and `design:` only as commented examples; `release_tag` only when a release file exists | R-1: answers `en`, `claude`, delivery `none`, `npm test` confirmed, no coverage, ship `pr`, release `package.json`; the file holds `language: en`, `driver: claude`, `tests.unit: "npm test"`, `release_tag: package.json` and `ship:` `pr` for `devkit-lite`, `devkit`, `devkit-project`, written by `setup-block.mjs apply` (the R-1 transcript holds the call); delivery `none` writes no key by design. R-3: the same with ship `merge` and `merge_method: squash`. R-4 (no `package.json`): no `release_tag` and none asked. Neither key `budget` nor `design:` was written by any run (O-4), which the scenario `45cbd1c` reworded now states for a config `openspec init` wrote. On `22d0706` an inline map in the block is refused with exit 3 and the file unchanged (Checks section). The `setup AC-3` tests (block apply, plan, parser, suite; the new `the default delivery answer none on a project with no train writes no delivery and leaves no unknown value`) passed in gates 4.5 and 7.8 at this head; `setup-block.test.mjs` passed in gate 7.8's run | pass |
| AC-4 | `rerun-keeps`: a second `/devkit setup` keeps every value present, asks only what is missing, and leaves `openspec/config.yaml` byte-identical when nothing is missing | R-2 (`proof/r2-rerun.txt`) on R-1's project: plan `missing` = the three optional test keys R-1 left unset, `fill` empty; no question about a key R-1 answered; the optional keys were asked again and declined (accepted in design.md, Risks); `shasum -a 256 openspec/config.yaml` before and after `12f78412f958ca309ef842b439d5e22333d6067e25f6e5657ec30c87e75f5d20`, equal; `git status --short` empty. R-5's re-run on the `compozy` driver: `3e154f17201be2ad77ddaa6c7ca41013c101da49b6b34361f66c7305a675b736` before and after, equal. On `22d0706` a CRLF config's present keys are no longer listed as missing (Checks section). The `setup AC-4` tests passed in gates 4.5, 5.6 and 7.8 at this head, the new `setup AC-4 block plan: after apply on a CRLF config, plan asks none of the keys the file holds and a second answer is refused` (`setup-block.test.mjs`) in gates 4.5 and 7.8, and the CRLF readers' tests `delivery-models config: a CRLF block is read as its LF twin` and `stage-roles flow settings: a CRLF tests block is read as its LF twin` passed in the unfiltered runs of gates 2.9 and 7.8 | pass |
| AC-5 | `no-checker-copy`: no checker code copied; the step records the plugin version and names each pack not enabled in `.claude/settings.json` | R-1: `find . -name guard.mjs -o -name flow-check.mjs -o -name deliver-check.mjs -o -name merge-setup.mjs` printed nothing; the report names "devkit-openspec 0.47.0" as the schemas' version and `devkit-design` as not enabled; `setup-block.mjs plan` after the run reads `pluginVersion` `0.47.0`, `ciPin` null. On `22d0706` the plan reads `pluginVersion` `0.48.0`, and `ciPin` `v0.48.0` from a workflow written from the template (now read by `pinsIn`). The `setup AC-5` tests passed in gates 4.5, 5.6 and 7.8 at this head, the new `setup AC-5 block plan: ciPin reads the pin of the workflow written from templates/devkit-reviews.yml` (`setup-block.test.mjs`) in gates 4.5 and 7.8 | pass |
| AC-6 | `driver-rule`: only the drivers `/devkit change` runs are offered, never a `driver-not-built` value; the `.compozy/` kit's yes/no question is asked separately, and a yes installs the kit as `compozy-setup` did | R-1, R-3, R-4 and R-5 offered `claude` and `compozy` and never `script`; the kit question came after the block, apart from the driver (R-1 and R-3 no, R-2 no again, nothing written). R-4 (`proof/r4-kit-yes.txt`) yes: the installer printed 27 `create` lines under `.compozy/`, `.compozy/kit-manifest.json` exists (pack `0.5.0`, `__TIMEZONE__` recorded), and `devkit-compozy@devkit` is enabled. R-5 driver `compozy`: the kit installed with no kit question, only the time zone asked. On `22d0706` the plan offers `["claude","compozy"]`, and a block with `driver: script` gives `driverNotBuilt` `{ script, 22 }` and the driver is not offered (Checks section). The `setup AC-6` tests passed in gates 3.6, 4.5, 5.6 and 7.8 at this head; `kit-installer.test.mjs` passed in gate 7.8's run | pass |
| AC-7 | `github-one-by-one`: in `merge` mode each GitHub item (ruleset, required checks, auto-merge) is shown and confirmed one by one, never in bulk; `merge` is the suggested ship answer | R-3 (`proof/r3-merge-mode.txt`), in a disposable private repository the owner allowed (O-2): the ship question showed `merge` as recommended (as in R-1, R-4 and R-5), `merge_method` was asked after it, and the GitHub plan was shown with the required-check list (`devkit-reviews`); `auto-merge` and `delete-branch` each got their own question, both declined; `workflow` and `ruleset` were deferred by `github-setup.mjs` itself and not asked (O-1); the repository kept `allow_auto_merge=false`, `delete_branch_on_merge=false`, 0 rulesets. On `22d0706` the plan with no config gives `ship` default `merge`. The ruleset's own question is proven by the tests `setup AC-7 skill: step 5 asks the ship mode with merge suggested and step 7 asks one question per item`, `setup AC-7 block plan` and the `github-setup` file; the step-7 text `387bf15` added on a `blocked` ruleset by the new test `setup AC-7 skill: a blocked ruleset tells the owner the written ship map stays merge and is changed to pr or plan by hand`, and the new `setup AC-7 block apply: a model answered in the same call accepts trunk-auto ...`; the `guard.test.mjs` tests passed in gates 4.5, 5.6 and 7.8 at this head, the `setup-block.test.mjs` ones in gates 4.5 and 7.8 | pass |
| AC-8 | `old-projects-work`: a project set up with the old skills (a fixture) passes the flow checker and runs `/devkit change` with no setup step | The test `setup AC-8 old project: the configuration the old skill wrote opens a change with no setup step and its readout reads` (fixture `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/`, the bytes of `c1ac8c4`) passed in gate 5.6's run (`^setup ` pattern, `guard.test.mjs`) and in gate 7.8's run at this head. No real run used an old project | pass |
| AC-9 | `behaviour-kept`: schema installation, the opt-in, the `gh` check, the changes-under-way list, the ship entry and the GitHub step behave as before: their tests pass in their new place | Gate 7.8's run at this head passed every moved file in its new folder: `changes-under-way`, `gh-version`, `github-setup`, `install-schemas`, `project-settings`, `ship-entry` under `plugins/openspec/skills/devkit/scripts/`, and `install-kit`, `adoption`, `gen-agents`, `devkit-kit`, `loop-templates` under `plugins/compozy/kit/scripts/` (one `pass` line each); gate 2.9's run passed the same eleven files; the suite script, whose `SUITE_FOLDERS` names both new folders, accepted every path (it exits 2 for a file outside its folders). The real runs used each behaviour in its new place (R-1 to R-5) | pass |
| AC-10 | `real-run`: a real run in a scratch project proves each case the plan declares: first install, re-run, `merge` mode, and the kit's yes and no answers | `proof/r1-first-install.txt` (first install, kit no), `r2-rerun.txt` (re-run, equal hashes), `r3-merge-mode.txt` (`merge` mode, every offered item declined), `r4-kit-yes.txt` (kit yes), `r5-driver-compozy.txt` (driver `compozy`, then the re-run on it), `r6-typed-only.txt` (the conducting session's own part, read against the narrowed typed-only claim; finding F-1); each run is a `claude -p` session with `--plugin-dir` for this worktree's three packs, one `--resume` turn per answer, run by the conducting session in scratch projects under `/var/tmp/devkit-project-setup`; the six files are not empty at this head (gate 7.8's `test -s` parts), are committed and unchanged since attempt 1. They ran before `387bf15`, whose changes touch inputs no real run used (Verification) | pass |

### Findings

- **F-1, what the typed-only claim does not cover.** Source: `proof/r6-typed-only.txt`. Review round 1 found that the
  spec's typed-only requirement promised more than the change enforces (spec-reviewer F1, code-quality-reviewer F1).
  The owner chose, typing in the conducting session on 2026-11-25, "Ajustar o texto (A)" (design D-14 note): since
  `45cbd1c` the requirement reads "The setup skill is invoked only from the owner's typed command" and says this
  change does not prevent a session from running the setup's scripts by hand, and the scenario "A request that is not
  the typed command" ends on no Skill call, no `devkit` skill run and no route from its `## Start` to the Setup
  section. R-6 meets that: no Skill call in any case. What stays open: a session can still run the setup's scripts it
  reads on disk and write a setup's files. In the declared case (R-1's project, already set up) the session ran the
  old `openspec-setup` scripts of the user-level devkit-openspec 0.33.0 cache and changed nothing only because the
  project already held the same files (`git status --short` empty). In the extra case (a new repository, not set up)
  it wrote `.claude/settings.json`, `openspec/` (the schemas and a config) and `.agents/skills`. Repeated in isolation
  (`HOME` and `CLAUDE_CONFIG_DIR` on an empty folder, only this change's three packs loaded by `--plugin-dir`), the
  session read this change's `## Setup` section from disk and ran its steps by hand (`change-loop.mjs start` with
  `setup`, `project-settings.mjs`, `openspec init`, `install-schemas.sh`, `setup-block.mjs plan`), wrote the same
  kinds of files and stopped before `setup-block.mjs apply` to ask the block's questions. The same is true of
  `/devkit change` (its scripts are on disk too), the comparison AC-1 names. The follow-up, a hook that refuses the
  setup's scripts when the session's last typed command is not `/devkit setup`, is a retro proposal (design D-14
  note), not part of this change. Until it exists an owner types `/devkit setup` and never asks for the setup in plain
  words. None of the three commits since attempt 2 changed `proof/` or the R-6 inputs, so the finding stands at
  `22d0706`.
- **O-1, R-3 could not ask the ruleset.** `github-setup.mjs` itself deferred the `workflow` item (the tag `v0.47.0`
  did not exist in `chacal88/devkit`) and so the `ruleset` item (its required check `devkit-reviews` had never
  reported); a deferred item is shown and not asked (the Setup section, step 7). The two items it offered
  (`auto-merge`, `delete-branch`) got one question each, both declined, nothing applied. The ruleset's own question,
  the confirmation of its required-check list and the step-7 text on a `blocked` ruleset are proven by the tests only
  (row AC-7).
- **O-2, the disposable repository still waits for the owner's deletion.** R-3 ran in the private repository
  `chacal88/devkit-setup-proof-20261124`, which the owner allowed: asked by the coordinator
  `Posso criar e depois apagar um repositório privado descartável na sua conta do GitHub para provar o modo merge?`,
  the owner typed in the coordinating session on 2026-11-24 `Sim, pode criar`. The run created it at
  2026-11-24T18:30:12-03:00 and did not delete it (the machine's `gh` token lacks `delete_repo`);
  `proof/r3-merge-mode.txt` records that it waits for the owner's deletion. The verifier did not contact GitHub in
  any attempt, so this file cannot say whether it has been deleted since.
- **O-3, the test keys were asked as one question in R-5.** In both R-5 sessions the four `tests.*` keys, which the
  repository gave nothing to propose, were asked together as one question, where the Setup section says one question
  each. The answer (leave all unset) wrote nothing, so no value is affected. In R-1, R-2, R-3 and R-4 they were asked
  one at a time.
- **O-4, budget and design in the real runs.** In R-1, R-3, R-4 and R-5 `openspec init` created the config, so the
  template's commented `budget` and `design:` examples were not copied and the files hold neither key at all; they
  appear as comments only on the path with no config (the template copy), which the test `setup AC-3 block apply: a
  first answer set appends the block, readDevkitSettings reads it with no unknown, and budget and design stay
  comments` checks. Since `45cbd1c` the spec's scenario and the starting-configuration requirement state both paths
  this way. No real run wrote either key.
