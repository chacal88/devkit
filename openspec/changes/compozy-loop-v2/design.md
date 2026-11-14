# Design

Change: `compozy-loop-v2` · Date: 2026-11-14 · Owner: Kaue (chacal88)

## Context

The pilot's loop is `.compozy/loops/openspec-change/loop.yaml`: six nodes (`propose`,
`approve_plan`, `implement`, `review`, `verify`, `deliver`), two human reviews written as `review`
blocks on `implement` and `deliver`, and two command gates. It ends when a pull request is open.
`chacal88/whatsapp-platform` holds a second copy that already differs in eleven places; both call
`node plugins/openspec/hooks/deliver-check.mjs`, which resolves only inside this repository.

What the loop grammar allows was checked against the compiler before this design was written, with
`compozy loop validate --file` on a probe carrying the full version-2 graph:

- a `branch` node with a CEL condition (`size(nodes.propose.output.screens) > 0`) and fan-in that
  keeps a node runnable when one of its two incoming paths was skipped;
- `review` blocks with `responders: { agents: deny }` on action nodes;
- gates whose criteria are all `command`, with `on_result.fail` set to `next_generation` or
  `escalate`;
- an action node whose `kind` is the literal tool id `compozy__worktree_remove`, with
  `on_error: { allow_fail: true }`;
- `contract.verification` as a command over `inputs` only.

The probe validated clean. One rejection taught the only non-obvious rule: a `| shellQuote` value
inside authored shell quotes is `unsafe_command_interpolation`, so the merge check is written
`gh pr view {{ ... | shellQuote }} --json state --jq .state | grep -qx MERGED`, never
`test "$(...)" = MERGED`.

Three facts constrain the kit. The devkit checkers live at a path that depends on how the devkit was
installed. `openspec validate <id> --strict` stops working the moment the change is archived, so it
cannot be the loop's own definition of done. And the daemon refuses blank-canvas Loop authoring:
publishing is `compozy loop create --fork-from-name`, which is the operator's act, not the kit's.

## Goals / Non-Goals

**Goals:**

- One source for the loop, the four role shells and the skills they call, installed by a skill.
- A design gate that costs nothing for a change without screens and refuses code for a change whose
  screens are not in the project's map with a versioned mockup.
- The loop reaches `archived` on its own: the red check, the merge, the archive and the worktree.
- Every shipped file is project-agnostic: no path, stack or command from one repository.

**Non-Goals:**

- Changing the devkit flow. `deliver-check`, `conduct-check`, `guard.mjs`, the schemas and the
  reviewer agents are consumed, not edited.
- Publishing or running the loop from the kit. The operator publishes and starts it.
- Making this repository demo-capable, or giving it a screen map.
- The pilot's `lead` role, its heartbeat, automations and the panel.

## Decisions

**D1 — The kit is a pack, `devkit-compozy` at `plugins/compozy/`.** (OD-1, unconfirmed.)
A project installs it only when it runs CompozyOS, so a project that does not never pays for its
skill descriptions on every turn, which is the stated reason the devkit is split into packs
(`docs/conventions.md`, ADR 0004). *Alternatives:* a `compozy-setup` skill inside `devkit-openspec`,
rejected because every OpenSpec project would carry three CompozyOS skill descriptions it never
uses; a `kits/` folder outside `plugins/`, rejected because it would appear in neither the
marketplace nor the catalog, which is how a project discovers the devkit.

**D2 — The graph: seventeen nodes, eighteen edges.** In order: `propose` → `approve_plan` →
`touches_screens` → `design` → `screens_ok` → `implement` → `review` → `verify` → `has_demo` →
`demo` → `deliver` → `ci_fix` → `checks_green` → `await_merge` → `merged` → `archive` → `cleanup`,
with the two skip edges `approve_plan → implement` and `verify → deliver`. Node ids are snake_case,
as the grammar requires. The first six nodes keep the pilot's ids, prompts and output schemas, so a
project moving from version 1 reads a diff, not a rewrite.

