# Tasks

Change: `flow-script-checker` · Date: 2026-11-19 · Owner: Kaue (chacal88)

Work only in this change's worktree, on its branch. Every exact text and rule is in `design.md`
(D-2 stage tables, D-3 header grammar, D-5 `flow.json`, D-6 checker, D-7 readout text, D-8 role
sentences, D-10 writer edits and test changes, D-11 claims and release); the implementer copies them
and makes no design choice. This change's own artifacts stay without a stage header: it is the
previous-script folder that proves AC-7.

Every gate is one backticked command, run as written: the flow takes the first backticked text after
`Gate:` and runs each `&&` part on its own, and `pr-verifier` copies each part verbatim into its
Gates table, so no part holds a `|` (several `--test-name-pattern` arguments instead of an
alternation). Every new test lives in `plugins/openspec/hooks/flow-check.test.mjs` with a name that
starts `flow-check`, so phase gates run them filtered in seconds; `guard.test.mjs` imports the file,
so the whole suite reaches them. The new tests need the `openspec` CLI 2.x on `PATH` (installed:
2.0.0). The whole suite (`node --test plugins/openspec/hooks/guard.test.mjs`, about 8.5 minutes and
671 tests on the base) runs once, in gate 7.7, as a background command.

Test first in every phase: the first task of each phase writes the named tests, and they fail
before the code task that follows. A test that already exists is changed only where `design.md`
D-10 names it, with its invariant, layer and suite.

OD-1 (`design.md` D-10) is decided (a): tasks 6.3 and 6.4 teach the plan-readiness reviewer and
the verifier to write the header line; what they check does not change.

| Id | Slug | Tasks |
|---|---|---|
| AC-1 | `every-stage-declared` | 2.1, 2.2, 2.7 |
| AC-2 | `roles-not-tools` | 2.2, 2.3, 3.1, 3.2, 3.3, 3.4 |
| AC-3 | `fixed-header` | 1.1, 1.2, 2.1, 2.2, 2.3, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 |
| AC-4 | `checker-tells-the-truth` | 1.1, 1.2, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.4 |
| AC-5 | `status-readout` | 5.1, 5.3, 5.4, 7.5 |
| AC-6 | `todays-flow-still-drives` | 2.5, 2.7, 3.1, 3.4, 6.2, 7.1, 7.7 |
| AC-7 | `older-change-recognised` | 4.1, 4.2, 7.5 |
| AC-8 | `short-script` | 2.1, 2.3, 2.7 |
| AC-9 | `no-ai-in-the-checker` | 5.1, 5.3, 5.4, 7.7 |

## 1. The header, the declaration and the task count (AC-3, AC-4)

Test first: 1.1 fails on the base, where `flow-check.mjs` does not exist.

- [x] 1.1 Create `plugins/openspec/hooks/flow-check.test.mjs` and add
  `import './flow-check.test.mjs'; // flow-script-checker: the stage header and the checker` to the
  imports of `plugins/openspec/hooks/guard.test.mjs`. Write the tests `flow-check header: a
  well-formed line is read` (each of the four results; a 7- and a 40-hex sha; `commit=none`; a
  trailing `\r`), `flow-check header: a malformed line, another first line and no line` (malformed
  for `<!-- devkit-stage x result=done ...`, none for `# Proposal` and for an empty file),
  `flow-check declaration: readFlow refuses a malformed flow.json` (a duplicate id, an unknown
  `source`, an `onFail` naming a later stage, a `staleAfter` naming an unknown stage, a title without
  `pt-BR`), and `flow-check tasks: a checkbox inside a fenced block is not a task` (an OpenSpec-shaped
  list `{ id, done, line }` over a `tasks.md` text with a backtick fence, a tilde fence and a longer
  fence holding a shorter one: only the unfenced open lines are pending). Verify: the filtered run
  fails with `ERR_MODULE_NOT_FOUND`. (AC-3, AC-4)
