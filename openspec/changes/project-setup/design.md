<!-- devkit-stage design result=passed attempt=1 commit=df0beb015918e8ea5344202a3eeb41ebbfdda78c -->
# Design

Change: `project-setup` · Date: 2026-11-23, revised 2026-11-25 (D-14 note) · Owner: Kaue (chacal88)
· PRD / tech spec: n/a (motivation: `proposal.md`; requirements: `requirements.md`; decision record:
`docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`, called "the record" below). Base:
the branch `project-setup` after its last merge of `origin/main` (at this revision the merge
`f1dcefa`, which brought `c09860c`: the delivery train on in this repository; trains 1 to 4 with
`own-pr-archive-paths`, `release-merge-leftovers` and `archive-release-pin`; trains 5 to 9 with
`post-merge-validate` (the loop's `merge-check` step), `loop-place-and-evidence`,
`project-slice-claim`, `state-skips-unlocated`, `jira-entry-followups` and
`stage-ceiling-consecutive`; the train records `openspec/trains/1.md` to `9.md`; and the archives of
`compozy-driver`, `delivery-train`, `stage-models`, `suite-speed`, `stale-only-on-own-files` and
`loop-place-and-evidence`), re-read on 2026-11-24 with no fetch. The first draft was written against
`origin/main` at `c1ac8c4`, later revisions against `f81f53b` (`cf34ff2`) and `6569874`
(`c663f21`); every fact below was re-read on the merged tree. `main` keeps moving, so this design
cites functions, files, headings and test names by name and gives no line number: a test is found
by its name (`grep -rn`), and the tests are the contract.

## Context

- Two skills set a project up today. `plugins/openspec/skills/openspec-setup/` (`SKILL.md`, seven
  scripts with their tests, `scripts/fixtures/schemas-0.13.0/`, `templates/config.yaml`,
  `templates/devkit-reviews.yml`) does the OpenSpec and `gh` checks, the opt-in, the schemas, the
  config and the GitHub step. `plugins/compozy/skills/compozy-setup/` (`SKILL.md`, `install-kit.mjs`,
  templates, tests) installs `.compozy/`.
- The verbs of `/devkit` are decided by `startMode` in `plugins/openspec/hooks/change-loop.mjs`. Its
  verb list (`['change', 'roadmap', 'status', 'project', 'train']`, the check that answers
  `unknown-verb`) is followed by the project gate `projectGate`, so a verb that must run in a project
  that is not set up has to be answered before that gate. The replies that name the old skills are
  `not-set-up`, `compozy-kit-missing`, `blocked-why.merge-setup`, `design-pack-missing` and
  `blocked-why.merge-setup-missing`, in `en` and in `pt-BR`; `verb-unknown` lists the verbs.
- The drivers: `DRIVERS = ['claude', 'compozy', 'script']` (exported) and
  `DRIVER_ROUND = { script: 22 }`, so `compozy` runs. `compozy-driver` rewrote
  `compozy-setup`: 21 generated agents, three loops, `gen-agents.mjs`, retired-file handling. It added
  the reply `compozy-kit-missing` and `compozy-driver.mjs`'s fix text `kit-missing`, both naming
  `/compozy-setup`. CI runs `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check`
  (the `CompozyOS agents are up to date` step), and `CLAUDE.md` names it. Its record is
  `docs/adr/0024-compozy-runs-the-short-loop.md`. It is archived
  (`openspec/changes/archive/2026-11-24-compozy-driver/`): the canonical `compozy-kit-setup` spec
  holds its text, the requirement "The kit runs the new stages in its four shells" is gone from it,
  and the three requirements it added name `compozy-setup` (D-12, step 4). The siblings' versions are
  read again at every later merge (D-12) and are not quoted here. This change's record takes the
  next free number on `origin/main` at the last merge before review; its file name carries that
  number today (0031: `origin/main` at `c09860c` holds 0025, 0026, 0027, 0029 (`project-slice-claim`)
  and 0030, and the open change `forced-merge-path` claims 0028 on its branch), and every reference
  to it names the file.
- `suite-speed` (archived; record `0026-the-devkit-test-suite-runs-by-file-in-parallel.md`)
  replaced the test command. The suite is `node scripts/test-suite.mjs [--test-name-pattern=<re>]
  [<test file>...]`: it runs every `*.test.mjs` of the folders listed in `SUITE_FOLDERS`, each file in
  a process of its own with its own `TMPDIR`, refuses a test file that imports a test file, and exits
  2 on a file argument that is not in those folders. `guard.test.mjs` imports no other test file any
  more. Two of the four folders are `plugins/openspec/skills/openspec-setup/scripts` and
  `plugins/compozy/skills/compozy-setup/scripts`, the folders this change moves (D-10), and
  `plugins/openspec/hooks/test-suite.test.mjs` pins both names (its constants `SETUP` and
  `COMPOZY_SETUP`). A folder the script cannot find reads as empty, so after the move the moved tests
  would silently stop running unless the list moves with them (T-31). It also split several suites:
  the skill-text tests of the change loop are in `change-loop-compozy.test.mjs`, those of the roadmap
  loop in `roadmap-loop-followups.test.mjs` and `roadmap-loop-upfront.test.mjs`, the train's verb and
  document tests in `delivery-train-after.test.mjs`, and the CLI and document tests of the delivery
  checker in `deliver-check-cli.test.mjs` (D-13). It has no spec delta, so it overlaps no requirement
  of this change. `CLAUDE.md`'s suite row, the suite paragraph of `CONTRIBUTING.md` (which lists the
  four folders) and the `Test suite` step of `ci.yml` name the new command; `suite-speed AC-7` and
  `suite-speed AC-8` pin those documents.
- `delivery-train` (archived) added a sixth verb, `/devkit train`, with the replies
  `train-args` and the train replies, a `## Train` section of the `devkit` skill right after
  `## Waiting on GitHub`, the script `plugins/openspec/hooks/train-loop.mjs` and the suites
  `plugins/openspec/hooks/delivery-train.test.mjs` and `delivery-train-after.test.mjs`.
  `verb-unknown` now lists `change, roadmap, status, project, train`, and the skill's
  `argument-hint` reads `... | status | train | project [<name>]`. `train-loop.mjs`'s `nextAction`
  strips the old setup pointer from `mergeSetup`'s facts with its own copy of `project-loop.mjs`'s
  regex (D-8). Its archive wrote the `change-coordination` requirement this change MODIFIES (D-12,
  step 7).
- `stage-models` (archived) added the `models:` table and `stage-models.test.mjs`. It
  names neither old skill and touches no file this plan edits beyond what D-13 lists; the setup asks
  no `models` key (requirements, Out of scope).
