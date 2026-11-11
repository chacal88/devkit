# Tasks

Change: `review-workflow` · Date: 2026-11-11 · Owner: Kaue (chacal88)

Every gate is one backticked command, run as written. The flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own. Work only in the worktree
`.claude/worktrees/review-workflow` on branch `review-workflow`. Plain bullets under
`## Workflow follow-up` are not tasks: `deliver-check` counts every checkbox of this file.

Red first, as a reported step. In every task that adds behaviour:

1. Write the tests.
2. Run the task's red command, and put the failing test names (or the load error) in the phase
   report before you write the code.
3. Run the same command green.

A test that passes on its first run is reported as such, with the reason. The full suite takes
about 9 minutes, so run it only at the gate. `<scripts>` below is
`plugins/core/skills/review-change/scripts`.

## 1. The round's rules, the script, the CLI and the checker (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6)

- [x] 1.1 Rules section and loader (design D3, D5, D6, D8). Create `<scripts>/review-round.workflow.js`:
  - `export const meta = { name: 'review-round', description: '<one sentence>', phases: ['review', 'verify', 'write'] }` as its first statement, all literals;
  - the `// ---- rules: begin` / `// ---- rules: end` section holding every name D3 lists, pure, with the prefixes of D15;
  - for now, an orchestration part that only calls `validateArgs(args)`.

  Create `<scripts>/review-round.mjs` with `loadRules(file)` (the `new Function` loader; `review usage: rules section not found in <file>` when a marker or a name is missing) and the loaded names as named exports. Create `<scripts>/review-round.test.mjs`; every test name starts with `review round:`. Add the rules tests of design D16:
  - `needsVerification`; `decide` (3/2/1/0 refutations, blank evidence, `null`); `oneLine` (newlines, `·` → `-`, the 400 cap);
  - `outcomeOf` (nit/praise only → approved, a surviving important → rejected, all refuted → approved, a disposed finding is neither open nor verified, declined), `findingLine`, `consensusOf`;
  - `validateArgs` / `validateStage1` (prefix `review input invalid:`, ids `F1..`, one-line text);
  - the prompt tests: preamble first; stage 1 says "write no file"; the verifier prompt holds only its finding; the writer prompt holds every line verbatim and the commit line, with no `Verdict: approved` / `Verdict: rejected`;
  - the static test: no `import `, `require(`, `Date.now` or `Math.random` anywhere in the script, and no match of `/\bprocess\./` or `/\bfs\./` (a word boundary, so prose such as "diffs." or "specs." in the prompts does not match); `meta` holds no `(`.

  Red: `node --test plugins/core/skills/review-change/scripts/review-round.test.mjs` (expect the missing-file load error); then the same command green (AC-2, AC-3, AC-4 rules).
- [x] 1.2 The orchestration (design D4, D6). In `review-round.workflow.js`, after the rules section: stage 1 runs all reviewers in one `parallel()`; stage 2 runs 3 `devkit-core:finding-verifier` thunks per finding that `needsVerification` holds for, in one `parallel()`; stage 3 runs one writer per reviewer that passed stage 1, in one `parallel()`. Each stage starts with `phase()`. The script ends with a top-level `return` of the D4 result, and `meta.phases` stays the list of the three phase names written in 1.1. This convention is fixed for this change, whoever runs the task, and the harness wrapper below is the only code that assumes it. A different form seen in a live run is a dogfood finding (Workflow follow-up, item 5) for a later change, not a choice made at task time; at run time a missing or unreadable result sends the round to the `agents` path (design D6). Add the harness tests of D16 to `review-round.test.mjs`. The harness strips the leading `export ` and runs the body as an `AsyncFunction('agent', 'parallel', 'pipeline', 'phase', 'log', 'args', body)`, with recording stubs and a `parallel` that turns a rejection into `null`. The tests:
  - AC-1: three reviewers' `agent` calls recorded before the first resolves, each with `agentType: 'devkit-core:<reviewer>'`, `phase: 'review'` and a schema;
  - AC-2: exactly 6 verifier calls for a blocking plus an important finding, none for the nit, the praise or the `fixed in` finding; the three vote cases;
  - AC-3: the writer prompts and `outcome.verdict` cases;
  - AC-4: `reviewMd` holds the verdicts, the verified and refuted counts, `Consensus: ... (round N/2)` and `Path: workflow`;
  - the result: the run resolves to an object with `version: 1`, `path: 'workflow'`, the `change` and `round` of `args`, the `outcomes` and `failed` lists and `reviewMd`, the fields the skill's result check reads (design D6);
  - the failures: a stage-1 `null`, a writer `null`, and invalid `args` rejecting with `review input invalid:`.

  Red: `node --test --test-name-pattern="review round: workflow" plugins/core/skills/review-change/scripts/review-round.test.mjs`; then the same command green (AC-1, AC-2, AC-3, AC-4).
