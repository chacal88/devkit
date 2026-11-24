<!-- devkit-stage design result=passed attempt=1 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Design

Change: `project-setup` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(motivation: `proposal.md`; requirements: `requirements.md`; decision record:
`docs/adr/0022-one-setup-verb-replaces-the-two-setup-skills.md`, provisional number). Base:
`origin/main` at `c1ac8c4`, read on 2026-11-23, and the local branch `compozy-driver` at `cb39d27`
(not fetched; first read at `9c95942`, re-read at `cb39d27` after the readiness review).

## Context

- Two skills set a project up today. `plugins/openspec/skills/openspec-setup/` (`SKILL.md`, seven
  scripts with their tests, `scripts/fixtures/schemas-0.13.0/`, `templates/config.yaml`,
  `templates/devkit-reviews.yml`) does the OpenSpec and `gh` checks, the opt-in, the schemas, the
  config and the GitHub step. `plugins/compozy/skills/compozy-setup/` (`SKILL.md`, `install-kit.mjs`,
  templates, tests) installs `.compozy/`.
- The verbs of `/devkit` are decided by `startMode` in `plugins/openspec/hooks/change-loop.mjs`. Its
  verb list is checked at line 1727 (`['change', 'roadmap', 'status', 'project']`) and the project
  gate `projectGate` runs right after it, so a verb that must run in a project that is not set up has
  to be answered before that gate. The replies that name the old skill are at lines 141, 309, 353
  and 388 (`en`) and 396, 564, 608 and 643 (`pt-BR`).
- The drivers: `DRIVERS = ['claude', 'compozy', 'script']` (line 58) and
  `DRIVER_ROUND = { compozy: 21, script: 22 }` (line 1680). On the branch `compozy-driver`,
  `DRIVER_ROUND` is `{ script: 22 }`, so `compozy` runs. That branch also rewrites `compozy-setup`:
  21 generated agents, three loops, `gen-agents.mjs`, retired-file handling. It adds the reply
  `compozy-kit-missing` and `compozy-driver.mjs`'s fix text `kit-missing`, both naming
  `/compozy-setup`, and imports five `compozy-setup` test files into `guard.test.mjs`. CI gains
  `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check`, and `CLAUDE.md` names
  it. At `cb39d27` ("renumber compozy-driver above main") its ADR is
  `docs/adr/0022-compozy-runs-the-short-loop.md`, devkit-openspec is 0.34.0 and the marketplace
  0.38.0. This change's record also carries the provisional number 0022, so after the merge of task
  1.1 two records numbered 0022 exist until task 6.6 gives this change's record the next free number.
- devkit-compozy also ships the skills `screen-design` and `screen-demo`. They stay (round 24 removes
  them, `docs/coordination-design.md`).
- The project's config is read with one-level parsers that this change reuses and does not change:
  `parseDevkitBlock` and `deliverySettings` (`guard.mjs`), `readDevkitSettings` (`change-loop.mjs`),
  `readTestSettings` (`flow-check.mjs`), `parseShip`, `parseMergeMethod` and `deliveryConfig`
  (`deliver-check.mjs`). `deliveryConfig` refuses a `ship:` entry that disagrees with
  `devkit.delivery.model` (`MODEL_SHIP`: `trunk` is `pr`, `trunk-auto` is `merge`, `two-prs` takes no
  entry).
- The CI pin a project records is the commit of the tag `v<devkit-openspec version>` in
  `.github/workflows/devkit-reviews.yml`. `github-setup.mjs` writes it (its `workflow` item) in
  `merge` mode (ADR 0002, ADR 0019). Each change also records `x-devkit-version` when it opens
  (change-version-pin). No other file of a project records the version.
- Decisions this design follows: ADR 0004 (per-project opt-in; amended), ADR 0009 (CompozyOS as a
  second driver; its Decision kept), ADR 0010 decision 1 (what lives under the project's `openspec/`),
  ADR 0018 (delivery model; and its rejected fourth downloaded checker file), ADR 0002 (merge mode
  by opt-in), ADR 0019 (the release tag), the proposed ADR 0022.

## Goals / Non-Goals

**Goals:**

- One verb, `/devkit setup`, typed only by the owner, the same for a first install and a re-run.
- Every decision the step makes about the `devkit:` block is a script, tested, never prose. The
  session asks the questions and says the facts.
- The old skills' scripts keep their behaviour and their tests in their new place.

**Non-Goals:**

- Changing what any checker or hook decides, or any `flow.json`.
- Recording the plugin version in a new key, or copying a checker.
- Registering a CompozyOS workspace or starting a run. `/devkit change` on the `compozy` driver
  already says what is missing (compozy-driver).
- An alias for the old skill names (ADR 0022, alternative 2, rejected).

## Decisions

### D-1 The verb and the start mode

`startMode` gains one branch, after the `VERB_ROUND` check and before the verb list. When the verb is
`setup`, it answers `out('setup', { root, reply: null })`, where `root` is `findRoot(cwd)`, else the
git top level of `cwd` (`git rev-parse --show-toplevel`), else `null`. With `root` null it answers
`out('setup-no-repo', { reply: say('setup-no-repo') })`. No check of the settings' values (an
unknown value, a missing delivery setting, a driver not built), no project gate and no driver check
runs for `setup`: the step is what repairs them. The settings file itself is still read first, as for
every verb (`readDevkitSettings` at the top of `startMode`, unchanged). An `openspec/config.yaml` that
exists and cannot be read (a folder, no read permission) ends `setup` with the usage error, exit 3,
exactly as it ends every other verb: the step cannot repair a file it cannot read, and the reply
already tells the owner the request could not be read. N-16 pins it (it holds on the base). The
usage reply stays the shared one, even though its example names `/devkit change`: a setup-only
wording would be a new reply key for a case no owner reports, and the reply's first sentence (the
request could not be read) is the part that applies. The words
after `setup` are ignored (the `text` field carries them, unused). `setups` and other words stay
`unknown-verb`.

The verb list at line 1727 stays as it is, because the branch above answers `setup` before that
check is reached. Only the `verb-unknown` reply gains `/devkit setup` (D-8).

Typed only: the `devkit` skill keeps `disable-model-invocation: true` (the host refuses a model call
of the skill), as for `/devkit change`. `guard.mjs` already ends a `/devkit change` run and a
`/devkit roadmap` run on any other typed command but `/devkit status` (`runOf`, `roadmapRunOf`), so a
typed `/devkit setup` ends their hold with no code change. Two tests (N-6, N-7) pin that.

Rejected: a separate script `setup-loop.mjs` for the start. The verb list and its reply live in
`change-loop.mjs`, as for `roadmap` and `project`, which also hand off to their own script after the
start.

### D-2 One list of the drivers that run

`change-loop.mjs` exports `BUILT_DRIVERS = DRIVERS.filter((d) => !DRIVER_ROUND[d])`, declared right
after `DRIVER_ROUND`. It is the only source of the driver question (`setup-block.mjs` imports it).
After the `compozy-driver` merge it is `['claude', 'compozy']`. `script` is never offered while
`DRIVER_ROUND.script` is set.

Rejected: a literal list in the skill or in `setup-block.mjs`. It would drift the day round 22
builds `script`.

### D-3 The block writer: `plugins/openspec/skills/devkit/scripts/setup-block.mjs`

A new script with no dependency, importing the readers listed in Context, `BUILT_DRIVERS` and
`LANGUAGE_TAG`. `LANGUAGE_TAG` (the language-tag regex, `change-loop.mjs` line 59) becomes an export
of `change-loop.mjs`, unchanged, so the loop and the writer check a language with one regex (the
project rule "one shared helper per mechanism").

`node setup-block.mjs plan <root> --json` reads only and prints one JSON object:

