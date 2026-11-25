<!-- devkit-stage tasks result=passed attempt=6 commit=9b67c11f446bfd8f24407556df9c082589acd50f -->
# Tasks

Change: `release-at-merge` · Date: 2026-11-24 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

Work only in this change's worktree, on its branch. Every name, text, rule and test is in `design.md`
(D-1 to D-17); the implementer copies them and makes no design choice: a choice the design does not
settle stops the phase and goes to the owner. No task writes a literal version of any pack or this
change's ADR number: the delivery step assigns them (D-17), and the tests build their versions in
fixtures. This change's ADR is cited `ADR [release-at-merge]` everywhere outside its own folder; no
test names its file.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and each gate exits 0 when its
phase is done. Phase gates run the test files of the area through `node scripts/test-suite.mjs
<files>` (each file in its own process and `TMPDIR`), with `TMPDIR=/var/tmp` and `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set as a pull-request run on CI does; the whole suite is the last gate, which the
train also runs. Run every `node` gate as a background command of the tool and judge it by its exit
code. Every new test is named `release-note <AC-n> <area>: ...` (D-15), builds its repository with
its file's helpers, blanks the branch variables through the file's shared constant, and makes its
folders through `test-tmp.mjs` with a `devkit-` prefix (CONTRIBUTING).

Test first in phases 2 to 5: the phase's test task comes before its code tasks, its new tests fail on
the code as the phase finds it (a test its task names as a guard passes there and says so), and that
failing run is saved as printed to `openspec/changes/release-at-merge/proof/red-<phase>.txt`; that run
is the task's check, never a gate. An existing test changes only where D-14 says, naming its
invariant, layer and suite in the commit message. Leave no backup or scratch file in the tree; end every task with `git status --short`.

| Id | Tasks |
|---|---|
| AC-1 | 2.1, 2.3, 2.5, 4.1, 4.3, 6.6, 7.2, 7.3, 7.5, 7.6, 9.11, 9.12 |
| AC-2 | 2.1, 2.3, 2.5, 6.6, 7.6, 7.7, 9.5, 9.6 |
| AC-3 | 3.1, 3.3, 6.3, 9.11 |
| AC-4 | 2.1, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 6.2, 8.1, 9.1, 9.5, 9.6, 9.11, 9.12, 9.14, 9.17, 10.1, 10.2, 10.3, 10.4, 10.5 |
| AC-5 | 2.4, 3.1, 3.2, 3.3, 4.3, 6.2, 6.3, 7.1, 7.4, 7.6, 8.1, 9.2, 9.3, 9.5, 9.6, 9.14, 9.17 |
| AC-6 | 5.1, 5.2, 5.3, 6.6, 7.1, 8.1, 9.17 |
| AC-7 | 2.1, 2.5, 3.1, 3.2, 3.3, 6.6, 9.2, 9.3, 10.3 |
| AC-8 | 3.1, 3.2, 6.5, 9.11 |
| AC-9 | 2.1, 2.2, 2.5, 3.1, 6.5, 7.4, 7.5, 9.11, 9.12, 9.14 |
| AC-10 | 3.1, 3.3, 4.1, 4.2, 6.4, 7.4 |
| AC-11 | 2.1, 2.5, 6.6 |
| AC-12 | 1.2, 2.1, 2.5, 4.3, 6.6, 9.8, 9.9, 9.11 |
| AC-13 | 4.1, 6.2, 6.3 |
| AC-14 | 5.1, 5.4, 5.5, 5.6, 5.7, 7.6, 9.1a, 9.3, 9.6, 9.9, 9.12, 9.17, 10.1, 10.2, 10.6 |
| AC-15 | 6.1 to 6.7, 7.1 to 7.8, 9.14, 9.15, 9.16 |
| AC-16 | 9.8, 9.9, 9.10, 9.15, 9.16 |

## 1. Setup

- [x] 1.1 Before this task the coordinating session commits the plan files (this change's folder and
  `docs/adr/release-at-merge.md`) on the branch. The plan base is `ba3126b` (it merged `origin/main` at
  `c663f21`, train 4, with `archive-release-pin`; design header and F-2). When `git merge-base
  --is-ancestor origin/main HEAD` exits 0, the merge does nothing. When the base has moved since
  (`origin/main` is not an ancestor), the merge runs: `git merge --no-ff origin/main`, resolving
  nothing by hand (a conflict outside `openspec/` stops the phase for the owner); then re-read
  `plugins/openspec/hooks/release-merge.mjs` and `deliver-check.mjs` against D-3a's two lists (what is
  already in `deliver-check.mjs`, what still moves): a listed name that is not where D-3a says, or a
  test the merge brought that asserts a text D-13 changes, stops the phase for a plan revision. Done
  when `git merge-base --is-ancestor origin/main HEAD` exits 0, D-3a's lists match the two files,
  `openspec validate release-at-merge --strict` passes, and `git status --short` lists no path outside
  `openspec/changes/release-at-merge/` (the stage files the flow writes uncommitted, `approval.md`
  among them, may be listed).
- [x] 1.2 Check that `openspec/changes/release-at-merge/approval.md` holds `- Release note: sha256:`
  followed by the first 12 hex of `sha256sum openspec/changes/release-at-merge/release.md` (D-17;
  AC-12 for this change itself). Done when the two values are equal; when the line is missing or
  differs, stop and ask the owner to approve the plan again with the line.
- [x] 1.3 Gate: `openspec validate release-at-merge --strict && python3 scripts/check.py` green.

## 2. The module boundary, the note, the release state and the delivery rows (deliver-check, flow-check)

- [x] 2.1 Write the D-15 tests of this phase: in `plugins/openspec/hooks/release-note.test.mjs` (new)
  the two boundary tests (D-3a), the AC-1 reader tests, the AC-2 state tests, the AC-9 "no key" and
  "release file missing" tests and the AC-11 tests; in `plugins/openspec/hooks/merge-setup.test.mjs`
  the boundary test of `--ci` and `guard.mjs ci` from the three downloaded files for a noted change;
  in `plugins/openspec/hooks/deliver-check.test.mjs` the rows N1 (each repository error included) to
  N7 and A1 (AC-2, AC-4, AC-7, AC-11, AC-12; N5 for behind and for the conflict stop) and the
  staleness tests (AC-4, AC-5); in `plugins/openspec/hooks/flow-check.test.mjs` the stage-header
  test. Run them and save the failing run as `proof/red-2.txt`. Done when every listed test exists by
  its D-15 name and `red-2.txt` shows them failing, except the source-scan boundary test, a guard that
  passes before and after the move (`red-2.txt` shows it passing).
- [x] 2.2 Apply D-3a: move `ReleaseError`, `bumpKind`, `applyBump`, `resolveManifest`,
  `withoutVersions` (now exported), `PIN_FILE`, `PIN_PACK`, `PIN_PACK_NAME` and their private `SEMVER`
  and `parseSemver` from `plugins/openspec/hooks/release-merge.mjs` into
  `plugins/openspec/hooks/deliver-check.mjs`, bodies unchanged; do not touch `PIN_MARKER`,
  `PIN_TOKEN`, `pinsIn`, `setPins`, `PIN_LINE_FILES` or `pinLinesOnly`, already in `deliver-check.mjs`
  (ADR 0027); write `TRAIN_PIN_FILE = PIN_FILE` with its comment; in `release-merge.mjs` grow the
  existing `import { RELEASE_FILE, pinsIn, setPins } from './deliver-check.mjs'` and `export { pinsIn,
  setPins }` lines to the names D-3a lists (no second import or export line, no second declaration),
  keeping `mergePins` and its local `MASK`. Done when both `release-note AC-9 boundary` tests of
  `release-note.test.mjs` pass and T-11, T-20, T-21, T-22 and T-42 stay green (`release-merge.test.mjs`,
  `merge-setup.test.mjs`, `delivery-train-after.test.mjs`, `delivery-train.test.mjs`,
  `release-tags.test.mjs`, `change-loop-compozy.test.mjs` "release-merge-conflict 15").
- [x] 2.3 In `plugins/openspec/hooks/deliver-check.mjs` add D-1 (`RELEASE_NOTE`, `parseReleaseNote`,
  `releaseNoteHash`), D-2 (`releaseFacts`; export `releaseTagOf`; move `ADR_DIRS` and `ADR_LINES` here,
  imported and re-exported by `conduct-check.mjs` and imported by `change-loop.mjs`) and D-3
  (`changeAdrs`, `computeRelease` with D-1's repository errors, `changelogEntry`, `releaseState`), with
  `node:` imports only (D-3a). Done when the AC-1, AC-2, AC-9 and AC-11 tests of
  `release-note.test.mjs` pass and the source-scan boundary test stays green.
- [x] 2.4 In the same file add D-5 (`maskRelease`, `releaseOnlyEdit`, the `release` option of
  `staleness`, passed by `tasksItem`, `acceptanceItem` and `readReviews` for approved or declined
  verdicts), and pass it from `collectFlow` in `plugins/openspec/hooks/flow-check.mjs`. Done when the
  staleness tests and the flow-check stage test pass and the T-13 tests stay green.
- [x] 2.5 In the same file add `state.release` to `collectState`, the rows N1 to N7 and A1 of D-8 in
  `nextStep`, and D-9's `approvalState` keys; add `ROWS['assign-release'] = session('delivery')` in
  `plugins/openspec/hooks/change-loop.mjs` (T-3) and `assign-release` to `MAIN` in
  `plugins/openspec/hooks/conduct-check.mjs` (T-4); in `plugins/openspec/skills/ship-change/SKILL.md`
  add the `assign-release` row as a new table line beside the `update-branch` row (D-10) and write the
  `- Release note:` text of D-9 inside the `stop-plan-approval` row's own table line, adding no line
  between it and the `stop-mockup-approval` row. Done when every N and A1 test and the merge-setup
  boundary test pass and these stay green: T-2, T-3, T-13, T-16 and T-36 (`guard.test.mjs`), T-29
  (`flow-check.test.mjs`), T-30, T-31 and T-32 (`deliver-check-cli.test.mjs`), T-33
  and T-41 to T-43 (`deliver-check-archive.test.mjs`), T-34 (`change-loop-remote-state.test.mjs`), T-35
  (`delivery-models.test.mjs`) and T-39's `ship-change` test (`release-tags.test.mjs`).
- [x] 2.6 In `docs/openspec-flow.md` write the D-13 parts of this phase: "The release note"
  paragraph, the rows N1 to N7 and A1 in "The delivery contract", `assign-release` in the merge-mode
  step table, the own-files sentence (after the phrases `deliver-check-cli.test.mjs` "own-files AC-9
  docs" asserts, T-14) and the release paragraph (keeping the phrase that test asserts). Done when
  T-14, T-31, T-35, T-41 (the P13 row, the file-check paragraph and the "Classification." bullet are
  not edited) and the `release-tags.test.mjs` test "release-tags 4: CONTRIBUTING and the flow page
  describe the key and the step" (T-8) stay green.
- [x] 2.7 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/release-tags.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-2, AC-4, AC-7, AC-9, AC-11 and AC-12 at the checker and the module boundary.

## 3. The step and the join (release-merge, the train)

- [x] 3.1 Write the D-15 tests of this phase: in `plugins/openspec/hooks/release-merge.test.mjs` the
  `--assign` tests (AC-4 and each refusal); in `release-note.test.mjs` the AC-5 rewrite tests, the
  AC-7 tests, the AC-8 tests and the AC-9 "no `docs/adr`" test; in
  `plugins/openspec/hooks/delivery-train.test.mjs` the noted joins (AC-3, AC-7, AC-10); in
  `plugins/openspec/hooks/delivery-train-after.test.mjs` the `trainCheck` and departure tests (AC-3,
  AC-5). Run them and save the failing run as `proof/red-3.txt`. Done when each exists by its D-15
  name and fails there.
- [x] 3.2 In `plugins/openspec/hooks/release-merge.mjs` add the D-4 citation rewrite and the D-6
  numbering core and `--assign` mode (step 2: the `RELEASE_FILE` paths keep the target's side,
  `PIN_FILE` takes the masked three-way merge), with the grown usage line (T-11 stays green). Done
  when the `--assign`, AC-5, AC-7 and AC-8 tests pass and every T-11 test is green.
- [x] 3.3 In the same file add the noted path of `--merge` (D-7), and in
  `plugins/openspec/hooks/deliver-check.mjs` extend `trainCheck`'s `allowed` (D-5), keeping its
  message's substring. Done when the AC-3, AC-7 and AC-10 join tests and the `trainCheck` tests pass
  and T-10 stays green.
- [x] 3.4 In `docs/openspec-flow.md` write the D-13 parts of this phase: `--assign` and the noted join
  in "Release-file conflicts: `release-merge.mjs`", "The delivery train", and the CI section's train
  sentence with the substring `delivery-train-after.test.mjs` "delivery-train docs: the documents
  follow" asserts (T-9), keeping the strings `change-loop-compozy.test.mjs` "release-merge-conflict 16"
  asserts (T-5), and leaving the CI pin lines and the "Classification." bullet as they are (T-6,
  T-41). Done when T-5, T-6, T-9 and T-41 stay green.
- [x] 3.5 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs && python3 scripts/check.py` green; covers AC-3, AC-4, AC-5, AC-7, AC-8, AC-9 and AC-10 at the step and the join.

