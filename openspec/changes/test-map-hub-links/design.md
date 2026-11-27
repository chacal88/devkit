<!-- devkit-stage design result=passed attempt=1 commit=acacc172e3fd1e3e5b4c325674d75f11511d8af0 -->
# Design

Change: `test-map-hub-links` · Date: 2026-11-27 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `decisions.md`, `release.md`). Base: `origin/main` at `02713b3a`.

A test file is named here by its stem: `guard` is `plugins/openspec/hooks/guard.test.mjs`, and
each of the 44 suite test files has a stem no other one has. "Fast" means "not in `slow`" of
`scripts/test-map.json`. "The trace" and "the coverage run" are the two measured runs of D-2 and
D-4. Their numbers below were measured on the base `02713b3a` while this plan was written, and the
implementer measures them again (tasks 1.2 and 1.3).

## Context

See `proposal.md`, "Why". What shapes the approach:

- The map's seed (`openspec/changes/archive/2026-11-27-selective-tests-by-map-2/design.md`, D-4)
  linked a key to every test whose code lines, or the code lines of a module it imports, hold the
  key's path (rule 4), or that reaches the key through relative imports (rule 3).
  `plugins/openspec/hooks/test-fixtures.mjs` names `openspec/roadmap.md`, `openspec/config.yaml` and
  `CONTRIBUTING.md`, and it imports `deliver-check.mjs` (lines 11 and 12) and `change-loop.mjs`
  (line 15). So every test that imports it is linked to those documents and to both hubs.
- `selectTests` in `scripts/test-suite.mjs` takes the first rule that matches (S1 to S7, line 110).
  S4, a `files` key, comes before S5 (a path under `openspec/`) and S6 (a Markdown file outside
  `plugins/`). So a document with a key selects its list, and a document with no key selects
  nothing, unless it is neither under `openspec/` nor Markdown: such a path falls to S7 and selects
  the whole suite.
- `mapProblems` (line 221) refuses a test linked to nothing (M6) and a suite-folder script no key
  covers (M5). It allows an empty list, which S4 treats as S7 (line 128). Keys outside the four
  suite folders are not required by M5, so a document key can be removed.
- `ownDiffPaths` in `plugins/openspec/hooks/deliver-check.mjs` (line 351) drops `RELEASE_FILE`
  (line 1732): `CHANGELOG.md`, `docs/catalog.md`, `.claude-plugin/marketplace.json` and each
  `plugins/*/.claude-plugin/plugin.json` are never own files.
- Run 46024905007 (pull request 160, own file `openspec/roadmap.md`), job `check`, from its step
  timestamps (`gh run view 46024905007 --json jobs`): set up 1 s, checkout 3 s, setup-node and
  setup-python under 1 s, `Catalog is up to date` and `CompozyOS agents are up to date` under 1 s
  each, `Names, descriptions, links, language` 2 s, `Install OpenSpec` 3 s, `Test suite` 10 min 4 s,
  `Schemas validate against the OpenSpec CLI` 1 s, post steps under 1 s. The job ran 10 min 17 s
  from start to end, about 13 s of it outside `Test suite`.
- The base selections, from `selectTests` on the base map (the simulation of task 1.1):
  `openspec/roadmap.md` 31 files (23 slow), `openspec/config.yaml` 32 (23), `CHANGELOG.md` 32 (23),
  `CONTRIBUTING.md` 30 (22), `README.md` 23 (16), `docs/openspec-flow.md` 32 (23),
  `docs/catalog.md` 31 (23), `.claude-plugin/marketplace.json` 32 (23), `change-loop.mjs` 33 (23),
  `deliver-check.mjs` 33 (23).

## Goals / Non-Goals

**Goals:**

- Each document key lists only fast tests that read the document from the checkout (AC-1, AC-2).
- The hub keys lose the tests that reach them only through `test-fixtures.mjs` or `guard.mjs` and
  run none of their code (AC-3).
- The map's check stays green, every test stays linked, and no key has an empty list (AC-4).
- Each link kept or dropped is proved by a command and its output, committed under
  `openspec/changes/test-map-hub-links/proof/`.

**Non-Goals:**

- No edit to `scripts/test-suite.mjs`, so no rule (S1 to S7) and no check (M1 to M7) changes. The
  durable guard on the new rule is a test of the repository's map (D-5), not a new map check: an
  M8 in the script would make every change of the script run its three slow tests for a rule
  that only this repository's data needs.
- No reader is added to a key that keeps a list (D-3). A key gains a test only where removing it
  would select the whole suite.
- No change to the non-code keys under `plugins/` (D-1) or to any other code key.

## Decisions

### D-1 Which keys are documents

A document key is a `files` key of `scripts/test-map.json` that:

1. is not under `plugins/`, and
2. is not code: its path does not end in `.mjs`, `.js`, `.cjs`, `.py` or `.sh`, and it is not
   under a `bin/` folder (`.compozy/bin/devkit-kit` is an executable script without an extension).

A folder key (ending in `/`) outside `plugins/` would be a document too; the map has none today.
The change narrows every document key whose list holds a slow test on the base: 56 keys,
listed in D-3. The other document keys (`.compozy/kit-manifest.json`, `.github/workflows/ci.yml`,
`CLAUDE.md`, `docs/adr/0001-*.md`, `docs/adr/0026-*.md`, `docs/getting-started.md`,
`docs/migrate-to-project-scope.md`, `scripts/test-map.json`) hold only fast tests and stay as they
are.

Why `plugins/` is out: S6 already treats Markdown under `plugins/` as code, because tests pin the
text of skills and agents (`selective-tests-by-map-2` proposal, "Flagged for the owner"), and the
shipped hooks read the pack's schemas, templates, manifests and `hooks.json` at run time. Editing
one of them is editing the product. These 27 keys keep their lists, the owner approves this with
the plan (requirements, assumption 2):

