<!-- devkit-stage readiness result=passed attempt=2 commit=2300f84524e5c1ec5ed8a0da41e5a5dccff9cc34 -->
# Readiness review: project-phases

Round 2. This round checks that the three blockers of round 1 (B-1, B-2, B-3) and the three Low points are fixed, and that the fixes did not break the rest. Artifacts read: `proposal.md`, `design.md`, `tasks.md`, `requirements.md` and the six spec deltas, at `2300f84`. Gates that exist on the base were run here once: `openspec validate project-phases --strict` (valid), `python3 scripts/check.py` (all checks passed), `python3 scripts/gen-catalog.py --check` (exit 0). The whole hook suite (about 13 minutes, gate 6.8) was not run; round 1 ran the existing-test part of gate 1.5 (91 pass, 0 fail) and no code changed since.

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes

No open blocker.

## 2. Scope validation
Classification: correct. No finding.

## 3. Proposal review
No finding. The old-pin point of round 1 is now stated in the design and the CHANGELOG entry (see section 10).

## 4. Design review
Re-derived against live code this round:
- `plugins/openspec/hooks/change-loop.test.mjs:2473-2476` asserts the `v0.18.1` pin and the absence of older pins. `design.md` D-20 now lists it as T-8 (`design.md:772`), with the new invariant, the layer and the suite.
- The write location: `design.md:252-254` ("Where the session writes") makes `root` the absolute path of the slice's worktree and every path of `detail` absolute under it; the S4 row (`design.md:267`) and the D-14 `phase` and `rounds` bullets (`:518-525`) repeat it.
- The round 1 code anchors were not touched by the revision (no product file changed).

## 5. Specs review
The rows of D-6 that had no scenario now have one in `specs/project-definition/spec.md`: a slice not found (`:229`), a half-made folder (`:233`), no progress (`:237`), a stage at its limit (`:241`), a conflicting pull request (`:245`), a pull request closed unmerged (`:249`), a branch ahead of its pull request (`:202`), behind its base (`:206`), waiting on GitHub (`:210`), a failing check (`:214`), no name and no unfinished slice (`:60`), a name already delivered (`:30`), and the writes landing in the worktree (`:105`). Format and normative language are sound. No finding.

## 6. Tasks review
Ordered, test first, one gate per phase. Task 3.1 now asserts that every path of `detail` is absolute and starts with `root` (`tasks.md:132-134`). Tasks 6.3 and 6.5 name T-8 as a changed-first test (`tasks.md:223-236`). No finding.

## 7. Omission detection
Validation, errors, idempotency, permissions, rollback, migration, rollout gating and test strategy are covered; no new gap.

## 8. Execution risks (top 5 failures)
1. A phase file written at a relative path would land in the root checkout. Prevention is now in D-6 and tested in 3.1.
2. Gate 6.5 or 6.8 going red on the pin test: handled by T-8.
3. A blocked or waiting end worded differently by two developers: each now has a scenario.
4. An existing project merging a slice in `merge` mode on its old CI pin: the CHANGELOG entry says to move the pin before setting `ship: devkit-project: merge` (`design.md:708`, `:823`).
5. `review.md` staleness from an uncommitted file under `docs/design/<slice>/`: covered by the commit-by-name step and its test; keep it.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [x] Low (round 1) — ADR 0010 amendment wording: `design.md:596` now lists ADR 0010 under `Amends:`.
- [x] Low (round 1) — flow-style `ship: { devkit: merge }`: handled in `design.md:571-572`.
- [x] Low (round 1) — CI pin sentence: present in the CHANGELOG and openspec-setup text.

## 11. Explicitly out of scope
- [ ] A run lock for `/devkit project` (D-12): decided and recorded.
- [ ] The dogfood slice and the real GitHub auto-merge run: a next change, stated in the proof map.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes, nine ACs, each with a test or a recorded live check.
3. Are error behaviors defined? Yes, every blocked and waiting end has a scenario.
4. Are edge cases covered? Yes.
5. Are dependencies clear? Yes.
6. Are contracts defined? Yes, including the checkout of the session's writes.
7. Can two developers interpret this differently? No material point left.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes.
10. What will be discovered too late? Only what the owner-run live checks can show; the plan states their limits.

## 13. Final conclusion
- Can we start? Yes.
- What must be fixed? Nothing.
- Main risk if ignored? Not applicable; keep the whole suite (gate 6.8) for the end of the change.
