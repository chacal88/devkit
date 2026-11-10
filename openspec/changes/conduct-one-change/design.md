# Design

## Context

See proposal.md - Why. The pieces this design builds on, all in devkit-openspec 0.9.1:

- `conduct-check.mjs` `compute` (line 558) reads the roadmap of `origin/<base>`, picks the
  current round, builds `ctx`, `items` and `at` only when that round has unticked lines, builds one
  row per unticked item through `evaluate` (line 436), serializes the archives, summarizes
  (`selectDispatch`, `summarizeRound`) and adds the session descriptors (`addSessions`).
  `conductState`'s watch loop re-evaluates `items.find(...)` with `at + 1` as the round. `evaluate`
  finds the worktree by branch (`findWorktree`, line 140), computes the planning facts (`planFacts`)
  and the planning, dependency and delivery rows. `parseArgs` (line 620) is the CLI; `main` (line
  651) turns a `UsageError` into exit 3.
- `deliver-check.mjs` exports `gitFacts` (head and the dirty paths outside `openspec/` and
  `.claude/`, line 167), `parseTasks` (line 270), `locateChange` (line 219) and `detectHost`.
- The skill (`conduct/SKILL.md`) already has the session rules of ADR 0006 (Children: busy, start,
  chain, group, archive, refused calls, stops), the kinds of turn (Start 5), the planning and
  delivery rows, the waits and the report. This change adds the argument forms and the single-change
  scope around them, and changes none of the session rules.
- `guard.test.mjs` pins the skill's text (lines 1059-1215) and the ADRs (line 1219);
  `conduct-check.test.mjs` pins the JSON (its `roundRepo` harness gives a bare origin, a clone and
  worktrees, with `DEVKIT_HOST` fixed to `cli` and `appEnv` for the app).

## Goals / Non-Goals

**Goals:**

- One engine for both modes: the single-change row is computed by the same code as a round row,
  so the sessions, the states and the steps are identical; the mode only decides which rows exist.
- The owner names the change; nothing in the skill or the checker picks one.
- What is already in a worktree is said before it is touched.

**Non-Goals:**

