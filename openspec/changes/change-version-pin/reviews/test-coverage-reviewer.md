Verdict: approved
Commit: c1dc4033d78fb79eafea79ef073afec7949d36f2

## Coverage analysis — change-version-pin (origin/main...c1dc403)

### Findings
- [nit] plugins/openspec/hooks/version-pin.test.mjs:356 (AC-4 readout: an unpinned change after the upgrade) — [4] No test asserts the 'Flow:' readout line or the second resume line for an unpinned change with installed flow 2. Only the pin:1 fixtures assert the notice. A mutation requiring 'pinned' before printing it (flow-check.mjs:635, change-loop.mjs#flowNotice) would stay green. Write in: version-pin.test.mjs beside AC-4 'after the upgrade', using shared({ pin: null, to2: true, stages: PLAN_V1 }) with the NEWER[lang] strings and the startChange reply.
- [nit] plugins/openspec/hooks/change-loop.mjs:1823 (moveFlow, `readPin(...).flow ?? 1`) — [3] The flow command is tested only on pinned changes. For an unpinned change at installed flow 1, nothing proves it is left unpinned and its bytes are untouched. Removing `?? 1` would make it write a pin and stay green. For an unpinned change at installed 2, nothing proves it is moved. Write in: version-pin.test.mjs, an AC-6 flow case on shared({ pin: null, ... }), asserting pinOf before and after.
- [nit] plugins/openspec/hooks/conduct-check.mjs:250 and :459 — [3] The conductor's `new-change` step, and openspec-setup's final 'first command' line, still tell the session or owner to run a raw `openspec new change`. A change opened that way has no pin and follows flow 1 after the upgrade, silently apart from the notice. No test or text states this. This is inherited behaviour outside AC-1, which names only `open`. If it is intended, one sentence in docs/openspec-flow.md is enough.
- [praise] plugins/openspec/hooks/version-pin.test.mjs:170-345 (AC-2 and AC-3) — Every reader that judges a change is tested, in each of the two directions (version 1 after the upgrade, version 2 for a new change): readout, loop next, code gate, devkit-reviews, locks, roadmap titles, conductor and deliver state. The fixtures come from a real install-schemas.sh re-run.
- [praise] plugins/openspec/hooks/version-pin.test.mjs:727-757 (AC-6 leaves the pin) — next, wait, another open, a real setup re-run and a pack update are each asserted to leave the pin bytes unchanged. Negative validation of 'moves only on command' is covered end to end through the real install script.
- [praise] plugins/openspec/hooks/version-pin.test.mjs:365-500 and :850-946 (AC-4 and AC-7) — Failure policy is tested per reader: the hard gates stop with exit 3 on a malformed pin, a missing kept file or a version mismatch; the code gate and the conductor fall back to the installed schema. The AC-7 check.py negatives cover every rule: unchanged version, missing kept file, missing digest, edited released file, wrong declared version, bad file name, no digest list.

In-scope surfaces: plugins/openspec hooks (guard, flow-check, change-loop, conduct-check, deliver-check, roadmap-loop, project-loop callers), the openspec-setup install script, scripts/check.py, the flow files and the docs.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0; read only):
- `changeFlow` callers in the readout (`collectFlow`): AC-2 readout x2, AC-3 readout x2, AC-4 readout x4.
- `changeFlow` in the code gate (`writeViolation` via `changeDeclaresOrInstalled`): AC-2 guard, AC-3 guard, AC-4 guard fallback.
- `changeDeclares` in `checkOne` and `collectState`: AC-2 ci, AC-3 ci, AC-3 deliver, AC-4 ci. Callers of `collectState` catch errors (deliver-check main, conductor `deliver()`, change-loop row), so an unreadable pin there is not a crash.
- `changeFlow` in `handOffFor` and `subagentStopFor`: AC-2 locks x2, AC-3 locks.
- `stageTitleOf` and `isPreviousScript` in the roadmap loop: AC-2 roadmap, AC-4 roadmap.
- `planArtifactsOf` and the planning rows in the conductor: AC-2, AC-3 x2, AC-4.
- `recordPin` in `openUnderLock`: AC-1 open x4 (including the slice open in project-loop and a malformed flow.json that opens nothing), AC-3 open, and the real `openspec status` unrecognized-key assertion at line 552.
- `recordPin` in `switchScript` case C1: AC-6 script x2.
- `moveFlow` and `runFlow`: AC-6 flow x4 (moves, equal, ahead refused, four usage errors with the bytes unchanged).
- `flowNotice` and the readout line, in en and pt-BR, with the equal case adding no line: AC-5 x4.
- `writePin`, with the budget block kept intact and CRLF and comment lines kept byte for byte: AC-1 writePin x2.
- Kept-flow integrity: AC-7 schema (both the plugin and the repository copy) and AC-7 check x12.
- `skills/devkit/SKILL.md` text (flow only on the owner's request, roadmap opens through `open`): AC-1 skill and AC-6 skill.

The design also changed `SAMPLE` in change-loop.test.mjs and the guard.test.mjs release assertions; the evidence reports 2131 of 2131 passing on the merged tree.

No test-that-tests-the-mock found: the scenarios run real child processes (`spawnSync` of flow-check, guard and deliver-check) over scratch projects built by the real `install-schemas.sh`. The fixtures are states the producers can emit: version 2 installed with `flows/1.json` and `flows/2.json` kept.

Cross-process flow (the `devkit-reviews` job downloading `guard.mjs`): the reader was moved into guard.mjs for that reason and `deliver-check` imports only from guard and merge-setup. The AC-2 and AC-4 ci tests run `deliver-check --ci` as a process. Real-evidence item, outside the unit suite: the first PR after release shows the job reading a pinned change, as the plan's dogfood note already says.

Bug-fix literal reproduction: not applicable. This is a feature, and `proof/red-1..3.txt` show the tests red before each phase.

Well covered: see F4 to F6.
