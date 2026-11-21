# The CompozyOS kit: devkit-compozy

`devkit-compozy` (`plugins/compozy/`) ships the CompozyOS delivery loop, version 2, as a devkit
pack: a loop template, four thin `AGENT.md` role shells and the two skills the design role calls
(`screen-design`, `screen-demo`), plus the `compozy-setup` skill that installs them into a project
as `.compozy/`. CompozyOS sequences the devkit flow across supervised agent turns; the devkit
itself — OpenSpec change files, the hooks that keep product code closed until the plan is ready,
the reviewer agents, the checkers — does the real work inside every stage. A project installs the
kit only when it runs CompozyOS: a project that doesn't never pays for its skill descriptions.

## The twelve stages

| # | Stage | Who runs it | Gate that follows |
|---|---|---|---|
| 1 | `propose` | `tech-lead` (the planner agent), with the devkit's plan and readiness skills; declares the screens the change touches in `proposal.md`'s `## Screens` | `approve_plan` — command: `openspec validate <id> --strict` in the change's worktree |
| 2 | the plan validation gate (`approve_plan`) | automated (control gate); a failure starts the next generation from `propose` | — |
| 3 | the design branch (`touches_screens` → `design` → `screens_ok`) | `design`, with the `screen-design` skill: confirms or proposes the screen-map rows and a mockup version | `screens_ok` — command: `.compozy/bin/devkit-kit screens-check --change <id>` |
| 4 | `implement` | `dev` (the implementer agent), phase by phase with TDD, one commit per task | preceded by the owner's review (approves the plan, and the design when it ran, in one decision, before any code); no automated gate follows directly — next is `review` |
| 5 | `review` | `qa` (the reviewer agent): the devkit review bench and `pr-verifier`, writing `reviews/`, `review.md`, `evidence.md` | the verify gate — command: the project's `verify_command` plus `.compozy/bin/devkit-kit deliver-check --ci` |
| 6 | the verify gate | automated (control gate); a failure starts the next generation | — |
| 7 | the demo branch (`has_demo` → `demo`) | `design`, with the `screen-demo` skill: screenshots and a journey video under `openspec/changes/<id>/evidence/` | none directly — joins `deliver` |
| 8 | `deliver` | `dev`, with the devkit's `ship-change`/`commit-and-pr`: pushes the branch and opens the pull request | preceded by the owner's review (approves the push and the pull request) |
| 9 | the CI wait and its gate (`ci_fix` → `checks_green`) | `dev` registers a CompozyOS pull-request monitor and fixes the branch while it stays armed, until the required checks are green | `checks_green` — command: `gh pr checks <url> --required` |
| 10 | the merge wait (`await_merge` → `merged`) | `dev` keeps the monitor armed until the pull request merges (by the owner, or by GitHub when the project's ship mode is `merge`); it never merges by hand | `merged` — command: `gh pr view <url> --json state --jq .state \| grep -qx MERGED` |
| 11 | `archive` | `dev`, with the devkit's `ship-change` archive steps (retro, the owner's answer per proposal, `openspec archive`, the roadmap tick, the archive pull request) | none directly — next is `cleanup` |
| 12 | the worktree cleanup (`cleanup`) | automated action (`compozy__worktree_remove`), allowed to fail without failing the run | terminal |

Both waiting stages (9 and 10) are a `run-agent` node that registers a CompozyOS pull-request
monitor, never a shell: the runtime cannot observe a `sleep`, a `gh pr checks --watch`, a
`gh run watch` or a polling loop, and a turn that waits that way never wakes. Their gates only
confirm, in one non-blocking command, the state the wait reached, and fail by escalating to the
owner rather than by replanning the change — the agent already looped on the fixes.

The merge itself stays the owner's unless the project's ship mode says `merge`
([ADR 0002](adr/0002-merge-without-the-owner-opt-in.md)).
Whatever the ship mode, the loop never merges a pull request by hand — only the waiting stage
confirms that the owner, or GitHub, already did.

## The two optional branches

- **The design branch** (stage 3) runs only when `propose`'s `screens` output — which mirrors
  `proposal.md`'s `## Screens` list — is not empty. When it is empty, both `design` and the demo
  branch are skipped and `implement` still runs, through the skip edge from `approve_plan`.
- **The demo branch** (stage 7) runs only when that same `screens` list is not empty *and* the
  project's `demo_command` is not empty. When either is missing, `demo` is skipped and `deliver`
  still runs, through the skip edge from `verify`.

