# Readiness review: devkit-panel

Round 4 (re-review after the round-3 blocker and its optional items were reported applied).

## 1. Decision
- Status: APPROVED
- Reviewer: general-purpose subagent following plugins/core/agents/plan-readiness-reviewer.md (the devkit-core agent type is not loaded in this session)
- Confidence: high
- Ready to implement: yes

The round-3 blocker is applied and verified against the checker, not the author's word: every gate of `tasks.md` (1.9, 2.9, 3.9, 4.9) is one backticked `&&`-joined command, `parseTasks` (deliver-check.mjs:272-284) takes each whole, `node plugins/openspec/hooks/deliver-check.mjs devkit-panel --json` reports the four commands verbatim as `phases[].gate.command`, the split on `&&` (deliver-check.mjs:309) yields seven distinct parts each of which stands on its own (every `claude plugin ...` part names the app's binary by absolute path, so neither the ship-change `gate` step nor pr-verifier's per-part run depends on PATH), and the header (tasks.md:5-9) and D15 (design.md:326-330) say so, with the npm/app distinction corrected. Both round-3 optional items on the plan's text were taken (tasks.md:39 last sentence; tasks.md:41 "not offered"). The package is valid (`openspec validate devkit-panel --type change --strict --no-interactive`: valid). No open mandatory finding; the items left are optional (section 10). The caller suggested no verdict; this one is my own.

## 2. Scope validation
Classification: correct

- Unchanged since round 3 (proposal.md "What Changes" 15-25; requirements.md "Out of scope" 204-213; design.md Non-Goals 34-39). The round-3 fix changed no scope: the gate commands now name the binary they already assumed, and the two sentences added to phase 4 describe what an unintended actor does with it (nothing).
- HEAD is still `ae2b676`; `git status` shows only the untracked change folder, so every code claim verified in rounds 1-3 stands at the same code.

## 3. Proposal review

- Unchanged. Exit criteria (proposal.md:90-92) are now carried by the gates as the flow parses them: `validate .`, `plugin test plugins/panel`, `gen-catalog.py --check` and the test command are all parts of 3.9 (tasks.md:35); `validate plugins/panel` and `plugin test` of 1.9/2.9; `plugin test` again at 4.9 at the loaded head.
- No findings.

## 4. Design review

The project keeps no metadata/roadmap/current-state artifacts per change; the roadmap is the round list. ADRs: unchanged (D16 records the stay within ADR 0001; no ADR changes, so `rules.design` is not triggered).

The round-3 blocker, re-derived:

| Claim | Checked against | Result |
|---|---|---|
| "the flow takes the first backticked text after `Gate:` and runs each `&&` part on its own" (tasks.md:5-6; design.md:327-329) | deliver-check.mjs:272-284 `parseTasks`: `description.match(/^Gate:[^`]*`([^`]+)`/)`; :309 `command.split('&&')`, each part needing a `pass` row whose cell contains the exact part in backticks (:315-316); ship-change SKILL.md:39 runs `next.command` alone in Bash; pr-verifier.md:38 and :55 run each part as its own command and write one row per part | Confirmed; the sentence is an accurate reading of the three readers |
| The four gates are each one backticked command | `deliver-check devkit-panel --json`: `phases[1..4].gate.command` are the full strings of tasks.md:22, :29, :35, :43; item 1 lists seven missing `pass` rows, one per distinct part, and no `names no command` block | Confirmed |
| Each `claude plugin ...` part stands alone | Every such part begins with `"$HOME/Library/Application Support/Claude/claude-code/2.1.317/91184d3d9ba3/claude.app/Contents/MacOS/claude"`; the file exists (312 MB, executable) and answers `--version` `2.1.317 (Claude Code)`; `$HOME` expands inside double quotes in Bash and the quotes carry the spaces | Confirmed |
| "the npm `claude` 2.1.227 on PATH has `plugin validate` for the manifest only and no `plugin test`" (tasks.md:8-9; design.md:326-327) | `which claude` → `~/.nvm/.../bin/claude` 2.1.227; `claude plugin --help` lists no `test`; `claude plugin test --help` prints the generic usage. On a scratch mod (scratchpad, not the repository) the npm `plugin validate <dir>` exits 1 with `hooks: Invalid input: expected record, received undefined` (it rejects a `{ "modules": [...] }` hooks.json), while the app's binary lists `./register.tsx hooks: session.start` and `calls: $.fs.exists` and exits 0 | Confirmed, with a nuance for the implementer (section 10, first item): the npm validate is red on a mod, not vacuous |
| AC-11's report of hooks and calls is the app binary's | same scratch run: the app's `validate` prints the hooks and `$.*` calls of the module even while the rollout switch is off | Confirmed |
| A missing README does not fail 1.9 (the README is task 3.1, phase 3) | app `validate <dir>` without README: `README_MISSING` under "problems the plugin directory refuses a submission for", then `Validation passed with warnings`, exit 0 | Confirmed |
| `claude plugin validate .` (3.1, 3.9, AC-1, CONTRIBUTING.md:41) stays meaningful with a mod in the marketplace | scratch marketplace holding the scratch mod: both binaries' `validate .` exit 0 and do not descend into the mod's hooks; both binaries' `validate .` on this worktree exit 0 today | Confirmed; 3.9 runs it with the app's binary, and the repository's lint line on the npm binary is not broken by the pack |
| The precondition: `plugin test --help` prints `Run a mod's tests`, else the refusal (exit 0) | At the time of this review the app's binary prints the refusal (`hooks modules are turned off in this process: the rollout switch was saved off by an earlier session ...`), exit 0; `plugin test <dir>` on the scratch mod prints the same refusal and exits 1 | Confirmed; and the gate is red, not vacuously green, when the switch is off (section 8, item 1) |

