<!-- devkit-stage design result=passed attempt=4 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Design

Change: `stage-roles` · Date: 2026-11-21 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, `docs/coordination-design.md` D-4 and D-8,
`docs/adr/0010-openspec-as-the-harness.md`, `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`).
Paths are written relative to the repository root and in backticks, never as links: this file moves
one folder deeper when the change is archived. Line numbers are those of `2300f84`.

## Context

See `proposal.md` (Why). What exists at `2300f84`, each fact read in the source:

- Both declarations (`plugins/openspec/schemas/devkit/flow.json`, `.../devkit-lite/flow.json`,
  byte-identical copies under `openspec/schemas/`) mark `mockup`, `decisions`, `unit-tests` and
  `e2e-tests` `"shipped": false`. `mockup` lists the skills `screen-mockup` and `screen-design`;
  `screen-design` ships only in devkit-compozy (`plugins/compozy/skills/screen-design/`).
  `readiness` has `staleAfter: ["proposal", "specs", "design", "tasks"]`.
- `flow-check.mjs#readFlowFile` (`:48-79`) accepts only the keys of `STAGE_KEYS` (`:33-34`) and does
  not check `ceiling`. `artifactState` (`:382-422`) reports a stage with no file `not-applicable`
  only when OpenSpec skips it or the stage is `shipped: false`. `computeFlow` (`:446-545`) offers a
  failed stage's `onFail` (or itself) below `ceiling ?? ceilings.default` and ends blocked at it; an
  `owner: true` stage whose header says `pending` ends `waiting-for-owner` `owner-pending`
  (`:536-541`). `TEXT` (`:291-374`) holds one sentence per reason code in `en` and `pt-BR`; a test
  (`flow-check.test.mjs`, "both languages cover every reason code") names every code.
- `change-loop.mjs` reads the grill's `Classification: ... flags=[..]` line (`classificationFlags`,
  `:627-632`) only to switch a short-script change to `devkit`. `readDevkitSettings` (`:63-84`)
  reads every indented `key: value` of the `devkit:` block as one flat map and keeps only `driver`
  and `language`. `AGENT` (`:371-377`) maps five roles to their agents; `PACKS` (`:1125-1130`) is
  held equal to `docs/roles.md` by "change-loop lock agent: the accepted packs are the ones
  docs/roles.md names". `planPart` (`:518-551`) hands a plan stage to `AGENT[role]` with one brief
  for the planner; an end waiting for the owner at any stage but `approval` and `requirements` falls
  to `unknown-step`. `buildPart` (`:560-585`) takes every step from `deliveryRow` (conduct-check over
  deliver-check), which knows no `unit-tests` or `e2e-tests` stage.
- `conduct-check.mjs#planArtifactsOf` (`:178-200`) lists as plan files every plan stage of the
  declaration with a plain file that is shipped, except requirements, readiness and approval; the
  CompozyOS planner follows it.
- `guard.mjs#classify` (`:208-225`) calls every path outside `openspec/` and `.claude/` `code`;
  `writeViolation` (`:229-253`) refuses code on a schema with `readiness` until it says APPROVED,
  and then from anyone but `tdd-implementer`. So today an ADR file and an E2E test file can be
  written only by the implementer, after the approval.
- The plan approval is the `ship-change` row `stop-plan-approval`
  (`plugins/openspec/skills/ship-change/SKILL.md:37`): the session writes `approval.md` from the
  owner's own message; `deliver-check.mjs#approvalState` (`:1034-1043`) says whether it is current.
- `pr-verifier` (`plugins/core/agents/pr-verifier.md:44,60,61`) takes screenshots and may comment
  on the pull request; `ship-change`'s `verify` row allows a comment once a pull request exists.
- The CompozyOS kit (`plugins/compozy/skills/compozy-setup/templates/`) has four shells
  (`tech-lead`, `dev`, `qa`, `design`) and a loop whose design node runs after the plan approval
  gate; this repository's `.compozy/` is the rendered copy, held byte-equal by
  `adoption.test.mjs`.

## Goals / Non-Goals

**Goals:** the four roles run from the loop of both drivers that exist; the declarations say when
each stage applies, so the checker decides it from facts and never sends a change back; product
code stays the implementer's.

**Non-Goals:** a change to `deliver-check.mjs`'s steps or to the `devkit-reviews` check (the test
stages come before the delivery in the walk, so the pull request is never reached with a red one);
any CompozyOS node added or removed; a writer lock on `mockup.md`, `decisions.md`, `unit-tests.md`
or `e2e-tests.md` (requirements: no new hook lock).

## D-1 The declarations (AC-2, AC-3, AC-5, AC-7, AC-10, AC-12, AC-13)

Three new optional keys of a stage in `flow.json`, read by `flow-check` (D-2):

| Key | Value | Meaning |
|---|---|---|
| `appliesWhen` | `{ "flag": "<flag>" }` or `{ "setting": "<dotted path under devkit>" }`, exactly one key | With no file, the stage applies only when the grill's classification lists the flag, or the `devkit:` block declares the setting with a non-empty value |
| `notAfter` | the id of a later artifact stage | With no file of its own, the stage does not apply once that stage has a file |
| `ceiling` | a whole number from 1, or the string `"owner"` | Existing key, now checked; `"owner"` means no attempt ceiling: the owner ends the attempts by approving |

`devkit/flow.json`, the four stages (every other stage unchanged; `readiness` gains two ids):

```json
{ "id": "mockup", "source": "artifact", "file": "mockup.md", "role": "screen-designer", "owner": true,
  "skills": ["screen-mockup"], "part": "plan", "appliesWhen": { "flag": "ui" }, "notAfter": "proposal", "ceiling": "owner",
  "title": { "en": "Screen mock-up", "pt-BR": "Mock-up de tela" } },
{ "id": "decisions", "source": "artifact", "file": "decisions.md", "role": "adr-author",
  "skills": ["adr-authoring"], "part": "plan", "notAfter": "proposal",
  "title": { "en": "Decisions and ADRs", "pt-BR": "Decisões e ADRs" } },
{ "id": "readiness", ..., "staleAfter": ["mockup", "decisions", "proposal", "specs", "design", "tasks"], ... },
{ "id": "unit-tests", "source": "artifact", "file": "unit-tests.md", "role": "test-runner",
  "skills": ["test-and-coverage", "systematic-debugging"], "part": "after", "codeBound": true, "onFail": "implementation",
  "appliesWhen": { "setting": "tests.unit" }, "notAfter": "evidence",
  "title": { "en": "Unit tests", "pt-BR": "Testes unitários" } },
{ "id": "e2e-tests", "source": "artifact", "file": "e2e-tests.md", "role": "e2e-tester",
  "skills": ["e2e-testing"], "part": "after", "codeBound": true, "onFail": "implementation",
  "appliesWhen": { "setting": "tests.e2e" }, "notAfter": "evidence",
  "title": { "en": "E2E tests", "pt-BR": "Testes E2E" } }
```

`devkit-lite/flow.json`: the `mockup` and `decisions` entries are removed; `unit-tests` and
`e2e-tests` are the same as above. `screen-design` leaves the `mockup` stage's skills: it records
screen-map rows after the plan, ships in another pack, and no devkit-core agent can list it.

