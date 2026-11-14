# Tasks

Change: `compozy-loop-v2` · Date: 2026-11-14 · Owner: Kaue (chacal88)

Work only in this change's worktree, on branch `compozy-loop-v2`.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, and `pr-verifier` copies each part verbatim into its
Gates table, so no part holds a `|`. The desktop app's bundled Claude Code (the only one with
`plugin validate` accepting this repository) is named without its version, as `CONTRIBUTING.md`
says:
"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"

Gate 7.6 holds the guard suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about 13
minutes), so it runs as a background Bash, never as a foreground tool call, which stops at 600 s.
This change touches no hook, so that suite runs once, at the end, as the regression net.

`compozy loop validate` exits 0 even when it reports `"valid": false`, so it is never a gate part on
its own (design D-risks). The loop-template test of 2.7 runs it, asserts `valid: true`, and skips
that assertion when the CLI or the daemon is absent.

The acceptance criteria carry the ids `deliver-check` item 4 reads (`AC-<n>`, from the
`## Acceptance criteria` section of `proposal.md`), each with its slug. A test that proves a
criterion starts its name with the id and the slug (`AC-4 screens-check: ...`). `pr-verifier` writes
one row per id, AC-1 to AC-10, and a row's cells name no other `AC-<n>` id (a cross-reference goes by
slug).

Plain bullets under `## Workflow follow-up` are not tasks: `deliver-check` counts every checkbox of
this file. A task the owner defers is kept checked with a dated decision on its line, as the loop's
definition of done says.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `kit-pack` | 1.1, 1.2, 7.3, 7.5, 7.6 |
| AC-2 | `loop-shape` | 2.1, 2.2, 2.5, 2.6, 2.7, 2.8 |
| AC-3 | `design-gate` | 2.3, 2.7, 4.2, 4.3, 4.5 |
| AC-4 | `screens-check` | 4.2, 4.3, 4.5 |
| AC-5 | `ci-green` | 2.5, 2.7, 3.2, 2.8 |
| AC-6 | `demo-contract` | 2.4, 5.1, 5.2, 5.3, 5.4, 5.5 |
| AC-7 | `archive-cleanup` | 2.1, 2.6, 2.7, 3.2 |
| AC-8 | `portable-hooks` | 1.5, 1.6, 2.1, 6.2 |
| AC-9 | `repo-adopts` | 1.3, 6.1, 6.2, 6.3, 6.4, 6.5 |
| AC-10 | `release-ready` | 7.1, 7.2, 7.3, 7.4, 7.5, 7.6 |

## 1. The pack and the resolver (AC-1, AC-8)

Answers OD-1. A different answer (the kit as a skill inside `devkit-openspec`) moves the
`plugins/compozy/` prefix of every file this change creates, in all seven phases, and changes 7.3
and 7.5; no file's content changes, and that pack's version and tag are then part of 7.3. Make the
move before 1.1 rather than after any later phase.

- [x] 1.1 Create `plugins/compozy/.claude-plugin/plugin.json`: `name: devkit-compozy`,
  `version: 0.1.0`, a one-sentence description naming the CompozyOS delivery loop over the devkit
  flow, `keywords`, and the same `author`, `license`, `homepage` and `repository` the other packs
  carry.
- [x] 1.2 Create `plugins/compozy/README.md` following the shape of `plugins/design/README.md`: what
  the kit is, the install line, the stage diagram of the loop (propose → plan gate → design →
  implement → review → verify → demo → deliver → CI → merge → archive → cleanup), what a project
  must provide (`verify_command`, optionally `demo_command`, `demo_url` and a `design:` block), and
  an `## Assets` section holding the `<!-- catalog:begin -->` / `<!-- catalog:end -->` markers,
  empty for now (7.5 fills them).
- [x] 1.3 Write `plugins/compozy/skills/compozy-setup/templates/substitutions.json`: the one place
  that names every placeholder the templates carry (the change-independent ones: the agent names,
  `verify_command`, `demo_command`, `demo_url`, the timezone, the screen-map keys), each with its
  meaning and its default. `compozy-setup` reads it to fill the templates, and the adoption test of
  6.4 reads the same file to render them: one source, so neither can drift from the other.
