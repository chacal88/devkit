Verdict: approved
Commit: 9eaef847377372376ef25eb7a8f400d0e3ccf619

## Coverage analysis — coordinator-loop-fixes, review round 2 (73e159c..9eaef84)

### Findings
- [important] plugins/openspec/hooks/conduct-check.mjs:64 — [5] The conduct-check side of conductor-task was untested: removing 'conductor-task' from MAIN would turn the row into the blocked 'unknown step conductor-task', and no test would fail. · fixed in f1acdfd7c0973d728b3f8075c470d01c6f8b4d5e
- [nit] plugins/openspec/hooks/guard.mjs:745 — [3] Tests pinned DECLARE_CALL only for the bare, quoted and cd-prefixed forms; `node --no-warnings <path>/change-loop.mjs declare` from a subagent got through. · fixed in 66f35536c6811681f247993690bf8813aba8dd3b
- [nit] plugins/openspec/hooks/change-loop.mjs:3249 — [3] `round = REVIEW_ROUNDS + authorizedRounds(dir, scope) + 1` is still tested only at round 3 (T38, T96, T143), so a hard-coded 3 would pass. Write in change-loop-declared.test.mjs after T111: a second declare at the deadlock after round 3 records round 4 and its reply says 'round 4'.
- [nit] plugins/openspec/hooks/flow-check.mjs:562 — [2] Still no test of a plan revised after approval but before the first task tick: dropping `started &&` would make the readiness stale and the suite would stay green. Write in flow-check.test.mjs next to T58: no task ticked, design edited, readiness stays passed.
- [praise] plugins/openspec/hooks/change-loop-declared.test.mjs — Round 1 praise, still true: the seams between parts are tested where the behaviour shows (declare CLI fed to the real stop hook, the resolution deadlock through push and fix-resolution, the plan digest through next, record-approval and the CompozyOS view), and the flows that cross processes have real runs in proof/.
- [nit] plugins/openspec/hooks/guard.test.mjs:1857 — [4] No test refuses a subagent's declare in the quoted-heredoc form the skills now prescribe (`... declare feat review-round --stdin words <<'DEVKIT_ARGS'` + body + terminator). OPTION_LINES[2] has `--stdin words` with no heredoc, and T102 only checks that a heredoc body is ignored. A withoutHeredocs that dropped the `<<` line with the body would let that form through, and both tests would stay green. It is refused today (read-only probe of declareViolation). Write in: guard.test.mjs, add that command to T99's refused list.
- [nit] plugins/openspec/hooks/guard.mjs:746 — [2] The option skip `(?:\s+-[^\s;&|]*)*` does not cover a node option whose value is a separate word: declareViolation returns null for a subagent's `node -r ./x.cjs <path>/change-loop.mjs declare ...`, `node --require ./x.cjs ...` and `node --stack-size 2000 ...` (read-only probe). The regex matches the revised D-1 exactly, so this is a design point for the security reviewer, not a missing test.
- [praise] plugins/openspec/hooks/change-loop-declared.test.mjs:449 — The stdin fix is tested at the seam, not only in the shared helper. T144 spawns real bash with the quoted heredoc, which exercises the entry-point stdin read for `declare` (`['reply','declare'].includes(argv[0])`): dropping 'declare' there turns exit 0 into exit 3. It also checks that no command in the words ran. T146 is the test asked for in round 1, written as proposed.

In-scope surfaces: plugins/openspec/hooks (change-loop runDeclare / withStdinParam / entry-point stdin read; guard DECLARE_CALL), conduct-check's actorOf / deliveryStep for conductor-task, the devkit and ship-change skill text, and the document pins for ADR 0023 and 0032 (T147, T148). The merge f416d6a brought no hook code (the archive of suite-socket-path, CONTRIBUTING and trains/18.md belong to other changes).
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0; read-only probes of declareViolation only):
- declare --stdin words → withStdinParam → declared.json words → T143 (in-process, words with a backtick, $(...) and quotes kept byte for byte; --param words unchanged)
- entry point reads stdin for `declare --stdin` (isMain) → T144 (spawned bash with the quoted heredoc; without the read the run exits 3 and the test fails)
- `declare --stdin` other name / bad name / both forms / empty input → exit 3, nothing recorded, the deadlock stays → T145
- runReply refactored onto withStdinParam (same messages with command 'reply') → jira-entry-followups AC-8 reply --stdin tests in change-loop-remote-state.test.mjs (empty, line break only, CRLF only, duplicate, bad name, spawned heredoc)
- skill text names --stdin words through <<'DEVKIT_ARGS' and never --param words → T44
- actorOf('conductor-task') → main; deliveryStep row runnable with deliver-check's reason → T146
- DECLARE_CALL node option words (--no-warnings, --, two options before a quoted path), refused for a subagent and allowed for the main session → T99; heredoc form for a subagent → gap (F6, nit); option with a separate value → not matched (F7, design)
- ADR 0032 Decision section verbatim plus the dated Note; compozy-kit names the Note → T147; ADR 0023 header names ADR 0033 → T148
- cross-process: the session's own heredoc declare in a nested session → real run ver-r7s (proof/ver-r7s-declared.json holds the owner's words byte for byte, round 3; turn 2's command uses --stdin words with <<'DEVKIT_ARGS')
Test run: one scoped run in the foreground at concurrency 3 under the CI branch variables, over change-loop-declared, conduct-check, guard and change-loop-remote-state, filtered to T143-T148, T44, T98-T104 and the reply --stdin tests: 19 pass, 0 fail.

### Well covered
- Owner's words through stdin: the in-process recording (T143), a real shell with the quoted heredoc and nothing in the words run (T144), every refusal leaving nothing recorded and the deadlock in place (T145), and the nested-session real run ver-r7s for the conducting session's own part.
- conductor-task in conduct-check: T146 pins both actorOf and the deliveryStep row's state and reason, which is the seam that would have broken silently.
- Guard option forms: T99 asserts both directions, subagent refused and main session allowed, so an over-broad regex would also fail.