**The unit stage needs its command (planner's resolution).** The requirements make the E2E stage
conditional on its command and say nothing for the unit stage. The unit stage gets the same rule:
without `devkit.tests.unit` it does not apply and the phase gates of `tasks.md` carry the proof, as
today. The alternative, running the context's prose "Test command", was rejected: the checker reads
no prose (ADR 0010 decision 3) and the agent would guess which line is the command.

**Both schemas' `schema.yaml` and templates.** In both copies of each schema:

- `mockup` and `decisions` artifacts are removed from `devkit-lite/schema.yaml`, and
  `templates/mockup.md` and `templates/decisions.md` from `devkit-lite/templates/`. The lite
  `description:` line drops nothing (it never named them).
- Every instruction's sentence "Until this stage's role ships, nobody is required to write this
  file, and the checker reports the stage as not applying." is replaced by the stage's condition:
  - `mockup`: "This stage applies only when the grill's classification lists `ui`, and not once
    `proposal.md` exists. Write the header with `result=pending`: only the owner's approval, recorded
    by the session, sets it to `passed`. On an attempt after the owner asked for changes, redraw from
    the owner's notes in `mockup.md`, keep them, and raise the attempt. Keep no image file."
  - `decisions`: "This stage does not apply once `proposal.md` exists. List each record as a line
    `- ADR: \`<path from the repository root>\` — <title>`; write each with its status line saying
    `proposed`. The owner's plan approval accepts them."
  - `unit-tests`: "This stage applies only when `devkit.tests.unit` is declared in
    `openspec/config.yaml`, and not once `evidence.md` exists. Run `devkit.tests.unit` and, when
    declared, `devkit.tests.coverage.command`; compare the coverage with
    `devkit.tests.coverage.target` when declared."
  - `e2e-tests`: "This stage applies only when `devkit.tests.e2e` is declared, and not once
    `evidence.md` exists. Write the tests from the acceptance criteria without reading the test
    files the change's diff adds or modifies; write only test files." The sentence about writing
    `result=not-applicable` when the project has no E2E structure is removed (the checker decides).
  - `evidence` (both): its instruction gains "as text: per acceptance criterion what was done,
    what was observed and whether it passed; no screenshot, no image, no pull-request comment."
  - `readiness` (devkit): "The plan under review includes `mockup.md` and the records
    `decisions.md` lists."
  - `approval` (devkit): "Show the owner the plan (the proposal's What Changes, the design
    decisions, the tasks' phases, and the records `decisions.md` lists, which the approval accepts)".
- Templates (`devkit/templates/` and the remaining lite ones), the comment under the heading only;
  line 1 is unchanged:
  - `mockup.md`: "Each screen this change alters: its file under `mock/` (`<screen>.html`,
    self-contained, for a web page or panel; `<screen>.md`, monospaced, for a terminal, CLI or
    band), the real example its data comes from. The owner's notes of each attempt and the owner's
    approval are appended below by the session."
  - `decisions.md`: "One line per record this change proposes, in the project's ADR folder, status
    proposed: `- ADR: \`<path from the repository root>\` — <title>`. With no decision that needs a
    record, set result=not-applicable above and say why in one line."
  - `unit-tests.md`: a table `| Command | Exit | Summary |`, then `Coverage: <n>% (target <t>% |
    no target declared)`, then `## Failures` when red.
  - `e2e-tests.md`: a table `| Scenario | Criterion | File | Result |`, then `Command: \`<e2e>\`
    exit <n>`, then `## Not covered` for a criterion with no end-to-end surface.
  - `evidence.md`: the comment says "as text, no image".