| Field | Value |
|---|---|
| `version` | `1` |
| `config` | `absent` or `present` (`openspec/config.yaml`) |
| `block` | `absent` or `present` (a column-0 `devkit:` line) |
| `present` | the values already held: `language`, `driver`, `delivery`, `tests`, `ship` (the map), `merge_method`, `release_tag` |
| `kept` | the present values the loop refuses (`readDevkitSettings(root).unknown` and `.missing`), each `{ setting, value, accepted }` |
| `missing` | one entry per key to ask, in this order: `language`, `driver`, `delivery`, `tests.unit`, `tests.coverage.command`, `tests.coverage.target`, `tests.e2e`, `ship`, `merge_method`, `release_tag`. Each entry is `{ key, default, proposed, options }` |
| `drivers` | `BUILT_DRIVERS` |
| `driverNotBuilt` | `{ driver, round }` when a present `driver` has a round, else `null` |
| `releaseFile` | `package.json` when the root's `package.json` has a top-level string `version`, else `null` |
| `kit` | `installed` when `.compozy/kit-manifest.json` exists, else `absent` |
| `pluginVersion` | the `version` of devkit-openspec's own `.claude-plugin/plugin.json` (`<script dir>/../../../.claude-plugin/plugin.json`) |
| `ciPin` | the tag named on the line `# pinned to the commit of <tag>` of `.github/workflows/devkit-reviews.yml`, else `null` |
| `fill` | the top-level parts of `openspec/config.yaml` outside the `devkit:` block that step 5 may write, in this order: `schema` when no top-level `schema:` line exists or it names a schema other than `devkit` and `devkit-lite`; `context` when no top-level `context:` key exists or its block holds a `<...>` placeholder (a `<`, then characters with no `<`, `>` or newline, then `>`); `rules` and `operations` each when no such top-level key exists. With no config, all four: step 5 copies the template, which already holds `schema`, `rules` and `operations`, so the only part it writes beyond that copy is `context`. With a config the setup wrote or an owner filled, `[]` |

The `fill` rule is what keeps a re-run from editing the file outside the block (AC-4): a present
`schema` of the devkit flow, a filled `context`, and present `rules` and `operations` maps are never
touched, and a missing child key of a present `rules:` or `operations:` map is not merged in (the
owner's maps stay as they are; the old skill's "merge in the missing keys" is not carried). A
`context` that legitimately holds a `<...>` text is read as a placeholder; the session then shows
the line and asks before it fills, so nothing changes without the owner's answer.

The rules for `missing`:

- `language`: absent. Default the present value, else `en`.
- `driver`: absent. Default `claude`, options `drivers`.
- `delivery`: `devkit.delivery.model` absent and no `ship:` map present. Default none (no model),
  options `none`, `trunk`, `trunk-auto`, `two-prs`. `two-prs` also needs `base` and `test_branch`;
  `base` is proposed from `git symbolic-ref --short refs/remotes/origin/HEAD` without `origin/`, else
  `main`.
- `tests.*`: each key absent. `proposed` comes from the root's `package.json` scripts (`test`,
  `coverage`, and `e2e` or `test:e2e`, run with the package manager its lockfile names: `npm`,
  `pnpm` or `yarn`) and from a `Makefile` `test:` target (`make test`). `tests.e2e` is proposed only
  when `playwright.config.*` or `cypress.config.*` exists. `tests.coverage.target` has no proposal.
  The session may still propose from CI files, as step 5 of the old skill did.
- `ship`: no `ship:` map and no delivery model. Default `merge`, options `plan`, `pr`, `merge`.
- `merge_method`: absent and the effective mode merges (a `ship` answer or present value `merge`, or
  the model `trunk-auto`). Default `squash`, options `squash`, `merge`, `rebase`.
- `release_tag`: absent and `releaseFile` is not null. Default `releaseFile`.
- A key whose present value the loop refuses is in `kept`, never in `missing`. The step does not
  change it.
- `budget` and `design` are never in `missing`.

`node setup-block.mjs apply <root>` reads the answers as JSON on standard input, through the quoted
heredoc of the skill: `{ language, driver, delivery: { model, base, test_branch }, tests: { unit,
coverage: { command, target }, e2e }, ship, merge_method, release_tag }`. A key left out or `null`
stays unset. It computes `plan` again and refuses, with exit 3, one stderr line and nothing written,
in these cases. The line names the key and its accepted values, or, for a block it cannot read, the
line number and that the block is edited by hand:

- an answer for a key that is not in `missing`. This is what makes a re-run keep every value.
- a `driver` not in `drivers`.
- a `language` that `LANGUAGE_TAG` refuses.
- a `model` outside the options, or `two-prs` without `base` and `test_branch`.
- a `ship` or `merge_method` outside its options.
- a `target` that is not a whole number from 0 to 100.
- a block it cannot read (below).

It exits 2 on a usage error (an unknown subcommand or option, no root, standard input that is not one
JSON object), with nothing written. Exit 3 is a refusal of the answers or of the block; exit 2 is a
call the skill wrote wrong. When `openspec/config.yaml` is absent it starts from
`templates/config.yaml` (moved, D-10). When `openspec/config.yaml` exists and cannot be read (a
folder, no read permission), `plan` and `apply` both exit 3 with one stderr line naming the file and
the read error, print no JSON and write nothing; the session says the line and stops the step.
`setup` reaches the script in that case when the folder has no `openspec/changes/` (D-1 falls back
to the git root). B-12 has the case.

How it writes (the parser decisions, `openspec/config.yaml` rule "Parsers"):

- No answered key: the file is not written at all. Its bytes and its mtime stay, and it prints
  `{"file":"unchanged","added":[]}`.
- No block: it appends, after one blank line, `# The settings of /devkit, written by /devkit setup.`,
  then `devkit:` and the answered keys, two-space indent, in the `missing` order. Nested keys sit
  under `delivery:`, `tests:` and `coverage:`.
- A block present: each missing top-level key is inserted after the block's last indented line, at
  the block's own indent. A missing child of a present `tests:` (or `coverage:`, or `delivery:`) is
  inserted after that map's last nested line, at the indent of its first child, else at twice the
  block's indent. A missing map (`tests:` with its children) is inserted at the block's end.
- `ship` answered: `ship:` with `devkit-lite`, `devkit` and `devkit-project` all set to the answer is
  appended at the end of the file, then `merge_method: <x>` when answered. A present `ship:` map is
  never edited here; `ship-entry.mjs` adds a missing `devkit-project` key as before.
- Values: commands are written as JSON strings, which YAML reads as double-quoted scalars. `language`,
  `driver`, `model`, `base`, `test_branch`, `ship` and `merge_method` are written plain after the
  checks above. `target` is a bare integer. `release_tag` is written plain after the
  `releaseTagSetting` check of `guard.mjs`.
- A file that ends without a newline gets one before anything is appended. An empty file reads as no
  block. CRLF line endings are kept: every added line ends with `\r\n` when the file's first line
  ends with `\r\n`.
- Refused (exit 3, nothing written): a `devkit:` line with an inline value (`devkit: {}`,
  `devkit: x`), a second column-0 `devkit:` line, or a tab in the indentation of a block line.

After `apply`, `readDevkitSettings` reads the written block with no `unknown` entry. Test B-3 checks
it.

Rejected: rewriting the file from a YAML library (the repository has no dependency and the rule
"keep the user's values" forbids reformatting); a commented block uncommented in place (the template
test T-5 pins that the template's block stays all comments, and the owner's own file may hold none).

### D-4 Finding the kit installer: `plugins/openspec/skills/devkit/scripts/kit-installer.mjs`

`node kit-installer.mjs <root> [install-kit arguments...]` finds devkit-compozy's
`kit/scripts/install-kit.mjs` and runs `node <installer> <root> <arguments...>` with its output
passed through and its exit code returned. `node kit-installer.mjs --where` prints
`{ "installer": <path>, "version": <version> }`, or exits 3 with one line naming `devkit-compozy`
and every location tried.

The search, in order:

1. The sibling of this pack: `<devkit-openspec root>/../compozy`. This is the repository layout and
   the layout of `--plugin-dir` runs from a checkout. It is taken when its
   `.claude-plugin/plugin.json` names `devkit-compozy` and `kit/scripts/install-kit.mjs` exists.
2. The installed packs: under `$CLAUDE_CONFIG_DIR/plugins`, else `$HOME/.claude/plugins`, every
   `.claude-plugin/plugin.json` naming `devkit-compozy` with a `kit/scripts/install-kit.mjs`
   sibling. The highest `version` wins, compared field by field as integers; a tie goes to the
   lexicographically last path. This is the rule of the kit's resolver `bin/devkit-kit`, the one
   `compozy-driver` ships.

A devkit-compozy that keeps its installer under `skills/compozy-setup/` (0.4.0 and older) is not
matched. The reply then says to update devkit-compozy.