- A new way to run phases: the child-session rules (ADR 0006) are reused untouched.
- Ordering between changes in single-change mode (`after:` is the roadmap's, which is not read).
- Changing `ship-change`.

## Decisions

### D1. No spec delta

This repository keeps no `openspec/specs/`; every archived change pinned behaviour with the tests
run from `guard.test.mjs` and set `skip_specs: true`. Same here.

### D2. `--change <id>`: the same row, without the roadmap

`parseArgs` gains `--change <id>` / `--change=<id>`. The id must match `locateChange`'s rule
(`/^[\w.-]+$/`, not `.`, `..` or `archive`), else a `UsageError`; `--change` together with
`--round` is a `UsageError` ("--change and --round do not combine"). `conductState` and `compute`
take `change` beside `round` and `busy`.

In `compute`, when `change` is set: the roadmap is not read (no `git show origin/<base>:openspec/roadmap.md`;
a repository without one still works), `rounds` is empty, `ticked` is an empty set, and the result
is `{ version: 2, base, mode: 'change', change: id, round: null, startedAt: null, skipped: [],
roadmapDone: false, changes: [row] }`. `ctx` is built exactly as for a round with unticked lines
(`root`, `env`, `ghFor`, `base`, `ref`, `ticked`, `main`, `worktrees`, `originSha`), `items` is
`[{ id, after: [], text: null, notes: null }]` and `at` is `null`; `compute` returns them as today,
so `conductState`'s watch loop re-evaluates the one item with `evaluate(ctx, item, roundOf(at))`,
where `roundOf` gives `at + 1` for a round and `null` in single-change mode (the loop is changed to
call it; it is the only place that derives the round number from `at`). The row is
`evaluate(ctx, items[0], null)` after the existence check of D3, so `planFacts`, `planningStep`,
`dependencyStep` (null: no `after`), `deliver`, the overrides and `serializeArchives` (one row, no
blockers) run unchanged. The round mode sets `mode: 'round'` and `change: null`. Both fields are
additive, so `version` stays 2 (the JSON contract in `docs/openspec-flow.md`); the pack bumps minor.
`summarizeRound`, `selectDispatch` and `--busy` work on the one row as they do on many; `--watch`
with `--change <id>` watches that one row (a test pins it: a per-call fixture flips the checks and
the watch returns with the recomputed single row, `mode: 'change'`).

`backgroundOf` (the child's `background`) reads, in single-change mode, "Change `<id>`, conducted on
its own: no roadmap round." instead of the round line, then the schema and the recompute sentence as
today. `renderHuman` is unchanged (one `<id>: <state>` line, then `dispatch:`, `owner:`, `github:`).

Alternatives: a separate code path for one change (rejected: two engines, the panel would have to
read two shapes); a `--changes a,b` list (rejected: the owner asked for one change at a time, and
the round mode already covers a set).

### D3. Existence, and the exit-3 error

In single-change mode `evaluate`'s "no worktree" branch is preceded by an existence check, in this
order, the first match deciding:

1. A worktree found by branch (`<id>` or `chore/archive-<id>`): `locateChange(worktree, id)` must
   find the active folder or an archived one; the row is computed as today. A worktree with no
   folder at all is exit 3 (never `new-change`), with its own prefix: "change <id> has a worktree
   without a folder: <path> has no openspec/changes/<id>/; run `openspec new change <id> --schema
   <devkit|devkit-lite>` there".
2. No worktree, and `refs/heads/<id>` or `refs/remotes/origin/<id>` exists, or `origin/<base>`
   holds `openspec/changes/<id>` (`git rev-parse --verify origin/<base>:openspec/changes/<id>`):
   today's three `worktree` rows, unchanged (a branch is enough, as in round mode; once the worktree
   exists, step 1 decides whether the folder is there).
3. No worktree, no branch, and `origin/<base>` holds `openspec/changes/archive/<date>-<id>`
   (`git ls-tree --name-only origin/<base> openspec/changes/archive/`, the newest `<date>-<id>`
   entry): the row is `archived` (`next: { step: 'archived', actor: 'none' }`, state `archived`),
   with `worktree` and `branch` as `evaluate` would guess them. In round mode this row never comes
   up (a ticked line is not conducted), so the check runs only in single-change mode.
4. Otherwise exit 3, with one of two distinct prefixes. If `locateChange(root, id)` finds the
   active folder in the current checkout (which is then on a branch other than `<id>`, else step 1
   would have found it): "change <id> is on another branch: openspec/changes/<id>/ is in <root> on
   branch <branch>; run `git switch -c <id>` there and run again". Else, and only then: "no change
   <id>: no worktree, no branch <id>, no openspec/changes/<id>/ on origin/<base> and no archived
   folder; create it with `openspec new change <id> --schema <devkit|devkit-lite>` on a branch
   named <id>".

The three exit-3 errors of this check have distinct prefixes the skill reads: `no change <id>:`
means nothing exists anywhere (no worktree, no branch: a `git worktree add -b <id>` cannot
collide); `change <id> has a worktree without a folder:` means the worktree exists and only the
folder is missing; `change <id> is on another branch:` means the change exists and must not be
created again. The exit-3 JSON stays `{ version: 2, error }`; the prefix is the contract, pinned by
tests. The `create` row is round-mode only: a change the owner names must exist, and a typo'd id
creates nothing. The skill's missing-change question (D5) is the one way to create it.

### D4. `unfinished` on every change row

`evaluate` adds, to every row that has a worktree, `unfinished: unfinishedWork(worktree, id)`:

- `dirty`: `gitFacts(worktree).dirty` (the uncommitted paths outside `openspec/`, plus untracked
  ones outside `.claude/`; the same list `deliver-check`'s `commit` step uses).
- `phases`: from `parseTasks` of the change's `tasks.md` (active or archived folder), the numbers
  of the phases with at least one ticked and at least one unticked checkbox (the gate counts as a
  checkbox), ascending. No `tasks.md` gives `[]`.
- `summary`: `"<n> uncommitted path(s) outside openspec/: <first three, comma-separated>"` and
  `"phase <n> half done (<ticked ids> ticked, <open ids> open)"` per phase, joined with `; `.
- `null` when `dirty` and `phases` are both empty. A row with no worktree (`worktree`, `create`,
  the `archived` row of D3) has `unfinished: null`.

Computed in both modes: the field costs one `git status` per worktree, which `deliver` already pays
for started changes, and the round mode's sweep is where the stale worktree was resumed. The
existing test "--json prints version 2 with the D2 fields" pins the row's key list; `unfinished`
joins it.

Why not reuse `deliver-check`'s report: `deliver` runs only once planning is done, and the report
has no half-done notion (it goes straight to `implement`/`gate`); the planning rows need the fact
too, so it is computed beside the planning facts.

### D5. The skill: three argument forms, one scope

Start 1 becomes the argument rule:

- `<id>`: single-change mode. Run `node <skill-dir>/../../hooks/conduct-check.mjs --json --change <id>
  [--busy <id>]`. This run reads and writes only that change's worktree; it never reads
  `openspec/roadmap.md`, never touches another change's worktree, and enforces no `after:` (the
  owner orders changes, as with `ship-change`; `docs/openspec-flow.md` Limits says so).
- `round <n>`: the round mode of 0.9.1, unchanged except for D6. There is no bare round mode.
- No argument: list the open change ids and ask which one with AskUserQuestion, then stop. The
  ids are the folders under `openspec/changes/` (minus `archive`) in the current checkout and in
  every path of `git worktree list`, plus the worktree branches that are change ids, deduplicated.
  The owner's answer is the typed go-ahead for that id; the run goes on as `/conduct <id>`. The
  skill never conducts more than the named change.
- Exit 3 whose error starts `no change <id>:` (nothing exists anywhere, D3): print the error, list
  the open ids as above, and ask in one question whether to create `<id>` and with which schema
  (proposed `devkit`: no roadmap line to read, so the strictest track). Only on the owner's answer
  run `git worktree add -b <id> <main>/.claude/worktrees/<id> origin/<base>` (`<main>` from
  `git rev-parse --path-format=absolute --git-common-dir`, its parent; the error guarantees no
  worktree and no branch `<id>` exist, so the command cannot collide) and `openspec new change <id>
  --schema <answer>` in the new worktree, then recompute.
- Exit 3 whose error starts `change <id> has a worktree without a folder:`: the same question
  (create the folder there, which schema); only on the owner's answer run `openspec new change <id>
  --schema <answer>` in that worktree (no `git worktree add`), then recompute.
- Any other exit-3 error (`change <id> is on another branch:` included) stops the run with its
  message, as today; nothing is created. A typo'd id is therefore `no change <id>:` and creates
  nothing without the owner's answer.

Every `conduct-check` call of a single-change run carries `--change <id>`: Start 3, every Loop
recompute, the recompute of a continuation turn and of an Auto-fix wake, and the `--watch` call of
the Waits section (`node <skill-dir>/../../hooks/conduct-check.mjs --json --watch --change <id>`;
in the round mode `--round <n>` in its place). A bare `conduct-check` is never run: it would sweep
the round. The Waits section's command line says both forms, and a pin test quotes it.

Everything after Start runs on the report's rows as today: with one row, `dispatch` has at most one
id, `owner` at most one gate, and the Children, Planning, Delivery, Waits and Stops sections apply
to it unchanged (same `session` descriptor, `sessionPrefix`, group `<id>`, archive on the gate
tick, chain rule, refusal state, `bind_pr` after `open-pr`). The kinds of turn (Start 5) are
unchanged: the owner's typed `/conduct <id>` is the only go-ahead, a continuation turn after a
child's end starts the next phase, an Auto-fix wake runs the GitHub-side steps and starts no
session. The frontmatter `description` names the single-change mode first and keeps the `Use when`
sentence (`scripts/check.py`), with no cron or wake-up word (the existing description pin).

Why not `ship-change`: it is the host-agnostic one-change skill with no worktree, session or
planning logic; giving it sessions would mean a second copy of the Children section. The owner's
"pick one change, approve its plan, phases as child sessions" is `/conduct` with one row.

### D6. The unfinished-work gate

In Start, after the first recompute of a run the owner typed (both modes), before any step: for
every change row whose `unfinished` is not `null`, say `<id> has unfinished work in <worktree>:
<summary>` and ask, with AskUserQuestion, whether to go on with it. Only the owner's own message in
that session continues it; "no" sets the change aside as `waiting for the owner: unfinished work in
<worktree>` for this run (an instance of the `waiting for the owner: <what>` state). A continuation
turn (`<side-sessions-event>`) and an Auto-fix wake never ask it: mid-run the worktree is dirty by
design (phases implemented, not yet committed), and the owner's answer stands for the session. The
report lists the changes set aside this way.

Why a question and not a stop: the common case after a chain break is exactly a half-done phase
(tasks ticked, gate open) that the owner wants to go on with; the point is that the owner sees what
is there before it moves.

### D7. ADR 0007 (draft; written as `docs/adr/0007-one-change-on-request.md` in phase 3)

```markdown
# ADR 0007: One change on request, never a sweep

- Status: accepted
- Date: 2026-11-10
- Change: conduct-one-change

## Context

ADR 0006 lets a conducting skill start one child session per implementation phase, in the change's
worktree, from the owner's turn and the chain of continuation turns that follows it. It says nothing
about which changes a run conducts: in 0.9.x the only conducting skill was the round sweep of
`openspec/roadmap.md`, which took every open change of the current round and reused any worktree
found by branch. Its first dogfood resumed a worktree left dirty by an earlier run, and the owner
had no way to name one change. The owner asked for the one-change shape: name a change, approve its
plan, watch its phases run as child sessions under it, nothing else touched, and no automatic or
roadmap-driven run.

## Decision

1. `/conduct <id>` conducts exactly the change the owner names. The checker's `--change <id>`
   restricts the report to that change without reading the roadmap; the skill reads and writes only
   that change's worktree, enforces no `after:`, and never picks a change on its own. A change that
   does not exist is an error, and is created only after the owner confirms the id and the schema.
2. The round sweep runs only on an explicit `round <n>`. A bare `/conduct` lists the open change
   ids and asks which one; it never sweeps.
3. Before anything of a change runs on a turn the owner typed, work already in its worktree
   (uncommitted paths outside `openspec/`, half-done phases) is reported, and the change goes on
   only when the owner's own message in that session says so.
4. ADR 0006's session rules hold per change, in both modes: one child per implementation phase,
   the chain of continuation turns, a refused start as a stop, the sidebar group named after the
   change, the archive on the phase's gate. ADR 0006 is amended, not superseded: it decides how
   phases run; this ADR decides which changes a run conducts.

## Consequences

- Positive: the owner is the one who picks; a stale worktree is seen before it is resumed; one
  engine (the checker) serves both modes and any later panel.
- Negative: ordering between changes is the owner's in single-change mode (Accepted: the roadmap
  stays a report, as ADR 0001 wanted). Two changes conducted one by one take two typed runs
  (Accepted: that is the request). A missing change costs one question before anything starts
  (Accepted: a typo'd id must create nothing).

### Review trigger

The owner asks for an unattended or roadmap-driven run again; a caller other than the skill (a
panel) needs the checker to list candidate changes; the unfinished-work question is answered by
anything but the owner's own message.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| Keep the sweep as the default and add `<id>` as a filter | Smallest change | A bare `/conduct` still sweeps; the owner's request was the opposite | low |
| Remove the round mode | Simplest skill | A round of independent changes loses its parallel run; the engine exists | low |
| Give `ship-change` the child sessions | No new mode | A second copy of the session rules in a host-agnostic skill; no worktree logic there | medium |
| Pick the change from the current branch | No argument needed | Silent selection is what the owner ruled out; `ship-change` already does it for its own flow | low |
```

ADR 0006 gets `- Amended by ADR 0007 (0007-one-change-on-request.md)` after its `- Status: accepted`
line (the status is pinned by a test and stays) and one sentence in its Decision 1 noting that
which changes a run conducts is ADR 0007's. `openspec/config.yaml` lists 0007.

### D8. Docs and release

- `docs/openspec-flow.md`: the `/conduct` section is retitled `## Conducting a change: \`/conduct <id>\`` (the
  anchor becomes `#conducting-a-change-conduct-id`; the pack README link follows). It opens with
  the single-change mode (the argument forms, the existence rule, `unfinished`), then the round mode
  as the explicit option (the round, worktrees, planning, dependency and delivery rows, as today).
  "The result" gains `mode`, `change` and `unfinished`. Troubleshooting gains two rows (exit 3 `no
  change <id>`; `<id> has unfinished work in <worktree>`). Limits: the `after:` bullet says
  `/conduct <id>` does not enforce it either. The CI snippet pins `v0.10.0`.
