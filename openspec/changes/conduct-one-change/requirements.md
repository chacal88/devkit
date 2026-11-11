# Requirements

## Request

The owner, in their words (translated from Portuguese, relayed by the session that conducted the
0.9.0 dogfood): "The child sessions exist only in the round mode of `/conduct`, which sweeps every
open change of the current `openspec/roadmap.md` round; it even resumed a stale worktree from
yesterday. I do not want any automatic or roadmap-driven run. `ship-change <id>` still implements
with a subagent and says it never starts a session. What I want: pick one change by id, approve its
plan, and have its phases run as child sessions grouped under that change, nothing else touched."

Decided with the owner on 2026-11-10 (the grill's questions were answered in the owner's brief, so
none was asked again here): `/conduct <id>` conducts exactly the change the owner names; it does
not read `openspec/roadmap.md`, touches no other change and never picks a change on its own; the
round mode stays only behind an explicit `round <n>`; a bare `/conduct` stops and asks which
change, listing the open change ids; the single-change steps are 0.9.0's (planning rows, readiness,
the owner's typed approval, one child session per implementation phase with ADR 0006's descriptor,
naming, sidebar group and archive rules, reviews, verify, PR, waits, archive); only the owner's
typed `/conduct <id>`, a continuation turn after a child's end, or an Auto-fix wake for the
non-session steps moves it; a change whose worktree holds uncommitted work or half-done phases is
reported before anything runs and continues only on the owner's own message in that session;
`conduct-check` gains `--change <id>` (a missing change folder is an exit-3 error); ADR 0007 records
"one change on request, never a sweep" and amends ADR 0006; devkit-openspec goes to 0.10.0.

Classification: domain=process type=feature flags=[architecture (amends ADR 0006), contract (`conduct-check` JSON gains fields)] (confirmed: schema `devkit`)

### Facts

- `plugins/openspec/skills/conduct/SKILL.md` (devkit-openspec 0.9.1) takes only `round <n>` as an
  argument (Start 1); without it the first round with an open line is conducted. Every run reads the
  roadmap of `origin/<base>` through `conduct-check` (`compute`, `conduct-check.mjs:558`) and
  evaluates every unticked change of the current round (`evaluate`, line 436), reusing any
  worktree found by branch (`findWorktree`, line 140), whatever it holds. The skill's Waits section
  runs `conduct-check --json --watch [--round <n>]`, and its Loop recomputes with the same
  arguments as Start 3.
- `conduct-check.mjs` `parseArgs` (line 620) knows `--json`, `--round`, `--busy` and
  `--watch`; any other option is a `UsageError` (exit 3, `{ version: 2, error }` in `--json`,
  `main` at line 651). `compute` builds `ctx`, `items` and `at` only when the round has unticked
  lines; `conductState`'s watch loop re-evaluates `items` with `at + 1` as the round number.
  The report (`--json`, version 2) carries `base`, `round`, `startedAt`, `skipped`, `roadmapDone`,
  `changes[]` (`id`, `round`, `after`, `text`, `notes`, `schema`, `worktree`, `branch`, `base`,
  `sessionPrefix`, `next`, `state`, `deliver`, plus `session` on a `session` row), `dispatch`,
  `owner`, `github`, `stopped`, `busy`, `end`; `docs/openspec-flow.md` says `version` changes only
  when a field is removed or changes meaning. The test "--json prints version 2 with the D2 fields"
  (`conduct-check.test.mjs:1022`) pins the exact key list of a change row.
- `evaluate` with no worktree (line 448) gives `worktree` (a local branch, a remote branch, or the
  folder on `origin/<base>`) or `create` (nothing anywhere: ask the schema, then
  `git worktree add -b <id> <path> origin/<base>`). `locateChange(root, id)`
  (`deliver-check.mjs:219`) finds an active folder or the newest archived one.
- `deliver-check.mjs` `dirtyPaths` (line 149) lists the uncommitted paths outside `openspec/` (and
  outside `.claude/` for untracked files); `gitFacts` exports it as `dirty`. `parseTasks` (line 270)
  returns every checkbox with its phase, id, `done` and `isGate`. `nextStep` (line 957) reports
  `implement` with `phase` for the first phase with an open task and `gate` for a phase whose tasks
  are ticked but whose gate is not.
