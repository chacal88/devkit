<!-- devkit-stage proposal result=passed attempt=1 commit=a11521bd439a1a20d302abf4d7f7f82fc930a32f -->
# Proposal

Change: `run-status-bar` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a ·
Inputs: [requirements.md](requirements.md), [mockup.md](mockup.md) and [mock/](mock/) (approved on 2026-11-24),
[decisions.md](decisions.md)

## Why

A session that conducts a change or a roadmap run shows where the work stands only when someone asks
(`/devkit status`, the session title's two icons). The owner asked for one line under the message box
that says it all the time: which change, at which stage, how far along, and what it waits for; or, in
the roadmap coordinator's session, how many changes are working, waiting for the owner or blocked.
`change-loop.mjs state` (ADR 0017) already derives every fact the line needs except the list of stages
that apply to a change, so the bar can now be a plain reader of that command.

## What Changes

- **A Claude Code status line command shipped by devkit-openspec**, `plugins/openspec/hooks/status-line.mjs`.
  Claude Code runs it with a JSON object on standard input; it prints one line, at most 100 columns:
  - in a session that conducts one change (its folder is a worktree of that change, on the change's
    branch): `<state icon> <stage icon> <id> · <stage title> · <strip> · <n> of <N>[ · <reason>]`,
    with `■` for each stage before the current one, `◆` for the current one, `□` for the later ones,
    and the reason only while the change is stopped;
  - in the session that coordinates a roadmap run:
    `<n> in play · <n> working · 🙋 <n> waiting on the owner · ⛔ <n> blocked`, zeros included;
  - in any other session: nothing.
  A line wider than 100 columns is cut by the rule the mock-up shows (the reason loses words, then the
  reason goes, then the id is cut, keeping 20 columns).
- **The owner turns it on once**, with a `statusLine` entry in `.claude/settings.json` that the plugin's
  README and `docs/openspec-flow.md` give. The change edits no settings file.
- **`change-loop.mjs state` gains two additions; no existing field changes meaning:**
  - each entry carries `stages`, the ids of the stages that apply to the change in the order of its
    flow (computed by one shared helper of `flow-check.mjs`, the one the stage walk itself uses), or
    `null` when the change's flow is not read;
  - `--offline` makes the command call GitHub not at all, so GitHub reads as not answering, as the
    `change-state` spec already defines. The bar uses it for the roadmap listing.
- **Docs and release**: `docs/openspec-flow.md` (the state paragraph and a new status line paragraph),
  `plugins/openspec/README.md`, `CHANGELOG.md`, the devkit-openspec version (with the release pins of
  `docs/openspec-flow.md` moved to it) and the marketplace version.

Non-goals: no budget share, token count or transcript read; no write, no stored state, no AI call, no
`devkit-run:` or `devkit-end:` line; no change to `plugins/panel` or to the session title; no
setting written into any `settings.json`.

## Acceptance criteria

Copied from [requirements.md](requirements.md), with their ids.

- AC-1 `lone-change-bar`: In a session that conducts the change `run-status-bar` at stage `approval`, waiting for the plan approval, the status line prints the state icon and stage icon, `run-status-bar`, the stage title, a strip with the earlier stages marked done, the current one marked and the later ones not yet, `<n> of <N>` where N is the number of stages that apply to the change and n the place of the current one, and the reason in words; the command exits 0.
- AC-2 `no-budget`: With a `budget` cap set, the line has no percentage and no mention of the budget, and the command reads no session transcript.
- AC-3 `roadmap-counts`: In the session that coordinates a roadmap run whose `state` listing holds six changes (three `running`, two `waiting-for-owner`, one `blocked`), the line prints those counts and no strip and no percentage.
- AC-4 `nothing-conducted`: With no change conducted and no run, the status line prints nothing and exits 0.
- AC-5 `read-only`: Running the status line command leaves `git status`, the run file and the list of worktrees as they were, calls no AI and prints no `devkit-run:` or `devkit-end:` line.
- AC-6 `person-language`: With `--lang pt-BR` the line's words are in Brazilian Portuguese and the state, stage and counts are the same as with `--lang en`.
- AC-7 `mock-matches`: The line the command prints for each example of the mock-up the owner approved is the one the mock shows, element by element.

Exit criteria: every gate of [tasks.md](tasks.md) green, including `node scripts/test-suite.mjs`,
`python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check` and `claude plugin validate .`;
the real runs of the command that [design.md](design.md) D-12 lists recorded in `evidence.md`.

## Capabilities

### New Capabilities

- `status-line`: the one-line status of the session under Claude Code's message box: which session
  shows which line, what each line holds, its width and cut rule, its language, and that it only reads.

### Modified Capabilities

- `change-state`: the `state` command's entries list the stages that apply to the change, and
  `--offline` reads the state without calling GitHub (two ADDED requirements; no existing requirement
  changes).

## Impact

- **devkit-openspec** (`plugins/openspec/`): new `hooks/status-line.mjs` and its tests; `hooks/flow-check.mjs`
  (the shared helper), `hooks/change-loop.mjs` (the `stages` field, `--offline`, the bar's words in the
  message table), `hooks/merge-setup.mjs` and `hooks/roadmap-loop.mjs` (the offline GitHub stub moves to
  one place), `README.md`; version bump.
- **Repository**: `docs/openspec-flow.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`.
- **Not touched**: `plugins/panel`, the session title, any `settings.json`, every other pack.
- **Dependencies**: `change-state` (archived; ADR 0017) delivers the `state` command. The listing exits 3
  in this repository today (`no change named delivery-train`, read on 2026-11-24);
  `state-skips-unlocated` (roadmap, open) is the change for that defect, and until then the roadmap line of this
  repository's coordinator is empty (design.md D-12 lists it as dogfood).
- **Decisions cited**: ADR 0017 (the state is derived in one place; panels read the command), ADR 0010
  (no stored state), ADR 0021 (the run file records the coordinating session), ADR 0026 (the test
  suite command). No new ADR ([decisions.md](decisions.md)). Open decisions inherited: none.
