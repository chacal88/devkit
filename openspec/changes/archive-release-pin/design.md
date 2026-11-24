<!-- devkit-stage design result=passed attempt=3 commit=34e3500db260bff6af03280818740ef85a2eb1a3 -->
# Design

Change: `archive-release-pin` · Date: 2026-11-23, amended 2026-11-24 · Owner: Kaue (chacal88) ·
Base: `d2010ca` (amendment at `34e3500`) ·
PRD / tech spec: n/a · Proposal: [proposal.md](proposal.md) · Spec delta:
[specs/reviews-check/spec.md](specs/reviews-check/spec.md) · Decision:
[ADR 0027](../../../docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)
(amends ADR 0003; builds on ADR 0002, 0012, 0018, 0019), amended by
[ADR 0030](../../../docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md) (builds on ADR 0022)

## Amendment of 2026-11-24 (ADR 0030, grill answer A3)

Phases 1 to 3 below were delivered, reviewed and boarded on the delivery train (PR 107). The
delivery train (ADR 0022) joins its heads with `release-merge.mjs`, which has no rule for the pin
block of `plugins/openspec/hooks/change-loop-compozy.test.mjs`; every release edited that block, so a
train carried one releasing change. ADR 0030 removes the cause. What changes in this design:

- New decision D-12: the pin test reads the manifest and holds no release literal.
- D-2: the test-file half of `pinLinesOnly` (its second path, `PIN_TEST_LINES`) is removed.
- D-3 and D-4: unchanged in code; `texts` now holds at most the doc, because `PIN_LINE_FILES` holds
  only it.
- D-5: the two test-file fixtures of c561553 are deleted.
- D-6 and D-7: tests 3 to 8, 10 and 11 are flipped to the one-file rule, test 12 is new (table
  "Amended tests" under D-6).
- D-8: the flow doc, ADR 0003, ADR 0027 and the config name the one pin file and ADR 0030.
- D-9: the CHANGELOG entry drops the test-file sentence; the release no longer edits the test.
- D-10: a new real-run set, A1 to A6, in `proof/real-run-amended.txt`; `proof/real-run.txt` stays as
  the record of phase 3.

Every path, name and text of the amendment follows the current branch (`34e3500`), where the pin
block and the archive tests live in `change-loop-compozy.test.mjs` and
`deliver-check-archive.test.mjs` since suite-speed (ADR 0026) split the test files. Phases 1 to 3 keep
the names of their time. D-11 is not used.

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
- Moving `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `MASK`, `mergePins` or `classifyConflict` (ADR 0027
  decision 6 moves only the four names of the pin definition).
- Any change to `RELEASE_FILE`, `isArchiveRecord`, `canonicalSpecs` or the staleness rule.

## Decisions

### D-1 The pin definition moves into deliver-check.mjs (ADR 0027 decision 6)

In `deliver-check.mjs`, a new section `// ---- the CI pin lines (archive-release-pin, ADR 0027)`
directly above `RELEASE_FILE` holds, byte for byte as today in `release-merge.mjs:129-141`, the
comment lines, `const PIN_MARKER`, `const PIN_TOKEN` (both still module-private), `export function
pinsIn` and `export function setPins`. In `release-merge.mjs`:

- line 16 becomes `import { RELEASE_FILE, pinsIn, setPins } from './deliver-check.mjs';`, and right
  under it goes `export { pinsIn, setPins }; // the pin definition lives in deliver-check.mjs (ADR 0027)`;
