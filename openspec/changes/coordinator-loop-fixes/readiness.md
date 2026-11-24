<!-- devkit-stage readiness result=failed attempt=4 commit=2fbb92f42503b846c67e1594c8e936d09fc21046 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD 2fbb92f (clean tree: the plan files are committed). This round follows the merge of `origin/main`
(8185b85: delivery-train, stage-models, compozy-driver, roadmap-panel-study) and the renumbering of the change's ADR
from 0022 to 0025 (2fbb92f). The whole plan was judged afresh from the files, not from the attempt 3 report. Artifacts
read: `proposal.md`, `design.md` (all 916 lines), `tasks.md`, `decisions.md`, `requirements.md`, `approval.md`, the eight
spec deltas, ADR 0025 and ADRs 0022 to 0024, `openspec/config.yaml`, `CLAUDE.md`, `CONTRIBUTING.md`, the roadmap, and the
merged code each claim names (`git diff 0501f0a 8185b85 --stat` read in full, then the files the plan edits).

Checks run at HEAD: `openspec validate coordinator-loop-fixes --strict` passes; `python3 scripts/check.py` passes;
`python3 scripts/gen-catalog.py --check` exits 0; `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check`
exits 0 (21 agents); `command claude plugin validate .` passes. `parseTasks` and `readPhases` read `tasks.md` as 36 tasks in 6
phases, each phase with one gate, no gate command holding a `|`. Every gate command that exists on the base was run
there once, with `GITHUB_HEAD_REF=probe-branch` and `GITHUB_BASE_REF=main`, `TMPDIR` under `/private/tmp`: gate 1.6 (222
tests, green), 2.5 (614 tests green, and `review-round.test.mjs` green), 3.7 (504 green), 4.7 (408 green), 5.5 (36 green);
`check.py` green. Gate 6.6 is the whole suite and was not run (the caller forbids it); its non-suite parts are the checks
above, all green. No gate is red on the merged base. A probe on a scratch copy of `plugins/` and `.compozy/` (a one-line
edit of `plugins/core/agents/tdd-implementer.md`, the file task 3.3 edits) made `gen-agents.mjs --check` print
`tdd-implementer: differs from its source` and exit 1; that is finding 1.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

The plan was approved on an older base. The merge brought in the CompozyOS driver and kit (ADR 0024), and the plan does
not know it exists: three of its edits break suites and a CI step that the merge added, and one of its ACs (AC-8) is
silently void for the new driver. Five findings are mandatory (section 9); each fits in a revision of `design.md` and
`tasks.md` with no change of scope and no new decision (they apply ADR 0025's decisions 6 and 7 and `CONTRIBUTING.md` step 5
to files that did not exist when the plan was written). Every claim about the delivery checker, the stage walk, the guard and
the loops that the attempt 3 review verified still holds in substance at the merged head; only line numbers moved.

The readiness hash changes with this file, so the owner's recorded approval (`approval.md`, `sha256:6dff42735a92`) is stale
once it is written: the revised plan goes back to the owner, as AC-8's own rule says it should.

## 2. Scope validation
Classification: correct (incomplete on one edge, finding 4)

The scope is unchanged and explicit (proposal "What Changes", non-goals, design Non-Goals, "Dropped" in `requirements.md`),
and follows ADR 0025's eight points. Every capability the plan touches has a delta (eight, none new), and the merge added no
main spec: `openspec/specs/` is untouched by 0501f0a..8185b85, so each MODIFIED requirement still carries every scenario of
the main one. I compared the requirement names of the deltas of `delivery-train`, `stage-models` and `compozy-driver`
(still under `openspec/changes/`, not archived) with this change's deltas for `change-coordination`, `change-delivery`,
`coordination-locks` and `change-stages`: no requirement is modified by two changes, so the archives do not overwrite each
other. What the plan leaves out is the surface the merge added: the CompozyOS driver reads the same `nextAction` and writes
`approval.md` itself (finding 2), and its kit is generated from two files the plan edits (finding 1).

