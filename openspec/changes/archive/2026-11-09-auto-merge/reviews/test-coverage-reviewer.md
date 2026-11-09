Verdict: approved
Commit: cba2f4484a9452a95615ee6eba015bb21ecc1f98

## Coverage analysis — auto-merge (round 2, re-review), 55722bf..cba2f44

In-scope surfaces: plugins/openspec/hooks (deliver-check, merge-setup), plugins/openspec/skills/openspec-setup (github-setup, template), docs/openspec-flow.md pin.
Blocking gaps (8-10 without a plan): 0
Seams checked (read only, mutation runs: 0):
- collectState → mergeSetup(method) wire (deliver-check.mjs:813) → caught by `merge setup stops: merge_method rebase with rebase merges off...` (deliver-check.test.mjs:1776). With `shipRepo({ method: 'rebase' })` and `allow_rebase_merge: false`, a hard-coded or dropped method falls back to squash (`allow_squash_merge` true), the preflight passes, the step becomes `enable-auto-merge`, and `assert.equal(n.step, 'stop-merge-setup')` and the `/rebase merges are not allowed/` match go red. Confirmed by reading; I did not run the mutation.
- Items 6/7/8 in merge mode through the real collector → caught by :1912 (unresolved thread → `answer` with the thread url and `items[6].status === 'open'`; failing check → `fix-checks` with the failing list; bad body → `edit-pr-body`) and :1932 (`autoMergeRequest` set → `disable-auto-merge`, with `number` 12). Both build state with `mergeReady()` fixtures and `runCli`, not `withItem`. A wrong `merged` shortcut or a wrong item computation changes the step and fails these asserts.
- gh timeout in the shared runner → caught by :2012 (`makeGh(..., 400)` against a fake gh that sleeps 8 s). If `timeoutMs` were ignored, the call would take 8 s and the `< 5000` assert, `timedOut === true` and `/timed out/` all fail.
- Stalled poll in `waitForMerge` → caught by :2029 (poll 2 sleeps 15 s, `--watch=0.025`). Without the per-call `timeout` the run takes 15 s and fails `< 9000`; the `timedOut: true` and summary asserts also go red.
- One gh runner → :2023 is a source-text assert (`spawnSync('gh'` absent from deliver-check.mjs and github-setup.mjs). It can go red, but it only guards against the regex pattern (see nit).
- Paginated check-run discovery → caught by github-setup.test.mjs:106. It asserts `--paginate` on the recorded call, 45 unique names plus the dedupe of `job-3`, `devkit-reviews` filtered out, 46 required checks, and the confirm line. The fixture uses the real per-line `--jq` output shape.
- Sha pin of the workflow → caught by github-setup.test.mjs:174 (the URL holds the sha, the tag is never in a URL, a comment names the tag, no `{{..}}` left, the tag GET is on the call log), :193 (annotated tag dereferenced), :202 and the following test (tag missing → deferred and nothing written; other error → `error`, exit 1, no file). The template comment is pinned by merge-setup.test.mjs:69 and the doc pin by deliver-check.test.mjs:2751.

### Findings
- [important] [6] The merge_method → preflight wire is untested through the collector · fixed in cba2f44
- [important] [5] Items 6, 7 and 8 in merge mode are covered only by hand-built state · fixed in cba2f44
- [nit] [3] The `devkit-reviews` failing → `blocked: item 6` case (R-7) is still only on a hand-built state (round 1 nit, unchanged). Low risk, left as is.
- [nit] [3] `encodeURIComponent(branch)` in `requiredChecks` (merge-setup.mjs) and `discoverContexts` (github-setup.mjs) is new, and every test uses `main`. A default branch like `release/1.x` would not be asserted to be encoded. Write in: merge-setup.test.mjs (rules route key) and github-setup.test.mjs.
- [nit] [3] `waitForMerge` returns `done(left <= GH_TIMEOUT_MS)` on a timed-out poll. The test at :2029 covers the "cut at the cap" side (`timedOut: true`). The side where gh stalls for 60 s with more time left (`timedOut: false`) has no test.
- [nit] source-text test: deliver-check.test.mjs:2023 asserts the absence of the literal `spawnSync('gh'` in two files. It catches the regression the runner dedup fixed, but a spawn through `execFileSync('gh', ...)` or a variable would pass. Behavior is already protected by :2012.
- [nit] mock-only/weak (round 1, still true): `noMergeCall(t)` empty asserts, now also in :1912, :1932 and :1776, cannot go red because deliver-check never calls `gh pr merge`. The step name asserts beside them are the real proof.
- [nit] impossible fixture (round 1, unchanged): `nextStep row 0a` pairs `merged: true` with `dirty` files. It only tests precedence.

### Cross-process items (real evidence, not unit tests)
- The `devkit-reviews` workflow running on GitHub, the ruleset, and AC-10 (PR merged by auto-merge) still need real evidence from the PR's own run (gh pr checks, dogfood.md, retro.md), not another unit test. Resolving the sha of the `v<version>` tag needs the tag to exist in chacal88/devkit, so the first `--apply workflow` after release should be recorded.
- Per the caller, the suite is green at 305 pass, 0 fail. I did not re-run it.

### Well covered
- merge_method reaches the preflight through the real collector — deliver-check.test.mjs:1776
- Open items 6/7/8 never enable auto-merge and disable it when it is already on — :1912, :1932 through `runCli`
- Per-call gh timeout in the shared runner and in the merge poll — :2012, :2029 (both wall-clock bounded, would go red if the timeout were dropped)
- Paginated discovery and sha-pinned workflow with tag deref, missing and failing lookups — github-setup.test.mjs:106, :174-:202
- Everything listed as covered in round 1 is untouched by this range, apart from the `ghError` and runner moves, which the tests above exercise.
