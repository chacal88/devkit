<!-- devkit-stage proposal result=passed attempt=1 commit=35b4b579715c1b3f8f5a078a358efb793a5f703d -->
# Proposal

Change: `state-skips-unlocated` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: the line of `openspec/roadmap.md` and the owner-confirmed `requirements.md`; change-state
retro, learning 4).

## Why

When a change's folder lives only in a worktree whose branch is neither `<id>` nor
`chore/archive-<id>`, `change-loop.mjs state` and `/devkit status` (`roadmap-loop.mjs status`) run
from a checkout that does not hold it exit 3 with `no change named <id>, active or archived`, and
hide every other change of the repository. The loop finds the folder when it lists the changes but
then reads it in the main checkout (`locate` falls back there), so one odd worktree blinds the
board, the state command and the side panels that read it.

## What Changes

- **A change the loop cannot place is listed, not fatal.** One shared helper in
  `plugins/openspec/hooks/change-loop.mjs` says a known change cannot be placed (some checkout holds
  its folder, the checkout `locate` picks does not) and gives its blocked stand-in action. The state
  command and the roadmap's facts (`collectRoadmap` in `plugins/openspec/hooks/roadmap-loop.mjs`)
  both call it before `nextAction`, so the change is listed `blocked` with the existing reason
  `wrong-branch` ("its folder is on a branch with another name", and its Brazilian Portuguese
  text already in the message table), exit 0, its `root` and `branch` those of the checkout that holds it, its stage
  fields null. No new message, no new reason code. Before it, the state command checks the
  archive: a change archived on the default branch whose only folder is a stale copy is listed
  `archived`, not blocked.
- **`locate` prefers the caller's checkout.** The order becomes: the worktree on
  `chore/archive-<id>`, the worktree on branch `<id>`, then the caller's own checkout when it holds
  the change's active folder and the main checkout holds no folder of it, then the main checkout. A
  caller in the main checkout or in the change's own worktree gets the same result as today, so
  `next --change <id>` and the change run's stop lock work from a worktree on another branch.
- **The roadmap run sees the same blocked line.** `collectRoadmap` also feeds `roadmap-loop.mjs
  next` and the roadmap run's stop lock. With the helper, a roadmap run whose line cannot be placed
  says once that it is blocked, with the same reason, and the other lines go on (today `next` exits 3
  and the stop lock lets the stop through as an error).
- **Unchanged:** an id no checkout, archive or run file knows keeps exit 3 `no change named <id>`;
  every change the loop can place is printed exactly as before; `next`'s flow, the stage checkers,
  the delivery steps and `status --json` keep their behaviour.
- Documentation: the `state` paragraph of `docs/openspec-flow.md` names the blocked entry and the
  `locate` order; release of devkit-openspec (patch), the marketplace version, `CHANGELOG.md` and
  the CI pin in `docs/openspec-flow.md` move together.

Non-goals: making `next` or `roadmap-loop.mjs draft` succeed for an unplaced change called from a
checkout that cannot place it;
reading the unplaced change's real stage from the checkout that holds it; any new ADR (see
`decisions.md`).

## Acceptance criteria

- AC-1 `state-lists-unlocated`: `change-loop.mjs state` (no `--change`), run from a checkout that does not hold change `x`'s folder while another worktree on a branch not named `x` does, exits 0 and lists `x` with `state: blocked` and a `reason.code` and `reason.text` (in `en` and in `pt-BR`), and still lists every other change of the repository.
- AC-2 `state-change-flag-unlocated`: `change-loop.mjs state --change x` in the same setup exits 0 with that one blocked entry, the same entry as in AC-1.
- AC-3 `board-lists-unlocated`: the `/devkit status` board (`roadmap-loop.mjs status`) for a roadmap line whose change is in that setup shows it as blocked with the same reason text, exits 0, and shows the other lines as before; the board and `state` agree on every open roadmap change.
- AC-4 `unknown-id-keeps-exit-3`: `state --change nope` for an id with no folder in any checkout, no archived folder and no run-file line still exits 3 with the plain reply and `no change named nope` in `error`.
- AC-5 `locate-prefers-caller`: `locate` called from a worktree that holds change `x`'s folder on a branch not named `x` returns that worktree, so `next --change x` and the hooks work there; the worktree on `chore/archive-x` and the worktree on branch `x` still win over it, and from the main checkout or from the change's own worktree the result is the same as before.
- AC-6 `no-behaviour-change-elsewhere`: no other behaviour changes: every existing `state`, board and `locate` caller test (`change-loop.test.mjs`, `roadmap-loop.test.mjs`, `guard.test.mjs`) passes as it is, and a change the loop can place is printed exactly as before.
- AC-7 `docs-follow`: `docs/openspec-flow.md` (the `state` section) and the `change-state` spec name the new blocked reason and the new `locate` order.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-state`: the state command lists a change it cannot place as blocked with the reason
  `wrong-branch` (list and `--change`) after checking the archive (a stale copy of an archived
  change reads `archived`), and the checkout a change is read in follows the new order.
- `roadmap-coordination`: the board (and the roadmap run's decision) shows a line whose change
  cannot be placed as blocked with the same reason the state command gives.

## Impact

- Hooks: `plugins/openspec/hooks/change-loop.mjs` (`locate`, the new shared helper,
  `stateEntries`), `plugins/openspec/hooks/roadmap-loop.mjs` (`collectRoadmap`). One line per
  surface: the state command lists the change; the board, `roadmap-loop.mjs next` and the roadmap
  stop lock see it blocked; `next` and the change stop lock work from a worktree on another branch.
- Tests: new tests in `plugins/openspec/hooks/change-loop.test.mjs` and
  `plugins/openspec/hooks/roadmap-loop.test.mjs`; no existing test changes.
- Docs and release: `docs/openspec-flow.md`, `CHANGELOG.md`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`.
- Dependencies: ADR 0017 decision 1 (one place derives the state; blocked keeps its reason), ADR
  0010 decision 3 (four ends). No open-decisions log exists in this repository.

Exit criteria: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node
--test plugins/openspec/hooks/guard.test.mjs`, `python3 scripts/check.py`, `python3
scripts/gen-catalog.py --check`, `claude plugin validate .` and `openspec validate
state-skips-unlocated --strict` pass; the real-run proof (tasks, phase 3) shows AC-1 to AC-5 in a
scratch repository in both languages.

Decisions cited: ADR 0017 (decision 1, decision 2), ADR 0010 (decision 3); `decisions.md` (no new
record). Open decisions inherited: none.