Rejected: calling the resolver `bin/devkit-kit` (it lives in the kit and exists only after an
install); reading `installed_plugins.json` (a host file whose shape is not ours); moving the
installer into devkit-openspec (ADR 0022, alternative 4, rejected).

### D-5 What the step records and names (AC-5)

- No checker file is copied. The schemas come from `install-schemas.sh` as before, and the CI
  downloads its checkers at the pinned commit as before.
- The version: the step's report names `pluginVersion` ("the schemas come from devkit-openspec
  <v>"). In `merge` mode the GitHub step's `workflow` item writes the pin to the commit of
  `v<pluginVersion>` (unchanged `github-setup.mjs`). When `ciPin` differs from `v<pluginVersion>`,
  the report says so and that the `workflow` item moves it. The pin a project records stays the CI
  pin (requirements, assumption 2; ADR 0022 decision 3). No new key.
- The packs: before the opt-in, the step runs
  `node <skill-dir>/scripts/project-settings.mjs <root> --packs <list> --dry-run --json`. It names
  each item whose action is not `ok` by its pack. The list is `devkit-core,devkit-openspec`, plus
  `devkit-design` when the owner wants `/devkit project`, plus `devkit-compozy` when the kit is
  installed or wanted. Then it writes the opt-in as before. `project-settings.mjs` already reports
  `enable` and `enable (was false)` per pack; only a test is added (P-1).

### D-6 The kit and the driver (AC-6)

- The kit question is asked when `kit` is `absent` and the driver answer is not `compozy`. A no
  writes nothing for the kit, and the question is asked again on a later run.
- A yes, or the answer `compozy`, runs `kit-installer.mjs <root>` with the inputs
  `substitutions.json` lists that the manifest does not record (after `compozy-driver`:
  `__TIMEZONE__`, asked once). The installer prints one line per file. For each `edited` or `kept`
  file the step shows the difference and asks one question; it re-runs with `--accept` for the files
  that got a yes, as `compozy-setup` did. Then the opt-in adds `devkit-compozy`.
- `kit: installed` on a re-run: the installer runs again with no kit question, so the kit's
  templates update as the old skill's re-run did.
- The old skill's step 3 (writing a `design:` block) is not carried. `design:` stays a commented
  example of the template, and the report says the block is set by hand when the project tracks
  screens. Requirements, Out of scope: "writing `budget` or the `design:` block".

### D-7 The skill text: `plugins/openspec/skills/devkit/SKILL.md`

- Frontmatter. `description` adds one sentence: "`/devkit setup` sets the project up for the devkit
  flow, or updates its setup: the opt-in, the schemas, the `devkit:` block, the GitHub step of
  `merge` mode and, on request, the CompozyOS kit." The "Use when" list adds `/devkit setup`.
  `argument-hint` becomes
  `"change [<request> | <change-id> | <Jira key or link>] | roadmap [<n> | stop] | status | setup | project [<name>]"`.
  The last part stays `| project [<name>]`, which T-24 pins. `disable-model-invocation: true` stays.
- `## Start`: the mode list adds `setup-no-repo` to the "say `reply` and end the turn" item, and an
  item "`setup`: the Setup section below, in `root`".
- A new `## Setup` section between `## Waiting on GitHub` and `## Roadmap`. It is the only new `##`
  heading: the old skill's `# Set up the devkit flow in a project` title and its `## Steps` heading
  are not carried, its intro and path list become the section's first paragraph, and its steps are
  the numbered list items below, with no `##` or `###` heading of their own. Its `## Never` items
  join the skill's `## Never` (below). So the skill's `##` headings become `## Settings`, `## Start`,
  `## A new change`, `## Loop`, `## Owner gates`, `## Waiting on GitHub`, `## Setup`, `## Roadmap`,
  `## Status`, `## Project`, `## Never`: the list T-28 pins, whose last three stay `## Status`,
  `## Project`, `## Never` (T-24). The section stays out of every slice the tests take
  (`## Start`..`## A new change`, `## Roadmap`..`## Status`, `## Status`..`## Never`,
  `## Project`..`## Never`). Paths are `<skill-dir>/scripts/...` and
  `<skill-dir>/templates/...`. Its steps keep the headings and the sentences of the old skill that
  tests pin (D-13): `1. **Check the CLI.**`, `2. **Opt the project in.**`, `3. **Initialize
  OpenSpec**`, `4. **Install the schemas**`, `5. **Write \`openspec/config.yaml\`.**`,
  `6. **Check.**`, `7. **GitHub (merge mode).**`, then `8. **The CompozyOS kit.**` and
  `9. **Report**`. Step 7 runs when the effective mode merges. Its pinned sentence on `ship` and
  `merge_method` ("only if the owner asks") is replaced by "`ship` and `merge_method` are asked in
  step 5, `merge` suggested" (T-15). Step 9 names `/devkit change` as the first command.
- Step 5, the whole of it. It runs `setup-block.mjs plan` first. Then:
  - It writes `schema`, `context`, `rules` and `operations` only as `fill` names them, and nothing
    else outside the block. With no config it starts from the template, as before: the copy
    brings `schema`, `rules` and `operations`, and `context` is the only part it then fills. `schema` in
    `fill` because the config names another schema: ask first, as before. `context` in `fill`: fill
    it from the repository as before (stack, commands, ADR folder, default branch, conventions),
    never with placeholders, and run the test command once to record a failing one there. `rules`
    or `operations` in `fill`: copy that map from the template. Every part `fill` does not name is
    left byte for byte: the sentence "Every part of `openspec/config.yaml` that `fill` does not name
    stays as it is: a re-run with an empty `fill` and nothing `missing` writes nothing." is pinned
    by N-17. This replaces the old prose "set `schema: devkit-lite` as the default", "merge in only
    the missing `rules` / `operations` keys" and "Fill `context` from the repo", which edited a
    config on every run.
  - It asks the `missing` questions in order (one question each, AskUserQuestion where the host has
    it, else said and the turn ended), offering each entry's `options` with its `default` suggested,
    as the JSON gives them: the skill lists no option of its own. That is how the `merge_method`
    question offers `squash`, `merge` and `rebase` without the skill holding the word `rebase`
    (T-26). It says each `kept` and `driverNotBuilt` fact, and runs `setup-block.mjs apply` with the
    answers through the quoted heredoc.
  - It keeps the old step's test-key sentences that T-5 pins, and the `ship-entry.mjs` and
    workflow-pin bullets as they are.
- Two moved sentences are reworded, because a skill-wide test reads them (T-26):
  - Step 4's "(`change-loop.mjs flow`, only on the owner's request)" becomes "(the `flow` command of
    `/devkit change`, only on the owner's request)": `change-loop.test.mjs` line 2341 requires every
    line naming `change-loop.mjs flow` to carry `--lang ${user_config.language}`, and this line is
    not a call.
  - Step 7's "(add `--method <squash|merge|rebase>` for another merge method, ...)" becomes "(add
    `--method <the merge_method answer of step 5>` when it is not `squash`, ...)". The script's
    accepted values are unchanged (`github-setup.mjs`, its tests); the owner still chooses
    `rebase` through step 5's options.
- Constraints the whole file must keep (tests T-26): no `--lang en`/`--lang pt-BR`, no unquoted
  heredoc, no `rebase`, `push-rebased` or `--force` anywhere in the file
  (`change-loop.test.mjs` line 2539, `release-merge-conflict 16`, unchanged: its invariant is that
  the skill never describes a history rewrite, and the two rewordings above keep the Setup text
  inside it), no `CronCreate`, `conduct-check` or `wake_when_done` before `## Roadmap`. Every
  `change-loop.mjs` call carries `--lang ${user_config.language}`.
- `## Never` gains the old skill's items, worded for the setup: overwrite an existing
  `openspec/config.yaml` wholesale or remove the owner's rules; leave a `<placeholder>` in
  `context`; commit in a setup; install a pack at user scope, run `claude plugin install` without
  `--scope project`, or edit `~/.claude/` or `.claude/settings.local.json`; "Change GitHub settings
  without the owner's confirmation of that item, or apply an item that was not confirmed." (T-15
  pins this one.)
- `plugins/openspec/skills/ship-change/SKILL.md` line 26 ("the `openspec-setup` GitHub step") and
  row `stop-merge-setup` (line 67) name "the GitHub step of `/devkit setup`".

### D-8 Replies and messages

