<!-- devkit-stage readiness result=passed attempt=3 commit=6fce9721974668c73a1403e5d3121aa24349d8a2 -->
# Readiness review: stage-ceiling-consecutive

Re-review (attempt 3) at `6fce972` (devkit-openspec 0.33.0), after the author's revision of round 2's one Mandatory finding (F-3). Run here: `openspec validate stage-ceiling-consecutive --strict` (valid). Not run, as the caller asked: any test suite, `scripts/check.py` and `gen-catalog.py` (the revision touches only `design.md` and `tasks.md` under the change folder; `proposal.md`, `requirements.md` and both spec deltas are unchanged since round 2, by their file times), so the filtered gates of tasks 1.7, 2.4 and 3.6 are not checked against the base here (their new tests do not exist yet either).

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 2's Mandatory finding is fixed: P-1 no longer claims a brief from `change-loop.mjs next` on a failed evidence, and the new real run P-13 reaches the plan brief through a path I re-derived in the code. No open Mandatory finding remains; two Low notes are listed in section 10.

## 2. Scope validation
Classification: correct. The revision adds one real-run case and its explanation; no scope change.

## 3. Proposal review
Unchanged since round 2 and still sound: the claims about the `review` stage's restarting round, the nine ACs with stable ids (each in a task row, `tasks.md:27-35`), both capabilities existing with full deltas, the proposal under two pages.

## 4. Design review
Claims about the live code, re-derived at `6fce972`:

| Claim | Result |
|---|---|
| D-8: a failed evidence leaves the change `inDelivery` (`change-loop.mjs:867-874`; `BUILD_PARTS` at `:854`), so `buildPart` (`:1176`) runs `testStageStep` first (`:1178`), which takes only `TEST_STAGES` (`:856`) as the failed stage (the `fix-tests` branch, `:1157-1160`); every other failure is the delivery row's (`:1180-1196`), whose brief is `step <step> <detail JSON>` | holds; P-1 now runs `flow-check` only, as D-8 says |
| D-8: a failed `readiness` goes to `onFail: proposal` (`plugins/openspec/schemas/devkit/flow.json`, readiness: `ceiling 3`, `onFail proposal`); `proposal` is `part: plan` with role `change-planner`, so `inDelivery` is false, `planPart` runs and `n.reasonCode === 'fix-after-failure'` (`change-loop.mjs:1117-1121`) gives `agent('proposal', 'change-planner', ...)` with the brief at `:1121` | holds |
| P-13 walk: `mockup` has `notAfter: proposal` and `appliesWhen ui`, `decisions` has `notAfter: proposal`, so both are not-applicable once `proposal.md` exists; `readiness` is the current failed stage; `readiness` is not `codeBound`, and its `stale-plan` test is by file times against `staleAfter` (`flow-check.mjs:452-458`), so a `readiness.md` written last is not `fixed`; the order of the checks in `computeFlow` (`:575-581`) gives `fix-after-failure` for `proposal` with `failures` 1 over `[passed 1, passed 2, failed 3]` | holds |
| P-13 `next` runs with no GitHub lookup: `collectState` and `defaultBase` are called only `if (inDelivery(...))` (`change-loop.mjs:1298-1308`); the existing `change-loop next: a readiness failed at its ceiling exits 2` test (`change-loop.test.mjs:741`) already runs `next` on a `planChange` repository of the same shape; an `agent` action exits 0 (`loopOutput` at `:2406`, `code: 0` at `:2533`) | holds |
| The brief is wrapped by `brief(stage, what, detail)` (`change-loop.mjs:1035-1041`): `Change <id> (<script> script), stage <stage>: <what>. Work only in ...` | the D-6 sentence is a substring of the printed brief, not the whole string (Low note, section 10) |
| D-8 `fix-tests` without a real run: a failed `unit-tests` has next `implementation`, so `next` calls `collectState` with a real `gh` first (`:1298-1308`); the brief is built from the stage checker's params alone (`:1176-1178`, `:1157-1160`) | holds; the unit test `stage-ceiling-consecutive AC-6 loop: the fix briefs name the failures in a row` is its proof, and the reason is written |
| Round 2's other claims (the `review` round restart, `collectFlow` throwing outside a git repository, `artifactState` and `computeFlow` ordering, D-3 pseudocode against D-4 and D-9 cases, `blocked-why.ceiling` lines, `render`, `project-loop.mjs#blockedEnd`) | unchanged files; `flow-check.mjs` and `change-loop.mjs` are as round 2 read them (`HEAD` is the same commit) |
| Every test name in D-9's "existing tests" table and in the tasks | re-grepped: each exists in the file the table names (`flow-check.test.mjs`, `version-pin.test.mjs`, `change-loop.test.mjs`, `project-loop.test.mjs`, `roadmap-loop.test.mjs`) |

Parsers: D-2 decides unterminated input, a missing blob, no commit and a non-zero exit. No gap.

Config rules (`openspec/config.yaml`): test history is a fixture repository (holds); every existing test that asserts a changed text is a row of the D-9 table (holds); release numbers are "the next free one on `origin/main` at the last merge before review" (task 3.1, D-10; holds); each gate task names its test command (holds).

