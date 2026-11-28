<!-- devkit-stage tasks result=passed attempt=1 commit=1e8c2a5084a7b8508f46fe3c2a4aa8e43affe817 -->
# Tasks

Change: `review-writer-text` · Date: 2026-11-28 · Owner: Kaue (chacal88) · Base: `origin/main` at
`6f03a57` (the branch was opened on it and has merged nothing yet) · PRD / tech spec: n/a
(`proposal.md`, `design.md`, `decisions.md`, `release.md`)

Work only in this change's worktree, on its branch. Every rule, text, function and test name is in
`design.md`: D-1 the caps, D-2 `withoutSummary`, D-3 `summaryLine`, D-4 the writer prompt text, D-5
the loader names, D-6 the tests, the pinned rules and the real-run proof, D-7 the docs and the release.
The implementer copies them and makes no design choice. `RW` is
`plugins/core/skills/review-change/scripts/review-round.workflow.js` and `RT` is
`plugins/core/skills/review-change/scripts/review-round.test.mjs`.

Test first: write a task's tests, see them fail on the code before the task, then make them pass.
Every new test's name starts `review-writer-text AC-<n> `. An existing test changes only where
`design.md` D-6 "Pinned rules" says so (one: the exported names, D-5). Its commit message names its
invariant, its layer and its suite (CLAUDE.md). No test file is added or moved, so
`scripts/test-map.json` does not change. The release follows the note rule: `release.md` states it,
and no task bumps a version, edits a `CHANGELOG.md` line or a CI pin line, or numbers an ADR (ADR
0034). Leave no scratch file in the tree, and end every task with `git status --short`.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own. Both gates name the same command, so one passing row of
its selective part in `evidence.md` serves both (the `python3 scripts/check.py` part is the train's).
Run the selective run as a background command of the tool, never with a shell `&`, with no other test
run on the machine and `TMPDIR=/var/tmp`.

| Id | Tasks |
|---|---|
| AC-1 | 1.1, 1.2, 2.1 |
| AC-2 | 1.1, 1.2, 2.1 |
| AC-3 | 1.3, 1.4, 2.1 |
| AC-4 | 1.3, 1.4, 2.1 |
| AC-5 | 1.3, 1.4, 2.1 |
| AC-6 | 1.6, 2.4 |

## 1. The rules, the loader, their tests and the docs (devkit-core)

- [ ] 1.1 In `RT`, write the two tests of `design.md` D-6 for AC-1 and AC-2: `review-writer-text AC-1 a reviewer's own refutation of 600 characters stays whole` and `review-writer-text AC-2 two refuting verifiers keep their whole evidence`. They use only names `RT` already imports. Check (red): `TMPDIR=/var/tmp node scripts/test-suite.mjs --test-name-pattern="^review-writer-text" plugins/core/skills/review-change/scripts/review-round.test.mjs` exits 1 and both tests fail on the `…` (AC-1, AC-2)
- [ ] 1.2 In `RW`'s rules section, lift the two caps of D-1: `oneLine(f.disposition, Infinity)` in `validateStage1` and `oneLine(v.evidence, Infinity)` in `decide`. Leave `oneLine`'s default and its other callers as they are. Check: the command of 1.1 exits 0, and `review round: oneLine joins lines, turns the middle dot into a dash and caps the length` still passes in `TMPDIR=/var/tmp node scripts/test-suite.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs` (AC-1, AC-2)
- [ ] 1.3 In `RT`, write the five tests of D-6 for AC-3, AC-4 and AC-5. They are `review-writer-text AC-3 withoutSummary leaves out a summary section and nothing else`, `review-writer-text AC-3 the writer prompt holds the rest of sections verbatim and not the reviewer's summary`, `review-writer-text AC-4 summaryLine fills every list in the outcome's order`, `review-writer-text AC-4 the writer prompt asks for the round's summary as the last section` and `review-writer-text AC-5 a blocking finding refuted with long evidence is approved, under refuted, on both paths`. Add `withoutSummary` and `summaryLine` to `RT`'s import list and to the name list of `review round: the rules section loads and exports every name` (D-5). Check (red): the command of 1.1 exits 1 (the two names are not exported yet) (AC-3, AC-4, AC-5)
- [ ] 1.4 In `RW`'s rules section, add `withoutSummary` (D-2) and `summaryLine` (D-3), and change `writerPrompt` to the text of D-4. In `plugins/core/skills/review-change/scripts/review-round.mjs`, add both names to `NAMES` and to the `export const { ... } = loadRules()` list (D-5). Check: the command of 1.1 exits 0 with seven `review-writer-text` tests passing, and `TMPDIR=/var/tmp node scripts/test-suite.mjs plugins/core/skills/review-change/scripts/review-round.test.mjs` exits 0 with every pinned test of D-6 unchanged (`git diff origin/main -- plugins/core/skills/review-change/scripts/review-round.test.mjs` shows only additions, plus the two names of 1.3) (AC-3, AC-4, AC-5)
- [ ] 1.5 Add the two sentences of D-7 to step 3 of "The review round" in `docs/openspec-flow.md` and to the "Verification and the verdict file" paragraph of `plugins/core/skills/review-change/SKILL.md`. Check: `python3 scripts/check.py` exits 0, and `grep -c "round builds from the outcome" docs/openspec-flow.md` prints 1 (AC-4)
- [ ] 1.6 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green. Its `selected` lines name `RT`, `plugins/openspec/hooks/deliver-check.test.mjs` and `plugins/compozy/kit/scripts/devkit-kit.test.mjs`, plus the files of the `docs/openspec-flow.md` entry (D-6). Covers AC-1 to AC-5 by test and AC-6

## 2. The real-run proof and the validation

- [ ] 2.1 Conductor: run the real-run proof of `design.md` D-6, cases A, B and C, from the session's scratch folder (`TMPDIR=/var/tmp`). First write and delete a probe file in the scratch `changeDir`; if either fails, stop and ask the owner. Fill `head` and `dirty` from the worktree's `node plugins/core/skills/review-change/scripts/review-round.mjs tree`. Run that script's `outcomes` on the one input, and send each `jobs` entry as one Agent call (`subagent_type` its `agentType`, its prompt). Then run `check-file` on each written file. Check: three verdict files, each passing `check-file` (exit 0) and meeting D-6's pass rule (whole dispositions with no `…`, a last `### Summary` with `summaryLine`'s line, no reviewer summary, the rest of `sections` as given) (AC-1 to AC-5)
- [ ] 2.2 Conductor: hand the scratch paths of 2.1 (the input, the `outcomes` answer, the three files, the `check-file` outputs) to the pr-verifier. It copies them into `openspec/changes/review-writer-text/proof/` and records one row per case in `evidence.md` before the first review round. Check: `evidence.md` has three real-run rows naming the files under `proof/` (AC-1 to AC-5)
- [ ] 2.3 Run the repository's other checks: `python3 scripts/gen-catalog.py --check`, `node plugins/compozy/kit/scripts/gen-agents.mjs --check` and `claude plugin validate .`. Check: each exits 0 (a `CLAUDE.md` command each)
- [ ] 2.4 Run `openspec validate review-writer-text --strict`. Check: it passes, and the delta `specs/review-round/spec.md` states AC-1 to AC-4 (AC-6)
- [ ] 2.9 Gate: `node scripts/test-suite.mjs --own-files && python3 scripts/check.py` green on the head that holds the proof; covers AC-6

## Workflow follow-up

- The review round (`review-change`) after `evidence.md` holds the selective gate row and the three real-run rows.
- The delivery writes the versions, the changelog entry and the CI pins from `release.md` at the merge (ADR 0034).
- Archive the change after the merge, then the retro.
