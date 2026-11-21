Verdict: approved
Commit: ba000172e43ae6b2bfc979d744bcc6da7b045c13

## Quality review — roadmap-coordinator (round 2)

### Findings
- [important] openspec/changes/roadmap-coordinator/evidence.md (AC-8, AC-10) — AC-8 (stop word) and AC-10 (draft offered when there is no roadmap) were marked pass on tests alone, with no real command output. · fixed in ba000172e43ae6b2bfc979d744bcc6da7b045c13
- [nit] plugins/openspec/hooks/change-loop.mjs:889-893 (withLockFile) — Stale-lock takeover is a check-then-unlink. Two waiters can both judge the lock stale, and the second unlink can delete the first one's fresh lock. The refactor moved this into the one shared helper, so it now covers both the open lock and the run file. The window is tiny and only follows a crash.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs (run.declared[id], after[...]) — Ids from `--param id=` and `--after <id>=` become keys of plain objects with no check against the roadmap. An id such as `__proto__` changes the prototype instead of recording an entry.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:377-379 (updateRun) — If writing the temporary run file throws, `roadmap-run.json.<pid>.tmp` is left behind. The lock is released, but the temporary file is never removed.
- [nit] plugins/openspec/hooks/hooks.json:27 vs roadmap-loop.mjs LOCK.waitMs — The `agent` hook times out at 10 s, but `updateRun` can wait up to 10 s for the run-file lock, plus the flow reads. A contended lock could hit the hook timeout.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs (holding/inflight) — A killed `hold` or `wait` leaves `holding` or `inflight` set, and a same-session `/devkit roadmap` keeps them. The design names this risk and its way out (`--fresh` or a new session).
- [praise] plugins/openspec/hooks/guard.mjs:355-445 (transcriptEvents, runOf, roadmapRunOf, mainInRun, lock) — One transcript scan with two interpreters over it. `mainInRun` and `lock()` scan once and pass the events on, and the optional `events` parameter keeps the old call shapes working.
- [praise] plugins/openspec/hooks/change-loop.mjs:876-912 (withLockFile) — The lock loop that was duplicated in two files is now one helper with an injectable `sleep` and `timeout`. The callers keep their own error messages and timings, and the new tests exercise the helper directly.
- [praise] openspec/changes/roadmap-coordinator/evidence.md (AC-8, AC-10 rows), proof/evidence-runs/ac8.out and ac10.out — Real runs in scratch projects, with the stop word, the resume and the untracked draft shown step by step. The rows state what is not shown (the session side) instead of overclaiming.

Verdict: approved

### Summary
- 9 findings (0 blocking, 0 important open, 5 nit) + 3 praise; the one round-1 important (F1) is fixed.
- Justification: I checked F1 against the real output in ac8.out and ac10.out. The runs match what evidence.md says: `devkit-roadmap: stop` with empty actions and a `stopped` end, then the resume; and the draft written untracked, with the commit count staying at 1.
- I read the full diff of a6df7b9 for change-loop.mjs, guard.mjs and roadmap-loop.mjs. `withLockFile` keeps the old lock semantics: the `wx` create, the stale takeover, the timeout and the release in `finally`. An undefined `sleep` falls back to the default parameter, and the run file lock still creates an empty file because no `holder` is given.
- `runOf` and `roadmapRunOf` interpret the same events as before. Typed commands, tool-result texts and the stdout fallback are preserved, and a read error still returns null so the locks fail open.
- Each hook call now reads the transcript once on every path.
- I found no new defect, so the nits from round 1 stand and I did not widen the review. The suite result was handed over (1112 of 1112 pass) and I did not re-run it.