Round-3 optional items, re-derived:

| Item | Result |
|---|---|
| A dispatched actor that receives phase 4 | tasks.md:39: "A child session or implementer that receives phase 4 anyway ends at once with `Outcome: failure: phase 4 is the conducting session's (tasks.md)` and changes nothing." Consistent with conduct SKILL.md:56 (`Outcome: failure: <reason>` → `blocked: phase 4: <reason>`, child left unarchived) and with the child's brief (conduct-check.mjs:516-523), which tells it to wait for tdd-implementer's `Outcome:`. Applied. |
| 4.1 when the app offers no "Turn them on" question | tasks.md:41: "when the app offers no such question in this session, 4.1 is recorded as `not offered` and 4.2 carries the whole live check". Design D17 step 1 (design.md:356-359) was not mirrored; tasks govern the actor, so this is a Low optional (section 10). Applied in substance. |
| `.test.ts` vs `.test.tsx` | reference.md:81 still says `*.test.ts`; requirements.md Facts now says `*.test.ts[x]`, the skill's own example is `examples/pane.test.tsx`; gate 1.9's prose asks for a non-zero test count. Not reproducible while the switch is off. Carried as Low. |

Mod API contract (same bundled skill hash `0be87fe210f1a1bf5e46e97484480dcd` as rounds 1-3): spot-checked again at the d.ts: `ToolCheckArgs` (4923), `isFilled` (2206, 4278, 4757), `clock.every` (3595), `ui.panes()` (2564, 7257), `session.root()` (3472, 7119), `process.run` `init` `{ cwd, env, stdin, timeoutMs }` (3641); `examples/pane-state.d.ts` shows the `declare module 'claude-code' { interface PluginState {...} }` form D11 relies on, and the app's validate enforces "a contract exports types and nothing else" on `types/index.d.ts` (reproduced), which D11's content satisfies.

Alternatives, error handling, rollback, open questions: unchanged (D2, D4, D6, Migration Plan; Open Questions: none).

## 5. Specs review

No change package specs: `skip_specs: true` in `.openspec.yaml`, consistent with the repository (no `openspec/specs/`; every archived change did the same; `openspec validate` accepts it). The behaviour is the thirteen ACs; AC-2 to AC-12 pinned by the tests of D13, AC-13 by phase 4. No requirement lives only in a support doc. No findings.

## 6. Tasks review

