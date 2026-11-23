Verdict: approved
Commit: f7c5945b8bd8763a51040c609968fe937a9633c4

## Quality review — roadmap-sessions-upfront (round 2)

### Findings
- [important] plugins/openspec/hooks/roadmap-loop.mjs:900 (unpushedOf), :885 (filesPushed) — unpushedOf asked a plan push whenever any plan file was dirty or ahead, so the implementer's tasks.md ticks were committed as 'docs(openspec): plan of <id>'. · fixed in 6fab305
- [important] plugins/openspec/hooks/guard.mjs:950-955 (skillEntry) — The fail-closed catch wrapped the import of roadmap-loop.mjs, so a module that could not load refused every Skill call, and every call paid the import. · fixed in 6fab305
- [important] plugins/openspec/hooks/roadmap-loop.mjs:932 (killWaits), :1396 (checkCmd watchAlive) — killWaits sent SIGTERM to a recorded pid, and checkCmd counted a pid as alive, with no check that the pid is still a wait loop; a recycled pid could be signalled. · fixed in 6fab305
- [nit] plugins/openspec/hooks/change-loop.mjs:961-1011 — The header comment of decide was separated from it by the triage section. · fixed in 6fab305
- [praise] plugins/openspec/hooks/roadmap-loop.mjs:393 (placeDecision, sessionDecide) — The place rule is one pure function, re-decided on the run file under its lock; check, session-next and session-wait share the single reader.
- [praise] plugins/openspec/hooks/roadmap-loop.mjs:634 (entryDecision), roadmap-loop.test.mjs:2860 — The ticket claim is re-checked under the run file's lock and the refusal names the owner's typed fallback; tests cover each label, the guard exit codes, the log line, the bypass and the other-skill path.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:1346-1352 (mergeBaseCmd) — Every failure of git merge (a dirty tracked file that refuses it, for example) is reported as why=base-conflict, 'could not be merged'; only a real conflict deserves the label.
- [praise] plugins/openspec/hooks/guard.mjs namesEntrySkill, roadmap-loop.mjs isWaitProcess — The fixes are small, single-owner helpers (namesEntrySkill is shared by guard and entryDecision; isWaitProcess is shared by waitAlive and killWaits), and each comes with a test that exercises the red case: a failing import, a non-wait live pid, ticks after the plan push.

### Summary
- 8 findings (0 blocking, 0 important open, 1 nit open) + 3 praise; F1 to F4 are fixed in 6fab305.
- Justification: Re-review limited to my round 1 findings and the lines changed since 123a7ba (6fab305, the merge 699e6be, the renumber 877026a, the evidence f7c5945). The merge brought release-tags work (deliver-check.mjs, release-tags.test.mjs, ship-change) from main, which I did not judge.
- F1: `unpushedOf` now treats `approval.md` on origin as the record of the plan push. Only the coordinating session writes it and the push carries it with the plan files (`pushCmd` still pushes all PLAN_FILES). A tick of tasks.md therefore asks no second push, and an approval written again does. The new test 'upfront AC-12 next' covers both: the tick leaves origin behind and asks nothing, and attempt=2 of the approval is pushed along with tasks.md.
- F2: `skillEntry` calls `namesEntrySkill(input.tool_input)` first, with no import. Only a call that names devkit-session imports roadmap-loop.mjs and fails closed. The test 'upfront AC-2 guard' covers a module that cannot load (another skill passes, devkit-session is refused), and `namesEntrySkill` is exported and tested on its own.
- F3: `isWaitProcess` reads `ps -o command= -p <pid>` and matches `roadmap-loop.mjs (session-)wait`. `killWaits` and `waitAlive` (used by `checkCmd`) both use it, a spared pid is dropped from the record, and a `ps` error gives false. Tests: 'upfront AC-14 isWaitProcess', 'upfront AC-14 check' (live non-wait pid spared and forgotten) and 'upfront AC-15 decide'.
- F4: the triage block now sits above the decide header comment.
- F7 stays open as a nit: the merge failure label is unchanged. It does not block.
- Other changes since round 1 are covered by tests and read consistently: `pruneRecords` (D-7) runs before a place is handed in check and in a coordinating decision, and only in a run with a session per change; `hasTriageSection` replaces the regex in check, so a heading in a fence or with trailing words is no section; `startedTaskOf` skips the host's leading system-reminder notes, and a note that is never closed gives null.
- Scope: the plugin diff still matches the proposal; the ADR renumber to 0020 is consistent in the roadmap-loop.mjs text and in the 'ADR 0020: the documents follow' test.
- Acceptance: evidence.md (attempt 3, at 877026a) maps each acceptance criterion to its test names and real runs of `roadmap-loop.mjs next`. It says plainly which host-side parts are left to the dogfood run (D-15). The whole suite is reported green there (2232 tests). I did not re-run it.
