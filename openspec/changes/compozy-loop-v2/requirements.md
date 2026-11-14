# Requirements

Change: `compozy-loop-v2` · Date: 2026-11-14 · Owner: Kaue (chacal88)

Grill: offered on 2026-11-14 as four questions (where the kit lives, how the design gate checks
the screen map, who declares that a change touches a screen, how the demo runs). The owner did not
answer within the planning node, so the four answers below are written as **(unconfirmed)**
assumptions, chosen as the option the questions marked "recommended", and repeated verbatim in the
plan's open questions. The owner decides them at the plan-approval review, before any code — which
is the point at which they are still cheap, because no file exists yet.

What a different answer costs, named honestly, because none of the four is confined to a single
phase (`proposal.md`, Open decisions, carries the same table):

| Decision | What changes | Cost |
|---|---|---|
| A-1 / OD-1 | the path prefix of every file the change creates, in all seven phases, plus the registration in `marketplace.json` and the catalog; inside `devkit-openspec` the release also bumps that pack and gains a tag | a mechanical move, applied once, plus a tag; no file's content changes |
| A-2 / OD-2 | how `screens-check` resolves the map (phase 4), and the text that documents it in `compozy-setup`, the pack README and the `design` shell (phases 1, 3, 4) | one function and four passages |
| A-3 / OD-3 | the `propose` output schema and both branch conditions (phase 2), the `tech-lead` shell's rule (phase 3) and what `screens-check` reads (phase 4) | phases 2 to 4; the gate and the branches keep their shape |
| A-4 / OD-4 | the demo helper and the example spec (phase 5), and the `demo` node's prompt (task 2.4, phase 2) | the smallest of the four: one phase plus one prompt |

None of the four changes the loop's graph, its gates or the acceptance criteria.

## Request

