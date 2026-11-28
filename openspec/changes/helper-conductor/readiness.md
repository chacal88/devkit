<!-- devkit-stage readiness result=passed attempt=7 commit=76eba5a7f690d8f6c26784e69d29b18f2a4e9323 -->
# Readiness review: helper-conductor

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 7, on 76eba5a (the commit "settle the broken run file and limitOf of helper-conductor"). Changed since round 6 (db6342b): `design.md` (D-3, D-4, interim-copy bullet), `tasks.md` (2.1, 2.17, 3.1), `specs/roadmap-conductor/spec.md`. `openspec validate helper-conductor --strict` passes. No fetch was run.

## 2. Scope validation
Classification: correct. The edits settle two behaviours already in scope and add no capability.

## 3. Proposal review
No findings.

## 4. Design review
Round 6's two blockers, re-checked:
- Broken run file: one rule now stands in D-3 (`design.md:251-257`), D-4 (`design.md:277-285`), 2.1 (`tasks.md:112-137`), 2.17 (`tasks.md:295-298`), 3.1 (`tasks.md:345-350`) and the spec. A missing file is `emptyRun()`, `no-task`, and the hook blocks. A file that exists but does not parse to a JSON object prints nothing, because the hook keeps its own read and parse. `readRun`'s `emptyRun()` for a broken file applies only to the `tick` verb and the other verbs, and 2.1 tests that case. Closed.
- `limitOf`: the interim copy holds unexported minimal copies of `limitOf`, `DEFAULT_LIMIT`, `isChangeId` and `CLAIM_STALE_MS`, and imports nothing from `roadmap-loop.mjs` or `run-file.mjs` (`design.md:210-211`, `design.md:316-329`, `tasks.md:298-304`). 2.1 deletes all of them and the hook gets `limitOf` with `run-file.mjs`. The synchronous `localFacts` and the no-load rule of D-4 no longer conflict. Closed.

## 5. Specs review
The new scenario "No run file" (blocks) and the reworded "A run file that cannot be read" (exists, empty, non-JSON or not an object: prints nothing) cover both rows of the D-3 and D-4 rule. The requirement text now says "with no run file, it SHALL block". Every row has a scenario.

## 6. Tasks review
Add-only check: 2.2, 2.3, 2.14a, 2.17 and gate 2.18 create only new files and `scripts/test-map.json` keys. Imports come from the existing modules, and none of guard.mjs, run-file.mjs, roadmap-loop.mjs, change-loop.mjs, deliver-check.mjs, conduct-check.mjs, status-line.mjs, the devkit and ship-change SKILL.md or docs/openspec-flow.md is edited. `tick-gate.mjs`, `standing-answers.mjs`, `request-file.mjs` and `test-slots.mjs` do not exist yet. `release.md` exists and no task bumps a version or numbers an ADR. Tasks 2.1 and 3.1 name the test files and the `--test-name-pattern` checks.

## 7. Omission detection
No findings.

## 8. Claims against code
- `limitOf` and `DEFAULT_LIMIT` at `roadmap-loop.mjs:62-71`: matches (`DEFAULT_LIMIT` unexported, `limitOf` exported).
- `isChangeId` at `guard.mjs:1503`: matches, exported.
- `readRun` at `run-file.mjs:32-35`: returns `emptyRun()` on a read error, a parse error or a non-object, so it cannot tell missing from broken. This is why the hook keeps its own parse.
- `CLAIM_STALE_MS` does not exist in `plugins/openspec/hooks/` yet. D-2 (`design.md:162-165`) defines it, so the interim copy and 2.1 are new work, as the plan says.

## 9. Findings
No findings.

## 10. Execution-readiness test
No major doubts for phase 2's add-only part or for 2.1.

## 11. Top production risks
1. Interim and final copies of `localFacts` and its helpers drift if 2.1 does not delete the copy in the same commit. D-4 and 2.1 both require that.
2. The hook's own parse and `readRun` read the file twice, so a file removed in between reads as missing. D-4 states this and gives it the block outcome.
3. Ledger waits of 15 seconds hold gates while a train waits. 2.14a's cases cover it.
4. The hook's 10-second timeout on a slow disk. 3.1 records the time.
5. The payload form the hook sees is unknown, so the regex accepts two forms. Task 3.6 logs real firings and drops the unused one.

## 12. Mandatory questions
1. Problem objectively defined: yes. 2. Result measurable: yes. 3. Error behaviours defined: yes, including the broken and the missing run file. 4. Edge cases covered: yes. 5. Dependencies clear: yes, the order paragraph of phase 2. 6. Contracts defined: yes. 7. Two developers differ: no on the points of round 6. 8. Implicit decisions: none found. 9. Tasks deliver the outcome: yes. 10. Found too late: the 2.1 deletion drifting from the interim copy, covered in risk 1.

## 13. Verdict
APPROVED. Both round 6 blockers are closed and nothing new opened.