- `ship-change` (`plugins/openspec/skills/ship-change/SKILL.md`) runs `implement` as a subagent in
  every host and says "Nothing here starts another session". It is not changed here.
- ADR 0006 (`docs/adr/0006-phases-as-child-sessions.md`, accepted) lets "a conducting skill" start
  one child per implementation phase; it says nothing about which changes a run conducts. The guard
  test "ADR 0006 supersedes ADR 0005 ..." (`guard.test.mjs:1219`) pins `- Status: accepted` on it.
- `scripts/check.py` requires a skill `description` to say when to use it (`Use when`), refuses
  Portuguese words in Markdown, checks links and requires a CHANGELOG heading for the marketplace
  version. `deliver-check.test.mjs:3031` requires the CI snippet pin in `docs/openspec-flow.md` to be
  `<commit sha of v<devkit-openspec version>>`.
- `openspec/roadmap.md` on `origin/main`: round 5 open (`commit-and-pr-trailer`,
  `conventions-trailer`), round 6 ticked (`conduct-sessions`). The dogfood session of 0.9.0 found
  `commit-and-pr-trailer`'s worktree dirty from the 0.8.0 run (phase 1 implemented, uncommitted).

## Assumptions

Planner-level, derived from the owner's brief and the code; confirmed at plan approval.

- Arguments of `/conduct`: `<id>` (one change, the normal case), `round <n>` (the round mode of
  0.9.0, unchanged), nothing (stop and ask). `<id>` is a change id (`[A-Za-z0-9._-]+`); `round`
  followed by a number is never read as an id.
- `conduct-check --change <id>` restricts the report to that change: `changes` has one row, the
  roadmap of `origin/<base>` is not read (a repository without one still exits 0), `round` is
  `null`, `startedAt` is `null`, `skipped` is `[]`, `roadmapDone` is `false`, and two new top-level
  fields say which mode produced the report: `mode` (`"change"` | `"round"`) and `change` (the id,
  or `null` in round mode). The row's `round`, `after`, `text` and `notes` are `null`, `[]`, `null`,
  `null`. `--change` with `--round` is a usage error (exit 3).
- Existence of the change, for `--change <id>`: its worktree (found by branch `<id>` or
  `chore/archive-<id>`, as today) holds `openspec/changes/<id>/` or its archived folder; or, with no
  worktree, a branch `<id>` exists (local or `origin/<id>`) or `origin/<base>` holds
  `openspec/changes/<id>/` (the three `worktree` rows of today), or `origin/<base>` holds
  `openspec/changes/archive/<date>-<id>/` (the row reads `archived`). Anything else is exit 3 with
  one of three distinct error prefixes: `no change <id>:` (nothing exists anywhere: no worktree, no
  branch, nothing on `origin/<base>`), `change <id> has a worktree without a folder:` (the worktree
  found by branch has no `openspec/changes/<id>/`), `change <id> is on another branch:` (the active
  folder is in the current checkout on a branch that is not `<id>`; the message names `git switch
  -c <id>`). The `create` and `new-change` rows never appear in single-change mode.
- Every `conduct-check` call of a single-change run carries `--change <id>`: the first run, every
  recompute of the loop, the recompute of a continuation turn and of an Auto-fix wake, and the
  `--watch` call (`conduct-check --json --watch --change <id>`); the round mode passes `--round <n>`
  there. The checker's watch loop re-evaluates the one row in single-change mode (`round` null).
- Every change row, in both modes, carries `unfinished`: `null`, or `{ dirty, phases, summary }`
  where `dirty` is `gitFacts(worktree).dirty` (the uncommitted paths outside `openspec/` and
  `.claude/`), `phases` the numbers of the phases of `tasks.md` with at least one ticked and one
  unticked checkbox (gate included), and `summary` one line naming both (at most three paths). It
  is additive: `version` stays 2; the pack bumps minor (0.10.0).
