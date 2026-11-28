<!-- devkit-stage evidence result=passed attempt=1 commit=27a660357e6fb9bb5e78fdd27c574663f95ff564 -->
Commit: 27a660357e6fb9bb5e78fdd27c574663f95ff564

# Evidence: state-listing-speed

## Verification

The gate run was done by the conducting session at 4722bda (the last merge of the base); the commits
after it change only `openspec/changes/state-listing-speed/` (`proof/gate-2.txt`, `tasks.md`). The
verifier did not re-run it (about 36 min on this loaded machine) and read the recorded file instead.

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.7 / 2.3 | `node scripts/test-suite.mjs --own-files` | pass: run with `--concurrency=2` at 4722bda, output in `openspec/changes/state-listing-speed/proof/gate-2.txt` (27 `selected` lines there, every file `pass`, none `FAIL` or `LEFT`); `suite: 27 files, 2812 tests, 2812 pass, 0 fail, 2143.6s, concurrency 2`; load about 11 before and 6.5 after, no other suite of this session running |
| 1.7 / 2.3 | `python3 scripts/check.py` | train: proven by the train record (the train's command `node scripts/test-suite.mjs && python3 scripts/check.py` has this part; the conducting session's run also printed `all checks passed` in `proof/gate-2.txt`) |

Single file re-run by the verifier at this commit, load 4.9:
`node --test plugins/openspec/hooks/change-state-listing.test.mjs`: 18 tests, 18 pass, 0 fail, 45.0 s.

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | `listing-reads-in-parallel` | Test `state-listing-speed AC-1 the reads of the listing overlap` (stand-in `openspec` recording start and end) passed in the verifier's run of `change-state-listing.test.mjs` and in `proof/gate-2.txt`. | pass |
| AC-2 | `listing-output-unchanged` | Tests `AC-2 the listing is byte-identical to the sequential read` (with and without `--offline`) and `AC-2 each entry is the one state --change prints` passed. Real run: `cmp` of base and branch output over 11 entries printed nothing (`proof/listing-11.txt`). | pass |
| AC-3 | `listing-concurrency-bound` | Tests `AC-3 the pool never runs more than its limit` (limit 2, limits 0 and 1, bound is machine cores and at least one) and `AC-3 the pool stops starting after a stop` passed. | pass |
| AC-4 | `listing-failures-unchanged` | Tests `AC-4 an unreadable change is listed blocked`, `a read that fails the command fails the listing`, `a child that fails in a checkout of its own fails the listing as one after another` and `a child that dies is a usage failure` passed. The `no change named <id>` case runs in `change-loop.test.mjs` in the gate. | pass |
| AC-5 | `eleven-changes-under-ten-seconds` | `proof/listing-11.txt`: scratch clone with 11 changes in play, `state --offline --lang en`; branch pack 9.58 s (exit 0), base pack 28.90 s, load 10.58 before and 11.30 after; 11 entries in both listings; clone and copies removed. The run was at about load 11 with other sessions' suites running (none from this session); the time is under 10 s as AC-5 requires. | pass |
| AC-6 | `single-change-and-next-unchanged` | Tests `AC-6 a listing of one change or none starts no read process` and `AC-6 in-process state stays synchronous` passed; `change-state-stages.test.mjs`, `change-loop.test.mjs` and `status-line.test.mjs` are `pass` in `proof/gate-2.txt` with no test edited to fit. | pass |

Not run by the verifier: the task 2.2 checks (`gen-catalog --check`, `gen-agents --check`, `claude plugin validate .`, `openspec validate --strict`, the release-file diff); `tasks.md` ticks them.
No defect found.