- [x] 1.4 Write `plugins/compozy/skills/compozy-setup/SKILL.md`: frontmatter `name: compozy-setup`
  and a description that says what it installs and the phrases a user would say. Body: the install
  procedure (write `.compozy/` with `config.toml`, `README.md`, `agents/<role>/AGENT.md` for the
  four roles, `loops/openspec-change/loop.yaml`, `bin/devkit-kit`; add the `design:` block to
  `openspec/config.yaml` only when the project has screens), what it never does (publish the loop —
  that is the operator's `compozy loop create --fork-from-name` — start a run, or write product
  code), and how to re-run it over an existing `.compozy/`.
- [x] 1.5 Write the resolver `plugins/compozy/skills/compozy-setup/templates/bin/devkit-kit` (POSIX
  `sh`, executable): resolve the hooks directory in the order `$DEVKIT_HOOKS`, a repository checkout
  (`plugins/openspec/hooks/` walking up from the caller's directory), then the installed
  `devkit-openspec` under the Claude Code plugins directory with the highest `version` in its
  `.claude-plugin/plugin.json`, compared field by field as integers (not by directory name, not by
  modification time), the lexicographically last path winning a tie; forward the first argument
  (`deliver-check`, `conduct-check` or `screens-check`) with the remaining arguments to the matching
  script; exit 3 naming the three paths it tried when none resolves, and exit 3 on an unknown
  subcommand. `screens-check` resolves inside this pack, not in `devkit-openspec`.
- [x] 1.6 Write `plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs` over temporary
  directories: `AC-8 portable-hooks: ...` covering each of the three sources winning in order, the
  argument pass-through and the exit code of the resolved script, exit 3 with the three paths when
  nothing resolves, and exit 3 on an unknown subcommand. One scenario per rule of 1.5's tie-break:
  two installed copies where the higher `version` is the older directory and the alphabetically
  earlier name (so neither mtime nor directory order can pass by accident), `0.13.0` beating `0.9.0`
  (so the comparison is by integer field, not by string), and two copies at the same version, where
  the lexicographically last path wins.
- [x] 1.7 Gate: `node --test plugins/compozy/skills/compozy-setup/scripts/devkit-kit.test.mjs && python3 scripts/check.py`

## 2. Loop v2, the shipped template (AC-2, AC-3, AC-5, AC-6, AC-7, AC-8)

Answers OD-3. A different answer (a checker inferring the screens, or a loop input) changes the
`propose` output schema of 2.2, both branch conditions of 2.3 and 2.4, the `tech-lead` rule of 3.1
and what `screens-check` reads in 4.2 and 4.3 — phases 2 to 4. The graph, the gates and the branch
shape stay as they are.

The file is `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml`. Design
D2 fixes the node ids, the order and the edges; the validated probe is the reference.

- [x] 2.1 Header, inputs and contract: `apiVersion: compozy.loop/v1`, `meta` with `name`,
  `description` and `catalog`; inputs `change_id`, `brief`, `schema`, `verify_command`,
  `demo_command` (default empty), `demo_url` (default empty) and the four agent inputs `planner`,
  `implementer`, `reviewer`, `designer`; `contract` with `goal`, a `definition_of_done` that ends at
  the archived change and keeps the sentence that a task the owner deferred by a dated decision in
  `tasks.md` counts as done, the three constraints of version 1, `iteration_cap: 3`, and
  `verification` as one `command` over `inputs` only that the change's archived folder is on
  `origin/<base>` (design D8). Every checker call in this file goes through
  `.compozy/bin/devkit-kit` (design D9).
- [x] 2.2 The five kept nodes, with the pilot's ids, prompts and output schemas: `propose` (its
  `output_schema` gains a required `screens` array of strings, documented as the ids of
  `proposal.md`'s `## Screens`), `approve_plan`, `implement` (its `review` block now also shows the
  design output, guarded with `{{ if ... }}`), `review` and `verify` (its `deliver_check` criterion
  now reads `.compozy/bin/devkit-kit deliver-check --ci`).
- [x] 2.3 The design branch: `touches_screens` (`class: control`, `kind: branch`,
  `condition: "size(nodes.propose.output.screens) > 0"`), `design` (`run-agent` on `designer`,
  output `screens`, `mockup`, `mockup_version`, `worktree_path`) and `screens_ok` (gate, one
  `command` criterion running `.compozy/bin/devkit-kit screens-check --change <id>` inside the
  worktree, `on_result.fail: next_generation`).
