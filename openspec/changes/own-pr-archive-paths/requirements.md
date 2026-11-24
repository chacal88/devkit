<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> `isOwnPr` in `plugins/openspec/hooks/deliver-check.mjs` drops any pull request that touches `openspec/changes/archive/`, so a change whose own pull request edits another change's archived files is never found after its merge and `/devkit change` asks to open it again; refuse only a pull request that touches the change's own archive folder, and pin it with a test

## Classification

domain=process type=bug flags=[] (devkit-lite, confirmed by the owner on 2026-11-23: small, easy to undo, no screen, no boundary, no new contract)

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- The change is the predicate `isOwnPr(id, pr, files)` in `plugins/openspec/hooks/deliver-check.mjs` (line 616 today): its second rule, `files.some((f) => f.startsWith('openspec/changes/archive/'))`, becomes a check on the change's own archive folder only. Its other two rules stay: a head that `isArchiveHead` names is refused, and some file must sit under `openspec/changes/<id>/`.
- A change's own archive folder is `openspec/changes/archive/<YYYY-MM-DD>-<id>/`, with the exact id. The check takes the first path segment after `openspec/changes/archive/`, matches it with the module's existing `ARCHIVED` pattern (`/^(\d{4}-\d{2}-\d{2})-(.+)$/`) and compares the captured name with `id` by equality, so an id such as `foo` never matches the archive folder of `foo-two`, and an id with a `.` is never read as a pattern.
- A file directly under `openspec/changes/archive/` (no folder segment, for example an index file) is not any change's own archive folder and does not refuse the pull request.
- The change's own archive pull request stays refused twice over: by its head (`chore/archive-<id>` or `archive-<id>`, through `isArchiveHead`) and now by its files (they sit in the change's own archive folder).
- Callers do not change: `mergedOnBranch` and `findChangePr` (`plugins/openspec/hooks/deliver-check.mjs`, lines 660 and 696) keep calling `isOwnPr(id, head, files)`; `change-loop.mjs` and `flow-check.mjs` get the fix through `deliver-check.mjs` alone.
- Tests live in `plugins/openspec/hooks/deliver-check.test.mjs`, beside the existing `field-fixes 4 delivered` group (the `isOwnPr` unit test at line 4903 and the `ownRepo` fixtures that follow it); the existing assertion that a pull request bringing `openspec/changes/archive/2026-11-09-foo/retro.md` is not `foo`'s own stays true, because that is `foo`'s own archive folder.
- Line with the sibling `forced-merge-path`: this change decides which pull request counts as the change's own, from its files; `forced-merge-path` changes what the loop does when the owner merged that pull request with admin rights (finding it by number or merge commit once GitHub deleted the branch). This change does not touch the lookup by branch or by number, and `forced-merge-path` does not touch `isOwnPr`.
- No suite run on the Avell while it is overloaded: the plan names the filtered test files and the full-suite run happens only once the coordinating session gives a place.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `own-archive-refused` — `isOwnPr('foo', { headRefName: 'ship/foo' }, ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-foo/retro.md'])` is `false`.
- AC-2 `other-archive-allowed` — `isOwnPr('foo', { headRefName: 'ship/foo' }, ['openspec/changes/foo/tasks.md', 'openspec/changes/archive/2026-11-09-bar/retro.md'])` is `true`: a pull request that edits another change's archived files is still `foo`'s own when it changes a file of `openspec/changes/foo/`.
- AC-3 `id-prefix-not-confused` — the archive folder `openspec/changes/archive/2026-11-09-foo-two/` does not refuse `foo`'s pull request, and `openspec/changes/archive/2026-11-09-foo/` does not refuse `foo-two`'s.
- AC-4 `archive-head-still-refused` — a pull request whose head is `chore/archive-bar` or `archive-bar` is refused whatever its files, as today.
- AC-5 `found-after-merge` — through `findChangePr` in the `merge` ship mode, a merged pull request whose files are `openspec/changes/<id>/tasks.md` and another change's archived `retro.md` is found (`{ pr, via: 'list' }`), where it was `{ none: true }` before; a test with the fake `gh` of `deliver-check.test.mjs` proves it.
- AC-6 `no-regression` — every existing `field-fixes 4 delivered` test in `deliver-check.test.mjs` stays green, and `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass.

## Questions asked

1. [scope] Does the change run as the full `devkit` script or the short `devkit-lite`? → `devkit-lite`: a one-line predicate plus a test, easy to undo, no screen, no boundary, no new contract. (Answered by the owner on 2026-11-23, relayed in this session.)

## Out of scope

- The flow after an admin merge below 8/8 and the lookup of a pull request whose branch GitHub deleted: that is `forced-merge-path`.
- Changing how `findChangePr` selects, orders or limits the merged pull requests it reads.
- Changing `isArchiveHead` or `archiveHeads`.
- Any change to the delivery contract items, `change-loop.mjs` or `flow-check.mjs`.