- What the merges of `c663f21` and `c09860c` brought beside the archives, and what it means here:
  - The delivery train is on in this repository: `openspec/config.yaml` sets `devkit.delivery`
    (`model: trunk-auto`, `train: "node scripts/test-suite.mjs && python3 scripts/check.py"`) next
    to its `ship:` map, all `merge` (ADR 0022). A reviewed change boards and leaves on a train; the
    departure renumbers its release above the train's numbers, and the train's merge commit is the
    one tagged (CONTRIBUTING, D-15). The setup step's own handling of `delivery.train` is unchanged:
    it never writes or removes it, and lists a refused one in `kept` (D-3).
  - A merge of the base stales the evidence and reviews only when it brings one of the change's own
    files (`stale-only-on-own-files`, `docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md`;
    the own-files rule of `docs/openspec-flow.md`). D-12's re-reads after a merge stay; they no
    longer imply a new review round by themselves.
  - `archive-release-pin` (merged on train 4, not archived; `docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md`):
    the test `change-loop docs: the design records the answers` (`change-loop-compozy.test.mjs`)
    reads the expected CI pin from `plugins/openspec/.claude-plugin/plugin.json` through
    `pinMismatches`, so a devkit-openspec release moves the CI pins of `docs/openspec-flow.md` and
    edits no test (D-15). Its fixtures `plugins/openspec/hooks/fixtures/c561553/openspec-flow.before.txt`
    and `openspec-flow.after.txt` hold the bytes of `docs/openspec-flow.md` at a past commit, the
    sentence "The openspec-setup script resolves the tag" included; `archive-release-pin 1` and
    `archive-release-pin 6` (`deliver-check-archive.test.mjs`) read them as they are (D-9).
  - The train records `openspec/trains/<n>.md` (one per departure, written by `train-loop.mjs`) hold
    each train's suite output, so `openspec/trains/7.md` names the test paths under
    `plugins/compozy/skills/compozy-setup/scripts/` and `plugins/openspec/skills/openspec-setup/scripts/`,
    and every record of a train that leaves before this change's will. They are history, like
    `openspec/changes/` and `CHANGELOG.md`: N-10 skips the folder and no record is edited (D-9,
    point 1).
  - `post-merge-validate` (merged by trains 5 to 9, not archived) gave the loop a `merge-check` step: after
    every merge of the base, before the evidence and any push, the session runs `openspec validate
    <id> --type change --strict` once for that merge, and a red check goes to the planner as a merge
    defect (`docs/openspec-flow.md`, "The loop"). Its spec delta ADDS requirements to
    `change-coordination` and modifies neither requirement this change MODIFIES (D-12, step 7). The
    Workflow follow-up of `tasks.md` names the step.
  - `project-slice-claim` took ADR 0029. It, `post-merge-validate`, `loop-place-and-evidence`
    (archived), `state-skips-unlocated`, `jira-entry-followups` and `stage-ceiling-consecutive`
    edited files this plan also edits (`change-loop.mjs`, `project-loop.mjs`, `guard.mjs`, the
    `devkit` and `ship-change` skills, `docs/openspec-flow.md`, `plugins/openspec/README.md` and
    several suites of D-13), but none of the texts, functions, headings or tests this plan changes:
    their skill edits are in the `## Loop` section and the `commit` and `review` rows. No source or
    test line they added names an old skill; the train records are the only new files that do.
  - `CONTRIBUTING.md` asks every test file to stay under about 300 s in the suite's summary; on the
    recorded full runs `change-loop.test.mjs` took 371 s
    (`openspec/changes/archive-release-pin/proof/full-suite.txt`) and 338.9 s (train 7's record), and
    `guard.test.mjs` 67 s and 48.2 s (Risks).
  - No code claim of this design moved at either merge: `startMode`'s verb list, `projectGate`, the
    reply keys of D-8, `readDevkitSettings`, `trainSetting`, `deliveryConfig` and `MODEL_SHIP`, the pointer and
    both strips, `FIX['kit-missing']`, `SUITE_FOLDERS` and the skill's headings read as before.
    `flow-check.mjs` gained the own-files staleness only; its `schema-without-declaration` text is
    unchanged.
- The `devkit` skill's `##` headings on the merged tree, as `change-loop skill: the sections of D-3 to
  D-9 and the modes of start` (`change-loop-compozy.test.mjs`) pins them: `Settings, Start, On the CompozyOS driver, A new change, Loop, Owner gates, Waiting on
  GitHub, Train, Roadmap, Status, Project, Never`. `## Start`'s first item ends "When the JSON's
  `settings.driver` is `compozy`, read the next section instead of the lines below", and
  `## On the CompozyOS driver` lists `new`, `resume`, `choose`, `ask-unfinished`, `roadmap`, `status`
  and `driver-no-project` only (D-7).
- devkit-compozy also ships the skills `screen-design` and `screen-demo`. They stay (round 24 removes
  them, `docs/coordination-design.md`).
- The project's config is read with one-level parsers that this change reuses and does not change:
  `parseDevkitBlock` and `deliverySettings` (`guard.mjs`), `readDevkitSettings` (`change-loop.mjs`),
  `readTestSettings` (`flow-check.mjs`), `parseShip`, `parseMergeMethod` and `deliveryConfig`
  (`deliver-check.mjs`). `deliveryConfig` refuses a `ship:` entry that disagrees with
  `devkit.delivery.model` (`MODEL_SHIP`: `trunk` and `two-prs` are `pr`, `trunk-auto` is `merge`;
  under `two-prs` any `ship:` entry for the schema disagrees).
- The CI pin a project records is the commit of the tag `v<devkit-openspec version>` in
  `.github/workflows/devkit-reviews.yml`. `github-setup.mjs` writes it (its `workflow` item) in
  `merge` mode (ADR 0002, ADR 0019). Each change also records `x-devkit-version` when it opens
  (change-version-pin). No other file of a project records the version.
- Decisions this design follows: ADR 0004 (per-project opt-in; amended), ADR 0009 (CompozyOS as a
  second driver; its Decision kept), ADR 0010 decision 1 (what lives under the project's `openspec/`),
  ADR 0018 (delivery model; and its rejected fourth downloaded checker file), ADR 0002 (merge mode
  by opt-in), ADR 0019 (the release tag), ADR 0022 (the delivery train this repository's release
  leaves on; D-15), the record
  `docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md` (the one suite command and the
  folders it reads; D-10, T-31), the record
  `docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md` (a
  release moves the flow page's CI pins and edits no test; D-15), and the proposed record
  `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md`.

## Goals / Non-Goals

**Goals:**

- One verb, `/devkit setup`, accepted only from the owner's typed command (the `devkit` skill is
  not model-invocable, as for `/devkit change`), the same for a first install and a re-run.
- Every decision the step makes about the `devkit:` block is a script, tested, never prose. The
  session asks the questions and says the facts.
- The old skills' scripts keep their behaviour and their tests in their new place.

**Non-Goals:**

- Changing what any checker or hook decides, or any `flow.json`.
- Recording the plugin version in a new key, or copying a checker.
- Registering a CompozyOS workspace or starting a run. `/devkit change` on the `compozy` driver
  already says what is missing (compozy-driver).
- An alias for the old skill names (the record, alternative 2, rejected).

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

The verb list of `startMode` (`['change', 'roadmap', 'status', 'project', 'train']`) stays as it is,
because the branch above answers `setup` before that check is reached. Only the `verb-unknown`
reply gains `/devkit setup` (D-8). `setup` answers the same way whatever `settings.driver` holds;
the skill's `## Start` then sends it to the Setup section on every driver (D-7).

Typed only: the `devkit` skill keeps `disable-model-invocation: true` (the host refuses a model call
of the skill), as for `/devkit change`. `guard.mjs` already ends a `/devkit change` run on any other
typed command (`runOf`), and a `/devkit roadmap` run on any other typed command but `/devkit status`
and `/devkit train` (`roadmapRunOf`), so a typed `/devkit setup` ends their hold with
no code change. Two tests (N-6, N-7) pin that. "Typed only" covers the skill and nothing more: a
request in plain words makes no Skill call, so the skill's `## Start` never sends it to the Setup
section. Nothing in this change refuses a session that reads the Setup section's scripts on disk
and runs them by hand (R-6, evidence finding F-1); the owner chose to keep it that way in this change
and to propose the refusal at the retro (D-14, the owner's decision of 2026-11-25).

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
`LANGUAGE_TAG`. `LANGUAGE_TAG` (the language-tag regex of `change-loop.mjs`) becomes an export
of `change-loop.mjs`, unchanged, so the loop and the writer check a language with one regex (the
project rule "one shared helper per mechanism").

`node setup-block.mjs plan <root> --json` reads only and prints one JSON object:

| Field | Value |
|---|---|
| `version` | `1` |
| `config` | `absent` or `present` (`openspec/config.yaml`) |
| `block` | `absent` or `present` (a column-0 `devkit:` line) |
| `present` | the values already held: `language`, `driver`, `delivery`, `tests`, `ship` (the map), `merge_method`, `release_tag` |
| `kept` | the present values the loop refuses, each `{ setting, value, accepted }`: every entry of `readDevkitSettings(root).unknown` and `.missing`, and, when `readDevkitSettings(root).train.problem` is `{ kind: 'train-model' }` (a `delivery.train` with no model or with `two-prs`, which `projectGate` refuses with `train-model` or `train-no-model`), one entry `{ setting: 'delivery.train', value: <the train value>, accepted: 'trunk, trunk-auto' }` |
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
  `main`. When `kept` holds the `delivery.train` entry, the options are only `trunk` and `trunk-auto`
  and the default is `trunk`: the two models the train runs with, so an answer leaves the project
  runnable; `none` and `two-prs` are then refused by `apply` as outside the options. The step never
  writes or removes `delivery.train` (Out of scope); with `model: two-prs` present, `delivery` is not
  in `missing`, and the step only says the `kept` fact (the owner edits the block by hand).
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
installer into devkit-openspec (the record, alternative 4, rejected).

### D-5 What the step records and names (AC-5)

- No checker file is copied. The schemas come from `install-schemas.sh` as before, and the CI
  downloads its checkers at the pinned commit as before.
- The version: the step's report names `pluginVersion` ("the schemas come from devkit-openspec
  <v>"). In `merge` mode the GitHub step's `workflow` item writes the pin to the commit of
  `v<pluginVersion>` (unchanged `github-setup.mjs`). When `ciPin` differs from `v<pluginVersion>`,
  the report says so and that the `workflow` item moves it. The pin a project records stays the CI
  pin (requirements, assumption 2; the record's decision 3). No new key.
- The packs: before the opt-in, the step runs
  `node <skill-dir>/scripts/project-settings.mjs <root> --packs <list> --dry-run --json`. It names
  each item whose action is not `ok` by its pack. The list is `devkit-core,devkit-openspec`, plus
  `devkit-design` when the owner wants `/devkit project`, plus `devkit-compozy` when the kit is
  installed or wanted. Then it writes the opt-in as before. `project-settings.mjs` already reports
  `enable` and `enable (was false)` per pack; only a test is added (P-1).

### D-6 The kit and the driver (AC-6)

- The kit question is asked when `kit` is `absent` and the driver answer is not `compozy`. A no
  writes nothing for the kit, and the question is asked again on a later run.
- A yes, or the answer `compozy`, runs `kit-installer.mjs <root>`. The only input the step asks is
  `__TIMEZONE__`, once, when the manifest does not record it. `substitutions.json` also lists
  `__SCREEN_MAP__` and `__MOCKUP__`; no template uses them and the installer records their defaults,
  so they are never asked. The installer prints one line per file. For each `edited` or `kept`
  file the step shows the difference and asks one question; it re-runs with `--accept` for the files
  that got a yes, as `compozy-setup` did. Then the opt-in adds `devkit-compozy`.
- `kit: installed` on a re-run: the installer runs again with no kit question, so the kit's
  templates update as the old skill's re-run did.
- The old skill's step 3 (writing a `design:` block) is not carried. `design:` stays a commented
  example of the template, and the report says the block is set by hand when the project tracks
  screens. Requirements, Out of scope: "writing `budget` or the `design:` block".

### D-7 The skill text: `plugins/openspec/skills/devkit/SKILL.md`

- The position of `setup` among the verbs, named once here and used by every list of them (the
  `argument-hint`, the "Use when" list, the `verb-unknown` reply of D-8 and the spec delta of
  `change-coordination`): `setup` comes right after `status`. Every other verb keeps its place in
  each list, `train` included.
- Frontmatter. `description` adds one short sentence, right after the sentence "/devkit train
  departs the boarded changes of a project with a delivery train, together on one train." (kept
  word for word, as `delivery-train docs: the documents follow` pins it): "/devkit setup sets the project up for the
  devkit flow, or updates its setup." The "Use when" list becomes "... /devkit status, /devkit setup,
  /devkit train or /devkit project [<name>]." `argument-hint` becomes
  `"change [<request> | <change-id> | <Jira key or link>] | roadmap [<n> | stop] | status | setup | train | project [<name>]"`.
  The last part stays `| project [<name>]`, which T-24 pins. `disable-model-invocation: true` stays.
- `## Start`: the mode list adds `setup-no-repo` to the "say `reply` and end the turn" item, and an
  item "`setup`: the Setup section below, in `root`, whatever the driver". The sentence that ends
  the first item, "When the JSON's `settings.driver` is `compozy`, read the next section instead of
  the lines below", becomes "When the JSON's `settings.driver` is `compozy` and the mode is neither
  `setup` nor `setup-no-repo`, read the next section instead of the lines below." So a re-run of
  `/devkit setup` on a project whose driver is `compozy` runs the Setup section as on every other
  driver (AC-4, R-5), and `## On the CompozyOS driver` gains no item and is not otherwise edited.
  N-11 pins the new sentence and the `setup` item.
- A new `## Setup` section right after `## Train` and right before `## Roadmap`. `## Train` stays the
  heading right after `## Waiting on GitHub` (`delivery-train docs: the documents follow`). It is the only new `##`
  heading: the old skill's `# Set up the devkit flow in a project` title and its `## Steps` heading
  are not carried, its intro and path list become the section's first paragraph, and its steps are
  the numbered list items below, with no `##` or `###` heading of their own. Its `## Never` items
  join the skill's `## Never` (below). So the skill's `##` headings become `## Settings`, `## Start`,
  `## On the CompozyOS driver`, `## A new change`, `## Loop`, `## Owner gates`,
  `## Waiting on GitHub`, `## Train`, `## Setup`, `## Roadmap`, `## Status`, `## Project`,
  `## Never`: the list T-28 pins, whose last three stay `## Status`, `## Project`, `## Never`
  (T-24). The section stays out of the slices the tests take with negative assertions
  (`## Start`..`## A new change`, `## Roadmap`..`## Status`, `## Status`..`## Never`,
  `## Project`..`## Never`, and the text before `## Roadmap`, which T-28 checks for the Roadmap's
  tools). Two slices hold it and assert only what they must find: `## Train`..`## Roadmap`
  (`delivery-train docs: the documents follow`, the train section's words) and `## Waiting on
  GitHub`..`## Never` (`change-loop skill: the wait is started in the background on a GitHub wait`, the background wait); the Setup text adds
  lines to them and removes none. Paths are `<skill-dir>/scripts/...` and
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
    `/devkit change`, only on the owner's request)": `change-loop skill: every change-loop command and the readout carry the person's language` requires every
    line naming `change-loop.mjs flow` to carry `--lang ${user_config.language}`, and this line is
    not a call.
  - Step 7's "(add `--method <squash|merge|rebase>` for another merge method, ...)" becomes "(add
    `--method <the merge_method answer of step 5>` when it is not `squash`, ...)". The script's
    accepted values are unchanged (`github-setup.mjs`, its tests); the owner still chooses
    `rebase` through step 5's options.
- Constraints the whole file must keep (tests T-26): no `--lang en`/`--lang pt-BR`, no unquoted
  heredoc, no `rebase`, `push-rebased` or `--force` anywhere in the file
  (`release-merge-conflict 16: the flow doc and the skill describe the release step as a merge and a plain push`, unchanged: its invariant is that
  the skill never describes a history rewrite, and the two rewordings above keep the Setup text
  inside it), no `CronCreate`, `conduct-check` or `wake_when_done` before `## Roadmap`. Every
  `change-loop.mjs` call carries `--lang ${user_config.language}`.
- `## Never` gains the old skill's items, worded for the setup: overwrite an existing
  `openspec/config.yaml` wholesale or remove the owner's rules; leave a `<placeholder>` in
  `context`; commit in a setup; install a pack at user scope, run `claude plugin install` without
  `--scope project`, or edit `~/.claude/` or `.claude/settings.local.json`; "Change GitHub settings
  without the owner's confirmation of that item, or apply an item that was not confirmed." (T-15
  pins this one.)
- `plugins/openspec/skills/ship-change/SKILL.md`'s sentence on "the `openspec-setup` GitHub step" and
  its row `stop-merge-setup` name "the GitHub step of `/devkit setup`".

### D-8 Replies and messages

| Where | Key or line | New text (`en`; `pt-BR` below it) |
|---|---|---|
| `change-loop.mjs` | `not-set-up` | `This project is not set up for devkit yet: type /devkit setup first. Nothing was run.` / `Este projeto ainda não está preparado para o devkit: digite /devkit setup primeiro. Nada foi executado.` |
| `change-loop.mjs` | `verb-unknown` (all six verbs, `setup` right after `status`, D-7) | `So far /devkit change, /devkit roadmap, /devkit status, /devkit setup, /devkit project and /devkit train exist: type /devkit change and what you want done, /devkit roadmap to run the roadmap, /devkit status to see where everything is, /devkit setup to set this project up or update its setup, /devkit project and a name to plan a new project or slice, or /devkit train to send the boarded changes on one train.` / `Por enquanto existem /devkit change, /devkit roadmap, /devkit status, /devkit setup, /devkit project e /devkit train: digite /devkit change e o que você quer fazer, /devkit roadmap para rodar o roadmap, /devkit status para ver onde está tudo, /devkit setup para preparar este projeto ou atualizar a preparação, /devkit project e um nome para planejar um projeto ou uma fatia nova, ou /devkit train para mandar as changes embarcadas em um trem só.` The ending of each text (the `/devkit train` clause) is the one `delivery-train P13: the reply to an unknown verb names /devkit train, in order, in both languages` (`delivery-train-after.test.mjs`) pins, unchanged. |
| `change-loop.mjs` | `setup-no-repo` (new) | `/devkit setup runs inside a git repository: open the project's folder, or create its repository there first. Nothing was run.` / `/devkit setup roda dentro de um repositório git: abra a pasta do projeto, ou crie o repositório dele ali primeiro. Nada foi executado.` |
| `change-loop.mjs` | `design-pack-missing` | `The project flow needs the devkit-design pack in this project: type /devkit setup and enable the devkit-design pack, then call /devkit project again. Nothing was run.` / `O fluxo de projeto precisa do pacote devkit-design neste projeto: digite /devkit setup, ative o pacote devkit-design e chame /devkit project de novo. Nada foi executado.` |
| `change-loop.mjs` | `blocked-why.merge-setup` | `the repository is not prepared for automatic merging yet, which the GitHub step of /devkit setup does` / `o repositório ainda não está preparado para o merge automático, que a etapa do GitHub de /devkit setup prepara` |
| `change-loop.mjs` | `blocked-why.merge-setup-missing` | `the repository is not prepared for automatic merging yet ({list}), which the GitHub step of /devkit setup does` / `o repositório ainda não está preparado para o merge automático ({list}), que a etapa do GitHub de /devkit setup prepara` |
| `change-loop.mjs` (from `compozy-driver`) | `compozy-kit-missing` | `run /compozy-setup first, then call /devkit again` becomes `type /devkit setup and answer yes to the kit, then call /devkit again`; `rode /compozy-setup primeiro e chame /devkit de novo` becomes `digite /devkit setup, responda sim ao kit e chame /devkit de novo`. The rest of each text is kept. |
| `compozy-driver.mjs` | `FIX['kit-missing']` | `/devkit setup installs the devkit kit into this project (answer yes to the kit question)` |
| `flow-check.mjs` | `schema-without-declaration` | `the schema has no flow.json: the project has not re-run /devkit setup` / `o schema não tem flow.json: o projeto ainda não rodou /devkit setup de novo` |
| `guard.mjs`, `changeFlow` | `FlowUsageError` text | `... re-run /devkit setup with a devkit-openspec that ships it` |
| `merge-setup.mjs` | `POINTER`, now exported as `SETUP_POINTER`, and a new export `withoutSetupPointer(m)` | `; run the GitHub step of /devkit setup to configure it`. `withoutSetupPointer(m)` returns `m.endsWith(SETUP_POINTER) ? m.slice(0, -SETUP_POINTER.length) : m`: the one helper both strips below call (the project rule "one shared helper per mechanism"). The comment "The ruleset `openspec-setup` creates" names `/devkit setup`. |
| `project-loop.mjs`, `decideSlice` | the strip of the pointer | `setup.missing.map(withoutSetupPointer)`, importing it from `merge-setup.mjs` in place of the regex `/; run the openspec-setup skill.*$/` (behaviour unchanged) |
| `train-loop.mjs`, `nextAction` (from `delivery-train`) | the strip of the pointer in the blocked train reply | `setup.missing.map(withoutSetupPointer)`, added to the file's existing `merge-setup.mjs` import, in place of the regex `/;\s*run the openspec-setup skill.*$/` (behaviour unchanged: the reply lists the missing facts, then `github-setup.mjs --method merge allows merge commits and auto-merge`). N-18 pins it |
| `changes-under-way.mjs` | the header comment and the `- Why:` line written into `approval.md` | `... when /devkit setup replaced the devkit schemas ...`. An `approval.md` already written keeps its text. |
| `templates/config.yaml` | the comment on `merge` and the GitHub step | `` `merge` needs the GitHub step of /devkit setup first (workflow, `` |

`templates/config.yaml` also gains two commented examples under its existing `# devkit:` example, a
`#   budget: 200000` line and a `# design:` example with its two keys. Those are the only places
`budget` and `design:` appear (AC-3). They reach a project's file only when step 5 starts from the
template, that is when no `openspec/config.yaml` exists at step 5. When the project had no
`openspec/` folder, step 3's `openspec init` writes the file first, and step 5 then adds only the
block, the `ship:` map, `merge_method` and the parts `fill` names, so the file holds neither key at
all (evidence O-4; the spec's "The setup asks each key of the devkit block" and "The setup asks for
the project's test commands" state both paths, with no change of behaviour). The heading line, and
the rule that every line of the block is a comment, stay (T-5).

### D-9 What "named nowhere" covers (AC-2)

Decision records (`docs/adr/`), past `CHANGELOG.md` entries, change folders (`openspec/changes/`,
the archive included) and train records (`openspec/trains/`) keep their text: they are history.
The record says so of ADR 0019's Context.
The new `CHANGELOG.md` entry names the removed skills to say they are removed. ADR 0004 keeps its
Decision text and gets a Note (D-11). Everything else is checked by one test, N-10. It walks the
repository's working tree, never git history (config rule "Test history"), and fails on any line
holding `openspec-setup` or `compozy-setup`, naming the file and the line. What it skips, and why:

1. History, by folder or file: `.git/`, `node_modules/`, `docs/adr/`, `openspec/changes/` (the
   archive included), `openspec/trains/` and `CHANGELOG.md`. A train record holds the suite output
   of its departure, test paths included (`openspec/trains/7.md` names the setup and kit tests under
   the two removed folders), and the train loop writes one per departure; rewriting one would falsify
   what that train ran.
2. Two fixture folders that hold the bytes of a past commit, by path:
   `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/` (N-15's: the bytes an old project
   holds; the template of `c1ac8c4` names `openspec-setup` in its comment on `merge` by design) and
   `plugins/openspec/hooks/fixtures/c561553/` (`archive-release-pin`'s: `docs/openspec-flow.md` at
   commit `c561553`, whose pin paragraph names "the openspec-setup script"; `archive-release-pin 1`
   and `archive-release-pin 6` compare them with the real hunks of that commit, so rewriting them
   would change what those tests prove). No other fixture is skipped.
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
   The archive of `compozy-driver` is on the base: the canonical `compozy-kit-setup` no longer holds
   "The kit runs the new stages in its four shells", and the delta MODIFIES all six of its
   requirements that name `compozy-setup` (D-12, step 4), so every line of that file outside the
   Purpose that names an old skill is in a skipped block, and N-10 turns green once tasks 6.2 to 6.4
   are done.

No test file is skipped. The tests that must hold the old names build them by concatenation
(`'openspec' + '-setup'`, `'compozy' + '-setup'`), so no source line holds the name: N-10's own
needles, N-8's, T-14's negative, N-19's negative, and T-6's quote of the past `CHANGELOG.md` line (same string, same
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
- `gen-agents.mjs`: `DEFAULT_ROOT` goes from five levels up to four,
  `resolve(here, '..', '..', '..', '..')`; `AGENTS_AT` becomes
  `['plugins', 'compozy', 'kit', 'templates', 'agents']`; `SELF` becomes
  `plugins/compozy/kit/scripts/gen-agents.mjs`. The generated header line of every agent changes,
  so the agents are generated again, under `kit/templates/agents/` and, through `install-kit.mjs`,
  under this repository's `.compozy/agents/`.
- `adoption.test.mjs`: `REPO_ROOT` is four levels up, and the comment above it says so; the comments
  that name `compozy-setup` as the reader of `substitutions.json` name "the kit installer".
- `gen-agents.test.mjs`: its `test-tmp.mjs` import becomes `../../skills/test-tmp.mjs`; `REPO` is
  four levels up; `AGENTS_AT` and the generator path it spawns name `kit`.
- `install-kit.test.mjs`: the sandbox copies the kit folder to `<tmp>/kit` (the copy is named `kit`,
  not `kit/compozy-setup`) and keeps the pack's `plugin.json` two levels above `scripts/`; the
  comments that say "the compozy-setup folder" or "its own copy of compozy-setup" say "the kit
  folder". `install-kit.test.mjs` and `devkit-kit.test.mjs`: `test-tmp.mjs` is imported from
  `../../skills/test-tmp.mjs` (it stays at `plugins/compozy/skills/test-tmp.mjs`, which
  `test-tmp.test.mjs` pins).
- `loop-templates.test.mjs`: the `cwd` of the `compozy loop validate` spawn is four levels up.
- Every moved test's run comment at the top of the file (the kit's five and the setup scripts' six)
  names its new path.
- `kit/templates/substitutions.json` (the `syntax` text): "compozy-setup replaces each token"
  becomes "the kit installer replaces each token". The file is read for its `placeholders` only, so
  no behaviour changes.
- The suite's folder list (T-31): `SUITE_FOLDERS` in `scripts/test-suite.mjs` names
  `plugins/openspec/skills/devkit/scripts` and `plugins/compozy/kit/scripts` in place of the two
  removed folders, and `plugins/openspec/hooks/test-suite.test.mjs` its constants `SETUP` and
  `COMPOZY_SETUP` and one probe text. The new `setup-block.test.mjs` and `kit-installer.test.mjs`
  then run because their folder is listed (N-19 pins it); no file imports them, which the suite
  refuses anyway. `plugins/openspec/skills/devkit/scripts` holds only the setup scripts, their tests
  and `fixtures/`, so the suite reads no other file there. `scripts/check.py` exempts every test of
  `plugins/compozy` from the skip check by pack, so the kit's move keeps that exemption.
- `.github/workflows/ci.yml` (the `CompozyOS agents are up to date` step and the schema step's
  `install-schemas.sh` path; the `Test suite` step is unchanged), `CLAUDE.md` (the agents-check
  row), `CONTRIBUTING.md` (the suite paragraph's folder list and the manual `install-schemas.sh`
  line), `docs/openspec-flow.md` (the manual setup's `install-schemas.sh` path and
  `templates/config.yaml` link), `docs/compozy-kit.md` (the generator path),
  `plugins/compozy/kit/templates/README.md` (the generator path) and this repository's
  `.compozy/README.md`.

Rejected: `plugins/openspec/hooks/` for the setup scripts (it is the checkers' folder, and every
script there is shipped to CI by path); a `plugins/compozy/skills/<x>/` folder with no `SKILL.md`
for the kit (a folder under `skills/` is read as a skill, and `scripts/check.py` checks every
`plugins/*/skills/*/SKILL.md`).

### D-11 Documents and the records

- The record `docs/adr/0031-one-setup-verb-replaces-the-two-setup-skills.md` is the adr-author's.
  Its number is the next free number on `origin/main` at the last merge before review; its file name
  carries that number today. When a later merge of `main` takes it, the loop's `renumber-adr` step
  at that merge renames the file and moves every link. Its title line, its `Number:` line and its
  `Status: accepted` line are already set on the branch since `09654b7`; the implementation edits no
  line of the record, and those lines move only with that renumber step (task 6.7). The record's
  `Accepted by:` line is not rewritten after the owner's new approval of this plan, because it names
  `approval.md`, which holds that approval, and the record's decision has not changed since it was
  accepted. In the texts below, `<n>` is that number.
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
  amends 0004`, placed in number order (after the `0030` entry while `<n>` is 0031).
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

### D-12 This change beside its siblings: `compozy-driver`, `delivery-train`, `stage-models` and `suite-speed`

`compozy-driver` merged into `main` first (the owner's order; requirements, assumption 4), and
`main` was merged into `project-setup` with `delivery-train` and `stage-models`, then with
`suite-speed`, then with trains 1 to 4, which also brought the archives of all four, then with
trains 5 to 9 (`post-merge-validate`, `loop-place-and-evidence`, `project-slice-claim`,
`state-skips-unlocated`, `jira-entry-followups`, `stage-ceiling-consecutive` and the train records).
`main` keeps moving; the plan's base is the branch's last merge of `origin/main`.

1. That merge is done (at this revision `f1dcefa`, which brought `c09860c`). Task 1.1 confirms it
   with an ancestor check on the fixed commit `c09860c`, never on the moving `origin/main` ref, so a
   later move of `main` cannot turn it red; it runs no merge. Task 1.2 re-reads, on the base, every
   file this design names from the four siblings and from the trains, and fixes this plan where a
   name or path moved. The siblings' record numbers and versions are read by file and are not
   quoted in the plan. This change's record keeps the rule of D-11: the next free number on
   `origin/main` at the last merge before review. Gate 1.4 checks that `c09860c` is in the branch,
   that the archives of `compozy-driver` and `delivery-train` are on it, that `DRIVER_ROUND` holds no
   `compozy`, that `plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs` and
   `scripts/test-suite.mjs` exist. A red part means `main` moved under the plan, and the change
   stops for the owner; if `compozy` is not built, the requirement's condition ("if `driver: compozy`
   is built") goes the other way, and N-5, B-1 and the AC-6 proof change.
2. The kit folder moves as `main` holds it after that merge: 21 agents, three loops,
   `gen-agents.mjs`, retired-file handling. Nothing of the old kit is restored.
3. Its new texts naming `/compozy-setup` (`compozy-kit-missing`, `FIX['kit-missing']`,
   `compozy-driver readiness: kit-missing when the change loop is not in the workspace`, its CI step,
   its `CLAUDE.md` row, its docs) are in D-8, D-10 and the test table.
4. Its spec delta on `compozy-kit-setup` is archived: the canonical spec on the base holds its text.
   This change's delta MODIFIES the three requirements the two versions shared and, written at this
   plan revision, the three `compozy-driver` added that name `compozy-setup` ("A re-run removes the
   retired files the project did not edit", "A retired file the project edited stays and is named",
   "Inputs the kit no longer uses are dropped"), each copied whole from the canonical spec with the
   installer named and no other change. Task 6.5 re-reads the six canonical blocks at each later
   merge of `main` and rewrites a block from the canonical text where it moved.
5. Its record took its number at its merge (`0024-compozy-runs-the-short-loop.md`), and the later
   siblings took 0025 (`stale-only-on-own-files`), 0026 (`suite-speed`), 0027 and 0030
   (`archive-release-pin`) and 0029 (`project-slice-claim`); the open change `forced-merge-path`
   claims 0028 on its branch. This change's record takes the next free number on `origin/main` at
   the last merge before review (D-11); 0031, the number its file name carries, is the lowest one
   neither on `origin/main` at `c09860c` nor claimed.
6. Any later merge of `main` (the one before the last verify and review included) becomes the
   branch's last merge of `origin/main`. It repeats step 1's re-read for these files (the project's
   rule: merge the base before the final review; under the own-files rule a merge that brings none
   of the change's own files stales no evidence or review by itself), the grep of D-13 over the
   suite's test files (a sibling may have moved or split a suite again), tasks 6.5 and 6.6, and gate
   1.4's content checks at the paths phase 2 left:
   `test -f plugins/openspec/hooks/compozy-driver.mjs && test -f plugins/compozy/kit/scripts/gen-agents.mjs && test -f scripts/test-suite.mjs && test ! -e plugins/compozy/skills/compozy-setup && test ! -e plugins/openspec/skills/openspec-setup && grep -q "const DRIVER_ROUND = { script: 22 };" plugins/openspec/hooks/change-loop.mjs && grep -q "plugins/openspec/skills/devkit/scripts" scripts/test-suite.mjs && grep -q "plugins/compozy/kit/scripts" scripts/test-suite.mjs`.
   A red part means `main` moved under the plan: the change stops for the owner. The plan's checks
   name fixed commits or paths, never the position of `origin/main`, so they hold after each merge.
   The loop's `merge-check` step (`post-merge-validate`) then runs `openspec validate project-setup
   --type change --strict` on that merge before the evidence; a red check is a merge defect the
   planner fixes in the plan files, copying into the delta any scenario `main` added to a
   requirement this change MODIFIES (tasks 6.5, 6.6).
7. `delivery-train`'s archive wrote the canonical `change-coordination` requirement "The devkit
   command reads its verb" that this change MODIFIES. This change's block is that canonical text
   with `setup` added (the verb sentence with all six verbs, the two train scenarios, the
   unknown-verb scenario listing six commands in the order of D-7, and this change's two setup
   scenarios); no sentence of the canonical block is dropped or reworded. Read on `f1dcefa`, the
   canonical block equals the delta's block minus `setup`, and so does "The command runs only in a
   project set up for devkit" minus the `/devkit setup` wording. Task 6.6 re-reads both canonical
   requirements at each later merge: where one moved, the block is written again from the canonical
   text plus `setup`, with no other change. `stage-models`'s archived `change-coordination` delta
   MODIFIED another requirement ("Every end of a run is marked in the session's record"), and
   `post-merge-validate`'s delta (merged, not archived) only ADDS requirements to
   `change-coordination` (the `merge-check` step), so neither overlaps.

### D-13 Existing tests this change touches

Every row was found by grepping the test files of the suite's folders on the base (this branch after
its last merge of `origin/main`, `f1dcefa`) for `openspec-setup`, `compozy-setup`,
`skills/devkit/SKILL.md`, the old reply texts, the verb lists and the skill sentences. The merge of
`c09860c` (trains 5 to 9) added no test or source line that names an old skill and removed no test
of a row; it edited several suites of the rows below (among them `change-loop.test.mjs`,
`change-loop-compozy.test.mjs`, `project-loop.test.mjs`, `deliver-check*.test.mjs`,
`flow-check.test.mjs`, `version-pin.test.mjs` and `roadmap-loop-upfront.test.mjs`), and every test name of the rows below was found again by name
(some at other lines). The earlier merge of `c663f21` added no such test and moved no row either: it
changed
`change-loop-compozy.test.mjs` (the skill sentence `release-merge-conflict 16` quotes now reads
"`verify` and `review` for what the merge made stale", outside the Setup text; the literal pin lines
of `change-loop docs: the design records the answers` were replaced by the manifest read),
`delivery-train-after.test.mjs`, `deliver-check*.test.mjs`, `conduct-check.test.mjs`,
`flow-check.test.mjs` and `release-merge.test.mjs`, and every test name of the rows below was found
again by name. Each row names
the file the test lives in now, the test by its name, the invariant, the layer that owns it and the
suite. No row gives a line number: the test is found by its name. Every file named here is a file
of the suite (`node scripts/test-suite.mjs` runs it in a process of its own); no test file imports
another, so no row changes an import that wires a suite.

| Id | File | Test | Change | Invariant (layer) |
|---|---|---|---|---|
| T-1 | none | none | dropped: `suite-speed` removed the side-effect imports of `guard.test.mjs`, so no import of the setup script tests is left to change; T-31 moves their folder in the suite's list | the setup scripts' tests run in the suite (suite wiring, T-31) |
| T-2 | none | none | dropped, as T-1, for the five kit test files | the kit's tests run in the suite (suite wiring, T-31) |
| T-3 | `guard.test.mjs` | `openspec-setup SKILL.md teaches the per-project opt-in (2.4)` | renamed `setup skill: the Setup section teaches the per-project opt-in (2.4)`; reads the `## Setup` section and `## Never` of the devkit skill, same assertions | the setup teaches only the per-project install (skill text) |
| T-4 | `guard.test.mjs` | `this repository opts in through .claude/settings.json (2.5, ADR 0004)` | the script path `skills/devkit/scripts/project-settings.mjs` | this repository is opted in (settings writer) |
| T-5 | `guard.test.mjs` | the three `stage-roles setup:` tests | the constant `setupRoot` is `skills/devkit`; step 5 is sliced from the devkit skill | step 5 proposes and confirms the four test keys; the template's block stays all comments (skill text, template) |
| T-6 | `guard.test.mjs` | `upfront AC-5 docs: the flow doc names the released flow versions, the 0.37.0 entry names flow version 2, and ADR 0021's Note names flow 1` (its assertion on the `- Projects:` line of that `CHANGELOG.md` entry) | the quoted literal is written with the name split by concatenation (`'openspec' + '-setup'`), so the string and the assertion are unchanged and the source line holds no old name (D-9) | history is kept (release notes) |
| T-7 | `merge-setup.test.mjs` | the constant `'the setup template'` path; the constant `POINTER`; `mergeSetup: each fact missing alone is listed with its exact text and the openspec-setup pointer (AC-6)` | template path `skills/devkit/templates/devkit-reviews.yml`; `POINTER` is the new text; test renamed `... and the /devkit setup pointer (AC-6)` | each missing merge fact is listed with the pointer to the setup (GitHub facts) |
| T-8 | `deliver-check.test.mjs` | `nextStep row 3a: merge setup missing stops after the approval stops and before any work (AC-6)` | the expected line ends with the new pointer; `/devkit setup` matched | the merge-setup stop names the setup step (delivery checker) |
| T-9 | `deliver-check-cli.test.mjs` | `one gh runner: deliver-check.mjs and github-setup.mjs do not spawn gh themselves (architecture)` | path `skills/devkit/scripts/github-setup.mjs` | one `gh` runner (architecture) |
| T-10 | `deliver-check-cli.test.mjs` | `AC-6 instructions-follow: configs, ship-change, devkit, flow doc and READMEs name evidence before review` | template path `skills/devkit/templates/config.yaml` | the configs name evidence before review (docs) |
| T-11 | `delivery-models.test.mjs` | `delivery-models P5 workflow (<label>): ...` | template path `skills/devkit/templates/` | the workflow's token stays read-only (CI template) |
| T-12 | `flow-check.test.mjs` | the constant `INSTALL` used by the schema tests | path `skills/devkit/scripts/install-schemas.sh` | the installed schemas are what the checker reads (flow checker) |
| T-13 | `version-pin.test.mjs` | `version-pin AC-6 flow: next, wait, another open, a setup re-run and a pack update leave the pin` | path `skills/devkit/scripts/install-schemas.sh` | a setup re-run leaves a change's pin (version pin) |
| T-14 | `change-loop.test.mjs` | `change-loop start: S3 a folder with no openspec, or another schema, is not set up` | `/\/devkit setup/` matched, and the old name not matched through a regex built by concatenation (D-9) | a project not set up is told the setup command (start) |
| T-15 | `github-setup.test.mjs` (moved) | `format: openspec-setup has the GitHub step: script path that resolves, one confirmation per item, nothing applied unconfirmed (AC-7)`; `field-fixes 5 skill: step 7 ...` | renamed `format: the Setup section has the GitHub step: ...`; the `only if the owner asks` assertion becomes `/\`ship\` and \`merge_method\` are asked in step 5, \`merge\` suggested/`; the rest reads the devkit skill unchanged | one question per GitHub item, nothing applied unconfirmed (skill text) |
| T-16 | `gh-version.test.mjs` (moved) | `gh-version 19: step 1 of SKILL.md names the script and 2.50.0 and says the setup goes on (AC-7)` | none: `../SKILL.md` now resolves to the devkit skill, whose step 1 keeps the text | the `gh` warning never stops the setup (skill text) |
| T-17 | `changes-under-way.test.mjs` (moved) | `field-fixes 7 apply: with the owner answer only the started full-script change gets an approval.md that records no approval; ...` (its `- Why:` line) | `when \/devkit setup replaced the devkit schemas` | the not-applicable approval says why (setup script) |
| T-18 | `change-loop.test.mjs` | `change-loop start: S2 no verb or an unknown verb names the commands that exist` | its `pt-BR` prefix becomes `^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit setup, \/devkit project e \/devkit train` (the twin of T-19 and T-30); its `en` regex (`change.*roadmap.*status.*project`) and the render equalities hold with the new text unchanged | an unknown verb names the verbs, `train` included (start) |
| T-19 | `roadmap-loop.test.mjs` | `roadmap-loop start: roadmap and status are routed` | the `pt-BR` prefix becomes `^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit setup, \/devkit project e \/devkit train`; its `en` regex holds unchanged | the `pt-BR` verb list (start) |
| T-20 | `project-loop.test.mjs` | `project-loop start: step 2 without the design pack nothing runs and the reply names the pack` | `/\/devkit setup/` matched | the missing design pack names the setup (project start) |
| T-21 | `project-loop.test.mjs` | `project-loop next: S23 ship merge with the repository not prepared ends blocked and names what is missing` | none; N-9 adds the negative | the blocked reply lists the missing facts (project loop) |
| T-22 | `compozy-driver.test.mjs` | `compozy-driver readiness: kit-missing when the change loop is not in the workspace` | `/\/devkit setup/` matched | the missing kit names its fix (CompozyOS module) |
| T-23 | the kit tests (`install-kit`, `adoption`, `gen-agents`, `devkit-kit`, `loop-templates`), moved | their paths (D-10) | paths, run comments and the comments naming `compozy-setup` only; assertions unchanged | the kit installs and regenerates as before (kit) |
| T-24 | `project-loop.test.mjs` | `project-loop skill: the section sits between Status and Never and every call carries the language` | none: `| setup` goes right after `| status`, so the hint still ends `| train | project [<name>]`, and `## Setup` sits before `## Roadmap` | the skill's last sections and hint (skill text) |
| T-25 | `change-loop-compozy.test.mjs`, `guard.test.mjs` | `change-loop skill: the frontmatter`; `stage-roles gates: the devkit skill names the mock-up among the owner's gates and the accept-decisions step` | none: the description keeps `/devkit change`, `Use when` and "the grill, the mock-up, the plan approval, the retro answers"; the setup sentence is added after the train sentence, which stays word for word (T-30) | the skill's frontmatter (skill text) |
| T-26 | `change-loop-compozy.test.mjs`, `roadmap-loop-followups.test.mjs`, `roadmap-loop-upfront.test.mjs`, `stage-models.test.mjs` | the skill-wide negatives: `change-loop skill: every change-loop command and the readout carry the person's language`; `change-loop skill: start and open read the request through a quoted heredoc with the terminator rule` (no unquoted heredoc); `change-loop skill: the sections of D-3 to D-9 and the modes of start` (no `conduct-check`, `CronCreate` or `wake_when_done` before `## Roadmap`); `release-merge-conflict 16: the flow doc and the skill describe the release step as a merge and a plain push` (no `push-rebased`, `rebase` or `--force` in the skill); `roadmap-loop skill: every roadmap-loop command carries the person's language and the load limit` (no `--lang en`, `--lang pt-BR` or numeric `--load-limit`); `upfront AC-16 skill: no section before the Roadmap names a scheduling tool`; `stage-models AC-9 the skill change sections name no session-model tool` | none. The Setup text is written to obey them, by D-7's two rewordings: step 4 names "the `flow` command of `/devkit change`", not `change-loop.mjs flow` (the `--lang` rule on every line naming that call), and step 7's `--method` takes "the merge_method answer of step 5" while step 5 offers the plan's `options` from the JSON, so the file never holds `rebase`. Task 2.4 applies both when it moves the text, so gate 2.9 is green | the skill's calls carry the settings, and the skill never describes a history rewrite or a schedule before the Roadmap (skill text) |
| T-27 | none | none | dropped: `suite-speed` rewrote the header comment of `review-round.test.mjs`, which no longer names the setup tests; devkit-core has no change | none |
| T-28 | `change-loop-compozy.test.mjs` | `change-loop skill: the sections of D-3 to D-9 and the modes of start` | the `deepEqual` list of `##` headings becomes the twelve headings of the base plus `'## Setup'`, between `'## Train'` and `'## Roadmap'`: `'## Settings', '## Start', '## On the CompozyOS driver', '## A new change', '## Loop', '## Owner gates', '## Waiting on GitHub', '## Train', '## Setup', '## Roadmap', '## Status', '## Project', '## Never'`; the mode list (`train` and `train-args` included) and the negatives before and after `## Roadmap` are unchanged (the Setup steps carry no `##` heading and name no Roadmap tool, D-7). Applied in task 2.4, which adds the heading | the devkit skill has exactly these sections, in this order (skill text) |
| T-29 | `roadmap-loop-followups.test.mjs` | `roadmap-loop skill: the frontmatter and the start modes name the roadmap and the status` | the exact `argument-hint` regex gains the verb `setup`, with its escaped separator, right after `status` and before `train`: `... \| status \| setup \| train \| project \[<name>\]"$`, so it matches D-7's hint exactly and nothing else; the rest unchanged. Applied in task 5.3 | the skill's hint lists the verbs, in order (skill text) |
| T-30 | `delivery-train-after.test.mjs` (from `delivery-train`, split by `suite-speed`) | `delivery-train P13: the reply to an unknown verb names /devkit train, in order, in both languages`; `delivery-train docs: the documents follow` | P13: its `en` prefix becomes `So far \/devkit change, \/devkit roadmap, \/devkit status, \/devkit setup, \/devkit project and \/devkit train exist` and its `pt-BR` prefix `^Por enquanto existem \/devkit change, \/devkit roadmap, \/devkit status, \/devkit setup, \/devkit project e \/devkit train`; its two assertions on the train clause at the end of each text are unchanged. Docs: its exact hint regex becomes `... \| status \| setup \| train \| project \[<name>\]"` (D-7's hint, as T-29); its assertions that `## Train` sits right after `## Waiting on GitHub`, on the `## Train`..`## Roadmap` slice (now holding the Setup section, positive matches only), on the train sentence of the description and on the start modes are unchanged and hold with D-7's placement. Applied in task 3.3 (P13) and task 5.3 (the hint) | an unknown verb and the hint list every verb, `train` included, in order; `## Train` follows `## Waiting on GitHub` (start, skill text) |
| T-31 | `scripts/test-suite.mjs`; `plugins/openspec/hooks/test-suite.test.mjs` | `SUITE_FOLDERS`; the constants `SETUP` and `COMPOZY_SETUP` that `suite-speed AC-1 the script runs the test files of the four folders and no other` and `suite-speed AC-1 the repository suite holds every file the old command ran` read, and the probe text "only the compozy-setup folder is in the suite" | the two folders become `plugins/openspec/skills/devkit/scripts` and `plugins/compozy/kit/scripts` in the list and in the constants; the probe text becomes "only the kit's scripts folder is in the suite"; every assertion (the four folders, the 29 files the old command ran, no other compozy test file, no panel test file) is unchanged. Applied in task 2.3 | the suite runs the setup scripts' and the kit's tests wherever they live, and nothing else of `plugins/compozy` (suite wiring) |

Searched and left unchanged: T-3 and T-15 slice from `## Never` and from `GitHub (merge mode)`,
which the moved text keeps; T-16 and the T-5 slices find their steps by the step headings, which the
devkit skill holds once; no test pins step 7's `--method <squash|merge|rebase>` text, so D-7's
rewording breaks none. `delivery-train P9 N7: a project whose repository does not allow merge
commits ends blocked naming the setup, only in trunk-auto` (`delivery-train.test.mjs`) asserts the
train's blocked reply names `github-setup.mjs --method merge`, which `withoutSetupPointer` keeps;
`project-loop start: every new message key renders in both languages with no internal term`
(`project-loop.test.mjs`, which matches `/devkit project` in `verb-unknown`) and the `en` regexes
of T-18 and T-19 match the new `verb-unknown` unchanged; `change-loop skill: the wait is started in
the background on a GitHub wait` (`change-loop-compozy.test.mjs`, the `## Waiting on GitHub`..`## Never`
slice) asserts only words of the wait, which the Setup text leaves in place.
`upfront AC-1 skill: devkit-session is model-invocable, names its change from the start line, and
keeps the title rule and the archive line` (`roadmap-loop-followups.test.mjs`) asserts that the
devkit skill keeps `disable-model-invocation: true`, which D-7 keeps. The documents `suite-speed`
pins (`suite-speed AC-7` and `suite-speed AC-8`: the one command in `CLAUDE.md`, `CONTRIBUTING.md`,
`plugins/openspec/README.md` and `openspec/config.yaml`, no old command outside the records, the
measured time) keep that text: tasks 2.8 and 6.2 edit only the folder names and the setup prose
around it. `plugins/compozy/skills/test-tmp.mjs` does not move (`test-tmp.test.mjs` pins it), so
the kit tests import it from their new depth (D-10). `archive-release-pin 1` and
`archive-release-pin 6` (`deliver-check-archive.test.mjs`) read the `c561553` fixtures, which keep
their bytes (D-9, point 2). `change-loop docs: the design records the answers` needs no edit for the
release: it reads the pin from the manifest, and D-15 moves the pins of `docs/openspec-flow.md`.
`release-tags 3: ship-change has the tag-release row, its report line and its never line`
(`release-tags.test.mjs`) reads the ship-change skill, whose tag-release row, report line and never
line D-7 leaves as they are; task 5.4 runs it with the other suites that read that skill
(`change-loop-remote-state.test.mjs` among them, whose `commit-attribution AC-1 T20` reads only the
skill's `## Attribution` section).

New tests. Every name starts `setup AC-<n> <area>: `. Each fails on the base, except N-6, N-7 and
N-16, which pin behaviour that already holds, and N-19, which passes once task 4.1's two files
exist; their task says so.

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
| N-11 | `guard.test.mjs` | `setup AC-1 skill: the hint lists setup right after status, the description names /devkit setup, the skill stays not model-invocable, and Start sends setup to the Setup section on every driver` (asserts the `setup` item of `## Start` and the sentence "When the JSON's `settings.driver` is `compozy` and the mode is neither `setup` nor `setup-no-repo`, read the next section instead of the lines below." of D-7, and that `## On the CompozyOS driver` holds no `setup` item) |
| N-12 | `guard.test.mjs` | `setup AC-6 skill: step 8 asks the kit apart from the driver, runs kit-installer on yes and enables devkit-compozy, writes nothing on no, and the compozy driver installs the kit` |
| N-13 | `guard.test.mjs` | `setup AC-5 skill: the Setup section copies no checker, names the version, the packs not enabled and a CI pin that differs` |
| N-14 | `guard.test.mjs` | `setup AC-7 skill: step 5 asks the ship mode with merge suggested and step 7 asks one question per item` |
| N-15 | `guard.test.mjs` | `setup AC-8 old project: the configuration the old skill wrote opens a change with no setup step and its readout reads` (fixture `plugins/openspec/skills/devkit/scripts/fixtures/old-setup/`, the template's bytes at `c1ac8c4` and its `.claude/settings.json`) |
| N-16 | `change-loop.test.mjs` | `setup AC-1 start: setup with an openspec/config.yaml that cannot be read ends with the usage error and exit 3, as the other verbs do` (the fixture holds `openspec/changes/` beside `openspec/config.yaml` made a folder, so `findRoot` finds the root; without it the verb answers `setup` with exit 0. Passes on the base) |
| N-17 | `guard.test.mjs` | `setup AC-4 skill: step 5 writes schema, context, rules and operations only where fill names them, and the block only through setup-block.mjs apply` (pins D-7's step 5 sentence; reads the step through the `5. **Write`..`6. **Check.**` slice of T-5) |
| N-18 | `delivery-train.test.mjs` | `setup AC-2 train: the blocked train reply lists the missing merge facts without the setup pointer` (beside `delivery-train P9 N7`, with its fixture: reads `SETUP_POINTER` and `withoutSetupPointer` through a namespace import of `merge-setup.mjs`, asserts the pointer names `/devkit setup`, and that the `train-blocked` reply holds neither the pointer nor the words "run the GitHub step" and still ends with `github-setup.mjs --method merge allows merge commits and auto-merge`; fails on the base, where neither export exists) |
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
| B-17 | `setup-block.test.mjs` | `setup AC-4 block plan: a delivery.train the loop refuses is kept, and the delivery question then offers only trunk and trunk-auto` (cases: `train` with no model gives the `delivery.train` entry in `kept` and a `delivery` entry with options `trunk`, `trunk-auto` and default `trunk`, and `apply` refuses `two-prs` with exit 3; `train` with `model: two-prs` gives the `kept` entry and no `delivery` entry; `train` with `model: trunk` gives no `kept` entry) |
| K-1 | `kit-installer.test.mjs` (new) | `setup AC-6 kit: the sibling compozy pack is found` |
| K-2 | `kit-installer.test.mjs` | `setup AC-6 kit: the highest installed version wins and a tie goes to the last path` (under a `CLAUDE_CONFIG_DIR` in a temporary folder) |
| K-3 | `kit-installer.test.mjs` | `setup AC-6 kit: no devkit-compozy exits 3 naming the pack and every location tried` |
| K-4 | `kit-installer.test.mjs` | `setup AC-6 kit: a devkit-compozy with the installer under skills/compozy-setup is not taken` |
| K-5 | `kit-installer.test.mjs` | `setup AC-6 kit: the installer runs with the arguments passed and its exit code returned, and writes only under .compozy` |
| P-1 | `project-settings.test.mjs` (moved) | `setup AC-5 settings: a dry run names a pack set to false and writes nothing` |
| N-19 | `test-suite.test.mjs` | `setup AC-3 suite: the repository suite lists setup-block.test.mjs and kit-installer.test.mjs under the devkit skill's scripts, and no test file under the two removed setup folders` (reads `suiteFiles(REPO_ROOT)`, as `suite-speed AC-1 the repository suite holds every file the old command ran` does; the negative is that no listed path starts with `plugins/openspec/skills/openspec-setup/` or `plugins/compozy/skills/compozy-setup/`, both built by concatenation, D-9) |

The tests use `test-tmp.mjs` for every folder, the file's shared env constant that blanks
`DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH`, and need the `openspec` CLI 2.x on `PATH`. No test reads git history.

### D-14 The real run (AC-10)

Done by the session that conducts this change, never by `tdd-implementer`. The runs happen in
scratch projects under the session's TMPDIR (on the Linux worker that runs this change,
`/var/tmp/devkit-project-setup`), outside this repository; no step depends on one operating
system's paths. Each uses Claude Code with `--plugin-dir` for this worktree's `plugins/core`,
`plugins/openspec` and `plugins/compozy`. Each typed command is a `claude -p "/devkit setup"`
session; each answer is a `claude -p --resume <session id> "<answer>"` turn, because a `-p` session
has no AskUserQuestion and the skill then says the question and ends the turn. Each run's
transcript lines and the commands' outputs are saved to
`openspec/changes/project-setup/proof/<run>.txt`. The six files R-1 to R-6 are committed before the
evidence stage and cited in `evidence.md` before the first review round (`CLAUDE.md`: the real-run
proof is in `evidence.md` before the first review round; only a line the round itself produces is
added after it).

| Run | Case | Project | What the file shows |
|---|---|---|---|
| R-1 | first install, kit no | a new git repository with a `package.json` (`test` script, `version`) | the questions in order; `ls openspec/schemas`; `.claude/settings.json`; `openspec/config.yaml` with the block, `ship` `pr`, `release_tag: package.json`; no `.compozy/`; no checker file (`find . -name guard.mjs`); the version named |
| R-2 | re-run, nothing missing | R-1's project | `shasum -a 256 openspec/config.yaml` before and after, equal; no block question asked; the kit question asked again and answered no |
| R-3 | `merge` mode | a scratch clone of a GitHub repository the owner administers | the ship answer `merge`, the GitHub plan, one question per item, each answered no, and the plan run again unchanged: nothing applied |
| R-4 | kit yes | a new git repository | `.compozy/` and its manifest, `devkit-compozy@devkit` enabled, the installer's per-file lines |
| R-5 | driver `compozy` | a new git repository | `compozy` and `claude` offered, `script` not; `compozy` chosen; the kit installed with no kit question; then `/devkit setup` typed again in that project (driver `compozy`) runs the Setup section, starts no CompozyOS run, asks no block question and no kit question, and leaves `openspec/config.yaml`'s `shasum -a 256` unchanged (D-7, `## Start` on every driver) |
| R-6 | the conducting session's own part | R-1's project | a `-p` session asked in plain words to set the project up makes no Skill call: the `devkit` skill does not run and its `## Start` does not reach the Setup section through it; in R-1's project `git status --short` stays empty, and the typed `/devkit setup` of R-1 is the one that ran the skill. The files a session writes by running the setup's scripts by hand (the extra cases the file also records, in a repository not set up) are recorded as evidence finding F-1, which this change does not prevent |

A run that cannot happen (no GitHub repository for R-3, the host refusing) is recorded in its file
with the reason, and the owner decides at the evidence whether it counts.

Note (2026-11-25), the owner's decision on R-6. Review round 1 found that the spec's typed-only
requirement promised more than the change enforces (spec-reviewer F1, code-quality-reviewer F1):
R-6 shows no Skill call for a plain-words request in every case, but its extra cases show a session
running the setup's scripts by hand and writing `.claude/settings.json`, `openspec/` and
`.agents/skills` in a repository not set up (evidence F-1). The owner chose, typing in the
conducting session on 2026-11-25: "Ajustar o texto (A)". The spec's requirement "The setup skill is
invoked only from the owner's typed command", task 7.6 and the R-6 row above now claim only what the
change enforces, as AC-1 already words it ("accepted only from the owner's typed command, as
`/devkit change` is"): the `devkit` skill is not model-invocable. No code changes for it, and the
change does not grow.

Retro proposal (not part of this change): a hook that refuses the setup's scripts (the Setup
section's `change-loop.mjs start` with `setup`, `project-settings.mjs`, `install-schemas.sh`,
`setup-block.mjs apply` and the kit installer) when the session's last typed command is not
`/devkit setup`, with a real run of R-6's extra case as its proof. Until it exists, an owner types
`/devkit setup` and does not ask for the setup in plain words.

### D-15 Release

devkit-openspec, devkit-compozy and the marketplace each take the next free minor version on
`origin/main` at the last merge before review. The version goes in `plugin.json` and
`marketplace.json`, with a `CHANGELOG.md` entry. devkit-core keeps its version: no file of it
changes (T-27 is dropped). `scripts/test-suite.mjs` is a repository script, shipped by no pack.

The devkit-openspec bump moves every CI pin of `docs/openspec-flow.md` (the lines `pinsIn` reads:
the `# pinned to the commit of v<x>` comments of the CI snippet and the "Pin the commit sha of the
release tag (`v<x>` above)" sentence) to `v<the new version>`, and edits no test: the test
`change-loop docs: the design records the answers` asserts `pinMismatches(flow, version)` with
`version` read from `plugins/openspec/.claude-plugin/plugin.json` (ADR 0030; CONTRIBUTING, release
step). Gate 6.10 runs that test.

This repository delivers on a delivery train (`devkit.delivery.train` in `openspec/config.yaml`,
ADR 0022). The change's head carries the versions above; once boarded, the departure renumbers its
release above the train's numbers (`release-merge.mjs --merge`, which also resolves the pin lines of
`docs/openspec-flow.md`), and the train's merge commit is tagged `v<the train's version>` when the
train's release changes devkit-openspec's version; the change's intermediate version gets no tag
(CONTRIBUTING). This repository's `.compozy/` is installed again after the devkit-compozy bump, so
the `pack` field of `.compozy/kit-manifest.json` records the new pack version. No test pins that
field (`adoption.test.mjs` pins the installed files, the inputs and the digests), and
`release-merge.mjs` does not rewrite it, so a renumbering on the train leaves it at the head's
version, which the next install corrects.

## Risks / Trade-offs

- [A sibling merges into `main` after the plan and moves or splits a file this plan names] → D-12,
  step 6: every merge of `main` is followed by the re-read, the grep of D-13 and the loop's
  `merge-check` step; the plan names functions and tests by name, never by line, and its checks name
  fixed commits, never the position of `origin/main`.
- [A new kind of history file names the old skills (as the train records did)] → D-9 lists it with
  the history and N-10 skips its folder; task 1.2's re-read greps every file a merge added.
- [The kit installer is not found on an owner's machine (devkit-compozy not installed, or 0.4.0)] →
  the reply names the pack and the locations (K-3, K-4); the kit is opt-in (the record, Consequences).
- [A re-run asks the optional keys the owner left unset again (coverage, E2E, delivery, kit)] →
  accepted: nothing records a "no", and the old skill asked them again too. A no writes nothing, so
  the file stays byte-identical (AC-4).
- [The block writer meets a hand-written block in a shape it does not read] → it refuses with
  nothing written (B-12); the owner edits by hand.
- [A typed `/devkit setup` in a roadmap session ends the run's hold] → that is the existing rule for
  any typed command but `/devkit status` and `/devkit train`, pinned by N-7; `/devkit roadmap` resumes.
- [Owners who learned `/openspec-setup`] → every message names `/devkit setup`; the record accepts it.
- [A session asked in plain words runs the setup's scripts by hand and writes a setup's files in a
  project not set up (R-6, evidence F-1)] → accepted for this change by the owner's choice A of
  2026-11-25 ("Ajustar o texto (A)", D-14 note): the spec claims only that the skill is not
  model-invocable. Retro proposal: the hook that refuses the setup's scripts without a typed
  `/devkit setup` (D-14 note).

## Migration Plan

Projects set up with the old skills need no step (N-15, AC-8). The next re-run is `/devkit setup`.
Rollback: revert the merge commit. The moved scripts return to the two skill folders, and projects
are unaffected, because no file a project holds changes shape. A project that ran the new step has
only keys the old readers already read.

## Implementation plan

Order: the start mode and the driver list (no dependency), then the scripts, then the moves with the
skill text, then documents and release, then the real runs.

- **devkit-openspec (hooks)**: `change-loop.mjs` (D-1, D-2, D-8), `flow-check.mjs`, `guard.mjs`,
  `merge-setup.mjs`, `project-loop.mjs`, `train-loop.mjs`, `compozy-driver.mjs` (D-8); the suites
  of D-13, `delivery-train.test.mjs`, `delivery-train-after.test.mjs` and `test-suite.test.mjs`
  included (T-30, T-31, N-18, N-19).
- **devkit-openspec (skill)**: `skills/devkit/SKILL.md` (D-7), the moved `scripts/` and `templates/`,
  `setup-block.mjs`, `kit-installer.mjs` and their tests, the old-setup fixture;
  `skills/ship-change/SKILL.md`; `skills/openspec-setup/` removed.
- **devkit-compozy**: `kit/` (moved), `skills/compozy-setup/` removed, regenerated agents,
  `README.md`, `plugin.json`.
- **Repository**: `scripts/test-suite.mjs` (`SUITE_FOLDERS`, T-31), `.compozy/`,
  `.github/workflows/ci.yml`, docs, ADRs, specs' Purpose, config, changelog, marketplace.

Files to create: `plugins/openspec/skills/devkit/scripts/setup-block.mjs`, `setup-block.test.mjs`,
`kit-installer.mjs`, `kit-installer.test.mjs`, `scripts/fixtures/old-setup/config.yaml`,
`scripts/fixtures/old-setup/settings.json`, `openspec/changes/project-setup/proof/*`.
Files to delete: `plugins/openspec/skills/openspec-setup/SKILL.md`,
`plugins/compozy/skills/compozy-setup/SKILL.md`. Files to move: D-10. Files to modify: D-7, D-8,
D-10, D-11, D-13.

Estimate: optimistic 27 h, likely 38 h, pessimistic 56 h (the pessimistic case: more sibling merges
that move or split the files this plan names, a canonical block of task 6.5 or 6.6 moved by a
later merge, or the real runs needing host workarounds).

| Component | Hours | Type | Risk |
|---|---|---|---|
| Confirm the base (the last merge of `origin/main`), re-read the merged tree (task group 1) | 1 | Integration | LOW |
| `setup-block.mjs` with its tests B-1 to B-17 | 9.5 | Core | MEDIUM |
| `kit-installer.mjs` with K-1 to K-5, P-1, N-19 | 3 | Core | LOW |
| Start mode, `BUILT_DRIVERS`, replies and messages, the two pointer strips, N-1 to N-9, N-18, T-7 to T-22, T-30 (P13) | 5.5 | Core | LOW |
| Moves, the suite's folder list, path fixes, regenerated agents, `.compozy/`, CI (D-10, T-3 to T-5, T-23, T-28, T-31) | 4.5 | Migration | MEDIUM |
| The `## Setup` section, `## Start` on every driver, `## Never`, ship-change, N-10 to N-17, T-29, T-30 (hint) | 5.5 | Core | MEDIUM |
| Documents, ADRs, Purpose edits, the two delta re-reads (6.5, 6.6), catalog, changelog, versions and the flow page's CI pins | 4 | Documentation | LOW |
| Touched-file suite runs (gates 2.9 and 7.8) and fixes | 2 | Testing | MEDIUM |
| Real runs R-1 to R-6 | 2.5 | Testing | MEDIUM |

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| `compozy-driver` not merged, or merged with `compozy` still not built | LOW | HIGH | gate 1.4 stops the change before any code; the owner decides |
| A later merge of `main` moves a canonical `compozy-kit-setup` block this delta MODIFIES | LOW | MEDIUM | the six blocks are copied whole from the canonical text on `f1dcefa` (D-12, step 4); the loop's `merge-check` step validates the delta after every merge; task 6.5 re-reads them at each later merge and rewrites a moved block from the canonical text |
| A sibling archived after this plan MODIFIES "The devkit command reads its verb" again, and this change's archive drops its text | LOW | HIGH | this change's block is the canonical text plus `setup` (D-12, step 7); task 6.6 re-reads the canonical requirement at each later merge and rewrites the block from it |
| A sibling's copy of a mechanism this plan changes is missed (as `train-loop.mjs`'s pointer strip was) | LOW | MEDIUM | one helper `withoutSetupPointer` for every strip (D-8); N-10 fails on any old name left in a script; task 1.2's re-read greps every file the siblings added |
| A pinned text missed by the grep | MEDIUM | LOW | gates 2.9 and 7.8 run every test file this change touches (the touched-file list of `tasks.md`), with `--concurrency=2`; the train's departure runs the whole suite, which is the whole-suite proof; N-10 fails on any old name left |
| The moved or new setup tests drop out of the suite while every gate stays green (`SUITE_FOLDERS` reads a missing folder as empty) | MEDIUM | HIGH | T-31 moves the folder list with the files in task 2.3; every phase gate names its test files as arguments, which the script refuses with exit 2 when they are not in its folders; N-19 pins the two new files in the suite's list |
| Regenerated agents drift from `.compozy/` | LOW | MEDIUM | `gen-agents.mjs --check` and `adoption.test.mjs` in the gates |
| The host's `-p` mode cannot run a typed skill with answers by `--resume` | LOW | MEDIUM | D-14: an interactive session run instead, recorded the same way |
| `change-loop.test.mjs` grows further above the 300 s per file that `CONTRIBUTING.md` asks (371 s on `archive-release-pin`'s recorded run, 338.9 s in train 7's record) | MEDIUM | LOW | the start tests it gains (N-1 to N-5, N-8, N-16) call `startMode` in a scratch folder, about a second each; a split of the file is its own change, as `CONTRIBUTING.md` describes it (by section heading, no test renamed), and is not widened into this one; the evidence names the file's time |
| The suite's long run on a full machine | MEDIUM | LOW | no gate of this change runs the whole suite: every gate names its test files and passes `--concurrency=2`; gates 2.9 and 7.8, the longest (the touched-file list), run as a background command of the tool; the whole suite runs once, at the train's departure |
| A re-run edits `openspec/config.yaml` outside the block | LOW | HIGH | `fill` (D-3) decides it in a script, B-15 tests it, N-17 pins step 5's sentence, R-2 compares the bytes |
| A later merge of `main` takes the number this change's record carries today | LOW | LOW | every link to the record names its file; the record's number is the next free number on `origin/main` at the last merge before review, and the loop's renumber step at that merge moves every link (D-11, task 6.7) |

Assumptions (where the plan breaks if reality differs):

- The base holds `compozy-driver` merged and archived: `DRIVER_ROUND = { script: 22 }`, the kit
  under `skills/compozy-setup/` with `gen-agents.mjs`, its record
  `docs/adr/0024-compozy-runs-the-short-loop.md`, its text in the canonical `compozy-kit-setup`
  spec (requirements, assumption 4; gate 1.4; task 1.2).
- The base holds `suite-speed` merged and archived (in the branch since `cf34ff2`):
  `node scripts/test-suite.mjs` is the one suite command and `SUITE_FOLDERS` lists the folders it
  reads (its record `docs/adr/0026-the-devkit-test-suite-runs-by-file-in-parallel.md`; gate 1.4;
  task 1.2).
- The base holds `delivery-train` merged and archived: the verb `train`, the `## Train` section
  right after `## Waiting on GitHub`, `train-loop.mjs`, and its text in the canonical
  `change-coordination` requirement this change MODIFIES (D-12, step 7; task 6.6).
- This repository keeps the delivery train on (`devkit.delivery` in `openspec/config.yaml`, whose
  `train` command runs the whole suite at each departure) and the pin test reads the manifest
  (ADR 0030), as on `c09860c`: D-15's release, the touched-file gates and the Workflow follow-up of
  `tasks.md` follow all three.
- The loop gives the `merge-check` step after each merge of the base (`post-merge-validate`, as on
  `c09860c`; `docs/openspec-flow.md`, "The loop"): D-12 step 6 and the Workflow follow-up rely on it
  to validate the delta at the last merge before review.
- `--plugin-dir` places packs as siblings named by folder (`plugins/openspec`, `plugins/compozy`),
  as earlier live checks used it (`openspec/changes/archive/2026-11-22-project-phases/tasks.md`,
  task 5.2).
- The host refuses a model call of a skill with `disable-model-invocation: true`
  (`upfront AC-1 skill: devkit-session is model-invocable, ...` in `roadmap-loop-followups.test.mjs`
  relies on it for the `devkit` skill).

Dependencies: `compozy-driver` archived (D-12; its canonical text for task 6.5); `delivery-train`
archived (the verb `train`, D-7, D-8; its canonical text for task 6.6); `stage-models` archived (no
overlap, D-12 step 7); `suite-speed` archived (the suite command and `SUITE_FOLDERS`, D-10, T-31);
`archive-release-pin` merged on train 4 (the pin test reads the manifest, D-15; not archived, and
nothing here waits on its archive); `stale-only-on-own-files` archived (the own-files rule, D-12
step 6); `post-merge-validate` merged by trains 5 to 9 (the loop's `merge-check` step after a merge of
the base, D-12 step 6; not archived, and nothing here waits on its archive; its delta only ADDS to
`change-coordination`); `project-slice-claim` merged (it took ADR 0029, D-12 step 5); the train
records `openspec/trains/<n>.md` (history, D-9); the archived
`delivery-models` (the delivery keys and `MODEL_SHIP`), `change-version-pin` (the pin this step
leaves) and `gh-version-check` (step 1's `gh` line).
