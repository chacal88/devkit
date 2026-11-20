Commit: b56cf3dab9914acf99121ba364863004ff5fb053

# Evidence: flow-script-checker

Verified on branch `flow-script-checker` at the commit above, tree clean (no uncommitted work).
This file carries no stage header on purpose: this folder is the previous-script folder that proves
AC-7 (tasks.md 7.5, design.md D-12). Numbers below were counted by the verifier at this commit,
unless marked "caller", which means measured by the conducting session on the same tree
(same content as the commit; the commit was made right after and changed nothing).

## Verification

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.3, 2.7, 3.4, 4.4, 5.4, 6.6 | `node --test --test-name-pattern="^flow-check" plugins/openspec/hooks/flow-check.test.mjs` | pass: 60 tests per caller; re-run by the verifier, exit 0, fail 0, 45 s |
| 1.3, 2.7, 3.4, 4.4, 5.4, 6.6, 7.7 | `python3 scripts/check.py` | pass: exit 0, "all checks passed" |
| 2.7 | `node --test --test-name-pattern="^conduct" plugins/openspec/hooks/conduct-check.test.mjs` | pass: 92 tests, 92 pass, 0 fail (verifier re-run, exit 0, 93 s) |
| 2.7 | `node --test --test-name-pattern="^AC-6 instructions-follow" --test-name-pattern="^install-schemas" plugins/openspec/hooks/guard.test.mjs` | pass: 10 tests, 10 pass, 0 fail (verifier re-run, exit 0) |
| 2.7, 7.7 | `openspec schema validate devkit` | pass: "Schema 'devkit' is valid", exit 0 |
| 2.7, 7.7 | `openspec schema validate devkit-lite` | pass: "Schema 'devkit-lite' is valid", exit 0 |
| 2.7, 7.7 | `openspec validate flow-script-checker --strict` | pass: "Change 'flow-script-checker' is valid", exit 0 |
| 6.6 | `node --test --test-name-pattern="^AC-6 instructions-follow" plugins/openspec/hooks/guard.test.mjs` | pass: 3 tests, 3 pass, 0 fail (verifier re-run, exit 0) |
| 7.7 | `node --test plugins/openspec/hooks/guard.test.mjs` | pass: tests 732, pass 732, fail 0, about 522 s (caller; not re-run by the verifier, 9 minutes) |
| 7.7 | `python3 scripts/gen-catalog.py --check` | pass: exit 0, catalog clean (verifier re-run) |
| 7.7 | `claude plugin validate .` | pass: "Validation passed" (caller; the verifier could not re-run it: the `claude` wrapper on this machine answers "permission denied", exit 126, with and without the sandbox) |

The gate commands above are the 11 that the installed `deliver-check` (devkit-openspec 0.9.1 from the
plugin cache) lists for this change, so this very change is still driven by the installed pack.

### Acceptance criteria

