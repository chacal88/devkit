<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> one setup step writes the `devkit:` block, installs the schemas and the checker into the project and wires its driver (orchestrator-replan retro, item 3)

### Answered by triage

1. [project rules] Which tests, docs and versions pin the names or text of `openspec-setup` and `compozy-setup`? -> The skill folders `plugins/openspec/skills/openspec-setup/` and `plugins/compozy/skills/compozy-setup/` (with their script tests); text pins in `plugins/openspec/hooks/guard.test.mjs`, `change-loop.test.mjs`, `project-loop.test.mjs`, `deliver-check.test.mjs`, `merge-setup.test.mjs`, `delivery-models.test.mjs`, `flow-check.test.mjs`, `version-pin.test.mjs` and `plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs`; message text naming the skill in `change-loop.mjs`, `flow-check.mjs`, `guard.mjs`, `merge-setup.mjs`, `project-loop.mjs`; docs and specs `openspec/specs/project-setup/spec.md` and `openspec/specs/compozy-kit-setup/spec.md`; the catalog is generated. The planner lists them again from the code. (source: `docs/catalog.md:122-128`)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The one setup step is a new verb `/devkit setup` of the `devkit` skill (`plugins/openspec/skills/devkit/SKILL.md`), typed only by the owner; the skills `openspec-setup` and `compozy-setup` are removed, and every message, doc and test that names them points to `/devkit setup`. (answered by the coordinator under the owner's delegation, 2026-11-23, grill question 1, option A: one door like `/devkit change`, `/devkit roadmap`, `/devkit status`, `/devkit project`)
- "Installs the checker" copies no checker code: the checks (`flow-check`, `deliver-check`, `guard`) keep running from the installed plugin and CI keeps downloading them at the release tag. The step records the plugin version the project uses (the pin CI and `release_tag` already read) and checks that the packs are enabled in `.claude/settings.json`. The design doc's "under the project's `openspec/`" is read as the version pin and the schemas, not checker code; the adr-author notes whether that wording needs an amendment of `docs/coordination-design.md`. (answered by the coordinator under the owner's delegation, 2026-11-23, grill question 2, option A; follows ADR 0004, ADR 0018 and the change-version-pin decision)
- `/devkit setup` writes the `devkit:` block of `openspec/config.yaml` as follows: one short question each for `language`, `driver` and the delivery model (`delivery.model`, `delivery.base`, `delivery.test_branch`), each with its default read from the repository; `tests.unit`, `tests.coverage.command`, `tests.coverage.target` and `tests.e2e` proposed from the repository for the owner to confirm (as `openspec-setup` does today); the ship mode (`ship` and `merge_method`, top-level keys) asked, with `merge` shown as the suggested answer; `release_tag` written only when a release file exists; `budget` and the `design:` block left as commented examples. A re-run keeps every value already present and asks only what is missing. In `merge` mode each GitHub item (ruleset, required checks, auto-merge setting) is shown and confirmed one by one, never applied in bulk. There is no `devkit:` key for the task source: the key or link typed names it. (answered by the coordinator under the owner's delegation, 2026-11-23, grill question 3, option A)
- The driver rule: `/devkit setup` offers a `driver` value only when `/devkit change` can run with it on the installed plugin, and never writes a value that blocks the owner's own command (`driver-not-built`). Today that is `claude`; `script` is not offered. The CompozyOS kit under `.compozy/` stays installable through a separate yes/no question of the step. The `compozy-driver` change (Round 21, branch `compozy-driver`) merges into `main` first and edits the `compozy-setup` skill and the kit manifest: the planner reads `origin/main` after that merge (or the branch before it); if `driver: compozy` is built there, `compozy` is offered and choosing it installs the kit. Removing `compozy-setup` is reconciled with what that change ships. (answered by the coordinator under the owner's delegation, 2026-11-23, grill question 4, option A)
- Settled from the code, no question: the step keeps what `openspec-setup` does today and moves it under the new verb: opt the project in (`plugins/openspec/skills/openspec-setup/scripts/project-settings.mjs`), check `gh` (`gh-version.mjs`), list the changes under way before replacing schemas and ask one yes (`changes-under-way.mjs`), install the schemas (`install-schemas.sh`), write `context` from the repository, add the `devkit-project` ship entry (`ship-entry.mjs`) and run the GitHub step (`github-setup.mjs`). It is the same step for a first install and for a re-run; a re-run upgrades the schemas and keeps the project's values (`openspec/specs/project-setup/spec.md`).
- A project already set up with the old skills keeps working with no step: the three consumer projects need no re-run to keep their current flow. (answered by the coordinator under the owner's delegation, 2026-11-23, grill question 1)

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
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

## Out of scope

- The `script` driver and the build of `compozy-driver` itself (Round 21, its own change).
- Any change to the checkers' code, or copying them into a project.
- A `devkit:` key for the task source, and writing `budget` or the `design:` block.
- Re-running the step on the three consumer projects (they keep working as they are).
- Applying GitHub settings in bulk.
