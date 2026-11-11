# Proposal

Change: `conduct-one-change` · Date: 2026-11-10 · Owner: kaue rodrigues dos santos · Requirements: [requirements.md](requirements.md) · Design: [design.md](design.md) · Roadmap: round 7 of `openspec/roadmap.md`

## Why

`/conduct` (0.9.x) only knows rounds: every run sweeps every open change of the current
`openspec/roadmap.md` round, reusing whatever worktree it finds by branch. The 0.9.0 dogfood showed
the cost: the sweep resumed a worktree left dirty by an earlier run, and the owner had no way to
say "this change, and nothing else". The child sessions of ADR 0006 exist only inside that sweep,
while `ship-change <id>`, the one-change skill, still implements with a subagent and never starts a
session. The owner wants the one-change shape: name a change, approve its plan, watch its phases
run as child sessions grouped under it, and have nothing else touched.

## What Changes

- **`conduct-check --change <id>`.** The checker gains a single-change mode: one row, computed
  exactly as in the round mode (planning rows, readiness, approval, delivery through
  `deliver-check`, the `session` descriptor and `sessionPrefix` in the app), without reading the
  roadmap of `origin/<base>`. Two top-level fields say which mode produced the report (`mode`,
  `change`). A change that exists nowhere (its worktree, a branch named after it, `origin/<base>`,
  its archive) is an exit-3 error with a prefix the skill can read (`no change <id>:`; two other
  prefixes tell a worktree without a folder and a folder on another branch apart), never a
  `create` row. `--change` and `--round` do not combine; `--watch` works with `--change`.
- **`unfinished` on every change row** (both modes): the uncommitted work outside `openspec/` and
  the half-done phases of `tasks.md` in the change's worktree, with a one-line summary. Additive:
  the JSON stays `version: 2`.
- **`/conduct <id>` conducts one change.** The skill's first mode is the single change: it runs
  `--change <id>` (on every call of the run, the GitHub watch and the continuation turns included),
  reads no roadmap, touches no other change, enforces no `after:` and runs 0.9.0's
  steps for that one row, child sessions included (same descriptor, naming, sidebar group, archive,
  chain and refusal rules as ADR 0006). The round mode stays, only behind an explicit `round <n>`.
  A bare `/conduct` lists the open change ids and asks which one; it never sweeps and never picks a
  change on its own. A missing change is created only after the owner confirms the id and the
  schema in one question.
- **Unfinished work is reported first.** At the start of a run the owner typed, a change whose
  worktree holds uncommitted work or a half-done phase is reported as `<id> has unfinished work in
  <worktree>: <summary>`, and nothing of it runs until the owner's own message in that session says
  so.
- **ADR 0007** records "one change on request, never a sweep" and amends ADR 0006 (whose session
  rules now hold per change).
- **Docs and release**: `conduct/SKILL.md` (single-change mode first), `docs/openspec-flow.md`,
  `README.md`, `plugins/openspec/README.md`, catalog, CHANGELOG, `openspec/config.yaml` (ADR list),
  `openspec/roadmap.md` (round 7); devkit-openspec 0.10.0 (the JSON gains fields: minor); the CI
  snippet pins `v0.10.0`. `ship-change` and devkit-core are not touched.

## Acceptance criteria

