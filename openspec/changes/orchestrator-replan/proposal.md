# Proposal

Change: `orchestrator-replan` · Date: 2026-11-19 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(`requirements.md` holds the grill, the agreed design D-1 to D-13 and the owner's answers)

Summary: record in the repository the coordination design the owner approved on 2026-11-19: a new
ADR that supersedes ADR 0001 and ADR 0007, one design document, a roadmap rewritten to the
approved build order, and every file that still states the old rule corrected. Nothing that runs
changes.

## Why

The coordination layer (`/conduct`, its child sessions, the two checkers that guess the next step
from prose) is what fails: 13 of the 14 archived changes fixed that machinery or its view, and the
owner asked to redo it while keeping the skills, the agents and the gates. The owner approved a
replacement (OpenSpec as the harness, a roadmap coordinator and a change coordinator, a loop over
files, a driver per project) and a build order of twelve small changes. Step 1 of that order is to
record the design, so that step 2 can be planned from the repository alone and every reader meets
one governing decision instead of ADR 0001 and its five exceptions.

## What Changes

- **ADR 0010** (`docs/adr/0010-openspec-as-the-harness.md`, `- Status: accepted`): OpenSpec is the
  harness; a roadmap coordinator drives `openspec/roadmap.md` and a change coordinator drives one
  change; the flow is a loop over files; the driver is chosen per project; the script names roles,
  not a platform's tool. It decides what is to be built, naming the round that builds each piece,
  and answers by name every alternative ADRs 0001 to 0009 rejected that the design takes up.
- **Superseded**: ADR 0001 and ADR 0007 get `- Status: superseded by ADR 0010 (...)` and a note on
  what survives. **Noted**: ADRs 0006, 0008 and 0009 keep `accepted` and gain a note on what of each
  still holds until the round that removes it.
- **The design document** `docs/coordination-design.md`: one section per D-1 to D-13, each item
  marked decided, proposed or open, plus the open points, the machinery that stays until its round
  and the six withdrawn roadmap items. Linked from `CLAUDE.md` ("Where the rules are") and from the
  Documentation list of `README.md`.
- **The roadmap**: the six unticked lines of the old model go (owner, question 16); the eleven
  ticked lines stay unchanged; steps 2 to 12 of the build order become rounds 14 to 24.
- **Truthfulness**: `README.md`, `docs/openspec-flow.md`, `docs/compozy-kit.md`,
  `plugins/openspec/README.md` and the `context: ADRs:` line of `openspec/config.yaml` stop stating
  ADR 0001 or ADR 0007 as the rule in force (including the phrase "without a harness"), and say
  that the current machinery stays shipped until its round.
- **Release**: the pack README sentence makes this a `devkit-openspec` change, so
  `devkit-openspec` 0.14.1 → 0.14.2, marketplace 0.18.0 → 0.18.1, a `CHANGELOG.md` entry, the CI
  pin in `docs/openspec-flow.md` moved to `v0.14.2`, and the tag `v0.14.2` after the merge.
- **Config fix (AC-7)**: the third `rules.design` entry of `openspec/config.yaml` is quoted, so
  OpenSpec 2.0.0 reads all three design rules again.
- **The mock**: `mock/` (five panel screens, `canvas.json`, the owner's Portuguese planning page) is
  verified and committed with the change, as the archived `panel-conduct-view` change keeps its own.

Non-goals (`requirements.md`, Out of scope): building any step 2 to 12 of the build order; removing
or changing `/conduct`, `ship-change`, the checkers, the hooks, the schemas, the panel or the
CompozyOS loop; renaming anything in the CompozyOS kit; deciding the open points; a Portuguese copy
of the documentation; a version bump of any pack other than `devkit-openspec`.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1 `adr-0010-recorded` — `docs/adr/0010-<slug>.md` exists with `- Status: accepted` and states the decision of D-2, D-3 and D-8: OpenSpec is the harness; a manager drives the roadmap and a tech lead drives one change; the flow is a loop over files; the driver is chosen per project; the script names roles, not a platform's tool. Its Alternatives table carries the options this conversation rejected (app child sessions per stage, a session that remembers, a single-platform design). ADR 0001 and ADR 0007 read `superseded by ADR 0010`; ADRs 0006, 0008 and 0009 each carry the note of A-1.
- AC-2 `design-document-complete` — the design document of A-2 exists, is linked from the "Where the rules are" table of `CLAUDE.md` and from the Documentation list of `README.md`, and contains a section for each of D-1 to D-13 with every item marked decided, proposed or open. A reader finds in it, without any other source: the stage table of D-4 with the role, skills, product and gate of every stage; the three delivery models of D-5; the harness rules and the lock table of D-8; the build order of D-11; the list of open points.
- AC-3 `roadmap-rewritten` — `openspec/roadmap.md` holds no unticked line of the six ids of A-3, keeps every ticked line unchanged, and lists steps 2 to 12 of D-11 as rounds in the grammar `guard.mjs session` reads; a new session's start report shows the first new round as the current one.
- AC-4 `claims-true-at-the-commit` — no file of A-5 states ADR 0001 or ADR 0007 as the rule in force; each place that did now names ADR 0010 and says the current machinery stays until its round. `openspec/config.yaml`'s `context: ADRs:` line lists ADR 0010 and the two supersessions.
- AC-5 `mock-and-page-kept` — `openspec/changes/orchestrator-replan/mock/` holds the five panel screens, `canvas.json` and the planning page, and the design document names that folder as where the approved mock lives.
- AC-6 `gates-green` — `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, `claude plugin validate .` and `node --test plugins/openspec/hooks/guard.test.mjs` pass at the delivered commit, and `git diff --stat origin/main...HEAD` shows no change under any `plugins/*/agents`, `plugins/*/skills` or `plugins/*/schemas` path, and under `plugins/*/hooks` only test code in `plugins/openspec/hooks/guard.test.mjs` (the ADR status assertions and the two tests the review of round 1 asked for). The delivered commit carries the `devkit-openspec` 0.14.2 release (marketplace 0.18.1, `CHANGELOG.md` entry, CI pin at `v0.14.2`).
- AC-7 `design-rules-load` — `openspec instructions design --change orchestrator-replan --json` prints no "ignoring this artifact's rules" warning and returns the three `rules.design` entries of `openspec/config.yaml`. Today OpenSpec 2.0.0 drops all three, because the third entry holds an unquoted `: ` that YAML reads as a mapping; found while opening this change.

## Open decisions

- **OD-1, decided (a): the ADR 0007 status assertion.** `plugins/openspec/hooks/guard.test.mjs:1312`
  asserts `^- Status: accepted$` on ADR 0007, which AC-1 makes false. The assertion is rewritten to
  expect `superseded by ADR 0010` (the only edit under `plugins/*/hooks`); on its own it would need
  no version bump, as test-only edits to `guard.test.mjs` shipped twice before (`0af3faf`,
  `cb3e29b`), and it rides in the release the pack README brings. AC-6 and A-4
  in `requirements.md` name this exception. Decided by the conducting session as a routine mechanism
  choice, under the owner's standing instruction to decide routine choices; the owner sees it at
  plan approval. Answers (b) and (c), and their cost, are recorded in `design.md` D-6.

## Capabilities

### New Capabilities

None as spec deltas. `openspec list --specs` reports no specs; this repository pins behaviour with
tests, every archived change set `skip_specs: true`, and so does this one (`.openspec.yaml`): it
ships documents and one YAML quoting fix, and no behaviour changes.

### Modified Capabilities

None.

## Impact

- New: `docs/adr/0010-openspec-as-the-harness.md`, `docs/coordination-design.md`.
- Changed: `docs/adr/0001-*.md`, `0006-*.md`, `0007-*.md`, `0008-*.md`, `0009-*.md`; `README.md`,
  `CLAUDE.md`, `docs/openspec-flow.md` (two paragraphs and its CI pin), `docs/compozy-kit.md`,
  `openspec/config.yaml`, `openspec/roadmap.md`; in `devkit-openspec`: the first sentence of
  `plugins/openspec/README.md`, one assertion of `plugins/openspec/hooks/guard.test.mjs` (OD-1) and
  `plugin.json`; `.claude-plugin/marketplace.json` and `CHANGELOG.md` (release 0.18.1, tagged
  `v0.14.2` after the merge, `design.md` D-7).
- Not changed: every agent, skill, hook script and schema; every other pack and its version;
  `docs/catalog.md` (line 3 of a pack README is outside the generated tables); `CONTRIBUTING.md`
  (it states neither ADR as the rule).
- Dependencies: none. The design's own unverified points (D-13) are proved by later rounds.
- Exit criteria, green at the delivered commit: `python3 scripts/check.py`,
  `python3 scripts/gen-catalog.py --check`, the bundled binary's `plugin validate .`,
  `node --test plugins/openspec/hooks/guard.test.mjs`, `openspec validate orchestrator-replan --strict`,
  the path check of AC-6, and the `devkit-openspec` 0.14.2 release in place (versions, `CHANGELOG.md`
  entry, CI pin; gate 2.7 checks each).
- Decisions cited: ADR 0001 and ADR 0007 (superseded here); ADR 0005, 0006 and 0008 (their rejected
  alternatives are answered by ADR 0010); ADR 0009 (CompozyOS stays a driver); ADR 0002, 0003 and
  0004 (unchanged: the merge rules and the per-project opt-in).
- Workflow follow-up (after the merge, not an acceptance criterion): the tag `v0.14.2` on the merge
  commit; change 2 of the build order
  (`flow-script-checker`) is planned from `docs/coordination-design.md` alone, which confirms AC-2
  for real; its result is recorded in this change's `retro.md`.
