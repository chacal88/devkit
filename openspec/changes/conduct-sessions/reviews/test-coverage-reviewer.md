Verdict: approved
Commit: 5f0caebbe70e088a52e3cc90d96ca093c1160b58
Round: 1

## Coverage analysis - conduct-sessions (origin/main...HEAD)

In-scope surfaces: plugins/openspec/hooks (conduct-check.mjs, node:test), skill text (SKILL.md pinned by guard.test.mjs), docs/ADR pins
Blocking gaps (8-10 without a plan): 0
Coverage verdict: PASS
Seams checked (read, no mutation runs: 0):
- actorOf(step, host) -> deliveryStep(report.host ?? 'cli') -> caught by "under the app host implement is a session row..." (actor/agent/state, cli, absent host)
- detectHost(env) -> real report.host -> caught by "app host: a change at implement has next.actor session..." (real fixture, appEnv vs cli default)
- 'session' in RUNNABLE -> running when in --busy, dropped from dispatch -> caught by same test (state 'running', dispatch ['b'])
- selectDispatch cap with session rows + busy -> caught by "a dispatch of two sessions and one subagent is capped at three"
- addSessions descriptor (title, name, cwd, branch, phase, brief, background) -> caught by "the session descriptor has ..." (exact key set, values, brief phrases) - phase 1 only, see finding 1
- sessionPrefix on every row, session only on session rows -> caught by "sessionPrefix is on every change row" and the --json key-set test
- version 2 in report and in exit-3 object, wake gone, no wake line in human output -> caught by the version test, the --json test, the human-output line-list test
- worktree guard with the child's cwd and devkit-lite -> caught by the extended worktree test and the new devkit-lite test (assert exit codes 2/0 through the real hook)
- skill text (AC-3, 5, 6, 7, 8, 9), ADR 0006/0005/0001/config, READMEs -> caught by sentence pins in guard.test.mjs (verified each quoted sentence exists in SKILL.md at HEAD)

### Findings
- [important] [6] phase number at the descriptor seam is only exercised for phase 1 - failure: if `addSessions` (conduct-check.mjs, `const phase = c.next.phase`) or `briefOf` hard-coded or mis-derived the phase, `name` (`<prefix>${phase}`), `title`, `session.phase` and the brief for a change at phase 2 would be wrong and every test stays green (the only descriptor test uses `lites(['a'])`, phase 1; the deliveryStep session test passes a REPORT with no `phase`). The chain rule (AC-5) depends on phase 2 having a different name than phase 1. Write in: conduct-check.test.mjs, the "sessions" block, using a fixture with phase 1 ticked and phase 2 open under appEnv, asserting `session.name === 'a-p2'`, `session.phase === 2`, title and brief mention phase 2.
- [nit] impossible/tautological test: conduct-check.test.mjs "sessionPrefixes: plain, cut at 20, a two-digit phase keeps the prefix" - the loop `${prefix}${n}`.length <= 24 only concatenates a string in the test; it would stay green whatever `sessionPrefixes` returns for 10/99 (it does not call production with a phase). Its real value is the 20-char cut, which the earlier asserts already pin.
- [nit] implementation-coupled: the collision test recomputes `createHash('sha1')...slice(0,2)` in the test, so it pins the formula (which is the spec, D3) but would not catch a spec change made consistently in both places. Acceptable; no fix needed. Not covered: a collision after trailing-dash removal (e.g. `abcdefghijklmnopqrs-xyz` vs `...-abc`), same code path.
- [nit] skill-text pins are sentence-existence checks: they prove the wording is present, not that the flow works (D13 continuation, chain rule). The design assigns AC-5/6/7/9 to the live dogfood after merge, so this is by design; it is recorded in tasks "Workflow follow-up".
- [nit] docs/openspec-flow.md (rewritten "Conducting a round", troubleshooting rows, Limits) has no pin beyond `scripts/check.py` link checks; a stale `wake`/cron sentence there would not go red. Low risk, no verdict effect.

### Well covered
- AC-1 host split (app session vs cli subagent, absent host = cli, only `implement` becomes a session) - actorOf and deliveryStep tests plus a real-fixture test through `detectHost`.
- AC-2 wake removal and version 2 - three independent tests (JSON keys, human lines, exit-3 object).
- Busy/cap interplay - `running` state and `dispatch` exclusion under app, cap of three with two sessions + one subagent, and the busy=3 empty dispatch.
- Prefix safety - `add-x` vs `add-x-pagination` regex test asserts neither matches the other's names (the AC-7 bare starts-with trap), collision rule with SHA-1.
- AC-4 - the guard refuses the child's no-agent_type edit/Bash at cwd = worktree and admits tdd-implementer; devkit-lite refuses nothing. Real hook invocations, would go red on a guard regression.
- Harness isolation - `DEVKIT_HOST: 'cli'` pinned in cleanEnv and cli(), so the desktop app environment cannot flip existing tests.
