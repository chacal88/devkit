Verdict: rejected
Commit: 9307ba1dd24843a444fabc6594695db1888dc830

## Quality review — roadmap-coordinator (round 1)

### Findings
- [important] openspec/changes/roadmap-coordinator/evidence.md (AC-8, AC-10) — AC-8 (stop word) and AC-10 (draft offered when there is no roadmap) are marked pass on tests alone; the evidence itself says no live run exists, so there is no real command output. Both are cheap to run for real.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:373-381 and change-loop.mjs withOpenLock — Stale-lock takeover is a check-then-unlink: two waiters can both judge the lock stale, and the second unlink can delete the first one's fresh lock, so both enter the critical section. The window is tiny and only follows a crash.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:743,684 — Ids from `--param id=` and `--after <id>=` become keys of plain objects (`run.declared[id]`, `after[...]`) with no check against the roadmap. An id such as `__proto__` mutates the object's prototype instead of recording an entry. Validate with the BRIEF_OF id pattern or use Object.create(null).
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:387-389 — If writeFileSync of the temporary run file throws, `roadmap-run.json.<pid>.tmp` is left behind; the lock is released but the temporary file is never removed.
- [nit] plugins/openspec/hooks/hooks.json:27 vs roadmap-loop.mjs:334 — The `agent` hook times out at 10 s, but `updateRun` can wait up to 10 s for the run-file lock, plus the flow reads. A contended lock could hit the hook timeout; the lock is normally held for milliseconds. Lower `LOCK.waitMs` for the hook path or raise the timeout.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:344-364 (holding/inflight) — A killed `hold` or `wait` leaves `holding` or `inflight` set, and a same-session `/devkit roadmap` keeps them (U4). The run then neither ends nor re-emits the hold until `--fresh` or a new session. The design lists this risk and its way out, so it is a nit.
- [praise] plugins/openspec/hooks/change-loop.mjs (subagentStopFor, handOffFor) — The change run's stop-lock and hand-off logic was extracted into shared functions that the roadmap locks reuse, instead of copying it. The one-change behaviour is kept, and the 1105-test suite stayed green.
- [praise] plugins/openspec/hooks/roadmap-loop.mjs:125-253 — The decision core (`classifyLines`, `entriesOf`, `decideRoadmap`, `boardOf`) is pure: facts in, decision out, no AI calls and no hidden I/O. The pure part is cleanly split from the I/O in `collectRoadmap` and `updateRun`.
- [praise] openspec/changes/roadmap-coordinator/evidence.md — Each acceptance criterion separates what was shown live from what the tests prove, and names what is left for the next change. The probe and two live runs show defects found, fixed test first and re-run.

### Summary
- 9 findings (0 blocking, 1 important, 5 nit) + 3 praise
- Justification: I read roadmap-loop.mjs in full, the diffs of guard.mjs and change-loop.mjs, the plugin and marketplace version bump, the CHANGELOG line, the ADR list in config.yaml, tasks.md (24 of 24 ticked) and evidence.md. I did not re-run the suite, as instructed.
- The intent matches the diff. The roadmap locks hang off `roadmapRunOf`, which is read from the transcript the same way as `runOf`. The `lock()` dispatch falls back to the change loop, and every lock fails open on its own errors. The shared extraction leaves `/devkit change` unchanged. I found no contradiction between the ADR 0013 / design text and the code, no variant (class N1 to N8, RH, RS, RU) without a test, and no listing or N+1 problem on a hot path beyond what the existing change lock already does.
- F1 is the only item that blocks approval as written. Acceptance rule 3 asks for real output. AC-8 and AC-10 are honestly labelled test-only, a deliberate proof-versus-dogfood split, so I rated it `important` rather than `blocking`. The fix is to run `roadmap-loop.mjs draft` in a scratch repository with no roadmap and `run` with the word `stop` against a started run, then add the output to evidence.md. Alternatively, contest it by recording in evidence that the split is the owner's decision. With F1 closed or contested with evidence, the verdict stands as approved; until then the round does not satisfy the open-`important` rule.
- The nits do not change the verdict and are the implementer's to decide.
