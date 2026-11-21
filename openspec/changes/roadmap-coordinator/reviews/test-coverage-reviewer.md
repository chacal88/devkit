Verdict: approved
Commit: 9307ba1dd24843a444fabc6594695db1888dc830

## Coverage analysis — roadmap-coordinator (6918c0d..HEAD)

### Findings
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:652 — [3] `run` without --session is refused (exit 3) in code, but no test omits the flag; dropping the guard would write session undefined and make U4 wipe in-flight state. Write in roadmap-loop.test.mjs beside U1-U4.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:378 — [3] Lock timeouts (updateRun 10 s, withOpenLock 60 s) are untested; a timeout in RH4 allows the hand-off but records nothing in flight. Fails open by design, rare. Write in roadmap-loop.test.mjs with an injected sleep.
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:1790-1921 — implementation-coupled: skill and docs tests pin SKILL.md and doc prose by regex; a rewording turns them red with no behavior change. Same convention as the change-loop skill tests.
- [nit] plugins/openspec/hooks/roadmap-loop.mjs:712 — [2] draft's fallback to en when the language setting is unknown has no test (only en and pt-BR are covered).

In-scope surfaces: plugins/openspec/hooks (roadmap-loop.mjs, change-loop.mjs, guard.mjs), plugins/openspec/skills/devkit/SKILL.md, and the docs and catalog files that tests pin.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0): guard routing to the roadmap or change locks (caught by the three-modes test); mainInRun and the product-edit refusal (lock edit tests, plus the unchanged change-run rows); roadmapRunOf, the transcript reader (six lock run tests, stored forms recorded by the probe); handOffFor and subagentStopFor extraction (existing change-loop lock tests unchanged, plus RH3); run file under concurrent writers, stale lock and broken file (real child processes); open lock in the git common directory (real child processes, name-taken for the loser); run bookkeeping through the CLI (U1-U4, next, resume, wait, hold, reply tests assert the run file state); late-writer pipe read (real child with delayed write); SKILL.md carrying --lang, --load-limit, the session id and the brief line (skill tests, prose pins); the cross-process flow is covered by the probe and the two live runs under proof/, which a unit test cannot replace.

### Well covered
- The pure core decideRoadmap, the classes C1-C8, places, starts, N1-N8, owner queue head, E1-E3 and `after`: each row of the design table has a named test.
- Hold on load: decide sets held and says so once; the stop lock allows it only while holding; hold sets and clears holding, also on error.
- Boundaries and negatives: parseWord refuses 0, -1, 1.5, 100, 2 3 and many with nothing written; limitOf and --interval edge values; previous-script skipped; unknown reply keys and a missing id give exit 3.
- RS5, RH5 and RU7 fail open on a folder-as-run-file, a broken file, no file and no project; the same fixture with a good file refuses.
- Message-table integrity: every key and code renders in both languages with the same key set.
- The stdin retry for a slow pipe uses a real child and a delayed write and matches the instant answer.
