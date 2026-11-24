# ADR 0025: One setup verb, `/devkit setup`, replaces the two setup skills

- Status: accepted
- Accepted by: the owner, on 2026-11-24, in the approval of the plan of change project-setup (openspec/changes/project-setup/approval.md)
- Date: 2026-11-23
- Change: project-setup
- Number: 0025, the next free number on `origin/main` after the records 0022 to 0024. It stays final
  unless a later merge of `main` before the review round takes it; then the record moves to the next
  free number.
- Amends: ADR 0004 (0004-devkit-per-project.md), the sentence of its Decision "The docs and
  `openspec-setup` teach only the per-project install" and the mitigation of its Consequences
  "`openspec-setup` writes the settings": both now name `/devkit setup`. ADR 0009
  (0009-compozy-loop-as-a-second-driver.md) keeps its Decision; the pack `devkit-compozy` loses its
  setup skill and stays an opt-in pack, so its review trigger ("`devkit-compozy` becomes a default
  pack") does not fire.

## Context

A project enters the devkit flow through two skills today. `openspec-setup` (devkit-openspec) opts
the project in, checks `gh`, lists the changes under way, installs the schemas `devkit` and
`devkit-lite`, writes `context` and part of the `devkit:` block of `openspec/config.yaml`, adds the
`devkit-project` ship entry and runs the GitHub step. `compozy-setup` (devkit-compozy, beside its
skills `screen-design` and `screen-demo`) installs the CompozyOS kit under `.compozy/`. Every other owner entry is a verb of the one
skill `devkit`: `/devkit change`, `/devkit roadmap`, `/devkit status`, `/devkit project`.

The coordination design (`docs/coordination-design.md`, Open points) left project setup open:
"one setup step per project writes the `devkit:` block of `openspec/config.yaml` (driver, language
of the files, delivery model, test commands, task source), installs the schemas and the checker
under the project's `openspec/` and wires the chosen driver. It replaces what `openspec-setup` and
`compozy-setup` do today." The grill of the change project-setup (2026-11-23) answered: one verb of
the `devkit` skill, typed only by the owner; both skills removed; no checker code copied into the
project; a `driver` value offered only when `/devkit change` can run with it; the kit asked
separately; a project set up with the old skills keeps working with no step.

ADR 0004 names `openspec-setup` in its Decision and Consequences. ADR 0010, decision 1, says
everything that defines the flow is to live under the project's `openspec/` and lists what that is:
`config.yaml`, `roadmap.md` and the schemas; it names no checker code. ADR 0018 rejected a fourth
downloaded checker file because every project moving its pin would break until it edited its
workflow; the change change-version-pin made the plugin version the project records the pin CI
and `release_tag` read. ADR 0019's Context names `openspec-setup` as the step that resolves the
pin; that is history and stays as written.

## Decision

1. **One verb.** Project setup is `/devkit setup`, a verb of the `devkit` skill of devkit-openspec.
   Like the other verbs it runs only from the owner's typed command (the skill is not invocable by
   the model). It is the same step for a first install and for a re-run: a re-run upgrades the
   schemas, keeps every value already present and asks only for what is missing.
2. **The two skills are removed.** `openspec-setup` and `compozy-setup` no longer exist, and no
   alias keeps their names. Every reply, hook message, document and test that named them names
   `/devkit setup`. Their scripts keep their behaviour in their new place.
3. **No checker code in the project.** The step copies no checker. `flow-check`, `deliver-check`
   and `guard` run from the installed plugin, and CI keeps downloading them at the release tag. The
   step records the plugin version the project uses and says, naming the pack, when a pack is not
   enabled in `.claude/settings.json`. "Under the project's `openspec/`" (ADR 0010, decision 1) is
   the configuration, the version pin and the schemas, as that decision lists them.
4. **The CompozyOS kit stays in its pack.** The kit's files, its templates and its installer stay in
   devkit-compozy. The pack loses `compozy-setup` only: it keeps its skills `screen-design` and
   `screen-demo` and stays opt-in per project (ADR 0004, ADR 0009).
   `/devkit setup` asks whether to install the kit as a question of its own, separate from the
   `driver` value; a yes runs the installer devkit-compozy ships, with the behaviour
   `compozy-setup` has, and enables devkit-compozy in the project's `.claude/settings.json`. No
   kit file ships in devkit-openspec.
5. **Old projects need no step.** A project set up with the old skills keeps its flow with no
   re-run; nothing the checkers or hooks read changes shape.

## Consequences

- Positive: the owner has one door for everything the devkit flow does, the same in every project;
  setup and its re-run are one step that keeps the project's values; no checker copy drifts from
  the plugin, and the pin stays the single thing a project moves; a project that never chooses the
  kit carries none of it.
- Negative: an owner who learned `/openspec-setup` or `compozy-setup` finds no such skill
  (Mitigated: every message and document names `/devkit setup`, and the catalog lists it). The
  `devkit` skill's text grows by one verb (Accepted: the other verbs share it the same way).
  devkit-compozy's kit is installed only through `/devkit setup`, a skill of another pack
  (Accepted: the pack stays the kit's package and its opt-in, and keeps its screen skills). `/devkit setup` must find the installed
  devkit-compozy to install the kit, and says so, naming the pack, when it is not installed
  (Accepted: the kit is opt-in).
- Neutral: the consumer projects keep running with no setup step; their next re-run is
  `/devkit setup`.

### Review trigger

Claude Code adds a native setup entry per plugin; the kit needs a file in a project that
devkit-compozy cannot ship; a project needs checker code under its own `openspec/`; or
devkit-compozy becomes a default pack.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| `/devkit setup` replaces both skills, kit kept in devkit-compozy (chosen) | One door like the other verbs; kit stays opt-in; no copied checker | The kit's installer is reached from another pack's skill; the old names stop working | medium |
| Keep `openspec-setup` and `compozy-setup` as aliases of the verb | Old habits keep working | Two names for one step; every message and test carries both; the owner chose removal | low |
| A separate skill `devkit-setup` | Smaller `devkit` skill | A fifth entry beside the four verbs; the owner chose the `/devkit` door | low |
| Move the kit's files and installer into devkit-openspec, remove devkit-compozy | One pack to install | Every devkit project ships the kit; fires ADR 0009's review trigger; breaks the projects that enable devkit-compozy | high |
| Copy the checkers into the project's `openspec/` (the design doc's wording read literally) | The project holds everything that runs it | ADR 0018's rejected reason: copies drift and every pin move breaks until the project edits them; CI already downloads them at the tag | high |