- [x] 1.2 Create `plugins/openspec/hooks/flow-check.mjs` exporting `STAGE_HEADER` and
  `parseStageHeader(text)` (`design.md` D-3: `{ stage, result, attempt, commit }`,
  `{ malformed: true }` or `null`), `readFlow(root, schema)` (D-5: `flow.json` next to the
  `schemaFile` of `guard.mjs`, `null` when absent, a thrown usage error when malformed) and
  `pendingTasks(openspecTasks, tasksText)` (D-6 fence rule). It runs nothing when imported (the
  `isMain` form of `guard.mjs:507-509`). Verify: the 1.1 tests pass. (AC-3, AC-4)
- [x] 1.3 Gate: `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-3 (reader), AC-4 (fence case).

## 2. The two scripts (AC-1, AC-3, AC-8, AC-6)

Test first: the 2.1 tests fail on the shipped schemas; every `conduct` test over a `devkit` change
goes red at 2.4 and green again at 2.5.

- [x] 2.1 In `flow-check.test.mjs`, write `flow-check schema: AC-1 a new devkit change lists every
  stage in order` (a temporary project: `git init`, `openspec init --tools none --no-animation .`,
  `install-schemas.sh .`, `openspec new change x --schema devkit`; `openspec status --change x --json`
  has the `artifacts` ids of `design.md` D-2 in order and `applyRequires` `["approval"]`),
  `flow-check schema: AC-8 a new devkit-lite change lists the short script` (D-2 list; no
  `readiness`, `approval` or `design`; `applyRequires` `["tasks"]`), `flow-check schema: flow.json
  matches the schema` (for both schemas, the `source: "artifact"` stages of `flow.json` are the
  status artifacts in the same order, `file` equals `outputPath`, and `readFlow` accepts it),
  `flow-check schema: AC-3 every template starts with its stage header` (line 1 parses, names the
  template's stage, `result=pending`, `commit=none`), and `flow-check schema: the openspec/schemas
  copies are byte-identical` (every file under both schema folders, `flow.json` and templates
  included). In `plugins/openspec/hooks/conduct-check.test.mjs`, write `conduct: plan files come from
  the stage declaration` (`devkit`: `proposal.md`, `design.md`, `tasks.md`; `devkit-lite`:
  `proposal.md`, `tasks.md`). Verify: they fail. (AC-1, AC-3, AC-8)
- [x] 2.2 Rewrite `plugins/openspec/schemas/devkit/schema.yaml` to `design.md` D-2 (`devkit` table:
  ids, files, `requires`, `apply.requires: [approval]`, `version: 2`), keeping the description's
  phrase `evidence + review before the PR`. Each instruction starts with the role line of D-8, then
  this paragraph: "The file's first line is the stage header of the template:
  `<!-- devkit-stage <id> result=pending attempt=1 commit=none -->`. Keep it first. When the stage's
  gate is met, set `result` to `passed` (or `failed`, or `not-applicable` with one line in the body
  saying why), `attempt` to 1 on the first write and to one more than the replaced header's on a
  rewrite, and `commit` to `git rev-parse HEAD`.", then today's instruction with the D-8
  replacements (no `devkit-core:`, `subagent_type`, Agent tool, `AskUserQuestion`), and for each
  stage its gate in one sentence from `docs/coordination-design.md` section 4 (the `Gate` column).
  The `mockup`, `decisions`, `unit-tests` and `e2e-tests` instructions add D-4's sentence: until
  their role ships nobody is required to write the file, and the checker reports the stage as not
  applying. `readiness` keeps its `- Status:` sentence; `approval` gives the D-10 `approval.md` form;
  `review` says the reviewers' own files keep `Verdict:` on line 1 and `review.md` carries the
  header; `apply` keeps `pr-verifier` before `review-change`. Templates in
  `plugins/openspec/schemas/devkit/templates/`: prepend the header line (with its stage id) to
  `requirements.md`, `proposal.md`, `spec.md` (stage `specs`), `design.md`, `tasks.md`,
  `readiness.md`; create `mockup.md` (`# Mock-up`), `decisions.md` (`# Decisions and ADRs`),
  `approval.md` (`# Plan approval: <change-id>` and the four lines of the `stop-plan-approval` row,
  `plugins/openspec/skills/ship-change/SKILL.md:37`, with placeholder values that hold a `|` or
  `<...>` so `readValue` never reads them as `APPROVED`), `unit-tests.md`
  (`# Unit tests`), `e2e-tests.md` (`# E2E tests`), `evidence.md` (`Commit: <sha>` on line 2, then
  `# Evidence`, `### Gates`, the criteria table), `review.md` (`# Review`), `retro.md`
  (`## Retro: <change-id>` and `## Proposed updates`), each with the header and one HTML comment
  saying what the file holds (no line of any template, the comment included, starts with
  `Status:`, `Commit:` or `Verdict:`, except `evidence.md`'s line 2, `Commit: <sha>`, which holds no
  sha). Create `plugins/openspec/schemas/devkit/flow.json` with the text of
  D-5. Verify: `openspec schema validate devkit` passes from the repository root after 2.4. (AC-1,
  AC-2, AC-3)
