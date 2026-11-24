<!-- devkit-stage design result=passed attempt=3 commit=ba3126b84f6821144dad1cfb02b260bf68dc7e77 -->
# Design

Change: `release-at-merge` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `proposal.md`, `requirements.md`, `decisions.md`, `ADR [release-at-merge]`, `release.md`).
Plan base: `ba3126b`, the merge of `origin/main` at `c663f21` (train 4, which carries
`archive-release-pin`, ADR 0027 and ADR 0030) into `66a27b1` (the merge of `a347ac0`, train 3, into
the first base `2ecd562`); the code and the tests below were read again at `ba3126b`. Every
function, constant and file is named, never a line number; this change's own version and ADR number
are "assigned at merge" and never written.

## Context

See `proposal.md` (Why). What the approach builds on, read at the plan base and at `origin/main`:

- `plugins/openspec/hooks/release-merge.mjs` resolves release conflicts by rule: `resolveVersion`
  (the base's version plus the branch's own bump kind, `bumpKind` and `applyBump`), `resolveManifest`
  (rewrites a manifest from the base's text), `manifestEditsBeyondVersion`, `resolveChangelog` (the
  one new entry renumbered above the base's newest), `PIN_FILE` (`docs/openspec-flow.md`), `PIN_PACK`,
  `PIN_PACK_NAME` and `mergePins` (the CI pin lines), `resolveRoadmapTicks` and `classifyConflict`. Its
  `main` has two modes: `--base <base>` merges `origin/<base>` into the branch and renumbers the
  branch's bump above the base's; `--merge <rev>` is the train's join, the roles swapped. Both read
  the change's bump from the manifests the branch edited (`resolveVersions`). It imports
  `RELEASE_FILE`, `pinsIn` and `setPins` from `deliver-check.mjs` and re-exports `pinsIn` and
  `setPins` (`export { pinsIn, setPins }`, ADR 0027: the pin definition lives in the file the consumer
  CI downloads); `deliver-check.mjs` imports nothing from it (its comment on `TRAIN_PIN_FILE`; the
  test "archive-release-pin 10" of `release-merge.test.mjs` refuses such an import), which D-3a
  keeps.
- `plugins/openspec/hooks/train-loop.mjs`: the departure (`departTrain`) builds the train in a scratch
  worktree with `build`, which runs `release-merge.mjs --merge <head> --json` per boarded head; exit 2
  takes the change off with `pathsDetail` of the JSON. `updateTrain` merges the base with `--base`.
- `plugins/openspec/hooks/deliver-check.mjs`: `RELEASE_FILE` (manifests, marketplace, `CHANGELOG.md`,
  `docs/catalog.md`; its source is pinned by a test), `TRAIN_PIN_FILE`, `ownFiles` and `staleness`
  (the own-files rule, ADR 0025: a release file is never own; a plain commit is judged as before),
  the pin definition `PIN_MARKER`, `PIN_TOKEN`, `pinsIn` and `setPins`, `PIN_LINE_FILES` and
  `pinLinesOnly` (the flow page passes the archive check when only its CI pins moved: ADR 0027 as
  amended by ADR 0030), `unnamedFiles` (the archive check, ADR 0003 as amended by ADR 0027 and ADR
  0030), `trainCheck` (its `allowed` paths: release files, the
  pin, the roadmap, the record), `releaseTagOf` and `releaseTagFacts` (ADR 0019), `approvalState`
  and `nextStep` (the delivery rows; `stop-plan-approval` only while no task is ticked; the train
  rows T1 to T9; `update-branch` and `enable-auto-merge` in `merge` mode). The CI job of a consumer
  downloads `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` only; this repository's own
  `devkit-reviews.yml` runs the branch's `deliver-check.mjs --ci`.
- `plugins/openspec/hooks/conduct-check.mjs`: `actorOf` maps steps to actors (`SUBAGENT`, `MAIN`, ...);
  `deliveryRow` applies the overrides `adrClash` (`ADR_DIRS`, `ADR_FILE`, step `renumber-adr`),
  `releaseConflict` (`resolve-release-conflict`) and `trainRejoin`.
- `plugins/openspec/hooks/change-loop.mjs`: `ROWS` (`handOff` and `session` rows per step, which
  `ROW_STEPS` exposes), `SKILL_LOOP_STEPS`, `decisionRecords` and `acceptDecisions` (`ADR_LINES`,
  `readRecord`), `approvalText` and `recordApproval` (the CompozyOS record step), `subagentStopFor`
  (the `subagent-stop` hook of `guard.mjs`, also used by `roadmap-loop.mjs`), `buildView` (a session
  step's CompozyOS brief names "the `ship-change` row of that name").
- `plugins/openspec/hooks/flow-check.mjs`: decides the stages up to the approval from headers and
  `staleAfter` mtimes; `collectFlow` passes `own` to `staleness` for the code-bound stages.
- `plugins/openspec/hooks/guard.mjs`: `isDecisionRecord` accepts any Markdown file in a folder named
  `adr`, `adrs` or `decisions`; the `adr-author` writes only there.
- `scripts/check.py`: links, language, frontmatter, changelog heading, skipped tests, flow versions;
  no ADR check today. The stage files of a change are written uncommitted on top of the commit their
  header names: `approval.md` of `stale-only-on-own-files` says `commit=5d255b1`, and that commit
  holds no file of the change's plan.
- On `origin/main` since the first base: train 3 (`release-merge-leftovers`) gave
  `openspec/specs/change-delivery/spec.md` the requirement "A plain commit on the branch keeps its
  rule". Train 4 (`archive-release-pin`, ADR 0027 and ADR 0030) moved `PIN_MARKER`, `PIN_TOKEN`,
  `pinsIn` and `setPins` into `deliver-check.mjs` and added `PIN_LINE_FILES` and `pinLinesOnly`; the
  test "change-loop docs: the design records the answers" of `change-loop-compozy.test.mjs` no longer
  asserts a pin literal: it reads devkit-openspec's version from its manifest and checks every pin
  against it (`pinMismatches`), so no release edits it (ADR 0030); `CONTRIBUTING.md` step 5's last
  sentence now says a release moves the flow page's CI pins and no test; the flow page's P13 row and
  "The file check (P13, AC-3)" paragraph name the pin-line exemption; ADR 0003's header gained the
  "Amended by" lines of ADR 0027 and ADR 0030; the `ADRs:` line of `openspec/config.yaml` gained
  0027 and 0030. Nothing merged contradicts a requirement: the requirements already name
  `archive-release-pin` as merged and draw the line D-17 keeps.

## Goals / Non-Goals

**Goals:**
- One reader of the note and one derived release state, both in `deliver-check.mjs`, shared by the
  checker, the step, the join, the stage checker and `--ci`.
- One numbering core in `release-merge.mjs`, used by `--assign` and by `--merge`, that leaves every
  file under `openspec/changes/` as it was.
- The old rule untouched for a change with no note; nothing new without `devkit.release_tag`.

**Non-Goals:**
- `change-loop-compozy.test.mjs`'s pin test, `unnamedFiles`, `PIN_LINE_FILES`, `pinLinesOnly` and
  `RELEASE_FILE`: the archive check's pin-line rule stays as written (ADR 0027, ADR 0030; D-17).
- The panel (`plugins/panel/hooks/steps.ts` shows an unknown step by its id, as `tag-release`).
- `updateTrain`'s `--base` and its limits with several released joins, the archive's
  `apply-proposals` bump (an archive has no note), the schema templates and `flow.json`.

## Decisions

### D-1 The note and its reader

`openspec/changes/<id>/release.md`, in this order (CRLF read as LF; blank lines between parts allowed):

```text
# Release note                        (optional first line)
packs:                                (or `packs: []`)
- <pack name>: patch|minor|major      (one line per pack, each pack once)
marketplace: patch|minor|major        (optional; default: the largest pack bump, none if no pack)
release: patch|minor|major            (optional; the file devkit.release_tag names)
## <changelog title>                  (required when the note releases anything)
<changelog body, Markdown, to the end of the file>
```

New exports of `deliver-check.mjs` (the CI job downloads it alone, and `release-merge.mjs` already
imports it): `RELEASE_NOTE = 'release.md'`; `parseReleaseNote(text)` returns `{ packs: [{ name, kind
}], marketplace, release, title, body }` or `{ error }`; `releaseNoteHash(dir)` returns
`sha256:<first 12 hex>` of the file's bytes, or `null` with no file. Errors, each starting `release.md:`
and naming the field: an empty file or no `packs:` line (`packs: missing`); a list line that is not
`- <name>: <kind>`; a kind outside the three; a pack twice; `marketplace:` or `release:` out of order
or twice; any other line before the title (`line <n>: "<text>" is not a field of the note`); no title
or an empty body when the note releases anything; a body with an odd count of fence lines
(```` ``` ```` or `~~~`, three or more) (`changelog body: a code fence opened at line <n> is never
closed`). A last line without a newline is read as if it had one. Errors that need the repository
come from `computeRelease` (D-3), not the reader, each in the same form: a pack with no
`plugins/<dir>/.claude-plugin/plugin.json` of that name (`release.md: packs: <name> is not a pack of
this project`); `marketplace:` with no `.claude-plugin/marketplace.json` (`release.md: marketplace:
the project has no .claude-plugin/marketplace.json`); `release:` when the `devkit.release_tag` file is
a pack manifest (`release.md: release: <file> is the manifest of <pack>; state its bump under
packs:`). With no `devkit.release_tag`, nothing reads the file (AC-9).

### D-2 Which rule a change follows

`releaseFacts(root, id, facts)` (exported, memoized on `facts` as `ownFiles` is) answers `{ applies:
false }` when `releaseTagOf(root)` (now exported, for D-11) is null. Otherwise a change with `release.md` is **noted** and every
rule below applies; a change without it is **old-rule**: delivered exactly as today (AC-10), plus the
"no release" refusal of D-8. `ADR_DIRS` (`docs/adr`, `docs/decisions`) and `ADR_LINES` move to
`deliver-check.mjs`; `conduct-check.mjs` and `change-loop.mjs` import them (their exports stay).

### D-3 The release lines, the computation and the derived state

The release lines of a tree: each pack manifest's `version` for packs present at the compared merge
base; the marketplace's `metadata.version` and `plugins[].version`; `CHANGELOG.md`'s text; `pinsIn` of
`PIN_FILE`; the top-level `version` of the `devkit.release_tag` file; for each unnumbered ADR the
change's `decisions.md` lists (`changeAdrs(root, rev, id)`: `- ADR:` paths in `ADR_DIRS` whose name has
no `NNNN-` prefix, in listed order), whether the tree holds `<dir>/<slug>.md` or `<dir>/<NNNN>-<slug>.md`;
and whether `ADR [<slug>]` remains outside `openspec/changes/`. `docs/catalog.md` is left to
`gen-catalog.py --check`.

`computeRelease(readAt, base, note, setting)` (pure over a reader of files at a revision) gives the
lines the step writes on `base`: each listed pack `applyBump(base version, kind)`; the marketplace
entries follow the packs; `metadata.version` bumped by `marketplace:`; the pins set to the new
devkit-openspec version when that pack is bumped (else the base's), only when `PIN_PACK` exists; the
release file's version bumped by `release:` when the file exists and is not a pack manifest (a pack
manifest's version is the pack's; a `release:` line then is an error naming the pack); the changelog,
when `CHANGELOG.md` exists and a version heads it (`metadata.version`, else the release file's), by
`changelogEntry(baseText, version, title, body, packVersions)`: `## <version> — <title>`, a blank line,
the body with `- **<pack>**:` at the start of a bullet turned into `- **<pack>** <version>:` for each
listed pack, inserted above the first `## ` line of the base text (appended when there is none); and
the ADR numbers: per folder, one more than the highest `NNNN-` file of that folder on `base`, in
listed order.

`releaseState` (part of `releaseFacts`) compares the head's lines with those of `M`, the merge base of
the head and `origin/<base>` (the base `stalenessBase` names): equal to `M`'s and every ADR unnumbered gives
`unassigned`; equal to `computeRelease(M)` gives `assigned`; anything else gives `hand` with the
differing paths. A note with nothing to write (no pack, no `release:`, no ADR) is `assigned` at once
(AC-11). `current` is `assigned` with `origin/<base>` an ancestor of the head. Without `origin/<base>`
the state is an error (`cannot compute the release: origin/<base> is missing; git fetch origin
<base>`), never a pass. `citations` lists `ADR [<x>]` tokens in the branch's changed files for a slug
`x` the change does not own; one with no `<dir>/<NNNN>-x.md` on `origin/<base>` is unlanded.

### D-3a The module boundary: what moves into `deliver-check.mjs`

A consumer's `devkit-reviews` job downloads exactly `guard.mjs`, `deliver-check.mjs` and
`merge-setup.mjs` (`docs/openspec-flow.md`, CI section; the setup template), and `release-merge.mjs`
already imports `deliver-check.mjs`. So `deliver-check.mjs` keeps its relative imports to
`./merge-setup.mjs` and `./guard.mjs` only, static or dynamic, and everything D-1 to D-5, D-8 and D-9
run comes from those three files. A static import of `release-merge.mjs` would fail every consumer's
check at load time (`ERR_MODULE_NOT_FOUND`), with or without a release setting, and would be a cycle.

Already in `deliver-check.mjs` at the plan base, moved there by `archive-release-pin` (ADR 0027) and
not moved again: `PIN_MARKER`, `PIN_TOKEN`, `pinsIn` and `setPins`, which `release-merge.mjs` imports
and re-exports today (`import { RELEASE_FILE, pinsIn, setPins } from './deliver-check.mjs'` and
`export { pinsIn, setPins }`); this change leaves those two lines' names in place.

These move, with their bodies unchanged, from `release-merge.mjs` into `deliver-check.mjs`, exported
there: `ReleaseError` (one class, so `release-merge.mjs`'s `instanceof ReleaseError` sees the errors
the moved functions throw), `bumpKind`, `applyBump`, `resolveManifest`, `withoutVersions` (now
exported: `maskRelease` masks manifests with it and `release-merge.mjs`'s `manifestEditsBeyondVersion`
keeps using it), `PIN_FILE`, `PIN_PACK` and `PIN_PACK_NAME`, with the private `SEMVER` and
`parseSemver` they use. That is the whole list of what is still in `release-merge.mjs` and moves;
nothing else is moved. `TRAIN_PIN_FILE` stays, written `export const TRAIN_PIN_FILE = PIN_FILE`, its
comment saying the name is kept for its readers; `PIN_LINE_FILES` stays as written (ADR 0030).
`release-merge.mjs` imports each moved name from `./deliver-check.mjs` and re-exports it under the same
name: its existing import line grows to `import { RELEASE_FILE, pinsIn, setPins, ReleaseError,
bumpKind, applyBump, resolveManifest, withoutVersions, PIN_FILE, PIN_PACK, PIN_PACK_NAME } from
'./deliver-check.mjs'` and its existing `export { pinsIn, setPins }` grows to `export { pinsIn,
setPins, ReleaseError, bumpKind, applyBump, resolveManifest, PIN_FILE, PIN_PACK, PIN_PACK_NAME }`
(one import line and one export line, no second declaration of any name), so every importer of
`release-merge.mjs` keeps its import line: `release-merge.test.mjs`, `delivery-train.test.mjs`,
`delivery-train-after.test.mjs`, `release-tags.test.mjs`, `change-loop-compozy.test.mjs` (its
`pinsIn`) and `conduct-check.mjs` (its `PIN_FILE`). Staying in `release-merge.mjs`: `resolveVersion`,
`manifestEditsBeyondVersion` and `diffPaths`, `parseChangelog` and `resolveChangelog`, `mergePins` (it
writes a temporary folder and runs `git merge-file`; only the step and the join use it; its mask
`MASK = '0.0.0'` stays a local constant), the roadmap ticks, `classifyConflict`, the new
`numberRelease` (D-6) and `main`. The new functions of D-1 to D-5 (`parseReleaseNote`,
`releaseNoteHash`, `releaseFacts`, `changeAdrs`, `computeRelease`, `changelogEntry`, `releaseState`,
`maskRelease`, `releaseOnlyEdit`) are written in `deliver-check.mjs` with `node:` imports only;
`release-merge.mjs` imports the ones `numberRelease` uses.

Rejected: a copy of the helpers in each file held equal by a test, as `TRAIN_PIN_FILE` is (ten
names and their bodies to keep equal by hand); importing `release-merge.mjs` from `deliver-check.mjs`
(the consumer failure above); a fourth download (every consumer's workflow file would change, and an
older one would fail). Three tests hold the boundary (D-15, "boundary"), the same in intent as before
the base moved: the re-exported names are the same objects on both modules (`pinsIn` and `setPins`,
re-exported today and checked by "archive-release-pin 10", plus the seven public names moved here);
`deliver-check.mjs`'s source names no relative module but `./guard.mjs` and `./merge-setup.mjs`; and
`deliver-check --ci` and `guard.mjs ci`, run from the three downloaded files alone in a project that
names `devkit.release_tag`, read a noted change after its step's commit with no module error (the
existing download tests, T-20 of `merge-setup.test.mjs` and "archive-release-pin 9" of
`deliver-check-archive.test.mjs`, cover a change with no note and an archive).

### D-4 The unnumbered ADR and its citations

A noted change names its ADR `<dir>/<slug>.md` (`<slug>` the change id, `<change-id>-<topic>` for
more) and cites it `ADR [<slug>]`; `decisions.md` lists that path and is never edited. Citation forms
rewritten, in every tracked text file (`git grep -I`) outside `openspec/changes/` (every change folder
and the archive: another change's plan files stay as approved): `ADR [<slug>]` to `ADR <NNNN>`, and
`<slug>.md` not preceded or followed by a letter, digit, `_` or `-` to `<NNNN>-<slug>.md` (covers
`docs/adr/<slug>.md`, `adr/<slug>.md` links and `(<slug>.md)` header references). A foreign slug that
has landed on the base is rewritten to its number too (AC-7). Refusals (exit 2, merge undone): a slug
another file of `ADR_DIRS` already has (`a second ADR with the slug <slug>: <paths>`) and an unlanded
citation (`ADR [<x>] is cited but has not landed on <base>; it lands with its own change`). The ADR's
own `Change:` line resolves the citations left in the change folder after the merge.

### D-5 The release edit, which stales nothing

`maskRelease(text, path, map)` masks, symmetrically: JSON manifests and the release file without their
version fields; `PIN_FILE` with `setPins(text, '0.0.0')` (the mask `pinLinesOnly` uses, ADR 0027); in any text, `ADR <NNNN>` to `ADR [<slug>]`
and `<NNNN>-<slug>.md` to `<slug>.md` for every numbered ADR of `ADR_DIRS` at the later revision
(`map`, memoized per revision). `releaseOnlyEdit(root, before, after, path)` is true for
`CHANGELOG.md` and `docs/catalog.md`, for a path whose two texts mask equal, for an added
`<dir>/<NNNN>-<slug>.md` whose text masks equal to `<dir>/<slug>.md` before, and for that unnumbered
path deleted when its numbered form is added. `staleness` gains the option `release` (a predicate
from `releaseFacts`, null for an old-rule change or without the setting): a touched path it accepts
counts as not touched, in a plain commit (amends ADR 0025 decision 3 and modifies the change-delivery
requirement "A plain commit on the branch keeps its rule": a release edit of a noted change, the
step's commit included, is a release-class edit, not a plain commit; see Flagged) and in a merge
(against the first parent, so a base edit to an own file still stales, ADR 0025 decision 2).
`tasksItem`, `acceptanceItem`, `readReviews` (approved or declined verdicts only; a rejected one keeps
its rule) and `collectFlow` in `flow-check.mjs` pass it. `trainCheck`'s `allowed` also accepts a path
`releaseOnlyEdit` accepts between the auto-merge tree (or the parent) and the commit, and its message
keeps the substring `release files, the CI pin, \`openspec/roadmap.md\` and` the record.

### D-6 The step: `release-merge.mjs --assign --base <base> [--json]`

The usage grows to `--base <base> [--roadmap-ticks] [--json] | --assign --base <base> [--json] |
--merge <rev> [--json]`. One core, `numberRelease(root, { side, target, note, adrs })`, serves
`--assign` (`side` the head, `target` `origin/<base>`) and the noted `--merge` (D-7):

1. Preflight as `--base` (exit 3: no `origin/<base>`, a rebase, tracked edits outside `openspec/`;
   a merge left in progress is aborted). The noted change is the one folder under `openspec/changes/`
   (not `archive/`) whose `release.md` the side added or changed since the merge base; none or two is
   exit 2 with the reason. `releaseState` of the side must be `unassigned` or `assigned` (else exit 2,
   `release lines edited by hand: <paths>`); a malformed note is exit 2 with the reader's message.
2. When `target` is not an ancestor of the head: `git merge --no-ff --no-commit <target>`. For each
   path the side changed outside `openspec/changes/` whose text holds assigned tokens, the merged text
   is `git merge-file` of the merge base, `maskRelease` of the side's text and the target's text (in a
   temporary folder it removes, as `mergePins` does); a conflict there, or a conflict in any path that
   is not a release line, undoes the merge (`restore`) and exits 2 naming the paths. The paths
   `RELEASE_FILE` matches (pack manifests, the marketplace, `CHANGELOG.md`, `docs/catalog.md`) keep
   the target's side; `PIN_FILE` is not one of them: its text takes the masked three-way merge above
   (pins masked with `setPins`), so its prose edits from both sides are kept and step 3 writes its
   pins.
3. Write the lines of `computeRelease(target)`: manifests by `resolveManifest` from the target's text,
   `CHANGELOG.md` by `changelogEntry` on the target's text, the pins by `setPins` (the one pin
   definition ADR 0027 put in `deliver-check.mjs`; T-6 checks them against the manifest, ADR 0030;
   the archive check's pin-line rule is not involved: this is the change's branch), the release file's
   version, `gen-catalog.py` when it exists and a manifest changed, each ADR by `git mv` to its number
   with `ADR [<slug>]` and `<slug>.md` rewritten in it, then the citations (D-4).
4. Commit: `chore(release): merge origin/<base> and assign the release of <id>` (a merge) or
   `chore(release): assign the release of <id>` (a plain commit); nothing to write is exit 0 with no
   commit. Never push. JSON adds `mode: "assign"`, `change`, `adrs` (`{ from, to }`), `citations`
   (paths) to the existing fields. Any failure after the merge started restores the tree (exit 2).

### D-7 The join of a noted head: `--merge <rev>`

`--merge` finds the noted change of `<rev>` as in D-6 step 1. A head with no note goes through the
existing path unchanged (AC-10). A noted head: `git merge --no-ff --no-commit <rev>` into the train
tip; the `RELEASE_FILE` paths keep the train's side (`--ours`) and `PIN_FILE` takes the masked
three-way merge of D-6 step 2; a head that was assigned by `--assign` (state
`assigned`, possible only by the bootstrap of D-17) has its tokens unmasked through the three-way merge
of D-6 step 2; then D-6 step 3 with `target` the train's tip, so the first boarded takes the next
numbers and the next one numbers above it (AC-3). The commit message stays `chore(train): join <rev7>
and renumber its release above the train` (pinned by `delivery-train.test.mjs`). Exit 2 cases (hand
edit, duplicate slug, unlanded citation, a conflict outside release lines) take the change off the
train through `build`'s existing `left` path with the JSON's `error` as its detail; `train-loop.mjs`
does not change. A head taken off for an unlanded citation boards again after the cited change lands
(its `rejoin-train` merges the base, which then numbers the citation).

### D-8 The delivery rows

`collectState` adds `state.release = releaseFacts(...)`. `nextStep`, first match wins inside each place:

| # | Where | Condition | `next.step` |
|---|---|---|---|
| A1 | the existing `stop-plan-approval` row | a readiness schema, readiness `APPROVED`, and `approval.ok` false because the note's hash differs from the recorded one (D-9), whether or not a task is ticked | `stop-plan-approval`, reason `release note changed after approval`, fields `readiness`, `release`, `file` |
| N1 | right after the `commit` row (every task ticked) | the note cannot be read, or `computeRelease` fails | `blocked` `release.md: <field>: <why>` |
| N2 | same place | old-rule, and the branch changes a file under `plugins/<dir>/` of a pack whose manifest version equals its merge base's, or `decisions.md` lists an unnumbered ADR | `blocked` `no release: <pack dirs or ADR path> ...` |
| N3 | same place | noted, state `hand` | `blocked` `release lines edited by hand: <paths>` |
| N4 | same place, no train | noted, an unlanded citation | `blocked` `ADR [<x>] is cited but has not landed on <base>` |
| N5 | the item 5 rows, no train | noted, and item 5 is blocked only for a conflict with the base or open only for being behind it | `assign-release` (in place of `update-branch` or of the conflict stop, `blocked` with `item: 5` and `conflict: true`) |
| N6 | before `enable-auto-merge`, `wait-merge`, `ready` and `ready-base`, no train | noted, and the state is not `current` | `assign-release` |
| N7 | anywhere | the state cannot be computed (no `origin/<base>`) | `blocked` with that reason |

`assign-release` carries `number`, `base`, `branch`, `reason` and `command` (`['node', <path of
release-merge.mjs next to deliver-check.mjs>, '--assign', '--base', <base>, '--json']`). In a train
project only N1 to N3 apply and the T rows follow as today; N4 is the join's (D-7). In `merge` mode
an auto-merge left on when the base moved is disabled first by the existing row, because GitHub then
reports the branch behind. `--ci` is unchanged except for D-5's predicate.

### D-9 The approval covers the note

`approvalState(dir)` adds `release` (`releaseNoteHash(dir)`) and `recordedRelease` (the value of a
`- Release note:` line of `approval.md`) only when either is non-null, so the object of a change with
no note keeps its keys (pinned by `deliver-check.test.mjs` and `flow-check.test.mjs`); `ok` also
requires the two to be equal. `nextStep`'s `stop-plan-approval` carries `release`. The `ship-change`
row for `stop-plan-approval` adds the line `- Release note: <next.release>` after `- Readiness:` when
`next.release` is set; `approvalText` gets an optional `release` and writes that line only when given,
and `recordApproval` passes it. The loop's `waiting-approval` and `waiting-approval-again` details add
`release` beside `readiness`. `flow-check.mjs` needs no other change: from the implementation on the
loop follows `deliver-check`'s row, and before it the approval stage reads `approval.ok` through the
loop's facts. This replaces the requirement's comparison with `release.md` at `approval.md`'s
`commit=`, which names a commit that holds no plan file (Context; Flagged).

### D-10 The loop and the conductor

`conduct-check.mjs`: `MAIN` gains `assign-release`; `deliveryRow` skips `releaseConflict` for a
noted change (its conflicts are the step's), and `adrClash` leaves out, for a noted change, every
`<dir>/<NNNN>-<slug>.md` whose slug its `decisions.md` lists unnumbered (those numbers are the
step's); a numbered ADR a noted change lists keeps the old rule; `ADR_DIRS` re-exported from
`deliver-check.mjs`. `change-loop.mjs`: `ROWS['assign-release']
= session('delivery')` (not in `SKILL_LOOP_STEPS`; its dispatch is the `ship-change` row, which the
CompozyOS view already names for a session step); `decisionRecords` resolves a listed
`<dir>/<slug>.md` that is missing to the single `<dir>/<NNNN>-<slug>.md` (two or more: unreadable,
naming them). `ship-change` gets the row: `git fetch origin <next.base>`, run `next.command` in the
change's worktree; exit 0: `git push origin <next.branch>` (plain, never a force push), then the loop
again; exit 2: stop `blocked: item 5 (<the JSON's error or conflicts>)`. The `devkit` skill's Loop
bullet for `session` adds: an `assign-release` exit 2 is declared with `... reply blocked --param
id=<id> --param why=pr-problem ...`, shown with the JSON's `error`, and ends the run. The new text
avoids the word that test 16 of `change-loop-compozy.test.mjs` forbids in the skill.

### D-11 The planner's failure and who sees it

The stage agent that can fail to deliver the note is the `change-planner`. The hook that sees it is
`guard.mjs subagent-stop`, through `subagentStopFor` in `change-loop.mjs` (also the roadmap path).

Where the check sits: `subagentStopFor` computes `next` and `stage`, then returns `allow('delivered')`
as soon as the next stage is not one of the stopping role's stage files. After the planner writes
`tasks.md` with its header set, the next stage is `readiness` (another role), so that return is
exactly the state the check must see. The check therefore runs right before that return, inside its
condition: when the condition holds, the role is `change-planner`, `releaseTagOf(found.root)` is not
null (`deliver-check.mjs` exports it from this change on; a bad setting throws, and
`subagentStopFor`'s callers let a throwing stop through, as today) and the change's `tasks.md` exists, it reads `release.md` with `parseReleaseNote`; a missing file
or an `{ error }` returns `refuseOnce(input, key, 'no-release-note', change, reason)`, and anything
else falls through to `allow('delivered')` as today. While one of the planner's own stage files is
still missing or pending, the existing `no-file` and `UNDELIVERED` refusals come first, unchanged.

The key: `release-note/<missing|malformed>@<facts.fingerprint ?? ''>`, the same fingerprint the
existing keys use, so a second stop in the same state finds the recorded key and goes through
(`same-state`), and a stop after the planner changed the plan or the note (a new fingerprint, or
`missing` turned `malformed`) is refused once again. The reason: `openspec/changes/<id>/release.md does
not exist: write the release note (packs:, the changelog title and body) before you stop`, or
`openspec/changes/<id>/release.md cannot be read: <the reader's message>`. The files the agent leaves
are `proposal.md`, `specs/`, `design.md` and `tasks.md` without a readable `release.md`. The readiness
review (the `plan-readiness-review` skill names the check) and N1 or N2 at delivery are the later
checks. The `adr-author` writing a numbered ADR in a noted change is no failure the flow must
catch: that record follows the old rule (`adrClash` and `renumber-adr` still apply to it, D-10), and
the readiness review flags it.

### D-12 `scripts/check.py`: `check_adrs`

For `docs/adr` and `docs/decisions`: a numbered record is `NNNN-<slug>.md`; an unnumbered record is a
`.md` whose name has no `NNNN-` prefix and whose first non-blank line starts `# ADR [`; other files
(`README.md`) are ignored. Problems: two records with one slug across both folders; an unnumbered
record not listed in an `- ADR:` line of an active `openspec/changes/<id>/decisions.md`; an unnumbered
record on the base. Base or branch, first match wins: `GITHUB_HEAD_REF` set: base when it is
`train/<n>`, else branch (a pull request's head); the checked-out branch is the default branch
(`origin/HEAD`'s target, else `main` or `master`): base; `HEAD` is an ancestor of `origin/<default>`
or the local default branch: base; otherwise (a change branch, or a detached merge ref with no default
ref, as in CI's `check` job and in the suite's runs of `check.py`): branch. A `--root` that is not a
git repository is the base. A fresh branch at the base's tip with an uncommitted ADR reads as the base.

### D-13 Texts

- `docs/openspec-flow.md`: a "The release note" paragraph in "The delivery contract" (D-1, D-3, D-8
  rows A1, N1 to N7); `assign-release` in the conduct-check main-session list and the merge-mode step
  table; `--assign` and the noted join in "Release-file conflicts: `release-merge.mjs`"; the own-files
  paragraph gets one sentence on D-5 after its present phrases; "The delivery train" and the CI section
  get the numbering (the substring D-5 names is kept); the release paragraph "While a change is in
  delivery, every merge of the base that brings one of its own files ..." keeps that phrase and says
  a noted change takes its numbers from `assign-release`. No `v<x.y.z>` on a pin-marker line outside
  `## CI`; the strings test 16 of `change-loop-compozy.test.mjs` pins stay. Not edited: the P13 row,
  "The file check (P13, AC-3)" paragraph and the "Classification." bullet that "archive-release-pin
  11" asserts (T-41: the pin-line rule of ADR 0027 and ADR 0030 stays as written), and the CI pin
  lines themselves (a branch writes no pin; the step and the join do, D-6, D-7).
- `CONTRIBUTING.md` step 5 keeps its first words ``5. Bump the `version` `` and the six parts
  `release-tags.test.mjs` pins, and says: a change with a note edits no release line; the delivery
  writes them, the CI pins of `docs/openspec-flow.md` included; a change opened before keeps the old
  rule (the rest of today's step 5, its last sentence included: a release moves the flow page's CI
  pins and no test, ADR 0030).
- `openspec/config.yaml`: the Conventions line; the `tasks` rule (quoted): a change with a note never
  bumps a version or numbers an ADR, and an old-rule change keeps "the next free number on origin/main
  at the last merge before review"; the `ADRs:` list gains the entry `ADR [release-at-merge] <subject>,
  amends 0022 and 0025` after its last entry (the step rewrites the token to `ADR <NNNN>`, D-4),
  leaving every existing entry as it is (the 0003, 0018, 0019, 0027 and 0030 substrings T-41, T-44
  and the ADR tests assert).
- `plugins/core/agents/change-planner.md`: write `release.md` with the plan where the project names
  `devkit.release_tag`; cite ADRs `ADR [<slug>]`, name no number or version; the stop hook refuses a
  stop without the note. `adr-author.md` and `skills/adr-authoring/SKILL.md`: in such a project name
  the record `docs/adr/<slug>.md`, title `# ADR [<slug>]: ...`, no number, a project with no ADR folder
  gets `docs/adr/` with the unnumbered record; in a project that names no `devkit.release_tag` the
  numbering stays as today (the next free number; `docs/adr/` with 0001 when there is no folder).
  These edits keep what D-14's T-23 to T-26 and T-29 assert: the three folder names, `Outcome: failure`
  and `docs/adr/` in both files, the frontmatter, Outcome line, five headings and Never list of
  `adr-author.md`, the `adr-authoring` body pins, the planner's records sentence verbatim and every
  writer's stage-header sentence; no agent's frontmatter changes (T-38). `adr-reviewer.md`: accept the unnumbered form and the
  `ADR [<slug>]` citation before the delivery. `tdd-implementer.md`: in a change with `release.md`
  never edit a version, a CHANGELOG line, a CI pin or an ADR number (its apply-proposals line stays:
  an archive has no note). `skills/plan-readiness-review/SKILL.md`: the note exists and reads, no task
  bumps or numbers, the "next free number" sentence scoped to old-rule changes. Then
  `gen-agents.mjs` regenerates `plugins/compozy/skills/compozy-setup/templates/agents/*/AGENT.md`.
- ADR 0022 and ADR 0025 each get `- Amended by ADR [release-at-merge] (release-at-merge.md)` and a
  dated `Note (release-at-merge, <date>)` saying what is amended, as ADR 0002 has; the delivery
  numbers both forms. ADR 0003, ADR 0027 and ADR 0030 are built on, not amended (`ADR
  [release-at-merge]`'s Builds-on line and decision 7): no file of them is edited, so ADR 0003's
  first nine lines stay as "archive-release-pin 11" reads them (T-41).

### D-14 The existing tests this change alters or must keep green

Grep run at the plan base for each altered text, step, constant and ADR behaviour (`renumber-adr`,
`resolve-release-conflict`, `next free`, `RELEASE_FILE`, `ADR_DIRS`, `ADR_FILE`, `approvalState(`,
`approvalText`, `chore(train): join`, `release files, the CI pin`, `5. Bump the`, `docs', 'adr'`,
`check.py`, `stop-plan-approval`, `tag-release`), and run again at `66a27b1` for the files D-13 and
D-3a change: every reader of `plugins/core/agents/{change-planner,adr-author,adr-reviewer,
tdd-implementer}.md`, `plugins/core/skills/{adr-authoring,plan-readiness-review}/SKILL.md`,
`plugins/openspec/skills/{ship-change,devkit}/SKILL.md` (`ship-change`, `skillText`, `'devkit',
'SKILL.md'`, `core', 'agents'`, `agents/${`), and every importer of a moved name (`from
'./release-merge.mjs'`, `TRAIN_PIN_FILE`, the download set). Every row's suite is its own file under
`node scripts/test-suite.mjs`. T-20 to T-40 are the rows the second grep added; each one's
`Change` column says what the new text must keep. A third grep, at `ba3126b`, ran the same strings
plus `pinsIn`, `setPins`, `PIN_FILE`, `PIN_LINE_FILES`, `pinLinesOnly`, `Amended by`, `ADRs:`,
`openspec-flow.md` and `CONTRIBUTING` over every file train 4 changed (`docs/openspec-flow.md`,
`CONTRIBUTING.md` step 5, `openspec/config.yaml`, `docs/adr/0003-*.md`,
`deliver-check-archive.test.mjs`, `release-merge.test.mjs`, `change-loop-compozy.test.mjs`,
`deliver-check-fixtures.mjs` and the `fixtures/c561553/` flow pages); it re-stated T-6, T-12, T-21 and
T-22 and added T-41 to T-44. No test train 4 added asserts a sentence D-13 changes: no test reads
CONTRIBUTING step 5's pin sentence, and the fixtures build their own flow pages.

`change-loop-compozy.test.mjs` is not edited. Its pin test ("change-loop docs: the design records the
answers", T-6) no longer asserts a literal: it reads devkit-openspec's version from the manifest
(ADR 0030), so it stays green on every branch of a noted change (no pin and no version moved) and
after the step's commit (the step writes the pack's version and the pins together, D-3). The other
assertions of that file this change must keep green, none of them edited, are T-5, T-7, T-19 and T-22
to T-28.

| Id | File, test | Invariant | Layer | Change |
|---|---|---|---|---|
| T-1 | `guard.test.mjs`, "ADR 0006 supersedes ADR 0005 ..." and "ADR 0008 records the reviewer round ..." | no two ADRs share a number | repository records | count only names matching `^\d{4}-`: an unnumbered `docs/adr/<slug>.md` has no number, and two such names would share their first four letters |
| T-2 | `deliver-check-cli.test.mjs`, "format: ship-change names every next.step the checker can return" | every step `nextStep` emits has a `ship-change` row | skill text | none; requires the `assign-release` row |
| T-3 | `change-loop.test.mjs`, the scan of returnable steps against `ROW_STEPS` | every returnable step has a loop row and no row is dead | loop table | none; requires `ROWS['assign-release']` |
| T-4 | `change-loop.test.mjs`, "the loop's step agents match conduct-check's actorOf" | loop and conductor agree on actors | loop and conductor | none; `assign-release` is a session step and `main` |
| T-5 | `change-loop-compozy.test.mjs`, "release-merge-conflict 16" | flow-doc strings and the skill's release-conflict sentence; no forbidden word in the skill | docs | none; D-13 keeps them |
| T-6 | `change-loop-compozy.test.mjs`, "change-loop docs: the design records the answers" | every CI pin of the flow page names the devkit-openspec version its manifest holds (`pinMismatches`, no literal; ADR 0030) | docs | none: a noted branch moves neither the pins nor the version, and `computeRelease` sets the pins to the new devkit-openspec version in the same commit as the manifest (D-3, D-6 step 3); task 8.1's dogfood is checked by it |
| T-7 | `change-loop-compozy.test.mjs`, "every hand-off step of the delivery rows carries its dispatch sentence" | the list of hand-off steps | CompozyOS view | none; `assign-release` is not a hand-off |
| T-8 | `release-tags.test.mjs`, "release-tags 4: CONTRIBUTING and the flow page describe the key and the step" | step 5's prefix and six parts, rows R1 to R3 and P0, no literal pin outside `## CI` | docs | none; D-13 keeps them |
| T-9 | `delivery-train-after.test.mjs`, "delivery-train docs: the documents follow" | the CI sentence on the train's own commits, the train subsection, one `ship-change` row per train step | docs | none; D-13 keeps the substring |
| T-10 | `delivery-train.test.mjs`, "delivery-train join: a change with no release file merges ..." and the other join tests | the join's message and old-rule numbers | release-merge `--merge` | none (AC-10) |
| T-11 | `release-merge.test.mjs`, every `release-merge` and `release-merge pin` test, "a missing origin/<base> and an unknown option are setup errors" | `--base` as today, exit 3 on an unknown option | release-merge | none (AC-9, AC-10) |
| T-12 | `deliver-check-archive.test.mjs`, "release list: RELEASE_FILE is unchanged and unnamedFiles still reports docs/openspec-flow.md (AC-7)" | `RELEASE_FILE` does not hold the flow page; `unnamedFiles` names it unless only its pins moved (ADR 0027) | archive check | none: `RELEASE_FILE`, `unnamedFiles` and `pinLinesOnly` are not touched |
| T-13 | `deliver-check.test.mjs` (`approvalState` and the `approval` JSON) and `flow-check.test.mjs` (`approvalState`) | the approval object of a change with no note | checker | none: D-9 adds keys only with a note |
| T-14 | `deliver-check-cli.test.mjs`, "own-files AC-9 docs" | the own-files paragraph's phrases | docs | none; D-13 appends after them |
| T-15 | `conduct-check.test.mjs`, the `upfront AC-11 adr` tests and the `release-merge-conflict` and `conduct pin` tests | `renumber-adr` and `resolve-release-conflict` for changes with no note | conductor | none (AC-10) |
| T-16 | `guard.test.mjs`, "ship-change SKILL.md pins the stop-plan-approval row ..." | the approval row's owner rule and `next.readiness` | skill text | none; the row only gains the note line |
| T-17 | `guard.test.mjs`, "config.yaml rules: no list item is an unquoted string holding ': '" | rules stay YAML strings | config | none; the new `tasks` rule is quoted |
| T-18 | `version-pin.test.mjs`, "version-pin AC-7 check: the tree's flows pass" | `check.py` passes on the repository | `check.py` | none; D-12 tolerates the branch's ADR |
| T-19 | `change-loop-compozy.test.mjs`, the `recordApproval` and `approvalText` tests | the approval text of the CompozyOS record step | loop | none: the line is written only with `release` |
| T-20 | `merge-setup.test.mjs`, "workflow (the setup template): deliver-check --ci and guard.mjs ci run from only the files the template downloads" | a consumer's job runs from `guard.mjs`, `deliver-check.mjs` and `merge-setup.mjs` alone, with no module error | consumer CI download set | none; D-3a keeps `deliver-check.mjs` free of `release-merge.mjs`, and the new boundary test of the same file covers a noted change |
| T-21 | `delivery-train-after.test.mjs`, "delivery-train P11: TRAIN_PIN_FILE is the pin file release-merge rewrites" | `TRAIN_PIN_FILE` equals `release-merge.mjs`'s `PIN_FILE` and `docs/openspec-flow.md` | module boundary | none; `TRAIN_PIN_FILE = PIN_FILE` in `deliver-check.mjs`, `PIN_FILE` re-exported by `release-merge.mjs` (D-3a) |
| T-22 | the importers of moved or already re-exported names: `release-merge.test.mjs` (its import line, which names `pinsIn`, `setPins`, `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, `bumpKind`, `applyBump` and `resolveManifest`, and every `release-merge` and `release-merge pin` test), `delivery-train.test.mjs` and `delivery-train-after.test.mjs` (`release.*`), `release-tags.test.mjs` and `change-loop-compozy.test.mjs` (`pinsIn`; "release-merge-conflict 15"), `conduct-check.mjs` (`PIN_FILE`) | a moved name stays importable from `release-merge.mjs` and behaves as before | module boundary | none; D-3a re-exports each name, the bodies unchanged |
| T-23 | `change-loop-compozy.test.mjs`, "stage-roles roles agent adr-author: frontmatter names its model, tools and skills", "...: it returns its Outcome line and starts from the stage header rule", "...: its Never list holds its limits" | `adr-author.md`'s model `opus`, its tools and `adr-authoring`, `Outcome: proposed <n> \| none-needed \| failure — <summary>`, the `decisions` stage header, the five headings, a Never list matching `accepted record`, `outside the ADR folder`, `accepted` | agent text | none; D-13 edits the Method's ADR-folder step only and keeps frontmatter, Outcome line, headings and Never list |
| T-24 | `change-loop-compozy.test.mjs`, "stage-roles roles agent: the ADR author says what it does when the project's folder is not one it may write" | `adr-author.md` and `adr-authoring/SKILL.md` name the three folders, `Outcome: failure` and `docs/adr/` | agent and skill text | none; D-13's no-folder sentence (unnumbered with the setting, 0001 without) keeps all three |
| T-25 | `change-loop-compozy.test.mjs`, "stage-roles roles skill adr-authoring: its description says when to use it and its body holds the method" | the skill's `Use when` description and its body pins (`hard to reverse`, the status line, `Context, Decision, Consequences`, amend or supersede, `not-applicable`) | skill text | none; D-13 adds the unnumbered-record paragraph only |
| T-26 | `change-loop-compozy.test.mjs`, "stage-roles roles planner: change-planner leaves the records to the ADR author" | the planner's records sentence, verbatim | agent text | none; D-13's note and citation sentences are added beside it, that sentence untouched |
| T-27 | `change-loop-compozy.test.mjs`, the `change-loop skill:` tests (frontmatter, language, heredoc, the release-conflict sentence, the script rule, the owner's answers, one stage per hand-off, "an end the session declares goes through reply ... (F1)", the review sentence, the background wait, the grill paragraph, the sections, the CompozyOS section, the replies not yet shown, "what the session writes itself ... (AC-11)") and "upfront AC-5 skill: the grill skill and the devkit skill hand the triage ..." | the `devkit` skill's Loop, Never and section texts | skill text | none; D-10 adds one sentence to the `session` bullet, declared through `reply blocked` (F1 holds), with no internal term shown (AC-11 holds) and no `rebase` or `--force` (T-5) |
| T-28 | `change-loop-compozy.test.mjs`, "change-loop compozy view: the dispatch line of a step is its ship-change row, the devkit skill's Loop bullet, or nothing" and "... the review step, the gate step and the session steps map as the table says" | a session step's CompozyOS brief says "as the `ship-change` row of that name says"; the listed agent steps keep their dispatch lines | CompozyOS view | none; `assign-release` is a session step like `enable-auto-merge` and is in neither list |
| T-29 | `flow-check.test.mjs`, "flow-check AC-3: every writer of a stage file names the stage header" | the `ship-change` rows `stop-plan-approval`, `review`, `retro`, `stop-retro-answers` name `<!-- devkit-stage` and their stage; `change-planner.md` names the header and `proposal` | skill and agent text | none; D-9's line is written inside the `stop-plan-approval` row, which keeps its header text; D-13 keeps the planner's header sentence |
| T-30 | `deliver-check-cli.test.mjs`, "format: ship-change skill exists, says \"Use when\", and its deliver-check path resolves" | the skill's frontmatter and its `../../hooks/deliver-check.mjs` path | skill text | none; the new row runs `next.command`, which names its own path |
| T-31 | `deliver-check-cli.test.mjs`, "AC-6 instructions-follow: configs, ship-change, devkit, flow doc and READMEs name evidence before review" | no text names the review before the evidence (`OLD_ORDER`); the Mode paragraph names `pr-verifier` before `review-change` | skill and doc text | none; the new rows, sentences and paragraphs use no `OLD_ORDER` phrase and leave the Mode paragraph |
| T-32 | `deliver-check-cli.test.mjs`, "format: ship-change enables auto-merge with one exact command, only at enable-auto-merge, and disables it at disable-auto-merge (AC-2, AC-3, AC-8)" | `gh pr merge` only at `enable-auto-merge` and `disable-auto-merge`; the `update-branch` row's command | skill text | none; the `assign-release` row runs `git fetch`, `next.command` and `git push origin <next.branch>`, never `gh pr merge`; the `update-branch` row is not edited |
| T-33 | `deliver-check-archive.test.mjs`, "format: ship-change archive rows name the commands ...", "format: ship-change reused merge rows say next.number is the archive PR ...", "format: ship-change Start takes the id from a chore/archive-<id> branch, Stops, Never and Hosts cover the archive", and "commit-attribution AC-1 T33" to "T36" | the archive rows, the four reused merge rows naming the archive PR, Start, Stops, Never, Hosts and the Attribution section | skill text | none; the `assign-release` row is a new row beside `update-branch` (an archive has no note, so it names no archive PR), and none of those rows or sections is edited |
| T-34 | `change-loop-remote-state.test.mjs`, "commit-attribution AC-1 T16" to "T19" (the `devkit` skill's `agent` lines) and "T20 the request, the ship-change skill and the agent share one block format" | the `agent` bullets name the attribution block; `ship-change`'s Attribution section up to `## Loop` holds the block | skill text | none; D-10 edits the `session` bullet, not an `agent` bullet, and the Attribution section is untouched |
| T-35 | `delivery-models.test.mjs`, "delivery-models docs: the documents follow" | exactly one `ship-change` row for each two-prs step, `ready-base` included; the flow page's delivery-models phrases | skill and doc text | none; N6 names `ready-base` in `docs/openspec-flow.md` but adds no second `ready-base` row |
| T-36 | `guard.test.mjs`, "stage-roles gates: the stop-mockup-approval row comes after stop-plan-approval and is written only from the owner's own message" and "stage-roles gates: the devkit skill names the mock-up among the owner's gates and the accept-decisions step" | the `stop-mockup-approval` row is the line right after `stop-plan-approval`; the `session` bullet names `accept-decisions` | skill text | none; D-9's `- Release note:` text goes inside the `stop-plan-approval` row's own table line, so no line comes between the two rows; the `session` bullet keeps `accept-decisions` |
| T-37 | `roadmap-loop-followups.test.mjs`, "followups AC-15 next: a start that gave no session id is reported as session-refused ..." | the `devkit` skill's sentence "when the call returns anything but a session id (...)" | skill text | none; the Roadmap section is not edited |
| T-38 | `project-loop.test.mjs`, "project-loop schema: the agents of the shipped roles list exactly their stages' skills ..." | each core agent's frontmatter `skills:` equals its stage's skills | agent frontmatter | none; D-13 changes no frontmatter of `change-planner`, `adr-author`, `adr-reviewer` or `tdd-implementer` |
| T-39 | `release-tags.test.mjs`, "release-tags 3: ship-change has the tag-release row, its report line and its never line" and "release-tags 3: the devkit skill declares a stopped tag-release as an archive-failed end" | the `tag-release` row, Report and Never lines; the `session` bullet's `tag-release` sentence with `why=archive-failed` | skill text | none; the `assign-release` sentence is added to the `session` bullet before the `tag-release` sentence, which stays as it is |
| T-40 | `change-loop.test.mjs`, "change-loop brief: names the role, the change and the stage and holds no skill text" | no brief holds a line of its stage's skills | loop briefs | none; the lines D-13 adds to `plan-readiness-review/SKILL.md` and `adr-authoring/SKILL.md` are not brief text |
| T-41 | `deliver-check-archive.test.mjs`, "archive-release-pin 11: the flow page, ADR 0003 and the config state the pin-line rule" | the P13 row and "The file check (P13, AC-3)" paragraph name the flow page and ADR 0027 and ADR 0030, not the pin test; the "Classification." bullet lacks "and the ADR 0003 exemption, do not change"; ADR 0003's first nine lines hold its 0027 and 0030 "Amended by" lines and its archive-release-pin Note; ADR 0027 names ADR 0030; the `ADRs:` line holds the 0027 and 0030 entries | docs and records | none: D-13 edits none of the P13 row, that paragraph, that bullet or ADR 0003 (built on, not amended), and adds the config entry after the last one |
| T-42 | `release-merge.test.mjs`, "archive-release-pin 10: release-merge.mjs re-exports the one pin definition of deliver-check.mjs, which never imports release-merge.mjs" | `R.pinsIn === D.pinsIn`, `R.setPins === D.setPins`, no import of `release-merge` in `deliver-check.mjs`'s source, `D.PIN_LINE_FILES` equals `[R.PIN_FILE]` | module boundary | none; D-3a keeps the two re-exports, re-exports the moved `PIN_FILE` with the same value, and leaves `PIN_LINE_FILES` |
| T-43 | `deliver-check-archive.test.mjs`, "archive-release-pin 1" to "9" and "12" | `pinLinesOnly` passes a pin-only flow page and names anything else (a test file included); `unnamedFiles`, the local archive stop and `--ci` (from the three downloaded files too) apply it; the pin test holds no version literal and no change name | archive check | none: `pinLinesOnly`, `PIN_LINE_FILES`, `unnamedFiles` and the pin test are not edited; `maskRelease` calls `setPins` with the same mask and changes neither |
| T-44 | `delivery-models.test.mjs`, "delivery-models docs: the documents follow" (its ADR part, beside T-35's: ADR 0002, 0003, 0010 and 0012 carry ADR 0018's Note and "Amended by" line, and the `ADRs:` line names 0018), `release-tags.test.mjs` "release-tags 4: this repository names devkit-openspec's plugin.json as its release file" and `guard.test.mjs` "ADR 0003 exists with Status: accepted ..." | the existing `ADRs:` entries (0003, 0018, 0019) and the ADR 0003 header and body | records and config | none: the new `ADRs:` entry is appended; ADR 0003 is not edited |

### D-15 The new tests

Every new test is named `release-note <AC-n> <area>: ...`; every env blanks the branch variables
through the file's shared constant; every folder comes from `test-tmp.mjs` with a `devkit-` prefix; no
test reads the repository's history or names this change's ADR file.

| File | Tests (each with its negatives) |
|---|---|
| `release-note.test.mjs` (new) | AC-1: a complete note, the default marketplace, `packs: []`, CRLF, no final newline, and one refusal per field: empty file, no `packs:`, bad list line, bad kind, pack twice, fields out of order, unknown line, no title, no body, unclosed fence; the repository errors (unknown pack, `release:` on a pack manifest, `marketplace:` with no marketplace). AC-2: `unassigned`, `assigned`, `hand` for a version, the changelog, a pin, the release file and a half-numbered ADR. AC-5: `changeAdrs`, the two rewrite forms, folders under `openspec/changes/` untouched, a binary file skipped, `maskRelease` symmetric. AC-6: `check.py` on a branch (tolerated), on `main` and on `train/1` (refused), not listed by a change (refused), two files with one slug (refused), a `README.md` (ignored), a root with no git (base). AC-7: unlanded refused naming the slug, landed rewritten. AC-8: `package.json` written; `CHANGELOG.md` present and absent. AC-9: no key, release file missing, no `docs/adr`. AC-11: no note and no bump refused, `packs: []` passes. AC-14: the documents and agent texts of D-13. Boundary (D-3a): `release-note AC-9 boundary: release-merge.mjs re-exports the moved names as the same objects` (`release.<name> === deliver.<name>` for every name `release-merge.mjs` re-exports from `deliver-check.mjs`: `pinsIn` and `setPins`, re-exported today, and `ReleaseError`, `bumpKind`, `applyBump`, `resolveManifest`, `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME`, moved by D-3a; the test holds that list itself, so the next move of a helper edits the test, not the design); `release-note AC-9 boundary: deliver-check.mjs names no relative module but guard.mjs and merge-setup.mjs` (every `from './…'` and `import('./…')` specifier of its source) |
| `release-merge.test.mjs` | AC-4: `--assign` up to date (one plain commit), behind (one merge commit), again after the base released the same pack (no conflict), two changes in a row; nothing to do (exit 0, no commit); refusals exit 2 with the tree as it was: a conflict in `src/a.ts`, a hand edit, a duplicate slug, an unlanded citation, a malformed note; exit 3 preflights as `--base` |
| `delivery-train.test.mjs` | AC-3: two noted joins of the same pack; two unnumbered ADRs; AC-10: a noted and an old-rule head on one train, in both orders; AC-7: an unlanded citation exits 2 |
| `delivery-train-after.test.mjs` | AC-3, AC-5: `trainCheck` passes a join that numbers an ADR and fails one that also edits a sentence; the departure of two noted changes leaves both boarded heads current at their own heads |
| `deliver-check.test.mjs` | AC-2, AC-11: rows N1 to N3 and N7 (N1 for a malformed field, an unknown pack, `marketplace:` with no marketplace file and `release:` on a pack manifest); AC-7: N4 with no train, none in a train project; AC-12: row A1 with no task ticked and with tasks ticked, a note added after an approval, no note (unchanged); AC-4: N5 in place of `update-branch` and in place of the conflict stop (`blocked`, `conflict: true`), N6 before `enable-auto-merge`, before `wait-merge` (auto-merge on, the branch not reported behind) and before `ready`, never in a train project; AC-4, AC-5: the step's commit leaves evidence and approved reviews current, a commit that also edits a sentence stales them, a rejected review and an old-rule change stale as before |
| `flow-check.test.mjs` | AC-4: the evidence and review stage headers stay passed after the step's commit |
| `conduct-check.test.mjs` | AC-4: `actorOf('assign-release')` is `main`; a noted change in a release-only conflict gets `assign-release`, not `resolve-release-conflict`; a noted change's numbered ADR the base took gets no `renumber-adr`; AC-10: an old-rule change still gets both |
| `merge-setup.test.mjs` | Boundary (D-3a): `release-note AC-9 boundary: deliver-check --ci and guard.mjs ci run from the three downloaded files for a noted change` (the download test's files copied to a `devkit-` folder; a repository with a bare `origin`, `devkit.release_tag`, a noted change whose evidence and approved reviews record R and whose only later commit is the step's: both commands exit as for a met change, `pass` true, no `ERR_MODULE_NOT_FOUND` or `Cannot find module`) |
| `change-loop.test.mjs` | AC-4: the `assign-release` session action and its detail; AC-1: the planner's stop refused once with no note (reason names `release.md`, key `release-note/missing@<fingerprint>`) and with a malformed note (the reader's message, key `release-note/malformed@<fingerprint>`), let through the second time in the same state, refused again after the planner changed a file, let through after the note is written, for another role, while `tasks.md` is missing, and without the setting; AC-5: `decisionRecords` after the numbering (one file; two files unreadable); AC-12: the approval details carry `release`, `approvalText` writes the line only with it |
| `release-tags.test.mjs` | AC-13: the tag asked for a single merge whose release `assign-release` wrote, and for a train's merge commit |

### D-16 The real-run proof

Task 6 runs each case with the worktree's CLIs (`$DEV`) in scratch repositories under a private
`TMPDIR` (`$TMPDIR/devkit-proof-release-at-merge`), each with a bare `origin`, written to
`openspec/changes/release-at-merge/proof/real-run.md` with every command and its output; the folder is
removed afterwards. `gh` has no GitHub remote there: where a row needs pull-request facts, a `gh` stub
on `PATH` answers from a JSON file the case writes (named in the case; no GitHub call is made).

| Case | What runs | AC |
|---|---|---|
| P-1 | single merge, `merge` mode: a noted change with an ADR and citations; `deliver-check` answers `assign-release` last; the session part (fetch, `next.command`, plain push); evidence and reviews recorded before stay current; `enable-auto-merge` next; a sibling noted change merges first: `assign-release` again, no conflict | AC-4, AC-5 |
| P-2 | a train of two noted changes bumping one pack, each with an ADR, through `train-loop.mjs depart`; the record, `deliver-check --ci` on the train, both heads unchanged | AC-3, AC-5 |
| P-3 | an old-rule change (own bump, numbered ADR): `--base` renumbering, `renumber-adr` on a clash, and a join beside a noted change | AC-10 |
| P-4 | a consumer project, `devkit.release_tag: package.json`, root `CHANGELOG.md`; then without `CHANGELOG.md` and `docs/adr`; then naming a file that does not exist | AC-8, AC-9 |
| P-5 | a consumer with no `devkit.release_tag`: same commands, no new step, refusal or file | AC-9 |
| P-6 | refusal: a version edited by hand | AC-2 |
| P-7 | refusal: no release; then `packs: []` passes | AC-11 |
| P-8 | refusal: the note changed after the approval; the session writes `approval.md` with the new hash from `next.release`, and the run goes on | AC-12 |
| P-9 | refusal: an unlanded citation; the cited change lands; the citation is rewritten | AC-7 |
| P-10 | refusal: a duplicate slug; `check.py` on the branch and on `main` | AC-6 |
| P-11 | each malformed field of the note through the checker and the step | AC-1 |
| P-12 | the tag after the single merge of P-1 and after the train of P-2 (`gh` stub serving the merge commits the cases made) | AC-13 |

Task 7 is the conducting session's own part, with the real agents of the worktree
(`claude --plugin-dir <worktree>/plugins/core --plugin-dir <worktree>/plugins/openspec -p`, each run
with the brief `change-loop.mjs next` gives for that stage, in scratch projects opened with the
worktree's `change-loop.mjs open`), written to `proof/agents-run.md` under one `## S-<n> ` heading per
case. It covers every input variant D-13 declares for an agent this change alters: the `adr-author`
(with an ADR folder, with none, without the setting), the `change-planner` (a good note, none, a
malformed one, without the setting), the `plan-readiness-reviewer` (each of the three checks D-13 adds
to its skill) and the `tdd-implementer` (a release line asked of it in a noted change). Project K names
`devkit.release_tag: package.json` and has `docs/adr/0001-start.md`; project K0 is K without `docs/adr/`;
project N is K without `devkit.release_tag`. A case that needs the plan stages done seeds them as
files with passed headers (readiness `APPROVED`, `approval.md` with the note's hash) before the run,
and names what it seeded.

| Case | What runs | AC |
|---|---|---|
| S-1 | K: the `adr-author` on the decisions stage drafts `docs/adr/<slug>.md` with `# ADR [<slug>]` and lists it in `decisions.md` | AC-5, AC-6 |
| S-2 | K: the `change-planner` writes the plan and a `release.md` that `parseReleaseNote` reads; `guard.mjs subagent-stop` lets its stop through | AC-1 |
| S-3 | K, the failure path: with the files S-2's planner left but `release.md` removed, `guard.mjs subagent-stop` with the planner's input refuses once naming the file, lets the second stop through; restored, it lets the stop through | AC-1 |
| S-4 | K0: the `adr-author` creates `docs/adr/` and drafts `docs/adr/<slug>.md` unnumbered, listed in `decisions.md` | AC-5, AC-9 |
| S-5 | N: the `adr-author` drafts `docs/adr/0002-<slug>.md`, numbered as before this change; no file is unnumbered | AC-9, AC-10 |
| S-6 | K, a malformed note: the planner's files with a `release.md` whose bump is `big`; `guard.mjs subagent-stop` with the planner's input refuses once with `release.md:` and the field, lets the second stop through; then the real `change-planner` on a revision brief of that change leaves a `release.md` `parseReleaseNote` reads, and its stop goes through | AC-1 |
| S-7 | N: the `change-planner` writes the plan with no `release.md`; its stop goes through with no refusal; `deliver-check feat --json` gives no row N1 to N7 | AC-1, AC-9 |
| S-8 | K: the `plan-readiness-reviewer` on a seeded plan with no `release.md` writes `readiness.md` with `result=failed` and a finding naming `release.md` | AC-1, AC-14 |
| S-9 | K: the same on a seeded noted plan whose `decisions.md` lists a numbered `docs/adr/0002-<slug>.md`: a finding naming the numbered ADR | AC-5, AC-14 |
| S-10 | K: the same on a seeded noted plan with a task that sets `package.json`'s version: a finding naming the task | AC-2, AC-14 |
| S-11 | K: the `tdd-implementer` on phase 1 of a seeded, approved noted plan whose task 1.1 asks it to set `package.json`'s version returns `Outcome: failure` naming the release line; `git diff` shows `package.json` unchanged and `deliver-check feat --json` gives no row N3 | AC-2 |

### D-17 The bootstrap and the line with `archive-release-pin`

- This change carries `release.md`: devkit-openspec `minor` (a new step, new refusals and a new CLI
  mode), devkit-core `minor` (the planner, the ADR author and the implementer act differently),
  devkit-compozy `patch` (regenerated copies only), `marketplace: minor` (the largest). Its ADR is
  `docs/adr/release-at-merge.md`, unnumbered.
- The approval of this plan records `- Release note: sha256:<12 hex of release.md>` (the installed
  `ship-change` row does not name it yet; the conducting session adds it). Task 1.2 checks it.
- The dogfood (task 8.1), after the last merge of `origin/main` before review: this worktree's
  `node plugins/openspec/hooks/release-merge.mjs --assign --base main --json` assigns the next free
  number on origin/main at the last merge before review to the ADR and the next versions to the packs.
  From then on the branch holds numbers of its own, so `main`'s current train joins it as an old-rule
  change (the requirements' "follows the old rule"). After any later merge of `origin/main`, the same
  command runs again from this worktree, never the installed `resolve-release-conflict` or
  `renumber-adr` (they would renumber the changelog heading but not its per-pack versions, which this
  branch's checker refuses as a hand edit).
- `check.py` tolerates the unnumbered ADR on this branch (D-12) and, after the dogfood, finds none.
- The line with `archive-release-pin` (merged, train 4): that change makes a pin-line rewrite
  acceptable to the archive check (`unnamedFiles` with `pinLinesOnly`, ADR 0027 amending ADR 0003)
  and makes `change-loop-compozy.test.mjs` read the version from the manifest (ADR 0030); this change
  removes the rewrite from every branch (only the step and the join write a pin line) and touches
  neither `unnamedFiles`, `PIN_LINE_FILES`, `pinLinesOnly`, `RELEASE_FILE` nor that test. It builds on
  ADR 0003, ADR 0027 and ADR 0030 and amends none of them (`ADR [release-at-merge]` decision 7): the
  archive check's pin-line rule stays as written, the safety net for archive pull requests (no note)
  and for changes on the old rule, and is removed with the old rule. Nothing waits: no pin assertion
  stands in the way of this change's release (T-6).

## Flagged for the owner

- F-1 (requirements Decision 2, `ADR [release-at-merge]` decision 2): comparing `release.md` "at the
  commit recorded in `approval.md`'s header" cannot work, because that commit holds no plan file
  (Context). D-9 records the note's hash in `approval.md`; the ADR's sentence needs the adr-author.
  The adr-author is revising that wording: the approval records `- Release note: sha256:<hash>`.
- F-2 (ADR 0025 decision 3, "A plain commit on the branch is judged as before"; main's spec requirement
  "A plain commit on the branch keeps its rule"): D-5 amends it for release edits of a noted change.
  The base merges are done (`origin/main` at `a347ac0`, merge `66a27b1`; at `c663f21`, merge
  `ba3126b`), and the change-delivery delta
  now carries that requirement as a MODIFIED block: main's text and both its scenarios verbatim, plus
  the release-edit sentence and the two scenarios of the former ADDED requirement "A release edit
  leaves the evidence and the reviews current", which it replaces. The ADR's Amends line, which named
  decision 1 only, is being revised by the adr-author to name ADR 0025 decision 3 too.
- F-3: the brief named `change-delivery` and `change-coordination`; `delivery-train` (an ADDED join
  requirement) and `reviews-check` (its train-commits requirement would be false) are added too.
- F-4: resolved. `archive-release-pin` has merged (train 4, `c663f21`, in the plan base `ba3126b`):
  the pin test reads the manifest (ADR 0030) and this change edits no pin assertion, so nothing waits
  (D-17) and the task that stopped for it is removed (the dogfood is now task 8.1).
- F-5: citations are rewritten outside every change folder, not only outside this change's, so a
  sibling's approved plan never changes (D-4).
- F-6: AC-9's "with no train" is read as a project with no train and no `devkit.release_tag`; a project
  with the key and no train does get `assign-release` (AC-4).
- F-7: `ADR [release-at-merge]`'s sentence "until then it is `docs/adr/release-at-merge.md`, cited as
  `ADR [release-at-merge]`" will read with the number after the rewrite; the adr-author can word it
  without the tokens.

## Risks / Trade-offs

- [Rewrite hits an unrelated `<slug>.md`] → slugs are change ids, matched as whole tokens, and only
  outside `openspec/changes/`; `releaseOnlyEdit` and `trainCheck` refuse any edit the masking does not
  explain.
- [Masking lets a wrong rewrite through] → masking is symmetric over numbered ADRs only; a citation
  changed to another ADR's number masks to another slug and stales the records.
- [Two rules side by side] → one predicate (`releaseFacts`) decides the rule; AC-10 tests every
  old-rule path unchanged.
- [This change's own delivery on `main`'s old train] → D-17; the coordinator holds `main` at the
  release step (owner's memory: a re-merge costs one to two hours here).
- [A consumer pinned to an older checker] → its `--ci` judges the step's commit as stale until its pin
  moves to this release; the release note says so in `docs/openspec-flow.md`'s CI section.

## Migration Plan

Nothing migrates: open changes keep the old rule; a change moves over only when the owner asks (add
its note, put its release lines back to the base's). Rollback: revert the change's merge; noted
changes then have no step to number them, so revert only with no noted change open.

## Implementation plan

Order: the module boundary (D-3a), then the reader and the state (D-1 to D-5, D-8, D-9) → the step and the join (D-6, D-7) → the loop
and the conductor (D-10, D-11) → the readers and the texts (D-12, D-13) → proof (D-16) → bootstrap
(D-17).

- **Hooks (backend):** `deliver-check.mjs` (D-1 to D-5, D-3a, D-8, D-9), `release-merge.mjs` (D-3a, D-6, D-7),
  `conduct-check.mjs` (D-10), `change-loop.mjs` (D-9 to D-11), `flow-check.mjs` (D-5, one call site).
- **Skills and agents (the "frontend" of a session):** `ship-change`, `devkit`, the core agents and
  skills of D-13, regenerated CompozyOS copies.
- **Repository:** `scripts/check.py`, docs, config, ADR header lines.

Files to create: `plugins/openspec/hooks/release-note.test.mjs`,
`openspec/changes/release-at-merge/proof/{red-2.txt,red-3.txt,red-4.txt,red-5.txt,real-run.md,agents-run.md,dogfood.md}`.
Files to modify: `plugins/openspec/hooks/{deliver-check,release-merge,conduct-check,change-loop,flow-check}.mjs`,
`plugins/openspec/hooks/{deliver-check,release-merge,delivery-train,delivery-train-after,flow-check,conduct-check,change-loop,release-tags,guard,merge-setup}.test.mjs`
(new tests only, except T-1 in `guard.test.mjs`),
`plugins/openspec/skills/{ship-change,devkit}/SKILL.md`,
`plugins/core/agents/{change-planner,adr-author,adr-reviewer,tdd-implementer}.md`,
`plugins/core/skills/{adr-authoring,plan-readiness-review}/SKILL.md`,
`plugins/compozy/skills/compozy-setup/templates/agents/*/AGENT.md` (generated), `scripts/check.py`,
`docs/openspec-flow.md`, `CONTRIBUTING.md`, `openspec/config.yaml`, `docs/adr/0022-*.md` and
`docs/adr/0025-*.md` (not `docs/adr/0003-*.md`, `0027-*.md` or `0030-*.md`: built on, not amended);
read and kept green, not edited: `deliver-check-archive.test.mjs`, `change-loop-compozy.test.mjs`'s
existing tests, `delivery-models.test.mjs` (T-41 to T-44); at the dogfood, the release files and `docs/adr/release-at-merge.md`
(renamed by the step). Files to delete: none.

Estimate: optimistic 32 h, likely 46 h, pessimistic 68 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Module boundary: move and re-export, three boundary tests (D-3a) | 1 | Core | MEDIUM |
| Note reader, release lines, `computeRelease`, `releaseState` (D-1 to D-3) | 6 | Core | MEDIUM |
| Masking, `releaseOnlyEdit`, `staleness` option, `flow-check` call site (D-5) | 4 | Core | HIGH |
| Delivery rows and approval (D-8, D-9) | 4 | Core | MEDIUM |
| `--assign` and the numbering core, citations (D-4, D-6) | 6 | Core | HIGH |
| Noted join and `trainCheck` (D-7, D-5) | 3 | Integration | MEDIUM |
| Conductor, loop rows, resolver, planner stop hook (D-10, D-11) | 3 | Integration | LOW |
| `check.py` `check_adrs` (D-12) | 2 | Core | LOW |
| New and adjusted tests (D-14, D-15) | 6 | Testing | MEDIUM |
| Texts, agents, CompozyOS regeneration, ADR lines (D-13) | 3 | Documentation | LOW |
| Real-run proof P-1 to P-12 (D-16) | 3 | Testing | MEDIUM |
| Agents' real run S-1 to S-11 (D-16) | 4 | Testing | MEDIUM |
| Bootstrap and dogfood (D-17) | 1 | Migration | HIGH |

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The masking misses a token form and stales evidence after the step | MEDIUM × MEDIUM | AC-4 and AC-5 tests over each form; P-1 checks the records after the real step |
| A sibling takes this change's numbers on `main`'s old train | MEDIUM × HIGH | D-17 re-run after each base merge; the coordinator holds `main` at the release step |
| The base moves again before the implementation and changes a file the plan names | MEDIUM × MEDIUM | task 1.1 merges `origin/main` and re-reads `release-merge.mjs` and `deliver-check.mjs` against D-3a's lists before task 2.2; a name D-3a lists that is not where it says stops the phase for a plan revision |
| The planner's stop hook refuses a stage that is not the plan's last | LOW × LOW | it sits inside `subagentStopFor`'s `delivered` branch, with `tasks.md` present, once per key (D-11) |
| `deliver-check.mjs` gains an import a consumer job cannot load | LOW × HIGH | D-3a's boundary tests, T-20, and the new `--ci` run from the three downloaded files |
| A consumer layout the rules do not expect | LOW × MEDIUM | the step writes only files that exist; AC-8 and AC-9 cases |

Assumptions (each a place the plan breaks if wrong): stage files are written uncommitted on top of the
commit their header names (Context: `stale-only-on-own-files/approval.md`); `actions/checkout` on a
`pull_request` run leaves `HEAD` detached at a merge ref with `GITHUB_HEAD_REF` set and no
`origin/main` (`.github/workflows/ci.yml`, D-12); this repository's `devkit-reviews.yml` runs the
branch's `deliver-check.mjs` (`.github/workflows/devkit-reviews.yml`); `release-merge.mjs` is
installed next to `deliver-check.mjs` in every pack copy (`plugins/openspec/hooks/`).

Dependencies: `ADR [release-at-merge]` (proposed, accepted by the plan approval); ADR 0019 (tag rule,
unchanged); ADR 0022 and ADR 0025 (amended); ADR 0003, ADR 0027 and ADR 0030 (built on, unchanged);
`archive-release-pin` (merged, train 4) for the pin definition in `deliver-check.mjs`, the pin test
that reads the manifest and the base text of `CONTRIBUTING.md` step 5 and the flow page (D-17; nothing
waits on it); `release-merge-leftovers` (merged, train 3) for the change-delivery spec.