`plugins/compozy/kit/templates/` (17 tests, 7 slow), `plugins/core/.claude-plugin/plugin.json`
(8, 7), `plugins/core/agents/adr-author.md` (2, 2), `adr-reviewer.md` (1, 1),
`change-planner.md` (2, 2), `code-quality-reviewer.md` (2, 2), `commit-and-pr.md` (2, 2),
`e2e-tester.md` (1, 1), `pr-verifier.md` (3, 3), `requirements-triage.md` (1, 1),
`tdd-implementer.md` (2, 2), `plugins/core/skills/adr-authoring/SKILL.md` (1, 1),
`plugins/core/skills/plan-readiness-review/templates/report.md` (1, 1),
`plugins/design/skills/design-business-discovery/templates/STATE.md` (4, 4),
`plugins/openspec/.claude-plugin/plugin.json` (31, 23), `plugins/openspec/README.md` (2, 1),
`plugins/openspec/hooks/fixtures/` (29, 22), its two files under `fixtures/c561553/` (1, 1 each),
`plugins/openspec/hooks/hooks.json` (3, 2), `plugins/openspec/schemas/` (22, 15), its two
`schema.yaml` keys (1, 1 each), `plugins/openspec/skills/devkit/SKILL.md` (2, 1),
`plugins/openspec/skills/devkit/scripts/fixtures/` (3, 1),
`plugins/openspec/skills/ship-change/SKILL.md` (3, 2), `plugins/panel/` (4, 3).

The two `plugin.json` keys are release files (never own files), so their lists select nothing on
a pull request either way.

Alternative rejected: "a document is any non-code key". It would narrow the pack's schemas and
skills, which the hooks and agents execute. That is the code the owner left out (requirements,
"Out of scope", last bullet).

### D-2 What a reader is, and how the trace proves it

A test file reads a document when, run alone from the repository root, it opens the document's
file in the checkout. "Opens" means a `readFileSync`, `readFile`, `openSync`, `open` or
`createReadStream` of the path, from `node:fs` or `node:fs/promises`. It counts whether the call
is in the test file, in a helper it calls, or in a Node process it spawns. A file the test writes
into a temporary project and reads back is not the document. A scan that reads every tracked file
and asserts on their text counts as a read: the `suite-speed AC-7` test of `test-suite` reads every
tracked file outside its four exempt prefixes and fails on a line that names the old command.

The trace measures this. A scratch module, kept in the session's scratch folder and copied
verbatim at the top of `proof/doc-reads.txt`, wraps those five `fs` functions and the two of
`fs.promises`, then calls `syncBuiltinESMExports()` from `node:module`. Each path under the
repository root that is opened is appended, relative to the root, to the file `TRACE_LOG` names.
Each fast suite test file (21 on the base) is run alone with
`NODE_OPTIONS=--import=<tracer URL> TRACE_ROOT=<root> TRACE_LOG=<log> TMPDIR=<fresh folder> node --test --test-reporter=dot <file>`,
the fresh folder made under `/var/tmp` and given by its real path, as D-4 step 2 says.
`NODE_OPTIONS` reaches every Node child that inherits the environment. `proof/doc-reads.txt` holds,
per test file, its exit code and the sorted unique document paths it opened.

The trace's limits, and how each is covered:

- A non-Node child is not traced. The only fast test that runs one on the checkout is `guard`'s
  `migration doc: it passes the install-scope lint (3.3)`, which runs `python3 scripts/check.py`
  with no `--root` and asserts only on `docs/migrate-to-project-scope.md` lines. `test-suite`'s
  `suite-speed AC-5c` runs `check.py` with `--root` on a temporary folder, which is not the
  checkout. Task 1.2 greps the fast test files for `spawnSync('python3'`, `'bash'` and
  `git grep` and records the result in the proof.
- A Node child spawned with an environment that leaves out `NODE_OPTIONS` is not traced. Such a
  child could only add reads, and only for a test that is already a reader or is not linked, so
  it cannot drop a reader wrongly. Every narrowed key keeps every linked fast test the trace shows
  reading it.
- Only fast tests are traced: slow tests leave every document key whatever they read (owner's
  answer 1).

Measured on the base (the trace of this plan, 21 files, all exit 0), among the 56 keys of D-3:
`guard` opens 35 and `test-suite` 29 (they open 506 and 487 distinct repository paths, whole-tree
scans included); `review-round` and `status-line` open `docs/openspec-flow.md`;
`project-settings` opens `.claude-plugin/marketplace.json`; `merge-setup` opens
`.github/workflows/devkit-reviews.yml`. The other 15 fast test files open none of them.

### D-3 The new content of each document key

For each key of D-1 in scope, the new list is the fast tests linked to it on the base that the
trace shows opening it (or a path under it, for a folder key):

- **narrow**: that set is not empty, so it becomes the list;
- **remove the key**: the set is empty, and the path is under `openspec/` (S5) or a Markdown file
  outside `plugins/` (S6), so without a key it selects no test file. The key is removed, not
  emptied: an empty list selects the whole suite (S4, line 128);
- **relink**: the set is empty and the path is neither (it would fall to S7 and select the whole
  suite). The list becomes every fast test the trace shows opening it, linked or not.

No reader is added to a key that keeps a list. A fast reader that is not linked today (the trace
shows `test-suite` reading `openspec/roadmap.md` and `docs/catalog.md` through its scan) is not
linked by this change: that is no loss against the base, and adding it would widen the selection
the owner asked to narrow. The narrowed lists keep their sorted order, as all the map's lists do.

