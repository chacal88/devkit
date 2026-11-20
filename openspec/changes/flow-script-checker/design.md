# Design

Change: `flow-script-checker` · Date: 2026-11-19 · Owner: Kaue (chacal88) · PRD / tech spec: n/a
(design sources: `requirements.md`, [ADR 0010](../../../docs/adr/0010-openspec-as-the-harness.md),
[docs/coordination-design.md](../../../docs/coordination-design.md))

## Context

See `proposal.md` (Why). The design sources fix the stages (section 4), the three facts of the
header (section 8), the checker's job and its four end states (ADR 0010 decision 3). They leave
open the header's format and field names, where the checker lives, how the checker learns a
stage's role and ceiling, and how today's readers live with the header; the planner's list of what
they did not answer is appended to `requirements.md`. This design settles each of them against the
repository at `92bec9f`.

This change is itself a change of the previous script: its files carry no stage header, and it is
the real folder on which AC-7 is proved (D-12). Its own artifacts must stay header-free.

## D-1 What OpenSpec 2.0.0 does, tested (point 1)

Tested on 2026-11-19 with the installed CLI (`openspec --version` prints `2.0.0`) in a throwaway
project outside the repository (`git init`, `openspec init --tools none --no-animation .`), with a
schema `exp` that declares all fourteen file stages and two extra keys (`role`, `skills`) on an
artifact, plus a top-level `flow:` key and an extra file `flow.json` in the schema folder.

| # | Command | Observed |
|---|---|---|
| T1 | `openspec schema validate exp` | `✓ Schema 'exp' is valid`, exit 0, after the note `Schema commands are experimental and may change.` Extra artifact keys, an unknown top-level key and an extra file in the folder all pass |
| T2 | `openspec status --change demo --json` | Keys: `changeName`, `schemaName`, `planningHome`, `changeRoot`, `artifactPaths`, `isPlanningComplete`, `isComplete`, `applyRequires`, `nextSteps`, `actionContext`, `artifacts`, `root`. Each artifact: `{ id, outputPath, status: ready \| blocked \| done \| skipped, requires, missingDeps? }`. `role`/`skills` are absent (dropped) |
| T3 | Same, after the stages were declared out of dependency order (`zeta` requires `alpha`, declared before it, then `mid`) | `["alpha", "zeta", "mid"]`: a dependency walk from the declaration order. Declaring each stage after the stages it requires keeps the declaration order |
| T4 | Same, with only `proposal.md` and `retro.md` written | `proposal done`, `retro done`, every stage between them `ready` or `blocked`: a file that exists is `done` whatever its dependencies |
| T5 | Same, with every file up to `approval.md` written | `isPlanningComplete: false` (every artifact counts as planning), `nextSteps: ["Run openspec instructions unit-tests ..."]`: OpenSpec offers the first stage after implementation before any task is done |
| T6 | `openspec instructions requirements --change demo --json` | Keys: `changeName`, `artifactId`, `schemaName`, `changeDir`, `planningHome`, `outputPath`, `resolvedOutputPath`, `existingOutputPaths`, `description`, `instruction`, `template`, `dependencies`, `unlocks`, `root`. `template` is the file's text, header line included. Returned for a `blocked` artifact too (`decisions` with `mockup` missing) |
| T7 | `openspec instructions apply --change demo --json`, `tasks.md` holding `- [x] 1.1`, `- [ ] 1.2` and, inside a fenced block, `- [ ] 9.9` and `- [x] 9.8` | `state: blocked`, `missingArtifacts: ["approval"]`, `progress: { total: 4, complete: 2, remaining: 2 }`, `tasks: [{ id, description, done, sourcePath, line }]` with lines 10, 11, 15, 16: **the fenced lines are counted as tasks**. The list is returned while `apply` is blocked |
| T8 | `openspec validate demo --strict` with key lines (`Stage: specs`, ...) above `# Spec Delta` | `⚠ [WARNING] ... Text above the first "## " section is not carried into the main spec by archive`, exit 1. YAML front matter: the same warning. One HTML comment line (`<!-- devkit-stage specs result=passed attempt=1 commit=1a2b3c4 -->`) above `# Spec Delta`, or a multi-line comment: `Change 'demo' is valid`. Key lines or the comment line on top of `proposal.md`, `design.md`, `tasks.md`: valid |
| T9 | `openspec archive demo --yes` with `readiness`, `approval`, `unit-tests`, `e2e-tests`, `evidence`, `review`, `retro` missing, extra files (`extra-stage.md`, `mock/s.html`, `reviews/a.md`) and the fenced open checkbox | `Task status: 3/4 tasks`, `Warning: 1 incomplete task(s) found. Continuing due to --yes flag.`, specs applied, `Change 'demo' archived as '2026-11-19-demo'`, exit 0; every extra file moved with the folder; the main spec written from the delta has no header comment |
| T10 | `openspec status` on a change whose `.openspec.yaml` has `skip_specs: true` | `specs` is `skipped` |
| T11 | Time of `openspec status --change d5 --json` and `openspec instructions apply --change d5 --json` | about 0.6 s each |
| T12 | `npm view @fission-ai/openspec version` | `2.1.1`: the CI's `npm i -g @fission-ai/openspec@latest` (`.github/workflows/ci.yml:25`) installs a version nobody tested |

What the plan depends on, and only that: the `artifacts` list of `status --json` (ids, order,
`outputPath`, `status` including `skipped`), the `tasks[].done` and `tasks[].line` of
`instructions apply --json`, `schema validate`, `validate --strict` accepting the HTML comment line
on top of every artifact (T8), and `archive` tolerating stages without files (T9). The `schema`
commands are experimental (T1); the checker does not call them, but CI and `openspec-setup` do.

**The pin.** (a) `.github/workflows/ci.yml` installs `@fission-ai/openspec@2.0.0` in a step before
"Hook tests" (the new tests call the CLI) and uses that install for the schema step; (b)
`flow-check` runs `openspec --version` and exits 3 with `flow-check is tested with OpenSpec 2.x;
found <v>` for any other major; (c) `docs/openspec-flow.md` states the tested version. A project
pins its own CLI version in round 26 (project setup); this round records the tested version only.

## D-2 The stages of each script (points 2, AC-1, AC-8)

Every stage of section 4 that leaves a file is an OpenSpec artifact; the stages with no file of
their own exist only in `flow.json` (D-5), with a `source` that says where their state comes from.
Stage 0 (the roadmap coordinator's choice) is not part of a change; stage 14 (the second pull
request) belongs to round 17 and is not declared.

**`devkit`** (`apply.requires: [approval]`):

| # | Stage id | File | `requires` | Source | Role | Skills (helpers) |
|---|---|---|---|---|---|---|
| 1 | `open` | none | - | `folder` (`.openspec.yaml` exists) | `change-coordinator` | - |
| 2 | `requirements` | `requirements.md` | `[]` | artifact | `change-coordinator` with the owner | `requirements-grill` (`codebase-researcher`) |
| 3 | `mockup` | `mockup.md` | `[requirements]` | artifact, role not shipped | `screen-designer` | `screen-mockup`, `screen-design` |
| 4 | `decisions` | `decisions.md` | `[requirements]` | artifact, role not shipped | `adr-author` | `adr-authoring` |
| 5 | `proposal` | `proposal.md` | `[requirements]` | artifact | `change-planner` | (`openspec-validator`) |
| 6 | `specs` | `specs/**/*.md` | `[proposal]` | artifact | `change-planner` | (`openspec-validator`) |
| 7 | `design` | `design.md` | `[proposal]` | artifact | `change-planner` | (`openspec-validator`) |
| 8 | `tasks` | `tasks.md` | `[specs, design]` | artifact | `change-planner` | (`openspec-validator`) |
| 9 | `readiness` | `readiness.md` | `[tasks]` | artifact | `plan-readiness-reviewer` | `plan-readiness-review` (`plan-reality-auditor`, `adr-reviewer`) |
| 10 | `approval` | `approval.md` | `[readiness]` | artifact | `owner` | - |
| 11 | `implementation` | none | - | `tasks` (OpenSpec's task list) | `tdd-implementer` | `test-driven-development`, `systematic-debugging` |
| 12 | `unit-tests` | `unit-tests.md` | `[approval]` | artifact, role not shipped | `test-runner` | `test-and-coverage`, `systematic-debugging` |
| 13 | `e2e-tests` | `e2e-tests.md` | `[approval]` | artifact, role not shipped | `e2e-tester` | `e2e-testing` |
| 14 | `evidence` | `evidence.md` | `[approval]` | artifact | `pr-verifier` | - |
| 15 | `review` | `review.md` | `[evidence]` | artifact | `review-bench` | `review-change` (the six reviewers, `finding-verifier`) |
| 16 | `delivery` | none | - | `github` | `commit-and-pr` | `commit-message-guidelines` |
| 17 | `retro` | `retro.md` | `[review]` | artifact | `change-coordinator` with the owner | `retro` |

`mockup` and `decisions` require only `requirements`, and the stages after implementation require
only `approval` (the review, `evidence`), so a missing round-16 file never shows a later stage as
`blocked` in `openspec status`; the order between them is the checker's (T3, T4). `proposal` does
not require `mockup` or `decisions` for the same reason. `apply` requires `approval` because stage 7
comes before stage 8; today's flow never calls `openspec instructions apply` (`ship-change` and
`/conduct` follow `deliver-check` and `conduct-check`), so this changes no step they give.