## 4. The loop and the conductor

- [x] 4.1 Write the D-15 tests of this phase in `plugins/openspec/hooks/conduct-check.test.mjs` (AC-4,
  AC-10), `plugins/openspec/hooks/change-loop.test.mjs` (AC-1 planner stop with its two keys, AC-4
  session action, AC-5 resolver, AC-12 approval details) and
  `plugins/openspec/hooks/release-tags.test.mjs` (AC-13). Run them and save the failing run as
  `proof/red-4.txt`. Done when each exists by its D-15 name and fails there.
- [x] 4.2 In `plugins/openspec/hooks/conduct-check.mjs` apply D-10 (`MAIN`, the overrides for a noted
  change, `ADR_DIRS` from `deliver-check.mjs`). Done when the conduct-check tests of 4.1 pass and T-15
  stays green.
- [x] 4.3 In `plugins/openspec/hooks/change-loop.mjs` apply D-9 (the approval details, the optional
  `release` of `approvalText` and `recordApproval`), D-10 (`decisionRecords` resolves a numbered
  record) and D-11 (in `subagentStopFor`, the release-note check inside the `allow('delivered')`
  condition, before that return, with `refuseOnce` code `no-release-note` and key
  `release-note/<missing|malformed>@<facts.fingerprint ?? ''>`). Done when the change-loop tests of
  4.1 pass and T-4, T-19 and T-40 stay green.
