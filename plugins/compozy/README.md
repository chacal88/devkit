# devkit-compozy

The CompozyOS driver of the devkit flow, as files any project installs: one agent for every devkit
role, three loops and the skills the screen roles can use. `/devkit setup` writes them into the
project as `.compozy/` through the pack's kit installer; `/devkit` then starts the runs (`driver: compozy` in the `devkit:` block of
`openspec/config.yaml`). The design is [ADR 0024](../../docs/adr/0024-compozy-runs-the-short-loop.md).

```bash
claude plugin install devkit-compozy@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see
[getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

| Loop | Does |
|---|---|
| `devkit-change` | one change from its request to archived: each turn asks the devkit checker (`change-loop.mjs`) what is next, has it confirm the reading, and runs that one step (a role, the review loop, a phase gate, a command, or a question to the owner) |
| `devkit-review` | the review round as parallel sessions, over `review-round.mjs` |
| `devkit-roadmap` | starts the changes of `openspec/roadmap.md` in order while there are free places; it merges nothing |

- The devkit decides, the loops only run: every gate is a script (`change-loop.mjs`, reading
  `flow-check` and, through `conduct-check`, `deliver-check`), the same ones the Claude driver asks.
- The twenty-one agents under `agents/` are seats generated from the Claude agent files
  (`scripts/gen-agents.mjs`): each hands its work, unchanged, to the Claude agent of the same name, so
  the devkit hooks judge it as in Claude Code. A change goes into the Claude agent, never into the copy.
- Every automated decision is a command, never a judge; every human decision is a CompozyOS request
  the owner answers: the grill, the plan approval, the mock-up approval, the retro answers, and a
  retry or stop when a step is blocked.
- The loops reach the checkers through `.compozy/bin/devkit-kit`, a portable resolver: no shipped
  template holds a path that exists in only one repository.

The driver does not carry every feature of the Claude driver; the limits are listed in the
Consequences of ADR 0024.

## What a project must provide

- `driver: compozy` in the `devkit:` block of `openspec/config.yaml`, the project registered as a
  CompozyOS workspace, and the kit installed.
- The project's own test commands (`devkit.tests.unit`, and `devkit.tests.e2e` when it has
  end-to-end tests).
- A `design:` block in `openspec/config.yaml`, its two keys `screen_map:` (the project's screen
  map path) and, optionally, `mockup:` (the tool or document the mockup lives in), only when the
  project has a browser surface to track. No block means no screens: `screens-check` is a no-op.
  The map at `screen_map` must carry a row per screen with the screen id as its first cell, and a
  line starting with `Mockup:` carrying the version or the date the rows describe.

## Install

`/devkit setup` (the Setup section of devkit-openspec's `devkit` skill) writes `.compozy/` into the project
when the owner says yes to the kit or chooses `driver: compozy`. It runs the kit installer this pack
ships, `kit/scripts/install-kit.mjs`, which writes `config.toml`, `README.md`, the twenty-one agents
under `agents/<role>/AGENT.md`, the loops under `loops/<name>/loop.yaml`, the resolver
`bin/devkit-kit` and `kit-manifest.json`. It never starts a run and never writes product code. A
project on the first kit (four role shells and the `openspec-change` loop) runs it again: the unedited
old files are removed, an edited one is kept and named.

## Assets

<!-- catalog:begin -->
**Skills** (invoke with `/<name>` or let Claude pick them by description)

| Skill | What it does / when to use |
|---|---|
| [`screen-demo`](skills/screen-demo/SKILL.md) | Runs a project's demo command and files the screenshots and the journey video a change's declared screens produce, under openspec/changes/<id>/evidence/. Use when a change's `## Screens` section names at least one screen and the project has a demo_command, after verify and before the pull request. |
| [`screen-design`](skills/screen-design/SKILL.md) | Reads a project's screen map and mockup version, proposes or confirms a row for each screen a change declares, and runs the mechanical check of the screen map (`screens-check`). Use when a change's `## Screens` section names at least one screen, before implementation starts. |
<!-- catalog:end -->
