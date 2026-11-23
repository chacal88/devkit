<!-- devkit-stage readiness result=passed attempt=4 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Readiness review: stage-roles

Package: `openspec/changes/stage-roles/` (proposal, requirements, design at attempt 4, tasks at attempt 4, 7 spec deltas, `change-coordination` at attempt 3). Stage reached: phases 1 and 2 on disk and uncommitted; tasks 2.1 (one test), 2.4 and 2.10 still open. Fourth review; the revision for F-1 was checked against the working tree.

## Decision

- Status: APPROVED

Blockers: 0. F-1 of attempt 3 is closed.

## Scope

`correct`. Four declared-but-unrun stages, explicit non-goals. The revision adds a clause the code already holds and adds no behavior.

## Validation

`openspec validate stage-roles --strict`: valid.

## Claims about the code, verified

| Claim | Result |
|---|---|
| D-4 accept-decisions step requires `facts.approval?.ok`, not archiving, and `proposed` or `unreadable` not empty | confirmed, `plugins/openspec/hooks/change-loop.mjs:523` |
| Archive branch is `chore/archive-<id>` and sets `facts.archiving` | confirmed, `change-loop.mjs:685` and `:710` |
| Spec scenario "The change is being archived" matches the code (no step, loop goes on to the archive steps) | confirmed against `change-loop.mjs:523-528` |
| Task 2.1 names the new test, says it passes when written because the clause exists, and gives a runnable check | consistent; no such test exists yet in `change-loop.test.mjs` (grep), as the unchecked task says |
| Earlier claims (waiting-mockup, owner-changes, testStageStep, GATE_OF_WHY, T-10, T-11) | confirmed in the previous round; nothing in the revision touches them |

## Findings

### F-1 (attempt 3) closed

`design.md` D-4 lines 289-295, D-11 line 567, `specs/change-coordination/spec.md` lines 128 and 152-154 and `tasks.md` task 2.1 now carry the archive clause, its scenario and its test.

### F-2 Low, Nice to have

Task 2.4 is unchecked although its code half (`GATE_OF_WHY`) is on disk. No change needed.

## Execution-readiness test

Major doubts for the remaining work: 0.

## Top production risks (grounded in this package)

1. E2E tests in a folder the test-file rule does not know (D-6): the tester is refused and the refusal names the rule.
2. The `ui` flag missing because the grill was skipped: no mock-up; the readout says so.
3. An E2E test commit makes the unit and E2E stages stale and run twice: bounded, documented.
4. A further existing test found failing outside the T table in phases 3 and 4: the plan says to stop and have the planner add a row.
5. The new archive-branch test passes on first write, so it proves the clause only if it is shown to fail when the clause is removed; the plan keeps `proof/red-2.txt` as it is.

## Mandatory questions

1. Problem defined objectively: yes.
2. Result measurable: yes, each AC maps to tasks and tests.
3. Error behaviors defined: yes.
4. Edge cases covered: yes, including the archive branch.
5. Dependencies clear: yes.
6. Contracts defined: yes.
7. Two developers interpreting differently: no open point found.
8. Implicit decisions: none found.
9. Tasks deliver the outcome: yes.
10. Discovered too late: the real-world `ui` and E2E folder cases, proven by the first live use as the plan states.

## False-completeness check

Nothing found.