- `README.md`: the `/conduct` paragraph starts with `/conduct <id>`; the round is the option;
  ADR 0007 beside ADR 0006. `plugins/openspec/README.md`: the `conduct` and `conduct-check` rows.
- `docs/catalog.md` regenerated (the `conduct` description changes).
- devkit-openspec 0.10.0 in `plugins/openspec/.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json` (pack and marketplace `version`); CHANGELOG `## 0.10.0 — one
  change on request`. devkit-core is not touched.
- `openspec/roadmap.md`: `## Round 7: one change on request` with
  `- [ ] conduct-one-change — /conduct <id> conducts one change ...`, written during planning
  (the checker reads the roadmap from `origin/main`, so it lists the line only after the merge).

### D9. Tests

- `conduct-check.test.mjs`: `--change` through `conductState` and the CLI (`mode`, `change`,
  `round: null`, one row, the same `next`/`state`/`session`/`sessionPrefix` as the round mode for
  that change in `appEnv`; a repository without a roadmap on `origin/main`; `--change` with
  `--round` exit 3; the id rule; `--change <id> --watch` returning the recomputed single row);
  existence (exit 3 with each of the three prefixes: `no change <id>:`, `change <id> has a worktree
  without a folder:`, `change <id> is on another branch:`; `worktree` rows unchanged; `archived`
  for an archived folder on `origin/main` with no worktree); `unfinished` (null on a
  clean worktree; `dirty` with a product file; `phases` with a half-done phase at a non-default
  phase number and a gate-only case; the summary text; both modes); the existing key-list test
  extended with `unfinished`; the single-change `background`.
