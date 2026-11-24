<!-- devkit-stage tasks result=passed attempt=2 commit=02208a3517799997e0a4950c46c466ec161c88c6 -->
# Tasks

Change: `post-merge-validate` · Date: 2026-11-23 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. The how is fixed in `design.md` (D-1 to D-11):
the implementer copies the names, texts, commands and rules from there and makes no design choice; a
choice the design does not settle stops the phase and goes to the owner.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, so no part holds a `|`. Every hook gate runs with
`TMPDIR=/var/tmp`, `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as a pull-request run on CI does.
Every new test takes its env from the file's existing helpers (`cleanEnv`, `SET`, `gh.env`), which
blank `DEVKIT_BYPASS`, `DEVKIT_BRANCH`, `DEVKIT_CHANGE`, `GITHUB_HEAD_REF`, `GITHUB_BASE_REF` and
`GITHUB_EVENT_PATH`. The tests need the `openspec` CLI 2.x on `PATH`. A gate that loads a whole hook
suite runs as a background command of the tool, never with a shell `&`; the guard suite (13 to 21
minutes) runs once, in 3.7, from the conducting session.

Test first. The first task of each phase writes that phase's tests, runs them on the code as it is
and saves the output, as printed, to `openspec/changes/post-merge-validate/proof/red-<phase>.txt`.
That run is the task's check, never a gate. Every new test's name starts `post-merge-validate <phase>: `
and reaches a new export through `changeLoopModule`, so the red run fails test by test. No test reads
this repository's git history: every merge is made in a temporary repository.

Existing tests change only where `design.md` D-9 names them (`change-state AC-3 state` and the
`deliveredChange` helper), each time with its invariant, its layer and its suite; name them in the
commit message. Leave no backup or scratch file in the tree, and end every task with
`git status --short`. Merge `origin/main` into the branch before phase 1 and before task 3.5
(siblings in flight touch the same files, design R-6).

ADR 0017: `decisions.md` lists the adr-author's Note on ADR 0017 (status proposed; the merge-check
record `<git common dir>/devkit/merge-check/<id>.json` is one more input of decision 1), and the
owner's approval of this plan accepts it (`design.md`, "ADR 0017: a proposed Note"). No task of this
plan writes or edits the Note, and none keeps its status line in step at the retro or the archive:
no project rule asks for it.

## 1. The merge, the record and the command (AC-2, AC-4, AC-5, AC-6, AC-7)

- [x] 1.1 Write T-1 to T-6 (design D-9) in `plugins/openspec/hooks/change-loop.test.mjs`; T-5's
  `env.PATH` is an empty temporary folder, never the folder of `node`. Check:
  `proof/red-1.txt` holds the red run of
  `node --test --test-name-pattern="^post-merge-validate 1" plugins/openspec/hooks/change-loop.test.mjs`,
  each new test failing on a missing export or command.
- [x] 1.2 D-1: `baseMergeOf(root, ref)` in `plugins/openspec/hooks/change-loop.mjs`, exported. Check:
  T-1 passes.
- [x] 1.3 D-2: `mergeCheckFile(root, id)` and `readMergeCheck(file, id)`, exported, and the `reds`
  rule; the record written with `saveWriteBack`. Check: T-2 passes.
- [x] 1.4 D-3: the command `merge-check <id> --lang <l>` (`runMergeCheck`, the `main` dispatch, the
  usage line and the header comment of `change-loop.mjs`). Check: T-3, T-4, T-5 and T-6 pass, and
  `change-loop.test.mjs:3166-3167` (the usage still names `accept-decisions <id>`) passes.
- [x] 1.5 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test --test-name-pattern="^post-merge-validate 1" --test-name-pattern="^change-loop settings" --test-name-pattern="^change-loop replies" plugins/openspec/hooks/change-loop.test.mjs && python3 scripts/check.py` green; covers AC-4, and the command's half of AC-2, AC-5, AC-6 and AC-7.

## 2. The decision, the facts and the replies (AC-1, AC-2, AC-3, AC-5, AC-6, AC-7, AC-9)

- [x] 2.1 Write T-7 to T-15 (design D-9), including the two optional parameters of `deliveredChange`
  (T-12) and the two new cases of the test `change-state AC-3 state: each blocked reason decide gives
  is the reason, with its phrase and details` (T-15, `change-loop.test.mjs:4942` at `02208a3`).
  Check: `proof/red-2.txt` holds the red run of
  `node --test --test-name-pattern="^post-merge-validate 2" --test-name-pattern="^change-state AC-3" plugins/openspec/hooks/change-loop.test.mjs`;
  every existing caller of `deliveredChange` still passes in that run.