## 3. Proposal review
- Problem, goal and the sixteen ACs are unchanged and observable. AC-11 stays split into a proven half and a carried half.
- `proposal.md` Impact (lines 106-125) lists `devkit-openspec` and `devkit-core` as the packs to bump; the merge made
  `devkit-compozy` a third, because the plan edits two agent files its templates are generated from (finding 1). Its exit
  criteria (lines 121-125) omit `gen-agents.mjs --check`, which `CLAUDE.md` now lists as a command and CI runs.
- AC-13 (line 77) says "a pull request that conflicts with the base outside the release files gets a declared resolve step";
  at the merged head an archive that left a delivery train and conflicts outside the release files keeps a blocked
  `stop-archive` (finding 4).
- ADR 0025 is `accepted` in its file (accepted at the 2026-11-24 approval); `proposal.md` lines 6 and 118 and `design.md` lines 5-6,
  802 and 908 still say "proposed". Wording only (section 10).

## 4. Design review
Every claim about internals was re-derived with Read, Grep and runs at HEAD. Held, with the line the code is now at
(the design's own line numbers are the c1ac8c4 ones and are all off; section 10):

- `deliver-check.mjs`: `nextStep` starts at 1669; the plan-approval stop is at 1705 (`!state.started`); the phase loop
  (`implement`, `gate`) at 1715-1720; `stop-review-deadlock` at 1724-1725 (`round >= 2`); `fix-review` 1736; `review` round at
  1757; the resolution's deadlock at 1801-1802 and its round at 1815; `readReviewMd` reads any `/N` (1877); `approvalState`
  keeps its `{ status, recorded, readiness, ok }` shape (1655-1664); `resolutionState` is called inside `twoPrsOf` (1923), where
  `dir` is in scope, so `res.limit` is computable there; `parseTasks` 416 and `readPhases` 434 know `Gate:` only; `staleness`
  allows anything under `openspec/` (`isOpenspec`, 231, 302), so `declared.json` and `proof/` never stale evidence or a
  review. The delivery train rows (`disable-auto-merge`, `boarded`, `on-train`, `wait-train`, `rejoin-train`) sit before and
  after the rows the plan changes and do not touch them.
- `flow-check.mjs`: the local `ceilingOf` is at 532 and is used at 600-601 (`raw.attempt >= ceiling`), the `header-failed`
  ceiling is computed inline at 481; both are the two places D-4 replaces with one exported `ceilingOf(stage, flow, facts)`.
  `flow-check.mjs` already imports from `deliver-check.mjs` (line 11), so `authorizedRounds` needs no new edge. `stage-ceiling-
  consecutive` is still unmerged (roadmap line 177), so D-17's rule has nothing to apply yet.
- `change-loop.mjs`: `END_OF_KEY` 2951 and `runReply` 2972 (and `roadmap-loop.mjs` 1719-1745, `replyCmd`); `GATE_OF_WHY` 810 and
  `declaredEnd` 899-906 read `params.gate ?? GATE_OF_WHY[why]`; `FAMILY.what` 779; `LoopRefusal` 57 and `failure()` 3140 give
  `{ version: 1, error, reply }` and exit 3; `AGENT` is still a non-exported literal of nine roles (968-978) and `PACKS` is
  exported at 2523, so D-9's move holds; `COMMIT_AGENT` and `ATTRIBUTION_ASK` are exported (963, 965); `createdAfter` (1739) is
  not exported and has a `catch`; `decide`'s `buildPart` has `const step = row.next.step;` at 1340 and the plan-approval wait
  at 1362-1365; `planPart`'s two approval waits are at 1290-1291 and `PLAN_REASONS` at 981; the owner-end branch is at 1368.
  `nextAction` takes an options object (1432), so `redGate` is one more key. The stage-models retry (`retried`, 1219-1229)
  works on the brief of an agent action; it does not touch `fix-gate`, which only `declare` hands.
- `guard.mjs`: `runMarkers` 812 and `runOf` 816-833 drop the end's id and set `ended` from any end line, so D-2 is as described;
  `classify` keeps the `approval.md` line (604, 613); `sanitize` (680) is heredoc removal plus quote replacement;
  `guardBash` (1306) has the git rules under `sessionRoot && optedIn(sessionRoot)` (1310).
- `conduct-check.mjs`: `releaseConflict` (406) returns `stop(... conflict in ${others})` at 432, the line D-5 overrides;
  `SUBAGENT` (50) and `MAIN` (62) are the two tables D-5 and D-6 extend; `deliveryRow` (473) puts `releaseConflict` before
  `trainRejoin`.
- Skills and docs: `ship-change/SKILL.md` has the rows the plan edits (`stop-plan-approval` 52, `implement` 54, `gate` 55,
  `review` 57, `stop-review-deadlock` 59, `review-resolution` 88) and line 20; `devkit/SKILL.md` has the Loop items, `## Owner
  gates` 138, `## Waiting on GitHub` 142 and, new, `## Train` 152 right after it, which the new train test pins by position (D-10
  adds a paragraph, not a heading, so it holds); `devkit-session/SKILL.md`, `review-change/SKILL.md` and
  `review-round.workflow.js` are not in the merge diff and read as the plan says; both schemas still hold "two rounds at most"
  (`devkit/schema.yaml:561`, `devkit-lite/schema.yaml:414`, both copies); `docs/openspec-flow.md` holds each anchor D-12 names
  (`**The loop.**` 232, `**Waiting on GitHub.**` 238, `**The locks (devkit-openspec 0.16.0).**` 242, `**Delivery rows.**` 306,
  `**Order of the delivery steps.**` 467, `Plan approval on disk` 489, the review-change bullet 858, the `devkit-lite` section 81);
  `docs/coordination-design.md` holds the review row at 188; ADR 0011 is untouched by the merge.
- ADRs: ADR 0025 is consistent with ADRs 0022 to 0024 (no decision of theirs is reversed; ADR 0022 point 8 and ADR 0024 are
  the context of findings 4 and 2). ADR 0025 decision 3 raises the `review` stage's ceiling and the delivery limit together;
  the code the walk reads is as D-4 says.

Failed re-derivations (each is a finding of section 9 or 10):

- The plan does not mention the CompozyOS driver, its kit or its tests, though the merge made them depend on files the plan
  edits and on the text it changes (findings 1, 2, 3).
- D-18 states "today 0.33.0 to 0.34.0 and 0.14.0 to 0.15.0 ... 0.37.0 to 0.38.0" and the CI pin lines "661, 662 and 675". At 8185b85
  the packs are devkit-openspec 0.36.0, devkit-core 0.14.1 and the marketplace 0.40.0, and the pin lines are 731, 732 and 745
  (finding 5).

## 5. Specs review
- Normative `SHALL` and WHEN/THEN scenarios throughout; every outcome row of the decision tables of D-3, D-4 and D-5 has a
  scenario (attempt 3 checked it row by row; no spec text changed).
- `change-coordination` and `file-writers` say nothing about the CompozyOS driver, so a reader cannot tell whether "the
  session records the digest" (AC-8) and "a red gate hands one fix" (AC-10) cover it (finding 2).
- The two wording points of attempt 3 stay open (section 10): the qualifying requirement of `coordination-locks` beside an
  unmodified one, and the title of the `change-stages` requirement.

## 6. Tasks review
- Six `## N.` groups, each ending in a `Gate:` task with one backticked command; every AC id is in a task; T1 to T114 are each
  written by one task; version and ADR numbers are named as "the next free ... at the last merge before review" (6.1, 6.2), as
  the rules of `openspec/config.yaml` ask. No gate is red on the merged base (header).
- Tasks 3.3 and 4.3 edit `plugins/core/agents/tdd-implementer.md` and `plugins/core/agents/pr-verifier.md`; neither names the
  kit's generated copies of those files, the suites that pin them, or the pack bump (finding 1). The rule of `openspec/config.yaml`
  "a task that changes a text a test pins names each test file that asserts the old text" is not met for them, nor for the
  `ROWS` addition of 2.4 (finding 3) or the approval form of 3.4 to 3.6 (finding 2).
- The `CONTRIBUTING.md` rule added by the merge ("run by name the tests that base added since the plan's base ...: a failing one
  is a row for the plan's test table and one plan revision") is what findings 1 to 3 apply. The search of D-15 covers eleven
  test files; it does not cover `gen-agents.test.mjs`, `adoption.test.mjs`, `loop-templates.test.mjs`, `devkit-kit.test.mjs`,
  `install-kit.test.mjs`, `delivery-train.test.mjs`, `stage-models.test.mjs`, `compozy-driver.test.mjs` or `release-tags.test.mjs`.
  I grepped the last four and the train and models suites for the texts the plan changes (`tests-red`, `stop-review-deadlock`,
  `waiting-review-dispute`, `stop-plan-approval`, `Outcome: failure`, `round 2`, "two rounds", "only file you write",
  `resolve-release-conflict`) and found no pin there beyond the ones in findings 1 to 3.

## 7. Omission detection
- Validation, errors, atomicity of `declared.json`, parser decisions, exit codes, idempotency, migration, rollback and
  observability are defined (attempt 3), and nothing the merge brought changes them.
- Not defined, and new: what each of D-3, D-4 and D-7 does under the CompozyOS driver. At the merged head a red gate in that
  driver asks the owner (`buildView`, `change-loop.mjs` 2677, `loop.yaml` 466-478) and its review loop passes `next.round`
  with no `limit` to `review-round.mjs` (`devkit-review/loop.yaml` 61-66), so an authorized third round would be refused there;
  it writes `approval.md` itself (finding 2). Saying "the CompozyOS driver is not changed by this change, except ..." closes it.
- `declare`'s printed action: `next` reads the budget, the strict model table and the retry (`runNext`, 2955-2965); `declare`
  does not say whether its `nextAction` call does (Low, section 10).
- In a CompozyOS session, `writeViolation` (`guard.mjs` 642-644) refuses every owner-`''` gate with the `approval.md` message;
  `declared.json` would get that message there. A CompozyOS session never calls `declare`, so this is a wording point (Low).

## 8. Execution risks (top 5 failures)
1. Cause: tasks 3.3 and 4.3 edit two agent files and nothing regenerates the kit. Impact: phases 3 and 4 pass their gates (no gate
   runs the kit's suites), CI's "CompozyOS agents are up to date" step and `gen-agents.test.mjs` / `adoption.test.mjs` go red, found
   at 6.6 or on the pull request, after the review round. Prevention: finding 1.
2. Cause: the CompozyOS driver writes `approval.md` without a `- Plan:` line. Impact: a change run on CompozyOS is never sent back
   to its gates after a plan edit, and AC-8 is true for one driver only. Prevention: finding 2.
3. Cause: `ROWS['resolve-base-conflict']` makes the exhaustive hand-off test of the compozy view fail. Impact: red in phase 2's
   neighbour suites (the 2.5 patterns do not match `change-loop compozy view`; 3.7's `^change-loop` does), so it surfaces a phase late.
   Prevention: finding 3.
4. Cause: the stage walk's ceiling and the delivery checker's limit drift (D-4, unchanged risk). Impact: a third round the walk
   refuses, found at R7. Prevention: unchanged: `ceilingOf` and `authorizedRounds` as the one count, T105 to T113.
5. Cause: the proof files of 14 real runs carry the host's paths (attempt 3, unchanged). Impact: personal data in a public
   repository. Prevention: section 10, first item.

## 9. Mandatory fixes before implementation
- [ ] High — `tasks.md` 3.3 (lines 138-143), 4.3 (173-176), gates 3.7 (157) and 4.7 (194), 6.2 (220-225); `design.md` D-6 (376-378), D-8
  (429-431), D-15 (600-641), D-18 (790-798); `proposal.md` Impact (106-125) — the plan edits `plugins/core/agents/tdd-implementer.md`
  and `plugins/core/agents/pr-verifier.md`, and the merge made the kit's `templates/agents/<role>/AGENT.md` a generated copy of
  every Claude agent file (`gen-agents.mjs` lines 1-12: "the instructions body is the source text, unchanged"), checked by CI
  (`.github/workflows/ci.yml`, step "CompozyOS agents are up to date"), by `gen-agents.test.mjs:114` ("the repository is up to
  date"), and, for this repository's own `.compozy/agents/<role>/AGENT.md`, by `adoption.test.mjs:81-87` (byte for byte against
  the rendered template) and its manifest test (`:97-104`); a probe confirmed exit 1. `CONTRIBUTING.md` step 5 bumps every pack
  changed, and `plugins/compozy` changes. Smallest correction: in 3.3 and 4.3 add "regenerate the kit's two agent templates with
  `gen-agents.mjs`, refresh `.compozy/agents/tdd-implementer/AGENT.md`, `.compozy/agents/pr-verifier/AGENT.md` and
  `.compozy/kit-manifest.json` the way `adoption.test.mjs` renders them, and say which command does it"; add `devkit-compozy` (next
  minor after `origin/main`'s at the last merge, `plugin.json`, `marketplace.json`, a `CHANGELOG.md` bullet) to D-18, 6.2 and the
  proposal's Impact; add `node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` to the exit criteria and to the
  gates 3.7 and 4.7, with `node --test` of `gen-agents.test.mjs` and `adoption.test.mjs` by name; add the three kit tests as rows
  of D-15.
- [ ] High — `design.md` D-7 (387-419), `tasks.md` 3.4 to 3.6 (144-156), D-15 (626-627); `proposal.md` AC-8 (line 70) — the CompozyOS
  driver is a second writer of `approval.md`: `approvalText` (`change-loop.mjs:2810`, "in the form of the `stop-plan-approval` row
  of `ship-change`") and `recordApproval` (`:2830-2840`) write `- Status`, `- Readiness`, `- Date`, `- Owner's words` and no
  `- Plan:`, and the test `change-loop compozy record-approval: it writes approval.md in the form of the ship-change row ...`
  (`change-loop.test.mjs:4175`, with the two after it at 4188 and 4203) pins that exact text. D-7 changes that row's form and says an
  approval with no `- Plan:` line "asks nothing", so a plan approved on CompozyOS is never sent back, and the test and the row
  disagree after the change. Two developers can choose differently. Smallest correction: decide it in D-7. The one that keeps AC-8
  whole: `approvalText` takes the digest from `planDigest(dir)` and writes `- Plan:` as the row does, `recordApproval` passes it,
  task 3.4 or 3.5 does it with its tests (the text test above updated, one new case for a revised plan under
  `next --view compozy`), and D-15 gets the row. Add one sentence to D-3 and D-4 and to the Non-Goals: the CompozyOS driver keeps its
  red-gate question to the owner and its review loop's two rounds (`declare` is the Claude driver's; `devkit-review` passes no
  `limit`), unchanged.
- [ ] High — `design.md` D-5 (337-357), D-15 (609-641), `tasks.md` 2.4 (120-125) — D-5 adds `ROWS['resolve-base-conflict'] =
  handOff('implementation', 'tdd-implementer')`, and `change-loop compozy view: every hand-off step of the delivery rows carries its
  dispatch sentence ...` (`change-loop.test.mjs:3888-3905`) asserts the exact set of hand-off steps (`deepEqual` against a list that
  ends `... 'renumber-adr', 'rejoin-train'`), so it fails until `resolve-base-conflict` is added to it; its gate pattern
  (`^change-loop compozy`) is in no phase 2 gate. The same test also decides where a hand-off's dispatch sentence comes from:
  `SKILL_LOOP_STEPS` (`change-loop.mjs:2620`) names the steps whose sentence is a `devkit` skill Loop bullet, every other one needs a
  `ship-change` row, and the view names "one source only". D-5 writes the sentence in both places and does not say which the view
  uses. Smallest correction: D-5 says `resolve-base-conflict` stays out of `SKILL_LOOP_STEPS`, so its `ship-change` row is the
  dispatch source and the `devkit` skill item points to it (or the opposite, and `SKILL_LOOP_STEPS` gains it); D-15 and 2.4 name the
  test and its list; the gate 2.5 gets `--test-name-pattern="^change-loop compozy"`.
- [ ] Medium — `proposal.md` AC-13 (line 77), `design.md` D-5 (337-357) and Non-Goals (52-62) — `trainRejoin` (`conduct-check.mjs:443-465`)
  stops an archive that left a train with `stop-archive` when it conflicts outside the release files and the roadmap ticks, and
  `rejoin-train` (`deliver-check.mjs:1767`) is the change's own step; D-5 changes only `releaseConflict`. AC-13 as worded ("a pull
  request that conflicts with the base outside the release files gets a declared resolve step") is wider than the code D-5 builds,
  and T48 does not say whether a train project is covered. Smallest correction: scope AC-13 and D-5 to the pull requests the
  override reads (`releaseConflict`: a change's and an archive's, with no train left), and write in the Non-Goals that an archive that
  left a train keeps `stop-archive` (ADR 0022 point 8), unchanged.
- [ ] Medium — `design.md` D-18 (790-798), `decisions.md` line 3 — D-18 states facts that are false at the commit that ships it:
  "today 0.33.0 to 0.34.0 and 0.14.0 to 0.15.0 ... 0.37.0 to 0.38.0" (they are 0.36.0, 0.14.1 and 0.40.0) and the CI pin lines "661, 662
  and 675" (731, 732 and 745); `decisions.md` still says "the number 0022 is the next free one" for an ADR that is 0025. Smallest
  correction: word D-18 with the rule only ("the next minor after `origin/main`'s at the last merge before review", no literal
  version or line) and have `decisions.md` say the ADR was drafted as 0022 and renumbered to 0025 at the merge of 8185b85.

## 10. Optional improvements (within scope)
- [ ] Medium, fix during implementation — `design.md` D-14 (output column), tasks 4.1, 6.3 and 6.4 (carried from attempt 3): the stream
  JSON files under `proof/` hold the host's working directory and the person's home path in their `init` events; the repository is
  public. Have each run's check also `grep -c` for the home path and replace it with a placeholder before the files are committed.
- [ ] Medium, fix during implementation — `design.md` D-4, "`plugins/core/skills/review-change/SKILL.md`" bullet and task 2.3 (carried):
  that file also says "round 2 re-summons only the reviewers that failed", "No convergence after 2 rounds -> stop ... No
  automatic third round" and "no convergence after round 2 goes to the owner"; word them as "after the round limit (2 unless the
  owner authorized more)". No test pins them.
- [ ] Low — every line number of `design.md` and `tasks.md` is the c1ac8c4 one and has moved (for example "line 1554, 1587, 1621,
  1635, 1737" of `deliver-check.mjs` are 1724, 1757, 1801, 1815 and 1923; `flow-check.mjs` "459, 510, 575-579" are 481, 532, 600-601;
  `change-loop.mjs` "869, 1211, 2342, 844, 1570" are 995-997, 1368, 2523, 968, 1739; `guard.mjs` "564, 573, 861" are 604, 613 and
  about 1001-1071; `docs/coordination-design.md` "line 185" is 188; the roadmap "line 174" is 177; test lines "657, 3280 ..." and "534-541").
  The implementer locates each by name; say so in the intro of `tasks.md`, or replace the numbers by names.
- [ ] Low — `design.md` D-3 and D-4: say whether `declare`'s `nextAction` call reads the budget, the strict model table and the
  retry as `next` does (`runNext`, `change-loop.mjs:2955-2965`); the cheapest rule is "as `next` does, except `retry`".
- [ ] Low — `design.md` D-1, "Who writes it": say that in a CompozyOS session (`COMPOZY_SESSION_ID` set) `writeViolation` refuses
  `declared.json` through its first branch (`guard.mjs:642-644`), and that its message names `approval.md`; give `declared.json` its own
  message there or state that the wording is accepted.
- [ ] Low — "ADR 0025 (proposed ...)" in `proposal.md` lines 6 and 118 and `design.md` lines 5-6, 802 and 908: the ADR is accepted
  (`docs/adr/0025-...md` line 3).
- [ ] Low — `specs/coordination-locks/spec.md` (carried): the new requirement qualifies the unmodified "A run is known from the
  session's own record"; moving it into a MODIFIED requirement keeps the main spec from reading two ways after the archive. Same for
  the title "until the work starts" in `change-stages`.
- [ ] Low — `proposal.md` (carried): about 1,800 words against "under two pages"; trim "What Changes" to one-line bullets.
- [ ] Low — `design.md` D-1 (carried): the loop's `declared.json` and the roadmap run file's `declared[id]` share a name and are
  different records; one sentence saying so.
- [ ] Low — `ship-change` used without the loop does not see a plan revised after the approval until the readiness runs again
  (carried); the skill line could say so.

## 11. Explicitly out of scope
- [ ] A plan revised after the approval in `ship-change` used without the loop (the legacy path).
- [ ] `decisions.md` and `mockup.md` edited after the start are not in the digest; the ADR names four plan files.
- [ ] The roadmap coordinator's third review round in session-per-change mode (a design Non-Goal).
- [ ] The `fresh-base-check` half of item 21 and every "Dropped" item.
- [ ] Whether the desktop app's monitor wakes the session on green checks (AC-11's deferred half, the roadmap line).
- [ ] Any change to the CompozyOS driver's loops (`devkit-change`, `devkit-review`) for the declared steps: the plan keeps them as
  they are (finding 2 asks only that the plan say so, and that `approvalText` follow the approval form).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: four retros, ADR 0025's context, each kept item anchored to code.
2. Is the result measurable? Yes for every AC. AC-8 is measurable only for the Claude driver until finding 2 is settled; AC-13 is
   wider than the code D-5 builds (finding 4).
3. Are error behaviors defined? Yes: exit codes, `LoopRefusal` messages in both languages, reader errors, refusals.
4. Are edge cases covered? Yes for the Claude driver and the guard; the CompozyOS driver, the train archive and the kit's generated
   files are not (findings 1, 2, 4).
5. Are dependencies clear? Partly: ADR 0025, the siblings of D-17 and the merge before the last gate are; the surfaces the merged
   siblings added (the kit, its tests, the driver's approval writer) are not.
6. Are contracts defined? Yes: `DECLARED`, `declaredStep`, `readDeclared`, `declared.json`, `ceilingOf`, `authorizedRounds`,
   `deadlockScope`, the digest, the new steps' details, the messages. Not defined: the approval form shared with the driver, and
   the dispatch source of `resolve-base-conflict`.
7. Can two developers interpret this differently? Yes, at three points: whether the driver's approval gets `- Plan:` (finding 2),
   which source holds the `resolve-base-conflict` dispatch sentence (finding 3), and whether regenerating the kit belongs to the
   change (finding 1).
8. Are any decisions implicit instead of written? Yes: the three above.
9. Do the tasks fully deliver the intended outcome? Not until finding 1 is in them: as written the phases pass their gates and the
   pull request's CI step fails.
10. What will be discovered too late if implementation starts now? That the kit's sync check fails at 6.6 or in CI, that the
    compozy view's hand-off test fails a phase after the row that breaks it, and that a CompozyOS-approved plan is never sent back.

## 13. Final conclusion
- Can we start? No: five mandatory corrections, all in `design.md`, `tasks.md` and `proposal.md`, none of them a change of scope.
- What must be fixed? Section 9, then a new readiness run; the owner approves the revised plan again (the hash changes).
- Main risk if ignored? Phases 3 and 4 go green on gates that do not run the kit's suites, and the CI step "CompozyOS agents are up
  to date" fails on the pull request after the review round.
