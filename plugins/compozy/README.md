# devkit-compozy

The CompozyOS delivery loop, version 2, as devkit files any project installs: a loop template, four
thin `AGENT.md` role shells and the skills those shells call. `compozy-setup` writes them into the
project as `.compozy/`; the operator then publishes and runs the loop.

```bash
claude plugin install devkit-compozy@devkit --scope project
```

Run at the project root, or add the pack to the project's `.claude/settings.json` (see
[getting-started](../../docs/getting-started.md#1-opt-the-project-in)).

```text
propose ─▶ plan gate ─▶ design ─▶ implement ─▶ review ─▶ verify ─▶ demo ─▶ deliver ─▶ CI ─▶ merge ─▶ archive ─▶ cleanup
```

- `design` and `demo` are optional branches: skipped automatically for a change that declares no
  screen, or whose project has no `demo_command`.
- Every automated gate is a command, never a judge; every human decision is a `review` the owner
  answers before the step it precedes runs.
- `implement` through `cleanup` reach the devkit checkers (`deliver-check`, `conduct-check`) and
  this pack's own `screens-check` through `.compozy/bin/devkit-kit`, a portable resolver: no
  shipped template holds a path that exists in only one repository (design D9).

## What a project must provide

- `verify_command`: the shell command the `verify` gate runs inside the worktree, deciding the
  change is ready for a pull request.
- `demo_command` (optional): a command that captures screenshots and a short video for a change
  with screens. Empty skips the demo branch.
- `demo_url` (optional): the base URL `demo_command` runs the demo against.
- A `design:` block in `openspec/config.yaml`, its two keys `screen_map:` (the project's screen
  map path) and, optionally, `mockup:` (the tool or document the mockup lives in), only when the
  project has a browser surface to track. No block means no screens: the design gate is a no-op.
  The map at `screen_map` must carry a row per screen with the screen id as its first cell, and a
  line starting with `Mockup:` carrying the version or the date the rows describe.

## Install

`compozy-setup` writes `.compozy/` into the project: `config.toml`, `README.md`, the four role
shells under `agents/<role>/AGENT.md`, `loops/openspec-change/loop.yaml` and the resolver
`bin/devkit-kit`. It never publishes the loop to the CompozyOS daemon (that is the operator's
`compozy loop create --fork-from-name`), never starts a run and never writes product code.

## Assets

<!-- catalog:begin -->
<!-- catalog:end -->
