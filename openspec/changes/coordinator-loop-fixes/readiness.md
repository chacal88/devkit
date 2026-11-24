<!-- devkit-stage readiness result=failed attempt=5 commit=96d372bae7bd823579419804d0560188588950fd -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD 96d372b (clean tree), the plan revision that follows the merge of `origin/main` c09860c at
fd29ac6 and adds AC-19 and AC-20 (D-22, D-23); D-19 to D-21 (from e0a61af) are reviewed here for the first time.
The plan was judged from the files, not from the attempt 4 report, and `openspec/config.yaml` was read again for
rules added since. Artifacts read: `proposal.md`, `design.md` (every section; D-1 to D-7 and D-12 to D-23 in
full), `tasks.md`, `requirements.md` (the c09860c check and the ACs), `decisions.md`, `approval.md`,
`.openspec.yaml`, the nine spec deltas, ADR 0032 (the change's ADR), ADR 0023, the sibling deltas of
`post-merge-validate` and `stage-ceiling-consecutive`, `openspec/roadmap.md`, and the code each claim names.

Checks run at HEAD: `openspec validate coordinator-loop-fixes --strict` and
`openspec validate coordinator-loop-fixes --type change --strict --no-interactive` pass (CLI 2.0.0);
`python3 scripts/check.py` passes; `python3 scripts/gen-catalog.py --check` exits 0;
`node plugins/compozy/skills/compozy-setup/scripts/gen-agents.mjs --check` exits 0 (21 agents);
`claude plugin validate .` passes. Every test-suite part of the six gates (1.6, 2.5, 3.9, 4.7, 5.9, 6.6) was run
on the base as written, minus the file `change-loop-declared.test.mjs` that task 1.1 creates, with
`TMPDIR=/var/tmp/devkit-coordinator-loop-fixes` and `--concurrency=2`, the machine shared with other work
(load 2 to 15): 1.6 (132 + 194 tests), 2.5 (577 + 286), 3.9 (427 + 316), 4.7 (343 + 118), 5.9 (295 + 144),
6.6 (55 + 21), all green. Every `--test-name-pattern` of every task check and gate matches at least one test of
the files it is given (scripted check), except the `^coordinator-loop-fixes` ones, whose tests do not exist yet.
The non-suite parts that need this change's output (`test -s proof/checks.txt`, the `host-monitor-wake` grep)
are red on the base by design. No gate is red on the base. Two probes on a scratch copy of `openspec/`: the
same `budget`/`models:` lines under `devkit:` in this change's `.openspec.yaml` exit 1 with
"Unrecognized key name(s) ... devkit ... prefix a key with x-", and under `x-devkit:` exit 0 (D-22 holds).

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

The five mandatory findings of attempt 4 are fixed (D-19, the kit regeneration in 3.3 and 4.3, `devkit-compozy`
in D-18 and 6.2, `gen-agents.mjs --check` and the two kit suites in the gates, the CompozyOS approval writer in
D-7, the dispatch source of `resolve-base-conflict` in D-5, AC-13 scoped to the pull requests `releaseConflict`
reads, D-18 worded by rule), and so are its Low items (names in place of lines, `declare`'s `nextAction`
options, the CompozyOS `writeViolation` branch, the proof scrub, the review-change sentences). Every claim of
the new sections that I re-derived holds. Two narrow findings remain mandatory (section 9): D-22 changes the
text of ADR 0023 decision 1 through a Note, where the project's rules ask for an ADR record, and the gate of
phase 1 does not run the tests that call the two functions phase 1 rewrites. Neither changes scope.

The readiness hash changes with this file, so the owner's recorded approval (`approval.md`, `sha256:6dff42735a92`)
is stale: the revised plan goes back to the owner.

## 2. Scope validation
Classification: correct

The scope is the kept items 1, 2, 4 to 6, 8 to 18, 21 to 24 and the field findings 25 to 28 (`requirements.md`),
with explicit non-goals (proposal, design Non-Goals, "Dropped"). AC-19 and AC-20 come from the owner's own
findings 27 and 28 and each has a decision (D-22 picks the `x-devkit:` block, the option AC-19 offers), tasks,
tests and, for AC-19, deltas. The CompozyOS driver's share is stated once (D-19, Non-Goals). Nothing in the
design commits to behaviour absent from the specs or the tasks.

## 3. Proposal review
- Problem, goal and the twenty ACs (AC-3 dropped as covered by main) are observable; AC-11 keeps its proven and
  deferred halves; AC-8, AC-10 and AC-7 now say which driver they hold for.
- Impact names the three packs, the generated kit files, the docs and the ADR Notes; exit criteria include
  `gen-agents.mjs --check` and the strict validation on the merged head.
- `proposal.md` is 3,062 words against the rule "Keep it under two pages" (`openspec/config.yaml`,
  `rules.proposal`); carried as Low (section 10), it grew from about 1,800.

## 4. Design review
Re-derived at HEAD (names, since the plan cites no lines):

- `flow-check.mjs`: `failuresInARow` is exported; `computeFlow` has the local `ceilingOf = (s) => s.ceiling ??
  flow.ceilings.default` and compares `raw.failures >= ceiling`; `artifactState` computes the `header-failed`
  ceiling inline and passes `failures`; the `stale-plan` block is guarded by `!started && !facts.postMerge`;
  `collectFlow`'s `postMerge` is `config.ship !== 'plan' && offOwnBranch(...) && delivery().delivered`, with
  `gf` built with `base`. `capOf` reads the change's file then the config through `parseDevkitBlock`.
  Both scripts' `review` stage is `review-bench`, ceiling 2, `onFail: implementation` (D-4 holds).
- `deliver-check.mjs`: `planDirty` (all of the change folder but the review record) gives `commit` before
  `fix-review`; `folderDirty` gives `commit` before a review round; `isArchiveHead` is `/^(chore\/)?archive-/`
  and is the first line of `isOwnPr` and the `rest` filter of `findChangePr`; `ownFiles` returns null when the
  head is an ancestor of `origin/<base>`; `prItem`'s merged arm is met only at `headRefOid === facts.head`, and
  its post-merge caller passes the `facts` that carry `base`, so `headInBase(root, facts)` is computable there.
- `change-loop.mjs`: `CHECK_BEFORE` does not hold `gate`; `buildPart` reads the step, then the place step, then
  the merge-check block (D-3's position holds); `SKILL_LOOP_STEPS` is `['resolve-release-conflict',
  'renumber-adr']`; `approvalText` writes no `- Plan:` line and `recordApproval` runs under `stateFor(...,
  'approval')`; `budgetOf` and `modelsOf` read the change's `.openspec.yaml` through `parseDevkitBlock`, and the
  `waiting-budget` message says "the devkit block of {file}"; `writePin` replaces or appends only its own
  `x-devkit-version`/`x-devkit-flow` lines and `writeClaimKeys` appends at the end, so an `x-devkit:` block is
  closed by the next top-level key and kept byte for byte (T137 holds); `readPin` matches exact keys.
- `guard.mjs`: `runMarkers` drops the end's id and `runOf` sets `ended` from any end line (D-2 holds);
  `parseDevkitBlock` opens only on `^devkit:` (D-22's key parameter is a one-line change); the `approval.md`
  rule of `classify` and the CompozyOS branch of `writeViolation` are as D-1 says.
- `conduct-check.mjs`: `deliveryRow` returns `rejoin-train` before the overrides and tries `adrClash`,
  `releaseConflict`, `trainRejoin` in that order; `trainRejoin` handles only `rejoin-archive` (D-5 holds).
- Kit: `install-kit.mjs` reuses the manifest's recorded inputs and records `pack`; the manifest's `pack` is
  0.4.0, equal to `plugins/compozy/.claude-plugin/plugin.json` (D-19 holds).
- Siblings: `post-merge-validate` and `stage-ceiling-consecutive` are merged and not archived; the latter's
  three scenarios of "Attempt ceilings and no progress stop the run" are all in this change's delta, so either
  archive order is caught by `merge-check` (D-17 holds). `post-merge-validate`'s requirement "A merge-defect
  fix follows the rule of every plan edit" is in its own delta only (D-7, task 3.6a).
- The three roadmap tests of D-23 exist with the titles D-15 gives, and a search of every test file for
  `readRepo('openspec', 'roadmap.md')` and `readRoadmap(REPO_ROOT)` finds one more reader
  (`change-loop-compozy.test.mjs`, the `review-writer-prompt` line), which accepts either tick.

Failed re-derivation: ADR 0023 decision 1 says "the `devkit:` block of a change's `.openspec.yaml` overrides
single stages"; D-22 replaces that place and records it as a Note, not as an ADR (finding 1).

## 5. Specs review
- `SHALL` and WHEN/THEN throughout; the strict validation passes. The `stage-models` delta keeps the three main
  scenarios and adds the strict-validation, `devkit:`-fallback and both-blocks cases; the `change-coordination`
  budget requirements are modified in step.
- Every outcome row of the D-20 table and of D-21's switch has a scenario (`change-delivery` "A change's own
  pull request", `change-stages` "After a merge the walk resumes at the retro").
- The carried wording points of attempt 4 are closed (`coordination-locks` modifies the requirement it
  qualifies; the `change-stages` title now says "after the work started").

## 6. Tasks review
- Six `## N.` groups, each ending in one `Gate:` with one backticked command and no `|`; every AC id has a task;
  T1 to T141 (T24 dropped) are each written by one task; versions and the ADR number are given as rules.
- The phase gates follow D-17 (the files the phase touches, two parts, `--concurrency=2`, CI's branch
  variables) and are green on the base (header).
- Gap: phase 1 rewrites `runReply` (with its `--stdin <name>` option, which D-1 says `declaredStep` keeps) and
  `roadmap-loop.mjs replyCmd`, but tasks 1.2 and 1.4, gate 1.6 and D-15 do not run the tests that call them:
  `roadmap-loop reply: an end key records declared and prints the end line first; ...` (roadmap-loop.test.mjs:
  the pattern `^roadmap-loop replies` does not match it), `followups AC-4 reply: an end declared for an id that
  is not a change id exits 3 and records nothing` (roadmap-loop-followups.test.mjs), `jira-entry-followups AC-8
  reply --stdin refuses ...` and `jira-entry-followups AC-8 reply without --stdin reads no standard input`
  (change-loop-remote-state.test.mjs), and `upfront AC-8 skill: after a merge-base exit 3 the change session
  declares the end blocked with base-conflict ...` (roadmap-loop-upfront.test.mjs). Likewise task 3.7 changes the
  merged-list filter of `findChangePr`, and `delivery-train P3 delivered: looked up from the default branch, the
  train's merged pull request is not the change's own` (delivery-train-after.test.mjs) calls it and is in
  neither 3.7 nor gate 3.9 (finding 2).

## 7. Omission detection
- Validation, errors, the record's parser decisions and atomic write, exit codes, idempotency (`declare` at the
  same ceiling refuses), migration (no record, no `- Plan:` line, a `devkit:` block all read as today), rollback
  (D-22's rollback names what an `x-devkit:` block loses), observability (`declared.json`, the proof files) and
  the test strategy are defined.
- `post-merge-validate`'s requirement is checked against the main spec only at task 3.6a. If that sibling
  archives after phase 3 and before this change archives, the main spec keeps "neither asks for a new review or
  a new approval", which D-7 makes false for an approval with a digest; nothing after 3.6a looks again
  (section 10).

## 8. Execution risks (top 5 failures)
1. Cause: phase 1 changes `runReply`/`replyCmd` and its gate runs none of the five tests that call them.
   Impact: a lost `--stdin` or a changed `declared[id]` shape passes gate 1.6 and is found by the delivery
   train's whole suite after the evidence and the review. Prevention: finding 2.
2. Cause: D-22 changes ADR 0023 decision 1 through a Note. Impact: the architecture or ADR reviewer of the
   review bench refuses it against the config rule, a plan revision after the implementation. Prevention:
   finding 1.
3. Cause: `post-merge-validate` archives between phase 3 and this change's archive. Impact: the main spec states
   a scenario the code no longer meets. Prevention: section 10, first item.
4. Cause: `deliver-check.test.mjs` takes most of the new checker tests and ran 235 s and 363 s on the base under
   load. Impact: it passes CONTRIBUTING's 300 s mid-change. Prevention: as planned (each file run alone before
   the gate and split above 300 s, D-16).