| Where | Key or line | New text (`en`; `pt-BR` below it) |
|---|---|---|
| `change-loop.mjs` | `not-set-up` | `This project is not set up for devkit yet: type /devkit setup first. Nothing was run.` / `Este projeto ainda não está preparado para o devkit: digite /devkit setup primeiro. Nada foi executado.` |
| `change-loop.mjs` | `verb-unknown` | `So far /devkit change, /devkit roadmap, /devkit status, /devkit setup and /devkit project exist: type /devkit change and what you want done, /devkit roadmap to run the roadmap, /devkit status to see where everything is, /devkit setup to set this project up or update its setup, or /devkit project and a name to plan a new project or slice.` / `Por enquanto existem /devkit change, /devkit roadmap, /devkit status, /devkit setup e /devkit project: digite /devkit change e o que você quer fazer, /devkit roadmap para rodar o roadmap, /devkit status para ver onde está tudo, /devkit setup para preparar este projeto ou atualizar a preparação, ou /devkit project e um nome para planejar um projeto ou uma fatia nova.` |
| `change-loop.mjs` | `setup-no-repo` (new) | `/devkit setup runs inside a git repository: open the project's folder, or create its repository there first. Nothing was run.` / `/devkit setup roda dentro de um repositório git: abra a pasta do projeto, ou crie o repositório dele ali primeiro. Nada foi executado.` |
| `change-loop.mjs` | `design-pack-missing` | `The project flow needs the devkit-design pack in this project: type /devkit setup and enable the devkit-design pack, then call /devkit project again. Nothing was run.` / `O fluxo de projeto precisa do pacote devkit-design neste projeto: digite /devkit setup, ative o pacote devkit-design e chame /devkit project de novo. Nada foi executado.` |
| `change-loop.mjs` | `blocked-why.merge-setup` | `the repository is not prepared for automatic merging yet, which the GitHub step of /devkit setup does` / `o repositório ainda não está preparado para o merge automático, que a etapa do GitHub de /devkit setup prepara` |
| `change-loop.mjs` | `blocked-why.merge-setup-missing` | `the repository is not prepared for automatic merging yet ({list}), which the GitHub step of /devkit setup does` / `o repositório ainda não está preparado para o merge automático ({list}), que a etapa do GitHub de /devkit setup prepara` |
| `change-loop.mjs` (from `compozy-driver`) | `compozy-kit-missing` | `run /compozy-setup first, then call /devkit again` becomes `type /devkit setup and answer yes to the kit, then call /devkit again`; `rode /compozy-setup primeiro e chame /devkit de novo` becomes `digite /devkit setup, responda sim ao kit e chame /devkit de novo`. The rest of each text is kept. |
| `compozy-driver.mjs` | `FIX['kit-missing']` | `/devkit setup installs the devkit kit into this project (answer yes to the kit question)` |
| `flow-check.mjs` | `schema-without-declaration` | `the schema has no flow.json: the project has not re-run /devkit setup` / `o schema não tem flow.json: o projeto ainda não rodou /devkit setup de novo` |
| `guard.mjs` line 499 | `FlowUsageError` text | `... re-run /devkit setup with a devkit-openspec that ships it` |
| `merge-setup.mjs` line 22 | `POINTER`, now exported as `SETUP_POINTER` | `; run the GitHub step of /devkit setup to configure it`. Line 143's comment names `/devkit setup`. |
| `project-loop.mjs` line 254 | the strip of the pointer | `m.endsWith(SETUP_POINTER) ? m.slice(0, -SETUP_POINTER.length) : m`, importing `SETUP_POINTER`: one source for the text (behaviour unchanged) |
| `changes-under-way.mjs` lines 2 and 96 | comment and the `- Why:` line written into `approval.md` | `... when /devkit setup replaced the devkit schemas ...`. An `approval.md` already written keeps its text. |
| `templates/config.yaml` line 14 | comment | `` `merge` needs the GitHub step of /devkit setup first (workflow, `` |

`templates/config.yaml` also gains two commented examples under its existing `# devkit:` example, a
`#   budget: 200000` line and a `# design:` example with its two keys. Those are the only places
`budget` and `design:` appear (AC-3). The heading line, and the rule that every line of the block is
a comment, stay (T-5).

### D-9 What "named nowhere" covers (AC-2)

Decision records (`docs/adr/`), past `CHANGELOG.md` entries and change folders (`openspec/changes/`,
the archive included) keep their text: they are history. ADR 0022 says so of ADR 0019's Context.
The new `CHANGELOG.md` entry names the removed skills to say they are removed. ADR 0004 keeps its
Decision text and gets a Note (D-11). Everything else is checked by one test, N-10. It walks the
repository's working tree, never git history (config rule "Test history"), and fails on any line
holding `openspec-setup` or `compozy-setup`, naming the file and the line. What it skips, and why:

1. History, by folder or file: `.git/`, `node_modules/`, `docs/adr/`, `openspec/changes/` (the
   archive included) and `CHANGELOG.md`.
2. The N-15 fixture folder `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/`, by path:
   it holds the bytes an old project holds, and the template of `c1ac8c4` names `openspec-setup` on
   its line 14 by design. No other fixture is skipped.
3. In `openspec/specs/project-setup/spec.md` and `openspec/specs/compozy-kit-setup/spec.md` only,
   a `### Requirement:` block (from its header to the next `### Requirement:` or `## ` heading)
   whose header this change's delta MODIFIES. N-10 reads the delta's headers from
   `openspec/changes/project-setup/specs/<capability>/spec.md`, or, once the change is archived,
   from the folder under `openspec/changes/archive/` whose name ends in `-project-setup`. Those
   bodies are canonical text the archive replaces with the delta's after the merge (D-11: only the
   Purpose is edited by hand). Every other line of the two files, the Purpose included, is checked.
   After the archive the MODIFIED bodies are the delta's text, which holds no old name, so this
   skip matches nothing and needs no removal. The blocks the delta ADDS are not skipped: they are
   worded without the literal names ("either of the two removed setup skills", "the earlier setup
   skill of the OpenSpec pack"), so after the archive no block of either canonical spec, ADDED,
   MODIFIED or untouched, holds an old name, and the spec scenario "The files of the repository"
   holds for its own requirement. No line of this change's spec deltas holds an old name (task 6.1
   greps them).
   Until the archive of `compozy-driver` reaches the branch, the canonical `compozy-kit-setup`
   still holds the requirement "The kit runs the new stages in its four shells", which names
   `compozy-setup` and which `compozy-driver` REMOVES: N-10 is red until task 6.5 merges that
   archive, by design.

No test file is skipped. The tests that must hold the old names build them by concatenation
(`'openspec' + '-setup'`, `'compozy' + '-setup'`), so no source line holds the name: N-10's own
needles, N-8's, T-14's negative, and T-6's quote of the past `CHANGELOG.md` line (same string, same
assertion). Every other test, comment and template line that names an old skill is rewritten (D-10,
D-13): the moved kit tests' body comments and the kit's `templates/substitutions.json` text
included.

### D-10 Where the files go

| From | To |
|---|---|
| `plugins/openspec/skills/openspec-setup/scripts/` (all files, `fixtures/` included) | `plugins/openspec/skills/devkit/scripts/` |
| `plugins/openspec/skills/openspec-setup/templates/` | `plugins/openspec/skills/devkit/templates/` |
| `plugins/openspec/skills/openspec-setup/SKILL.md` | removed; its steps move into the `## Setup` section (D-7) |
| `plugins/compozy/skills/compozy-setup/scripts/` (as `compozy-driver` leaves it) | `plugins/compozy/kit/scripts/` |
| `plugins/compozy/skills/compozy-setup/templates/` | `plugins/compozy/kit/templates/` |
| `plugins/compozy/skills/compozy-setup/SKILL.md` | removed; its procedure moves into step 8 of the `## Setup` section, its re-run rules into D-6 |

