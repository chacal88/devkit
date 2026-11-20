Verdict: rejected
Commit: 07a85c411ee58cafd43ddd663a9176eb821b5c65

## Spec review — flow-script-checker

### Findings
- [important] specs/change-stages/spec.md (Requirement: A stale stage runs again alone); plugins/openspec/hooks/flow-check.mjs (staleAfter handling) — The spec delta defines staleness only for a stage after the implementation (header commit behind a product commit) and for the approval after a new readiness. Readiness going stale when a plan file is newer, and the decision to skip that mtime check once any task is ticked, appear in no requirement or scenario. The change resolved this silently, so extend the delta with a plan-stage staleness requirement or drop the behaviour.
- [important] specs/change-stages/spec.md (Requirement: Every run ends in one of four states); flow-check.mjs delivery rows and flow-check.test.mjs DELIVERY_ROWS — The spec delta has one delivery scenario (pending checks wait on GitHub). The checker implements and tests much more: ship plan, pr and merge modes, no PR, a head not pushed, failing and unreadable checks, owner merges, auto-merge, closed PR blocks, and resuming at the retro after a squash merge with staleness checks skipped (decision 5). Requirements A-5 names the delivery models but no spec scenario states these behaviours.
- [important] requirements.md A-8; specs/change-stages/spec.md (Requirement: The readout is plain text); flow-check.mjs checkOpenspecVersion — The checker refuses an OpenSpec other than 2.x with exit 3, and a missing CLI or an OpenSpec answer without artifacts also gives exit 3. This lives only in the A-8 assumption and the tests; the spec delta's exit-code scenario says only 'a usage error'. The four install lines moved to `@2` (decision 7) are likewise outside the delta. Add the version rule to the spec or state that it is design only.
- [nit] specs/change-stages/spec.md (Scenario: A failed header does not pass its stage); flow.json onFail — The spec says a failed stage offers no later stage. The checker offers the declared fix stage (`onFail`, for example the implementation) and then the failed stage again. This is an earlier stage, so it does not contradict the spec, but the spec never says it. A failed stage must still give a next stage under the four-states requirement, so this is probably an intended extension that the spec forgot to record.
- [nit] evidence.md AC-5 row; requirements.md AC-5 — AC-5 asks that the sample readout be shown to the owner, who reads it. The evidence records the verifier comparing the samples with D-7, not the owner reading them. Record the owner's reading before delivery.
- [nit] docs/adr/0010-openspec-as-the-harness.md (new Note, lines 20-22) — The change adds a dated note to a recorded ADR about fenced task lines. It says decisions 1 to 8 are unchanged and reverses nothing, so there is no escalation. The owner should know ADR text was touched, since no requirement asks for it.

In-scope specs: `/Users/kauesantos/Documents/devkit/.claude/worktrees/panel-conduct-view-404c57/openspec/changes/flow-script-checker/specs/change-stages/spec.md` (the delta, the only spec; the project has no canonical specs under `openspec/specs/`). I also read `requirements.md` (AC-1 to AC-9, A-1 to A-8) and `docs/adr/0010-openspec-as-the-harness.md`.

### Coverage
| Requirement | Status |
|-------------|--------|
| The devkit schema declares every stage that leaves a file | covered. 14 artifacts in the order the spec lists, and `apply` requires `approval`. |
| The short script keeps the grill and has no separate plan approval | covered. 11 artifacts, no design, readiness or approval. |
| Each schema declares its stages with roles, not tools | covered. Both `flow.json` files match their schemas, `docs/roles.md` has a section for every role and helper, and `grep` finds none of the forbidden words in `plugins/openspec/schemas`. |
| Every stage file opens with the stage header | covered. All templates of both schemas start with the header, naming their own stage with `result=pending`, and the malformed-header case is tested. |
| Today's flow reads a change written with the header | covered. Tests for the same `deliver-check` step, the readiness gate, `approvalState` and `conduct-check`. |
| The checker reports each stage from headers and facts, never prose | covered. Failed, not-applicable and unshipped-role scenarios each have a test. |
| No stage after the implementation while a task is pending | covered, including the fenced example. |
| A stale stage runs again alone | covered for the post-implementation case, which has a test. Staleness before the implementation is unspecified (F1). |
| Attempt ceilings and no progress stop the run | covered. Tests for the ceiling and for `--after` with nothing changed. |
| Every run ends in one of four states or names the next stage | covered for the owner's approval, the stale approval, the unshipped-role pending file, archived and pending checks. The rest of the delivery is outside the spec (F2). |
| The readout is plain text in Portuguese or English | covered. Exit codes 0, 1, 2 and 3 match the scenario; `--lang` defaults to pt-BR and `--json` is tested. The version refusal is not in the spec (F3). |
| A change begun under the previous script is recognised | covered. Both the no-header folder and the schema-without-`flow.json` case have tests. |
| The checker needs no AI | covered. The source imports only Node built-ins and the pack's own hook modules, and a test runs it on a restricted PATH. |

### Implementer decisions
- (1) Skipping the mtime staleness check once a task is ticked is unspecified and resolved silently (F1).
- (2) A pending file of an unshipped role ending `unshipped-role-pending`, and `approval-stale` only for a stale `approval.md`, matches the scenario 'No next stage names a role that cannot act'.
- (3) Rule 6 keeping `next` away from `owner` and unshipped roles is the same requirement, so it is consistent.
- (4) An archived change reading its schema only from its own `.openspec.yaml` matches 'An archived change': no OpenSpec status is asked for.
- (5) Skipping staleness checks after a merge on a foreign branch is outside the spec (F2).
- (6) The checker's own git helpers are an implementation detail and do not touch the spec.
- (7) The `@2` pin and CI `2.0.0` are in A-8, but the delta does not cover the version refusal (F3).

### Scope creep
No item is blocking. Edits to `plugins/core` agents, `ship-change` and `conduct` skills, `guard.mjs` session text and `docs/` are the stage-header writers (decision OD-1), the AC-2 role text and documentation, all traced to requirements. The `conduct-check.mjs` change reads `flow.json` to keep `/conduct` driving, as A-3 and D-10 state.

### Summary
6 findings (0 scope creep, 3 spec-delta gaps of behaviour built without a requirement: F1 to F3; 0 gaps against a required scenario; 3 nits).