Opening the change, the implementation and the delivery have no file: `open` is passed when the
change folder holds `.openspec.yaml`; `implementation` from the task list (D-6); `delivery` from the
pull request (D-6). The owner's approval has its file, `approval.md`, written today by the main
session from the owner's message (`ship-change` row `stop-plan-approval`), so it is an artifact.

**`devkit-lite`** (`apply.requires: [tasks]`, as today): the same ids without `design`, `readiness`
and `approval`: `open`, `requirements` `[]`, `mockup` `[requirements]`, `decisions`
`[requirements]`, `proposal` `[requirements]`, `specs` `[proposal]`, `tasks` `[proposal]`,
`implementation`, `unit-tests` `[tasks]`, `e2e-tests` `[tasks]`, `evidence` `[tasks]`, `review`
`[evidence]`, `delivery`, `retro` `[review]`. `specs` stays optional through `skip_specs: true`
(T10: `skipped`, which the checker reports as not applicable). The go-ahead stays the owner's
message to ship (`ship-change`, Go-ahead), with no file, as the owner asked (question 4).

## D-3 The stage header (point 3, AC-3, AC-6)

**Form (decided here; the field names were open in section 8).** Line 1 of every stage file, exactly:

```text
<!-- devkit-stage <stage> result=<result> attempt=<n> commit=<sha> -->
```

