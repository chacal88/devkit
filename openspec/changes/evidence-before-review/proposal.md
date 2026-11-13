# Proposal

Change: `evidence-before-review` · Date: 2026-11-12 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(requirements.md holds the owner-confirmed assumptions; mock: `mock/passos.md`)

Summary: `pr-verifier` records `evidence.md` before the `review-change` round whenever the evidence is missing or stale, and this release is tagged so projects can pin it.

## Why

Today `deliver-check` sends a change to the review round before `pr-verifier` has written
`evidence.md`, so a reviewer can fail round 1 only because the evidence does not exist yet; that
cost a whole fix round in `chacal88/Digital-Representative` (requirements.md, Request). Projects
cannot change the order locally: their vendored schema must stay byte-identical to a devkit tag,
and the newest tag is `v0.8.0`. This change moves the evidence ahead of the review everywhere the
order lives, and tags the release so a project can pick it up.

## What Changes

- **`deliver-check`**: after the phases are committed, `fix-defect` and `verify` come before
  `review`. A current rejected review is still fixed first (`fix-review`), and
  `stop-review-deadlock` still stops first. Step names, the JSON shape of `deliver-check` and
  `conduct-check`, the staleness rule, the `gh pr create` guard and `deliver-check --ci` do not
  change.
- **Instructions and docs**: both schemas' `apply.instruction` (and the byte-identical copies in
  `openspec/schemas/`), the `openspec-setup` config template, this repository's
  `openspec/config.yaml`, the `ship-change` and `conduct` skills, `docs/openspec-flow.md`, the
  READMEs and the pack descriptions put `pr-verifier` before `review-change`.
- **devkit-panel**: the `Passos` list shows `Provas` before `Revisão` (the owner's mock,
  `mock/passos.md`); nothing else in the pane changes.
- **Release**: devkit-openspec 0.13.0, devkit-core 0.6.2, devkit-panel 0.2.1, marketplace 0.16.0,
  a CHANGELOG entry, the CI pin at `v0.13.0`, and a new CONTRIBUTING rule (owner-confirmed): a
  release that changes devkit-openspec's version is tagged `v<that version>` on its merge commit on
  `main`; one that bumps only other packs gets no new tag.
- **After the merge** (not an acceptance criterion): the tag `v0.13.0` is created on the merge
  commit and pushed, and `retro.md` records `git ls-remote` showing it (design D9).

Non-goals (requirements.md, Out of scope): the Digital-Representative repository and its vendored
schemas; tags for releases 0.9.0 to 0.12.0; any change to the review round (`review-change`,
`review-round.mjs`, verdict rules, ADR 0008) or to `pr-verifier`'s evidence format; automating
the tag push.

## Acceptance criteria

- AC-1 (`evidence-first`): with the phases done and committed, and both the evidence and the reviews missing or stale, `deliver-check` reports `verify` as the next step; once the evidence is current with no defect, it reports `review`.
- AC-2 (`defect-before-review`): while current evidence records a failing criterion, `deliver-check` reports `fix-defect`, never a `review` round, whether the reviews are missing, stale or approved.
- AC-3 (`fix-restales-both`): after a `fix-review`, `fix-defect` or `fix-checks` commit that changes a path outside `openspec/`, `deliver-check` reports `verify`, then (evidence current) `review` for the stale reviewers.
- AC-4 (`no-mutual-staleness`): recording `reviews/*.md` after `evidence.md` (or the reverse), committed or not, leaves the other one current.
- AC-5 (`guards-kept`): `gh pr create` is still refused without approved reviews or without evidence, and `deliver-check --ci` still fails on stale reviews or stale evidence.
- AC-6 (`instructions-follow`): both schemas' `apply.instruction`, the `openspec-setup` config template, this repository's `openspec/config.yaml`, `ship-change`, `conduct`, `docs/openspec-flow.md` and `plugins/core/README.md` describe pr-verifier before review-change, and no text in the repository still describes the old order.
- AC-7 (`panel-order`): the panel's `Passos` list shows `Provas` before `Revisão`, and while the next step is `verify` the `Revisão` row is pending, not done.
- AC-8 (`release-ready`): the release bumps every changed pack in `plugin.json` and `marketplace.json`, adds its `CHANGELOG.md` entry, moves the CI pin in `docs/openspec-flow.md` to the new devkit-openspec version (`v0.13.0`), adds the `CONTRIBUTING.md` rule that a release changing devkit-openspec's version is tagged `v<that version>` on its merge commit on `main`, and the tag `v<devkit-openspec version>` exists neither on `origin` nor locally before the PR.

## Capabilities

### New Capabilities

None as spec deltas. `openspec list --specs` reports no specs: this repository keeps no
`openspec/specs/`, pins behaviour with tests, and every archived change set `skip_specs: true`,
so this one does too (`.openspec.yaml`; design D1). The acceptance criteria above are the
behaviour. The contract (`flags=[contract]`) is which `next.step` `deliver-check --json` returns
first after the phases, read by `ship-change`, `conduct`, `conduct-check` and devkit-panel.

### Modified Capabilities

None.

## Impact

- devkit-openspec: `hooks/deliver-check.mjs` (`nextStep` only) and its tests,
  `hooks/conduct-check.test.mjs`, `hooks/guard.test.mjs`; both `schemas/*/schema.yaml`;
  `skills/openspec-setup/templates/config.yaml`; `skills/ship-change/SKILL.md`;
  `skills/conduct/SKILL.md`; the pack description.
- devkit-core: `README.md` only (diagram, step table, intro line).
- devkit-panel: `hooks/i18n.ts` (`STEP_KEYS`), `hooks/report.test.tsx`, `hooks/panel.test.tsx`,
  `README.md`.
- Repository: `openspec/schemas/*/schema.yaml`, `openspec/config.yaml`, `docs/openspec-flow.md`,
  `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/catalog.md` (generated),
  `.claude-plugin/marketplace.json`.
- Other projects: a change already past its phases in a project that updates mid-flight gets
  `verify` where it got `review`; nothing it recorded goes stale.
- Dependencies: none new. Delivered with the working tree's `deliver-check` (design D10).
- Exit criteria, green at the PR head: `node --test plugins/openspec/hooks/guard.test.mjs`,
  `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`, the bundled binary's
  `plugin test plugins/panel` and `plugin validate .`, `openspec schema validate devkit` and
  `devkit-lite`, `openspec validate evidence-before-review`. After the merge, outside the
  criteria: the tag, checked in `retro.md` (design D9).
- Decisions cited: ADR 0001 (the gates "approved reviews and evidence before the PR" hold),
  ADR 0002 (the CI pin to a release tag's commit; this release creates that tag), ADR 0004
  (hooks per project, unchanged), ADR 0006 and 0007 (`/conduct` unchanged), ADR 0008 (the review
  round itself unchanged). No ADR changes and no new ADR (design D11).
- Open decisions inherited: none (the repository keeps no open-decisions log). The owner
  answered on 2026-11-13: AC-8 covers only what exists before the PR, and the tag rule applies to
  releases that change devkit-openspec's version (requirements.md, Assumptions).