- [x] 4.4 In `plugins/openspec/skills/devkit/SKILL.md` add the `assign-release` exit-2 sentence to the
  Loop's `session` bullet, before its `tag-release` sentence (D-10), leaving the sentence and the
  absent words that `change-loop-compozy.test.mjs` "release-merge-conflict 16" asserts (T-5). Done when
  these stay green: T-5, T-27 and T-28 (`change-loop-compozy.test.mjs`), T-31
  (`deliver-check-cli.test.mjs`), T-34 (`change-loop-remote-state.test.mjs`), T-36's `devkit` test
  (`guard.test.mjs`), T-37 (`roadmap-loop-followups.test.mjs`) and T-39's `devkit` test
  (`release-tags.test.mjs`).
- [x] 4.5 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-4, AC-5, AC-10, AC-12 and AC-13 in the loop and the conductor.

## 5. Readers, rules and texts

- [x] 5.1 Write the D-15 tests of this phase in `release-note.test.mjs`: the AC-6 `check.py` tests and
  the AC-14 documents and agent texts test. Run them and save the failing run as `proof/red-5.txt`.
  Done when each exists by its D-15 name and fails there.
- [x] 5.2 Add `check_adrs` to `scripts/check.py` (D-12) and call it from `main`. Done when the AC-6
  tests pass and `version-pin.test.mjs` "version-pin AC-7 check: the tree's flows pass" (T-18) stays
  green on this branch.
- [x] 5.3 In `plugins/openspec/hooks/guard.test.mjs` change the two "no duplicate ADR number" checks
  as T-1 says (invariant: no two ADRs share a number; layer: the repository's records; suite:
  `guard.test.mjs`). Done when both tests pass with an unnumbered record in `docs/adr/`.
- [x] 5.4 Update `plugins/core/agents/change-planner.md`, `adr-author.md`, `adr-reviewer.md`,
  `tdd-implementer.md`, `plugins/core/skills/adr-authoring/SKILL.md` and
  `plugins/core/skills/plan-readiness-review/SKILL.md` as D-13 says, then run
  `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs` and `python3 scripts/gen-catalog.py`.
  Done when the AC-14 test's agent part passes, both `--check` runs pass, and these stay green: T-23,
  T-24, T-25 and T-26 (`change-loop-compozy.test.mjs`), T-29 (`flow-check.test.mjs`), T-38
  (`project-loop.test.mjs`) and T-40 (`change-loop.test.mjs`).
- [x] 5.5 Update `CONTRIBUTING.md` step 5 (keeping the prefix and six parts `release-tags.test.mjs`
  "release-tags 4" asserts, T-8) and `openspec/config.yaml` (Conventions line, the quoted `tasks`
  rule that `guard.test.mjs` "config.yaml rules: no list item is an unquoted string holding ': '"
  checks (T-17), the `ADRs:` entry `ADR [release-at-merge] <subject>, amends 0022 and 0025` appended
  after the last entry); keep step 5's last sentence (ADR 0030) for the old rule. Done when the AC-14
  test's documents part, T-8, T-17, T-41 and T-44 pass.
- [x] 5.6 Add `- Amended by ADR [release-at-merge] (release-at-merge.md)` and a dated
  `Note (release-at-merge, <date>)` to `docs/adr/0022-reviewed-changes-leave-on-a-delivery-train.md`
  and `docs/adr/0025-a-base-merge-stales-only-on-the-changes-own-files.md` (D-13); edit no file of ADR
  0003, ADR 0027 or ADR 0030 (built on, not amended). Done when `python3 scripts/check.py` passes,
  `git diff --stat origin/main -- docs/adr/0003-auto-merge-the-archive-pr.md` is empty, and the T-1,
  T-41 and T-44 tests stay green.
- [x] 5.7 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/project-loop.test.mjs plugins/openspec/hooks/version-pin.test.mjs plugins/openspec/hooks/test-suite.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && claude plugin validate .` green; covers AC-6 and AC-14.

## 6. Real-run proof of every case

- [x] 6.1 Write the seed and case scripts of D-16 under `$TMPDIR/devkit-proof-release-at-merge` (a
  private `TMPDIR`; never `/tmp` on this machine), each repository with a bare `origin`, the release
  files of a two-pack marketplace, `docs/openspec-flow.md` pin lines, `devkit.release_tag`, and the
  `gh` stub D-16 describes. Done when the seed builds and `proof/real-run.md` opens with how it was
  built.
- [x] 6.2 Run P-1 (single merge, the session's own part of the step included) and the single-merge
  half of P-12, appending each command and its output to `proof/real-run.md`. Done when the records
  stay current after the step, the next step is `enable-auto-merge`, the second `assign-release`
  meets no conflict and `tag-release` is asked (AC-4, AC-5, AC-13).
- [x] 6.3 Run P-2 (a train of two noted changes through `train-loop.mjs depart`) and the train half
  of P-12. Done when the train holds both numbers in boarding order, `deliver-check --ci` passes on
  it, both heads are unchanged and `tag-release` is asked for the train's merge (AC-3, AC-5, AC-13).
- [x] 6.4 Run P-3 (an old-rule change). Done when `--base`, `renumber-adr` and the mixed join behave
  as before this change (AC-10).
- [x] 6.5 Run P-4 and P-5 (consumer projects with and without the key, each variant). Done when the
  release file and `CHANGELOG.md` follow AC-8 and no new step, refusal or file appears in AC-9's
  cases.
- [x] 6.6 Run P-6 to P-11 (each refusal and each malformed field; in P-8 the session writes
  `approval.md` from `next.release`). Done when each refusal reads as D-8 says and each case's fix
  lets the run go on (AC-1, AC-2, AC-6, AC-7, AC-11, AC-12).
- [x] 6.7 Gate: `python3 scripts/check.py && openspec validate release-at-merge --strict && grep -q "^## P-1 " openspec/changes/release-at-merge/proof/real-run.md && grep -q "^## P-12 " openspec/changes/release-at-merge/proof/real-run.md` green, the scratch folder removed; covers AC-15 for the cases of D-16's first table.

## 7. The conducting session's part: the real agents on every variant

Every case runs the worktree's agents with `claude --plugin-dir <worktree>/plugins/core --plugin-dir
<worktree>/plugins/openspec -p` and the brief `change-loop.mjs next` gives, in the scratch projects K,
K0 and N of D-16 (under `$TMPDIR/devkit-proof-release-at-merge`), each change opened with this
worktree's `node plugins/openspec/hooks/change-loop.mjs open`; each case appends its commands, the
seeded files it names and the outputs to `proof/agents-run.md` under `## S-<n> `.