**Alternatives considered.** Deciding "applies" in the loop instead of the checker: rejected, the
readout, `/devkit status` and the stop locks read the checker, and they would disagree. Writing a
`not-applicable` file for every skipped stage (ADR 0010 decision 3: "a stage that does not apply
leaves its file saying so"): rejected for the conditional and late stages, because the requirements
say no file is written (AC-3) and a change under way must not gain files (AC-13); the readout says
why in the stage's line, which decision 3's purpose (the reason is visible) keeps. ADR 0014
decision 1 records it (D-12). A per-stage `"ceiling": 999` for the mock-up: rejected, a number would be a
hidden limit the owner never chose.

## D-2 The checker (AC-3, AC-7, AC-10, AC-13; spec `change-stages`)

**Facts.** `collectFlow` adds two facts for a live change with a declaration, read before the
previous-script test: `flags`, the lower-cased flags of the first line of `requirements.md` that
matches `/^.*Classification:.*flags=\[([^\]]*)\]/m` (empty when the file or the line is missing),
and `settings`, the map of the declared dotted paths under `devkit` with a non-empty value
(`{ 'tests.unit': 'npm test', 'tests.e2e': ..., 'tests.coverage.command': ..., 'tests.coverage.target': '80' }`),
from `readTestSettings(root)` (D-3). `classificationFlags` moves from `change-loop.mjs` to
`flow-check.mjs`, exported, and `change-loop.mjs` imports it.

**Declaration checks** (`readFlowFile`): `STAGE_KEYS` gains `appliesWhen` and `notAfter`;
`appliesWhen` must be an object with exactly one of `flag` (a non-empty string) or `setting` (a
non-empty dotted string); `notAfter` must name an artifact stage after this one; `ceiling`, when
present, must be a whole number from 1 or `"owner"`. Each breach is a `FlowUsageError` naming the
stage and the key, as the existing checks are.

**Order of rules in `artifactState` for a stage with no file**, first match wins: (1) OpenSpec
skips it (`skipped`, unchanged); (2) `notAfter` names a stage with a file: `not-applicable`,
`past-point`, `{ after }`; (3) `appliesWhen.flag` not in `flags`: `not-applicable`, `flag-absent`,
`{ flag }`; (4) `appliesWhen.setting` not in `settings`: `not-applicable`, `setting-absent`,
`{ setting }`; (5) `shipped: false`: `role-not-shipped` (unchanged, kept for a project's own
declaration); (6) `pending`, `no-file`. A stage with a file is read from its header as today.

**The owner ceiling.** For a stage whose `ceiling` is `"owner"`: a failed header gives the stage
reason `changes-asked`, `{ attempt }`, instead of `header-failed`; in `computeFlow` a failed current
stage with that ceiling is never `ceiling-reached` and offers itself with `owner-changes`,
`{ stage, attempt }` (the `raw.fixed` branch does not arise: the mock-up is not code-bound and has
no `staleAfter`). `situation()` prints `changes-asked` alone, as it prints `header-failed`. The
`--after` no-progress rule is unchanged.

**New reason codes** (`TEXT`, both languages; the readout prefixes the state word, so no sentence
starts with it):

| Code | en | pt-BR |
|---|---|---|
| `past-point` | `` `the change was already past the ${nameOf(n, p.after)} when this stage arrived` `` | `` `a change já tinha passado da etapa ${nameOf(n, p.after)} quando esta etapa chegou` `` |
| `flag-absent` | `` `the requirements' classification has no ${p.flag} flag` `` | `` `a classificação dos requisitos não tem a marca ${p.flag}` `` |
| `setting-absent` | `` `openspec/config.yaml declares no devkit.${p.setting}` `` | `` `o openspec/config.yaml não declara devkit.${p.setting}` `` |
| `changes-asked` | `` `the owner asked for changes at attempt ${p.attempt}` `` | `` `o dono pediu mudanças na tentativa ${p.attempt}` `` |
| `owner-changes` | `` `the owner asked for changes to the ${nameOf(n, p.stage)} at attempt ${p.attempt}; it is drawn again` `` | `` `o dono pediu mudanças na etapa ${nameOf(n, p.stage)} na tentativa ${p.attempt}; ela é refeita` `` |

**`conduct-check.mjs#planArtifactsOf`** keeps a plan stage only when it is shipped, declares no
`appliesWhen`, and its `notAfter` stage (when declared) has no file in the change's folder; the
signature gains the change's folder. So the CompozyOS planner is asked for `decisions.md` on a new
`devkit` change and never for `mockup.md` (the kit's design node draws it, D-8), and a change past
its proposal is never asked for either (AC-13).

**Alternatives considered.** Reading the flags in the loop and passing them to the checker:
rejected, the checker runs alone (`flow-check.mjs <id>`) and must give the same report. Reading the
`ui` flag from `proposal.md`'s `## Screens` (the CompozyOS form): rejected, the mock-up comes before
the proposal.

## D-3 The test settings (AC-8, AC-9, AC-10; specs `change-coordination`, `project-setup`)

**Keys (planner's resolution of the requirements' nesting point: option (a)).** The nested form,
which `docs/coordination-design.md` D-8 already shows:

```yaml
devkit:
  language: en
  driver: claude
  tests:
    unit: "npm test"                 # the whole unit suite
    coverage:
      command: "npm run coverage"    # prints the total coverage
      target: 80                     # whole number, percent; absent: coverage is recorded, never fails
    e2e: "npm run e2e"               # absent: the E2E stage does not run
```

Option (b), flat keys (`unitTests`, `coverageCommand`), was rejected: it would leave the design
page's example wrong and mix two styles in one block.

**Reader.** `readTestSettings(root)` in `flow-check.mjs` (exported; `change-loop.mjs` imports it,
since `flow-check.mjs` cannot import `change-loop.mjs`) reads the `devkit:` block by indentation:
a line `  tests:` opens the tests map, deeper `unit:`, `e2e:` and `coverage:` lines fill it, and
`command:` and `target:` under `coverage:` fill that. Values are read with the same rule as
`plainValue` (quoted or not, a trailing `# comment` dropped; `plainValue` moves to `flow-check.mjs`
with it). It returns `{ unit, e2e, coverage: { command, target }, paths, unknown }`: missing values
are `null`; `paths` is the flat map D-2 uses; `target` is a number only when the text is a whole
number from 0 to 100, else `null` with `{ setting: 'coverage-target', value, accepted: 'a whole number from 0 to 100' }`
in `unknown`. `readDevkitSettings` keeps its contract and appends the tests' `unknown` entries to
its own, so `projectGate` stops `start` with `setting-unknown` for a bad target, as for a bad
driver. Its flat scan stays as it is (the nested `unit:` or `command:` lines are ignored there,
which "change-loop settings" tests already allow for unknown keys).

**`openspec-setup`.** Step 5 ("Write `openspec/config.yaml`") gains one bullet: "Fill the
`devkit:` block's `tests:` from the repository: `unit` from the test command (package scripts,
`Makefile`, CI), `coverage.command` when the stack has a coverage command, `e2e` only when the
project has an E2E tool configured (Playwright, Cypress, a CI E2E job). Show each proposed value and
ask the owner to confirm or change it, and ask for `coverage.target` (none is a valid answer).
Write only what the owner confirmed; keep every value the block already holds and ask nothing about
it. A stage whose command is absent does not run." `templates/config.yaml` gains, after the `ship`
comment, a commented `devkit:` block with `language`, `driver` and the four `tests` keys above,
headed `# The settings of /devkit change; a test stage whose command is absent does not run.`

## D-4 The loop (AC-2 to AC-6, AC-9, AC-10; spec `change-coordination`)

**Agents.** `AGENT` gains `'screen-designer': 'devkit-core:screen-designer'`,
`'adr-author': 'devkit-core:adr-author'`, `'test-runner': 'devkit-core:test-runner'` and
`'e2e-tester': 'devkit-core:e2e-tester'`; `PACKS` gains the same four roles with `devkit-core`.

**Plan part.** The brief's `what` of a plan stage handed for a `PLAN_REASONS` code: the planner and
the readiness reviewer keep today's texts; any other role gets
`` `write ${file} from \`openspec instructions ${stage} --change ${id}\`` `` (stale or rerun:
today's "is out of date" text). Two new branches, before the `PLAN_REASONS` branch:

- `n.reasonCode === 'owner-changes'`: `agent('mockup', 'screen-designer', null,
  \`the owner asked for changes at attempt ${attempt}: redraw from the owner's notes in mockup.md as attempt ${attempt + 1}\`)`.
- In the ends: `e.state === 'waiting-for-owner' && e.stage === 'mockup' && e.reasonCode === 'owner-pending'`:
  `waiting('waiting-for-owner', 'waiting-mockup', 'mockup', {}, { file: 'openspec/changes/<id>/mockup.md', folder: 'openspec/changes/<id>/mock/' })`.
  (Decided in phase 2, recorded at attempt 3.) `<id>` stands for the change's real id
  (`ctx.id`), written into both paths: the detail of change `feat` is
  `{ file: 'openspec/changes/feat/mockup.md', folder: 'openspec/changes/feat/mock/' }`, never the
  literal `<id>`.

**Build part.** Before reading the delivery row, `buildPart` looks at the stage checker's `next`:

- `n.stage` in `TEST_STAGES = ['unit-tests', 'e2e-tests']`: hand it to `AGENT[role]` with step
  `n.stage`, detail `{ unit, coverage: { command, target } }` (unit) or `{ e2e }` (E2E) from
  `readTestSettings`, and `what` `` `run the ${stage} stage from \`openspec instructions ${stage} --change ${id}\`` ``
  (stale or rerun after a fix: `the work changed since the last run: run it again`).
  (Decided in phase 2, recorded at attempt 3.) The stale or rerun case is the checker's
  `n.reasonCode` `stale-code` or `rerun-after-fix`; its `what` is that sentence alone, with no
  `openspec instructions` text, and the step and the detail are the same as on a first run.
- `n.stage === 'implementation'`, `n.reasonCode === 'fix-after-failure'` and `n.params.failed` in
  `TEST_STAGES`: hand step `fix-tests` to `devkit-core:tdd-implementer`, detail `{ failed, file }`,
  `what` `` `${failed} failed at attempt ${attempt} of ${ceiling}: fix the code from ${file}, test first, within the approved tasks` ``.

Neither step is a row of `ROWS` (no checker returns it), so "the loop's rows match what the checkers
return" is unchanged. After a fix, the dirty tree makes the delivery row `commit` (as for every
fix), and the committed fix makes the failed stage `rerun-after-fix`.

**Accept-decisions step.** `nextAction` adds `decisions: decisionRecords(root, dir)`:
`{ listed: [path], proposed: [path], unreadable: [{ path, why }] }`, from the `- ADR: \`<path>\``
lines of `decisions.md` and the first status line of each file (see below). `decide`, right after the
previous-script and archived checks: when `facts.approval?.ok`, the change is not being archived
(`facts.archiving` false), and `proposed` or `unreadable` is not empty, return
`sessionAction('approval', 'accept-decisions', { command, records })` with
`command = ['node', <hooks>/change-loop.mjs, 'accept-decisions', id, '--lang', lang]`. On the
archive branch (`chore/archive-<id>`, `facts.archiving` true) the step is never returned, whatever
the records say, and the loop goes on to the archive steps: the archive pull request only moves the
change's folder, so it is not where the owner accepts a record, and sending the owner there would
mix a decision into a move (`change-loop.mjs:523` already holds this clause; recorded at attempt 4).

(Decided in phase 2, recorded at attempt 3.) The facts `decide` reads for this change are two, both
filled by `nextAction` and listed in the comment above `decide`:

- `facts.tests`, the result of `readTestSettings(root)` (D-3), from which the build part takes the
  test stages' detail; a missing `facts.tests` reads as every value `null`.
- `facts.decisions`, the result of `decisionRecords(root, dir)` above; a missing one reads as no
  record, so no `accept-decisions` step.

`records` lists the `proposed` paths, then the `unreadable` paths, in `decisions.md`'s order within
each group. An unreadable record makes the step too, so that the session runs the command and the
command refuses that record by name (step 2 below: exit 3, the `blocked` reply with
`why=cannot-accept` and an `error` that names the path and the fault), instead of the loop going on
to the implementation with a record left unaccepted. With every listed record readable and none
proposed, or with no record listed, there is no step.

**`change-loop.mjs accept-decisions <id> --lang <l>`** (the one new subcommand; `USAGE` names it):

1. Refuses unless `approvalState(dir).ok`: a `LoopRefusal`, exit 3, whose `error` names what is
   wrong (here the missing or earlier approval; below the file and the fault) and whose `reply` is
   the `blocked` message with `why=cannot-accept` and that `error`.
2. For each listed path: refuses when it is absolute, leaves the repository, does not exist, is not
   `.md`, or has no folder named `adr`, `adrs` or `decisions` (case-insensitive); or when its first
   line matching `/^(\s*[-*]?\s*\**Status\**\s*:\s*\**\s*)(\S+)(.*)$/im` is missing or its value is
   neither `proposed` nor `accepted` (case-insensitive). All checks run before any write: a refusal
   changes no file.
3. For each `proposed` one: the value becomes `accepted` in the same letter case (`Proposed` to
   `Accepted`), and a line is inserted right after it, with the status line's own prefix:
   `<prefix>Accepted by: the owner, on <Date of approval.md>, in the approval of the plan of change <id> (openspec/changes/<id>/approval.md)`.
4. Prints `{ version: 1, change, accepted: [path], already: [path] }`, exit 0.

The session runs `detail.command`; exit 3 is declared with `reply blocked --param id=<id> --param
why=cannot-accept --param error="<the JSON's error field>"`. The command writes only files `decisions.md` lists, inside an ADR
folder, only after a current approval: it is the approval's own record, not product code (ADR 0014, D-12).

**Messages** (one table, `MESSAGES`; none holds a stage id, a file or a setting key):

| Key | en | pt-BR |
|---|---|---|
| `waiting-mockup` | `The mock-up of {id} is drawn. Look at it and tell me whether you approve it or what to change; I go on as soon as you answer.` | `O mock-up de {id} está desenhado. Veja e me diga se aprova ou o que mudar; eu sigo assim que você responder.` |
| `gate.mockup` | `your approval of the mock-up` | `a sua aprovação do mock-up` |
| `blocked-why.cannot-accept` | `the decision records could not be marked accepted ({error})` | `não foi possível marcar os registros de decisão como aceitos ({error})` |
| `setting.coverage-target` | `coverage target` | `meta de cobertura` |

`roadmap-loop.mjs#GATE_OF_WHY` gains `'waiting-mockup': 'mockup'`, so "every owner wait has a gate"
holds.

**Locks.** `UNDELIVERED` (`change-loop.mjs:1078`) gains `owner-changes`: a screen designer that
stops before redrawing is refused once, as any stage agent that has not delivered (the existing
lock, applied to the new stage). The hand-off lock needs nothing more than `PACKS`.

**Alternatives considered.** A delivery-checker step for the test stages: rejected, deliver-check
is the old oracle that round 24 removes, and its 8-item contract and the CI check would change. A
`record-approval` command writing `approval.md` too: rejected, it changes the approval lock ADR
0011 relies on; the loop's step after a current approval reaches the same end with a smaller surface.

## D-5 The owner gates (AC-4, AC-6; specs `change-coordination`, `roadmap-coordination`)

**`ship-change` gains the row `stop-mockup-approval`**, after `stop-plan-approval`:

> Stop. Show the mock-up: each file `mockup.md` lists (a `.md` screen inline, an `.html` screen by
> its path; where the host can publish a private Artifact, it may also publish the `.html` files as
> one). Ask the owner to approve it or say what to change. Only from the owner's own message:
> approved, set line 1 of `mockup.md` to `<!-- devkit-stage mockup result=passed attempt=<same n> commit=<git rev-parse HEAD> -->`
> and append `## Owner's approval` with `- Date: <YYYY-MM-DD>` and `- Owner's words: "<up to 200 characters>"`,
> then append to `requirements.md`, under `## What the mock-up revealed`, each fact the mock-up
> settled that the requirements did not hold (none: say so in one line); changes asked, set line 1
> to `result=failed` with the same attempt and append `## Owner's notes (attempt <n>)` with the
> owner's words. Then run the loop again. Never answer for the owner.

**`stop-plan-approval`** keeps every phrase its test pins; its summary gains "and the records
`decisions.md` lists, which the approval accepts", and it ends "the loop then hands
`accept-decisions`".

**`devkit` skill.** Its `description:` lists the mock-up among the owner's gates ("the grill, the
mock-up, the plan approval, the retro answers"); "Owner gates" names the mock-up (`waiting-mockup`,
recorded by the `stop-mockup-approval` row, asked with AskUserQuestion with the options approve /
ask for changes);
the Loop's `session` item says that an `accept-decisions` step runs `detail.command` like
`switch-script`, and an exit 3 is declared with `reply blocked --param id=<id> --param
why=cannot-accept --param error="<the JSON's error field>"`.