- [x] 2.2 D-6: the keys `blocked-why.merge-defect` and `blocked-why.merge-check-failed` in both
  languages of `MESSAGES`, with the texts of the D-6 table. Check: `change-loop replies: no internal
  term` and `roadmap-loop replies: a blocked line renders every blocked reason in both languages` pass.
- [x] 2.3 D-4: `CHECK_BEFORE` and the merge-check block of `buildPart`, with the brief text of D-4
  verbatim; `decide`'s comment on `facts` names `mergeCheck`. Check: T-7 to T-11 and T-15 pass.
- [x] 2.4 D-5: `nextAction` reads `mergeCheck` (`baseBranch` moved before the `try`). Check: T-12
  and T-13 pass.
- [x] 2.5 D-7: no code; T-14 pins the plan-gate answer. Check: T-14 passes with no edit to
  `flow-check.mjs` or `deliver-check.mjs` (`git diff --stat origin/main -- plugins/openspec/hooks/flow-check.mjs plugins/openspec/hooks/deliver-check.mjs` prints nothing).
- [x] 2.6 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/change-loop.test.mjs plugins/openspec/hooks/roadmap-loop.test.mjs && python3 scripts/check.py` green (a background command: the whole loop suites, so an existing fixture with a merge on the task branch would show here, design R-1); covers AC-1, AC-2, AC-3, AC-5, AC-6, AC-7 and AC-9.

## 3. Skill, documents, roadmap, release and the real run (AC-8, AC-10)

- [x] 3.1 Write T-16 (design D-9). Check: `proof/red-3.txt` holds the red run of
  `node --test --test-name-pattern="^post-merge-validate 3" plugins/openspec/hooks/change-loop.test.mjs`.
- [x] 3.2 D-8: the sentence in the `session` item of `plugins/openspec/skills/devkit/SKILL.md`.
  Check: T-16's skill part passes and `guard.test.mjs`'s test `stage-roles gates: the devkit skill
  names the mock-up among the owner's gates and the accept-decisions step` passes (run it by name:
  `node --test --test-name-pattern="stage-roles gates" plugins/openspec/hooks/guard.test.mjs`).
- [x] 3.3 D-8: `docs/openspec-flow.md` (the sentence in "**The loop.**", the line-316 rewrite, the two
  Troubleshooting rows) and the `hooks/change-loop.mjs` row of `plugins/openspec/README.md`. Check:
  T-16's docs part passes and `python3 scripts/check.py` exits 0.
- [x] 3.4 D-8: the trimmed `post-merge-validate` line of `openspec/roadmap.md`, unticked. Check:
  T-16's roadmap part passes.
- [x] 3.5 D-11: release. Merge `origin/main` first, then take the next minor after `origin/main`'s
  devkit-openspec version and the next minor after its marketplace `metadata.version` (the next free
  numbers on origin/main at the last merge before review); set them in
  `plugins/openspec/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, move the three
  CI pin lines of `docs/openspec-flow.md` to the new devkit-openspec version, and add the CHANGELOG
  entry (D-11). Check: `change-loop.test.mjs`'s CI pin invariant (line 2573, "every CI pin names the
  devkit-openspec version of its manifest") passes, `python3 scripts/gen-catalog.py --check` exits 0
  and `command claude plugin validate .` exits 0.
- [x] 3.6 D-10: the real run, both cases, with `proof/real-run-red.jsonl`,
  `proof/real-run-green.jsonl` and `proof/real-run-summary.txt`. Check: the pass condition of D-10
  holds in the summary (the red sequence with the planner's Agent call, the green sequence, the
  `devkit-stage` lines unchanged, both streams trusted by D-10 step 8); any other sequence stops the
  phase and goes back to the plan.
- [x] 3.7 Gate: `env TMPDIR=/var/tmp GITHUB_HEAD_REF=probe-branch GITHUB_BASE_REF=main node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && command claude plugin validate . && openspec validate post-merge-validate --strict` green (the guard suite as a background command of the conducting session); covers AC-1 to AC-10 and every other suite at once (AC-8 through the proof of 3.6).

## Workflow follow-up

- The installed devkit-openspec, not this worktree, runs the loop: this change's own merges of
  `origin/main` are validated by hand (`openspec validate post-merge-validate --strict`) until a
  version with this change is installed, or the loop is driven with this worktree's
  `plugins/openspec/hooks/change-loop.mjs` (CLAUDE.md).
- Archive the change after the review bench and the owner's answers to the retro, as `ship-change`
  leads it.