- Structure follows `rules.tasks` (config.yaml:33-35): four `## N.` groups, each ending with a gate task naming a test command; every AC id appears in at least one task (AC-1 in 3.x; AC-2..7, AC-11 in 1.x; AC-8..10, AC-12 in 2.x; AC-13 in 4.x). Ordering by dependency holds (1.1 → 1.2/1.3 → 1.4 → 1.9; 2.1 → 2.2 → 2.3 → 2.9; 3.1 → 3.2 → 3.9; 4.1 → 4.2 → 4.9). Every path is under a real directory. "Workflow follow-up" bullets are plain, not checkboxes (deliver-check counts fifteen tasks, as the header says).
- Gates as the flow parses them (deliver-check JSON of this review): 1.9 and 2.9 = app `validate plugins/panel && app plugin test plugins/panel`; 3.9 = `node --test ... && python3 scripts/check.py && python3 scripts/gen-catalog.py --check && app validate . && app plugin test plugins/panel`; 4.9 = `app plugin test plugins/panel`. Seven distinct parts; pr-verifier writes one `pass`/`fail` row per part (pr-verifier.md:55) and deliver-check dedups identical parts across gates (`new Set`, :309), so one green row for `plugin test plugins/panel` serves 1.9, 2.9, 3.9 and 4.9. The shape matches every archived change (e.g. archive/2026-11-08-ship-modes/tasks.md:50).
- Phases 1-3: an implementer can build every task without a question; the texts are literal (file names, function names, argv, cwd, env, timeout, test cases, both languages). One inline verify line (1.1, tasks.md:18) names bare `claude`, which on PATH is the npm binary that rejects a `modules` hooks.json; the header's rule covers it, so it is an optional item (section 10), not a blocker.
- Phase 4: one actor (the conducting session with the owner), one location, the ticks and the follow-on named, the "not offered" branch of 4.1 and the behaviour of an unintended actor written. Executable as written.

## 7. Omission detection

- Validation / error handling / retries / permissions / side effects / observability / rollback / idempotency / migration / feature flag / compatibility / test strategy: defined (D4-D8, D13, D15, AC-6, AC-7, AC-11), unchanged since round 2.
- Gate commands the flow can run and verify: now present (section 4, section 6).
- The rollout switch off at gate time: the precondition in tasks.md:9-12 and D15 (design.md:335-341) says what to do; and the gate itself is red (exit 1 with the refusal text) rather than green with zero tests, reproduced this round, so the flow's `stopped at gate <task>: ... red: <last lines>` (ship-change SKILL.md:39) carries the fix. No omission.
- No new omissions found.

## 8. Execution risks (top 5 failures)

1. The rollout switch is off when ship-change reaches a gate with `plugin test` (it is off at the time of this review) / Impact: `plugin test plugins/panel` exits 1 with the refusal; the run stops at that gate with the refusal as its last lines; pr-verifier records `fail` until re-run / Prevention: the precondition (tasks.md:9-12, D15): start the app's binary once with network access, check `--help` prints `Run a mod's tests`, re-run the gate. A red, not a vacuous green, so nothing passes by accident.
2. An implementer runs 1.1's verify line (`claude plugin validate plugins/panel`) with the npm binary / Impact: `hooks: Invalid input: expected record, received undefined`, exit 1, which could be misread as a hooks.json shape problem and "fixed" by breaking the `modules` form the engine needs / Prevention: section 10, first item: 1.1's verify names the app's binary like the gates; the header (tasks.md:6-9) already states the rule.
3. `claude plugin test` picks up `*.test.ts` only (reference.md:81) while the plan's files are `*.test.tsx` / Impact: zero tests, a green 1.9 that proves nothing / Prevention: gate 1.9's prose "with a non-zero test count" (tasks.md:22); the implementer reads the count at the first green run; the skill's own example is `pane.test.tsx`. Carried.
4. A conducting session that follows the conduct skill verbatim after 3.9 starts a phase-4 child (SKILL.md:30, :44) / Impact: now bounded: the child reads tasks.md:39 and ends with `Outcome: failure: phase 4 is the conducting session's (tasks.md)`, recorded as `blocked: phase 4: ...` (SKILL.md:56), naming the paragraph / Prevention: applied in tasks.md:39; the conducting session then does 4.1-4.2 itself.
5. `$.tool.list()` does not list the app's deferred MCP tools / Impact: `mayList` false for every owner, the permission line always shown / Prevention: hypothesis settled at 4.2; fallback to `tool.check` alone (the old mod's `canCall`, register.tsx:422). Carried.

## 9. Mandatory fixes before implementation
- [ ] none

