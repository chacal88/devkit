# Tasks

Change: `evidence-before-review` · Date: 2026-11-12 · Owner: Kaue (chacal88)

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, and `pr-verifier` copies each part verbatim into its
Gates table, so no part holds a `|`. The desktop app's bundled Claude Code (the only one with
`plugin test`) is named without its version, as CONTRIBUTING "Testing a mod pack" says:
"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")"
(2.1.321 on 2026-11-12).

Precondition of every gate with `plugin test`: the bundled binary's `plugin test --help` prints `Run
a mod's tests`. When it prints the rollout-switch refusal instead (exit 0 as well), run the bundled
binary once with `-p "ok" --max-turns 1 --model haiku` and network access, then check again. The
switch holds for about two minutes, which is why `plugin test` is the first part of each gate.

Gates 1.9 and 4.9 hold the guard suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about
13 minutes, 12m54s observed on 279c830; it imports `deliver-check.test.mjs` and `conduct-check.test.mjs`), so they run as a
background Bash, never as a foreground tool call, which stops at 600 s.

Work only in the change's worktree on branch `evidence-before-review`. Plain bullets under
`## Workflow follow-up` are not tasks: `deliver-check` counts every checkbox of this file.

From gate 1.9 on, the conducting session reads the next step from the working tree's checkers, not
the installed 0.12.0 ones (design D10).

The acceptance criteria carry the ids `deliver-check` item 4 reads (`AC-<n>`, from the
`## Acceptance criteria` section of `proposal.md`), each with its slug. A test that proves a
criterion starts its name with the id and the slug (`AC-2 defect-before-review: ...`); existing
tests keep their names. `pr-verifier` writes one row per id, AC-1 to AC-8, in its
`| AC-N | <criterion> | <proof and where it is> | pass |` form, the criterion cell starting with the
slug; a row's cells name no other `AC-<n>` id (a cross-reference goes by slug).

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `evidence-first` | 1.1, 1.2, 1.3, 1.6, 1.9 |
| AC-2 | `defect-before-review` | 1.1, 1.2, 1.9 |
| AC-3 | `fix-restales-both` | 1.1, 1.3, 1.9 |
| AC-4 | `no-mutual-staleness` | 1.4, 1.9 |
| AC-5 | `guards-kept` | 1.5, 1.9 |
| AC-6 | `instructions-follow` | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 3.3, 3.9 |
| AC-7 | `panel-order` | 3.1, 3.2, 3.9 |
| AC-8 | `release-ready` | 4.1, 4.2, 4.3, 4.4, 4.5, 4.9, 5.1, 5.9 |

## 1. deliver-check: evidence before review (AC-1, AC-2, AC-3, AC-4, AC-5)

- [x] 1.1 In `plugins/openspec/hooks/deliver-check.mjs#nextStep`, move the `fix-defect` block (with
  its `const ac`) and the `verify` block to just after the `fix-review` block and before the
  `toReview` / `review` block (design D2). Nothing else in `nextStep` moves; `staleness()`, the step
  names, the `round` computation and the JSON stay as they are. The comment above `nextStep` names
  this change's design D2 beside "design D4, first match wins". Verify: the tests of 1.2 and 1.3
  pass and fail on the old order (AC-1 evidence-first, AC-2 defect-before-review, AC-3
  fix-restales-both).
- [x] 1.2 Unit tests in `plugins/openspec/hooks/deliver-check.test.mjs`, beside the `nextStep row`
  tests, built with `state()`:
  - `AC-1 evidence-first: ...`: item 1 or item 4 with evidence missing (and stale) and item 2 with
    both reviewers missing (and stale) gives `verify`; evidence current with no defect and the
    reviewers missing gives `review` with both reviewers, round 1;
  - `AC-2 defect-before-review: ...`: a `defects: ['AC-1']` row at current evidence gives
    `fix-defect` with the reviewers missing, stale, and current-approved with nothing undisposed;
  - `D2: ...`: a current rejected review beside a current defect gives `fix-review`; a round-2
    deadlock with evidence missing gives `stop-review-deadlock`; a `noProof` criterion at current
    evidence with the reviewers missing gives `review`, and with them approved gives `blocked`
    item 4.

  Verify: each test fails when 1.1 is reverted.
