<!-- devkit-stage readiness result=passed attempt=3 commit=bec9bf03e8ba0b5dc02c6ad2e719f9b7757f6e7c -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD bec9bf0 (the plan files are uncommitted in the worktree). The whole plan was judged afresh from
the files, not from the attempt 1 or attempt 2 reports. Artifacts read: `proposal.md`, `design.md` (all 916 lines),
`tasks.md`, `decisions.md`, `requirements.md`, the seven spec deltas, ADR 0022, the main specs the deltas touch,
`openspec/config.yaml`, `openspec/roadmap.md`, and the code each claim names.

Checks run: `openspec validate coordinator-loop-fixes --strict` passes; `python3 scripts/check.py` passes;
`python3 scripts/gen-catalog.py --check` exits 0; `command claude plugin validate .` passes. `parseTasks` and
`readPhases` read `tasks.md` as 36 tasks in 6 phases, each phase with one gate, no gate command holding a `|`.
Every gate command that exists on the base was run there, node part and `check.py`, with `GITHUB_HEAD_REF` and
`GITHUB_BASE_REF` set, `TMPDIR` under `/private/tmp`: gate 1.6 (220 tests, green), 2.5 (596 tests green, and
`review-round.test.mjs` 90 green), 3.7 (429 green), 4.7 (333 green), 5.5 (36 green); `check.py` green. Gate 6.6 is
the whole suite and was not run (the caller forbids it); its non-suite parts are the four commands above, all green.
The local `origin/main` is one docs-only commit ahead (605ed9b, `roadmap-panel-study`); no code the plan touches moved.

## 1. Decision
- Status: APPROVED
- Confidence: medium-high
- Ready to implement: yes

No open mandatory finding. The two blockers of attempt 2 (the review stage's ceiling, and the real runs the new
guard refuses) are closed (section 4). Two Medium and four Low findings remain, none mandatory (section 9 is empty; section
10 lists them, with the fix class of each). Confidence is not "high" because AC-7 rests on a new two-checker
mechanism (the stage walk's ceiling and the delivery checker's limit) that no test of the base exercises yet; the
plan's own tests T105 to T111 and real runs R7, R7s and R7b are what prove it.

## 2. Scope validation
Classification: correct

The scope is explicit (proposal "What Changes", non-goals, design Non-Goals, "Dropped" in `requirements.md`) and
follows ADR 0022's eight points. Every capability the plan touches has a delta (eight, matching the proposal's
list, none new). Each MODIFIED requirement carries every scenario of its main requirement, checked by name with a
script: `change-coordination` (21, 11 and 7 scenarios kept), `change-stages` (2 kept, 7 added), `delivery-models`
(1 kept, 3 added), `project-setup` (4 kept, 2 added). Items 1, 10 and 15 use `declare` for the two keys that
record, where `requirements.md` assumes `reply`; the assumption says "the planner picks the shape", ADR 0022
records the reason (a `reply` stays a pure printer), so this is a decision made and written, not a gap.

## 3. Proposal review
- Problem and goal are clear; the sixteen ACs are observable. AC-11 is split into a half proven here (T82, R13a,
  R13b) and a half carried to the roadmap line `host-monitor-wake` (task 6.5), and the AC says so itself.
- Non-goals are tight: "Dropped", `fresh-base-check`, `devkit-lite`'s stages, the slice ADR review, the panel, the
  roadmap coordinator's third round in session-per-change mode.
- Dependencies and the siblings that touch the same functions are named (design D-17).
- The proposal is about 1,800 words against the "under two pages" rule of `openspec/config.yaml`; archived proposals
  run 2,000 to 2,800 words, so it is a note (section 10).

## 4. Design review
Every claim about internals below was re-derived with Read and Grep at HEAD.