**D3 — The design branch, and why the skip edge is what makes it free.** `touches_screens` is a
`branch` on `size(nodes.propose.output.screens) > 0`. Its exclusive descendants `design` and
`screens_ok` are marked `branch_skipped` when the condition is false. `implement` has two incoming
edges — `screens_ok` and `approve_plan` — and fan-in runs it once every predecessor has *settled*,
a skip included, so a change with no screens reaches `implement` exactly as it does today. The same
shape gives the demo: `has_demo` branches on the same list (and on a non-empty `demo_command`), and
`deliver` joins `demo` with the skip edge from `verify`. *Alternative:* a `route` node with a
default path, rejected because fan-in already expresses "optional stage" with one fewer concept and
no ordered-match rule to get wrong.

**D4 — The owner approves plan and design in one review, on `implement`.** A `review` block is
evaluated *before* its node runs, which is exactly "before any code": the prompt carries the plan
summary, the open questions, and — when the design ran — the proposed screen rows and the mockup
version, and `reject` ends the run without code. *Alternatives:* a `human` criterion on a gate after
`design`, rejected because a gate cannot mix command and human criteria at runtime and the design
needs both the mechanical check and the owner; a `review` block on `design` itself, rejected because
it would ask the owner before the design exists.

**D5 — `screens-check` is the mechanical half of the design gate.** A Node script in the
`screen-design` skill. It reads the project's `openspec/config.yaml` `design:` block (`screen_map:`,
optional `mockup:`), the change's `proposal.md` `## Screens` section, and the map. Exit 0 when every
declared id appears as the first cell of a row of the map *and* the map carries a line starting with
`Mockup:` that holds a version or an ISO date; exit 1, naming what is missing; exit 3 for a setup
error (unreadable map, unknown change, a `design:` block pointing nowhere). No `## Screens` section,
or no `design:` block, means no screens: exit 0, so the check is a no-op for a project without a
UI. The map format it requires is the one `chacal88/whatsapp-platform` already writes.
*Alternatives:* a fixed path `docs/design/screen-map.md` (OD-2), rejected because the pilot project's
map is `docs/design/2b-screen-map.md` and renaming a reviewed document to adopt a kit is the wrong
cost; parsing the mockup itself, rejected because a mockup is a published artifact, not a file.

**D6 — The plan declares the screens.** (OD-3, unconfirmed.) `proposal.md` gains a `## Screens`
section listing the ids, and the `propose` node's `output_schema` gains a `screens` array that
mirrors it. The branch condition reads the node output; `screens-check` reads the file, so the gate
still works when a human or `/conduct` drives the change outside the loop. *Alternatives:* a checker
inferring the screens from the touched paths, rejected because it depends on a path convention the
kit cannot impose; a loop input, rejected because the owner would have to name the screens before a
plan exists.

**D7 — Waiting is a monitor, never a shell.** `ci_fix` and `await_merge` are `run-agent` nodes whose
prompts tell the agent to register a CompozyOS pull-request monitor and work while it is armed; the
CompozyOS runtime cannot observe a `sleep`, a `gh pr checks --watch` or a polling loop, and a turn
that waits that way never wakes. The gates that follow — `checks_green` (`gh pr checks <url>
--required`) and `merged` — only confirm the state the wait reached, in one non-blocking command.
`checks_green` and `merged` fail to `escalate`: the agent already looped on the fixes, so a failure
is a question for the owner, not a reason to replan the change from `propose`.

*Settled in phase 2, as `CONTRIBUTING.md` requires.* AC-5 says no step of the template waits with
`sleep`, `gh pr checks --watch`, `gh run watch` or a polling loop, and task 2.5 says the two
waiting prompts must forbid those four forms *by name* — so the forms appear in the file either
way. The test resolves this by scanning the only node text the engine itself executes, the gate
criteria's `check:` commands and `contract.verification`, and asserting separately that both
prompts carry the prohibition. A prohibition in prose and a command that waits are different
things, and only the second can block a turn.

**D8 — The loop ends at `archived`, and the cleanup can fail without failing the run.** `archive`
runs the `ship-change` archive steps (retro, the owner's answer per proposal, `openspec archive`,
the roadmap tick, the archive pull request). `cleanup` is an action node whose `kind` is the literal
tool id `compozy__worktree_remove`, with `path` from `archive`'s output and
`on_error: { allow_fail: true }`: the tool refuses a dirty worktree, and a refused cleanup after a
merged and archived change must not turn the run into a failure. `contract.verification` is
therefore not `openspec validate` — that stops resolving once the change is archived — but a
command over `inputs` only that the change's archived folder is on `origin/<base>`.

