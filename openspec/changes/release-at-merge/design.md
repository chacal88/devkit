<!-- devkit-stage design result=passed attempt=6 commit=9b67c11f446bfd8f24407556df9c082589acd50f -->
# Design

Change: `release-at-merge` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(sources: `proposal.md`, `requirements.md`, `decisions.md`, `ADR [release-at-merge]`, `release.md`).
Plan base: `ba3126b`, the merge of `origin/main` at `c663f21` (train 4, which carries
`archive-release-pin`, ADR 0027 and ADR 0030) into `66a27b1` (the merge of `a347ac0`, train 3, into
the first base `2ecd562`); the code and the tests below were read again at `ba3126b`. Every
function, constant and file is named, never a line number; this change's own version and ADR number
are "assigned at merge" and never written.

**Revised after review round 1** (`review.md`, FAIL at `4a6e858`; the five verdict files under
`reviews/`), at `41dd40e`: the coordinating session took the decisions D-18 to D-27 under the owner's
delegation, and D-4, D-5, D-6, D-9, D-13, D-15, D-16 and D-17 are revised where they point to them.
"Findings of review round 1", after D-27, gives every finding its decision and task, or the written
reason it gets none. Phase 9 of `tasks.md` carries the work. The readiness review of that revision
(attempt 4, `readiness.md`) found four blockers, answered in the same place: D-20 amends `ADR
[release-at-merge]` decision 6, so the adr-author drafted `ADR [release-at-merge-step-record]`
(listed in `decisions.md`); the base moved to `a815222` (train 15, D-25 and D-27); the give-back
refusal gets a scenario and a test (D-20, D-26); task 9.6 names every flow-page sentence that repeats
the rule D-20 changes.

**Revised after review round 2** (`review.md`, FAIL at `c1c875e`, round 2 of 2, escalated), at
`9b67c11`, by the owner's own decision typed on 2026-11-25, "1a e 2b": (1a) the owner confirms the
per-line reading of the step's record, which the code took in `46c3c2e` (defect 7): each release line
takes the newest step commit that wrote it, a trailer still counting only when its commit changed
what it names (D-28); (2b) this change's release-edit rule is scoped to the normal delivery path, and
an owner's forced merge keeps reading the evidence and the reviews by the canonical requirement "The
open items of a forced merge are named", so `gatesAtHead` is not changed and its release-edit
allowance is a roadmap follow-up (D-29). The round 2 nits that are one-line text fixes in files this
change already edits are taken (D-30). "Findings of review round 2", after round 1's map, gives every
finding its answer; phase 10 of `tasks.md` carries the work. The numbering is done (task 9.17): no
plan file and no task writes a version or an ADR number, and if the base moves the delivery's
`assign-release` step runs again.

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
and the archive: another change's plan files stay as approved) but test files and fixtures (D-18):
`ADR [<slug>]` to `ADR <NNNN>`, and `<slug>.md` not preceded or followed by a letter, digit, `_` or
`-` to `<NNNN>-<slug>.md` only where it names a file of an ADR folder (D-19: `docs/adr/<slug>.md`,
`adr/<slug>.md` links, and `(<slug>.md)` header references inside an ADR folder). A foreign slug that
has landed on the base is rewritten to its number too (AC-7). Refusals (exit 2, merge undone): a slug
another file of `ADR_DIRS` already has (`a second ADR with the slug <slug>: <paths>`) and an unlanded
citation (`ADR [<x>] is cited but has not landed on <base>; it lands with its own change`). The ADR's
own `Change:` line resolves the citations left in the change folder after the merge.

### D-5 The release edit, which stales nothing

`maskRelease(text, path, map)` masks, symmetrically: JSON manifests and the release file without their
version fields; `PIN_FILE` with `setPins(text, '0.0.0')` (the mask `pinLinesOnly` uses, ADR 0027); in a file that holds citations (D-18), `ADR <NNNN>` to `ADR [<slug>]`
and, where D-19's anchor matches, `<NNNN>-<slug>.md` to `<slug>.md` for every numbered ADR of `ADR_DIRS` at the
revision (`map`, memoized per revision; each side masked with its own records, the refinement
`49a8884` made). `releaseOnlyEdit(root, before, after, path)` is true for
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
   exit 2 with the reason. `releaseState` of the side must be `unassigned` (a line the step's own
   record names counts as given back, D-20) or `assigned` (else exit 2, `release lines edited by hand:
   <paths>`); a malformed note is exit 2 with the reader's message. A project that names no
   `devkit.release_tag` is exit 3 (D-24).
2. When `target` is not an ancestor of the head: `git merge --no-ff --no-commit <target>`. For each
   path the side changed outside `openspec/changes/` whose text holds assigned tokens, the merged text
   is `git merge-file` of the merge base, `maskRelease` of the side's text and the target's text (in a
   temporary folder it removes, as `mergePins` does); a conflict there, or a conflict in any path that
   is not a release line, undoes the merge (`restore`) and exits 2 naming the paths. The paths
   `RELEASE_FILE` matches (pack manifests, the marketplace, `CHANGELOG.md`, `docs/catalog.md`) keep
   the target's side; `PIN_FILE` is not one of them: its text takes the masked three-way merge above
   (pins masked with `setPins`), so its prose edits from both sides are kept and step 3 writes its
   pins. When no merge is needed and the state's `reassign` is not empty (the person merged the base
   by hand after a refusal), D-20's give-back runs instead, before the slug check.
3. Write the lines of `computeRelease(target)`: manifests by `resolveManifest` on the merged text, so a
   manifest field the branch added stays and only the version fields move (revised after round 1:
   the implementation's deviation 1, which the five reviewers accepted, and architecture nit F4),
   `CHANGELOG.md` by `changelogEntry` on the target's text, the pins by `setPins` (the one pin
   definition ADR 0027 put in `deliver-check.mjs`; T-6 checks them against the manifest, ADR 0030;
   the archive check's pin-line rule is not involved: this is the change's branch), the release file's
   version, `gen-catalog.py` when it exists and a manifest changed, each ADR by `git mv` to its number
   with `ADR [<slug>]` and `<slug>.md` rewritten in it, then the citations (D-4).
4. Commit: `chore(release): merge origin/<base> and assign the release of <id>` (a merge) or
   `chore(release): assign the release of <id>` (a plain commit); nothing to write is exit 0 with no
   commit. The message ends with the step's record (D-20): `Release-change`, `Release-line`,
   `Release-adr` and `Release-citation` trailers. Never push. JSON adds `mode: "assign"`, `change`,
   `adrs` (`{ from, to }`), `citations` (paths) to the existing fields. Any failure after the merge
   started restores the tree (exit 2).

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
`- Release note:` line of `approval.md`) only when either is non-null (in a project that names
`devkit.release_tag`, which `approvalState` reads itself when its caller does not say, D-22), so the object of a change with
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
- After review round 1 (phase 9): `docs/openspec-flow.md`'s `--assign` paragraph replaces "Citations
  are read only in Markdown and YAML files ..." with D-18's rule and D-19's anchor, names the
  record's trailers and the recovery after a refusal for a conflict outside the release lines
  (D-20), and says that `--assign` with no `devkit.release_tag` exits 3 (D-24); "The release note"
  paragraph gains the sentence that the note counts with `tasks.md` when the readiness is judged
  stale (D-21). `plugins/openspec/skills/ship-change/SKILL.md`'s `assign-release` row gains, after
  its exit 2 clause, the merge by hand (D-20); its existing words stay (T-2, T-32, T-33). The
  `ADRs:` entry of `openspec/config.yaml` keeps its citation form (D-25).

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

The tests review round 1 found missing, and those of D-18 to D-24, are listed in D-26.

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
| P-13 | (after review round 1, D-20) the reviewer's sequence: `feat` assigned (a pack and an ADR); a sibling lands the same pack's next version and the same ADR number and changes `src/a.ts`, which `feat` also changed; `assign-release` exits 2 naming `src/a.ts` and leaves the branch as it was; the session merges `origin/main` by hand, resolves `src/a.ts`, takes the base's side of every release line, commits; `deliver-check` answers `assign-release`, not `blocked`; the step exits 0, renumbers the ADR above the sibling's, writes the version above the base's, and `git log -1 --format=%B` shows its record; the state reads assigned and current and `enable-auto-merge` is next | AC-4, AC-5 |

After review round 1 the whole script (`proof/cases.mjs`, P-1 to P-13) runs again at the head of
phase 9 and `proof/real-run.md` is written anew: the step's commits now carry their record, the
citations follow D-18 and D-19, and P-5's hand run of `--assign` exits 3 (D-24).

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
| S-12 | (after review round 1, D-21) K, the failure path then the success path: S-8's seed (a plan with no `release.md`), the real `plan-readiness-reviewer` fails it with a finding naming `release.md` (`readiness.md` `result=failed`); `change-loop.mjs next` hands the planner the revision; on a copy of that state the case writes only `release.md` and `change-loop.mjs next` hands the readiness review (`rerun-after-fix`), not the same revision; then the real `change-planner` runs on the brief (the case records which plan files it changed and their mtimes), `change-loop.mjs next` hands the readiness review again, and the real reviewer passes the plan; the same seed in N (no `devkit.release_tag`), with `release.md` touched after `readiness.md`, keeps the readiness passed | AC-16, AC-1 |

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
- After review round 1: the dogfood commit `2bd35c5` carries no record (D-20 came later), and the base
  since released the same numbers; D-27 gives them back by hand before the merge of the base, and
  task 9.17 runs the step again, with its record, after the last merge of `origin/main`.
- The line with `archive-release-pin` (merged, train 4): that change makes a pin-line rewrite
  acceptable to the archive check (`unnamedFiles` with `pinLinesOnly`, ADR 0027 amending ADR 0003)
  and makes `change-loop-compozy.test.mjs` read the version from the manifest (ADR 0030); this change
  removes the rewrite from every branch (only the step and the join write a pin line) and touches
  neither `unnamedFiles`, `PIN_LINE_FILES`, `pinLinesOnly`, `RELEASE_FILE` nor that test. It builds on
  ADR 0003, ADR 0027 and ADR 0030 and amends none of them (`ADR [release-at-merge]` decision 7): the
  archive check's pin-line rule stays as written, the safety net for archive pull requests (no note)
  and for changes on the old rule, and is removed with the old rule. Nothing waits: no pin assertion
  stands in the way of this change's release (T-6).

### D-18 A citation lives in every text file but tests and fixtures (after review round 1: A1)

Revises D-4 and D-5 (adr-reviewer F1, spec-reviewer F1, code-quality nit F4). Commit `620c047`
(dogfood defect 4) read citations only in `*.md`, `*.yaml` and `*.yml` files, narrower than `ADR
[release-at-merge]` decision 3, which says every citation in a tracked text file outside
`openspec/changes/`. The rule goes back to the decision's scope minus the files that hold test data:
a literal in a test or a fixture names no record, and defect 4 came from such literals only.

`deliver-check.mjs` keeps the one definition and drops `CITATION_EXTENSIONS`:

- `CITATION_PATHSPEC = ['.', ':(exclude)openspec/changes', ':(exclude,glob)**/*.test.*',
  ':(exclude,glob)**/*-fixtures.*', ':(exclude,glob)**/test/**', ':(exclude,glob)**/tests/**']`,
  always read with `git -C <root> grep -I` (binary files skipped);
- `holdsCitations(path)`: true when `path` is not under `openspec/changes/`, its base name matches
  neither `*.test.*` nor `*-fixtures.*`, and none of its folders is named `test` or `tests`. A caller
  that reads a file's text through it skips a text that holds a NUL byte, as `-I` does.