## D-6 The writers (spec `file-writers`)

In `guard.mjs#writeViolation`, two predicates (exported for the tests):

- `isDecisionRecord(rel)`: `rel` ends in `.md` and one of its folder segments (the file name
  excluded) matches `/^(adr|adrs|decisions)$/i`.
- `isTestFile(rel)`: one of its folder segments is, case-insensitively, `test`, `tests`,
  `__tests__`, `e2e`, `spec`, `specs`, `cypress` or `playwright`; or its file name matches
  `/^test_|_test\.[^.]+$|[._-](test|spec|e2e|cy)\.[^.]+$/i`.

Placement, for a `code` path: before the schema test, `if (actor === 'adr-author') return
isDecisionRecord(rel) ? null : 'adr-author writes only the project's decision records (a Markdown
file in a folder named adr, adrs or decisions), not <rel>.'`. After the readiness test (whose refusal
is unchanged and comes first), `if (actor === 'e2e-tester') return isTestFile(rel) ? null :
'e2e-tester writes only test files, not <rel>. Product code is written by the tdd-implementer agent.'`.
Every other branch is unchanged, so on `devkit-lite` any agent still writes code and the screen
designer and the test runner are refused like any agent but the implementer on `devkit`.

The test-file rule is the planner's resolution of how the guard tells a test from product code
without a new setting; its limit (a product file named `spec.ts`, a project whose E2E tests live
elsewhere) is a risk below.

## D-7 The roles (AC-2, AC-5, AC-9 to AC-11, AC-15; spec `stage-deliverables`)

Each agent follows `docs/conventions.md` (Receives, Method, Delivers, Returns with an `Outcome:`
line, Never), names no project, and starts with the stage header rule of the stage instruction.

| Agent | Model | Tools | Skills | Delivers | Returns |
|---|---|---|---|---|---|
| `screen-designer` | sonnet | Read, Glob, Grep, Bash, Write, Edit | `screen-mockup` | `mock/<screen>.html` or `.md`, `mockup.md` (`result=pending`) | `Outcome: drawn \| failure — <summary>` |
| `adr-author` | opus | Read, Glob, Grep, Bash, Write, Edit | `adr-authoring` | the proposed records, `decisions.md` | `Outcome: proposed <n> \| none-needed \| failure — <summary>` |
| `test-runner` | sonnet | Read, Glob, Grep, Bash, Write | `test-and-coverage`, `systematic-debugging` | `unit-tests.md` | `Outcome: green \| red \| failure — <summary>` |
| `e2e-tester` | sonnet | Read, Glob, Grep, Bash, Write, Edit | `e2e-testing` | the E2E test files, `e2e-tests.md` | `Outcome: green \| red \| failure — <summary>` |

`failure` is reserved for "could not do the job" (a command that cannot start, a missing input), so
the loop's declared end (`role-failed`) is not used for a red run, which the header carries.

Never lists: `screen-designer` never writes product code, never keeps an image, never sets
`result=passed`; `adr-author` never edits an accepted record's text, never writes outside the ADR
folder and `decisions.md`, never sets a record accepted; `test-runner` never edits a file but
`unit-tests.md`, never masks an exit code (no `| tail`, `|| true`); `e2e-tester` never edits a
product file, never reads the test files of the change's diff, never weakens a test to pass.

Skills (devkit-core, each `SKILL.md` with a "Use when" description):

- `screen-mockup`: find the screens from the requirements and the code; pick the target's form
  (D-1 template text); take the data from a real example (a fixture, a seed, the change's
  requirements, a recorded output), never lorem ipsum; one file per screen; a self-contained HTML
  file has inline CSS, no script that fetches, no external font or image; a text screen is a fenced
  block at the real width; write `mockup.md`; on a redraw, read the owner's notes first and answer
  each one.
