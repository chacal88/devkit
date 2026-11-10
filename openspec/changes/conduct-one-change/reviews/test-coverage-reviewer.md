Verdict: approved
Commit: a527a0f40340e774a70af46ab3c0322394e60c3b
Round: 1

## Coverage analysis: conduct-one-change (origin/main...HEAD)

In-scope surfaces: plugins/openspec/hooks (conduct-check.mjs, node:test), conduct SKILL.md and docs pins (guard.test.mjs)
Blocking gaps (8-10 without a plan): 0
Seams checked (by reading; mutation runs: 0, suite not re-run, gate result 567 pass taken as given):
- parseArgs `--change` / `--round` exclusion / id rule -> conduct-check.test.mjs "--change through the CLI" (both orders, six bad ids, `--change=`, usage line)
- compute `change` branch skipping the roadmap read -> "reads no roadmap" test (roadmap removed from origin/main, exit 0, round mode still exit 3)
- single row equals round row -> AC-1 test compares next/state/sessionPrefix/session, background pinned literally
- roundOf(null) in the watch loop (`at + 1` would give NaN/0) -> "--change <id> --watch" test (flip to `ready`, timeout to `wait-checks`)
- evaluate worktree-without-folder throw -> its own test; round mode still `new-change`
- missingChange: "another branch" / "no change" / `archived` -> one test each; archived suffix collision (`old` vs `older-old`, `ol`) covered
- three `worktree` rows in single mode -> "keeps the three worktree rows"
- unfinished wire on every row (`entry ? unfinishedWork : null`) -> key-list test (null, round mode), clean/no-worktree null test, dirty, phases [2] and [1] gate-only, combined summary; round mode equality asserted
- skill text, README, ADR 0007, amended-by -> guard.test.mjs pins (substring pins, the project's convention)

### Findings
- [important] [6] A `chore/archive-<id>` worktree holding only the archived folder, read with `--change <id>`: the AC lists this case and D9 implies it, but no test runs `--change` against it. `evaluate` finds the worktree by `findWorktree` (conduct-check.mjs:141) and the "worktree without a folder" guard at conduct-check.mjs:~478 relies on `locateChange` accepting an archived folder. Making that guard live-only would turn the archive step of a single-change run (the last step before `archived`) into exit 3 "has a worktree without a folder", and no test goes red. · write in: conduct-check.test.mjs, next to the "worktree with no folder" test, using the existing archive-worktree helper (~line 764, `addWt(..., { branch: 'chore/archive-a' })`), asserting `t.state({ change: 'a' })` returns exit 0 and the same `next.step` as round mode.
- [nit] unfinished summary truncation: `dirty.slice(0, 3)` (conduct-check.mjs, unfinishedWork) is never exercised with 4 or more dirty paths; the dirty test uses 2. A broken slice would only change the summary. · write in: the dirty test in conduct-check.test.mjs.
- [nit] implementation-coupled: guard.test.mjs skill pins assert prose substrings (e.g. `/this run creates nothing/`, `/never sweeps/`); a legitimate rewording turns them red. Accepted project convention for skill text, no action needed beyond awareness.
- [nit] `--change` with `--busy` is not tested; `--busy` is shared code with the round mode, so low risk.

### Well covered
- Mode/change/round:null fields and the single-row equivalence with the round mode, including the single-change `background` text.
- All three exit-3 prefixes plus the three unchanged `worktree` rows and the `archived` row for an archived folder on origin/main.
- `unfinished`: null on clean and on no-worktree rows, `dirty` excluding openspec/ files, `phases` at a non-default phase number, gate-only phase, summary text, both modes.
- Watch on a single row, which would fail if `roundOf` were reverted.