- lines 129-141 (the marker comment, `PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, its comment, `setPins`,
  its comment) are deleted; `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `MASK`, `mergePins` and the
  section header stay.

Why: `deliver-check.mjs` cannot import `release-merge.mjs`. The consumer CI does not download it,
and `release-merge.mjs` already imports `deliver-check.mjs`. Rejected: a copy of the regular
expressions in `deliver-check.mjs`, because the conflict resolution and the archive check would then
be free to disagree on what a pin is (ADR 0027, Consequences).

Wording: no text of `deliver-check.mjs`, comment included, may hold the string `release-merge`, or
test 10 (whose source must not match `/release-merge/`) fails. The section header, the comment
moved with the definition, and the comments of D-4 name ADR 0027 and "the conflict resolution"
instead of the file; the moved comment lines of `release-merge.mjs:129-141` hold no such string
today. The one comment that names the other module is the re-export line, which lives in
`release-merge.mjs`.

### D-2 The rule: pinLinesOnly (ADR 0027 decisions 1 and 2)

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
- Accepted looseness, recorded in ADR 0027's review trigger: a form line may move into another test
  of the same file, and the message is free text. The subject must be `flow` and the regular
  expression must be a plain version.

**Amended (ADR 0030 decision 2).** In `plugins/openspec/hooks/deliver-check.mjs` (lines 1359-1376 at
`34e3500`): `PIN_LINE_FILES` becomes `['docs/openspec-flow.md']`; `PIN_TEST_LINES` is deleted; in
`pinLinesOnly` the line `if (path === PIN_LINE_FILES[0]) return ...` becomes the function's last
statement, `return setPins(before, '0.0.0') === setPins(after, '0.0.0');`, and the `kept` helper and
the array comparison are deleted. The section then reads, from the comment above `PIN_LINE_FILES` to
the end of `pinLinesOnly`:

```
// The one file whose CI pin lines an archive may change without a proposal naming it (ADR 0027 as amended by ADR 0030).
export const PIN_LINE_FILES = ['docs/openspec-flow.md'];
// true only when `path` is the pin file, both texts are strings, and they differ only in pins.
// Anything else, missing or unreadable included, is false.
export function pinLinesOnly(path, pair) {
  if (!PIN_LINE_FILES.includes(path)) return false;
  const { before, after } = pair ?? {};
  if (typeof before !== 'string' || typeof after !== 'string') return false;
  return setPins(before, '0.0.0') === setPins(after, '0.0.0');
}
```

Two comments change with it. Above `RELEASE_FILE`, `// The CI pin files are not release files; see
PIN_LINE_FILES (ADR 0027).` becomes `// The CI pin file is not a release file; see PIN_LINE_FILES
(ADR 0027, ADR 0030).`. Above `unnamedFiles`, `The one exception by content (ADR 0027): a pin file
passes` becomes `The one exception by content (ADR 0027, ADR 0030): the pin file passes`; the rest of
that comment stays. `PIN_LINE_FILES` stays an exported array, so `archiveChanges` (the loop at line
1329) and test 10 read it unchanged. The doc's rule, with its line-ending and empty-text behaviour
above, is unchanged. The test-file bullets above, and the looseness bullet, no longer apply.

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

**Amended (ADR 0030).** No code change here: the loop reads `PIN_LINE_FILES`, which now holds only
the doc, so `texts` holds at most `docs/openspec-flow.md`. The 64 MiB buffer stays (the doc may grow;
the cost is nil).

### D-4 unnamedFiles takes the texts (ADR 0027 decision 4)

`export function unnamedFiles(paths, proposals, texts = {})`: the filter gains `&& !pinLinesOnly(p,
texts[p])` before `!named.has(p)`. The two callers pass the texts:

- `filesStop` (line 1441): `unnamedFiles(a.changed?.paths ?? [], a.retro.proposals, a.changed?.texts)`;
- `archivePrCheck` (line 2202): `unnamedFiles(changes.paths, proposals, changes.texts)`.

A caller that passes no texts gets today's answer, so every existing two-argument call and test
keeps its result. The comment above `unnamedFiles` names ADR 0027 and the pin rule. The comment
above `RELEASE_FILE` adds: `The CI pin files are not release files; see PIN_LINE_FILES (ADR 0027).`

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

**Amended (ADR 0030).** `change-loop.test.before.txt` and `change-loop.test.after.txt` are deleted
(`git rm`); the two `openspec-flow.*.txt` fixtures stay, and tests 1, 2 and 6 keep reading them.

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
| 11 | `the flow page, ADR 0003 and the config state the pin-line rule` | the P13 row of `docs/openspec-flow.md` names both files; the paragraph starting `**The file check (P13, AC-3).**` holds `adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`, both form texts and `// Invariant: the CI snippet pins the current release`; the `**Classification.**` bullet no longer holds `and the ADR 0003 exemption, do not change`; ADR 0003's first eight lines hold `- Amended by ADR 0027 (0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)`, and its Context holds a Note starting `Note (archive-release-pin, ` that ends with `The Decision is otherwise unchanged.`; the ADRs line of `openspec/config.yaml` holds `0027 the archive check lets the release pin lines pass unnamed, amends 0003` | AC-8 |

**Amended tests (ADR 0030).** Tests 1 to 9 and 11 now live in
`plugins/openspec/hooks/deliver-check-archive.test.mjs` (moved there by suite-speed), test 10 in
`plugins/openspec/hooks/release-merge.test.mjs`. Every test keeps its id `archive-release-pin <n>:`,
so the gate patterns still select it. A name changes only where its old claim would now be false
(tests 3, 5 and 6); the others keep their whole name. The helpers `LOOP_PATH`, `loopLines`,
`loopText`, `PIN_LOOP_BEFORE` and `PIN_LOOP_AFTER` stay (they are the input of the named cases).
`PIN_BASE` and `PIN_EDITS` become doc-only (`{ [FLOW_PATH]: PIN_DOC('0.33.0') }` and
`{ [FLOW_PATH]: PIN_DOC('0.34.0') }`), and a new constant `LOOP_EDIT = { base: { [LOOP_PATH]:
PIN_LOOP_BEFORE }, files: { [LOOP_PATH]: PIN_LOOP_AFTER } }` holds the pin-assertion-only edit of the
test file. Red before the code of task 4.2 means: the test fails on the branch at `34e3500`.

| # | Name after the prefix (new where it changes) | What it asserts now | Red before 4.2 | AC |
|---|---|---|---|---|
| 1 | unchanged | unchanged (the doc and its two fixtures) | no | AC-1, AC-10 |
| 2 | unchanged | unchanged | no | AC-2 |
| 3 | `pinLinesOnly names a test file whose only changed lines are the old pin forms` | `DC.PIN_LINE_FILES` deep-equals `['docs/openspec-flow.md']`; `false` for `LOOP_PATH` with: `PIN_LOOP_BEFORE` to `PIN_LOOP_AFTER`; a removed `assert.doesNotMatch` line; an added one whose message holds `\'`; a changed Invariant comment; a form line at another indentation (the same inputs as before, the verdict flipped); no fixture read | yes | AC-3 |
| 4 | unchanged | unchanged cases, all still `false` | no (kept: a test file with any other change stays named) | AC-3 |
| 5 | `a flow page missing or unreadable on either side, another path, a CRLF pin line or a changed final newline is never pin-only, and an empty base is a text` | `false` for: `pair` undefined; `before` null; `after` null; both null; `before` a number; equal texts under `docs/other.md`; equal texts under `LOOP_PATH` (the test file is another path now); `PIN_DOC('0.33.0')` against `PIN_DOC('0.34.0')` whose first pin line ends in `\r`; the doc with `before` `'a\nb\n'` and `after` `'a\nb'` and the other way round; the doc with `before` `''` and `after` `'a\n'`; `LOOP_PATH` with `before` `''` and `after` `''`. `true` for the doc with `before` `''` and `after` `''` | yes (the two `LOOP_PATH` cases) | AC-5 |
| 6 | `unnamedFiles takes the pin rule from the texts, and c561553's file list names only its test file when no proposal names the flow page` | with paths `[FLOW_PATH, LOOP_PATH]` and pin-only texts for both, `unnamedFiles` is `[LOOP_PATH]`; with no texts, or empty texts, both are named; with texts beyond the pin, both are named; c561553's 16 paths (with `LOOP_PATH` for the test file, as today), its proposals and the doc fixtures as texts give `[LOOP_PATH]`; the same list without `LOOP_PATH` gives `[]`; without texts it gives `[FLOW_PATH, LOOP_PATH]` | yes | AC-1, AC-3, AC-10 |
| 7 | unchanged | through `pinArchive`: the doc-only `PIN_EDITS`, committed and in the tree, give `open-archive-pr`; the doc beyond its pin gives `stop-archive` `apply-proposals` `files no approved proposal names: docs/openspec-flow.md`, committed and in the tree; `LOOP_EDIT` (base and files) gives the stop naming `LOOP_PATH`, committed and in the tree; `git rm` of the doc (base holding it, `PIN_EDITS` in the tree) gives the stop naming `docs/openspec-flow.md` | yes (the `LOOP_EDIT` case) | AC-1, AC-2, AC-3, AC-5 |
| 8 | unchanged | `--ci` through `archivePrRepo`: doc-only pin edits pass (exit 0, `archive.unnamed` `[]`); the doc beyond its pin fails naming it; `LOOP_EDIT` fails (exit 1) with `archive.unnamed` `[LOOP_PATH]`; the doc added only on the branch (`base` `{}`, `files` `PIN_EDITS`) fails naming the doc | yes (the `LOOP_EDIT` case) | AC-7, AC-1 to AC-5 |
| 9 | unchanged | unchanged, on the doc-only `PIN_BASE` and `PIN_EDITS` | no | AC-7 |
| 10 | unchanged | as before, plus `assert.deepEqual(D.PIN_LINE_FILES, [R.PIN_FILE])` replacing `assert.ok(D.PIN_LINE_FILES.includes(R.PIN_FILE), ...)`; its `// Invariant (archive-release-pin, ADR 0027)` comment names `ADR 0027, ADR 0030` | yes | AC-6, AC-7 |
| 11 | unchanged | the P13 row names `docs/openspec-flow.md` and not `plugins/openspec/hooks/change-loop-compozy.test.mjs`; the paragraph starting `**The file check (P13, AC-3).**` holds `adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md`, `adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md` and `One file passes by its content`, and holds neither `change-loop-compozy.test.mjs`, `assert.match(flow,` nor `// Invariant: the CI snippet pins the current release`; the Classification check unchanged; ADR 0003's first nine lines hold the `- Amended by ADR 0027 (...)` line and `- Amended by ADR 0030 (0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)`; its Note starting `Note (archive-release-pin, ` ends with `The Decision is otherwise unchanged.`, holds `ADR 0030` and does not hold `change-loop-compozy.test.mjs`; ADR 0027's first ten lines hold the same `- Amended by ADR 0030 (...)` line, and a line of it starts `Note (archive-release-pin, ` and holds `ADR 0030`; the ADRs line of `openspec/config.yaml` holds `0027 the archive check lets the release pin lines pass unnamed, amends 0003, amended by 0030` and `0030 the pin test reads the manifest, so only the flow page pins pass unnamed, amends 0003 and 0027` | yes | AC-8 |
| 12 (new) | `the pin test reads the manifest and holds no release version literal and no change name outside the v0.20.0 floor` | reads `plugins/openspec/hooks/change-loop-compozy.test.mjs` with `textOf`; the body is the lines from the one starting `test('change-loop docs: the design records the answers'` to the first later line equal to `});`. Of the body lines that hold neither `0\.20\.0` nor `0.20.0`: none matches `/\d+\\?\.\d+\\?\.\d+/` (a version, with or without its `v` and its escapes); none starts (after spaces) `// Invariant: the CI snippet pins the current release`; none holds any of the change ids the deleted lines named (`archive-release-pin`, `change-budget`, `change-state`, `change-state-retro-fixes`, `change-version-pin`, `commit-attribution`, `compozy-driver`, `delivery-models`, `delivery-train`, `gh-version-check`, `jira-entry`, `release-merge-conflict`, `release-tags`, `remote-worker`, `review-openspec-fix`, `roadmap-sessions-upfront`, `stage-models`, `stage-roles`, `stale-only-on-own-files`, `suite-speed`, `test-fixture-cleanup`). The body holds `readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')` and `assert.deepEqual(pinMismatches(flow, version), []`, and the floor lines `const staleV20 =` and `moves this pin to` | yes | AC-4 |

Test 12 reads the source of a test file. That is a documentation-layer guard, like test 11 reading
the docs: the invariant is "no release edits the pin test" (ADR 0030 decision 1), it lives with the
other archive-release-pin tests in `deliver-check-archive.test.mjs`, and it fails on the branch at
`34e3500`, whose body holds 29 such lines (the Invariant comment, the `assert.match` line and 27
`assert.doesNotMatch` lines).

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

**Amended (ADR 0030).** Found with `grep -n "PIN_LINE_FILES\|PIN_TEST_LINES\|pinLinesOnly\|change-loop.test.before\|change-loop.test.after\|Invariant: the CI snippet" plugins/openspec/hooks/*.test.mjs plugins/openspec/hooks/*.mjs`
at `34e3500`: the hits are `deliver-check.mjs` (D-2), tests 1 to 11 (D-6), and the pin block below.
No other test reads `PIN_LINE_FILES` or the deleted fixtures.

| Suite | Layer | Test | Invariant | Action |
|---|---|---|---|---|
| `change-loop-compozy.test.mjs` | the docs | `change-loop docs: the design records the answers` | the CI snippet pins the devkit-openspec version of its manifest (ADR 0030 decision 1) | D-12: the pin block's literal lines are deleted; the name and every other assertion stay |
| `release-merge.test.mjs` | the pin rule | `archive-release-pin 10` | the archive check reads by content exactly the file whose pins the conflict rule resolves | the `PIN_LINE_FILES` assertion becomes an equality (D-6 amended table) |
| `deliver-check-archive.test.mjs` | the archive file check | `archive-release-pin 3` to `8`, `11`; constants `PIN_BASE`, `PIN_EDITS`; new `LOOP_EDIT` | the one-file rule of ADR 0030 decision 2 | as the D-6 amended table says |

### D-8 Documents and ADR 0003 (AC-8)

`docs/openspec-flow.md`, three places:

- The `**Classification.**` bullet (line 311). Its last sentence `The release list itself, and the
  ADR 0003 exemption, do not change.` is replaced by the text below. The old sentence would be false
  once ADR 0027 amends the exemption.

  ```text
  The release list itself does not change; the archive check's own rule for the CI pin lines (see "The file check" below, [ADR 0027](adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)) is separate and resolves no conflict.
  ```

- The P13 row (line 527). In its first cell, the words between `` `openspec/roadmap.md`, `` and
  `` `openspec/specs/<capability>/spec.md` `` become the text below. The row stays one line.

  ```text
  the release files, `docs/openspec-flow.md` when only its CI pins moved, `plugins/openspec/hooks/change-loop.test.mjs` when only its pin assertion lines changed, and
  ```

- The paragraph `**The file check (P13, AC-3).**` (line 534). After the sentence that ends with
  `` `docs/catalog.md`. ``, insert:

  ```text
  Two files pass by their content instead ([ADR 0027](adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)): `docs/openspec-flow.md` when its text, with every CI pin masked (the pin lines `release-merge.mjs` resolves), equals its text at the merge base masked the same way; and `plugins/openspec/hooks/change-loop.test.mjs` when every line added or removed against the merge base is an `assert.match(flow, /v<X>\.<Y>\.<Z>/, '<message>');` or `assert.doesNotMatch(flow, /v<X>\.<Y>\.<Z>/, '<message>');` line, with any message, or a comment line starting `// Invariant: the CI snippet pins the current release`. Any other edit of either file, or a file missing or unreadable on either side, needs a named proposal; neither is a release file, so a merge conflict in it is classified as above.
  ```

The CI section's sentence "runs the same exact-path file check as P13" (line 639) already covers
`--ci` and stays as it is.

`docs/adr/0003-auto-merge-the-archive-pr.md`, only the two additions ADR 0018 made (no accepted
text is edited):

- after the header line `- Amended by ADR 0018 (0018-the-delivery-model-is-chosen-per-project.md)`,
  the line `- Amended by ADR 0027 (0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)`;
- after the paragraph starting `Note (delivery-models, 2026-11-22)`, a blank line and the paragraph
  below, with `<date>` the date in ADR 0027's `- Accepted by:` line. The Note holds neither `gates
  nothing` nor ``outside `openspec/` ``, which `ADR 0003 exists with Status: accepted, ...`
  (`guard.test.mjs`) refuses.

  ```text
  Note (archive-release-pin, <date>): ADR 0027 amends the exemption list of the Decision: `docs/openspec-flow.md` also passes when only its CI pins moved, and `plugins/openspec/hooks/change-loop.test.mjs` when only its pin assertion lines changed, both checked by their content against the merge base; neither file is exempt as a whole. The Decision is otherwise unchanged.
  ```

`openspec/config.yaml`, the `ADRs:` line: before its closing `)`, append `; 0027 the archive check
lets the release pin lines pass unnamed, amends 0003` (after the 0022 entry if a sibling's has
landed).

ADR 0027 itself is set to accepted by the loop's `accept-decisions` step after the owner approves
the plan. No task edits its text.

**Amended (ADR 0030).** Plain text edits at `34e3500`; ADR 0030 itself stays as the `adr-author`
wrote it and is accepted by the loop's `accept-decisions` step after the owner approves this
amended plan. None of these texts holds `gates nothing` or ``outside `openspec/` ``.

`docs/openspec-flow.md`, three places:

- The `**Classification.**` bullet (line 314). In its last sentence, `([ADR 0027](adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md))`
  becomes the text below (the rest of the sentence stays):

  ```text
  [ADR 0027](adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md) as amended by [ADR 0030](adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)
  ```

- The P13 row (line 550). In its first cell the words
  `` `plugins/openspec/hooks/change-loop-compozy.test.mjs` when only its pin assertion lines changed, ``
  (with the space after them) are deleted. The row stays one line.
- The paragraph `**The file check (P13, AC-3).**` (line 571). The text from `Two files pass by their
  content instead` to `so a merge conflict in it is classified as above.` is replaced by:

  ```text
  One file passes by its content instead ([ADR 0027](adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md) as amended by [ADR 0030](adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)): `docs/openspec-flow.md` when its text, with every CI pin masked (the pin lines `release-merge.mjs` resolves), equals its text at the merge base masked the same way. Any other edit of it, or the file missing or unreadable on either side, needs a named proposal; it is not a release file, so a merge conflict in it is classified as above. No test file passes by its content: the test that holds the CI snippet to the release reads the version from `plugins/openspec/.claude-plugin/plugin.json`, so a release does not edit it.
  ```

`docs/adr/0003-auto-merge-the-archive-pr.md`:

- after the header line `- Amended by ADR 0027 (0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md)`, the line
  `- Amended by ADR 0030 (0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)`;
- the paragraph starting `Note (archive-release-pin, 2026-11-23)` (not yet on `main`) is replaced by:

  ```text
  Note (archive-release-pin, 2026-11-23, amended 2026-11-24): ADR 0027, as amended by ADR 0030, amends the exemption list of the Decision: `docs/openspec-flow.md` also passes when only its CI pins moved, checked by its content against the merge base; the file is not exempt as a whole, and no test file passes by its content. The Decision is otherwise unchanged.
  ```

`docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` (accepted; body
untouched):

- after the header line starting `- Builds on:`, the line `- Amended by ADR 0030 (0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)`;
- right under `## Context`, a blank line, the paragraph below, and a blank line, with `<date>` the
  day of the edit:

  ```text
  Note (archive-release-pin, <date>): ADR 0030 amends Decision 1 and Decision 2 for `plugins/openspec/hooks/change-loop-compozy.test.mjs`: the test that held the pin block reads the version from the manifest, no release edits the file, and only `docs/openspec-flow.md` passes the archive check by its content. The rest of the Decision is unchanged.
  ```

