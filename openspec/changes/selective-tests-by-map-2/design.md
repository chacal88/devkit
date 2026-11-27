<!-- devkit-stage design result=passed attempt=2 commit=22f70c31f9bcbba9c8e6babe685dd4b07de05725 -->
# Design

Change: `selective-tests-by-map-2` · Date: 2026-11-26 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `decisions.md`, `release.md`, the unnumbered record
`docs/adr/a-change-runs-only-the-tests-its-files-map-to.md`). Base: `origin/main` at `e8991d6d`;
the branch was opened on it and has merged nothing yet. "The record" below is that file; every
repository file this design edits cites it as `ADR [a-change-runs-only-the-tests-its-files-map-to]`
and never by a number (`proposal.md`, "Release rule"; D-9).

## Context

See `proposal.md` (Why). The state at `e8991d6d` (the branch's tree adds only its change folder):

- `scripts/test-suite.mjs` (ADR 0026) is the one test command. `suiteFiles()` lists the 44
  `*.test.mjs` files of the four `SUITE_FOLDERS`. `parseArgs()` takes `--concurrency=`,
  `--reporter=`, `--test-name-pattern=`, `--test-skip-pattern=` and file arguments. `testImports()`
  refuses a test-file import before anything runs, and `main()` exits 1 with `no test file under ...`
  when nothing is chosen. The script imports only Node built-ins.
  `plugins/openspec/hooks/test-suite.test.mjs` runs copies of the script inside synthetic trees
  (`tree()` copies `scripts/test-suite.mjs` alone).
- `plugins/openspec/hooks/deliver-check.mjs` holds the own-files rule of ADR 0025:
  - `stalenessBase(root, env)` (line 331) gives the base: `GITHUB_BASE_REF`, else the configured
    base, else `origin/HEAD`, else `main`/`master`.
  - `gitFacts(root, { base })` (line 318) gives `{ head, dirty, base }`. `dirty` comes from
    `dirtyPaths` (line 299): the uncommitted paths outside `openspec/` (`isOpenspec`, line 266);
    untracked ones under `.claude/` are left out too.
  - `baseTip` (line 325) and `headInBase` (line 343) find the base's tip and whether the head is in it.
  - `ownFiles(root, id, facts)` (line 352) runs
    `git diff --name-only -z --no-renames <tip>...<head>` (line 359) and drops `RELEASE_FILE` (line 1705).
  - `TRAIN_BRANCH = /^train\/(\d+)$/` is at line 1093.
  - The merged `release-at-merge` added `releaseEditOf` (line 2159), which `staleness` takes beside
    `ownFiles` for a change with a release note; it does not touch `ownFiles` or `RELEASE_FILE`.

  The module imports `./merge-setup.mjs` and `./guard.mjs` and runs `main` only as an entry point.
- `tasksItem()` (line 561) gives a gate part a free pass only when it equals a part of
  `devkit.delivery.train` (`node scripts/test-suite.mjs && python3 scripts/check.py`, `openspec/config.yaml:30`).
  Every other part needs a `pass` row in `evidence.md`.
- `.github/workflows/ci.yml` job `check` checks out at the default depth 1 (the merged ref on a
  pull request) and runs `node scripts/test-suite.mjs` in its `Test suite` step.
- The agents that run tests after a merge of the base (`resolve-release-conflict` and `renumber-adr`
  in `plugins/openspec/skills/devkit/SKILL.md:116-118`, the release merge in `docs/openspec-flow.md:347`)
  run "the project's test command". The tdd-implementer runs the repository's real commands from
  `CLAUDE.md`, and the pr-verifier runs each gate part of `tasks.md`. In this repository the command
  comes from `openspec/config.yaml` `context` (`Test command:`, `Gates:`) and from `CLAUDE.md`
  (Commands). So those texts decide what the gates, the proof and the base merges run.
- Per-file times: the last recorded whole run (`openspec/changes/archive/2026-11-26-archive-release-pin/proof/full-suite.txt`,
  concurrency 8) has 21 files at 60 s or more and 17 under 30 s. The paths in that run predate the setup move,
  and the run predates `plugins/openspec/hooks/release-note.test.mjs`, which `release-at-merge` added.

## Goals / Non-Goals

**Goals:**

- The selection rules of the record's decision 2, in one exported pure function, with one test per rule,
  negatives included.
- The own-files list that `--own-files` reads comes from the same code as the staleness rule.
- `node scripts/test-suite.mjs` without `--own-files` keeps every behaviour it has (AC-8): it never
  loads the map or `deliver-check.mjs`.

**Non-Goals:**

- Following imports at selection time beyond the shared helpers (ADR 0025 rejected the dependency
  closure). The map is seeded once by a scan (D-4) and then kept by hand.
- Selecting `check.py`, `gen-catalog.py --check` or `gen-agents.mjs --check`, the panel's tests, or
  changing the train (requirements, Out of scope).
- Changing a generic agent or skill. They keep "the project's test command", and this repository's
  texts name the selective command.

## Decisions

### D-1 The mode: `node scripts/test-suite.mjs --own-files`

- Spelling `--own-files`, after ADR 0025's "own files". It takes no value: `--own-files=x` is an
  `unknown argument`, exit 2. It refuses file arguments (`--own-files takes no file argument`,
  exit 2). It combines with `--concurrency=`, `--reporter=` and the two pattern flags, which reach
  the children as today.
- `USAGE` gains `[--own-files]` after `[--test-skip-pattern=<re>]`. The header comment of the
  script names the mode and cites the record as `ADR [a-change-runs-only-the-tests-its-files-map-to]`. The usage line still starts with `usage: node scripts/test-suite.mjs `,
  as `test-suite.test.mjs:91` and `:670` match.
- Under `--own-files` only, `main()` loads `deliver-check.mjs` with a dynamic `import()` of
  `pathToFileURL(join(root, 'plugins/openspec/hooks/deliver-check.mjs'))`. It then reads and checks
  the map (D-3), computes the own files (D-2), selects (D-5), prints the `selected` lines (D-6) and
  runs the chosen files through the existing pool. Without the flag, none of this runs (AC-8).
- Alternative rejected: a second script. ADR 0026 decision 1 and the record's decision 3 keep one
  command. A static import of `deliver-check.mjs` was rejected too: it would load the module on
  every whole run, and every synthetic tree of `test-suite.test.mjs` would need the module.

### D-2 The own files: one helper in `deliver-check.mjs`

- New export `ownDiffPaths(root, tip, head)`: the `Set` of paths of
  `git diff --name-only -z --no-renames <tip>...<head>`, minus `RELEASE_FILE`. It throws as git does
  when there is no merge base. `ownFiles()` line 359 calls it in place of its inline expression, so
  the staleness rule runs the same command it runs today.
- New export `branchOwnPaths(root, facts)`, returning `{ base, paths }` (sorted, unique) or
  `{ base, why }`:
  - `facts.base` null: `why` = `no base branch`.
  - no `origin/<base>`: `why` = `origin/<base> is missing`.
  - no commit yet: `why` = `no commit`.
  - head contained in `origin/<base>`: `paths` = `facts.dirty` minus `RELEASE_FILE`.
  - otherwise: `paths` = `ownDiffPaths(...)` together with `facts.dirty`, minus `RELEASE_FILE`. When
    `ownDiffPaths` throws (git finds no merge base), `why` = `no merge base with origin/<base>`.
- `baseTip` stays private. `branchOwnPaths` is the one caller outside `ownFiles`. The script calls
  `branchOwnPaths(root, gitFacts(root, { base: stalenessBase(root, process.env) }))`. The CI base
  (`GITHUB_BASE_REF`) and the local one (`origin/HEAD`) therefore come from the rule the reviews check
  uses (ADR 0025 decision 5).
- Git itself can fail before `branchOwnPaths` decides anything: `gitFacts` calls `dirtyPaths`, whose
  `git status --porcelain -z -uall` throws in a folder that is not a git work tree (an export, a
  tarball, a copy made by `git archive`), and so does any git call when git is missing or the
  repository is broken. The script therefore makes that one call inside a `try`. Any error it throws
  gives `{ base: null, why }` with `why` = `git cannot tell the own files: <first line of the error's
  message>`. `main()` keeps catching only `UsageError`; this `try` is the one other catch, and it
  wraps only the own-files call, never the map check or the run. The head branch read of D-5 is
  guarded the same way.
- What the list holds, against `ownFiles`:
  - It has no rule for `openspec/changes/<id>/` (it takes no id). `ownFiles` adds that whole folder
    to `isOwn`; this list holds only the committed paths of the diff, the change folder's committed
    files among them. They select nothing (S5), but they count in the `<n> own files` of the `none`
    line (D-6).
  - It adds the uncommitted paths (`facts.dirty`), because a gate runs before the commit. Those are
    the paths of `dirtyPaths`, so an uncommitted path under `openspec/` never counts. A mapped file
    under `openspec/` (`openspec/config.yaml`, which D-8 edits) selects its tests only once it is
    committed. Every task commits its files before its phase gate runs (`tasks.md`), so the gates
    see it. The script does not read `git status` a second time to add them: one helper, one rule.
  - It drops `RELEASE_FILE` only, as `ownFiles` does. The release-class edits of a change with a
    release note (`0034-release-at-merge.md` decision 5: the renamed record, the rewritten
    citations) stay in it and select the tests they map to: they only add tests, never remove one.
- Every `why`, the git failure included, selects the whole suite (fail safe, ADR 0025 decision 4).
- Alternative rejected: computing the diff inside `scripts/test-suite.mjs`. That would be a second
  copy of the release-file rule and of the base lookup.

### D-3 The map: `scripts/test-map.json`

One file under `scripts/`, beside the script that reads it (option (a) of the requirements). The
suite's four folders span three packs, `SUITE_FOLDERS` already lives in one place, and per-pack maps
would split one rule over three files that every selection reads anyway. The format is JSON, so no
new parser is needed. Shape:

```json
{
  "slow": ["plugins/openspec/hooks/change-loop.test.mjs"],
  "shared": { "plugins/openspec/hooks/test-fixtures.mjs": [] },
  "files": {
    "plugins/openspec/hooks/deliver-check.mjs": ["plugins/openspec/hooks/deliver-check.test.mjs"],
    "plugins/panel/": ["plugins/openspec/hooks/test-suite.test.mjs"]
  }
}
```

- `files`: a key is a repository path. A key that ends in `/` is a folder and covers every path under
  it. The value is the list of suite test files that cover the key. An empty list is allowed and
  means that no test covers the key: an own path whose matching key (S4) has an empty list is
  classed as S7 and selects the whole suite, whatever the path. That keeps AC-4 ("code no entry
  covers runs the whole suite") for a key that covers nothing, and keeps M5 satisfiable for a module
  no test reaches. The seed can write such a key (D-4 rule 3, a module no test reaches); rules 4 and
  5 never do, because they make a key only for a path some test names.
- `shared`: a key is a shared test helper. Its value lists the slow test files linked to it directly,
  and is usually empty.
- `slow`: the slow suite test files.
- Paths are relative to the repository root, with `/`.

`mapProblems(root, map, suite)` returns `[{ entry, why }]`. Each problem is printed to stderr as
`scripts/test-map.json: <entry>: <why>`, then `refused: <n> test map problems`; the script exits 1
before any file runs. The problems:

| # | Problem | `why` |
|---|---|---|
| M1 | a key, value, shared key, shared link or slow item names no existing path; a folder key names no folder (AC-9) | `names <path>, which does not exist` / `is not a folder` |
| M2 | a value, shared link or slow item is not a suite test file | `links <path>, which is not a test file of the suite` |
| M3 | a `files` or `shared` key is a suite test file (a test selects itself) | `is a test file of the suite: it selects itself` |
| M4 | a path is both a `files` key and a `shared` key | `is both a file entry and a shared helper` |
| M5 | a file under one of the four suite folders that is not a suite test file and that no key covers ("a script the map lacks") | `is not covered by the map` |
| M6 | a suite test file that no `files` value and no `shared` link names ("a test the map lacks"); importing a shared helper does not count as a link | `is linked to nothing` |
| M7 | the shape: not an object, a top-level key other than `slow`, `shared`, `files`, a value that is not an array of strings | `is not ...` (the expected shape) |

The file's input, which the readiness review asks for under "Parsers":

- missing: `scripts/test-map.json: cannot read: ENOENT`;
- empty or not valid JSON: `scripts/test-map.json: not JSON: <message of JSON.parse>`;
- a JSON value that is not an object: M7.

Each of these exits 1 before any file runs. A whole run never reads the file, so a missing or broken
map never touches it (T-25).

M6 has no exemption for the users of a shared helper. 41 of the 44 suite tests import
`test-tmp.mjs` or `test-fixtures.mjs`, so an exemption would make the check void. The exemption is
not needed either: S3 already selects a helper's fast users through `uses`, and D-4 rule 6 links
every test in the seed. So a test that only imports a shared helper and that no entry names is a
problem.

The script refuses a bad map on every `--own-files` run, so a change that adds a module or a test
without an entry fails its own gate. That is how the map "cannot rot unnoticed" (requirements). The
test T-16 pins the repository's own map (`mapProblems` is empty) and runs on the train and whenever
`scripts/test-map.json` is an own file.

### D-4 The map's first content

The implementer builds it once, at task 1.6, from the following rules applied to the tree as it
stands then. The rules are written down so that the seed is mechanical. The computation runs as a
scratch script in the session's scratch folder and is never committed. From then on the map is kept
by hand (the record's decision 1).

1. `slow`: every suite test file with 60 s or more in the per-file summary of the baseline whole run
   of task 1.1 (`proof/base-whole.txt`). The 60 s line follows the recorded run named in Context.
   Over-marking only makes the shared-helper rule run fewer files.
2. `shared`: the three `test-tmp.mjs` copies (`plugins/openspec/hooks/`,
   `plugins/core/skills/review-change/scripts/`, `plugins/compozy/skills/`) and
   `plugins/openspec/hooks/test-fixtures.mjs`, each with `[]`. The `<name>-fixtures.mjs` modules are
   `files` keys instead (rule 3): each serves a few tests, all of which should run.
3. A `files` key for every file under the four suite folders that is not a suite test, not a shared
   helper and not under a `fixtures/` folder. Its value is every suite test file that reaches the
   key through relative imports (static `from '...'`, `import '...'`, dynamic `import('...')`,
   transitively through any non-test module), or whose code lines, or the code lines of a module it
   imports, hold the key's file name.
4. A `files` key for every other tracked file, outside `openspec/changes/` and not a suite test, whose
   repository path, or whose file name when that name is unique in `git ls-files`, appears on a
   code line of a suite test or of a module it imports. Its value is those tests.
5. Folder keys:
   - `plugins/openspec/hooks/fixtures/` and `plugins/openspec/skills/devkit/scripts/fixtures/`:
     the suite tests of the parent folder whose text holds `fixtures`;
   - `plugins/openspec/schemas/`: the suite tests whose text holds `schemas`;
   - `plugins/compozy/kit/templates/`: those whose text holds `templates`;
   - `plugins/panel/`: those whose text holds `panel` (four today: `change-loop-compozy`,
     `deliver-check-cli`, `deliver-check-archive`, `test-suite`).
6. Every suite test still linked to nothing is added to one key, chosen mechanically. The
   candidates are the files that rule 3 made keys of (under the four suite folders) whose file name
   the test's text holds anywhere, comment lines included. The test joins the value of the first
   candidate in `LC_ALL=C` sorted order of repository path. With no candidate, it joins the value of
   `scripts/test-suite.mjs`. Then M6 holds. The seed script prints one line per test this rule
   placed, and the line goes in the commit message of task 1.6. At `e8991d6d` the three tests that
   import no shared helper are linked earlier (`jira-task.test.mjs` imports `jira-task.mjs`, rule 3;
   `adoption.test.mjs` and `loop-templates.test.mjs` hold `templates`, rule 5), so the rule is
   expected to place none.

A code line, in rules 3 and 4, is a line whose first non-blank characters are not `//`, `/*` or
`*`. A mention on a comment line links nothing. Rule 5 is unchanged: it matches a folder word
anywhere in the text.

Why comments do not count. The owner's rule is that only the tests linked to the own files run, and a
link means that the test runs, imports or reads the file. A header comment does none of these.
`scripts/test-suite.mjs` shows the cost of counting comments: 35 of the 44 suite tests name it, and
nearly all of them only in the header line "Run by `node scripts/test-suite.mjs`". Counted as a link,
that line would make every change to the script run about 35 files, slow ones included, and this
change edits the script. With comment lines left out, at `e8991d6d`, the path is on a code line of
`test-suite.test.mjs` and `test-tmp.test.mjs` (the CI pin), and of `delivery-train-fixtures.mjs`
(its `SUITE` constant). That module is imported by `delivery-train.test.mjs`,
`delivery-train-after.test.mjs` and `deliver-check-archive.test.mjs`, so the key gets those five
tests, plus any test that rule 6 sends to it. Alternatives rejected:

- Fixing the one entry by hand. The seed would stop being mechanical, and every other key that tests
  name in comments (a module named in a "Tests for" header, for example) would keep the same fault.
- Following only imports and dropping text mentions. Tests that read a file without importing it
  (`CLAUDE.md`, `openspec/config.yaml`, `ci.yml`, a `SKILL.md`) would lose their link. S7 would then
  select the whole suite for those paths, or S5 and S6 would select nothing for them.

This decision does not make this change's own gate small, and the plan does not expect it to be.
The change also edits `plugins/openspec/hooks/deliver-check.mjs`. Many suite tests reach that module
through real imports, through `test-fixtures.mjs`, the `*-fixtures.mjs` modules and the product
modules that import it, so rule 3 links them. That link is real. The gain shows on changes whose own
files are leaves of the import graph.

Each list is sorted and unique. `mapProblems` must be empty when task 1.6 ends. Paths that none of
the rules reach stay unmapped and select by D-5: an unmapped `SKILL.md` or `schema.yaml` (a file name
that is not unique) selects the whole suite, a root Markdown selects nothing.

### D-5 The selection: `selectTests({ own, map, suite, exists, uses })`

A pure function exported from `scripts/test-suite.mjs`:

- `own`: the sorted own paths.
- `suite`: the `suiteFiles()` list.
- `exists(path)`: a predicate.
- `uses`: a `Map` from each shared helper to the suite test files that use it.

It returns `{ kind: 'files', files: [{ file, by: [own...] }] }`, `{ kind: 'whole', reason }` or
`{ kind: 'none', count }`. Each own path `p` is classed by the first rule that matches:

| Rule | Own path | Selects |
|---|---|---|
| S1 | a suite test file that exists | itself, slow or fast |
| S2 | a path under a suite folder that matches `*.test.mjs` and does not exist (deleted) | nothing |
| S3 | a `shared` key | every fast test in `uses.get(p)`, and every test its entry links (slow ones included) |
| S4 | covered by a `files` key with a non-empty list: the exact key, else the longest folder key that is a prefix of `p` (when that key's list is empty, `p` goes to S7) | that key's tests |
| S5 | under `openspec/` | nothing |
| S6 | ending in `.md` and not under `plugins/` (docs) | nothing |
| S7 | anything else (code no entry covers), and a path whose matching key has an empty list | the whole suite |

Then:

- Any S7 path makes the result `whole`, with `reason` =
  `no entry of scripts/test-map.json covers <p1>[, <p2>...]`.
- Else, a non-empty union makes it `files`, sorted, each test with the sorted own paths that selected
  it. An empty union makes it `none`.
- The S7 reason is the same for both kinds of S7 path: `no entry of scripts/test-map.json covers
  <p>` (a key with an empty list covers nothing).
- "Fast" is "not in `slow`". A slow test runs only through S1, S3's own links or S4: the record's
  decision 2 and AC-2.

`uses` comes from `sharedUses(root, map, suite)`. The scan reads each suite test, each shared
helper, and each test-support module: a file under one of the four suite folders whose name ends in
`-fixtures.mjs`. Each line matching
`/(?:\bfrom\s*|^\s*import\s*|\bimport\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g`
is resolved against the file's folder. A test uses a helper when it imports it, or imports a shared
helper or a test-support module that uses it. The closure goes through shared helpers and
test-support modules only, and stops at every other module. This is the one import scan, run only
under `--own-files`.

So the open point is settled this way: a test that imports `deliver-check-fixtures.mjs`, which
imports `test-fixtures.mjs`, is a user of `test-fixtures.mjs`. The reason is that an edit to the
helper reaches that test through the fixtures module, and AC-3 asks that every fast test the edit
reaches runs. At `e8991d6d` every such test also imports the helper directly, so no selection
differs today. The rule keeps it so when a test drops its direct import. The closure does not follow
product modules (`deliver-check.mjs`, `change-loop.mjs`): ADR 0025 rejected that dependency closure,
and product modules never import a test helper. T-5 pins the path through a `-fixtures.mjs` module.

Before the selection, the script checks the head branch. `GITHUB_HEAD_REF` is read when it is
non-empty. Otherwise the script runs `git rev-parse --abbrev-ref HEAD`, and when that fails (no
commit yet, a folder that is not a git work tree, no git) the branch is unknown. An unknown branch is
not a train branch, and the script goes on to the own files, where the same failure gives a `why`
(D-2). When the branch matches `TRAIN_BRANCH` (imported from `deliver-check.mjs`, not a second
pattern), the result is `whole` with reason `<branch> is a train branch` (the record's decisions 5 and
6). A `why`, from `branchOwnPaths` or from the git failure of D-2, gives `whole` with that `why` as
the reason.

### D-6 The output

All lines go to stdout, before the first `start` line:

- `files`: one line per selected test, `selected <test file> by <own>[, <own>...]`. Then the normal
  run, and its `suite:` summary line, unchanged.
- `whole`: one line, `selected the whole suite: <reason>`. Then the normal whole run.
- `none`: one line, `selected no test file: <n> own files, none maps to a test` (or
  `selected no test file: no own file`). The script exits 0, makes no run root and prints no `suite:`
  line. The whole run's `no test file under ...` exit 1 is unchanged: it is a different case, an
  empty suite.

AC-6 in the evidence. A working rule in `CLAUDE.md`, which the pr-verifier reads first, says how
the row of the selective gate part is written:

- its summary copies the run's `selected` lines, or names the file under `proof/` that holds them,
  together with the `suite:` line;
- a run that selected nothing reads `pass: selected no test file (<n> own files)`, never a
  whole-suite pass.

The row is the part's own `pass` row: `tasksItem` already asks for it, because
`node scripts/test-suite.mjs --own-files` is not a part of `devkit.delivery.train`. T-28 pins that.

### D-7 CI

In `.github/workflows/ci.yml`, job `check`:

- the checkout gets `with: { fetch-depth: "${{ github.event_name == 'pull_request' && '0' || '1' }}" }`.
  A pull request gets the full history, so `origin/<GITHUB_BASE_REF>` resolves. A push keeps depth
  1, which still catches a test that reads history. The values are strings, because a bare `0` is
  falsy in an expression and would give `1`.
- the `Test suite` step runs
  `node scripts/test-suite.mjs ${{ github.event_name == 'pull_request' && '--own-files' || '' }}`.

The checkout of a pull request is the merged ref, and its merge base with `origin/<base>` is the
base tip, so the own files are what the pull request brings. A train's pull request (`GITHUB_HEAD_REF`
= `train/<n>`) gets `whole` through D-5. On push to `main` there is no flag. The job id `check`,
`runs-on`, Node 22 and the step's name stay the same (ADR 0002, ADR 0003, ADR 0022 decision 11).
T-29 in `test-tmp.test.mjs` pins the step and the checkout.

Alternative rejected: the train test in the YAML expression (`!startsWith(github.head_ref, 'train/')`).
It can only be pinned as text, and a second train pattern would exist beside `TRAIN_BRANCH`.

### D-8 The texts the agents read (AC-5)

- `openspec/config.yaml` `context:`
  - `Test command: node scripts/test-suite.mjs --own-files && python3 scripts/check.py`.
  - The `Gates:` line becomes: "A phase gate names `node scripts/test-suite.mjs --own-files` (ADR
    [a-change-runs-only-the-tests-its-files-map-to]: the tests the change's own files map to) and `python3 scripts/check.py`; the selective
    part is not a part of the train's command, so it needs its own passing row after every base
    merge that stales the evidence; a gate naming one test file needs a passing local row after
    every base merge, so a plan uses one only when that file must pass before the train." The
    sentence on `--test-name-pattern` is kept word for word.
  - The `Test history:` line keeps its start and is followed by `Live roadmap:`
    (`change-loop-declared.test.mjs` T140). Its parenthesis reads
    `(CI's push run checks out at depth 1)`.
  - The ADR list gains, as its last entry, after the base's `ADR 0035 ...` entry and before the
    closing `)`, `; ADR [a-change-runs-only-the-tests-its-files-map-to] a change runs only the tests
    its own files map to, amends 0022, 0025 and 0026`. It is the unnumbered citation form; the release
    step rewrites it to the `ADR <NNNN>` form the base's last two entries use when it numbers the
    record (D-9). The 0026 entry keeps its text,
    which `guard.test.mjs` "setup AC-2 records" matches by substring (`amended by <n of the setup
    record>;`).
- `devkit.delivery.train` is unchanged.
- `CLAUDE.md`:
  - a Commands row after the whole-suite row: "The tests the change's own files map to (gates, proof,
    after a base merge; `scripts/test-map.json`)" with `node scripts/test-suite.mjs --own-files`. It
    goes after because `test-suite.test.mjs` "suite-speed AC-8" reads the first line holding
    `node scripts/test-suite.mjs` and asks it for the measured time;
  - the working rule of D-6;
  - a working rule: a change that adds or moves a script or a test under the suite's folders edits
    `scripts/test-map.json` in the same commit.
- `CONTRIBUTING.md`: a new paragraph after the paragraph that follows the `node scripts/test-suite.mjs`
  block (that one must keep the measured time, `test-suite.test.mjs` "suite-speed AC-8"). It holds
  the mode, the map's shape, rules S1 to S7, the refusals M1 to M7, CI's two runs and the upkeep rule.
- `docs/openspec-flow.md:347`: "the whole test suite runs once, in the evidence stage that follows"
  becomes "the project's test command runs once, in the evidence stage that follows". In this
  repository that command is the selective one, and a sentence with a fact about a project must hold
  for this repository too.
- Comments that state CI's depth, which after D-7 holds only for a push:
  - `plugins/openspec/hooks/change-loop-compozy.test.mjs:1129` says "because CI checks out with depth
    1". It becomes "because CI's push run checks out with depth 1".
  - `plugins/openspec/hooks/deliver-check.test.mjs:1324` says "Copied here because CI checks out
    shallow.". It becomes "Copied here because CI's push run checks out shallow.".

  These are comment edits only; no assertion changes.
- Every text above that names the record (the `Gates:` line and the ADR list entry of
  `openspec/config.yaml`, the header comment of `scripts/test-suite.mjs` of D-1, and any mention in
  the `CLAUDE.md` rows or the `CONTRIBUTING.md` paragraph) writes
  `ADR [a-change-runs-only-the-tests-its-files-map-to]`, never a number. No test or fixture file
  cites the record: the release step does not rewrite those files (D-9), and the new tests are named
  `selective-tests-by-map-2 AC-<n> ...`.

### D-9 The records

The ADR file is `docs/adr/a-change-runs-only-the-tests-its-files-map-to.md`, unnumbered, and stays
so on the branch (the release rule of `proposal.md`: no task numbers or renames it):

- `- Status: accepted`, plus an `- Accepted by:` line naming the approval, at plan approval.
- The line
  `- Amended by ADR [a-change-runs-only-the-tests-its-files-map-to] (a-change-runs-only-the-tests-its-files-map-to.md)`
  in the header of ADR 0022, ADR 0025 and ADR 0026: the unnumbered form that `release-merge.test.mjs`
  "release-note AC-5 assign: the first record's Amended by header line ..." (line 939) shows the step rewriting to `- Amended by ADR <NNNN> (<NNNN>-<slug>.md)`.
  In ADR 0022 and ADR 0025 it goes right
  after their `- Amended by ADR 0034 (0034-release-at-merge.md)` line, which `release-at-merge`
  added and the base `e8991d6d` holds. In ADR 0026 it goes after the 0031 line, which
  `guard.test.mjs` "setup AC-2 records" finds with `includes`.
- The release-at-merge records are not amended: this change follows their note rule and changes
  none of their decisions.

The release (`release.md`, `0034-release-at-merge.md` decisions 1, 2 and 7): `packs:` with
`devkit-openspec: patch`, the default marketplace bump, the changelog title and body. No task bumps
a version, writes a `CHANGELOG.md` line, moves a CI pin line of `docs/openspec-flow.md` or
regenerates `docs/catalog.md` for a release; the delivery writes them at the merge. Without the
note, `releaseDelivery` in `deliver-check.mjs` would answer `no release: plugins/openspec ...` for a
branch that changes the pack with no bump of its own; with it, the note's state rules apply.

The number. `decisions.md` lists the record unnumbered, and the release step numbers exactly such
records (`changeAdrs` in `deliver-check.mjs` keeps the listed paths with no `NNNN-` prefix): the
`assign-release` step, or the train's join, gives it the next free number on the base and rewrites
`ADR [a-change-runs-only-the-tests-its-files-map-to]` and
`a-change-runs-only-the-tests-its-files-map-to.md` in tracked text outside `openspec/changes/`
(decision 3 of `0034-release-at-merge.md`; `rewriteCitations` in
`plugins/openspec/hooks/release-merge.mjs`), test and fixture files excluded (`CITATION_PATHSPEC`).
No task of this plan does it.

The change folder's `decisions.md` keeps its `- ADR:` line as written, and nothing rewrites it:
`decisionRecords` in `plugins/openspec/hooks/change-loop.mjs` reads each `- ADR:` path through
`numberedRecord`, which resolves the listed unnumbered path (`<dir>/<slug>.md`) to the numbered
file once the step has numbered it. Task 3.2's check calls `decisionRecords` on this change after 3.1 and
expects no unreadable and no proposed record.

### D-10 AC-8: same files, same test names

This is the procedure of suite-speed's design D-10.

1. The base copy is `git archive <base> | tar -x -C /var/tmp/devkit-stbm/base`, where `<base>` is
   the `origin/main` sha the branch stands on (`e8991d6d`, the sha it was opened on, while it has
   merged nothing; the sha of its latest merge of `origin/main` otherwise). Inside
   it run `git init -q && git add -A -f`; no commit is needed, because no suite test reads `HEAD`.
   When the last merge before review (task 3.1) brings a newer `origin/main`, steps 1 and 2 run
   again on that sha before step 4, so a test file the base added is in both runs. The slow marks
   (D-4 rule 1) keep coming from the first run.
2. In the copy, `node scripts/test-suite.mjs --reporter=tap > /var/tmp/devkit-stbm/base.tap 2>&1`
   must exit 0.
3. At the head, after the last base merge, `node scripts/test-suite.mjs --reporter=tap > .../head.tap`
   runs with no `TMPDIR` override, as CONTRIBUTING.md asks of a change to the suite script.
4. Extract the names (`^\s*(not )?ok [0-9]+ - `, reduced and `LC_ALL=C sort`ed) and drop the head
   names that start with `selective-tests-by-map-2 `. `diff` must print nothing.
5. The sorted `start ` lines of the two runs must be equal.

The base run is also the source of D-4 rule 1. Its per-file summary lines and its `suite:` line are
committed as `proof/base-whole.txt`.

### D-11 Tests

Every new test's name starts `selective-tests-by-map-2 AC-<n> ` (`T-` ids below are the plan's). The
synthetic trees for the end-to-end tests are git repositories made by the test:

- a base commit, `refs/remotes/origin/main` set to it with `git update-ref`, and
  `refs/remotes/origin/HEAD` pointing at it;
- a branch, and the branch's commits;
- `plugins/openspec/hooks/deliver-check.mjs` as a symlink to the real file (Node resolves its own
  imports from the real path);
- an env built from the test's shared constant that blanks `GITHUB_HEAD_REF`, `GITHUB_BASE_REF`,
  `GITHUB_EVENT_PATH`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE` and `DEVKIT_BYPASS` (CONTRIBUTING.md). A test
  that needs a variable sets it on purpose.

| T | AC | File | Condition (positive / negative) |
|---|---|---|---|
| T-1 | AC-1 | test-suite.test.mjs | S4 exact key selects its fast and slow tests with `by`; a test no key links is not selected |
| T-2 | AC-1 | test-suite.test.mjs | two own files linking one test: both in its `by`, the test once |
| T-3 | AC-1 | test-suite.test.mjs | S1 a touched suite test, slow, selects itself; S2 a deleted one selects nothing |
| T-4 | AC-1 | test-suite.test.mjs | S4 folder key covers a path under it; exact beats folder; the longer folder key beats the shorter; a sibling path is not covered |
| T-5 | AC-2, AC-3 | test-suite.test.mjs | S3 a shared helper selects every fast importer: direct, through another shared helper, and through a `-fixtures.mjs` module; a test that reaches the helper only through a product module is not selected; a slow importer is not selected; a fast non-importer is not selected |
| T-6 | AC-2 | test-suite.test.mjs | S3 a slow test linked in the helper's entry is selected; the same slow test unlinked is not (T-5) |
| T-7 | AC-4 | test-suite.test.mjs | S7 unmapped code gives `whole` naming the path; the same path mapped gives `files`; the same path under an exact key with `[]`, and under a folder key with `[]`, gives `whole` with the same reason |
| T-8 | AC-4 | test-suite.test.mjs | S5 and S6 only give `none`; an unmapped `.md` under `plugins/` gives `whole`; a mapped `openspec/` path and a mapped root `.md` give their tests |
| T-9 | AC-4 | test-suite.test.mjs | a `none` path beside a mapped one gives `files` (none adds nothing); a `whole` path beside a mapped one gives `whole` |
| T-10 | AC-9 | test-suite.test.mjs | M1 each of key, value, shared key, shared link, slow item naming a missing path is a problem naming the entry; a folder key on a file; existing paths are no problem |
| T-11 | AC-9 | test-suite.test.mjs | M2 a value, a shared link, a slow item outside the suite; a suite file is no problem |
| T-12 | AC-9 | test-suite.test.mjs | M3 a suite test as a key; M4 a path in both; neither when apart |
| T-13 | AC-9 | test-suite.test.mjs | M5 an uncovered module under a suite folder; covered by an exact key, by a folder key, as shared: no problem |
| T-14 | AC-9 | test-suite.test.mjs | M6 a test linked to nothing is a problem, and so is a test that only imports a shared helper; linked by a `files` value, or by a `shared` link: no problem |
| T-15 | AC-9 | test-suite.test.mjs | M7 and the input cases: missing file, empty file, not JSON, an array, an unknown key, a value not an array of strings |
| T-16 | AC-9, AC-2 | test-suite.test.mjs | the repository's own map has no problem; `test-fixtures.mjs` is shared; `slow` is not empty and holds only suite files; the `scripts/test-suite.mjs` entry holds `test-suite.test.mjs` and not `ship-entry.test.mjs`, which names the script only in comments (D-4) |
| T-17 | AC-1 | test-suite.test.mjs | end to end: a branch touching a mapped module prints the `selected ... by ...` lines and starts only those files |
| T-18 | AC-4, AC-6 | test-suite.test.mjs | end to end: a docs and `openspec/` branch exits 0, prints `selected no test file`, starts no file, leaves no run root; the whole run of a tree with no test file still exits 1 (existing test, kept) |
| T-19 | AC-4 | test-suite.test.mjs | end to end: an unmapped code file starts every suite file after `selected the whole suite: no entry ...` |
| T-20 | AC-7 | test-suite.test.mjs | `GITHUB_HEAD_REF=train/7` gives the whole suite with the train reason; `GITHUB_HEAD_REF=feature` with the same tree is selective; a local branch `train/3` gives the whole suite |
| T-21 | AC-1 | test-suite.test.mjs | uncommitted, staged and untracked own files count; a head inside `origin/main` with one dirty mapped file selects its tests; a mapped `openspec/` file edited but not committed selects nothing, and once committed selects its tests (D-2) |
| T-22 | AC-4 | test-suite.test.mjs | fail safe: no `origin/main` gives the whole suite with `origin/main is missing`; a tree that is not a git repository (made without `git init`, run with `GIT_CEILING_DIRECTORIES` set to its parent so that no enclosing repository is found) exits as a whole run, prints `selected the whole suite: git cannot tell the own files: ` and starts every suite file, with no stack trace on stderr; an orphan branch with no commit, beside an `origin/main`, gives the whole suite with `no commit`; release files only (a manifest, `CHANGELOG.md`) give `none` |
| T-23 | AC-9 | test-suite.test.mjs | end to end: a map naming a missing file exits 1 naming the entry, starts no file |
| T-24 | AC-1 | test-suite.test.mjs | `--own-files` with a file argument exits 2; `--own-files=x` exits 2; neither starts a file |
| T-25 | AC-8 | test-suite.test.mjs | a whole run of a tree with a broken map and no `deliver-check.mjs` runs every file as before |
| T-26 | AC-1 | test-suite.test.mjs | under `--own-files`, `--test-name-pattern=` and `--reporter=tap` reach the selected children |
| T-27 | AC-4, AC-5 | deliver-check.test.mjs | `branchOwnPaths`: committed and dirty paths together, release files out, sorted; a committed path under `openspec/changes/<id>/` is in the list; head in base gives dirty only; no `origin/<base>`, no base, no commit and no merge base give their `why`; `ownFiles` gives what it gave (the `own-files` tests, unchanged) |
| T-28 | AC-6 | delivery-train.test.mjs | with the train key `node scripts/test-suite.mjs && python3 scripts/check.py`, a gate `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` with no rows lists the selective part in `missingGates` and the check part in `trainParts`; with a pass row for the selective part, item 1 is met |
| T-29 | AC-7 | test-tmp.test.mjs | ci.yml: the `Test suite` step holds the `--own-files` expression of D-7 and no other test command; the checkout holds the `fetch-depth` expression; the job id is `check` |
| T-30 | AC-5 | test-suite.test.mjs | `openspec/config.yaml` `Test command:` and `Gates:` name `node scripts/test-suite.mjs --own-files`; `devkit.delivery.train` is still the whole command; `CLAUDE.md` has the selective row after the whole one; `CONTRIBUTING.md` names `--own-files` and `scripts/test-map.json` |

T-1 to T-16 call the exported functions directly. T-17 to T-26 spawn the copy of the script.

### Pinned rules: every test that quotes what this change replaces

The grep covered all four suite folders, `scripts/check.py`, the fixtures modules and
`delivery-train-fixtures.mjs`. It searched for `test-suite`, `Test suite`, `ci.yml`, `fetch-depth`,
`depth 1`, `Test command`, `Gates:`, `Test history`, `trainParts`, `ownFiles`, `stalenessBase`,
`TRAIN_BRANCH`, `Amended by ADR`, `usage: node scripts/test-suite.mjs` and `no test file`.

| Test (file) | What it pins | This change |
|---|---|---|
| `test-fixture-cleanup AC-5 ...` (test-tmp.test.mjs) | step `Test suite` holds `node scripts/test-suite.mjs`, after `Install OpenSpec` | still true; T-29 added beside it |
| `suite-speed AC-7 ...` (test-suite.test.mjs) | `CLAUDE.md`, `CONTRIBUTING.md`, `plugins/openspec/README.md`, `openspec/config.yaml` hold `node scripts/test-suite.mjs` | still true |
| `suite-speed AC-8 ...` (test-suite.test.mjs) | first `CLAUDE.md` line with the command states the time; the paragraph after the CONTRIBUTING block states it | new row and paragraph placed after (D-8) |
| `suite-speed AC-1 started through a symlinked folder or file ...`, `... no test file ...`, `... bad argument exits 2 ...` (test-suite.test.mjs) | usage prefix, exit 1 on an empty tree, bad arguments | unchanged; T-24 and T-18 add the new cases |
| `setup AC-2 records ...` (guard.test.mjs) | ADR 0026 header holds the 0031 line; `config.yaml` holds the 0026 entry text | 0026 entry untouched, new line appended (D-8, D-9) |
| `coordinator-loop-fixes AC-20 T140 ...` (change-loop-declared.test.mjs) | `Test history:` line followed by `Live roadmap:` | start and order kept |
| `delivery-train AC-5: ...` ×3 (delivery-train.test.mjs), `delivery-train P11 ...` (delivery-train-after.test.mjs) | gate parts equal to train parts need no row | unchanged; T-28 adds the selective part |
| `own-files AC-1` to `AC-6` (deliver-check.test.mjs) | the staleness rule through `ownFiles` | unchanged; `ownFiles` calls `ownDiffPaths` |
| `delivery-train-fixtures.mjs` `SUITE` | the train command | unchanged |

`plugins/openspec/skills/devkit/scripts/setup-block.test.mjs:350` builds its own `Test command:` line
for a template and does not read this repository's config.

## Risks / Trade-offs

- [The map misses a test that covers a file] → the train's whole run finds it (record's
  Consequences). M5 and M6 refuse a module or a test the map lacks, and S7 runs everything for
  unmapped code.
- [A shared helper's slow importers do not run on a helper edit] → this is AC-2, the owner's choice.
  The train runs them.
- [The CI checkout of a pull request cannot find the merge base, for example after a forced base] →
  `branchOwnPaths` gives a `why`, and the whole suite runs (fail safe).
- [A file cites the record by a literal number, which a sibling may take first and the release step
  cannot rewrite] → D-8 and D-9 give the one citation form,
  `ADR [a-change-runs-only-the-tests-its-files-map-to]`, for every file; task 2.4's check greps the
  tracked text outside `openspec/changes/` for it and for any other form.
- [A later base merge moves `deliver-check.mjs` again near `ownFiles`] → the anchors are names as
  well as lines; `ownDiffPaths` is a one-line edit inside `ownFiles`; task 3.1 re-reads them and
  edits `proposal.md` and `tasks.md` in the merge commit when a name moved (CLAUDE.md).
- [The release is done by the wrong rule, or a release line is edited on the branch] →
  `proposal.md` "Release rule" states the note rule and `release.md` exists; task 3.2's check shows
  no release file in the branch's diff; `deliver-check` refuses release lines edited by hand
  (`0034-release-at-merge.md` decision 6) and a `release.md` changed after the approval (decision 2).
- [Watch tests flake under load during the whole runs] → the two whole runs of D-10 go on a quiet
  machine, one at a time, as a background command (CONTRIBUTING.md).
- [Open changes whose gates name the whole command keep running it] → accepted in the record.

## Migration Plan

There is no data and no setting to migrate. Rollback: revert the merge. The whole command and the train
never depended on the map, so a revert leaves both working. Open changes' gate rows keep the
command they name.

## Implementation plan

Dependency order: own-files helper (deliver-check) → selection and map reader (script) → the map's
content → CI and texts → records (the release itself is the delivery's).

- **Per surface**: devkit-openspec hooks (`deliver-check.mjs` two exports; four test files). Repository
  scripts (`scripts/test-suite.mjs`, `scripts/test-map.json`). CI (`ci.yml`). Texts and records
  (`openspec/config.yaml`, `CLAUDE.md`, `CONTRIBUTING.md`, `docs/openspec-flow.md`, ADRs). No frontend, no
  worker.
- **File structure**:
  - create `scripts/test-map.json` and `openspec/changes/selective-tests-by-map-2/proof/*.txt`
    (`release.md` is written with the plan);
  - modify `scripts/test-suite.mjs`, `plugins/openspec/hooks/deliver-check.mjs`,
    `plugins/openspec/hooks/{test-suite,deliver-check,delivery-train,test-tmp,change-loop-compozy}.test.mjs`,
    `.github/workflows/ci.yml`, `openspec/config.yaml`, `CLAUDE.md`, `CONTRIBUTING.md`,
    `docs/openspec-flow.md` (the sentence of D-8 only), `docs/adr/0022-*`, `0025-*`, `0026-*`, and
    the new ADR (its status lines);
  - leave to the delivery: the manifests, `CHANGELOG.md`, `docs/catalog.md`, the CI pin lines and
    the record's number (D-9);
  - delete nothing.
- **Estimate**: optimistic 14 h, likely 20 h, pessimistic 30 h. The two whole runs take 25 to
  45 minutes of machine time.

| Component | Hours | Type | Risk |
|---|---|---|---|
| `branchOwnPaths` / `ownDiffPaths` + T-27 | 2 | Core | LOW |
| `selectTests`, `sharedUses`, `mapProblems`, map reader + T-1 to T-16 | 5 | Core | MEDIUM |
| `--own-files` wiring, output, refusals + T-17 to T-26 | 4 | Integration | MEDIUM |
| Map seed (D-4) and its review | 3 | Migration | MEDIUM |
| CI step and checkout + T-29 | 1 | Integration | LOW |
| Texts (config, CLAUDE.md, CONTRIBUTING, flow page, comments) + T-28, T-30 | 2 | Documentation | LOW |
| Records, release-note check, AC-8 runs, real-run proofs | 3 | Testing | MEDIUM |

- **Risks** (probability × impact, mitigation):
  - map seed too coarse, so selections are near-whole (MEDIUM × LOW): rule 1 marks slow, and the owner
    can trim entries later;
  - a later base merge conflicts on `deliver-check.mjs` or the ADR list of `config.yaml` (LOW ×
    MEDIUM): `ownDiffPaths` is a one-line edit; the ADR list keeps both sides; task 3.1 re-reads the
    anchors;
  - a sibling takes the next version before the merge (MEDIUM × LOW): no plan text holds a literal
    version; the delivery's `assign-release` runs again after each base merge that moved the release
    (`0034-release-at-merge.md` decision 1);
  - a file cites the record by a literal number instead of `ADR [<slug>]` (LOW × MEDIUM): D-8 and
    D-9 name the form each file writes, and task 2.4's check greps for it;
  - CI expression typo leaves `check` red (LOW × HIGH): T-29 pins the text, and the pull request's
    first run is read before auto-merge (workflow follow-up);
  - whole-run names differ because of a flaky test (LOW × MEDIUM): re-run alone on a quiet machine.
- **Assumptions**:
  - `actions/checkout@v4` with `fetch-depth: 0` on `pull_request` gives `refs/remotes/origin/<base>`
    (as `.github/workflows/devkit-reviews.yml` relies on);
  - a dynamic `import()` of a symlinked `deliver-check.mjs` resolves its imports from the real path
    (Node's default, no `--preserve-symlinks`);
  - no suite test reads the repository's `HEAD` (`openspec/config.yaml` `Test history:`; suite-speed D-10).
- **Dependencies**: ADR 0025 (`ownFiles`, `stalenessBase`, merged), ADR 0026 (the script, merged),
  ADR 0022 (`TRAIN_BRANCH`, train, merged), `release-at-merge` (`0034-release-at-merge.md`
  decisions 1, 2, 5 to 8, the note rule this change follows; merged in PR 155, archived in PR 156,
  both in the base `e8991d6d`). None under way.

## Open Questions

None.