## 5. Specs review
Unchanged since round 2. Normative language and `#### Scenario:` blocks are present; every decision-table row of D-4 that the checker can reach has a scenario (H-1 and H-3 to H-6, F-3, F-4, the readout row; H-2 is the existing scenario; F-1 and F-2 are reader-only unit cases by design). The `project-definition` delta restates the requirement. No requirement lives only in a support doc. The two briefs have no spec scenario; the spec says the reason names the count, and AC-6 names the readout and the reply (not a finding, as in round 2).

## 6. Tasks review
- One `## N.` group per phase, each ending in a gate (1.7, 2.4, 3.6); every AC id is in a task (`tasks.md:27-35`); tests first with the red output saved (1.1, 2.1).
- Task 3.4 now names P-13 in its environment sentence, its run list, its expected column (the brief `readiness failed at attempt 3 (failures in a row: 1 of 3): revise the plan from its findings`) and the AC-6 row. The `fix-tests` brief is declared to have no real run, with the reason. The check of 3.4 can now pass for every run it lists.
- The files that assert an old text are named in the task that changes it (1.4, 1.5, 2.2, 2.3, 3.1). Paths exist. Gate commands are single commands; the long gate (3.6) is marked for a background run.

## 7. Omission detection
Validation, error handling and side effects: D-2, D-4. Retries, permissions, rollback: none apply (read-only checker; rollback is a revert). Legacy records: the `{failures}` fallback in `render` is written and pinned. The restarting `review` round: D-3, H-6, the scenario, the test, P-9. The brief's real run: P-13. No omission found.

## 8. Execution risks (top 5 failures)
1. A passed take that was never committed. Cause: stage files overwritten between commits. Impact: the count falls back to the real streak minus the unseen takes (H-5). Prevention: documented (D-7 sentence, Risks, the `ship-change` rows that commit the change folder).
2. Two failed takes with the same `attempt` and `commit` merge into one under the de-duplication key. Impact: low, as the no-progress rule stops a stage that comes back unchanged. Hypothesis only.
3. P-13 readiness mtime ordering. Cause: the scratch plan files and `readiness.md` written inside one second. Impact: `stale-plan` needs a gap over `FRESH_MS`, so a `readiness.md` written after the plan files is never `fixed`; only a wrong write order would show `rerun-after-fix`. Prevention: D-8 says the takes are written in order.
4. Shallow clones: P-6 and P-10 depend on `git log` listing the boundary commit of a shallow clone as the commit that adds the file. I read the code, not a git run here; F-3 and H-3 and the real runs show a difference at once. Low.
5. `change-loop.mjs next` in a scratch repository (P-2, P-13) could stop at a gate the unit fixtures stub. Prevention: task 3.4 names the CLI tests' environment, and `planChange` already runs `next` on branch `main` with no remote (`change-loop.test.mjs:741`). Hypothesis, not run here.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Low — `design.md:289` (P-13, "whose brief is ...") and `tasks.md:117-118`: the printed brief is `Change feat (devkit script), stage proposal: readiness failed at attempt 3 (failures in a row: 1 of 3): revise the plan from its findings. Work only in ...` (`change-loop.mjs:1035-1041`). Read "whose brief is" as "whose brief contains"; the implementer sees the output at once. Fix during implementation: save the whole printed brief in `real-run.txt`.
- [ ] Low — `design.md:289`: the `flow-check` expected cell for P-13 could name `failed: readiness` in the params, as P-1's `fix-after-failure` does for the evidence, so the section shows which stage failed.

## 11. Explicitly out of scope
- [ ] Making `deliver-check.mjs` tolerate a non-git root (a CI-downloaded file the plan leaves untouched).
- [ ] Merge detection and `post-merge-validate` (stated non-goals).
- [ ] Aligning the `review` round numbering with "one more on each rewrite" (a header-writing change; AC-5 forbids it).
- [ ] The sentence in `docs/openspec-flow.md:109` that `attempt` is "one more on each rewrite" (false for the `review` stage; D-7 only rewords the ceiling sentence there; AC-5 keeps the header's values as they are).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: the checker blocks at the first failure after passed takes; the remote-worker case is cited.
2. Is the result measurable? Yes: AC-1 to AC-9 are observable, each with a test or a real run; the one brief with no real run says why.
3. Are error behaviors defined? Yes: history read failures return `[]` (D-2); outside a repository the checker exits 3 as today, which the plan says.
4. Are edge cases covered? Yes: shallow clones, uncommitted takes, made-up `commit=`, merges, the restarting review round.
5. Are dependencies clear? Yes: ADR 0010 decision 3, ADR 0017 decision 1; `remote-worker` is archived; no dependency on `post-merge-validate`.
6. Are contracts defined? Yes: the three reason codes gain `failures`; the `render` fallback for records without it is written.
7. Can two developers interpret this differently? Not on behavior; only on whether "brief is" means the whole string (Low).
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes: AC-1 to AC-9 each map to tasks and a test or a real run.
10. What will be discovered too late if implementation starts now? Nothing I could find; the unrun parts are the gates (the machine is overloaded) and the shallow-clone behavior of `git log`, both shown at once by the first real runs.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation; the two Low notes of section 10 can be applied while building.
- Main risk if ignored? Low: a proof section that saves only the D-6 sentence and not the whole brief.
