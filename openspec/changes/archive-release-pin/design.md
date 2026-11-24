<!-- devkit-stage design result=passed attempt=2 commit=d2010cafc71627b2d8d365d75af477fbecd0e736 -->
# Design

Change: `archive-release-pin` · Date: 2026-11-23 · Owner: Kaue (chacal88) · Base: `d2010ca` ·
PRD / tech spec: n/a · Proposal: [proposal.md](proposal.md) · Spec delta:
[specs/reviews-check/spec.md](specs/reviews-check/spec.md) · Decision:
[ADR 0023](../../../docs/adr/0023-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)
(amends ADR 0003; builds on ADR 0002, 0012, 0018, 0019)

## Context

See proposal.md for why. The current state, at `d2010ca`:

- `unnamedFiles(paths, proposals)` (`plugins/openspec/hooks/deliver-check.mjs:1128`) is a pure
  function of paths. It exempts `isArchiveRecord` (`openspec/changes/**`, `openspec/roadmap.md`),
  `canonicalSpecs`, `RELEASE_FILE` (line 1124) and the exact targets of approved proposals.
- It has two callers, and both get their paths from `archiveChanges(root, base)` (line 1110): the
  local archive stop `filesStop` in `archiveNext` (line 1441; `collectState` stores the result as
  `state.archive.changed`, line 1358) and `archivePrCheck` for `--ci` (line 2185, result at line
  2202). `archiveReport` (the `--json` readout) does not serialize `changed`.
- The pin definition is module-private in `plugins/openspec/hooks/release-merge.mjs:130-141`:
  `PIN_MARKER`, `PIN_TOKEN`, and the exported `pinsIn` and `setPins`. `release-merge.mjs` imports
  `RELEASE_FILE` from `deliver-check.mjs` (line 16). Its importers are `conduct-check.mjs`
  (`PIN_FILE`, `classifyConflict`), `release-merge.test.mjs`, `release-tags.test.mjs` and
  `change-loop.test.mjs` (`pinsIn`).
- The consumer CI downloads only `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs`
  (`docs/openspec-flow.md` CI snippet). `merge-setup.test.mjs:184` (`workflow (the setup template):
  deliver-check --ci and guard.mjs ci run from only the files the template downloads`) runs `--ci`
  from exactly those files. This repository's own `.github/workflows/devkit-reviews.yml` runs the
  PR head's `deliver-check.mjs` with `fetch-depth: 0`.
- `plugins/openspec/hooks/change-loop.test.mjs:2577-2598` holds the pin block of `change-loop docs:
  the design records the answers`: the Invariant comment, one `assert.match(flow, /v0\.33\.0/, ...)`
  and 20 `assert.doesNotMatch(flow, /v.../, ...)` lines. Some messages hold an escaped quote
  (`'no pin left on main\'s release before it (remote-worker)'`).
- c561553 changed `docs/openspec-flow.md` in two hunks (`@@ -575,8 +575,8 @@`, `@@ -585,7 +585,7
  @@`) and `change-loop.test.mjs` in one (`@@ -2475,7 +2475,8 @@`). The planner checked the regular
  expressions of D-2 against these texts (whole files and hunks) and against today's pin block, with
  no test suite run: all pass.

## Goals / Non-Goals

**Goals:**

- One pure rule, `pinLinesOnly(path, pair)`, that both callers reach through `unnamedFiles`.
- The pin definition in one place (`deliver-check.mjs`), with `release-merge.mjs` unchanged for its
  importers.
- Fail closed: a side that is missing or cannot be read, an unknown path, or an unexpected line
  ending never counts as pin-only.

**Non-Goals:**

- A diff algorithm or a parser of `git diff` output: D-2 compares two whole texts.
- Moving `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `MASK`, `mergePins` or `classifyConflict` (ADR 0023
  decision 6 moves only the four names of the pin definition).
- Any change to `RELEASE_FILE`, `isArchiveRecord`, `canonicalSpecs` or the staleness rule.

## Decisions

### D-1 The pin definition moves into deliver-check.mjs (ADR 0023 decision 6)

In `deliver-check.mjs`, a new section `// ---- the CI pin lines (archive-release-pin, ADR 0023)`
directly above `RELEASE_FILE` holds, byte for byte as today in `release-merge.mjs:129-141`, the
comment lines, `const PIN_MARKER`, `const PIN_TOKEN` (both still module-private), `export function
pinsIn` and `export function setPins`. In `release-merge.mjs`:

