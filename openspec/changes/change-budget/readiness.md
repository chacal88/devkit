<!-- devkit-stage readiness result=passed attempt=1 commit=c56155334749cdc46bad077ba8f53c4bbec5d140 -->
# Readiness review: change-budget

## Decision

- Status: APPROVED

Blockers: 0. `openspec validate change-budget --strict` passes. The plan is implementable without a
question that changes behaviour or scope.

## Scope

Correct. The problem (no per-run spend control), the in-scope setting, count, stop and resume, and the
non-goals (status display, dollars, cross-session sums, roadmap coordinator, CompozyOS block) are
explicit in `proposal.md` and `requirements.md`. The specs add nothing the proposal does not justify.

## Claims checked against the code (at c561553, HEAD c561553 plus the untracked change folder)

- `change-loop.mjs#readDevkitSettings` (63 to 88), `plainValue` (51), `LoopRefusal` (41): as described.
  The block loop is moved as is by D-1.
- `decide` (600), `guard` (623), `agent` (637) and `sessionAction` (641) wrap `guard`, so `hold` over them
  puts the no-progress end first, as the spec scenario says.
- `nextAction` (772) takes `{ env, lang, after, openspec, gh }`; `dir` is computed at 783; callers
  `stopDecision` (1234), `runWait` (1414) and `roadmap-loop.mjs` (550, 852, 895) pass no budget option;
  `runNext` (1363) is the only one to opt in.
- `guard.mjs#transcriptEvents` (521), `runOf` (495, closure `markers` at 497), `marksOf` (547): as
  described; `homedir`, `basename` and `dirname` are already imported (50 to 52).
- `roadmap-loop.mjs#GATE_OF_WHY` (82) and `gateOf` (90): an unknown `waiting-` key throws, so the added
  entry is needed. The existing tests D-8 names exist: `change-loop.test.mjs` 117 (`EXEMPT_EQUAL` 126),
  2444 (pin at 2478), `roadmap-loop.test.mjs` 577; `readCounter` at 1689; `SET` at 28; helpers at
  1541 to 1570.
- Release numbers: devkit-openspec 0.21.1 and marketplace 0.25.1 on the base; the three `v0.21.1` lines
  of `docs/openspec-flow.md` are 578, 579, 588.
- `guard.test.mjs` imports `change-loop.test.mjs` and `roadmap-loop.test.mjs` (17, 18), so the 2.7 gate
  patterns reach them.

No claim failed.

## Gates run on the base

`python3 scripts/check.py` (passed), `python3 scripts/gen-catalog.py --check` (exit 0),
`claude plugin validate .` (passed), `^change-loop lock` of `change-loop.test.mjs` under
`GITHUB_HEAD_REF` (50 of 50). The full suite (3.2) is long and left to the caller.

## Findings

No Critical, High or Mandatory findings.

- Low, Fix during implementation: `specs/change-coordination/spec.md` scenario "A new session" has no
  named test in `design.md` D-9. It follows from the "before the first run line" and "another change's
  run line" count tests, so no revision is needed; add a one-line test if the implementer wants it pinned.
- Low, Nice to have: D-8 and the Alternatives table leave the `x-devkit:` block (silences the CLI notice)
  to the owner at plan approval. It is a choice the owner may make; it does not block the build.

## Mandatory questions

1. Problem defined: yes. 2. Measurable: yes, AC-7 gives an exact sum (7525). 3. Error behaviour: yes
(invalid value exits 3, unreadable transcript fails open). 4. Edge cases: yes (split lines, sidechain,
missing fields, subagent start, no session id). 5. Dependencies: clear (`managed-agents-study` is
archived). 6. Contracts: yes, in D-1 to D-5 with exact functions and message texts. 7. Two readings:
none found. 8. Implicit decisions: none found. 9. Tasks deliver the outcome: yes, each AC maps to tasks
and tests in the table. 10. Found too late: only the live presence of `CLAUDE_CODE_SESSION_ID` in a
real host, which task 1.4 and the dogfood follow-up cover, and the design fails open.

## Top risks

1. No session id in the host's Bash environment, so no cap applies (fail open; task 1.4; docs row).
2. The transcript's stored form moves (one reader, D-3).
3. A hook test green locally and red on CI (gates run with `GITHUB_HEAD_REF` set).
4. A sibling change edits the same message table or version (take the next version at merge).
5. A large transcript slows `next` (only with a cap; task 1.4 records the time).