- The skill, single-change mode: runs `conduct-check --json --change <id>` (with `--busy` from the
  app's list of sessions as today), reads and writes only that change's worktree, never reads
  `openspec/roadmap.md`, never enforces `after:` (the owner orders changes, as with `ship-change`;
  the Limits bullet of `docs/openspec-flow.md` says so), and does what the 0.9.0 skill does for one
  row: planning rows, readiness, approval, `session` rows as child sessions (same descriptor,
  naming, group, archive, chain and refusal rules), reviews, verify, PR, waits, archive.
- The skill, no argument: `git worktree list` plus `ls openspec/changes/` in the current checkout
  and in each worktree, minus `archive`, gives the open change ids; the skill lists them, asks which
  one with AskUserQuestion and stops. The owner's answer names the change; the run then goes on as
  `/conduct <id>`. It never conducts more than the named change.
- The skill, a missing change: on exit 3 `no change <id>:` it prints the error, lists the open ids
  and asks the owner, in one question, whether to create `<id>` and with which schema (proposed
  `devkit`, the strictest track, since there is no roadmap line to read); only on the owner's answer
  it runs `git worktree add -b <id> <main checkout>/.claude/worktrees/<id> origin/<base>` (safe: the
  error means no worktree and no branch exist) and `openspec new change <id> --schema <answer>`
  there, then recomputes. On exit 3 `change <id> has a worktree without a folder:` it asks the same
  question and, on the answer, runs only `openspec new change <id> --schema <answer>` in that
  worktree. Any other exit 3 (`change <id> is on another branch:` included) stops with its message
  and creates nothing. A typo'd id therefore creates nothing.
- Unfinished work: at the start of a run the owner typed (both modes), every change row whose
  `unfinished` is not `null` is reported as `<id> has unfinished work in <worktree>: <summary>` and
  asked about with AskUserQuestion before anything of it runs; it goes on only when the owner's own
  message in that session says so, else it is set aside as `waiting for the owner: unfinished work
  in <worktree>`. A continuation turn and an Auto-fix wake never ask it (the owner's answer stands
  for that session).
- Report, single-change mode: the one change's line (id, schema, one of the five states) and the
  lines that apply (sessions left to start, `not archived:`/`not grouped:`/`not bound:`, the bound
  PR, the Auto-fix line); no `round:`, `roadmap:` or `skipped rounds:` line.
- ADR 0007 `docs/adr/0007-one-change-on-request.md` (accepted) records: one change on request,
  never a sweep; the round sweep only on an explicit `round <n>`; unfinished work reported before
  anything runs; ADR 0006's session rules hold per change. ADR 0006 gains the line
  `- Amended by ADR 0007 (0007-one-change-on-request.md)` after its Status (which stays `accepted`).
  `openspec/config.yaml` lists 0007.
- Docs: `conduct/SKILL.md` describes the single-change mode first and the round mode as the
  explicit option; `docs/openspec-flow.md` retitles the `/conduct` section to the single-change
  mode (anchor updated where linked), adds the two troubleshooting rows (exit 3 `no change`, the
  unfinished-work line) and the Limits bullet; `README.md` and `plugins/openspec/README.md` follow;
  `docs/catalog.md` is regenerated; CHANGELOG `## 0.10.0 — one change on request`; devkit-openspec
  0.10.0 in `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; the
  CI snippet pins `v0.10.0`; `openspec/roadmap.md` gains `## Round 7: one change on request` with
  the line `- [ ] conduct-one-change — ...` (written during planning, in the form of round 6).
- `ship-change` is not changed: it stays the CLI-and-app skill that implements with a subagent.

## Acceptance criteria

- AC-1: `conduct-check --json --change <id>` reports `mode: "change"`, `change: "<id>"`,
  `round: null` and exactly one change row, `changes[0].id === "<id>"`, with the same `next`,
  `state`, `sessionPrefix` and (in `host: app`, at `implement`) `session` as the round mode gives
  that change; a repository whose `origin/<base>` has no `openspec/roadmap.md` still exits 0 with
  it; the round mode reports `mode: "round"` and `change: null`; `--change` with `--round` exits 3.
- AC-2: `--change <id>` for an id with no worktree, no branch `<id>` (local or `origin/<id>`), no
  `openspec/changes/<id>/` on `origin/<base>` and no archived folder there exits 3 with an error
  starting `no change <id>:`; a worktree found by branch with no `openspec/changes/<id>/` exits 3
  with an error starting `change <id> has a worktree without a folder:`; the active folder in the
  current checkout on another branch exits 3 with an error starting `change <id> is on another
  branch:` and naming `git switch -c <id>`; the three `worktree` rows are unchanged; a change
  archived on `origin/<base>` with no worktree and no branch reads `archived`; `--change <id>
  --watch` watches that one row and returns it recomputed.
- AC-3: every change row, in both modes, carries `unfinished`: `null` for a clean worktree with no
  half-done phase, else `{ dirty, phases, summary }` with the uncommitted paths outside `openspec/`
  and `.claude/`, the half-done phase numbers (a phase with a ticked and an unticked checkbox) and
  a summary naming both; `version` stays 2.
- AC-4: `plugins/openspec/skills/conduct/SKILL.md` describes the single-change mode first:
  `/conduct <id>` runs `conduct-check --json --change <id>`, and every later call of the run (loop
  recompute, continuation turn, Auto-fix wake, the `--watch` call) carries `--change <id>` too;
  it reads no `openspec/roadmap.md` and touches no other change; `round <n>` is the only way into
  the round mode; a bare `/conduct` lists the open change ids, asks which one and never sweeps; its
  Never section says so. Pinned by skill-text tests in `guard.test.mjs`, the watch line included.
- AC-5: the single-change steps are 0.9.0's: planning rows, readiness, the owner's typed approval,
  one child session per implementation phase (`start_session` with the row's `session` descriptor,
  the same naming, sidebar group and archive rules as ADR 0006), reviews, verify, PR, waits,
  archive; the three kinds of turn (the owner's typed `/conduct <id>`, a continuation turn after a
  child's end, an Auto-fix wake for the GitHub-side steps) keep their 0.9.0 rules. Pinned by the
  existing skill-text tests, which stay green.
- AC-6: at the start of a run the owner typed, a change whose `unfinished` is not `null` is
  reported as `<id> has unfinished work in <worktree>: <summary>` and nothing of it runs until the
  owner's own message in that session says so; a continuation turn or an Auto-fix wake never asks
  it. Pinned by a skill-text test; proven live in the dogfood.
- AC-7: on exit 3 `no change <id>:`, the skill lists the open change ids and asks the owner, in one
  question, whether to create `<id>` and with which schema; it creates (worktree, `openspec new
  change`) only on the owner's answer; on `change <id> has a worktree without a folder:` it asks
  the same and runs only `openspec new change` in that worktree; on `change <id> is on another
  branch:` it stops and creates nothing. Pinned by a skill-text test.
- AC-8: `docs/adr/0007-one-change-on-request.md` exists with Decision, Consequences, Review
  trigger and Alternatives considered; ADR 0006 keeps `- Status: accepted` and carries
  `- Amended by ADR 0007`; `openspec/config.yaml` lists 0007; `README.md`, `plugins/openspec/README.md`
  and `docs/openspec-flow.md` describe the single-change mode first and the round mode as the
  explicit option; CHANGELOG has `## 0.10.0`; devkit-openspec is 0.10.0 in both manifests; the CI
  snippet pins `v0.10.0`; `python3 scripts/gen-catalog.py --check` reports no drift;
  `openspec/roadmap.md` has `## Round 7: one change on request` with the `conduct-one-change` line.
- AC-9: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and
  `openspec validate conduct-one-change --strict` pass. After the merge, the owner's typed
  `/conduct <id>` on one change is recorded in this change's `retro.md` `## Dogfood`: the single
  row, the unfinished-work question when it applied, the child sessions under the change's group,
  and no other change touched.

## Out of scope

- Changing `ship-change` (it keeps its subagent implementer and starts no session).
- Removing the round mode, or changing what it does beyond the unfinished-work gate.
- Enforcing `after:` in single-change mode (the roadmap is not read there).
- The orquestrador panel, a Workflow-based review round, child sessions for steps other than
  `implement`.
- Adding `docs/openspec-flow.md` to `RELEASE_FILE` or moving the CI pin bump into the release step
  (the retro of `conduct-sessions`, item 8: a change of its own).
- The checker gap found at the archive of `conduct-sessions` (`apply-proposals` not reached while
  the archive PR is open: a change of its own).