Closed since attempt 2:
- The review stage's ceiling. `flow.json` gives `review` `"ceiling": 2` in both scripts
  (`schemas/devkit/flow.json:49`, `devkit-lite/flow.json:34`); `artifactState` computes the ceiling at
  `flow-check.mjs:459` and `computeFlow` compares it at `:575-579` (`raw.attempt >= ceilingOf(s)`);
  `inDelivery` is false for a blocked end (`change-loop.mjs:869`), so the stage walk's `ceiling-reached` is the code
  review's deadlock in the loop, exactly as D-4's Context says. D-4 now lifts that ceiling with the same count the
  delivery checker uses (`authorizedRounds`, one function read by both), through one exported `ceilingOf(stage,
  flow, facts)` that replaces the local one at `:510` and the inline one at `:459`, and only for the `review` stage
  of role `review-bench` (the `devkit-project` flow's `review` has role `adr-reviewer`, checked in its `flow.json`).
  I walked the sequence against the code: unauthorized round 2 FAIL ends `blocked` `ceiling` on `review` and
  `decide` gives `blockedEnd` with `role` `review-bench` (`stageFields`, `change-loop.mjs:1025`), which is what
  `deadlockScope` reads; with one record the walk's `raw.fixed` is false before the fix, so it offers
  `implementation` (`fix-after-failure`, `flow-check.mjs:580-581`), whose part is `build`, so `inDelivery` is true
  and `nextStep` (`deliver-check.mjs:1554`, limit 3) falls through to `fix-review` (`:1561`); after the fix commit
  evidence goes stale (`verify`), then the review header goes stale (`rerun-after-fix`) and `nextStep:1587` gives
  round 3 limit 3. A round-3 FAIL reaches ceiling 3 and ends blocked again. A second `declare` finds `fix-review`,
  not a deadlock, and refuses. The pinned tests D-15 lists (`flow-check.test.mjs:534-541`, `:445`, `:543`,
  `version-pin.test.mjs` ceilings 2 and 1) carry no `authorizedReviewRounds` fact, so `?? 0` keeps them as they are.
  T113 pins the shipped `review` ceiling of both scripts to `REVIEW_ROUNDS` (both are 2, verified).
- The real runs that call `declare`. D-14 now has four rules: a direct `declare` is the conducting session's
  (R6, R7, R7b in task 6.3, with the loop's output sent to files so `runOf` never reads a `devkit-run:` line of a
  scratch change), a nested `claude -p` session's own main session may declare (R5, R7s), fixtures are built by a
  script outside the scratch project and never write `declared.json`, and R14 is the one run whose refusal is the
  proof. The guard facts hold: `role(input)` is `''` for the main session (`guard.mjs:74`), `guardBash` has the git
  rules under `sessionRoot && optedIn(sessionRoot)` (`:1036-1041`), `sanitize` is heredoc removal plus quote
  replacement (`:634-646`), `classify` has the `approval.md` line to mirror (`:564`, `:573`), and the three tests
  that match `approval\.md is written only by the main session...` (`guard.test.mjs:1028`, `:1043`, `:1673`) are
  unanchored, so a path before `approval.md` still matches.
- `tasks.md` 4.1 and 6.3 are the conducting session's and the intro, D-14 and each task say so; 4.6 writes no
  language sentence unless R10's line ends in `pass`.

Held, re-derived: `END_OF_KEY` in both loops (`change-loop.mjs:2409`, `roadmap-loop.mjs:1510`); `runMarkers` drops
the end's id (`guard.mjs:766-767`) and `runOf` sets `ended` from any end line (`:784`); the only readers of
`mark.end` are in `runOf`, and every `devkit-end:` line in the existing tests names the run's change (checked at
`change-loop.test.mjs:1723-1739`, `:1826-1829`); `FAMILY.what = 'what.'` (`change-loop.mjs:655`), so `{decision}` is
the right parameter and `SAMPLE` gains it; `gate.decision` exists (`:244`, `:499`); `GATE_OF_WHY` (`:686`) and
`declaredEnd` (`:775-778`) read `params.gate ?? GATE_OF_WHY[why]`; `parseTasks` knows `Gate:` only
(`deliver-check.mjs:403-415`); `nextStep` rows at `:1535` (plan approval, `!state.started`), `:1543-1548` (phase
loop, gate step detail `{ phase, task, command }`), `:1554`, `:1587`, `:1621`, `:1635`; `readReviewMd` already reads
any `/N` (`:1693`); `approvalState` shape is `{ status, recorded, readiness, ok }` (`:1496-1505`) and `planRevision`
stays apart; `staleness` allows anything under `openspec/` (`isOpenspec`), so `declared.json` and `proof/` never stale
the evidence or a review; `flow-check.mjs` imports from `deliver-check.mjs` already (`:11`), so `authorizedRounds`
and `approvalState` need no new edge, and `deliver-check.mjs` cannot import `DECLARED` (`RECORDED_KEYS` and T114 are
the right answer); `PACKS` is exported at `change-loop.mjs:2342` and `AGENT` is a non-exported literal at `:844`;
`createdAfter` is not exported (`:1570`) and has a `catch`; `ATTRIBUTION_ASK` is already exported (`:841`);
`github-setup.mjs` exits 1 for a blocked state; `pr-verifier.md:50` holds the sentence D-8 replaces; both schemas
hold "two rounds at most" (`devkit/schema.yaml:561`, `devkit-lite/schema.yaml:414`); `docs/openspec-flow.md` holds
each anchor D-12 names ("a gate that stays red", the Order of the delivery steps paragraph, the review-change
bullet); versions 0.33.0, 0.14.0 and 0.37.0 match D-18; every path in the tasks exists.

