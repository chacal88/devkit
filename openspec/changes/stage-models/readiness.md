<!-- devkit-stage readiness result=passed attempt=6 commit=e05787469f3a59a3de0a574a325a230566707b5e -->
# Readiness review: stage-models

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 6. The plan was revised after the round-5 NEEDS-REVISION: `design.md` D-13 gained a Run 3 (a test-runner
stub that obeys the `subagent-stop` hook); phase 5 in `tasks.md` is renumbered (5.4 the run, 5.5 the gate); the
proposal's consent list and D-10's ADR 0020 Note text changed; the Lows were fixed. Phases 1 to 4 are built and
committed (HEAD `e057874`); phase 5 (tasks 5.1 to 5.5) is the work left, and it changes no product code. I read
the revision end to end and re-derived its claims against the code as built. Both round-5 mandatory fixes are
closed (section 9). No open Mandatory finding remains.

Checks run here, on the base with `TMPDIR=/var/tmp/devkit-stage-models` and `GITHUB_HEAD_REF`/`GITHUB_BASE_REF`
set: `openspec validate stage-models --strict` passes; `python3 scripts/check.py` passes;
`python3 scripts/gen-catalog.py --check` passes; `^stage-models AC-(4|10) ` (35 tests) passes. The whole guard
suite (13 to 21 minutes) is marked long and was not run by me; phases 1 to 4 passed it at their gates (task 4.6),
and phase 5 changes no product code, so a red guard suite on the base is not expected (task 5.5 runs it).

## 2. Scope validation
Classification: correct

Phase 5 pins built behaviour with one test, states it in two tests and three documents, and shows it in one real
run. It adds no product code. The one scope edge, that it narrows an owner-grilled criterion (AC-10) and reads
two decisions of ADR 0020, is now disclosed to the owner for acceptance (section 3), so it is a consent item, not
inflation.

## 3. Proposal review
- `proposal.md` "Acceptance criteria" now says AC-1 to AC-9 and AC-11 to AC-13 are the owner's text as written
  and AC-10 is not. I diffed each line against `requirements.md`: AC-1 to AC-9, AC-11 to AC-13 are identical;
  AC-10 differs exactly as the proposal says (the added "that wrote no stage file" and the `result=failed`
  clause). The claim holds.
