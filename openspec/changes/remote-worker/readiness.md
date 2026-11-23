<!-- devkit-stage readiness result=passed attempt=5 commit=de34e56d393f5926838fd644cae2d27192870b86 -->
# Readiness review: remote-worker

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes. Phases 1 to 4 and tasks 5.1 to 5.4 and 5.7 are in the tree and green; what is left is tasks 5.5, 5.6, 5.8, 5.9 and gate 5.10, and each can be built without a question.

Round 5. Rounds 1 to 4 stand. This round judges the revision that follows the two merges of `origin/main` (`ccb3dfb` at `212d007`, `39c6f93` at `aa7329a`), at HEAD `de34e56`. `origin/main` is still `aa7329a` (fetched now), so the release numbers are current.
`openspec validate remote-worker --strict` prints "Change 'remote-worker' is valid" (run now). The owner has not yet accepted the ADR 0017 amendment: that is the approval gate, not a gap in the plan (see section 4).

## 2. Scope validation
Classification: correct. The revision adds no capability. It does three things: it makes one existing test of main fit the claim commit (T-14), it repairs the `roadmap-coordination` delta so the archive does not drop main's scenarios, and it records an exception to ADR 0017 that the code already implements (the place wait is titled `⏳ <id>`). The Non-Goals and the 12 acceptance criteria are unchanged.

## 3. Proposal review
No findings. `proposal.md:51-52` and `:118` name ADR 0017 decision 4 beside ADR 0013 and ADR 0014. The release line (`:53`) says 0.30.0 and 0.34.0, which match the manifests.

