<!-- devkit-stage readiness result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: project-phases-followups

## Decision

- Status: APPROVED

Blockers: 0. `openspec validate project-phases-followups --strict` reports the change valid.

## Blockers

None.

## Code claims checked (read at c56155334749cdc46bad077ba8f53c4bbec5d140)

- `guard.mjs#sliceProblems` (lines 208 to 262) and `sliceReviewStale` (193 to 205): chain, messages and the single `try` for the base are as the design says; `recorded.uncommitted` is never read there.
- `project-loop.mjs#readVerdict` (64 to 72): `usable` ignores the marker; `reviewPart` (205 to 209) and `archivedPart` (221, 222) read `usable`; `recordReviewCommand` (523 to 544) has the four refusals in the stated order.
- `change-loop.mjs` `why.other-commit` exists at 266 (en) and 442 (pt-BR); the pin assertions are at `change-loop.test.mjs` 2478 and 2479.
- `sliceProblems` has exactly two non-test callers (`deliver-check.mjs:1582`, `guard.mjs:697`), so A-1 holds.
- `deliver-check.mjs#staleness` (204) uses the same marker wording the plan copies.
- `facts.dirty` excludes `openspec/`, so a verdict file written by `verdictFor` does not send test 9 (active) to the commit agent first.
- Test helpers named in D-4 exist (`GUARD` and `CL` are module imports); the three anchor tests and the two deliver-check pin tests exist under those names.
- `docs/openspec-flow.md` lines 323, 578, 579 and 588, `plugins/openspec/README.md` line 20, the versions 0.21.1 and 0.25.1, and the roadmap line of round 19b match the plan.
- Base gates: `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` pass on the base. The long suite is left to the implementer's task 2.4.

## Scope

correct. Non-goals are explicit and tight.

## Findings by section

- Proposal: no findings.
- Design: no findings. Every outcome row (marker at contract, hook, record-review, next, merge with ADR, no base, bad header) has a test and a spec scenario.
- Specs: no findings.
- Tasks: no findings. Each AC maps to a task and a command; red-first run is a check, not a gate.
- Omissions: no findings (rollout, rollback and the pin risk are written).

## Low notes (fix during implementation, not blockers)

- Low, Nice to have: `tasks.md` 2.1 asks for `<date>` the day it is written; fine, but the implementer should use the actual date, not copy the plan's.

## Mandatory questions

1. Problem defined: yes. 2. Measurable: yes (ten named tests, numstat checks). 3. Error behavior: yes (exit codes, messages). 4. Edge cases: yes (marker on an unresolved sha, root-commit base). 5. Dependencies: clear. 6. Contracts: yes (messages and keys written). 7. Divergent interpretation: unlikely, texts are given. 8. Implicit decisions: none found. 9. Tasks deliver the outcome: yes. 10. Discovered late: a fixture that does not build as D-4 says, which task 1.1 settles before the fix.