- The resolved-by-design list now reads "Four criteria and two readings of ADR 0020", and names AC-10 (narrowed,
  with the consequence that a red Haiku unit-test run goes to the implementer's fix and not to a Sonnet rerun),
  ADR 0020 decision 5 and decision 2 (`[1m]` reach). The owner accepts each at plan approval. Round-5 fix 2 closed.
- "What Changes" states the narrowed retry; Impact now lists `docs/adr/0020-the-model-is-chosen-by-stage.md` and
  its renumbering at the delivery merge. Non-goals unchanged and still true.

## 4. Design review
Claims of the revision, re-derived against the code:

| Claim | Where checked | Result |
|---|---|---|
| `retried` matches the newest runs by `handOffKey` of the action `decide` would hand now | `change-loop.mjs:1013-1023`; `guard.mjs:710-722` (`BRIEF_END`, `handOffKey`) | holds |
| A stage agent that wrote `result=failed` gets `fix-after-failure`; `decide` builds a different brief, so no retry | `flow-check.mjs:518` (`header-failed`), `:633-637`; `change-loop.mjs:1063-1066` (`planPart`), `:1101-1105` (`testStageStep`, `fix-tests` on `implementation`) | holds |
| Plan-stage case at `decisions` on `opus` gives a revision, no `retry`, exit 0; the same world with no file gives exit 2 (failure on Opus) | I ran a throwaway test (scratchpad, not in the repo) on `planChange({have:['requirements']})`: with `decisions.md` at `result=failed attempt=1` the action is `decisions` / `devkit-core:adr-author` / `opus`, brief holds "revise the plan from its findings", no `retry`; with no file, exit 2 | holds; the revised scenario (the `decisions` stage, not `design`) is the one a real run can reach |
| A stage at its ceiling ends blocked, no retry | `flow-check.mjs:634-635` (`ceiling-reached`); `decisions`/`unit-tests` ceiling 3 in both `flow.json` | holds; the new scenario "A test stage recorded as failed at its ceiling" states it (round-5 Low closed) |
| `rerun-after-fix` is a different brief, so no retry | `flow-check.mjs:636`; `change-loop.mjs:1096-1098` ("run it again") | holds; D-5 now says it and points to existing tests |
| `subagent-stop` asks for a missing stage file once, lets the second stop through | `change-loop.mjs:1896-1904` (`refuseOnce`), `:1945-1964` (U2 `no-file`) | holds |
| `unit-tests` has `onFail: implementation`, `codeBound`, `appliesWhen tests.unit`; `e2e-tests` the same with `tests.e2e` | `plugins/openspec/schemas/devkit*/flow.json` | holds; Run 3's scratch config (`tests.unit` only) makes `e2e-tests` not apply |
| Runs 1 and 2 used the "stop again at once" stubs; the first attempts showed the obeying path | `proof/run-notes.txt` deviations 2 and 3; `proof/lone-models.txt` | holds; D-13 now says it (round-5 Low closed) |
| The Agent call's `model` overrides the frontmatter | `proof/probe-agent-model.txt` (Agent input `model=haiku`, subagent `message.model=claude-haiku-5-5`) | holds |
| Replaced sentences exist as D-10 quotes them | `docs/openspec-flow.md:240` (one line); `CHANGELOG.md:5-11` (wrapped; D-10's one-line anchor rule covers it); ADR 0020 decision 7 at line 65, `## Consequences` at 67 | holds |

**Run 3 (D-13), the new real-run proof.** The path is what the code does: a Haiku `unit-tests` agent stops once,
the hook refuses (U2 `no-file`), the stub writes `unit-tests.md` at `result=failed attempt=1 commit=HEAD`, and
`flow-check` offers `implementation` with `fix-after-failure`, which `testStageStep` turns into `fix-tests` on the
implementation's table model (`sonnet`) with no `retry` field. The staleness trap that hit run 1 (an untracked
marker read as uncommitted code, so `fixed` and `rerun-after-fix`) does not arise: Run 3's stubs write no marker,
and the stage file in the change folder is the same kind of file run 1's `result=passed` file was. The "ends as
the loop decides" tail is correctly left out of the check. The repeat rule and the stop-and-report rule bound the
one place the run could surprise (a Haiku agent that writes the file before its first stop).

**ADR 0020 Note (D-10).** The text now carries the clause round 5 asked for ("So the Consequences' mitigation
'one retry a model up' reaches only an agent that cannot finish; a stage agent that obeys the hook and records
`result=failed` takes the fix path, bounded by the stage's ceiling"), and both readings. It needs no superseding
ADR: no decision's text changes, the ADR is unmerged and ships in this pull request, and ADR 0014 sets the
precedent of a Note. `design.md:563` now says "the Notes of ADR 0014" (round-5 Low closed). The consent trail is
in `design.md` "Decisions and ADRs" and `proposal.md`.

## 5. Specs review
- `stage-models` delta: "Only a stage subagent that could not finish is retried" uses SHALL and has three
  scenarios (a test stage, a plan stage at `decisions`, a test stage at its ceiling); "The 1M variant is an
  explicit opt-in" gains the subagent scenario; the two existing retry scenarios now say "without writing
  `unit-tests.md`". `change-coordination` "A failed stage agent" says "without writing its stage file".
  `openspec validate --strict` passes. Every outcome row of D-5's decision (retry, second failure, Opus, written
  failed file, plan stage, ceiling, `rerun-after-fix` by existing tests) has a scenario or a named existing test.
- Nothing in the specs lives only in a support doc.

## 6. Tasks review
- 5.1 to 5.5 are ordered and map to the checks. 5.1 is a pin (passes with no code change; the stop-and-report rule
  is right, and I confirmed the plan-stage half above). 5.2 is red first and names its helpers and its
  expected failures. 5.3 states exact greps; I checked the anchors against the current files (the only `without
  writing its stage file` of `CHANGELOG.md` is the retry sentence, `on Haiku or Sonnet is handed again` is on
  one line of `docs/openspec-flow.md:240` and goes). 5.4 states the scratch paths, the permission mode, the
  files saved, the lines the check holds, the fallback when a nested `claude -p` is refused, and the repeat rule.
  5.5 is the gate, with `TMPDIR` set, the guard suite marked long, and the new `grep -q` checks on
  `fix-models.txt` and `fix-unit-tests.txt`.
- The AC table maps AC-4, AC-10 and AC-13 to the new tasks, with 5.5 for the gate. The renumbering is consistent:
  every `5.4` in `design.md` means the run, every `5.5` the gate.
- No task path is outside a real directory; scratch projects live under `/var/tmp/devkit-stage-models/proof/` and
  nothing of them is left in the repository (task 5.4 says so).
- Tasks 4.1 and 4.5 stay ticked and are redone at the delivery merge (D-10 and the phase-5 preface): `origin/main`
  (local ref `b92e6b1`, not fetched) holds another ADR 0020 and 0.32.0. This is now planned, with the `0020` tests
  following in the same commit and an estimate row; round-5 section 10 item closed.

## 7. Omission detection
- Validation, error handling, retries, idempotency, compatibility, observability and rollback: defined as in
  round 5. The case phase 5 opens (a failed agent that wrote its file) has a requirement, three scenarios, D-5
  prose, a risk row, a pinning test, a document test and a real run.
- Test strategy and evidence: the fixture half (5.1, 5.2) and the real half (5.4) now both cover the
  `result=failed` case; CLAUDE.md's "every case the plan declares" is met.
- Release and ADR numbering at the merge: planned (D-10, risk row, estimate row).

## 8. Execution risks (top 5 failures)
1. Cause: the delivery merge brings in `origin/main`'s ADR 0020 and 0.32.0. Impact: `stage-models AC-1`'s
   "no other file takes 0020" and the `0020` tests name the wrong ADR; a re-merge, evidence and review round costs
   1-2 h. Prevention: tasks 4.1 and 4.5 redone with the renumber at the merge (D-10); ask the coordinator to hold
   `main` at the release step.
2. Cause: Run 3's Haiku test runner writes the file before its first stop, so the hook's ask is not shown.
   Impact: a wasted run. Prevention: the repeat-once rule and the stop on a second occurrence (task 5.4).
3. Cause: the wrapped `CHANGELOG.md` splits an anchor across lines. Impact: 5.3's `grep -c` prints 0.
   Prevention: D-10's one-line anchor rule; run the greps.
4. Cause: a nested `claude -p` is refused inside the implementer. Impact: task 5.4 cannot run. Prevention: the
   `Outcome: failure` naming the task and the conducting session's Bash run, both written in D-13.
5. Cause: a Haiku unit-test run that misreads the suite goes to the implementer's fix, not to a Sonnet rerun.
   Impact: a wasted fix attempt against the ceiling. Prevention: accepted in the risk table and in the owner's
   consent list; `unit-tests: sonnet` is the project lever.

## 9. Mandatory fixes before implementation
None. The two round-5 fixes are closed:
- [x] High, Run 3: D-13 "Run 3", tasks 5.4 and 5.5, the AC-10 and AC-13 rows of the AC table.
- [x] Medium, consent trail: `proposal.md` (AC-10 flagged as narrowed, listed with the two ADR readings),
  `design.md` D-10 (the Note's clause on the narrowed mitigation), "Decisions and ADRs".

## 10. Optional improvements (within scope)
- [ ] Low, fix during implementation: `design.md` A-3 (about line 1014) still says "Not yet checked; task 1.1
  probes it before any code". Task 1.1 is done and `proof/probe-agent-model.txt` shows `model=haiku` on the Agent
  input and `claude-haiku-5-5` on the subagent. Say "checked in task 1.1".
- [ ] Low, carried: a session started at a Haiku stage (a change resumed at `unit-tests` or `delivery`) has no
  scenario or Troubleshooting words; the D-12 "Skill and docs" group is not assigned to a red-half task; a declined
  host question may end the turn with no call result; `tasks.md:61` counts a compact-JSON string.
- [ ] Note for the flow: `approval.md` holds `Readiness: sha256:e1f3db14a94b`, the hash of the round 3 file. This
  file replaces it; the flow re-asks the owner, who now also accepts the narrowed AC-10 and the two ADR 0020
  readings listed in `proposal.md`.

## 11. Explicitly out of scope
- [ ] The coordinating session's own model, switching a lone change's session, a status bar, a model above Opus,
  writing the spend to a file (`requirements.md` "Out of scope").
- [ ] `project-loop.mjs` hand-offs, the review round's reviewers, the CompozyOS driver, the agents' frontmatter.
- [ ] Changing `retried` to also retry a `result=failed` agent: the review chose to keep the code (D-5), and the
  test-runner contract makes a red run a stage result.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes (`proposal.md` Why; ADR 0020 Context).
2. Is the result measurable? Yes: AC-1 to AC-12 by named tests; AC-13 by runs 1 and 2 (the retry of an agent that
   cannot finish) and run 3 (the fix path), with the gate's greps.
3. Are error behaviors defined? Yes, including a failed agent that wrote its file, a stage at its ceiling, a
   failure on Opus and a second failure.
4. Are edge cases covered? Yes, with the carried Lows of section 10.
5. Are dependencies clear? Yes; the ADR number and release collision with `origin/main` is planned for.
6. Are contracts defined? Yes: the retry's reach, the `fix-tests` and revision briefs, the Note's and the
   documents' sentences with their anchors, the line forms of `fix-models.txt`.
7. Can two developers interpret this differently? Not on code or on the documents' text (D-10 gives the sentences).
8. Are any decisions implicit instead of written? No. The narrowed AC-10 and the two ADR readings are written and
   put to the owner for acceptance.
9. Do the tasks fully deliver the intended outcome? Yes: the pin, the document tests, the three documents, the
   real run of the case real agents take, and the gate.
10. What will be discovered too late if implementation starts now? The ADR and release renumbering at the delivery
    merge (planned), and a Haiku test runner that does not wait for the hook (bounded by the repeat rule).

## 13. Final conclusion
- Can we start? Yes. Phase 5 can be implemented without a question that changes behaviour or scope.
- What must be fixed? Nothing before implementation. The Lows of section 10 can be fixed during it.
- Main risk if ignored? The merge-time renumbering of ADR 0020 and the release number; it is in the plan and costs
  a re-merge round if `main` moves again.
