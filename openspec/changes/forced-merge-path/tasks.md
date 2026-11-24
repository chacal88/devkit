<!-- devkit-stage tasks result=passed attempt=1 commit=def86377b435bf281d5a933226deb5a4782e4de4 -->
# Tasks

Change: `forced-merge-path` · Date: 2026-11-24 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. The how is fixed in `design.md` (D-1 to D-13):
copy the names, texts, calls and rules from there and make no design choice; a choice the design
does not settle stops the phase and goes to the owner.

Every gate is one backticked command, run as written; no part holds a `|`. Every hook gate runs with
`TMPDIR=/private/tmp`, `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does.
Gates that load `deliver-check.test.mjs` take minutes and run as a background command of the tool,
never with a shell `&`; the whole suite runs once, in 3.6.

Test first. The first task of each phase writes that phase's tests, runs them on the code as it is,
and saves the output to `openspec/changes/forced-merge-path/proof/red-<phase>.txt`; that run is the
task's check, never a gate. Every new test's name starts `forced-merge-path <phase>: `. A test of a
new export reaches it through a namespace import. No test reads this repository's git history.

Existing tests change only where `design.md` D-12 ("Existing tests that assert a rule this change
touches") names them, each with its invariant, layer and suite; name them in the commit message.
End every task with `git status --short` and leave no scratch file in the tree.

## 1. The delivery checker (`plugins/openspec/hooks/guard.mjs`, `deliver-check.mjs`)

- [x] 1.1 Write the phase 1 tests of D-12: V1 in `plugins/openspec/hooks/guard.test.mjs` beside the `readValue` tests; N11 in `plugins/openspec/hooks/delivery-models.test.mjs`; F1-F11, G1-G10, E1, L1-L4, N1-N10 and R1 in `plugins/openspec/hooks/deliver-check.test.mjs`, with N1-N4 on the PR 88 shape (task 9.6 unticked on `main`, `check` SUCCESS, `devkit-reviews` FAILURE) and N6 asserting no `pr view 12` call in the fake's calls log. Check: `proof/red-1.txt` holds the red run, every new test failing for the missing behaviour, not at load.
- [x] 1.2 Split `valueIn(text, key)` out of `readValue` in `plugins/openspec/hooks/guard.mjs` (D-3), no behaviour changes. Check: `env TMPDIR=/private/tmp node --test --test-name-pattern "readValue|valueIn" plugins/openspec/hooks/guard.test.mjs` (run as a background command of the tool) passes V1 and the existing `readValue` tests of `guard.test.mjs` ("readValue: unfilled template line is not a value; full token kept" and "field-fixes 10 verdict: readValue returns the first Verdict line ...").
- [x] 1.3 Add `notGreen` and `forcedChecks` to `deliver-check.mjs` (D-2), reusing `requiredChecks` from `merge-setup.mjs`. Check: F1-F9 pass and F10's `forcedChecks` answers are the `{ error }` it names (its step assertions pass in 1.6).
- [x] 1.4 Add `gatesAtHead` with its per-run compare cache and its unexpected-shape errors (D-3). Check: G1-G8 pass and G9's `gatesAtHead` answers are the `{ error }` it names (its step assertions pass in 1.6).
- [x] 1.5 Add the commit arm to `findChangePr`'s list path and the `merged` field to `mergedOnBranch`'s `none` answer (D-1), the commit arm's errors carrying `arm: 'commit'`. Check: L1, L2, L4 and L3's `findChangePr` answer pass (its step assertion passes in 1.6) and `deliver-check.test.mjs:5041` passes with its added `merged.number` assertion.
- [x] 1.6 Add `forcedMerge` and wire it into `deliveryOf` (its base, the `unreadMerge` fact), `collectState` (`postMerge`, `mergedLeft` null on `forced` or `unreadMerge`, `common.forced`, `common.unreadMerge`, items 1 and 6), the `blocked` row of `nextStep` between the `state.archive` row and the `branchOk` row, and the `retro` row of `archiveNext` (D-3 to D-5). Check: N1-N11, F10, F11, G9, G10, L3 and E1 pass, and `deliver-check.test.mjs:5066` passes unchanged (AC-1, AC-3, AC-4, AC-6).
- [x] 1.7 Add the green-checks fixtures D-12 names to `deliver-check.test.mjs:4985`, `:5016` and `flow-check.test.mjs:998`, assertions unchanged. Check: those three pass and the partial-merge scenarios of AC-2 still answer `stop-branch` and `open-pr`.
- [x] 1.8 Check R1 against the unchanged `archivePrCheck` (D-9). Check: R1 passes with no change to `deliver-check.mjs`'s CI code.
- [x] 1.9 Gate: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/conduct-check.test.mjs` green; covers AC-1 to AC-4 and AC-6 at the checker.

