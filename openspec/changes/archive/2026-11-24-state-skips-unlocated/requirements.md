<!-- devkit-stage requirements result=passed attempt=1 commit=none -->
# Requirements

## Request

> `change-loop.mjs state` and `/devkit status` list a change the main checkout cannot locate as blocked with its reason instead of exiting 3, and `locate` prefers the caller's worktree (change-state retro, learning 4)

Classification: domain=process, type=bug, flags=[] (strict-assumed; it changes `locate`, which the lock hooks and the roadmap loop read, so the short script is not offered).

## Assumptions

<!-- Each confirmed by the owner. Literal paths, fields, names. -->
- Today `state` and `roadmap-loop.mjs status` exit 3 on a change whose folder lives in a worktree whose branch is not named after the change (and is not `chore/archive-<id>`): `knownChange` finds the folder through `checkoutsOf`, then `nextAction` calls `locate`, which falls back to the main checkout, and `collectFlow` throws `no change named <id>, active or archived` (`plugins/openspec/hooks/change-loop.mjs` `locate` ~1247, `knownChange` ~1602, `stateEntries` ~1640; `flow-check.mjs` ~238). Nothing catches it, so `failure()` exits 3 and hides every other change.
- `/devkit status` has its own path (`roadmap-loop.mjs` `collectRoadmap`, which calls `nextAction` per roadmap line without a catch), so it is in scope: the board must agree with `state` (spec `roadmap-coordination`).
- A change the loop cannot place is listed as an entry of the same shape as any other, `state: blocked`, exit 0, with a `reason` `{ code, text }` in the person's language and its stage fields null where unknown. Existing `blocked-why.*` reasons are an open key table (`MESSAGES`), not a closed contract; a new code (or an existing one such as `wrong-branch`) needs English and Brazilian Portuguese texts that the two tests rendering every `blocked-why.` code accept (`change-loop.test.mjs:100-117`, `roadmap-loop.test.mjs:561-577`). The planner picks the code and the wording.
- `state --change <id>` for such a change answers like the list: the blocked entry, exit 0 (owner's answer, given by the coordinating session under the owner's delegation, 2026-11-23).
- An id with no folder in any checkout, no archived folder and no line in the run file keeps exit 3 `no change named <id>` (spec `change-state`, test `change-loop.test.mjs:5783-5792`).
- `locate(start, id)` order becomes: worktree on `chore/archive-<id>`, worktree on branch `<id>`, then the caller's own checkout (`start`, the root `findRoot(cwd)` found) when it holds the change's folder, then the main checkout. A caller in the main checkout or in the change's own worktree gets the same root as today. No ADR or spec pins the old order.
- No ADR is contradicted: ADR 0017 decision 1 derives the state in one place and says a change has `running` or one of the four ends with a reason when one applies; this adds a reason to the blocked end, not a new end.
- The flow of `next`, the stage checkers and the delivery steps are unchanged: this change fixes where the loop looks and what `state` and the board print for a change it cannot place.

## Acceptance criteria

<!-- Stable ids, observable and testable. -->
- AC-1 `state-lists-unlocated`: `change-loop.mjs state` (no `--change`), run from a checkout that does not hold change `x`'s folder while another worktree on a branch not named `x` does, exits 0 and lists `x` with `state: blocked` and a `reason.code` and `reason.text` (in `en` and in `pt-BR`), and still lists every other change of the repository.
- AC-2 `state-change-flag-unlocated`: `change-loop.mjs state --change x` in the same setup exits 0 with that one blocked entry, the same entry as in AC-1.
- AC-3 `board-lists-unlocated`: the `/devkit status` board (`roadmap-loop.mjs status`) for a roadmap line whose change is in that setup shows it as blocked with the same reason text, exits 0, and shows the other lines as before; the board and `state` agree on every open roadmap change.
- AC-4 `unknown-id-keeps-exit-3`: `state --change nope` for an id with no folder in any checkout, no archived folder and no run-file line still exits 3 with the plain reply and `no change named nope` in `error`.
- AC-5 `locate-prefers-caller`: `locate` called from a worktree that holds change `x`'s folder on a branch not named `x` returns that worktree, so `next --change x` and the hooks work there; the worktree on `chore/archive-x` and the worktree on branch `x` still win over it, and from the main checkout or from the change's own worktree the result is the same as before.
- AC-6 `no-behaviour-change-elsewhere`: no other behaviour changes: every existing `state`, board and `locate` caller test (`change-loop.test.mjs`, `roadmap-loop.test.mjs`, `guard.test.mjs`) passes as it is, and a change the loop can place is printed exactly as before.
- AC-7 `docs-follow`: `docs/openspec-flow.md` (the `state` section) and the `change-state` spec name the new blocked reason and the new `locate` order.

## Out of scope

- Making `next` itself succeed for a change in a worktree the caller cannot place from the main checkout (it keeps failing with its own message); only `state` and the board stop dying on it.
- Reading the unplaced change's real stage from the checkout that holds it (the line asks for blocked with a reason).
- Archiving, merge order, release numbers and any other roadmap line.