## 10. Optional improvements (within scope)
- [ ] Medium, fix during implementation — `tasks.md:18` (1.1 "Verify: `claude plugin validate plugins/panel` passes once 1.4 exists") — on PATH `claude` is the npm 2.1.227, whose `plugin validate <dir>` rejects a `{ "modules": [...] }` hooks.json outright (`hooks: Invalid input: expected record, received undefined`, exit 1; reproduced on a scratch mod), so the verify line as typed is red for a reason that is not the pack's — Smallest correction: have 1.1's verify name the app's binary (the header's path) or say "with the app's binary (header)". 3.1's `claude plugin validate .` (tasks.md:33) is fine on either binary (marketplace validate does not descend into a plugin's hooks; reproduced).
- [ ] Low, nice to have — `design.md:356-359` (D17 step 1): mirror tasks.md:41's "not offered" branch (4.1 recorded as `not offered`, 4.2 carries the live check) so design and tasks say the same.
- [ ] Low, nice to have — `tasks.md:8` and `design.md:327`: "for the manifest only" could add "and it rejects a `modules` hooks.json", which tells an implementer who sees that error that the binary, not the file, is wrong.
- [ ] Low, nice to have — reference.md:81 says `claude plugin test` runs `*.test.ts`; the plan's tests are `*.test.tsx`. Confirm a non-zero test count at the first green run (carried from rounds 1-3).
- [ ] Low, nice to have — D6: a `clock.every` period a hook refuses ends the interval (d.ts:3592-3596); nothing in this pack refuses it. No change needed (carried).

## 11. Explicitly out of scope
- [ ] `conduct-check --change <id>` and `/conduct <id>` (the sibling change `conduct-one-change`).
- [ ] A project-file language option; the old mod's engine, grill, gates, Jira, workflows; marking `chacal88/orchestrator` superseded.
- [ ] Mobile and vscode surfaces beyond the toast fallback.
- [ ] An ADR for the panel (declined by the owner; D16 records the stay within ADR 0001 and a review trigger).
- [ ] Turning the rollout switch on: an environment fact the plan handles with a precondition; this review did not flip it.
- [ ] A wrapper script or repository change that puts the app's binary on PATH for everyone, or a CI job for `claude plugin validate`/`test`: product code outside the pack; the gate lines name the binary themselves.
- [ ] Teaching the conduct skill or conduct-check about owner-run phases: devkit-openspec is not changed by this package.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes (proposal.md "Why" 6-11; the owner's decision in requirements.md "Request" 3-22).
2. Is the result measurable? Yes: thirteen ACs, each with a test (AC-2 to AC-12) or the live check with its output in evidence.md (AC-13); the gate commands that measure AC-11, AC-12 and AC-1 through the flow are now the ones the flow runs (section 4).
3. Are error behaviors defined? Yes: exit 3 JSON `error` or stderr's first line, rejections, `ask`/`deny` → notice line, `isFilled: false` → toast, missing worktree → root; a gate with the switch off is red with the refusal text.
4. Are edge cases covered? Yes: concurrent triggers, stale report with age, no config, no checker, no `node`, quoted `schema:`, many open changes, version collision with the sibling, phase 4 handed to the wrong actor, no "Turn them on" question. Open hypothesis: deferred tools in `$.tool.list()` (section 8, item 5).
5. Are dependencies clear? Yes: none added; run-time `node` and an installed `devkit-openspec` or the repository's hooks; the app's 2.1.317 binary named by path in every mod gate, with the precondition.
6. Are contracts defined? Yes, verified at the same HEAD and the same bundled skill: `tool.check` `{ tool, input }`, `tool.call` flat, `items[].id`, `{ result }` only, `env` merged, `tool.register` at `session.start`, the checkers' JSON; the gate contract (first backticks, `&&` parts, one `pass` row per part) is now met by `tasks.md`.
7. Can two developers interpret this differently? Phases 1-4: no. The gates: no (one command, one binary each). One verify line (1.1) could send a developer to the npm binary; the header says otherwise (section 10).
8. Are any decisions implicit instead of written? None found. The binary each gate runs is in the command; the actor of phase 4 and its fallback are written.
9. Do the tasks fully deliver the intended outcome? Yes: AC-1 to AC-13 each have tasks, and the gates prove AC-1, AC-11, AC-12 through the flow.
10. What will be discovered too late if implementation starts now? Whether the rollout switch is on at the time of each gate (handled: red with a named fix), and whether `claude plugin test` takes `.tsx` (handled: the count is read at 1.9). Nothing that changes the plan.

## 13. Final conclusion
- Can we start? Yes. The round-3 blocker is fixed and verified against `parseTasks`, the checker's JSON, ship-change and pr-verifier; the phases are executable as written by the actors they name; the package is valid.
- What must be fixed? Nothing before implementation. The optional items of section 10 can be taken during phase 1 (1.1's verify line) or left.
- Main risk if ignored? Not applicable to the plan. Operationally: the first gate with `plugin test` will be red if the switch is still off, and the stop message says what to do.