- [x] 1.3 The CLI (design D7, D15). `review-round.mjs` runs as a CLI when it is the process entry:
  - subcommands `stage1`, `verify`, `outcomes`, `consolidate` and `check-file`, each with `--input <json file>`;
  - JSON on stdout; exit 0 / 2 / 3; the four prefixes;
  - text values are read from their last fenced `json` block, and a value without one becomes `review stage failed: <r> review` in `failed`.

  Tests in `review-round.test.mjs`, named `review round: cli ...`:
  - each subcommand on a fixture; `stage1` gives one job per bench entry, each with `agentType: 'devkit-core:<reviewer>'`;
  - `review usage:` for an unknown subcommand and a missing `--input`;
  - `review input invalid:` for bad `args`;
  - `check-file` exit 2 with `review file mismatch:` for a missing file, a wrong line 1, a wrong line 2 and a missing refuted line, and exit 0 for a file written from the outcome;
  - the AC-5 equivalence: the 1.2 fixtures run through the CLI chain with `args.path` `agents` give outcomes deep-equal to the harness's except `path`, and `consolidate`'s text says `Path: agents`.

  Red: `node --test --test-name-pattern="review round: cli" plugins/core/skills/review-change/scripts/review-round.test.mjs`; then the same command green (AC-5).
- [x] 1.4 `deliver-check`: an approved review with an undisposed finding is `fix-review` (design D11). In `plugins/openspec/hooks/deliver-check.mjs` `nextStep`, replace the `rejectedNow` → `fix-review` block with the `fix = uniq([...rejectedNow, ...approvedOpen])` rule and its two-part reason. `toReview` and the deadlock check stay as they are. In `plugins/openspec/hooks/deliver-check.test.mjs`, import the rules from `../../core/skills/review-change/scripts/review-round.mjs` and add:
  - `nextStep: an approved review at the current commit with an undisposed important finding goes to fix-review with that finding (AC-6)`. Its fixture finding is the real round-1 line of release-rebase-pin, copied verbatim from `git show af4055a:openspec/changes/release-rebase-pin/reviews/test-coverage-reviewer.md` (the `- [important] [6] "at every rebase stop" ...` line). The test also covers a `[blocking]` case and the mixed case (one rejected plus one approved-open give one `fix-review` with both reviewers and both findings);
  - `nextStep: an approved but stale review with an undisposed finding is still reviewed`;
  - `review round: findingsItem reads findingLine's refuted line as refuted and its open line as undisposed`, in a temp repo built with the file's existing `gitRepo` / `put` / `commitAll` helpers;
  - `review round: readReviewMd reads consolidate's Consensus line and round`.

  In `plugins/openspec/hooks/guard.test.mjs`, add `import '../../core/skills/review-change/scripts/review-round.test.mjs';` beside the openspec-setup imports. Every existing `nextStep` test, row 9 at line 1300 included, passes unchanged.

  Red: `node --test --test-name-pattern="fix-review with that finding|still reviewed|review round: findingsItem|review round: readReviewMd" plugins/openspec/hooks/deliver-check.test.mjs`. Only the AC-6 test is expected red; the other three pin compatibility, so report them as green on their first run with that reason. Then the same command green (AC-6, AC-3 and AC-4 file compatibility).
- [x] 1.5 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green (AC-1, AC-2, AC-3, AC-4, AC-5 and AC-6 at the logic level).

## 2. Agents, skills, ADR 0008, docs and release 0.13.0 (AC-1, AC-3, AC-5, AC-7, AC-8)

Phase 2 needs phase 1 green: the skill texts call the CLI subcommands and the script path of
phase 1, task 2.6 smoke-runs that CLI on real files, and the release moves the pin with the suite
green.