`openspec/config.yaml`, the `ADRs:` line: `0027 the archive check lets the release pin lines pass
unnamed, amends 0003` becomes `0027 the archive check lets the release pin lines pass unnamed, amends
0003, amended by 0030`, and `; 0030 the pin test reads the manifest, so only the flow page pins pass
unnamed, amends 0003 and 0027` is appended before the closing `)`, in number order after any 0028 or
0029 entry a sibling has landed.

### D-9 Release

At the base `d2010ca`: devkit-openspec `0.33.0` to `0.34.0` (a minor: the archive check's behaviour
changes) in `plugins/openspec/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json`
entry; marketplace `metadata.version` `0.37.0` to `0.38.0`. The numbers are taken again from
`origin/main` right before each push (CONTRIBUTING.md step 5), and every place below moves with them.

- `CHANGELOG.md`, above `## 0.37.0`: `## 0.38.0 — the archive check lets the release pin lines pass
  unnamed`, with a `**devkit-openspec** 0.34.0` bullet. The bullet says what changed for an archive
  and for `devkit-reviews --ci`, names ADR 0027 as a link, says the pin definition now lives in
  `deliver-check.mjs` and `release-merge.mjs` re-exports it, and ends with the sentence ``The CI
  snippet now pins `v0.34.0`, the release's tag.``. A `Docs:` bullet names ADR 0027, the Note in ADR
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

