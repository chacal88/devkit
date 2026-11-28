<!-- devkit-stage design result=passed attempt=1 commit=0421f488610ba57ef538ee71e19a25db6d16c7eb -->
# Design

Change: `forced-merge-release-edit` · Date: 2026-11-28 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`proposal.md`, `requirements.md`, `decisions.md`, `specs/change-delivery/spec.md`, `release.md`).
Base: `origin/main` at `6f03a57c`, branch opened on it (`0421f488`), nothing merged yet. Line numbers
below are at `0421f488` and move when task 1.1 merges `fast-suite`; the function names do not.

## Context

See `proposal.md` (Why). The state at `0421f488`:

- `gatesAtHead(gh, id, head)` (`plugins/openspec/hooks/deliver-check.mjs:969`), called only by
  `forcedMerge` (`:1054`) with `pr.headRefOid`, reads each gate file at the merged head through
  `readContents`. Its inner `behind(recorded, allowed)` reads `compare/<sha>...<head>` once per sha
  (`ghJson`) and rejects the first `files[].filename` that `allowed` refuses. `allowed` is
  `isOpenspec` for the evidence and `verdictAllowed(id, name, verdict, open)` for a review.
- The normal path's release-edit rule (ADR 0034 decision 5) is `staleness`'s `release` option.
  `readReviews` (`:487`) and the evidence items (`:599`, `:707`) pass `releaseEditOf(root, id, facts)`
  to it, and only for an approved or declined verdict with no undisposed finding (`exempt`, `:491`).
  `releaseEditOf` gives a predicate only for a change with `release.md` in a project that names
  `devkit.release_tag` (`releaseFacts`, `:2169`).
- That predicate is `releaseOnlyEdit(root, before, after, path, ctx)` (`:2254`), built on
  `maskRelease` and `maskCitations`. It reads files through `repoReader(root)` (`git show`,
  `git ls-tree`), and the folders of numbered records through `ctx.adrsAt(rev)`, which
  `releaseContext(root, file)` (`:2298`) builds on another `repoReader(root)`. It is pure over a
  reader `{ file(rev, path), dir(rev, path) }` except for that one hard-wired `repoReader(root)`
  call. The train check (`:3653`, `:3662`) is its other caller.
- `fast-suite` edits `staleness` (`:427`), which this change does not touch.

## Goals / Non-Goals

**Goals:**

- The forced-merge read gives the normal path's answer for a release edit, reading GitHub only.
- One mask: the forced-merge read calls the same `releaseOnlyEdit` the normal path and the train
  check call.
- Every caller of `releaseOnlyEdit` and `releaseContext` today reads exactly what it reads now.

**Non-Goals:**

- A per-commit judgement on the forced path. `gatesAtHead` judges the compare's aggregate file
  list today, and keeps doing so (D-1).
- The own-files rule on the forced path, and judging a compare entry's `previous_filename`: both
  absent today, both unchanged (Risks).
- Any reading of the step record (`stepRecord`) or of the release state (`releaseStateAt`).

## Decisions

### D-1 The mechanism: the masked comparison of ADR 0034 decision 5, on the compare's two ends

For a recorded commit R behind the merged head H, `behind` keeps its compare. A file the reader's
rule refuses is not a reason when the release allowance applies (D-3) and
`releaseOnlyEdit(null, R', H, path, ctx)` returns true. R' is the full sha of R (D-4); `ctx` reads
through GitHub (D-2). The first refused file that is not a release edit is the reason, in the same
text as today: `<R7> is behind the merged head, which changes <path>`.

What `releaseOnlyEdit` accepts on the two ends is what ADR 0034 decision 5 lists. `CHANGELOG.md`
and `docs/catalog.md` are accepted without a read. A path whose two texts are equal under
`maskRelease` passes: manifests and the release file without their versions, the flow page with its
pins at `0.0.0`, and the citations of each numbered record back to `ADR [<slug>]`. So does a
numbered ADR added where its unnumbered form left with the same masked text, and that form deleted.

Why the two ends and not each commit: `gatesAtHead` reads one compare per recorded sha and judges
its aggregate `files` list (forced-merge-path D-3). A per-commit reading would need
`compare.commits` and one `commits/<sha>` read per commit, up to 250, for an answer that differs
only where a later commit undid an earlier edit. The aggregate list already accepts such an undo for
every file today, so the change adds no new kind of leniency.