- `guard.test.mjs`: new pins for the argument forms (`--change <id>`, `round <n>`, the bare case
  with "never sweeps"), the single-change scope ("never reads `openspec/roadmap.md`", "touches no
  other change"), every call carrying `--change <id>` (the watch line `--json --watch --change <id>`
  included), the missing-change question (create only on `no change <id>:` and on `change <id> has
  a worktree without a folder:`; `change <id> is on another branch:` stops), the unfinished-work gate (its line and "only the
  owner's own message"), the Never lines; the README pin updated to the new paragraph start; the
  ADR test extended (0007 sections, 0006's amended-by line, config lists 0007). The existing pins
  (AC-3, AC-5 to AC-9 of `conduct-sessions`) must stay green: the session text is not rewritten.

## Risks / Trade-offs

- [The single-change row diverges from the round row] → one `evaluate` for both; a test computes the
  same change both ways and compares `next`, `state`, `session`.
- [`unfinished` flags the planning files of a fresh change] → it reads `gitFacts().dirty`, which
  excludes `openspec/`; planning files never count.
- [The unfinished-work question blocks a continuation turn] → D6: asked only on a turn the owner
  typed; pinned.
- [A typo'd id creates a change] → D3 exit 3 and D5's question: nothing is created without the
  owner's answer naming the id and the schema.
- [The skill creates a duplicate of a change that exists on another branch, or `git worktree add
  -b` collides with an existing worktree or branch] → D3's three distinct error prefixes: the skill
  creates only on `no change <id>:` (nothing exists, so the command cannot collide) and adds only
  the folder on `change <id> has a worktree without a folder:`; pinned.
- [A single-change run sweeps the round during its GitHub wait or a continuation turn] → D5:
  every call carries `--change <id>`, the watch line included; pinned, and D2's watch test.
- [The anchor of the `/conduct` section changes] → every link to it in the repository is updated;
  `scripts/check.py` checks link targets (files), the test for the pack README row checks the text.
- [The CI pin and `unnamedFiles` collide at the archive, as on PR #15] → known (retro of
  `conduct-sessions`, item 8): if a retro proposal bumps the pack, the retro also names
  `docs/openspec-flow.md` for the pin; the structural fix is out of scope.

## Migration Plan

1. Merge; `claude plugin update devkit-openspec@devkit` in the project (CONTRIBUTING).
2. `/conduct <id>` on one change is the dogfood (AC-9), recorded in `retro.md`.
3. Rollback: install 0.9.1; the JSON of 0.10.0 is a superset of 0.9.1's; no file format on disk
   changed.

## Open Questions

None.
