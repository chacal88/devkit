Verdict: rejected
Commit: 3826bb5ff032ff0421198609926b3d634f6a8f95

## Coverage analysis — suite-socket-path (74f2444..HEAD)

### Findings
- [important] scripts/test-suite.mjs:160-170 (tryRunRoot) vs test-suite.test.mjs AC-4 'fits by bytes' — [6] The byte-count test calls the exported runRootFits, but production decides in tryRunRoot with its own inline Buffer.byteLength + RUN_ROOT_NAME_BYTES > limit. Runtime never calls runRootFits; only the test helper runParent does. Changing tryRunRoot to use string .length, so a non-ASCII TMPDIR over 71 bytes is accepted and a socket bind fails with EINVAL, leaves every test green: the makeRunRoot tests use ASCII paths only. Write in: test-suite.test.mjs, one makeRunRoot test with a non-ASCII tmp folder whose byte length is over the limit and whose character count is under it (expect the short folder). Or make tryRunRoot call runRootFits so the byte test guards production.
- [important] scripts/test-suite.mjs:310 (main -> makeRunRoot) and test-suite.test.mjs — [5] The bind probe's run root always lands under /tmp (about 32 bytes), far from the 71-byte limit, so the limit constants never meet the real 104-byte sun_path boundary. The 'limit leaves room for a wider place' test restates the formula (71 + 3 + 29 = 103) and is a tautology. If SOCKET_TAIL_BYTES or SOCKET_PATH_MAX_BYTES were wrong by a few bytes, nothing would go red. Likewise, passing the chosen file count instead of all files, or dropping the limit argument, would stay green as long as the limit is 71. Write in: test-suite.test.mjs, one end-to-end run with a TMPDIR whose real path is exactly 51 bytes (run root 71) that binds the socket under the child TMPDIR. Run it as a node:test case in the same probe style as the bind test; it is meaningful on macOS.
- [nit] test-suite.test.mjs BIND_PROBE_BODY vs test-fixtures.mjs:607,622 — The probe hardcodes 'devkit-ch-xxxxxx/daemon.sock' instead of reading the fixture's real name. If fakeCompozy(...).daemon uses a longer folder prefix or socket name, SOCKET_TAIL_BYTES goes stale and no test notices. A fixture-derived assertion on the tail length would pin it.
- [nit] test-suite.test.mjs, test 'AC-3 ... exits 2 with the usage before any file runs' — Implementation-coupled: it swaps process.env.TMPDIR and monkey-patches process.stdout.write and process.stderr.write, and it relies on main returning 2 before its first await. A legitimate refactor that adds an await earlier would make the test leak output or fail. A child-process run with a short parameter is not possible, since main's third argument is not exposed on the CLI.
- [praise] test-suite.test.mjs makeRunRoot tests — Each fallback branch has its own test, the negative paths included, and each asserts that nothing was written to the folder that does not fit.

## Coverage analysis — suite-socket-path (74f2444..HEAD)

In-scope surfaces: `scripts/test-suite.mjs` (run-root choice), `plugins/openspec/hooks/test-suite.test.mjs` (node:test, probe trees). The docs and version bumps carry no behavior.

Blocking gaps (8-10 without a plan): 0

Seams checked (mutation runs: 0):
- Run root under a long TMPDIR goes to the real /tmp, and a child can bind `<TMPDIR>/devkit-ch-xxxxxx/daemon.sock`: caught by the AC-4 `a child binds` test (`bound === true`, the TMPDIR is at most `runRootLimit` bytes, the root is under `realpathSync('/tmp')`, and the root is removed).
- The "fits exactly" and "one byte over" decision in `tryRunRoot`: caught by the `fits exactly` and `one byte over` tests, with ASCII paths only (see F1).
- The `run root:` line, with where and why: caught by the `one byte over` and `cannot be used: ENOTDIR` tests.
- Both folders unusable gives exit 2 with the usage and nothing written: caught by the `main(..., short)` test, which asserts the stderr text, no `start ` in stdout, and an empty `base`.
- A file that leaves something under the short root still fails the run, and the root is removed: caught by the `leaver` test.
- `main` passing `runRootLimit(files.length)` and `tmpdir()` into `makeRunRoot`: caught only partly, by the bind and exit-2 tests (see F2).
- `SOCKET_TAIL_BYTES = 29` against the real `fakeCompozy` daemon path: gap (see F3).

### Well covered
- The fallback chain in `makeRunRoot` (fits, over the limit, unusable, both unusable). Each branch has its own test, the negative paths included, and each asserts that nothing was written to a folder that does not fit.
- The leftover check under the new short root.

Seams and gaps are listed above. No blocking gap: the main seam (a long TMPDIR, so the root goes to the real /tmp and a socket binds) is proven by a real bind in a child process, and the fallback chain is covered branch by branch. The two important gaps, F1 and F2, are follow-ups and do not reject the change alone. I ran `node scripts/test-suite.mjs plugins/openspec/hooks/test-suite.test.mjs` once: 28 pass, 0 fail. I did not run the whole suite.