- line 16 becomes `import { RELEASE_FILE, pinsIn, setPins } from './deliver-check.mjs';`, and right
  under it goes `export { pinsIn, setPins }; // the pin definition lives in deliver-check.mjs (ADR 0023)`;
- lines 129-141 (the marker comment, `PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, its comment, `setPins`,
  its comment) are deleted; `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `MASK`, `mergePins` and the
  section header stay.

Why: `deliver-check.mjs` cannot import `release-merge.mjs`. The consumer CI does not download it,
and `release-merge.mjs` already imports `deliver-check.mjs`. Rejected: a copy of the regular
expressions in `deliver-check.mjs`, because the conflict resolution and the archive check would then
be free to disagree on what a pin is (ADR 0023, Consequences).

Wording: no text of `deliver-check.mjs`, comment included, may hold the string `release-merge`, or
test 10 (whose source must not match `/release-merge/`) fails. The section header, the comment
moved with the definition, and the comments of D-4 name ADR 0023 and "the conflict resolution"
instead of the file; the moved comment lines of `release-merge.mjs:129-141` hold no such string
today. The one comment that names the other module is the re-export line, which lives in
`release-merge.mjs`.

### D-2 The rule: pinLinesOnly (ADR 0023 decisions 1 and 2)

In the same section of `deliver-check.mjs`:

```
export const PIN_LINE_FILES = ['docs/openspec-flow.md', 'plugins/openspec/hooks/change-loop.test.mjs'];
const PIN_TEST_LINES = [
  /^\s*assert\.(?:match|doesNotMatch)\(flow, \/v\d+\\\.\d+\\\.\d+\/, '(?:[^'\\]|\\.)*'\);$/,
  /^\s*\/\/ Invariant: the CI snippet pins the current release/,
];
// true only when `path` is a pin file, both texts are strings, and they differ only in pins (the doc)
// or only in pin assertion lines (the test). Anything else, missing or unreadable included, is false.
export function pinLinesOnly(path, pair)
```

- `pair` is `{ before, after }`, each a string or `null`. `pair` undefined, or either side not a
  string, gives `false`. So does a path outside `PIN_LINE_FILES`.
- `docs/openspec-flow.md`: `setPins(before, '0.0.0') === setPins(after, '0.0.0')`. This passes
  only when every line pair is equal with the pins masked. A marker line with other words changed, a
  pin line added or removed, a pin deleted from a marker line, or any other line differing gives
  `false` (AC-1, AC-2).
- `plugins/openspec/hooks/change-loop.test.mjs`: split each text on `\n`, drop every line that
  matches one of `PIN_TEST_LINES`, and compare the two remaining arrays element by element (equal
  length, every element equal). This is the same as "every added or removed line is of a pin form":
  a removed or added form line disappears from both sides, and any other added, removed, changed or
  reordered line leaves the arrays different (AC-3, AC-4).
- Line endings and unterminated input (the config's parser rule). Texts are split on `\n` only, as
  `pinsIn` and `setPins` do, and nothing is trimmed. A file that loses or gains its final newline
  changes the last element (`'x\n'` splits to `['x', '']`, `'x'` to `['x']`), so for either pin file
  it is not pin-only: `false`. A `\r` before `\n` stays part of the line: a CRLF form line does not
  match the anchored forms and stays as an ordinary line, so a CRLF test file passes only when the
  remaining lines are equal.
- Empty texts. The empty string is a text, not a missing side: only `null` (or a non-string) is
  missing. An empty text is one empty line, compared like any other. So an empty `before` with an
  empty `after` is `true` for either pin file (nothing changed), and an empty `before` with a
  non-empty `after` holding a non-form line is `false` (for the doc, any non-empty `after` is
  `false`, because the masked texts differ).
- Accepted looseness, recorded in ADR 0023's review trigger: a form line may move into another test
  of the same file, and the message is free text. The subject must be `flow` and the regular
  expression must be a plain version.

### D-3 Reading the two texts in archiveChanges

`archiveChanges(root, base)` keeps its contract (`{ missing: true }` or `{ paths }`) and adds
`texts`: for each path of `PIN_LINE_FILES` present in `paths`, `{ before, after }`.

- `before` comes from `execFileSync('git', ['-C', root, 'show', `${mergeBase}:${path}`], { encoding:
  'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })`, or `null` when that
  throws (absent at the merge base, or unreadable). `git show` of a blob applies no textconv. The
  64 MiB buffer is needed because `change-loop.test.mjs` is 405 KB and `git`'s helper keeps Node's
  default buffer.
- `after` is `readFileSync(join(root, path), 'utf8')`, or `null` when that throws. The working tree
  is the archive branch, committed or not, which is the same tree that `changedInTree` already folds
  into `paths`. On CI the tree is the PR head (`actions/checkout` with the head sha).
- A small local helper `textAt(root, rev, path)` holds the first read; the second is inline. No other
  path is read, so an archive that touches neither file costs nothing new.

### D-4 unnamedFiles takes the texts (ADR 0023 decision 4)

`export function unnamedFiles(paths, proposals, texts = {})`: the filter gains `&& !pinLinesOnly(p,
texts[p])` before `!named.has(p)`. The two callers pass the texts:

- `filesStop` (line 1441): `unnamedFiles(a.changed?.paths ?? [], a.retro.proposals, a.changed?.texts)`;
- `archivePrCheck` (line 2202): `unnamedFiles(changes.paths, proposals, changes.texts)`.

A caller that passes no texts gets today's answer, so every existing two-argument call and test
keeps its result. The comment above `unnamedFiles` names ADR 0023 and the pin rule. The comment
above `RELEASE_FILE` adds: `The CI pin files are not release files; see PIN_LINE_FILES (ADR 0023).`

### D-5 Fixtures from the real diff of c561553 (AC-10; config rule "Test history")

Tests never read git history. The implementer writes four fixture files once, from the commit,
holding exactly the hunks of `git show c561553` (context lines included), the hunks of one side
joined with `\n` in file order:

| File under `plugins/openspec/hooks/fixtures/c561553/` | Source |
|---|---|
| `openspec-flow.before.txt` | lines 575-582 and 585-591 of `c561553^:docs/openspec-flow.md` |
| `openspec-flow.after.txt` | lines 575-582 and 585-591 of `c561553:docs/openspec-flow.md` |
| `change-loop.test.before.txt` | lines 2475-2481 of `c561553^:plugins/openspec/hooks/change-loop.test.mjs` |
| `change-loop.test.after.txt` | lines 2475-2482 of `c561553:plugins/openspec/hooks/change-loop.test.mjs` |

They are `.txt`, so `scripts/check.py` (Markdown language and links) and `check_awaited_subtests`
(`*.test.mjs`) do not read them, and node never loads them. They hold neither `/conduct` nor the
`OLD_ORDER` phrases scanned by `change-loop retire: /conduct is not shipped and nothing points at
it` and `AC-6 instructions-follow: no tracked file outside the records still says review before
evidence`; task 1.1 checks this.

### D-6 New tests

Every new test is named `archive-release-pin <n>: ...`. Tests 1 to 9 and 11 live in
`plugins/openspec/hooks/deliver-check.test.mjs`, test 10 in
`plugins/openspec/hooks/release-merge.test.mjs`. In `deliver-check.test.mjs`, the new tests reach
the new exports through a namespace import added next to the existing named import, `import * as
DC from './deliver-check.mjs';`, so that before the code exists each test fails on its own and the
file still loads. One test per condition and label; negatives included.

| # | Name (after the prefix) | What it asserts | AC |
|---|---|---|---|
| 1 | `pinLinesOnly passes a flow page whose only change is its CI pins, and the real c561553 hunks` | an in-test doc holding the three real pin line shapes (the two snippet lines and the prose line with ``(`v<x>` above)`` and `git/ref/tags/v<x>`) moved from `v0.33.0` to `v0.34.0` gives `true`; the D-5 flow fixtures give `true` | AC-1, AC-10 |
| 2 | `pinLinesOnly names a flow page changed beyond its pins` | `false` for: a changed sentence, an added paragraph, a marker line with other words changed, an added pin line, a pin removed from a marker line, the fixture's after side with one non-pin word changed | AC-2 |
| 3 | `pinLinesOnly passes a test file whose only changed lines are the pin forms` | `true` for: the D-5 test fixtures; a removed `assert.doesNotMatch` line; an added one whose message holds `\'`; a changed Invariant comment; a form line at another indentation | AC-3, AC-10 |
| 4 | `pinLinesOnly names a test file with any other changed line` | `false` for: an added `assert.ok(flow.includes('x'), 'x');`; `assert.match(other, /v0\.34\.0/, 'm');`; `assert.match(flow, /v0\.34\.\d/, 'm');`; a changed line of another test (`assert.match(adrs, /0011/, ...)` to `/0012/`); an added `// note` comment; an added blank line; two non-form lines swapped | AC-4 |
| 5 | `a pin file missing or unreadable on either side, another path, a CRLF form line or a changed final newline is never pin-only, and an empty base is a text` | `false` for: `pair` undefined; `before` null; `after` null; both null; `before` a number (not a string); equal texts under `docs/other.md`; a test text whose only change is a form line ending in `\r`; the doc and the test file each with `before` `'a\nb\n'` and `after` `'a\nb'` (lost final newline), and each the other way round (gained final newline); the doc with `before` `''` and `after` `'a\n'`; the test file with `before` `''` and `after` `'x\n'`. `true` for: the doc with `before` `''` and `after` `''`; the test file with `before` `''` and `after` `''` (an empty base is not missing) | AC-5 |
| 6 | `unnamedFiles takes the pin rule from the texts, and c561553's file list passes with proposals naming neither pin file` | `unnamedFiles(['docs/openspec-flow.md', 'plugins/openspec/hooks/change-loop.test.mjs'], [], texts)` is `[]` with pin-only texts and names each file whose text goes beyond; with no texts both are named; c561553's 12 non-archive paths plus its archived folder's four `specs/<cap>/spec.md` paths, its proposals as approved targets with the two pin files left out of proposal 1, and the D-5 fixtures as texts give `[]` | AC-1, AC-3, AC-10 |
| 7 | `the local archive stop: pin-only edits open the archive PR, an edit beyond the pin stops on apply-proposals, committed or in the tree, and a deleted pin file stops` | through `collectState` and `nextStep` on the archive branch (helper of D-7): pin-only edits of both files give `open-archive-pr`; a doc sentence changed gives `stop-archive` `apply-proposals` whose reason is `files no approved proposal names: docs/openspec-flow.md`; the same pin-only edits left uncommitted give the same steps as committed; `git rm` of the test file gives the stop naming it | AC-1, AC-2, AC-3, AC-4, AC-5 |
| 8 | `--ci on an archive branch applies the same pin rule` | `archivePrRepo` with `base` holding both pin files: pin-only edits pass (exit 0, `archive.unnamed` `[]`); a doc changed beyond its pin fails with `archive.unnamed` `['docs/openspec-flow.md']`; another test line fails naming the test file; the test file added only on the branch fails naming it | AC-7, AC-1 to AC-5 |
| 9 | `--ci from only the three downloaded files passes a pin-only archive and fails one beyond the pin` | copies `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` into a `tmpFolder` and runs `node <copy>/deliver-check.mjs --ci --json` on test 8's repositories: the pin-only one exits 0, the beyond-pin one exits 1 naming the doc | AC-7 |
| 10 | `release-merge.mjs re-exports the one pin definition of deliver-check.mjs, which never imports release-merge.mjs` | `R.pinsIn === D.pinsIn` and `R.setPins === D.setPins` (namespace imports of both modules); the source of `deliver-check.mjs` does not match `/release-merge/`; `D.PIN_LINE_FILES` includes `R.PIN_FILE` | AC-6, AC-7 |
| 11 | `the flow page, ADR 0003 and the config state the pin-line rule` | the P13 row of `docs/openspec-flow.md` names both files; the paragraph starting `**The file check (P13, AC-3).**` holds `adr/0023-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`, both form texts and `// Invariant: the CI snippet pins the current release`; the `**Classification.**` bullet no longer holds `and the ADR 0003 exemption, do not change`; ADR 0003's first eight lines hold `- Amended by ADR 0023 (0023-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)`, and its Context holds a Note starting `Note (archive-release-pin, ` that ends with `The Decision is otherwise unchanged.`; the ADRs line of `openspec/config.yaml` holds `0023 the archive check lets the release pin lines pass unnamed, amends 0003` | AC-8 |

AC-6's conflict half is held by existing tests that this change leaves untouched and runs in its
gates: `release-merge pin: classifyConflict resolves a pin-only docs/openspec-flow.md and blocks one
beyond the pin, reading it once` (`release-merge.test.mjs`) and `conduct pin: both sides editing one
paragraph of docs/openspec-flow.md is blocked (AC-2)` (`conduct-check.test.mjs`).

### D-7 Existing tests and helpers this plan changes

Found with `grep -n "unnamedFiles\|RELEASE_FILE\|pinsIn\|setPins\|PIN_MARKER" plugins/openspec/hooks/*.test.mjs`
and a grep of the test files for every doc string D-8 changes (`The release list itself`,
`the release files and`, `or be a release file`, `There is no directory, prefix`, `P13`), which
matched no test. The layer is the code the test exercises.

| Suite | Layer | Test or helper | Invariant | Action |
|---|---|---|---|---|
| `deliver-check.test.mjs` | the archive file check | `release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)` | `RELEASE_FILE` keeps its content and the doc is not a release file | name and its first four assertions unchanged (they still hold: no texts, so the doc is named); two assertions added to its `unnamedFiles` half: with pin-only texts `unnamedFiles(['docs/openspec-flow.md'], [], texts)` is `[]`, and with a sentence changed it is `['docs/openspec-flow.md']` (AC-6) |
| same | the `--ci` archive fixtures | helper `archivePrRepo` | an archive branch over a base with a squash-merged change | gains an option `base = {}`, merged into the `files` of its `gitRepo` call, so the base commit holds those files before `origin/main` is set; the default keeps every caller |
| same | the local archive fixtures | new helper `pinArchive({ base, files, commit = true })` next to `approvedBy` | an archive branch over a base that holds the pin files | `pm({ branch: 'main' })`, `put(t.root, base)`, `commitAll`, `git update-ref refs/remotes/origin/main HEAD`, `git switch -q -c chore/archive-feat`, `archiveFolder(t)`, the retro with one approved proposal naming `CONTRIBUTING.md`, the ticked roadmap and `files`, committed when `commit`; returns `t` (the shape of `onArchiveBranch`, which stays unchanged) |
| `change-loop.test.mjs` | the docs | `change-loop docs: the design records the answers` | the CI snippet pins the current devkit-openspec release | the release's own pin lines only (D-9): the Invariant comment, the `assert.match` line to the new version, one `assert.doesNotMatch` line for `v0.33.0` |
| `release-merge.test.mjs` | the pin rule | the import line (`setPins`, `pinsIn` from `./release-merge.mjs`) and `release-merge pin: the real docs/openspec-flow.md: setPins changes exactly its CI pin lines` | the re-export keeps every importer | unchanged; they now prove the re-export |

### D-8 Documents and ADR 0003 (AC-8)

`docs/openspec-flow.md`, three places:

- The `**Classification.**` bullet (line 311). Its last sentence `The release list itself, and the
  ADR 0003 exemption, do not change.` is replaced by the text below. The old sentence would be false
  once ADR 0023 amends the exemption.

  ```text
  The release list itself does not change; the archive check's own rule for the CI pin lines (see "The file check" below, [ADR 0023](adr/0023-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)) is separate and resolves no conflict.
  ```

- The P13 row (line 527). In its first cell, the words between `` `openspec/roadmap.md`, `` and
  `` `openspec/specs/<capability>/spec.md` `` become the text below. The row stays one line.

  ```text
  the release files, `docs/openspec-flow.md` when only its CI pins moved, `plugins/openspec/hooks/change-loop.test.mjs` when only its pin assertion lines changed, and
  ```

- The paragraph `**The file check (P13, AC-3).**` (line 534). After the sentence that ends with
  `` `docs/catalog.md`. ``, insert:

  ```text
  Two files pass by their content instead ([ADR 0023](adr/0023-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)): `docs/openspec-flow.md` when its text, with every CI pin masked (the pin lines `release-merge.mjs` resolves), equals its text at the merge base masked the same way; and `plugins/openspec/hooks/change-loop.test.mjs` when every line added or removed against the merge base is an `assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');` or `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, '<message>');` line, with any message, or a comment line starting `// Invariant: the CI snippet pins the current release`. Any other edit of either file, or a file missing or unreadable on either side, needs a named proposal; neither is a release file, so a merge conflict in it is classified as above.
  ```

The CI section's sentence "runs the same exact-path file check as P13" (line 639) already covers
`--ci` and stays as it is.

`docs/adr/0003-auto-merge-the-archive-pr.md`, only the two additions ADR 0018 made (no accepted
text is edited):

- after the header line `- Amended by ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md)`,
  the line `- Amended by ADR 0023 (0023-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)`;
- after the paragraph starting `Note (delivery-models, 2026-11-22)`, a blank line and the paragraph
  below, with `<date>` the date in ADR 0023's `- Accepted by:` line. The Note holds neither `gates
  nothing` nor ``outside `openspec/` ``, which `ADR 0003 exists with Status: accepted, ...`
  (`guard.test.mjs`) refuses.

  ```text
  Note (archive-release-pin, <date>): ADR 0023 amends the exemption list of the Decision: `docs/openspec-flow.md` also passes when only its CI pins moved, and `plugins/openspec/hooks/change-loop.test.mjs` when only its pin assertion lines changed, both checked by their content against the merge base; neither file is exempt as a whole. The Decision is otherwise unchanged.
  ```

`openspec/config.yaml`, the `ADRs:` line: before its closing `)`, append `; 0023 the archive check
lets the release pin lines pass unnamed, amends 0003` (after the 0022 entry if a sibling's has
landed).

ADR 0023 itself is set to accepted by the loop's `accept-decisions` step after the owner approves
the plan. No task edits its text.

### D-9 Release

At the base `d2010ca`: devkit-openspec `0.33.0` to `0.34.0` (a minor: the archive check's behaviour
changes) in `plugins/openspec/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json`
entry; marketplace `metadata.version` `0.37.0` to `0.38.0`. The numbers are taken again from
`origin/main` right before each push (CONTRIBUTING.md step 5), and every place below moves with them.

- `CHANGELOG.md`, above `## 0.37.0`: `## 0.38.0 — the archive check lets the release pin lines pass
  unnamed`, with a `**devkit-openspec** 0.34.0` bullet. The bullet says what changed for an archive
  and for `devkit-reviews --ci`, names ADR 0023 as a link, says the pin definition now lives in
  `deliver-check.mjs` and `release-merge.mjs` re-exports it, and ends with the sentence ``The CI
  snippet now pins `v0.34.0`, the release's tag.``. A `Docs:` bullet names ADR 0023, the Note in ADR
  0003 and the flow doc's file check.
- `docs/openspec-flow.md`: every `v0.33.0` (lines 661, 662 and 675, four pins) becomes `v0.34.0`.
- `plugins/openspec/hooks/change-loop.test.mjs`, in the pin block only, three lines. The diff is
  itself made only of D-2's forms. The Invariant comment's text up to `0.33.0 (release 0.37.0), above
  remote-worker's` becomes the first line below, and the rest of today's list follows unchanged.
  `assert.match(flow, /v0\.33\.0/, ...)` becomes the second line, and the third goes right under it:

  ```text
    // Invariant: the CI snippet pins the current release (docs, change-loop.test.mjs); archive-release-pin moves it to 0.34.0 (release 0.38.0), above roadmap-sessions-upfront's 0.33.0 (release 0.37.0), above remote-worker's ...
    assert.match(flow, /v0\.34\.0/, 'the CI snippet pins the current release (archive-release-pin: 0.34.0)');
    assert.doesNotMatch(flow, /v0\.33\.0/, 'no pin left on main\'s release before it (roadmap-sessions-upfront)');
  ```