| Key | Base links | Action | New list | Linked fast tests dropped |
|---|---|---|---|---|
| `.claude-plugin/marketplace.json` | 32 (23 slow) | narrow | guard, project-settings | change-state-stages, compozy-driver, merge-setup, status-line, changes-under-way, gh-version, setup-block |
| `.claude/settings.json` | 7 (4 slow) | narrow | guard | review-round, project-settings |
| `.github/workflows/devkit-reviews.yml` | 31 (23 slow) | narrow | guard, merge-setup | change-state-stages, compozy-driver, status-line, changes-under-way, gh-version, setup-block |
| `.gitignore` | 1 (1 slow) | relink | guard, test-suite | - |
| `CHANGELOG.md` | 32 (23 slow) | narrow | guard | change-state-stages, compozy-driver, merge-setup, status-line, test-suite, changes-under-way, gh-version, setup-block |
| `CONTRIBUTING.md` | 30 (22 slow) | narrow | guard, test-suite | change-state-stages, compozy-driver, merge-setup, status-line, changes-under-way, gh-version |
| `README.md` | 23 (16 slow) | narrow | guard, test-suite | adoption, install-kit, review-round, change-state-stages, status-line |
| `docs/adr/0002-merge-without-the-owner-opt-in.md` | 3 (2 slow) | narrow | guard | - |
| `docs/adr/0003-auto-merge-the-archive-pr.md` | 4 (3 slow) | narrow | guard | - |
| `docs/adr/0004-devkit-per-project.md` | 2 (1 slow) | narrow | guard | - |
| `docs/adr/0005-parallel-steps-and-a-session-wake-up.md` | 2 (1 slow) | narrow | guard | - |
| `docs/adr/0006-phases-as-child-sessions.md` | 2 (1 slow) | narrow | guard | - |
| `docs/adr/0007-one-change-on-request.md` | 2 (1 slow) | narrow | guard | - |
| `docs/adr/0008-reviews-as-a-workflow.md` | 3 (1 slow) | narrow | guard | review-round |
| `docs/adr/0009-compozy-loop-as-a-second-driver.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0010-openspec-as-the-harness.md` | 7 (6 slow) | narrow | guard | - |
| `docs/adr/0011-the-change-coordinator-is-the-owners-session.md` | 3 (3 slow) | remove the key (S6) | - | - |
| `docs/adr/0012-the-reviews-check-follows-the-change-script.md` | 2 (2 slow) | remove the key (S6) | - | - |
| `docs/adr/0013-the-roadmap-coordinator-is-the-owners-session.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0014-each-roadmap-change-runs-in-a-session-of-its-own.md` | 3 (3 slow) | remove the key (S6) | - | - |
| `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0016-stage-roles-write-their-own-files.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0017-a-change-state-is-derived-in-one-place.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0018-the-delivery-model-is-chosen-per-project.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0019-the-delivery-loop-tags-the-release-it-merged.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0020-a-change-can-run-on-another-machine.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0021-a-roadmap-run-opens-every-change-at-its-start.md` | 2 (1 slow) | narrow | guard | - |
| `docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md` | 2 (2 slow) | remove the key (S6) | - | - |
| `docs/adr/0023-the-model-is-chosen-by-stage.md` | 2 (2 slow) | remove the key (S6) | - | - |
| `docs/adr/0024-compozy-runs-the-short-loop.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` | 2 (2 slow) | remove the key (S6) | - | - |
| `docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md` | 2 (2 slow) | remove the key (S6) | - | - |
| `docs/catalog.md` | 31 (23 slow) | narrow | guard | change-state-stages, compozy-driver, merge-setup, status-line, changes-under-way, gh-version, setup-block |
| `docs/compozy-kit.md` | 1 (1 slow) | remove the key (S6) | - | - |
| `docs/coordination-design.md` | 8 (8 slow) | remove the key (S6) | - | - |
| `docs/openspec-flow.md` | 32 (23 slow) | narrow | review-round, guard, status-line | change-state-stages, compozy-driver, merge-setup, changes-under-way, gh-version, setup-block |
| `docs/roles.md` | 6 (6 slow) | remove the key (S6) | - | - |
| `openspec/config.yaml` | 32 (23 slow) | narrow | guard, test-suite | change-state-stages, compozy-driver, merge-setup, status-line, changes-under-way, gh-version, setup-block |
| `openspec/roadmap.md` | 31 (23 slow) | narrow | guard | change-state-stages, compozy-driver, merge-setup, status-line, changes-under-way, gh-version, setup-block |
| `openspec/schemas/devkit-lite/flow.json` | 2 (2 slow) | remove the key (S5) | - | - |
| `openspec/schemas/devkit-lite/schema.yaml` | 1 (1 slow) | remove the key (S5) | - | - |
| `openspec/schemas/devkit/flow.json` | 4 (4 slow) | remove the key (S5) | - | - |
| `openspec/schemas/devkit/flows/2.json` | 1 (1 slow) | remove the key (S5) | - | - |
| `openspec/schemas/devkit/schema.yaml` | 8 (7 slow) | remove the key (S5) | - | merge-setup |
| `openspec/schemas/devkit/templates/requirements.md` | 1 (1 slow) | remove the key (S5) | - | - |
| `openspec/specs/change-coordination/spec.md` | 3 (3 slow) | remove the key (S5) | - | - |
| `openspec/specs/change-delivery/spec.md` | 1 (1 slow) | remove the key (S5) | - | - |
| `openspec/specs/change-stages/spec.md` | 1 (1 slow) | remove the key (S5) | - | - |
| `openspec/specs/review-round/spec.md` | 1 (1 slow) | remove the key (S5) | - | - |
| `openspec/specs/verdict-files/spec.md` | 1 (1 slow) | remove the key (S5) | - | - |
| `openspec/trains/1.md` | 3 (3 slow) | remove the key (S5) | - | - |
| `openspec/trains/3.md` | 2 (2 slow) | remove the key (S5) | - | - |
| `openspec/trains/4.md` | 2 (2 slow) | remove the key (S5) | - | - |
| `openspec/trains/9.md` | 1 (1 slow) | remove the key (S5) | - | - |
| `scripts/released-flows.json` | 2 (2 slow) | relink | guard, test-suite | - |

