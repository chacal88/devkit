<!-- devkit-stage retro result=passed attempt=1 commit=ef80a2b44e03db2e3b086ec2936b8ff1c5a4bc8c -->
## Retro: stage-roles

1. Went wrong:
   - The plan was revised twice after the implementation started. Phases 1 and 2 changed messages, schema keys and docs that existing tests already asserted, and those tests were not in the plan's T table. Each time the run stopped blocked, the planner added rows (T-8 to T-11), the readiness review ran again and the owner approved again. The loop did not see that the plan revision made the readiness review and the approval stale, so the session ran the readiness review by hand. That gap is already carried to `coordinator-loop-fixes`.
   - The installed devkit-openspec 0.18.1 loop refused the new `flow.json` (the unknown key `appliesWhen`), so the whole run used the worktree's own `change-loop.mjs`.
   - Main moved five times while PR 58 waited: PR 56 (the planned hold), then #59, #61, #60 and #63. The ruleset's strict checks need the branch up to date, so each move meant another merge from main. Each merge brought back the same conflicts in the release files (marketplace, plugin manifest, CHANGELOG, the CI pin and its assertion), and each cost a full evidence run and a review. The first merge also collided on the ADR number (main took 0014 and 0015, so this change's ADR became 0016) and on the devkit-core version (0.9.0 on both sides, so this change moved to 0.10.0).
   - The first merge dropped a spec scenario without any test noticing. Main added a scenario to a requirement that this change's `roadmap-coordination` delta modifies, and the delta's MODIFIED block replaced the requirement without it. Only `openspec validate --strict` in the evidence caught it. That failure was the third attempt of the demonstration, so the stage hit its limit, and the owner authorized going past it. Later merges took the demonstration to attempt 7.
   - The GitHub `check` job failed on a test that passed locally. The AC-1 roadmap test read `git show 2300f84:openspec/roadmap.md`, and CI checks out at depth 1, so the commit was not there. The fix holds the old line as a constant.
   - The owner's Linux worker ran out of `/tmp` inodes during phase work. The suites leave fixture folders behind. The owner authorized deleting the devkit test folders older than 60 minutes, and every later run used `TMPDIR=/var/tmp`.
2. Better next time:
   - When a plan changes a message, a schema key or a doc string, the planner greps the test files for it, and every test that asserts it becomes a row of the T table.
   - A test never reads the repository's git history. CI checks out at depth 1, so old content is held as a fixture or a constant.
   - After every merge from the base, run `openspec validate <id> --strict` before the evidence, so a spec delta that lost main's scenario is caught as a merge defect, not as an evidence attempt.
   - A failed evidence attempt that a merge from the base caused does not count toward the stage's limit.
3. Remember: in a change whose PR waits while others merge, every base move costs a merge, an evidence run and a review, and the spec deltas must be checked against main's new text each time.

| # | Learning | kind | action | scope |
|---|---|---|---|---|
| 1 | Existing tests that asserted changed messages and keys were missing from the T table, and the plan was revised twice mid-implementation | process-friction | rule (proposal 1) | project |
| 2 | A test read git history that CI's depth-1 checkout lacks | bug-class | rule (proposal 1) | project |
| 3 | A merge from main left a MODIFIED spec requirement without main's new scenario, caught only by the evidence's `openspec validate`, and that failure counted toward the demonstration's limit | tooling | followup (proposal 2) | project |
| 4 | Main moved five times under PR 58, each costing a merge, an evidence run and a review | tooling | followup (already the roadmap lines `fresh-base-check` and `delivery-merge-hold`, round 17h) | project |
| 5 | The loop did not see a plan revised after the implementation started | tooling | followup (already carried to `coordinator-loop-fixes`) | project |
| 6 | The installed 0.18.1 loop could not read the new `flow.json`, so the run used the worktree's script | tooling | memory-only: a change that adds a flow key runs its own loop until it ships | project |
| 7 | Hook test suites fill a tmpfs `/tmp`; runs on the Linux worker use `TMPDIR=/var/tmp` | environment | followup (already the roadmap line `test-fixture-cleanup`, round 17g) | project |
| 8 | A docs test read `openspec/changes/stage-roles/approval.md`, a live change path that the archive moves, so the archive PR's check went red | bug-class | regression-gate (proposal 3) | project |

## Proposed updates

### `openspec/config.yaml` (project-rule)
Two lines for the context every agent gets, after the `Parsers:` line: the planner lists the existing tests that assert what the plan changes, and a test never reads repository history.
- before: `  Parsers: A plan that moves or writes a parser decides what unterminated input does (an unclosed fence, a missing closing line, an empty file); the readiness review asks for it.`
+ after: the same `Parsers:` line, followed by `  Existing tests: A plan that changes a message, a schema key or a doc string greps the test files for it, and every test that asserts it is a row of the plan's test table; the readiness review asks for the grep.` and `  Test history: A test never reads the repository's git history (CI checks out at depth 1); old content is held as a fixture or a constant.`
- Answer: approved
- Applied: yes

### `openspec/roadmap.md` (tooling)
One follow-up line in round 17h, after `archive-release-pin`.
- before: (round 17h ends with the line `archive-release-pin`)
+ after: `- [ ] post-merge-validate — after a merge from the base, the delivery loop runs \`openspec validate <id> --strict\` before the evidence and sends a failure to the planner as a merge defect, and an evidence attempt that a base merge made stale or red does not count toward the stage's limit; in stage-roles a merge from main left the roadmap-coordination delta without main's new scenario, and the evidence's third attempt hit the limit (stage-roles retro, item 3)`
- Answer: approved
- Applied: yes

### `plugins/openspec/hooks/change-loop.test.mjs` (bug-class)
Found at the archive: the test of ADR 0016 read the change's `approval.md` from its live folder, which `openspec archive` moves, so the archive PR's `check` job failed with ENOENT. The test now reads `approval.md` from the live folder when it exists, else from the archived one; every assertion is unchanged. The owner approved this fix in the archive PR on 2026-11-22, in the answer `Sim, corrigir`.
- before: `const approval = readRepo('openspec', 'changes', 'stage-roles', 'approval.md');`
+ after: the test reads `openspec/changes/stage-roles/approval.md` when it exists, else the latest `openspec/changes/archive/<date>-stage-roles/approval.md`
- Answer: approved
- Applied: yes