- `adr-authoring`: list the decisions the change takes; for each, ask whether it is hard to reverse,
  crosses a boundary, changes a contract, picks a technology, or contradicts or amends an accepted
  record (read the project's records and their rejected alternatives); write a record only for
  those; follow the project's folder, naming pattern and form, with a status line saying `proposed`
  and the sections Context, Decision, Consequences and Alternatives; an amendment or supersession
  is a new record naming the one it changes; update the project's index when it keeps one; write
  `decisions.md` (D-1 form) or the not-applicable line.
- `e2e-testing`: read the acceptance criteria and the specs, not the diff's tests; find the E2E
  framework from the declared command and the files it runs; write one scenario per criterion that
  can be exercised end to end, named with the criterion id; run the declared command alone (its
  exit decides); record the table and the not-covered criteria; on a red scenario, record what it
  observed and stop.

`pr-verifier.md`: the description drops "screenshots" and "can comment on the PR"; the UI bullet
becomes "exercise each changed screen locally (or on the PR's preview) and record in text what it
showed: the visible text, the state, the console errors"; Delivers items 3 (PR comment) and 4
(screenshots) are removed; each criterion row says what was done and what was observed; Returns
drops "and in the PR comment"; Never gains "Take a screenshot, keep an image or post a pull-request
comment". `ship-change`'s `verify` row drops "(a PR comment is allowed once a PR exists)".
`code-quality-reviewer.md:54` says "observed screen text" in place of "screenshot".

`change-planner.md` gains one sentence under Method step 4: "On a script with a `decisions` stage,
the records are the adr-author's: cite `decisions.md`; a decision found while planning that needs a
record `decisions.md` lacks is an escalation, not a draft."

## D-8 The CompozyOS kit (AC-14; spec `compozy-kit-setup`)

No node, edge or input is added. Text only, in the templates:

- `agents/tech-lead/AGENT.md`, procedure step 1: "For the `devkit` schema, before the proposal,
  have `devkit-core:adr-author` write `decisions.md` (and any proposed record); `conduct-check`
  lists it among the missing plan files." Scope gains the project's ADR folder, through that agent.
- `agents/design/AGENT.md`, "Screen map and mockup": "First have `devkit-core:screen-designer` draw
  each declared screen under `openspec/changes/<id>/mock/` and write `mockup.md` (the
  `screen-mockup` skill), then the screen-map rows as today." Scope gains `mockup.md`.
- `agents/qa/AGENT.md`: a new step before the bench: "When `openspec/config.yaml` declares
  `devkit.tests.unit`, have `devkit-core:test-runner` write `unit-tests.md`; when it declares
  `devkit.tests.e2e`, have `devkit-core:e2e-tester` write the E2E tests and `e2e-tests.md`; a red
  one is the blocking issue `unit_tests_red` or `e2e_tests_red`." Scope gains those two files and
  the E2E test files the agent writes, committed on the branch.
- `agents/dev/AGENT.md`, Implement: "Before the first phase of a change the operator approved: have
  `devkit-core:tdd-implementer` set each record `decisions.md` lists to accepted, with an
  `Accepted by:` line naming the operator's approval in this run, and set `mockup.md`'s header to
  `result=passed` with that approval as the owner's words."
- `loops/openspec-change/loop.yaml`: the `design` node prompt names `devkit-core:screen-designer`
  and `mockup.md`; the `review` node prompt names the two test agents and the two blocking ids; the
  `implement` node's review prompt lists `decisions.md` among the files to read and asks the
  operator to approve the plan together with the records it lists. Its parenthetical list of files
  becomes, word for word, `(requirements and its open questions, proposal, tasks, and design,
  decisions and readiness on the devkit schema)` (D-11, T-11); the line breaks inside the prompt
  are free, since the test flattens the whitespace.
- `.compozy/` is re-installed with `node plugins/compozy/skills/compozy-setup/scripts/install-kit.mjs .`
  (each file matches its recorded digest, so it is updated without a question).

## D-9 The documents and the roadmap (AC-1, AC-15)

- `docs/roles.md`: the four sections's "Played today by" lines become "The agent
  `devkit-core:<role>`." (the form the PACKS test reads); `screen-designer` Does adds "only when the
  grill flags `ui`", Delivers names the `mock/` files; `test-runner` Does: "Runs the whole unit
  suite and the coverage command the project declares and records the result"; `e2e-tester` Does:
  "Writes the E2E tests from the acceptance criteria, apart from the implementer, runs them and
  records the result"; `pr-verifier` Delivers adds "as text, with no image"; `mockup` Stages says
  "`devkit` only", and so does `decisions` Stages, since `devkit-lite` no longer has that stage (D-1).
- `docs/coordination-design.md`: D-4 rows 3, 4, 9, 10 and 11 say "(built, round 16)" in place of
  "(new)"; the paragraph under the table on the mock-up says `screen-designer` draws it; the Tense
  paragraph lists the new roles, skills and the `devkit.tests` settings as existing since
  `stage-roles`; D-8's "The configuration's field names" adds "Decided by `stage-roles` on
  2026-11-21: `devkit.tests.unit`, `devkit.tests.coverage.command`, `devkit.tests.coverage.target`,
  `devkit.tests.e2e`", and the example gains the `coverage` lines.
- `docs/openspec-flow.md`: the artifact rows drop "role not shipped yet" and say when each stage
  applies; the paragraph's last sentence becomes the rule of D-1; the `devkit-lite` paragraph says
  it has no mock-up and no decisions; a short "Test settings" paragraph shows the block of D-3 and
  says that the commit of new E2E tests makes the unit and E2E stages run once more. In "The
  change coordinator" section, "The loop." paragraph's sentence "from the implementation on, the
  same engine as `deliver-check` ... decide the step; the loop copies their decision and adds none"
  gains "except the unit and E2E tests, which `flow-check` alone decides", and one sentence says
  that the mock-up waits for the owner's answer and that the loop has the session accept the
  listed records once the plan approval is recorded.
- `docs/compozy-kit.md` and `plugins/compozy/README.md`: the shells' rows name the agents of D-8.
- `plugins/core/README.md`: four rows in "The path through a change" (the diagram keeps
  `review-change ◀── pr-verifier`); `plugins/openspec/README.md`: the `hooks/change-loop.mjs` row
  lists `accept-decisions` among the commands and says the unit and E2E tests come from
  `flow-check`; the `devkit` skill row follows the regenerated catalog.
- ADR 0014 (D-12) is written as `docs/adr/0014-stage-roles-write-their-own-files.md`. ADR 0010
  gains the header line `- Amended by ADR 0014 (0014-stage-roles-write-their-own-files.md)` and a
  dated Note after the roadmap-coordinator one: "Note (stage-roles, 2026-11-21): the roles of D-4
  stages 3, 4, 9 and 10 ship and stage 11 is recorded as text. ADR 0014 (linked to its file, as the Notes link ADR 0013)
  amends decision 3 (a stage that does not apply because of its declared condition, or that the
  change had already passed, leaves no file) and the sentence of decision 8 on product code. The
  test commands are the settings `devkit.tests.*` (decision 1, round 16). Decisions 1 to 8 are
  otherwise unchanged." ADR 0011 gains the same header line and the Note: "Note (stage-roles,
  2026-11-21): ADR 0014 (linked to its file, as the Notes link ADR 0013) says which files outside the
  change folder are not product code (decision records, and test files the E2E tester writes);
  decision 2's refusal of the session's product edits is unchanged." The ADR line of
  `openspec/config.yaml`'s `context` gains "0014 stage roles write their own files, amends 0010
  and 0011".
- `openspec/roadmap.md`: the `stage-roles` line becomes
  `- [ ] stage-roles (after: change-coordinator) — the ADR author, the unit-test suite, the E2E tester, the screen designer and the demonstration recorded as text in the change (D-4 stages 3, 4, 9, 10, 11)`;
  a new round right after it:

  ```text
  ## Round 16b: the coordinator loop fixes
  - [ ] coordinator-loop-fixes (after: stage-roles) — every item the three retros carried onto stage-roles, moved here by the owner on 2026-11-21. <the text of the stage-roles line at 2300f84 from "Carried from the change-coordinator retro" to its end, verbatim>
  ```

  A test (D-11) reads both lines with `guard.mjs#parseRoadmap` and checks that the new line holds
  every carried sentence of the line at `2300f84` (`git show 2300f84:openspec/roadmap.md`).

## D-10 Versions and release (AC-16)

devkit-core 0.8.1 to 0.9.0, devkit-openspec 0.18.1 to 0.19.0, devkit-compozy 0.2.0 to 0.3.0, the
marketplace 0.22.1 to 0.23.0, in each `plugin.json` and `.claude-plugin/marketplace.json`, and a
`## 0.23.0 — the stage roles` entry in `CHANGELOG.md`. The CI snippet of `docs/openspec-flow.md`
(`:554-562`) and its test pin move to `v0.19.0`. `python3 scripts/gen-catalog.py` regenerates
`docs/catalog.md` and the packs' catalog sections. The numbers meet the sibling changes at the
release rebase (`resolve-release-conflict`). The tag `v0.19.0` is pushed after the merge
(`CONTRIBUTING.md`).

## D-11 Tests

Every new test's name starts `stage-roles ` and an area word: `flow`, `roles`, `loop`, `gates`,
`guard`, `setup`, `kit`, `docs`. Hook tests go in the file of the module they test (all imported by
`guard.test.mjs`); kit tests in `role-shells.test.mjs` and `loop-template.test.mjs`. One test per
guard condition and per label, the negative ones included (merge-setup-field-fixes retro):

- `flow`: each `readFlowFile` breach (bad `appliesWhen`, two keys, unknown `notAfter`, earlier
  `notAfter`, `ceiling` 0 or `"x"`); rules (2) to (6) of D-2 each on and off; a file present wins
  over each condition; the flags line read, missing, and skipped grill; `readTestSettings` (nested,
  quoted, comments, target 0, 100, 101, `80%`, absent); the owner ceiling at attempts 1 and 3, no
  `ceiling-reached`, the readout line; `staleAfter` by `mockup.md` and by `decisions.md`; both
  shipped declarations carry no `shipped` and match D-1; the lite status lists no mock-up or
  decisions (live, through `schemaProject`); `planArtifactsOf` with and without `proposal.md`.
- `loop`: plan-part hand-offs of both new plan stages and their briefs; `waiting-mockup` with its
  detail; `owner-changes` brief; the two test stages handed whatever the row says, with their
  detail; `fix-tests` for each test stage, and not for evidence or review failures; the
  accept-decisions step present only with a current approval and a proposed or unreadable record;
  no accept-decisions step on the archive branch (`facts.archiving` true) even with a current
  approval and a proposed record, the next action being the archive steps' (a new test, added at
  attempt 4, not a T row);
  `accept-decisions` command: no approval, earlier approval, path outside, not `.md`, no ADR folder,
  no status line, status `superseded`, mixed proposed and accepted, letter case kept, prefix kept,
  nothing written on a refusal; `setting-unknown` for a bad target; the new message keys in both
  languages through the existing "no internal term" test; `gateOf` for `waiting-mockup`; the
  screen designer's stop refused once on `owner-changes`.