## 2. The loop, the skills and the replay (`change-loop.mjs`, `ship-change`, `devkit`, `proof/`)

- [x] 2.1 Write the phase 2 tests of D-12 (C1-C3 in `plugins/openspec/hooks/change-loop.test.mjs`, D1 there, D2 in `deliver-check.test.mjs` beside "format: ship-change archive rows ..."). Check: `proof/red-2.txt` holds the red run.
- [x] 2.2 In `plugins/openspec/hooks/change-loop.mjs`, the forced row's precedence over `testStageStep` and its `reply`, and the `forced-merge` key in the `en` and `pt-BR` message tables (D-6). Check: C1-C3 pass and the message-table test of "Replies use no internal term" passes.
- [x] 2.3 Add D-7's sentence to the `retro` row of `plugins/openspec/skills/ship-change/SKILL.md` and D-6's sentence to the `- \`session\`` item of `plugins/openspec/skills/devkit/SKILL.md`. Check: D1, D2, `change-loop.test.mjs:2463` and the "format: ship-change archive rows ..." test pass (AC-5).
- [x] 2.4 Write `openspec/changes/forced-merge-path/proof/replay.mjs`, `proof/gh-shim.mjs` and the fixture cases under `proof/fixtures/` (D-13, the failed rollup read and the `pt-BR` clone of D-7 included), reading nothing but GitHub through the shim and the local clone; this is the harness of AC-8, which the evidence runs. Check: `node openspec/changes/forced-merge-path/proof/replay.mjs --case pr88 --dry-run` prints the three checkouts it would build and exits 0, and a shim call with `-X POST` exits non-zero naming the refusal.
- [x] 2.5 Gate: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/deliver-check.test.mjs` green; covers AC-1 and AC-5 at the loop and the skills.

## 3. Documents, decision records and release

- [x] 3.1 Update `docs/openspec-flow.md` as D-10 lists (delivered paragraph, "The post-merge phase", "Finding the change PR"). Check: `python3 scripts/check.py` exits 0 and every link the paragraphs add resolves (the pin tests run in 3.3).
- [x] 3.2 After the owner's plan approval only: add ADR 0022 to the `ADRs:` line of `openspec/config.yaml` `context:` and the "Amended by" header line and Context note to `docs/adr/0003-auto-merge-the-archive-pr.md` (D-10), the ADR's number being the next free number on `origin/main` at the last merge before review (rename `docs/adr/0022-an-owners-forced-merge-leads-the-change-to-the-archive.md` and every reference when a sibling took it). Check: `openspec validate forced-merge-path --strict` passes and `grep -c "an owner's forced merge" openspec/config.yaml` prints 1 (AC-7).
- [ ] 3.3 Release: merge `origin/main`, then set devkit-openspec's version in `plugins/openspec/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry, and the marketplace version, each to the next free version after `origin/main`'s at the last merge before review; move the CI pin lines of `docs/openspec-flow.md` to that devkit-openspec version; add the CHANGELOG entry (forced merge path, ADR 0022). Check: the pin tests of `deliver-check.test.mjs` and `change-loop.test.mjs` pass and `command claude plugin validate .` exits 0.
- [x] 3.4 Run `python3 scripts/gen-catalog.py --check`. Check: exit 0 (no description changed).
- [x] 3.5 Run `openspec validate forced-merge-path --strict` and `python3 scripts/check.py` once every document is written. Check: both exit 0 (AC-7).
- [ ] 3.6 Gate: `env TMPDIR=/private/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate forced-merge-path --strict` green (the guard suite as a background command); covers AC-1 to AC-7 and every other suite at once.

## Workflow follow-up

- The pr-verifier runs `proof/replay.mjs` for PR 88 (live) and every other case of D-13 (live once
  merged, else its fixture), the real `claude -p` retro runs of D-13 for each case that reaches the retro, live once merged, else from its fixture, plus the `pt-BR` run of D-7, `openspec archive
  roadmap-sessions-upfront --yes` with stdin closed on a scratch clone at PR 88's head, and one live
  read-only call of each new GitHub route, and records them in `evidence.md` (AC-4, AC-5, AC-8).
- ADR 0022 is accepted by the loop's `accept-decisions` step after the owner approves the plan.
- After the merge the loop's `tag-release` pushes the devkit-openspec tag (ADR 0019).
- Archive the change after the review bench and the owner's answers to the retro.
