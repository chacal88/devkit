Verdict: rejected
Commit: 1e2fc4d68248416c4d80c16d486cc246ea586604

## Coverage analysis — state-listing-speed (origin/main...HEAD)

### Findings
- [important] plugins/openspec/hooks/change-loop.mjs:3443 (entryOfRead) and stateListing join — [5] Spec scenario 'A read process that gives no entry' is only exercised for the signal case (stub reader, AC-4 'a child that dies'). Spawn error, exit code other than 0 or 3, and 'no single entry' (wrong id, two entries, bad JSON, version != 1) have no test. Loosening the entry check, such as dropping `out.changes[0]?.change === r.id` or `length === 1`, leaves the suite green. write in: plugins/openspec/hooks/change-state-listing.test.mjs, using the stub-reader pattern (`readOne: reader({b: {...}})`) with cases for error set, code 2, empty stdout, a different id, and two entries.
- [nit] plugins/openspec/hooks/change-state-listing.test.mjs:176-198 — No test makes the failure order observable with two failing ids at once (an exit-3 read at a later id against a no-entry read at an earlier id, or the reverse). The in-order walk in stateListing is only checked with one failing child.
- [nit] plugins/openspec/hooks/change-state-listing.test.mjs:125-150 — The 'one core' scenario is covered by the pool test with limit 1 and by the formula `listingBound() === max(1, availableParallelism())`, not by a mock of `availableParallelism` returning 0. This is acceptable, and the formula test is slightly implementation-coupled.
- [praise] change-state-listing.test.mjs AC-1/AC-2 — The real-process seam is protected: the overlap is read from a stand-in `openspec` log and bounded by the core count, `GIT_OPTIONAL_LOCKS=0` is asserted on every child start, and the listing's stdout and stderr are byte-compared with the in-process sequential read, both offline and with the fake gh.

In-scope surfaces: plugins/openspec/hooks (change-loop.mjs, state listing), scripts/test-map.json, the KEPT_HUB_READERS list in test-suite.test.mjs.
Blocking gaps (8-10 without a plan): 0
Seams checked (mutation runs: 0):
- Child spawn argv and env (`--change <id>`, `GIT_OPTIONAL_LOCKS=0`): caught by AC-1, which asserts the lock variable on each recorded start.
- Output equals the sequential read: caught by AC-2 (byte-identical, two modes) and AC-2 (each entry equals `state --change`).
- Concurrency bound and early stop: caught by the AC-3 pool tests (`boundedMap`, `stopWhen`).
- Failure join, exit 3 passthrough: caught by AC-4 (real child in a checkout with a bad `merge_method`, compared with the sequential run).
- Signal death to `could not be read: signal SIGKILL`: caught by the AC-4 'child that dies' test.
- Other no-entry cases: gap (F1).
- Listing of one change or none starts no child: caught by the AC-6 test.
- In-process `state` stays synchronous: caught by the AC-6 test.
- Map and hub entries: `test-map.json` and `KEPT_HUB_READERS` both list the new file.
