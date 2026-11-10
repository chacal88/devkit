# Readiness review: conduct-sessions

## 1. Decision
- Status: NEEDS-REVISION
- Confidence: high
- Ready to implement: no

Third round. The three fixes of the previous round (under way, `limit: 100`, fixed 4-character name rule) are present in the edited artifacts, and M1-M8 of round 1 still hold. The edits introduced two narrow gaps (N1, N2). Both fit inside the approved scope; no owner decision in requirements.md is impossible given the code. `openspec validate conduct-sessions --strict`: valid, 0 errors (INFO only: skip_specs). `rules.tasks` met (one `## N.` group per phase ending in a gate; every AC id appears in a task). `rules.readiness` respected (only this reviewer writes the file).

## 2. Scope validation
Classification: correct. Problem, scope and owner decisions are explicit (requirements.md, "Decided with the owner"). Proposal AC-1 and requirements AC-1 agree, and both agree with design D3.

## 3. Proposal review
Consistent with requirements and design: AC list identical, Impact lists the harness, `description` and ADR test. No findings.

## 4. Design review
Previous mandatory fixes, checked against the edited artifacts:

- Fix 1 (under way, D13): fixed. design.md:288-298 defines "under way" from the recompute (at least one ticked task in `tasks.md`, or in `devkit` an `approval.md` recording the current readiness; a `devkit-lite` change with no ticked task is not under way) and says it never reads the app's list. requirements.md:88-92, proposal.md:28 and tasks.md 2.1 agree. One leftover: N1.
- Fix 2 (`limit: 100`, D6): fixed in design.md:121-123, requirements.md:96 and tasks.md 2.1 (and its pin test). I called `list_sessions({linked: true, limit: 100})` in this repository: the tool accepted it and returned rows with no error, so the value is usable.
- Fix 3 (fixed 4-character rule, D3): fixed. design.md:66-77 reserves `-p` plus two digits, cuts the id to 20 characters (trailing `-` removed) for every phase, uses `<id18><hh>-p<n>` on a collision with the SHA-1 of the full id for both changes, and puts phases above 99 out of scope; 20+4 = 24 and 18+2+4 = 24 both fit the tool's `[a-z0-9-]`, 24-character `name`. The prefix is now identical for phases 9 and 10. The Risks line (design.md:319) no longer says "20-character prefix". One leftover: N2.
- Round 1 items: M1 (`stateOf` has no `session` case today, `conduct-check.mjs:81-85`; D2 and 1.1 add it), M2 (`DEVKIT_HOST: 'cli'` pinned in the harness, 1.1), M3, M4 (D13), M6 (`guard.mjs:235` returns null without a `readiness` artifact; AC-4 and 2.4 scope the refusal to `devkit`), M7 (docs and README rows assigned to 1.4, 2.3, 2.5, 3.2) and M8 (D9's one report rule) are unchanged by the edits and still hold. Every test the tasks name (the wake tests, the version tests, the four `guard.test.mjs` skill-text tests, the ADR 0005 test, the worktree test at `guard.test.mjs:936`) was found under that name in the previous round and the edits touched none of them.
- App tool facts: `list_sessions` rows carry `sessionId`, `title`, `cwd`, `isArchived`, `isRunning`, `lastActivityAt`, `group`, `link`, `remoteControlActive`, and linked children `name` and `startedBy`; no `state` field; archived rows are omitted unless `include_archived`. D6 uses only these.

New gaps:

- N1. tasks.md:20 (task 2.3) still tells the implementer to write that a continuation turn "may start the next session of a change that already had one". That is the phrase round 2 flagged as undefined; D13 and task 2.1 replaced it with "under way". Task 2.3 also drives the rewritten pin test of the kinds-of-turn paragraph, so the skill text and its test could use the old wording and contradict D13 (the child is archived before the next recompute, so "had one" cannot be answered from the app).
- N2. design.md:125-127 and tasks.md 2.1 match a child to its change by `name` "starts with" `sessionPrefix`. Prefixes are not prefix-free across changes: `add-x` has prefix `add-x-p`, and the child `add-x-pagination-p1` of another change starts with it. The wrongly matched change is marked `running` and kept out of `dispatch` for as long as the other child runs (and `add-x`'s archive step in D9 matches by exact `session.name`, so only busy detection is affected). The collision rule covers equal cut ids only. Two developers would match differently (startsWith, or prefix plus digits).

## 5. Specs review
No specs by design (D1, `skip_specs: true`, archived precedents). Behavior is pinned by the listed tests; acceptable.

## 6. Tasks review
Ordered by phase, each task has a verify, each AC has a task: AC-1 1.1, 1.2; AC-2 1.3; AC-3, AC-5, AC-6, AC-7 2.1; AC-8 2.2, 2.3; AC-9 2.3; AC-4 2.4; AC-10 2.5, 3.1-3.3; AC-11 3.4, 3.9 and the dogfood bullets (plain bullets by precedent; the `parseTasks` note is correct). Findings: N1 (task 2.3 wording), N2 (task 1.2 and 2.1 need the match rule).

## 7. Omission detection
- Error handling: start refusal (D5), archive, move, bind refusal (D9): covered.
- Permissions: kinds of turn (D13): covered.
- Idempotency: idle same-name child, list truncation: covered.
- Rollback (install 0.8.0), compatibility (`cli` unchanged), observability (report lines): covered.
- Test strategy: skill-text pins plus the dogfood; acceptable as stated. Not covered: the match rule between a child name and a prefix (N2).

## 8. Execution risks (top 5 failures)
1. Cause: startsWith on `sessionPrefix` (N2). Impact: an unrelated change is held `running` while a sibling change's child works. Prevention: M2 below.
2. Cause: 2.3 says "already had one" (N1). Impact: pin test and skill text drift from D13; chain may stop or start on the wrong turn. Prevention: M1 below.
3. Cause: `archive_session` cleans up worktrees by default. Impact: the change's worktree disappears. Prevention: D9's dogfood check and fallback (already in the plan).
4. Cause: the app asks the owner to approve every move and archive. Impact: the run waits on prompts. Prevention: D9's report rule and notice (already in the plan).
5. Cause: a change joins the round later and a new prefix collision renames another change's prefix. Impact: its running child is not recognized for one run. Prevention: low risk, accepted (the roadmap round is fixed during a run).

## 9. Mandatory fixes before implementation
- [ ] Medium — tasks.md:20 (task 2.3) — still says "a change that already had one", which D13 replaced by "under way" and which cannot be answered once the child is archived — smallest correction: replace it with "a change under way (a ticked task in `tasks.md`, or in `devkit` an `approval.md` recording the current readiness; design D13)" so the pinned sentence matches 2.1 and D13.
- [ ] Medium — design.md:125-127 (D6) and tasks.md 2.1 (and 1.2's tests) — `startsWith(sessionPrefix)` matches another change's child when one id extends another (`add-x` vs `add-x-pagination`) — smallest correction: say a row belongs to a change when its `name` equals `sessionPrefix` followed only by digits (`^<prefix>[0-9]+$`), pin that phrase in the 2.1 test, and add to the 1.2 name tests a case of two ids where one extends the other with distinct prefixes.

## 10. Optional improvements (within scope)
- [ ] Say in 2.1 that the first-run double recompute (D6) is skipped when `list_sessions` returns no running row.

## 11. Explicitly out of scope
- [ ] The orquestrador panel, the Workflow-based review, any per-project flow file (requirements.md, owner's decisions).

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, by AC-1 to AC-11 and the tests named in the tasks.
3. Are error behaviors defined? Yes (D5, D6, D9).
4. Are edge cases covered? Yes, except the prefix-extension case (N2).
5. Are dependencies clear? Yes (phase 1, then 2, then 3).
6. Are contracts defined? Yes: the `session` descriptor and `sessionPrefix`, except the match rule (N2).
7. Can two developers interpret this differently? Yes on N1 and N2.
8. Are any decisions implicit instead of written? N1 (stale wording), N2 (match rule).
9. Do the tasks fully deliver the intended outcome? Yes once the two fixes are folded in.
10. What will be discovered too late? That a change is held `running` by another change's child (N2).

## 13. Final conclusion
- Can we start? Not yet.
- What must be fixed? The two items of section 9, both one-line edits.
- Main risk if ignored? A pinned skill sentence that contradicts D13 (N1) and a change wrongly held running (N2).
