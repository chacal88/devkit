<!-- devkit-stage readiness result=failed attempt=8 commit=0585eddbbf62dedc5ea01413a5b0a7c4ebdc5f23 -->
# Readiness review: helper-conductor

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no, one narrow blocker (task 3.6 against probe 3); the implemented add-only tasks match their text

Round 8, on 0585edd, after round 7 (76eba5a, APPROVED). Changed since: `tasks.md` (2.2, 2.3, 2.14a, 2.17, 2.18 ticked; 2.14a's map sentence; two Workflow follow-up lines), `proof/probe-3-setup.mjs`, `proof/probe-3-instructions.md`, the four new modules and tests, `scripts/test-map.json`. `openspec validate helper-conductor --strict` passes. No fetch was run.

## 2. Scope validation
Classification: correct. No scope added.

## 3. Proposal review
No findings.

## 4. Design review
No findings. D-4 (`design.md:313-315`) states the hook's `DEVKIT_HOOK_LOG` line is `{ at, mode, session, change, decision, why }`, with no prompt in it. That matters for blocker B1.

## 5. Specs review
No findings.

## 6. Tasks review
- 2.14a map sentence (`tasks.md:245-247`): `change-loop.mjs`'s list is left as it is. `test-suite.test.mjs:1124-1130` (`KEPT_HUB_READERS`) and the AC-3 test at `:1171` pin that list, and it holds no `test-slots`. Nothing else in `tasks.md`, `design.md`, `proposal.md` or the specs still says `change-loop.mjs`'s list gains `test-slots.test.mjs` (grep of `test-slots.test` and `list gains`). `tasks.md:270` says `roadmap-loop.mjs`'s list gains it, which is a different hub and is 2.14's work. Consistent.
- 2.17 map sentence: `scripts/test-map.json` has `tick-gate.test.mjs` in `guard.mjs`'s list (line 526) and a `tick-gate.mjs` key. Matches. 2.2, 2.3 and 2.14a keys exist for `standing-answers.mjs`, `request-file.mjs` and `test-slots.mjs`.
- The two Workflow follow-up lines (`tasks.md:573-589`) are follow-ups and add no behaviour. Fine.

## 7. Omission detection
No findings beyond B1.

## 8. Claims against code (the ticked tasks)
- 2.17: `tick-gate.mjs` exports `commonDirOf`, `localRunFilePath`, `localFacts`, `tickReady`. It holds unexported `limitOf`, `DEFAULT_LIMIT`, `CLAIM_STALE_MS` with the `DEVKIT_CLAIM_STALE_MS` override (lines 20-38). It imports only Node built-ins at the top and `guard.mjs` by dynamic `import()` in the async `gate` (line 279). No import of `roadmap-loop.mjs` or `run-file.mjs`. `hooks.json` has no `tick-gate` entry. Matches.
- 2.14a: `test-slots.mjs` exports `SLOTS_LOCK`, `SLOT_STEP_MS`, `slotsPaths`, `readSlots`, `tryTakeSlot`, `releaseSlots`, `waitForSlot`, with the values D-25 gives (`design.md:1150`), and imports `withLockFile` from `change-loop.mjs`. Matches.
- 2.2: `standing-answers.mjs` reads `## Answers` and `## Delegations`, ignores fenced blocks and exports `GATE_IDS`. 2.3: `request-file.mjs` has `SUMMARY_LINES = 12`, `APPROVAL_WORDS_MAX = 200` and write, parse, answer functions. Match.
- No file that `multi-roadmaps` edits was touched (`git diff --name-only 8d43e315..HEAD -- plugins` lists only the four modules and their tests).
- Gate 2.18: `proof/gate-2.18.txt` ends `suite: 5 files, 162 tests, 162 pass, 0 fail`, with the `selected` lines. Its `--own-files` row is separate from a whole-suite pass, as CLAUDE.md asks.

## 9. Findings

B1. High, Mandatory before implementation. `tasks.md:400-402` (task 3.6 (g)) says the hook's payload `prompt` is read "as `DEVKIT_HOOK_LOG` records it". The hook's log line holds no prompt (`design.md:313-315`, `tick-gate.mjs:264-267`), so (g) cannot be observed as written. `proof/probe-3-setup.mjs:19-22` works around it with a separate `raw-log.mjs` writing `log/prompt.jsonl`, and `probe-3-instructions.md` (g) reads that file. Task 3.6 does not name `raw-log.mjs` or `prompt.jsonl`, and its settings sentence (`tasks.md:386-389`) lists one hook, this branch's `tick-gate.mjs`. The coordinator following 3.6 would not find the form the check needs, and the decision "which form is dropped from the regex" (D-4) depends on it. Smallest correction: reword 3.6's settings sentence and (g) so the scratch project's hook list is the raw logger first (`proof/probe-3-setup.mjs` writes it) and then `tick-gate.mjs`, and (g) reads `log/prompt.jsonl`.

B2. Medium, Mandatory before implementation. `tasks.md:399-400` (3.6 (f)) requires "the tick call it names run", and 3.6's check (`tasks.md:407-409`) is the only consumer. `probe-3-instructions.md` (b) says the `tick` verb does not exist yet (task 2.5) and the session is expected to report the note and stop. If probe 3 runs now, as the instructions prepare, (f) as written cannot pass, and 3.6 stays unticked with no statement of which parts the early run settles. Smallest correction: say in 3.6 that the run happens before 2.5 and that (f) is "the note reached the session (quoted)", with the call run left to 3.6's re-run or to 6.1 (which already lists the tick); or state that 3.6 waits for 2.5. Either way the plan and the instructions must say the same.

Minor, Fix during implementation. `tasks.md:391` says "each a task" for the three firings; `probe-3-instructions.md` (a) re-arms one task three times. Both satisfy "a task created on the owner's typed turn", but one wording should be chosen so the log can be read per firing.

## 10. Execution-readiness test
Two doubts, both inside 3.6. No doubt for the add-only modules.

## 11. Top production risks
1. The probe returns no payload form, so the hook ships with two regex forms and a test for a form no host sends. Prevention: B1.
2. The early run is read as closing 3.6 and phase 4 starts on a probe that never ran the tick call. Prevention: B2.
3. Interim and final copies of `localFacts` drift unless 2.1 deletes the copy in its own commit (unchanged from round 7; 2.1 and D-4 both require it).
4. `test-slots.test.mjs` is not selected by `--own-files` when only `change-loop.mjs` changes, by the pinned list. 2.14's `roadmap-loop.mjs` link covers the caller; the whole suite covers the rest.
5. A hook with a 10-second timeout on a slow disk (3.1 records the time).

## 12. Mandatory questions
1. Problem objectively defined: yes. 2. Result measurable: yes. 3. Error behaviours defined: yes. 4. Edge cases covered: yes. 5. Dependencies clear: yes, except which of 3.6 runs before 2.5 (B2). 6. Contracts defined: yes. 7. Two developers differ: on 3.6 (g) yes (B1). 8. Implicit decisions: the early probe run (B2). 9. Tasks deliver the outcome: yes once 3.6 is fixed. 10. Found too late: the payload form not recorded.

## 13. Verdict
NEEDS-REVISION. Fix B1 and B2 in `tasks.md` task 3.6 (and, if the early run is kept, one line in `proof/probe-3-instructions.md`). The map sentence of 2.14a is consistent with the rest of the plan, and the four modules match the tasks they tick.