- `docs/catalog.md`: no description changes, so `python3 scripts/gen-catalog.py --check` passes with
  no regeneration. If a merge of `main` changes a description, it is regenerated.

### D-10 The real-run proof (AC-9)

A scratch repository under `/var/tmp/devkit-archive-release-pin/proof-repo` (a bare `origin` and a
clone; never inside the worktree), built by commands the implementer records verbatim at the top of
`openspec/changes/archive-release-pin/proof/real-run.txt`. Reading git history here is allowed: it
is proof, not a test.

- `main`: `docs/openspec-flow.md` and `plugins/openspec/hooks/change-loop.test.mjs` as at
  `c561553^`; `openspec/config.yaml` with `schema: devkit-lite`; an active change `demo` with
  `.openspec.yaml` `schema: devkit-lite`; `openspec/roadmap.md` listing `demo`; `CONTRIBUTING.md`.
  Pushed to `origin`.
- For each case, a fresh branch `chore/archive-demo` from `main`: `git mv openspec/changes/demo
  openspec/changes/archive/2026-11-23-demo`, a `retro.md` with one approved and applied proposal
  naming `CONTRIBUTING.md`, `CONTRIBUTING.md` edited, the roadmap ticked, then the case's edit,
  committed. The run is `env GITHUB_BASE_REF=main GITHUB_HEAD_REF=chore/archive-demo node
  <worktree>/plugins/openspec/hooks/deliver-check.mjs --ci --json`, and the file records the exit
  code and `archive.unnamed`.

