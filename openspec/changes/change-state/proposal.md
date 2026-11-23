<!-- devkit-stage proposal result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Proposal

Change: `change-state` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a (sources:
`requirements.md`; item F-1 of
`openspec/changes/archive/2026-11-22-managed-agents-study/study.md`; ADR 0010, ADR 0014). Roadmap line
`change-state (after: managed-agents-study)` of `openspec/roadmap.md`.

## Why

devkit already has a small set of states: a stage under way, or one of the loop's four ends with a
reason (ADR 0010, decision 3). What it lacks is one reader. `/devkit status` works out each row in
`roadmap-loop.mjs` from the loop's action and the run file. The session title shows only the stage
icon, so a session waiting for the owner looks the same as one at work. The later panels
(`coordination-panels`) would need a third reading. A Managed Agents session reports one status and
one stop reason (managed-agents-study F-1); devkit should give every surface one derived answer, and
store none (ADR 0010, decisions 3 and 6).

## What Changes

- **One state, derived in one place.** One function of `change-loop.mjs` turns the loop's action
  (and, in a roadmap run, the run file's facts) into the change's state: `running`,
  `waiting-for-owner`, `waiting-on-github`, `blocked` or `archived`, with its reason (a code and a
  phrase in the person's language), the stage and its title, the stage icon, the state icon and the
  session title. `next` carries it in its action; nothing is stored.
- **A read-only command.** `change-loop.mjs state [--change <id>] --lang <l>` prints that state as
  JSON for one change, or for every open change and every change the roadmap run file lists. It
  writes nothing and prints no run marker.
- **A change nobody works on** in a run with a session per change (no session of its own, or a start
  that waits for the owner's next message) reads `running`, reason "ready, waiting for someone to
  continue". Outside a roadmap run, a change reads what the loop says.
- **A GitHub that does not answer** while the change's stage needs it ends the loop waiting on GitHub
  ("GitHub did not answer", exit 1), no longer blocked (exit 2); the background wait still ends blocked,
  quoting the error, after three failed reads in a row. A stage that does not need GitHub is unchanged.
- **`/devkit status`** places each open change's row by its state, with the same blocks and words.
- **The session title** is the stage icon and the id while the change runs (`🛠️ <id>`); the state
  icon, a space and the stage icon while it is stopped (`🙋 ❓ <id>`, `⏳ 🚀 <id>`, `⛔ 🛠️ <id>`);
  `📦 <id>` once archived; still cut to 59 code points. A change session starts with that title too.
- **ADR 0016 (new, proposed)** records the one derivation, the GitHub rule and the title; it amends
  ADR 0014 decision 3.
- Docs and release: devkit-openspec 0.22.0, marketplace 0.26.0.

Non-goals: rewiring any panel (`coordination-panels`); a stored event log or state file (ADR 0010);
a budget or a new end of the loop (`change-budget`); the transcript reading of `guard.mjs`'s locks,
which gate and report no state; the session-start roadmap lines of `guard.mjs`; the `/devkit project`
slices, which keep `project-loop.mjs` and its own GitHub rule; the stage checker's own readout
(`flow-check`), which still reports what it saw; when a session renames itself (SKILL.md Loop 1a).

## Acceptance criteria

- AC-1 `one-change-state` — For one named change, the command prints its state, the reason when one applies, and the stage with its title in the person's language; `git status` is unchanged after it runs.
- AC-2 `all-changes-state` — Without a change named, the command prints one entry per open change folder under `openspec/changes/` and per change the roadmap run file lists, each as in AC-1.
- AC-3 `same-as-next` — For every end of the loop (waiting for the owner, waiting on GitHub, blocked with each reason, archived) and for a stage under way, the command's state and reason equal what `change-loop.mjs next` returns for the same files and the same GitHub answers; a test feeds the same facts to both.
- AC-4 `ready-no-session` — When the roadmap run file says a change has no session or waits for a place, the command prints `running` with the reason "ready, waiting for someone to continue"; with no roadmap run file, plain `running`.
- AC-5 `github-silent` — With GitHub not answering, a change whose stage needs GitHub prints `waiting-on-github` with the reason "GitHub did not answer", and a change whose stage does not need GitHub (the grill, the plan) prints its normal state.
- AC-6 `status-reads-state` — `/devkit status` builds each change's row from the command: a change in `waiting-for-owner` sits in the block of changes waiting for the owner, `blocked` in the blocked block, `running` and `waiting-on-github` under way; its existing tests stay green.
- AC-7 `title-state-icon` — The session title the loop gives is the stage icon and the id while the change runs (`🛠️ <id>`); the state icon, a space and the stage icon while it is stopped (`🙋 ❓ <id>`, `⏳ 🚀 <id>`, `⛔ 🛠️ <id>`); `📦 <id>` when archived; still cut to 59 code points.

Exit criteria: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs`,
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and the marketplace validation
pass; `openspec validate change-state --strict` passes.

## Capabilities

### New Capabilities

- `change-state`: the read-only state command of the change loop, its JSON, which changes it lists,
  how the run file's facts weigh, and that the state is the loop's own decision.

### Modified Capabilities

- `change-coordination`: a GitHub that does not answer ends the loop waiting on GitHub, not blocked;
  the background wait tells a GitHub that stays silent from a wait on the checks or the merge.
- `roadmap-coordination`: the change session's title carries the state icon while the change is
  stopped; the board places each open change by its state.

## Impact

- `plugins/openspec/hooks/change-loop.mjs`: the state helper, the `state` subcommand, `decide` (the
  GitHub rule), `waitLoop`, `whereOf`, `nextAction` (the state and title of each action),
  `sessionTitle`, the message table; the run file's reader and the owner-gate table move here from
  `roadmap-loop.mjs`.
- `plugins/openspec/hooks/roadmap-loop.mjs`: `boardOf` and the session-start title read the state;
  imports and re-exports the moved helpers.
- Tests: `change-loop.test.mjs`, `roadmap-loop.test.mjs`; three existing tests change (`design.md`
  D-10), the rest of the suite runs unchanged.
- Docs: ADR 0016 (new), Notes and header lines in ADR 0014 and ADR 0010, `openspec/config.yaml` (the
  ADRs line), `docs/openspec-flow.md`, `docs/coordination-design.md`.
- Release: `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`,
  `CHANGELOG.md`, `docs/catalog.md`.
- Dependencies: `managed-agents-study` (archived, `c377948`). `coordination-panels` comes after and
  reads the command.
- Decisions cited: ADR 0010 (decisions 3, 6 and 8), ADR 0011 (the run detection the locks keep), ADR
  0013 (decision 4, the run file), ADR 0014 (decisions 1 to 3). Open decisions inherited: ADR 0016
  (proposed here) needs the owner's acceptance with the plan; it changes `next`'s end when GitHub does
  not answer (`design.md` D-4).