- [x] 1.3 Integration tests in `deliver-check.test.mjs` with `shipRepo()`, `reviewAt()` and
  `fullEvidence()`:
  - the walkthroughs flip (design D5): `driveToReady` gives `[..., 'commit', 'verify', 'review',
    'open-pr', 'ready']` (line 1781) and the merge-mode one `'verify', 'review'` (line 2324);
  - `AC-3 fix-restales-both: ...`, three cases from a change with current evidence and approved
    reviews: (a) a rejected review at `HEAD` and `review.md` at `FAIL (round 1/2)`, then a product
    commit: `verify`, then after `fullEvidence` `review` for the stale reviewers at round 2;
    (b) a `fail` row at current evidence, then a product commit: `verify`, then `review`;
    (c) an open PR with a failing check (as the row-17 tests stub it), then a product commit:
    `verify`, then `review`, then after the reviews `push`.

  Verify: these tests pass (AC-1 evidence-first, AC-3 fix-restales-both).
- [x] 1.4 `AC-4 no-mutual-staleness: ...` tests in `deliver-check.test.mjs` (design D3), with
  `gitRepo` / `collectState` on a committed change: `evidence.md` at `HEAD`, then `reviews/*.md`
  written uncommitted, then committed: items 1 and 4 keep `evidence: 'current'` both times; the
  reverse (reviews at `HEAD`, then `evidence.md` uncommitted, then committed): item 2 stays `met`
  both times. Verify: the tests pass, and the same assertions fail when a `src/` file is committed
  in between (the control case).
- [x] 1.5 `AC-5 guards-kept: ...` tests (design D4):
  - in `plugins/openspec/hooks/guard.test.mjs`, beside "gh pr create needs approved reviews and
    evidence": `evidence.md` written first and no `reviews/` refuses `gh pr create` with
    `review not approved`; approved reviews and no `evidence.md` refuses it with `evidence.md`;
  - in `deliver-check.test.mjs`, beside the `--ci` tests: with `ciRepo()`, a later product commit
    and only the reviews re-recorded at it fails with item 1 and item 4 (evidence stale); only the
    evidence re-recorded at it fails with item 2 (reviews stale).

  Verify: the tests pass; `guard.mjs` and the `--ci` code are unchanged (`git diff` shows no line of
  `guard.mjs` and no line outside `nextStep` in `deliver-check.mjs`).
- [x] 1.6 Adjust the existing tests that asked for `review` while the evidence was missing, by
  design D5's rule (about the order: flip; about something else: record evidence first):
  in `deliver-check.test.mjs`, as design D5's table says:
  - line 1717 (scoped re-review): record `fullEvidence` before each `t.next()`;
  - line 1784 (round-2 deadlock resume): after the owner's commit expect `verify`, then record
    `fullEvidence`, then expect `review` round 1 with both reviewers;
  - line 2361 (auto-merge after a product commit): after `disable-auto-merge` push the next step,
    `verify`, into `seen`, then call `fullEvidence`, then push `review` and call `reviewAt`, so
    `seen` reads `'disable-auto-merge', 'verify', 'review', 'push'`;

  and `plugins/openspec/hooks/conduct-check.test.mjs` line 710
  (renamed "after the force push both are stale: verify, then review (override 2c)": `verify` as
  `subagent` `devkit-core:pr-verifier`, then, with evidence recorded, `['review', 'review']`).
  Any other test the suite turns red follows the same rule and is named in the phase report.
  Verify: the guard suite is green (gate 1.9) (AC-1 evidence-first).
- [x] 1.9 Gate: `node --test plugins/openspec/hooks/guard.test.mjs` green (AC-1 evidence-first, AC-2 defect-before-review, AC-3 fix-restales-both, AC-4 no-mutual-staleness, AC-5 guards-kept). Run as a background Bash.