## 4. Design review
Re-derived from the files and from running the tests, not from the plan's word:
- **T-14 is real and its fix works.** At HEAD, `delivery-models open` runs 10 tests and 1 fails: `a two-prs change starts from origin/<base>` (`delivery-models.test.mjs:191`, actual `7b123eb`, expected `9b18be1`). That is the red run task 5.8 describes. I applied the two assertions of D-14 T-14 (`HEAD^` equals `origin/main`; `merge-base --is-ancestor origin/main HEAD` exits 0) to a copy of the tree in the scratch folder, with no edit in the worktree. The test then passed. `spawnSync` is already imported (`delivery-models.test.mjs:8`). The invariant (branches from the remote's base tip) stays intact, because the claim commit is one commit on top of it.
- **T-15 is real and unaffected by task 5.9.** `change-state ADR 0017: the documents follow` is at `change-loop.test.mjs:5495`. Every assertion reads its own anchored line (`/^- Status: accepted$/m`, the exact `Amends:` line, `Accepted by:`) or a heading. None reads a new `- Amended by ADR 0019 (...)` line or a Note as the first Context paragraph. It is the only reader of ADR 0017 (`git grep 0017 -- '*.test.mjs'` shows only this test). The ADR 0014 header check (`slice(0, 8)` includes the 0017 line, `change-loop.test.mjs:5517`) holds: ADR 0014's lines 4 and 5 are 0017 and 0019.
- **T-10 needs no edit.** `change-loop docs: the design records the answers` passes at HEAD. It compares every CI pin with `plugin.json` (`pinMismatches`), and `docs/openspec-flow.md:640,651` pin `v0.30.0` while `plugin.json:3` holds `0.30.0`.
- **The code already agrees with the amendment.** `stageIcon` returns ⏳ for the `no-place` end (`change-loop.mjs:674`), and the state icon is dropped for that reason (`:755`). A test asserts `sessionTitle` is `⏳ mine` (`change-loop.test.mjs:3768`). D-9 (`design.md:431-437`), ADR 0019 decision 8 (`design.md:572-576`), the proposal and the spec delta (`specs/roadmap-coordination/spec.md:98,138-140`) all say the same thing, with no leftover "⛔ ⏳".
- **The ADR text to write is complete.** D-13 gives the `Amends:` line, decision 5's `(⏳, decision 8)`, decision 8, decision 9's list, ADR 0017's header line and Note, and the config line. ADR 0019 at HEAD is still in its pre-amendment form (`Amends:` has two ADRs, no 0017), as unticked task 5.9 says. ADR 0017 has no "Amended by" line yet, and the config ADRs line ends `amends 0013 and 0014`. Task 5.9 tells the implementer exactly what to change.
- **The release numbers match main.** `origin/main` has devkit-openspec 0.29.0, marketplace 0.33.0 and ADR 0018 as its last ADR. The tree has 0.30.0, 0.34.0 and ADR 0019. `python3 scripts/gen-catalog.py --check` and `python3 scripts/check.py` both exit 0 (run now). The `CHANGELOG.md` head is `## 0.34.0 — remote worker`.
- **Pending owner gate.** ADR 0019 stays `Status: proposed`, and `approval.md` is for the plan of attempt 4 (readiness hash `b3141912867e`). The revised plan, including the ADR 0017 amendment, needs a new approval. D-13 (`design.md:680-690`) says the session that records it sets the status. The owner's reading is not in "Open Questions" by name (see section 10).

## 5. Specs review
No findings. The `roadmap-coordination` MODIFIED requirement "A change session shows the stage its change is in" now matches the base spec's text and 9 scenarios exactly. I diffed it against `openspec/specs/roadmap-coordination/spec.md`. It differs only in the added `⏳ <id>` clause of the requirement text and the new 10th scenario "Waiting for a place" (`specs/roadmap-coordination/spec.md:138-140`). Archiving it therefore drops nothing. Every outcome of D-9's waiting end has a scenario (the two `change-coordination` ones, the title one, the stop-lock one).

## 6. Tasks review
- 5.5: unticked, to run at the merged commit. The current `phase-5.txt` is from 2026-11-22 20:22, before both merges, so the check cannot pass by accident. See finding F-1 on its "newer than" anchor.
- 5.6: runs now and prints that the change is valid, so the unticked task will pass.
- 5.7: ticked. I re-ran its check: 7 tests, 7 passing. Its `git diff aa7329a` rule is stated against the merged main.
- 5.8: executable as written. The red run (10 tests, 1 failing) reproduced here. Its green check and the `git diff 212d007 -- delivery-models.test.mjs` rule are consistent: that file did not change between `212d007` and `aa7329a`.
- 5.9: its check pattern runs 3 tests (`^change-state ADR 0017`, `^followups ADR 0014`, `^followups AC-3 run file`: one each, counted in the files). `git diff ccb3dfb -- docs/adr/0017-...md` is valid because the second merge did not touch ADR files. The `Amends: ADR 0014` grep finds the original line.
- 5.10: the whole suite at the merged HEAD. The suite has not run at `de34e56` (the last whole run, `evidence.md` attempt 3, was at `ccb3dfb`). The plan states this and puts the run last, which is the right place.
- The ACs-to-tasks table (`tasks.md:52-65`) maps every AC to tasks that exist, and AC-10 now includes 5.9.

Main's tests since `c561553` that touch `open`, the claim, a session title, a version pin or ADR text:
- **Accounted for in D-14:** T-14 (`delivery-models open`), T-10 (pins), T-15 (ADR 0017), plus T-1, T-4 and T-5 for the `open` tests of the base range.
- **Shown unaffected by D-14's own reading** (`design.md:781-791`): the `jira-entry`, `change-budget AC-8` and other `delivery-models open` tests assert the reply, the requirements text, a refusal before the claim or the main checkout's state, not the new branch's commits or its refs on `origin`. The tests that read commits build their branches with `addWt`, `worktree add` or `switch -c`. The `delivery-models open` group is the one I ran: 9 of its 10 pass at HEAD.
- **Not named in D-14, shown unaffected here:** the tests main added in `212d007..aa7329a` (`release-merge-conflict 1` to `16`, `change-loop docs` and the `conduct-check` changes). I ran the `^release-merge-conflict` group (16 tests), `^change-loop docs: the design`, `^change-state ADR 0017` and `^followups ADR 0014` at HEAD: all pass. A search of the diff of `conduct-check.test.mjs` and `release-merge.test.mjs` for `open`, claim, title, ADR and version words finds only the release-merge pin and version tests, which use their own fixtures. The two that read this change's files are `release-merge-conflict 15` (the pins of the flow doc, covered by T-10) and `16` (words the flow doc, the skill and the README must or must not hold). No task still to run edits those three files. D-14 does not say so (finding F-2).

## 7. Omission detection
No findings. Verification of the two new tasks is by tests (5.8, 5.9 and gate 5.10). The release step says what to re-check before the push and the auto-merge (`design.md:835-837`). The live part is the owner's decision of 2026-11-23 (L-1 to L-4, after the merge), unchanged from round 4.

## 8. Execution risks (top 5 failures)
1. Cause: `origin/main` moves again before the merge. Impact: a third renumbering of the release, the tag and ADR 0019 (a pin or ADR number that is not the merged one). Prevention: the Workflow follow-up and D-15 re-check every number at delivery, and T-10 reads the manifest, so a stale pin is red.
2. Cause: the owner declines the ADR 0017 amendment at approval. Impact: the code (`stageIcon`, `:755`) and the spec delta already implement `⏳ <id>` and would need a revision. Prevention: it is an approval question, and the Note only points to ADR 0019, so ADR 0017's text is untouched either way (D-13).
3. Cause: the whole suite at the merged HEAD finds a failure not in D-14. Impact: a stop for a plan revision. Prevention: only T-14 failed at `ccb3dfb`, and the second merge's test changes (release-merge, conduct-check) pass in the groups I ran; 5.10 is the last gate.
4. Cause: a push race against GitHub or an SSH fault that the local tests do not reach. Impact: a defect seen only live. Prevention: R-10 and L-1 to L-4, accepted by the owner in round 4.
5. Cause: ADR 0019's status is left `proposed` after approval. Impact: documents say proposed on a merged change. Prevention: D-13 says the session that records the approval sets `accepted` and `Accepted by:`; no phase task does.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] F-1 (Low, Fix during implementation): `tasks.md:227-228`, the check of 5.5, says the file is "newer than the merge commit `ccb3dfb`". The manifests at 0.30.0 and 0.34.0 come from the second merge, `39c6f93`, so a run between the two merges would pass the check while having validated 0.29.0/0.33.0. Smallest correction: "newer than the merge commit `39c6f93`" (or "newer than the last commit that touched the manifests"). The same text already says "at the merged commit", so an implementer who runs it at HEAD is right either way.
- [ ] F-2 (Low, Fix during implementation): `design.md:781-785` states the search of main's tests for `c561553..212d007` only. Add one sentence that `212d007..aa7329a` was read too, naming `release-merge-conflict 15` and `16` and the `conduct-check` and `release-merge` suites as passing at HEAD and untouched by the tasks still to run. This makes the "every test main added" claim hold in the file, not only in this report.
- [ ] F-3 (Low, Nice to have): `tasks.md:308` and `design.md:831` say "release rebase"; main's `aa7329a` renamed that step to `release-merge.mjs` and a merge. Use "release merge". The stage headers of `proposal.md`, `design.md`, `tasks.md` and the specs name commit `ccb3dfb`; the planner can refresh them when the files are next written.
- [ ] F-4 (Low, Nice to have): "Open Questions" (`design.md:1083-1087`) lists what the owner confirms at approval. It names ADR 0019 but not its amendment of ADR 0017. Add "its amendment of ADR 0017 decision 4" so the approval question is explicit.

## 11. Explicitly out of scope
- [ ] The claim of a `/devkit project` slice (Non-Goals; proposed as a roadmap line by the retro).
- [ ] The live check on two machines (L-1 to L-4), by the owner's decision of 2026-11-23.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: the Proof map's named tests, T-14 and T-15 for the revision, and gate 5.10; the live part by L-1 to L-4.
3. Are error behaviors defined? Yes, unchanged from round 4.
4. Are edge cases covered? Yes. For the revision: the claim commit on a two-prs base is covered by T-14; the added ADR lines by T-15.
5. Are dependencies clear? Yes. 5.5 and 5.6 at the merged commit, 5.8 and 5.9 independent of each other, 5.10 last.
6. Are contracts defined? Yes, in D-1 to D-16 and the three spec deltas; the title contract is in the requirement text and a scenario.
7. Can two developers interpret this differently? No material risk found. The edits of 5.8 and 5.9 are given as exact text.
8. Are any decisions implicit instead of written? No. The ADR 0017 amendment is written in D-9, D-13, the proposal and the spec, and is waiting for the owner.
9. Do the tasks fully deliver the intended outcome? Yes: after 5.8 the suite is expected to be green (T-14 was the only failure at `ccb3dfb`), and 5.9 puts the amendment on the documents.
10. What will be discovered too late if implementation starts now? A failure of the whole suite at `de34e56` that did not show at `ccb3dfb`; the groups I ran give no sign of one. A refusal of the ADR 0017 amendment at approval.

## 13. Final conclusion
- Can we start? Yes. The remaining tasks are exact and executable, and the plan's claims about main's tests and the code hold when re-derived.
- What must be fixed? Nothing before implementation. F-1 and F-2 are small corrections to make while doing 5.5 and 5.8.
- Main risk if ignored? A third renumbering if `origin/main` moves before the merge, and the owner's decision on the ADR 0017 amendment at plan approval.
