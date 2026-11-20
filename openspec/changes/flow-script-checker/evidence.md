Commit: 701313736f8816c08f14d5e4bdf10d0a1a2561e1

# Evidence: flow-script-checker

Verified on branch `flow-script-checker` at the commit above, tree clean (no uncommitted work), no PR yet.
This file carries no stage header on purpose: this folder is the previous-script folder that proves
AC-7 (tasks.md 7.5, design.md D-12). Every number is marked "verifier" (counted by the verifier at this
commit) or "caller" (measured by the conducting session on the same tree; the commit was made right
after and changed nothing). This replaces the evidence written at b56cf3d.

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.3, 2.7, 3.4, 4.4, 5.4, 6.6 | `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs` | pass: 69 tests, 69 pass, 0 fail, 47 s (verifier, exit 0; the caller also measured 69) |
| 1.3, 2.7, 3.4, 4.4, 5.4, 6.6, 7.7 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" (verifier; the caller also measured it) |
| 2.7 | `node --test --test-name-pattern="^conduct" plugins/openspec/hooks/conduct-check.test.mjs` | pass: 92 tests, 92 pass, 0 fail (verifier, exit 0) |
| 2.7 | `node --test --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^install-schemas" plugins/openspec/hooks/guard.test.mjs` | pass: 10 tests, 10 pass, 0 fail (verifier, exit 0) |
| 2.7, 7.7 | `openspec schema validate devkit` | pass: "Schema 'devkit' is valid", exit 0 (verifier) |
| 2.7, 7.7 | `openspec schema validate devkit-lite` | pass: "Schema 'devkit-lite' is valid", exit 0 (verifier) |
| 2.7, 7.7 | `openspec validate flow-script-checker --strict` | pass: "Change 'flow-script-checker' is valid", exit 0 (verifier) |
| 6.6 | `node --test --test-name-pattern="^AC-6 instructions-follow" plugins/openspec/hooks/guard.test.mjs` | pass: 3 tests, 3 pass, 0 fail (verifier, exit 0) |
| 7.7 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: tests 741, pass 741, fail 0, about 520 s (caller; not re-run by the verifier) |
| 7.7 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog clean (verifier; the caller also measured exit 0) |
| 7.7 | `claude plugin validate .` | pass: "Validation passed" (caller, run through the app's bundled binary; not run by the verifier) |

These are the 11 gate parts of `tasks.md` (1.3, 2.7, 3.4, 4.4, 5.4, 6.6, 7.7), each copied as written
and de-duplicated.

### Acceptance criteria

| AC | Criterion | Proof and where it is | Result |
| --- | --- | --- | --- |
| AC-1 | every-stage-declared | Test `flow-check schema: AC-1 a new devkit change lists every stage in order` (in the 69-test flow-check run, pass). The stage list is the 14 artifacts of `docs/coordination-design.md` section 4 that leave a file (requirements, mockup, decisions, proposal, specs, design, tasks, readiness, approval, unit-tests, e2e-tests, evidence, review, retro). The schemas in `openspec/schemas/` are byte-identical to `plugins/openspec/schemas/` (`diff -r`, verifier). | pass |
| AC-2 | roles-not-tools | Tests `flow-check AC-2: no schema text names a platform tool` (forbids `devkit-core:`, `subagent_type`, `Agent tool`, `AskUserQuestion`, `Workflow tool`, `Claude` in every schema file, plugin copy and repo copy, and requires each instruction's first line to be `Role: <role>.` matching `flow.json`), `...the role document covers every role` (`docs/roles.md`, one `## <role>` per role and helper) and `...the session hook names the checker and the roles` (all pass). By hand (verifier): a grep of `plugins/openspec/schemas/` and `openspec/schemas/` for `devkit-core:`, `subagent_type`, `mcp__`, `AskUserQuestion`, `WebFetch`, `WebSearch`, `TodoWrite`, `Bash`, `Grep`, `Glob`, `Claude`, `Agent tool`, `Workflow tool` and backticked `Read`/`Write`/`Edit`/`Task` finds nothing (exit 1). A bare `Write` as an English verb ("Write requirements.md with:", schema.yaml lines 22, 51, 183, 190) does occur: it is the verb, not a tool name, and the test does not forbid it. | pass |
| AC-3 | fixed-header | Tests `flow-check header: ...` (including header validation through the walk), `flow-check schema: AC-3 every template starts with its stage header` and `flow-check AC-3: every writer of a stage file names the stage header` (all pass in the 69-test run). The header is `<!-- devkit-stage <stage> result=pending attempt=1 commit=none -->`: status, attempt and commit. | pass |
| AC-4 | checker-tells-the-truth | One test per case, all in the 69-test flow-check run (pass): failed header does not pass (`stages: a failed header does not pass its stage`); not applicable counts as passed; no stage after the implementation while a task is pending; stale stage is the only one offered again; failed stage past its ceiling ends blocked; same stage with nothing changed ends blocked (the fingerprint); every run ends in one of four states (`flow-check stages: termination simulation: every run ends in one of four states or names one next stage`); a checkbox in a fenced example is not a task (`tasks: a checkbox inside a fenced block is not a task`, `stages: a fenced example in tasks.md does not hold the implementation`). New since the last evidence and in the same run: stages of several files, a skipped artifact, `commit=none`, the merged PR seen from the change's own branch, no plan staleness after the merge, no `openspec` on PATH, schema and `flow.json` parity. The sample change below shows failed, passed, not applicable and blocked. The live proof on a real change is round 15's, as the requirements say. | pass |
| AC-5 | status-readout | Test `flow-check readout: the sample change prints the approved text` re-run by the verifier with `FLOW_CHECK_SAMPLE_DIR` set to a scratch directory (1 test, pass): it wrote `flow-check-sample.pt-BR.txt` and `flow-check-sample.en.txt`, and `diff` against the two `text` blocks of design.md D-7 (lines 462 to 512) shows no difference for either (verifier). Both outputs are recorded below. `--json` carries the same facts (`flow-check readout: --json carries the same facts`, pass; real output below). The owner reading the sample (caller's statement): on 2026-11-19 the session showed the owner the Portuguese sample of design.md D-7 in the message that asked for the plan approval, and the owner answered "Aprovo o plano", recorded in `approval.md` (Status: APPROVED, Date 2026-11-19, Owner's words "Aprovo o plano"). The verifier did not witness that message. | pass |
| AC-6 | todays-flow-still-drives | Whole suite: `node --test plugins/openspec/hooks/guard.test.mjs`, 741 of 741 pass (caller). Named tests, all in the flow-check run (pass): `AC-6: deliver-check gives the same step with and without stage headers`, `AC-6: the readiness gate reads Status under a header`, `AC-6: approvalState reads a headed approval.md`, `AC-6: conduct-check gives the same planning step with headers`; the `conduct` suite (92 of 92) and the `AC-6 instructions-follow` tests (3 of 3) pass. By hand (verifier): `deliver-check flow-script-checker` run on this very change printed 8 items, in progress at item 1 (evidence stale, which this file corrects; the round-1 reviews stale at 7013137 with findings still undisposed). Then two copies of this change folder in scratch git repositories, one as is and one with a `devkit-stage` header on line 1 of every file except `evidence.md`: `deliver-check` printed identical lines for both (same 8 items, same next step; `diff` empty), and `flow-check` read the headed copy as the new script ("roteiro devkit", stage table) and the plain copy as the previous one. Round 15 proves shipping a change created with the new script. | pass |
| AC-7 | older-change-recognised | Tests `flow-check AC-7: a folder in the previous form is recognised` and `...a schema without flow.json is the previous script` (pass). Run on this change's own folder (self-run below, verifier): exit 0, message "roteiro anterior", `stages` empty, `next` null, `end` null. The folder now also holds `review.md` and `reviews/*.md` (they begin "# Review: ..." and "Verdict: ..."); line 1 of all 13 other `.md` files here is not a stage header and `evidence.md` starts with `Commit:`; the only `devkit-stage` text is quoted inside prose or tables (tasks.md, design.md, the spec delta, proposal.md, this file's rows), never on a first line. The folder still reads as the previous script. | pass |
| AC-8 | short-script | Test `flow-check schema: AC-8 a new devkit-lite change lists the short script` (pass in the 69-test run): requirements, mockup, decisions, proposal, specs, tasks, unit-tests, e2e-tests, evidence, review, retro; no readiness, no approval, no design; mockup and decisions apply only when called for. | pass |
| AC-9 | no-ai-in-the-checker | Tests `flow-check AC-9: it imports only node built-ins and the pack's hook modules` and `...it runs with only node, git, openspec and a fake gh on PATH` (pass). By hand (verifier): `flow-check.mjs` imports `node:fs`, `node:path`, `node:url`, `node:crypto`, `node:child_process`, then `./guard.mjs`, `./deliver-check.mjs` (now also exporting `currentBranch`, `defaultBranches`, `archiveHeads`, which `flow-check.mjs` imports) and `./merge-setup.mjs`. The pack modules it pulls in import only `node:fs`, `node:path`, `node:child_process`, `node:os`, `node:url`, `node:crypto` and each other (guard.mjs has one dynamic `import('./deliver-check.mjs')`). The only external commands spawned across the four files are `git`, `openspec` and `gh`; no `fetch`, no URL in `flow-check.mjs`. | pass |

### Self-run on this change's folder (AC-5, AC-7)

Run by the verifier at 7013137. `node plugins/openspec/hooks/flow-check.mjs flow-script-checker` (exit 0):

```text
Change flow-script-checker (roteiro devkit)

Esta change começou no roteiro anterior: os arquivos dela não têm o cabeçalho de etapa. O fluxo de hoje a termina (ship-change, guiado pelo deliver-check). Este comando não para nada.
```

`node plugins/openspec/hooks/flow-check.mjs flow-script-checker --json --lang en` (exit 0):

```json
{
  "version": 1,
  "change": "flow-script-checker",
  "schema": "devkit",
  "script": "previous",
  "head": null,
  "stages": [],
  "next": null,
  "end": null,
  "previous": {
    "finishedBy": "ship-change",
    "reasonCode": "previous-script",
    "params": {},
    "reason": "the change began under the previous script: its files carry no stage header"
  }
}
```

### Sample change `add-csv-export` (AC-5)

Written by the test `flow-check readout: the sample change prints the approved text` with
`FLOW_CHECK_SAMPLE_DIR` set (files `flow-check-sample.pt-BR.txt` and `flow-check-sample.en.txt`), and
identical to the two blocks of design.md D-7. Portuguese, the one the owner reads:

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

English:

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

### Defects

None found.

### Not proved here

- `claude plugin validate .` was not run by the verifier; the result is the caller's.
- The whole `guard.test.mjs` suite was not re-run (caller's measurement, 741 of 741).
- The owner reading the sample is the caller's statement; the verifier did not witness it.
- The sample change is a test fixture, not a live change; the live proof is round 15's.
- The round-1 review is stale at 7013137 and its findings are undisposed per `deliver-check`; a new
  review round is the caller's next step, not a defect of the change.