- [x] 2.1 Agents (design D9, D10).
  - Create `plugins/core/agents/finding-verifier.md`: frontmatter `name: finding-verifier`, a description with "Use when", `tools: Read, Glob, Grep, Bash`, `model: sonnet`. The body covers what it receives, the method, the one-finding budget, the return (`Refuted: yes | no`, `Evidence: <one line>`, or the caller's schema) and a Never list.
  - Add the `### Staged round` paragraph (stage 1: return, write no file; stage 3: write as given, verdict by your own rules, do not review again) at the end of the "Verdict file" section of `plugins/core/agents/{code-quality,test-coverage,architecture,security,adr,spec}-reviewer.md`.

  Tests in `review-round.test.mjs`, named `review round: text ...`: all six have `### Staged round`; `finding-verifier.md` exists and its `tools:` holds neither `Write` nor `Edit`.

  Red: `node --test --test-name-pattern="review round: text" plugins/core/skills/review-change/scripts/review-round.test.mjs`; then green, and `python3 scripts/check.py` passes (AC-2, AC-3).
- [x] 2.2 `plugins/core/skills/review-change/SKILL.md` (design D7, D12).
  - Step 4 becomes the three stages: the path rule; the Workflow call with `scriptPath: <skill-dir>/scripts/review-round.workflow.js`, the inline-`script` fallback and `args`; the `agents` path with the `review-round.mjs` subcommands; busy until the completion notice.
  - The two run-time fallbacks of D6 for a call that was accepted: the result check (a missing or malformed result runs the whole round on the `agents` path, note `Workflow result invalid: <what>`), and the lost round (no notice, and on a later turn the task is no longer running or the owner says the round is dead: drop the busy mark and run the whole round on the `agents` path, note `Workflow lost: no completion notice`; while the task still runs, print that the round is running; a late notice is not consolidated).
  - Step 6 states the verification and verdict rules.
  - The Output part covers `review.md`'s new form and `check-file`.
  - Never gains the four rules of D12.
  - The `description` mentions the verification, stays under about 500 characters and keeps "Use after".
  - No ADR number appears.

  Add `review round: text` tests:
  - the skill names `scripts/review-round.workflow.js`, `scriptPath`, the `agents` path, `subagent_type: devkit-core:<reviewer>` with one message per stage, and `check-file`;
  - the result-check row: the skill holds `Workflow result invalid` and says the whole round runs on the `agents` path;
  - the lost-round row: the skill holds `Workflow lost: no completion notice` and says the busy mark is dropped.

  Red, then green, with the 2.1 command (AC-1, AC-5, AC-8).
- [x] 2.3 The callers (design D12).
  - `plugins/openspec/skills/ship-change/SKILL.md`: the `review` row (through the Workflow tool as `review-change` describes; the `agents` path on a turn the owner did not type; do not recompute until the notice, or until `review-change` declares the round lost) and the `fix-review` row (findings may come from an approved review).
  - `plugins/openspec/skills/conduct/SKILL.md`: Delivery rows item 5 (the same, plus `--busy` until the notice or until the round is declared lost; continuation turns and Auto-fix wakes run the `agents` path).

  Add a `review round: text` test: both rows name the Workflow tool, the `agents` path and the lost round (the text `declares the round lost` in ship-change, `declared lost` in conduct). Red, then green, with the 2.1 command (AC-1, AC-5, AC-8).
- [x] 2.4 ADR 0008 (design D13).
  - Write `docs/adr/0008-reviews-as-a-workflow.md` from the draft in D13.
  - Add the sentence to ADR 0001's Note.
  - Add `; 0008 reviews as a workflow` to the `ADRs:` line of `openspec/config.yaml`.
  - Add the ADR 0008 sentence and link to the "Coordination is allowed; a harness is not." paragraph of `README.md`.

  In `plugins/openspec/hooks/guard.test.mjs`, beside the ADR 0006 test (line 1285), add `ADR 0008 records the reviewer round as a Workflow script; ADR 0001 and the config point to it`. It asserts `- Status: accepted`; the headings Decision, Consequences, Review trigger and Alternatives considered; that ADR 0001 names `0008-reviews-as-a-workflow.md`; that the config matches `/0008 reviews as a workflow/`; and that no ADR number repeats.

  Red: `node --test --test-name-pattern="ADR 0008" plugins/openspec/hooks/guard.test.mjs` (it also imports the other suites; the pattern keeps the run to that test); then green (AC-7).
- [x] 2.5 Docs (design D12).
  - `docs/openspec-flow.md`:
    - `## The review round` before `## The delivery contract`, linking `adr/0008-reviews-as-a-workflow.md`;
    - the "One writer per gate file" row;
    - the Cost bullet;
    - the Limits bullet;
    - the troubleshooting row `Path: agents` on a typed turn.
  - `plugins/core/README.md`: the Review row of "The path through a change".

  Add a `review round: text` test: `docs/openspec-flow.md` has `## The review round` and the ADR 0008 link. Red, then green, with the 2.1 command. `python3 scripts/check.py` passes (links, language) (AC-8).
- [x] 2.6 Real-input smoke of the new CLI (design D6, D15; lesson: prove a checker on real input). For each of the four files in `openspec/changes/archive/2026-11-11-release-rebase-pin/reviews/`:
  - write a scratch JSON `{ file, outcome: { verdict: 'approved', commit: <its line-2 sha>, uncommitted: false, lines: [] } }` outside the repository and run `node plugins/core/skills/review-change/scripts/review-round.mjs check-file --input <that json>`. Expect exit 0;
  - run it again with `verdict: 'rejected'`. Expect exit 2 and stderr starting `review file mismatch:`.

  Put the eight exit codes in the report. Nothing is written in the repository (AC-3, AC-5).
- [x] 2.7 Release (design D14).
  - Bump devkit-core to `0.6.0` in `plugins/core/.claude-plugin/plugin.json` and its `.claude-plugin/marketplace.json` entry.
  - Bump devkit-openspec to `0.12.0` in `plugins/openspec/.claude-plugin/plugin.json` and its entry.
  - Set the marketplace `metadata.version` to `0.13.0`.
  - Add `## 0.13.0 — reviews as a workflow` above `## 0.12.0` in `CHANGELOG.md`, with these lines:
    - a **devkit-core** 0.6.0 line: the three-stage round, the Workflow script and its `agents` fallback, `review-round.mjs`, `finding-verifier`, the reviewers' staged-round paragraph, `review.md`'s path and counts;
    - a **devkit-openspec** 0.12.0 line: approved with an undisposed finding → `fix-review`; the `review` rows of ship-change and conduct; the CI snippet pins `v0.12.0`;
    - a Docs line: ADR 0008, ADR 0001's Note, "The review round".

  Red: `node --test --test-name-pattern="the pin in docs/openspec-flow.md|the real docs/openspec-flow.md" plugins/openspec/hooks/deliver-check.test.mjs plugins/openspec/hooks/release-rebase.test.mjs`. Both fail, because the pins are still `v0.11.0`; report it. Then:
  - run `git add docs/openspec-flow.md`;
  - run `node --input-type=module -e "import { setPins } from './plugins/openspec/hooks/release-rebase.mjs'; import { readFileSync, writeFileSync } from 'node:fs'; const f = 'docs/openspec-flow.md'; writeFileSync(f, setPins(readFileSync(f, 'utf8'), '0.12.0'));"`;
  - check that `git diff -U0 docs/openspec-flow.md` shows exactly the three pin lines changed;
  - check that `grep -c "v0\.11\.0" docs/openspec-flow.md` prints `0`;
  - check that the red command is green.

  Then run `python3 scripts/gen-catalog.py` and check that `python3 scripts/gen-catalog.py --check` exits 0 (AC-8).
- [x] 2.8 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && "$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude" plugin validate . && openspec validate review-workflow --strict` green (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8). The validate part runs the bundled binary by absolute path, never the bare `claude` (design Risks).

## Workflow follow-up

These are plain bullets, outside `deliver-check`'s count (see the note at the top).

- Review and evidence: give the reviewers and `pr-verifier` the result of gate 2.8 (about 9 minutes)
  instead of having them re-run it. This change's own reviews run the current way: the new round
  is installed only after the release.
- After the merge: `claude plugin update devkit-core@devkit` and `devkit-openspec@devkit` in the
  project.
- Dogfood, on the next change (`panel-conduct-view`), recorded in this change's retro. Check each
  live-only fact of design D16:
  1. the tool takes `scriptPath` into the installed plugin (or the inline fallback ran);
  2. `devkit-core:<name>` resolves inside the Workflow;
  3. the guard sees `agent_type` for the stage-3 writers;
  4. `schema` returns the D4 shapes;
  5. the result convention and the `meta.phases` form hold;
  6. a typed `/ship-change` or `/conduct` turn takes the `workflow` path and an automated turn
     takes `agents`;
  7. the completion notice arrives and the session finishes the round; and whether the session
     can see a running Workflow task's state, which the lost-round row of design D6 relies on.

  Items 2, 3, 6 and 7 are the live half of AC-1 to AC-3, which this change proves only under the
  harness and on the `agents` path (proposal, Exit criteria).

  Record the `Path:` and `Notes` lines of its `review.md`, and how many agents ran.
- Archive through `ship-change`. A retro proposal that bumps devkit-openspec also names
  `docs/openspec-flow.md`, because the pin follows the version.
- Follow-up candidate for a guard change: add `finding-verifier` to the roles that write nothing
  (design Risks).