Every reader uses those two names: `citationsOf` (the changed files scanned for `ADR [<x>]`),
`citedAt` (a citation still standing), `numberRelease`'s rewrite (`git grep -l`), the give-back
`unassign` of the step and the join (D-6 step 2, D-7, D-20) and `maskRelease`'s ADR part: the ADR
tokens are masked only when `holdsCitations(path)`, so a commit that changes the test literal
`docs/adr/feat.md` to `docs/adr/0002-feat.md` is a plain edit and stales (code-quality nit F4), and
`unassign` passes the real path, not `''`. `docs/openspec-flow.md` says so (D-13). The comments of the
tests written for defect 4 ("release-note AC-7 citation: an ADR [x] literal in a changed .mjs file is
neither cited nor rewritten" and the "same token" test after it in `release-note.test.mjs`; "release-note
AC-7 join: a head numbered before the train is renumbered in its Markdown citations, and its source
literals stay as written" in `delivery-train.test.mjs`) say "a test file or a fixture" where they say
"a source file"; their assertions stand, since their files are `*.test.mjs`. A `git grep -I` with this
pathspec at `41dd40e` finds no `ADR [<x>]` token outside `openspec/changes/`: the repository trips
nothing.

### D-19 The `<slug>.md` form only where it names an ADR folder's file (code-quality F2)

D-4's second form matched `<slug>.md` in any file, so a change named like another document (`roles`
and `docs/roles.md`) would break every link to it, and `maskRelease` hid the break from the
staleness. `deliver-check.mjs` exports `adrFileRe(name, path)`: the global RegExp of `<name>.md` as a
whole token (not preceded or followed by a letter, a digit, `_` or `-`) whose folder part ends in
`adr/` or `decisions/` (the last part of each `ADR_DIRS` folder: `docs/adr/feat.md`, `../adr/feat.md`,
`adr/feat.md`, `docs/decisions/feat.md`), or, when `path` is a file of an `ADR_DIRS` folder, with no
folder part (`(feat.md)` in `docs/adr/0022-x.md`); the folder part is captured so the rewrite keeps
it. `rewriteCitations(text, slug, number, path)` (a fourth argument) writes `<number>-<slug>.md` only
where `adrFileRe(slug, path)` matches; `maskRelease` maps `<NNNN>-<slug>.md` back only where
`adrFileRe(`${number}-${slug}`, path)` matches. `ADR [<slug>]` and `ADR <NNNN>` keep their rule.
This also meets the part of architecture nit F3 that this change touches: the two citation forms
live in one helper the rewrite and the mask share; the other numbered-name lookups stay where they
are (follow-up).

### D-20 The step's own record of what it wrote (Blocker 1, code-quality F1)

**The failure.** An assigned branch whose base then released the same pack, took the same ADR number
for another record and changed a file the branch also changed (`src/a.ts`) gets exit 2 from
`--assign` (a conflict outside the release lines, D-6 step 2). The only way on is a merge by hand.
After it the merge base is the base's tip, the release files are the base's, and the change's record
still holds the number the earlier run gave it (`docs/adr/0002-feat.md`, while the base's `0002` is
`docs/adr/0002-other.md`). `releaseStateAt` reads that line as neither the merge base's nor what the
step computes there, so `hand`, and every later `--assign` refuses with `release lines edited by
hand: docs/adr/feat.md`. AC-4 fails for this case, and no document names a way out.

**The record.** Every commit `numberRelease` makes for `--assign` (a plain or a merge commit) keeps
its subject and ends its message with a trailer block, one trailer per thing it wrote, in this order:

```text
chore(release): assign the release of feat

Release-change: feat
Release-line: plugins/openspec/.claude-plugin/plugin.json
Release-line: .claude-plugin/marketplace.json
Release-line: CHANGELOG.md
Release-line: docs/openspec-flow.md
Release-adr: docs/adr/feat.md -> docs/adr/0002-feat.md
Release-citation: docs/x.md
```

