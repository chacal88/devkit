Verdict: approved
Commit: dd407bd

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
