<!-- devkit-stage readiness result=passed attempt=2 commit=35b4b579715c1b3f8f5a078a358efb793a5f703d -->
# Readiness review: state-skips-unlocated

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Attempt 2, judged afresh. The three mandatory fixes of attempt 1 are closed: the archived check now
comes before the blocked stand-in (D-3, with a spec requirement and test 1.19), the run-file scenario
has a state test and a board test (1.18, 2.8), and AC-7 has a test that fails without the inserted
sentences (3.1). No finding is mandatory. Short checks run on the base at this commit, with
`TMPDIR=/private/tmp/devkit-state-skips-unlocated`: `openspec validate state-skips-unlocated --strict`
valid, `python3 scripts/check.py` "all checks passed", `python3 scripts/gen-catalog.py --check` exit 0,
`claude plugin validate .` "Validation passed". The long gates (the hook suites) were not run, as the
caller instructed; the plan runs them once in 3.5 and marks them as background commands.

## 2. Scope validation
Classification: correct. The problem (one worktree on an odd branch makes `state` and the board exit 3
and hide every change) is in `proposal.md` Why. In-scope, non-goals (`next`, `wait`, `session-next`,
`draft`, `status --json` keep their behaviour) and unchanged behaviour are explicit (`proposal.md`
45-48; `design.md` Non-Goals 52-61). The roadmap run's `next` and stop lock changing behaviour (D-4) is
a consequence of the one fact collector, is disclosed in the proposal, design and R-2, and is flagged for
the owner at approval; it is not inflation. The archived step (D-3) is inside AC-6 and the plan's own
spec requirement, not new scope.

## 3. Proposal review
Problem, goal, capabilities (`change-state`, `roadmap-coordination`, both modified), impact and
exit criteria are clear. Low: the file is 94 lines, at the edge of the "under two pages" rule in
`openspec/config.yaml`; and "Before it, the state command checks the archive" (line 26) reads "it" as the
stand-in without saying so. Neither blocks.

## 4. Design review
Every claim about internals was re-derived in the code at this commit:

- `locate` (`change-loop.mjs:1247`): archive worktree, worktree on `<id>`, then `mainRoot`; it never
  reads the caller. Confirmed. `knownChange` (1602), `checkoutsOf` (1508), `stateEntries` (1644, the
  archived stand-in object at 1661), `archivedDates` (1542), `archivedOnDefault` (1566), `createdAfter`
  (1570, module-private, same file, signature `(root, id, archivedDay)`, a folder with no creation day
  reads as the stale copy), `unfinished` (1582, uses the same `createdAfter` test at 1595): confirmed.
  D-3's step 2 uses the same sources and the same test `unfinished` uses, so the list and `--change`
  agree on a stale copy.
- `collectFlow` throws `no change named <id>, active or archived` (`flow-check.mjs:240`); nothing in
  `stateEntries` catches it; `failure()` is at `change-loop.mjs:2537`. Confirmed.
- `collectRoadmap` (`roadmap-loop.mjs:680`): the `nextAction` at 728 is uncaught; a declared line is
  skipped at 723 before any action is read; `readFlying` is true for the board (1484); an in-flight line
  is skipped only without `readFlying` (726). `classifyLines` classes an archived line before any action,
  so it never reaches the helper (D-3 closing paragraph). Confirmed.
- `changeState` (`change-loop.mjs:794`): with a blocked stand-in action, a declared blocked end gives its
  own reason (813: `tests-red`, text `the tests of phase {phase} failed` at 306), and an in-flight agent
  gives `running` with `stage = inflight.stage` (809-812). So tests 1.18 and 2.8 expectations
  (reason `tests-red`, not `wrong-branch`; `running` with stage `design`) are what the code gives.
  `entriesOf` (`roadmap-loop.mjs:183`) places an in-flight line before the action is looked at (`running`)
  and a blocked end as `blocked`: the board follows the run file first, as the state command does.
- `endOfAction` (765) and `blockedReason` (762) give `{ code: 'wrong-branch', text }` from the stand-in's
  `end` and `params`; `wrong-branch` is in `MESSAGES` in both languages (308, 563); `BLOCKED_STEP` (941)
  maps `stop-branch` to it. Confirmed; D-1 holds.
