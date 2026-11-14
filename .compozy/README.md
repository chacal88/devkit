# .compozy/ - CompozyOS skeleton of this workspace

What CompozyOS reads to give this repository an identity. It travels with the repository; the
daemon adds `workspace.toml` (a stable id for this machine) on the first registration, which is
git-ignored.

## Roles (agents/)

The devkit is the engine: OpenSpec changes, hooks that keep product code closed until the plan is
ready, reviewer agents and checkers. CompozyOS only sequences the stages, holds the human gates,
runs sessions and shows the panel. Each agent here is a thin badge over devkit skills and agents;
no rule is duplicated in these prompts.

| Role | Does | Writes |
| --- | --- | --- |
| `tech-lead` | plans one change (proposal, design, tasks, spec deltas, readiness) | `openspec/changes/<id>/` |
| `dev` | implements phase by phase with TDD in the worktree `<id>` on branch `<id>` | code and tests, `tasks.md` ticks |
| `qa` | runs the review bench and the pr-verifier | `reviews/`, `review.md`, `evidence.md` |

## Loop (loops/openspec-change)

`propose` -> `approve_plan` (validation) -> `implement` (the operator approves the plan in its
review) -> `review` -> `verify` (focused check + `deliver-check --ci` inside the worktree) ->
`deliver` (the operator approves the push; the ship mode of `openspec/config.yaml` decides the
merge).

```
compozy loop run --name openspec-change --workspace devkit \
  --input change_id=<id> --input brief="<what the change must achieve>" \
  --input schema=devkit-lite --no-prompt
```

The operator starts every run; nothing starts a loop on its own.