The Existing-tests rule of `openspec/config.yaml` is met: D-15 has 31 rows. I grepped the test files for the texts
the plan changes (`waiting-review-dispute`, `tests-red`, "two rounds at most", "only file you write", "stays red",
the F1 sentence) and found no pinning test that is not a row.

ADRs: ADR 0022 is `proposed`, `accept-decisions` takes it at the plan approval, its points match D-1 to D-7, and no
approach an earlier ADR rejected is used (no fifth state, no unbounded fix loop, no authorization from any message,
no lift of the edit lock).

## 5. Specs review
- Normative `SHALL` and WHEN/THEN scenarios throughout; every outcome row of the decision tables of D-3, D-4 (the
  three-bound table included) and D-5 has a scenario: the stage walk at round 2 FAIL with and without an
  authorization, after a failed authorized round, with two, for a resolution-only record, for other stages and for
  another role's `review` stage, and for a flow whose own ceiling is 1 (`change-stages`).
- The `change-coordination` delta covers the `declare` outcomes (not at the gate, not at a deadlock, no words,
  twice for one deadlock, the resolution's deadlock); `delivery-models` has four scenarios; `file-writers` covers the
  command rule (quoted path, `cd`, other verbs, commit message, heredoc, project without the schemas).
- Two wording points, not blockers (section 10): `coordination-locks` adds a qualifying requirement beside an
  unmodified one that calls any `devkit-end:` line an end line; `change-stages` leaves its title "until the work
  starts" over a requirement that the new one narrows.

## 6. Tasks review
- Six `## N.` groups, each ending in a `Gate:` task with one backticked command whose `&&` parts the checker runs
  one by one. Every AC id is in at least one task. T1 to T114 are each written by exactly one task (1.1: 30, 2.1: 40,
  3.1: 21, 4.2: 15, 5.1: 8 = 114), test-first order holds, and each "check" names the tests it expects to pass.
- Version and ADR numbers are named as "the next free ... at the last merge before review" (6.1, 6.2), as the rule
  asks. Tasks that change a pinned text name the test files (1.1, 1.5, 2.3, 3.6, 4.2, 4.6).
- 4.1, 6.3 and the fetch before 6.1 are the conducting session's; the `Conductor:` marker does not exist yet, so the
  order is kept by the intro, by each task's own text and by the implementer's stop rule. Adequate, and the plan
  says why it is not the marker.
- Phase gates were run on the base (header). No gate is red.

## 7. Omission detection
- Validation, errors, atomicity of `declared.json` (temporary file and rename), parser decisions (`readDeclared`,
  `planDigest`, `declareViolation`), exit codes and refusal messages in both languages: defined.
- Idempotency of `declare gate-red` (a second call is a second red) and of `declare review-round` (the next action
  is no longer a deadlock, so a second call refuses): written.
- Migration, rollback and compatibility: written (no record means limit 2 and today's ceilings; an approval with no
  `- Plan:` line asks nothing; no `Conductor:` task reads as today; a revert leaves ignored files).
- Authorization of an extra round: skill rule, the recorded words, the guard's refusal of a subagent's `declare` and
  of any subagent's write of the file. The main session's own misuse rests on the skill rule, as the plan approval
  does (ADR 0011, ADR 0021); the plan says so in its risk table.
- Observability: the stop lock's decision log; the real runs of D-14 with their one-line checks.
- Not covered, and fine to leave: a flow whose own `review` ceiling is 1 shows "round 3" in the `declare` reply while
  the next round is 2 (a synthetic flow of a test; the shipped flows are 2).

## 8. Execution risks (top 5 failures)
1. The two bounds drift on a merge. Cause: `stage-ceiling-consecutive` (roadmap line 174) changes the count at
   `flow-check.mjs:578` while this change changes the limit. Impact: a third round the stage walk refuses, found only
   at R7. Prevention: D-4 and D-17 give the rule (the sibling's count left, `ceilingOf` right), T105 to T109 hold under
   either count, and the merge precedes the last gate and the whole-suite run (6.1, 6.6).
2. A real run reaches the wrong session. Cause: the new guard refuses a subagent's `declare` by command text, and a
   conducting session that prints a scratch change's `devkit-run:` line moves its own stop lock. Impact: a stalled
   phase or a false stop. Prevention: D-14's four rules and the file-only output of 4.1 and 6.3.
3. The proof files carry the host's paths. Cause: stream JSON of 14 real runs is committed under `proof/` in a public
   repository, and its `init` events hold working directories and the person's home path. Impact: personal data in a
   public repository. Prevention: section 10, first item.
4. A session obeys the review skill's own "no convergence after 2 rounds → stop" at round 3. Cause: the plan edits
   `review-change/SKILL.md`'s `args` and consensus line but not lines 126 to 128 and 149. Impact: a refusal of a round
   the owner authorized, caught by a person, not a test. Prevention: section 10, second item.
5. AC-11's second half is never observed. Cause: only the desktop app shows it. Impact: carried by the roadmap line
   and the retro; the plan says so and does not claim it.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] Medium, fix during implementation — `design.md` D-14 (the output column), tasks 4.1, 6.3 and 6.4: the stream JSON
  files under `proof/` hold the host's working directory and the person's home path in their `init` events. Before they
  are committed, have the run's check also `grep -c` for the home path and replace it with a placeholder (or keep only
  the events the check reads). The repository is public.
