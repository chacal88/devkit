<!-- devkit-stage proposal result=passed attempt=1 commit=8432791edc714cfd226a61a0fab66ee1afe3ccd0 -->
# Proposal

Change: `release-merge-leftovers` · Date: 2026-11-23 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(source: `requirements.md`; the roadmap line `release-merge-leftovers` of `openspec/roadmap.md`,
item 1 of the `release-merge-conflict` retro). Plan base: `c1ac8c4` (origin/main).

## Why

devkit-openspec 0.29.0 (release 0.33.0) replaced the release rebase with a merge and removed the
`push-rebased` step from the change loop, the conduct checker and the `devkit` skill, but three places
still name it: the `commit-attribution` spec (one scenario and one mention), and the panel's step table
and label table (with the panel test list that mirrors them). The same retro noted that the
release-merge override was only ever tested under the plain `pr` ship mode, never under the two-PR
delivery model, where the base branch and the test branch differ and a wrong branch in the merge
command would go unnoticed.

## What Changes

- `openspec/specs/commit-attribution/spec.md` (through this change's delta, applied at archive): the
  scenario "A branch the loop's own rebase rewrote" goes, and the scenario "Every dispatch of the
  commit agent names the block" stops listing the devkit skill's `push-rebased` item; it keeps the
  shipping skill's rows and the devkit skill's `agent` items. Because the OpenSpec CLI refuses a
  MODIFIED block that drops a scenario, the requirement that holds the dropped scenario is removed
  and added again under a new header, with its text and its nine other scenarios unchanged (see
  "Flagged for the owner").
- `plugins/panel/hooks/steps.ts` drops `push-rebased` from the `pr` step group,
  `plugins/panel/hooks/i18n.ts` drops its label pair, and `plugins/panel/hooks/report.test.tsx` drops
  it from `ACTOR_STEPS`. A step id the panel does not know already falls back to its id, so nothing
  else in the panel changes.
- `plugins/openspec/hooks/conduct-check.test.mjs` gains two tests that run the release-merge override
  with `openspec/config.yaml` set to the two-PR delivery model (`two-prs`, base `main`, test branch
  `develop`): a conflict only in release files answers `resolve-release-conflict` with the paths and a
  merge command on `main`; a conflict that also has `README.md` answers `blocked`. The `TWO_PRS`
  config text moves into `conduct-check.test.mjs` and `delivery-models.test.mjs` re-exports it, byte
  for byte (see "Flagged for the owner").
- Release: a patch of devkit-panel, of devkit-openspec (its test files change) and of the
  marketplace, a `CHANGELOG.md` entry, and the CI pin of `docs/openspec-flow.md` moved to the new
  devkit-openspec version with its assertion in `plugins/openspec/hooks/change-loop.test.mjs`.

Non-goals: everything under "Out of scope" in `requirements.md` (how the release step, the override
or the delivery checker work; `CHANGELOG.md` history and `openspec/changes/archive/**`, which keep
naming `push-rebased`; the evidence-attempt counting and the live check). The guards that the step
stays gone are kept as they are: the `change-coordination` scenarios "No step pushes by force" and
"A branch the loop's own rebase rewrote" (a different scenario of the same name, which says the loop
hands no push), and the negative assertions of `plugins/openspec/hooks/change-loop.test.mjs`
(`change-loop decide: the B rows are exactly the steps the checkers can return`,
`release-merge-conflict 16`, `commit-attribution AC-1 T1` to `T5`). If a new test shows the override
misbehaves under `two-prs`, that is a defect of the override: the implementation stops and the owner
decides; it is not fixed here.

## Acceptance criteria

Copied from `requirements.md`, with their ids.

- AC-1: `openspec/specs/commit-attribution/spec.md` holds no `push-rebased` and no scenario that hands a rewritten branch to the commit agent; the scenario on every dispatch of the commit agent still names the shipping skill's rows and the devkit skill's `agent` items.
- AC-2: `plugins/panel/hooks/steps.ts`, `plugins/panel/hooks/i18n.ts` and `plugins/panel/hooks/report.test.tsx` hold no `push-rebased`, and the panel's own suite passes with the label table and the step table still agreeing.
- AC-3: with `openspec/config.yaml` set to the two-PR delivery model, a change PR that conflicts only in `CHANGELOG.md` and the manifests makes conduct-check answer `resolve-release-conflict` with the paths and a command ending in `--base main`; a conflict in `README.md` as well makes it answer `blocked`.
- AC-4: no behaviour changes: the release step, the override and the delivery checker answer every input as before, and the other suites keep their results.

Exit criteria: every phase gate of `tasks.md` green, ending with
`node --test plugins/openspec/hooks/guard.test.mjs` (run with the CI branch variables set and an
empty `TMPDIR`), the panel suite (`plugin test plugins/panel` with the desktop app's bundled
Claude Code), `python3 scripts/check.py`, `python3 scripts/gen-catalog.py --check`,
`claude plugin validate .` and `openspec validate release-merge-leftovers --strict`; AC-1 is proven
before the pull request by archiving the change in a scratch copy of `openspec/`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `commit-attribution`: REMOVED "A hand-off to the commit agent asks the session for its attribution
  lines" and ADDED "Every hand-off to the commit agent asks the session for its attribution lines",
  the same text and scenarios without the one on the `push-rebased` hand-off; MODIFIED "The session
  appends its own attribution lines to the commit agent's prompt", written whole, whose scenario on
  every dispatch of the commit agent drops the `push-rebased` item.

## Impact

- devkit-panel (patch above origin/main's at the last merge before review; 0.3.0 at the plan base):
  `hooks/steps.ts`, `hooks/i18n.ts`, `hooks/report.test.tsx`.
- devkit-openspec (patch above origin/main's at the last merge before review; 0.33.0 at the plan
  base): `hooks/conduct-check.test.mjs`, `hooks/delivery-models.test.mjs`,
  `hooks/change-loop.test.mjs` (the CI-pin assertion only). No hook, skill, agent or schema changes.
- Spec: `openspec/specs/commit-attribution/spec.md`, through the delta at archive.
- Docs and release: `docs/openspec-flow.md` (the CI pin, three lines), `CHANGELOG.md`,
  `.claude-plugin/marketplace.json` (the two packs and the marketplace patch; 0.37.0 at the plan
  base). After the merge the loop answers `tag-release` for the new devkit-openspec version
  (`devkit.release_tag`, ADR 0019).
- Runtime: none. Two more conduct-check tests (one fixture repository each) add a few seconds to
  the guard suite.

**Decisions cited.** ADR 0002 and ADR 0003 (the `merge` ship mode and the ruleset's required checks,
unchanged). ADR 0018 (the two-PR delivery model; decision 2 makes the base branch the repository's
default branch, which is why the merge command names `main` and never the test branch). ADR 0019
(the tag of the release after the merge). No new ADR: the change records no decision.

**Dependencies.** `release-merge-conflict` (archived 2026-11-23) removed the step and wrote
`releaseConflict`; `delivery-models` (archived) wrote `two-prs` and `TWO_PRS`. Nothing this change
uses is still under way.

**Open decisions inherited.** None: the change touches no point of `docs/coordination-design.md`
"Open points".

**Flagged for the owner at plan approval.**

- `requirements.md` says the scenario "A branch the loop's own rebase rewrote" is removed from its
  requirement. OpenSpec 2.0.0 refuses that in both `validate` and `archive`: a MODIFIED block must
  keep every scenario the current spec has, and one requirement cannot be both REMOVED and ADDED
  under the same header. The delta therefore removes the requirement and adds it again as "Every
  hand-off to the commit agent asks the session for its attribution lines": the same body and the
  nine other scenarios, word for word. After the archive the spec has no such scenario and no
  `push-rebased` (AC-1); the two visible side effects are the new header (no file references the
  old one) and the requirement's place, which moves from first to last of the three. The other way
  out, keeping a scenario of that name rewritten to say the loop hands no push (as
  `change-coordination` did in `release-merge-conflict`), keeps the leftover's title in this spec,
  so the plan does not take it.
- AC-3 says the command ends in `--base main`. The override's command at the plan base is
  `node <hooks>/release-merge.mjs --base main --json`: it holds `--base main` and ends with `--json`.
  The new test asserts that the value after `--base` is `main` and that no argument is `develop`;
  the command itself does not change (AC-4).
- `requirements.md` says the test reuses `TWO_PRS` exported by `delivery-models.test.mjs`. Importing
  it from there into `conduct-check.test.mjs` would make an import cycle (`delivery-models.test.mjs`
  already imports `roundRepo` from `conduct-check.test.mjs`), and `delivery-models.test.mjs` builds a
  fixture with `roundRepo` at load, before `conduct-check.test.mjs` has defined the constants
  `roundRepo` reads: the guard suite would fail at load. The plan keeps one constant: it is defined in
  `conduct-check.test.mjs`, and `delivery-models.test.mjs` imports and re-exports it unchanged, so
  `release-tags.test.mjs` and every existing use read the same text from the same export.
- The release bumps devkit-openspec as well as devkit-panel: its test files change, and
  `CONTRIBUTING.md` step 5 bumps every pack a change touches (as test-only releases did before,
  0.26.1 and 0.32.2). This moves the CI pin and tags the release after the merge.