**Amended (ADR 0030).** The release numbers stay as they are on the branch (devkit-openspec 0.40.0,
marketplace 0.44.0 at `34e3500`); the flow's release step re-takes them from `origin/main`. No task
of phase 4 writes a version number. The release no longer edits the pin test: the third bullet above
(the three pin-block lines) does not apply from phase 4 on, and D-12 deletes those lines.

`CHANGELOG.md`, in the entry of this release (`## 0.44.0 — the archive check lets the release pin
lines pass unnamed` at `34e3500`; its heading and version stay as the release step leaves them), the
`**devkit-openspec**` bullet is rewritten to the text below, `<version>` being the bullet's own
devkit-openspec version as it stands on the branch (the last sentence, which names the tag, is kept
as it is):

```text
- **devkit-openspec** <version>: the archive's file check no longer asks a retro proposal to name
  `docs/openspec-flow.md` when only its CI pin lines moved: the file passes when its text with every
  CI pin masked equals its text at the merge base masked the same way
  ([ADR 0027](docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md), as amended
  by [ADR 0030](docs/adr/0030-the-pin-test-reads-the-manifest-so-only-the-flow-page-pins-pass-unnamed.md)).
  Any other edit of the file, or the file missing or unreadable on either side, still stops the
  archive on `apply-proposals` and fails `devkit-reviews --ci`, which applies the same rule from the
  same place (`unnamedFiles`). The file does not join the release list, so a merge conflict in it is
  classified as before. The CI pin test (`change-loop docs: the design records the answers`) now
  derives the pin from `plugins/openspec/.claude-plugin/plugin.json` and holds no release number, so
  no release edits it and the delivery train can join several changes that release; a change to that
  test in an archive needs a named proposal, as any test file does. The pin definition
  (`PIN_MARKER`, `PIN_TOKEN`, `pinsIn`, `setPins`) now lives in `deliver-check.mjs`, and
  `release-merge.mjs` re-exports it, so the downloaded CI files stay three.
  <the sentence "The CI snippet now pins `v<version>`, the release's tag." as on the branch>
```

