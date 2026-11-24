<!-- devkit-stage tasks result=passed attempt=2 commit=bbb831f9b6dc488a64d519a4d02d3e05ab521e9d -->
# Tasks

Change: `project-slice-claim` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every rule, key, text and test name is in
`design.md`: D-1 the claim at a slice's open, D-2 the refusal, D-3 the readout's machine line, D-4 the
board unchanged, D-5 the delivery unchanged, D-6 the existing tests this change touches, D-7 the proof,
D-8 the ADRs, D-9 the documents and the release. The implementer copies them and makes no design
choice.

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`, and every gate exits 0 when its
phase is done. Every `node --test` gate runs as a background command of the tool and is judged by its
exit code once it ends, never by a foreground timeout: a run still going is pending, not red. Gates
run with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does; the tests need
the `openspec` CLI 2.x on `PATH`; where the temporary folder is short of inodes, run them with
`TMPDIR=/var/tmp`. Every new test is named `slice-claim <AC-n> <area>: ...` as D-7 names it, and lives
in `plugins/openspec/hooks/project-loop.test.mjs`. An existing test changes only where D-6 says so; one
that fails at a gate and is not in D-6 stops the work for a plan revision. Leave no backup or scratch
file in the tree; end every task with `git status --short`.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `slice-open-pushes-claim` | 1.1, 1.3, 1.6, 2.6 |
| AC-2 | `claim-keys-before-pin` | 1.1, 1.3, 1.6 |
| AC-3 | `slice-open-refuses-claimed` | 1.1, 1.6, 2.2 |
| AC-4 | `slice-open-race-one-wins` | 1.1, 1.3, 1.6 |
| AC-5 | `slice-no-origin-unchanged` | 1.1, 1.6 |
| AC-6 | `slice-status-shows-machine` | 1.1, 1.4, 1.5, 1.6, 2.2 |
| AC-7 | `board-never-lists-slices` | 1.1, 1.6, 2.2 |
| AC-8 | `slice-delivery-unchanged` | 1.1, 1.6, 2.6 |
| AC-9 | `claim-shared-code` | 1.1, 1.3, 1.6 |

## 1. The claim at a slice's open and the readout's machine line (AC-1 to AC-9)

- [x] 1.1 Write this phase's tests first (design D-7; spec `project-definition` MODIFIED "The project
  command opens a slice", "The slice readout shows the five stages" and "A slice is not a change of
  the other commands"), in `plugins/openspec/hooks/project-loop.test.mjs`: the helper `otherClone(t)`
  beside `loopProject`, and the thirteen `slice-claim` tests of D-7's table (AC-1 to AC-9, including
  the push the remote refuses, D-2). Run them on
  `bbb831f` with `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test
  --test-name-pattern="^slice-claim" plugins/openspec/hooks/guard.test.mjs` and save the output to
  `openspec/changes/project-slice-claim/proof/red-1.txt`. Check: the file shows the tests D-7 marks
  "yes" failing for a missing behaviour (not a syntax error) and the regression guards (AC-3, AC-5,
  AC-6 second test, AC-7) passing. This red run is a task, not a gate: it exits non-zero.
- [x] 1.2 Add the git identity lines of D-6 to `plugins/openspec/hooks/project-loop.test.mjs` (the
  `IDENT` constant and the `??=` loop of `change-loop.test.mjs` lines 3908 and 3909, before `ENV`).
  Invariant: a test that opens a slice with an `origin` can commit in a run of this file alone; layer:
  the test fixtures; suite: project-loop. Check: `git diff` shows no assertion changed.
- [x] 1.3 In `plugins/openspec/hooks/project-loop.mjs`, `openSlice` passes `claim: { machine:
  thisMachine(), places: null }`, `lockSleep` and `beforePush` to `openCheckout`, and imports
  `thisMachine` from `./change-loop.mjs` (design D-1); the command line is unchanged; no comment
  added to `project-loop.mjs` names `force-with-lease`, `x-devkit-machine`, `chore(openspec): open`,
  `writeClaimKeys` or `claimOnOrigin` (the AC-9 test reads comments too, D-7). Check: the
  `slice-claim AC-1` tests (the claim and the refused push), `AC-2`, `AC-4` and `AC-9` pass;
  `git diff --stat` lists no change to `openCheckout` in `plugins/openspec/hooks/change-loop.mjs`.
- [x] 1.4 In `plugins/openspec/hooks/change-loop.mjs#MESSAGES`, add `slice-machine` beside
  `slice-title` in both languages with the texts of design D-3 (`Machine: {machine}`, `Máquina:
  {machine}`). Check: `change-loop replies: no internal term in either language`
  (`change-loop.test.mjs`) and `project-loop start: every new message key renders in both languages
  with no internal term` (`project-loop.test.mjs`) pass unchanged (D-6 T-7).
