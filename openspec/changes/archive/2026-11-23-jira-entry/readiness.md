<!-- devkit-stage readiness result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: jira-entry

## Decision

- Status: APPROVED

Blockers: 0. `openspec validate jira-entry --strict` passes. An implementer can build every task from
`design.md` D-1 to D-11 without a design choice, and every AC-1 to AC-10 has tasks and a named test.

## Scope

Classification: correct. In and out of scope are explicit (`proposal.md` "What Changes", non-goals);
the one ADR touch (the task-source setting of ADR 0010 decisions 1 and 8) is a dated Note and is
flagged for the owner at approval, not hidden.

## Claims checked against the code

- `startMode` (`change-loop.mjs:955`) has the `/^\S+$/` branch at 977 after the `unfinished` list, so a
  task branch before it (D-2) fits; `parseStart` gives `text: 'PROJ-482'` (936). Confirmed.
- `requirementsFor` (1011) holds the quoting that D-4 moves; `openChange` (1068) and `runOpen` (1390)
  do not take `gh` today, as D-4 says; `main` and `isMain` (1429, 1482) read stdin only for `start` and
  `open`, which D-7 extends to `write-back`.
- `nextAction` (772) builds the delivery report only inside `inDelivery`; `buildReport` returns
  `pr: { number, url }` (`deliver-check.mjs:1336`). `deliveredPr` as D-6 plans is feasible.
  `loopOutput` (1358) prints the whole action, so new fields reach the session.
- `decisionKey` (1166) reads only kind, end, agent, step, reply: new fields cannot change a wait.
- `archivedOnDefault` (866), `filesLanguageOf` (951), `readDevkitSettings` (63), the common-dir
  fallback of `withOpenLock` (1056) and `roadmap-loop.mjs#runFilePath` (435) exist as described.
- `hooks.json` matchers are Edit|Write|..., Bash and Agent only; no MCP matcher.
- The test fixtures the plan names exist (`SET`, `cleanEnv`, `snapshot`, `addChange`, `deliveredChange`
  at 752 without a `requirements` parameter, `readRepo`, `skillText`, and the two tests named at 2374
  and 2444). `docs/openspec-flow.md` has `v0.21.1` on three lines (578, 579, 588). Versions 0.21.1,
  0.9.0 and 0.25.1 match. Roadmap round 20 and the project-phases Note of ADR 0010 are where the plan
  says.
- Gates run here: `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` are green on
  the base. The long gates (the change-loop suite of 2.4 and the guard suite of 4.6) did not finish in
  my budget on a loaded machine; the caller runs them. A red one would then be a finding.

## Findings

- Low, Fix during implementation. `design.md` D-6 says `task: { key, link }` "when `recordedTask` is
  not `null`" but not whether the key is absent or `null` otherwise. Existing `next` tests must pass
  unchanged, so absent is the safe reading; the test of task 3.1 ("same kind, end, step... with and
  without a task") should also assert the key is absent for a change with no task.
- Low, Nice to have. `design.md` D-3 and "Assumptions": the connector's tool names and field shapes
  are not verified here. The plan says so, keeps the script blind to that shape, and assigns it to
  the live follow-up (AC-10). Safe as scoped.

## Omissions

No findings. Validation, error behaviour, idempotency (the answer is recorded before the write), the
archive race, legacy records (a corrupt record asks nothing), rollback and test strategy are defined
in D-1, D-4, D-7 and "Migration Plan". Every outcome of the decision tables of D-2, D-4 and D-7 has a
scenario in `specs/jira-tasks/spec.md`.

## Mandatory questions

1. Problem objectively defined: yes.
2. Result measurable: yes, AC-1 to AC-10 map to named tests.
3. Error behaviours defined: yes (D-1 broken input, D-4 refusals, D-7 `why` codes).
4. Edge cases covered: yes (archived key, reused id, quoted `Jira:` text, no transitions).
5. Dependencies clear: yes.
6. Contracts defined: yes, the JSON inputs and outputs are spelled out.
7. Can two developers interpret this differently: only the Low finding above.
8. Implicit decisions: none found.
9. Tasks deliver the outcome: yes.
10. Discovered too late: the connector's real tool names and description format, deliberately
    deferred to `jira-entry-live`.

## Top production risks

1. The connector's shape differs from D-3: the session's mapping fails and nothing is opened (the
   AC-3 path).
2. The description arrives as Atlassian Document Format: it is quoted as received; the live proof
   checks it.
3. The grill rewrites the `Jira:` line: resume and write-back stop working; both skills forbid it and
   a test pins the text.
4. The yes rests on session discipline, with no hook: flagged for the owner.
5. A lost record in another clone asks the question again: accepted, since nothing is written
   without a yes.