## 2. Instructions, skills and docs (AC-6)

- [x] 2.1 Schemas (design D6): in `plugins/openspec/schemas/devkit/schema.yaml` and
  `plugins/openspec/schemas/devkit-lite/schema.yaml`, `apply.instruction` dispatches
  `devkit-core:pr-verifier` first (a defect fixed by `tdd-implementer`, then `pr-verifier` again),
  then the review-change skill (after a fix: `pr-verifier` again, then the reviewers concerned),
  then `commit-and-pr`; `description:` ends "→ evidence + review before the PR". Copy both files
  byte-identical to `openspec/schemas/devkit/schema.yaml` and
  `openspec/schemas/devkit-lite/schema.yaml`. Verify: `cmp` of each pair exits 0 and
  `openspec schema validate devkit` and `devkit-lite` print valid (AC-6 instructions-follow).
- [x] 2.2 Configs (design D6): `plugins/openspec/skills/openspec-setup/templates/config.yaml` and
  `openspec/config.yaml`: the header comment reads "apply → evidence + reviews", and the
  `operations.apply.guidance` line dispatches `devkit-core:pr-verifier` before `review-change`.
  Verify: `node --test --test-name-pattern="the config template says who merges"
  plugins/openspec/skills/openspec-setup/scripts/github-setup.test.mjs` stays green (it reads other
  lines of the template; the whole file takes about seven minutes, so filter it) and the 2.6 test
  passes (AC-6 instructions-follow).
