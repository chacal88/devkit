Verdict: approved
Commit: 63c5eac8f72e8319b9056b1c9ca52715cfaf775c

## Quality review — state-skips-unlocated (round 1)

### Findings
- [praise] plugins/openspec/hooks/change-loop.mjs:1788 — One shared unplacedAction helper feeds both the state command and collectRoadmap, so board and state agree by construction (ADR 0017).
- [praise] plugins/openspec/hooks/change-loop-remote-state.test.mjs:1397 — Each locate guard has its own negative test; run-file precedence and the archived-with-stale-copy and id-reuse cases are pinned; phrases come from render().
- [nit] plugins/openspec/hooks/change-loop.mjs:1843 — stateEntries keeps two caches (days via archivedDates, archived via archivedOnDefault) that can read GitHub/git twice in one command; derive archived from days.
- [nit] plugins/openspec/hooks/change-loop.mjs:1796 — unplacedAction's holder comes from knownChange/checkoutsOf, which does not skip train/<n> checkouts as unfinished does; a train-only folder could read wrong-branch with the train as root (was exit 3 before, untested).
- [nit] openspec/changes/state-skips-unlocated/requirements.md:18 — requirements.md words the new locate step without design D-5's narrowing (active folder, main holds none); spec, docs, tests and evidence state the narrower rule, requirements was not revised.
- [nit] plugins/openspec/hooks/change-loop.mjs:1411 — locate now calls realpathSync(start) on every fall-through path; a nonexistent start would throw where it used to fall back (no such caller found).

### Summary

- 6 findings (0 blocking, 0 important, 4 nit) + 2 praise.
- Justification: read the product diff (change-loop.mjs, roadmap-loop.mjs), the new tests (remote-state, roadmap-loop-upfront, fixtures, compozy pin), docs and release files, and the plan (requirements, design D-1..D-8, tasks, specs, evidence, proof/real-run.txt). Task items match the code and proof; the real run shows exit 3 before and exit 0 after for state and the board in en and pt-BR, nope still exits 3, next from x's worktree exits 0. No ADR is contradicted (wrong-branch is reused, no new code). Perf is one git worktree list plus a few existsSync per open line. Filtered run of the 'unlocated' tests at 63c5eac: 39 of 39 pass (the two moved suites). The whole suite and check.py are the train's to prove. No open blocking or important finding, so the verdict stands at approved.