- [x] 2.3 Rewrite `plugins/openspec/schemas/devkit-lite/schema.yaml` the same way to the
  `devkit-lite` list of D-2 (`apply.requires: [tasks]`; its `requirements` instruction is devkit's;
  description: "devkit for small, contained changes - requirements (grill) → proposal → (optional
  spec delta) → tasks → apply (TDD) → evidence + review before the PR. No readiness gate, no separate
  plan approval."). Templates: prepend the header to `proposal.md`, `spec.md`, `tasks.md`; create
  `requirements.md` (devkit's), `mockup.md`, `decisions.md`, `unit-tests.md`, `e2e-tests.md`,
  `evidence.md`, `review.md`, `retro.md` as in 2.2. Create
  `plugins/openspec/schemas/devkit-lite/flow.json` (D-5, lite form). Verify: `openspec schema
  validate devkit-lite` passes after 2.4. (AC-2, AC-3, AC-8)
- [x] 2.4 Copy both folders into this repository's `openspec/schemas/` with
  `bash plugins/openspec/skills/openspec-setup/scripts/install-schemas.sh .` (D-9: the copies stay
  byte-identical). Verify: the 2.1 schema tests pass; the `conduct` tests over `devkit` changes are
  red (expected until 2.5). (AC-1, AC-8)
- [x] 2.5 In `plugins/openspec/hooks/conduct-check.mjs`, `planArtifactsOf` reads the plan files
  from `flow.json` when the schema has one (D-10 rule, through `readFlow`), else as today. In
  `conduct-check.test.mjs` make the three edits of `design.md` D-10, each with the invariant named
  there (layer: conduct-check's planning rows; suite: `conduct-check.test.mjs`, run by
  `guard.test.mjs`): the `planFiles` helper (`:79-93`) writes `requirements.md` for every schema;
  the test `conduct: an after: id that is missing from the roadmap or in a skipped round keeps its
  dependent waiting` (`:167-173`) adds `requirements.md` to its hand-built `devkit-lite` change; the
  test at `:353-364` is renamed as D-10 says and gains the assertion that without `requirements.md`
  the step is `grill`. No other conduct test changes (D-10 says how the list was searched). Verify:
  every `conduct` test passes, `conduct: plan files come from the stage declaration` included.
  (AC-6, AC-8)
- [x] 2.6 Run `openspec validate flow-script-checker --strict` against the new copies: this change
  stays valid with the new schema (D-9). Verify: `Change 'flow-script-checker' is valid`. (AC-6)
- [x] 2.7 Gate: `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs && node --test --test-name-pattern="^conduct" plugins/openspec/hooks/conduct-check.test.mjs && node --test --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^install-schemas" plugins/openspec/hooks/guard.test.mjs && openspec schema validate devkit && openspec schema validate devkit-lite && openspec validate flow-script-checker --strict && python3 scripts/check.py` green; covers AC-1, AC-3, AC-6, AC-8.

## 3. Roles and today's readers (AC-2, AC-6)

Test first: the three AC-2 tests of 3.1 fail before 3.2 and 3.3. The four AC-6 tests pin
compatibility and are expected green as soon as they are written; any that fails is a plan defect
to report, not to fix by changing a reader.

- [x] 3.1 Write `flow-check AC-2: no schema text names a platform tool` (every `instruction`,
  template and `flow.json` of both schemas, in both copies, holds none of `devkit-core:`,
  `subagent_type`, `Agent tool`, `AskUserQuestion`, `Workflow tool`, `Claude`; each instruction's
  first line names the role `flow.json` gives that stage, the `apply` instruction counting as the
  `implementation` stage's), `flow-check AC-2: the role document covers
  every role` (a `## <role>` heading in `docs/roles.md` for every `role` and `helpers` value of both
  `flow.json`), `flow-check AC-2: the session hook names the checker and the roles` (`guard.mjs
  session` on a repository with one devkit change prints `flow-check.mjs` and "a role is the
  devkit-core agent of the same name", and no longer "the next step is what `openspec status`
  says"), and the four `flow-check AC-6:` tests of `design.md` D-10 (deliver-check's step with and
  without headers over the ten fixtures; the readiness gate under a header; `approvalState` on a
  headed `approval.md`; conduct-check's planning step with headers). Verify: the AC-2 tests fail,
  the AC-6 tests pass. (AC-2, AC-6)
- [x] 3.2 Create `docs/roles.md` per D-8 (one `## <role>` section per role and helper: what it does,
  delivers, never does, the stages that name it, who plays it in Claude Code today); add a row to
  the "Where the rules are" table of `CLAUDE.md`: `| The roles each stage names | [docs/roles.md](docs/roles.md) |`.
  Verify: the role-document test passes; `python3 scripts/check.py` green (links, language). (AC-2)
- [x] 3.3 In `plugins/openspec/hooks/guard.mjs` `sessionChange` (`:478-481`), replace the sentence
  "Follow the schema: the next step is what `openspec status` says, ..." with the two sentences of
  D-8; nothing else in the file changes. Verify: the session-hook test passes. (AC-2, AC-6)
- [x] 3.4 Gate: `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-2, AC-6.

## 4. The checker's walk over files and git (AC-4, AC-7)

Test first: every 4.1 test fails before 4.2.

- [x] 4.1 Write, over `computeFlow` with synthetic facts and, where git matters, real repositories
  from `gitRepo`/`put`/`commitAll` of `deliver-check.test.mjs`: `flow-check stages: a failed header
  does not pass its stage`, `flow-check stages: not applicable counts as passed`, `flow-check stages:
  a stage whose role is not shipped and has no file does not apply`, `flow-check stages: no stage
  after the implementation while a task is pending`, `flow-check stages: uncommitted product changes
  keep the implementation pending`, `flow-check stages: a stale stage is the only one offered again`
  (evidence headed at c1, a product commit c2, review headed at c2: evidence stale and next, review
  passed), `flow-check stages: a plan file newer than readiness makes readiness stale`,
  `flow-check stages: a failed stage past its ceiling ends blocked`, `flow-check stages: a failed
  stage offers its fix, then itself after the fix`, `flow-check stages: the same stage with nothing
  changed ends blocked` (`--after` with the printed `progressKey`; and a different key after one
  edit does not stop), `flow-check stages: the owner's approval and an unanswered retro wait for the
  owner`, `flow-check stages: a stale approval waits for the owner` (`readiness.md` newer than a
  passed `approval.md`: `end waiting-for-owner`, `approval-stale`, `next` null), `flow-check stages:
  a pending file of an unshipped role waits for the owner` (`decisions.md` with `result=pending`:
  `end waiting-for-owner`, `unshipped-role-pending`; and no `next` ever names `owner` or an
  unshipped role across the 4.1 fixtures), `flow-check stages: an archived change ends archived`, `flow-check AC-7: a folder in the
  previous form is recognised` (headerless `requirements.md` and `proposal.md`: `script` `previous`,
  `stages` `[]`, `next` and `end` null), `flow-check AC-7: a schema without flow.json is the previous
  script`. Verify: they fail. (AC-4, AC-7)
- [x] 4.2 Implement in `flow-check.mjs` `collectFlow(root, id, { env, gh, openspec })` (D-6 facts,
  with `makeOpenspec(cwd, env)`) and `computeFlow(facts, flow, { after })`: the state table, the stale
  check, the walk (rules 1 to 3 and 5 of D-6), the previous-script check and the report fields of
  the JSON of D-6 (`reasonCode`, `params`, English `reason`). The delivery is phase 5: until then a
  walk that reaches it is not exercised by any test. Verify: the 4.1 tests pass except the
  no-progress one. (AC-4, AC-7)
- [x] 4.3 Implement `progressKey` and the `--after` stop (D-6 fingerprint). Verify: the no-progress
  test passes. (AC-4)
- [x] 4.4 Gate: `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-4, AC-7.

## 5. The delivery, the command line and the readout (AC-4, AC-5, AC-9)

Test first: every 5.1 test fails before 5.2 and 5.3.

- [x] 5.1 Write `flow-check delivery: <row>` for each row of the D-6 delivery table (with `fakeGh`
  of `deliver-check.test.mjs`), `flow-check delivery: after a squash merge the walk resumes at the
  retro`, `flow-check stages: termination simulation: every run ends in one of four states or names one next stage` (a loop
  over twelve fixtures that applies each `next` stage's outcome until an `end`; every report has
  exactly one of `next` and `end`, and every end is one of the four states with a reason),
  `flow-check readout: an archived change ends archived without asking OpenSpec for its status` (a
  real folder moved by `openspec archive`, a wrapper `openspec` first on `PATH` that answers
  `--version` and fails on any other call: exit 0, `end.state` `archived`), `flow-check readout: an
  OpenSpec answer without artifacts exits 3` (a live change, a wrapper answering
  `{"status":[{"severity":"error","message":"x"}]}` with exit 0: exit 3 quoting `x`),
  `flow-check readout: the sample change prints the approved text` (export `sampleChange()` from the
  test file: `add-csv-export` as D-7 and D-12 describe; the CLI's text output in `pt-BR` and `en`
  equals the two blocks of D-7 exactly; when `FLOW_CHECK_SAMPLE_DIR` is set, also writes them to
  `<dir>/flow-check-sample.pt-BR.txt` and `<dir>/flow-check-sample.en.txt`), `flow-check readout:
  both languages cover every reason code`, `flow-check readout: --json carries the same facts`
  (`version` 1, the keys of D-6, exactly one of `next`/`end`), `flow-check readout: exit codes`
  (0 next, 0 archived, 0 previous script, 1 waiting, 2 blocked, 3 unknown change), `flow-check
  readout: an OpenSpec other than 2.x exits 3` (a fake `openspec` printing `3.0.0` first on `PATH`),
  `flow-check AC-9: it imports only node built-ins and the pack's hook modules` (the source's import
  lines and spawned programs, D-6), `flow-check AC-9: it runs with only node, git, openspec and a fake
  gh on PATH` (same JSON as with the full `PATH`). Verify: they fail. (AC-4, AC-5, AC-9)
- [x] 5.2 Implement the delivery of D-6 (rule 4 and the post-merge walk) importing `shipConfig`,
  `findChangePr`, `checksItem`, `waitingFor`, `locateChange`, `gitFacts`, `staleness` from
  `deliver-check.mjs` and `makeGh`, `ghError` from `merge-setup.mjs`; copy none. Verify: the
  delivery and four-states tests pass. (AC-4)
- [x] 5.3 Implement the command line of D-6 (arguments, `--json`, `--lang` defaulting to `pt-BR`,
  exit codes, `{ version: 1, error }`), the `TEXT` table and the text renderer of D-7, and the
  `openspec --version` check. Verify: the readout and AC-9 tests pass. (AC-5, AC-9)
- [x] 5.4 Gate: `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs && python3 scripts/check.py` green; covers AC-4, AC-5, AC-9.

## 6. The writers of the header (AC-3, AC-6)

Test first: 6.1 fails before 6.2 to 6.5.

- [x] 6.1 Write `flow-check AC-3: every writer of a stage file names the stage header`: the rows
  `stop-plan-approval`, `review`, `retro` and `stop-retro-answers` of
  `plugins/openspec/skills/ship-change/SKILL.md`, the row `grill` of
  `plugins/openspec/skills/conduct/SKILL.md`, `plugins/core/agents/plan-readiness-reviewer.md`,
  `plugins/core/agents/pr-verifier.md` and `plugins/core/agents/change-planner.md` each contain
  `<!-- devkit-stage` and their stage id; line 1 of
  `plugins/core/skills/plan-readiness-review/templates/report.md` is a `readiness` header with
  `result=pending`. Verify: it fails. (AC-3)
- [x] 6.2 Edit the four `ship-change` rows and the `conduct` `grill` row as the D-10 writer table
  says; nothing else in either skill changes. Verify: the `ship-change` and `conduct` assertions of
  6.1 pass and `node --test --test-name-pattern="^AC-6 instructions-follow"
  plugins/openspec/hooks/guard.test.mjs` stays green. (AC-3, AC-6)
- [x] 6.3 Edit `plugins/core/agents/plan-readiness-reviewer.md` (Delivers: the header first,
  `passed` for APPROVED, `failed` otherwise, attempt one more than the replaced file's) and prepend a
  `readiness` header with `result=pending` to `plugins/core/skills/plan-readiness-review/templates/report.md`.
  Verify: those assertions pass. (AC-3)
- [x] 6.4 Edit `plugins/core/agents/pr-verifier.md` item 1 of Delivers: the header on line 1
  (`passed` for verified, `failed` for defect-found), and "`Commit: <sha>`, as the first line of the
  file, before the first heading" becomes "`Commit: <sha>`, right after the stage header line, before
  the first heading". Verify: that assertion passes. (AC-3)
- [x] 6.5 Edit `plugins/core/agents/change-planner.md` step 4: in OpenSpec mode, write each artifact
  from `openspec instructions <artifact> --change <id> --json` and keep its template's first line,
  `result=passed` once `openspec validate <id> --strict` passes. Verify: that assertion passes. (AC-3)
- [x] 6.6 Gate: `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs && node --test --test-name-pattern="^AC-6 instructions-follow" plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py` green; covers AC-3, AC-6.

## 7. Documentation, release and proof (AC-5, AC-6, AC-7, AC-9)

Test first: 7.1 changes the test anchor before the doc, so the `AC-6 instructions-follow` run is red
between its two edits.

- [x] 7.1 In `plugins/openspec/hooks/deliver-check.test.mjs:2883`, the anchor `` `apply` requires
  `readiness` `` becomes `` `apply` requires `approval` `` (D-10: invariant, layer and suite named
  there). Then update `docs/openspec-flow.md` per D-11: the "Choosing a schema" sentence (`:19`), the
  `devkit` section (`:37-53`, D-2 table, the apply paragraph starting `` `apply` requires `approval` ``
  with `pr-verifier` before `review-change`), the `devkit-lite` section (`:55-63`), "Running a
  change" (`:104-107`, `flow-check` gives what is next), the `Commit:` rule (`:327`), a new section
  "The stage header and `flow-check`" (D-3, D-6, D-7 in short; OpenSpec 2.0.0 as the tested
  version), and the pin (`:489`, `:490`, `:497`) to `v0.15.0`. Verify: `node --test
  --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^the pin in docs"
  --test-name-pattern="^AC-8 release-ready" plugins/openspec/hooks/guard.test.mjs` green after 7.6.
  (AC-6)
- [x] 7.2 Update `docs/coordination-design.md` at the lines D-11 lists (the checker, the header and
  the role names now exist, built by `flow-script-checker`; the open point "The header's field
  names" is answered with this change named; section 3 links `docs/roles.md`), and add to
  `docs/adr/0010-openspec-as-the-harness.md` a dated Note under `## Context`, in the form of its
  existing Note: "Note (flow-script-checker, 2026-11-19): the checker reads OpenSpec's task list
  less the lines inside fenced examples of `tasks.md`, which are not tasks; decisions 1 to 8 are
  unchanged." Verify: `python3 scripts/check.py` green. (AC-6)
- [x] 7.3 Correct the other claims of D-11: `README.md:52`, `plugins/openspec/README.md` (`:3`,
  `:18`, `:19`, rows for `flow.json` and `hooks/flow-check.mjs`), `CONTRIBUTING.md` ("Changing the
  OpenSpec schemas": both copies, `flow.json` and the header kept together; the suite needs the
  `openspec` CLI), the header comments of `openspec/config.yaml` and
  `plugins/openspec/skills/openspec-setup/templates/config.yaml` (lines 1 to 7, keeping
  `apply → evidence + reviews`), and line 39 of
  `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml` and
  `.compozy/loops/openspec-change/loop.yaml` ("devkit adds an independent readiness gate and the
  owner's plan approval; ..."), line 100 of both loop copies and lines 30-32 of
  `plugins/compozy/skills/compozy-setup/templates/agents/tech-lead/AGENT.md` and
  `.compozy/agents/tech-lead/AGENT.md` (the replacements of the D-11 row "only the `devkit` schema
  runs the grill"), and the four `@fission-ai/openspec@latest` lines of the D-11 row on installing
  OpenSpec (`docs/openspec-flow.md:72`, `:499`, `:512`, `plugins/openspec/skills/openspec-setup/SKILL.md:18`).
  Verify: `node --test
  plugins/compozy/skills/compozy-setup/scripts/loop-template.test.mjs` and `python3 scripts/check.py`
  green. (AC-6)
- [x] 7.4 In `.github/workflows/ci.yml`, add a step before "Hook tests" that runs
  `npm i -g @fission-ai/openspec@2.0.0`, and drop the `npm i -g @fission-ai/openspec@latest` line of
  the schema step, which then uses that install. Verify: `grep -c "@fission-ai/openspec@2.0.0"
  .github/workflows/ci.yml` prints 1 and `grep -c "openspec@latest" .github/workflows/ci.yml` prints 0.
  (AC-9)
- [x] 7.5 Proof on real input (D-12), before `pr-verifier` writes this change's `evidence.md`: this
  folder proves AC-7 only while none of its stage files carries a header, and the verifier,
  readiness reviewer and `ship-change` that run on this change are the installed pack's, which write
  none (do not dispatch them with this repository's 6.3 and 6.4 formats). Run `node plugins/openspec/hooks/flow-check.mjs
  flow-script-checker > "$TMPDIR/flow-check-self.pt-BR.txt"` and `node
  plugins/openspec/hooks/flow-check.mjs flow-script-checker --json --lang en >
  "$TMPDIR/flow-check-self.json"` (both exit 0, the previous-script message, `stages` `[]`), then
  `FLOW_CHECK_SAMPLE_DIR="$TMPDIR" node --test --test-name-pattern="^flow-check readout: the sample"
  plugins/openspec/hooks/flow-check.test.mjs`. Hand the four files to `pr-verifier` for
  `evidence.md`. Verify: the four files exist and the self-run text holds "roteiro anterior".
  (AC-5, AC-7)
- [x] 7.6 Release (D-11): devkit-openspec 0.15.0, devkit-core 0.7.0,
  devkit-compozy 0.1.1 in each `plugin.json` and `.claude-plugin/marketplace.json`, marketplace
  0.19.0; the devkit-openspec description of D-11 in its `plugin.json` and
  `.claude-plugin/marketplace.json`; `CHANGELOG.md` entry `## 0.19.0 — the script and the checker`
  with the D-11 content; then `python3 scripts/gen-catalog.py`. Verify: `python3
  scripts/gen-catalog.py --check` and `python3 scripts/check.py` green. (AC-6)
- [x] 7.7 Gate: `node --test plugins/openspec/hooks/guard.test.mjs && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && claude plugin validate . && openspec schema validate devkit && openspec schema validate devkit-lite && openspec validate flow-script-checker --strict` green, run as a background command (about 9 minutes); covers AC-6, AC-9 and every criterion's tests together.

## Workflow follow-up

- After the merge: tag `v0.15.0` on the merge commit and push the tag (`CONTRIBUTING.md`, step 5).
- Round 15 (`change-coordinator`) is created with this round's script and shipped by `ship-change`:
  it proves AC-4 and AC-6 live, and its readout is run at each stage.
- The retro of this change records whether `docs/coordination-design.md` was enough to plan from:
  the list "Questions the design document did not answer" in `requirements.md`.
