<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> openspec-type-flag: `openspec validate <id> --strict` answers `ambiguous_item` when a change and a canonical spec share the id (seven archived ids of this repository equal spec names). `change-loop.mjs merge-check` already passes `--type change`; make every other place that runs `openspec validate` for a change (the readiness reviewer, the change planner, the openspec-validator agent, the CompozyOS templates) pass it too, with a test or check that refuses one that does not.

Classification: domain=process type=bug flags=[] (none of ui, architecture or contract applies)

## Assumptions

- In scope: every place whose text tells an agent or a stage to run `openspec validate` on one change id. Each runs `openspec validate <id> --type change --strict` (keeping any other flag it already has, such as `--no-interactive` or `--json`):
  - `plugins/core/agents/plan-readiness-reviewer.md` (step 3);
  - `plugins/core/agents/change-planner.md` (step 4 and the next-step line of its output);
  - `plugins/openspec/agents/openspec-validator.md` (step 1 and its report line);
  - `plugins/core/skills/plan-readiness-review/SKILL.md` and `plugins/core/skills/review-change/SKILL.md`, whose fallback to the bare form ("if the CLI lacks those flags") is removed: devkit supports OpenSpec 2.x only (`docs/openspec-flow.md:131`) and 2.0.0 accepts `--type change` (`docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md:26`);
  - the `Gate: \`openspec validate <id> --strict\` passes.` lines of `plugins/openspec/schemas/devkit/schema.yaml` and `plugins/openspec/schemas/devkit-lite/schema.yaml`, with their byte-identical copies under `openspec/schemas/` (`CONTRIBUTING.md:78`).
- The CompozyOS agents are not edited by hand: `plugins/compozy/kit/templates/agents/*/AGENT.md` and `.compozy/agents/*/AGENT.md` are regenerated with `node plugins/compozy/kit/scripts/gen-agents.mjs` from the Claude agent files (`docs/compozy-kit.md:37-40`).
- Out of the edit: text that only names the command without telling anyone to run it on a change (`docs/roles.md:154`, `docs/coordination-design.md:181`, the agent descriptions in `plugins/openspec/README.md` and `docs/catalog.md`, the schema sentences "`openspec validate` rejects ..." that describe what the CLI does), the `openspec validate --all --strict` snippet of `docs/openspec-flow.md` (it takes no id), and the old-release fixtures under `plugins/openspec/skills/devkit/scripts/fixtures/schemas-0.13.0/`.
- The type passed is always `change`: every place in scope validates a change, never a canonical spec.
- Packs touched: devkit-core, devkit-openspec and devkit-compozy; their versions and changelog lines follow `CONTRIBUTING.md:60` (the change's `release.md`).

## Acceptance criteria

- AC-1 `every-run-passes-type` — Every file in scope tells the agent to run `openspec validate <id> --type change --strict`; no file in scope still holds the bare form or a fallback to it, and `node plugins/compozy/kit/scripts/gen-agents.mjs --check` passes.
- AC-2 `same-name-proof` — A test creates, in a scratch repository with the real `openspec` CLI, a change and a canonical spec that share one id: the bare `openspec validate <id> --strict` answers `ambiguous_item`, and `openspec validate <id> --type change --strict` validates the change.
- AC-3 `bare-form-refused` — A repository check that runs locally and in CI fails when an agent, skill or schema file tells an agent to run `openspec validate <id>` on a change without `--type change`, naming the file and the line; on the files of this change it passes.

## Out of scope

- Prose that only names the command, the `--all` snippet and the old-release fixtures (see Assumptions).
- Any change to how `change-loop.mjs merge-check` validates (it already passes `--type change`).

## Questions asked

1. [scope] Beyond the places the request names, the bare form also sits in the schemas' `Gate:` lines and in two skills' fallback: what goes in? → Everything that tells an agent or a stage to run a change's validation goes in, the schemas' `Gate:` lines and the two skills' fallback included; prose that only names the command stays as is (answered by the coordinator's session on the owner's delegation of 2026-11-28).
2. [end effect] When the bare form is written again, what happens, and is the proof a test with a change and a spec of the same name? → A repository check fails, locally and in CI, naming the file and the line of the bare form; the proof is a test with a change and a canonical spec of the same id run on the real `openspec` CLI (answered by the coordinator's session on the owner's delegation of 2026-11-28).

## Answered by triage

1. [project rules] Which CLI version is pinned, and does it accept `--type change`? → CI installs `@fission-ai/openspec@2.0.0`; devkit supports 2.x only; 2.0.0 accepts `openspec validate <id> --type change --strict` and the loop already runs it (source: `.github/workflows/ci.yml:23`, `docs/openspec-flow.md:131`, `docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md:26`, `plugins/openspec/hooks/change-loop.mjs:1790`).
2. [scope] Are the CompozyOS agent copies regenerated rather than edited? → Yes: `gen-agents.mjs` writes them from the Claude agent files and `--check` fails on a stale one (source: `plugins/compozy/kit/scripts/gen-agents.mjs:6`, `docs/compozy-kit.md:37`).
3. [scope] Are the `openspec/schemas/` copies kept in sync? → Yes, byte-identical through `install-schemas.sh`, asserted by a test (source: `CONTRIBUTING.md:78`, `plugins/openspec/hooks/flow-check.test.mjs:188`).
4. [project rules] Version bumps and release lines? → Through the change's `release.md`, written with the plan (source: `CONTRIBUTING.md:60`).
5. [end effect] What proof do the documents ask for? → "a test of a change and a spec of the same name" (source: `openspec/roadmap.md:230`).
6. [project rules] Does a checker already scan text for command forms? → No; `check_install_scope` is the nearest pattern (source: `scripts/check.py:103`).