Moves use `git mv`, so history follows. The devkit-openspec scripts keep their depth
(`skills/<name>/scripts`), so every `../../../hooks` and `../../../schemas` path in them holds
unchanged (`install-schemas.sh`'s `src`, every `test-tmp.mjs` import). The kit moves one level up, so
these change:

- `install-kit.mjs`: `PACK_JSON` becomes `join(here, '..', '..', '.claude-plugin', 'plugin.json')`.
- `gen-agents.mjs` (line numbers on `compozy-driver` at `cb39d27`): `DEFAULT_ROOT` (line 20) goes
  from five levels up to four, `resolve(here, '..', '..', '..', '..')`; `AGENTS_AT` (line 21)
  becomes `['plugins', 'compozy', 'kit', 'templates', 'agents']`; `SELF` (line 25) becomes
  `plugins/compozy/kit/scripts/gen-agents.mjs`. The generated header line of every agent changes,
  so the agents are generated again, under `kit/templates/agents/` and, through `install-kit.mjs`,
  under this repository's `.compozy/agents/`.
- `adoption.test.mjs`: `REPO_ROOT` (line 22) is four levels up; the comment of line 21 says so; the
  comments of lines 6 and 31 name "the kit installer" for `compozy-setup`.
- `gen-agents.test.mjs`: its `test-tmp.mjs` import (line 12) becomes `../../skills/test-tmp.mjs`;
  `REPO` (line 16) is four levels up; `AGENTS_AT` (line 18) and the generator path (line 50) name
  `kit`.
- `install-kit.test.mjs`: the sandbox copies the kit folder to `<tmp>/kit` (line 46 names the copy
  `kit`, not `kit/compozy-setup`) and keeps the pack's `plugin.json` two levels above `scripts/`;
  the comments of lines 8 and 43 say "the kit folder". `install-kit.test.mjs` and
  `devkit-kit.test.mjs`: `test-tmp.mjs` is imported from `../../skills/test-tmp.mjs`.
- `loop-templates.test.mjs`: the `cwd` of the `compozy loop validate` spawn (line 543) is four
  levels up.
- Every moved kit test's first-line run comment names its new path.
- `kit/templates/substitutions.json` line 2 (the `syntax` text): "compozy-setup replaces each token"
  becomes "the kit installer replaces each token". The file is read for its `placeholders` only, so
  no behaviour changes.
- `guard.test.mjs` imports, `.github/workflows/ci.yml` (the agents check and the schema step),
  `CLAUDE.md` (the agents-check row), `CONTRIBUTING.md` line 73, `docs/openspec-flow.md` lines 142,
  149 and 642, `docs/compozy-kit.md`, `plugins/compozy/kit/templates/README.md` line 16 and this
  repository's `.compozy/README.md`.

Rejected: `plugins/openspec/hooks/` for the setup scripts (it is the checkers' folder, and every
script there is shipped to CI by path); a `plugins/compozy/skills/<x>/` folder with no `SKILL.md`
for the kit (a folder under `skills/` is read as a skill, and `scripts/check.py` checks every
`plugins/*/skills/*/SKILL.md`).

### D-11 Documents and the records

- ADR 0022 is the adr-author's record. The implementation renumbers it to the next free number on
  `origin/main` at the last merge before review (the loop's `renumber-adr` step), moving every link.
  It sets the status to `accepted` with the plan approval's words, as earlier changes did.
- ADR 0004, after plan approval, by the implementation: a header line
  `- Amended by ADR <n> (<file>)` under the existing one, and a dated Note at the top of its Context:
  "Note (project-setup, <date>): the setup is the verb `/devkit setup` of the `devkit` skill
  (ADR `<n>`, linked to its file); the Decision's 'the docs and `openspec-setup`' and the Consequences'
  'Mitigated: `openspec-setup` writes the settings' now read `/devkit setup`. The Decision is
  otherwise unchanged." ADR 0009 is not edited (`decisions.md`).
- `docs/coordination-design.md`, Open points: the "Project setup" bullet leaves the list. The
  paragraph above the list adds "project setup was answered by the change `project-setup` on
  <date>: one verb, `/devkit setup`, with no checker copied into the project (the version pin and
  the schemas are what lives under its `openspec/`)".
- `openspec/config.yaml` `context`, ADRs line: `<n> one setup verb replaces the two setup skills,
  amends 0004`.
- `CHANGELOG.md`: one entry for the new marketplace version, with a `- Projects:` line saying that
  existing projects need no step and that the next re-run is `/devkit setup`.
- The prose of `README.md`, `plugins/openspec/README.md`, `plugins/compozy/README.md`,
  `docs/getting-started.md`, `docs/openspec-flow.md`, `docs/compozy-kit.md`, `docs/conventions.md`
  and `CONTRIBUTING.md` names `/devkit setup`. The catalog blocks are generated
  (`python3 scripts/gen-catalog.py`). The pack descriptions in
  `plugins/compozy/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` say "installed
  into a project by `/devkit setup`".
- The canonical Purpose of `openspec/specs/project-setup/spec.md` and
  `openspec/specs/compozy-kit-setup/spec.md` names `/devkit setup` and the kit installer. A Purpose
  is edited in the canonical spec, not in a delta (OpenSpec's instruction). Their requirement bodies
  are not edited by hand: the archive of this change applies the delta to them after the merge, and
  until then N-10 skips exactly the blocks the delta MODIFIES (D-9, point 3).

### D-12 This change beside `compozy-driver`

`compozy-driver` merges into `main` first (the owner's order; requirements, assumption 4). The plan
is written against that branch, read locally with no fetch.

1. Before the first task, the implementation fetches, merges `origin/main` into `project-setup`
   and re-reads every file this design names from `compozy-driver`. The first re-read checks the
   sibling's ADR number and versions against `cb39d27` (`0022-compozy-runs-the-short-loop.md`,
   devkit-openspec 0.34.0, marketplace 0.38.0) and fixes this plan where they moved. Gate 1.4 checks that
   `DRIVER_ROUND` holds no `compozy`, that `plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs`
   exists, and that the merge is in the branch. If `compozy` is still not built on `main`, the
   change stops for the owner. The requirement's condition ("if `driver: compozy` is built") would
   then go the other way, and N-5, B-1 and the AC-6 proof change.
2. The kit folder moves as `main` holds it after that merge: 21 agents, three loops,
   `gen-agents.mjs`, retired-file handling. Nothing of the old kit is restored.
3. Its new texts naming `/compozy-setup` (`compozy-kit-missing`, `FIX['kit-missing']`,
   `compozy-driver.test.mjs` line 95, its five imports in `guard.test.mjs`, its CI line, its
   `CLAUDE.md` row, its docs) are in D-8, D-10 and the test table.
4. Its spec delta on `compozy-kit-setup` reaches the canonical spec only when it is archived. This
   change's delta MODIFIES the three requirements both versions share, with the `compozy-driver`
   text. Task 6.5, after the documents of phase 6 (which do not wait on it), checks that the archive
   is on `origin/main` and merges `origin/main` into the branch. It then adds MODIFIED blocks for the three requirements `compozy-driver` adds and that name `compozy-setup`
   ("A re-run removes the retired files the project did not edit", "A retired file the project
   edited stays and is named", "Inputs the kit no longer uses are dropped"), with the installer
   named and no other change.
5. Its ADR takes its number at its merge. This change's record takes the next free one at its last
   merge (D-11).
6. Any later merge of `main` (task 6.5's, and the one before the last verify and review) repeats
   step 1's re-read for these files (the project's rule: merge the base before the final review),
   and repeats gate 1.4's content checks at the paths phase 2 left:
   `test -f plugins/openspec/hooks/compozy-driver.mjs && test -f plugins/compozy/kit/scripts/gen-agents.mjs && test ! -e plugins/compozy/skills/compozy-setup && test ! -e plugins/openspec/skills/openspec-setup && grep -q "const DRIVER_ROUND = { script: 22 };" plugins/openspec/hooks/change-loop.mjs`.
   A red part means `main` moved under the plan: the change stops for the owner.

### D-13 Existing tests this change touches

Every row was found by grepping the test files of both trees (this branch and `compozy-driver`) for
`openspec-setup`, `compozy-setup`, `skills/devkit/SKILL.md`, the old reply texts and the skill
sentences. Each row names the invariant, the layer that owns it and the suite. All run through
`plugins/openspec/hooks/guard.test.mjs`.

| Id | File : line (this branch) | Test | Change | Invariant (layer) |
|---|---|---|---|---|
| T-1 | `guard.test.mjs` 25-30 | the six imports of the setup script tests | path `../skills/devkit/scripts/` | the setup scripts' tests run in the hook suite (suite wiring) |
| T-2 | `guard.test.mjs` 33-37 on `compozy-driver` | the five imports of the kit tests | path `../../compozy/kit/scripts/` | the kit's tests run in the hook suite (suite wiring) |
| T-3 | `guard.test.mjs` 632 | `openspec-setup SKILL.md teaches the per-project opt-in (2.4)` | renamed `setup skill: the Setup section teaches the per-project opt-in (2.4)`; reads the `## Setup` section and `## Never` of the devkit skill, same assertions | the setup teaches only the per-project install (skill text) |
| T-4 | `guard.test.mjs` 655 | `this repository opts in through .claude/settings.json (2.5, ADR 0004)` | the script path `skills/devkit/scripts/project-settings.mjs` | this repository is opted in (settings writer) |
| T-5 | `guard.test.mjs` 1488-1520 | the three `stage-roles setup:` tests | `setupRoot` is `skills/devkit`; step 5 is sliced from the devkit skill | step 5 proposes and confirms the four test keys; the template's block stays all comments (skill text, template) |
| T-6 | `guard.test.mjs` 1729 (1776 on `compozy-driver`) | the CHANGELOG `0.24.0` Projects line | the quoted literal is written with the name split by concatenation (`'openspec' + '-setup'`), so the string and the assertion are unchanged and the source line holds no old name (D-9) | history is kept (release notes) |
| T-7 | `merge-setup.test.mjs` 29, 77, 108 | `the setup template` path; `POINTER`; `mergeSetup: each fact missing alone ... the openspec-setup pointer (AC-6)` | template path `skills/devkit/templates/devkit-reviews.yml`; `POINTER` is the new text; test renamed `... and the /devkit setup pointer (AC-6)` | each missing merge fact is listed with the pointer to the setup (GitHub facts) |
| T-8 | `deliver-check.test.mjs` 2306, 2310 | `nextStep row 3a: merge setup missing stops after the approval stops and before any work (AC-6)` | the expected line ends with the new pointer; `/devkit setup` matched | the merge-setup stop names the setup step (delivery checker) |
| T-9 | `deliver-check.test.mjs` 2658 | `one gh runner: deliver-check.mjs and github-setup.mjs do not spawn gh themselves (architecture)` | path `skills/devkit/scripts/github-setup.mjs` | one `gh` runner (architecture) |
| T-10 | `deliver-check.test.mjs` 3173 | `AC-6 instructions-follow: ...` | template path `skills/devkit/templates/config.yaml` | the configs name evidence before review (docs) |
| T-11 | `delivery-models.test.mjs` 1453 | `delivery-models P5 workflow (<label>): ...` | template path `skills/devkit/templates/` | the workflow's token stays read-only (CI template) |
| T-12 | `flow-check.test.mjs` 110 | `INSTALL` used by the schema tests | path `skills/devkit/scripts/install-schemas.sh` | the installed schemas are what the checker reads (flow checker) |
| T-13 | `version-pin.test.mjs` 799 | `version-pin AC-6 flow: next, wait, another open, a setup re-run and a pack update leave the pin` | path `skills/devkit/scripts/install-schemas.sh` | a setup re-run leaves a change's pin (version pin) |
| T-14 | `change-loop.test.mjs` 995 | `change-loop start: S3 a folder with no openspec, or another schema, is not set up` | `/\/devkit setup/` matched, and the old name not matched through a regex built by concatenation (D-9) | a project not set up is told the setup command (start) |
| T-15 | `github-setup.test.mjs` 329, 487 (moved) | `format: openspec-setup has the GitHub step: ...`; `field-fixes 5 skill: step 7 ...` | renamed `format: the Setup section has the GitHub step: ...`; the `only if the owner asks` assertion becomes `/\`ship\` and \`merge_method\` are asked in step 5, \`merge\` suggested/`; the rest reads the devkit skill unchanged | one question per GitHub item, nothing applied unconfirmed (skill text) |
| T-16 | `gh-version.test.mjs` 74 (moved) | `gh-version 19: step 1 of SKILL.md names the script and 2.50.0 and says the setup goes on (AC-7)` | none: `../SKILL.md` now resolves to the devkit skill, whose step 1 keeps the text | the `gh` warning never stops the setup (skill text) |
| T-17 | `changes-under-way.test.mjs` 142 (moved) | `field-fixes 7 apply: with the owner answer only the started full-script change gets an approval.md that records no approval; ...` (its `- Why:` line) | `when \/devkit setup replaced the devkit schemas` | the not-applicable approval says why (setup script) |
| T-18 | `change-loop.test.mjs` 972-981 | `change-loop start: S2 no verb or an unknown verb names the commands that exist` | line 979's `pt-BR` prefix becomes `^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit setup e \/devkit project` (the twin of T-19); line 980's `en` regex and the render equalities hold with the new text unchanged | an unknown verb names the verbs (start) |
| T-19 | `roadmap-loop.test.mjs` 816 | `roadmap-loop start: roadmap and status are routed` | the `pt-BR` prefix becomes `^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit setup e \/devkit project` | the `pt-BR` verb list (start) |
| T-20 | `project-loop.test.mjs` 754 | `project-loop start: step 2 without the design pack nothing runs and the reply names the pack` | `/\/devkit setup/` matched | the missing design pack names the setup (project start) |
| T-21 | `project-loop.test.mjs` 1192 | `project-loop next: S23 ship merge with the repository not prepared ends blocked and names what is missing` | none; N-9 adds the negative | the blocked reply lists the missing facts (project loop) |
| T-22 | `compozy-driver.test.mjs` 95 on `compozy-driver` | `compozy-driver readiness: kit-missing when the change loop is not in the workspace` | `/\/devkit setup/` matched | the missing kit names its fix (CompozyOS module) |
| T-23 | the kit tests (`install-kit`, `adoption`, `gen-agents`, `devkit-kit`, `loop-templates`) | their paths (D-10) | paths and first-line comments only; assertions unchanged | the kit installs and regenerates as before (kit) |
| T-24 | `project-loop.test.mjs` 1567 | `project-loop skill: the section sits between Status and Never and every call carries the language` | none: `| setup` goes before `| project [<name>]`, and `## Setup` before `## Roadmap` | the skill's last sections and hint (skill text) |
| T-25 | `change-loop.test.mjs` 2329, `guard.test.mjs` 1578 | `change-loop skill: the frontmatter`; `stage-roles gates: the devkit skill names the mock-up ...` | none: the description keeps `/devkit change`, `Use when` and "the grill, the mock-up, the plan approval, the retro answers" | the skill's frontmatter (skill text) |
| T-26 | `change-loop.test.mjs` 2341-2351 (`every change-loop command and the readout carry the person's language`), 2363, 2459, 2539 (`release-merge-conflict 16: the flow doc and the skill describe the release step as a merge and a plain push`); `roadmap-loop.test.mjs` 1830-1838, 3015-3022 | the skill-wide negatives | none. The Setup text is written to obey them, by D-7's two rewordings: step 4 names "the `flow` command of `/devkit change`", not `change-loop.mjs flow` (line 2341's `--lang` rule on every line naming that call), and step 7's `--method` takes "the merge_method answer of step 5" while step 5 offers the plan's `options` from the JSON, so the file never holds `rebase` (line 2539). Task 2.2 applies both when it moves the text, so gate 2.9 is green | the skill's calls carry the settings, and the skill never describes a history rewrite (skill text) |
| T-27 | `review-round.test.mjs` 2 | a comment naming the setup tests | the comment names the devkit skill's setup tests | none (comment) |
| T-28 | `change-loop.test.mjs` 2448-2451 | `change-loop skill: the sections of D-3 to D-9 and the modes of start` | the `deepEqual` list of `##` headings gains `'## Setup'` between `'## Waiting on GitHub'` and `'## Roadmap'`; the mode list and the negatives before and after `## Roadmap` are unchanged (the Setup steps carry no `##` heading, D-7). Applied in task 2.2, which adds the heading | the devkit skill has exactly these sections, in this order (skill text) |
| T-29 | `roadmap-loop.test.mjs` 1844-1851 | `roadmap-loop skill: the frontmatter and the start modes name the roadmap and the status` | the exact `argument-hint` regex gains the verb `setup`, with its escaped separator, between `status` and `project`, so it matches D-7's hint exactly and nothing else; the rest unchanged. Applied in task 5.3 | the skill's hint lists the verbs, in order (skill text) |

Searched and left unchanged: `guard.test.mjs` 632 (T-3) and `github-setup.test.mjs` 487 (T-15)
slice from `## Never` and from `GitHub (merge mode)`, which the moved text keeps;
`gh-version.test.mjs` 74 (T-16) and the T-5 slices find their steps by the step headings, which the
devkit skill holds once; no test pins step 7's `--method <squash|merge|rebase>` text, so D-7's
rewording breaks none.

New tests. Every name starts `setup AC-<n> <area>: `. Each fails on the base, except N-6, N-7 and
N-16, which pin behaviour that already holds; their task says so.

| Id | File | Test (the condition and its label) |
|---|---|---|
| N-1 | `change-loop.test.mjs` | `setup AC-1 start: setup in a folder with no openspec answers the setup mode with the git root and creates nothing` |
| N-2 | `change-loop.test.mjs` | `setup AC-1 start: setup with an unknown setting, a missing delivery setting or a driver not built still answers the setup mode` (three cases) |
| N-3 | `change-loop.test.mjs` | `setup AC-1 start: setup outside a git repository answers setup-no-repo in both languages and runs nothing` |
| N-4 | `change-loop.test.mjs` | `setup AC-1 start: setups is an unknown verb` (negative) |
| N-5 | `change-loop.test.mjs` | `setup AC-6 drivers: BUILT_DRIVERS is claude and compozy and holds no driver with a round` |
| N-6 | `guard.test.mjs` | `setup AC-1 guard: a typed /devkit setup ends a /devkit change run` (passes on the base) |
| N-7 | `guard.test.mjs` | `setup AC-1 guard: a typed /devkit setup ends a /devkit roadmap run and /devkit status does not` (passes on the base) |
| N-8 | `change-loop.test.mjs` | `setup AC-2 replies: no reply key renders openspec-setup or compozy-setup in either language, and not-set-up, design-pack-missing and both merge-setup reasons name /devkit setup` |
| N-9 | `project-loop.test.mjs` | `setup AC-2 project: the S23 reply lists the missing facts without the setup pointer` (negative of the strip) |
| N-10 | `guard.test.mjs` | `setup AC-2 tree: no file outside the history names the removed setup skills, and neither skill folder exists` |
| N-11 | `guard.test.mjs` | `setup AC-1 skill: the hint lists setup before project, the description names /devkit setup, the skill stays not model-invocable, and Start sends setup to the Setup section` |
| N-12 | `guard.test.mjs` | `setup AC-6 skill: step 8 asks the kit apart from the driver, runs kit-installer on yes and enables devkit-compozy, writes nothing on no, and the compozy driver installs the kit` |
| N-13 | `guard.test.mjs` | `setup AC-5 skill: the Setup section copies no checker, names the version, the packs not enabled and a CI pin that differs` |
| N-14 | `guard.test.mjs` | `setup AC-7 skill: step 5 asks the ship mode with merge suggested and step 7 asks one question per item` |
| N-15 | `guard.test.mjs` | `setup AC-8 old project: the configuration the old skill wrote opens a change with no setup step and its readout reads` (fixture `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/`, the template's bytes at `c1ac8c4` and its `.claude/settings.json`) |
| N-16 | `change-loop.test.mjs` | `setup AC-1 start: setup with an openspec/config.yaml that cannot be read ends with the usage error and exit 3, as the other verbs do` (the fixture holds `openspec/changes/` beside `openspec/config.yaml` made a folder, so `findRoot` finds the root; without it the verb answers `setup` with exit 0. Passes on the base) |
| N-17 | `guard.test.mjs` | `setup AC-4 skill: step 5 writes schema, context, rules and operations only where fill names them, and the block only through setup-block.mjs apply` (pins D-7's step 5 sentence; reads the step through the `5. **Write`..`6. **Check.**` slice of T-5) |
| B-1 | `setup-block.test.mjs` (new) | `setup AC-3 block plan: no config gives every key missing with its default, drivers claude and compozy` |
| B-2 | `setup-block.test.mjs` | `setup AC-6 block plan: a present driver: script is kept with its round and never offered` |
| B-3 | `setup-block.test.mjs` | `setup AC-3 block apply: a first answer set appends the block, readDevkitSettings reads it with no unknown, and budget and design stay comments` |
| B-4 | `setup-block.test.mjs` | `setup AC-4 block apply: nothing missing leaves the file byte-identical and unwritten` |
| B-5 | `setup-block.test.mjs` | `setup AC-4 block apply: one missing tests key is inserted under tests and nothing else moves` |
| B-6 | `setup-block.test.mjs` | `setup AC-4 block apply: an answer for a key already present is refused and nothing is written` |
| B-7 | `setup-block.test.mjs` | `setup AC-6 block apply: a driver not offered is refused` |
| B-8 | `setup-block.test.mjs` | `setup AC-3 block plan: release_tag is asked only with a package.json version` (both cases) |
| B-9 | `setup-block.test.mjs` | `setup AC-7 block plan: ship is asked with merge suggested only with no ship map and no model, and merge_method only when the mode merges` (four cases: no model, `trunk-auto`, `pr`, ship map present) |
| B-10 | `setup-block.test.mjs` | `setup AC-4 block plan: a refused language value is kept and listed, not asked` |
| B-11 | `setup-block.test.mjs` | `setup AC-3 block parser: CRLF kept, a missing final newline added, an empty file read as no block` |
| B-12 | `setup-block.test.mjs` | `setup AC-3 block parser: an inline devkit value, a second devkit line, a tab indent and an openspec/config.yaml that cannot be read are refused with nothing written` (the last case: the config is a folder, and `plan` and `apply` each exit 3 with a stderr line naming the file and no JSON) |
| B-13 | `setup-block.test.mjs` | `setup AC-5 block plan: pluginVersion is devkit-openspec's version and ciPin the workflow's tag` |
| B-14 | `setup-block.test.mjs` | `setup AC-3 block apply: an invalid language, model, ship, merge_method or target, and two-prs without base or test_branch, are refused with exit 3 and nothing written` (one case each: `xx_bad`, `trunk-x`, `auto`, `fast`, `101`, `two-prs` alone) |
| B-15 | `setup-block.test.mjs` | `setup AC-4 block plan: fill names schema, context, rules and operations only when absent, another schema or a context placeholder, and is empty on a filled config` (cases: no config, the template as is, a filled config, a config with `schema: spec-driven`) |
| B-16 | `setup-block.test.mjs` | `setup AC-3 block apply: a usage error exits 2 with nothing written` (an unknown subcommand, standard input that is not one JSON object; the refusals' exit 3 is B-6, B-7, B-12 and B-14) |
| K-1 | `kit-installer.test.mjs` (new) | `setup AC-6 kit: the sibling compozy pack is found` |
| K-2 | `kit-installer.test.mjs` | `setup AC-6 kit: the highest installed version wins and a tie goes to the last path` (under a `CLAUDE_CONFIG_DIR` in a temporary folder) |
| K-3 | `kit-installer.test.mjs` | `setup AC-6 kit: no devkit-compozy exits 3 naming the pack and every location tried` |
| K-4 | `kit-installer.test.mjs` | `setup AC-6 kit: a devkit-compozy with the installer under skills/compozy-setup is not taken` |
| K-5 | `kit-installer.test.mjs` | `setup AC-6 kit: the installer runs with the arguments passed and its exit code returned, and writes only under .compozy` |
| P-1 | `project-settings.test.mjs` (moved) | `setup AC-5 settings: a dry run names a pack set to false and writes nothing` |

The tests use `test-tmp.mjs` for every folder, the file's shared env constant that blanks
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH`, and need the `openspec` CLI 2.x on `PATH`. No test reads git history.

### D-14 The real run (AC-10)

Done by the session that conducts this change, never by `tdd-implementer`. The runs happen in
scratch projects under `/private/tmp/` (macOS: TMPDIR under `/private/tmp`), outside this
repository. Each uses Claude Code with `--plugin-dir` for this worktree's `plugins/core`,
`plugins/openspec` and `plugins/compozy`. Each typed command is a `claude -p "/devkit setup"`
session; each answer is a `claude -p --resume <session id> "<answer>"` turn, because a `-p` session
has no AskUserQuestion and the skill then says the question and ends the turn. Each run's
transcript lines and the commands' outputs are saved to
`openspec/changes/project-setup/proof/<run>.txt`.

| Run | Case | Project | What the file shows |
|---|---|---|---|
| R-1 | first install, kit no | a new git repository with a `package.json` (`test` script, `version`) | the questions in order; `ls openspec/schemas`; `.claude/settings.json`; `openspec/config.yaml` with the block, `ship` `pr`, `release_tag: package.json`; no `.compozy/`; no checker file (`find . -name guard.mjs`); the version named |
| R-2 | re-run, nothing missing | R-1's project | `shasum -a 256 openspec/config.yaml` before and after, equal; no block question asked; the kit question asked again and answered no |
| R-3 | `merge` mode | a scratch clone of a GitHub repository the owner administers | the ship answer `merge`, the GitHub plan, one question per item, each answered no, and the plan run again unchanged: nothing applied |
| R-4 | kit yes | a new git repository | `.compozy/` and its manifest, `devkit-compozy@devkit` enabled, the installer's per-file lines |
| R-5 | driver `compozy` | a new git repository | `compozy` and `claude` offered, `script` not; `compozy` chosen; the kit installed with no kit question |
| R-6 | the conducting session's own part | R-1's project | a `-p` session asked in plain words to set the project up runs no setup (no file changes, `git status --short` empty); the typed `/devkit setup` of R-1 is the one that ran |

A run that cannot happen (no GitHub repository for R-3, the host refusing) is recorded in its file
with the reason, and the owner decides at the evidence whether it counts.

### D-15 Release

devkit-openspec, devkit-compozy and the marketplace each take the next free minor version on
`origin/main` at the last merge before review. The version goes in `plugin.json` and
`marketplace.json`, with a `CHANGELOG.md` entry. devkit-core keeps its version: only a test comment
changes, and its pack ships no test file to a project. The tag `v<devkit-openspec version>` is
pushed after the merge by the delivery loop (`release_tag`). This repository's `.compozy/` is
installed again after the devkit-compozy bump, so its manifest records the new pack version
(`adoption.test.mjs`).

## Risks / Trade-offs

- [A sibling merges into `main` after the plan and moves a line this plan names] → D-12, step 6:
  every merge of `main` is followed by the re-read, and the line numbers here are hints; the tests
  are the contract.
- [The kit installer is not found on an owner's machine (devkit-compozy not installed, or 0.4.0)] →
  the reply names the pack and the locations (K-3, K-4); the kit is opt-in (ADR 0022, Consequences).
- [A re-run asks the optional keys the owner left unset again (coverage, E2E, delivery, kit)] →
  accepted: nothing records a "no", and the old skill asked them again too. A no writes nothing, so
  the file stays byte-identical (AC-4).
- [The block writer meets a hand-written block in a shape it does not read] → it refuses with
  nothing written (B-12); the owner edits by hand.
- [A typed `/devkit setup` in a roadmap session ends the run's hold] → that is the existing rule for
  any typed command but `/devkit status`, pinned by N-7; `/devkit roadmap` resumes.
- [Owners who learned `/openspec-setup`] → every message names `/devkit setup`; ADR 0022 accepts it.

## Migration Plan

Projects set up with the old skills need no step (N-15, AC-8). The next re-run is `/devkit setup`.
Rollback: revert the merge commit. The moved scripts return to the two skill folders, and projects
are unaffected, because no file a project holds changes shape. A project that ran the new step has
only keys the old readers already read.

## Implementation plan

Order: the start mode and the driver list (no dependency), then the scripts, then the moves with the
skill text, then documents and release, then the real runs.

- **devkit-openspec (hooks)**: `change-loop.mjs` (D-1, D-2, D-8), `flow-check.mjs`, `guard.mjs`,
  `merge-setup.mjs`, `project-loop.mjs`, `compozy-driver.mjs` (D-8).
- **devkit-openspec (skill)**: `skills/devkit/SKILL.md` (D-7), the moved `scripts/` and `templates/`,
  `setup-block.mjs`, `kit-installer.mjs` and their tests, the old-setup fixture;
  `skills/ship-change/SKILL.md`; `skills/openspec-setup/` removed.
- **devkit-compozy**: `kit/` (moved), `skills/compozy-setup/` removed, regenerated agents,
  `README.md`, `plugin.json`.
- **Repository**: `.compozy/`, `.github/workflows/ci.yml`, docs, ADRs, specs' Purpose, config,
  changelog, marketplace.

Files to create: `plugins/openspec/skills/devkit/scripts/setup-block.mjs`, `setup-block.test.mjs`,
`kit-installer.mjs`, `kit-installer.test.mjs`, `scripts/fixtures/old-setup/config.yaml`,
`scripts/fixtures/old-setup/settings.json`, `openspec/changes/project-setup/proof/*`.
Files to delete: `plugins/openspec/skills/openspec-setup/SKILL.md`,
`plugins/compozy/skills/compozy-setup/SKILL.md`. Files to move: D-10. Files to modify: D-7, D-8,
D-10, D-11, D-13.

Estimate: optimistic 26 h, likely 36 h, pessimistic 52 h (the pessimistic case: a second sibling
merge, or the real runs needing host workarounds).

| Component | Hours | Type | Risk |
|---|---|---|---|
| Merge of `main` after `compozy-driver`, re-read (task group 1) | 1.5 | Integration | MEDIUM |
| `setup-block.mjs` with its tests B-1 to B-16 | 9 | Core | MEDIUM |
| `kit-installer.mjs` with K-1 to K-5, P-1 | 3 | Core | LOW |
| Start mode, `BUILT_DRIVERS`, replies and messages, N-1 to N-9, T-7 to T-22 | 5 | Core | LOW |
| Moves, path fixes, regenerated agents, `.compozy/`, CI (D-10, T-1 to T-5, T-23, T-28) | 4 | Migration | MEDIUM |
| The `## Setup` section, `## Never`, ship-change, N-10 to N-17 | 5 | Core | MEDIUM |
| Documents, ADRs, Purpose edits, delta revision, catalog, changelog, versions | 3.5 | Documentation | LOW |
| Whole suite runs and fixes | 2 | Testing | MEDIUM |
| Real runs R-1 to R-6 | 2.5 | Testing | MEDIUM |

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `compozy-driver` not merged, or merged with `compozy` still not built | LOW | HIGH | gate 1.4 stops the change before any code; the owner decides |
| `compozy-driver` merged but not archived by the last phase | MEDIUM | MEDIUM | task 6.5 waits on it, after the documents; the delta revision and N-10's green run are the only things that need it |
| A pinned text missed by the grep | MEDIUM | LOW | the whole suite in gates 2.9 and 7.8; N-10 fails on any old name left |
| Regenerated agents drift from `.compozy/` | LOW | MEDIUM | `gen-agents.mjs --check` and `adoption.test.mjs` in the gates |
| The host's `-p` mode cannot run a typed skill with answers by `--resume` | LOW | MEDIUM | D-14: an interactive session run instead, recorded the same way |
| The suite's long run on a full machine | MEDIUM | LOW | the whole suite runs only in gates 2.9 and 7.8, as a background command of the tool |
| A re-run edits `openspec/config.yaml` outside the block | LOW | HIGH | `fill` (D-3) decides it in a script, B-15 tests it, N-17 pins step 5's sentence, R-2 compares the bytes |
| Two records numbered 0022 from task 1.1 to task 6.6 | HIGH | LOW | every link to this change's record names its file, not only its number; task 6.6 renumbers it with every link (D-11) |

Assumptions (where the plan breaks if reality differs):

- `compozy-driver` lands as on its branch at `cb39d27`: `DRIVER_ROUND = { script: 22 }`, the kit
  under `skills/compozy-setup/` with `gen-agents.mjs`, its record
  `0022-compozy-runs-the-short-loop.md` (requirements, assumption 4; gate 1.4; task 1.2).
- `--plugin-dir` places packs as siblings named by folder (`plugins/openspec`, `plugins/compozy`),
  as earlier live checks used it (`openspec/changes/archive/2026-11-22-project-phases/tasks.md`,
  task 5.2).
- The host refuses a model call of a skill with `disable-model-invocation: true`
  (`roadmap-loop.test.mjs` line 2993 relies on it for the `devkit` skill).

Dependencies: `compozy-driver` merged (D-12; its archive for task 6.5); the archived
`delivery-models` (the delivery keys and `MODEL_SHIP`), `change-version-pin` (the pin this step
leaves) and `gh-version-check` (step 1's `gh` line).