`Release-line` names each key D-3 compares (a pack manifest, the marketplace, `CHANGELOG.md`,
`PIN_FILE`, the release file) that the commit wrote; `Release-adr` each record it renamed;
`Release-citation` each path whose citations it rewrote (the JSON's `citations`). `docs/catalog.md`
is not named (D-3 leaves it to `gen-catalog.py --check`). The join's commits carry none: a train's
commits never come back to a change branch, and the record is read only from commits not on the
target.

`deliver-check.mjs` exports `stepRecord(root, { head, tip, id })` (`node:` imports only, D-3a): `git
log --first-parent --format=%H%x00%B%x1e <tip>..<head>`, newest first; every commit whose message's
last paragraph holds `Release-change: <id>` is a recorded commit, and the record is read per line from
all of them (revised at review round 2, the owner's decision 1a, D-28): each key takes its value from
the newest recorded commit that wrote it, so a value an older step commit wrote and a later step
commit kept (a merge that renumbered nothing) stays the step's own (defect 7, `46c3c2e`); null when no
commit is recorded or when `git log` fails (a shallow clone that cannot reach the range). The values
come from that commit's own tree, never from the trailer text, and a named key counts for a commit
only when that commit changed it from its first parent: a `Release-line` whose line differs between
`<commit>^1` and `<commit>`, a `Release-adr` whose `to` the commit holds and its first parent does
not, a `Release-citation` whose path differs between the two. A trailer typed on a commit that wrote
nothing is ignored, and the key keeps the value of an older recorded commit that did write it. It
returns `{ commit, lines, adrs, citations }`: `commit` the newest recorded commit, `lines` the values
in the form `linesOf` and `adrValue` give (the changelog masked with the head's numbers, as D-3 does),
`adrs` the `{ from, to, commit }` renames and `citations` the `{ path, commit }` rewrites, each with
the recorded commit that wrote it, which the give-back reads as "the record's commit".

**The state.** `releaseStateAt` reads the record and counts a key whose head value is neither the
merge base's nor the computed one as the step's own when the record holds that same value for it.
Then, first match wins: every key equal to the computed value is `assigned`; every key equal to the
merge base's or to the record's is `unassigned`, with `reassign` listing the keys taken from the
record (empty in every case D-3 already knew); anything else is `hand`, the paths as before. Only the
step's own record decides: a value no recorded commit wrote stays `hand` (a number typed by hand, a
record lost to an amend). `nextStep` therefore answers N6 `assign-release`, not N3, for a branch
merged by hand. A key whose head value equals the merge base's is never in `reassign`, even when the
record holds that same value (the reviewer's own sequence: devkit-openspec 1.1.0 on both sides, so
the manifest is unassigned and given back by nothing); `reassign` lists only keys whose head value
equals the record's and differs from the merge base's.

**What the give-back touches.** `reassign` holds state keys only, the keys `releaseStateAt` compares
(the pack manifests, the marketplace, `CHANGELOG.md`, `PIN_FILE`, the release file and each
`Release-adr` `from` path); the record's `Release-citation` paths are given back together with the
`Release-adr` entry they belong to when that entry's key is in `reassign`, and never become keys the
state compares (readiness attempt 5, O2). Only the record's `Release-adr` and `Release-citation`
entries so selected go through the three-way give-back below. A `Release-line` key in `reassign` (a pack or
marketplace version, `CHANGELOG.md`, the CI pins, the release file's `version`, kept from the
branch's side of a merge by hand) is left to step 3, which writes every release line from
`computeRelease(target)` anyway: the manifests by `resolveManifest` on the merged text, the changelog
by `changelogEntry` on the target's text, the pins by `setPins`, the release file's version.

**The step.** `numberRelease` takes the `unassigned` state with a non-empty `reassign` when no merge
is needed (the person merged): before the slug check of D-4 it gives back what the record names,
each path through `git merge-file` of three texts (base: the path's text at the record's commit;
ours: the working text; theirs: the record commit's text with the record's numbers masked by
`maskRelease`), so only the tokens the step wrote go back to `ADR [<slug>]` and `<slug>.md`, and a
citation the base brought with the same number (`ADR 0002` for the base's other record) stays as it
is; each `Release-adr` record is moved back to its `from` the same way. A conflict there is exit 2
(`cannot give back the numbers the step wrote in <path>`), nothing written and the head and the tree
as they were (`restore`): a person who edited, after the record, a line where the step had written
a number (`see ADR 0002` became `see ADR 0002 and its notes` in `docs/x.md`) changed the very line
the give-back changes, so `git merge-file` conflicts; the scenario "A line the step wrote, edited
after its record" and the D-26 test of that name prove it. Step 3 then writes
`computeRelease(target)` as always. The merge path of D-6 step 2 is unchanged: before its merge the
side holds no other record with its number, so its mask is exact.

**Why trailers.** Rejected: (a) a guess from the trees (the review's first suggestion: a numbered
form whose text masks equal to the unnumbered one is the step's): it cannot tell a number the step
wrote from one a person typed, and it covers records, not a version a person kept; (b) `--assign
--continue` over a merge left in progress for the person: a half-merged worktree across a session
boundary, which the checker cannot read while it waits; (c) a file holding the numbers: under
`openspec/changes/<id>/` it changes the change folder and stales the records, anywhere else it is a
file outside the release lines; (d) `git notes`: neither pushed nor fetched by default, so a clone
loses them. A trailer travels with its commit through push, fetch and merge, needs no file, and sits
on the very commit whose diff proves it.

**Where it is read, and the checkout depth.** Only where the branch's history is present: the
checker's `nextStep` in a local clone, the step, and the join in the train's scratch worktree of a
local clone. `deliver-check --ci` computes no release state (it judges staleness through
`releaseOnlyEdit`, which reads no trailer), and both `devkit-reviews.yml` files (this repository's
and the setup template's) check out with `fetch-depth: 0` anyway. CI's `check` job
(`.github/workflows/ci.yml`, `actions/checkout@v4` at its default depth of 1) runs `check.py`, which
reads no record, and the suite, whose tests build their own repositories and never read this
repository's history (D-15). A clone that cannot read the range reads no record and falls back to the
trees: `hand`, never a false pass. The join reaches `stepRecord` only through `releaseStateAt` and
adds no give-back of its own: in a train project the step never runs (D-8 hands `assign-release`
only with no train), so a boarded head holds no record and its `reassign` is empty, and a head the
step numbered before the train (D-17's bootstrap) keeps D-7's mask give-back.

**The recovery, written down.** The `ship-change` `assign-release` row and the flow page's `--assign`
paragraph say what follows exit 2 for a conflict outside the release lines: the person merges
`origin/<base>` by hand, resolves those files, takes the base's side of every release line in
conflict (the versions, the `CHANGELOG.md` entries, the CI pins), commits, and runs the loop again;
the step then numbers the branch above the base from its record. The records go stale at that merge
when it resolves a conflict in one of the change's own files (ADR 0025 decision 2); the step's commit
after it stales nothing more.

**The record of the decision.** `ADR [release-at-merge]` decision 6 refuses "anything else" as
edited by hand and derives the state "with no marker commit"; D-20 adds an outcome (a value the
step's own recorded commit wrote is given back, not refused) and makes the state depend on
commit-message metadata as well as the trees (an amend that drops the trailers changes the state
while the trees stay the same, and can only turn it back into the refusal). That is a change of
decision 6, not a reading of it, so it has its own record: `ADR [release-at-merge-step-record]`
(`docs/adr/release-at-merge-step-record.md`, proposed, drafted by the adr-author and listed in
`decisions.md`), whose decisions 1 to 8 are this D-20 and whose alternatives are (a) to (d) above
plus a documented manual recovery. The decision text of `ADR [release-at-merge]` is not edited; its
header gains the one line `- Amended by ADR [release-at-merge-step-record]
(release-at-merge-step-record.md)` at task 9.1a, as the repository's convention for an amended record
(F-8, "The `Amended by` line" below). The record follows
D-4: unnumbered, cited by its slug in this folder before and after, and numbered by the step in the
same commit as the first record, the next number after it, since `decisions.md` lists it second
(task 9.17); no plan file names either number. Its slug starts with the first record's slug, so the
D-26 test "two unnumbered records of one change" builds that very shape (`feat`, `feat-store`).

**The texts that repeat decision 6.** `docs/openspec-flow.md` says the rule D-20 changes in three
places, each found by its text (task 9.6):

- "The release note" paragraph: the sentence that starts "The state of a branch is derived, with no
  marker commit:" and ends "anything else was edited by hand." becomes: "The state of a branch is
  derived from its trees, with no commit made to mark it: its release lines (...the list as now...)
  equal to those of its merge base with `origin/<base>` is `unassigned`; equal to what the step
  computes from that merge base and the note is `assigned`, and `current` once `origin/<base>` is in
  the branch; a line that equals neither but holds what the step's own last recorded commit wrote
  (the `Release-` trailers of its message, read against that commit's tree) is `unassigned` too, and
  the next run of the step gives it back and numbers it again; anything else was edited by hand."
- the row N3 of that paragraph's table: the condition "a note, and the release lines were edited by
  hand" becomes "a note, and a release line is neither the merge base's, nor what the step computes,
  nor what the step's own record wrote"; its `next.step` cell stays.
- the `--assign --base <base>` bullet of "Release-file conflicts: `release-merge.mjs`": "exits 2 when
  the branch's release lines are neither the merge base's nor the ones the step wrote there" gains
  ", nor the ones its own last recorded commit wrote", and the bullet gains the record (the trailer
  block, one per thing written), the give-back with its exit 2 `cannot give back the numbers the step
  wrote in <path>`, and the recovery after a conflict outside the release lines.

A `grep -rn` of the test files at `41dd40e` (`edited by hand`, `marker commit`, `The state of a
branch`, `neither the merge base`, `a note, and`) finds no assertion of these three sentences: the
"documents" subtest of `release-note.test.mjs` asserts only the bold heads `**The release note.**`
and `**A noted change on the train.**`, the table cell of the `assign-release` row and the bullet's
head `--assign --base <base>`, which stay; the tests that match `release lines edited by hand:` (the N3 tests of
`deliver-check.test.mjs`, the AC-2 state tests of `release-note.test.mjs`, "release-note AC-4 assign:
a version edited by hand exits 2 naming the release line" of `release-merge.test.mjs`) assert the
checker's and the step's message, which does not change. The `devkit` skill's `assign-release` clause
("a release line edited by hand, a conflict outside the release lines, an ADR cited before it
landed") stays true and is not edited.

**The `ADRs:` line.** In `openspec/config.yaml`'s `ADRs:` list, this change's first entry, which
ends `, amends 0022 and 0025`, gains `, amended by ADR [release-at-merge-step-record]` (the way the
0027 entry says `amends 0003, amended by 0030`), and the list gains, after that entry, `; ADR
[release-at-merge-step-record] the release step's commits record the lines they wrote, so a branch
merged by hand is numbered again, amends ADR [release-at-merge]`. Both new citations keep the
bracket form, so the step rewrites each (D-25's reason for code-quality nit F6: a bare
`[release-at-merge-step-record]` or a bare number is no citation form, and a later run that
renumbers would leave it behind). The "documents" subtest of
`release-note.test.mjs` "release-note AC-14 texts: ..." asserts that the line ends with this change's
record (`; ${CITED} [^;]+, amends 0022 and 0025\\)$`); its assertion changes to the line ending with
the first record's entry followed by the second's (`; ${CITED} [^;]+, amends 0022 and 0025, amended
by ${CITED2}; ${CITED2} [^;]+, amends ${CITED}\\)$`, `CITED2` the second slug's `ADR
(?:\\[<slug>\\]|\\d{4})`). Invariant: the `ADRs:` line ends with this change's records in the order
`decisions.md` lists them, each in a form the step rewrites, the first naming the second as its
amender, and the entries before them stay; layer: the texts of D-13; suite: `release-note.test.mjs`
(D-26, "changed").

**The `Amended by` line.** Decided by the coordinating session as the repository's standing
convention, not an owner question: every amended accepted record in `docs/adr/` carries one `-
Amended by ADR <NNNN> (<NNNN>-<slug>.md)` header line per amender (ADR 0003 carries four, ADR 0027
one, and ADR 0022 and ADR 0025 received theirs from this change). So `ADR [release-at-merge]` gets,
as the last line of its header bullets (after `- Builds on:`, where ADR 0027 places its line), `-
Amended by ADR [release-at-merge-step-record] (release-at-merge-step-record.md)`, written in the
unnumbered form the step rewrites. The adr-author adds it at task 9.1a: after 9.1, because 9.1's
revert renames `docs/adr/0031-release-at-merge.md` back to `docs/adr/release-at-merge.md` and a line
added before it would meet that revert; before 9.6, so the record reads complete before the texts
that cite the second record change. The line is a header line, not an edit of the accepted decision
text (as for ADR 0022 and ADR 0025 here). It stales no stage file (the `decisions` stage is
`decisions.md` only, `plugins/openspec/schemas/devkit/flow.json`), and no test reads it (the
"records" subtest of `release-note.test.mjs` checks ADR 0022, 0025, 0003, 0027 and 0030 only). At
task 9.17 the step numbers both of its tokens: `ADR [release-at-merge-step-record]` by the
`ADR [<slug>]` rule, and `(release-at-merge-step-record.md)` by D-19's no-folder form, since the file
holding it is an `ADR_DIRS` file; the step's citation pass reads every tracked file the pathspec
names, the record it renamed a moment before included, so the line reads `- Amended by ADR <N+1>
(<N+1>-release-at-merge-step-record.md)` in `docs/adr/<N>-release-at-merge.md`. No existing test
covers a citation in an ADR's header line naming another record of the same change (the two-records
test of task 9.5 covers the second citing the first), so D-26 adds one (task 9.2), which pins that
the pass hands `rewriteCitations` the renamed record's own path once D-19 makes the file form depend
on the path.

### D-21 The readiness review sees the release note (B1)

**The failure.** The readiness review fails a plan on its note (`plan-readiness-review/SKILL.md`, the
release note paragraph; S-8), but the readiness stage's `staleAfter` names stage files only, so a
planner that then changes only `release.md` leaves `readiness.md` the newest stage file and the loop
hands it the same revision brief until no progress ends the run (S-6, "What the loop hands after the
revision"). **The agent that fails, the files it leaves, the hook that sees it:** the
`plan-readiness-reviewer` leaves `readiness.md` with `result=failed` and a finding naming `release.md`;
the `change-planner` then leaves a newer `release.md` and no other changed plan file. The hook is not
`guard.mjs subagent-stop` but the stage walk of `flow-check.mjs` (`artifactState`, reached by
`change-loop.mjs next` through `collectFlow` and `computeFlow`), which marks a failed stage whose
`staleAfter` files are newer as `fixed` and offers it again (`rerun-after-fix`).

**The rule, in code.** `collectFlow` adds `facts.noteFiles`: `[{ path: 'release.md', mtimeMs }]`
when `releaseTagOf(root)` names a file (a value the setting reader refuses counts as none, as in
`releaseFacts`) and the change's folder holds `release.md`; else `[]`. In `artifactState`'s
`staleAfter` loop the entry `tasks` compares `maxMtime([...(facts.files.tasks ?? []),
...(facts.noteFiles ?? [])])`; the reason stays `stale-plan` with `by: 'tasks'`. `release.md` never
joins `facts.files.tasks`, so the tasks stage asks no header of it. The guard `!started &&
!facts.postMerge` is unchanged: once a task is ticked, a changed note is the approval's (row A1, the
recorded hash). A readiness run again stales the approval through its own `staleAfter`
(`readiness`), so the owner approves the new note. The conductor follows the same rule:
`conduct-check.mjs` `planFacts` counts the `release.md` mtime, under the same condition, in a
`newestNote` it compares only in `readiness.fresh` (never in `planArtifacts`, so no `plan` step asks
for it, and never in `newestPlan`, so the dependency audit's `audit.fresh`, which judges the order of
changes and not their release, is not staled by a note), and its planning row answers `readiness`
too. No `flow.json` changes and no flow version is released (`ADR [release-at-merge]`
decision 2); the requirement is the MODIFIED `change-stages` block (D-25). The canonical
`change-stages` requirement "A change follows the flow version it opened with" holds: the rule edits
no stale rule, ceiling or `onFail` target of a recorded flow; it is an input of the comparison in
code, of the same kind as the 2-second tolerance and the started guard, and acts on every recorded
flow whose readiness lists `tasks` in `staleAfter` (devkit flows 1 and 2, identical there).

### D-22 Every reader of the approval checks the note (architecture F2)

D-9 gave `approvalState(dir)` the note keys directly; the code took them only when the caller passed
`{ release: true }`, which evidence.md did not list as a deviation, so `conduct-check.mjs` `planFacts`
(the conductor's `approve` row) and `change-loop.mjs` `acceptDecisions` read a plan whose note
changed after the approval as approved. `approvalState(dir, { release } = {})` now reads the setting
itself when `release` is undefined: `namesReleaseTag(changeRoot(dir))`. `namesReleaseTag` moves from
`change-loop.mjs` into `deliver-check.mjs` and is exported (`change-loop.mjs` imports it);
`changeRoot(dir)` is the folder above `openspec/changes/<id>` or `openspec/changes/archive/<id>`, and
a folder outside that layout names no setting. Callers that pass `release` keep passing it.
`conduct-check.mjs`'s `approve` row gives the reason `release note changed after approval` (with
`release` among its fields) when the readiness hash matches and the note's does not;
`acceptDecisions` refuses with the same words. The object of a change with no note keeps its four
keys (T-13). The rule is the ADDED requirement "Every reader of the plan approval checks the release
note", whose scenario "A folder outside a project's layout" pins the last case.

### D-23 A `## ` line in the changelog body is refused (code-quality nit F5)

`parseReleaseNote` refuses a body line outside a code fence that starts `## ` (`/^##\s/`):
`release.md: changelog body: line <n>: "<text>" is a version heading; write ### or a list item`.
`changelogEntry` would otherwise write it into `CHANGELOG.md` as another version-level heading, which
`parseChangelog` and the changelog rule of `check.py` read as a version. A `### ` line and a line
inside a fence are kept.

### D-24 `--assign` with no `devkit.release_tag` exits 3 (architecture nit F5, spec-reviewer nit F7)

The implementation's exit 2 (evidence.md, deviation 2) is a setup error, as a setting the reader
refuses already is in `--assign` (exit 3), and the script's header reserves 3 for setup and usage
errors, while `ship-change` reads 2 as `blocked: item 5`. So: stderr `release-merge: openspec/config.yaml
names no devkit.release_tag: this project has no release to assign`, no JSON, exit 3, nothing
written. No session reaches it (the checker never hands `assign-release` without the key); P-5 runs
again and records exit 3.

### D-25 Spec and design text settled after round 1

- spec-reviewer F2: `change-coordination` carries "From the implementation on, the step inside the
  stage goes to its role" as a MODIFIED block, its text and every scenario copied verbatim from the
  canonical spec, plus one sentence, the three conflict scenarios ("A conflict only in release
  files", "A conflict in any other file", "GitHub reports a conflict the base merges cleanly") scoped
  to a change with no release note, and the scenario of a noted change in conflict
  (`assign-release`). The review named the second and the third; the first contradicts the ADDED
  conductor requirement in the same way, so it is scoped too (F-10).
- Train 15 (`a815222`, readiness attempt 4, blocker 2): `change-coordination` carries "The loop
  fetches the base branch before it judges a delivery step" as a MODIFIED block, its text and its six
  scenarios copied verbatim from the canonical spec at `a815222`, plus one sentence: for a change with
  a release note, in a project that names `devkit.release_tag` and sets no delivery train, the step
  judged from the fetched base is `assign-release`. Its scenario "A base that moved on the remote",
  whose THEN hands the release-conflict step, is scoped to a change with no release note, and one
  scenario is added, "A base that moved on the remote, for a change with a release note" (the action
  is the session step `assign-release`). The fetch is `fresh-base-check`'s code, already on this
  branch through train 12 (train 15 archived its spec), and N5 and N6 are this change's, so the D-26
  test of that scenario is a guard (F-10). Until task 9.1 merges `a815222`, this worktree's
  canonical spec lacks the requirement, so `openspec validate` reports, as information, that the
  archive would refuse this block; the merge clears it.
- spec-reviewer F4: `change-delivery` gains "The repository check refuses an unnumbered ADR on the
  base" and "The repository check refuses an unlisted unnumbered ADR and a slug held twice"; the
  seven existing `release-note AC-6 check` tests prove their scenarios (D-26), and AC-6 names the
  unlisted rule.
- spec-reviewer nit F5: the MODIFIED "A plain commit on the branch keeps its rule" names the change's
  own ADR renumbered by a later run as a release edit, with a scenario.
- spec-reviewer nit F6: `delivery-train` carries "Release numbers follow the boarding order on the
  train only" as a MODIFIED block scoped to a head with no note, its scenario verbatim; the ADDED join
  requirement gains the scenario of a project with no `devkit.release_tag` (test-coverage nit F8).
- B1 is the MODIFIED `change-stages` requirement "A plan stage is stale after a plan file changes,
  until the work starts" (verbatim, plus the note's sentence and four scenarios): a fifth capability,
  named in the proposal (F-10).
- D-18 to D-20 are ADDED `change-delivery` requirements ("A citation lives in every text file but
  tests and fixtures", "The file form of a citation is rewritten only where it names an ADR folder's
  file", "A release line the step wrote is known by the step's own record", "The release step
  records what it wrote and numbers again after a merge by hand", whose scenario "A line the step
  wrote, edited after its record" is the give-back's exit 2), and D-22 is "Every reader of the plan
  approval checks the release note".
- architecture nit F4 and the implementation's deviation 1: D-6 step 3 says the merged text, and
  test-coverage F4's test pins it with the state read `assigned` right after the step.
- code-quality nit F6 (the `ADRs:` entry reads `ADR <NNNN> a change carries ...` where the others read
  `<NNNN> <subject>`): kept, with this reason. A bare number is no citation form, so a later run of
  the step that renumbers the record after the base took its number would leave it behind; the entry
  keeps the `ADR [<slug>]` form D-13 wrote, which the step rewrites. Follow-up: a citation form for
  the `ADRs:` list.
- adr-reviewer nit F3 (`ADR [release-at-merge]` decision 4's "no train" read literally): F-6's
  reading stands; the record is accepted and is not edited, and no new record is wanted for a
  wording. Follow-up for the next record that touches decision 4.

### D-26 The tests round 1 found missing, and the tests of D-18 to D-24

Each is named `release-note <AC-n> <area>: ...` (D-15). "Red" fails on the code as phase 9 finds it;
"guard" pins behaviour the code already has and passes there, saying so in `proof/red-9.txt`. Task
10.3 renames the `stepRecord` test below and three tests of defect 4 that D-18 names, with their
assertions unchanged (D-30 gives the new names).

| Finding | File | Test | Kind |
|---|---|---|---|
| A1 / D-18 | `release-note.test.mjs` | "release-note AC-7 citation: a citation in a changed source file is refused while unlanded and rewritten once landed" (`plugins/openspec/hooks/x.mjs` with `// amends ADR [other]`) | red |
| A1 / D-18 | `release-note.test.mjs` | "release-note AC-5 rewrite: a source comment and a Python file are numbered with the record" (`plugins/a/hooks/x.mjs`, `scripts/x.py`) | red |
| A1 / D-18 | `release-note.test.mjs` | "release-note AC-5 citation scope: a test file, a fixture and the files of a test folder are never cited, rewritten or counted as still cited" (`x.test.mjs`, `x-fixtures.mjs`, `test/a.md`, `tests/b.yaml`) | guard |
| A1 / D-18 | `release-note.test.mjs` | "release-note AC-5 citation scope: holdsCitations and CITATION_PATHSPEC name the same files" (a scratch repository with those paths and `docs/x.md`, `plugins/a/hooks/x.mjs`, `scripts/x.py`, `openspec/config.yaml`, `openspec/changes/f/design.md`: `git grep -l` with the pathspec equals the filter) | red |
| code-quality nit F4 / D-18 | `deliver-check.test.mjs` | "release-note AC-4 staleness: a test literal renumbered by hand stales the evidence" | red |
| A1 / D-18 | `delivery-train.test.mjs` | "release-note AC-7 join: a source file's citation of a head numbered before the train is given back and renumbered" | red |
| code-quality F2 / D-19 | `release-note.test.mjs` | the existing "release-note AC-5 rewrite: ADR [<slug>] becomes ADR <NNNN> and <slug>.md becomes <NNNN>-<slug>.md, each only as a whole token" changes: called with the path `docs/x.md` the bare `(feat.md)` stays, with `docs/adr/0001-start.md` it is rewritten (invariant: both forms are rewritten as whole tokens, the file form only where it names an ADR folder's file; layer: the step's rewrite in `release-merge.mjs`; suite: `release-note.test.mjs`) | changed |
| code-quality F2 / D-19 | `release-note.test.mjs` | "release-note AC-5 rewrite: a change named like another document leaves its links alone" (change `roles`, `docs/roles.md` linked from `docs/x.md`) and "release-note AC-5 mask: a link to another document renamed by hand is not masked" | red |
| D-19, D-20 "The `Amended by` line" | `release-merge.test.mjs` | "release-note AC-5 assign: the first record's Amended by header line naming the second record of the same change takes the second's number in both tokens" (`decisions.md` lists `docs/adr/feat.md` then `docs/adr/feat-store.md`; `docs/adr/feat.md`'s header ends `- Amended by ADR [feat-store] (feat-store.md)`; the base's highest is `0026`; after `--assign`, `docs/adr/0027-feat.md` holds `- Amended by ADR 0028 (0028-feat-store.md)`, and no tracked file outside `openspec/changes/` holds `ADR [feat-store]`, a bare `(feat-store.md)` or `0027-feat-store.md`) | guard (today's file form matches anywhere; after D-19 it pins that the citation pass hands `rewriteCitations` the renamed record's path, an `ADR_DIRS` file) |
| code-quality F1 / D-20 | `release-merge.test.mjs` | "release-note AC-4 assign: an assigned branch merged by hand after a code conflict with a base that released the same pack and ADR number is numbered again" (the reviewer's sequence: assign; the base releases the same pack and ADR number and edits `src/a.ts`; `--assign` exits 2 on `src/a.ts`; a merge by hand that takes the base's release files; `--assign` again exits 0, renumbers, and the state reads `assigned` and `current`) | red |
| code-quality F1 / D-20 | `release-merge.test.mjs` | "release-note AC-4 assign: the step's commit ends with its record" (plain and merge commit: subject unchanged, the trailers of D-20 in order) | red |
| code-quality F1 / D-20 | `release-merge.test.mjs` | "release-note AC-4 assign: the same branch with its record removed by an amend reads hand naming the record" and "...: a version no recorded commit wrote is still refused" | guard |
| code-quality F1 / D-20 | `release-merge.test.mjs` | "release-note AC-4 assign: a citation the base brought with the step's old number keeps its number when the step gives its own back" | red |
| code-quality F1 / D-20 | `release-note.test.mjs` | "release-note AC-4 record: stepRecord reads the newest recorded commit, ignores a trailer whose commit wrote nothing, and is null without one" | red |
| code-quality F1 / D-20 | `deliver-check.test.mjs` | "release-note AC-4 row N6: a branch merged by hand after the step is handed assign-release, not refused" | red |
| readiness M3 / D-20 | `release-merge.test.mjs` | "release-note AC-4 assign: a line the step wrote, edited by a person after the record, is not given back: exit 2 naming the path, the head and the tree as they were" (the reproduction's merge by hand, then `see ADR 0002` becomes `see ADR 0002 and its notes` in `docs/x.md`; stderr and the JSON's `error` say `cannot give back the numbers the step wrote in docs/x.md`; `git rev-parse HEAD` and `git status --short` as before the run) | red |
| readiness O1 / D-20 | `release-note.test.mjs` | "release-note AC-4 record: a line equal to both the merge base's value and the record's is unassigned and outside reassign, and a version kept from the record is left to step 3" (the reproduction's manifest at 1.1.0 on both sides is not in `reassign`; a second branch whose merge by hand kept its own 1.1.0 over a base at 2.0.0 has the manifest in `reassign`, and `--assign` then writes 2.1.0 through step 3 with no three-way give-back of the manifest) | red |
| readiness M1 / D-20, D-4 | `release-merge.test.mjs` | "release-note AC-5 assign: two unnumbered records of one change take the next two numbers in the order decisions.md lists them, the second's citations of the first follow, and the record names both renames in that order" (`decisions.md` lists `docs/adr/feat.md` then `docs/adr/feat-store.md`, the second citing `ADR [feat]` and `(feat.md)`, `docs/x.md` citing both; the base's highest is `0026`: `0027-feat.md` and `0028-feat-store.md`, `ADR [feat-store]` never read as `ADR [feat]`, `feat-store.md` never rewritten as `feat.md`, two `Release-adr` trailers in listed order) | red (the record part) |
| B1 / D-21 | `flow-check.test.mjs` | "release-note AC-16 stages: a note newer than readiness.md makes it stale", "...: a readiness failed on the note is offered again after a note-only revision", "...: without devkit.release_tag the note stales nothing", "...: once a task is ticked the note stales nothing" | red, red, guard, guard |
| B1 / D-21, readiness O3 | `conduct-check.test.mjs` | "release-note AC-16 conduct: a note newer than readiness.md hands readiness" (an `audit.md` as new as the plan stays `fresh` beside it) | red |
| B1 / D-21 | `change-loop.test.mjs` | "release-note AC-16 loop: after a note-only revision of a failed readiness the next action is the readiness review" | red |
| architecture F2 / D-22 | `deliver-check.test.mjs` | "release-note AC-12 approval: approvalState reads devkit.release_tag itself, and a folder outside a project gets no note keys" | red |
| architecture F2 / D-22 | `conduct-check.test.mjs` | "release-note AC-12 conduct: a note changed after the approval answers approve with that reason" | red |
| architecture F2 / D-22 | `change-loop.test.mjs` | "release-note AC-12 accept: accept-decisions refuses a note changed after the approval" | red |
| code-quality nit F5 / D-23 | `release-note.test.mjs` | "release-note AC-1 reader: a ## line in the changelog body is refused naming its line; a ### line and a fenced ## line are kept" | red |
| test-coverage F1 | `release-merge.test.mjs` | "release-note AC-4 assign: run again after the base released another devkit-openspec version, the pin-only conflict of a flow page that cites no ADR is resolved by rule" (`notedRepo` with no ADR; the base releases a patch with `pinDoc` of it; exit 0, the pins name the branch's new version, no conflict marker) | guard |
| test-coverage F2 | `release-note.test.mjs` | "release-note AC-8 consumer: run again after the base released, the release file takes the note's bump above the base's" (beside the AC-8 consumer test) | guard |
| test-coverage F3 | `deliver-check.test.mjs` | "release-note AC-4 staleness: a consumer's step commit leaves tasks, acceptance and approved reviews current" (`CONSUMER` config, `ciProve`) | guard |
| test-coverage F3 | `delivery-train-after.test.mjs` | "release-note AC-3 trainCheck: a consumer's join that writes the release file passes" | guard |
| test-coverage F4, architecture nit F4 | `release-merge.test.mjs` | "release-note AC-4 assign: a manifest field the branch added is kept when the step merges a base that released, and only the version moves" (the state reads `assigned` right after) | guard |
| test-coverage F6 | `deliver-check-cli.test.mjs` | "release-note AC-12 format: ship-change's stop-plan-approval row writes - Release note: <next.release> after - Readiness: when next.release is set" (beside T-32) | guard |
| test-coverage F6, D-20 | `deliver-check-cli.test.mjs` | "release-note AC-4 format: ship-change's assign-release row fetches, runs next.command, pushes plain and never by force, stops blocked on exit 2 and names the merge by hand" | red (the merge by hand is new) |
| test-coverage nit F7, D-24 | `release-merge.test.mjs` | "release-note AC-9 assign: the refusals before any write" (no `devkit.release_tag`: exit 3; a setting the reader refuses: exit 3; `--assign --roadmap-ticks`: exit 3; no noted change and two noted changes: exit 2; each with the tree as it was) | red (exit 3) |
| test-coverage nit F8 | `delivery-train.test.mjs` | "release-note AC-9 join: with no devkit.release_tag a head carrying release.md joins by the old rule" | guard |
| test-coverage nit F9 | `deliver-check.test.mjs` | "release-note AC-4 row N6: before ready-base in a two-prs project" | guard |
| test-coverage nit F10 | `release-merge.test.mjs` | "release-note AC-4 assign: a slug refusal after the step gave back its own numbered record leaves the tree as it was" (restore takes out `docs/adr/feat.md`) | guard |
| readiness M2 / D-25 | `change-loop.test.mjs` | "release-note AC-4 fetch: a base that moved on the remote hands assign-release, not resolve-release-conflict, to a noted change" (`staleMergeFixture` of the `fresh-base-check` tests with `devkit.release_tag` set and the change's `release.md`: `next` moves `origin/main` to the remote's commit and answers the session step `assign-release`) | guard |
| readiness M1 / D-20 | `release-note.test.mjs` | the "documents" subtest of "release-note AC-14 texts: the agents, the documents and the records follow the release note and the unnumbered ADR" changes: the `ADRs:` line ends with the first record's entry, then the second's, `amends ${CITED}` (invariant, layer and suite in D-20, "The `ADRs:` line") | changed |
| spec-reviewer F4 | `release-note.test.mjs` | no new test: the seven existing `release-note AC-6 check` tests prove the scenarios of the two check.py requirements (branch, `main`, `train/1`, unlisted, two slugs, `README.md`, a root with no git) | existing |

### D-27 The merge of trains 13 to 15, and the numbers given back first

`origin/main` stands at `a815222` (trains 13, 14 and 15, local as last fetched; this revision did not
fetch). Against the last merge base `d6d7f6a` it released devkit-openspec and the marketplace at the
very versions the dogfood commit `2bd35c5` gave this branch and then a patch above them (train 15),
and devkit-core at two patches; it holds no ADR above 0030. Its code: `flow-check.mjs`
(`notApplicableOf` and `appliedStages` at the top of `artifactState`), `change-loop.mjs` (the status
line's state; train 15 removed one line, a second `const baseBranch` inside `nextAction`'s delivery
branch), `merge-setup.mjs` (`OFFLINE_GH`), `roadmap-loop.mjs`, one sentence each of
`plan-readiness-review/SKILL.md` and `requirements-grill/SKILL.md`, `pr-verifier.md` and their tests;
it added `status-line.mjs`, `status-line.test.mjs` and `change-state-stages.test.mjs`, and the flow
page's CI pins name its devkit-openspec release. Its specs: train 15 archived `fresh-base-check` and
`run-status-bar`, adding to `change-coordination` "The loop fetches the base branch before it judges a
delivery step" and "A base that cannot be fetched does not stop the loop", to `change-delivery` "The
delivery checkers never fetch", and the `change-state`, `roadmap-coordination` and `status-line`
requirements. One scenario contradicts this change's delta: "A base that moved on the remote" hands
the release-conflict step where a noted change gets `assign-release` (N5); D-25 scopes it in a
MODIFIED block, the planner's step 3b answer for drift a requirement of this change already decides.
"The delivery checkers never fetch" agrees with D-3 (the checker reads `origin/<base>` and, when it is
missing, says `git fetch origin <base>` without running it) and with D-20 (`stepRecord` reads `git
log` only). The rest is drift the plan resolves.

`2bd35c5` carries no record (D-20 came later), and both sides changed `change-loop.mjs` and append
tests to the same files, so the step's merge would stop on a conflict outside the release lines and
leave this branch in D-20's failure with no record to read. Task 9.1 therefore gives the numbers back
by hand before it merges, as the readiness review ran it in a scratch clone at `41dd40e`:

1. `git revert --no-commit 2bd35c5` conflicts in `CONTRIBUTING.md` only, on one sentence of step 5,
   where the number `2bd35c5` wrote, `(ADR <NNNN>)`, stands against `(ADR [release-at-merge])` beside train 12's other edits; the
   implementer undoes only what `git show 2bd35c5` changed there (the sentence takes `ADR
   [release-at-merge]`) and keeps every other line of HEAD. Committed as `chore(release): give back the
   release of release-at-merge before the merge of origin/main`. After it, `git diff d6d7f6a HEAD --
   CHANGELOG.md .claude-plugin/marketplace.json docs/catalog.md 'plugins/*/.claude-plugin/plugin.json'`
   is empty.
2. `git merge --no-ff origin/main` merges the release files cleanly (the branch holds the merge base's)
   and conflicts in `plugins/openspec/hooks/change-loop.mjs` only, in two hunks, each resolved by
   keeping both sides: the import lines, where HEAD adds `ADR_LINES`, `releaseTagOf` and the other
   names of D-2 and D-11 and the base adds `appliedStages` and the `OFFLINE_GH` import, so one line
   changed on both sides becomes the union of the names each side imports, each name once; and two
   `const` definitions both sides added at the same place, both kept. Any other conflict outside
   `openspec/` stops the phase for the owner.

The state then reads `unassigned` above the new merge base, the first record is
`docs/adr/release-at-merge.md` again beside `docs/adr/release-at-merge-step-record.md`, and
`check.py` tolerates both on the branch (D-12; `decisions.md` lists both). The give-back writes no
number of its own (`ADR [release-at-merge]` decision 1). Phase 9 runs on the current base, and task
9.17 runs this worktree's step, now with its record, after the last merge of `origin/main`: the two
records take the next free numbers on the base then, which no task assumes; a later merge of the
base goes through the step (with the record, even after a code conflict). The give-back commit
stales the records, which phase 9's code changes stale anyway.

### D-28 The step's record is read per line (review round 2: adr-reviewer F7, spec-reviewer F8; the owner's decision 1a)

**The finding.** `ADR [release-at-merge-step-record]` decision 3 has `stepRecord` read "the newest
commit" on the branch's first-parent line that names `Release-change: <id>`, decision 4 compares a
line with "the record", and the delta's requirement "A release line the step wrote is known by the
step's own record" says "the step's own latest recorded commit". Since `46c3c2e` (defect 7, found
while implementing task 9.6) the code reads each key from the newest recorded commit that wrote it,
because the whole-commit reading lost a number a later step commit kept (a merge commit of the step
that renumbered nothing names the ADR in a `Release-adr` trailer that counts for nothing, since that
commit did not rename it, so the record of that commit alone no longer held the 0002 the first commit
wrote, and a later merge by hand read `hand`). Evidence
listed it as a deviation; the accepted record and the delta were not touched, and no scenario covers
a number kept across a later step commit.

**The owner's answer (1a, 2026-11-25).** The per-line reading is confirmed, and the code stays as it
is (`stepRecord` in `plugins/openspec/hooks/deliver-check.mjs`; no hook changes in phase 10). It keeps
decision 2 (a key counts for a commit only when that commit changed it from its first parent, the
value read from its tree) and decision 6 (a missing or forged record only refuses more, never passes),
and it is what makes the record's Positive consequence hold for every merge of the base. So the plan
says it in each place that states the reading:

- D-20's sentence on `stepRecord` (revised above): every commit carrying the trailer is a recorded
  commit, and each key takes the newest one that wrote it.
- The delta's requirement "A release line the step wrote is known by the step's own record" reads the
  record per line, and gains the scenario "A number the step kept across a later step commit" (the
  first step commit numbers `docs/adr/0002-feat.md`; the base releases with no ADR; the step's merge
  commit keeps 0002; the base then takes 0002 for `docs/adr/0002-other.md` and changes `src/a.ts`; a
  person merges by hand; the step exits 0 with `docs/adr/0003-feat.md` and the release assigned and
  current). Its proof is the existing test "release-note AC-4 assign: a number the step kept across a
  base merge is still its own after a later merge by hand" (`release-merge.test.mjs`, red before
  `46c3c2e` and green after it in `proof/red-9.txt`), which asserts each part of the THEN; no new test.
- The record: decision 3 and 4's text stays, and the adr-author adds one dated note as the first
  paragraph of its `## Context`, in the form ADR 0022 and ADR 0025 carry (`Note (release-at-merge,
  <date>): ...`), recording the owner's acknowledgement (task 10.1). Its text: "Note (release-at-merge,
  2026-11-25): after review round 2 of change release-at-merge the owner acknowledged the per-line
  reading of decisions 3 and 4: `stepRecord` reads every commit on the branch's first-parent line
  above the base whose last paragraph names `Release-change: <id>`, and each release line takes the
  value of the newest of those commits that wrote it, a trailer still counting only when its commit
  changed what it names (decision 2), so a number an older step commit wrote and a later step commit
  kept stays the step's own. "The newest commit" of decision 3 and "the record" of decision 4 read
  that way. The Decision is otherwise unchanged." The note names no record by a citation token and
  no number of this change, so the release state (which compares the records' names and whether
  `ADR [<slug>]` is still cited, `adrValue`) and the citation pass do not see it. It is a note and not
  a new amending record: it adds no outcome to decision 6 as amended (the outcome "a value the step's
  own recorded commit wrote is given back" is the record's own), and the owner chose the reviewer's
  offered fix.
- The texts that repeat the reading: `docs/openspec-flow.md` already says it per line ("The release
  note" paragraph: "the newest commit whose `Release-` trailers name that line and whose diff from its
  first parent wrote it"; the `--assign` bullet: "line by line, the value the newest of its own
  recorded commits that wrote that line gave it"), so it is not edited. The `ship-change` row
  `assign-release` ends "(the `Release-` trailers of its last commit)", the whole-commit reading; it
  becomes "(the `Release-` trailers of its own commits, each line read from the newest one that wrote
  it)" (task 10.2). The test "release-note AC-4 format: ship-change's assign-release row ... names the
  merge by hand" (`deliver-check-cli.test.mjs`) asserts the part "from its own record", which stays.
- The test "release-note AC-4 record: stepRecord reads the newest recorded commit, ignores a trailer
  whose commit wrote nothing, and is null without one" already asserts the per-key reading (its
  message: "each key takes the newest recorded commit that wrote it"); its name states the old
  reading and is renamed (task 10.3, D-30).

### D-29 An owner's forced merge reads the gates by its own requirement (review round 2: spec-reviewer F9, test-coverage F16, adr-reviewer nit F8, architecture nit F7; the owner's decision 2b)

**The finding.** The delta's MODIFIED requirement "A plain commit on the branch keeps its rule" and its
scenario "The step's commit" say the evidence and the approved reviews stay current after the step's
commit. The canonical requirement "The open items of a forced merge are named"
(`openspec/specs/change-delivery/spec.md`, train 16, merged into this branch at `a47cec8`) lists a gate
file as an open item when a file outside `openspec/` changed after its `Commit:` (scenarios "Evidence
recorded before a product change" and "A review that did not pass"), and its code, `gatesAtHead` in
`deliver-check.mjs`, reads that through a GitHub compare whose files must all be under `openspec/` or
allowed by `verdictAllowed`. The step's commit always changes such files (the manifests,
`CHANGELOG.md`, the ADR rename, the citations), so an owner's forced merge of a noted change would list
`evidence.md` and each approved review as "behind the merged head, which changes <manifest>". Neither
requirement scopes the other.

**The owner's answer (2b, 2026-11-25).** This change's release-edit rule is the normal delivery
path's: the delivery checker, the stage checker and `deliver-check --ci`. The delta's requirement "A
plain commit on the branch keeps its rule" gains one sentence: on an owner's forced merge the evidence
and the reviews are read by the requirement "The open items of a forced merge are named", so the
delivery step's release commit can list them there as open items, an over-report, never a pass. The
scenario "The step's commit" says the same in the last clause of its THEN. `gatesAtHead` is not
changed, the canonical forced-merge requirement gets no MODIFIED block, and the flow page's "An
owner's forced merge" paragraph (a gate file "that holds no passing verdict current at that head,
read through GitHub") already says what the scoped sentence says, so it is not edited.

**Why the scope is safe.** The forced-merge path is reached only when tasks are left unticked at the
merge (`deliveryOf`, `left.length > 0`), and `assign-release` is handed only once the contract is
otherwise met (N6 sits before `enable-auto-merge`), so the case needs an owner who merges with
admin rights while a task is open, and then the evidence of that head is not complete anyway. The
result can only be more open items, never fewer (code-quality and architecture reviewers' judgement
of evidence open item 1). The over-report is the canonical scenario "Evidence recorded before a
product change" applied to the step's commit, which its forced-merge tests on the base already pin
(`deliver-check-archive.test.mjs`, the FMP G-rows); this change writes no test of it, since such a
test would pin the very behaviour the follow-up removes.

**The follow-up, on the roadmap.** Task 10.4 appends, in `openspec/roadmap.md`'s form for a change's
follow-ups (rounds 28k, 28n and 28o: `## Round 28<letter>: follow-ups of <change>`, then `- [ ] <id>
(after: <change>) — <text>`), a new round at the end of the file, its letter the next after the
highest `## Round 28<letter>` the file holds when the task runs (28p while the file ends at 28o), with
one line `forced-merge-release-edit (after: release-at-merge)`. The line waits until this change is
archived (`classifyLines` in `roadmap-loop.mjs` reads an `after:` id as done once it is archived), and
it gives `gatesAtHead` the release-edit allowance in the architecture reviewer's direction: allow the
files of a commit in the compare that carries `Release-change: <id>` (so the step's record of D-20
stays the one owner), or apply the release mask; with the test test-coverage F16 named
(`deliver-check-archive.test.mjs` beside the FMP G-tests: a noted change whose compare from the
evidence commit lists only the step's release files has no gate open). It names this change and its
round 2 findings. The roadmap is under `openspec/`, so the line stales no record; no roadmap line
names this change itself, so the archive ticks nothing. The line, word for word, on one line of the
file:

```text
- [ ] forced-merge-release-edit (after: release-at-merge) — from review round 2 of release-at-merge (spec-reviewer F9, test-coverage-reviewer F16, adr-reviewer F8, architecture-reviewer F7; the owner's answer 2b of 2026-11-25): on an owner's forced merge, `gatesAtHead` (`plugins/openspec/hooks/deliver-check.mjs`) reads each gate file through a GitHub compare whose files must all be under `openspec/` or allowed by `verdictAllowed`, so the commit of the `assign-release` step (the manifests, `CHANGELOG.md`, the ADR rename, the citations) lists `evidence.md` and each approved review as open items, an over-report and never a pass, while "A plain commit on the branch keeps its rule" reads them as current on the normal delivery path, the only one release-at-merge gave its release-edit rule. Give `gatesAtHead` the release-edit allowance: allow the files of a commit in the compare that carries `Release-change: <id>` (the step's record, so it stays the one owner), or apply the release mask; drop the forced-merge sentence release-at-merge wrote into that requirement; and add the test beside the forced-merge G-rows of `deliver-check-archive.test.mjs`: a noted change whose compare from the evidence commit lists only the step's release files opens no gate.
```

### D-30 The round 2 nits taken, and the rest

Taken, each a one-line text fix in a file this change already edits, with no behaviour change, so no
test is written first:

- The `app` host bullet of `plugins/openspec/skills/ship-change/SKILL.md` (adr-reviewer nit F9,
  spec-reviewer nit F10, code-quality nit F9, test-coverage nit F17; evidence open item 2): after the
  sentence that starts "A merge conflict is reported `blocked: item 5`, except in a project with a
  delivery train" and ends "never because Auto-fix reported the conflict.", one sentence is inserted,
  the rest of the bullet unchanged: "A change with a release note, in a project that names
  `devkit.release_tag` and has no delivery train, is the other exception: `next` answers its conflict
  with the base with `assign-release` (row N5), and the session runs that row." No test pins the
  bullet (a `grep` of the test files finds no assertion of "Auto-fix" or of the sentence); the tests
  that read `ship-change` slice its rows (`| \`<step>\` |`) or the `## Hosts` section for "archive PR"
  and "two|twice" (`deliver-check-archive.test.mjs`, "format: ship-change Start takes the id ..."),
  which stay true (task 10.2).
- The test names that state the old citation rule (test-coverage nit F20) and the one that states the
  old record reading (D-28). Each is a rename with the assertions unchanged (task 10.3); invariant,
  layer and suite:
  - `release-note.test.mjs`: "release-note AC-7 citation: an ADR [x] literal in a changed .mjs file is
    neither cited nor rewritten" becomes "release-note AC-7 citation: an ADR [x] literal in a changed
    test file is neither cited nor rewritten" (its file is `x.test.mjs`; since D-18 a plain `.mjs` is
    cited). Invariant: a test file's `ADR [<x>]` literal is never cited, counted as still cited or
    rewritten; layer: the citation scope (`holdsCitations`, `CITATION_PATHSPEC`) read by the step;
    suite: `release-note.test.mjs`.
  - `release-note.test.mjs`: "release-note AC-7 citation: the same token in a changed .md file is
    refused while unlanded and rewritten once landed, the .mjs literal never" becomes "... rewritten
    once landed, the literal in the test file never" (the same `x.test.mjs`, the same reason, taken by
    the planner because it states the rule the nit names). Same invariant, layer and suite.
  - `delivery-train.test.mjs`: "release-note AC-7 join: a head numbered before the train is renumbered
    in its Markdown citations, and its source literals stay as written" becomes "... and its test-file
    literals stay as written" (its file is `src/beta.test.mjs`; D-18 names this test with the two
    above). Invariant: the join leaves a test file's literal as written; layer: `release-merge.mjs
    --merge`'s rewrite; suite: `delivery-train.test.mjs`.
  - `release-note.test.mjs`: "release-note AC-4 record: stepRecord reads the newest recorded commit,
    ignores a trailer whose commit wrote nothing, and is null without one" becomes "release-note AC-4
    record: stepRecord reads each key from the newest recorded commit that wrote it, ignores a trailer
    whose commit wrote nothing, and is null without one". Invariant: the record is read per key;
    layer: `stepRecord` in `deliver-check.mjs`; suite: `release-note.test.mjs`.

  A `git grep` at `9b67c11` finds the old names only in the two test files and in this change's
  folder: `proof/red-9.txt` keeps its runs as they were printed, `evidence.md` is the verifier's to
  write again, and D-18 and D-26 above keep the names phase 9 used, with this pointer.

Not taken, each a follow-up (`tasks.md`, "Workflow follow-up"), because it is code or a new test, not
a one-line text fix: test-coverage nit F18 (no test that the join's commit carries no record), nit F19
(no test of the give-back skipping a citation path the merge by hand deleted), architecture nit F8
(`numberRelease` reads the record a second time after `releaseStateAt`; return it from the state), and
the nits carried from round 1 (adr-reviewer F3 and F4, architecture F3, test-coverage F11 to F13).
code-quality nit F10 (the merge `a47cec8` resolved two conflicts outside `openspec/` that task 9.1
did not expect, on the coordinating session's word, where task 9.1 says to stop for the owner) is a
process point with a correct result, flagged for the owner (F-11), with no task.

## Findings of review round 1

Every finding of the five verdict files, with its decision and task, or the reason it gets none.

| Reviewer | Finding | Severity | Answer |
|---|---|---|---|
| adr-reviewer | F1 citations only in Markdown and YAML | blocking | fixed: D-18; tasks 9.2 to 9.4 |
| adr-reviewer | F2 readiness not run again on a note-only revision | important | fixed: D-21; tasks 9.8 to 9.10, S-12 (9.15) |
| adr-reviewer | F3 decision 4's "no train" | nit | follow-up (D-25): the record is accepted and not edited; F-6's reading stands |
| adr-reviewer | F4 `.compozy/kit-manifest.json`'s `pack` | nit | follow-up: a change of the kit installer (it records the pack's version, which the step does not write); three reviewers accepted it as informational |
| adr-reviewer | F5 `origin/main` moved | nit | fixed: D-27; tasks 9.1 and 9.17 |
| spec-reviewer | F1 citations narrower than the requirement | important | fixed: D-18 (code back to the requirement, which now names the test exclusion) |
| spec-reviewer | F2 canonical conflict scenarios contradict the delta | important | fixed: D-25, the MODIFIED `change-coordination` block |
| spec-reviewer | F3 readiness gap | important | fixed: D-21, the MODIFIED `change-stages` block |
| spec-reviewer | F4 check.py rules with no requirement | important | fixed: D-25, two ADDED requirements; AC-6 names the unlisted rule |
| spec-reviewer | F5 renumbered own ADR not named | nit | fixed: D-25 |
| spec-reviewer | F6 old train requirement unscoped | nit | fixed: D-25 |
| spec-reviewer | F7 `--assign` exit with no setting | nit | fixed: D-24; task 9.11 |
| code-quality-reviewer | F1 no way back after a merge by hand | blocking | fixed: D-20; tasks 9.5 to 9.7, P-13 (9.14) |
| code-quality-reviewer | F2 `<slug>.md` rewritten anywhere | important | fixed: D-19; tasks 9.2 to 9.4 |
| code-quality-reviewer | F3 readiness stall | important | fixed: D-21 |
| code-quality-reviewer | F4 mask in every file | nit | fixed: D-18 |
| code-quality-reviewer | F5 `## ` in the changelog body | nit | fixed: D-23; tasks 9.11, 9.12 |
| code-quality-reviewer | F6 `ADRs:` entry form | nit | kept, reason in D-25; follow-up |
| test-coverage-reviewer | F1 pin-only conflict on re-assign | important | test: D-26; task 9.11 |
| test-coverage-reviewer | F2 consumer re-assign | important | test: D-26; task 9.11 |
| test-coverage-reviewer | F3 release-file mask for a consumer | important | tests: D-26; task 9.11 |
| test-coverage-reviewer | F4 manifests on the merged text | important | test: D-26; D-6 step 3 revised; task 9.11 |
| test-coverage-reviewer | F5 readiness gap | important | fixed: D-21 |
| test-coverage-reviewer | F6 ship-change clause and row | important | tests: D-26; task 9.11 |
| test-coverage-reviewer | F7 step refusals untested | nit | test: D-26 (with D-24) |
| test-coverage-reviewer | F8 AC-9 for trains | nit | test: D-26 |
| test-coverage-reviewer | F9 N6 before `ready-base` | nit | test: D-26 |
| test-coverage-reviewer | F10 restore's new branch | nit | test: D-26 |
| test-coverage-reviewer | F11 the AC-13 tests are fed by the gh fixture | nit | follow-up, accepted: the tag path is ADR 0019's unchanged code, and P-12 proves it end to end |
| test-coverage-reviewer | F12 an impossible fixture number in `conduct-check.test.mjs` | nit | follow-up: the asserted rule does not depend on the number |
| test-coverage-reviewer | F13 no red run recorded for the defect fixes | nit | accepted for phases 1 to 8 (a red run cannot be made again after the fix); phase 9 saves each red run to `proof/red-9.txt` |
| architecture-reviewer | F1 readiness and the note have two owners | important | fixed: D-21, the reviewer's direction (a), by mtime as the stages already are |
| architecture-reviewer | F2 approvalState's option | important | fixed: D-22; tasks 9.8 to 9.10 |
| architecture-reviewer | F3 numbered-name lookups in five places | nit | partly: D-19's one helper for the citation forms; the rest a follow-up |
| architecture-reviewer | F4 D-6 step 3's wording | nit | fixed: D-6 step 3, D-26's test |
| architecture-reviewer | F5 exit 2 for a setup error | nit | fixed: D-24 |

The readiness review of the revised plan (attempt 4, NEEDS-REVISION) and its answers:

| Item | Finding | Answer |
|---|---|---|
| M1 | D-20 changes `ADR [release-at-merge]` decision 6, so it needs a record, not a reading | fixed: `ADR [release-at-merge-step-record]` (drafted by the adr-author, listed in `decisions.md`); D-20 "The record of the decision"; F-8; the `ADRs:` line and its test (D-20, D-26); the numbering at task 9.17 and the test of two records of one change (task 9.5) |
| M2 | the base is `a815222` (train 15), whose "A base that moved on the remote" contradicts the delta | fixed: D-27 restated; D-25's MODIFIED `change-coordination` block; F-10; the guard test of the noted case (task 9.11) |
| M3 | the give-back's exit 2 has no scenario and no test | fixed: D-20; the scenario "A line the step wrote, edited after its record"; the D-26 test (task 9.5) |
| M4 | the flow page repeats decision 6 in two places task 9.6 does not name | fixed: D-20 "The texts that repeat decision 6" (three places, by text; no test asserts them); task 9.6 |
| O1 | which keys `reassign` holds and what the give-back touches | taken: D-20; the D-26 record test (task 9.5) |
| O2 | whether the join reads the record | taken: D-20, "Where it is read" (one sentence; no join test, since no boarded head holds a record) |
| O3 | the flow-version requirement, and the audit staled by the note | taken: D-21 (the audit keeps `newestPlan`); the conduct test's audit check |
| O4 | task 9.17's diff check too wide after a merge commit | taken: task 9.17 checks `openspec/changes/release-at-merge/` |
| O5 | the changelog body of `release.md` | not taken: `release.md` is outside this revision's files; the approval covers the note, and the implementer's evidence names the record and the recovery |
| O6 | the test-folder exclusion also skips Markdown there | taken: F-9 |
| O7 | the proposal over two pages | partly: the revision added only the lines M1 and M2 need |
| Low | D-22's folder outside the layout has a test but no scenario | taken: the scenario "A folder outside a project's layout" |

The readiness review of attempt 5 (NEEDS-REVISION) and its answers:

| Item | Finding | Answer |
|---|---|---|
| N1 | task 9.6's done condition greps for a phrase D-20's new sentence keeps | fixed: task 9.6 checks that `derived, with no marker commit` (the old text only) prints 0 and that `what the step's own last recorded commit wrote` (the new text) is present |
| O1 | the step record's decisions 4 and 5 differ from D-20 | not taken here: the record is the adr-author's, and a proposed record is aligned before the owner accepts it with the plan, not by a phase 9 task; the coordinating session has the adr-author align it before the approval |
| O2 | what `reassign` holds | taken: D-20, "What the give-back touches" (state keys only; citation paths go back with their `Release-adr` entry and are never keys) |
| O3 | when the `Amended by` line is added | taken: decided as the standing convention, added at task 9.1a (after 9.1, before 9.6); D-20, "The `Amended by` line"; F-8; the D-26 test of the header line (task 9.2) |
| O4 | the second record is untracked before 9.1 | taken: the paragraph before task 9.1 |
| O5 | the dependency line calls `ADR [release-at-merge]` proposed | taken: the Dependencies of phase 9 |
| O6 | the proposal over two pages | not taken: `proposal.md` is outside this revision's files |

## Findings of review round 2

Round 2 (`review.md` at `c1c875e`) failed on four important findings, each confirmed by its finding
verifiers (12, none refuted); code-quality and architecture approved. Every finding of the five
verdict files of round 2 that is not a round 1 finding marked fixed, with its answer. The owner's
decision of 2026-11-25 ("1a e 2b") settles the two themes the review escalated.

| Reviewer | Finding | Severity | Answer |
|---|---|---|---|
| adr-reviewer | F7 `stepRecord` per key against decision 3's "the newest commit" | important | owner 1a: D-28; the adr-author's dated note in the record (task 10.1), D-20's sentence, the delta's per-line requirement and its new scenario |
| adr-reviewer | F3 decision 4's "no train" (carried) | nit | follow-up, as in round 1 (D-25) |
| adr-reviewer | F4 `.compozy/kit-manifest.json`'s `pack` (carried) | nit | follow-up, as in round 1 |
| adr-reviewer | F8 `gatesAtHead` with no release-edit allowance | nit | owner 2b: D-29; the delta scoped (one sentence), the roadmap follow-up (task 10.4) |
| adr-reviewer | F9 the `app` host sentence of `ship-change` | nit | taken: D-30; task 10.2 |
| spec-reviewer | F8 the requirement's "latest recorded commit" against the per-key code; no scenario of a kept number | important | owner 1a: D-28; the requirement read per line and the scenario "A number the step kept across a later step commit", proven by the existing test of defect 7 |
| spec-reviewer | F9 the delta's step commit against the canonical "The open items of a forced merge are named" | important | owner 2b: D-29; "A plain commit on the branch keeps its rule" and its scenario "The step's commit" scoped to the normal path; `gatesAtHead` unchanged; the roadmap follow-up (task 10.4) |
| spec-reviewer | F10 the `app` host sentence and row N5 | nit | taken: D-30; task 10.2 |
| code-quality-reviewer | F9 the `app` host sentence and row N5 | nit | taken: D-30; task 10.2 |
| code-quality-reviewer | F10 the merge `a47cec8` resolved conflicts task 9.1 did not expect | nit | no task: the result keeps both sides, as three reviewers checked; flagged for the owner (F-11) |
| test-coverage-reviewer | F16 `gatesAtHead` after the step's commit, untested | important | owner 2b: D-29; no test of the over-report (the base's FMP G-rows pin the canonical rule); the fix and its test are the roadmap follow-up (task 10.4) |
| test-coverage-reviewer | F11, F12, F13 (carried) | nit | accepted follow-ups, as in round 1 |
| test-coverage-reviewer | F17 the `app` host sentence and row N5 | nit | taken: D-30; task 10.2 |
| test-coverage-reviewer | F18 the join's commit carries no record, untested | nit | follow-up: a new test (`delivery-train.test.mjs`), not a text fix |
| test-coverage-reviewer | F19 the give-back's skip of a citation path the merge by hand deleted, untested | nit | follow-up: a new test (`release-merge.test.mjs`), not a text fix |
| test-coverage-reviewer | F20 a test name states the old citation rule | nit | taken: D-30, with its sibling of the same rule and the join test D-18 names; task 10.3 |
| architecture-reviewer | F3 numbered-name lookups in several places (carried) | nit | follow-up, as in round 1 |
| architecture-reviewer | F7 `gatesAtHead` does not follow the release-edit rule | nit | owner 2b: D-29; the roadmap line takes the reviewer's direction (task 10.4) |
| architecture-reviewer | F8 `numberRelease` reads the record a second time | nit | follow-up: code, not a text fix |

The praise findings need no answer. Every reviewer accepted the deviations evidence listed for round
2 except the per-key record, which D-28 answers; evidence's two open items are D-29 (the forced
merge) and D-30 (the `app` host sentence).

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
- F-8 (after review round 1, D-20; resolved by `ADR [release-at-merge-step-record]`): `ADR
  [release-at-merge]` decision 6 derives the state "with no marker commit" and refuses "anything
  else" as edited by hand. D-20 reads the trailers of the step's own commit to tell its own earlier
  output from a hand edit, which adds an outcome to decision 6, so the readiness review (attempt 4,
  M1) asked for a record rather than a reading, as `openspec/config.yaml`'s design rule says. The
  adr-author drafted `ADR [release-at-merge-step-record]` (proposed), which amends decision 6 and
  carries D-20's rejected alternatives; `decisions.md` lists it, and the owner accepts it with the
  plan. The decision text of `ADR [release-at-merge]` is not edited. Its header line `- Amended by
  ADR [release-at-merge-step-record] (release-at-merge-step-record.md)` is decided, not asked: the
  coordinating session settled it as the repository's standing convention (every amended accepted
  record carries one such line per amender; ADR 0022 and ADR 0025 received theirs in this change).
  The adr-author adds it at task 9.1a, after 9.1 un-numbers the record and before 9.6, and the
  `ADRs:` entry of the first record says `amended by ADR [release-at-merge-step-record]` (task 9.6);
  D-20, "The `Amended by` line", gives the reasons, the numbering of both tokens at task 9.17 and the
  D-26 test that covers it.
- F-9 (after review round 1, D-18): decision 3 says "every citation in a tracked text file outside
  `openspec/changes/`"; D-18 leaves out test files and fixtures, reading a test literal as test data
  and not a citation of a record (the exclusion adr-reviewer F1 offered as its first fix). No new
  record. The folder part of the exclusion (`test/`, `tests/`) also skips Markdown and YAML kept in
  such a folder, wider than test data; the repository has none today (readiness attempt 4, O6), and
  the owner confirms the reading at the plan approval.
- F-10 (after review round 1, D-25): two widenings found while revising, flagged rather than taken
  silently: the `change-stages` capability joins the four the proposal named (B1's requirement lives
  there), and the canonical scenario "A conflict only in release files" is scoped to a change with no
  note beside the two the spec review named, since it contradicts the ADDED conductor requirement in
  the same way. A third, after the readiness review of attempt 4 (M2): train 15's canonical
  requirement "The loop fetches the base branch before it judges a delivery step" joins the
  `change-coordination` delta as a MODIFIED block, its scenario "A base that moved on the remote"
  scoped to a change with no note and one scenario added for a noted change (D-25).
- F-11 (after review round 2, code-quality nit F10): the merge `a47cec8` resolved, besides the two
  `change-loop.mjs` hunks task 9.1 expected, `openspec/config.yaml`'s `ADRs:` line and the session
  bullet of `plugins/openspec/skills/devkit/SKILL.md`, keeping both sides, on the coordinating
  session's word, where task 9.1 says another conflict outside `openspec/` stops the phase for the
  owner. Three reviewers checked that both sides are kept, so no task changes it; the owner confirms
  the resolution or asks for it again.

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
- [A record trailer typed by hand] → D-20 reads values from the commit's tree and counts a key only
  when that commit changed it; a forged trailer on a commit that wrote the same lines by hand would
  pass, which the train check and the reviews of that commit still see.

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

### Phase 9: the fixes of review round 1

Order: the merge of the base with the numbers given back (D-27) → the citations (D-18, D-19) → the
record and the step after a merge by hand (D-20) → the readiness and the approval (D-21, D-22) → the
note body, the exit code and the coverage gaps (D-23, D-24, D-26) → the real runs (P-1 to P-13, S-12)
→ the dogfood and the whole suite.

- **Hooks:** `deliver-check.mjs` (`CITATION_PATHSPEC`, `holdsCitations`, `adrFileRe`, `maskRelease`,
  `stepRecord`, `releaseStateAt`, `approvalState`, `namesReleaseTag`, `parseReleaseNote`),
  `release-merge.mjs` (`rewriteCitations`, `unassign`, `numberRelease`'s give-back and trailers,
  `main`'s exit 3), `flow-check.mjs` (`collectFlow`'s `noteFiles`, `artifactState`'s `staleAfter`
  loop), `conduct-check.mjs` (`planFacts`' `newestPlan`, the `approve` reason), `change-loop.mjs`
  (`acceptDecisions`' refusal, `namesReleaseTag` imported).
- **Skills and docs:** `plugins/openspec/skills/ship-change/SKILL.md` (the `assign-release` row),
  `docs/openspec-flow.md` (the `--assign` bullet, "The release note" and its row N3, D-20),
  `openspec/config.yaml` (the second record in the `ADRs:` line, D-20).
- **Records:** `docs/adr/release-at-merge-step-record.md`, drafted by the adr-author and not edited
  by any task; `docs/adr/release-at-merge.md` gains its `- Amended by` header line from the
  adr-author at task 9.1a; the step numbers both records at task 9.17.
- **Proof:** `proof/cases.mjs` (P-13), `proof/agents.mjs` (S-12), `proof/real-run.md` written anew,
  `proof/agents-run.md` and `proof/dogfood.md` appended, `proof/red-9.txt` created.

Files to create: `openspec/changes/release-at-merge/proof/red-9.txt` (and, in this revision,
`specs/change-stages/spec.md`). Files to modify: the hooks above and
`plugins/openspec/hooks/{release-note,release-merge,deliver-check,deliver-check-cli,delivery-train,delivery-train-after,flow-check,conduct-check,change-loop}.test.mjs`
(new tests; the existing ones only as D-18 and D-26 say), `plugins/openspec/hooks/change-loop.test.mjs`
(the fetch guard), the texts and `openspec/config.yaml`, the three proof scripts and records; at the
dogfood, the release files, `docs/adr/release-at-merge.md`, `docs/adr/release-at-merge-step-record.md`
and their citations. Files to delete: none.

Estimate for phase 9: optimistic 19 h, likely 28 h, pessimistic 44 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| The merge of the base with the numbers given back (D-27) | 2 | Migration | MEDIUM |
| Citations in every text file, the anchored file form, their tests (D-18, D-19) | 4 | Core | MEDIUM |
| The step's record, the state, the give-back, the recovery texts, the second record's line, their tests (D-20) | 8 | Core | HIGH |
| Readiness sees the note, every reader of the approval, their tests (D-21, D-22) | 3 | Core | MEDIUM |
| Note body, exit 3, coverage gaps and nits (D-23, D-24, D-26) | 4 | Testing | LOW |
| P-1 to P-13 again (D-16) | 3 | Testing | MEDIUM |
| S-12 with the real agents (D-16) | 2 | Testing | MEDIUM |
| Dogfood again and the whole suite (D-17, D-27) | 2 | Migration | MEDIUM |

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The merge of 9.1 meets a conflict that is not append-only | MEDIUM × MEDIUM | the phase stops for the owner (task 9.1); the numbers are given back first, so the release files cannot conflict |
| The wider citation scope finds an `ADR [<x>]` in a source file of a consumer project | LOW × MEDIUM | the step names the file and the slug (exit 2, as for Markdown); the repository has none (D-18's grep) |
| A three-way give-back meets a line the person edited by hand | LOW × MEDIUM | exit 2 naming the path, the head and the tree as they were (D-20, its scenario and test); the person fixes that line |
| Two records of one change whose slugs share a prefix (`release-at-merge`, `release-at-merge-step-record`) are rewritten or masked one for the other | LOW × HIGH | the whole-token rule of D-4 and D-19; the D-26 test of two records of one change builds that shape (`feat`, `feat-store`) |
| A clone that cannot read the record | LOW × LOW | null record: the trees decide, `hand`, never a false pass (D-20) |
| The note counted with the tasks stage stales a readiness the owner already saw | LOW × LOW | only before the work starts, and only when `release.md` is newer (D-21) |
| A test reads the step's commit message whole | LOW × LOW | the subject is unchanged; the grep at `41dd40e` finds only `--format=%s` reads of it (`release-merge.test.mjs`) |
| `origin/main` moves again during phase 9 | MEDIUM × MEDIUM | task 9.17 runs the step after the last merge, with its record; the coordinator holds `main` at the release step (D-17) |

Assumptions of phase 9: `git log --first-parent <tip>..<head>` reaches the step's commits in every
clone that computes the release state (`.github/workflows/devkit-reviews.yml` and the setup template
check out with `fetch-depth: 0`; `--ci` reads no record); the trailer convention of `git
interpret-trailers`, a last paragraph of `Key: value` lines, is what the step writes and
`stepRecord` reads; the main session runs task 9.1's merge on the local `origin/main` the coordinating
session last fetched.

Dependencies: `ADR [release-at-merge]` (accepted by the owner at the change's first plan approval,
its header `Status: accepted`); ADR 0019 (tag rule,
unchanged); ADR 0022 and ADR 0025 (amended); ADR 0003, ADR 0027 and ADR 0030 (built on, unchanged);
`archive-release-pin` (merged, train 4) for the pin definition in `deliver-check.mjs`, the pin test
that reads the manifest and the base text of `CONTRIBUTING.md` step 5 and the flow page (D-17; nothing
waits on it); `release-merge-leftovers` (merged, train 3) for the change-delivery spec; for phase 9,
`run-status-bar` and the archive of `stage-ceiling-consecutive` (merged, trains 13 and 14) and the
archives of `fresh-base-check` and `run-status-bar` (train 15, `origin/main` at `a815222`) for the base
task 9.1 merges (D-27), which changed `flow-check.mjs`'s `artifactState` next to D-21's loop, the
`change-stages` spec outside the requirement D-21 modifies and the `change-coordination` requirement
D-25 modifies; `ADR [release-at-merge-step-record]` (proposed, accepted by the plan approval; amends
`ADR [release-at-merge]` decision 6; builds on ADR 0020 and ADR 0025, unchanged).

### Phase 10: answers to review round 2

Order: the record's note (D-28, the adr-author) → the `ship-change` texts (D-28, D-30) → the test
names (D-28, D-30) → the roadmap follow-up (D-29) → the phase gate → the final gate. The spec delta
and this design carry the rest of 1a and 2b already; no hook changes.

- **Hooks:** none. `stepRecord`, `releaseStateAt` and `gatesAtHead` in
  `plugins/openspec/hooks/deliver-check.mjs` stay as they are.
- **Skills:** `plugins/openspec/skills/ship-change/SKILL.md`: the `assign-release` row's last
  parenthesis (D-28) and one sentence in the `app` host bullet (D-30).
- **Tests:** renames only, assertions unchanged: three in `plugins/openspec/hooks/release-note.test.mjs`
  and one in `plugins/openspec/hooks/delivery-train.test.mjs` (D-30).
- **Records:** `ADR [release-at-merge-step-record]`'s file (`docs/adr/<NNNN>-release-at-merge-step-record.md`,
  numbered at task 9.17) gains the dated note from the adr-author (D-28); no other record changes.
- **Repository:** `openspec/roadmap.md` gains the follow-up round (D-29).

Files to create: none. Files to modify: the five above. Files to delete: none. No task writes a
version, a changelog line, a CI pin or an ADR number; when the base moves, the delivery's
`assign-release` step numbers the branch again from its record, as D-20 says.

Estimate for phase 10: optimistic 1.5 h, likely 2.5 h, pessimistic 4 h (the final gate's whole suite
takes about 20 minutes on an idle machine, and longer under load).

| Component | Hours | Type | Risk |
|---|---|---|---|
| The record's dated note, by the adr-author (D-28) | 0.5 | Documentation | LOW |
| The `ship-change` row and host sentence (D-28, D-30) | 0.25 | Documentation | LOW |
| The four test names (D-30) | 0.25 | Testing | LOW |
| The roadmap follow-up round (D-29) | 0.25 | Documentation | LOW |
| The phase gate and the final gate | 1.25 | Testing | MEDIUM |

| Risk | Probability × impact | Mitigation |
|---|---|---|
| The note or a text edit carries a citation token or a number the step would read | LOW × MEDIUM | the note's text is fixed in D-28 and holds no `ADR [<slug>]` and no number of this change; task 10.1 checks `git grep` for the token |
| An edited `ship-change` line breaks a test that reads the skill | LOW × LOW | D-30's grep found no assertion of the host sentence; the row keeps "from its own record"; the phase gate runs every test file that reads the skill's rows and hosts |
| A renamed test is run by a filter that still names the old text | LOW × LOW | no gate or proof script filters by those names (`git grep` at `9b67c11`); the gates run whole files |
| `openspec/roadmap.md` meets a base that appended a round of the same letter | MEDIUM × LOW | the task takes the next free letter when it runs; a later merge conflict there lies under `openspec/`, and the round is kept beside the base's (the step's merge by hand of D-20 if it comes with the step) |
| The phase's commits stale the evidence and the reviews | HIGH × LOW | expected: a product text and a record change after `c1c875e`; the verification and the review run again on the new head, as the loop asks |
| The base moves and the release must be assigned again | MEDIUM × MEDIUM | the delivery's `assign-release` runs the step with its record (D-20); no task writes a number; the coordinator holds `main` at the release step (D-17) |

Assumptions of phase 10: the record of the step stays at `docs/adr/` under the number task 9.17 gave
it until the delivery (`git ls-files docs/adr` at `9b67c11` lists it numbered); the adr-author writes
only under `docs/adr/` (`guard.mjs` `isDecisionRecord`); the roadmap's `after:` waits on an archived
id (`roadmap-loop.mjs` `classifyLines`); the whole suite at the final head is the one gate a text
change of a skill needs beyond the filtered files (CLAUDE.md, "Commands").

Dependencies: the owner's decision of 2026-11-25 ("1a e 2b"); `ADR [release-at-merge-step-record]`
(accepted, numbered at task 9.17); the canonical `change-delivery` requirement "The open items of a
forced merge are named" and `gatesAtHead` (train 16, `forced-merge-path`, merged at `a47cec8`),
unchanged; ADR 0028 (an owner's forced merge leads the change to the archive), unchanged.