- `guard`: `adr-author` allowed in `docs/adr/`, `ADR/`, `decisions/`, refused for `src/a.ts`, for
  `docs/adr/x.png`, on both scripts; `e2e-tester` allowed for each folder name and each file form,
  refused for `src/export.ts`, refused before the approved readiness, unrestricted on `devkit-lite`;
  `test-runner` and `screen-designer` refused for a code path past the approval.
- `roles`: each new agent's frontmatter (name, model, tools, skills), its `Outcome:` line and its
  Never list; each new skill's description says when; `pr-verifier.md` names no screenshot and no
  `gh pr comment`; the `change-planner.md` sentence; the `docs/roles.md` lines of AC-15. The
  `ship-change` `verify` row is not pinned here: its edit is task 2.7, so its test is a `gates` test
  written in task 2.1.
- `gates`: the `stop-mockup-approval` row (owner's own message, `result=passed`, `result=failed`,
  the notes, the requirements section); the `stop-plan-approval` row names the records; the
  `verify` row allows no comment; the `devkit` skill names `waiting-mockup` and `accept-decisions`.
- `setup`: `openspec-setup` step 5 names the four keys and "keep every value"; the template's
  commented block.
- `kit`: each shell names its agent of D-8; the loop's design and review prompts; still four
  shells.
- `docs`: D-4 marks rows 3, 4, 9, 10, 11 built; the D-8 field names; ADR 0014's headings,
  status and `Accepted by:` line, the `Amended by` lines and Notes of ADR 0010 and ADR 0011, the
  `config.yaml` ADR line; the roadmap split of D-9.

**Existing tests this plan changes**, each with its invariant, owner and suite:

| Id | Test | Change | Invariant (layer, suite) |
|---|---|---|---|
| T-1 | `flow-check.test.mjs` constant `LITE_STAGES` (`:114`), read by "AC-8 a new devkit-lite change lists the short script" | also leaves out `mockup` and `decisions` | the short script's declared stages (schema, `flow-check.test.mjs`) |
| T-2 | "flow-check stages: a stage whose role is not shipped and has no file does not apply" (`:456`) | runs over a fixture declaration: the shipped one with `shipped: false` set on `mockup` and `decisions` and their conditions removed | an unshipped role's stage with no file does not apply (checker, `flow-check.test.mjs`) |
| T-3 | "flow-check stages: a pending file of an unshipped role waits for the owner" (`:705`) | the same fixture declaration, with `unit-tests` unshipped too | a pending file no shipped role can finish waits for the owner (checker, `flow-check.test.mjs`) |
| T-4 | "flow-check readout: both languages cover every reason code" (`:1146`) | the table `P` gains the five codes of D-2 | every reason code is said in both languages (readout, `flow-check.test.mjs`) |
| T-5 | `conduct-check.test.mjs` plan-files test (`:183`) | `missing('devkit')` is `['decisions.md', 'proposal.md', 'design.md', 'tasks.md']` | the plan files are the plan stages that always apply and that the change has not passed (conduct-check, `conduct-check.test.mjs`) |
| T-6 | `change-loop.test.mjs:2473` CI snippet pin | `v0.19.0` | the CI snippet pins the current release (docs, `change-loop.test.mjs`) |
| T-7 | `change-loop.test.mjs` fixtures `PLAN_FILES` (`:639`), `addChange` (`:858`), `worktreeChange` (`:1902`), every `planChange` call whose `have` holds `requirements` and no `proposal`, and the explicit `addChange(wt, 'wt-change', ['requirements'], ...)` (`:984`) of "change-loop start: S6 a change that lives only in a worktree resumes there" | `PLAN_FILES` gains `decisions: 'decisions.md'`; those defaults and calls, the S6 list included, add `decisions` | a fixture change opened at the grill stands right before its proposal, so the planner is its next role (loop, `change-loop.test.mjs`) |
| T-8 | "flow-check readout: the sample change prints the approved text" (`:1128`), its constants `SAMPLE_PT` (`:1043`) and `SAMPLE_EN` (`:1067`) | in both constants, the mock-up and decisions lines (3 and 4) read "does not apply: " and the `past-point` text of D-2 naming the proposal, and the unit-tests and E2E lines (12 and 13) the same text naming the demonstration, each in its language, in place of the `role-not-shipped` text; every other line unchanged | the sample change prints the approved readout in both languages, and a stage the change was already past when it arrived says so and is never offered (readout, AC-13, `flow-check.test.mjs`) |
| T-9 | `roadmap-loop.test.mjs` fixture `lkProject`: its default `have = ['requirements']` (`:1247`) and `LK_PLAN` (`:1239`), read by "roadmap-loop lock stop: RS3 one change in flight and another ready is refused once, naming the change, the stage and the command" (`:1336`), "roadmap-loop lock subagent-stop: RU1 two planners of two changes are judged each by its own change, from the prompt" (`:1564`), "roadmap-loop lock subagent-stop: RU1 with no readable prompt the one in-flight entry of that agent type gives the change" (`:1579`), "roadmap-loop lock subagent-stop: RU6 a refused stop keeps the entry" (`:1637`), "roadmap-loop lock: the three modes reach the roadmap decisions in a roadmap run, and a change run keeps the change decisions" (`:1726`) and "roadmap-loop lock: no trap, not opted in, DEVKIT_BYPASS, an unreadable transcript or run file let everything through" (`:1753`) | `LK_PLAN` gains `decisions: 'decisions.md'`; the default `have` is `['requirements', 'decisions']` | a fixture change opened at the grill stands right before its proposal, so the planner is its next role, as T-7 (roadmap lock, `roadmap-loop.test.mjs`) |
| T-10 | "roadmap-loop replies: every owner wait has a gate" (`roadmap-loop.test.mjs:575`), its map `expected` | `expected` gains `'waiting-mockup': 'mockup'` (the new message key of D-4 and its `GATE_OF_WHY` entry); every other entry and assertion unchanged | every `waiting-` key of the loop's message table, but the GitHub wait, is an owner gate with a gate phrase in both languages, and the map names every such key (roadmap replies, `roadmap-loop.test.mjs`) |
| T-11 | "field-fixes 8 grill: the review prompt names the requirements and its open questions, and the approval node shows the plan's open questions" (`plugins/compozy/skills/compozy-setup/scripts/install-kit.test.mjs:179`), its first `assert.match` (`:182`) | the pinned list becomes `(requirements and its open questions, proposal, tasks, and design, decisions and readiness on the devkit schema)`, the exact text D-8 gives the `implement` node's review prompt; the `doesNotMatch` and the open-questions assertion unchanged | the plan approval's prompt names every plan file the operator reads before approving, the files of the `devkit` script marked as such (kit loop template, `install-kit.test.mjs`) |