- [ ] Medium, fix during implementation — `design.md` D-4, "`plugins/core/skills/review-change/SKILL.md`" bullet and
  task 2.3: that file also says "round 2 re-summons only the reviewers that failed", "No convergence after 2 rounds →
  stop and escalate ... No automatic third round" (line 128) and "no convergence after round 2 goes to the owner" (line
  149). Word them as "after the round limit (2 unless the owner authorized more)"; the rule stays that a third round
  is never automatic. No test pins these lines.
- [ ] Low — `specs/coordination-locks/spec.md`: the new requirement qualifies the unmodified "A run is known from the
  session's own record" ("an end line"). Moving it into a MODIFIED requirement with that requirement's scenarios kept
  keeps the main spec from reading two ways after the archive. Same for the title "until the work starts" in
  `change-stages`.
- [ ] Low — `proposal.md`: about 1,800 words against "under two pages"; trim "What Changes" to one-line bullets.
- [ ] Low — `design.md` D-1: the loop's `declared.json` and the roadmap run file's `declared[id]` share a name and are
  different records; one sentence saying so spares a reader the mistake.
- [ ] Low — `ship-change` used without the loop does not see a plan revised after the approval until the readiness
  runs again; the skill line could say so.

## 11. Explicitly out of scope
- [ ] A plan revised after the approval in `ship-change` used without the loop (the legacy path).
- [ ] `decisions.md` and `mockup.md` edited after the start are not in the digest; the ADR names four plan files.
- [ ] The roadmap coordinator's third review round in session-per-change mode (a design Non-Goal).
- [ ] The `fresh-base-check` half of item 21 and every "Dropped" item.
- [ ] Whether the desktop app's monitor wakes the session on green checks (AC-11's deferred half, the roadmap line).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: four retros, ADR 0022's context, each kept item anchored to code.
2. Is the result measurable? Yes for every AC; AC-11 is split into a measured half and a carried half, and AC-7 now
   has a path the loop reaches (walk, `declare`, round 3), tested through `nextAction` (T111).
3. Are error behaviors defined? Yes: exit codes, `LoopRefusal` messages in both languages, reader errors, refusals.
4. Are edge cases covered? Yes: unreadable record, version 2, unknown keys, empty and missing files, unclosed fences, an
   approval with no digest, a quoted or `cd`-prefixed command, a project without the schemas, a record for the other
   review, another role's `review` stage, a flow with its own lower ceiling.
5. Are dependencies clear? Yes: ADR 0022 accepted at the approval, siblings in D-17, the merge before the last gate.
6. Are contracts defined? Yes: `DECLARED`, `declaredStep`, `readDeclared`, `declared.json`, `ceilingOf`,
   `authorizedRounds`, `deadlockScope`, the digest, the new steps' details, the messages and their parameter names.
7. Can two developers interpret this differently? Not at a point that changes behavior; the two skill-text lines of
   section 10 are the only places.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes, with the two section 10 corrections made on the way.
10. What will be discovered too late if implementation starts now? Possibly a merge conflict with
    `stage-ceiling-consecutive` on the ceiling comparison (handled by D-17 and the order of 6.1), and the fact that
    R7, R7s and R7b are the first end-to-end exercise of the two-bound mechanism, in phase 6.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing before implementation. Two Medium corrections go in during implementation (section 10).
- Main risk if ignored? The ceiling mechanism of D-4 first meets the real loop at R7, in phase 6, after the code is
  written; T105 to T111 exercise it through `nextAction` earlier, in phase 2, which is where a flaw would show.