- [x] 1.5 In `plugins/openspec/hooks/project-loop.mjs`, `readFacts` returns `folder: located.dir` in
  `common`, and `statusText` appends the `slice-machine` line after the title through the helper
  `claimMachineOf(dir)` over `parseClaim` (imported from `./change-loop.mjs`), as design D-3 gives it,
  with no line for an absent, unreadable or malformed value; no comment it adds names the five strings
  task 1.3 lists. Update the one existing test D-6 T-1
  names, `project-loop status: one line per stage with passed, not applicable, ready and blocked, and
  nothing after the five` (`project-loop.test.mjs`): invariant "the readout lists its title, then the
  machine of its claim when it has one, then one line per stage, and nothing after the five while a
  stage is open"; layer: the readout; suite: project-loop; the edit is exactly D-6 T-1's. Check: both
  `slice-claim AC-6` tests and T-1 pass; T-2 passes unchanged.
- [x] 1.6 Gate: `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^slice-claim" --test-name-pattern="^project-loop " --test-name-pattern="^commit-attribution AC-1" --test-name-pattern="^gh-version 1[56]" --test-name-pattern="^version-pin AC-1 open" --test-name-pattern="^upfront AC-5 open" --test-name-pattern="^remote AC-1 open" --test-name-pattern="^remote AC-2 open" --test-name-pattern="^remote AC-3 open" --test-name-pattern="^remote AC-4 open" --test-name-pattern="^change-loop replies" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py`
  green, a background command; it runs every test of `project-loop.test.mjs` (each one that opens a
  slice now claims it) and the change-path tests of D-6; covers AC-1 to AC-9 by tests, with D-6 T-1
  to T-8.

## 2. The ADRs, the documents and the release

- [ ] 2.1 The ADR lines and Notes of design D-8, where `<N>` is the slice-claim ADR's number: the
  next free number on `origin/main` at the last merge before review (0022 at `bbb831f`, the number
  `decisions.md` and design D-8 use; when it moved, every reference here moves with it). In
  `docs/adr/0015-a-project-slice-is-a-change-delivered-in-one-pull-request.md` the `- Amended by ADR
  <N> (...)` line after `- Status: accepted` and the Note before `## Consequences`; in
  `docs/adr/0020-a-change-can-run-on-another-machine.md` the `- Amended by ADR <N> (...)` line right
  after the `- Amended by ADR 0021 (...)` line and the Note after the roadmap-sessions-upfront Note,
  before `## Consequences`; in `openspec/config.yaml` the `ADRs:` line's `<N>` entry. Check: `project-loop docs: the documents follow`
  (`project-loop.test.mjs`) and `upfront D-18 docs: ADR 0021 names ADR 0020 ...`
  (`roadmap-loop.test.mjs`), which read these headers and the 0021 Note, pass unchanged at 2.5.
- [ ] 2.2 The documents of design D-9: `docs/openspec-flow.md` (the sentence on the claim in the
  first paragraph of `## Defining a project: /devkit project`, and the corrected last sentence of
  `**The slice contract.**`; no other file repeats the corrected sentence, per D-9's grep),
  `docs/coordination-design.md` (the sentence in section 7's `**What exists ...**` paragraph) and
  `plugins/openspec/README.md` (the `hooks/project-loop.mjs` row). Before editing, grep
  `plugins/openspec/hooks/*.test.mjs` for `slice's readout` and for the README row's text: no test
  asserts either today (`bbb831f`); a test found there is updated as D-6 would, or stops for a plan
  revision. Check: `python3 scripts/check.py` passes (links, language); `project-loop docs: the
  documents follow` passes unchanged at 2.5.
- [ ] 2.3 The release of design D-9: devkit-openspec and the marketplace each take the next free minor
  version on `origin/main` at the last merge before review, in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` (the pack's entry
  and `metadata.version`); `CHANGELOG.md` gains the entry D-9 describes; `docs/catalog.md` is
  regenerated with `python3 scripts/gen-catalog.py`. Check: `python3 scripts/gen-catalog.py --check`
  and `claude plugin validate .` pass.
- [ ] 2.4 Validate the change: `openspec validate project-slice-claim --strict` passes.
- [ ] 2.5 Gate (focused): `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^project-loop docs" --test-name-pattern="^upfront D-18 docs" --test-name-pattern="^slice-claim" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && openspec validate project-slice-claim --strict`
  green, a background command; covers the documents of 2.1 and 2.2 and the release of 2.3.
- [ ] 2.6 Gate (whole suite): `env GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs`
  green, run as a background command of the tool (13 to 21 minutes); every existing test outside D-6
  passes unchanged, which proves AC-8's delivery and AC-1's open across every slice test; a failure
  outside D-6 stops the work for a plan revision.

## Workflow follow-up

- The evidence stage records the real-run proof of design D-7 in
  `openspec/changes/project-slice-claim/proof/real-run.txt`, every case the plan declares.
- Before the push and before auto-merge, re-check the release numbers and ADR 0022's number against
  `origin/main`.
- Archive the change after its review and merge.
