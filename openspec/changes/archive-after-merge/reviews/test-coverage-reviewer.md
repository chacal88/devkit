Verdict: rejected
Commit: e497cc29002c8cda9fdddbe2c945f7ed95e65479

## Coverage analysis — archive-after-merge, dac9784..e497cc2

In-scope surfaces: plugins/openspec/hooks (deliver-check.mjs, guard.mjs, merge-setup.mjs), ship-change SKILL, docs/ADRs.
Blocking gaps (8-10 without a plan): 1
Seams checked: P13 file check before first open → caught by `P13 stops with stop-archive apply-proposals…` (deliver-check.test.mjs:3407); P13 on an OPEN archive PR / push path → GAP; AC-2 unanswered proposals → caught by P8 test (:3282); AC-5 pr mode never merges → P3i (:3249); skill names every emitted step → format test (:2500); archive branch never selects another change → :2748/:2760; AC-8 bypass_actors on the real ruleset → gap (real evidence); mutation runs: 0 (read-only review).

### Findings
- [blocking] [8] P13 is skipped whenever an archive PR is already OPEN — failure: in `archiveNext` (deliver-check.mjs ~L895-915) the OPEN-PR branch returns `open-archive-pr` (when `headRel==='ahead'` or uncommitted), `update-branch`, `enable-auto-merge` or `wait-merge` before the `unnamedFiles` check (~L936-938), which only runs when `pr` is null. Sequence: P13 passes, PR opens, then a file no approved proposal names (e.g. `src/other.ts`) is committed/pushed or already sits in the PR head (same head, clean tree) → next step is `enable-auto-merge`/`open-archive-pr` push with no file check, and in `merge` mode GitHub auto-merges it without review. This is the gate the change exists for (AC-3, R-5, design R3). No test goes red: P3d (:3218) and P3f-h (:3226) only use `CONTRIBUTING.md`, the named file; every P13 test (:3388-3425) uses `archivePrs: []`. Write in: deliver-check.test.mjs, post-merge section, using `onArchiveBranch({ archivePrs:[archivePrJson({headRefOid: head})], files:{'CONTRIBUTING.md':…,'src/other.ts':…} })`: assert `stop-archive/apply-proposals` (not `enable-auto-merge`) for same-head, ahead and dirty-tree variants, and that `disable-auto-merge` wins when auto-merge is already on. Fix may need code (move the file check before P3d/P3g) — a code change, flagged, not widened here.
- [important] [6] AC-8 (ruleset without bypass actors) and AC-5 on GitHub (auto-merge actually enabled on the archive PR) are cross-process claims proven only by unit tests on the fake gh and string checks on the skill (:2517). `merge-setup.mjs:118` sets `bypass_actors: []` for new setups, but nothing reads the live ruleset. Write in: evidence.md / retro `## Dogfood` — `gh api repos/{owner}/{repo}/rulesets/<id> --jq .bypass_actors` returns `[]`, plus the archive PR's `autoMergeRequest` from `gh pr view`. Real-evidence item, not another unit test.
- [important] [5] `openspec/` is exempt wholesale in `unnamedFiles` (deliver-check.mjs:~751, tested as "ok" at :3398): an archive-branch edit to `openspec/config.yaml` (ship mode, merge_method) or another change's folder passes P13 and auto-merges. Either accept explicitly in ADR 0003 (it is not listed as such in the P13 tests' intent) or restrict to `openspec/changes/<id>/`, `openspec/changes/archive/<date>-<id>/` and `openspec/roadmap.md`; then add a bad-case row to the `bad` table at :3408.
- [nit] implementation-coupled: deliver-check.test.mjs:~3380 `assert.doesNotMatch(src, /step\('merged'/)` greps production source text instead of the behavior (already covered by the nextStep test at :1706).
- [nit] implementation-coupled: :3368 `Object.keys(j.archive)` fixes key order of the JSON; a harmless reorder goes red.

### Well covered
- Retro answers gate (AC-2): P8 loops over each proposal left unanswered and asserts no archive PR step is reachable (:3282).
- P13 first-open file check: exact path, `./` normalisation, no prefix/glob/directory matching, rejected-proposal target, untracked files, missing origin/<base> (:3388-3425).
- Post-merge state reads: archived listing vs 404 vs other errors vs gh timeout, PR selection OPEN > MERGED > CLOSED (:3056-3096); pr mode never calls `pr merge` (:3249).
- Archive branch never selects a contained open change in hooks and `--ci` (:2748-2775); real history ids (auto-merge #5 vs archive #6) (:2948).
- Skill/checker drift: every emitted step has a table row in SKILL.md (:2500).