(The operator's brief, in their words.)

> A reusable CompozyOS delivery kit, version 2 of the openspec-change loop the pilot used (see
> `.compozy/` in this repository and in `chacal88/whatsapp-platform`). Ship it as devkit files any
> project can adopt: the loop YAML template, thin AGENT.md shells (tech-lead, dev, qa and a design
> role) and the skills those shells call. The loop gains: (1) a design gate between the approved
> plan and implementation: when the change touches a screen, that screen must exist in the project's
> screen map and mockup with a version; otherwise the design role proposes it and the owner approves
> the design in a review before any code; skipped automatically when no screen is touched. (2) The
> review bench and the pr-verifier as a run-agent step followed by a command gate
> (`deliver-check --ci` inside the worktree), never a judge. (3) After the pull request is open, the
> implementer waits for the CI check and fixes until it is green, with a gate that confirms the
> check before the loop ends. (4) A demo step for changes with screens: Playwright screenshots of
> every changed screen in both themes and in desktop and phone widths, plus a short video of the
> journey, stored under `openspec/changes/<id>/evidence/` and linked from the pull request body.
> (5) After the owner merges (the merge stays human unless the project's ship mode says merge), the
> loop archives the change with the ship-change archive steps, removes the worktree and ends the
> sessions. Tasks the owner defers by a dated decision in `tasks.md` count as done for the loop's
> finish line. whatsapp-platform adopts the kit right after this change.

## Assumptions

- A-1 **(unconfirmed)** The kit is a new pack, `devkit-compozy`, at `plugins/compozy/`, with
  `.claude-plugin/plugin.json`, a `README.md` carrying the catalog markers and an entry in
  `.claude-plugin/marketplace.json`. A project installs it only when it runs CompozyOS, so a project
  that does not never pays for its skill descriptions.
- A-2 **(unconfirmed)** The design gate reads the screen map and the mockup from paths the project
  declares in `openspec/config.yaml` (a new `design:` block with `screen_map:` and, optionally,
  `mockup:`), not from a path the kit fixes. A project with no `design:` block has no screens, and
  the gate is a no-op for it. The only format the gate requires of the screen map is a row per
  screen whose first cell is the screen id, and a line starting with `Mockup:` that carries a
  version or a date. `chacal88/whatsapp-platform`'s `docs/design/2b-screen-map.md` already satisfies
  both.
- A-3 **(unconfirmed)** The plan declares which screens a change touches: `proposal.md` lists the
  screen ids, and the loop's `propose` node returns them in a `screens` array. An empty array skips
  the design branch and the demo branch; the owner sees the list in the same review in which they
  approve the plan.
- A-4 **(unconfirmed)** The demo runs a command the project owns (a new `demo_command` loop input),
  against a base URL the project gives (`demo_url`). The kit ships an example Playwright script in
  its templates and a skill that states the matrix and the file names. An empty `demo_command` skips
  the demo, which is this repository's case: the devkit has no browser surface.
- A-5 The kit is files under the pack plus a `compozy-setup` skill that installs them into a project
  as `.compozy/` (roles, loop, config, a resolver for the devkit checkers). It does not publish the
  loop to the daemon: publishing stays `compozy loop create --fork-from-name`, run by the operator.
- A-6 This repository adopts version 2 for itself in this change: its `.compozy/` is regenerated
  from the kit's templates, differing only by the inputs it fills in. That is how the templates are
  proven before `chacal88/whatsapp-platform` takes them.
- A-7 The loop never waits on external work from a shell. Waiting on a pull request's checks and on
  its merge is a CompozyOS pull-request monitor registered by the agent that owns the step; the
  gates that follow only confirm the state that the wait reached.
- A-8 "Ends the sessions" is the loop's ordinary cell settlement; the kit's explicit cleanup is the
  worktree, and it runs only after the change reads `archived`.
- A-9 The merge stays the owner's unless `openspec/config.yaml` says `ship: merge`, in which case
  GitHub merges at 8/8 (ADR 0002). The loop never merges by hand in either mode.

## Acceptance criteria

- AC-1 (`kit-pack`): a pack `devkit-compozy` exists under `plugins/compozy/` with its
  `plugin.json`, a `README.md` whose catalog markers are filled, and an entry in
  `.claude-plugin/marketplace.json`; `python3 scripts/gen-catalog.py --check`, `python3 scripts/check.py`
  and `claude plugin validate .` all pass on it.
- AC-2 (`loop-shape`): the shipped loop template declares, in this order, `propose`, the plan
  validation gate, the design branch, `implement`, `review`, the verify gate, the demo branch,
  `deliver`, the CI wait and its gate, the merge wait, `archive` and the worktree cleanup; every
  human decision is a `review` block or a `human` gate criterion, every automated gate criterion is
  `command`, and the definition has no `agent-judge` criterion and no `goal` node.
- AC-3 (`design-gate`): with a plan that declares at least one screen id, the loop runs the design
  node and then a command gate; with an empty `screens` array both the design node and the demo node
  are skipped and `implement` still runs. Proven on the template by a test that reads the graph, and
  by a `compozy loop validate` of the filled template.
- AC-4 (`screens-check`): the kit's `screens-check` script exits 0 only when every screen id the
  change declares appears in the project's configured screen map and that map carries a `Mockup:`
  line with a version or a date; it exits non-zero naming the ids or the missing mockup version, and
  exits 3 on a setup error (no `design:` block, unreadable map, unknown change).
- AC-5 (`ci-green`): the template has a step after `deliver` whose prompt tells the agent to wait on
  the pull request with a CompozyOS pull-request monitor and fix until the check is green, and a
  command gate after it that fails while a required check is not successful. No step of the template
  waits with `sleep`, `gh pr checks --watch`, `gh run watch` or a polling loop.
- AC-6 (`demo-contract`): for a change with screens, the demo step writes under
  `openspec/changes/<id>/evidence/` one screenshot per declared screen for each theme (light and
  dark) and each width (desktop and phone) plus one video of the journey, and `deliver` links that
  folder from the pull request body. Proven before the pull request by the example script's naming
  and by the skill and template text; the first real run is a workflow follow-up.
- AC-7 (`archive-cleanup`): after the merge the template runs the `ship-change` archive steps, then
  removes the worktree, and its `definition_of_done` keeps the sentence that a task the owner
  deferred by a dated decision in `tasks.md` counts as done. The cleanup node runs only after the
  change reads `archived`.
- AC-8 (`portable-hooks`): every template calls the devkit checkers through the kit's resolver,
  which finds them in a repository checkout, in an installed `devkit-openspec`, or at `$DEVKIT_HOOKS`;
  no shipped template holds a path that only exists in one repository.
- AC-9 (`repo-adopts`): this repository's `.compozy/` is regenerated from the kit's templates and
  differs from them only by the values the setup fills in; the four role shells it installs are the
  shipped ones.
- AC-10 (`release-ready`): every changed pack is bumped in its `plugin.json` and in
  `marketplace.json`, `CHANGELOG.md` gains its line, `docs/catalog.md` is regenerated, and the
  documentation names the kit in `docs/` and in the root `README.md`.

## Out of scope

- `chacal88/whatsapp-platform` adopting the kit: the brief puts it right after this change.
- Publishing the loop to the CompozyOS daemon (`compozy loop create`), authoring Goals, heartbeats,
  the `lead` role of the pilot, automations and the panel.
- Any change to the devkit flow itself: `deliver-check`, `conduct-check`, `guard.mjs`, the schemas,
  the reviewer agents and `review-change` stay as they are. The kit only calls them.
- Producing a real demo recording in this repository: it has no browser surface.
- A screen map or a mockup for this repository.