- [x] 2.4 The demo branch: `has_demo` (branch on the same list and a non-empty `demo_command`) and
  `demo` (`run-agent` on `designer`, prompt naming the `screen-demo` skill, `demo_command` and
  `demo_url`; output `evidence_dir`, `shots`, `video`). `deliver`'s prompt links
  `openspec/changes/<id>/evidence/` from the pull-request body when the demo ran.
- [x] 2.5 The pull-request stages: `deliver` (kept, with its `review` block), `ci_fix` (`run-agent`
  on `implementer`, prompt: register a CompozyOS pull-request monitor on the pull request, fix until
  the check is green, never wait with `sleep`, `gh pr checks --watch`, `gh run watch` or a polling
  loop), `checks_green` (gate, `gh pr checks <url> --required`, `on_result.fail: escalate`),
  `await_merge` (`run-agent`, the same monitor until the pull request merges) and `merged` (gate,
  `gh pr view <url> --json state --jq .state` piped to `grep -qx MERGED`; the `| shellQuote` value
  stays outside every authored quote, or the compiler rejects it as
  `unsafe_command_interpolation`).
- [x] 2.6 The end: `archive` (`run-agent`, the `ship-change` archive steps, output `archived`,
  `worktree_path`, `archive_pr`), `cleanup` (`class: action`, `kind: compozy__worktree_remove`,
  `params.path` from `archive`'s output, `on_error: { allow_fail: true }`), and the eighteen edges
  of design D2 including the two skip edges `approve_plan → implement` and `verify → deliver`.
- [x] 2.7 Write `plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs`:
  `AC-2 loop-shape: ...` asserts the node ids, their order and the eighteen edges, that every gate
  criterion is `command`, that no criterion is `agent-judge` and no node is a `goal`, and that the
  two `review` blocks carry `responders: { agents: deny }`; `AC-3 design-gate: ...` asserts both
  branch conditions and that `implement` and `deliver` each have a second incoming edge that skips
  the optional stage; `AC-5 ci-green: ...` asserts the `ci_fix` prompt names a pull-request monitor
  and that no node text contains `sleep `, `--watch`, `gh run watch` or `until `;
  `AC-7 archive-cleanup: ...` asserts the cleanup node, its `allow_fail` and the deferred-task
  sentence in `definition_of_done`. Last, when `compozy` is on `PATH` and answers, run
  `compozy loop validate --file <template> -o json` and assert `valid: true`; skip that assertion
  otherwise.
- [x] 2.8 Gate: `node --test plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs && python3 scripts/check.py`

## 3. The four role shells and the project skeleton (AC-5, AC-7, AC-9)

Thin shells: they name the devkit assets they call and the rules that bind them, and duplicate no
rule that already lives in `CLAUDE.md`, `openspec/config.yaml` or a devkit skill. They go under
`plugins/compozy/skills/compozy-setup/templates/agents/<role>/AGENT.md`, not in `plugins/<pack>/agents/`:
they are CompozyOS roles, not Claude Code agents.

- [x] 3.1 `tech-lead/AGENT.md`: the pilot's shell, project-agnostic (no path from one repository: the
  checkers through `.compozy/bin/devkit-kit`), plus one rule — list in `proposal.md`'s `## Screens`
  every screen the change touches, and return the same ids in the structured result; no screen means
  an empty list, never a guess.
- [x] 3.2 `dev/AGENT.md`: the pilot's shell, project-agnostic, plus: after the pull request is open,
  wait on it with a CompozyOS pull-request monitor and fix until the check is green — never `sleep`,
  `gh pr checks --watch`, `gh run watch` or a polling loop; after the merge run the `ship-change`
  archive steps; never merge by hand, whatever the ship mode.
- [x] 3.3 `qa/AGENT.md`: the pilot's shell, project-agnostic, keeping the rule that a task the owner
  deferred by a dated decision in `tasks.md` is not a finding, and the blocking-issue list.
