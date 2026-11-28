<!-- devkit-stage evidence result=passed attempt=2 commit=d47c7b291b04827fd0b662f20a5b961b38f37130 -->
Commit: d47c7b291b04827fd0b662f20a5b961b38f37130

# Evidence: state-listing-speed

## Verification

The gate run was done by the conducting session at d47c7b2 (the head, after the last merge of the base
and the review-fix tests of 0e3bb9f); its output is `openspec/changes/state-listing-speed/proof/gate-3.txt`
(head line 1 names d47c7b2). The verifier did not re-run it and read the recorded file. The verifier ran
`node --test plugins/openspec/hooks/change-state-listing.test.mjs` itself at d47c7b2: 29 tests, 29 pass,
0 fail (load average 8.4 at the start).

### Gates

| Gate | Command | Result |
| --- | --- | --- |
| 1.7 / 2.3 | `node scripts/test-suite.mjs --own-files` | pass: run with `--concurrency=2` at d47c7b2, output in `openspec/changes/state-listing-speed/proof/gate-3.txt`; 27 `selected` lines there (gen-agents.test.mjs, review-round.test.mjs, the change-loop*, change-state-listing, change-state-stages, compozy-driver, deliver-check-archive, delivery-*, guard, jira-task, project-loop, release-tags, roadmap-loop*, stage-models, status-line, test-suite, version-pin, changes-under-way and setup-block test files), every file `pass`, none `FAIL` or `LEFT`; `suite: 27 files, 2831 tests, 2831 pass, 0 fail, 1907.7s, concurrency 2`; loads before and after are in that file |
| 1.7 / 2.3 | `python3 scripts/check.py` | pass: run by the conducting session at d47c7b2 after the selective part, `all checks passed` in `openspec/changes/state-listing-speed/proof/gate-3.txt` |

### Acceptance criteria

| AC | Criterion | Proof | Result |
| --- | --- | --- | --- |
| AC-1 | listing reads run concurrently | `node --test plugins/openspec/hooks/change-state-listing.test.mjs`: test `state-listing-speed AC-1 the reads of the listing overlap` passes (stand-in `openspec` records start and end of each call) | pass |
| AC-2 | listing byte-identical to the sequential read | same run: `AC-2 the listing is byte-identical to the sequential read` (with and without `--offline`) and `AC-2 each entry is the one state --change prints` pass; also `cmp` of base and branch outputs printed nothing in `proof/listing-11.txt` | pass |
| AC-3 | no more reads at once than `os.availableParallelism()`, at least one | same run: `AC-3 the pool never runs more than its limit` (limit 2, limits 0 and 1, bound is the cores) and `AC-3 the pool stops starting after a stop` pass | pass |
| AC-4 | failures unchanged | same run: `AC-4 an unreadable change is listed blocked`, `a read that fails the command fails the listing`, `a child that fails in a checkout of its own...`, `a child that dies is a usage failure`, `a read that gives no entry fails the listing and names why` (9 sub-cases: spawn error, error beside a good answer, exit 2, empty output, non-JSON, other id, two entries, no entry, version other than 1) and `with two reads that fail the first in id order is the one named` pass | pass |
| AC-5 | 11 changes in play, `state --offline` under 10 s on the avel machine | `openspec/changes/state-listing-speed/proof/listing-11.txt`: 11 entries in both listings, branch run 9.58 s against 28.90 s for the base, load about 10.6 before and 11.3 after (other sessions' suites running, this session none), `cmp` printed nothing. Taken before the review fix; the listing code is unchanged since, per the conducting session. The margin is under 0.5 s with load above 10, so the human weighs it | pass |
| AC-6 | single-change and `next` unchanged | same run: `AC-6 a listing of one change or none starts no read process` and `AC-6 in-process state stays synchronous` pass; `change-state-stages`, `change-loop` and `status-line` test files were selected in the gate of `proof/gate-3.txt` and passed unedited | pass |
