<!-- devkit-stage readiness result=failed attempt=8 commit=ad1c5d00147d693158238ad98b138812ad21c579 -->
# Readiness review: coordinator-loop-fixes

Reviewed at HEAD ad1c5d0 (clean tree), after implementation started. Phase 1 is done (gate 1.6 ticked).
Tasks 2.0 to 2.2 are ticked. 2.3 (8b9be44) and 2.4 (d3da0e9) are coded but not ticked. The revision ad1c5d0
changes `design.md` (D-1, D-5, D-14 R7b, D-15, D-16 T96, D-23, the risk table), `tasks.md` (2.3, 2.4, 2.5,
5.8, 5.9), `proposal.md` and `requirements.md` (an AC-20 note). I read the whole diff and re-derived each claim
it makes against the code at HEAD.

Since the approval (75ce9f0), the branch merged `origin/main` at 2.0. That merge brought one new project rule:
the `Gates:` line of `openspec/config.yaml:42`, added by 2e70e34 (the archive of `state-skips-unlocated`). By the
review method, a rule added since the approval applies to the revised plan.

Checks run at HEAD:
- `openspec validate coordinator-loop-fixes --strict` and `... --type change --strict --no-interactive` both
  print "Change 'coordinator-loop-fixes' is valid".
- `python3 scripts/check.py`: "all checks passed".
- The three parts of gate 2.5 (`TMPDIR=/var/tmp/devkit-coordinator-loop-fixes`, `--concurrency=2`):
  - part 1: 604 tests, 1 fail (`conduct: under two-prs, a conflict that also has README.md is blocked ...`);
  - part 2: 321 tests, 1 fail (T96);
  - part 3, the new jira call: 1 fail (`jira-entry-followups AC-10 ...`).
  These are exactly the three failures the revision addresses.
- I probed each revised assertion in a scratch copy of HEAD (`git archive`, nothing written to the worktree):
  - T96 with the record committed and pushed gives `push`, then `fix-resolution`.
  - The new jira fixture passes as the D-15 row states.
  - The two-prs test with the D-15 row's assertions passes.

The caller gave no verdict, and this review relies on none.

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no. One narrow fix is needed: the gates must follow the project's new `Gates:` rule, or
  state the exception it allows.

The three gaps phase 2 found are closed correctly and verified against the code. The one blocker comes from
the rule the 2.0 merge brought.

## 2. Scope validation
Classification: correct. The revision adds no behaviour:
- T96 now asserts what `nextStep` already does.
- Two existing tests become D-15 rows.
- Gate 2.5 runs one more test.
- The `post-merge-validate 3` edit is dropped because main already made it.

## 3. Proposal review
No new findings. The `post-merge-validate 3` sentence is true at HEAD (see section 4). The Low length item is
carried (section 10).

## 4. Design review
Claims of the revision, re-derived at HEAD:
- D-1, item 5 lists every uncommitted file of the change folder. Confirmed:
  `plugins/openspec/hooks/deliver-check.mjs:1116-1117` (`details.uncommitted = changedUnder(root, 'openspec/changes/<id>')`,
  with no exemption for `declared.json`).
- D-1, the `push` row comes before the two-prs rows. Confirmed: `push` is at `deliver-check.mjs:1967`, and
  `two.resolution`'s `stop-review-deadlock` and `fix-resolution` are at `:1982` and `:1992`.
- D-1, at the code review's deadlock `fix-review` comes first. Confirmed: `deliver-check.mjs:1896-1910`, where
  `planDirty` leaves `declared.json` out (`:2181`). So T111 is unchanged.
- The probed `declare` action is the `commit-and-pr` hand-off `push`, with
  `detail.reason` "uncommitted files in the change folder: openspec/changes/feat/declared.json". R7b's "its
  reason naming `declared.json`" therefore holds.
- After the probe committed the record and pushed `feat`, `next` gave `fix-resolution`. The fixture's PR head
  follows the remote branch (`test-fixtures.mjs:403`, `headRefOid: tip(p.head)`).
- D-5 and the jira row: with `conflicts` omitted, `releaseConflict` sees a clean `git merge-tree` and, in `pr`
  mode, returns null. The code is `plugins/openspec/hooks/conduct-check.mjs:426-431`, and `PR_CONFIG` is `pr` at
  `change-loop-fixtures.mjs:50`. Item 5 then stays the blocked end `pr-problem`, exit 2. Probed: it passes.