**D9 — One resolver for the devkit checkers.** `compozy-setup` installs `.compozy/bin/devkit-kit`, a
small shell script that resolves the hooks directory in this order: `$DEVKIT_HOOKS`; a repository
checkout (`plugins/openspec/hooks/`); the newest installed `devkit-openspec` under the Claude Code
plugins directory. It forwards `deliver-check`, `conduct-check` and `screens-check` with their
arguments, and exits 3 with the three paths it tried when it finds nothing. Every shipped template
calls `.compozy/bin/devkit-kit <checker>`. *Alternatives:* a `deliver_check_command` loop input
filled per project, rejected because a hard-coded plugin path rots at the next plugin update;
vendoring the checkers into `.compozy/`, rejected because a vendored copy drifts from the schema
that CI pins.

*Mechanics settled in phase 1, as `CONTRIBUTING.md` requires of a decision the design did not
state.* A plugin copy is matched by the `name` and `version` fields of its own
`.claude-plugin/plugin.json` plus a required sibling script, never by its directory name: the
marketplace checkout of this repository is folder-named `openspec`, not `devkit-openspec`, and only
matches by content. The plugins directory searched is `$CLAUDE_CONFIG_DIR/plugins`, falling back to
`$HOME/.claude/plugins` — the same variable Claude Code itself honours to relocate its config, so
the resolver needs no variable of its own and the tests point it at a temporary tree. And
`screens-check` names two sources in its exit-3 message, not three: it ships with this pack, so
`$DEVKIT_HOOKS` (which names the `devkit-openspec` hooks directory) does not apply to it, and
padding a third line for symmetry with `deliver-check` would name a source it never tried.

**D13 — The templates carry `__UPPER_SNAKE__` tokens, listed once in `substitutions.json`.** The
placeholder syntax is `__NAME__`, deliberately unlike the `{{ }}` CompozyOS itself evaluates inside
`loop.yaml` at run time: a reader can tell at a glance which braces the installer fills and which
the daemon does. `templates/substitutions.json` names the ten change-independent tokens — the four
agent ids (`__PLANNER__`, `__IMPLEMENTER__`, `__REVIEWER__`, `__DESIGNER__`, named after the loop's
own inputs and defaulting to the matching role shell), `__VERIFY_COMMAND__`, `__DEMO_COMMAND__`,
`__DEMO_URL__`, `__TIMEZONE__`, `__SCREEN_MAP__` and `__MOCKUP__` — each with its meaning and its
default. `compozy-setup` reads that file to install the templates and the adoption test of task 6.4
reads it to render them, so neither can drift from the other. *Alternative:* `{{ }}` for both,
rejected because the installer would have to know which braces are not its own.