The `Docs:` bullet becomes `- Docs: ADR 0027 and ADR 0030, the Notes in ADR 0003 and ADR 0027, and
the flow doc's file check (P13) and Classification bullet.`

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

**Amended (ADR 0030): the cases A1 to A6.** `proof/real-run.txt` stays as the record of phase 3. The
amended proof goes to `openspec/changes/archive-release-pin/proof/real-run-amended.txt`, built the
same way in a new scratch repository `/var/tmp/devkit-archive-release-pin/proof-repo-amended` (a bare
`origin` and a clone; never inside the worktree), with the build commands recorded verbatim at the
top of the file and the scratch repository removed afterwards. Its `main` holds
`docs/openspec-flow.md` as at `c561553^`, the file
`plugins/openspec/hooks/change-loop-compozy.test.mjs` holding the text of
`c561553^:plugins/openspec/hooks/change-loop.test.mjs` (the pin block of that time, at today's path),
and the same `openspec/config.yaml`, change `demo`, roadmap and `CONTRIBUTING.md` as above. Each case
is a fresh `chore/archive-demo` branch prepared as above, then the case's edit, committed; the run is
the same `env GITHUB_BASE_REF=main GITHUB_HEAD_REF=chore/archive-demo node
<worktree>/plugins/openspec/hooks/deliver-check.mjs --ci --json`, after task 4.2, and the file records
the exit code and `archive.unnamed`.

| Case | Edit or run | Expected |
|---|---|---|
| A1 | `docs/openspec-flow.md` as at `c561553` (a pin-only doc change) | exit 0, `[]` |
| A2 | A1 plus one sentence of the doc changed | exit 1, `["docs/openspec-flow.md"]` |
| A3 | `plugins/openspec/hooks/change-loop-compozy.test.mjs` set to the text of `c561553:plugins/openspec/hooks/change-loop.test.mjs` (only its pin assertion lines differ from `main`) | exit 1, `["plugins/openspec/hooks/change-loop-compozy.test.mjs"]` |
| A4 | `git rm docs/openspec-flow.md` | exit 1, `["docs/openspec-flow.md"]` |
| A5 | A1 run from a folder holding only copies of `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` (the consumer CI's three files) | exit 0, `[]` |
| A6 | in this worktree, after task 4.3: `env TMPDIR=/var/tmp/devkit-archive-release-pin GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --test-name-pattern="^change-loop docs: the design records the answers$" plugins/openspec/hooks/change-loop-compozy.test.mjs`, and `git grep -c -E "[0-9]+\\\\?\\.[0-9]+\\\\?\\.[0-9]+" -- plugins/openspec/hooks/change-loop-compozy.test.mjs` compared with `git grep -c -E "<the same pattern>" 34e3500 -- plugins/openspec/hooks/change-loop-compozy.test.mjs` | the test passes (exit 0, one test run); the count drops by 29, the lines D-12 deletes |

A1, A2, A4 and A5 re-prove the doc half on the amended code; A3 is the flipped case; A6 is the check
that the pin test holds without a version literal. The local stop is proved by test 7, as above.

### D-12 The pin test reads the manifest (ADR 0030 decision 1; AC-4)

In `plugins/openspec/hooks/change-loop-compozy.test.mjs`, test `change-loop docs: the design records
the answers` (lines 325-401 at `34e3500`): the 29 lines from the one starting `  // Invariant: the CI
snippet pins the current release` through the line `  assert.doesNotMatch(flow, /v0\.21\.0/, 'no pin
left on the previous release');` (lines 359-387) are deleted, and nothing is added in their place.
What stays pins the snippet to the release:

- the `v0.20.0` slice-merge floor: the `const staleV20 = ...` line, its `assert.deepEqual`, and the
  `assert.match` on `moves this pin to` with the floor's message `(project-phases)`; a fixed floor,
  not a release pin;
- `const version = JSON.parse(readRepo('plugins', 'openspec', '.claude-plugin', 'plugin.json')).version;`,
  `assert.ok(pinsIn(flow).length >= 3, ...)` and `assert.deepEqual(pinMismatches(flow, version), [],
  ...)`: every pin of the doc equals the manifest's version, so a stale pin fails by the difference.

The test's name and every other assertion stay. The deleted `assert.doesNotMatch` lines refused a
pin left on an older release; `pinMismatches` refuses any pin that is not the manifest's, which
includes every older one (ADR 0030, Consequences). Test 12 (D-6) guards the result.

Why: a release must edit no file that `release-merge.mjs` cannot resolve, so the train can join
several releasing changes (ADR 0030 Context). Rejected: teaching `release-merge.mjs` the test's pin
block (ADR 0030 Alternatives; it would keep a hand-kept history and grow the conflict rule to a test
file), and keeping the test-file archive rule beside the manifest read (it would exempt lines no
release writes).

## Risks / Trade-offs

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A sibling release takes `0.34.0`/`0.38.0` or ADR number 0027 before this merges | MEDIUM × LOW | numbers re-taken from `origin/main` before each push (CONTRIBUTING step 5); an ADR rename moves the file, its title and every reference (decisions.md) |
| A merge of `main` conflicts in `openspec/config.yaml` (a sibling's ADR entry), which is not a release file | MEDIUM × LOW | resolved by hand at the merge of `main`, keeping both entries in number order; the gates of phase 2 run again |
| The rule is looser than intended: a form line moves into another test, or a message hides an unapproved claim | LOW × MEDIUM | only `flow` and a plain version are accepted; the review trigger of ADR 0027 names it; the owner can still require a named proposal |
| The content read fails on CI (shallow clone) | LOW × MEDIUM | a failed read is `null`, so the file stays unnamed and the archive stops (fail closed); both workflows already fetch with `fetch-depth: 0` |
| A roadmap run opens `release-pin-is-a-release-file` as a change of its own while this one is in flight | LOW × MEDIUM | the coordinating session is told the line is covered here; both lines are ticked at this change's archive |
| The installed devkit-openspec (0.33.0) drives this change's own archive with the old rule | MEDIUM × LOW | this archive needs the old rule only if its retro bumps the pack; then the proposal names the two files, as before |

Amendment (ADR 0030):

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A sibling change on `main` or on the train edits the pin block of `change-loop-compozy.test.mjs` (a release before this merges), so the merge of `main` conflicts there | MEDIUM × LOW | resolve by deleting the whole literal block, as D-12 says, whatever the sibling wrote; test 12 fails on any literal left |
| The delivered phase-3 proof and reviews cite the removed test-file rule | HIGH × LOW | `proof/real-run.txt` stays as history; the amended proof is a new file; the evidence and the review bench run again on the amended head (their own writers) |
| A sibling's ADR takes number 0030 first | MEDIUM × LOW | decisions.md's numbering rule: re-checked against `origin/main` and open branches before the push; a rename moves the file, its title and every reference (ADR 0003 and 0027 lines and Notes, the config line, the flow doc, CHANGELOG, test 11) |
| Dropping the `assert.doesNotMatch` lines weakens the stale-pin check | LOW × MEDIUM | `pinMismatches(flow, version)` fails any pin unequal to the manifest's version, older ones included (`release-merge-conflict 15` tests the helper); `pinsIn(flow).length >= 3` keeps a doc with its pins removed from passing |
| A test-file edit now stops an archive that a pin-only retro would have passed under ADR 0027 | LOW × LOW | no release edits the test any more (D-12), so a pin-only retro never touches it; any other edit needed a named proposal already |

Trade-off: the check now reads two texts per pin file. That is two git calls on an archive that
touches a pin file, and none otherwise. After the amendment there is one pin file.

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

- ADR 0027 is accepted before phase 1; the plan breaks if the owner changes its rule.
- The consumer CI keeps downloading exactly three files (`merge-setup.test.mjs:184`).
- The pin markers keep their shape (ADR 0027 review trigger).
- A pin-only change needs no bump in the same diff. The guard against a pin that differs from the
  manifest is the `pinMismatches` assertion of `change-loop docs: the design records the answers`
  and test `release-merge-conflict 15`, which ADR 0027's Consequences also cite. requirements.md
  cites it as `release-merge-conflict 16`, which is the release-step docs test; requirements.md
  stays as the grill recorded it, and the plan cites the right test.

**Amendment (phase 4, ADR 0030).** Order: the flipped and new tests (red), then the code and the
fixtures (D-2, D-5), then the pin block (D-12), then the documents (D-8, D-9), then the proof (D-10
A1 to A6).

- Per surface: devkit-openspec hooks (`deliver-check.mjs`, the test files, two fixtures); documents
  (the flow doc, ADR 0003, ADR 0027, the config, CHANGELOG). No release number changes.
- Create: `openspec/changes/archive-release-pin/proof/red-4.txt`,
  `openspec/changes/archive-release-pin/proof/real-run-amended.txt`.
- Modify: `plugins/openspec/hooks/deliver-check.mjs`,
  `plugins/openspec/hooks/deliver-check-archive.test.mjs`,
  `plugins/openspec/hooks/release-merge.test.mjs`,
  `plugins/openspec/hooks/change-loop-compozy.test.mjs` (pin block only), `docs/openspec-flow.md`,
  `docs/adr/0003-auto-merge-the-archive-pr.md` and
  `docs/adr/0027-the-archive-check-lets-the-release-pin-lines-pass-unnamed.md` (header lines and
  Notes only), `openspec/config.yaml`, `CHANGELOG.md`.
- Delete: `plugins/openspec/hooks/fixtures/c561553/change-loop.test.before.txt`,
  `plugins/openspec/hooks/fixtures/c561553/change-loop.test.after.txt`.
- Estimate: optimistic 3 h, likely 4.5 h, pessimistic 7 h (a merge of `main` that renumbers the
  release or the ADR, plus the train's whole suite).

| Component | Hours | Type | Risk |
|---|---|---|---|
| 4.1 flipped tests 3 to 8, 10, 11 and new test 12, red run | 1.5 | Testing | MEDIUM |
| 4.2 code (D-2 amended) and fixture deletion | 0.5 | Core | LOW |
| 4.3 pin block of the test (D-12) | 0.25 | Core | LOW |
| 4.4 documents, ADR header lines and Notes, config, CHANGELOG | 0.75 | Documentation | LOW |
| 4.5 real-run proof A1 to A6 | 0.75 | Testing | LOW |
| 4.6 filtered gate | 0.75 | Testing | LOW |

Assumptions of the amendment: ADR 0030 is accepted before task 4.1 (decisions.md); the pin block
holds lines 359-387 at `34e3500` (read for this plan); no other test reads `PIN_LINE_FILES` beyond
test 10 or the two deleted fixtures (the D-7 amended grep).

**Dependencies:** ADR 0030 (proposed; accepted by `accept-decisions` after the owner approves the
amended plan) and ADR 0022 (the delivery train, whose join is the reason); ADR 0027 (decisions stage, accepted by `accept-decisions`); the pin definition of
the archived change `release-merge-conflict`; the archive check of ADR 0003 and ADR 0012. No open
decision.
