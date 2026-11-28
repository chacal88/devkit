<!-- devkit-stage readiness result=failed attempt=6 commit=db6342b8aa8a1ef653e7729f1f1eb883c68419ed -->
# Readiness review: helper-conductor

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no, until the two blockers of section 9 are fixed in `design.md` and `tasks.md`

Round 6, on db6342b (the commit "fix the add-only split of helper-conductor"). Changed since round 5 (a1afda4): `design.md` (D-3 and D-4 interim-copy lines), `tasks.md` (2.1, 2.14, 2.14a, 2.17). `openspec validate helper-conductor --strict` passes. No fetch was run.

## 2. Scope validation
Classification: correct. The edits move work between tasks and add no behaviour.

## 3. Proposal review
No findings.

## 4. Design review
Round 5's three blockers, re-checked:
- Interim copy: D-3 (`design.md:196-197`) and the new D-4 bullet (`design.md:296-305`) say `commonDirOf`, `localRunFilePath`, `localFacts` and `tickReady` live in `tick-gate.mjs` until 2.1, and 2.1 (`tasks.md:112-137`) moves them and deletes the copy. Closed.
- Ledger split: 2.14a owns `test-slots.mjs` and all eight ledger cases; the export list matches D-25's "ledger module's contract" (`design.md:1116-1130`); `withLockFile` is exported from `change-loop.mjs:2388`. 2.14 adds no ledger case. Closed.
- The pointer fix reads correctly. Closed.

The tension the planner flagged is real and is blocker 1. The new interim copy also opens blocker 2.

## 5. Specs review
No findings. The spec delta did not change.

## 6. Tasks review
Add-only check: 2.2, 2.3, 2.14a, 2.17 and gate 2.18 create only new files and `scripts/test-map.json` keys. Imports come from `change-loop.mjs`, `roadmap-loop.mjs` and `guard.mjs`, and none of those files is edited. This holds. `plugins/openspec/hooks/standing-answers.mjs`, `request-file.mjs`, `tick-gate.mjs` and `test-slots.mjs` do not exist yet, so they are new. `release.md` exists and no task bumps a version.

## 7. Omission detection
See findings 1 and 2.

## 8. Claims against code
- `readRun` (`run-file.mjs:32-35`) returns `emptyRun()` on a missing file, a parse error or a non-object. It cannot tell "missing" from "broken".
- `limitOf` is at `roadmap-loop.mjs:66`, exported; `DEFAULT_LIMIT` at `:63` is not exported. `roadmap-loop.mjs` imports `guard`, `flow-check`, `deliver-check`, `merge-setup` and `compozy-driver` (`:45-55`).
- `findRoot` (`guard.mjs:81`) and `optedIn` (`guard.mjs:432`) are exported.

## 9. Findings

### Finding 1: a broken run file is `no-task` (block) in D-3 and "prints nothing" in D-4 and 3.1
- Severity: Critical. Fix class: Mandatory before implementation.
- Artifacts: `design.md:249` (D-3: "a missing, empty or non-JSON run file is `emptyRun()` (no task, rule 1)"); `design.md:262-264` (D-4: the envelope path calls `readRun(localRunFilePath(root))`; "any parse error ... print nothing"); `tasks.md:330` (3.1: "a broken run file ... print nothing"); `tasks.md:291` and `design.md:299` (2.17: raw read, broken prints nothing); `tasks.md:129-131` (2.1: the hook's process cases "pass unchanged" after it switches to `readRun`).
- Why it matters: 2.17 can satisfy the case, because it parses the JSON itself. After 2.1 the hook gets `readRun`, which maps a broken file to `emptyRun()`, so `tickReady` gives `no-task` and the hook blocks. The "broken run file prints nothing" process case then fails. 2.1 says that case passes unchanged, so 2.1 cannot be done as written. A developer has to choose between changing `readRun`, keeping a second raw parse in the hook, or changing the case.
- Smallest correction: pick one rule and write it in D-3, D-4, 2.1 and 3.1. Either (a) a broken file blocks like a missing one, and the case moves to the blocking list in 2.17 and 3.1, or (b) the hook keeps its own `JSON.parse` of the file (missing gives the empty run, unparseable prints nothing) and only then calls `tickReady`, with 2.1 saying so, and D-3's line reads "a missing or empty file; the hook prints nothing for a file that does not parse". The planner may judge which one the owner wants; (b) keeps the tested behaviour of 2.17 and the fail-open posture of a gate hook.

### Finding 2: 2.17's `limitOf` import has no form that fits D-4 and `localFacts`
- Severity: High. Fix class: Mandatory before implementation.
- Artifacts: `tasks.md:291-292` ("`limitOf` imported from `roadmap-loop.mjs`", while `findRoot` and `optedIn` are said to be dynamic); `design.md:257-258` ("Node built-ins at the top; ... by a dynamic `import()` only once the raw text matched, so any other prompt loads nothing"); `design.md:179-181` (D-3: `localFacts(root, run, env)` is synchronous and calls `limitOf`).
- Why it matters: a static import of `roadmap-loop.mjs` at the top of `tick-gate.mjs` loads the whole `change-loop` import graph on every prompt of every session, which breaks D-4's no-load rule. A dynamic import cannot feed a synchronous `localFacts`. Two developers will choose differently, and the test of "any other prompt loads nothing" has nothing to check against.
- Smallest correction: state the form. For example, the interim copy holds its own three-line `limitOf` and `DEFAULT_LIMIT` (deleted by 2.1 with the rest), or `tick-gate.mjs` takes `limit` as a parameter of `localFacts` that the hook passes after its dynamic import. Add the line to 2.17 and to the D-4 interim bullet.

## 10. Execution-readiness test
Two major doubts for phase 2's add-only part (findings 1 and 2). Under the limit of three, but both change behaviour, so neither can wait.

## 11. Top production risks
1. A broken run file blocks every prompt in a project, or lets a dead run fire ticks, depending on which reading wins (finding 1).
2. The hook loads the whole loop module graph on each prompt and slows every session's prompts (finding 2).
3. Interim and final copies of `localFacts` drift if 2.1 does not run in the same commit as the deletion; D-4 and 2.1 both require that, so the risk is covered.
4. Ledger waits of 15 seconds hold gates while a train waits: covered by 2.14a's cases.
5. The hook's 10-second timeout with the fixture of a slow disk: 3.1 records the time; covered.

## 12. Mandatory questions
1. Problem objectively defined: yes. 2. Result measurable: yes. 3. Error behaviours defined: no for a broken run file (finding 1). 4. Edge cases covered: yes apart from finding 1. 5. Dependencies clear: yes, order paragraph of phase 2. 6. Contracts defined: yes, D-25's ledger contract; the hook's `limitOf` source is not (finding 2). 7. Two developers differ: yes, on findings 1 and 2. 8. Implicit decisions: the same two. 9. Tasks deliver the outcome: yes once fixed. 10. Found too late: the broken-file case failing when 2.1 lands.

## 13. Verdict
NEEDS-REVISION. Fix findings 1 and 2 in `design.md` and `tasks.md`; no other change is needed, and the add-only split itself holds.
