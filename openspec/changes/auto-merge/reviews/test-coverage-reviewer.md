Verdict: approved
Commit: 55722bf6a30ec7d49ebea78efb3187222f1d0ca5

## Coverage analysis — auto-merge (round 1), origin/main..HEAD

In-scope surfaces: plugins/openspec/hooks (deliver-check, merge-setup, guard), plugins/openspec/skills/openspec-setup (github-setup, SKILL, template), ship-change SKILL (format tests), docs sweep.
Blocking gaps (8-10 without a plan): 0
Seams checked (read, no mutation runs: 0):
- nextStep enable only at 8/8 → caught by `AC-2: with any one of items 1-8 open or blocked...` (deliver-check.test.mjs:1735, 16 cases plus the 8/8 control) and by the collector-driven walkthrough (:1980) and `merge mode: 8/8 ...` (:1802)
- disable-auto-merge after regression → `nextStep row 0b` (:1656, 9 states) plus the walkthrough through collectState with a real product commit (:1980)
- MERGED lookup after branch deletion → `carry-over` tests (:1852, :1862, :1875) through collectState and the CLI; `pr list --head ... --state all` asserted on the call log
- preflight block → `merge setup stops` (:1750) through collectState and CLI (exit 2, summary, JSON, no `pr merge` call); fail-closed on gh error (:1775)
- --ci items 1-4 → :2415-:2487 with real git repos (stale review, undisposed finding, AC without row, no proof, gate row, readiness); selection 1-4 (:2531-:2598); shallow and head-sha preflight (:2612, :2625); guard.mjs ci delegation, lone copy, symlink (guard.test.mjs)
- github-setup dry run → `plan (no --apply)` asserts no `-X` call and no file; every write in the script goes through `-X` (github-setup.mjs:181, :184), so the detector matches the code; idempotent second run asserts all `ok` and zero writes
- collectState → mergeSetup(method) wire (deliver-check.mjs:813) → GAP, see below
- human gate (devkit readiness APPROVED) in merge mode → caught through the real collector by `merge mode keeps the human plan gate` (:1783, devkitRepo + collectState)

### Findings
- [important] [6] The merge_method → preflight wire is untested through the collector — failure: `deliver-check.mjs:813` passes `mergeMethod` to `mergeSetup`. If it were hard-coded to `squash` or dropped, a repo with `merge_method: rebase` and `allow_rebase_merge` off would get `enable-auto-merge --rebase` instead of `stop-merge-setup`; `mergeSetup`'s unit test (merge-setup.test.mjs:121) passes the method itself and the collector tests (:1608, :1815) keep all `allow_*` true, so nothing goes red · write in: deliver-check.test.mjs next to `merge setup stops` (:1750): `shipRepo({ ship: 'merge', method: 'rebase' })` + `presetSetup(t.gh, { repo: { allow_rebase_merge: false } })`, expect `stop-merge-setup` and `/rebase merges are not allowed/`
- [important] [5] Items 6, 7 and 8 in merge mode are covered only by hand-built state — failure: the AC-2 matrix (:1735) and row 0b (:1656) run on `metState`/`withItem`; the walkthrough only drives items 1, 2, 4, 5 through the real collector. A regression where `collectState` mis-computes item 7 or 6 for the merge-mode PR shape (for example the `merged` shortcut at deliver-check.mjs:788-789 applied too broadly) would not be caught by a merge-mode test · write in: deliver-check.test.mjs, one test using `mergeReady()` with `gh` fixtures for an unresolved thread and for a failing check, expecting `answer` / `fix-checks` and never `enable-auto-merge`; with `autoMergeRequest` set, expect `disable-auto-merge`
- [nit] [4] R-7 (`devkit-reviews` failing → `blocked: item 6`) is tested only on a hand-built state (:1704); the name match against real `gh pr checks` output is covered separately by item 6 tests, so risk is low · write in: deliver-check.test.mjs, via `mergeReady()` with a `pr-checks` fixture
- [nit] mock-only/weak: `walkthrough (merge)` asserts `noMergeCall(t)` empty (:2027) and `merge setup stops` asserts the same; `deliver-check` never calls `gh pr merge`, so this assert cannot go red. Harmless, but it is not the AC-2 proof; the real proof is the step names
- [nit] impossible fixture: `nextStep row 0a` (:1651) combines `merged: true` with `dirty: ['src/a.ts']`; the collector can emit that only with uncommitted files after a merge, fine as a precedence test, not a producer state worth certifying beyond ordering

### Cross-process items (real evidence, not unit tests)
- The `devkit-reviews` workflow running on GitHub, the ruleset, and AC-10 (PR merged by auto-merge) are pinned only by text tests. Phase 5 of tasks.md is unticked; AC-10 must be recorded from the PR's own run (gh pr checks, dogfood.md, retro.md), not from another unit test.
- Run status: `node --test plugins/openspec/hooks/guard.test.mjs` was still running when this review was written (over 4 minutes); I did not see a pass/fail summary. The author's phase gates must show it green in evidence.md.

### Well covered
- Enable only at 8/8 and the method/head in the step — :1717, :1735, :1802, :1815
- Disable then resume then re-enable then merged — walkthrough :1980 through the real collector with real commits
- Wait: poll until MERGED, cap, auto-merge off, head change, gh error, no poll outside wait-merge — :1914-:1968
- Preflight reasons exact text, fail-closed on unreadable settings, approval stop ordered before setup stop — :1686, :1750, :1775, :1783
- --ci: stale, finding, AC, no-proof, gate, readiness each fail with the right item; selection rules with real branches and a squash-merged leftover; bypass ignored; ship/merge_method not read — :2415-:2625
- github-setup: dry run writes nothing, per-item apply, deferred ruleset applies nothing, payload equals D8 via stdin, idempotent re-run, per-item write error, read error not applied over
- Docs sweep and ADR/tag-pin tests make AC-9 mechanical