- [x] 2.3 Skills (design D6): `plugins/openspec/skills/ship-change/SKILL.md` (description "verifies,
  reviews"; Mode list `pr-verifier`, `review-change`; the `commit` row "verify and review run
  next"; Resume; the Hosts `app` line `fix-checks`, its commit, `verify`, scoped re-review, `push`)
  and `plugins/openspec/skills/conduct/SKILL.md` (the Delivery rows sentence on the checker's
  order). The step table keeps a row for every `next.step`. Verify: the `format: ship-change ...`
  tests pass and the 2.6 test passes (AC-6 instructions-follow).
- [x] 2.4 `docs/openspec-flow.md` (design D6): lines 51, 61, 199, 420 and 541 in the new order, and a
  new **Order of the delivery steps.** paragraph in "The delivery contract", after "The `Commit:`
  staleness rule", with design D2's rows and why reviews and evidence never stale each other.
  The CI pin is not touched here (task 4.3). Verify: `python3 scripts/check.py` (links, language)
  and the 2.6 test pass (AC-6 instructions-follow).
- [x] 2.5 READMEs and descriptions (design D6): `plugins/core/README.md` (line 3, the line-17
  diagram with the `│` above still aligned, the "Prove it works" row above "Review"), `README.md`
  (line 9 list, line 47 diagram), the devkit-openspec `description` in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` ("TDD →
  evidence → review"); then `python3 scripts/gen-catalog.py` regenerates `docs/catalog.md` and the
  catalog blocks. Verify: `python3 scripts/gen-catalog.py --check` exits 0 and
  `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` is green (it reads
  the core README's Review row) (AC-6 instructions-follow).
- [x] 2.6 The text test `AC-6 instructions-follow: ...` in `deliver-check.test.mjs`, beside the
  `format:` tests (design D6): the schema copies are identical; the positive markers of the listed
  files; the `OLD_ORDER` scan over `git ls-files` outside `openspec/changes/`, `CHANGELOG.md`,
  `plugins/panel/hooks/fixtures/` and the test file itself, with design D6's phrases. Verify: it
  passes on the edited tree and fails when any one listed old phrase is put back in any scanned
  file (try one by hand and revert) (AC-6 instructions-follow).
- [x] 2.9 Gate: `node --test --test-name-pattern="instructions-follow" --test-name-pattern="format:" plugins/openspec/hooks/deliver-check.test.mjs && node --test plugins/core/skills/review-change/scripts/review-round.test.mjs && openspec schema validate devkit && openspec schema validate devkit-lite && python3 scripts/check.py && python3 scripts/gen-catalog.py --check` green (AC-6 instructions-follow).

## 3. devkit-panel: Provas before Revisão (AC-6, AC-7)

- [ ] 3.1 In `plugins/panel/hooks/i18n.ts`, `STEP_KEYS` becomes `[..., 'implementation', 'proofs',
  'review', 'pr', ...]`; the `StepKey` union and `STEP_NAMES` follow the same order (design D7).
  Read `STEP_OF`, `STEP_ITEMS`, `stepOfItem`, the `partial` rules, the `isFinished` fallback and
  `nowOf`'s `then` in `plugins/panel/hooks/steps.ts` against design D7; if any of them needs a
  change, make it and amend design D7 in this phase. Verify: the 3.2 tests (AC-7 panel-order).
- [ ] 3.2 Tests (design D7): flip `plugins/panel/hooks/report.test.tsx` lines 606, 612-613, 942,
  952-953, 961-965, 1017 and 1021, and `plugins/panel/hooks/panel.test.tsx` lines 396, 405-406, 444
  and 458 to the new order; add `AC-7 panel-order: ...` to `report.test.tsx` (a row with
  `next.step: verify`: Proofs `current`, Review `pending`, `then` reads `Depois: revisão, PR e
  checks, merge.`) and to `panel.test.tsx` (the `Passos` lines on both surfaces read
  `● Provas ...` and then `○ Revisão`, in `mock/passos.md`'s order). The mock's numbers (5
  criteria, `0/5`, `14/14`) only illustrate the order; the tests build their own data. Verify:
  gate 3.9 (AC-7 panel-order).
- [ ] 3.3 `plugins/panel/README.md` line 31 lists `Provas` before `Revisão`; add the panel's old
  phrases (`'review', 'proofs'`, `Revisão, Provas`, `revisão, provas`, `review, proofs`) to the
  `OLD_ORDER` list of the 2.6 test. Verify: the `instructions-follow` test passes (AC-6
  instructions-follow).
- [ ] 3.9 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate plugins/panel && node --test --test-name-pattern="instructions-follow" plugins/openspec/hooks/deliver-check.test.mjs` green (AC-7 panel-order, AC-6 instructions-follow).

## 4. Release files (AC-8)

- [ ] 4.1 Versions (design D8): `plugins/openspec/.claude-plugin/plugin.json` 0.13.0,
  `plugins/core/.claude-plugin/plugin.json` 0.6.2, `plugins/panel/.claude-plugin/plugin.json` 0.2.1,
  the same three in `.claude-plugin/marketplace.json`, and its `metadata.version` 0.16.0. Verify:
  the 4.5 test (AC-8 release-ready).
- [ ] 4.2 `CHANGELOG.md`: a `## 0.16.0 — evidence before review` entry on top, one line each for
  devkit-openspec 0.13.0, devkit-core 0.6.2 and devkit-panel 0.2.1, and a Docs line (the flow doc,
  CONTRIBUTING's tag rule, the CI pin at `v0.13.0`). Verify: `python3 scripts/check.py` (its
  CHANGELOG check reads the metadata version) (AC-8 release-ready).
- [ ] 4.3 The CI pin in `docs/openspec-flow.md` (lines 479, 480, 487) names `v0.13.0`. Verify: the
  existing test "the pin in docs/openspec-flow.md is the commit sha of v + the devkit-openspec
  version" passes (AC-8 release-ready).
- [ ] 4.4 `CONTRIBUTING.md` (design D8): add the new release tag rule after step 5 of "Adding or
  changing an asset" (a release that changes devkit-openspec's version is tagged `v<that version>`
  on its merge commit on `main`, a lightweight tag pushed after the merge; a release that bumps
  only other packs gets no new tag), and on line 40 replace the guard-suite time "about 9 minutes;
  8.7 observed on 94e795d" with "about 13 minutes; 12m54s observed on 279c830". Verify: the 4.5 test and `python3 scripts/check.py` (AC-8 release-ready).