A project with no browser surface declares no screen in any change, so both branches are a no-op
for it, start to finish, which is also the first proof that the skip works
(this repository's own change, `compozy-loop-v2`).

## What a project must provide

- `verify_command` — the focused check the `verify` gate runs inside the worktree.
- `demo_command` (optional) — a command that captures the demo evidence. Empty means no demo, and
  the demo branch is skipped.
- `demo_url` (optional) — the base URL `demo_command` runs the demo against.
- A `design:` block in `openspec/config.yaml` (`screen_map:`, optionally `mockup:`), only for a
  project that has screens to track. No block means no screens: the design gate is a no-op. The
  map at `screen_map` must carry a row per screen (the screen id as its first cell) and a line
  starting with `Mockup:` carrying a version or an ISO date.

See [the pack's README](../plugins/compozy/README.md) for the full contract.

## How to adopt it

1. **Install the pack and run `compozy-setup`.** It writes `.compozy/` into the project:
   `config.toml`, `README.md`, the four role shells (`agents/<role>/AGENT.md`), the loop template
   (`loops/openspec-change/loop.yaml`) and the resolver `bin/devkit-kit`; it adds the `design:`
   block to `openspec/config.yaml` only when the project has screens. It never publishes the loop,
   starts a run, or writes product code.

   The files are installed by a script, `install-kit.mjs`, which records the inputs and a digest of
   every file in `.compozy/kit-manifest.json`. Running it again updates the files the project did
   not edit with the current templates and the recorded inputs, and reports a file already equal to
   its rendering as `same`. A file the project edited is shown (its difference from the current
   template) and kept until the owner says yes for that file, one question per file; the run is then
   repeated with `--accept <path>` for it. The first re-run of an install made before the manifest
   existed treats every file that differs from the template as edited.
2. **Publish the loop.** The operator runs `compozy loop create --fork-from-name` once the files
   are in place and reviewed — a CompozyOS act, not the kit's.
3. **Run it.** The operator starts a run with `compozy loop run`, naming the loop, a workspace and
   the inputs (`change_id`, `brief`, `schema`, and the four agent defaults `compozy-setup` already
   filled):

   ```bash
   compozy loop run --name openspec-change --workspace <name> \
     --input change_id=<id> --input brief="<what the change must achieve>" \
     --input schema=devkit-lite --no-prompt
   ```

   Nothing starts a run on its own; the operator starts every one.

## How it relates to `/devkit change`

`/devkit change` ([ADR 0010](adr/0010-openspec-as-the-harness.md), [ADR 0011](adr/0011-the-change-coordinator-is-the-owners-session.md); it replaced `/conduct`, ADR 0006 and ADR 0007) and the CompozyOS loop are **two ways to drive the
same devkit flow**, not two flows: the same artifacts (`proposal.md`, `design.md`, `tasks.md`,
`reviews/`, `evidence.md`), the same checkers (`deliver-check`, `conduct-check` (a checker the `/devkit change` loop calls), and this kit's own
`screens-check`) and the same owner gates (plan and design approval, the push, the PR merge when
the mode is not `merge`). `/devkit change <what you want>` runs the flow from the owner's own Claude Code session,
stage by stage, in a git worktree, asking the owner only at the owner's gates; the CompozyOS loop runs it as
a supervised multi-agent run (`compozy loop run`) across the four role shells, with the owner's
decisions as `review` blocks the loop stops on. Neither replaces the other: a project picks the one
that fits how it works, or uses both on different changes. The posture — CompozyOS as a second, opt-in driver of the devkit flow — is recorded in [ADR 0009](adr/0009-compozy-loop-as-a-second-driver.md). [ADR 0010](adr/0010-openspec-as-the-harness.md) supersedes ADR 0001 and ADR 0007 and keeps CompozyOS as one of the drivers a project chooses: round 21 (`compozy-driver`) replaces this loop with the short generic one and round 15 (`change-coordinator`) replaced `/conduct` with `/devkit change`; the CompozyOS loop works as this page describes until round 21.

## Checker portability

Every shipped template calls the devkit checkers through `.compozy/bin/devkit-kit`, a resolver
that finds them at `$DEVKIT_HOOKS`, in a repository checkout, or in the installed
`devkit-openspec` with the highest version — so no template holds a path that exists in only one
repository. `screens-check` resolves inside this pack itself, since it ships with it.
