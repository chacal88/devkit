<!-- devkit-stage proposal result=passed attempt=1 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Proposal

Change: `project-setup` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `requirements.md`, `decisions.md`, the proposed record
`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`, whose number is the next free
number on `origin/main` at the last merge before review (its file name carries it today);
`docs/coordination-design.md`, Open points, "Project setup"). Roadmap line `project-setup`
(round 26), item 3 of the `orchestrator-replan` retro.

## Why

A project enters the devkit flow through two skills, `openspec-setup` (devkit-openspec) and
`compozy-setup` (devkit-compozy), while every other owner entry is one verb of the `devkit` skill.
The coordination design left project setup open: one step should write the `devkit:` block, install
the schemas, record the version the project uses and wire the chosen driver. Now that the CompozyOS
driver is built (change `compozy-driver`, round 21), that step can offer the drivers that run and
install the kit when the owner wants it.

## What Changes

- New verb `/devkit setup` of the `devkit` skill, typed only by the owner (the skill stays
  `disable-model-invocation: true`). `change-loop.mjs start` answers it with a new mode `setup`
  before the project gate, so it runs in a folder that is not set up yet. It is the same step for a
  first install and for a re-run.
- The step keeps what `openspec-setup` does (the OpenSpec and `gh` checks, the opt-in, the changes
  under way, the schemas, `context`, the `devkit-project` ship entry, the GitHub step). It also asks
  `language`, `driver` and the delivery model, proposes `devkit.tests.*`, asks the ship mode with
  `merge` suggested, and writes `release_tag` only when a release file exists. `budget` and `design:`
  stay commented examples. A re-run asks only what is missing and leaves `openspec/config.yaml`
  byte-identical when nothing is: on a config that exists, `schema`, `context`, `rules` and
  `operations` are written only where absent (or another schema, or a `context` placeholder).
- The driver question offers only the drivers `/devkit change` runs on the installed plugin
  (`claude`, and `compozy` once `compozy-driver` is on `main`), never `script`. A separate yes/no
  question installs the CompozyOS kit with the installer devkit-compozy ships. Choosing `compozy`
  installs the kit.
- **BREAKING** for owners: the skills `openspec-setup` and `compozy-setup` are removed, with no alias.
  Their scripts, templates and tests move: `plugins/openspec/skills/openspec-setup/{scripts,templates}`
  to `plugins/openspec/skills/devkit/`, and `plugins/compozy/skills/compozy-setup/{scripts,templates}`
  to `plugins/compozy/kit/`. devkit-compozy keeps the kit and its other skills
  (`screen-design`, `screen-demo`).
- Every reply, hook message, document and test that names the old skills names `/devkit setup`.
  That covers `change-loop.mjs`, `flow-check.mjs`, `guard.mjs`, `merge-setup.mjs`, `project-loop.mjs`,
  `train-loop.mjs` (its copy of the pointer strip), `compozy-driver.mjs`, `changes-under-way.mjs`,
  `ship-change`, the READMEs, `CONTRIBUTING.md`,
  `CLAUDE.md`, the docs, the two capability specs and the generated catalog. Decision records,
  past `CHANGELOG.md` entries and archived changes stay as written.
- No checker code is copied into a project. The step names the devkit-openspec version the schemas
  come from, and the version the CI pin points at in `merge` mode. It names each pack the project
  uses that is not enabled in `.claude/settings.json`.
- Documents: the open point of `docs/coordination-design.md` is answered. ADR 0004 gets a dated Note
  and an "Amended by" line, written by the implementation after plan approval. The record
  `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md` is accepted, with the next free
  number on `origin/main` at the last merge before review. Releases of devkit-openspec, devkit-compozy and the marketplace;
  the devkit-openspec release moves the CI pins of `docs/openspec-flow.md` and edits no test (ADR 0030).