- [ ] 4.5 `AC-8 release-ready: ...` test in `deliver-check.test.mjs` (design D8): every pack's
  `plugin.json` version equals its `marketplace.json` entry; the doc pin names
  `v<devkit-openspec version>`; CONTRIBUTING holds the tag rule (`v<devkit-openspec version>`,
  "merge commit", "lightweight"). Verify: it passes, and fails with one marketplace version
  changed by hand (revert after) (AC-8 release-ready).
- [ ] 4.9 Gate: `"$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin test plugins/panel && "$(for c in "$HOME/Library/Application Support/Claude/claude-code/"*/*/claude.app/Contents/MacOS/claude; do :; done; echo "$c")" plugin validate . && node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate evidence-before-review` green (AC-8 release-ready, and every criterion's tests together). Run the whole gate as a background Bash; `plugin test` goes first because the refreshed switch holds about two minutes and the guard suite alone takes about 13.

## 5. Release tag free, owner-run (AC-8)

This phase is the conducting session's (design D9). When the checker reports `implement` phase 5,
the conducting session runs it itself: no tdd-implementer dispatch and no child session, because
it reads `origin` and writes no code. A child session or implementer that receives phase 5 anyway
ends at once with `Outcome: failure: phase 5 is the conducting session's (tasks.md)` and changes
nothing. AC-8 covers only what exists before the PR (requirements.md, Assumptions): this phase
proves `v0.13.0` is free. Creating and pushing the tag on the merge commit is a post-merge step
(Workflow follow-up, design D9), recorded and checked in `retro.md`, so every checkbox here can be
ticked before the PR.

- [ ] 5.1 Owner-run, by the conducting session (no implementer, no child session): check the tag is
  free and the release reads 0.13.0, in the worktree:
  - `git ls-remote --tags origin refs/tags/v0.13.0` prints nothing;
  - `git tag --list v0.13.0` prints nothing;
  - `plugins/openspec/.claude-plugin/plugin.json` reads `"version": "0.13.0"`.

  Write the three outputs, with the post-merge commands of design D9, to a file in the conducting
  session's scratchpad for `pr-verifier`. If the tag exists, stop and tell the owner; never move
  it.
- [ ] 5.9 Gate: `node --test --test-name-pattern="release-ready" plugins/openspec/hooks/deliver-check.test.mjs && python3 scripts/check.py` green (AC-8 release-ready). Owner-run, by the conducting session (no implementer, no child session): ticked only once 5.1's record is written.

## Workflow follow-up

- `pr-verifier` writes `evidence.md` after 5.9, before any review round (design D10). The
  conducting session appends to the ship-change `verify` dispatch prompt:
  - run `node plugins/openspec/hooks/deliver-check.mjs evidence-before-review --json` in the
    worktree before writing, and quote its `next.step` and item 2, as the live proof of AC-1
    evidence-first on this change;
  - 5.1's record, for AC-8 release-ready (the tag free on `origin` and locally); the row is `pass`
    on the pre-merge facts design D9 lists, and names no post-merge fact;
  - every gate part in its Gates table, the guard suite as a background Bash.
- The reviewers get the guard suite's result from `evidence.md` instead of re-running it.
- After the merge, when the checker reports `retro`, before the retro dispatch: the tag commands of
  design D9 (`git fetch origin main`; the merge commit from `gh pr view <n> --json mergeCommit`;
  `git tag v0.13.0 <sha>`; `git push origin v0.13.0`; `git ls-remote origin refs/tags/v0.13.0`),
  with their output passed to the retro dispatch: `retro.md` records it and checks that the
  `git ls-remote` line names the merge commit's sha; a missing or misplaced tag is reported there
  to the owner. This step is not an acceptance criterion and has no checkbox.
- After the merge: `claude plugin update devkit-openspec@devkit`, `devkit-core@devkit` and
  `devkit-panel@devkit` in the devkit repository.
- Digital-Representative picks up the `v0.13.0` schemas in a later change there (out of scope).