- Test 1.19's fixture: `archiveGh`, `archiveOnOrigin`, `withCreated`, `listedBy` exist at
  `change-loop.test.mjs:2647-2678`. In the base's "field-fixes 1 archived" test (2706) the main checkout
  is behind `origin`, `old-wt` holds the stale active folder (no `created:` line) and the id is not
  listed, so `createdAfter` is false for it and 1.19 (i) reads `archived`; 1.19 (ii) rewrites
  `.openspec.yaml` with `created: 2026-11-21` (after the archive day `2026-11-20`) and reads `blocked`.
  Both outcomes follow from the code.
- Test helpers named in D-7 exist: `stateCmd`, `writeRunFile` (`change-loop.test.mjs:5726, 5731`),
  `readRepo` (2256); in the roadmap suite `projectWith` (763), `doNext` (769), `doStatus` (770),
  `putRun` (774), `addOpen` (785), `inFlight` (789), `lkProject` (1272), `stopOf` (1363), `placedOn`
  (4616), `cmd` (767), and `changeMain` (the import of `main` from `change-loop.mjs`, line 13).
- Test 3.1: the paragraph "**A change's state.**" is `docs/openspec-flow.md:240`; none of
  `wrong-branch`, `chore/archive-` or "the checkout it is called from" is in it on the base (grep count
  0 on that line), so 3.1 fails without the new sentences and "change-state ADR 0017: the documents
  follow" (5962) still finds its anchors.
- Existing-test anchors in the D-7 table were sampled at this commit (change-loop.test.mjs 100-117,
  510, 860, 1056, 1078, 1163, 1753, 2663-2710, 5740-5837, 5855, 5962, 6115; roadmap-loop.test.mjs 563,
  902, 1363, 4629, 4649, 4681, 4759; release-merge.test.mjs 426): each lands on the named test. The
  claim that no existing test pins the replaced rules holds (no test calls `locate` or `knownChange`).
- ADR 0017 and ADR 0010 do not pin `locate`'s order, and no rejected alternative is reintroduced (the
  "each surface keeps its own reading" alternative stays rejected by the shared helper).

Findings:

- Low, Fix during implementation: test 1.19 sets the fixture with `archiveOnOrigin`, which leaves a
  second worktree (`pusher`) that holds the archived folder. The helper's holder is the first checkout
  `knownChange` finds; `git worktree list` gave alphabetical order for linked worktrees here (git 2.50),
  so `old-wt` comes before `pusher`, but that order is git's, not the test's. If a git lists `pusher`
  first, 1.19 (ii) would read `archived`. Smallest correction: in 1.19 (ii) assert `branch` `old-wt` as
  the plan does and, if it flakes, remove the `pusher` worktree after `archiveOnOrigin` pushes.
- Low: when `locate` picks a worktree on branch `<id>` that lacks the folder while another checkout holds
  it, the helper gives `wrong-branch` where the base exited 3. Disclosed and accepted in D-2 and R-3.

## 5. Specs review
Both deltas use `SHALL`, have WHEN/THEN scenarios and validate strictly. Every outcome row of D-3's order
has a scenario: blocked stand-in (the list, `--change`, both languages), the run file first (declared end
or in flight, "and the board shows the same"), unknown id (exit 3), a placeable change (as before), the
archived stale copy and the reused id (the new requirement "The archive is checked before a change is
listed unplaced"), and the six `locate` cases. The roadmap delta covers the board, its language, the
agreement with the command, the run's decision and the stop lock. Scenario to test map: "A change the loop
cannot place" to 1.11-1.14 and 1.18; "The run file weighs first" to 1.18 and 2.8; "An id nobody knows" to
1.10 and 1.15; "A change the loop can place" to 1.9 and 2.7; the archive requirement to 1.19; the `locate`
requirement to 1.1-1.8, 1.16 and 1.17; the roadmap requirement to 2.1-2.6. No requirement lives only in
`design.md`.

## 6. Tasks review
Phases 1 to 3 each end in a gate task with one backticked command; the AC table covers AC-1 to AC-7; the
"test first" task of each phase saves `proof/red-<phase>.txt` and its red-run line is specific and
correct against the code: 1.1 and 1.9 to 1.14 and 1.16 to 1.19 fail, 1.2 to 1.8 and 1.15 pass on the old
`locate` (the archive and own-branch worktrees already win, the caller and the main checkout return the
main root today); 2.1 to 2.6 and 2.8 fail (the board and stop lock die on the unplaced line), 2.7 passes;
3.1 fails. Task 1.3 carries D-3's order (helper, archived step, blocked stand-in, then the unchanged
branches). The release task names "the next patch version after `origin/main`'s at the last merge before
review", never a literal number; the doc task names the test that pins the sentences. The base's short
gates are green (section 1). Every task path falls under a real directory (the `proof/` folder is created
by the first red run). No task hides a decision behind "define" or "handle": the code shapes are in D-2,
D-3, D-4 and D-5.