- [x] 7.1 In K run the `adr-author` on the decisions stage (S-1). Done when the record is
  `docs/adr/<slug>.md` titled `# ADR [<slug>]` and `decisions.md` lists it (AC-5, AC-6).
- [x] 7.2 In K run the `change-planner` on its plan stages (S-2). Done when `release.md` exists,
  `parseReleaseNote` reads it, and `guard.mjs subagent-stop` with the planner's input lets the stop
  through (AC-1).
- [x] 7.3 Remove that `release.md` and run `guard.mjs subagent-stop` twice with the planner's input
  and the files it left (S-3), then restore it and run it once more. Done when the first stop is
  refused naming the file, the second goes through, and the restored one goes through (AC-1).
- [x] 7.4 Run the `adr-author` in K0 (S-4) and in N (S-5). Done when K0 holds a new `docs/adr/` with
  the unnumbered `docs/adr/<slug>.md` listed in `decisions.md`, and N holds `docs/adr/0002-<slug>.md`
  and no unnumbered record (AC-5, AC-9, AC-10).
- [x] 7.5 In K seed the planner's files with a `release.md` whose bump is `big`, run
  `guard.mjs subagent-stop` twice with the planner's input, then run the real `change-planner` on the
  revision brief (S-6); in N run the `change-planner` on its plan stages (S-7). Done when the first
  S-6 stop is refused with `release.md:` and the field and the second goes through, the revised
  `release.md` reads and its stop goes through; and in S-7 no `release.md` is written, the stop goes
  through with no refusal and `deliver-check feat --json` shows no row N1 to N7 (AC-1, AC-9).
- [x] 7.6 In K run the `plan-readiness-reviewer` on three seeded plans, one defect each: no
  `release.md` (S-8), a noted plan whose `decisions.md` lists a numbered ADR (S-9), a noted plan with
  a task that sets `package.json`'s version (S-10). Done when each `readiness.md` has `result=failed`
  and a finding naming, in turn, `release.md`, the numbered ADR path and the task (AC-1, AC-2, AC-5,
  AC-14).
- [x] 7.7 In K run the `tdd-implementer` on phase 1 of a seeded, approved noted plan whose task 1.1
  asks it to set `package.json`'s version (S-11). Done when it returns `Outcome: failure` naming the
  release line, `git diff` shows `package.json` unchanged and `deliver-check feat --json` shows no row
  N3 (AC-2).
- [x] 7.8 Gate: `python3 scripts/check.py && grep -q "^## S-1 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-2 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-3 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-4 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-5 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-6 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-7 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-8 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-9 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-10 " openspec/changes/release-at-merge/proof/agents-run.md && grep -q "^## S-11 " openspec/changes/release-at-merge/proof/agents-run.md` green, the scratch projects removed; covers AC-15 for the conducting session's part and every agent variant.

## 8. Bootstrap and the whole suite

- [x] 8.1 After the last merge of `origin/main` before review, run this worktree's
  `node plugins/openspec/hooks/release-merge.mjs --assign --base main --json` (D-17): it assigns the
  next free number on origin/main at the last merge before review to `ADR [release-at-merge]` and the
  next versions to the packs `release.md` lists. Save the command and its JSON to
  `proof/dogfood.md`. Done when it exits 0, `git diff --stat HEAD^ -- openspec/changes/` is empty, the
  record is numbered, `python3 scripts/check.py` passes and this worktree's
  `node plugins/openspec/hooks/deliver-check.mjs release-at-merge --json` shows no row N1 to N7. After
  any later merge of `origin/main`, run the same command again from this worktree, never the
  installed `resolve-release-conflict` or `renumber-adr`. `change-loop-compozy.test.mjs` "change-loop
  docs: the design records the answers" (T-6) checks the pins the command wrote against the manifest
  it wrote (AC-4, AC-5, AC-6).
- [x] 8.2 Gate: `node scripts/test-suite.mjs && python3 scripts/check.py` green at the final commit,
  run once as a background command with no other suite on the machine; the train's suite proves both
  parts.

## 9. Fixes of review round 1