ADR 0035's review trigger ("a CI job or any reader without the branch's history starts computing
the release state") does not fire. This reader computes no release state: it calls neither
`releaseStateAt`, `computeRelease` nor `stepRecord`, and it reads no trailer. It judges staleness by
the masked comparison, which is exactly what ADR 0035 decision 7 lets a reader without the
branch's history do. ADR 0034's review trigger "a rename at merge stales an approval, an evidence
or a review" described the forced path's over-report; this change removes that case.

Alternatives considered:

| Option | Why rejected |
|---|---|
| Allow every file of a compare commit whose message carries `Release-change: <id>` (D-29's first option) | AC-2 fails: a step's commit that also edits a sentence would pass. ADR 0035 decision 2 makes a trailer count for nothing on its own. Decision 3 lets only `stepRecord` read the record, and only where the branch's history is present, which GitHub's compare is not. |
| Run `staleness` on the local checkout `deliveryOf` holds (`root`) | The requirement is "GitHub alone". ADR 0028 decision 6 finds the forced merge from any checkout, after GitHub deleted the branch, where R and H may be absent locally. A local read would make the answer differ by checkout, the thing `gatesAtHead` exists to avoid. |
| Judge each commit of the compare against its parent through GitHub | Up to 250 extra reads per recorded sha, and a different reading from the one `gatesAtHead` makes for `openspec/` and the reviewer rules (above). |
| A second, GitHub-only copy of the mask | The coordinator's constraint and the one-helper rule: one mask, one reader parameter (D-5). |

### D-2 The GitHub reader, local to `gatesAtHead`

Inside `gatesAtHead`, a reader with the shape `repoReader` returns, memoized per `rev` and `path`
for the call:

- `file(rev, path)`: `readContents(gh, path, rev)`. Not found gives `null`. An answer whose
  `json.content` is a string gives its base64-decoded UTF-8 text. An answer with no content string
  (a folder, or a file GitHub answers with `encoding: none`) records the error
  `<path> at <rev7> has no content`, the text `textOf` already uses, and gives `null`. A failed read
  records `error` (the `ghError` text) and gives `null`.
- `dir(rev, path)`: `readContents(gh, path, rev)`. Not found gives `[]`. An array gives the `name`
  strings of its entries. Any other answer gives `[]`. A failed read records its error and gives `[]`.

Only the first error is kept (`readError`), as the `historyError` of the fixed-in check is. After
every `releaseOnlyEdit` call `behind` checks it, and a set `readError` ends `gatesAtHead` with
`{ error: readError }`. The caller then answers `blocked` through `deliveryOf`'s `unreadMerge`, as
for every other gate read (spec scenario "A file of the release comparison cannot be read"). An
error is never a pass and never "not forced". The reader is a closure, not an export: production
and the tests reach it only through `gatesAtHead`.

### D-3 When the allowance applies

- **By verdict** (as `readReviews`'s `exempt`): the evidence once its header is `passed`, and a
  review whose verdict is approved or declined and that lists no undisposed finding (`open` false).
  `behind` gains a third argument `exempt` (boolean). The evidence passes `true` and a review passes
  `!open`; a non-approved verdict never reaches `behind`.
- **By change**, read lazily the first time an exempt `behind` meets a refused file, and once per
  call. First `openspec/changes/<id>/release.md` at H: not found means no allowance; a failed read
  is the error. Any other answer means a note (its content is not parsed, as `releaseOnlyEdit` does
  not need it). Then `openspec/config.yaml` at H through the reader's `file`: `null` with no error
  means no allowance. Otherwise `releaseTagSetting(parseDevkitBlock(text)).file`, both from
  `guard.mjs` and already imported, is taken; `null` (no `release_tag`, or a value the setting
  reader refuses, as `namesReleaseTag` treats it) means no allowance. A file gives
  `ctx = releaseContext(null, file, reader)`.

  The config is read at H, not in the local checkout, so the answer is the same from every
  checkout. The note is read first because the no-note case is the common one and then costs a
  single read.
- A compare whose refused files are all under `openspec/` or pass the rule makes no read beyond
  today's (no refused file, no lazy read).

### D-4 The recorded side's ref

R' is `compare.json.base_commit.sha` when it is a full sha (`isSha`), else `recorded.sha`. The
`Commit:` line may hold a short sha (G4), and the contents API is read at the compare's resolved
base. For an `ahead` compare the base commit is R itself. `identical` never reaches the judgement,
since its file list is empty.

### D-5 The shared helper takes its reader from the context

- `releaseContext(root, file = null, reader = repoReader(root))` returns `{ file, reader, adrsAt }`,
  `adrsAt` reading through that `reader`.
- `releaseOnlyEdit` reads through `ctx.reader` in place of its own `repoReader(root)`; its default
  `ctx = releaseContext(root)` carries `repoReader(root)`.
- `releaseEdit(root, file)` and the train check keep calling `releaseContext(root, file)`, so their
  reads are byte-for-byte today's. `staleness` is not edited.

### D-6 Texts

- Spec: `specs/change-delivery/spec.md` (two MODIFIED blocks, every existing scenario kept).
- `docs/openspec-flow.md`, paragraph "An owner's forced merge.", after the sentence ending
  `read through GitHub so the count is the same from every checkout.`, one sentence is inserted:
  `For a change with a release note in a project that names \`devkit.release_tag\`, a path whose
  texts at the recorded \`Commit:\` and at the merged head, read through GitHub, are equal once the
  release lines are masked counts as unchanged for the evidence and for an approved or declined
  review with no undisposed finding, as on the delivery path ("The own-files rule"); a read that
  comparison needs and cannot make is \`blocked\` too.`
- The comments of `gatesAtHead` (`:964`-`:968`) and of `behind` say the same in one line each and
  cite `forced-merge-release-edit D-1`.

### D-7 Tests

All in `plugins/openspec/hooks/deliver-check-archive.test.mjs`, in the G block, at G15's place. No
test file is added or moved, so `scripts/test-map.json` is not edited (its
`plugins/openspec/hooks/deliver-check.mjs` entry already selects this file). Every new test name
starts `forced-merge-release-edit AC-<n> ` (or `forced-merge-release-edit blocked ` for D-2's
error path). Each is written first and seen failing on the code before task 1.3.

Fixture: one helper `releaseStepAt(gh, head, { flow = 'release', extra = [], note = true,
config = 'tag', base = true })`. It sets the compare `compare/<OLD>...<head>` and every contents
answer the step's commit needs at `OLD` and at `head`:

- `release.md` at head: `fileFx('# Release note\n\npacks:\n- devkit-openspec: patch\n\n## t\n\nbody\n')`,
  or `NOT_FOUND` with `note: false`.
- `openspec/config.yaml` at head: `devkit:\n  release_tag: plugins/openspec/.claude-plugin/plugin.json\n`
  with `config: 'tag'`, `devkit:\n  language: en\n` with `'none'`, `devkit:\n  release_tag: notes.txt\n`
  with `'bad'`, and `NOT_FOUND` with `'absent'`.
- `.claude-plugin/marketplace.json` and `plugins/openspec/.claude-plugin/plugin.json`: the same JSON
  with `version` `1.0.0` at `OLD` and `1.1.0` at head.
- `CHANGELOG.md`: no contents answer (D-1: accepted without a read).
- `docs/adr/0035-feat.md`: `NOT_FOUND` at `OLD`, and at head the text `# Feat\n\nThe record.\n`.
  `docs/adr/feat.md` holds that text at `OLD` and is `NOT_FOUND` at head. `docs/adr` lists
  `feat.md` at `OLD` and `0035-feat.md` at head; `docs/decisions` is `NOT_FOUND` at both.
- `docs/openspec-flow.md` at `OLD`: `See ADR [feat].\nuses: x # pinned to the commit of v1.0.0\nThe gate reads it.\n`.
  At head the same with `ADR 0035` and `v1.1.0`. With `flow: 'sentence'` the head's last line is
  `The gate reads it twice.\n` as well.
- The compare: `status: 'ahead'`, `base_commit: { sha: OLD }` (omitted with `base: false`), and
  `files` the G15 order `STEP_FILES` (the ADR entry `renamed` from `docs/adr/feat.md`), then `extra`.
  Each extra product file gets `NOT_FOUND` at `OLD` and a text at head.

`gatesAt` gains `gh.set(contentsKey('openspec/changes/feat/release.md', head), NOT_FOUND)` before
its gate files, so every G, F and N row that reaches a refused file reads "no note", as today.

| Id | Name (after the prefix) | Asserts |
|---|---|---|
| T-1 | `AC-1 a noted change behind only the assign-release step's files opens no gate, and forcedMerge counts only the red check` | `gatesOf` is `{ gates: [] }` with evidence and both reviews at `OLD`; `forcedMerge` gate items `[]`, `count` 1; each contents key read at most once (`t.gh.calls()`) |
| T-2 | `AC-2 a step's commit that also edits a sentence of docs/openspec-flow.md opens the evidence and each approved review, naming that file` | three gates, each `<OLD7> is behind the merged head, which changes docs/openspec-flow.md` |
| T-3 | `AC-3 a product commit after the step's opens the evidence naming plugins/x.mjs` | `extra: ['plugins/x.mjs']`: evidence and both reviews naming `plugins/x.mjs` |
| T-4 | `AC-4 no note, no config, no release_tag or a refused one: the same items as before, naming the first step file` | four variants (`note: false`; `config` `'absent'`, `'none'`, `'bad'`); each gives three gates naming `.claude-plugin/marketplace.json`. With `note: false` no contents read of a step file is made |
| T-5 | `AC-4 a compare of only openspec/ files reads no release note` | G5's compare: no call to the `release.md` key |
| T-6 | `AC-5 a REJECTED review and an approved one with an undisposed finding stay open across the step's commit` | the AC-1 compare; `reviews/code-quality-reviewer.md` `verdict rejected`, the `withFinding` review naming `.claude-plugin/marketplace.json`; evidence current |
| T-7 | `AC-1 the compare's base_commit sha is the recorded side's ref, and the recorded sha is without it` | a short `Commit:` (`OLD7`) with the compare `OLD7...head` answering `base_commit: { sha: OLD }` is current, and no contents key at `OLD7` is read; `base: false` with the full `OLD` is current too |
| T-8 | `blocked a failed or empty read of the release comparison ends gatesAtHead with the error` | cases: `release.md` `BOOM`; config `BOOM`; config with no content string; marketplace at `OLD` `BOOM`; marketplace at head with no content string; `docs/adr` at `OLD` `BOOM`. Each gives `{ error }`, `gh: boom` or `<path> at <rev7> has no content` |
| T-9 | `blocked from the default branch a failed release read blocks naming pull request 12 and never forces` | `forcedFixtures(pm())` with the evidence at `OLD`, `releaseStepAt(t.gh, 'b'.repeat(40))` and the marketplace at `OLD` `BOOM`: `unreadMerge` `{ number: 12, error: 'gh: boom' }`, `forced` null, `nextStep` `blocked` with `unreadReason(12, 'gh: boom')` |

### Pinned rules: every test that quotes what this change replaces

Searched in every suite (every `*.test.mjs` and `*-fixtures.mjs` of the repository, and `.compozy/`) for the
forced-merge sentence, the scenario text, `over-report`, `is behind the merged head`, `gatesAtHead`,
`forcedMerge`, `releaseOnlyEdit`, `releaseContext` and `repoReader`. Each test that quotes the sentence
or the behaviour:

| Test | Invariant | Layer | Suite | Action |
|---|---|---|---|---|
| `forced-merge-path 1: G15 forced-merge-release-edit: a noted change behind only the assign-release step's files names evidence.md and each approved review as open`, and its comment block (`deliver-check-archive.test.mjs:2592`-`2616`) | a noted change's step commit at a forced merge reads as the over-report | `gatesAtHead` | `deliver-check-archive.test.mjs` | removed, replaced by T-1 (its `STEP_FILES` kept for the fixture) |
| G5, G6, G8, G11, G13 (`:2474`-`:2577`) | a refused file names the record as behind; an openspec-only compare is current | `gatesAtHead` | same | unchanged expectations; `gatesAt`'s default "no note" keeps them on today's read |
| G9, G10, F, N and `forcedMerge` rows using `gatesAt` or `forcedFixtures` | failed reads block; counts and order | `gatesAtHead`, `deliveryOf` | same | unchanged; the new default answer is a key they never set |
| `release-note AC-4 staleness: ...` and `release-note AC-5 staleness: ...` (`deliver-check.test.mjs:2943`-`3105`) | the normal path's release-edit rule | `staleness` through `releaseOnlyEdit` | `deliver-check.test.mjs` | unchanged; they prove D-5 keeps the local reader |
| `release-note AC-3 trainCheck: a join that numbers an ADR passes ...` (`delivery-train-after.test.mjs:465`) | the train's own-commit rule | train check through `releaseContext` | `delivery-train-after.test.mjs` | unchanged; proves D-5 for the other caller |

`release-note.test.mjs` matches only for `repoReader` (it hands `computeRelease` a local reader) and is untouched. No other test quotes the spec sentence, the "The step's commit" THEN, or the flow paragraph's
forced-merge sentence. `openspec/specs/change-delivery/spec.md:414` and `:428` hold them and change
only through the delta at the archive. The roadmap line holds the request text and is ticked by the
archive.

## Risks / Trade-offs

- [A refactor of `releaseOnlyEdit` changes what the normal path or the train reads] (LOW × HIGH). Mitigation: D-5 keeps
  `repoReader(root)` as the default reader, and the `release-note AC-4`/`AC-5` staleness rows and
  `release-note AC-3 trainCheck` row (table above) run in the gate.
- [`fast-suite` moves the code this plan names] (MEDIUM × LOW). Mitigation: task 1.1 merges the base
  first and, when a named line or helper moved, edits `proposal.md`, `design.md` and `tasks.md` in
  the same commit (CLAUDE.md). This plan's edits do not touch `staleness`.
- [The aggregate compare accepts a release-masked file that a per-commit reading would not, e.g. a
  product edit later undone] (LOW × LOW). Accepted: today's forced read already accepts any undo, and
  the normal path stays per-commit (D-1).
- [A merge of the base between R and H, read without the own-files rule, still opens items] (MEDIUM × LOW).
  Accepted and unchanged: an over-report, never a pass. A version bump the base brought to a manifest
  now masks equal and no longer opens an item, as on the normal path for a merge's first parent.
- [A rename's `previous_filename` is not judged] (LOW × MEDIUM). Unchanged from today and out of
  scope; for a noted change the new path is still judged by the mask, which refuses a product file
  renamed into an ADR folder (no unnumbered form of that slug at R).
- [More GitHub reads on a forced merge of a noted change: about 2 per refused file plus 4 folder
  reads] (LOW × LOW). Mitigation: memoized per call, lazy (D-3), and capped by the existing 300-file
  limit.
- [A file over GitHub's 1 MB contents limit answers no content and blocks] (LOW × LOW).
  Mitigation: `CHANGELOG.md` and `docs/catalog.md` are never read; a block names the file, and the
  owner's retro step waits on it rather than passing.

## Migration Plan

No migration: one checker answer changes for forced merges of noted changes, from more open items
to the normal path's. Rollback is the revert of the change's commits. The spec delta's two
MODIFIED blocks go back to the archived wording of release-at-merge.

## Implementation plan

Dependency order: the shared helper's reader (D-5) → the GitHub reader and the allowance in
`gatesAtHead` (D-2 to D-4) → tests (D-7) → texts (D-6).

- **Backend (`plugins/openspec/hooks/deliver-check.mjs`)**: modify `releaseContext`,
  `releaseOnlyEdit` and `gatesAtHead` and its comment. No other function changes.
- **Tests**: modify `plugins/openspec/hooks/deliver-check-archive.test.mjs` (`gatesAt`, the helper
  `releaseStepAt`, T-1 to T-9, G15 removed).
- **Docs/spec**: modify `docs/openspec-flow.md` (one sentence); the spec delta is already written.
- **Files created / deleted**: none in the product; the change folder's own files only.

Estimate: optimistic 3 h, likely 5 h, pessimistic 8 h. The pessimistic case is a `fast-suite` merge
that moves the code, plus a long `--own-files` run: `deliver-check.mjs` maps to 29 test files,
slow ones included.

| Component | Hours | Type | Risk |
|---|---|---|---|
| D-5 reader in the context | 0.5 | Core | LOW |
| D-2 to D-4 in `gatesAtHead` | 1.5 | Core | MEDIUM |
| D-7 fixture and T-1 to T-9 | 2 | Testing | MEDIUM |
| D-6 flow sentence and comments | 0.5 | Documentation | LOW |
| Base merge and gate runs | 0.5 | Integration | MEDIUM |

Assumptions:

- GitHub's `compare/<base>...<head>` answers `base_commit.sha` and a `files` list with `filename`
  (and `previous_filename` on a rename). Source: `gatesAtHead` and the G15 fixture.
- `contents/<path>?ref=<sha>` answers a base64 `content` for a file under 1 MB and an array for a
  folder. Source: `readContents`, `textOf` and G9.
- `releaseOnlyEdit` uses no reader but `ctx.reader` once D-5 lands, and `root` for nothing else.
  Source: `deliver-check.mjs:2254`-`2303`.

Dependencies: ADR 0034 decision 5 (the rule), ADR 0035 decisions 2, 3 and 7 (no trailer, no
record, the masked comparison for a reader without history), ADR 0028 decision 3 (the open items),
`openspec/specs/change-delivery/spec.md` (the two requirements), and `fast-suite` landing first
(coordinator's order).