## 7. Omission detection
- Validation and errors: the unknown-id exit 3 is kept and tested (1.15); `openspec` missing and
  unreadable settings keep their paths (the helper only reads, `nextAction` is not reached for an
  unplaced id). Idempotency and side effects: `state` and the board only read; 1.12 compares `a`'s entry
  with and without the worktree.
- Compatibility: a caller in the main checkout or the change's own worktree returns today's value (1.4,
  1.5); the main checkout holding any folder of the change keeps `locate` as before (1.7, 1.6).
- Performance: R-4 covers `state`, the Stop hook's extra `locate` per open line, and the lazy
  `archivedDates` read.
- Rollback: one edit per surface (Migration Plan). Observability, retries, authorization, feature flags
  and data migration: none applies.

## 8. Execution risks (top 5 failures)
1. Sibling changes collide on `change-loop.mjs`, `roadmap-loop.mjs` or the release numbers. Cause: R-6.
   Impact: a conflicting merge or a stale version. Prevention: the two merges of `origin/main` in tasks
   1.1 and 3.3, numbers re-read at the last merge before review.
2. A `locate` caller somewhere depended on the main-checkout fallback from a worktree on another branch.
   Cause: R-1. Impact: a silent behaviour change in a hook. Prevention: tests 1.4 to 1.8 pin the
   neighbours, and the whole suite runs in 3.5.
3. The roadmap run's `next` and stop lock change on an unplaced line (D-4, R-2). Impact: the owner meets
   a different run than before. Prevention: disclosed for approval, pinned by 2.4 to 2.6.
4. Test 1.19 (ii) depends on which holder `knownChange` finds first (section 4, Low). Impact: a flake on
   one git version. Prevention: the assertion on `branch` `old-wt` shows it at once; remove the extra
   worktree if it flakes.
5. `realpath` differences (`/tmp` and `/private/tmp`) on macOS miss the main-checkout comparison in D-5
   (R-5). Prevention: both sides go through `realpathSync`, gates run with `TMPDIR=/private/tmp`.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] 1.19: make the holder independent of git's worktree order (section 4, Low).
- [ ] `proposal.md:26`: say "Before the stand-in" instead of "Before it"; trim the file under two pages.

## 11. Explicitly out of scope
- [ ] Making `next`, `wait`, `session-next`, `draft` or `status --json` succeed for an unplaced change
  (the plan's own non-goals).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: `proposal.md` Why and AC-1 to AC-5.
2. Is the result measurable? Yes: each AC has a test (the table in D-7) and a real-run line (D-8, 3.4);
   AC-7 is pinned by 3.1.
3. Are error behaviors defined? Yes: exit 3 for an unknown id (AC-4, 1.15), the stale copy of an archived
   change (1.19), the reused id (1.19 ii), the run file's declared end (1.18).
4. Are edge cases covered? Yes: the neighbours of `locate` (1.2-1.8), the helper's four guards (1.9-1.11),
   the run file (1.18, 2.8), the archived stale copy and the reused id (1.19), a placed line (2.7).
5. Are dependencies clear? Yes: ADR 0017 and ADR 0010, the two specs, phase order 1 -> 2 -> 3.
6. Are contracts defined? Yes: the helper, the stand-in object, the entry shape, the `locate` code and the
   D-3 order are written.
7. Can two developers interpret this differently? Not on a behaviour: the check order is fixed in D-3 and
   in the spec; only the 1.19 fixture detail (section 4) is open.
8. Are any decisions implicit instead of written? No: D-1 to D-8 and R-1 to R-7 write them.
9. Do the tasks fully deliver the intended outcome? Yes: tasks 1.1 to 3.5 cover every AC and the
   phase gates.
10. What will be discovered too late if implementation starts now? Only a merge collision with a sibling
    change (R-6) or the 1.19 holder order on another git version.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation; the two items of section 10 are optional.
- Main risk if ignored? A flaky 1.19 (ii) on a git that lists worktrees in another order, and the owner
  meeting the roadmap run's changed behaviour on an unplaced line, which the plan flags for approval.
