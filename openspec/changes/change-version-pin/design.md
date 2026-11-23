<!-- devkit-stage design result=passed attempt=3 commit=cc4d863ed45de6268e0baab71024b91399a9e17e -->
# Design

Change: `change-version-pin` · Date: 2026-11-22 · Owner: Kaue (chacal88) · PRD / tech spec: n/a

## Context

See `proposal.md` (Why). What exists today, at `cc4d863` (devkit-openspec 0.22.0, marketplace 0.26.0,
after the `stage-roles` change):

- Every installed `flow.json` (`devkit`, `devkit-lite`, `devkit-project`) declares `"version": 1`.
  `stage-roles` edited them in place and kept that version: new stage keys `appliesWhen` and
  `notAfter`, `ceiling: "owner"` on `mockup`, a longer `readiness.staleAfter`, every `shipped: false`
  removed; `devkit-lite` dropped its `mockup` and `decisions` stages; `devkit-project` is unchanged.
  It kept changes under way readable through `appliesWhen` and `notAfter` (a stage whose `notAfter`
  stage already has a file does not apply). Version 1 is therefore the content at `cc4d863`; the
  0.21.x content that version 1 had before is not kept and no reader can ask for it (requirements,
  "A change with no pin"). AC-4 compares an unpinned change with its behaviour at `cc4d863`.
- A change's `.openspec.yaml` holds `schema:` and `created:` (written by `openspec new change`).
  `change-loop.mjs#switchScript` rewrites its `schema:` line; nothing else writes it.
- The readers of a change's flow call `flow-check.mjs#readFlow(root, schema)`, which reads the
  installed `openspec/schemas/<schema>/flow.json` (else the machine-wide copy, `guard.mjs#schemaFile`)
  through `readFlowFile`, which refuses any `version` other than 1: `flow-check.mjs#collectFlow` (so its
  callers `flow-check.mjs#main`, `change-loop.mjs#nextAction`, `#whereOf` and `#subagentStopFor`,
  `roadmap-loop.mjs#isPreviousScript`, `project-loop.mjs#readFacts` and `#archiveCommand`),
  `change-loop.mjs#subagentStopFor` and `#handOffFor`, `roadmap-loop.mjs#stageTitleOf`,
  `conduct-check.mjs#planArtifactsOf`. D-4 lists every one, with the readers that stay on the
  installed flow.
- The product-code gate (`guard.mjs#writeViolation`), the readiness of `deliver-check.mjs`
  (`collectState`, and `checkOne` in `--ci`) and the roadmap conductor's planning rows
  (`conduct-check.mjs#planFacts`: `needsReadiness` and `needsRequirements`) do not read `flow.json`:
  they ask `guard.mjs#schemaHasArtifact(root, schema, <stage>)` of the installed `schema.yaml`.
- The `devkit-reviews` job of a project downloads `guard.mjs`, `deliver-check.mjs` and
  `merge-setup.mjs` into `$RUNNER_TEMP` and runs on the pull request's head checkout
  (`docs/openspec-flow.md`, CI); this repository's own job runs `deliver-check.mjs --ci` from the tree.
  Any new reader the check needs must live in one of those three files; the flow files it reads come
  from the checkout's `openspec/schemas/`.
- The earlier one-off fix for field finding 7 (`coordinator-field-fixes` A-12, AC-10, D-7) wrote
  `approval.md` as not applying for full-script changes whose implementation had started, and D-2
  recognises a change "begun under the previous script" (`flow-check.mjs#isPreviousScript`: its
  earliest stage file has no header). Both answer one upgrade, after the fact. This change records,
  before any upgrade, which flow each change follows, so the next flow change needs no such fix.
  `isPreviousScript` and `openspec-setup/scripts/changes-under-way.mjs` stay as they are: the
  previous script is the flow before version 1; a pinned change always has a headed
  `requirements.md` (D-6), so it is never read as previous.

## Goals / Non-Goals

**Goals:** one reader of "the flow this change follows" that every change-scoped reader uses (D-4
table A), in a file the CI job already downloads; every released flow version kept where projects and CI find it;
an explicit, recorded move; a repository check that makes a silent flow change impossible to merge.

**Non-Goals (design level):** a flow version 2 (none ships; every `flow.json` stays at version 1);
script-scoped readers (`project-loop.mjs` for a slice not yet opened and `readStatusFlow`,
`changes-under-way.mjs`, the open's own read of the installed version) keep reading the installed
flow; the OpenSpec CLI's own reads (`openspec status`, `openspec instructions`) stay on the installed
`schema.yaml` (D-4 B2, B3); the archived branch of `collectFlow` keeps today's reading (an archived
change ends `archived` before any stage is read); `deliver-check` keeps tying the owner's approval to the readiness stage
(`needsReadiness`); the `devkit-reviews` output and the `deliver-check` report keep their shape
(their tests pin the keys); the previous-script paragraph of the readout gets no flow line.

## D-1 The pin in `.openspec.yaml` (AC-1, AC-4)

Two keys, appended after OpenSpec's own lines (the requirements allow any `x-` name; these are the
chosen ones):

```yaml
schema: devkit
created: 2026-11-22
x-devkit-version: 0.23.0
x-devkit-flow: 1
```