Every other existing test runs unchanged. A test that fails outside this table is a defect of the
implementation, or a missing row here: the implementer stops and reports it, and the planner adds
the row before the test is changed.

Sweep at attempt 3: the whole suite (`guard.test.mjs`, 1248 tests) ran on the tree phases 1 and 2
left, and its one failure was T-10; the five kit test files ran green (71 tests, one skipped without
a daemon). The existing tests that phases 3 and 4 touch were read for an assertion on a closed list
(of messages, keys, steps, stages, agents, files or nodes) that this plan extends: T-11 is the one
found. The others hold an open list or a list this plan does not extend: the kit's four shells,
eight kit files, seventeen nodes, eighteen edges and two review blocks (D-8 adds none of them), the
six reviewers of the bench, and the ADR, roadmap and version pins, which T-6 and D-9 already follow.

## D-12 ADR 0014, proposed with this plan

This plan changes two sentences of accepted decisions, so it proposes a record instead of a Note
(`openspec/config.yaml` rules; ADR 0011's rejected alternative "Keep ADR 0010's sentence and record
the hook in a Note only": a weaker guarantee needs its own record). ADR 0010 decision 3 says "a stage
that does not apply leaves its file saying so", and AC-3 and AC-10 write no file; ADR 0010 decision
8 and ADR 0011 decision 3 say product code is written only by the implementer, and the guard calls
every path outside `openspec/` and `.claude/` product code, so an ADR file by `adr-author`, an E2E
test by `e2e-tester` and the `accept-decisions` step would each break the sentence as the hooks read
it. The owner accepts or refuses it with the plan; refused, the plan goes back to planning before
any code. Task 4.3 writes the file with `Status: accepted` and the `Accepted by:` line quoting
`approval.md`'s owner's words; `adr-reviewer` checks it at the readiness review.

```markdown
# ADR 0014: Stage roles write their own files, and a stage that does not apply may leave none

- Status: accepted
- Date: 2026-11-21
- Change: stage-roles
- Amends: ADR 0010 (0010-openspec-as-the-harness.md), decision 3's sentence on a stage that does not apply and decision 8's sentence on product code; ADR 0011 (0011-the-change-coordinator-is-the-owners-session.md), decision 3
- Accepted by: the owner, on <the Date of approval.md>, in the message that approved the plan of the change: `<the Owner's words of approval.md>`; recorded in `openspec/changes/stage-roles/approval.md`

## Context

Round 16 ships the roles of four stages that the scripts declared and nobody ran: the screen
designer (the mock-up), the ADR author (decisions and ADRs), the test runner (the unit suite) and the
E2E tester. Two facts of the accepted records stop them as written.

ADR 0010 decision 3 says every stage leaves a file and "a stage that does not apply leaves its file
saying so". The owner decided that a change touching no screen gets no mock-up file, that a project
with no E2E command gets no E2E file and no agent, and that a change opened before this version never
gains a file for a stage it has passed. The checker already reports a stage whose role is not shipped
as not applying without a file, and says why in the stage's line.

ADR 0010 decision 8 and ADR 0011 decision 3 say product code is written only by the implementer
role under the same hooks. The hooks call every path outside `openspec/` and `.claude/` product
code. The owner decided that the ADR author drafts each record in the project's ADR folder before the
plan is approved, that the E2E tester writes E2E tests apart from the implementer, and that the
owner's plan approval accepts the records together with the plan.

## Decision

1. A stage may declare when it applies: a flag of the grill's classification, a setting of the
   project's `devkit:` block, or a later stage that the change has not reached yet. A stage whose
   condition does not hold, or that the change had already passed, leaves no file; the checker
   reports it as not applying, with the reason in its line. Every other stage leaves its file, as
   ADR 0010 decision 3 says.
2. Two kinds of file outside the change folder are not product code when their role writes them
   under the hooks: a decision record (a Markdown file in a folder named `adr`, `adrs` or
   `decisions`), which the ADR author drafts before the plan is approved; and a test file, which the
   E2E tester writes only after the full script's readiness is approved. Every other path outside
   `openspec/` and `.claude/` stays product code, written only by the implementer role on the full
   script once the plan is approved.
3. A record the ADR author proposes is accepted by the owner's plan approval. In the Claude driver,
   once that approval is recorded, the loop hands the session one step that runs a script: it sets
   every record `decisions.md` lists from proposed to accepted with the approval's date, refuses
   while the approval is not current, and writes nothing else; the session's own product edits stay
   refused in a run (ADR 0011 decision 2). In the CompozyOS kit the implementer sets them before its
   first phase, after the operator's approval.
4. ADR 0010's other decisions, and ADR 0011's decisions 1 and 2, are unchanged.

## Consequences

- Positive: the four stage roles run under the same hooks; a change that does not need a stage
  carries no file for it; a change under way is never sent back; the records the plan depends on are
  accepted in the same message as the plan, and the date is set by a script, not by hand.
- Negative: the E2E tester's write rule reads the path, so a product file named like a test passes it
  (Mitigated: the tester's own instructions, and the review bench reads the diff). A stage with no
  file is visible only in the readout, not in the change folder (Accepted: the readout and
  `/devkit status` say why). The accepting script writes from the session's shell, which the edit
  lock does not see (Accepted: it writes only listed records, only after a current approval).

### Review trigger

A product file reaches a pull request through the E2E tester's or the ADR author's write rule; an
owner asks for a stage's skip to be kept as a file; the accepting script is found writing anything
but a listed record's status.

## Alternatives considered

| Option | Pros | Cons | Cost to undo |
|---|---|---|---|
| A Note on ADR 0010 only | No new record | Two decision sentences would change with no record; ADR 0011 rejected that form for a weaker guarantee | low |
| A `not-applicable` file for every skipped stage | Decision 3 kept as written | The owner decided no file for the mock-up and E2E; a change under way would gain files | low |
| The implementer writes the E2E tests and the ADRs | No new writer | The owner wants E2E tests apart from the implementer, and records before the plan is approved | medium |
| A project setting naming the E2E test folder | An exact rule | One more setting before any project needs it; left to the project setup round | low |
| The session edits the records' status by hand | No script | The session writes no product code in a run, and a hand edit can skip a record | low |
```

## Proof map

| AC | Proved here by | Stated limit | Proved next |
|---|---|---|---|
| AC-1 | `stage-roles docs` roadmap split test | - | the next change runs `coordinator-loop-fixes` |
| AC-2 | `stage-roles flow` rule (3) on; `stage-roles loop` mock-up hand-off; `stage-roles roles` agent and skill pins | the drawing itself is the agent's | the first `ui` change after the release |
| AC-3 | `stage-roles flow` rule (3) off; `stage-roles loop` no hand-off | - | - |
| AC-4 | `stage-roles loop` `waiting-mockup`, `owner-changes`; `stage-roles flow` owner ceiling; `stage-roles gates` the row | the session's showing (and an Artifact) is prose | the first `ui` change |
| AC-5 | `stage-roles loop` decisions hand-off; `stage-roles roles` agent, skill and template pins | the analysis is the agent's | the next `devkit` change |
| AC-6 | `stage-roles loop` accept step and command tests | - | - |
| AC-7 | `stage-roles flow` `staleAfter` tests | - | - |
| AC-8 | `stage-roles flow` `readTestSettings`; `stage-roles loop` bad target; `stage-roles setup` | the setup's questions are prose | a project upgraded to 0.19.0 |
| AC-9 | `stage-roles flow` rule (4); `stage-roles loop` hand-off and `fix-tests`; `stage-roles roles` agent pins; `stage-roles guard` test-runner refused | the run is the agent's | a project that declares `tests.unit` |
| AC-10 | `stage-roles flow` rule (4) for E2E; `stage-roles loop`; `stage-roles guard` e2e-tester | the tests are the agent's | a project with E2E |
| AC-11 | `stage-roles roles` pr-verifier pins; `stage-roles gates` the `verify` row; the existing `deliver-check` evidence tests unchanged | - | this change's own `evidence.md` |
| AC-12 | `stage-roles flow` declarations; T-1 | - | - |
| AC-13 | `stage-roles flow` rule (2) for both pairs; `planArtifactsOf` with `proposal.md` | - | the changes open at the upgrade |
| AC-14 | `stage-roles kit` tests; `adoption.test.mjs` on the re-installed `.compozy/` | the kit's loop is not run live | round 21 |
| AC-15 | `stage-roles roles` (the `docs/roles.md` lines); `stage-roles docs` (D-4 rows built); the PACKS test | - | - |
| AC-16 | the final gate | - | - |

## Risks / Trade-offs

| Risk | P | I | Mitigation |
|---|---|---|---|
| E2E test files the tester writes are a product commit, so after their commit the unit and E2E stages are stale and run once more | HIGH | LOW | Bounded: the rerun finds the tests present; the `e2e-testing` skill writes tests only for criteria without one; documented in `docs/openspec-flow.md` |
| The test-file rule lets the E2E tester write a product file named like a test, or refuses a project's E2E folder with another name | MEDIUM | MEDIUM | The rule covers the common layouts (D-6); the review bench reads the diff; a refused write names the rule, and a project can rename the folder; a setting for the folder is left to round 26 (project setup) |
| A session that edits `mockup.md`'s header itself, or a screen designer that sets `passed`, skips the owner | LOW | MEDIUM | The row says only from the owner's message; the agent's Never; no new lock (requirements); the readiness reviewer sees the file |
| `accept-decisions` rewrites a status line in a form the project does not use | LOW | MEDIUM | The `adr-authoring` skill writes a `Status:` line; any other form is refused with the file named, changing nothing |
| A project with many changes under way sees new stages appear | LOW | HIGH | `notAfter` (D-1, D-2) and its tests; the upgrade listing is unchanged because nothing goes back |
| The `ui` flag is missing when the grill was skipped, so a screen change gets no mock-up | MEDIUM | LOW | The readout says the classification has no `ui` flag; the owner can add it to the line and call again |
| The whole suite grows past its 13 minutes | MEDIUM | LOW | New tests are pure where possible (`computeFlow`, `decide`, predicates); only the lite status test uses the CLI, reusing `schemaProject` |
| The sibling changes bump the same versions | HIGH | LOW | The release rebase (`resolve-release-conflict`) |

## Migration Plan

Projects install devkit-openspec 0.19.0 (and devkit-core 0.9.0 for the agents). A change opened
after that runs the decisions on `devkit`, the mock-up on `ui`, and the test stages once the project
declares their commands; a change under way keeps its place (AC-13). A project's own
`openspec/schemas/` copy is replaced by `openspec-setup`, whose listing is unchanged. Rollback:
revert the merge commit; projects reinstall 0.18.1, where the four stages read as not shipped again,
and the files the new roles wrote stay as plain files the old checker reads by their headers.

## Implementation plan

Dependency order: the declarations, the checker and the four roles together (phase 1: once a stage
drops `"shipped": false`, the skills test of `change-loop.test.mjs` wants its agent file and the
PACKS test wants `docs/roles.md` and `PACKS` to agree, so none of them can be green alone), then the
loop's new behaviour, the owner gates, the guard and the setup (phase 2), then the kit (phase 3),
then the documents, the roadmap, the release and the whole suite (phase 4).

**Per surface.**

- devkit-openspec: schemas (both copies), `hooks/flow-check.mjs`, `hooks/conduct-check.mjs`,
  `hooks/change-loop.mjs`, `hooks/roadmap-loop.mjs`, `hooks/guard.mjs`, their tests;
  `skills/devkit/SKILL.md`, `skills/ship-change/SKILL.md`, `skills/openspec-setup/SKILL.md`,
  `skills/openspec-setup/templates/config.yaml`; `README.md`; `.claude-plugin/plugin.json`.
- devkit-core: four agents and three skills (new); `agents/pr-verifier.md`,
  `agents/change-planner.md`, `agents/code-quality-reviewer.md`; `README.md`; `plugin.json`.
- devkit-compozy: four shells and the loop template, `role-shells.test.mjs`,
  `loop-template.test.mjs`, `README.md`, `plugin.json`.
- Repository: `openspec/schemas/`, `.compozy/`, `docs/roles.md`, `docs/coordination-design.md`,
  `docs/openspec-flow.md`, `docs/compozy-kit.md`, `docs/adr/0010-openspec-as-the-harness.md`,
  `docs/adr/0011-the-change-coordinator-is-the-owners-session.md`, `openspec/config.yaml`,
  `openspec/roadmap.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`, `docs/catalog.md`.

**Files to create**: `plugins/core/agents/screen-designer.md`, `plugins/core/agents/adr-author.md`,
`plugins/core/agents/test-runner.md`, `plugins/core/agents/e2e-tester.md`,
`plugins/core/skills/screen-mockup/SKILL.md`, `plugins/core/skills/adr-authoring/SKILL.md`,
`plugins/core/skills/e2e-testing/SKILL.md`, `docs/adr/0014-stage-roles-write-their-own-files.md`.
**Files to delete**:
`plugins/openspec/schemas/devkit-lite/templates/mockup.md`,
`plugins/openspec/schemas/devkit-lite/templates/decisions.md` and their copies under
`openspec/schemas/devkit-lite/templates/`.

**Estimate**: optimistic 28 h, likely 38 h, pessimistic 54 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Declarations, schemas and templates in both copies (phase 1) | 3 | Core | LOW |
| `flow-check` facts, rules, owner ceiling, reason codes, `readTestSettings`; `planArtifactsOf`; `AGENT` and `PACKS`; their tests and T-1 to T-5, T-7 to T-9 (phase 1) | 9 | Core | MEDIUM |
| Four agents, three skills, `pr-verifier`, planner and reviewer sentences, `docs/roles.md`, `docs/openspec-flow.md`, their pins (phase 1) | 7 | Core | MEDIUM |
| `change-loop` plan and build parts, `accept-decisions`, messages, settings validation; `roadmap-loop` gate; their tests and T-10 (phase 2) | 8 | Core | MEDIUM |
| Guard predicates and placement, their tests (phase 2) | 2 | Core | MEDIUM |
| `ship-change`, `devkit`, `openspec-setup` text and the template, their pins (phase 2) | 2 | Integration | LOW |
| Kit shells and loop prompts, tests and T-11, re-install, kit docs (phase 3) | 3 | Integration | LOW |
| Design page, ADR 0014 and the two Notes, roadmap split, READMEs, docs tests (phase 4) | 2 | Documentation | LOW |
| Versions, CHANGELOG, pin, catalog, whole suite, validation (phase 4) | 2 | Documentation | LOW |

**Assumptions** (where the plan breaks if wrong): the exports and line numbers named in Context exist
at `2300f84` (read in the source); OpenSpec 2.x accepts a schema whose artifacts drop two ids and a
change whose status lists fewer artifacts (it did when `flow-script-checker` changed both schemas);
the grill keeps writing its `Classification:` line (`plugins/core/skills/requirements-grill/SKILL.md:73`);
Claude Code passes `agent_type` for a devkit-core subagent so the guard can tell the new roles apart
(`docs/coordination-design.md` D-8, "What the hooks can do"); the whole suite runs about 13 minutes
(`CLAUDE.md`, Commands).

**Dependencies**: round 14 (`flow-script-checker`), round 15 (`change-coordinator`) and round 18
(`roadmap-coordinator`), archived at `2300f84`; ADR 0010, ADR 0011, ADR 0013; the `openspec` CLI 2.x.

## Decisions cited

ADR 0010 decisions 1 (a configuration block filled by the rounds; the test commands in round 16),
3 (headers, the checker, ceilings in configuration, a stage that does not apply), 5 (the existing
locks stay, hooks veto), 6 (the owner's plan approval) and 8 (product code only by the implementer;
no side door), both amended by the proposed ADR 0014 (D-12); ADR 0011 (the session writes no product code in a run;
the approval only from the owner's message; locks fail open); ADR 0013 (owner gates of a roadmap
run asked one change at a time); ADR 0004 (the guard acts only in opted-in projects); ADR 0009 (the
CompozyOS kit as it stands until round 21); ADR 0012 (the `devkit-reviews` check, unchanged).