Review round 1 failed (`review.md` at `4a6e858`); the decisions are D-18 to D-27 of `design.md`, and
"Findings of review round 1" there maps every finding to these tasks. Strict test first, as in phases
2 to 5: each fix's test task comes before its code task, its red tests fail on the code as the phase
finds it, and its guard tests (D-26's "guard": coverage of behaviour the code already has) pass there
and say so; each run is appended as printed to `openspec/changes/release-at-merge/proof/red-9.txt`
under a line naming its task, and that run is the task's check, never a gate. An existing test changes
only where D-18 and D-26 say, its invariant, layer and suite named in the commit message. No task
writes a version or an ADR number of this change. Every gate runs at most three test files at once
(`--concurrency=3`) as a background command of the tool, judged by its exit code. End every task with
`git status --short`.

Before 9.1: `python3 scripts/check.py` fails at `41dd40e`, before any phase 9 edit, with `broken link
docs/roles.md` in `review.md` and `reviews/code-quality-reviewer.md` (code-quality F2 quotes
`[the roles](docs/roles.md)` outside a code span). Those are gate files with one writer each, so
neither the planner nor the implementer edits them: the coordinating session has their writers (the
review session for `review.md`, the `code-quality-reviewer` for its verdict) make that quotation a
code span, with no other word changed, before 9.1; every gate below needs `check.py` green. The
plan-and-approval commit includes `docs/adr/release-at-merge-step-record.md`, which 9.1's `git
ls-files` check needs (readiness attempt 5, O4).

- [x] 9.1 Merge the base with the numbers given back (D-27; adr-reviewer nit F5). On the local
  `origin/main` as the coordinating session last fetched it (`a815222`, train 15, or later):
  `git revert --no-commit 2bd35c5`, whose one expected conflict is one sentence of `CONTRIBUTING.md`
  step 5 (the number `2bd35c5` wrote in `(ADR <NNNN>)` against `(ADR [release-at-merge])`), resolved by undoing only what `git show
  2bd35c5` changed and keeping every other line of HEAD; commit `chore(release): give back the
  release of release-at-merge before the merge of origin/main`; then `git merge --no-ff
  origin/main`, whose expected conflicts are two hunks of `plugins/openspec/hooks/change-loop.mjs`,
  each resolved by keeping both sides (the import line: the union of the names each side imports,
  each once; two `const` definitions both sides added at one place: both kept). Any other conflict
  outside `openspec/`, in the revert or the merge, stops the phase for the owner. Done when `git merge-base --is-ancestor origin/main
  HEAD` exits 0, `git ls-files docs/adr` lists `docs/adr/release-at-merge.md` and
  `docs/adr/release-at-merge-step-record.md` and no numbered file of either slug, `git grep -n -e "-release-at-merge.md" -e "-release-at-merge-step-record.md" -- ':!openspec/changes'` finds nothing,
  `git diff --quiet origin/main HEAD -- CHANGELOG.md .claude-plugin/marketplace.json docs/catalog.md
  'plugins/*/.claude-plugin/plugin.json'` exits 0 (the release lines are the new merge base's: the
  state D-3 calls `unassigned`), and `python3 scripts/check.py` and `openspec validate
  release-at-merge --strict` pass, the latter no longer printing `Archive would refuse this delta`
  (before this merge the canonical `change-coordination` spec lacks train 15's requirement, which the
  delta modifies; D-25).
- [x] 9.1a (readiness attempt 5, O3; D-20, "The `Amended by` line"; F-8) The coordinating session
  has the adr-author add to `docs/adr/release-at-merge.md` (unnumbered by 9.1), as the last line of
  its header bullets (after `- Builds on:`, where ADR 0027 places its line), the one line `- Amended
  by ADR [release-at-merge-step-record] (release-at-merge-step-record.md)`, in the unnumbered form
  the step rewrites; no other line of the record changes, and the implementer does not write it.
  Committed as `docs(adr): name the amending record in the header of release-at-merge`. Done when
  `grep -c -F -e "- Amended by ADR [release-at-merge-step-record] (release-at-merge-step-record.md)"
  docs/adr/release-at-merge.md` prints 1, `git diff --numstat <9.1's merge commit> HEAD --
  docs/adr/release-at-merge.md` reports one line added and none removed, and `python3
  scripts/check.py` passes.
- [x] 9.2 Write the D-26 tests of D-18 and D-19 (adr-reviewer F1, spec-reviewer F1, code-quality F2
  and nit F4): in `plugins/openspec/hooks/release-note.test.mjs` the source-file citation, the
  source comment and Python file, the citation scope, the pathspec agreement, the anchored rewrite
  and mask tests, and the change of the existing "release-note AC-5 rewrite: ADR [<slug>] becomes ADR
  <NNNN> and <slug>.md becomes <NNNN>-<slug>.md, each only as a whole token"; in
  `plugins/openspec/hooks/deliver-check.test.mjs` the test-literal staleness test; in
  `plugins/openspec/hooks/delivery-train.test.mjs` the join's source-file give-back test; in
  `plugins/openspec/hooks/release-merge.test.mjs` "release-note AC-5 assign: the first record's
  Amended by header line naming the second record of the same change takes the second's number in
  both tokens" (a guard; D-20, "The `Amended by` line"). Run them;
  append the run to `proof/red-9.txt`. Done when each exists by its D-26 name, the red ones fail and
  the guard passes there.
- [x] 9.3 Apply D-18 and D-19 (adr-reviewer F1, spec-reviewer F1, code-quality F2 and nit F4): in
  `plugins/openspec/hooks/deliver-check.mjs` `CITATION_PATHSPEC`, `holdsCitations`, the export `adrFileRe`, `maskRelease` (ADR part only in a file that holds
  citations, the file form anchored); in `plugins/openspec/hooks/release-merge.mjs`
  `rewriteCitations(text, slug, number, path)`, its callers and `unassign` with the real path; in
  `docs/openspec-flow.md` the `--assign` paragraph's citation sentences (D-13); the comments of the
  defect-4 tests D-18 names. Done when the 9.2 tests pass, every other `release-note AC-5` and `AC-7`
  test stays green, and T-5, T-14 and T-31 stay green.
- [x] 9.4 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs && python3 scripts/check.py` green; covers AC-5 and AC-7 for the citations.
- [x] 9.5 Write the D-26 tests of D-20 (code-quality F1), the reviewer's reproduction first: in
  `plugins/openspec/hooks/release-merge.test.mjs` "release-note AC-4 assign: an assigned branch
  merged by hand after a code conflict with a base that released the same pack and ADR number is
  numbered again" (assign; the base releases the same pack and ADR number and edits `src/a.ts`;
  `--assign` exits 2 on `src/a.ts`; a merge by hand taking the base's release files; `--assign`
  again exits 0 and renumbers; the state reads `assigned` and `current`), then the record, the
  amended-record, the unwritten-version and the base-citation tests; in
  `plugins/openspec/hooks/release-note.test.mjs` the `stepRecord` test; in
  `plugins/openspec/hooks/deliver-check.test.mjs` the row N6 test for a branch merged by hand; in
  `plugins/openspec/hooks/deliver-check-cli.test.mjs` "release-note AC-4 format: ship-change's
  assign-release row fetches, runs next.command, pushes plain and never by force, stops blocked on
  exit 2 and names the merge by hand" (test-coverage F6, the row's part). Then the three tests the
  readiness review of attempt 4 asked for: in `plugins/openspec/hooks/release-merge.test.mjs`
  "release-note AC-4 assign: a line the step wrote, edited by a person after the record, is not
  given back: exit 2 naming the path, the head and the tree as they were" (M3) and "release-note
  AC-5 assign: two unnumbered records of one change take the next two numbers in the order
  decisions.md lists them, the second's citations of the first follow, and the record names both
  renames in that order" (M1: `feat` then `feat-store`, the shape of this change's two records); in
  `plugins/openspec/hooks/release-note.test.mjs` "release-note AC-4 record: a line equal to both the
  merge base's value and the record's is unassigned and outside reassign, and a version kept from
  the record is left to step 3" (O1). Every repository is a scratch one the test builds; none reads
  this repository's history. Run them; append the run to `proof/red-9.txt`. Done when each exists by
  its D-26 name, the reproduction and the other red ones fail (the two-records test on its record
  part), and the two guards pass.