- AC-1: `conduct-check --json --change <id>` reports `mode: "change"`, `change: "<id>"`, `round: null` and exactly one change row, `changes[0].id === "<id>"`, with the same `next`, `state`, `sessionPrefix` and (in `host: app`, at `implement`) `session` as the round mode gives that change; a repository whose `origin/<base>` has no `openspec/roadmap.md` still exits 0 with it; the round mode reports `mode: "round"` and `change: null`; `--change` with `--round` exits 3.
- AC-2: `--change <id>` for an id with no worktree, no branch `<id>` (local or `origin/<id>`), no `openspec/changes/<id>/` on `origin/<base>` and no archived folder there exits 3 with an error starting `no change <id>:`; a worktree found by branch with no `openspec/changes/<id>/` exits 3 with an error starting `change <id> has a worktree without a folder:`; the active folder in the current checkout on another branch exits 3 with an error starting `change <id> is on another branch:` and naming `git switch -c <id>`; the three `worktree` rows are unchanged; a change archived on `origin/<base>` with no worktree and no branch reads `archived`; `--change <id> --watch` watches that one row and returns it recomputed.
- AC-3: every change row, in both modes, carries `unfinished`: `null` for a clean worktree with no half-done phase, else `{ dirty, phases, summary }` with the uncommitted paths outside `openspec/` and `.claude/`, the half-done phase numbers (a phase with a ticked and an unticked checkbox) and a summary naming both; `version` stays 2.
- AC-4: `plugins/openspec/skills/conduct/SKILL.md` describes the single-change mode first: `/conduct <id>` runs `conduct-check --json --change <id>`, and every later call of the run (loop recompute, continuation turn, Auto-fix wake, the `--watch` call) carries `--change <id>` too; it reads no `openspec/roadmap.md` and touches no other change; `round <n>` is the only way into the round mode; a bare `/conduct` lists the open change ids, asks which one and never sweeps; its Never section says so. Pinned by skill-text tests in `guard.test.mjs`, the watch line included.
- AC-5: the single-change steps are 0.9.0's: planning rows, readiness, the owner's typed approval, one child session per implementation phase (`start_session` with the row's `session` descriptor, the same naming, sidebar group and archive rules as ADR 0006), reviews, verify, PR, waits, archive; the three kinds of turn (the owner's typed `/conduct <id>`, a continuation turn after a child's end, an Auto-fix wake for the GitHub-side steps) keep their 0.9.0 rules. Pinned by the existing skill-text tests, which stay green.
- AC-6: at the start of a run the owner typed, a change whose `unfinished` is not `null` is reported as `<id> has unfinished work in <worktree>: <summary>` and nothing of it runs until the owner's own message in that session says so; a continuation turn or an Auto-fix wake never asks it. Pinned by a skill-text test; proven live in the dogfood.
- AC-7: on exit 3 `no change <id>:`, the skill lists the open change ids and asks the owner, in one question, whether to create `<id>` and with which schema; it creates (worktree, `openspec new change`) only on the owner's answer; on `change <id> has a worktree without a folder:` it asks the same and runs only `openspec new change` in that worktree; on `change <id> is on another branch:` it stops and creates nothing. Pinned by a skill-text test.
- AC-8: `docs/adr/0007-one-change-on-request.md` exists with Decision, Consequences, Review trigger and Alternatives considered; ADR 0006 keeps `- Status: accepted` and carries `- Amended by ADR 0007`; `openspec/config.yaml` lists 0007; `README.md`, `plugins/openspec/README.md` and `docs/openspec-flow.md` describe the single-change mode first and the round mode as the explicit option; CHANGELOG has `## 0.10.0`; devkit-openspec is 0.10.0 in both manifests; the CI snippet pins `v0.10.0`; `python3 scripts/gen-catalog.py --check` reports no drift; `openspec/roadmap.md` has `## Round 7: one change on request` with the `conduct-one-change` line.
- AC-9: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and `openspec validate conduct-one-change --strict` pass. After the merge, the owner's typed `/conduct <id>` on one change is recorded in this change's `retro.md` `## Dogfood`: the single row, the unfinished-work question when it applied, the child sessions under the change's group, and no other change touched.

## Capabilities

### New Capabilities
<!-- None: this repository keeps no openspec/specs/; behavior is pinned by the tests run from guard.test.mjs (precedent: every archived change under openspec/changes/archive/). skip_specs: true. See design.md D1. -->

### Modified Capabilities
<!-- None. skip_specs: true -->

## Impact

- **devkit-openspec** (`plugins/openspec/`): `hooks/conduct-check.mjs` (`--change`, `mode` and
  `change` fields, the existence check and its exit-3 error, the archived-on-base row, `unfinished`
  on every row, the single-change `background`), `hooks/conduct-check.test.mjs`,
  `skills/conduct/SKILL.md` (frontmatter `description`, Start with the three argument forms, the
  no-argument stop, the missing-change question, the unfinished-work gate, the single-change scope,
  Report, Never), `hooks/guard.test.mjs` (new skill-text pins; the README pin and the ADR test
  extended), `README.md` (the `conduct` and `conduct-check` rows), `.claude-plugin/plugin.json`.
- **Repo**: new `docs/adr/0007-one-change-on-request.md`; `docs/adr/0006-...` (amended-by line);
  `docs/openspec-flow.md` (the `/conduct` section, the result paragraph, two troubleshooting rows,
  the Limits bullet, the CI pin), `README.md` (the `/conduct` paragraph), `docs/catalog.md`
  (generated), `openspec/config.yaml` (ADR list), `openspec/roadmap.md` (round 7),
  `.claude-plugin/marketplace.json`, `CHANGELOG.md`.
- **Runtime**: the same desktop-app tools as 0.9.0 (`start_session`, `list_sessions`,
  `archive_session`, the sidebar and PR tools); nothing new. Outside the app `/conduct <id>` runs
  the one change with subagent phases, as 0.9.0's CLI path does for a round.
- **Dependencies**: none new (Node 22, `gh`, OpenSpec 1.16, git ≥ 2.38 as before).
- **Exit criteria**: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, `claude plugin validate .`,
  `openspec validate conduct-one-change --strict`; `check` and `devkit-reviews` green on the PR;
  after the merge, the owner's `/conduct <id>` dogfood recorded in `retro.md` (AC-9).
- **Decisions cited**: ADR 0001 (unchanged: every step recomputed from the repository and GitHub,
  the owner's human gates), ADR 0004 (unchanged), ADR 0006 (amended: its session rules hold per
  change; which changes a run conducts is ADR 0007's). **New**: ADR 0007 (design D7).
