<!-- devkit-stage readiness result=failed attempt=6 commit=900672c59291ce094cee32ebb1e1354c4a76a9cb -->
# Readiness review: roadmap-sessions-upfront

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no (phase 9 only; phases 1 to 8 are ticked and unchanged)

Blockers: 3, all narrow and fixable in the plan files (design.md, tasks.md, the spec delta). Stage reached: phases 1 to 8 done and reviewed, phase 9 (design D-18, after review round 1 at `5edea6b`) planned and not started. Attempt 6, over the plan at `900672c`. The caller named points to check and suggested no verdict; this verdict is mine.

Checks run here: `openspec validate roadmap-sessions-upfront --strict` valid; `python3 scripts/check.py` prints `all checks passed`; `python3 scripts/gen-catalog.py --check` clean; the worktree is clean. Not run, left to the caller: the whole suite (task 9.6 runs it as a background command). No gate of phase 9 is red on the base except by design: the new tests do not exist yet and T-27 is still the old assertion.

The approval on disk predates this revision. That is the owner's gate (D-18 says so itself), not a defect, and it is not counted below.

## 2. Scope validation
Classification: correct. Phase 9 answers the three verified findings of the review and nothing else: records for the ADRs (item 1), a spec qualification (item 2), two small code changes (item 3). No criterion of `proposal.md` and no line of `requirements.md` changes. The proposal bullet at `proposal.md:81-87` and the Decisions cited paragraph (`:187-189`) say the same as D-18 and as the spec delta.

## 3. Proposal review
No finding. The new bullet states the place rule, says it is a decision for the owner, and lists ADR 0020 decisions 5 and 8 as amended for a change session of this machine on the run's ticket.

## 4. Design review
Claims of D-18 re-derived on the branch (HEAD `900672c`):

