<!-- devkit-stage readiness result=passed attempt=7 commit=cc32e6bff36b2dbb7239dff8bd666cc10c7c7843 -->
# Readiness review: remote-worker

## 1. Decision
- Status: APPROVED
- Confidence: high
- Ready to implement: yes. The three blockers of round 6 are fixed and each fix checks out when run; no new finding is mandatory.

Round 7. Rounds 1 to 6 stand. This round judges the plan at HEAD `cc32e6b` (the plan commit on top of the fourth merge `c9f08f0`, `origin/main` `fc01230`). `git fetch` shows `origin/main` still at `fc01230`, so the release numbers (devkit-openspec 0.32.0, marketplace 0.36.0, tag `v0.32.0`) and ADR 0020 are current: main's marketplace is 0.35.1, and its only change since `37a7063` outside archive files is devkit-core 0.13.2 and `review-round` in the core pack.

## 2. Scope validation
Classification: correct. The revision after `fc01230` only edits verification text (counts, diff anchors, the tag step, wording). No capability, acceptance criterion or Non-Goal changed.

## 3. Proposal review
No findings. Only the stage header changed since `c9f08f0`.

## 4. Design review
Re-derived from the files and by running tests.

- **ADR 0020 acceptance paragraph (F-4)** (`design.md:688-698`) says the ADR's text changed only in its number since the approval recorded at `7b21aad`. True: `git diff -M 7b21aad HEAD -- docs/adr/` shows the rename `0019-...` to `0020-...` at 99% similarity, and the one changed line of the file is its title (`# ADR 0019:` to `# ADR 0020:`). ADR 0013, 0014 and 0017 only change their links from 0019 to 0020. The ADR 0019 added there is main's own (release-tags).
- **Release merge wording (F-3)**: `git grep -n "release rebase"` in the change folder and `docs` finds nothing.
- **D-1 step 4 order** still matches the code: `change-loop.mjs:1899` `writeClaimKeys`, `:1900` `recordPin`, `:1902` `claimOnOrigin` (commit and push only). Unchanged since round 6.
- **Fourth merge** (`37a7063` to `fc01230`): 36 files, 278 insertions, 7 deletions, all of them archive moves, `openspec/specs/**` (change-version-pin's deltas), `roadmap.md`, devkit-core 0.13.2 and `review-round.*` in the core pack. No test of `plugins/openspec/hooks` changed, so D-14's accounting of main's tests holds. `openspec validate --strict` accepts the deltas against the updated `openspec/specs`.
- **ADR 0019** (main's) is not edited by this change, and the follow-up's description of it (`tag-release` answered because `openspec/config.yaml` names the release file) matches round 6's reading of `config.yaml:24` and `CONTRIBUTING.md:62` (F-2).

## 5. Specs review
No findings. The three deltas are unchanged. `openspec validate remote-worker --strict`: "Change 'remote-worker' is valid".

## 6. Tasks review
The three blockers of round 6, each run now:

- **5.8 `^remote` count**: the task says 41 (20 in `change-loop.test.mjs`, 21 in `roadmap-loop.test.mjs`). `grep -c "^test('remote "` gives 20 and 21. `^remote` ran 41 tests, 41 passing. Fixed.
- **5.8 T-14 diff**: `git diff fc01230 -- plugins/openspec/hooks/delivery-models.test.mjs` is 2 insertions and 1 deletion: the removed `rev-parse HEAD` assertion and the two assertions T-14 gives (`HEAD^` and `merge-base --is-ancestor`). Exactly what the task says. `^delivery-models open` ran 10 tests, 10 passing. Fixed.
- **5.7 existing-test rule**: `git diff fc01230 -- change-loop.test.mjs roadmap-loop.test.mjs`, removed lines only: `SAMPLE`, T-1's `rev-parse HEAD` assertion, the import line, `BLOCKED_PARAMS`, the `waits` filter, the `userConfig` assertion, `putRun`, and the T-11, T-12 and T-13 lines. This is the list the task gives, and no other existing line is removed. The 5.7 check ran 7 tests, 7 passing. Fixed.

Other checks the tasks name:

- 5.8, `version-pin`: 66 tests, 66 passing. `git diff 37a7063 -- version-pin.test.mjs` prints nothing. The task keeps `37a7063` as that anchor while the others use `fc01230`; both are right, because main's `37a7063` to `fc01230` range touches no test file of this pack (see optional improvement F-5).
- 5.8, order of D-1 step 4 and T-19: both are in the tree (`change-loop.mjs:1899-1902`; `change-loop.test.mjs:3642,3648` read `/x-devkit-(machine|places)/`). The task is unticked though its work is in the tree; ticking it is the implementer's step, after the checks above.
- 5.9: ran its check, 3 tests, 3 passing; `git diff ccb3dfb -- docs/adr/0017-...md` shows only added lines; the original `Amends: ADR 0014` line is at `:7`.
- 5.3: its three `git grep` checks find nothing; the `change-loop docs: the design records` test ran 1 of 1 passing.
- 5.5: `claude plugin validate .` ran now and printed "Validation passed" (output not written to the task's path). The file at `/var/tmp/devkit-validate-remote-worker/phase-5.txt` is from 2026-11-23 11:57, older than `c9f08f0` (17:13), so it does not satisfy 5.5's "newer than `c9f08f0`" check. The task already says 5.5, 5.6 and 5.10 are run again at the final commit and a run ticked before it does not count (F-1). That is the implementer's step, not a plan gap.
- `python3 scripts/check.py` and `python3 scripts/gen-catalog.py --check` exit 0.
- The ACs-to-tasks table still maps every AC to existing tasks.

Not run: the phase gates 1.4, 2.4, 3.6 and 4.6 (ticked, from earlier rounds, no test file of the pack changed since) and gate 5.10, the whole suite (13 to 21 minutes). The groups I ran cover what the three blockers and the four suggestions touch; gate 5.10 is the implementer's last gate.

## 7. Omission detection
No findings. The tag step is now one owner (the loop's `tag-release`, with a by-hand fallback that names the R2 stop); the renumbering rule for a further move of `origin/main` is written (`tasks.md:343-346`, `design.md` D-15).

## 8. Execution risks (top 5 failures)
1. Cause: `origin/main` moves again before the merge. Impact: a fifth renumbering of the release, the tag and the ADR. Prevention: D-15 and the follow-up re-check every number at delivery; T-10 reads the manifest, so a stale CI pin is red.
2. Cause: 5.5, 5.6 or 5.10 left as run before the final commit. Impact: the flow binds evidence to a commit and asks again, or a stale `phase-5.txt` lets 5.10's `grep -q` pass. Prevention: the task says to re-run all three at the commit that holds task 5.8; the implementer writes `phase-5.txt` fresh first.
3. Cause: the whole suite at the final commit finds a failure not in D-14. Impact: a stop for a plan revision. Prevention: every group tied to main's tests passes here (`^remote` 41, `version-pin` 66, `^delivery-models open` 10, and the 5.7, 5.9 and docs checks); 5.10 is the last gate.
4. Cause: the owner's approval hash (`approval.md`, `sha256:e931a77b15e4`) binds the readiness of an earlier round. Impact: the approval is stale and the owner approves again. Prevention: expected; the revision changed the plan's text, so approval is the owner's gate, not a gap.
5. Cause: the tag pushed by hand at another commit while the loop also pushes it. Impact: a stop at the loop's R2 row. Prevention: the follow-up says the loop pushes it and the by-hand commands apply only if it does not.

## 9. Mandatory fixes before implementation
None.

## 10. Optional improvements (within scope)
- [ ] F-5 (Low, Nice to have): `tasks.md:305-306` anchors the `version-pin` diff on `37a7063` while 5.7 and 5.8's other diffs use `fc01230`. Both give an empty diff for that file, so nothing breaks; use `fc01230` the next time the file is written, so one anchor reads through.
- [ ] F-6 (Low, Nice to have): the stage headers of `proposal.md`, `design.md` and `tasks.md` carry main's commit `fc01230` where other stages carry the plan's own HEAD; the planner's header refresh sets them when the files are next written.

## 11. Explicitly out of scope
- [ ] The claim of a `/devkit project` slice (Non-Goals).
- [ ] The live check on two machines (L-1 to L-4), by the owner's decision of 2026-11-23.
- [ ] Refreshing `evidence.md`, which follows approval.

## 12. Mandatory review questions
1. Is the problem objectively defined? Yes.
2. Is the result measurable? Yes: the Proof map's named tests, T-14 to T-19, the counts of 5.7 and 5.8 (now run and matching) and gate 5.10.
3. Are error behaviors defined? Yes, in D-1 to D-12 and the deltas; unchanged.
4. Are edge cases covered? Yes (a malformed flow file after the claim keys, a no-origin open with a pin, a silent machine, a wake too early).
5. Are dependencies clear? Yes: the order of phases, the merge anchors, and the re-run of 5.5, 5.6 and 5.10 at the final commit.
6. Are contracts defined? Yes, in D-1 to D-16 and the deltas.
7. Can two developers interpret this differently? Not in the places that blocked before: the counts and anchors of 5.7 and 5.8 now agree with the tree.
8. Are any decisions implicit instead of written? No.
9. Do the tasks fully deliver the intended outcome? Yes, once 5.8 and 5.10 run at the final commit.
10. What will be discovered too late if implementation starts now? Only what the whole suite finds at 5.10 (not run here); nothing indicates a failure.

## 13. Final conclusion
- Can we start? Yes. Every check of tasks 5.7 and 5.8 that can run without editing the tree passes as written.
- What must be fixed? Nothing before implementation; F-5 and F-6 are wording.
- Main risk if ignored? A further move of `origin/main` before the merge, which D-15 already handles by renumbering.
