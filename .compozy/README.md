# .compozy/ - CompozyOS skeleton of this project

What CompozyOS reads to give this project an identity. It travels with the repository; the
daemon adds `workspace.toml` (a stable id for this machine) on the first registration, which is
git-ignored.

## Roles (agents/)

The devkit is the engine: OpenSpec changes, hooks that keep product code closed until the plan is
ready, reviewer agents and checkers. CompozyOS only sequences the stages, holds the human gates,
runs sessions and shows the panel. Each agent here is a thin shell over devkit skills and agents;
no rule is duplicated in these prompts.

| Role | Does | Writes |
| --- | --- | --- |
| `tech-lead` | plans one change (proposal, design, tasks, spec deltas, readiness), declaring the screens it touches; on the `devkit` schema `devkit-core:adr-author` writes `decisions.md` first | `openspec/changes/<id>/`, and the project's ADR folder through that agent |
| `dev` | implements phase by phase with TDD in the worktree `<id>` on branch `<id>`, waits on the pull request's checks and its merge, then drives the archive; before the first phase it has the implementer accept the listed ADRs and the mock-up | code and tests, `tasks.md` ticks, the archive steps |
| `qa` | runs the unit and E2E tests through `devkit-core:test-runner` and `devkit-core:e2e-tester` when the project declares them, then the review bench and the pr-verifier | `reviews/`, `review.md`, `evidence.md`, `unit-tests.md`, `e2e-tests.md`, the E2E test files |
| `design` | for a change with screens, has `devkit-core:screen-designer` draw each screen and write `mockup.md`, confirms or proposes the screen-map rows and a mockup version, then records the demo evidence | `openspec/changes/<id>/mock/`, `mockup.md`, the screen-map rows, `openspec/changes/<id>/evidence/` |

## Loop (loops/openspec-change)

Twelve stages: `propose` -> plan gate -> `design` (skipped for a change that declares no screen)
-> `implement` (the operator approves the plan, and the design when it ran, in one review) ->
`review` -> `verify` (focused check + `deliver-check --ci` inside the worktree) -> `demo` (skipped
for a change with no screen, or when the project names no `demo_command`) -> `deliver` (the
operator approves the push) -> the CI wait and its gate -> the merge wait and its gate ->
`archive` (the devkit's `ship-change` archive steps) -> `cleanup` (the worktree is removed).

```
compozy loop run --name openspec-change --workspace <name> \
  --input change_id=<id> --input brief="<what the change must achieve>" \
  --input schema=devkit-lite --no-prompt
```

The operator starts every run; nothing starts a loop on its own. `compozy-setup` fills this
project's four agent defaults, `verify_command`, optionally `demo_command` and `demo_url`, and the
workspace timezone in `config.toml`; everything else in this file is the same for every project
that adopts the kit.