- `placeFacts` (`change-loop.mjs:1349-1359`): reads the claim, takes `readRun(runFilePath(found.root)).places` for `run`, answers `taken: true` as soon as `refs/remotes/origin/<id>` holds `approval.md`, otherwise counts the other claims of its machine with `placed === true`. Matches D-18's reading. `buildPart` (`:1186-1190`) is the only user: `no-place` end or `take-place` hand-off, and only for `spec.stage === 'implementation'` (`:1310-1311`). Confirmed.
- `sessionNext` (`roadmap-loop.mjs:1027-1046`) applies `sessionDecide` exactly when `run.changeSessions && run.tickets[id]?.claimedBy`. `sessionDecide` (`:954-993`) runs `placeDecision` only for an `agent` or `session` action in a load part; a blocked `end` such as `no-place` passes through it untouched. So the stall D-18 describes is real: a `no-place` end is no `held` action, the session's wait ends, and nothing wakes it after the plan push lands. The `wake` of `decideRoadmap` (`:429-444`) matches only an `own` entry whose action is still the `no-place` end. Confirmed.
- Does the proposed fix make exactly one gate apply? Yes, for each change, by construction: the condition `placeFacts` would test (`places === 'run'`, `changeSessions`, `tickets[id]?.claimedBy`) is the condition `sessionNext` tests. `runFilePath` resolves the git common directory (`run-file.mjs:23-30`), so `found.root` (the change's worktree) and `start` (`findRoot(cwd)`) read the same file. `change-loop.mjs` already imports `readRun`/`runFilePath` (`:42`) and never imports the roadmap script, so ADR 0021 decision 8 holds. A claimed change then meets only `sessionDecide`, an unclaimed one only `buildPart`'s gate.
- Can a claimed change still wait forever? Not on this path. After the fix it is `held` (`why: place`, state `running`, title `⏳`), and its held-session wait plus the check's `queued` handout (`:1679`) are what free it. An unclaimed change of this machine ends `no-place` and the `wake` counts the same claims its gate counts (`:436-440`), so the wake reads the count of the gate it wakes for. Confirmed.
- ADR 0020 and ADR 0021: ADR 0020 decision 5 says a change "takes a place ... by pushing its approved plan", counted from GitHub, "nothing is scheduled"; decision 7 says no hook reaches another machine; decision 8 makes the place wait a blocked end with the title `⏳`. D-18's reading (a claimed session change takes its place from the run file, is `running` with the reason `place`; another machine's, and an unclaimed change's, stay as ADR 0020 says) is consistent with the code (`roadmap-loop.mjs:325-326` for the ticketless remote start, `:346` for `places: 'run'`) and with ADR 0021 decisions 2 and 5. Amending decisions 5 and 8 only is right; the Note says decision 7 and the rest hold.
- Board row: `boardOf` (`roadmap-loop.mjs:564-568`) uses `takenBy(name)`, claims with `placed === true`. The facts already carry `tickets`, `occupied` and `claims` keyed by id (`:691`, `:750`), so change 2 of D-18 needs no new read.

Findings from the claims:

**F1. Medium, Mandatory before implementation. Two populations, two counts, one SHALL that the plan does not hold.** D-18 "Never looser than either rule?" (`design.md:1419-1430`) shows an unclaimed change is stricter than `occupied`. It does not look the other way. A claimed change `a` is gated by `occupied` only, which never holds an unclaimed change `d` (no `session-next` for `d`, so no entry). `d` takes its place by the claims on `origin`. With the number 1, `a` in `occupied` and `d` placed, this machine runs two changes in a load stage, and the new row reads 2 of 1. The new requirement says the row "SHALL count both", and the existing requirement "A place is held only by a change that loads the machine" says "At most the run's number of this machine's changes SHALL hold a place at once" (`spec.md:20-23`). So the spec text can be falsified by a case the design leaves unsaid. How likely: an unclaimed ticket in a session run is the documented fallback (R-1: the entry refuses and the owner types the change's command), so it will happen. It is not a regression (before the fix the claimed change was already ungated by claims once the push landed) and it does not make anything wait forever. Smallest correction: add a paragraph to D-18's "Never looser" saying the two populations are counted apart and the run's number can be exceeded by changes the coordinator holds no ticket for, with the board reading above the number as the signal; and qualify "At most the run's number" in the spec delta (or the new requirement) to "of the changes whose session claimed the run's ticket". The owner approves item 3 on exactly this text, so it must say it.

**F2. Medium, Mandatory before implementation. `tasks.md` 9.4 contradicts D-18 and test 4 on where the `Amended by` line of ADR 0020 goes.** `design.md:1332-1334` says the line goes "right after `- Status: accepted`, where ADR 0013 and ADR 0014 hold theirs", and the test asserts it in "its first eight lines" (`design.md:1456`). `tasks.md:625-626` says "after `- Amends:`". ADR 0020's `Amends:` block is lines 6 to 10 and `Accepted by` is line 11 (`docs/adr/0020-...md:1-11`), so an implementer who follows 9.4 puts the line at 11 or 12 and the test written from D-18 fails; one who follows D-18 contradicts 9.4. Smallest correction: 9.4 says "right after `- Status: accepted`, as ADR 0013 and ADR 0014 do" (the same form ADR 0004's test already uses, `roadmap-loop.test.mjs:5124`).

**F3. Medium, Mandatory before implementation. The fixture of tests 1 and 3 does not say whether `b`'s ticket is claimed, and the two tests need it opposite.** D-18 "The tests this asks" (`design.md:1447-1455`) fixes only "`a`'s ticket claimed" for the shared fixture. Test 1 expects the board's row `taken: 1` with `occupied: { a }` and `b`'s claim placed, which holds only when `b` is claimed (an unclaimed `b` counts by the rule of change 2, giving 2). Test 3 is "the same fixture with `a`'s ticket unclaimed" and expects "the board's row counts `b`'s placed claim", which holds only when `b` is unclaimed. Two developers will write different fixtures, and one of them will see a test that cannot pass. The spec scenarios "A change of this machine with no claimed ticket" and "An approved plan pushed is no place taken on this machine" (`spec.md:41-48`) have the same gap about `b`. Smallest correction: name `b`'s ticket in each test and in the two scenarios (claimed in test 1 and its scenario, unclaimed in test 3 and its scenario, or say that test 3's board half uses its own fixture).

## 5. Specs review
The new requirement has normative language and five scenarios. Outcomes of D-18 item 3 each have one: the claimed change before and after its push, the place freeing before the claim does, the unclaimed change, the per-machine places. "Never looser" has the gaps of F1 and F3 above. The scenario "The places of each machine with the machines setting set" does not say that `b` of this machine is a claimed session change (it reads as one, since `b` "waits in its own session"); folded into F3. `openspec validate --strict` passes.

## 6. Tasks review
- Order and test-first: 9.1 writes the four tests and T-27, runs them on the unchanged code with a named command and saves `proof/red-9.txt`, listing which pass there (the unclaimed-gate test, which pins today's behavior) and which fail and on what assertion. This is the pattern phases 1 to 8 used (`proof/red-1.txt` to `red-8.txt` exist). 9.2 and 9.3 are the code, each with its own check; 9.4 the documents; 9.5 the focused gate; 9.6 the whole suite. Order is right. The new tests live in `roadmap-loop.test.mjs`, which `guard.test.mjs` imports (`:19`), so the red command and the gates run them.
- Gates: 9.5's patterns match existing names (`upfront AC-9 session-next`, `upfront merge`, `remote AC-10`, `remote AC-11`, `remote AC-5 status`, `remote AC-12 status`, `upfront AC-5 docs`, `upfront AC-5 skill: the grill rule`). The whole-suite run is task 9.6, as the caller says, as a background command of the tool, with the rule that a failure outside 9.1's tests is a defect of 9.2 or 9.3. `check.py`, `gen-catalog.py --check` and `openspec validate --strict` are green on the base (above).
- ADR edits (9.4 against D-18 item 1): ADR 0021's `Amends` entry and second Note, ADR 0020's `Amended by` line and Note, ADR 0010's Note qualifier (the quoted sentence matches the text at `docs/adr/0010-...md:65-67` apart from a line break), the config `ADRs:` line (currently ends "0014 and 0017", `config.yaml:31`), `rules.requirements` (already written, `config.yaml:40`) and the CHANGELOG bullet are all assigned, each with its text and a check. Complete, apart from F2. ADR 0021's existing flow-2 Note (`:92-97`) already holds the qualifier and needs no edit.
- Paths are real directories of the repo.

## 7. Omission detection
Validation, errors, idempotency (the push once per approval), observability (the board row, the title), rollback (revert two functions and the documents), compatibility (a run with no `changeSessions`, or an unclaimed ticket, keeps today's gate) and test strategy per layer are covered. One omission, below as O1. F1 is the only behavioral one.

## 8. Execution risks (top 5 failures)
1. F3: the board assertion of test 1 or 3 is written against the wrong ticket state and the green step of 9.3 cannot pass. Prevention: name the ticket per test.
2. F2: the `Amended by` line lands at line 11 and test 4 fails on its first-eight-lines check. Prevention: fix 9.4.
3. F1: an owner running a mixed run reads "2 of 1 places taken" and takes it for a defect. Prevention: say it in D-18, the ADR 0021 Note and the changelog bullet.
4. The whole suite of 9.6 finds a test outside the listed patterns that assumed the claims gate for a claimed change. Prevention: the rule in 9.6 (a defect of 9.2 or 9.3).
5. A second merge of `main` moves `remote-worker`'s tests while phase 9 is in review. Prevention: the existing re-merge rule (R-9) and the gate re-run.

## 9. Mandatory fixes before implementation
- [ ] F1 (Medium): `design.md` D-18 "Never looser than either rule?" and `spec.md` (`roadmap-coordination`, requirement "A place is held only by a change that loads the machine", or the new one): say the two populations are counted apart and what that does to "at most the run's number".
- [ ] F2 (Medium): `tasks.md:625-626` (9.4): put ADR 0020's `Amended by` line right after `- Status: accepted`.
- [ ] F3 (Medium): `design.md:1447-1455` and `spec.md:41-48`: name `b`'s ticket state per test and scenario.

## 10. Optional improvements (within scope)
- [ ] O1 Low: D-18 item 3 could add one sentence that a typed `/devkit change` of a change whose ticket a dead session claimed reads `next`, which neither gate covers after the fix. Before the fix it was already ungated once the plan push had landed, so this is no regression.
- [ ] Low: `docs/openspec-flow.md:335` and `docs/coordination-design.md:103` describe the places of a run; with the machines setting set they say nothing of the rule of D-18. The ADR Note and the changelog bullet carry it; a clause in the flow document would help the owner who reads only that file.

## 11. Explicitly out of scope
- [ ] The owner's approval of the revised plan (stale `approval.md`): the plan's own gate.
- [ ] Merging the two counts into one inside `change-loop.mjs` (D-18 "Rejected": a second copy of `placeDecision`).
- [ ] Any release number.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: three verified findings, each mapped to an item, a task and a spec scenario (the table at `design.md:1276-1280`).
2. Is the result measurable? Yes: four named tests with a red record, T-27, the focused gate and the whole suite; but F3 leaves two of them under-specified.
3. Are error behaviors defined? Yes: the claimed change held with `place`, the unclaimed one ends `no-place` and is woken; a run without a session per change keeps its gate.
4. Are edge cases covered? Mostly: plan not pushed yet, pushed, delivery before archive, archived, unclaimed ticket. Not covered: the mixed population (F1).
5. Are dependencies clear? Yes: 9.1 to 9.6 in order, the owner's approval before 9.1.
6. Are contracts defined? Yes: `placeFacts` returns `null` under the stated condition, `boardOf`'s `taken` is defined as the union of ids, once each.
7. Can two developers interpret this differently? Yes on F2 (where the header line goes) and F3 (the fixture).
8. Are any decisions implicit instead of written? One: F1, what happens to the cap when the populations mix.
9. Do the tasks fully deliver the intended outcome? Yes, once F2 is fixed.
10. What will be discovered too late? A board row above the number in a mixed run (F1), or a red 9.3 caused by a fixture (F3).

## 13. Final conclusion
- Can we start? No, not yet: three edits to design.md, tasks.md and the spec delta, then the owner's approval of the revised plan.
- What must be fixed? F1, F2, F3 (all Medium, all one to three lines each). Nothing in the code analysis needs to change: the single-gate fix is sound and no change waits forever on the path D-18 closes.
- Main risk if ignored? Tests written against the wrong fixture, an ADR header the test refuses, and an owner who is asked to approve a place rule without being told that a mixed run can exceed the number.
