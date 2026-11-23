Verdict: approved
Commit: 7b9c499654e1b08818d7a4ff4a465fffb88e8d68

## Coverage analysis — remote-worker (30e6cbd..HEAD, round 2)

### Findings
- [important] plugins/openspec/hooks/machine-probe.mjs:30-36 (installationFor) — Choosing the pack installation was untested beyond one user-scope entry. It is now covered by 'the installation is the project-scoped one at or above the folder, else the user-scoped one' (roadmap-loop.test.mjs). That test checks project over user in both orders, a parent path, a trailing slash, a sibling that shares the prefix, and a path below the folder. · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [important] plugins/openspec/hooks/machine-probe.mjs:42-47 (state error paths) — The probe's own error replies were never asserted. The test 'the probe itself answers with an error and exit 3' (roadmap-loop.test.mjs) now runs the real probe. It covers pack not installed, no installPath, a missing file, invalid JSON and a failing inner status. It asserts exit 3, version 1 and the error text. · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [important] plugins/openspec/hooks/change-loop.mjs claimThroughGh — The gh read path had no assertion on its parse. The new test in change-loop.test.mjs injects a gh fake that returns the contents API shape. It asserts machine, places (a number, 'run' or null) and placed (true or false by approval.md) for three branches. · fixed in 7b9c499654e1b08818d7a4ff4a465fffb88e8d68
- [nit] plugins/openspec/hooks/change-loop.mjs:placeChange — There is still no test for `place` when the push is refused (a non-fast-forward) or when `fetch` fails. Nothing asserts that this does not read as taken.
- [nit] plugins/openspec/hooks/roadmap-loop.test.mjs:2896-2912 — The test is still implementation-coupled. It asserts the exact ssh timeouts (20_000, 120_000) and the argv prefix, so a legitimate tuning change turns it red.
- [praise] plugins/openspec/hooks/change-loop.test.mjs AC-3 — The claim race of two clones opening one id is exercised through real clones and a real origin.
- [praise] plugins/openspec/hooks/roadmap-loop.test.mjs AC-9 checkout — The real machine-probe `checkout` runs on a real second clone. It asserts the HEAD sha, idempotence and the refusal cases.
- [praise] plugins/openspec/hooks/roadmap-loop.test.mjs probeState — The new probe tests spawn the real machine-probe.mjs against a temporary HOME and fake pack folders. They check the probe's behavior instead of the mock's canned answer, so breaking `failWith`, `exitCode = 3` or the scope match turns them red.

In-scope surfaces: plugins/openspec hooks (change-loop, roadmap-loop, machine-probe, run-file).
Blocking gaps (8-10 without a plan): 0
Seams checked: probe installation choice -> caught by the scope and path test in roadmap-loop.test.mjs; probe error replies -> caught by the exit 3 test; gh claim parse -> caught by the new listing test in change-loop.test.mjs; open claim -> origin push -> caught by AC-2 and AC-3; claim refusal from a remote branch -> caught by AC-1; take-place step -> `place` command -> caught by AC-10; stale-view wake -> caught by AC-11; machines config validation -> caught by AC-7; probe `checkout` -> caught by AC-9. Mutation runs: 0.

The round-2 changes are test-only (78 added lines in two test files). evidence.md reports 1428/1428 at HEAD.

### Well covered
- Pack installation choice on the other machine: project scope, path boundaries, user fallback.
- The probe's error contract: message and exit code for each failure.
- The gh read of a stale clone's claims: placed, machine and places parsing.
