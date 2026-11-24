<!-- devkit-stage proposal result=passed attempt=1 commit=511d3e753d1069c89bb5d35a26de195d254d0301 -->
# Proposal

Change: `own-pr-archive-paths` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: the round 19b line of `openspec/roadmap.md`, the `project-phases-followups` retro, learning
1, and the owner-confirmed `requirements.md`).

## Why

`isOwnPr` in `plugins/openspec/hooks/deliver-check.mjs` refuses every pull request that changes any
file under `openspec/changes/archive/`. A change whose own pull request also edits another change's
archived files (as `project-phases-followups` did with the archived `project-phases` plan, PR #61) is
then never found after its merge: `findChangePr` answers `{ none: true }`, `/devkit change` asks to
open a pull request that is already merged, and the archive has to run by hand. The rule meant to
keep the change's own archive pull request out; it should refuse only the change's own archive
folder.

## What Changes

- `isOwnPr(id, pr, files)` refuses a pull request for its files only when one of them sits in the
  change's own archive folder, `openspec/changes/archive/<YYYY-MM-DD>-<id>/`, with the exact id
  (the folder name read with the module's existing `ARCHIVED` pattern, the name compared by
  equality). A file of another change's archive folder, a file directly under
  `openspec/changes/archive/`, or a folder there whose name is not `<date>-<name>` no longer refuses
  it. Its two other rules stay: an archive head (`isArchiveHead`) is refused, and some file must sit
  under `openspec/changes/<id>/`.
- The comment above `isOwnPr` and the "Finding the change PR" paragraph of `docs/openspec-flow.md`
  say the same rule.
- New tests in `plugins/openspec/hooks/deliver-check.test.mjs`, beside the `field-fixes 4
  delivered` group: the predicate (AC-1 to AC-4 and the edge paths) and `findChangePr` finding such a
  merged pull request in the `merge` ship mode (AC-5).
- A devkit-openspec patch release (version, marketplace, `CHANGELOG.md`, the CI pin of
  `docs/openspec-flow.md`).

Not changed (from `requirements.md`, "Out of scope"): the flow after an admin merge below 8/8 and the
lookup of a pull request whose branch GitHub deleted (that is `forced-merge-path`); how
`findChangePr` selects, orders or limits the merged pull requests it reads; `isArchiveHead` and
`archiveHeads`; the delivery contract items, `change-loop.mjs` and `flow-check.mjs`.

## Acceptance criteria

Copied from `requirements.md`, with their ids (six, as the owner confirmed them).

- AC-1 `own-archive-refused` — `isOwnPr('foo', { headRefName: 'ship/foo' }, ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-foo/retro.md'])` is `false`.
- AC-2 `other-archive-allowed` — `isOwnPr('foo', { headRefName: 'ship/foo' }, ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-bar/retro.md'])` is `true`: a pull request that edits another change's archived files is still `foo`'s own when it changes a file of `openspec/changes/foo/`.
- AC-3 `id-prefix-not-confused` — the archive folder `openspec/changes/archive/2026-11-09-foo-two/` does not refuse `foo`'s pull request, and `openspec/changes/archive/2026-11-09-foo/` does not refuse `foo-two`'s.
- AC-4 `archive-head-still-refused` — a pull request whose head is `chore/archive-bar` or `archive-bar` is refused whatever its files, as today.
- AC-5 `found-after-merge` — through `findChangePr` in the `merge` ship mode, a merged pull request whose files are `openspec/changes/<id>/tasks.md` and another change's archived `retro.md` is found (`{ pr, via: 'list' }`), where it was `{ none: true }` before; a test with the fake `gh` of `deliver-check.test.mjs` proves it.
- AC-6 `no-regression` — every existing `field-fixes 4 delivered` test in `deliver-check.test.mjs` stays green, and `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-delivery`: MODIFIED "A change's own pull request": the files rule refuses only the
  change's own archive folder, not any folder under `openspec/changes/archive/`; three scenarios
  added (another change's archived files, the change's own archive folder, an id that starts
  another's).

## Impact

- devkit-openspec (patch release): `hooks/deliver-check.mjs` (`isOwnPr` and its comment only) and
  `hooks/deliver-check.test.mjs` (new tests; the existing `isOwnPr` test's title and one assertion
  message reworded, its assertions unchanged). `mergedOnBranch`, `findChangePr`, `deliveryOf`,
  `change-loop.mjs`, `flow-check.mjs`, `guard.mjs`, the schemas and the panel do not change; the
  callers get the fix through `isOwnPr` alone.
- No JSON contract, reason code, step name or schema key changes.
- The `devkit-reviews` check (`deliver-check.mjs --ci`) does not call `findChangePr`; it is
  unaffected.
- Docs: `docs/openspec-flow.md` ("Finding the change PR" and the CI pin), `CHANGELOG.md`,
  `.claude-plugin/marketplace.json`, `plugins/openspec/.claude-plugin/plugin.json`.

**Exit criteria.** The gates of `tasks.md`, each a filtered run of `deliver-check.test.mjs` plus
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `claude plugin validate .`;
and `openspec validate own-pr-archive-paths --strict`. The whole hook suite
(`node --test plugins/openspec/hooks/guard.test.mjs`) runs once, before the delivery, when the
coordinating session gives a place (`requirements.md`, last assumption).

**Dependencies.** `project-phases-followups` (archived; its retro, learning 1, is this change).
`coordinator-field-fixes` (archived; its D-4 introduced `isOwnPr` and the rule this change narrows).
The sibling `forced-merge-path` (open in the roadmap) does not touch `isOwnPr`, and this change does
not touch the lookup by branch or by number. A sibling that also bumps devkit-openspec meets this
bump at the release step (`CONTRIBUTING.md`, step 5).

**Decisions cited.** ADR 0003 (the archive pull request carries no delivery contract and starts after
the change is delivered: the change's own archive pull request stays out of `isOwnPr`, by its head
and by its own archive folder); ADR 0017 decision 1 (a change's state is derived in one place:
the fix lives in the one predicate every reader goes through). No new ADR is needed: no decision
changes.

**Open decisions inherited.** None; no point of `docs/coordination-design.md` ("Open points") is
touched.