Non-goals: everything under "Out of scope" in `requirements.md` (the `script` driver; changing or
copying the checkers; a task-source key; writing `budget` or `design:`; re-running setup in the
consumer projects; bulk GitHub settings). Also: no change to any `flow.json` or schema, no new
`devkit:` key, no registration of a CompozyOS workspace.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `setup-verb`: typing `/devkit setup` in a scratch project that has the packs installed and no `openspec/` leaves it with `.claude/settings.json` enabling the packs, the `devkit` and `devkit-lite` schemas installed under `openspec/schemas/`, and an `openspec/config.yaml` that holds a `devkit:` block; `/devkit setup` is accepted only from the owner's typed command, as `/devkit change` is.
- AC-2 `old-skills-gone`: the skills `openspec-setup` and `compozy-setup` no longer exist; no reply, hook message or document names them or `/openspec-setup`: each names `/devkit setup`; `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.
- AC-3 `block-written`: after a first setup with answers given, `openspec/config.yaml` holds `devkit.language`, `devkit.driver`, the delivery settings, the confirmed `devkit.tests.*` values and the ship mode, and `budget` and `design:` appear only as commented examples; `release_tag` is written only when a release file exists.
- AC-4 `rerun-keeps`: a second `/devkit setup` on the same project keeps every value already present, asks only for what is missing, and leaves `openspec/config.yaml` byte-identical when nothing is missing.
- AC-5 `no-checker-copy`: the step copies no checker code into the project; it records the plugin version the project uses and says so, naming the pack, when a pack is not enabled in `.claude/settings.json`.
- AC-6 `driver-rule`: the step offers only the driver values that `/devkit change` can run with on the installed plugin, never writes `driver-not-built` values, and asks the `.compozy/` kit's yes/no question separately; a yes installs the kit with the behaviour `compozy-setup` has today.
- AC-7 `github-one-by-one`: in `merge` mode the step shows each GitHub item (ruleset, required checks, auto-merge setting) and confirms it one by one, never in bulk; `merge` is the suggested answer of the ship question.
- AC-8 `old-projects-work`: a project set up with the old skills (a fixture) passes the flow checker and runs `/devkit change` with no setup step.
- AC-9 `behaviour-kept`: schema installation, the opt-in settings, the `gh` check, the changes-under-way list, the ship entry and the GitHub step behave as before: their existing tests pass in their new place.
- AC-10 `real-run`: a real run in a scratch project proves each case the plan declares: first install, re-run, `merge` mode, and the kit's yes and no answers.

How `design.md` reads three of them: "the behaviour `compozy-setup` has today" (AC-6) is the
installer's behaviour; the old skill's `design:` step is not carried (Out of scope; D-6). "Names
them" (AC-2) excludes decision records, past `CHANGELOG.md` entries and change folders, which are
history (the record's Context; D-9). "Records the plugin version" (AC-5) uses the pins that exist, with
no new key (requirements, second assumption; D-5).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `project-setup`: the setup is `/devkit setup`. It writes the `devkit:` block (asked keys,
  proposed tests, ship mode, `release_tag`), keeps values on a re-run, applies the driver rule, asks
  the kit question, names the version and the packs not enabled, and copies no checker. The four
  existing requirements that name `openspec-setup` now name the verb. The other requirements keep
  their behaviour.
- `compozy-kit-setup`: the kit is installed by the installer devkit-compozy ships, run by
  `/devkit setup` on a yes to the kit question. The requirements that name `compozy-setup` name that
  installer instead, with no change of behaviour. One added requirement says the installer ships
  outside any skill folder and how `/devkit setup` finds it.
- `change-coordination`: `/devkit` reads `setup` as a verb that runs before the project gate, on
  every driver, beside the five verbs `main` holds (`train` included). The reply for a project not
  set up names `/devkit setup`. The delta's block is the canonical text, as the archive of
  `delivery-train` left it, plus `setup` (`design.md` D-12, step 7).

## Impact

- devkit-openspec: `hooks/change-loop.mjs` (the `setup` mode, one exported list of built drivers, the
  replies), `hooks/flow-check.mjs`, `hooks/guard.mjs`, `hooks/merge-setup.mjs` (the pointer and its
  one strip helper), `hooks/project-loop.mjs`, `hooks/train-loop.mjs` and `hooks/compozy-driver.mjs`
  (message texts); `skills/devkit/` (the
  `## Setup` section, the moved scripts, templates and fixtures, the new `setup-block.mjs` and
  `kit-installer.mjs`); `skills/ship-change/SKILL.md`; `skills/openspec-setup/` removed; the suites
  `guard.test.mjs`, `change-loop.test.mjs`, `change-loop-compozy.test.mjs`, `roadmap-loop.test.mjs`,
  `roadmap-loop-followups.test.mjs`, `project-loop.test.mjs`, `deliver-check.test.mjs`,
  `deliver-check-cli.test.mjs`, `merge-setup.test.mjs`, `delivery-models.test.mjs`,
  `flow-check.test.mjs`, `version-pin.test.mjs`, `compozy-driver.test.mjs`,
  `delivery-train.test.mjs` and `delivery-train-after.test.mjs` (the verb list, the hint and the
  train's blocked reply), and `test-suite.test.mjs` (the suite's folder names).
