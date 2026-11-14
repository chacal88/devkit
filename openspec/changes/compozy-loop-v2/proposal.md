# Proposal

Change: `compozy-loop-v2` · Date: 2026-11-14 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`requirements.md` holds the operator's brief and the assumptions; four of them are unconfirmed and
repeated under "Open decisions")

Summary: the CompozyOS delivery loop the pilot ran by hand becomes a devkit pack, `devkit-compozy`,
that any project installs; version 2 of the loop adds a design gate before code, a demo step, a wait
on the pull request's checks and the archive and cleanup after the merge.

## Why

The `.compozy/` skeleton that sequences the devkit flow exists twice, hand-copied: once here and
once in `chacal88/whatsapp-platform`, already drifted (the two `loop.yaml` differ in eleven places).
Nothing ships it, so a third project starts from a copy of a copy, and the two copies call the devkit
checkers through `plugins/openspec/hooks/...`, a path that exists only in this repository.

The pilot also showed what the loop is missing. Code was written for screens that the project's
screen map did not describe yet, so the owner reviewed pixels after the implementation instead of
before it. Nothing proved a screen change visually before the pull request. And the loop ended at
"a pull request is open": the red check, the merge, the archive and the leftover worktree were all
the owner's, by hand, in another session.

## What Changes

- **A new pack, `devkit-compozy`** (`plugins/compozy/`): a `compozy-setup` skill that installs
  `.compozy/` into a project (the four role shells, the loop, `config.toml`, a resolver for the
  devkit checkers), plus the two skills the new role calls, `screen-design` and `screen-demo`.
- **A portable resolver** (`.compozy/bin/devkit-kit`): every shipped template calls the devkit
  checkers through it. It finds them at `$DEVKIT_HOOKS`, in a repository checkout, or in the
  installed `devkit-openspec`, so no template carries a path from one repository.
