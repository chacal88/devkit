# Requirements

## Request

Created on 2026-11-12 from a session the owner started in another project's conducting session,
schema `devkit` confirmed by the owner. The request (translated from Portuguese, summarized):
change the devkit flow so a change's `evidence.md` is recorded by `devkit-core:pr-verifier`
BEFORE the `review-change` round whenever the evidence is missing or stale, instead of after it;
release it the way this repository releases, with a git tag for the release.

Why: in `chacal88/Digital-Representative`, the change `upgrade-devkit-and-enable-panel` failed
review round 1 only because `evidence.md` did not exist yet (`code-quality-reviewer` raised it as
an important finding and three finding-verifiers confirmed it); the next change,
`openspec-cli-version-gate`, recorded the evidence first and passed round 1 with no finding to
verify. Projects cannot fix the order locally: their vendored schema must stay byte-identical to a
devkit tag, and the apply skill tells agents to ignore config guidance that conflicts with the
schema's instruction. The devkit repository has no git tag after `v0.8.0`, so projects can only
pin their vendored schemas to `v0.8.0`.

Classification: domain=process type=feature flags=[contract, ui] (confirmed: the next step of
`deliver-check` is consumed by `ship-change`, `conduct`, `conduct-check` and devkit-panel; the
panel's step ladder changes order)

### Facts

- The order lives in `plugins/openspec/schemas/devkit-lite/schema.yaml` and
  `plugins/openspec/schemas/devkit/schema.yaml` (`apply.instruction`: 1. review-change,
  2. pr-verifier, 3. commit-and-pr), copied byte-identical in `openspec/schemas/`.
- `plugins/openspec/hooks/deliver-check.mjs#nextStep` returns `stop-review-deadlock`,
  `fix-review` and `review` before it looks at the evidence (`fix-defect`, then `verify`).
- `plugins/openspec/skills/ship-change/SKILL.md` and `plugins/openspec/skills/conduct/SKILL.md`
  follow `deliver-check`; `plugins/openspec/skills/openspec-setup/templates/config.yaml` and this
  repository's `openspec/config.yaml` repeat the order in `operations.apply.guidance`;
  `docs/openspec-flow.md` and `plugins/core/README.md` describe it.
- `plugins/panel/hooks/i18n.ts#STEP_KEYS` orders the ten steps `... implementation, review,
  proofs, pr ...`, and `plugins/panel/hooks/steps.ts#flowSteps` marks every step before the
  current one as done.
- `staleness` in `deliver-check.mjs` ignores commits and uncommitted files under `openspec/`, so
  writing `reviews/*.md` does not stale `evidence.md` and the reverse.
- `openspec-setup` pins the CI workflow to the commit of the tag `v<devkit-openspec version>`.

## Assumptions

- Confirmed by the owner: schema `devkit`.
- Confirmed by the owner: when the evidence records a failing criterion, the defect is fixed and
  the evidence recorded again before any review round (`fix-defect`, then `verify`, then
  `review`).
- Confirmed by the owner: devkit-panel swaps its `Revisão` and `Provas` rows in this change, so
  `Provas` comes before `Revisão`; nothing else in the pane changes (mock:
  `mock/passos.md`).
- Confirmed by the owner: this release is tagged `v<devkit-openspec version>` (expected
  `v0.13.0`) on the merge commit of this change on `main`, after the merge; the releases 0.9.0 to
  0.12.0 stay untagged.
- Confirmed by the owner on 2026-11-13 ("Concordo"), a new rule this change adds (today
  `CONTRIBUTING.md` has no tagging rule): a release that changes devkit-openspec's version is
  tagged `v<that version>` on its merge commit on `main`, with a lightweight tag pushed after the
  merge; a release that bumps only other packs gets no new tag. `CONTRIBUTING.md` gains this rule.
- Confirmed by the owner on 2026-11-13 ("Separar assim"): AC-8 covers only what exists before the
  PR. Creating and pushing the tag on the merge commit is a post-merge step, recorded and checked
  in `retro.md`, not an acceptance criterion.
- Confirmed by the owner (walkthrough of one day): after the phases, `pr-verifier` records the
  evidence; a defect is fixed and the evidence recorded again; the review round then reads the
  evidence; a code fix after the PR (a failing CI check woken by Auto-fix, a rejected review)
  makes evidence and reviews stale, and the next steps are `verify`, then `review`, then `push`.
- Confirmed by the owner: proven here are the `deliver-check` tests for every order case and this
  change's own delivery, run with the working tree's `deliver-check`, recording the evidence
  before its own review round. The gain in `chacal88/Digital-Representative` shows only in a
  later change there that picks up the `v0.13.0` schemas, outside this change.
- The guard on `gh pr create` (`plugins/openspec/hooks/guard.mjs`) and the CI check
  `deliver-check --ci` are unchanged: a PR still needs approved reviews and current evidence.
- The step names (`verify`, `review`, `fix-review`, `fix-defect`, `stop-review-deadlock`) and the
  JSON shape of `deliver-check` and `conduct-check` do not change; only which step comes first.

## Acceptance criteria

- AC-1 (`evidence-first`): with the phases done and committed, and both the evidence and the
  reviews missing or stale, `deliver-check` reports `verify` as the next step; once the evidence
  is current with no defect, it reports `review`.
- AC-2 (`defect-before-review`): while current evidence records a failing criterion,
  `deliver-check` reports `fix-defect`, never a `review` round, whether the reviews are missing,
  stale or approved.
- AC-3 (`fix-restales-both`): after a `fix-review`, `fix-defect` or `fix-checks` commit that
  changes a path outside `openspec/`, `deliver-check` reports `verify`, then (evidence current)
  `review` for the stale reviewers.
- AC-4 (`no-mutual-staleness`): recording `reviews/*.md` after `evidence.md` (or the reverse),
  committed or not, leaves the other one current.
- AC-5 (`guards-kept`): `gh pr create` is still refused without approved reviews or without
  evidence, and `deliver-check --ci` still fails on stale reviews or stale evidence.
- AC-6 (`instructions-follow`): both schemas' `apply.instruction`, the `openspec-setup` config
  template, this repository's `openspec/config.yaml`, `ship-change`, `conduct`,
  `docs/openspec-flow.md` and `plugins/core/README.md` describe pr-verifier before review-change,
  and no text in the repository still describes the old order.
- AC-7 (`panel-order`): the panel's `Passos` list shows `Provas` before `Revisão`, and while the
  next step is `verify` the `Revisão` row is pending, not done.
- AC-8 (`release-ready`): the release bumps every changed pack in `plugin.json` and
  `marketplace.json`, adds its `CHANGELOG.md` entry, moves the CI pin in `docs/openspec-flow.md`
  to the new devkit-openspec version (`v0.13.0`), adds the `CONTRIBUTING.md` rule that a release
  changing devkit-openspec's version is tagged `v<that version>` on its merge commit on `main`, and
  the tag `v<devkit-openspec version>` exists neither on `origin` nor locally before the PR.

## Out of scope

- The `chacal88/Digital-Representative` repository and its vendored schemas (a later change there).
- Tags for the past releases 0.9.0 to 0.12.0.
- Any change to the review round itself (`review-change`, `review-round.mjs`, the reviewers'
  verdict rules) or to `pr-verifier`'s evidence format.
- Automating the tag push (a release step in `deliver-check` or `ship-change`).