`x-devkit-version` is information for the reader (the devkit-openspec `plugin.json` version that
wrote the pin: this release's number, settled at release, D-11; 0.23.0 if nothing merges before it);
only `x-devkit-flow` decides.

**Reader, `guard.mjs#readPin(dir)`** → `{ flow: number | null, devkit: string | null }`. It reads
`<dir>/.openspec.yaml`; the parse rules (the `config.yaml` "Parsers" rule):

- A missing, unreadable or empty file: `{ flow: null, devkit: null }`.
- Each key is read from the first line that matches `^<key>:` (multiline); later lines of the same
  key are ignored (no devkit writer leaves two, D-7). A line without a final newline and a CRLF line
  read the same.
- The value: the text after the colon, trimmed, with a trailing ` # comment` (a `#` after a space)
  dropped, then one pair of matching `"` or `'` quotes removed.
- `x-devkit-flow` must then match `^[1-9][0-9]{0,5}$`; anything else (empty, `0`, `abc`, `1.5`, `-1`)
  throws `FlowUsageError`: `<id>'s .openspec.yaml has x-devkit-flow "<value>", not a flow version (a
  whole number from 1)`, `<id>` being the folder's name.
- `x-devkit-version` is any non-empty value, else null; never an error.

**Writer, `change-loop.mjs#writePin(dir, { devkit, flow })`**, the only writer (used by D-6 and D-7
through `recordPin`). For each key in the order `x-devkit-version`, `x-devkit-flow`: with a value,
the first line of the key becomes `<key>: <value>`, every later line of that key is dropped, and a
key with no line is appended; with `null`, every line of the key is dropped. Before an append, a
text that does not end in `\n` gets one. Every other line stays byte for byte. One `writeFileSync`.

`change-loop.mjs#recordPin(root, dir, script)` =
`writePin(dir, { devkit: packVersion(), flow: readFlow(root, script)?.version ?? null })`.
`change-loop.mjs#packVersion(pluginDir = join(HOOKS_DIR, '..'))` returns the `version` string of
`<pluginDir>/.claude-plugin/plugin.json`, or null when the file is missing, not JSON or has no
string `version` (then the open writes no `x-devkit-version` line). `github-setup.mjs#pluginVersion`
reads the same file for the setup and throws when it is missing; it stays as it is (another pack
script with another failure rule, outside this change).

## D-2 Every released flow version stays installed (AC-2, AC-3)

Each schema folder gains `flows/<n>.json`, one file per released flow version, the current one
byte-identical to `flow.json`. This change adds `flows/1.json` to `devkit`, `devkit-lite` and
`devkit-project`, in `plugins/openspec/schemas/` and in this repository's `openspec/schemas/` (the
test "flow-check schema: the openspec/schemas copies are byte-identical" in `flow-check.test.mjs`
then covers both copies). Each is a byte copy of the folder's `flow.json` as the tree holds it when
task 1.2 runs, the `cc4d863` content (Context). Should a later merge of `main` bring another in-place
edit of a `flow.json` before this change merges, `flows/1.json` and its digest (D-8) are copied again
from the merged tree: no change records a pin before this release. The 0.21.x content of version 1
gets no file: `stage-roles` replaced it in place before any change could record a pin, so no change
follows it. `install-schemas.sh` copies each
schema folder whole (`cp -R "$src/$name"`), so projects get `flows/` with no script change, in the
project form (committed, read by CI) and the `--user` form alike. OpenSpec 2.0.0 accepts the folder:
`openspec schema validate devkit` printed `Schema 'devkit' is valid` with `flows/1.json` in place
(planner's probe, 2026-11-22), and the CI step "Schemas validate against the OpenSpec CLI" keeps
running it. ADR 0010 decision 1 ("everything that defines the flow is to live under the project's
`openspec/`") holds.

## D-3 One reader of the change's flow, in `guard.mjs` (AC-2, AC-3, AC-4)

The flow file reader moves from `flow-check.mjs` to `guard.mjs`, as the stage header reader did
("one reader, re-exported"): `FlowUsageError`, `readFlow(root, schema)`, `readFlowFile(f, name)` and
their constants (`flow-check.mjs` lines 21 to 26 at `cc4d863`: `SOURCES`, `PARTS`, `STAGE_KEYS`,
`SETTING_PATH`, and `LANGS` exported as `FLOW_LANGS`). `STAGE_KEYS` holds `appliesWhen` and `notAfter`
since `stage-roles`; `SETTING_PATH` is read only by `readFlowFile`'s `appliesWhen` check (line 64).
Every check of `readFlowFile` moves with it unchanged, the ones `stage-roles` added included: the
`ceiling` that is a whole number from 1 or `"owner"` (line 57), the `appliesWhen` that is exactly one
flag or one dotted setting (line 60), the `notAfter` that names a later artifact stage (line 75).
`flow-check.mjs` imports `FlowUsageError`, `readFlow` and `readFlowFile` from `guard.mjs` and
re-exports them (it still throws `FlowUsageError` itself, in `openspecJson`, `collectFlow` and
`readTestSettings`), and takes `LANGS` from `FLOW_LANGS`, so every importer (`conduct-check.mjs`, `change-loop.mjs`,
`roadmap-loop.mjs`, `project-loop.mjs`, `changes-under-way.mjs`, the tests) keeps its import and
`instanceof FlowUsageError` keeps working (one class). One rule changes: `readFlowFile` accepts a
`version` that is a whole number from 1 (`Number.isInteger(v) && v >= 1`), message
`version <v> is not a whole number from 1`; it refused anything but 1. No test pins the old rule
(searched every `*.test.mjs` for `is not 1` and `version: 2`).

New in `guard.mjs`:

`changeFlow(root, dir)` → `{ schema, flow, version, installed, pinned, devkit }`:

1. `schema = changeSchemaAt(root, dir)`; `pin = readPin(dir)` (may throw, D-1).
2. `folder` = the folder of `schemaFile(root, schema)`, or null; `installed` =
   `readFlowFile(<folder>/flow.json, schema)` when that file exists, else null.
3. No `installed` and no `pin.flow`: `{ schema, flow: null, version: null, installed: null, pinned:
   false, devkit }` (today's "no declaration": `flow-check` says `schema-without-declaration` or
   throws for a schema that is not devkit's, as now).
4. `want = pin.flow ?? 1`. When `installed?.version === want`: `flow = installed`.
5. Else `kept = <folder>/flows/<want>.json`. Missing (or no folder): throw `FlowUsageError`:
   `<id> follows flow <want> of the <schema> script, and this checkout has no <relative path of
   kept, or "openspec/schemas/<schema>/flows/<want>.json">: re-run openspec-setup with a
   devkit-openspec that ships it`. Present: `flow = readFlowFile(kept, '<schema> flow <want>')`;
   when `flow.version !== want`, throw `FlowUsageError`: `<relative path> declares version
   <flow.version>, not <want>`.
6. Return `{ schema, flow, version: want, installed: installed?.version ?? null, pinned: pin.flow !==
   null, devkit: pin.devkit }`.

`changeDeclares(root, dir, stageId)` → boolean: `changeFlow(root, dir).flow` declares a stage with
that id; with `flow` null, `schemaHasArtifact(root, schema, stageId)` (today's reading). Throws what
`changeFlow` throws.

`changeDeclaresOrInstalled(root, dir, stageId)` → boolean: `changeDeclares(root, dir, stageId)`; on a
`FlowUsageError` (a malformed pin, a missing kept file, a kept file of another version, a malformed
installed `flow.json`), `schemaHasArtifact(root, changeSchemaAt(root, dir), stageId)`, today's reading;
any other error propagates, as today. The one helper for "a reader that is not a hard gate falls back
to the installed schema": the code gate and the conductor's planning rows both call it (D-4), and no
caller writes its own copy of the catch.

Errors by caller: the readout and the loops surface them (exit 3; the change loop's `LoopUsageError`
"cannot be read"; the project loop's usage-error form); `deliver-check` exits 3, so the CI check fails
naming the version; the code gate and the conductor's planning rows fall back through
`changeDeclaresOrInstalled` (neither is a hard gate: CI is, and it fails); `planArtifactsOf` keeps its
own `FlowUsageError` catch (it falls back to the `schema.yaml` file list, as today); the locks and the
roadmap's titles already let errors through.

## D-4 The readers (AC-2, AC-3, AC-4)

The list is exhaustive. It comes from a sweep of every non-test file under `plugins/` and `scripts/`
at `cc4d863` for each way to learn which stages a change has: `readFlow`, `readFlowFile`,
`collectFlow` (and its callers), `schemaHasArtifact`, `schemaFile`, `flow.json`, a schema's
`.stages`, `PROJECT_STAGE_FILES`, and the OpenSpec CLI's `status` and `instructions` (which read the
installed `schema.yaml`). Only `plugins/openspec/hooks/` and
`plugins/openspec/skills/openspec-setup/scripts/` hold one; `plugins/core`, `plugins/panel`, the other
packs, `scripts/` and `.github/` hold none. Task 1.6 re-runs the sweep as its check.

**A. Routed: the reader follows the change's flow.** Each has its D-9 test (one per reader; the test
named is the one that fails on the code before the change where one exists).

| # | Reader | Today | Change | D-9 test (after `version-pin `) |
|---|---|---|---|---|
| A1 | `flow-check.mjs#collectFlow`, active change | `readFlow(root, schema)` | `changeFlow(root, located.dir)`; `facts.flowVersion = { version, installed, pinned }`. `isPreviousScript(files, flow)` then runs on that flow, unchanged | `AC-2 readout: a version-1 change after the upgrade is asked the removed stage, not the added one` |
| A2 | `flow-check.mjs#computeFlow` | report keys `version … previous` | the base report (line 516 at `cc4d863`) gains `flow: null` as its last key, after `previous`; a current-script report sets `flow: facts.flowVersion ?? null`; archived and previous-script reports keep `flow: null`. `version` of the report stays 1 (an added key) | `AC-4 readout: an unpinned change on version 1 reads as before` |
| A3 | `flow-check.mjs#renderText` | title, stages, next or end | D-5 line 2 when `report.flow?.installed > report.flow.version` (both numbers) | `AC-5 readout: a newer installed flow adds one line in en and pt-BR` |
| A4 | `flow-check.mjs#main` (the readout command) | `collectFlow` | nothing more: through A1; errors exit 3 as today | `AC-4 readout: a recorded flow that is not installed stops the checker` |
| A5 | `change-loop.mjs#nextAction` (and `decide`, `inDelivery` on the flow it passes) | `collectFlow` | nothing more: through A1 | `AC-2 loop: next hands the readiness to its reviewer after the upgrade` |
| A6 | `change-loop.mjs#whereOf` (the resume reply; the roadmap board's `collectRoadmap#whereFor`) | `collectFlow` | nothing more: through A1 | `AC-2 where: a version-1 change after the upgrade stops at its readiness` |
| A7 | `change-loop.mjs#subagentStopFor` (`flow0`, then `collectFlow`) | `readFlow(found.root, changeSchemaAt(...))` | `flow0 = changeFlow(found.root, dir).flow` (its caller lets an error through); the `collectFlow` read through A1 | `AC-2 locks: a version-1 readiness reviewer delivers before it stops` |
| A8 | `change-loop.mjs#handOffFor` (also the roadmap's RH3, through `roadmapAgentDecision`; `scriptAgents(flow)`) | `readFlow(found.root, schema)` | `const { flow, schema } = changeFlow(found.root, dir)`; `!flow` → `allow('no-script')` as now | `AC-2 locks: a version-1 change may hand the readiness to its reviewer` |
| A9 | `roadmap-loop.mjs#stageTitleOf` | `readFlow(...)` in a `try` | `changeFlow(found.root, dir).flow` in the same `try`; the function becomes exported (for its test) | `AC-2 roadmap: a version-1 change after the upgrade titles its readiness in flight` |
| A10 | `roadmap-loop.mjs#isPreviousScript` (RH2 of `roadmapAgentDecision`) | `collectFlow` | nothing more: through A1; the function becomes exported (for its test). Its caller's catch keeps today's `allow('error')` | `AC-4 roadmap: a recorded flow that is not installed stops the previous-script test` |
| A11 | `project-loop.mjs#readFacts`, an opened slice (`next`, `status`) | `collectFlow` | nothing more: through A1; an error reaches `main`'s usage-error form (exit 3) | `AC-4 project: next of a slice whose recorded flow is not installed stops` |
| A12 | `project-loop.mjs#archiveCommand` | `collectFlow` | nothing more: through A1; an error reaches `main`'s usage-error form (exit 3), nothing archived | `AC-4 project: archive of a slice whose recorded flow is not installed stops` |
| A13 | `conduct-check.mjs#planArtifactsOf(root, schema, dir)` (already exported with that signature; `planFacts` already passes `dir`) | `readFlow(root, schema)`, `FlowUsageError` caught; the plan stages filtered by `appliesWhen` and `notAfter` (against `dir`) | the signature and argument order stay; inside, `changeFlow(root, dir).flow` replaces `readFlow(root, schema)` in the same `try`, same catch (falls back to the `schema.yaml` list of `schema`, as today); the `appliesWhen` / `notAfter` filter runs unchanged on that flow | `AC-3 conductor: a version-2 change is asked the added plan file`; also `AC-2 conductor: a version-1 change after the upgrade is asked its readiness, not the added plan file` |
| A14 | `conduct-check.mjs#planFacts`, `needsReadiness` and `needsRequirements` (they drive `readiness`, `approval` and `planningStep`) | `schemaHasArtifact(root, schema, 'readiness')`, `schemaHasArtifact(root, schema, 'requirements')` | `Boolean(located) && changeDeclaresOrInstalled(root, dir, 'readiness')` and the same for `'requirements'`: a conductor tick is not a hard gate, so it falls back to the installed schema on a `FlowUsageError`, as the code gate does; the `schemaHasArtifact` import goes when unused | `AC-3 conductor: a version-2 change is not asked readiness`; fallback: `AC-4 conductor: an unreadable recorded flow falls back to the installed schema` |
| A15 | `guard.mjs#writeViolation` (code gate) | `schemaHasArtifact(root, schema, 'readiness')` | `changeDeclaresOrInstalled(root, changeDir(root, ch.name), 'readiness')`: a hook never blocks on its own error (ADR 0011, "A lock never traps"; ADR 0011 rejected "a hook that fails closed") | `AC-3 guard: a version-2 change does not ask readiness`; fallback: `AC-4 guard: an unreadable recorded flow falls back to the installed schema` |
| A16 | `deliver-check.mjs#collectState` | `schemaHasArtifact(root, schema, 'readiness')` | `changeDeclares(root, dir, 'readiness')`; errors propagate (exit 3) | `AC-3 deliver: a version-2 change's state does not need readiness` |
| A17 | `deliver-check.mjs#checkOne` (`--ci`; `runSeveral` judges each change through it) | same | `changeDeclares(root, changeDir(root, id), 'readiness')`; an error reaches `main`'s catch: exit 3, `deliver-check: <message>` on stderr, the job fails | `AC-3 ci: a version-2 change prints no readiness line`; error: `AC-4 ci: a recorded flow that is not installed fails the check` |

**B. Deliberately on the installed flow (or on no flow).** No code change; each with its reason.

| # | Reader | What it reads | Why it stays |
|---|---|---|---|
| B1 | `flow-check.mjs#collectFlow`, archived change | `readFlow(root, archivedSchema(dir))` | an archived change ends `archived` before any stage is read (Non-Goals) |
| B2 | `flow-check.mjs#collectFlow`, `openspec status --change <id> --json` and `openspec instructions apply --change <id> --json` | the OpenSpec CLI, which reads the installed `schema.yaml` | the CLI honouring the pin is out of scope (`requirements.md`); `collectFlow` takes from it only the `skipped` ids (looked up by the stages of the change's flow, so an id that flow lacks is never read) and the task list, which both flows' `tasks` stage read alike. Also the agent briefs of `change-loop.mjs#nextAction` (lines 697 to 698 and 724 at `cc4d863`), which tell a stage agent to run `openspec instructions <stage> --change <id>`: the agent gets the installed template, the stage itself comes from the change's flow |
| B3 | `guard.mjs#sessionChange`, `openspec status --change <name>` | the CLI's text | printed as context at session start; it decides nothing; same scope reason as B2 |
| B4 | `change-loop.mjs#recordPin` (D-1) | `readFlow(root, script)` | it records the installed version, by definition |
| B5 | `change-loop.mjs#moveFlow` (D-7) | `readFlow(found.root, schema)` | it compares with the installed version, and must move a change whose kept file is missing |
| B6 | `change-loop.mjs#openUnderLock`, `prepare` | `schemaFile(worktree, script)`'s `templates/requirements.md` | the change is being created on the installed flow; it has no pin yet |
| B7 | `project-loop.mjs#readFacts`, a slice with no `.openspec.yaml` (`notOpened`) | `readFlow(root, SCRIPT)` | no `.openspec.yaml`, so no pin: the slice opens on the installed flow |
| B8 | `project-loop.mjs#readStatusFlow` (`statusText` when `facts.flow` is null) | the installed `devkit-project` `flow.json` | only for a delivered or archived slice (the archived reading of B1), and only for stage titles |
| B9 | `openspec-setup/scripts/changes-under-way.mjs` | the pack's `flow.json` by path (`readFlowFile`) | the setup's own previous-script test, before the schemas are replaced (Non-Goals) |
| B10 | `guard.mjs#PROJECT_STAGE_FILES` (`sliceProblems`, the `gh pr create` slice check, `deliver-check`'s archived slices in `--ci`) | a constant, no flow | the CI job reads no schema for a slice; "project-loop schema: PROJECT_STAGE_FILES are the artifact files of the declaration" (`project-loop.test.mjs`) fails the day a `devkit-project` flow version changes those files, which is when the constant must be revisited |
| B11 | `deliver-check.mjs#isDevkitScript`, `#schemaOf`, `guard.mjs#changeSchema`, `#changeSchemaAt` | the schema's name | which changes the check judges is decided by the name (ADR 0012), not by stages |
| B12 | `guard.mjs#schemaHasArtifact` | the installed `schema.yaml` | after this change called only by `changeDeclares` (no flow declared) and `changeDeclaresOrInstalled` (the fallback); `planArtifactsOf`'s `schema.yaml` list (A13's fallback) reads the same file through `schemaFile` |
| B13 | `flow-check.mjs#classificationFlags(dir)` and `#readTestSettings(root)` (set as `facts.flags` and `facts.settings` by `collectFlow`, read by `artifactState` lines 444 to 447 for a stage's `appliesWhen`; imported by `change-loop.mjs` line 32 for the loop's facts) | the grill's `flags=[…]` line of the change's `requirements.md`; the `devkit:` block of `openspec/config.yaml` | project and change facts, not flow-versioned: which stage asks for them is decided by the `appliesWhen` of the change's own flow (A1), so a pinned change asks only the facts its flow names |
| B14 | `change-loop.mjs` hard-coded stage ids: `TEST_STAGES` (line 522), `SWITCH_FLAGS` (line 525, with the `proposal` row of the `devkit-lite` switch), the `accept-decisions` row on `approval` (line 662), the `mockup` waiting row (line 705) | constants, no flow | each fires only when the walk over the change's flow (A1, A5) names that stage as next or end, so a flow without the stage never reaches it; a later flow version that renames one of these stages must revisit the constant, as for B10 |
| B15 | `guard.mjs#classify`, `#isDecisionRecord`, `#isTestFile` | constants, no flow | they say who may write a path (`readiness.md`, `evidence.md`, `approval.md`, `reviews/`, decision records, test files), not whether a stage applies; whether the code gate asks readiness is A15 |

Which changes the check judges does not change: `isDevkitScript(schema)` still decides by the
schema's name (ADR 0012). The readiness row and the `fail: readiness` part of the CI output keep
their text; they now appear exactly when the change's flow declares readiness.

## D-5 The newer-flow line and the resume reply (AC-5)

Readout (`flow-check.mjs`, `WORDS[lang].newer(version, installed, schema, id)`), line 2, directly
under the title line and before the blank line:

```text
en:    Flow: this change follows version 1 of the devkit script; version 2 is installed. To move it: change-loop.mjs flow add-csv-export.
pt-BR: Fluxo: esta change segue a versão 1 do roteiro devkit; a versão 2 está instalada. Para mudá-la: change-loop.mjs flow add-csv-export.
```

JSON readout: `"flow": { "version": 1, "installed": 2, "pinned": true }` (`installed` null when the
script has no `flow.json`). With equal versions the text readout is byte for byte today's; the
approved sample ("flow-check readout: the sample change prints the approved text",
`flow-check.test.mjs`) proves it.

Resume reply (`change-loop.mjs#startMode`, mode `resume`): the reply becomes
`render('resumed', { id, where })`, then `\n` and `render('flow-newer', { version, installed })` when
`flowNotice(root, id)` finds a newer installed flow. `flowNotice(root, id)` reads
`changeFlow(root, <the change's folder in that checkout>)` and returns `{ version, installed }` when
both are numbers and `installed > version`, else null; any error → null (the reply stays as today).
`root` is the checkout `resume` already names (`known.root`, or `list[0].root`). New message keys,
same keys in both languages (the table rules of "Replies use no internal term" hold: no file, no
option, no checker name):

```text
flow-newer  en:    It follows version {version} of its script's flow; version {installed} is installed, and it moves to it only if you ask me.
flow-newer  pt-BR: Ela segue a versão {version} do fluxo do roteiro; a versão {installed} está instalada, e só muda para ela se você me pedir.
flow-moved  en:    The change {id} now follows version {installed} of its script's flow; it followed version {version}.
flow-moved  pt-BR: A change {id} agora segue a versão {installed} do fluxo do roteiro; antes seguia a versão {version}.
flow-ahead  en:    The change {id} follows version {version} of its script's flow, newer than the installed version {installed}: update devkit in this project before moving it.
flow-ahead  pt-BR: A change {id} segue a versão {version} do fluxo do roteiro, mais nova que a versão instalada {installed}: atualize o devkit neste projeto antes de mudá-la.
```

## D-6 Opening records the pin (AC-1)

`change-loop.mjs#openUnderLock`, after `openspec new change` succeeds and before `prepare`:
`recordPin(worktree, join(worktree, 'openspec', 'changes', id), script)`. That one place covers
`/devkit change` and `/devkit roadmap` (the `devkit` skill opens a roadmap change with the same
`change-loop.mjs open` command) and `/devkit project` (`project-loop.mjs#openSlice` calls
`openCheckout`). The flow version is the worktree's installed flow of the script, the one
`openspec new change` just used. A script with no `flow.json` gets no `x-devkit-flow` line (it reads
as version 1, D-3). A malformed installed `flow.json` throws; the existing O5 clean-up removes the
worktree, its folder and the branch, and `open` exits 3 with the error.

## D-7 The `flow` command and the `script` switch (AC-6)

New subcommand `change-loop.mjs flow <id> [--lang <l>]` (`runFlow`, beside `runScript`; `USAGE`, line
1464 at `cc4d863`, gains `| flow <id> --lang <l>` right after `| accept-decisions <id> --lang <l>`), `moveFlow(cwd, id, { lang })` → `{ code, body }`:

| Case | Exit | File | Body |
|---|---|---|---|
| No active change named `<id>` (unknown, archived) | 3 | untouched | usage-error form, error names the id |
| The change's script has no installed `flow.json` | 3 | untouched | usage-error form, error names the script |
| The change's recorded `x-devkit-flow` is not a whole number from 1 (D-1) | 3 | untouched | usage-error form, error names the value |
| Followed version (pin, else 1) equals the installed one | 0 | untouched | `{ version: 1, change, script, flow }`, no `reply` |
| Followed version is newer than the installed one | 2 | untouched | `… reply: flow-ahead` |
| Followed version is older | 0 | `recordPin(found.root, dir, script)` | `{ …, flow: <installed>, reply: flow-moved }` |

`moveFlow` reads `readPin(dir).flow ?? 1` and `readFlow(found.root, schema)?.version`, not
`changeFlow`, so a change whose kept file is missing can still be moved. No stage, proposal or task
state refuses the move: the owner's request is the gate.

`switchScript`, case C1 (before any proposal, another script): after the `schema:` line is rewritten,
`recordPin(found.root, located.dir, script)` records the installed flow of the new script (none: the
`x-devkit-flow` line is dropped). C2 (proposal exists) and C3 (same script) write nothing, as today.

No other command writes the pin: `next`, `wait`, `start`, `reply`, the roadmap and project loops,
`install-schemas.sh` and `changes-under-way.mjs` never call `writePin`. The `devkit` skill runs `flow`
only when the owner asks (D-11).

## D-8 The repository check (AC-7)

New `scripts/released-flows.json`, the digest of every released flow version, computed from the
`flows/<n>.json` files task 1.2 copied from the tree when it runs (the `cc4d863` content for version
1, Context; the 0.21.x content of version 1 has no digest, as it has no file):

```json
{
  "devkit": { "1": "sha256:<hex of plugins/openspec/schemas/devkit/flows/1.json>" },
  "devkit-lite": { "1": "sha256:<hex>" },
  "devkit-project": { "1": "sha256:<hex>" }
}
```

New `check_flow_versions()` in `scripts/check.py`, called from `main()` after
`check_panel_parity()`. It does nothing when `<root>/plugins/openspec/schemas` is not a folder (every
lint test's scratch root). Otherwise, with `rel` the schema folder relative to the root:

- `scripts/released-flows.json` missing → `scripts/released-flows.json is missing: it records the
  digest of every released flow version`; not JSON → `scripts/released-flows.json is not JSON`; stop.
- For each schema folder holding a `flow.json` (sorted): a `flow.json` that is not JSON or has no
  integer `version` → `<rel>/flow.json: no integer "version"`. `flows/<v>.json` missing →
  `<rel>/flow.json: version <v> has no flows/<v>.json; keep each released flow version there`.
  Present with other bytes → `<rel>/flow.json: differs from flows/<v>.json, the released content of
  version <v>; a flow change raises its version`.
- For each `flows/*.json`: a name that is not a whole number from 1 → `<rel>/flows/<name>: not a
  flow version`; its own `version` other than the name → `<rel>/flows/<n>.json: its version is <x>,
  not <n>`; no digest → `<rel>/flows/<n>.json: no digest in scripts/released-flows.json`; another
  digest → `<rel>/flows/<n>.json: does not match the digest of released version <n> in
  scripts/released-flows.json`.
- For each digest of a script whose `flows/<n>.json` is missing → `scripts/released-flows.json:
  <script> version <n> has no flows/<n>.json`.

So a `flow.json` edited with its version kept fails (it differs from `flows/<v>.json`, whose digest
pins it); an edit of a released `flows/<n>.json` fails; a raise passes once `flow.json` says `<n+1>`,
`flows/<n+1>.json` holds the same bytes and its digest is recorded. CONTRIBUTING.md states those
three steps (D-11). The check runs in the CI `check` job (`python3 scripts/check.py`) in seconds;
the copies under `openspec/schemas/` stay pinned by the byte-identical test.

## D-9 Tests

All new tests live in a new `plugins/openspec/hooks/version-pin.test.mjs`, imported by
`plugins/openspec/hooks/guard.test.mjs` with the line
`import './version-pin.test.mjs'; // change-version-pin: the flow a change opened with`. Every test
name starts `version-pin AC-<n> `, so a check selects them with
`--test-name-pattern="^version-pin AC-<n> "`. Every spawned process takes its env from one file
constant that blanks `DEVKIT_BYPASS`, `DEVKIT_CHANGE`, `DEVKIT_BRANCH`, `GITHUB_HEAD_REF`,
`GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` (the guard test "no test env blanks DEVKIT_BRANCH without
also blanking GITHUB_HEAD_REF" scans the file); a CI test then sets its own `GITHUB_HEAD_REF`. Every
phase gate runs the suite with `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` set, as the CI run does.
Fixtures come from the existing suites: `roundRepo` (`conduct-check.test.mjs`), `gitRepo`, `put`,
`commitAll`, `git` (`deliver-check.test.mjs`). The file imports the hook modules as namespaces
(`import * as GUARD from './guard.mjs'`, and so on), so that before a phase a missing export fails
its own tests, not the whole file, and the red run shows each test failing.

One helper per mechanism in the file:

- `flowV2()` → the version 2 of `devkit` the upgrade tests install, derived from the tree's
  `plugins/openspec/schemas/devkit/flow.json`: `version` 2; a stage `threat-model` (`source:
  artifact`, `file: threat-model.md`, `role: change-planner`, `skills: []`, `part: plan`, titles `en`
  "Threat model" and `pt-BR` `Modelo de ameaças`) inserted after `design`; the stage `readiness`
  removed and `approval.staleAfter` set to `["tasks"]`; the `review` stage's `ceiling` 2 → 1. It
  passes `readFlowFile`.
- `upgradeTo2(checkout)` writes `JSON.stringify(flowV2(), null, 2)` to
  `<checkout>/openspec/schemas/devkit/flow.json` and the same bytes to `flows/2.json` (a re-install,
  as merged into the change's branch).
- `packV2()` copies `plugins/openspec` to a temporary folder once, sets its
  `.claude-plugin/plugin.json` version to `9.9.9` and writes `flowV2()` as its
  `schemas/devkit/flow.json` and `flows/2.json`: a newer pack whose
  `skills/openspec-setup/scripts/install-schemas.sh`, `hooks/change-loop.mjs` and
  `hooks/flow-check.mjs` are the "setup re-run" and the "pack update".
- `planFiles(dir, stages, c0)` writes headed plan files (`requirements`, `proposal`, `specs`,
  `design`, `tasks` with ticked tasks, and on request `threat-model`, `readiness`, `approval`,
  `evidence`, `review` failed at attempt 1), as `flow-check.test.mjs#sampleChange` does.
- `pinOf(dir)` returns the `.openspec.yaml` bytes, compared before and after a command.

Tests (one per condition, negatives included):

| AC | Test (after `version-pin AC-<n> `) | Proves |
|---|---|---|
| 1 | `open: a devkit and a devkit-lite change record the pack and flow versions` | `x-devkit-version` = tree's `plugin.json` version, `x-devkit-flow: 1`, `schema:`/`created:` kept; `openspec status --change <id>` stdout and stderr hold no `Unrecognized key` |
| 1 | `open: a project slice records the devkit-project flow` | `project-loop.mjs open <slice>` writes both keys |
| 1 | `open: a script with no installed flow.json gets no flow line` | `flow.json` of `devkit-lite` removed on origin/main: version line only |
| 1 | `open: a malformed installed flow.json opens nothing` | exit 3; no worktree, folder or branch |
| 1 | `packVersion: a plugin.json with a version, and none` | string, then null (missing file, not JSON, no `version`) |
| 1 | `writePin: append, replace, drop, collapse, keep` | no trailing newline, an existing line, `null`, two lines of a key, every other line byte for byte |
| 1 | `skill: the roadmap opens with the same open command` | `plugins/openspec/skills/devkit/SKILL.md` roadmap `start` names `change-loop.mjs open` |
| 2 | `readout: a version-1 change after the upgrade is asked the removed stage, not the added one` | plan files to `tasks`, no readiness: `readiness` listed and next, no `threat-model` |
| 2 | `readout: the version-1 ceiling holds after the upgrade` | review failed at attempt 1: next is the implementation (`fix-after-failure`, "of 2") |
| 2 | `loop: next hands the readiness to its reviewer after the upgrade` | `change-loop.mjs next`: agent `devkit-core:plan-readiness-reviewer`, stage `readiness` |
| 2 | `guard: a version-1 change keeps the code closed after the upgrade` | main session edit of `src/a.js`, no approved readiness: exit 2, "no approved readiness" |
| 2 | `ci: a version-1 change is asked its readiness after the upgrade` | `deliver-check.mjs --ci` on `ship/<id>`: `readiness open`, `fail:` names `readiness` |
| 2 | `locks: a version-1 change may hand the readiness to its reviewer` | `handOffFor` allows `devkit-core:plan-readiness-reviewer` |
| 2 | `locks: a version-1 readiness reviewer delivers before it stops` | `subagentStopFor` refuses `no-file` for `readiness.md` |
| 2 | `where: a version-1 change after the upgrade stops at its readiness` | `CL.whereOf(found, id, { lang: 'en' })` on the AC-2 scratch names `Plan readiness` (the `readiness` title of `flows/1.json`), not `Threat model` |
| 2 | `roadmap: a version-1 change after the upgrade titles its readiness in flight` | `ROADMAP.stageTitleOf({ root, id }, 'readiness', 'en')` is `Plan readiness`; `'pt-BR'` gives that stage's `pt-BR` title |
| 2 | `conductor: a version-1 change after the upgrade is asked its readiness, not the added plan file` | `roundRepo` with change `a` on `devkit`, the tree's `devkit` schema folder under `openspec/schemas/` and `upgradeTo2` committed on origin/main and merged into `a`'s worktree, the plan files of `flows/1.json` (`planFiles`), no `threat-model.md`, no `readiness.md`: `a`'s `next.step` in `t.state()` is `readiness`, not `plan` |
| 3 | `open: a change opened after the upgrade records flow 2` | upgrade committed on origin/main; `x-devkit-flow: 2` |
| 3 | `readout: a version-2 change is asked the added stage, not the removed one` | `threat-model` next; no `readiness` |
| 3 | `readout: the version-2 ceiling blocks` | review failed at attempt 1: blocked, `ceiling-reached`, ceiling 1 |
| 3 | `guard: a version-2 change does not ask readiness` | the same edit: exit 0 |
| 3 | `ci: a version-2 change prints no readiness line` | no `readiness` row; `readiness` not among the failed |
| 3 | `locks: a version-2 change refuses the removed stage's reviewer` | `handOffFor` refuses `devkit-core:plan-readiness-reviewer` |
| 3 | `conductor: a version-2 change is asked the added plan file` | the same `roundRepo`, `a` pinned to 2 with the plan files of `flowV2()` but no `threat-model.md`: `a`'s `next.step` is `plan` and its `missing` holds `threat-model.md` |
| 3 | `conductor: a version-2 change is not asked readiness` | the same `roundRepo`, `a` pinned to 2 with every plan file of `flowV2()` (`threat-model.md` included) and no `readiness.md`: `a`'s `next.step` is neither `readiness` nor `approve` |
| 3 | `deliver: a version-2 change's state does not need readiness` | `DC.collectState(root, id, { env, gh: fakeGh() })` on a version-2 change: `needsReadiness` false, `readiness` and `approval` null; the version-1 change of the same scratch: `needsReadiness` true |
| 4 | `readout: an unpinned change on version 1 reads as before` | JSON `flow` `{1,1,false}`; no `Flow:`/`Fluxo:` line |
| 4 | `readout: an unpinned change after the upgrade follows version 1` | as the AC-2 readout test with no pin |
| 4 | `changeDeclares: equals the schema's readiness for unpinned changes` | `devkit` true, `devkit-lite` false, `devkit-project` false, a schema with no `flow.json` (`spec-driven` stub) as `schemaHasArtifact` |
| 4 | `readPin: the parse rules of D-1` | quotes, comment, CRLF, no final newline, empty file, missing file, first of two lines, empty / `0` / `abc` / `1.5` refused |
| 4 | `readFlowFile: a version is a whole number from 1` | 2 accepted; 0, 1.5 and `"1"` refused |
| 4 | `readout: a recorded flow that is not installed stops the checker` | pin 7: exit 3 naming 7 and `flows/7.json`; JSON error too |
| 4 | `readout: a malformed recorded flow stops the checker` | `abc` and `0`: exit 3 naming the value |
| 4 | `readout: a kept file that declares another version stops the checker` | `flows/1.json` saying 2: exit 3 naming both |
| 4 | `guard: an unreadable recorded flow falls back to the installed schema` | pin 7 and pin `abc` on `devkit`: the edit is refused for readiness, as today |
| 4 | `ci: a recorded flow that is not installed fails the check` | pin 7: exit 3, stderr names 7 |
| 4 | `conductor: an unreadable recorded flow falls back to the installed schema` | pin 7, then pin `abc`, on `devkit` with plan files and no `readiness.md`: `t.state()` does not throw and `a`'s `next.step` is `readiness`, as today |
| 4 | `roadmap: a recorded flow that is not installed stops the previous-script test` | `ROADMAP.isPreviousScript(start, id, env)` on a change pinned to 7 throws `FlowUsageError` naming `flows/7.json` |
| 4 | `project: next of a slice whose recorded flow is not installed stops` | a slice opened with `project-loop.mjs open` (as the AC-1 project test), its pin set to 7: `project-loop.mjs next --slice <slice>` exits 3, its JSON `error` names 7 and `flows/7.json` |
| 4 | `project: archive of a slice whose recorded flow is not installed stops` | the same slice: `project-loop.mjs archive <slice>` exits 3 naming `flows/7.json`; the slice's folder is still under `openspec/changes/`, no `archive/` entry |
| 5 | `readout: a newer installed flow adds one line in en and pt-BR` | line 2 exactly as D-5; JSON `{1,2,true}` |
| 5 | `readout: an equal installed flow adds no line` | the version-2 change: no line |
| 5 | `resume: a newer installed flow adds one line in en and pt-BR` | `start` `change <id>`: `resumed` + `\n` + `flow-newer` |
| 5 | `resume: an equal installed flow adds no line` | the reply equals `render('resumed', …)` |
| 6 | `flow: moves an older change and records the versions` | exit 0, `x-devkit-flow: 2`, `x-devkit-version` = tree's version, reply `flow-moved`, other lines kept; then the readout lists `threat-model`, not `readiness` |
| 6 | `flow: an equal change is left as it is` | exit 0, no `reply`, bytes equal |
| 6 | `flow: a change newer than the installed flow is refused` | pin 3, installed 2: exit 2, `flow-ahead`, bytes equal |
| 6 | `flow: no active change, an archived change, no installed flow and a malformed pin are usage errors` | pin `abc` for the last: exit 3 each, the error names the id, the script or the value, bytes equal |
| 6 | `flow: next, wait, another open, a setup re-run and a pack update leave the pin` | `next`; `wait --interval 5` (returns at once on a plan stage); `open` of a second change; `packV2()`'s `install-schemas.sh`; `packV2()`'s `change-loop.mjs next` and `flow-check.mjs`: bytes equal after each |
| 6 | `script: a switch records the new script's installed flow` | `devkit-lite` → `devkit` with `devkit` at version 2: `x-devkit-flow: 2`; back to `devkit-lite` (version 1): `x-devkit-flow: 1`; `created:` kept |
| 6 | `script: a switch to a script with no installed flow drops the flow line` | the `x-devkit-flow` line is gone |
| 6 | `skill: the flow command runs only on the owner's request` | `devkit` SKILL.md names `change-loop.mjs flow <id> --lang` in the sentence that starts "When the owner asks" |
| 7 | `check: the tree's flows pass` | a scratch root with a copy of `plugins/openspec/schemas` and `scripts/released-flows.json`: `check.py --root` exits 0 |
| 7 | `check: a flow changed without raising its version fails` | a stage added, `version` 1: exit 1, names `devkit/flow.json` and version 1 |
| 7 | `check: a raised version passes` | `version` 2, `flows/2.json` same bytes, digest recorded: exit 0 |
| 7 | `check: a raised version with no kept file fails` | exit 1, "has no flows/2.json" |
| 7 | `check: a kept version with no digest fails` | exit 1, "no digest" |
| 7 | `check: an edited released version fails` | `flows/1.json` and `flow.json` edited alike: exit 1, digest message |
| 7 | `check: a kept file declaring another version fails` | exit 1 |
| 7 | `check: a digest with no kept file fails` | exit 1 |
| 7 | `check: a missing or unreadable digest list fails` | exit 1 for each |
| 7 | `check: a root without the schemas skips the check` | exit 0 |
| 7 | `schema: every kept flow is valid and named by its version` | each `flows/<n>.json` of the tree passes `readFlowFile` and declares `n` |

The file imports `conduct-check.test.mjs#roundRepo`, `deliver-check.test.mjs#fakeGh` and the
namespaces `CL` (`change-loop.mjs`), `ROADMAP` (`roadmap-loop.mjs`) and `DC` (`deliver-check.mjs`) as
it imports `GUARD`. Every routed reader of D-4 table A has at least one row above.

Red first: the first task of each phase writes its tests and runs them on the code before the
phase; the output is saved, as printed, to `openspec/changes/change-version-pin/proof/red-<phase>.txt`
(a check of that task, never a gate). Each test fails there except the ones that guard a reading this
change must keep, which pass before and after. In phase 1 the code before it refuses the upgraded
`flow.json` (version 2), so every reader of the installed flow fails; the ones that pass read the
installed `schema.yaml`, which the upgrade fixture leaves (it still declares `readiness`), or fall back
to it: `AC-2 guard`, `AC-2 ci`, `AC-2 conductor`, `AC-4 guard` and `AC-4 conductor`. Phase 2:
`AC-1 skill`, `AC-5 resume: an equal installed flow adds no line` and
`AC-6 flow: next, wait, another open, a setup re-run and a pack update leave the pin`. Phase 3:
`AC-7 check: a root without the schemas skips the check`. The upgrade scratch of the readout tests is built once and
reused by the tests that only read it (as `sampleChange` is), to keep the suite's time.

## D-10 Existing tests this change touches

Searched every `plugins/openspec/hooks/*.test.mjs` and `plugins/openspec/skills/openspec-setup/scripts/*.test.mjs`
at `cc4d863` (line numbers are of that commit; the test names are what count) for the rules this plan
replaces: how a change's flow is located, the version-1-only rule of
`readFlowFile`, the previous-script reading, the `script` switch writing `.openspec.yaml`, the open
writing `.openspec.yaml`, the readiness read of the hook, the check and the conductor, the conductor's
plan files, the roadmap's stage titles, the reply table and the CI output shapes.

| Test (file) | Rule it pins | What happens |
|---|---|---|
| "flow-check declaration: readFlow refuses a malformed flow.json" (`flow-check.test.mjs`) | the reader's checks | unchanged; `readFlow` is the re-export |
| "field-fixes 7 flow-check: readFlowFile reads a flow.json by path…" (`changes-under-way.test.mjs`) | the reader by path, `FlowUsageError` class | unchanged; same class through the re-export |
| `FC.readFlowFile(...)` of `devkit-project` (`project-loop.test.mjs`, line 91) | the project flow is valid | unchanged |
| "flow-check schema: the openspec/schemas copies are byte-identical" (`flow-check.test.mjs`) | two copies | unchanged; now also covers `flows/` |
| "flow-check readout: the sample change prints the approved text" (`flow-check.test.mjs`) | exact readout | unchanged; proves no line at equal versions (AC-4, AC-5) |
| "flow-check readout: --json carries the same facts" (`flow-check.test.mjs` line 1076; layer: the flow-check readout) | the JSON readout's keys, in order | in task 1.4, `'flow'` is added to the key list after `'previous'` (D-4 A2); invariant: the JSON readout's keys are pinned |
| "flow-check AC-7: …previous form…", "…schema without flow.json…", "readout: a previous-script change prints one paragraph", the five "field-fixes 2 previous-script: …" (`flow-check.test.mjs`) | previous-script reading (D-2 of `coordinator-field-fixes`) | unchanged |
| "change-loop open: O4 starts from origin/<default> after a fetch" (the full open test, `change-loop.test.mjs` line 1137, its assertion at 1166) | the open writes `schema:` | unchanged (`/^schema: devkit-lite$/m` still holds) |
| "change-loop script: C1 …", "C2 …", "C3 …", "the P3 trigger…" (`change-loop.test.mjs`) | the switch writes only the `schema:` line; C2/C3 write nothing | unchanged: C1 asserts the schema line only; C2 and C3 stay byte-equal |
| "change-loop replies: no internal term in either language" (`change-loop.test.mjs`) | every message renders | `SAMPLE` gains `version: 1, installed: 2` so the three new keys render; invariant: no message keeps a placeholder |
| "change-loop skill: every change-loop command and the readout carry the person's language" (`change-loop.test.mjs`) | `--lang` on every loop command of the skill | the subcommand regex and list gain `flow`; invariant: every command the skill runs carries the person's language |
| "change-loop docs: the design records the answers" (`change-loop.test.mjs` lines 2446 to 2502; its positive match `/v0\.22\.0/` at line 2481, then the `doesNotMatch` list of earlier tags) | the doc pins the current release | in the release task the positive match names the new tag and a `doesNotMatch` for `v0.22.0` joins the list; invariant: the snippet pins the current release |
| "change-loop start: … resumed …" (`change-loop.test.mjs` lines 969 to 1002, 2618) | the resume reply | unchanged: equal versions add no line |
| the code-gate tests (`guard.test.mjs`, section "code gate") | readiness closes code in `devkit`, not in `devkit-lite` | unchanged; read through `changeDeclares` |
| "conduct: plan files come from the stage declaration", the five "conduct: devkit: …" planning tests, "conduct: devkit-lite: …" and "conduct: B (after: A): …" (`conduct-check.test.mjs` lines 175 to 410) | the plan files (with their `appliesWhen` / `notAfter` filter) and the requirements and readiness rows of the conductor | unchanged: an unpinned change follows version 1, the installed one; read through `changeFlow` (inside `planArtifactsOf(root, schema, dir)`, signature kept) and `changeDeclaresOrInstalled` |
| the roadmap's `where.finishing` titles (`roadmap-loop.test.mjs` line 270) and its RH0 to RH6 hand-off tests | `stageTitleOf` and `isPreviousScript` | unchanged; the two functions become exported, their bodies read through `changeFlow` |
| "project-loop schema: PROJECT_STAGE_FILES are the artifact files of the declaration" (`project-loop.test.mjs` line 181) | the slice constant (D-4 B10) | unchanged |
| "ci mode runs the devkit-reviews check…" (`guard.test.mjs` line 246), the CI header and key tests (`deliver-check.test.mjs` lines 3182, 3191, 3534) | CI output shape | unchanged |
| `buildReport` keys (`deliver-check.test.mjs` line 2125) | the delivery report's keys | unchanged (no key added) |
| install-schemas folder lists (`install-schemas.test.mjs`) | three schema folders | unchanged (they list folders only) |
| install-scope lint tests (`guard.test.mjs`, from line 655) | `check.py --root` on scratch roots | unchanged: the new check skips roots without `plugins/openspec/schemas` |

## D-11 Documents and release

- `docs/openspec-flow.md`: "The stage header and `flow-check`": the sentence on `flow.json` adds
  `flows/<n>.json`; a new paragraph "The flow a change follows" (the two keys, version 1 without a
  pin, the kept versions, the newer-flow line, the `flow` JSON key); the `--json` sentence names the
  `flow` key. "The change coordinator": a paragraph "Moving to a newer flow" (the resume line, the
  `flow` command on the owner's request, the `script` switch recording the new script's flow).
  "Adopting it in a project" step 2: a re-run of the setup keeps each change on its flow. CI: the
  readiness is asked when the flow the change follows declares it, read from the checkout's
  `openspec/schemas/<script>/`; the job downloads the same three files.
- `CONTRIBUTING.md` (the schema paragraph, line 68): each folder also holds `flows/<n>.json`; a change
  to a `flow.json` raises its `version`, copies the new file to `flows/<n>.json` and records its
  digest in `scripts/released-flows.json` (`sha256:` and the hex of `shasum -a 256`); a released
  `flows/<n>.json` is never edited; `scripts/check.py` refuses anything else.
- `plugins/openspec/README.md`: the `flow.json` row names `flows/`; a row for
  `schemas/<schema>/flows/<n>.json`.
- `plugins/openspec/skills/devkit/SKILL.md`: after the `script` paragraph, "When the owner asks to
  move the change to the newer flow the readout or the resume reply named, run
  `node <skill-dir>/../../hooks/change-loop.mjs flow <id> --lang ${user_config.language}` and say its
  reply; never run it unasked."; the `resume` bullet says the reply may hold a second line, kept as is.
- `plugins/openspec/skills/openspec-setup/SKILL.md` step 4: a change opened from this release on
  records its flow version, and replacing the schemas keeps the earlier versions under `flows/`, so
  such a change keeps its flow until the owner moves it.
- Release (`CONTRIBUTING.md` step 5): devkit-openspec takes the next minor version after
  `origin/main`'s (0.23.0 while `main` is at 0.22.0) in `plugins/openspec/.claude-plugin/plugin.json`
  and `.claude-plugin/marketplace.json`; the marketplace `metadata.version` takes its next minor
  (0.27.0 while it is 0.26.0); `CHANGELOG.md` gets the `## <marketplace version> — change-version-pin`
  entry, above `## 0.26.0 — the stage roles` (or above whatever entry tops the file then), with a
  "Projects" line (move the `devkit-reviews` pin to the new tag to honour pins in CI; re-run
  `openspec-setup` to get `flows/`); the CI snippet of `docs/openspec-flow.md` (the `v0.22.0` lines
  594, 595 and 604) and the docs test of D-10 (positive match on the new tag, `doesNotMatch` for
  `v0.22.0`) name the new tag; `docs/catalog.md` regenerated. Both numbers are settled against `origin/main` at that task, never
  earlier; the tag is a Workflow follow-up after the merge.

## Decisions and ADRs

No new ADR. Read: 0002, 0004, 0010, 0011, 0012, 0013, 0015 (and their alternatives tables).

- ADR 0012 decides which changes the check judges, by the schema's name, and rejected "a devkit
  script is any schema that declares the evidence and review stages" because the check would read
  schema files to decide whom to judge. This change keeps that decision (`isDevkitScript` unchanged)
  and reads the change's flow only for the readiness the check already reads from the checkout's
  `schema.yaml` today.
- ADR 0011 rejected "a hook that fails closed" ("a failing checker could not edit at all"): the code
  gate falls back to today's reading on its own error (D-4).
- ADR 0010 decision 1 keeps the flow under the project's `openspec/` (D-2). ADR 0004's opt-in is
  untouched.
- The pin is a new rule of the checker and the loop, not a change to a recorded decision; the study
  item A-1 also found none needed. The plan-readiness review's `adr-reviewer` may judge otherwise; the
  owner decides at plan approval.
- Open point "Project setup" (`docs/coordination-design.md`, round 26) will install the schemas by
  another step: it must copy the `flows/` folder. Not a dependency of this change.

## Alternatives considered

| Option | Pros | Cons | Why not |
|---|---|---|---|
| A copy of `flow.json` in each change's folder at open | Self-contained change | Every change opened before the release has none to fall back to after an upgrade; the copy rides in every pull request and a hand edit changes the change's rules inside its own diff | The kept versions serve pinned and unpinned changes alike |
| Released versions read from git history (tags) | No extra files | CI checks out without tags; projects vendor the schemas, not devkit's history | Not readable where it is needed |
| Only spare the stages a later flow adds | Smaller | The grill chose the whole old flow (question 2) | Against the requirements |
| A separate pin file (`.devkit.json`) | No YAML edit | One more file per change; `.openspec.yaml` is already the change's own record and `x-` keys are proven silent | Needless |
| Unprefixed keys (`devkit-flow:`) | Shorter | `openspec status` warns "Unrecognized key name(s)" (requirements, proved on 2.0.0) | Breaks AC-1 |
| The code gate fails closed on an unreadable pin | Stricter | ADR 0011 rejected it; CI still fails such a change | ADR conflict |
| AC-7 by comparing with `origin/main` | No digest list | The `check` job checks out one commit; scratch tests could not raise a version | Not available |
| AC-7 in the node suite | One language | 13 to 21 minutes per run; `check.py --root` is already tested on scratch roots | Slower feedback |
| Name the command `upgrade` or `update` | Familiar | It sits beside `script <id> <script>`; `flow <id>` reads the same way | Consistency |

## Implementation plan

**Order (dependency):** kept flows and the reader (`guard.mjs`) → the readers (`flow-check`, the
hook, `deliver-check`, the locks) → the writers (open, switch, `flow`) and the resume line → the
repository check, documents and release.

**Per surface.**

- Hooks (`plugins/openspec/hooks/`): D-1, D-3 to D-7. No hook entry or `hooks.json` change.
- Schemas: D-2. No stage changes.
- Repository scripts: D-8.
- Skills and docs: D-11. Agents: none.
- CI files: none; the `check` job already runs `check.py` and the suite.

**File structure.**

- Create: `plugins/openspec/schemas/{devkit,devkit-lite,devkit-project}/flows/1.json`,
  `openspec/schemas/{devkit,devkit-lite,devkit-project}/flows/1.json`, `scripts/released-flows.json`,
  `plugins/openspec/hooks/version-pin.test.mjs`, `openspec/changes/change-version-pin/proof/red-{1,2,3}.txt`.
- Modify: `plugins/openspec/hooks/guard.mjs`, `flow-check.mjs`, `change-loop.mjs`, `deliver-check.mjs`,
  `roadmap-loop.mjs`, `conduct-check.mjs`, `guard.test.mjs` (one import line), `change-loop.test.mjs`
  and `flow-check.test.mjs` (D-10 edits); `scripts/check.py`; `docs/openspec-flow.md`, `CONTRIBUTING.md`,
  `plugins/openspec/README.md`, `plugins/openspec/skills/devkit/SKILL.md`,
  `plugins/openspec/skills/openspec-setup/SKILL.md`; `CHANGELOG.md`,
  `plugins/openspec/.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `docs/catalog.md`.
- Delete: none.

**Estimate:** optimistic 16 h, likely 23 h, pessimistic 35 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Kept flow versions (six `flows/1.json`) | 0.5 | Migration | LOW |
| Reader move, `readPin`, `changeFlow`, `changeDeclares` (`guard.mjs`) | 2.5 | Core | MEDIUM |
| `flow-check` facts, `report.flow`, the newer-flow line | 1.5 | Core | LOW |
| Code gate and `deliver-check` readiness | 1 | Core | MEDIUM |
| Locks, roadmap titles and previous-script test, conductor plan files and readiness (`changeDeclaresOrInstalled`) | 1.5 | Core | LOW |
| `packVersion`, `writePin`, `recordPin`, the open | 1.5 | Core | MEDIUM |
| `script` switch, `flow` command, messages | 2 | Core | LOW |
| Resume line | 0.5 | Core | LOW |
| `check_flow_versions`, `released-flows.json` | 1.5 | Core | LOW |
| `version-pin.test.mjs` (fixtures and the D-9 tests, one or more per D-4 reader) | 6.5 | Testing | MEDIUM |
| D-10 test edits | 0.5 | Testing | LOW |
| Documents and skills | 1.5 | Documentation | LOW |
| Release | 0.5 | Documentation | LOW |
| Three full-suite gates and their fixes | 1.5 | Testing | MEDIUM |

**Risks.**

| Risk | Probability × impact | Mitigation |
|---|---|---|
| A project's `devkit-reviews` pins an older tag, whose check reads `schema.yaml` and ignores pins | MEDIUM × MEDIUM (only once a flow version 2 ships) | CHANGELOG "Projects" line; `openspec-setup` moves the pin with the schemas; no version 2 exists yet |
| The move of the reader breaks an importer or `instanceof FlowUsageError` | LOW × HIGH | Re-export of the same binding; the D-10 reader tests and `conduct-check`'s catch run in the phase 1 gate |
| A reader of the flow is missed and keeps judging a pinned change by the installed flow | LOW × HIGH | D-4 is the sweep's exhaustive list, each reader routed with a D-9 test or kept with its reason; task 1.6 re-runs the sweep as its check |
| The edit hook reads two small JSON files more per code edit | LOW × LOW | Only for code files with one active change; files of a few KB |
| A sibling change edits a `flow.json` without a raise | MEDIUM × LOW | `check.py` fails its pull request; CONTRIBUTING states the three steps |
| A setup re-run with an older pack leaves a change pinned to a version not installed | LOW × MEDIUM | The error names the version and the fix; the hook falls back; `flow` refuses to move it backwards |
| A later OpenSpec rejects `x-` keys | LOW × HIGH | CI installs OpenSpec 2.0.0; the AC-1 test runs `openspec status` on every suite run |
| The new tests add minutes to the suite | MEDIUM × LOW | Read-only tests share one cached scratch; one full run per phase |
| The fixture's version 2 keeps `approval` without `readiness`, which `deliver-check` ties together | LOW × LOW | AC-3 tests assert only plan stages, the code gate and the readiness row |

**Assumptions** (where the plan breaks if reality differs).

- OpenSpec 2.0.0 reads `x-` keys silently and validates a schema folder holding `flows/`
  (requirements.md, proved on a scratch copy; the planner's probe on 2026-11-22).
- Projects commit `openspec/schemas/`, and the `devkit-reviews` job reads the pull request's head
  checkout (`docs/openspec-flow.md`, "Adopting it in a project" step 2 and CI). A `--user` install is
  invisible to CI, as for today's readiness read.
- `install-schemas.sh` copies each schema folder whole (its `cp -R "$src/$name"` loop).
- The pack's `plugin.json` is at `<hooks>/../.claude-plugin/plugin.json` in the plugin cache, as in
  the tree.
- `openspec new change` has written `.openspec.yaml` when `prepare` runs (`openUnderLock`'s order).
- The roadmap opens changes with `change-loop.mjs open` (`plugins/openspec/skills/devkit/SKILL.md`,
  the roadmap's `start`).

**Dependencies.** `managed-agents-study` (archived; item A-1 and roadmap line L-1);
`coordinator-field-fixes` (archived; `readFlowFile`, `isPreviousScript`, `changes-under-way.mjs`);
`project-phases` (archived; `openCheckout` shared by the project entry, the `devkit-project` flow);
`stage-roles` (archived 2026-11-22; devkit-openspec 0.22.0 and marketplace 0.26.0, the base versions;
it edited version 1 of every `flow.json` in place, added `appliesWhen`, `notAfter`, `SETTING_PATH`
and the `planArtifactsOf(root, schema, dir)` filter this plan builds on). No open decision.

## Migration Plan

Nothing to migrate: a change opened before the release has no pin and follows version 1, which is
every installed flow. A project gets `flows/` when it re-runs `openspec-setup`, and honours pins in
CI once its `devkit-reviews` workflow pins this release's tag. This repository's own change folder
has no pin (it was opened before the release); the next change opened here after the release carries
one (Workflow follow-up).

Rollback: revert the pull request. The `x-` keys are then ignored by every reader (OpenSpec reads
them silently), `flows/` is dropped with the revert, and the readers go back to the installed flow.