**D10 — The design role owns both the design and the demo.** One new shell, `design`, calling two
skills: `screen-design` (propose the rows and the mockup version, write
`openspec/changes/<id>/mock/screens.md` and the screen-map rows, commit on the change branch) and
`screen-demo` (run the project's `demo_command` and file the evidence). Both are screen work on the
same change, and a separate "demo" role would be a shell with one instruction. The screen-map rows
land on the change branch, so the map and the code that implements it merge together and
`screens-check` reads the branch's map, not `main`'s.

**D14 — What "project-agnostic" removes from the pilot's shells.** (Settled in phase 3.) The three
pilot shells name paths that exist only here: `plugins/openspec/hooks/conduct-check.mjs`,
`python3 scripts/check.py`, `docs/openspec-flow.md`, `docs/conventions.md`, `docs/adr/`, and the
sentence "This repository is the devkit itself". The shipped shells keep the procedure and the
rules and name those documents by their role instead ("the project's own contributing guide, when
it keeps one"), reaching the checkers through `.compozy/bin/devkit-kit`. Two conventions survive by
name, because every project adopting this kit has them: `CLAUDE.md` and `openspec/config.yaml`. One
rule generalises rather than disappears: the pilot's "a changed pack gets its version bumped in
`plugin.json` and `marketplace.json` plus a `CHANGELOG.md` line" is the devkit marketplace's own
shape of a rule every project has, so the shipped `dev` shell says a changed package gets its
version bumped and a changelog entry under the project's own versioning convention, when it keeps
one. The role-shell test pins the removals as an explicit deny-list, so the next hand-edit that
pastes a path back fails.

**D11 — Evidence names, and why they are the testable part of the demo.** The demo writes
`openspec/changes/<id>/evidence/<screen-id>-<light|dark>-<desktop|phone>.png` — desktop 1440×900,
phone 390×844 — and one `evidence/journey.webm`; `deliver` links the folder from the pull-request
body. This repository has no browser surface, so no criterion claims a recorded run before the pull
request (`CONTRIBUTING.md`: a criterion states only what can be proven before the pull request).
What is proven is the contract: a pure naming helper with its own test, and the shipped Playwright
spec asserted to declare the two themes, the two widths and the video. The first real recording is a
workflow follow-up in the project that adopts the kit next. *Alternative (OD-4):* shipping a
finished Playwright runner and making the project install Playwright, rejected because the kit must
not impose a stack; the project supplies `demo_command` and `demo_url`, and an empty `demo_command`
skips the branch.

**D12 — No new ADR, and no ADR changes.** The kit sequences the existing flow and changes none of
its decisions: the gates still live in the checkers (ADR 0001), the ship mode still decides the
merge and the loop still never merges by hand (ADR 0002, ADR 0003), the devkit is still installed
per project, which is why the kit is a pack (ADR 0004), and the review round is untouched
(ADR 0008). `/conduct` (ADR 0006, ADR 0007) is the other way to drive the same flow and is not
changed; a project may use either. If the implementer finds a decision this design does not cover,
`CONTRIBUTING.md` applies: amend this file in the same phase, and raise an ADR rather than deviate
silently.

## Risks / Trade-offs

- **The four unconfirmed answers.** OD-1 to OD-4 are the plan's own open questions, and none of them
  is confined to a single phase. OD-1 moves the path prefix of every file the change creates, in all
  seven phases, without changing any file's content; OD-2 changes one function and four passages;
  OD-3 reaches phases 2 to 4; OD-4, the smallest, changes phase 5 and the `demo` prompt of task 2.4.
  `requirements.md` carries the table. What makes them safe to leave open is
  not a small blast radius but the moment they are answered: the owner answers before implementation
  starts, so a different answer is paid in the plan, not in written files. None of the four changes
  the graph of D2, the gates or the acceptance criteria.
- **`escalate` on a transient `gh` failure.** `checks_green` and `merged` run one `gh` command and
  send the run to the owner when it does not exit zero, so a network blip or an expired `gh` token
  parks the run on a question instead of retrying. That is the deliberate trade: the alternative,
  `next_generation`, would replan a change whose code is already merged. The owner resumes the run
  after fixing the credential; a retry policy on these two gates is a later refinement, not this
  change.
- **A gate that needs the daemon.** `compozy loop validate` is the strongest proof of the template,
  and it needs a running CompozyOS. It also exits 0 on an invalid definition (it reports
  `"valid": false` in its JSON), so it is never a gate command on its own: the template test runs it,
  asserts `valid: true`, and skips that assertion when the CLI or the daemon is absent. The
  daemon-free half of the same test reads the graph and runs anywhere, CI included.
- **Binary evidence in the repository.** Screenshots and a video under `openspec/changes/<id>/` are
  what the brief asks for, and they make a change folder heavy. The naming is fixed so a project can
  add one ignore rule or a size budget later; this change does not add one.
- **A skipped node's output.** Prompts and conditions that read `.nodes.design.output.*` must be
  guarded (`{{ if ... }}`), because a skipped node settles with a skip marker rather than a filled
  schema. The template test pins the guards; a missed guard shows up in `compozy loop validate`.
- **Eleven places of drift, already.** Adopting the kit here rewrites this repository's `.compozy/`.
  A test asserts the installed files match the templates except for the filled inputs, so the next
  drift is a failing test instead of a discovery.
- **Two human stops instead of one.** A change with screens asks the owner to approve plan and
  design together, then the push. That is one more thing to read at the same stop, not one more
  stop.