- **Loop v2**, shipped as the template `loops/openspec-change/loop.yaml`:
  - a **design gate** between the approved plan and implementation. The plan names the screen ids
    the change touches; when the list is empty the design node and the demo node are skipped and
    implementation starts as before. When it is not, the design role proposes the screen-map rows
    and a mockup with a version, a command gate (`screens-check`) refuses while a declared screen is
    not in the map or the map has no mockup version, and the owner approves plan and design in the
    one review that precedes any code;
  - the review bench and the `pr-verifier` stay a **run-agent step followed by a command gate**
    (the project's focused check and `deliver-check --ci` inside the worktree). The definition
    carries no `agent-judge` criterion and no `goal` node;
  - a **demo step** for changes with screens: Playwright screenshots of every declared screen in
    both themes and in the desktop and phone widths, plus a short video of the journey, under
    `openspec/changes/<id>/evidence/`, linked from the pull request body;
  - after the pull request, the implementer **waits on the check with a CompozyOS pull-request
    monitor** and fixes until it is green, and a command gate confirms it;
  - after the merge (the owner's, or GitHub's in `ship: merge`), the loop runs the **`ship-change`
    archive steps**, then removes the worktree. A task the owner deferred by a dated decision in
    `tasks.md` still counts as done for the finish line.
- **This repository adopts version 2**: its `.compozy/` is regenerated from the templates and
  differs from them only by the inputs it fills in. That is how the templates are proven.
- **Docs and release**: a kit page under `docs/`, the pack row in `docs/conventions.md`, the
  marketplace entry, the regenerated catalog and a `CHANGELOG.md` line. `devkit-openspec` is not
  touched, so this release creates no tag (`CONTRIBUTING.md`).

Non-goals (`requirements.md`, Out of scope): `chacal88/whatsapp-platform` adopting the kit;
publishing the loop to the daemon; the pilot's `lead` role, heartbeats and automations; any change
to `deliver-check`, `conduct-check`, `guard.mjs`, the schemas or the reviewer agents; a real demo
recording or a screen map for this repository.

## Screens

None. This repository has no browser surface, so the change declares no screen id: the design branch
and the demo branch of its own run are skipped, which is also the first proof that the skip works.

## Acceptance criteria

- AC-1 (`kit-pack`): a pack `devkit-compozy` exists under `plugins/compozy/` with its `plugin.json`, a `README.md` whose catalog markers are filled, and an entry in `.claude-plugin/marketplace.json`; `python3 scripts/gen-catalog.py --check`, `python3 scripts/check.py` and `plugin validate .` all pass on it.
- AC-2 (`loop-shape`): the shipped loop template declares, in this order, `propose`, the plan validation gate, the design branch, `implement`, `review`, the verify gate, the demo branch, `deliver`, the CI wait and its gate, the merge wait, `archive` and the worktree cleanup; every human decision is a `review` block, every automated gate criterion is `command`, and the definition has no `agent-judge` criterion and no `goal` node.
- AC-3 (`design-gate`): with a plan that declares at least one screen id the loop runs the design node and then its command gate; with an empty `screens` list both the design node and the demo node are skipped and `implement` still runs.
- AC-4 (`screens-check`): `screens-check` exits 0 only when every screen id the change declares in `proposal.md` appears in the project's configured screen map and that map carries a `Mockup:` line with a version or a date; it exits 1 naming the missing ids or the missing version, and exits 3 on a setup error (unreadable map, unknown change, a `design:` block pointing nowhere).
- AC-5 (`ci-green`): the template has a step after `deliver` whose prompt tells the agent to wait on the pull request with a CompozyOS pull-request monitor and fix until the check is green, and a command gate after it that fails while a required check is not successful; no step of the template waits with `sleep`, `gh pr checks --watch`, `gh run watch` or a polling loop.
- AC-6 (`demo-contract`): the demo step and its skill state that, for a change with screens, `openspec/changes/<id>/evidence/` receives one screenshot per declared screen for each theme (light and dark) and each width (desktop and phone) plus one video of the journey, and that `deliver` links that folder from the pull request body; the shipped Playwright template produces exactly those names.
- AC-7 (`archive-cleanup`): after the merge the template runs the `ship-change` archive steps and then removes the worktree, the cleanup runs only after the change reads `archived`, and the `definition_of_done` keeps the sentence that a task the owner deferred by a dated decision in `tasks.md` counts as done.
- AC-8 (`portable-hooks`): every shipped template calls the devkit checkers through the kit's resolver, which finds them at `$DEVKIT_HOOKS`, in a repository checkout, or in an installed `devkit-openspec`; no shipped template holds a path that exists in only one repository.
- AC-9 (`repo-adopts`): this repository's `.compozy/` is regenerated from the kit's templates and differs from them only by the values the setup fills in, and `compozy loop validate` accepts the result.
- AC-10 (`release-ready`): the release adds `devkit-compozy` to `marketplace.json` with its version, bumps the marketplace version, adds the `CHANGELOG.md` line, regenerates `docs/catalog.md`, and the kit is named in `README.md`, `docs/conventions.md` and the new kit page.

## Open decisions

The owner answers these at the plan-approval review, before any code: the point at which they are
cheap, because no file exists yet. None of the four is confined to a single phase, and
`requirements.md` carries the table of what each one really costs. In short: OD-1 moves the path
prefix of every file the change creates and its registration (all seven phases, no content change);
OD-2 changes one function and four passages (phases 1, 3, 4); OD-3 reaches phases 2 to 4; OD-4 is
the smallest, phase 5 plus the `demo` prompt of task 2.4. None of the four changes the loop's graph,
its gates or these criteria.

- OD-1 (phase 1): the kit is a new pack `devkit-compozy`, not a skill inside `devkit-openspec`.
- OD-2 (phase 4): the design gate reads the screen map from a `design:` block in the project's
  `openspec/config.yaml`, not from a path the kit fixes.
- OD-3 (phase 2): the plan declares the screens (`proposal.md` `## Screens`, mirrored by the
  `propose` node's `screens` output), rather than a checker inferring them from the diff.
- OD-4 (phase 5): the demo runs a command the project owns (`demo_command`), with the kit shipping
  an example Playwright spec, rather than the kit imposing Playwright as a project dependency.

## Capabilities

### New Capabilities

None as spec deltas. `openspec list --specs` reports no specs: this repository keeps no
`openspec/specs/`, pins behaviour with tests, and every archived change set `skip_specs: true`, so
this one does too (`.openspec.yaml`). The acceptance criteria above are the behaviour, and the
contract the kit publishes is the shape of the shipped templates: the loop's node ids and order, the
`propose` output schema, the `screens-check` exit codes and the evidence file names.

### Modified Capabilities

None.

## Impact

- New: `plugins/compozy/` (`plugin.json`, `README.md`, `skills/compozy-setup/`,
  `skills/screen-design/`, `skills/screen-demo/`, their `templates/` and `scripts/` with tests).
- Changed: `.claude-plugin/marketplace.json`, `CHANGELOG.md`, `docs/catalog.md` (generated),
  `docs/conventions.md`, `README.md`, a new `docs/compozy-kit.md`, and this repository's
  `.compozy/` (loop, the four roles, `config.toml`, `README.md`, `bin/devkit-kit`).
- Untouched: `plugins/openspec/` and `plugins/core/`. No pack of the devkit flow is bumped, so this
  release creates no tag.
- Other projects: nothing changes until they install the new pack. A project already running the
  pilot's hand-copied `.compozy/` keeps working; adopting the kit replaces those files.
- Dependencies: none new in this repository. A project that wants the demo supplies its own
  Playwright and a `demo_command`.
- Exit criteria, green at the pull-request head: `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, the bundled binary's `plugin validate .`,
  `node --test plugins/openspec/hooks/guard.test.mjs`, and the tests of the three new skills.
- Decisions cited: ADR 0001 (the gates stay in the checkers, not in a harness), ADR 0002 (the ship
  mode decides the merge; the loop never merges by hand), ADR 0004 (the devkit is installed per
  project, which is why the kit is a pack), ADR 0008 (the review round is unchanged). No ADR
  changes; `design.md` D12 records why no new ADR is needed.
- Workflow follow-up (after the merge, not an acceptance criterion): the first real demo run and the
  first design gate happen in `chacal88/whatsapp-platform`, which adopts the kit next; the result is
  recorded in `retro.md`.