- devkit-compozy: `skills/compozy-setup/` removed; `kit/` holds `install-kit.mjs`, `gen-agents.mjs`,
  the templates and their tests; the generated agents are generated again with the new generator
  path; `README.md`, `plugin.json`.
- devkit-core: no change and no release (`suite-speed` already rewrote the comment of
  `review-round.test.mjs` that named the setup tests).
- This repository: `scripts/test-suite.mjs` (its `SUITE_FOLDERS` names the two new folders);
  `.compozy/` installed again; `.github/workflows/ci.yml`; `CLAUDE.md`,
  `CONTRIBUTING.md`, `README.md`, `docs/getting-started.md`, `docs/openspec-flow.md`,
  `docs/compozy-kit.md`, `docs/conventions.md`, `docs/coordination-design.md`, `docs/catalog.md`;
  ADR 0004 and the record `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`;
  `openspec/config.yaml` (the ADR list); the canonical Purpose of the two
  capability specs; `CHANGELOG.md`, `.claude-plugin/marketplace.json`.
- Versions: devkit-openspec, devkit-compozy and the marketplace each take the next free minor version
  on `origin/main` at the last merge before review. The devkit-openspec bump moves the CI pins of
  `docs/openspec-flow.md` to `v<that version>` and edits no test: the test
  `change-loop docs: the design records the answers` reads the expected pin from
  `plugins/openspec/.claude-plugin/plugin.json` (ADR 0030). This repository delivers on a delivery
  train (`devkit.delivery` in `openspec/config.yaml`, ADR 0022): the departure renumbers the release
  above the train's numbers, and the train's merge commit is tagged `v<the train's version>`
  (CONTRIBUTING).
- Dependencies: `compozy-driver` (round 21), `delivery-train`, `stage-models` and `suite-speed`,
  merged and archived on `main` (`openspec/changes/archive/2026-11-24-<id>/`) and merged into this
  branch; the plan's base is the branch's last merge of `origin/main` (`design.md` D-12). With
  `compozy-driver` archived, the `compozy-kit-setup` delta already holds the MODIFIED blocks of the
  three requirements it added; with `delivery-train` archived, the `change-coordination` block is the
  canonical text plus `setup`. Tasks 6.5 and 6.6 re-check both at each later merge. `suite-speed`
  gives the one suite command, `node scripts/test-suite.mjs`, and the folder list this change moves
  (`SUITE_FOLDERS`); it has no spec delta. The siblings' records are named by file
  (`docs/adr/0024-compozy-runs-the-short-loop.md`,
  `docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`), and their versions are read at
  each merge, not quoted here. This change's record and versions take the next free ones on
  `origin/main` at the last merge before review, so no two records share a number.
  `delivery-models` (archived) for the delivery keys; `change-version-pin` (archived) for the pin
  this step does not move; `archive-release-pin` (merged on train 4, not archived; ADR 0030) for the
  release rule above.
- Decisions cited: ADR 0002, 0004, 0009, 0010 (decision 1), 0018, 0019, 0022 (the delivery train
  this repository's release leaves on), 0030 (a release moves the flow page's pins and no test), the
  record `docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md` and the proposed record
  `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`.
  Open decisions inherited: none. The open point "Project setup" of `docs/coordination-design.md` is
  the one this change answers.

Exit criteria: `openspec validate project-setup --type change --strict` (the bare form is ambiguous:
a change and a capability share the name); the whole suite `node scripts/test-suite.mjs` with
`GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, which lists the moved setup and kit tests and the new
ones; `python3 scripts/check.py`; `python3 scripts/gen-catalog.py --check`; `claude plugin validate .`;
`node plugins/compozy/kit/scripts/gen-agents.mjs --check`; the real-run proof files of AC-10.