| AC | Criterion | Proof and where it is | Result |
| --- | --- | --- | --- |
| AC-1 | every-stage-declared | Test `flow-check schema: AC-1 a new devkit change lists every stage in order` (in the flow-check run, pass). By hand: schemas installed with `install-schemas.sh` into a scratch project, `openspec new change demo --schema devkit`, `openspec status --change demo --json` lists 14 artifacts: requirements, mockup, decisions, proposal, specs, design, tasks, readiness, approval, unit-tests, e2e-tests, evidence, review, retro. These are the 14 stages of `docs/coordination-design.md` section 4 that leave a file (stages 1 and 13, open the change and delivery, leave none), in the table's order. | pass |
| AC-2 | roles-not-tools | Tests `flow-check AC-2: no schema text names a platform tool`, `...the role document covers every role` (reads `docs/roles.md`, one `## <role>` heading per role and helper in both `flow.json`) and `...the session hook names the checker and the roles` (all pass). By hand: a grep of `plugins/openspec/schemas/` for tool names (Read, Write, Edit, Bash, Grep, Glob, WebFetch, Task, AskUserQuestion...) used as tools, `devkit-core:`, `subagent_type` and `mcp__` finds nothing (grep exit 1). | pass |
| AC-3 | fixed-header | Tests `flow-check header: ...`, `flow-check schema: AC-3 every template starts with its stage header` and `flow-check AC-3: every writer of a stage file names the stage header` (pass). By hand: line 1 of all 14 templates of `devkit` and all 11 of `devkit-lite` is `<!-- devkit-stage <stage> result=pending attempt=1 commit=none -->`, which carries status, attempt and commit. | pass |
| AC-4 | checker-tells-the-truth | One test per case, all in the flow-check run (pass): failed header does not pass (`stages: a failed header does not pass its stage`); not applicable counts as passed; no stage after the implementation while a task is pending; stale stage is the only one offered again; failed stage past its ceiling ends blocked; same stage with nothing changed ends blocked; every run ends in one of four states (`stages: every run ends in one of four states or names one next stage`); a checkbox in a fenced example is not a task (`tasks: a checkbox inside a fenced block is not a task`, and `stages: a fenced example in tasks.md does not hold the implementation`). The sample change output below shows failed, passed, not applicable and blocked on a real run. The live proof on a real change is round 15's, as the requirements say. | pass |
| AC-5 | status-readout | Self-run and sample outputs recorded below. Test `flow-check readout: the sample change prints the approved text` pins the text of design.md D-7; the verifier compared the sample files with D-7 and the Portuguese and English sample outputs are identical to the pinned blocks (17 stage lines, next stage, who runs it, why). `--json` carries the same facts (`flow-check readout: --json carries the same facts`, pass). The owner reads the Portuguese output at plan approval. | pass |
| AC-6 | todays-flow-still-drives | Whole suite: `node --test plugins/openspec/hooks/guard.test.mjs`, 732 of 732 pass (caller). Named tests, all pass in the flow-check run: `AC-6: deliver-check gives the same step with and without stage headers` (10 step kinds, same step with and without headers), `AC-6: the readiness gate reads Status under a header`, `AC-6: approvalState reads a headed approval.md`, `AC-6: conduct-check gives the same planning step with headers`; the `conduct` suite (92 of 92) and the `AC-6 instructions-follow` tests (3 of 3) pass. This change is driven today by the installed `deliver-check` 0.9.1 (it printed 8 items for this change at head b56cf3d and asked for the missing reviews and evidence). Round 15 proves shipping a change created with the new script. | pass |
| AC-7 | older-change-recognised | Tests `flow-check AC-7: a folder in the previous form is recognised` and `...a schema without flow.json is the previous script` (pass). Run on this change's own folder, which has no stage header in any file (line 1 of every stage file here is a title, the only `devkit-stage` comment is a quoted example in design.md line 107): see the self-run below. Exit 0, message "roteiro anterior", `stages` empty, `next` null, `end` null. The output equals the implementer's proof files byte for byte. | pass |
| AC-8 | short-script | Test `flow-check schema: AC-8 a new devkit-lite change lists the short script` (pass). By hand: `openspec new change short --schema devkit-lite` then `openspec status --json` lists 11 artifacts: requirements, mockup, decisions, proposal, specs, tasks, unit-tests, e2e-tests, evidence, review, retro. No readiness, no approval, no design; mockup and decisions are the ones that apply only when called for. | pass |
| AC-9 | no-ai-in-the-checker | Test `flow-check AC-9: it imports only node built-ins and the pack's hook modules` (scans the source and proves the scan catches an SDK import, a `claude` run, a shell run, a fetch and a dynamic import) and `...it runs with only node, git, openspec and a fake gh on PATH` (PATH holds only those four; same JSON as with the full PATH) pass. By hand, the imports of `plugins/openspec/hooks/flow-check.mjs` are `node:fs`, `node:path`, `node:url`, `node:crypto`, `node:child_process`, then `./guard.mjs`, `./deliver-check.mjs`, `./merge-setup.mjs`. The only external commands are `openspec` (line 111) and `git` (lines 159, 181, 188); no `fetch`, no URL. | pass |

### Self-run on this change's folder (AC-5, AC-7)

`node plugins/openspec/hooks/flow-check.mjs flow-script-checker` (exit 0):

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

Produced by the test `flow-check readout: the sample change prints the approved text` (task 7.5, files
`flow-check-sample.pt-BR.txt` and `flow-check-sample.en.txt` in the implementer's proof folder).
Portuguese, the one the owner reads:

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

- `claude plugin validate .` was not re-run by the verifier (the `claude` wrapper gives "permission denied"); the result is the caller's.
- The whole `guard.test.mjs` suite was not re-run (caller's measurement, 732 of 732).
- The sample change is a test fixture, not a live change; the live proof is round 15's.