5. Cause: the stage walk's ceiling and the delivery checker's limit drift. Impact: an authorized round refused by
   one of them. Prevention: as planned (`authorizedRounds` the one count, `ceilingOf` the one function, T105 to
   T113, T132, T113 pinning the shipped ceiling).

## 9. Mandatory fixes before implementation
- [ ] Medium — `design.md` D-22 ("ADR 0023: a dated Note ...") and "Decisions and ADRs" (the bullet that says
  D-22 and D-23 are not in `decisions.md`), `decisions.md`, `tasks.md` 5.6 — ADR 0023 decision 1
  (`docs/adr/0023-the-model-is-chosen-by-stage.md`, `## Decision` item 1) names "the `devkit:` block of a change's
  `.openspec.yaml`" as the place of a change's override; D-22 moves it to an `x-devkit:` block, which changes
  that decision's text. `openspec/config.yaml` `rules.design` says "Record any decision that changes an ADR as a
  proposal for a new ADR, not as a silent deviation", and the design itself leaves the choice to this review
  ("if the readiness review or the owner wants a record for D-22, it is an ADR author's run before the
  approval"). This review asks for the record. Smallest correction: an ADR author's run before the owner's new
  approval that records D-22 as a decision amending ADR 0023 decision 1 (a new decision of the change's ADR,
  with ADR 0023 in its Amends line, or a new ADR), `decisions.md` naming it, and D-22's Note on ADR 0023
  pointing to that record as ADR 0011's Note points to the change's ADR (D-12). No code or test changes.
- [ ] Medium — `tasks.md` 1.2, 1.4, 1.6 and 3.7, 3.9; `design.md` D-15 — the tests that call the functions
  these phases rewrite are not run by them (section 6 lists the six titles and files). D-17 says a gate runs "the
  files of the D-15 tests for the rules and texts it changes", and D-1 promises `declaredStep` keeps `--stdin`;
  as written, a regression in either reaches the delivery train first. Smallest correction: add the five reply
  tests to D-15 as "kept" rows (rule: the reply's end line and record; `--stdin`), name them in the checks of 1.2
  and 1.4, and add to the second part of gate 1.6 the patterns `^roadmap-loop reply:` (or widen
  `^roadmap-loop replies` to `^roadmap-loop repl`), `^followups AC-4 reply`, `^jira-entry-followups AC-8` and
  `^upfront AC-8 skill` with the files `roadmap-loop-followups.test.mjs` and `roadmap-loop-upfront.test.mjs`; add
  `^delivery-train P3 delivered` to the check of 3.7 and to gate 3.9 (its file is already there).

## 10. Optional improvements (within scope)
- [ ] Medium, fix during implementation — `tasks.md` 6.1 and `design.md` D-7 (the paragraph on the sibling's
  requirement): run 3.6a's `grep -c "^### Requirement: A merge-defect fix follows the rule of every plan edit"
  openspec/specs/change-coordination/spec.md` again after the merge of 6.1, and when it prints 1 while this
  change's delta holds no copy, report it so the copy is added (a plan revision, D-7) before the evidence.
- [ ] Low — `design.md` lines 595, 612 and 1520 write "ADR 0032" though "How this plan names things" says the
  plan never writes the number outside `decisions.md`; write "the change's ADR".
- [ ] Low — `design.md` D-15, the rows of `post-merge-validate 3` and `stage-roles docs`, and D-23: "asserts no
  tick" reads two ways; write "makes no assertion on the tick".
- [ ] Low — gates 4.7 and 5.9: D-9 moves `PACKS` and D-22 gives `parseDevkitBlock` a second argument; their
  direct tests `project-settings: PACKS equals the plugin names in marketplace.json`
  (`plugins/openspec/skills/openspec-setup/scripts/project-settings.test.mjs`) and `change-loop settings:
  shipConfig of deliver-check gives the same with and without the block` (`change-loop.test.mjs`) could join the
  checks of 4.4 and 5.5.
- [ ] Low — `proposal.md`: 3,062 words against "Keep it under two pages"; trim "What Changes" to one line per
  item and leave the reading of AC-13 and AC-11 to the design.

## 11. Explicitly out of scope
- [ ] A plan revised after the approval in `ship-change` used without the loop, beyond the sentence D-7 adds.
- [ ] `decisions.md` and `mockup.md` edited after the start are not in the digest (the ADR names four plan files).
- [ ] The roadmap coordinator's third review round in session-per-change mode (a design Non-Goal).
- [ ] The `fresh-base-check` half of item 21 and every "Dropped" item.
- [ ] Whether the desktop app's monitor wakes the session on green checks (AC-11's deferred half, `host-monitor-wake`).
- [ ] The CompozyOS driver's red-gate question and two-round review loop (Non-Goals, D-19).
- [ ] `resolve-base-conflict` in a project with the delivery train, where a conflict boards (D-5).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes: four retros and four field findings, each kept item anchored to code.
2. Is the result measurable? Yes: every AC has tests (T1 to T141) and, where an agent writes, a real run (D-14).
3. Are error behaviors defined? Yes: exit codes, `LoopRefusal` messages in both languages, the record's reader
   errors, the guard's refusals, the strict validation's warning.
4. Are edge cases covered? Yes, including the train exclusions, both drivers, both archive orders of the
   siblings, the `devkit:` fallback and both blocks in one file.
5. Are dependencies clear? Yes: the siblings and their states on c09860c (D-17), the merge that opens each phase.
6. Are contracts defined? Yes: `DECLARED`, `declaredStep`, `readDeclared`, `declared.json`, `ceilingOf`,
   `authorizedRounds`, `deadlockScope`, `planDigest`, `foreignArchiveHead`, `headInBase`, `changeDevkitBlock`.
7. Can two developers interpret this differently? Only on the ADR form of D-22 (finding 1), which the design
   leaves open, and the "asserts no tick" wording (section 10).
8. Are any decisions implicit instead of written? No; D-22's record is written as a choice deferred to this review.
9. Do the tasks fully deliver the intended outcome? Yes once finding 2 puts the reply tests in phase 1.
10. What will be discovered too late if implementation starts now? A reply regression at the train's whole suite,
    and an ADR objection to D-22 at the review bench.

## 13. Final conclusion
- Can we start? No: two mandatory corrections, both narrow and without a change of scope.
- What must be fixed? Section 9 (an ADR record for D-22, and the reply and `findChangePr` tests in the checks
  and gates of phases 1 and 3), then a new readiness run; the owner approves the revised plan again (the hash
  changes).
- Main risk if ignored? Phase 1 passes its gate with its rewritten reply path untested until the delivery train.