- [x] 3.4 `design/AGENT.md`, new: reads the project's screen map and mockup (from the `design:` block
  of `openspec/config.yaml`), and for the screens the change declares either confirms they are
  mapped with a versioned mockup or proposes them — `screen-design` writes
  `openspec/changes/<id>/mock/screens.md` and the screen-map rows, committed on the change branch;
  `screen-demo` records the evidence. It writes no product code, no test and no spec, and it never
  approves its own proposal.
- [x] 3.5 Write `templates/config.toml` (the workspace overlay: default agent, provider,
  `permissions.mode`, skills sources, timezone placeholder) and `templates/README.md` (the project's
  `.compozy/README.md`: the roles table, the stage line of the loop, and the one command that starts
  a run), both with the placeholders `compozy-setup` fills.
- [x] 3.6 Write `plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs`:
  `AC-9 repo-adopts: ...` asserts each of the four shells has the frontmatter keys the daemon reads
  and a body; `AC-5 ci-green: ...` asserts the `dev` shell names the monitor and forbids the four
  polling forms; `AC-7 archive-cleanup: ...` asserts the `qa` shell keeps the deferred-task rule and
  the `dev` shell the archive steps; and that no shell contains a path specific to one repository.
- [x] 3.7 Gate: `node --test plugins/compozy/skills/compozy-setup/scripts/role-shells.test.mjs && python3 scripts/check.py`

## 4. The design gate (AC-3, AC-4)

Answers OD-2. A fixed-path answer changes how 4.2 resolves the map and its fixtures in 4.3, and the
passages that document it in 1.4, 3.4 and 4.4 — one function and four texts, across phases 1, 3
and 4.

- [x] 4.1 Write `plugins/compozy/skills/screen-design/SKILL.md`: how to read a screen map and its
  mockup version, what a proposed row must carry (id, screen, what it shows and allows, the stage,
  the level of detail in the mockup), that the rows land on the change branch so map and code merge
  together, and that the owner approves plan and design in the same review, before any code.
- [x] 4.2 Write `plugins/compozy/skills/screen-design/scripts/screens-check.mjs`
  (`--change <id> [--json]`): read the `design:` block of `openspec/config.yaml` (`screen_map:`,
  optional `mockup:`), the change's `proposal.md` `## Screens` list and the map. Exit 0 when every
  declared id is the first cell of a row of the map and the map holds a line starting with `Mockup:`
  carrying a version or an ISO date; exit 1 naming the missing ids or the missing version; exit 3 on
  a setup error (unknown change, unreadable map, a `design:` block pointing nowhere). No
  `## Screens` section, or no `design:` block, is exit 0: a project without a UI is a no-op.
- [x] 4.3 Write `plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs` over fixtures:
  `AC-4 screens-check: ...` for every id mapped (0), one id missing (1, named), a map with no
  `Mockup:` version (1), no `## Screens` (0), no `design:` block (0), an unreadable map (3), an
  unknown change (3), and the `--json` shape; `AC-3 design-gate: ...` for a fixture shaped like the
  screen map of a real project, proving the format the gate requires is the one already written.
- [x] 4.4 Extend `compozy-setup/SKILL.md` (written in 1.4) and `plugins/compozy/README.md` with the `design:` block:
  its two keys, where it goes in `openspec/config.yaml`, and the two things the map must carry. The
  devkit's own `openspec-setup` template is not touched, so `devkit-openspec` keeps its version and
  this release creates no tag.
- [x] 4.5 Gate: `node --test plugins/compozy/skills/screen-design/scripts/screens-check.test.mjs && python3 scripts/check.py`

## 5. The demo (AC-6)

Answers OD-4, the smallest of the four decisions, but not a single-phase one: the "ship a finished
runner" answer changes 5.2 and 5.3 here and the `demo` prompt of task 2.4 in phase 2, and nothing
else.

- [x] 5.1 Write `plugins/compozy/skills/screen-demo/SKILL.md`: the matrix (themes light and dark ×
  widths desktop 1440×900 and phone 390×844), the file names
  `evidence/<screen-id>-<theme>-<width>.png` and `evidence/journey.webm` under
  `openspec/changes/<id>/`, that the journey video is short and covers the change's path through the
  screens, that the folder is linked from the pull-request body, and that an empty `demo_command`
  means the project has no demo and the step is skipped.
- [x] 5.2 Write the naming helper `plugins/compozy/skills/screen-demo/scripts/evidence-names.mjs`:
  pure functions from a change id and a screen id to the eight paths (four combinations, both
  themes) and to the video path, with the two viewport sizes as exported constants.