The eight documents the owner named, after the change: `openspec/roadmap.md` selects `guard`;
`openspec/config.yaml` selects `guard`, `test-suite`; `CHANGELOG.md` selects `guard`;
`CONTRIBUTING.md` selects `guard`, `test-suite`; `README.md` selects `guard`, `test-suite`;
`docs/openspec-flow.md` selects `guard`, `review-round`, `status-line`; `docs/catalog.md` selects
`guard`; `.claude-plugin/marketplace.json` selects `guard`, `project-settings`. None is slow
(AC-1). `CHANGELOG.md`, `docs/catalog.md` and `.claude-plugin/marketplace.json` are release files,
so a pull request never selects them; their lists matter only to the map's check (M1, M6)
(requirements, assumption 5).

The slow tests that leave a document key are still in the whole run (AC-5). Among them, from a
search of the slow files for the repository-root helpers (`readRepo`, `repoText`, `repoFile`,
`readRoot`, `join(REPO, ...)`), these read a document from the checkout:

- `CONTRIBUTING.md`: `deliver-check-cli` (lines 666 to 670, 1322 to 1334), `delivery-train-after`
  (773 to 792), `release-tags` (601 to 604), `release-note` (979 to 980);
- `openspec/roadmap.md`: `change-loop-compozy`, `change-loop` and `change-loop-remote-state`
  (`readRepo('openspec', 'roadmap.md')`);
- `scripts/released-flows.json`: `version-pin` and `change-loop-compozy`.

A pull request that breaks one of their pinned texts is red only at the train, as ADR 0036's
Consequences accept (`docs/adr/0036-a-change-runs-only-the-tests-its-files-map-to.md:77-84`).

Proof of AC-2 (one run, task 2.2): in a scratch clone of the head whose `origin/main` and
`origin/HEAD` are the head itself (task 2.2 gives the commands), rename the heading
`Round 17b: field fixes of 0.16.0` of `openspec/roadmap.md` and commit it. Then
`node scripts/test-suite.mjs --own-files` prints `selected plugins/openspec/hooks/guard.test.mjs by openspec/roadmap.md`
as its only `selected` line, and fails `guard`'s
`field-fixes 12 roadmap: the round 17b line is read before round 18` (exit 1). The output is
`proof/reader-fails.txt`.

Alternatives rejected:

- Emptying a list instead of removing the key: it selects the whole suite (S4 to S7).
- Keeping one placeholder fast test on each document: a link must mean that the test reads,
  imports or runs the file (the seed's rule), and a placeholder reads nothing.
- Linking every fast reader the trace finds: `guard` and `test-suite` scan the whole tree, so every
  document would gain them, including documents that select nothing today.

### D-4 The hub keys

For `plugins/openspec/hooks/change-loop.mjs` and `plugins/openspec/hooks/deliver-check.mjs`, each
test file of the base list (33 each, 35 distinct files) is in one of two classes, decided by
reading the test file itself:

- **own**: the test file imports the hub (a relative import, or a dynamic import of its URL), or
  reads, spawns or links the real hub file by its path. It keeps its link, whatever it executes
  (owner's answer 2: "the test files that import, spawn or call it themselves").
- **other**: every other test file. It reaches the hub through `test-fixtures.mjs` or `guard.mjs`,
  through another module (a product module that imports or names the hub, or a `-fixtures.mjs`
  module), or names the hub only inside a text it writes (a stub file, a fixture string). The
  coverage run decides it: it keeps its link when it executes at least one function of the hub
  beyond what loading the module runs, and loses it otherwise.

Every test the owner's answer drops ("only through `test-fixtures.mjs` or `guard.mjs`") is an
other test, so AC-3 holds once the coverage run has decided them. The same measure decides the
other tests that reach the hub through another module, because the owner's reason ("an import
chain is not proof that a test runs the module") holds for any chain, and a stub or a string is
not the hub at all. That adds five drops beyond the two modules the answer names
(`conduct-check`, `flow-check` and `release-note` from `change-loop.mjs`; `compozy-driver` and
`devkit-kit` from `deliver-check.mjs`), flagged in `proposal.md`.

The coverage run (owner's answer 2: "the plan decides each dropped link by what the test
executes"). A scratch script, copied verbatim into `proof/hub-coverage.txt`, runs:

1. a baseline:
   `NODE_V8_COVERAGE=<dir> node --input-type=module -e "await import('<change-loop URL>'); await import('<deliver-check URL>')"`.
   It records, per hub, the functions whose first range has a count above 0 (key
   `<functionName>@<startOffset>`). This is what loading the modules runs (10 functions of
   `change-loop.mjs` and 3 of `deliver-check.mjs` on the base).
2. for each of the 35 test files, alone, from the repository root, at most 6 at once:
   `NODE_V8_COVERAGE=<dir>/<file> TMPDIR=<fresh folder> node --test --test-reporter=dot <file>`.
   The fresh folder is made under `/var/tmp` and given by its real path (`/private/var/tmp/...` on
   macOS): `change-loop-remote-state`'s `change-budget AC-1 ...` compares a path under `TMPDIR`
   with its real path and fails under a symlinked one. V8 writes one coverage file per Node
   process, the spawned ones included, because they inherit the environment. `test-fixtures.mjs`'s
   `runCli` (line 204) passes `t.env`, which the fixtures build from `fakeGh().env`, a copy of
   `process.env` (line 143).
3. per test file and hub: the functions of the hub's URL with a count above 0 in any of its
   coverage files, less the baseline. A count of 0 means that the test loads the hub at most.

Measured on the base while this plan was written: 34 files exited 0, and
`change-loop-remote-state` failed only the `TMPDIR` comparison above, because that run used a
symlinked `/var/tmp` folder, which step 2 now rules out. "Beyond load" is the count of step 3.

`change-loop.mjs`, 33 to 24 test files (23 slow to 16):

| Test | Speed | Class (how) | Beyond load | Link |
|---|---|---|---|---|
| `gen-agents` | fast | own (dynamic import, line 21) | 0 | kept |
| `change-loop-compozy` | slow | own (import) | 234 | kept |
| `change-loop-declared` | slow | own (import) | 158 | kept |
| `change-loop-remote-state` | slow | own (import) | 168 | kept |
| `change-loop-remote` | slow | own (import) | 177 | kept |
| `change-loop` | slow | own (import) | 241 | kept |
| `change-state-stages` | fast | own (import) | 105 | kept |
| `compozy-driver` | fast | own (import, line 11) | 1 | kept |
| `conduct-check` | slow | other (a module that names the hub) | 0 | dropped |
| `deliver-check-archive` | slow | own (import) | 61 | kept |
| `deliver-check-cli` | slow | other (`test-fixtures.mjs` only) | 0 | dropped |
| `deliver-check` | slow | other (`test-fixtures.mjs` only) | 0 | dropped |
| `delivery-models` | slow | own (import) | 89 | kept |
| `delivery-train-after` | slow | own (import) | 26 | kept |
| `delivery-train` | slow | own (import) | 59 | kept |
| `flow-check` | slow | other (a module that names the hub) | 0 | dropped |
| `guard` | fast | other (`change-loop-fixtures.mjs`; names the hub only in strings) | 64 | kept |
| `jira-task` | fast | own (reads its source, line 185) | 0 | kept |
| `merge-setup` | fast | other (`test-fixtures.mjs` only) | 0 | dropped |
| `project-loop` | slow | own (import) | 96 | kept |
| `release-merge` | slow | other (`test-fixtures.mjs` only) | 0 | dropped |
| `release-note` | slow | other (a module that names the hub) | 0 | dropped |
| `release-tags` | slow | own (import) | 26 | kept |
| `roadmap-loop-followups` | slow | own (import) | 125 | kept |
| `roadmap-loop-upfront` | slow | own (import) | 168 | kept |
| `roadmap-loop` | slow | own (import) | 156 | kept |
| `stage-models` | slow | own (import) | 133 | kept |
| `status-line` | fast | own (import) | 74 | kept |
| `version-pin` | slow | own (import) | 140 | kept |
| `changes-under-way` | fast | own (spawns it, line 186) | 61 | kept |
| `gh-version` | fast | other (`test-fixtures.mjs` only) | 0 | dropped |
| `github-setup` | slow | other (`test-fixtures.mjs` only) | 0 | dropped |
| `setup-block` | fast | own (import) | 6 | kept |

`deliver-check.mjs`, 33 to 29 test files (23 slow to 22):

| Test | Speed | Class (how) | Beyond load | Link |
|---|---|---|---|---|
| `devkit-kit` | fast | other (writes a stub named `deliver-check.mjs`, lines 54, 74, 104) | 0 | dropped |
| `change-loop-compozy` | slow | own (import) | 167 | kept |
| `change-loop-declared` | slow | own (import) | 210 | kept |
| `change-loop-remote-state` | slow | other (through `change-loop.mjs`) | 132 | kept |
| `change-loop-remote` | slow | other (through `change-loop.mjs`) | 129 | kept |
| `change-loop` | slow | own (import) | 185 | kept |
| `change-state-stages` | fast | other (through `change-loop.mjs`) | 125 | kept |
| `compozy-driver` | fast | other (through `compozy-driver.mjs` and `change-loop.mjs`) | 0 | dropped |
| `conduct-check` | slow | other (through `deliver-check-fixtures.mjs`) | 303 | kept |
| `deliver-check-archive` | slow | own (import) | 326 | kept |
| `deliver-check-cli` | slow | own (import) | 263 | kept |
| `deliver-check` | slow | own (import) | 375 | kept |
| `delivery-models` | slow | own (import) | 279 | kept |
| `delivery-train-after` | slow | own (import) | 330 | kept |
| `delivery-train` | slow | own (import) | 280 | kept |
| `flow-check` | slow | own (import) | 212 | kept |
| `guard` | fast | own (spawns it, line 276) | 100 | kept |
| `merge-setup` | fast | own (import of `makeGh`, line 12) | 0 | kept |
| `project-loop` | slow | own (spawns it, line 253) | 109 | kept |
| `release-merge` | slow | own (import) | 98 | kept |
| `release-note` | slow | own (import) | 212 | kept |
| `release-tags` | slow | own (import) | 123 | kept |
| `roadmap-loop-followups` | slow | other (through product modules) | 85 | kept |
| `roadmap-loop-upfront` | slow | other (through product modules) | 87 | kept |
| `roadmap-loop` | slow | other (through product modules) | 123 | kept |
| `stage-models` | slow | other (through product modules) | 78 | kept |
| `status-line` | fast | other (through `change-loop.mjs`) | 27 | kept |
| `test-suite` | fast | own (links the real file, line 70) | 14 | kept |
| `version-pin` | slow | own (import) | 120 | kept |
| `changes-under-way` | fast | own (spawns it, line 71) | 86 | kept |
| `gh-version` | fast | other (`test-fixtures.mjs` only) | 0 | dropped |
| `github-setup` | slow | other (`test-fixtures.mjs`; names the hub only in a workflow string, line 56) | 0 | dropped |
| `setup-block` | fast | own (import) | 10 | kept |

So a pull request on `change-loop.mjs` alone selects 24 files instead of 33, and one on
`deliver-check.mjs` alone 29 instead of 33. M6 still holds after the drops: each dropped test
stays linked by other keys, and `mapProblems` of the simulated head map is empty (task 1.5
checks it again).

What stays: 16 of the 24 tests left on `change-loop.mjs` and 22 of the 29 left on
`deliver-check.mjs` are slow, and each of those runs the hub's code (from 26 to 375 functions
beyond load). The hub selections stay large because the slow tests really execute these modules,
not because of the seed's links. Making them small needs a split of those test files or a
finer-grained map; the requirements leave both out ("Out of scope").

Alternatives rejected:

- Deciding by the static import scan alone: an import chain is not proof that the test runs the
  module (owner's answer 2). Through `test-fixtures.mjs`'s helpers (`decide`, `nextStep`,
  `collectState`, `runCli`), a test can run a hub without naming it.
- Dropping only the tests that reach the hub through `test-fixtures.mjs` or `guard.mjs`, and keeping
  every other test whatever it runs: it keeps five links that the coverage run shows run none of
  the hub's code. The owner can still choose it at plan approval (24 becomes 27 for
  `change-loop.mjs`, 29 becomes 31 for `deliver-check.mjs`).
- Dropping every test that does not import the hub itself, executed or not: `change-state-stages`
  runs 125 functions of `deliver-check.mjs` beyond its load and `status-line` runs `approvalState`
  and `authorizedRounds`; dropping them would hide real coverage until the train.
- Dropping own tests that execute nothing of the hub (`gen-agents`, `jira-task`, `merge-setup`):
  the owner's answer keeps the tests that import or read the hub themselves, and they are fast.
- A per-function map (a test linked to the functions it runs): it needs a rule change (S4 links
  whole files), which the requirements leave out.

### D-5 The test that pins the result

One new test file section in `plugins/openspec/hooks/test-suite.test.mjs`, after T-16 (line 1023),
with its invariant comment:

```text
// Invariant: a document key of the repository's map (a non-code path outside plugins/) lists no
// slow test, the fast readers of the eight named documents stay linked, the hub links of tests
// that neither import nor run change-loop.mjs or deliver-check.mjs stay dropped, and no files key
// has an empty list. Layer: the data of scripts/test-map.json (design D-1 to D-4 of
// test-map-hub-links). Suite: test-suite.
```

Two helpers, local to the test file:

- `isDocumentKey(key)`: true when `key` does not start with `plugins/`, does not end in `.mjs`,
  `.js`, `.cjs`, `.py` or `.sh`, and has no `bin/` segment (D-1).
- `slowDocumentLinks(map)`: the sorted `<key>: <test>` strings for each document key whose list
  holds a test of `map.slow`.

Three tests, one per behaviour, each condition and label with its own case (negatives included):

| Id | Name | Cases |
|---|---|---|
| T-1 | `test-map-hub-links AC-1 a document key is a non-code path outside plugins/` | true: `openspec/roadmap.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `.gitignore`, `docs/adr/` (a folder key); false: `plugins/openspec/README.md` (under `plugins/`), `scripts/test-suite.mjs` (`.mjs`), `x.js`, `x.cjs`, `scripts/check.py` (`.py`), `plugins/openspec/skills/devkit/scripts/install-schemas.sh` (`.sh`, and under `plugins/`), `tools/run.sh` (`.sh` alone), `.compozy/bin/devkit-kit` (a `bin/` segment) |
| T-2 | `test-map-hub-links AC-1 slowDocumentLinks names each document key that lists a slow test` | a synthetic map with `slow: [S]`: a document key listing `S` and a fast `F` gives `[<key>: S]`; a document key listing only `F` gives nothing; a code key (`scripts/x.mjs`) listing `S` gives nothing; a non-code key under `plugins/` listing `S` gives nothing; two document keys with `S` give both, sorted |
| T-3 | `test-map-hub-links AC-1 AC-2 AC-3 AC-4 the repository's map links no slow test to a document, keeps the named documents' readers and the hubs' dropped links out, and has no empty list` | on `readTestMap(REPO_ROOT)`: `slowDocumentLinks` is `[]`; each kept reader of the eight named documents (D-3) is in its key's list; no test that D-4 drops is in its hub's list, and `change-loop.test.mjs` and `deliver-check.test.mjs` are still in their hub's list; every `files` value has at least one test |

T-16 stays as it is and keeps passing (AC-4): `mapProblems` is empty, `test-fixtures.mjs` is
shared, `slow` is not empty and holds only suite files, and the `scripts/test-suite.mjs` entry holds
`test-suite.test.mjs` and not `ship-entry.test.mjs`. This change edits none of those parts of the
map.

Test first: T-1 and T-2 are written with their helpers and pass at once (pure functions of the
test file). T-3 is written before the map is edited and fails on the base map, naming
`openspec/roadmap.md: plugins/openspec/hooks/change-loop.test.mjs` among the `slowDocumentLinks`.
That red run is task 1.4's own check, not a gate. T-3 passes after task 1.5.

### D-6 `CONTRIBUTING.md`

One sentence is added to the paragraph of `--own-files` (`CONTRIBUTING.md:44`), right after
"A comment line links nothing, only code lines do.":

> A document key (a non-code path outside `plugins/`) lists only the fast test files that read the
> document from the checkout, never a slow one, and a document no fast test reads has no key unless
> it would then select the whole suite; the keys of `change-loop.mjs` and `deliver-check.mjs` leave
> out a test file that reaches them only through `test-fixtures.mjs` or `guard.mjs` and runs none of
> their code.

The tests that read this paragraph, and what the edit keeps for each:

- `suite-speed AC-7 ...` (`test-suite`): no line names the old command. The sentence names none.
- `suite-speed AC-8 ...` (`test-suite`): the paragraph right after the command block (line 42)
  states the measured time. Line 44 is the next paragraph, so the edit does not touch it.
- `selective-tests-by-map-2 AC-5 T-30 ... CONTRIBUTING.md names the mode and the map ...`
  (`test-suite`): `--own-files` and `scripts/test-map.json` stay in the file.
- `deliver-check-cli` line 670 (`/own files/`), `release-tags` 601 (step 5), `release-note` 979
  (step 5), `delivery-train-after` 786 to 792: their patterns are in other sentences and paragraphs,
  which the edit keeps word for word. These four are slow, so the change's own gate does not run
  them; the whole run of task 2.4 does.
- `guard`'s ADR 0003 and ADR 0004 tests (lines 483 and 614): `CONTRIBUTING.md` still names `0003`
  and `0004`.
- `python3 scripts/check.py`: links, names and the language check.

`CLAUDE.md` is not edited. Its map row and its upkeep rule (lines 34 and 53) stay true, and
`test-suite`'s T-30 pins them.

### D-7 CI: measured, not changed

The fixed part of `check` in run 46024905007 is about 13 s (Context). After this change, a
pull request whose own files are Markdown outside `plugins/` selects only fast files, among four:
`guard`, `test-suite`, `review-round` and `status-line` (the union of the Markdown keys' new
lists), and none when it touches no keyed document. They run in parallel, so `guard` sets the
time. On the base, `guard` ran 34.5 s alone in the trace and 59.6 s at
concurrency 14 in the archived baseline (`openspec/changes/archive/2026-11-27-selective-tests-by-map-2/proof/base-whole.txt`).
The sum stays under 2 minutes on the CI runner if `guard` runs there in under about 100 s. So
`.github/workflows/ci.yml` is not edited, and the OpenSpec install is not cached.

AC-6's evidence (task 2.5) holds:

- each non-suite step's time from run 46024905007 (`gh run view 46024905007 --json jobs`), saved as
  `proof/ci-fixed-part.txt`;
- the time of `node scripts/test-suite.mjs --own-files` on a scratch branch whose only own file is
  `openspec/roadmap.md`, measured locally, saved as `proof/markdown-only.txt`.

The job time of a real Markdown-only pull request is CI-only proof, so it is a workflow follow-up:
this change's archive pull request (own files `openspec/changes/archive/...` and
`openspec/roadmap.md`). If that job, or the local sum, comes out above about 2 minutes, the change
goes back to the owner before any CI edit (requirements, answer 3).

Alternative rejected: caching `npm i -g @fission-ai/openspec@2.0.0`. It saves at most 3 s of
13 s, and `test-tmp`'s `test-fixture-cleanup AC-5 ...` pins a step named `Install OpenSpec` before
`Test suite`.

### D-8 The proofs

All under `openspec/changes/test-map-hub-links/proof/`, each with the command that made it and the
sha it ran on:

| File | What | AC |
|---|---|---|
| `before-selection.txt` | the base map's `selected` lines for each of the eight documents and the two hubs alone, made with the simulation script of task 1.1 (`selectTests` with `sharedUses`, as `selectOwn` calls it), and the counts | AC-1, AC-3 |
| `doc-reads.txt` | the tracer's source, the 21 traced runs, the grep of D-2's limits, the D-3 table as computed | AC-1, AC-2 |
| `hub-coverage.txt` | the coverage script's source, the baseline, and per test file its class, exit code and functions run beyond load, for each hub | AC-3 |
| `after-selection.txt` | the same lines as `before-selection.txt`, on the head's map, then `mapProblems` (empty) | AC-1, AC-3, AC-4 |
| `reader-fails.txt` | the AC-2 run of D-3 | AC-2 |
| `base-whole.txt`, `head-whole.txt`, `train-whole.txt`, `same-tests.txt` | the AC-5 runs and their comparison (task 2.4) | AC-5 |
| `ci-fixed-part.txt`, `markdown-only.txt` | D-7 | AC-6 |

AC-5's procedure follows `selective-tests-by-map-2` D-10:

1. `base-whole.txt`: before any edit (task 1.1), on the base head, `node scripts/test-suite.mjs --reporter=tap`
   with no `TMPDIR` override, its per-file summary lines, its `suite:` line, the sha, the core count
   and `uptime`. The tap output stays under `/var/tmp/devkit-tmhl/base.tap`.
2. `head-whole.txt`: the same on the head after the last merge of the base.
3. `train-whole.txt`: `DEVKIT_BRANCH=train/1 node scripts/test-suite.mjs --own-files --reporter=tap`
   on the head. Its first line is `selected the whole suite: train/1 is a train branch`.
4. `same-tests.txt`: the sorted `start` lines and the sorted test names (`ok`/`not ok` lines of the
   tap output, with their subtest path) of runs 1 and 2, and of runs 1 and 3, diffed. The three test
   names T-1 to T-3 of D-5 are removed from the head lists first, and the file names them. Both diffs
   must be empty.

### Pinned rules: the tests that read what this change edits

The search covered every suite folder for `test-map.json`, `readTestMap`, `MAP_FILE`, `.files[`
and `map.files`, for the keys this change edits and for the texts of D-6. Only `test-suite` reads
the repository's own map (T-16, line 1023). Every other `test-map.json` reader in `test-suite` builds
its own map in a temporary tree (`MAP_FILES`, line 892; `eFiles`, line 1113).

| Test (file) | Invariant | Layer | Suite | This change |
|---|---|---|---|---|
| `selective-tests-by-map-2 AC-9 AC-2 T-16 ...` (`test-suite`) | the repository's map has no problem, shares `test-fixtures.mjs`, marks slow tests, links `scripts/test-suite.mjs` by code lines | map data | test-suite | unchanged, stays green (AC-4) |
| T-1 to T-3 of D-5 (`test-suite`) | D-5's invariant | map data | test-suite | new |
| `suite-speed AC-7 ...` (`test-suite`, line 501) | no tracked file outside the records names the old command | documents | test-suite | unchanged; D-6's sentence names none |
| `suite-speed AC-8 ...` (`test-suite`, line 531) | `CLAUDE.md` and `CONTRIBUTING.md` state the measured time | documents | test-suite | unchanged; line 42 is not edited |
| `selective-tests-by-map-2 AC-5 T-30 ...` (`test-suite`, line 1388) | the documents name the mode and the map | documents | test-suite | unchanged |
| `test-fixture-cleanup AC-5 ...`, `selective-tests-by-map-2 AC-7 ...` (`test-tmp`, lines 198 and 217) | the CI steps | CI text | test-tmp | unchanged; `ci.yml` is not edited |
| `deliver-check-cli` lines 666 and 1322, `delivery-train-after` 773, `release-tags` 601, `release-note` 979 | the `CONTRIBUTING.md` texts they pin | documents | their own files (slow) | unchanged; run in task 2.4's whole runs |

No other test pins a key, a list or a count of the repository's map.

## Risks / Trade-offs

- [A slow test that pins a document's text no longer runs on that document's pull request] →
  accepted by the owner (answer 1). The train's whole-suite `check` and the bisection of ADR 0022
  decision 7 find it. D-3 lists the slow readers of the named documents so a reviewer knows them.
- [The trace misses a read (a non-Node child, an environment without `NODE_OPTIONS`)] → D-2's grep
  covers the non-Node children. A missed read can only be a missed reader, so the result can only
  drop a reader that is not linked today; every narrowed key keeps each linked fast test the trace
  shows reading it.
- [The coverage run misses a child process (an environment without `NODE_V8_COVERAGE`)] → only
  other tests are decided by coverage, and none of them imports, reads or spawns the real hub
  file. The helper that spawns a hub for them (`runCli`) passes `process.env` on. A dropped test
  that runs the hub after all is found at the train.
- [The map is edited by hand later and a slow test comes back to a document] → T-3 fails on it, and
  `scripts/test-map.json`'s key selects `test-suite` on that pull request.
- [A sibling change edits `scripts/test-map.json` before this one merges] → the last merge of
  `origin/main` (task 2.1) reruns `mapProblems` and T-3. A conflict in the map is resolved by
  applying D-3 and D-4 to the merged keys.
- [The whole runs of AC-5 flake under load (`--watch` tests)] → run them with no other suite on the
  machine, a load under about 20, and a failure re-run alone (CONTRIBUTING.md:42).
- [The hub narrowing is small] → see `proposal.md`, "Flagged for the owner".

## Migration Plan

One commit edits the map, the test and `CONTRIBUTING.md` together (the upkeep rule, CLAUDE.md:53).
Nothing is deployed: the map is read only by `--own-files`. Rollback is reverting that commit; the
selection goes back to the base lists, and no other file depends on the new ones.

## Implementation plan

Order: proofs on the base (the data the edit needs) → the test (red) → the map → the document →
the proofs on the head.

**Per surface.** Repository data (`scripts/test-map.json`): D-3 and D-4. Repository tests
(`plugins/openspec/hooks/test-suite.test.mjs`): D-5. Docs (`CONTRIBUTING.md`): D-6. No backend,
frontend, worker or CI surface.

**File structure.** Modify `scripts/test-map.json`, `plugins/openspec/hooks/test-suite.test.mjs`
and `CONTRIBUTING.md`. Create the proof files of D-8 under
`openspec/changes/test-map-hub-links/proof/`. Delete nothing. The tracer and the coverage script
live in the session's scratch folder and are copied into their proof files, never committed as
scripts.

**Estimate.** Optimistic 5 h, likely 8 h, pessimistic 13 h (most of it is wall clock: one coverage
run of about 15 min and three whole runs of about 12 min each).

| Component | Hours | Type | Risk |
|---|---|---|---|
| Base selections and baseline whole run (1.1) | 1 | Testing | LOW |
| Trace of the fast tests and the D-3 table (1.2) | 1 | Testing | MEDIUM |
| Coverage run and the D-4 result (1.3) | 1.5 | Testing | MEDIUM |
| T-1 to T-3, red (1.4) | 1 | Testing | LOW |
| Map edit (1.5) | 1 | Core | MEDIUM |
| `CONTRIBUTING.md` sentence (1.6) | 0.5 | Documentation | LOW |
| AC-2 run, AC-5 runs and comparison, AC-6 times (2.2 to 2.5) | 2 | Testing | MEDIUM |

**Risks** (probability × impact, mitigation):

- the trace or the coverage run on the implementer's machine gives another set than this plan's
  tables (MEDIUM × MEDIUM): a different set stops the task, and the plan's tables are revised
  before the map is edited (tasks 1.2 and 1.3), so the implementer makes no design choice;
- a whole run of AC-5 flakes (MEDIUM × LOW): quiet machine, a lone re-run of the failed file, as
  `CONTRIBUTING.md:42` says;
- the CI runner is slower than the local machine and the Markdown-only job passes 2 minutes
  (LOW × MEDIUM): the follow-up reads the archive pull request's job, and a time over the target
  goes back to the owner before any CI change (D-7);
- a sibling change merges a map edit first (LOW × MEDIUM): task 2.1 re-applies D-3 and D-4 and
  reruns T-3.

**Assumptions** (where the plan breaks if reality differs):

- the base map is the one the tables were computed on, `02713b3a`; task 2.1's merge rechecks it;
- `NODE_OPTIONS` and `NODE_V8_COVERAGE` reach every Node child that the fast tests and the other
  tests of D-4 spawn (D-2, D-4; `runCli` passes `t.env`, built from `process.env`);
- `ownDiffPaths` drops the release files (`deliver-check.mjs:351`, `RELEASE_FILE` at line 1732);
- the CI runner runs `guard` in under about 100 s (D-7; the archive pull request shows it).

**Dependencies.** `selective-tests-by-map-2` (archived, PRs 157 and 159): the map, `selectTests`,
`mapProblems` and T-16. ADR 0036: the selection rules this change keeps.

## Open Questions

None.
