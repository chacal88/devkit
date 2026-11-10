Verdict: approved
Commit: 7484e4795c0e9694ee9f86874a14af6a61562e3e

## Quality review — conduct-rounds (round 2)

### Findings
- [important] plugins/openspec/hooks/release-rebase.mjs:258 — post-rebase `try` rethrew non-`ReleaseError` exceptions (malformed manifest, write error), leaving the branch rebased and exiting 1 with a stack trace · fixed in dd407bd. The catch now handles every error (`e instanceof Error ? e.message : String(e)`) and calls `unresolved({ conflicts: [], error })`, so the tree is restored and the exit is 2. The new test `release-rebase: an invalid JSON manifest on the branch restores to oldHead with exit 2` (release-rebase.test.mjs:256) asserts exit 2, `resolved: false`, HEAD equal to oldHead, a clean `git status` and no `.git/rebase-merge`. This is the case I asked for. (The test puts the broken JSON on the branch, not on the base as I suggested. It reaches the same catch-all path.)
- [nit] plugins/openspec/hooks/conduct-check.mjs:489 — `selectDispatch` still receives the raw `--busy` list, not the filtered `busyIds`. This is unchanged and safe, because it only under-dispatches. The implementer decides.
- [nit] plugins/openspec/hooks/deliver-check.mjs (`started` exemption) — the soft `approval.md` gate is still open. Partly mitigated: dd407bd makes `approval.md` main-session only in every change folder, including with several active changes (guard.mjs:204, :349, :373). The "Never" list line is still optional.
- [praise] plugins/openspec/hooks/release-rebase.mjs:258 — the catch-all keeps the "restore, never leave a half-rebased branch" promise for every failure mode, not only the ones anticipated.
- [praise] plugins/openspec/hooks/deliver-check.mjs:517 — `conflict: true` as a structured field replaces `/has merge conflicts/` regex matching on prose in conduct-check. The tests pin it for both the change PR and the archive PR (conduct-check.test.mjs:636, :786).
- [praise] plugins/openspec/hooks/conduct-check.mjs:69 — an unmapped deliver-check step now stops the change with `unknown step <name>` instead of silently falling to actor `none`. A test pins it, including that it is never dispatched.

### Summary
- 3 findings (0 blocking, 0 important open, 2 nit) + 3 praise. The round-1 important is fixed.
- Justification: I checked only my previous findings and `git diff 8f6f2bd..dd407bd` on the .mjs files. I did not re-run the suite and relied on the supplied result (gate green, 534 tests, 0 fail; check.py, catalog and plugin validate passed). The extra changes in the fix commit (the `--wake` marker, approval.md gating when several changes are active, the `gh pr create` fallback to the session root) each come with tests and introduce no new blocking defect. Only nits remain, so the verdict is `approved`.

### Stale-only re-review at 9cd3265 (merge of origin/main, devkit-opt-in 0.7.1)
- Checked only `git diff dd407bd..9cd3265` outside `openspec/changes/archive`. The suite was not re-run; I relied on the supplied gate result (535 tests, 0 fail, check.py, gen-catalog --check, plugin validate green).
- The merge adds no new `.mjs` logic. In `guard.test.mjs` both sides' tests are kept: main's migration-doc assertions (mktemp, `--scope` or empty folder, `cp -n` plus tmp then mv) and the conduct-rounds worktree tests. No test was dropped or duplicated.
- Versions are consistent: devkit-core 0.5.2 in `plugin.json` and `marketplace.json`; the CHANGELOG has both the 0.8.0 and 0.7.1 entries. `tdd-implementer.md` gets main's one-line PID-only rule.
- No new finding. The two nits above stay open and optional. Verdict unchanged: approved.

### Stale-only re-review at 7484e47 (hermetic --ci fixtures)
- Checked only `git diff 9cd3265..7484e47 -- plugins/`. The change is test-only: `GITHUB_BASE_REF` and `GITHUB_EVENT_PATH` are cleared in `cleanEnv` and `cli()` (conduct-check.test.mjs:17, :1049) and in `shipRepo` and `devkitRepo` (deliver-check.test.mjs:1425, :1450). It fixes a CI-only failure where the runner's own env leaked into the `--ci` fixtures. No production code changed.
- I relied on the supplied results (CI-like env 1567/1567; gate 535/535; check.py passed) and did not re-run them.
- [praise] deliver-check.test.mjs:1425 — the fixture env is made hermetic against the CI variables instead of relying on the runner's state.
- No new finding. The two nits above stay open and optional. Verdict unchanged: approved.