- [x] 9.6 Apply D-20 (code-quality F1; test-coverage F6, the row's part; readiness M1, M3, M4, O1):
  in `plugins/openspec/hooks/deliver-check.mjs` `stepRecord` and the state of `releaseStateAt`
  (`reassign`: only keys equal to the record's and not to the merge base's); in
  `plugins/openspec/hooks/release-merge.mjs` the trailers of every `--assign` commit and the
  give-back with no merge before the slug check (`Release-adr` and `Release-citation` entries only;
  exit 2 `cannot give back the numbers the step wrote in <path>` with `restore`); in
  `plugins/openspec/skills/ship-change/SKILL.md` the merge by hand after the `assign-release` row's
  exit 2 clause. In `docs/openspec-flow.md`, the three places D-20 ("The texts that repeat decision
  6") names, each found by its text and not by a line number: in "The release note" paragraph the
  sentence that starts "The state of a branch is derived, with no marker commit:" and ends "anything
  else was edited by hand."; the row N3 of that paragraph's table, whose condition reads "a note, and
  the release lines were edited by hand"; and the `--assign --base <base>` bullet's "neither the
  merge base's nor the ones the step wrote there", the bullet also gaining the record, the give-back
  and the recovery. Each takes D-20's sentence. No test asserts those three sentences (D-20's grep:
  the "documents" subtest of `release-note.test.mjs` asserts only the paragraph heads, the
  `assign-release` row and the bullet's head, which stay; the tests matching `release lines edited
  by hand:` assert the unchanged message). In `openspec/config.yaml` the `ADRs:` line's first
  record entry gains `, amended by ADR [release-at-merge-step-record]` after `amends 0022 and 0025`,
  and the line gains the second record's entry after the first's (D-20, "The `ADRs:` line"); the
  `Amended by` header line of `docs/adr/release-at-merge.md` is 9.1a's, and the "documents" subtest of
  `plugins/openspec/hooks/release-note.test.mjs` "release-note AC-14 texts: ..." changes its `ADRs:`
  assertion as D-20 says, its invariant, layer and suite named in the commit message. Neither record
  under `docs/adr/` is edited by this task (the adr-author's). Done when the 9.5 tests pass, the
  changed "documents" subtest passes, `grep -c "derived, with no marker commit"
  docs/openspec-flow.md` prints 0 (a phrase only the old sentence holds), `grep -c "what the step's
  own last recorded commit wrote" docs/openspec-flow.md` prints 1 (the new sentence), `grep -c -F
  "amends 0022 and 0025, amended by ADR [release-at-merge-step-record]; ADR
  [release-at-merge-step-record] " openspec/config.yaml` prints 1, every `release-note AC-2`, `AC-4` and `AC-14` test stays green, and T-2, T-16, T-32,
  T-33, T-35 and T-36 stay green.
- [x] 9.7 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs && python3 scripts/check.py` green; covers AC-2, AC-4 and AC-5 after a merge by hand.
- [x] 9.8 Write the D-26 tests of D-21 and D-22 (adr-reviewer F2, spec-reviewer F3, code-quality F3,
  test-coverage F5, architecture F1 and F2): in `plugins/openspec/hooks/flow-check.test.mjs` the four
  `release-note AC-16 stages` tests; in `plugins/openspec/hooks/conduct-check.test.mjs` the AC-16 and
  AC-12 conduct tests; in `plugins/openspec/hooks/change-loop.test.mjs` the AC-16 loop and AC-12
  accept tests; in `plugins/openspec/hooks/deliver-check.test.mjs` the AC-12 approval test. Run them;
  append the run to `proof/red-9.txt`. Done when each exists by its D-26 name, the red ones fail and
  the guards pass.
- [x] 9.9 Apply D-21 and D-22 (adr-reviewer F2, spec-reviewer F3, code-quality F3, test-coverage F5,
  architecture F1 and F2): in `plugins/openspec/hooks/flow-check.mjs` `collectFlow`'s
  `noteFiles` and the `staleAfter` loop of `artifactState`; in `plugins/openspec/hooks/conduct-check.mjs`
  `planFacts`' `newestNote`, compared in `readiness.fresh` only (D-21: `newestPlan` and the audit's
  `fresh` unchanged), and the `approve` reason; in `plugins/openspec/hooks/deliver-check.mjs`
  `approvalState`'s default and `namesReleaseTag` (moved from `change-loop.mjs`, which imports it);
  in `plugins/openspec/hooks/change-loop.mjs` `acceptDecisions`' refusal; in `docs/openspec-flow.md`
  the sentence of "The release note" (D-13). No `flow.json` and no schema file changes. Done when the
  9.8 tests pass and T-4, T-13, T-19 and T-29 stay green.
- [x] 9.10 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/conduct-check.test.mjs plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs plugins/openspec/hooks/change-state-stages.test.mjs plugins/openspec/hooks/status-line.test.mjs plugins/openspec/hooks/stage-models.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs plugins/openspec/hooks/roadmap-loop-followups.test.mjs && python3 scripts/check.py` green; covers AC-12 and AC-16.
- [x] 9.11 Write the remaining D-26 tests (test-coverage F1, F2, F3, F4, F6 and nits F7 to F10;
  code-quality nit F5; spec-reviewer nit F7): in `plugins/openspec/hooks/release-merge.test.mjs` the
  pin-only re-assign, the manifest field, the refusals before any write (exit 3 with no
  `devkit.release_tag`) and the slug refusal after the give-back; in
  `plugins/openspec/hooks/release-note.test.mjs` the consumer re-assign and the `## ` body line; in
  `plugins/openspec/hooks/deliver-check.test.mjs` the consumer staleness and row N6 before
  `ready-base`; in `plugins/openspec/hooks/delivery-train-after.test.mjs` the consumer `trainCheck`;
  in `plugins/openspec/hooks/delivery-train.test.mjs` the join with no `devkit.release_tag`; in
  `plugins/openspec/hooks/deliver-check-cli.test.mjs` the `stop-plan-approval` format test
  (test-coverage F6, the clause's part); in `plugins/openspec/hooks/change-loop.test.mjs`
  "release-note AC-4 fetch: a base that moved on the remote hands assign-release, not
  resolve-release-conflict, to a noted change" (readiness M2, a guard of the MODIFIED
  `change-coordination` requirement "The loop fetches the base branch before it judges a delivery
  step"). Run them; append the run to `proof/red-9.txt`. Done when each
  exists by its D-26 name, the `## ` body test and the exit 3 part fail, and every guard passes.
- [x] 9.12 Apply D-23 and D-24 (code-quality nit F5, architecture nit F5, spec-reviewer nit F7): in `plugins/openspec/hooks/deliver-check.mjs` `parseReleaseNote`'s
  refusal of a `## ` body line; in `plugins/openspec/hooks/release-merge.mjs` exit 3 with no
  `devkit.release_tag`; in `docs/openspec-flow.md` the `--assign` paragraph's exit 3 (D-13). Done
  when the 9.11 tests pass and every `release-note AC-1` and `AC-9` test stays green.
- [x] 9.13 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/merge-setup.test.mjs plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green; covers AC-1, AC-3, AC-4, AC-8, AC-9 and AC-12 on the paths round 1 found untested, and the base fetch for a noted change.
- [x] 9.14 (code-quality F1 in a real run; D-24 and D-18 in the cases they change) Add P-13 to `openspec/changes/release-at-merge/proof/cases.mjs` (D-16) and run the whole
  script again under a private `TMPDIR` (`$TMPDIR/devkit-proof-release-at-merge`, never `/tmp`),
  `node openspec/changes/release-at-merge/proof/cases.mjs` with no case named, so it writes
  `proof/real-run.md` anew. Done when it exits 0 and prints `P-1 done` to `P-13 done`, P-5 records
  `--assign` exit 3, P-1 and P-13 show the step's record in `git log -1 --format=%B`, and P-13 reads
  `assign-release` after the merge by hand, then exit 0, the ADR numbered above the sibling's, the
  state assigned and current and `enable-auto-merge` next (AC-4, AC-5, AC-9, AC-15).
- [x] 9.15 (adr-reviewer F2, spec-reviewer F3, code-quality F3, test-coverage F5, architecture F1 with
  the real agents) Add S-12 to `openspec/changes/release-at-merge/proof/agents.mjs` (D-16) and run it with
  the worktree's agents (`claude --plugin-dir <worktree>/plugins/core --plugin-dir
  <worktree>/plugins/openspec -p`), appending to `proof/agents-run.md` under `## S-12 ` with a
  `Done-condition` block. Done when the real reviewer fails the plan naming `release.md`, the loop
  hands the planner the revision, the note-only state makes `change-loop.mjs next` hand the
  readiness review (`rerun-after-fix`), the real planner's revision is followed by the readiness
  review and the real reviewer passes it, and in N the touched note keeps the readiness passed
  (AC-16, AC-15).
- [x] 9.16 Gate: `python3 scripts/check.py && openspec validate release-at-merge --strict && grep -q "^## P-13 " openspec/changes/release-at-merge/proof/real-run.md && grep -q "^## S-12 " openspec/changes/release-at-merge/proof/agents-run.md` green, the scratch folders removed; covers AC-15 and AC-16 in real runs.
- [x] 9.17 (adr-reviewer nit F5; code-quality F1 on this branch) After the last merge of `origin/main` before review (when the base moved since 9.1, run
  the step itself, which merges it), run this worktree's `node plugins/openspec/hooks/release-merge.mjs
  --assign --base main --json` (D-17, D-27) and append the command, its JSON and `git log -1
  --format=%B` to `proof/dogfood.md`. The step numbers both records `decisions.md` lists, in that
  order: `ADR [release-at-merge]` takes the next free number on the base and `ADR
  [release-at-merge-step-record]` the one after it, and the citations of each outside
  `openspec/changes/` (the second record's `Amends` line, the first record's `Amended by` line, both
  its tokens, the `ADRs:` line, ADR 0022 and ADR 0025) follow; no task or plan file writes either
  number. Done when it exits 0, `git grep -n -F -e "ADR [release-at-merge" -e
  "(release-at-merge-step-record.md)" -e "(release-at-merge.md)" -- ':!openspec/changes'` finds
  nothing, the first record's header holds `- Amended by ADR <M> (<M>-release-at-merge-step-record.md)`
  with `<M>` the second record's number, the commit's message ends
  with `Release-change: release-at-merge` and the trailers D-20 lists (two `Release-adr` lines, the
  first record's first), `git diff --stat HEAD^ -- openspec/changes/release-at-merge/` is empty,
  `git ls-files docs/adr` lists both records numbered, the second's number one more than the
  first's, and neither unnumbered, `python3 scripts/check.py`, `python3
  scripts/gen-catalog.py --check` and `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs
  --check` pass, and `node plugins/openspec/hooks/deliver-check.mjs release-at-merge --json` shows no
  row N1 to N7 (AC-4, AC-5, AC-6).
- [x] 9.18 Gate: `node scripts/test-suite.mjs --concurrency=3 && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && claude plugin validate . && openspec validate release-at-merge --strict` green at the final head, the whole suite run once as a background command with no other suite on the machine; the train's suite proves it again.

## 10. Answers to review round 2

Review round 2 failed (`review.md` at `c1c875e`, round 2 of 2, escalated), and the owner decided on
2026-11-25, "1a e 2b": D-28 (the step's record read per line, confirmed), D-29 (an owner's forced
merge reads the gates by its own requirement; `gatesAtHead` unchanged, its allowance a roadmap
follow-up) and D-30 (the round 2 nits that are one-line text fixes). "Findings of review round 2" in
`design.md` maps every finding to these tasks or to a written follow-up. The spec delta and the
design already carry the plan text of 1a and 2b; this phase changes no hook and no behaviour, so no
task has a red run and no `proof/red-10.txt` is written (strict test first applies where behaviour
changes: nowhere here). No task writes a version, a changelog line, a CI pin or an ADR number: the
numbering is done (task 9.17), and if the base moves, the delivery's `assign-release` step numbers
the branch again from its record (D-20); a task names the step's record file by its slug, as `git
ls-files docs/adr` lists it. An existing test changes only as D-30 says (names only, assertions
unchanged), its invariant, layer and suite named in the commit message. Every gate runs at most three
test files at once (`--concurrency=3`) as a background command of the tool, judged by its exit code.
End every task with `git status --short`.

- [x] 10.1 (owner 1a; adr-reviewer F7, spec-reviewer F8; D-28) The coordinating session has the
  adr-author add to the record of `ADR [release-at-merge-step-record]` (the one file of `git ls-files
  docs/adr` whose name ends `-release-at-merge-step-record.md`, numbered at task 9.17) one dated note,
  as the first paragraph under its `## Context` heading and followed by one blank line, in the form
  ADR 0022 and ADR 0025 carry, with D-28's text word for word (it starts `Note (release-at-merge,
  2026-11-25): after review round 2 of change release-at-merge the owner acknowledged the per-line
  reading of decisions 3 and 4:` and ends `The Decision is otherwise unchanged.`); no other line of
  the record changes, the note holds no `ADR [<slug>]` token and no number of this change, and the
  implementer does not write it. Committed alone as `docs(adr): note the owner's per-line reading of
  the release step's record`. Done when `git grep -c -F "Note (release-at-merge, 2026-11-25)" --
  docs/adr` names that one file with the count 1, `git show --numstat --format= HEAD -- docs/adr`
  lists that one file with 2 lines added and 0 removed, `git grep -n -F "ADR [release-at-merge" --
  docs/adr` finds nothing, and `python3 scripts/check.py` passes (AC-4, AC-14).
- [x] 10.2 (owner 1a; adr-reviewer nit F9, spec-reviewer nit F10, code-quality nit F9,
  test-coverage nit F17; D-28, D-30) In `plugins/openspec/skills/ship-change/SKILL.md`: in the
  `assign-release` row, the closing parenthesis "(the `Release-` trailers of its last commit)"
  becomes "(the `Release-` trailers of its own commits, each line read from the newest one that
  wrote it)", the rest of the row unchanged; in the `app` bullet of "## Hosts", after the sentence
  that ends "never because Auto-fix reported the conflict.", insert D-30's sentence "A change with a
  release note, in a project that names `devkit.release_tag` and has no delivery train, is the other
  exception: `next` answers its conflict with the base with `assign-release` (row N5), and the
  session runs that row.", the rest of the bullet unchanged. No other line of the file changes.
  Done when `grep -c "trailers of its last commit" plugins/openspec/skills/ship-change/SKILL.md`
  prints 0, `grep -c -F "each line read from the newest one that wrote it"` and `grep -c -F
  "(row N5), and the session runs that row."` on that file print 1 each, `git diff --numstat HEAD
  -- plugins/openspec/skills/ship-change/SKILL.md`, run before the task's commit, reports 2 lines added and 2 removed, and these
  stay green in gate 10.5: "release-note AC-4 format: ship-change's assign-release row ... names the
  merge by hand" and T-2, T-30, T-31 and T-32 (`deliver-check-cli.test.mjs`), T-33
  (`deliver-check-archive.test.mjs`), T-9 (`delivery-train-after.test.mjs`), T-16 and T-36
  (`guard.test.mjs`), T-29 (`flow-check.test.mjs`), T-35 (`delivery-models.test.mjs`), T-39
  (`release-tags.test.mjs`), T-28 (`change-loop-compozy.test.mjs`) and T-34
  (`change-loop-remote-state.test.mjs`) (AC-4, AC-14).
- [x] 10.3 (owner 1a; test-coverage nit F20; D-28, D-30) Rename, with the assertions and the bodies
  unchanged, the four tests D-30 lists: in `plugins/openspec/hooks/release-note.test.mjs` "release-note
  AC-7 citation: an ADR [x] literal in a changed .mjs file is neither cited nor rewritten" to
  "release-note AC-7 citation: an ADR [x] literal in a changed test file is neither cited nor
  rewritten"; "release-note AC-7 citation: the same token in a changed .md file is refused while
  unlanded and rewritten once landed, the .mjs literal never" to "release-note AC-7 citation: the same
  token in a changed .md file is refused while unlanded and rewritten once landed, the literal in the
  test file never"; "release-note AC-4 record: stepRecord reads the newest recorded commit, ignores a
  trailer whose commit wrote nothing, and is null without one" to "release-note AC-4 record:
  stepRecord reads each key from the newest recorded commit that wrote it, ignores a trailer whose
  commit wrote nothing, and is null without one"; and in
  `plugins/openspec/hooks/delivery-train.test.mjs` "release-note AC-7 join: a head numbered before the
  train is renumbered in its Markdown citations, and its source literals stay as written" to
  "release-note AC-7 join: a head numbered before the train is renumbered in its Markdown citations,
  and its test-file literals stay as written". The commit message names each test's invariant, layer
  and suite as D-30 does. Done when `git grep -c -e "literal in a changed .mjs file" -e "the .mjs
  literal never" -e "its source literals stay as written" -e "stepRecord reads the newest recorded
  commit" -- plugins` finds nothing, each new name is found once by `git grep -c -F` under
  `plugins/openspec/hooks/`, `git diff --numstat HEAD -- plugins/openspec/hooks`, run before the task's commit, reports
  `release-note.test.mjs` with 3 lines added and 3 removed and `delivery-train.test.mjs` with 1 and 1,
  `git grep -c -F "a number the step kept across a base merge is still its own after a later merge by
  hand" -- plugins/openspec/hooks/release-merge.test.mjs` prints the file with 1 (the proof of the
  scenario "A number the step kept across a later step commit", D-28), and the four renamed tests pass
  in gate 10.5 (AC-4, AC-7).
- [x] 10.4 (owner 2b; spec-reviewer F9, test-coverage F16, adr-reviewer nit F8, architecture nit F7;
  D-29) Append to the end of `openspec/roadmap.md`, in the form of its rounds of a change's follow-ups
  (28k, 28n, 28o), one blank line, the heading `## Round 28<letter>: follow-ups of release-at-merge`
  with `<letter>` the next after the highest `## Round 28<letter>` the file holds then (`p` while it
  ends at 28o), and the one line D-29 gives in its fenced block, word for word and on one line. No
  other line of the file changes. Done when `grep -c -F "forced-merge-release-edit (after:
  release-at-merge)" openspec/roadmap.md` prints 1, the last `## ` line of the file is the new
  heading, `git diff --numstat HEAD -- openspec/roadmap.md`, run before the task's commit, reports 3
  lines added and 0 removed, and `python3 scripts/check.py` passes (AC-4).
- [ ] 10.5 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node scripts/test-suite.mjs --concurrency=3 plugins/openspec/hooks/release-note.test.mjs plugins/openspec/hooks/release-merge.test.mjs plugins/openspec/hooks/delivery-train.test.mjs plugins/openspec/hooks/delivery-train-after.test.mjs plugins/openspec/hooks/deliver-check-cli.test.mjs plugins/openspec/hooks/deliver-check-archive.test.mjs plugins/openspec/hooks/guard.test.mjs plugins/openspec/hooks/flow-check.test.mjs plugins/openspec/hooks/delivery-models.test.mjs plugins/openspec/hooks/release-tags.test.mjs plugins/openspec/hooks/change-loop-compozy.test.mjs plugins/openspec/hooks/change-loop-remote-state.test.mjs && python3 scripts/check.py && openspec validate release-at-merge --strict` green; covers AC-4 (the per-line record and its scenario), AC-7 (the renamed citation tests) and AC-14 (the texts) on the files phase 10 touches and every test file that reads the `ship-change` skill.
- [ ] 10.6 Gate: `node scripts/test-suite.mjs --concurrency=3 && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check && claude plugin validate . && openspec validate release-at-merge --strict` green at the final head, the whole suite run once as a background command with no other suite on the machine; the train's suite proves it again (AC-14).

## Workflow follow-up

- After the train that carries this change merges: `tag-release` pushes the devkit-openspec tag on
  the train's merge commit (ADR 0019).
- At the archive: no roadmap line names this change as its own line (task 10.4's line only waits on it
  with `after:`); moving the ten open changes to notes and removing the old rule are changes of their
  own (requirements, Out of scope).
- Follow-ups of review round 1 (design, "Findings of review round 1"), each a change of its own: a
  citation form for the `ADRs:` list of `openspec/config.yaml` (code-quality nit F6); the wording of
  `ADR [release-at-merge]` decision 4 in the next record that touches it (adr-reviewer nit F3); the
  kit installer's `pack` field in `.compozy/kit-manifest.json` (adr-reviewer nit F4); one helper for
  the other numbered-name lookups (architecture nit F3); the AC-13 tests fed by the `gh` fixture and
  the fixture number of `conduct-check.test.mjs` (test-coverage nits F11, F12).
- Follow-ups of review round 2 (design, "Findings of review round 2", D-30), each a change of its
  own: `gatesAtHead`'s release-edit allowance on an owner's forced merge, on the roadmap by task 10.4
  (D-29); a test that the join's commit carries no record (test-coverage nit F18); a test of the
  give-back skipping a citation path the merge by hand deleted (test-coverage nit F19); the record
  returned by `releaseStateAt` so `numberRelease` does not read it twice (architecture nit F8); and
  the round 1 follow-ups above, carried. The owner confirms or not the resolution of the merge
  `a47cec8` (code-quality nit F10, design F-11).
