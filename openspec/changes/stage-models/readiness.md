<!-- devkit-stage readiness result=passed attempt=4 commit=19c0196ddbe3084153ae8b3f169b9203fc586058 -->
# Readiness review: stage-models

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

Round 4. The plan was revised after the phase 2 stop: `next` now reads the stage hand-offs only when it is
called with `--after` (design D-5, D-11, D-12, the risks table and the alternatives table; tasks 2.2 and
2.3; the `stage-models` spec delta, requirement "Only a next-action call after a hand-off reads the
hand-offs"). This round re-reads that delta end to end and re-derives it against the code as built so far
in `plugins/openspec/hooks/` (HEAD `19c0196`, working tree modified: phase 1 done, task 2.1, 2.4 and 2.5
done, the readers of 2.2 and the `nextAction`/`decide` half of 2.3 already in the tree). No mandatory
finding is open. `openspec validate stage-models --strict` passes and `python3 scripts/check.py` passes.
No decision is left open.

## 2. Scope validation
Classification: correct

The revision narrows when the loop reads a transcript; it adds no surface. The change from "every `next`"
to "`next` with `--after`" is one argument of `runNext` plus the roadmap's own, unchanged, one-read rule.
Proposal scope, non-goals and the ADR 0019 decisions are not touched by it.

## 3. Proposal review
No finding. `proposal.md` says only "the retry is read from the session's transcripts" (lines 29, 41) and
AC-10 and AC-11 (lines 98-99), none of which names the call that reads; they stay true. The three AC
resolutions are still put to the owner at approval.

## 4. Design review
The claims of the revision, re-derived against the code:

| Claim | Where checked | Result |
|---|---|---|
| `runNext` is where the retry is switched on; today it passes `retry: true` and the plan changes it to `retry: opts.after !== undefined` | `change-loop.mjs:2046-2051` | holds; the tree still says `retry: true`, which is exactly what 2.3's red test is written against |
| `opts.after` is `undefined` when the flag is absent and a string when present | `parseArgs`, `change-loop.mjs:2023-2035` (`opts[a.slice(2)] = v` only when the flag is read; a flag with no value throws) | holds; an empty-string value counts as given, which is harmless |
| `nextAction` has the `retry` and `handOffs` options and the `handOffsFact` | `change-loop.mjs:1191, 1210-1217` | holds; already built, with the lock, `wait`, `state` and roadmap-status callers passing neither (`:1561, :1917, :2152`, `roadmap-loop.mjs:793, :836`) |
| `decide`'s inner `agent` calls `retried` before `guard`, with the failure count, `oneUp`, the `[1m]` suffix and `blocked('role-failed', ...)` | `change-loop.mjs:1000-1023` | holds, as D-5 writes it |
| `handOffKey`, `subagentRun`, `handOffsOf`, `typedSince`, `familyOfId` exist as D-4 lists them; `usage` events carry `model` | `guard.mjs:710-787`, `:681-685` | holds |
| The kept test "change-budget AC-4 with no budget next prints the same output with and without a session transcript, and reads none (kept)" calls `next` with no `--after` and no budget, and asserts zero reads | `change-loop.test.mjs:4340-4350` | holds; I ran it on the tree: it fails today with `1 !== 0` because `runNext` passes `retry: true`. It is the one failure, and it is the one task 2.3 fixes. |
| Every retry and failure test of a lone change calls `next` with `--after` (or, for the "new typed command" and "no transcript" ones, expects no retry) | `stage-models.test.mjs:656-806` | holds; I ran `stage-models AC-1[01]` and `change-budget AC-4`: nothing else fails, so `--after` only wiring cannot break a built retry test |
| The skill passes `--after` after every `agent` and `session` action, a failure included, in a change's own session and in the roadmap | `SKILL.md:83, :87, :168` (diff of 2.5 read) | holds; D-5's "every failure already comes back with `--after`" is true of the skill as written |
| The roadmap's reading does not depend on `--after`: only `runCmd` and `nextCmd` pass `retry: true`; with one session it reads once and passes `handOffs` | `roadmap-loop.mjs:451-453, 476-483, 491, 739, 766` | holds; the lock and `statusCmd` pass nothing |
| `--after` is the only trigger | `nextAction` callers listed above | holds |

Not verifiable here, as in round 3: A-1 and A-2 (the host's start and switch tools) are recorded as facts
of 2026-11-23; A-3 (the Agent `model` parameter) is probed by task 1.1, which is ticked (its proof files
are in `proof/`).

## 5. Specs review
- The new requirement "Only a next-action call after a hand-off reads the hand-offs" uses SHALL and has
  two scenarios: "A call with no progress key reads no hand-off" and "A lock reads no hand-off". Each
  outcome row of D-5's read rule has one: no `--after` reads none, with `--after` reads (the retry
  scenarios of the same spec all pass the key), a roadmap in one session reads once, a lock and the board
  read none.
- The requirement "A failed stage subagent is retried" and its three scenarios still say "called again
  with that action's progress key", which matches the revised trigger.
- Low: the requirement says the call "with the progress key of the action before it", while D-5 and the
  skill also pass `--after` after a `session` action, so such a call reads the hand-offs too. Harmless (the
  hand-offs are keyed by brief), and the requirement's own sentence "the call the session makes after every
  stage agent" stays true. No change needed.

## 6. Tasks review
- 2.3 is test first, names its red test, the three options, the header-comment sentence and a gate that
  runs the kept change-budget and lock tests. 2.2's check still names the kept test as passing "unchanged";
  see section 10 for the resume point, since the tree already holds 2.3's `nextAction` and `decide` half.
- Gates run on the base here: `openspec validate stage-models --strict` and `python3 scripts/check.py`
  green. I ran the part of 2.3's gate that already exists: `--test-name-pattern="^stage-models AC-1[01] "`
  with `^change-budget AC-4` over `stage-models.test.mjs` and `change-loop.test.mjs`: one failure, the kept
  test, as described. The whole suite (13 to 21 minutes) was not run; task 4.6 runs it once.
- The AC table still maps AC-1 to AC-13; AC-10 lists 2.2 and 2.3 for the reader and the trigger.

## 7. Omission detection
- Validation, error handling, retries, compatibility, idempotency, observability and rollback are defined,
  as in round 3. The revision adds a defined behavior for the one case it opens: a call with no `--after`
  after a failure hands the stage on its table model, the failure stays in the window, and the next call
  with `--after` counts both runs, so the run still ends blocked after two failures in a row (D-5 and the
  risks table). That case has a test row in D-12 (task 2.3).
- A start at a Haiku stage under the default table (a session resumed at `unit-tests` or `delivery`) is
  still the open note of round 3 (section 10).

## 8. Execution risks (top 5 failures)
1. Cause: a driver that drops `--after` after a failed agent. Impact: the failed stage is handed again on
   its table model instead of one model up, once. Prevention: D-5 accepts it and the next call with
   `--after` still ends the run blocked after two failures in a row.
2. Cause: the Agent tool ignores `model` (A-3). Prevention: task 1.1 probed it first.
3. Cause: the host ignores a start `model` above the coordinating session's family (A-1). Prevention:
   recorded, with the Troubleshooting row.
4. Cause: `-p` cannot carry the roadmap proof run (D-13). Prevention: the fallback and the accepted extra
   attempt.
5. Cause: a sibling change edits the release numbers or the ADR number. Prevention: tasks 4.1 and 4.5 read
   `origin/main` at the last merge before review (no `0019` file on `origin/main` today).

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Medium, fix during implementation: the resume point of phase 2. The tree already holds the readers of
  task 2.2 and the `nextAction`, `handOffs` and `retried` half of task 2.3, with `runNext` still passing
  `retry: true`. Task 2.2's check ("`change-budget AC-4 ... (kept)` passes unchanged") therefore cannot pass
  until 2.3's one-argument edit of `runNext` is made. Do 2.3's red test first, then the `runNext` edit and
  the header-comment sentence, and run 2.2's and 2.3's checks together; do not weaken the kept test.
- [ ] Low, fix during implementation: the title of `stage-models.test.mjs:780` says "nextAction reads the
  subagent folder only when asked to retry, and next asks". After the revision `next` asks only with
  `--after`; rename the test (it tests `nextAction`'s options, not `next`) so the 2.3 test is the one that
  speaks of `next`.
- [ ] Low, carried from round 3: `design.md:527` says the ADR 0014 Note is written "in the form ADR 0018's
  Notes use", but ADR 0018 has no Note; the form is ADR 0014's own existing Note
  (`Note (change-state, 2026-11-22):`).
- [ ] Low, carried: a session started at a Haiku stage (a change resumed at `unit-tests` or `delivery` with
  no session of its own) starts on Haiku and performs its review and retro there, which the floor forbids
  for switches. ADR 0019 Consequences accept it; no scenario shows it. Either add the scenario and the D-10
  Troubleshooting words, or have `sessionStartOf` send the floor. The plan builds the first as written.
- [ ] Low, carried: the D-12 group "Skill and docs" is not assigned to a red-half task (write the skill
  tests in the red half of 1.2 and 3.1, the docs tests in 4.2); `design.md:377-378` says a declined host
  question gives `session-model-refused` while a decline may end the turn with no call result (treat any
  non-success as a refusal); `tasks.md:61` counts a compact-JSON string (use a JSON-aware count if the host
  prints spaces).
- [ ] Note for the flow: `approval.md` holds `Readiness: sha256:e1f3db14a94b`, the hash of the round 3
  file. This file replaces it, so the approval's hash no longer matches; the flow re-asks the owner, who
  already chose the `--after` rule on 2026-11-23.

## 11. Explicitly out of scope
- [ ] The coordinating session's own model, switching a lone change's session, a status bar, a model above
  Opus, writing the spend to a file (`requirements.md` "Out of scope").
- [ ] `project-loop.mjs` hand-offs, the review round's reviewers, the CompozyOS driver, the agents'
  frontmatter.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes (`proposal.md` Why; ADR 0019 Context).
2. Is the result measurable? Yes. AC-1 to AC-12 have tests named in D-12; AC-13 reads transcript model
   fields.
3. Are error behaviors defined? Yes: `setting-unknown`, `LoopRefusal`, `role-failed`, fail-open readers, a
   refused switch, a lenient read outside a change's own loop, each with a scenario.
4. Are edge cases covered? Yes: a call with no `--after` after a failure, a `/devkit status` mid-run,
   success resetting the count, no transcript, other changes' subagents between, a found session, a floor
   above the stage. One accepted edge has no scenario (the Haiku start).
5. Are dependencies clear? Yes: `change-budget`, ADRs, the host tools with the probe for A-3.
6. Are contracts defined? Yes: the `model` field, the `retry` mark, `nextAction`'s `retry` and `handOffs`
   options, `runNext`'s argument, the start `input`, the `session-model` action, the `--after` keys, the
   spend messages.
7. Can two developers interpret this differently? Not on a point that changes behavior: the read rule is
   one argument (`opts.after !== undefined`), the failure count four numbered steps.
8. Are any decisions implicit instead of written? No. The `--after` rule is written in D-5, D-11, D-12, the
   risks, the alternatives, the tasks and the spec.
9. Do the tasks fully deliver the intended outcome? Yes; the AC table maps all 13 criteria.
10. What will be discovered too late if implementation starts now? Little. The live half of AC-6 and AC-7
    is a declared dogfood step; A-1 is recorded with a fallback.

## 13. Final conclusion
- Can we start? Yes, from task 2.3 (2.2's readers and 2.3's `nextAction` half are in the tree).
- What must be fixed? Nothing before implementation. The Medium note in section 10 is the order of the
  resume.
- Main risk if ignored? Treating the red kept change-budget test as a test to change instead of the code to
  fix: D-5 and D-11 say the code changes, not the test.
