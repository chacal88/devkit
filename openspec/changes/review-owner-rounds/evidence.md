<!-- devkit-stage evidence result=passed attempt=2 commit=3480c8863468c15291a75651553bb31b50dbbd33 -->
Commit: 3480c8863468c15291a75651553bb31b50dbbd33

# Evidence: review-owner-rounds

## Verification

### Gates

The gate is task 3.7 (the same command as 1.9 and 2.4). `origin/main`'s `openspec/config.yaml` sets
`devkit.delivery.train` to `node scripts/test-suite.mjs && python3 scripts/check.py`; this change does
not edit that key. The working tree was clean at the commit above.

| Gate | Command | Result |
| --- | --- | --- |
| 3.7 | `node scripts/test-suite.mjs --own-files` | pass: run as `--own-files --concurrency=2` at the merge commit above (load 3.12 before, 4.19 after); 8 files selected, none left or failing: devkit-kit, review-round, deliver-check-archive, deliver-check, flow-check, guard, status-line, validate-type, each `pass`; `suite: 8 files, 1228 tests, 1228 pass, 0 fail, 366.6s, concurrency 2`; the `selected` lines, the `suite:` line and the uptime before and after are in `proof/gate-after-merge.log`. Selective part, not a whole-suite pass. |
| 3.7 | `python3 scripts/check.py` | pass: exit 0, `all checks passed` (`proof/check-after-merge.log`); the train also runs it |

The tree was clean at the commit above except the two new files under `proof/`. The earlier gate log
`proof/gate-3.7.log` was taken before the merge of `origin/main` (merge commit above) and is kept as
history.

### Acceptance criteria

The merge of `origin/main` (joining review-writer-text's `withoutSummary`/`summaryLine` with this change's owner command) did not change the owner path; the real runs RR1 to RR5 were taken before the merge and are kept. The joined-condition test added by the merge passes in the gate log above.

The real-run proofs are under `proof/`; `proof/checks.txt` lists rr1 to rr5 each `pass`. Note: RR1's
agent stages (reviewer, verifiers, writer) ran at attempt 2 of the plan; the attempt-3 re-run reused
their JSON and re-ran only the CLI commands (design D-8, attempt-3 note).

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | An authorized round above 2 appends a section with `(round N/<limit>)` and one line quoting the owner's words from `declared.json`, written by the script | Real run RR1 (round 3, scope review, on the `agents` path): `proof/rr1-declared.json` records the words; `proof/rr1-review.md` shows `Consensus: FAIL (round 3/3)` and one line `Owner's words for round 3: "` + backtick span of the recorded words. Also the `review-owner-rounds AC-1` tests of `review-round.test.mjs` in the gate log. | pass |
| AC-2 | Rounds 3 and 4 each quote their own words | RR2: `proof/rr2-review.md` has `Consensus: FAIL (round 3/3)` with the round-3 words and `Consensus: FAIL (round 4/4)` with the different round-4 words; `proof/rr2-declared.json`, `proof/rr2-owner.json`. | pass |
| AC-3 | A round above 2 with no words for that round and scope is refused with an error naming the authorization, writing no verdict and no section | RR3 (`proof/rr3-owner.txt`, `rr3-stage1.txt`, `rr3-stage1-other.txt`): each exits 3 with `review input invalid: round N needs the owner's authorization ...` (declared.json without words, or args.owner without words) or `args.owner.round must be 4`; the hashes of `review.md` and `reviews/` before and after are equal. | pass |
| AC-4 | Rounds 1 and 2 print what they print today; the existing tests stay green unchanged | RR4: `proof/rr4-round1.diff` and `proof/rr4-round2.diff` are empty (0 lines) against the base's output; `review-round.test.mjs` passes whole in the gate log (`pass 9.0s`). | pass |
| AC-5 | The same three rules hold for a resolution review in `resolution.md` (scope `resolution`) | RR5: `proof/rr5-resolution.md` shows `Consensus: FAIL (round 3/3)` and one `Owner's words for round 3` line quoting the resolution words; `proof/rr5-declared.json`, `proof/rr5-owner.json`; refusal path covered by the AC-5 tests in the gate log. | pass |

Outcome: verified.