- D-5 and the two-prs row: `releaseConflict` returns `paths`, `others` and `base` (`conduct-check.mjs:435-437`).
  The row's assertions (`['resolve-base-conflict', 'subagent']`, the implementer, `others: ['README.md']`,
  `base: 'main'`, state `ready to run: resolve-base-conflict`) pass in the probe. The invariant comment the row
  rewrites is at `conduct-check.test.mjs:624-627`.
- D-23: `post-merge-validate 3: the roadmap line names the merge check and the sibling that counts evidence
  attempts` is at `plugins/openspec/hooks/change-loop.test.mjs:2838`. It matches `/^- \[[ x]\] post-merge-validate/`,
  and 6373424 (train 10) is an ancestor of HEAD and not of c09860c. The revised D-15 row, 5.8 and the 5.9
  pattern all agree with that.
- D-15 counts: five rows of `conduct-check.test.mjs` (`design.md:948-950`, 952), one of `change-loop.test.mjs`
  (951) and one of `change-loop-remote.test.mjs` (953). That matches "five ... one ... one" in D-5 and "seven
  updated tests" in 2.5.

Informational: the 2.0 merge brought "A merge-defect fix follows the rule of every plan edit" to the main spec
(`grep -c` prints 1 on `openspec/specs/change-coordination/spec.md` and 0 on the change's delta). So 3.6a's
copy will apply at phase 3, as the plan already provides.

Finding (blocker B1; see section 9): the gate policy of D-17 (`design.md:1170-1173`) contradicts the new
`Gates:` rule.

## 5. Specs review
No findings. The deltas are unchanged by this revision, and strict validation passes.

## 6. Tasks review
The task changes of this revision are sound:
- 2.3 now brings T96 to its row.
- 2.4 names both new D-15 tests with their files.
- 2.5 adds the jira call as a separate part, so the earlier patterns do not filter that file.
- 5.8 and 5.9 match D-23.
- The tests D-15 now names cover every README-conflict fixture that passes through `conduct-check`'s override.
  I grepped the suite for `conflicts: [...README...]`, `twoPrsConflict` and `pr-problem`. The other hits
  (`project-loop.test.mjs:1201`, `delivery-train.test.mjs:611-618`, `delivery-models.test.mjs:531-544`) read
  `deliver-check` or the project loop directly, not the override. Gate 2.5's run shows no other failure.

Finding B1 applies here: every gate (`tasks.md:123`, `:193`, `:272`, `:336`, `:398`, `:457`) and the preamble
(`tasks.md:27-33`).

## 7. Omission detection
No new findings. A Low item on R7b's fake `gh` is in section 10.

## 8. Execution risks (top 5 failures)
1. Cause: the gates keep their filtered `node scripts/test-suite.mjs ... <files>` parts. Thirteen such parts in
   1.6 to 6.6 are not train parts (`deliver-check.mjs:526-527`), so each needs a `pass` row in `evidence.md` at
   a current commit. This change edits `docs/openspec-flow.md` (D-22's sentences, 6.2's CI pins), so a base
   merge that brings a pin stales its evidence. That is the case the `state-skips-unlocated` retro recorded.
   Impact: every re-boarding after a train leaves the change re-runs every gate part on the owner's machine.
   Prevention: B1.
2. Cause: R7b's fake `gh` reports a fixed PR head. Impact: after the fixture pushes the record, `next` keeps
   answering `push`, R7b's check fails, and 6.3 stops for a plan revision. Prevention: section 10, item 1.
3. Cause: `post-merge-validate` archives a sibling between phase 3 and the last merge. Impact: a main-spec
   scenario no longer holds. Prevention: as planned (3.6a now applies; 6.1's re-check, D-7).
4. Cause: `deliver-check.test.mjs` grows with phase 3's tests (120.9 s alone in part 1 of gate 2.5 today).
   Impact: it crosses CONTRIBUTING's 300 s. Prevention: as planned (D-16 split rule).
5. Cause: a sibling takes 0032 or 0033 before the last merge. Impact: stale links in the Notes of ADR 0011 and
   ADR 0023. Prevention: as planned (`renumber-adr`; T78 and T139 read the number through `decisions.md`).

## 9. Mandatory fixes before implementation
- [ ] B1. Severity Medium, Mandatory before implementation (of phases 2.5 to 6). The rule is
  `openspec/config.yaml:42`: "A phase gate the delivery train runs names the train's command
  (`node scripts/test-suite.mjs`, `python3 scripts/check.py`); a gate naming one test file needs a passing local
  row after every base merge, so a plan uses one only when that file must pass before the train."

  The plan does the opposite. Its preamble says "No gate and no task runs the whole suite or a near-whole list
  of files" (`tasks.md:31`), and D-17 says the same (`design.md:1170-1173`). Every gate names filtered test
  files: `tasks.md:123` (1.6), `:193` (2.5), `:272` (3.9), `:336` (4.7), `:398` (5.9) and `:457` (6.6).

  No artifact claims the rule's exception (that a named file must pass before the train). The train is on in
  this repository (`openspec/config.yaml:30`), and it runs every one of those tests. Only the `python3
  scripts/check.py` parts are train parts today.

  Why it matters: thirteen gate parts need local `pass` rows at a current commit. This change owns lines of
  `docs/openspec-flow.md` (D-22, 6.2's pins), so its evidence goes stale on base merges, and every re-boarding
  re-runs them all.

  Smallest correction, the author's choice of one:
  - (a) Follow the rule.
    - Each gate names `node scripts/test-suite.mjs && python3 scripts/check.py` plus its non-test parts
      (`gen-agents.mjs --check`, `gen-catalog.py --check`, `command claude plugin validate .`, `test -s ...`,
      `grep -q ...`).
    - Each phase's filtered command moves to the Check of the phase's last task, so it is still run before the
      gate is ticked.
    - The preamble and D-17 say that the implementer does not run the train's part (the train proves it and
      `pr-verifier` writes its `train:` row).
  - (b) Invoke the exception explicitly. The preamble and D-17 name, per gate, the files that must pass before
    the train and why. They accept that `pr-verifier` records a `pass` row for each filtered part after every
    base merge, or one whole-suite run standing for them, as `pr-verifier.md:38` allows.

  Either way, the already-ticked gate 1.6 keeps its tick. Under (a), its command text changes. Under (b), it is
  named in the exception.

## 10. Optional improvements (within scope)
- [ ] Low, Fix during implementation: R7b (`design.md:850`) uses a "fake `gh`", and its check now needs
  `fix-resolution` after "the fixture script commits and pushes the record". That holds only if the fake reports
  the pushed branch tip as the PR head, as the suite's simulator does (`test-fixtures.mjs:403`). Smallest
  correction: one clause in R7b, "the fake `gh` reports the remote branch's tip as each PR's head (the suite's
  `test-fixtures.mjs` simulator)".
- [ ] Low, Nice to have: `docs/adr/0033-a-changes-own-settings-live-in-an-x-devkit-block.md:53` still says
  ADR 0023's "`## Decision` section untouched", while D-22 appends the Note inside it. Carried from attempt 7.
- [ ] Low, Nice to have: `proposal.md` is 2,483 words, against `rules.proposal`'s "Keep it under two pages".
  Carried.
- [ ] Low, Nice to have: `decisions.md` says 0033 "was the next free number across the remote branches". Not
  checked (no fetch); `renumber-adr` handles a clash. Carried.

## 11. Explicitly out of scope
- [ ] The other open plans in `openspec/changes/` (`fresh-base-check`, `stage-ceiling-consecutive`,
  `archive-release-pin`) also use filtered gates. They are not this package.
- [ ] Everything attempt 7 listed (a revised plan in `ship-change` without the loop, `decisions.md` and
  `mockup.md` outside the digest, the roadmap coordinator's third round, `fresh-base-check`'s half of item 21,
  the desktop app's monitor wake-up, the CompozyOS driver's red-gate question, `resolve-base-conflict` with the
  train).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes. The three gaps are named and each is reproduced by a red test at
   HEAD.
2. Is the result measurable? Yes. T96 and the two D-15 rows have exact assertions, and each passes in the probe.
3. Are error behaviors defined? Yes. They are unchanged since attempt 7.
4. Are edge cases covered? Yes for the revision: both deadlocks (`push` then `fix-resolution` on the
   resolution's, `fix-review` on the code review's), and a stale GitHub conflict in `pr` mode.
5. Are dependencies clear? Yes. The 2.0 merge is recorded, and 6373424 is in the branch.
6. Are contracts defined? Yes. The `push` hand-off and its reason are named.
7. Can two developers interpret this differently? On the gates, yes. The plan and the project rule disagree on
   what a gate names (B1).
8. Are any decisions implicit instead of written? The reliance on the `Gates:` rule's exception is implicit (B1).
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late if implementation starts now? At verify and on each re-boarding: the cost of
    thirteen local gate rows on an evidence file that base merges stale (B1).

## 13. Final conclusion
- Can we start? Not on gate 2.5 as written. Revise the gates first (B1); everything else in this revision is
  ready.
- What must be fixed? B1: make the gates follow `openspec/config.yaml`'s `Gates:` rule, or state the exception
  per gate.
- Main risk if ignored? Each re-boarding re-runs every filtered gate part locally to refresh stale evidence,
  which is the cost the rule was written to prevent.
