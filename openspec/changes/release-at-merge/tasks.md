<!-- devkit-stage tasks result=passed attempt=3 commit=ba3126b84f6821144dad1cfb02b260bf68dc7e77 -->
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
| AC-1 | 2.1, 2.3, 2.5, 4.1, 4.3, 6.6, 7.2, 7.3, 7.5, 7.6 |
| AC-2 | 2.1, 2.3, 2.5, 6.6, 7.6, 7.7 |
| AC-3 | 3.1, 3.3, 6.3 |
| AC-4 | 2.1, 2.4, 2.5, 3.1, 3.2, 4.1, 4.2, 6.2, 8.1 |
| AC-5 | 2.4, 3.1, 3.2, 3.3, 4.3, 6.2, 6.3, 7.1, 7.4, 7.6, 8.1 |
| AC-6 | 5.1, 5.2, 5.3, 6.6, 7.1, 8.1 |
| AC-7 | 2.1, 2.5, 3.1, 3.2, 3.3, 6.6 |
| AC-8 | 3.1, 3.2, 6.5 |
| AC-9 | 2.1, 2.2, 2.5, 3.1, 6.5, 7.4, 7.5 |
| AC-10 | 3.1, 3.3, 4.1, 4.2, 6.4, 7.4 |
| AC-11 | 2.1, 2.5, 6.6 |
| AC-12 | 1.2, 2.1, 2.5, 4.3, 6.6 |
| AC-13 | 4.1, 6.2, 6.3 |
| AC-14 | 5.1, 5.4, 5.5, 5.6, 5.7, 7.6 |
| AC-15 | 6.1 to 6.7, 7.1 to 7.8 |

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
- [ ] 8.2 Gate: `node scripts/test-suite.mjs && python3 scripts/check.py` green at the final commit,
  run once as a background command with no other suite on the machine; the train's suite proves both
  parts.

## Workflow follow-up

- After the train that carries this change merges: `tag-release` pushes the devkit-openspec tag on
  the train's merge commit (ADR 0019).
- At the archive: no roadmap line names this change; moving the ten open changes to notes and removing
  the old rule are changes of their own (requirements, Out of scope).