| Case | Edit | Expected |
|---|---|---|
| R1 | `docs/openspec-flow.md` as at `c561553` | exit 0, `[]` |
| R2 | R1 plus one sentence of the doc changed | exit 1, `["docs/openspec-flow.md"]` |
| R3 | `change-loop.test.mjs` as at `c561553` | exit 0, `[]` |
| R4 | R3 plus `assert.ok(flow.length > 0, 'x');` added under the pin lines | exit 1, `["plugins/openspec/hooks/change-loop.test.mjs"]` |
| R5 | `git rm docs/openspec-flow.md` | exit 1, `["docs/openspec-flow.md"]` |
| R6 | both files as at `c561553` (the matching pair, no proposal naming either) | exit 0, `[]` |
| R7 | R6 run from a folder holding only copies of `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` | exit 0, `[]` |
| R8 | in this worktree, after phase 2: `pinLinesOnly` on this branch's own two files against `git merge-base origin/main HEAD` (a `node --input-type=module -e` that imports the worktree's `deliver-check.mjs`) | `change-loop.test.mjs` `true` (only D-9's pin lines changed); `docs/openspec-flow.md` `false` (D-8's paragraphs changed) |

The local stop (`filesStop`) needs GitHub's answers, so its real path is proved by test 7 through
`collectState` with the fake `gh`. The proof says so.

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A sibling release takes `0.34.0`/`0.38.0` or ADR number 0023 before this merges | MEDIUM × LOW | numbers re-taken from `origin/main` before each push (CONTRIBUTING step 5); an ADR rename moves the file, its title and every reference (decisions.md) |
| A merge of `main` conflicts in `openspec/config.yaml` (a sibling's ADR entry), which is not a release file | MEDIUM × LOW | resolved by hand at the merge of `main`, keeping both entries in number order; the gates of phase 2 run again |
| The rule is looser than intended: a form line moves into another test, or a message hides an unapproved claim | LOW × MEDIUM | only `flow` and a plain version are accepted; the review trigger of ADR 0023 names it; the owner can still require a named proposal |
| The content read fails on CI (shallow clone) | LOW × MEDIUM | a failed read is `null`, so the file stays unnamed and the archive stops (fail closed); both workflows already fetch with `fetch-depth: 0` |
| A roadmap run opens `release-pin-is-a-release-file` as a change of its own while this one is in flight | LOW × MEDIUM | the coordinating session is told the line is covered here; both lines are ticked at this change's archive |
| The installed devkit-openspec (0.33.0) drives this change's own archive with the old rule | MEDIUM × LOW | this archive needs the old rule only if its retro bumps the pack; then the proposal names the two files, as before |

Trade-off: the check now reads two texts per pin file. That is two git calls on an archive that
touches a pin file, and none otherwise.

## Migration Plan

No data or configuration moves. Consumer projects get the rule when they move their CI pin to the
release (`v0.34.0` or later). Rollback: revert the merge commit. `RELEASE_FILE` and the release
tool are unchanged, so nothing else depends on the rule.

## Implementation plan

Order: the pin definition (D-1), then the rule and its read (D-2 to D-4), then the documents and the
release (D-8, D-9), then the proof (D-10).

**Per surface.** devkit-openspec hooks: `deliver-check.mjs` (definition, rule, read, callers) and
`release-merge.mjs` (re-export). Documents: the flow doc, ADR 0003, the config's ADRs line. Release
files. No skill, agent, schema, frontend or worker changes.

**File structure.**

- Create: `plugins/openspec/hooks/fixtures/c561553/openspec-flow.before.txt`,
  `openspec-flow.after.txt`, `change-loop.test.before.txt`, `change-loop.test.after.txt`;
  `openspec/changes/archive-release-pin/proof/red-1.txt`, `red-2.txt`, `real-run.txt`.
- Modify: `plugins/openspec/hooks/deliver-check.mjs`, `plugins/openspec/hooks/release-merge.mjs`,
  `plugins/openspec/hooks/deliver-check.test.mjs`, `plugins/openspec/hooks/release-merge.test.mjs`,
  `plugins/openspec/hooks/change-loop.test.mjs` (pin block only), `docs/openspec-flow.md`,
  `docs/adr/0003-auto-merge-the-archive-pr.md` (header line and Note only), `openspec/config.yaml`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- Delete: nothing.

**Estimate.** Optimistic 6 h, likely 9 h, pessimistic 14 h (two merges of `main` with a renumbered
release, plus the whole suite again).

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-1 move of the pin definition and re-export | 0.5 | Core | LOW |
| D-2 to D-4 rule, read and callers | 1.5 | Core | MEDIUM |
| D-5 fixtures | 0.5 | Testing | LOW |
| D-6 tests 1 to 10 and D-7 helpers, red run | 3 | Testing | MEDIUM |
| D-8 documents, ADR 0003, config, test 11 | 1 | Documentation | LOW |
| D-9 release | 0.5 | Migration | MEDIUM |
| D-10 real-run proof | 1 | Testing | LOW |
| Gates and the whole suite (owner run, background) | 1 | Testing | LOW |

**Assumptions** (each from requirements.md unless noted):

- ADR 0023 is accepted before phase 1; the plan breaks if the owner changes its rule.
- The consumer CI keeps downloading exactly three files (`merge-setup.test.mjs:184`).
- The pin markers keep their shape (ADR 0023 review trigger).
- A pin-only change needs no bump in the same diff. The guard against a pin that differs from the
  manifest is the `pinMismatches` assertion of `change-loop docs: the design records the answers`
  and test `release-merge-conflict 15`, which ADR 0023's Consequences also cite. requirements.md
  cites it as `release-merge-conflict 16`, which is the release-step docs test; requirements.md
  stays as the grill recorded it, and the plan cites the right test.

**Dependencies:** ADR 0023 (decisions stage, accepted by `accept-decisions`); the pin definition of
the archived change `release-merge-conflict`; the archive check of ADR 0003 and ADR 0012. No open
decision.
