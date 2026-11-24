<!-- devkit-stage readiness result=passed attempt=3 commit=77b15b107e15b2071ba2de372fa75eb23daa390f -->
# Readiness review: compozy-driver

## Decision

- Status: APPROVED

Blockers: 0. Round 3 reviews the plan as revised on 2026-11-22 for `main` at `77b15b1` (design
"Revision 2026-11-22"); the round 2 verdict was for base `c561553`.

## Package

Proposal, design (D-1 to D-19, Context, Revision), tasks (6 phases, AC table), seven spec deltas,
`requirements.md`. `openspec validate compozy-driver --strict`: valid. Stage reached:
ready-for-implementation, pending the owner's approval of the revision (see Findings).

## Scope

`correct`. The revision adds the mock-up gate, the `command` kind and the ADR 0016 amendment, each
tied to a main change since the first approval; the approach and AC-1 to AC-12 are unchanged and
the non-goals are explicit.

## Blockers (Mandatory before implementation)

None.

## Findings

- Low, Fix during implementation. `openspec/changes/compozy-driver/approval.md` is from 18:05 and
  the plan files changed at 23:10 to 23:13. The owner's approval covers the plan before the
  revision; the session that conducts the change must ask for it again on the revised plan before
  `implement`, as the gates require. Not a plan defect.
- Low, Nice to have. The capability `compozy-kit-setup` keeps main's requirement "A re-run updates
  the files the project did not edit" unmodified; it still holds for the new file set.

## Claims checked against code (77b15b1)

- `DRIVER_ROUND = { compozy: 21, script: 22 }` at `change-loop.mjs:1059`; `projectGate` at
  `:1069-1075`; `PACKS` at `:1420-1425` has 18 `devkit-core` roles plus `openspec-validator`, 19
  keys; `NOT_AGENTS` at `:1413` holds `change-coordinator`, so adding it to `PACKS` opens nothing
  to a Claude hand-off (`scriptAgents` filters it, `handOffFor` `:1456`). Line counts 1622, 973 and
  972 match; `install-kit.mjs` has 188 lines and `templates/agents` holds the four old shells.
- The round-16 facts hold: `waiting-mockup` at `:705-706`, `accept-decisions` at `:659-664`,
  `switch-script` at `:681-684`, `resolve-release-conflict` and `push-rebased` rows at `:555`,
  `:560`, `enable-auto-merge` as a session row at `:565`; `stop-mockup-approval` and
  `stop-plan-approval` rows at `ship-change/SKILL.md:37-38`.
- Tests named in D-19 exist at the cited anchors: `change-loop.test.mjs:946`, `:1114`, `:2082`,
  `:2199` (its bare list is today `['change-coordinator', 'owner', 'review-bench']`, so T-6's new
  list is right), `:3201`, `:3221`; `roadmap-loop.test.mjs:783`. `guard.test.mjs` does not import the
  compozy suites today, as the plan says. Both `test-tmp.mjs` helpers exist.
- Versions today are devkit-openspec 0.22.1, devkit-compozy 0.3.1, marketplace 0.26.1, CHANGELOG
  top entry `0.26.1`; the CI snippet pins `v0.22.1` at `docs/openspec-flow.md:594`, `:595`, `:604`;
  `docs/roles.md:41` has the `project-coordinator` sentence the plan edits; ADR 0016 has its
  `Amends:` and `Accepted by:` lines and the highest ADR is 0016, so 0017 is free today.
- The REMOVED requirements of `compozy-kit-setup` and the MODIFIED requirement of `change-stages`
  exist in main's specs under the same names.
- Every D-3 row added by the revision (`mockup`, `command`, `open-failed`, the other owner waits)
  has a scenario in `specs/compozy-driver/spec.md` (mock-up approve and changes, the command and
  its refusal, answers for a question not asked).
- Base gates run: `python3 scripts/check.py` passes and `python3 scripts/gen-catalog.py --check`
  exits 0. Gates that need new files do not exist on the base, as the plan says; the full suite is
  a long gate run by the caller.
- CompozyOS 0.6.2 behaviours cannot be checked here; phase 1 probes them with an explicit "stop"
  rule before any code phase. Accepted as a discovery task.

## Mandatory questions

1. Problem defined: yes. 2. Measurable: yes (AC table, proof map with proved-here versus dogfood).
3. Error behaviors: defined in D-3 to D-6 and the specs. 4. Edge cases: covered (edited retired
files, old kit, missing record, empty request, red test stage). 5. Dependencies: clear (rounds 15,
16, 18, CompozyOS 0.6.2). 6. Contracts: view, record, CLI and agent contracts are written. 7. Two
interpretations: none found that changes behavior. 8. Implicit decisions: none found. 9. Tasks
deliver the outcome: yes, test first in each phase. 10. Discovered late: a CompozyOS semantic
that differs from its guide, caught by phase 1.

## Top production risks

1. A seat that skips the hand-off: mitigated by the hooks and the generated-agent check.
2. P-1 fails and the approval lock is inert: the record-step refusal is the only guard, specified
   and tested.
3. The read agent miscopies the view: `confirm` compares every field.
4. The review loop's file exchange breaks a round: P-4, rerun from files; the failed round is
   specified.
5. Reinstall over an edited old kit: the kept-and-named rule is specified and tested.