- `<stage>`: the stage id of D-2. `<result>`: `passed`, `failed`, `not-applicable`, or `pending`
  (the template's value: written, not judged yet). The three decided facts are `result`, `attempt`
  and `commit`; `pending` is not a fourth result, it is the absence of one.
- `<n>`: 1 on the first write; on a rewrite, one more than the attempt of the header it replaces.
- `<sha>`: `git rev-parse HEAD` (7 to 40 hex) when the stage was produced, or `none` in a template.
- Grammar (one regular expression in `flow-check.mjs`, exported as `STAGE_HEADER`):
  `^<!-- devkit-stage ([a-z0-9][a-z0-9-]*) result=(passed|failed|not-applicable|pending) attempt=([1-9][0-9]{0,2}) commit=([0-9a-f]{7,40}|none) -->\r?$`.
  A first line that starts with `<!-- devkit-stage` and does not match is a malformed header; any
  other first line is no header.

Why a comment line: T8 shows that OpenSpec's strict validation refuses any visible text above a
spec delta's first `##`, key lines and front matter included; a comment passes and is not carried
into the main spec by archive (T9). It also renders invisibly on GitHub.

**Every reader of today's flow, against that line.**

| Reader | What it reads | With the header on line 1 |
|---|---|---|
| `guard.mjs` `readValue` (`plugins/openspec/hooks/guard.mjs:165-173`): readiness gate, `approval.md` | the first line matching `^\s*[-*]?\s*\**Status\**\s*:` (case-insensitive, anywhere in the file) | the comment line starts with `<!--`, never matches; the field is `result`, never `Status` |
| `deliver-check.mjs` `parseCommitLine` (`:175-187`) | the first `Commit: <sha>` line before the first heading | the comment line does not match; `evidence.md` keeps `Commit:` on line 2, still before the first heading |
| `deliver-check.mjs` `approvalState` (`:950-958`) | `Status`, `Readiness` lines; the sha256 of `readiness.md` | lines unchanged; the hash changes only when `readiness.md` is rewritten, as today |
| `deliver-check.mjs` `parseTasks`, `readPhases` (`:270-298`) | checkbox lines, `## N.` headings | the comment is neither |
| `deliver-check.mjs` `readReviewMd` (`:1081-1087`) | the last `Consensus:` line of `review.md` | unaffected |
| `deliver-check.mjs` `readRetro` (`:699-731`), `acceptanceItem` (`:380`) | lines under `## Proposed updates`, `## Acceptance criteria` | unaffected |
| `review-round.mjs check-file` (`plugins/core/skills/review-change/scripts/review-round.mjs:124-140`) | line 1 `Verdict:`, line 2 `Commit:` of `reviews/<reviewer>.md` | the reviewers' files get no header (below): unaffected |
| `conduct-check.mjs` `planFacts` (`:192-250`) | readiness `Status`, mtimes, `audit.md` `Base`/`Verdict` | unaffected; its list of plan files changes (D-10) |
| OpenSpec `validate --strict`, `archive` | the artifacts | T8, T9 |

So no reader of today's flow changes for the header. Pinned by `flow-check AC-6` tests in
`plugins/openspec/hooks/flow-check.test.mjs` (D-10).

**Which file is a stage's file.** The file the artifact `generates`. For `specs`, every file the
glob matches carries the header and the stage takes the worst of them (failed, then pending, then
passed; all not-applicable is not applicable). For `review`, the stage file is `review.md`, the
summary the session appends after each round; the reviewers' own `reviews/<reviewer>.md` keep
`Verdict:` on line 1 and `Commit:` on line 2 and get no header, so the six reviewers and the review
round's tooling do not change.

**Who writes it** (D-10 lists the edits): the templates carry it for every file written from
`openspec instructions` (requirements, the plan files, the round-16 stages); `ship-change` writes it
in `approval.md`, at the top of `review.md` after each round, and in `retro.md`; the
`plan-readiness-reviewer` and `pr-verifier` agents write it in their single-writer files, which no
other role may touch (`guard.mjs:197-215`).

## D-4 Stages whose role is not shipped yet (point 4, A-2)

`mockup`, `decisions`, `unit-tests` and `e2e-tests` carry `"shipped": false` in `flow.json`. For such
a stage:

- no file: the checker reports `not-applicable` with reason code `role-not-shipped` ("nobody runs
  this stage yet: no `<role>` role in this version"). Nobody writes a result, and the readout says
  so in words; it counts as passed for what follows (AC-4), because no role can run it;
- a file exists (a person drew a mock and wrote `mockup.md` by hand, with its header): its header is
  read like any other.

Round 16 flips `shipped` to `true` when it ships each role; from then on a missing file is pending
and the stage's role writes it, with `result=not-applicable` and a line saying why when the change
has no screen, needs no ADR or has no E2E (section 8: "still leaves its file, saying so and why").
The instructions of these stages say the same, without naming a round (pack assets name no
project-specific doc or round, `docs/conventions.md`, Content).

## D-5 The stage declaration: `flow.json` (point 5)

OpenSpec drops extra artifact keys from its output (T2) and a hand-parsed `schema.yaml` would be
prose-adjacent YAML; Node reads JSON natively. Each schema folder gets `flow.json`, installed with
the folder by `install-schemas.sh` (`cp -R`, `install-schemas.sh:40-47`). It is the script's
declaration of every stage; `schema.yaml` stays what OpenSpec reads.

`plugins/openspec/schemas/devkit/flow.json`, in full:

```json
{
  "version": 1,
  "script": "devkit",
  "ceilings": { "default": 3 },
  "stages": [
    { "id": "open", "source": "folder", "role": "change-coordinator", "skills": [], "part": "open",
      "title": { "en": "Open the change", "pt-BR": "Abrir a change" } },
    { "id": "requirements", "source": "artifact", "file": "requirements.md", "role": "change-coordinator", "owner": true,
      "skills": ["requirements-grill"], "helpers": ["codebase-researcher"], "part": "plan",
      "title": { "en": "Requirements (grill)", "pt-BR": "Requisitos (grill)" } },
    { "id": "mockup", "source": "artifact", "file": "mockup.md", "role": "screen-designer", "shipped": false, "owner": true,
      "skills": ["screen-mockup", "screen-design"], "part": "plan",
      "title": { "en": "Screen mock-up", "pt-BR": "Mock-up de tela" } },
    { "id": "decisions", "source": "artifact", "file": "decisions.md", "role": "adr-author", "shipped": false,
      "skills": ["adr-authoring"], "part": "plan",
      "title": { "en": "Decisions and ADRs", "pt-BR": "Decisões e ADRs" } },
    { "id": "proposal", "source": "artifact", "file": "proposal.md", "role": "change-planner", "skills": [],
      "helpers": ["openspec-validator"], "part": "plan", "title": { "en": "Proposal", "pt-BR": "Proposta" } },
    { "id": "specs", "source": "artifact", "file": "specs/**/*.md", "role": "change-planner", "skills": [],
      "helpers": ["openspec-validator"], "part": "plan", "title": { "en": "Specs", "pt-BR": "Specs" } },
    { "id": "design", "source": "artifact", "file": "design.md", "role": "change-planner", "skills": [],
      "helpers": ["openspec-validator"], "part": "plan", "title": { "en": "Design", "pt-BR": "Design" } },
    { "id": "tasks", "source": "artifact", "file": "tasks.md", "role": "change-planner", "skills": [],
      "helpers": ["openspec-validator"], "part": "plan", "title": { "en": "Tasks", "pt-BR": "Tarefas" } },
    { "id": "readiness", "source": "artifact", "file": "readiness.md", "role": "plan-readiness-reviewer",
      "skills": ["plan-readiness-review"], "helpers": ["plan-reality-auditor", "adr-reviewer"], "part": "plan",
      "ceiling": 3, "onFail": "proposal", "staleAfter": ["proposal", "specs", "design", "tasks"],
      "title": { "en": "Plan readiness", "pt-BR": "Revisão do plano" } },
    { "id": "approval", "source": "artifact", "file": "approval.md", "role": "owner", "owner": true, "skills": [],
      "part": "plan", "staleAfter": ["readiness"],
      "title": { "en": "Owner's approval", "pt-BR": "Aprovação do dono" } },
    { "id": "implementation", "source": "tasks", "role": "tdd-implementer",
      "skills": ["test-driven-development", "systematic-debugging"], "part": "build",
      "title": { "en": "Implementation", "pt-BR": "Implementação" } },
    { "id": "unit-tests", "source": "artifact", "file": "unit-tests.md", "role": "test-runner", "shipped": false,
      "skills": ["test-and-coverage", "systematic-debugging"], "part": "after", "codeBound": true, "onFail": "implementation",
      "title": { "en": "Unit tests", "pt-BR": "Testes unitários" } },
    { "id": "e2e-tests", "source": "artifact", "file": "e2e-tests.md", "role": "e2e-tester", "shipped": false,
      "skills": ["e2e-testing"], "part": "after", "codeBound": true, "onFail": "implementation",
      "title": { "en": "E2E tests", "pt-BR": "Testes E2E" } },
    { "id": "evidence", "source": "artifact", "file": "evidence.md", "role": "pr-verifier", "skills": [],
      "part": "after", "codeBound": true, "ceiling": 3, "onFail": "implementation",
      "title": { "en": "Demonstration", "pt-BR": "Demonstração" } },
    { "id": "review", "source": "artifact", "file": "review.md", "role": "review-bench", "skills": ["review-change"],
      "helpers": ["code-quality-reviewer", "test-coverage-reviewer", "architecture-reviewer", "security-reviewer",
                  "adr-reviewer", "spec-reviewer", "finding-verifier"],
      "part": "after", "codeBound": true, "ceiling": 2, "onFail": "implementation",
      "title": { "en": "Code review", "pt-BR": "Revisão de código" } },
    { "id": "delivery", "source": "github", "role": "commit-and-pr", "skills": ["commit-message-guidelines"],
      "part": "delivery", "onFail": "implementation", "title": { "en": "Delivery", "pt-BR": "Entrega" } },
    { "id": "retro", "source": "artifact", "file": "retro.md", "role": "change-coordinator", "owner": true,
      "skills": ["retro"], "part": "close", "title": { "en": "Retro and archive", "pt-BR": "Retro e arquivo" } }
  ]
}
```

`devkit-lite/flow.json` is the same without `design`, `readiness` and `approval`, with
`"script": "devkit-lite"`. Keys: `source` (`folder` | `artifact` | `tasks` | `github`); `file` (the
artifact's `generates`); `shipped` (default `true`); `owner` (the gate is the owner's answer: a file
with `result=pending` waits for the owner); `ceiling` (default `ceilings.default`); `onFail` (the
stage that fixes a failure; default the stage itself); `staleAfter` (earlier stages whose file,
modified later than this one by more than 2 s, makes this stage stale: the same tolerance as
`conduct-check.mjs`'s `FRESH_MS`); `codeBound` (stale by `deliver-check`'s commit rule); `part`
(`open` | `plan` | `build` | `after` | `delivery` | `close`). Attempt ceilings therefore live in the
script under the project's `openspec/` (ADR 0010 decision 3: "attempt ceilings live in
configuration"); a project override in `openspec/config.yaml` comes with the `devkit:` block of
round 15. A Portuguese title in a JSON file is allowed: `scripts/check.py` checks Markdown only
(`check_language`, `scripts/check.py:78-93`).

`readFlow(root, schema)` (exported by `flow-check.mjs`) finds the folder through
`schemaFile` (`guard.mjs:148-155`), parses `flow.json` and refuses (usage error, exit 3) a duplicate
id, an unknown `source`, `part` or key value, an `onFail` or `staleAfter` naming an unknown or later
stage, or a missing `title` language. A schema folder without `flow.json` is a previous-script
schema (D-6).

## D-6 The checker, `flow-check` (point 5, AC-4, AC-7, AC-9)

**Where it lives (A-4: option (b)).** `plugins/openspec/hooks/flow-check.mjs`, next to
`deliver-check.mjs`, with `flow-check.test.mjs` imported by `guard.test.mjs`. Reasons, from the
repository: (1) the design itself gives installing "the schemas and the checker under the project's
`openspec/`" to round 26, project setup (`docs/coordination-design.md`, Open points); (2) under a
project's `openspec/` the checker would be outside the code gate (`guard.mjs:203-206` classifies
every path under `openspec/` as planning) and outside the staleness rule (`deliver-check.mjs:145`,
`:206`: commits under `openspec/` never stale a review), so a change to it would need no review;
(3) reusing `deliver-check`'s GitHub reading needs the same folder, the bundle CI already
downloads (`guard.mjs`, `deliver-check.mjs`, `merge-setup.mjs`); (4) ADR 0008 rejected a per-project
copy of a script for drifting from the pack ("A saved workflow in `.claude/workflows/`"). What
travels with the script this round is the declaration (`flow.json`, in the schema folder); the
checker is generic over it.

**Command line.**

```text
node plugins/openspec/hooks/flow-check.mjs <change-id> [--json] [--lang pt-BR|en] [--after <progress-key>]
```

Run from anywhere inside the repository (`findRoot`). Text by default, in `--lang` (default `pt-BR`,
D-7); `--json` prints the report. Exit codes: `0` a next stage to run, or `archived`, or a
previous-script change; `1` waiting for the owner or on GitHub; `2` blocked; `3` usage or preflight
error (no `openspec/`; a change neither active nor archived; `openspec` missing or not 2.x; a schema
that is neither `devkit` nor `devkit-lite` and has no `flow.json`; a malformed `flow.json`; an
OpenSpec answer for a live change with no `artifacts` array, the message quoted from its body; an
invalid `ship` or `merge_method`, through `deliver-check`'s `shipConfig`), with
`{ "version": 1, "error": "<message>" }` under `--json`.

**JSON (`version: 1`).**

```json
{
  "version": 1,
  "change": "add-csv-export",
  "schema": "devkit",
  "script": "current",
  "head": "<sha or null>",
  "stages": [
    { "n": 15, "id": "review", "title": "Code review", "file": "review.md", "state": "failed",
      "result": "failed", "attempt": 1, "commit": "<sha>", "role": "review-bench", "skills": ["review-change"],
      "reasonCode": "header-failed", "params": { "attempt": 1, "ceiling": 2 }, "reason": "<English sentence>" }
  ],
  "next": { "n": 11, "stage": "implementation", "role": "tdd-implementer", "skills": ["..."],
            "reasonCode": "fix-after-failure", "params": { "failed": "review", "attempt": 1, "ceiling": 2 },
            "reason": "<English sentence>", "progressKey": "implementation@<12 hex>" },
  "end": null,
  "previous": null
}
```

Exactly one of `next` and `end` is non-null when `script` is `current`; `end` is
`{ "state": "archived" | "waiting-for-owner" | "waiting-on-github" | "blocked", "stage": "<id or null>", "reasonCode", "params", "reason" }`.
For a previous-script change `stages` is `[]`, `next` and `end` are null, and `previous` is
`{ "reasonCode": "previous-script" | "schema-without-declaration", "finishedBy": "ship-change", "reason" }`.
`reason` is English for programs; the text readout renders `reasonCode` and `params` in the chosen
language. `version` changes only when a field is removed or changes meaning.

**Facts gathered** (`collectFlow(root, id, { env, gh, openspec })`, the only function that runs
programs): `locateChange` (`deliver-check.mjs:219`) first. An archived change is decided there,
before any OpenSpec call except `--version`: OpenSpec 2.0.0 answers `status` for an archived change
with exit 0, a body `{"status":[{"severity":"error",...}]}` and no `artifacts` (seen by the readiness
review), so `collectFlow` does not ask it, and rule 1 of the walk needs no other fact. For a live
change, an answer with no `artifacts` array (or no `tasks` array from `instructions apply`) is a
usage error, exit 3, quoting the body. Then `openspec --version`; `openspec status --change
<id> --json` and `openspec instructions apply --change <id> --json` (both through an injectable
runner, `makeOpenspec(cwd, env)`, shaped like `makeGh`); the first line of each stage file and its
mtime; `gitFacts` and `staleness` (`deliver-check.mjs:167`, `:193`); the change's PR only when the
walk reaches the delivery or the checkout is not on the change's own branch (below). The pure
function `computeFlow(facts, flow, { after })` builds the report; nearly all tests call it with
synthetic facts.

**Stage states.** For each declared stage, in order:

| Source | Raw state |
|---|---|
| `folder` | `passed` |
| `artifact`, OpenSpec says `skipped` | `not-applicable` (`skip_specs`) |
| `artifact`, no file, `shipped: false` | `not-applicable` (`role-not-shipped`) |
| `artifact`, no file | `pending` (`no-file`) |
| `artifact`, file without a header / malformed / naming another stage | `pending` (`no-header` / `bad-header` / `header-other-stage`) |
| `artifact`, header `result=pending` | `pending` (`not-judged`; a stage with `owner: true` waits for the owner) |
| header `passed` / `not-applicable` / `failed` | that state, then the stale check |
| `tasks` | `passed` when `tasks.md` exists, every task outside a fenced block is done and `gitFacts` shows no uncommitted path outside `openspec/` and `.claude/`; else `pending` (`tasks-pending` with the count and the plan's task ids, which are the first word of OpenSpec's `description`, for example `1.2`; OpenSpec's own `id` is a running number; or `uncommitted`) |
| `github` | computed only when reached (below) |

Fenced blocks: a line that opens with three or more backticks or tildes opens a fence and the next
line opening with at least as many of the same character closes it; OpenSpec's tasks whose `line`
falls inside one are dropped (T7). This keeps OpenSpec's report as the source (ADR 0010 decision 3)
and drops only what is not a task (AC-4; the 2026-11-19 defect).

Stale check on a `passed` stage: `codeBound` stages are stale when `staleness(root, { sha: commit },
facts)` returns a reason (a later commit or an uncommitted path outside `openspec/`); stages with
`staleAfter` are stale when one of those stages' files is newer than this stage's file by more than
2 s. Stale reasons carry the short shas and the path.

**The walk.** The first stage whose state is not `passed` or `not-applicable` is the current one;
every later stage is `blocked` (`waits-for` stage n). Then:

1. Archived (`locateChange` says archived): `end archived`, whatever else is true.
2. Current is `stale` or `pending` with a role other than `owner`, and no `owner` wait applies:
   `next` = that stage, its role, its reason. A `pending` stage with `owner: true` whose file exists
   with `result=pending`, or the `approval` stage (role `owner`) missing or pending:
   `end waiting-for-owner`. A stale stage whose role is `owner` (the `approval`, made stale by a
   newer `readiness.md`) ends `waiting-for-owner` too (`approval-stale`: the owner approves the
   revised plan again). A stage whose declared `shipped` is `false` whose file exists with
   `result=pending` ends `waiting-for-owner` (`unshipped-role-pending`: no role in this version can
   finish it; the owner sets its result or removes the file).
3. Current is `failed` (attempt `a`, ceiling `c`): `a >= c` gives `end blocked`
   (`ceiling-reached`). Otherwise, when a fix happened since the failure (a `codeBound` stage that is
   also stale by the commit rule; a `staleAfter` stage whose inputs are newer), `next` is the failed
   stage again (`rerun-after-fix`); otherwise `next` is its `onFail` stage (`fix-after-failure`).
4. Current is `delivery`: below.
6. Last guard, applied to every `next` the rules above or the delivery compute (an `onFail` target
   included): when its stage's role is `owner` or its `shipped` is `false`, the run ends
   `waiting-for-owner` instead (`approval-stale`, `unshipped-role-pending`, or `no-role` for any
   other such case), so `next` never names a role that cannot act.
5. Every stage passed and the folder is not archived: `next` = `retro` with reason `archive`
   (`openspec archive`, the roadmap tick and the archive pull request, which `ship-change` runs).

**No progress (`--after`).** `progressKey` = `<next.stage>@<first 12 hex of sha256>` over: the HEAD
sha; `git status --porcelain=v1 -z -uall`; `git diff HEAD --binary`; and the bytes of each untracked
file outside `.claude/` (`git ls-files --others --exclude-standard -z`). When `--after` equals the key
just computed, the run ends `blocked` (`no-progress`: "`<stage>` came back with nothing changed since
the last run"). The checker keeps no state; the caller passes back the key it printed, which is the
"one run's bookkeeping" ADR 0010 decision 8 allows a driver. Round 15's loop passes it.

**The delivery (A-5).** Reached when every stage before it passed. It reuses, by import:
`shipConfig` (`deliver-check.mjs:128`), `findChangePr` (`:468`), `checksItem` (`:556`), `waitingFor`
(`:866`), `makeGh` (re-exported from `merge-setup.mjs`) and `ghError`; it copies none of them.

| Facts | Result |
|---|---|
| `ship` is `plan` | `end waiting-for-owner` (`ship-plan`: the owner opens and merges the pull request) |
| `findChangePr` error, `gh` missing | `end blocked` (`gh-error`, with `ghError`'s text) |
| no PR | `next delivery`, role `commit-and-pr` (`no-pr`) |
| PR open, head is not local HEAD | `next delivery` (`not-pushed`) |
| PR open, `checksItem` blocked | `end blocked` (`checks-unreadable`) |
| PR open, a check failing | `next implementation` (`check-failing`, names and links) |
| PR open, a check pending | `end waiting-on-github` (`checks-pending`) |
| PR open, green, `pr` mode | `end waiting-for-owner` (`owner-merges`) |
| PR open, green, `merge` mode, auto-merge on | `end waiting-on-github` (`auto-merge-on`, `waitingFor`) |
| PR open, green, `merge` mode, auto-merge off | `next delivery` (`enable-auto-merge`) |
| PR merged | `delivery` passed; the walk goes on to `retro` |
| PR closed | `end blocked` (`pr-closed`) |

After a squash merge the header commits of the stages before the delivery are no longer ancestors of
HEAD, as `deliver-check` already notes for its own items. So when the checkout is not on the change's
own branch (the default branch, `chore/archive-<id>`), the checker asks `findChangePr` first; a merged
PR switches it to the post-merge walk, where every stage before the delivery is reported from its
header without the stale check or the task count, the delivery is passed and the walk resumes at
`retro`. The full delivery contract (conversation, PR body, the archive PR) stays `deliver-check`'s
until round 24.

**A change begun under the previous script (AC-7).** Checked before the walk, after the archived
check: the schema folder has no `flow.json` (`schema-without-declaration`: the project has not run
`openspec-setup` since updating), or at least one of the change's stage files exists and none of them
starts with a stage header (`previous-script`). The checker then lists no stage, offers nothing,
stops nothing and exits 0. A change with no stage file yet is current: its files will come from the
new templates.

**Size.** About 650 lines for `flow-check.mjs` (facts 150, walk and states 250, delivery 80, text
and JSON 120, CLI 50) and about 900 for its tests: one third of the two checkers it starts to
replace (about 2,300 lines, ADR 0010), because it parses no prose and imports the GitHub reading.

**AC-9.** The source's `import` lines name only `node:` modules and `./deliver-check.mjs`,
`./guard.mjs`, `./merge-setup.mjs`; the only programs it spawns are `git`, `openspec` and `gh`.

### Decisions taken while implementing

Recorded after the build, where this design left a point open; the spec delta states each one
(`specs/change-stages/spec.md`).

1. **`staleAfter` stops once a task is ticked.** The mtime check of a `staleAfter` stage (the plan
   readiness, the owner's approval) runs only while no task of `tasks.md` is ticked, and not in the
   post-merge walk: the implementer ticks `tasks.md`, which would otherwise make the plan review
   stale on every tick. This is `conduct-check`'s rule (`started`, `FRESH_MS` of 2 s). Known blind
   spot: a plan file edited after the work started is not flagged; the code-bound stages after the
   implementation still go stale on the next product commit.
2. **An unshipped role's pending file.** A stage whose `shipped` is `false` and whose file exists
   with `result=pending` ends `waiting-for-owner` with `unshipped-role-pending`, even when the stage
   also has `owner: true` (the screen mock-up). `approval-stale` is used only for a stale
   `approval.md` (role `owner`).
3. **An archived change's schema.** It is read only from the archived folder's own `.openspec.yaml`;
   no OpenSpec call other than `--version` is made for it.
4. **The post-merge walk.** Off the change's own branch (no branch, a default branch, the archive
   branch), and only when `ship` is not `plan`, the checker asks `findChangePr` first; a merged pull
   request sets `postMerge`, which reports every stage before the delivery from its header alone (no
   commit staleness, no `staleAfter` check, the implementation passed whatever the task count) and
   passes the delivery, so the walk resumes at the retro.
5. **The OpenSpec pin.** The four install lines (`docs/openspec-flow.md` three times,
   `plugins/openspec/skills/openspec-setup/SKILL.md:18`) say `npm i -g @fission-ai/openspec@2`; CI
   pins `@fission-ai/openspec@2.0.0`; the checker exits 3 on a missing `openspec`, an unreadable
   version or a major other than 2.

## D-7 The readout (point 6, AC-5, A-6)

The command is the checker without `--json`. Text form: a title line, one line per stage
(number, title, situation), a blank line, then either the three lines next stage / who runs it / why,
or one end line. The sample below is the exact output for the sample change of D-12 (`add-csv-export`,
`devkit`, every stage up to the demonstration passed, the plan readiness passed at attempt 2, the
code review failed at attempt 1, nothing changed since), pinned by the test
`flow-check readout: the sample change prints the approved text` in
`plugins/openspec/hooks/flow-check.test.mjs`. The owner reads the Portuguese one at plan approval.

```text
Change add-csv-export (roteiro devkit)

 1  Abrir a change          passou
 2  Requisitos (grill)      passou
 3  Mock-up de tela         não se aplica: ninguém executa esta etapa ainda (o papel screen-designer não existe nesta versão)
 4  Decisões e ADRs         não se aplica: ninguém executa esta etapa ainda (o papel adr-author não existe nesta versão)
 5  Proposta                passou
 6  Specs                   passou
 7  Design                  passou
 8  Tarefas                 passou
 9  Revisão do plano        passou na tentativa 2
10  Aprovação do dono       passou
11  Implementação           passou: 6 de 6 tarefas feitas
12  Testes unitários        não se aplica: ninguém executa esta etapa ainda (o papel test-runner não existe nesta versão)
13  Testes E2E              não se aplica: ninguém executa esta etapa ainda (o papel e2e-tester não existe nesta versão)
14  Demonstração            passou
15  Revisão de código       falhou na tentativa 1 de 2
16  Entrega                 bloqueada: espera a etapa 15
17  Retro e arquivo         bloqueada: espera a etapa 16

Próxima etapa: 11 Implementação
Quem executa: tdd-implementer
Por quê: a revisão de código falhou na tentativa 1 de 2 e nada mudou no código desde então; a correção vem antes de uma nova revisão.
```

```text
Change add-csv-export (devkit script)

 1  Open the change         passed
 2  Requirements (grill)    passed
 3  Screen mock-up          does not apply: nobody runs this stage yet (no screen-designer role in this version)
 4  Decisions and ADRs      does not apply: nobody runs this stage yet (no adr-author role in this version)
 5  Proposal                passed
 6  Specs                   passed
 7  Design                  passed
 8  Tasks                   passed
 9  Plan readiness          passed at attempt 2
10  Owner's approval        passed
11  Implementation          passed: 6 of 6 tasks done
12  Unit tests              does not apply: nobody runs this stage yet (no test-runner role in this version)
13  E2E tests               does not apply: nobody runs this stage yet (no e2e-tester role in this version)
14  Demonstration           passed
15  Code review             failed at attempt 1 of 2
16  Delivery                blocked: waits for stage 15
17  Retro and archive       blocked: waits for stage 16

Next stage: 11 Implementation
Who runs it: tdd-implementer
Why: the code review failed at attempt 1 of 2 and the code has not changed since; the fix comes before another review.
```

Situation words: `passou`/`passed`, `falhou`/`failed`, `não se aplica`/`does not apply`,
`desatualizada`/`stale`, `pendente`/`pending`, `bloqueada`/`blocked`. End lines:
`Fim: arquivada.` / `End: archived.`; `Fim: esperando o dono. <motivo>` / `End: waiting for the
owner. <reason>`; `Fim: esperando o GitHub. ...` / `End: waiting on GitHub. ...`; `Fim: bloqueada.
...` / `End: blocked. ...`. A previous-script change prints the title line, a blank line and one
paragraph:

```text
Esta change começou no roteiro anterior: os arquivos dela não têm o cabeçalho de etapa. O fluxo de hoje a termina (ship-change, guiado pelo deliver-check). Este comando não para nada.
```

```text
This change began under the previous script: its files carry no stage header. Today's flow finishes it (ship-change, led by deliver-check). This command stops nothing.
```

Every reason code of D-6 has one sentence in each language, in one table in `flow-check.mjs`
(`TEXT`); a test asserts
both languages cover every code.

**Language in this round.** `--lang pt-BR|en`; without it, `pt-BR`, the same default as the only
language option devkit has today, devkit-panel's `userConfig.language`
(`plugins/panel/.claude-plugin/plugin.json`, default `pt-BR`). That option reaches the panel module
only (`plugins/panel/hooks/i18n.ts:557-558`), not a command run in a shell, so it cannot be read
here. Round 15 builds the person's setting and replaces the default; nothing is stored this round.

## D-8 Roles, not tools (point 7, AC-2)

**The roles** the two schemas name: `change-coordinator`, `owner`, `screen-designer`, `adr-author`,
`change-planner`, `plan-readiness-reviewer`, `tdd-implementer`, `test-runner`, `e2e-tester`,
`pr-verifier`, `review-bench`, `commit-and-pr`; and the helpers `codebase-researcher`,
`openspec-validator`, `plan-reality-auditor`, `adr-reviewer`, the six reviewers and
`finding-verifier`. The ids are section 4's names, which are also the devkit-core agent names where
one exists. `change-coordinator` is used instead of `tech-lead` because which of the two `tech-lead`
roles keeps that name is settled in round 15's grill (design, Open points).

**The document**: `docs/roles.md`, one section per role: what it does, what it delivers, what it
never does, which stages name it, and who plays it in Claude Code today (for example
`change-coordinator`: the main session running `ship-change` or `/conduct` until round 15;
`plan-readiness-reviewer`: the agent `devkit-core:plan-readiness-reviewer`; `screen-designer`: nobody
yet). A test (`flow-check AC-2: the role document covers every role`) reads every `role` and
`helpers` value of both `flow.json` files and asserts a `## <role>` heading for each.

**The instructions** start with one line `Role: <role>. Skills: <list or none>.` (and
`Helpers: ...` where D-2 lists them), then the stage's instruction with every Claude name removed:
`AskUserQuestion` becomes "ask the owner one question at a time"; "Dispatch ... with the Agent tool:
subagent_type: devkit-core:X" becomes "hand this stage to the X role"; the apply instruction keeps
`pr-verifier` before `review-change` (`deliver-check.test.mjs:2856-2862` pins it). The test
`flow-check AC-2: no schema text names a platform tool` searches every `instruction`, template and
`flow.json` of both schemas for `devkit-core:`, `subagent_type`, `Agent tool`, `AskUserQuestion`,
`Workflow tool` and `Claude`, and asserts each instruction's first line (the `apply` instruction
being the `implementation` stage's) names the same role as
`flow.json`.

**How today's Claude flow still finds its agents.** `ship-change` and `/conduct` name the devkit-core
types themselves and are Claude skills: unchanged. The session hook, which today says "Follow the
schema" (`guard.mjs:478-481`), gains one sentence: "A stage's instruction names its role; in Claude
Code a role is the devkit-core agent of the same name, dispatched with the Agent tool (`owner` is you
asking the owner, `change-coordinator` is this session, `review-bench` is the review-change skill)."
and replaces "the next step is what `openspec status` says" (false once T5 holds) with "the next
stage is what `node <plugin>/hooks/flow-check.mjs <id>` says; `ship-change` drives the change".
The guard's refusal messages already name `devkit-core:<owner>` (`guard.mjs:228`, `:241`): unchanged.

## D-9 Projects that update (point 8, A-1, AC-7)

What a project receives, and through which path:

1. `claude plugin update devkit-openspec@devkit` (and `devkit-core`): the hooks, `flow-check.mjs`,
   the new `ship-change` rows and agent formats. The project's `openspec/schemas/` is untouched:
   install-schemas copies only when run (`install-schemas.sh:39-47`), and `openspec-setup`
   upgrades the schemas only when re-run (its SKILL.md: "re-running it upgrades the schemas").
   `flow-check` then reports every change as `schema-without-declaration` and says to re-run
   `openspec-setup`; today's flow is unchanged.
2. `openspec-setup` re-run (or `install-schemas.sh`): the new `schema.yaml`, templates and
   `flow.json`. New changes get the new script. Open changes keep their `.openspec.yaml` (`schema:
   devkit`), so OpenSpec reads them with the new schema: their existing files stay `done`, the new
   stages show `ready` (T4), `openspec validate` is unchanged and `openspec archive` still archives
   (T9). `flow-check` reports them `previous-script` (no header in any stage file) and today's flow
   (`ship-change` + `deliver-check`, which never call `openspec status`) finishes them. For an open
   devkit change, `openspec instructions apply` now also asks for `approval.md`, which
   `ship-change` already writes before the first `implement`.
3. CI: the `devkit-reviews` job pins `deliver-check` to a commit (`docs/openspec-flow.md:489-490`)
   and does not call OpenSpec: unaffected until the project bumps the pin.

This repository is such a project: its `openspec/schemas/` copy changes in this change
(`deliver-check.test.mjs:2856-2859` requires the copies byte-identical), so this very change is read
with the new schema from phase 2 on, which is how AC-7 is proved on a real folder.

## D-10 Today's flow keeps driving (AC-6) and the writers (AC-3)

**Readers changed (two).**

- `conduct-check.mjs` `planArtifactsOf` (`:175-188`) counts every plain-file artifact of the schema
  except `requirements` and `readiness` as a plan file; with the new schemas it would ask to plan
  `mockup.md`, `approval.md`, `evidence.md`, `review.md` and `retro.md` before any implementation.
  New rule: when the schema folder has `flow.json`, the plan files are its stages with
  `part: "plan"`, `source: "artifact"`, `shipped` not `false`, a `file` without `*`, and an id other
  than `requirements`, `readiness` and `approval`: `["proposal.md", "design.md", "tasks.md"]` for
  `devkit`, `["proposal.md", "tasks.md"]` for `devkit-lite`, today's lists. Without `flow.json`,
  today's code. Failing test first: every `conduct` test over a devkit change goes red when phase 2
  replaces the schema; the new test `conduct: plan files come from the stage declaration` pins both
  lists.
- `guard.mjs` session text only (D-8). Test: `flow-check AC-2: the session hook names the checker
  and the roles`.

**A behaviour that follows the owner's answer 4.** `devkit-lite` now has `requirements`, so
`conduct-check` (which grills when the schema has that artifact, `conduct-check.mjs:206`, `:263`) asks the
grill for a not-started lite change. Test changes, all in
`plugins/openspec/hooks/conduct-check.test.mjs` (suite: `conduct-check.test.mjs`, run by
`guard.test.mjs`; layer: conduct-check's planning rows):

- the `planFiles` helper (`:79-93`) writes `requirements.md` for every schema, not only `devkit`.
  Invariant: a change whose plan files exist proceeds past planning.
- `conduct: an after: id that is missing from the roadmap or in a skipped round keeps its dependent
  waiting` (`:167-173`) builds a not-started `devkit-lite` change by hand (`proposal.md`, `tasks.md`);
  its `writeChange` gains `'requirements.md': '# Requirements\n'`. Invariant: a dependent whose plan
  is written waits on its unticked `after:` ids; without the file the grill would come first.
- `conduct: devkit-lite: proposal and tasks go straight to delivery; no planning row of it is an
  owner row (AC-4)` (`:353-364`) still passes through the helper, but its title becomes false: the
  short script now has one owner row, the grill. It is renamed `conduct: devkit-lite: with its
  requirements written, proposal and tasks go straight to delivery; the grill is its only owner row
  (AC-4)` and gains one assertion: with `requirements.md` removed, the step is `grill`. Invariant:
  the short script's planning asks the owner only for the grill.

How the list was made complete: every `devkit-lite` change in a test file that reaches
`conduct-check` was listed (`grep -n "devkit-lite\|writeChange(" conduct-check.test.mjs`; the other
test files naming `conduct-check` are the panel's and `devkit-kit.test.mjs`, which use JSON fixtures
or a stub and never run it on a schema). Of the hand-built lite changes, `:597` (`readyChange`),
`:769`, `:843`, `:866`, `:933` have a ticked task (started: no planning row), `:855` is archived,
`:1318` stops at exit 3 on its branch before planning, and `:376` gives `planningStep` synthetic
facts; only `:170` reaches the grill. The readiness review saw 90 of 91 `conduct` tests pass with the
helper change alone, the one red being `:167-173`. `ship-change` has no grill
step; a lite change it ships without `requirements.md` is reported by `flow-check` as pending at the
requirements stage, and `deliver-check` (which reads criteria from `proposal.md` first) is unchanged.

**Writers changed** (first line only; what each one judges is unchanged):

| Writer | File | Change |
|---|---|---|
| `plugins/openspec/skills/ship-change/SKILL.md`, row `stop-plan-approval` | `approval.md` | the header line (`result=passed`, attempt one more than the replaced file's, the HEAD sha) before `# Plan approval: <id>`; the four lines stay the row's (`ship-change/SKILL.md:37`: `- Status: APPROVED`, `- Readiness: <hash>`, `- Date: <YYYY-MM-DD>`, `- Owner's words: "..."`) |
| same, row `review` | `review.md` | after the round's section is appended, insert the header as line 1 when the file has none (the first round creates the file by appending, `plugins/core/skills/review-change/SKILL.md:175`), else replace line 1: `passed` when the round's `Consensus` is PASS, `failed` when FAIL, attempt = the round, commit = the reviewed commit |
| same, rows `retro` and `stop-retro-answers` | `retro.md` | written with `result=pending`; set to `passed` once every proposal has an `- Answer:` line |
| `plugins/openspec/skills/conduct/SKILL.md`, row `grill` | `requirements.md` | open it with the template's header, `result=passed` once the owner answered. (`approve` and the delivery rows already defer to `ship-change`'s rows) |
| `plugins/core/agents/plan-readiness-reviewer.md` and `plugins/core/skills/plan-readiness-review/templates/report.md` | `readiness.md` | the header on line 1: `passed` for APPROVED, `failed` for NEEDS-REVISION or BLOCKED |
| `plugins/core/agents/pr-verifier.md` | `evidence.md` | the header on line 1 (`passed` for verified, `failed` for defect-found), `Commit:` on line 2, still before the first heading; the sentence "as the first line of the file" changes to "right after the stage header line" |
| `plugins/core/agents/change-planner.md` | the plan files | in OpenSpec mode, write each artifact from `openspec instructions <artifact> --change <id> --json` and keep its template's first line, `result=passed` once `openspec validate <id> --strict` passes |

**OD-1, decided (a).** AC-3 asks every stage file to start with the header, and `evidence.md` (the
verifier's) and `readiness.md` (the readiness reviewer's) have one writer each, enforced by the hooks
(`guard.mjs:208-209`), so only those agents can write their first line. Decided while planning by the
conducting session, under the owner's standing instruction to decide routine choices: the
demonstration and the plan review begin with one hidden status line written by their own agents;
what they check does not change (`requirements.md`, Out of scope and Decisions taken while
planning). The alternative, leaving them untouched, would show two finished stages as pending until
round 16, against AC-4. The owner sees it in plain words at plan approval.

**Compatibility tests (AC-6)**, in `plugins/openspec/hooks/flow-check.test.mjs`, test names starting
`flow-check AC-6:`:

1. `deliver-check gives the same step with and without stage headers`: for each of the fixtures
   stop-not-approved, stop-plan-approval, implement, gate, verify, review, fix-review, fix-defect,
   open-pr and ready (built with `gitRepo`, `put`, `commitAll` and `fakeGh` from
   `deliver-check.test.mjs`), `collectState` + `nextStep` run on the plain folder and on the same
   folder with a header prepended to every stage file except `reviews/*.md`; the two `next.step`
   values are equal.
2. `the readiness gate reads Status under a header`: `guard.mjs edit` on product code with a headed
   `readiness.md` saying APPROVED (as `tdd-implementer`) exits 0, and saying NEEDS-REVISION exits 2.
3. `approvalState reads a headed approval.md`: `ok` is true for a headed file with the right hash.
4. `conduct-check gives the same planning step with headers`: `planningStep` on headed and plain plan
   files gives the same step.

**Existing tests changed** (each named with its invariant, the layer that owns it, its suite):

- `deliver-check.test.mjs:2883` (in "AC-6 instructions-follow: configs, ship-change, conduct, flow doc
  and READMEs name evidence before review") finds the flow doc's apply paragraph by its first words,
  `` `apply` requires `readiness` ``; the paragraph now starts `` `apply` requires `approval` ``, so the
  anchor changes to that. Invariant: every text that sequences the delivery names `pr-verifier`
  before `review-change`; layer: documentation truthfulness; suite: `deliver-check.test.mjs`.
- the three edits of `conduct-check.test.mjs` listed above (the `planFiles` helper, the test at
  `:167-173`, the renamed test at `:353-364`).
No others: the search above found none, and the readiness review's scratch run showed 90 of 91
`conduct` tests green with the helper alone; the implementer reports any other red test as a plan
defect.

## D-11 Documentation and release (point 9, A-7)

**Versions**: `devkit-openspec` 0.14.2 to 0.15.0 (new checker, schema contract); `devkit-core` 0.6.4
to 0.7.0 (three agents' output format); `devkit-compozy`
0.1.0 to 0.1.1 (one template line); marketplace 0.18.2 to 0.19.0; each in its `plugin.json` and in
`.claude-plugin/marketplace.json` (`CONTRIBUTING.md`, step 5).

**CHANGELOG** (`## 0.19.0 — the script and the checker`): devkit-openspec 0.15.0 (the two scripts
declare every stage, roles instead of Claude names, the stage header, `flow-check`, `conduct-check`
reads `flow.json`, session text; projects re-run `openspec-setup` to get the new schemas, open
changes finish on today's flow); devkit-core 0.7.0 (the readiness reviewer, the verifier and the
planner write the stage header line); devkit-compozy 0.1.1 (the loop's schema description); docs
(`docs/roles.md`, the flow page, the design's tense); CI installs OpenSpec 2.0.0; tagged `v0.15.0`.

**Pin**: `docs/openspec-flow.md:489`, `:490` and `:497` name `v0.15.0`
(`deliver-check.test.mjs:3340-3360` require the doc pin to name the devkit-openspec version).
**Tag** `v0.15.0` on the merge commit, after the merge (`CONTRIBUTING.md:52`): a Workflow follow-up.
**Catalog**: the devkit-openspec description in `plugins/openspec/.claude-plugin/plugin.json` and
`.claude-plugin/marketplace.json:22` gains "and flow-check, which reads each stage file's header and
says which stage passed and which comes next"; `python3 scripts/gen-catalog.py` rewrites
`docs/catalog.md:45` and the pack README's catalog block.

**Claims this change makes false, with every file that repeats them:**

| Claim | Files |
|---|---|
| `devkit-lite` has no grill ("No grill, no readiness gate", "Default flow: devkit-lite (proposal → ...", "choose `devkit` when the change needs the owner grilled") | `plugins/openspec/schemas/devkit-lite/schema.yaml:3`, `openspec/schemas/devkit-lite/schema.yaml:3`, `plugins/openspec/README.md:19`, `docs/openspec-flow.md:19`, `:55-63`, `openspec/config.yaml:1-7`, `plugins/openspec/skills/openspec-setup/templates/config.yaml:1-7`, `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:39`, `.compozy/loops/openspec-change/loop.yaml:39` |
| only the `devkit` schema runs the grill (replacement: "the grill when the schema has a `requirements` artifact") | `plugins/compozy/skills/compozy-setup/templates/agents/tech-lead/AGENT.md:30-32` and `.compozy/agents/tech-lead/AGENT.md:30-32` ("..., and for the `devkit` schema run the grill and the `devkit-core:plan-readiness-reviewer` agent" becomes "..., run the grill when the schema has a `requirements` artifact, and for the `devkit` schema the `devkit-core:plan-readiness-reviewer` agent"); `plugins/compozy/skills/compozy-setup/templates/loops/openspec-change/loop.yaml:100` and `.compozy/loops/openspec-change/loop.yaml:100` ("grill + readiness for the devkit schema" becomes "the grill when the schema has a `requirements` artifact, readiness for the devkit schema") |
| install OpenSpec `@latest` (the checker refuses a major other than 2) | `docs/openspec-flow.md:72`, `:499`, `:512`, `plugins/openspec/skills/openspec-setup/SKILL.md:18` (each becomes `npm i -g @fission-ai/openspec@2`, "a 2.x release") |
| `apply` requires `readiness` (devkit) | `docs/openspec-flow.md:53`, `plugins/openspec/README.md:18` |
| the instructions name the devkit-core agent | `plugins/openspec/README.md:18` ("Each artifact's instruction names the devkit-core skill or agent"), `docs/coordination-design.md:115-117` |
| `openspec status` tells the next step | `README.md:52`, `plugins/openspec/README.md:3`, `docs/openspec-flow.md:104-107`, `guard.mjs:479` |
| `evidence.md` starts with its `Commit:` line | `docs/openspec-flow.md:327`, `plugins/core/agents/pr-verifier.md:54` |
| the checker and the stage header are still to be built | `docs/coordination-design.md:22-23`, `:101-102`, `:259`, `:267-271`, `:321-322`, `:441` (the open point "The header's field names" becomes decided, with this change named), `:465-466` |

Sweep for the grill claim (`git grep -n -i "grill"` over `docs/`, `README.md`, `CONTRIBUTING.md`,
`plugins/`, `.compozy/`, the ADRs and the design page excluded): the rows above are every sentence
saying the short script has no grill or that only `devkit` grills; `docs/openspec-flow.md:223` and
`:225` list the grill among `/conduct`'s owner gates without naming a schema and stay true;
`conduct-check` itself needs no text change (its `grill` step follows the schema, `:206`, `:263`).

The config header comments keep `apply → evidence + reviews` (`deliver-check.test.mjs:2872` pins it).
New text: `docs/openspec-flow.md` sections "The `devkit` schema" and "The `devkit-lite` schema" (the
D-2 tables), a section "The stage header and `flow-check`" (D-3, D-6, D-7 in short, the tested
OpenSpec version), "Running a change" names `flow-check`; `CONTRIBUTING.md`, "Changing the OpenSpec
schemas": both copies, `flow.json` and the header are kept together and the AC-1/AC-8 tests need the
`openspec` CLI; `plugins/openspec/README.md` rows for `flow.json` and `flow-check.mjs`;
`docs/roles.md` linked from `CLAUDE.md` ("Where the rules are") and `docs/coordination-design.md`
section 3.

## D-12 Proof on real input (point 11, AC-5, AC-7)

- **This change's own folder (AC-7).** After phase 5, `node plugins/openspec/hooks/flow-check.mjs
  flow-script-checker` and the same with `--json --lang en`, run in this worktree: expected the
  previous-script message, `stages: []`, exit 0. `pr-verifier` records both outputs in `evidence.md`.
  The run comes before the verifier writes that file, and this change's verifier, readiness reviewer
  and `ship-change` are the installed pack's, which write no header: one headed file would make this
  folder read as a current-script change. This is the one place where `CONTRIBUTING.md:11` (dispatch
  with the repository's agent format) is set aside, for the header line only.
- **A sample change written with the new script (AC-5).** The test fixture `sampleChange()`
  (exported by `flow-check.test.mjs`) builds `add-csv-export` in a temporary project with the shipped
  `devkit` schema installed by `install-schemas.sh`, headed files as D-7 describes and a fake `gh`.
  The test `flow-check readout: the sample change prints the approved text` runs the CLI on it in
  both languages and, when `FLOW_CHECK_SAMPLE_DIR` is set, also writes the two outputs to
  `<dir>/flow-check-sample.pt-BR.txt` and `<dir>/flow-check-sample.en.txt`. Task 7.5 runs that test
  with the variable set; `pr-verifier` copies both files into `evidence.md`, and the owner reads the
  Portuguese one.

## D-13 Decisions cited, ADRs, alternatives

ADR 0010 decisions 1 (the script under `openspec/`, roles not tools), 3 (header, checker, ceilings,
zero pending tasks, four end states), 5 (hooks veto: the locks are untouched), 7 (`ship-change`,
`/conduct`, `conduct-check`, `deliver-check` stay shipped), 8 (no new harness outside OpenSpec);
ADR 0004 (opt-in stays the schema selection; `DEVKIT_SCHEMAS` unchanged); ADR 0002 and ADR 0003
(merge mode unchanged; the delivery reads `ship` through `deliver-check`); ADR 0008 (both review
paths unchanged; its rejected per-project copy is reason 4 of D-6).

**No new ADR.** Read against the Alternatives tables of ADRs 0001 to 0010: nothing here takes up a
rejected option. ADR 0010 rejects "devkit's own harness program, outside OpenSpec"; `flow-check` is
the checker ADR 0010 decision 3 itself decides, reading OpenSpec's own report, and `flow.json` lives
in the schema folder under `openspec/`. ADR 0004 rejects "an explicit `devkit: true` key": no config
key is added. The fence rule (D-6) reads ADR 0010 decision 3's "OpenSpec reports zero pending tasks"
as OpenSpec's task list less the lines inside fenced examples, which are not tasks (AC-4); OpenSpec
stays the source. To keep the ADR's text and the code in agreement, ADR 0010 gains a dated Note under
Context in the form of its existing Note (task 7.2), changing no decision.

| Alternative | Why not |
|---|---|
| Header as `Key: value` lines or YAML front matter | `openspec validate --strict` fails on spec deltas (T8); `Status:` would be read by `guard.mjs` `readValue` as the readiness verdict |
| Header on line 1 of `reviews/<reviewer>.md` | `review-round.mjs check-file` requires `Verdict:` on line 1; the reviewers would change. `review.md` is the stage's file instead |
| Role and skills as extra keys in `schema.yaml` | OpenSpec drops them (T2); reading them needs a YAML parser or a line hack inside block scalars |
| Checker installed under the project's `openspec/` now (A-4 (a)) | Outside the code gate and the stale rule; round 26 installs it; ADR 0008's per-project-copy rejection (D-6) |
| Rely on OpenSpec's task count as is | It counts fenced lines (T7): the 2026-11-19 defect again |
| Keep `apply.requires: [readiness]` in `devkit` | OpenSpec would call a change ready to implement before the owner's approval, stage 7 |
| A fourth result value for round-16 stages (`skipped`) | The three results are decided; `not-applicable` with its reason code says the truth without a new value |
| Plan-stage staleness by header commits | Plan files are usually uncommitted when reviewed; the mtime rule is the one `conduct-check` already uses |

## Risks / Trade-offs

| Risk | P | I | Mitigation |
|---|---|---|---|
| OpenSpec changes its JSON or its schema commands (experimental, T1; 2.1.1 already out, T12) | MEDIUM | HIGH | Pin 2.0.0 in CI; `flow-check` refuses a major other than 2 with a clear message; the AC-1/AC-8 tests fail loudly on a shape change |
| An agent forgets the header line | MEDIUM | MEDIUM | The readout says "pending: no stage header" and names the file; the no-progress key stops a loop; templates carry the line |
| Old open changes look half-done in `openspec status` after the schema update (T4) | HIGH | LOW | `flow-check` names them previous-script; docs and CHANGELOG say today's flow finishes them; nothing gates on `openspec status` |
| `/conduct` now grills a not-started lite change | MEDIUM | LOW | The owner's answer 4; documented in the CHANGELOG; started changes skip planning as today |
| The CompozyOS loop does not grill lite changes, so `flow-check` shows their requirements pending | MEDIUM | LOW | Truthful readout; the loop is replaced in round 21; the loop's description line is corrected |
| The suite now needs the `openspec` CLI | HIGH | MEDIUM | CI installs 2.0.0 before the hook tests; `CONTRIBUTING.md` says so |
| mtime-based plan staleness misreads after a fresh clone | LOW | LOW | The 2 s tolerance treats equal times as fresh; `deliver-check`'s hash rule still guards the approval |

Rollback: revert the merge commit; projects that re-ran `openspec-setup` re-run it after the revert to
restore the previous schemas; stage headers left in files are HTML comments no reader of the
previous flow sees.

## Implementation plan

Dependency order: the header and declaration readers, then the schemas (data), then today's readers,
then the checker, then its delivery and text, then the writers, then docs and release.

**Per surface.**

- devkit-openspec: `hooks/flow-check.mjs` (new), `hooks/flow-check.test.mjs` (new),
  `hooks/conduct-check.mjs`, `hooks/guard.mjs` (session text), `hooks/guard.test.mjs` (one import
  line), `hooks/conduct-check.test.mjs` (helper), `hooks/deliver-check.test.mjs` (one anchor),
  `schemas/devkit/` and `schemas/devkit-lite/` (`schema.yaml`, `flow.json`, templates),
  `skills/ship-change/SKILL.md`, `skills/conduct/SKILL.md`, `skills/openspec-setup/templates/config.yaml`,
  `README.md`, `.claude-plugin/plugin.json`.
- devkit-core: `agents/plan-readiness-reviewer.md`, `agents/pr-verifier.md`, `agents/change-planner.md`,
  `skills/plan-readiness-review/templates/report.md`, `.claude-plugin/plugin.json`.
- devkit-compozy: `skills/compozy-setup/templates/loops/openspec-change/loop.yaml`, `.claude-plugin/plugin.json`.
- Repository: `openspec/schemas/` (copies), `openspec/config.yaml` (header comment), `.compozy/loops/openspec-change/loop.yaml:39`,
  `.github/workflows/ci.yml`, `docs/roles.md` (new), `docs/openspec-flow.md`, `docs/coordination-design.md`,
  `docs/adr/0010-openspec-as-the-harness.md` (Note), `docs/catalog.md` (generated), `README.md`, `CLAUDE.md`,
  `CONTRIBUTING.md`, `CHANGELOG.md`, `.claude-plugin/marketplace.json`.

**Files to create**: `plugins/openspec/hooks/flow-check.mjs`, `plugins/openspec/hooks/flow-check.test.mjs`,
`plugins/openspec/schemas/devkit/flow.json`, `plugins/openspec/schemas/devkit-lite/flow.json`, templates
`mockup.md`, `decisions.md`, `approval.md`, `unit-tests.md`, `e2e-tests.md`, `evidence.md`, `review.md`,
`retro.md` in `schemas/devkit/templates/` and (without `approval.md`) in `schemas/devkit-lite/templates/`,
plus `requirements.md` in `schemas/devkit-lite/templates/`; the same under `openspec/schemas/`; `docs/roles.md`.
Files to delete: none.

**Estimate**: optimistic 24 h, likely 32 h, pessimistic 44 h.

| Component | Hours | Type | Risk |
|---|---|---|---|
| Header, declaration and fence readers (phase 1) | 3 | Core | LOW |
| Schemas, templates, `flow.json`, copies, `conduct-check` reader (phase 2) | 6 | Core | MEDIUM |
| Roles document, session text, AC-2 and AC-6 tests (phase 3) | 4 | Testing | LOW |
| Stage states, walk, stale, ceilings, no-progress, previous script (phase 4) | 7 | Core | MEDIUM |
| Delivery, CLI, JSON, readout, AC-9 (phase 5) | 5 | Integration | MEDIUM |
| Writers of the header (phase 6) | 3 | Core | LOW |
| Docs, CI pin, release, proof runs, whole suite (phase 7) | 4 | Documentation | LOW |

**Assumptions** (where the plan breaks if wrong): OpenSpec 2.0.0 behaves as D-1 recorded (tested
here); `gh` is not needed before the delivery (D-6); the suite runs about 8.5 minutes with 671 tests
on the base (the caller's figure; `orchestrator-replan`'s retro records 671 at its delivered commit);
no test outside those named in D-10 reads the schema text (searched: `deliver-check.test.mjs:2856-2887`
and the conduct fixtures are the only readers).

**Dependencies**: ADR 0010 and `docs/coordination-design.md` (merged at `1634b27`, answers recorded at
`1fd10d3`); `deliver-check.mjs`'s exports as of `92bec9f`; the `openspec` CLI 2.0.0 on the machine and
in CI.