- [x] 5.3 Write the example spec `plugins/compozy/skills/screen-demo/templates/demo/screens.spec.ts`:
  a Playwright spec that takes the screen list and the base URL from the environment, loops the two
  themes and the two widths, writes each screenshot under the evidence folder with the name of 5.2,
  and records one video of the journey. It is an example a project copies and adapts, stated as such
  in its header.
- [x] 5.4 Write `plugins/compozy/skills/screen-demo/scripts/evidence-names.test.mjs`:
  `AC-6 demo-contract: ...` asserts the eight paths and the video path for a change and two screens,
  the two viewport constants, and that the shipped spec text declares both themes, both widths, the
  video and the same name pattern.
- [x] 5.5 Gate: `node --test plugins/compozy/skills/screen-demo/scripts/evidence-names.test.mjs && python3 scripts/check.py`

## 6. This repository adopts version 2 (AC-9)

- [x] 6.1 Replace `.compozy/loops/openspec-change/loop.yaml` with the template filled for this
  repository: `verify_command` as today
  (`python3 scripts/gen-catalog.py --check && python3 scripts/check.py`), `demo_command` and
  `demo_url` empty, the four agent defaults.
- [x] 6.2 Replace `.compozy/agents/{tech-lead,dev,qa}/AGENT.md` with the shipped shells, add
  `.compozy/agents/design/AGENT.md`, and install `.compozy/bin/devkit-kit` (executable). Keep each
  shell's `appearance` block; the `design` role gets its own icon and the same colour.
- [x] 6.3 Update `.compozy/config.toml` and `.compozy/README.md` from the templates: the roles table
  gains `design`, and the stage line becomes the twelve stages of version 2. No `design:` block is
  added to `openspec/config.yaml`: this repository has no screens.
- [x] 6.4 Write `plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs`:
  `AC-9 repo-adopts: ...` renders each template with this repository's values, read from the
  substitution map of `templates/substitutions.json` (task 1.3), the same file `compozy-setup` reads
  to install them, and asserts the rendered text equals the installed file byte for byte — a render-then-compare, never a
  line-by-line heuristic — and that the four role shells are the shipped ones.
- [x] 6.5 Gate: `node --test plugins/compozy/skills/compozy-setup/scripts/adoption.test.mjs && python3 scripts/check.py`

## 7. Documentation and release (AC-1, AC-10)

- [x] 7.1 Write `docs/compozy-kit.md`: what the kit is, the twelve stages with who runs each and
  which gate follows, the two optional branches and what turns them on, what a project must provide,
  how to adopt it (`compozy-setup`, then the operator's `compozy loop create --fork-from-name` and
  `compozy loop run`), and how it relates to `/conduct` (two ways to drive the same flow).
- [x] 7.2 Link it: a row in the table of `CLAUDE.md`, a line in `README.md` (and its pack-count
  sentence, which says five packs today), the `compozy` row in the pack table of
  `docs/conventions.md`, and a pointer from `docs/openspec-flow.md` next to the `/conduct` section.
- [x] 7.3 Add `devkit-compozy` to `.claude-plugin/marketplace.json` (source `./plugins/compozy`,
  version `0.1.0`, category `development`, the description of 1.1) and bump the marketplace
  `metadata.version` to `0.17.0`. No other pack changes version.
- [x] 7.4 Add the `CHANGELOG.md` entry for the release: the new pack and what the loop gained.
- [ ] 7.5 Run `python3 scripts/gen-catalog.py` to fill `plugins/compozy/README.md`'s catalog markers
  and regenerate `docs/catalog.md`.
- [ ] 7.6 Gate: `python3 scripts/gen-catalog.py --check && python3 scripts/check.py && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate . && node --test plugins/openspec/hooks/guard.test.mjs`

## Workflow follow-up

- After the merge: `chacal88/whatsapp-platform` adopts the kit with `compozy-setup`, declares its
  `design:` block over `docs/design/2b-screen-map.md`, and runs the first change with screens. The
  first real design gate and the first recorded demo are observed there and written into `retro.md`.
- After the merge: no tag. This release changes no `devkit-openspec` version (`CONTRIBUTING.md`).
